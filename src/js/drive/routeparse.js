// Turns an OSRM /route/v1 response (steps=true, geometries=geojson, overview=full) into the data the drive display needs:
// a maneuver list with real distances and exit numbers, a resampled route polyline, and city / highway legs with real durations.

const RAD = Math.PI / 180;
export function haversine(a, b) {            // [lat, lon] pairs -> metres
  const dLat = (b[0] - a[0]) * RAD, dLon = (b[1] - a[1]) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * RAD) * Math.cos(b[0] * RAD) * Math.sin(dLon / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(h));
}

const isInterstate = (ref) => /^I[ -]?\d+/.test(ref || '');
const tidyRef = (ref) => (ref || '').split(';')[0].replace(/^I /, 'I-').replace(/^(US|SR|FL|CR) (\d)/, '$1-$2');

function arrowFor(type, mod) {
  const m = mod || 'straight';
  if (type === 'arrive') return 'arrive';
  if (type === 'off ramp') return 'exit';
  if (type === 'on ramp' || type === 'merge') return 'merge';
  if (type === 'fork') return m.includes('left') ? 'slightL' : 'slightR';
  if (m === 'slight left') return 'slightL';
  if (m === 'slight right') return 'slightR';
  if (m.includes('left') || m === 'uturn') return 'left';
  if (m.includes('right')) return 'right';
  return 'straight';
}

function roadLabel(s, type) {
  const ref = tidyRef(s.ref), name = s.name || '';
  const dest = (s.destinations || '').split(',')[0].replace(/^(I|US|SR|FL) /, (m) => m.trim() + '-');
  if (type === 'off ramp') {
    const exit = s.exits ? `Exit ${s.exits}` : 'Exit';
    return dest ? `${exit}: ${dest}` : name ? `${exit}: ${name}` : `${exit}${ref ? ': ' + ref : ''}`;
  }
  if (type === 'on ramp') return dest ? `Ramp to ${dest}` : ref ? `Ramp to ${ref}` : name ? `Ramp to ${name}` : 'Highway ramp';
  if (ref && name && !/^(Interstate|US Highway|State Road)/.test(name)) return `${ref} · ${name}`;
  return ref || name || 'Continue';
}

/** project lat/lon -> local metres (x east, y south) */
function project(coords, lat0, lon0) {
  const kx = 111320 * Math.cos(lat0 * RAD), ky = 110574;
  return coords.map(([lon, lat]) => [(lon - lon0) * kx, -(lat - lat0) * ky]);
}
function resample(pts, n) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = cum[cum.length - 1] || 1, out = [];
  let j = 0;
  for (let k = 0; k <= n; k++) {
    const d = (k / n) * L;
    while (j < cum.length - 2 && cum[j + 1] < d) j++;
    const seg = cum[j + 1] - cum[j] || 1, t = Math.min(1, Math.max(0, (d - cum[j]) / seg));
    out.push([pts[j][0] + (pts[j + 1][0] - pts[j][0]) * t, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * t]);
  }
  return out;
}

/** Classify each step as highway / city by its real average speed, then merge into legs. */
function buildLegs(steps, total) {
  let at = 0;
  const raw = steps.map((s) => {
    const v = s.duration > 0 ? s.distance / s.duration : 0;
    const hw = (v >= 21 && s.distance >= 250) || (isInterstate(s.ref) && s.distance >= 250);
    const r = { kind: hw ? 'highway' : 'city', start: at, end: at + s.distance };
    at += s.distance; return r;
  });
  let legs = [];
  for (const r of raw) {
    const last = legs[legs.length - 1];
    if (last && last.kind === r.kind) last.end = r.end; else legs.push({ ...r });
  }
  // fold short city gaps between highway pieces and short highway slivers into their neighbours
  for (let pass = 0; pass < 3; pass++) {
    legs = legs.map((l, i) => {
      const len = l.end - l.start, inner = i > 0 && i < legs.length - 1;
      if (l.kind === 'city' && inner && len < 1500 && legs[i - 1].kind === 'highway' && legs[i + 1].kind === 'highway') return { ...l, kind: 'highway' };
      if (l.kind === 'highway' && len < 2500) return { ...l, kind: 'city' };
      return l;
    });
    const merged = [];
    for (const l of legs) { const last = merged[merged.length - 1]; if (last && last.kind === l.kind) last.end = l.end; else merged.push({ ...l }); }
    legs = merged;
  }
  if (legs.length) legs[legs.length - 1].end = total;
  return legs;
}

/**
 * @param {object} json   OSRM response
 * @param {{name:string, from:string}} meta
 * @returns route object or null
 */
export function parseOSRM(json, meta = {}) {
  const r = json?.routes?.[0];
  if (json?.code !== 'Ok' || !r) return null;
  const steps = r.legs.flatMap((l) => l.steps);
  if (!steps.length) return null;
  const maneuvers = [];
  let at = 0;
  const cumD = [0], cumT = [0];
  steps.forEach((s, i) => {
    const mt = s.maneuver.type, mod = s.maneuver.modifier;
    const keep = i > 0 && (['turn', 'end of road', 'fork', 'off ramp', 'on ramp', 'merge', 'roundabout', 'rotary', 'roundabout turn', 'arrive'].includes(mt)
      || ((mt === 'new name' || mt === 'continue') && (s.distance > 2500 || (s.ref && isInterstate(s.ref) && at > 0))));
    if (keep) {
      const type = mt === 'arrive' ? 'arrive' : arrowFor(mt, mod);
      maneuvers.push({ type, road: mt === 'arrive' ? (meta.name || s.name || 'Destination') : roadLabel(s, mt), at, shield: isInterstate(s.ref) && mt !== 'arrive' ? tidyRef(s.ref) : null, exit: s.exits || null });
    }
    at += s.distance; cumD.push(at); cumT.push(cumT[cumT.length - 1] + s.duration);
  });
  const total = at;
  if (!maneuvers.length || maneuvers[maneuvers.length - 1].type !== 'arrive') maneuvers.push({ type: 'arrive', road: meta.name || 'Destination', at: total, shield: null });
  // drop maneuvers that are within 60 m of the previous one (roundabout chatter)
  const cleaned = maneuvers.filter((m, i) => i === 0 || m.type === 'arrive' || m.at - maneuvers[i - 1].at > 60);
  const coords = r.geometry.coordinates;
  const lat0 = coords[0][1], lon0 = coords[0][0];
  return {
    name: meta.name, from: meta.from,
    total, duration: r.duration,
    maneuvers: cleaned,
    route: resample(project(coords, lat0, lon0), 320),
    legs: buildLegs(steps, total),
    cumD, cumT,
  };
}
