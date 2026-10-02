// Vehicle models for the driving visualisation (original geometry, generated procedurally).
// Bodies are smooth "lofts": rounded cross-sections swept along the length of the car.
// Local model space: forward = -Z, right = +X, origin at ground centre of the vehicle.
import * as THREE from 'three';
import { CAR_SIZE } from './world.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

function lerpPts(pts, x) {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0); }
  return pts[pts.length - 1][1];
}
// smoothed piecewise-linear profile (removes sharp creases)
function prof(pts, x, r) {
  const k = [-2, -1, 0, 1, 2], w = [1, 2, 3, 2, 1];
  let a = 0, b = 0;
  for (let i = 0; i < 5; i++) { a += lerpPts(pts, x + k[i] * r * 0.5) * w[i]; b += w[i]; }
  return a / b;
}

const SPEC = {
  sedan: {
    belt: [[0, 0.78], [0.25, 0.93], [0.9, 0.99], [1.8, 1.0], [3.3, 0.99], [3.9, 0.9], [4.4, 0.76], [4.72, 0.56]],
    roof: [[0.95, 0.98], [1.25, 1.12], [1.7, 1.3], [2.1, 1.4], [2.55, 1.44], [2.8, 1.4], [3.1, 1.24], [3.38, 0.99]],
    cab: [0.95, 3.38], cabW: 0.84,
  },
  suv: {
    belt: [[0, 0.8], [0.2, 1.0], [0.7, 1.08], [1.6, 1.1], [3.5, 1.06], [4.1, 0.98], [4.55, 0.82], [4.9, 0.62]],
    roof: [[0.3, 1.08], [0.55, 1.5], [1.2, 1.68], [2.9, 1.7], [3.5, 1.47], [3.95, 1.1]],
    cab: [0.3, 3.95], cabW: 0.84,
  },
  pickup: {
    belt: [[0, 1.02], [0.1, 1.08], [1.85, 1.1], [2.0, 1.14], [4.2, 1.14], [5.0, 1.0], [5.45, 0.8], [5.6, 0.62]],
    roof: [[1.95, 1.12], [2.25, 1.72], [3.5, 1.8], [4.15, 1.3], [4.35, 1.14]],
    cab: [1.95, 4.35], cabW: 0.88,
  },
  van: {
    belt: [[0, 1.1], [0.2, 1.22], [4.5, 1.2], [5.0, 1.0], [5.4, 0.7]],
    roof: [[0.1, 1.2], [0.35, 2.02], [4.0, 2.1], [4.7, 1.4], [4.95, 1.18]],
    cab: [0.1, 4.95], cabW: 0.9,
  },
};

/** Loft a closed surface. fn(x) -> {w, y0, y1, e} for x in [0,L]; rear (x=0) at +Z, front at -Z. */
function loft(L, fn, nSt = 44, K = 26) {
  const pos = [], idx = [];
  const rings = [];
  for (let i = 0; i <= nSt; i++) {
    const x = ((1 - Math.cos((Math.PI * i) / nSt)) / 2) * L;
    const { w, y0, y1, e, taper = 0 } = fn(x);
    const ym = (y0 + y1) / 2, hh = Math.max(0.001, (y1 - y0) / 2);
    const ring = [];
    for (let k = 0; k < K; k++) {
      const a = (k / K) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      const py = ym + hh * Math.sign(s) * Math.pow(Math.abs(s), 2 / e);
      const frac = clamp((py - y0) / Math.max(1e-3, y1 - y0), 0, 1);
      const px = Math.max(0.0005, w) * (1 - taper * frac) * Math.sign(c) * Math.pow(Math.abs(c), 2 / e);
      pos.push(px, py, L / 2 - x);
      ring.push(pos.length / 3 - 1);
    }
    rings.push(ring);
  }
  for (let i = 0; i < nSt; i++) for (let k = 0; k < K; k++) {
    const a = rings[i][k], b = rings[i][(k + 1) % K], c = rings[i + 1][k], d = rings[i + 1][(k + 1) % K];
    idx.push(a, c, b, b, c, d);
  }
  for (const [ring, flip] of [[rings[0], false], [rings[nSt], true]]) {
    let cx = 0, cy = 0, cz = 0; for (const vi of ring) { cx += pos[vi * 3]; cy += pos[vi * 3 + 1]; cz += pos[vi * 3 + 2]; }
    pos.push(cx / K, cy / K, cz / K); const ci = pos.length / 3 - 1;
    for (let k = 0; k < K; k++) flip ? idx.push(ci, ring[(k + 1) % K], ring[k]) : idx.push(ci, ring[k], ring[(k + 1) % K]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const geoCache = new Map();
function getGeo(type) {
  if (geoCache.has(type)) return geoCache.get(type);
  const { len: L, wid: W } = CAR_SIZE[type];
  const out = {};
  if (type === 'semi') {
    const trailer = new THREE.BoxGeometry(W, 3.1, 12.6); trailer.translate(0, 0.95 + 1.55, 17 / 2 - 12.6 / 2 - 0.1);
    const cab = new THREE.BoxGeometry(W - 0.15, 2.6, 3.3); cab.translate(0, 0.7 + 1.3, -17 / 2 + 1.65);
    const chassis = new THREE.BoxGeometry(W - 0.4, 0.5, 15.5); chassis.translate(0, 0.6, 0.6);
    out.lower = cab; out.cabin = trailer; out.chassis = chassis;
  } else {
    const sp = SPEC[type], hw = W / 2;
    out.lower = loft(L, (x) => {
      const u = (2 * x) / L - 1;
      let w = hw * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), 10)), 0.3);
      w *= 1 - 0.12 * sstep(0.6, 1, x / L);
      const top = prof(sp.belt, x, 0.35);
      const bottom = 0.16 + 0.24 * Math.pow(Math.abs(u), 4);
      return { w, y0: bottom, y1: Math.max(bottom + 0.1, top), e: 7, taper: 0.05 };
    });
    const [c0, c1] = sp.cab;
    out.cabin = loft(c1 - c0, (xx) => {
      const x = xx + c0, t = xx / (c1 - c0);
      const belt = prof(sp.belt, x, 0.35) - 0.14;
      const roof = Math.max(belt + 0.05, prof(sp.roof, x, 0.3));
      const w = hw * sp.cabW * Math.pow(Math.sin(Math.PI * clamp(t, 0.001, 0.999)), 0.22);
      return { w, y0: belt, y1: roof, e: 5, taper: 0.3 };
    }, 36, 22);
    out.cabinOffset = (c0 + c1) / 2 - L / 2;       // cabin loft is centred on its own length
  }
  geoCache.set(type, out);
  return out;
}

const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.24, 18).rotateZ(Math.PI / 2);
const rimGeo = new THREE.CylinderGeometry(0.245, 0.245, 0.26, 14).rotateZ(Math.PI / 2);
const archGeo = new THREE.CylinderGeometry(0.43, 0.43, 0.02, 18).rotateZ(Math.PI / 2);
const barGeo = new THREE.BoxGeometry(1, 0.075, 0.05);
const blinkGeo = new THREE.BoxGeometry(0.26, 0.12, 0.05);

/**
 * Build a vehicle. opts: { body, glass, opacity, transparent, bodyGlass, hero, envMap }
 * hero = glossy standard materials (parked showcase); otherwise flat lambert (drive view).
 */
export function buildVehicle(type, opts = {}) {
  const { len: L, wid: W } = CAR_SIZE[type];
  const g = new THREE.Group();
  const geo = getGeo(type);
  const trans = opts.transparent || (opts.opacity ?? 1) < 1;
  const mk = (color, o = {}) => opts.hero
    ? new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.3, metalness: o.metal ?? 0.5, envMap: opts.envMap || null, envMapIntensity: o.env ?? 0.55 })
    : new THREE.MeshLambertMaterial({ color, transparent: trans, opacity: o.opacity ?? opts.opacity ?? 1 });
  const bodyMat = mk(opts.body ?? 0xcfcfd6, { rough: 0.34, metal: 0.45, env: 0.5 });
  const glassMat = mk(opts.glass ?? 0x15171c, { rough: 0.08, metal: 0.9, env: 0.9, opacity: Math.min(1, (opts.opacity ?? 1) + 0.04) });
  const body = new THREE.Mesh(geo.lower, bodyMat);
  const cabinMat = type === 'semi' ? bodyMat.clone() : glassMat;
  if (type === 'semi') cabinMat.color.multiplyScalar(0.92);
  const cabin = new THREE.Mesh(geo.cabin, cabinMat);
  if (geo.cabinOffset !== undefined) cabin.position.z = -geo.cabinOffset;      // front = -Z
  g.add(body, cabin);
  if (geo.chassis) g.add(new THREE.Mesh(geo.chassis, new THREE.MeshLambertMaterial({ color: 0x18181c })));

  // wheels (set into dark arch discs)
  const tire = new THREE.MeshLambertMaterial({ color: 0x0b0b0d });
  const rimM = opts.hero ? new THREE.MeshStandardMaterial({ color: 0x8a8d96, roughness: 0.35, metalness: 0.9, envMap: opts.envMap || null }) : new THREE.MeshLambertMaterial({ color: 0x3a3b42 });
  const archM = new THREE.MeshBasicMaterial({ color: 0x050506 });
  const axles = type === 'semi' ? [-6.0, 4.6, 6.2] : [-L / 2 + 0.98, L / 2 - 0.98];
  for (const z of axles) for (const sx of [-1, 1]) {
    const bodyW = (W / 2) * 0.985;
    const w = new THREE.Mesh(wheelGeo, tire); w.position.set(sx * (bodyW - 0.1), 0.35, z);
    const r = new THREE.Mesh(rimGeo, rimM); r.position.set(sx * (bodyW - 0.095), 0.35, z);
    g.add(w, r);
    if (type !== 'semi') { const a = new THREE.Mesh(archGeo, archM); a.position.set(sx * (bodyW * 0.99), 0.4, z); g.add(a); }
  }
  // tail + signals (rear = +Z)
  const tailMat = new THREE.MeshBasicMaterial({ color: 0x701010 });
  const tail = new THREE.Mesh(barGeo, tailMat);
  tail.scale.x = W * 0.56;
  const ty = type === 'semi' ? 1.2 : type === 'pickup' || type === 'van' ? 1.02 : 0.9;
  tail.position.set(0, ty, L / 2 - 0.1);
  g.add(tail);
  const bm = () => new THREE.MeshBasicMaterial({ color: 0xff9a1a, transparent: true, opacity: 0 });
  const blinkL = new THREE.Mesh(blinkGeo, bm()), blinkR = new THREE.Mesh(blinkGeo, bm());
  blinkL.position.set(-W * 0.36, ty - 0.02, L / 2 - 0.1); blinkR.position.set(W * 0.36, ty - 0.02, L / 2 - 0.1);
  g.add(blinkL, blinkR);
  // head lights (nose = -Z)
  const hl = new THREE.Mesh(barGeo, new THREE.MeshBasicMaterial({ color: 0xdfe6f5, transparent: true, opacity: opts.hero ? 0.95 : 0.5 }));
  hl.scale.x = W * 0.5; hl.position.set(0, type === 'sedan' ? 0.7 : 0.78, -L / 2 + 0.1); g.add(hl);
  if (opts.hero) {
    for (const sx of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.2), bodyMat);
      m.position.set(sx * (W / 2 - 0.04), 1.0, -L / 2 + 1.5); g.add(m);
    }
  }
  g.userData = { tail, tailMat, blinkL, blinkR, bodyMat, glassMat, type, bodyGlass: !!opts.bodyGlass };
  return g;
}

export function buildPedestrian(color = 0xb9bcc4) {
  const g = new THREE.Group();
  const m = new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.95 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.85, 3, 8), m); body.position.y = 0.95;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), m); head.position.y = 1.72;
  g.add(body, head);
  return g;
}

export function buildTrafficLight() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 6, 6), new THREE.MeshLambertMaterial({ color: 0x55565c }));
  pole.position.y = 3;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 4.4), new THREE.MeshLambertMaterial({ color: 0x55565c }));
  arm.position.set(0, 5.9, 2.2);
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.25, 0.35), new THREE.MeshLambertMaterial({ color: 0x1a1b1f }));
  box.position.set(0, 5.5, 4.2);
  const lamps = ['red', 'yellow', 'green'].map((c, i) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 10), new THREE.MeshBasicMaterial({ color: 0x222222 }));
    m.position.set(0, 5.9 - i * 0.4, 4.05);
    g.add(m); return m;
  });
  g.add(pole, arm, box);
  g.userData.lamps = lamps;
  return g;
}
