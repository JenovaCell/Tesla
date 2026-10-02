// Fake-but-consistent trip data for the navigation panel: maneuver list, ETA, remaining distance.
// All distances are in metres internally.

const MI = 1609.344;

const HWY_ROADS = [
  ['I-85 N', 'interstate'], ['SC-11/Walhalla', 'exit'], ['SC-11/Cherokee Foothills Scenic Hwy', 'exit'], ['S Highway 11', 'turn'],
  ['Roy F. Jones Hwy', 'turn'], ['GA-316 E', 'highway'], ['I-85 N/Greenville', 'interstate'], ['US-29 N', 'highway'], ['Lake Hartwell Rd', 'turn'],
  ['Exit 54 / Easley', 'exit'], ['Old Greenville Hwy', 'turn'], ['Keowee Vineyards Dr', 'turn'],
];
const CITY_ROADS = [
  'N Goldwater Blvd', 'E Mockingbird Ln', 'E Cheney Dr', 'N Scottsdale Rd', 'E Stetson Dr', 'W Olympic Blvd', 'E 5th Ave', 'Gilmerton Ave',
  'Camelback Rd', 'N Hayden Rd', 'E Indian School Rd', 'S Mill Ave', 'W University Dr', 'Palm Canyon Dr',
];
const DESTS_HWY = ['The Cliffs at Keowee Vineyards', 'Greenville Downtown Supercharger', 'Lake Keowee Overlook', 'Asheville Outlets'];
const DESTS_CITY = ['Barrio Queen', '2930 Gilmerton Ave', 'Whole Foods Market', 'Kierland Commons', 'Old Town Scottsdale'];

function rng(seed) {
  let a = seed | 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export class Trip {
  constructor(kind = 'highway', seed = 1) {
    this.base = kind;
    const r = rng(seed * 977 + 13);
    this.r = r;
    this.traveled = 0;
    if (kind === 'long') {
      // one door-to-door drive of 35-45 minutes: neighbourhood streets, a long highway leg, then city streets to the destination
      this.minutes = 35 + r() * 10;
      this.startDist = (0.7 + r() * 0.4) * MI;
      this.endDist = (0.8 + r() * 0.4) * MI;
      this.total = this.startDist + this.endDist + Math.max(10 * MI, (this.minutes * 60 - 290) * 29);
      this.dest = r() < 0.5 ? DESTS_HWY[Math.floor(r() * DESTS_HWY.length)] : DESTS_CITY[Math.floor(r() * DESTS_CITY.length)];
      this.avgSpeed = this.total / (this.minutes * 60);
      this.maneuvers = [];
      let at = 0.1 * MI + r() * 0.1 * MI;
      const city = () => ({ type: ['right', 'left', 'straight', 'right', 'left'][Math.floor(r() * 5)], road: CITY_ROADS[Math.floor(r() * CITY_ROADS.length)], shield: null });
      while (at < this.startDist - 0.2 * MI) { this.maneuvers.push({ ...city(), at }); at += (0.16 + r() * 0.2) * MI; }
      at = this.startDist + 0.1 * MI + r() * 0.5 * MI;
      this.maneuvers.push({ ...this._man(at, 0), at });
      const hwyEnd = this.total - this.endDist;
      while (at < hwyEnd - 6 * MI) { at += (4 + r() * 30) * MI; if (at < hwyEnd - 3 * MI) this.maneuvers.push({ ...this._man(at, this.maneuvers.length), at }); }
      at = hwyEnd + 0.05 * MI;
      this.maneuvers.push({ type: 'exit', road: CITY_ROADS[Math.floor(r() * CITY_ROADS.length)], at: hwyEnd - 0.3 * MI, shield: null });
      while (at < this.total - 0.2 * MI) { this.maneuvers.push({ ...city(), at }); at += (0.14 + r() * 0.2) * MI; }
      this.maneuvers.push({ type: 'arrive', road: this.dest, at: this.total, shield: null });
      this.maneuvers.sort((a, b) => a.at - b.at);
    } else if (kind === 'highway') {
      this.total = (90 + r() * 70) * MI;
      this.dest = DESTS_HWY[Math.floor(r() * DESTS_HWY.length)];
      this.avgSpeed = 29;       // m/s for ETA
      this.maneuvers = [];
      let at = 0;
      const first = 0.2 * MI + r() * 0.6 * MI;
      at = first;
      this.maneuvers.push(this._man(at, 0));
      while (at < this.total - 6 * MI) {
        at += (4 + r() * 38) * MI;
        this.maneuvers.push(this._man(at, this.maneuvers.length));
      }
      this.maneuvers.push({ type: 'arrive', road: this.dest, at: this.total, shield: null });
    } else {
      this.total = (0.45 + r() * 0.4) * MI;
      this.dest = DESTS_CITY[Math.floor(r() * DESTS_CITY.length)];
      this.avgSpeed = 10.5;
      this.maneuvers = [];
      let at = 0.08 * MI + r() * 0.08 * MI;
      while (at < this.total - 0.15 * MI) {
        this.maneuvers.push({ type: ['right', 'left', 'straight', 'right', 'left'][Math.floor(r() * 5)], road: CITY_ROADS[Math.floor(r() * CITY_ROADS.length)], at, shield: null });
        at += (0.14 + r() * 0.2) * MI;
      }
      this.maneuvers.push({ type: 'arrive', road: this.dest, at: this.total, shield: null });
    }
    // route shape for the map: unit-less polyline with a heading per maneuver
    this.route = this._shape();
  }
  _man(at, i) {
    const r = this.r;
    const [road, kind] = HWY_ROADS[(i * 3 + Math.floor(r() * HWY_ROADS.length)) % HWY_ROADS.length];
    const type = kind === 'exit' ? (r() < 0.5 ? 'exit' : 'slightR') : kind === 'turn' ? (r() < 0.5 ? 'left' : 'right') : 'straight';
    return { type, road, at, shield: kind === 'interstate' ? 'I-85' : null };
  }
  _shape() {
    // polyline in "map metres" with a gently winding highway or a grid-like city route
    const pts = [[0, 0]];
    let x = 0, y = 0, hd = this.base === 'city' ? -Math.PI / 2 : this.base === 'long' ? -Math.PI / 2 : -0.6;     // heading in radians (up = -y)
    const dirs = [];
    const mans = this.maneuvers;
    let prevAt = 0;
    for (let i = 0; i < mans.length; i++) {
      const L = mans[i].at - prevAt; prevAt = mans[i].at;
      const hwyLeg = this.base === 'highway' || (this.base === 'long' && mans[i].at > this.startDist + 0.3 * MI && mans[i].at < this.total - this.endDist - 0.2 * MI);
      if (hwyLeg) {
        const steps = 6;
        for (let s = 0; s < steps; s++) { hd += (this.r() - 0.5) * 0.28; x += Math.cos(hd) * L / steps; y += Math.sin(hd) * L / steps; pts.push([x, y]); }
      } else {
        x += Math.cos(hd) * L; y += Math.sin(hd) * L; pts.push([x, y]);
        const t = mans[i].type;
        if (t === 'right') hd += Math.PI / 2; else if (t === 'left') hd -= Math.PI / 2;
      }
    }
    return pts;
  }
  /** which leg of a 'long' trip we are on */
  get phase() { return this.base !== 'long' ? this.base : this.traveled < this.startDist ? 'start' : this.traveled < this.total - this.endDist ? 'highway' : 'end'; }
  get kind() { return this.base === 'long' ? (this.phase === 'highway' ? 'highway' : 'city') : this.base; }
  advance(m) { this.traveled = Math.min(this.total, this.traveled + m); }
  get remaining() { return Math.max(0, this.total - this.traveled); }
  get progress() { return this.traveled / this.total; }
  get etaSec() { return this.remaining / this.avgSpeed; }
  get nextIdx() { return Math.max(0, this.maneuvers.findIndex((m) => m.at > this.traveled + 1)); }
  get next() { const m = this.maneuvers[this.nextIdx]; return { ...m, dist: Math.max(0, m.at - this.traveled) }; }
  upcoming(n = 6) {
    const out = []; const i0 = this.nextIdx;
    for (let i = i0 + 1; i < this.maneuvers.length && out.length < n; i++) out.push({ ...this.maneuvers[i], dist: this.maneuvers[i].at - this.maneuvers[i - 1].at });
    return out;
  }
  /** point along the route polyline at fraction f (0..1) */
  pointAt(f) {
    const p = this.route; const n = p.length - 1;
    const u = Math.min(0.99999, Math.max(0, f)) * n, i = Math.floor(u), t = u - i;
    return { x: p[i][0] + (p[i + 1][0] - p[i][0]) * t, y: p[i][1] + (p[i + 1][1] - p[i][1]) * t, i, t, ang: Math.atan2(p[i + 1][1] - p[i][1], p[i + 1][0] - p[i][0]) };
  }
}

export function fmtDist(m, units = 'mi') {
  if (units === 'km') {
    if (m < 950) return `${Math.round(m / 10) * 10} m`;
    return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
  }
  const ft = m * 3.28084;
  if (ft < 900) return `${Math.max(50, Math.round(ft / 50) * 50)} ft`;
  const mi = m / MI;
  return `${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi`;
}
export function fmtDur(sec) {
  const m = Math.max(1, Math.round(sec / 60));
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} hr ${m % 60} min`;
}
