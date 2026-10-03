// High-detail model of the car being driven (one per selectable Tesla). Original, procedurally generated geometry:
// painted body with wheel arches and shut lines, translucent glass over a simple interior, turbine wheels with
// brake calipers, wrap-around light strips, mirrors and a licence plate. Rendered with a studio reflection map.
// Local model space: forward = -Z, right = +X, origin at ground centre.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { buildBodyGeometry, glassFactor, SPEC, vehicleSize, lerpPts, bodyHalfWidth, sstep, glowPlane } from './models3d.js';

const partCache = new Map();

/* ---------------------------------------------------------------- studio environment (for reflections) */
export function makeStudioEnv(renderer, theme) {
  const light = theme === 'light';
  const sc = new THREE.Scene();
  sc.background = new THREE.Color(light ? 0xaeb2bb : 0x08090c);
  const W = (v) => new THREE.Color(v, v, v);
  const panel = (w, h, pos, c) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); sc.add(m);
  };
  panel(16, 10, [0, 13, 0], W(light ? 3.2 : 2.4));                              // big overhead softbox
  panel(2.4, 12, [-10, 4, 0], W(light ? 2.6 : 2.0)); panel(2.4, 12, [10, 4, 0], W(light ? 2.6 : 2.0));   // side strips
  panel(12, 2.4, [0, 3, -12], W(light ? 2.0 : 1.5)); panel(12, 2.4, [0, 3, 12], W(light ? 1.8 : 1.1));  // front/back fills
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(50, 50).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: light ? 0xc9ccd3 : 0x0b0c10 }));
  floor.position.y = -1.2; sc.add(floor);
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(sc, 0.035).texture;
  pm.dispose();
  return tex;
}

/* ---------------------------------------------------------------- parts (cached per model) */
function surfaceZ(type, xAbs, front) {
  const { len: L, wid: W } = vehicleSize(type), sp = SPEC[type];
  if (sp.facet) return front ? -L / 2 - 0.004 : L / 2 + 0.004;
  let lo = 0, hi = L * 0.3;
  for (let i = 0; i < 26; i++) {
    const mid = (lo + hi) / 2;
    const w = bodyHalfWidth(front ? L - mid : mid, L, W / 2);
    if (w < xAbs) lo = mid; else hi = mid;
  }
  const xs = (lo + hi) / 2;
  return front ? -L / 2 + xs - 0.004 : L / 2 - xs + 0.004;
}

function railCurve(type, halfW, y, front, sag = 0.035) {
  const pts = [];
  for (let i = 0; i <= 28; i++) {
    const t = (i / 28) * 2 - 1, xa = Math.abs(t) * halfW;
    pts.push(new THREE.Vector3(t * halfW, y + sag * t * t, surfaceZ(type, xa, front)));
  }
  return new THREE.CatmullRomCurve3(pts);
}

function seamLines(base, type) {
  const { rings, xs, L } = base.userData;
  if (!rings) return null;
  const P = base.attributes.position, N = base.attributes.normal;
  const sp = SPEC[type];
  const segs = [];
  const nearest = (x) => { let bi = 0, bd = 1e9; xs.forEach((v, i) => { const d = Math.abs(v - x); if (d < bd) { bd = d; bi = i; } }); return bi; };
  const pt = (vi, off = 0.005) => [P.getX(vi) + N.getX(vi) * off, P.getY(vi) + N.getY(vi) * off, P.getZ(vi) + N.getZ(vi) * off];
  const add = (a, b) => segs.push(...a, ...b);
  const n = (rings[0].length) / 2;
  // vertical door lines (both sides)
  for (const f of [0.665, 0.44, 0.235]) {
    const R = rings[nearest(L * f)], belt = lerpPts(sp.belt, L * f);
    for (const side of [0, 1]) {
      const idx = side === 0 ? R.slice(0, n + 1) : [R[0], ...R.slice(n + 1).reverse()];
      const keep = idx.filter((vi) => P.getY(vi) > 0.42 && P.getY(vi) < belt - 0.02);
      for (let i = 0; i + 1 < keep.length; i++) add(pt(keep[i]), pt(keep[i + 1]));
    }
  }
  // hood and trunk cut lines across the top
  for (const [f, hiY] of [[0.745, 0.06], [type === 'modely' || type === 'modelx' ? 0.035 : 0.075, 0.06]]) {
    const R = rings[nearest(L * f)], belt = lerpPts(sp.belt, L * f);
    const path = [...R.slice(0, n + 1), ...R.slice(n + 1)];
    const keep = path.filter((vi) => P.getY(vi) > belt - hiY - 0.05);
    for (let i = 0; i + 1 < keep.length; i++) add(pt(keep[i], 0.004), pt(keep[i + 1], 0.004));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3));
  return g;
}

function wheelParts(type, wheelXs, axles) {
  const sp = SPEC[type], r = sp.wheelR;
  const tires = [], rims = [], calipers = [], liners = [];
  const cover = type === 'cybertruck';
  for (const z of axles) for (const sx of [-1, 1]) {
    const bw = wheelXs(z);
    const place = (g, dx = 0) => { g.translate(dx, 0, 0).scale(sx, 1, 1).translate(sx * 0, r, z); return g; };
    // tire (axis +X, outward = +X)
    const profile = [[0.6, -0.118], [0.8, -0.126], [0.955, -0.105], [1.0, -0.07], [1.0, 0.07], [0.955, 0.105], [0.8, 0.126], [0.6, 0.118]].map(([a, b]) => new THREE.Vector2(a * r, b));
    const tire = new THREE.LatheGeometry(profile, 30).rotateZ(-Math.PI / 2);
    tires.push(place(tire, bw));
    // rim pieces
    const parts = [];
    const face = new THREE.CylinderGeometry(0.62 * r, 0.62 * r, 0.02, 30).translate(0, 0.095, 0);
    parts.push(face);
    parts.push(new THREE.TorusGeometry(0.64 * r, 0.018, 8, 30).rotateX(Math.PI / 2).translate(0, 0.105, 0));
    if (cover) {
      parts.push(new THREE.CylinderGeometry(0.58 * r, 0.58 * r, 0.014, 30).translate(0, 0.108, 0));
    } else {
      const N = 20;
      for (let k = 0; k < N; k++) {
        const spoke = new THREE.BoxGeometry(0.034, 0.016, 0.5 * r).rotateY(0.45).translate(0, 0.108, 0.34 * r).rotateY((k / N) * Math.PI * 2);
        parts.push(spoke);
      }
    }
    parts.push(new THREE.CylinderGeometry(0.14 * r, 0.14 * r, 0.035, 16).translate(0, 0.11, 0));
    const rim = mergeGeometries(parts).rotateZ(-Math.PI / 2);
    rims.push(place(rim, bw));
    // brake caliper (inside the rim, upper rear) and arch liner (dark disc behind the wheel)
    const cal = new THREE.BoxGeometry(0.06, 0.16 * r * 2, 0.2).translate(-0.06, 0.55 * r, 0.16);
    calipers.push(place(cal, bw));
    liners.push(place(new THREE.CylinderGeometry(r * 1.32, r * 1.32, 0.012, 28).rotateZ(-Math.PI / 2), bw - 0.14));
  }
  return { tire: mergeGeometries(tires), rim: mergeGeometries(rims), caliper: mergeGeometries(calipers), archLiner: mergeGeometries(liners) };
}

function interiorGeometry(type, base) {
  const { len: L, wid: W } = vehicleSize(type);
  const [c0, c1] = base.userData.cabRange, span = c1 - c0;
  const zAt = (x) => L / 2 - x;
  const parts = [];
  const box = (w, h, d, x, y, z, color, rx = 0, rad = 0.05) => {
    let g = new RoundedBoxGeometry(w, h, d, 2, rad); if (g.index) g = g.toNonIndexed(); g.deleteAttribute('uv');
    if (rx) g.rotateX(rx);
    g.translate(x, y, z);
    const n = g.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = color[0]; col[i * 3 + 1] = color[1]; col[i * 3 + 2] = color[2]; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    parts.push(g);
  };
  const seat = [0.2, 0.2, 0.22], dash = [0.09, 0.09, 0.1], cream = type === 'modely' ? [0.62, 0.58, 0.52] : seat;
  const zF = zAt(c0 + span * 0.6), zR = zAt(c0 + span * 0.22), zD = zAt(c1 - 0.12);
  const hw = W / 2;
  for (const sx of [-1, 1]) {
    box(0.5, 0.13, 0.52, sx * 0.4, 0.52, zF, cream);
    box(0.5, 0.62, 0.12, sx * 0.4, 0.86, zF + 0.3, cream, 0.2);
    box(0.24, 0.16, 0.1, sx * 0.4, 1.2, zF + 0.34, cream);
  }
  box(1.34, 0.14, 0.5, 0, 0.54, zR, cream); box(1.34, 0.62, 0.12, 0, 0.86, zR + 0.3, cream, 0.15);
  box(hw * 1.5, 0.16, 0.5, 0, 0.9, zD, dash, -0.25, 0.06);
  box(0.26, 0.2, 1.0, 0, 0.58, (zF + zR) / 2, dash);
  return mergeGeometries(parts);
}

function getParts(type) {
  if (partCache.has(type)) return partCache.get(type);
  const { len: L, wid: W } = vehicleSize(type), sp = SPEC[type], hw = W / 2, r = sp.wheelR;
  const axles = [-L / 2 + 0.98, L / 2 - 0.98];
  const facet = !!sp.facet;
  const arches = axles.map((z) => ({ z, r, k: 1.34, depth: 0.27 }));
  const base = facet ? buildBodyGeometry(type) : buildBodyGeometry(type, { nst: 130, kh: 30, arches });
  const P = base.attributes.position, N = base.attributes.normal, info = base.userData.info;
  const gl = glassFactor(base, !facet);

  // ambient-occlusion colour for the paint; split triangles into paint / glass / roof liner
  const col = new Float32Array(P.count * 3);
  for (let i = 0; i < P.count; i++) {
    const f = info[i], y = P.getY(i), ny = N.getY(i);
    let ao = 0.5 + 0.5 * sstep(f.y0 + 0.02, f.y0 + 0.55, y);
    ao *= 1 - 0.45 * sstep(-0.1, -0.5, ny);
    if (!facet && f.cab > 0.12 && gl[i] < 0.5 && y > f.belt + 0.04 && Math.abs(N.getX(i)) > 0.25) ao *= 0.1;      // black B / C pillars
    if (!facet) {
      const z = P.getZ(i), ax = Math.abs(P.getX(i));
      // dark wheel wells
      for (const a of arches) { const d = Math.hypot(z - a.z, y - a.r), Ra = a.r * (a.k ?? 1.3); if (ax > hw * 0.4) ao *= 1 - 0.85 * sstep(Ra * 1.02, Ra * 0.8, d); }
      // unpainted dark lower bumpers / valances front and rear, and a dark sill
      const fromEnd = Math.min(z + L / 2, L / 2 - z);
      ao *= 1 - 0.8 * sstep(0.34, 0.2, y) * sstep(1.0, 0.55, fromEnd);
      ao *= 1 - 0.55 * sstep(0.3, 0.22, y);
    }
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = ao;
  }
  const colorAttr = new THREE.BufferAttribute(col, 3);
  const ia = base.index ? base.index.array : null;
  const nTri = ia ? ia.length / 3 : P.count / 3;
  const bodyIdx = [], glassIdx = [], linerIdx = [];
  for (let t = 0; t < nTri; t++) {
    const a = ia ? ia[t * 3] : t * 3, b = ia ? ia[t * 3 + 1] : t * 3 + 1, c = ia ? ia[t * 3 + 2] : t * 3 + 2;
    const avg = (gl[a] + gl[b] + gl[c]) / 3, ny = (N.getY(a) + N.getY(b) + N.getY(c)) / 3;
    const mx = Math.max(gl[a], gl[b], gl[c]);
    if (mx < 0.35) bodyIdx.push(a, b, c);
    if (mx >= 0.2) glassIdx.push(a, b, c);
    if (avg >= 0.5 && ny > 0.3) linerIdx.push(a, b, c);
  }
  const share = (idx, withColor) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', P); g.setAttribute('normal', N);
    if (withColor) g.setAttribute('color', colorAttr);
    g.setIndex(idx); return g;
  };
  const body = share(bodyIdx, true), glass = share(glassIdx, false);
  const lp = new Float32Array(P.array.length);
  for (let i = 0; i < P.count; i++) { lp[i * 3] = P.getX(i) - N.getX(i) * 0.035; lp[i * 3 + 1] = P.getY(i) - N.getY(i) * 0.035; lp[i * 3 + 2] = P.getZ(i) - N.getZ(i) * 0.035; }
  const liner = new THREE.BufferGeometry(); liner.setAttribute('position', new THREE.BufferAttribute(lp, 3)); liner.setIndex(linerIdx);

  const wheelXs = (z) => (facet ? hw * 0.97 : bodyHalfWidth(L / 2 - z, L, hw)) - 0.12;
  const wheels = wheelParts(type, wheelXs, axles);
  // arch liners sit just inside the (scooped) body surface
  const seams = seamLines(base, type);
  const interior = interiorGeometry(type, base);

  // lights: wrap-around tail strip, front bar/strips, plate
  const barW = (sp.bar ?? 0.78) * hw;
  const ty = Math.max(0.82, lerpPts(sp.belt, 0.14) - 0.09);
  const tail = new THREE.TubeGeometry(railCurve(type, barW, ty, false), 48, type === 'cybertruck' ? 0.026 : 0.02, 6);
  const hy = Math.max(0.64, lerpPts(sp.belt, L - 0.08) - 0.03);
  let head;
  if (type === 'model3' || type === 'models' || type === 'modely' || type === 'modelx') {                   // two slim angled units
    const mk = (s) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([0.3, 0.55, 0.8].map((t, i) => new THREE.Vector3(s * (t * hw), hy + 0.035 * (1 - i * 0.6), surfaceZ(type, t * hw, true)))), 12, 0.017, 6);
    head = mergeGeometries([mk(-1), mk(1)]);
  } else head = new THREE.TubeGeometry(railCurve(type, hw * (type === 'cybertruck' ? 0.9 : 0.78), hy, true, -0.02), 48, 0.016, 6);
  const plate = new THREE.BoxGeometry(0.32, 0.16, 0.012).translate(0, Math.max(0.55, ty - 0.3), surfaceZ(type, 0.01, false) + 0.004);

  const out = { body, glass, liner, seams, interior, ...wheels, tail, head, plate, L, W, hw, ty, cab: base.userData.cabRange };
  partCache.set(type, out);
  return out;
}

/* ---------------------------------------------------------------- public: the car */
export function buildEgo(type, opts = {}) {
  const P = getParts(type), { L, W, hw } = P, sp = SPEC[type];
  const tr = !!opts.transparent;
  const env = opts.envMap || null;
  const g = new THREE.Group();
  const mats = [];
  const reg = (m) => { mats.push(m); return m; };
  const paint = reg(new THREE.MeshPhysicalMaterial({
    vertexColors: true, color: opts.tint ?? 0xcccccc, metalness: type === 'cybertruck' ? 0.75 : 0.45, roughness: type === 'cybertruck' ? 0.4 : 0.42,
    clearcoat: type === 'cybertruck' ? 0 : 0.55, clearcoatRoughness: 0.2, envMap: env, envMapIntensity: opts.envIntensity ?? 1.0, flatShading: !!sp.facet, transparent: tr,
  }));
  const add = (geo, mat, order) => { const m = new THREE.Mesh(geo, mat); m.renderOrder = order; g.add(m); return m; };
  add(P.body, paint, 3);                                                       // child 0 = body (scene uses it for the rim outline)
  add(P.interior, new THREE.MeshLambertMaterial({ vertexColors: true, transparent: tr }), 4);
  const glass = reg(new THREE.MeshPhysicalMaterial({
    color: 0x07080b, metalness: 0.25, roughness: 0.05, transparent: true, opacity: 0.8, envMap: env, envMapIntensity: 0.7, depthWrite: false, clearcoat: 1,
  }));
  add(P.glass, glass, 6);
  if (P.seams) { const ls = new THREE.LineSegments(P.seams, new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false })); ls.renderOrder = 5; g.add(ls); }
  // wheels
  add(P.tire, new THREE.MeshLambertMaterial({ color: 0x0b0b0d, side: THREE.DoubleSide, transparent: tr }), 4);
  add(P.rim, reg(new THREE.MeshStandardMaterial({ color: type === 'cybertruck' ? 0x8a8d94 : 0x2c2d33, metalness: 0.85, roughness: 0.32, envMap: env, side: THREE.DoubleSide, transparent: tr })), 4);
  add(P.caliper, new THREE.MeshLambertMaterial({ color: 0xc8202a, side: THREE.DoubleSide, transparent: tr }), 4);
  // lights + plate
  const tailMat = new THREE.MeshBasicMaterial({ color: 0x8a1212 });
  add(P.tail, tailMat, 7);
  add(P.head, new THREE.MeshBasicMaterial({ color: 0xf3f7ff }), 7);
  add(P.plate, new THREE.MeshBasicMaterial({ color: 0xe4e5e8, transparent: tr }), 5);
  // mirrors
  const mirrorMat = reg(new THREE.MeshPhysicalMaterial({ color: opts.tint ?? 0xcccccc, metalness: 0.5, roughness: 0.32, clearcoat: 1, envMap: env, transparent: tr }));
  const mirrorX = hw + 0.04, mirrorZ = -L / 2 + L * 0.33, mirrorY = lerpPts(sp.belt, L * 0.68) + 0.04;
  for (const sx of [-1, 1]) {
    const m = add(new RoundedBoxGeometry(0.2, 0.11, 0.24, 2, 0.04), mirrorMat, 5);
    m.position.set(sx * mirrorX, mirrorY, mirrorZ); m.rotation.y = sx * 0.12;
  }
  // turn-signal pips + brake/head glows (used by the driving view)
  const bm = () => new THREE.MeshBasicMaterial({ color: 0xff9a1a, transparent: true, opacity: 0 });
  const blinkL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.05), bm()), blinkR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.05), bm());
  blinkL.position.set(-hw * 0.84, P.ty - 0.1, L / 2 - 0.12); blinkR.position.set(hw * 0.84, P.ty - 0.1, L / 2 - 0.12);
  blinkL.renderOrder = blinkR.renderOrder = 7; g.add(blinkL, blinkR);
  const brakeGlow = glowPlane('255,40,30', W * 2.2, 5.5); brakeGlow.position.set(0, 0.04, L / 2 + 2.0); g.add(brakeGlow);
  let headGlow = null;
  if (opts.headGlow) { headGlow = glowPlane('255,255,255', W * 2.6, 9); headGlow.position.set(0, 0.04, -L / 2 - 3.2); headGlow.material.opacity = 0.5; g.add(headGlow); }
  g.userData = {
    tailMat, blinkL, blinkR, bodyMat: paint, brakeGlow, headGlow, type,
    setEnv(tex) { for (const m of mats) { m.envMap = tex; m.needsUpdate = true; } },
    setPaint(hex) { paint.color.set(hex); mirrorMat.color.set(hex); },
  };
  return g;
}
