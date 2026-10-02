// Three.js renderer for the driving visualisation and the parked 3/4 view.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildVehicle, buildPedestrian, buildTrafficLight } from './models3d.js';

const THEMES = {
  dark: {
    bg: 0x0a0a0d, ground: 0x2b2a30, shoulder: 0x202025, road: 0x0e0e11, line: 0xf0f0f4, yellow: 0xe0ae3c,
    npc: 0xc4c4cc, npcA: 0.93, glass: 0x23242a, ego: 0x1c1d21, blue: [0.18, 0.46, 1.0], amb: 1.15, sun: 0.7, cross: 0x131316,
  },
  light: {
    bg: 0xdcdce1, ground: 0xe9e9ed, shoulder: 0xd9d9df, road: 0xbdbdc6, line: 0xffffff, yellow: 0xd9a52b,
    npc: 0xf6f6f8, npcA: 0.9, glass: 0x9a9ca6, ego: 0x202126, blue: [0.16, 0.42, 0.98], amb: 1.25, sun: 0.55, cross: 0xb6b6bf,
  },
};

class Strip {              // ribbon with per-vertex RGBA
  constructor(n, material, order) {
    this.n = n;
    this.pos = new Float32Array(n * 2 * 3);
    this.col = new Float32Array(n * 2 * 4);
    const idx = [];
    for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    this.geo.setIndex(idx);
    this.mesh = new THREE.Mesh(this.geo, material);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = order;
    this.count = 0;
  }
  set(i, lx, lz, rx, rz, y, rgba) {
    const p = i * 6;
    this.pos[p] = lx; this.pos[p + 1] = y; this.pos[p + 2] = lz; this.pos[p + 3] = rx; this.pos[p + 4] = y; this.pos[p + 5] = rz;
    const c = i * 8;
    for (let k = 0; k < 2; k++) { this.col[c + k * 4] = rgba[0]; this.col[c + k * 4 + 1] = rgba[1]; this.col[c + k * 4 + 2] = rgba[2]; this.col[c + k * 4 + 3] = rgba[3]; }
  }
  finish(count) {
    this.count = count;
    this.geo.setDrawRange(0, Math.max(0, (count - 1) * 6));
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.color.needsUpdate = true;
  }
}

class Quads {              // pool of flat quads (dashes, stripes, intersection boxes)
  constructor(n, material, order) {
    this.n = n; this.pos = new Float32Array(n * 4 * 3); this.k = 0;
    const idx = []; for (let i = 0; i < n; i++) { const a = i * 4; idx.push(a, a + 1, a + 2, a, a + 2, a + 3); }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setIndex(idx);
    this.mesh = new THREE.Mesh(this.geo, material); this.mesh.frustumCulled = false; this.mesh.renderOrder = order;
  }
  reset() { this.k = 0; }
  add(a, b, c, d, y) {          // each = [x,z]
    if (this.k >= this.n) return;
    const p = this.k++ * 12;
    this.pos[p] = a[0]; this.pos[p + 1] = y; this.pos[p + 2] = a[1];
    this.pos[p + 3] = b[0]; this.pos[p + 4] = y; this.pos[p + 5] = b[1];
    this.pos[p + 6] = c[0]; this.pos[p + 7] = y; this.pos[p + 8] = c[1];
    this.pos[p + 9] = d[0]; this.pos[p + 10] = y; this.pos[p + 11] = d[1];
  }
  finish() { this.geo.setDrawRange(0, this.k * 6); this.geo.attributes.position.needsUpdate = true; }
}

const flat = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide, ...extra });

THREE.ColorManagement.enabled = false;   // use hex colours as authored (flat, UI-like look)

export class DriveScene {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.r.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.r.setClearColor(0x000000, 0);
    this.scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(this.r);
    this.envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    this.cam = new THREE.PerspectiveCamera(40, 1, 0.5, 700);
    this.theme = 'dark';
    this.mode = 'drive';
    this.paint = opts.paint ?? 0x1c1d21;
    this.vehMeshes = new Map(); this.pedMeshes = new Map();
    this.lightObjs = [];
    this.camX = 0; this.lookX = 0; this.parkAng = 0.6; this.dragAng = 0;
    this.t = 0;

    this.amb = new THREE.HemisphereLight(0xffffff, 0x666670, 1.1);
    this.sun = new THREE.DirectionalLight(0xffffff, 0.7); this.sun.position.set(-30, 60, 40);
    this.scene.add(this.amb, this.sun);

    // ground
    this.groundMat = flat(0x222222);
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600).rotateX(-Math.PI / 2), this.groundMat);
    this.ground.renderOrder = -10; this.ground.frustumCulled = false;
    this.scene.add(this.ground);

    // road layers
    this.matShoulder = flat(0x333333, { vertexColors: false }); this.matRoad = flat(0x111111);
    this.matLine = flat(0xffffff); this.matYellow = flat(0xe0ae3c); this.matCross = flat(0x111111);
    this.matStripe = flat(0xffffff);
    this.shoulderL = new Strip(130, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide }), 1);
    this.shoulderR = new Strip(130, this.shoulderL.mesh.material, 1);
    this.roadStrip = new Strip(130, this.shoulderL.mesh.material, 2);
    this.solid = [0, 1, 2, 3, 4].map(() => new Strip(130, this.shoulderL.mesh.material, 3));
    this.dashes = new Quads(260, this.matLine, 3);
    this.cross = new Quads(6, this.matCross, 4);
    this.stripes = new Quads(120, this.matStripe, 5);
    this.pathStrip = new Strip(60, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide }), 6);
    for (const o of [this.shoulderL, this.shoulderR, this.roadStrip, ...this.solid, this.dashes, this.cross, this.stripes, this.pathStrip]) this.scene.add(o.mesh);
    this.roadGroupObjs = [this.ground, this.shoulderL.mesh, this.shoulderR.mesh, this.roadStrip.mesh, ...this.solid.map((s) => s.mesh), this.dashes.mesh, this.cross.mesh, this.stripes.mesh, this.pathStrip.mesh];

    // terrain blobs
    this.blobs = [];
    const bg = new THREE.SphereGeometry(1, 10, 6);
    this.blobMat = new THREE.MeshBasicMaterial({ color: 0x34333a });
    for (let i = 0; i < 46; i++) { const m = new THREE.Mesh(bg, this.blobMat); m.renderOrder = -5; m.visible = false; this.scene.add(m); this.blobs.push(m); }

    // traffic lights pool
    for (let i = 0; i < 4; i++) { const tl = buildTrafficLight(); tl.renderOrder = 9; tl.visible = false; this.scene.add(tl); this.lightObjs.push(tl); }

    // ego
    this.egoMesh = null;
    this.setPaint(this.paint, opts.type || 'sedan');

    // soft shadow disc (parked view)
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d'); const gr = x.createRadialGradient(64, 64, 4, 64, 64, 62);
    gr.addColorStop(0, 'rgba(0,0,0,.65)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(9, 14).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    this.shadow.position.y = 0.02; this.shadow.visible = false; this.scene.add(this.shadow);

    this.setTheme('dark');
  }

  setSize(w, h, ratio = 1) {
    this.r.setPixelRatio(ratio);
    this.r.setSize(w, h, false);
    this.cam.aspect = w / h; this.cam.updateProjectionMatrix();
    this.w = w; this.h = h;
  }
  setTheme(t) {
    this.theme = t; const T = THEMES[t];
    this.T = T;
    this.groundMat.color.set(T.ground); this.matCross.color.set(T.cross); this.matLine.color.set(T.line); this.matStripe.color.set(T.line); this.matYellow.color.set(T.yellow);
    this.blobMat.color.set(t === 'dark' ? 0x34333a : 0xdcdce2);
    this.amb.intensity = T.amb; this.sun.intensity = T.sun;
    this.amb.color.set(t === 'dark' ? 0xcfd2e6 : 0xffffff); this.amb.groundColor.set(t === 'dark' ? 0x55565e : 0xaaaab4);
    this._applyBackground();
    for (const m of this.vehMeshes.values()) this._tint(m.mesh, m.ent);
  }
  _applyBackground() {
    const T = this.T;
    if (this.mode === 'drive') { this.scene.background = new THREE.Color(T.bg); this.scene.fog = new THREE.Fog(T.bg, 120, 330); }
    else { this.scene.background = null; this.scene.fog = null; }
  }
  setMode(m) {
    this.mode = m;
    for (const o of this.roadGroupObjs) o.visible = m === 'drive';
    this.blobs.forEach((b) => (b.visible = false));
    this.shadow.visible = m === 'park';
    if (m === 'park') for (const v of this.vehMeshes.values()) v.mesh.visible = false;
    this.egoMesh.visible = m === 'drive'; this.heroMesh.visible = m === 'park';
    this._applyBackground();
  }
  setPaint(hex, type = 'sedan') {
    this.paint = hex; this.carType = type;
    if (this.egoMesh) this.scene.remove(this.egoMesh);
    if (this.heroMesh) this.scene.remove(this.heroMesh);
    // the ego is drawn dark in the driving view (tinted by the paint), like the real visualisation
    const dark = new THREE.Color(hex).multiplyScalar(0.16).add(new THREE.Color(0x0e0f12));
    this.egoMesh = buildVehicle(type, { body: dark.getHex(), glass: 0x07080a, transparent: true });
    this.egoMesh.renderOrder = 11;
    // inverted-hull outline so the ego reads against the dark road (like the real visualisation)
    const hullMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide, transparent: true, opacity: 0.55, depthWrite: false });
    const parts = this.egoMesh.children.slice(0, 2);
    parts.forEach((m) => { m.renderOrder = 3; const h = new THREE.Mesh(m.geometry, hullMat); h.renderOrder = 2; h.position.copy(m.position); h.scale.set(1.05, 1.08, 1.016); h.position.y -= 0.02; this.egoMesh.add(h); });
    this.egoHull = hullMat;
    this.heroMesh = buildVehicle(type, { body: hex, glass: 0x07080b, hero: true, envMap: this.envTex });
    this.heroMesh.visible = false;
    this.scene.add(this.egoMesh, this.heroMesh);
  }

  _tint(mesh, ent) {
    const T = this.T;
    const base = new THREE.Color(T.npc);
    const k = 0.9 + (ent?.hue ?? 0.5) * 0.18;
    mesh.userData.bodyMat.color.copy(base).multiplyScalar(k);
    mesh.userData.bodyMat.emissive.copy(base).multiplyScalar(k * (this.theme === 'dark' ? 0.34 : 0.12));
    mesh.userData.glassMat.color.set(mesh.userData.bodyGlass ? base.clone().multiplyScalar(k * 0.93) : T.glass);
    mesh.userData.glassMat.emissive.copy(base).multiplyScalar(k * (this.theme === 'dark' ? 0.26 : 0.1));
  }
  _getVeh(v) {
    let e = this.vehMeshes.get(v.id);
    if (!e) {
      const mesh = buildVehicle(v.type, { body: this.T.npc, glass: this.T.glass, opacity: this.T.npcA, transparent: true, bodyGlass: true });
      mesh.renderOrder = 10;
      this.scene.add(mesh);
      e = { mesh, ent: v, seen: 0 }; this.vehMeshes.set(v.id, e); this._tint(mesh, v);
    }
    e.seen = this.frame; e.ent = v;
    return e.mesh;
  }
  _getPed(p) {
    let e = this.pedMeshes.get(p.id);
    if (!e) { const mesh = buildPedestrian(this.theme === 'dark' ? 0xb7bac2 : 0xf2f2f5); mesh.renderOrder = 10; this.scene.add(mesh); e = { mesh, seen: 0 }; this.pedMeshes.set(p.id, e); }
    e.seen = this.frame; return e.mesh;
  }

  /* ----------------------------------------------------------------- */
  renderPark(dt, ctx) {
    this.t += dt; this.frame = (this.frame || 0) + 1;
    const ang = 0.55 + Math.sin(this.t * 0.35) * 0.28 + (ctx?.drag ?? this.dragAng ?? 0);
    const fov = 30, aspect = this.w / Math.max(1, this.h);
    const hfov = 2 * Math.atan(Math.tan((fov * Math.PI) / 360) * aspect);
    const ext = 4.72 * Math.abs(Math.sin(ang)) + 1.95 * Math.abs(Math.cos(ang));
    const R = Math.max(9.6, ext / 0.86 / (2 * Math.tan(hfov / 2)) + 1.0);
    const H = Math.max(1.9, R * 0.2);
    this.cam.position.set(-Math.sin(ang) * R, H, -Math.cos(ang) * R);
    this.cam.lookAt(0, 0.55, 0);
    this.egoMesh.visible = false;
    this.heroMesh.visible = true; this.heroMesh.position.set(0, 0, 0); this.heroMesh.rotation.set(0, 0, 0);
    this.heroMesh.userData.tailMat.color.set(0xb01818);
    this.cam.fov = fov; this.cam.updateProjectionMatrix();
    this.cam.lookAt(0, 0.55, 0);
    this.r.render(this.scene, this.cam);
  }
  /** projected screen position of a point on the parked car (for callouts) */
  projectParked(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(this.cam);
    return { x: (v.x * 0.5 + 0.5) * this.w, y: (-v.y * 0.5 + 0.5) * this.h };
  }

  renderDrive(world, dt) {
    this.t += dt; this.frame = (this.frame || 0) + 1;
    const T = this.T, ego = world.ego, env = world.env;
    const sE = ego.s;
    const thC = world.path(sE + 10).th;
    const eg = world.pos(sE, ego.d);
    const cs = Math.cos(thC), sn = Math.sin(thC);
    const loc = (gx, gz) => { const dx = gx - eg.x, dz = gz - eg.z; return [dx * cs - dz * sn, -(dx * sn + dz * cs)]; };   // -> [x, z(three)]
    const at = (s, d) => { const p = world.pos(s, d); return loc(p.x, p.z); };

    // ---- camera ----
    const egoLoc = at(sE, ego.d);
    const ahead = at(sE + 40, ego.d);
    const targetCamX = egoLoc[0] * 0.55 + ahead[0] * 0.06;
    this.camX += (targetCamX - this.camX) * Math.min(1, dt * 3);
    const lookTarget = ahead[0] * 0.55;
    this.lookX += (lookTarget - this.lookX) * Math.min(1, dt * 2.5);
    // framing: portrait panel (split layout) vs wide (full layout)
    const aspect = this.w / Math.max(1, this.h);
    const wide = clamp01((aspect - 0.75) / 1.0);
    const fov = 34 - wide * 8, camH = 8.8 + wide * 3.2, camZ = 32 + wide * 13, look = -6 - wide * 2;
    if (Math.abs(this.cam.fov - fov) > 0.01) { this.cam.fov = fov; this.cam.updateProjectionMatrix(); }
    this.cam.position.set(this.camX, camH, camZ);
    this.cam.lookAt(this.lookX, 0.0, look);
    this.sun.position.set(this.camX - 20, 60, 30);

    // ---- road ----
    const S0 = sE - 32, STEP = 3, N = 112;
    const rows = [];
    for (let i = 0; i < N; i++) rows.push(S0 + i * STEP);
    const edgeL = world.leftEdge, edgeR = world.rightEdge, roadHalfPad = 0.35;
    const sh = 3.4;
    const [tr, tg, tb] = hex3(T.road), [sr, sg, sb] = hex3(T.shoulder);
    const edgeStrip = (strip, d0, d1, rgb, y, alpha = 1) => {
      for (let i = 0; i < N; i++) {
        const s = rows[i], a = at(s, d0), b = at(s, d1);
        strip.set(i, a[0], a[1], b[0], b[1], y, [rgb[0], rgb[1], rgb[2], alpha]);
      }
      strip.finish(N);
    };
    edgeStrip(this.roadStrip, edgeL - roadHalfPad, edgeR + roadHalfPad, [tr, tg, tb], 0.01);
    edgeStrip(this.shoulderL, edgeL - roadHalfPad - sh, edgeL - roadHalfPad, [sr, sg, sb], 0.005);
    edgeStrip(this.shoulderR, edgeR + roadHalfPad, edgeR + roadHalfPad + sh, [sr, sg, sb], 0.005);

    // lines
    const lw = 0.16, white = hex3(T.line), yellow = hex3(T.yellow);
    const solids = []; const dashes = [];
    if (env.name === 'highway') {
      solids.push([edgeL + 0.05, yellow], [edgeR - 0.05, white]);
      for (let i = 1; i < env.fwd; i++) dashes.push(world.lanes[i].d - env.laneW / 2);
    } else {
      const m = env.median / 2;
      solids.push([-m, yellow], [m, yellow], [edgeL + 0.05, white], [edgeR - 0.05, white]);
      dashes.push(world.lanes[0].d + env.laneW / 2, world.oncLanes[0].d - env.laneW / 2);
    }
    this.solid.forEach((st, i) => {
      const L = solids[i];
      if (!L) { st.finish(0); return; }
      edgeStrip(st, L[0] - lw / 2, L[0] + lw / 2, L[1], 0.02);
    });
    // dashed
    this.dashes.reset();
    const dashLen = 3.0, period = 12.0;
    const k0 = Math.floor((S0 - 4) / period), k1 = Math.ceil((S0 + N * STEP) / period);
    for (const d of dashes) {
      for (let k = k0; k <= k1; k++) {
        const sa = k * period, sb = sa + dashLen;
        if (env.lights && world.inter.some((it) => Math.abs(it.s - sa) < 12)) continue;
        const a = at(sa, d - lw / 2), b = at(sa, d + lw / 2), c = at(sb, d + lw / 2), e = at(sb, d - lw / 2);
        this.dashes.add(a, b, c, e, 0.02);
      }
    }
    this.dashes.finish();

    // intersections + crosswalks + stop lines
    this.cross.reset(); this.stripes.reset();
    let li = 0;
    for (const L of this.lightObjs) L.visible = false;
    if (env.lights) {
      for (const it of world.inter) {
        const rel = it.s - sE;
        if (rel < -40 || rel > 300) continue;
        const w = 8.5, W = 80;
        this.cross.add(at(it.s - w, -W), at(it.s - w, W), at(it.s + w, W), at(it.s + w, -W), 0.025);
        // stop line (our lanes)
        const sl = it.s - 9.2, dL = world.lanes[0].d - env.laneW / 2, dR = edgeR;
        this.stripes.add(at(sl, dL), at(sl, dR), at(sl + 0.5, dR), at(sl + 0.5, dL), 0.03);
        // crosswalk zebra
        for (let d = edgeL + 0.6; d < edgeR - 0.2; d += 1.15) {
          const a = it.s - 7.6, b = it.s - 4.6;
          this.stripes.add(at(a, d), at(a, d + 0.6), at(b, d + 0.6), at(b, d), 0.03);
        }
        if (li < this.lightObjs.length && rel > -15 && rel < 220) {
          const L = this.lightObjs[li++]; const p = at(it.s + 7.5, edgeR + 1.2);
          L.visible = true; L.position.set(p[0], 0, p[1]);
          // arm points toward the road (negative x)
          L.rotation.y = Math.PI / 2 * -1 + Math.PI;     // arm extends toward -X (over road)
          const st = world.lightState(it.k);
          L.userData.lamps.forEach((m, i) => { const on = ['red', 'yellow', 'green'][i] === st; m.material.color.set(on ? [0xff3b30, 0xffc233, 0x30d158][i] : 0x2a2a2e); });
        }
      }
    }
    this.cross.finish(); this.stripes.finish();

    // terrain blobs
    const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
    const BL = 22; const base = Math.floor((sE - 40) / BL);
    let bi = 0;
    for (let k = base; k < base + 14 && bi < this.blobs.length - 1; k++) {
      for (const side of [-1, 1]) {
        const h1 = hash(k * 2 + (side > 0 ? 1 : 0)), h2 = hash(k * 7.3 + side);
        if (h1 < 0.35) continue;
        const d = side * ((side > 0 ? edgeR : -edgeL) + 14 + h2 * 60);
        const p = at(k * BL + h1 * BL, d);
        const m = this.blobs[bi++]; m.visible = true;
        const sc = 8 + h2 * 22;
        m.position.set(p[0], -0.6, p[1]); m.scale.set(sc * 1.5, 0.9 + h1 * 1.6, sc);
      }
    }
    for (; bi < this.blobs.length; bi++) this.blobs[bi].visible = false;

    // ---- ego ----
    this.heroMesh.visible = false;
    const em = this.egoMesh; em.visible = true;
    const ego_th = world.path(sE).th + ego.yawOff;
    em.position.set(egoLoc[0], 0, egoLoc[1]);
    em.rotation.y = -(ego_th - thC);
    const u = em.userData;
    const br = ego.brake;
    u.tailMat.color.setRGB(0.45 + br * 0.55, 0.06, 0.06);

    // ---- other vehicles ----
    const all = world.vehicles.concat(world.getCross());
    for (const v of all) {
      const rel = (v.s - sE);
      if (rel < -70 || rel > 320) continue;
      const m = this._getVeh(v);
      const p = at(v.s, v.d);
      m.visible = true; m.position.set(p[0], 0, p[1]);
      let yaw = world.path(v.s).th - thC;
      if (v.cross) yaw += v.dd > 0 ? Math.PI / 2 : -Math.PI / 2;
      else if (v.dir === -1 && !v.parked) yaw += Math.PI;
      else if (v.parked && v.dir === -1) yaw += Math.PI;
      yaw += v.dir === -1 ? -v.yawOff : v.yawOff;
      m.rotation.y = -yaw;
      const mu = m.userData;
      const front = v.dir === -1 || v.cross;                // we see their fronts: dim the red bar
      mu.tailMat.color.setRGB(front ? 0.2 : 0.4 + v.brake * 0.6, 0.06, 0.06);
      const blink = (Math.floor(this.t * 2.6) % 2) === 0;
      mu.blinkL.material.opacity = v.signal < 0 && blink ? 1 : 0; mu.blinkR.material.opacity = v.signal > 0 && blink ? 1 : 0;
    }
    // hide meshes not seen this frame
    for (const [id, e] of this.vehMeshes) {
      if (e.seen !== this.frame) { e.mesh.visible = false; if (this.frame - e.seen > 120) { this.scene.remove(e.mesh); this.vehMeshes.delete(id); } }
    }
    // ego blinkers
    const blinkE = (Math.floor(this.t * 2.6) % 2) === 0;
    u.blinkL.material.opacity = ego.signal < 0 && blinkE ? 1 : 0; u.blinkR.material.opacity = ego.signal > 0 && blinkE ? 1 : 0;

    // ---- pedestrians ----
    for (const p of world.peds) {
      const m = this._getPed(p); const q = at(p.s, p.d);
      m.visible = true; m.position.set(q[0], Math.abs(Math.sin(p.phase)) * 0.04, q[1]);
    }
    for (const [id, e] of this.pedMeshes) if (e.seen !== this.frame) { this.scene.remove(e.mesh); this.pedMeshes.delete(id); }

    // ---- planned path (blue) ----
    const target = ego.lc ? ego.lc.to : ego.d;
    const [br_, bg_, bb_] = T.blue;
    let n = 0;
    const startS = sE + ego.len / 2 + 0.4;
    const lenAhead = Math.min(70, 28 + ego.v * 1.8);
    const pathD = (s) => target + (ego.d - target) * Math.exp(-(s - sE) / 16);
    for (let i = 0; i < 30; i++) {
      const f = i / 29, s = startS + f * lenAhead + f * f * 6;
      const d = pathD(s);
      const a = at(s, d - 0.85), b = at(s, d + 0.85);
      const alpha = 0.95 * Math.pow(1 - f, 1.3) + 0.02;
      this.pathStrip.set(i, a[0], a[1], b[0], b[1], 0.06, [br_, bg_, bb_, alpha]);
      n++;
    }
    this.pathStrip.finish(n);
    this.egoVisible = true;

    this.egoMesh.visible = true;
    this.r.render(this.scene, this.cam);
  }
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));
function hex3(h) { return [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255]; }
