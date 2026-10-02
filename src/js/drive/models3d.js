// Vehicle models for the driving visualisation (original geometry, generated procedurally).
// Each car is ONE smooth body: rounded cross-sections swept along its length, with the glass,
// pillars, ambient-occlusion and soft shading baked into vertex colours. This gives the matte, low-contrast
// look of the real display and keeps the draw-call count low (a few meshes per vehicle).
// Local model space: forward = -Z, right = +X, origin at ground centre of the vehicle.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CAR_SIZE } from './world.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

function lerpPts(pts, x) {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0); }
  return pts[pts.length - 1][1];
}
function prof(pts, x, r) {          // smoothed piecewise-linear profile
  const k = [-2, -1, 0, 1, 2], w = [1, 2, 3, 2, 1];
  let a = 0, b = 0;
  for (let i = 0; i < 5; i++) { a += lerpPts(pts, x + k[i] * r * 0.5) * w[i]; b += w[i]; }
  return a / b;
}

// Side profiles: x from the rear (0) to the nose (L). belt = shoulder line (hood/trunk top); roof = roofline.
const SPEC = {
  sedan: {
    belt: [[0, 0.8], [0.15, 0.92], [0.8, 0.99], [1.9, 1.0], [3.3, 0.98], [3.9, 0.9], [4.4, 0.78], [4.72, 0.58]],
    roof: [[0, 0], [0.85, 0.99], [1.3, 1.18], [1.75, 1.34], [2.15, 1.42], [2.6, 1.45], [2.95, 1.4], [3.3, 1.22], [3.62, 0.98], [4.72, 0]],
    cabW: 0.8, wheelR: 0.36,
  },
  suv: {
    belt: [[0, 0.86], [0.15, 1.0], [0.7, 1.08], [1.8, 1.1], [3.5, 1.06], [4.1, 0.98], [4.6, 0.82], [4.9, 0.62]],
    roof: [[0, 0], [0.3, 1.1], [0.55, 1.52], [1.1, 1.68], [2.9, 1.7], [3.45, 1.5], [3.95, 1.1], [4.9, 0]],
    cabW: 0.82, wheelR: 0.38,
  },
  pickup: {
    belt: [[0, 1.04], [0.1, 1.1], [1.85, 1.1], [2.0, 1.14], [4.2, 1.14], [5.0, 1.02], [5.45, 0.82], [5.6, 0.64]],
    roof: [[0, 0], [1.9, 1.1], [2.2, 1.72], [3.5, 1.82], [4.1, 1.3], [4.35, 1.14], [5.6, 0]],
    cabW: 0.86, wheelR: 0.4,
  },
  van: {
    belt: [[0, 1.12], [0.2, 1.22], [4.4, 1.2], [5.0, 1.0], [5.4, 0.72]],
    roof: [[0, 0], [0.12, 1.2], [0.4, 2.02], [3.9, 2.1], [4.6, 1.45], [4.95, 1.2], [5.4, 0]],
    cabW: 0.9, wheelR: 0.38,
  },
};

const NST = 56, KH = 22;
const bodyHalfWidth = (x, L, hw0) => Math.max(0.01, hw0 * Math.pow(Math.max(0, 1 - Math.pow(Math.abs((2 * x) / L - 1), 10)), 0.3) * (1 - 0.1 * sstep(0.55, 1, x / L)));       // stations along the car, points per half cross-section

function buildBodyGeometry(type) {
  const { len: L, wid: W } = CAR_SIZE[type], sp = SPEC[type], hw0 = W / 2;
  const pos = [], info = [], rings = [];
  let cabRange = [Infinity, -Infinity];
  for (let i = 0; i <= NST; i++) {
    const x = ((1 - Math.cos((Math.PI * i) / NST)) / 2) * L;
    const u = (2 * x) / L - 1;
    const belt = prof(sp.belt, x, 0.35);
    const roof = prof(sp.roof, x, 0.3);
    const top = Math.max(roof, belt + 0.05);
    const cab = roof - belt;
    if (cab > 0.12) { cabRange[0] = Math.min(cabRange[0], x); cabRange[1] = Math.max(cabRange[1], x); }
    const w = bodyHalfWidth(x, L, hw0);
    const y0 = 0.2 + 0.22 * Math.pow(Math.abs(u), 4);
    const cw = sp.cabW, cabin = top - belt;
    const ctl = [
      [0, y0], [w * 0.78, y0 + 0.015], [w * 0.96, y0 + 0.12], [w, (y0 + belt) * 0.5], [w * 0.985, belt - 0.07],
      [w * 0.93, belt + 0.015], [w * cw, belt + cabin * 0.14], [w * cw * 0.92, belt + cabin * 0.6], [w * cw * 0.8, top - 0.05], [w * cw * 0.46, top - 0.008], [0, top],
    ].map((p) => new THREE.Vector2(p[0], p[1]));
    const half = new THREE.SplineCurve(ctl).getSpacedPoints(KH);
    const ring = [];
    const pushPt = (px, py) => { pos.push(px, py, L / 2 - x); info.push({ x, belt, cab, y0 }); ring.push(info.length - 1); };
    for (let k = 0; k <= KH; k++) pushPt(Math.max(0, half[k].x), half[k].y);
    for (let k = KH - 1; k >= 1; k--) pushPt(-Math.max(0, half[k].x), half[k].y);
    rings.push(ring);
  }
  const K = rings[0].length, idx = [];
  for (let i = 0; i < NST; i++) for (let k = 0; k < K; k++) {
    const a = rings[i][k], b = rings[i][(k + 1) % K], c = rings[i + 1][k], d = rings[i + 1][(k + 1) % K];
    idx.push(a, c, b, b, c, d);
  }
  for (const [ring, flip] of [[rings[0], false], [rings[NST], true]]) {
    let cx = 0, cy = 0, cz = 0; for (const vi of ring) { cx += pos[vi * 3]; cy += pos[vi * 3 + 1]; cz += pos[vi * 3 + 2]; }
    pos.push(cx / K, cy / K, cz / K); info.push(info[ring[0]]); const ci = info.length - 1;
    for (let k = 0; k < K; k++) flip ? idx.push(ci, ring[(k + 1) % K], ring[k]) : idx.push(ci, ring[k], ring[(k + 1) % K]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.userData = { info, cabRange };
  return g;
}

const LDIR = new THREE.Vector3(-0.35, 0.85, -0.4).normalize();
/** Bake glass / pillars / AO / soft shading into a colour attribute. */
function bakeBody(g, o) {
  const P = g.attributes.position, N = g.attributes.normal, { info, cabRange } = g.userData;
  const col = new Float32Array(P.count * 3);
  const span = cabRange[1] - cabRange[0];
  const xB = cabRange[0] + span * 0.52, xC = cabRange[0] + span * 0.1;
  for (let i = 0; i < P.count; i++) {
    const nx = N.getX(i), ny = N.getY(i), nz = N.getZ(i), y = P.getY(i), f = info[i];
    let gl = 0;
    if (f.cab > 0.12) {
      const m = sstep(0.025, 0.13, y - f.belt);
      gl = m * Math.max(sstep(0.97, 0.78, ny), o.glassRoof ? 1 : 0);
      const side = sstep(0.25, 0.7, Math.abs(nx));
      const pil = Math.max(1 - sstep(0.05, 0.11, Math.abs(f.x - xB)), 1 - sstep(0.05, 0.11, Math.abs(f.x - xC)));
      gl *= 1 - side * pil * 0.95;
    }
    let ao = 0.42 + 0.58 * sstep(f.y0 + 0.02, f.y0 + 0.6, y);
    ao *= 1 - 0.5 * sstep(-0.1, -0.5, ny);
    const shade = o.lit ? 0.5 + 0.5 * Math.max(0, nx * LDIR.x + ny * LDIR.y + nz * LDIR.z) : 1;
    const c = shade * ao * (1 + (o.glassTone - 1) * gl);
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = c;
  }
  const out = g.clone();
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.userData = g.userData;
  return out;
}

/* ---------- boxy vehicles (box truck, tractor-trailer) ---------- */
function boxPart(w, h, d, y, z, glassFn, radius = 0.16) {
  let g = new RoundedBoxGeometry(w, h, d, 3, radius); if (g.index) g = g.toNonIndexed();
  g.translate(0, y + h / 2, z);
  const P = g.attributes.position;
  g.computeVertexNormals();
  const N = g.attributes.normal, col = new Float32Array(P.count * 3);
  for (let i = 0; i < P.count; i++) {
    const nx = N.getX(i), ny = N.getY(i), nz = N.getZ(i), py = P.getY(i);
    const shade = 0.5 + 0.5 * Math.max(0, nx * LDIR.x + ny * LDIR.y + nz * LDIR.z);
    const ao = 0.45 + 0.55 * sstep(0.35, 1.1, py);
    const gl = glassFn ? glassFn(P.getX(i), py, P.getZ(i), nx, ny, nz) : 0;
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = shade * ao * (1 - 0.45 * gl);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.deleteAttribute('uv');
  return g;
}
function buildBoxVehicle(type) {
  const { len: L, wid: W } = CAR_SIZE[type];
  const parts = [];
  if (type === 'semi') {
    parts.push(boxPart(W - 0.1, 3.0, 2.8, 0.8, -L / 2 + 1.4, (x, y, z, nx, ny, nz) => (nz < -0.5 && y > 2.0 && y < 3.4 ? 1 : 0), 0.3));
    parts.push(boxPart(W, 2.95, L - 4.4, 0.95, L / 2 - (L - 4.4) / 2, null, 0.08));
  } else {
    parts.push(boxPart(W - 0.1, 2.1, 2.3, 0.45, -L / 2 + 1.15, (x, y, z, nx, ny, nz) => (nz < -0.5 && y > 1.35 ? 1 : Math.abs(nx) > 0.6 && y > 1.3 && y < 2.2 ? 1 : 0), 0.25));
    parts.push(boxPart(W, 2.55, L - 2.5, 0.55, L / 2 - (L - 2.5) / 2, null, 0.08));
  }
  return mergeGeometries(parts.map((p) => { const q = p.clone(); return q; }));
}

/* ---------- wheels (merged, vertex-coloured) ---------- */
const wheelCache = new Map();
function wheelGeometry(type) {
  if (wheelCache.has(type)) return wheelCache.get(type);
  const { len: L, wid: W } = CAR_SIZE[type];
  const r = type === 'semi' || type === 'box' ? 0.5 : SPEC[type].wheelR;
  const axles = type === 'semi' ? [-L / 2 + 1.5, L / 2 - 4.2, L / 2 - 1.9] : type === 'box' ? [-L / 2 + 1.3, L / 2 - 1.5] : [-L / 2 + 0.98, L / 2 - 0.98];
  const pieces = [];
  const paint = (g, c) => {
    if (g.index) g = g.toNonIndexed(); g.deleteAttribute('uv'); g.deleteAttribute('normal');
    const n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c; a[i * 3 + 1] = c; a[i * 3 + 2] = c; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
  };
  for (const z of axles) for (const sx of [-1, 1]) {
    const bw = type === 'semi' || type === 'box' ? (W / 2) * 0.9 : bodyHalfWidth(L / 2 - z, L, W / 2) - 0.1;
    const tire = new THREE.CylinderGeometry(r, r, 0.25, 16).rotateZ(Math.PI / 2).translate(sx * bw, r, z);
    const rim = new THREE.CylinderGeometry(r * 0.66, r * 0.66, 0.27, 12).rotateZ(Math.PI / 2).translate(sx * (bw + 0.004), r, z);
    const arch = new THREE.CylinderGeometry(r * 1.2, r * 1.2, 0.02, 16).rotateZ(Math.PI / 2).translate(sx * (bw + 0.1), r + 0.04, z);
    pieces.push(paint(tire, 0.14), paint(rim, 0.4), paint(arch, 0.05));
  }
  const g = mergeGeometries(pieces);
  wheelCache.set(type, g);
  return g;
}

/* ---------- soft glow sprites ---------- */
const glowTex = new Map();
function glowTexture(rgb) {
  if (glowTex.has(rgb)) return glowTex.get(rgb);
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 2, 64, 64, 62);
  g.addColorStop(0, `rgba(${rgb},0.9)`); g.addColorStop(0.45, `rgba(${rgb},0.35)`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); glowTex.set(rgb, t); return t;
}
function glowPlane(rgb, w, d) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: glowTexture(rgb), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
  m.renderOrder = -1;
  return m;
}

const barGeo = new THREE.BoxGeometry(1, 0.075, 0.05);
const blinkGeo = new THREE.BoxGeometry(0.26, 0.12, 0.05);
const bodyCache = new Map();
function bodyGeo(type, variant) {
  const key = `${type}|${variant}`;
  if (bodyCache.has(key)) return bodyCache.get(key);
  let g;
  if (type === 'semi' || type === 'box') g = buildBoxVehicle(type);
  else g = bakeBody(buildBodyGeometry(type), variant === 'hero'
    ? { lit: false, glassTone: 0.07, glassRoof: true }
    : { lit: true, glassTone: variant === 'ego' ? 0.62 : 0.6, glassRoof: variant === 'ego' });
  bodyCache.set(key, g);
  return g;
}

/**
 * Build a vehicle. opts: { tint, variant: 'npc'|'ego'|'hero', opacity, envMap }
 *  npc  = baked-shading, unlit, matte grey (traffic)         ego = same, tinted dark with glass roof
 *  hero = glossy standard material with reflections (parked showcase)
 */
export function buildVehicle(type, opts = {}) {
  const { len: L, wid: W } = CAR_SIZE[type];
  const variant = opts.variant || 'npc';
  const g = new THREE.Group();
  const geo = bodyGeo(type, variant);
  const opacity = opts.opacity ?? 1;
  const bodyMat = variant === 'hero'
    ? new THREE.MeshStandardMaterial({ vertexColors: true, color: opts.tint ?? 0xcfcfd6, roughness: 0.3, metalness: 0.55, envMap: opts.envMap || null, envMapIntensity: 0.6 })
    : new THREE.MeshBasicMaterial({ vertexColors: true, color: opts.tint ?? 0xcfcfd6, transparent: opacity < 1 || !!opts.transparent, opacity });
  g.add(new THREE.Mesh(geo, bodyMat));
  const wheelMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: 0xffffff, transparent: !!opts.transparent });
  g.add(new THREE.Mesh(wheelGeometry(type), wheelMat));

  // tail bar + signals (rear = +Z) and nose lights (-Z)
  const tailMat = new THREE.MeshBasicMaterial({ color: 0x701010 });
  const tail = new THREE.Mesh(barGeo, tailMat);
  tail.scale.x = W * 0.58;
  const ty = type === 'semi' || type === 'box' ? 1.0 : type === 'pickup' || type === 'van' ? 1.02 : 0.9;
  tail.position.set(0, ty, L / 2 - 0.1);
  g.add(tail);
  const bm = () => new THREE.MeshBasicMaterial({ color: 0xff9a1a, transparent: true, opacity: 0 });
  const blinkL = new THREE.Mesh(blinkGeo, bm()), blinkR = new THREE.Mesh(blinkGeo, bm());
  blinkL.position.set(-W * 0.38, ty - 0.02, L / 2 - 0.1); blinkR.position.set(W * 0.38, ty - 0.02, L / 2 - 0.1);
  g.add(blinkL, blinkR);
  if (type !== 'semi' && type !== 'box' && variant !== 'hero') {
    const hl = new THREE.Mesh(barGeo, new THREE.MeshBasicMaterial({ color: 0xdfe6f5, transparent: true, opacity: variant === 'hero' ? 0.95 : 0.4 }));
    hl.scale.x = W * 0.5; hl.position.set(0, type === 'sedan' ? 0.7 : 0.78, -L / 2 + 0.1); g.add(hl);
  }
  // brake glow on the road behind; headlight halo on the road ahead (ego)
  const brakeGlow = glowPlane('255,40,30', W * 2.2, 5.5); brakeGlow.position.set(0, 0.04, L / 2 + 2.0); g.add(brakeGlow);
  let headGlow = null;
  if (variant === 'ego') { headGlow = glowPlane('255,255,255', W * 2.6, 9); headGlow.position.set(0, 0.04, -L / 2 - 3.2); headGlow.material.opacity = 0.55; g.add(headGlow); }
  if (variant === 'hero') {
    for (const sx of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.2), new THREE.MeshStandardMaterial({ color: opts.tint ?? 0xcfcfd6, roughness: 0.35, metalness: 0.5, envMap: opts.envMap || null, envMapIntensity: 0.6 }));
      m.position.set(sx * (W / 2 - 0.1), 0.98, -L / 2 + 1.55); g.add(m);
    }
  }
  g.userData = { tail, tailMat, blinkL, blinkR, bodyMat, brakeGlow, headGlow, type };
  return g;
}

export function buildPedestrian(color = 0xb9bcc4) {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.85, 3, 8), m); body.position.y = 0.95;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), m); head.position.y = 1.72;
  g.add(body, head);
  return g;
}

export function buildTrafficLight() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 6, 6), new THREE.MeshBasicMaterial({ color: 0x55565c }));
  pole.position.y = 3;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 4.4), new THREE.MeshBasicMaterial({ color: 0x55565c }));
  arm.position.set(0, 5.9, 2.2);
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.3, 0.38), new THREE.MeshBasicMaterial({ color: 0x1a1b1f }));
  box.position.set(0, 5.5, 4.2);
  const lamps = ['red', 'yellow', 'green'].map((c, i) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), new THREE.MeshBasicMaterial({ color: 0x222222 }));
    m.position.set(0, 5.9 - i * 0.42, 4.03);
    g.add(m); return m;
  });
  g.add(pole, arm, box);
  g.userData.lamps = lamps;
  return g;
}
