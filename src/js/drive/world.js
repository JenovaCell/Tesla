// Driving world simulation (no rendering): road geometry, lanes, NPC traffic, traffic lights,
// pedestrians, and the "FSD" ego controller. Units: metres, seconds. s = distance along the road,
// d = lateral offset from the road centreline (+ = right). Everything is deterministic per seed.

export const MPH = 0.44704;

export const ENVS = {
  highway: {
    name: 'highway', fwd: 4, onc: 0, laneW: 3.7, median: 0, limit: 70, dens: 0.045, vmean: 0.93,
    curvy: 1, lights: false, parked: false,
    mix: [['sedan', 0.45], ['suv', 0.3], ['pickup', 0.1], ['semi', 0.15]],
  },
  city: {
    name: 'city', fwd: 2, onc: 2, laneW: 3.4, median: 3.2, limit: 35, dens: 0.05, vmean: 0.9,
    curvy: 0.5, lights: true, parked: true,
    mix: [['sedan', 0.5], ['suv', 0.33], ['pickup', 0.1], ['van', 0.07]],
  },
};

export const CAR_SIZE = {
  sedan: { len: 4.7, wid: 1.9 }, suv: { len: 4.9, wid: 2.0 }, pickup: { len: 5.6, wid: 2.1 },
  van: { len: 5.4, wid: 2.0 }, semi: { len: 17, wid: 2.55 },
};

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (t) => t * t * (3 - 2 * t);

export class World {
  constructor(envName = 'highway', seed = 7, opts = {}) {
    this.env = ENVS[envName];
    this.rng = mulberry32(seed);
    this.t = 0;
    this.nextId = 1;
    this.vehicles = [];
    this.peds = [];
    this.profile = opts.profile || 'standard';        // chill | standard | hurry
    this.events = [];                                  // one-shot events for sound/ui: {type}
    this._buildGeometry();
    // ego
    const laneCount = this.env.fwd;
    this.ego = this._makeVehicle('sedan', { s: 0, lane: Math.min(1, laneCount - 1), v: opts.v ?? 0, ego: true });
    this.ego.v = opts.v ?? 0;
    this.limit = this.env.limit;
    this._populate();
    this.crossTimer = 0;
    this.spawnTimer = 0;
  }

  /* ---------------- road geometry ---------------- */
  _buildGeometry() {
    this.step = 2; this.s0 = -160;
    this.X = [0]; this.Z = [0]; this.TH = [0];
    this.segs = [];            // {end, k}
    this.genS = this.s0;       // generated up to
    this._segEnd = this.s0; this._k = 0;
    // lane layout
    const e = this.env;
    this.lanes = [];           // forward lanes: {d}
    const half = e.median / 2;
    for (let i = 0; i < e.fwd; i++) this.lanes.push({ d: half + e.laneW * (i + 0.5) + (e.median ? 0 : -(e.fwd * e.laneW) / 2), dir: 1 });
    this.oncLanes = [];
    for (let i = 0; i < e.onc; i++) this.oncLanes.push({ d: -(half + e.laneW * (i + 0.5)), dir: -1 });
    const fMax = Math.max(...this.lanes.map((l) => l.d)) + e.laneW / 2;
    const fMin = Math.min(...this.lanes.map((l) => l.d)) - e.laneW / 2;
    this.rightEdge = fMax;
    this.leftEdge = e.onc ? -fMax : fMin;
    // intersections (city)
    this.inter = [];
    if (e.lights) for (let k = 0; k < 400; k++) this.inter.push({ k, s: 150 + k * 175 + (k % 3) * 11, phase: (k * 13.7) % 44, crossT: 0, pedT: 0 });
    this._ensure(400);
  }
  _pickCurv() {
    // alternate straights and gentle bends
    const r = this.rng, c = this.env.curvy;
    if (this._k !== 0 || r() < 0.25) { this._k = 0; return [180 + r() * 380, 0]; }
    const R = (this.env.name === 'city' ? 180 + r() * 220 : 450 + r() * 900) / Math.max(0.3, c);
    return [90 + r() * 200, (r() < 0.5 ? -1 : 1) / R];
  }
  _ensure(sMax) {
    while (this.genS < sMax) {
      if (this.genS >= this._segEnd) {
        if (this._k === 0) { const [len, k] = this._pickCurv(); this._k = k; this._segEnd = this.genS + len; }
        else { this._segEnd = this.genS + 140 + this.rng() * 160; this._k = 0; }
      }
      const i = this.X.length - 1, th = this.TH[i];
      this.X.push(this.X[i] + Math.sin(th) * this.step);
      this.Z.push(this.Z[i] + Math.cos(th) * this.step);
      this.TH.push(th + this._k * this.step);
      this.genS += this.step;
    }
  }
  /** centreline point at s */
  path(s) {
    this._ensure(s + 40);
    const f = (s - this.s0) / this.step, i = clamp(Math.floor(f), 0, this.X.length - 2), u = f - i;
    return { x: this.X[i] + (this.X[i + 1] - this.X[i]) * u, z: this.Z[i] + (this.Z[i + 1] - this.Z[i]) * u, th: this.TH[i] + (this.TH[i + 1] - this.TH[i]) * u };
  }
  /** global position of (s, d) */
  pos(s, d) {
    const p = this.path(s);
    return { x: p.x + d * Math.cos(p.th), z: p.z - d * Math.sin(p.th), th: p.th };
  }

  /* ---------------- vehicles ---------------- */
  _pickType() {
    let r = this.rng(), acc = 0;
    for (const [t, w] of this.env.mix) { acc += w; if (r < acc) return t; }
    return 'sedan';
  }
  _makeVehicle(type, o) {
    const sz = CAR_SIZE[type];
    const lane = o.lane ?? 0;
    const L = o.dir === -1 ? this.oncLanes[lane] : this.lanes[lane];
    const v = {
      id: this.nextId++, type, len: sz.len, wid: sz.wid, s: o.s, d: o.d ?? L?.d ?? 0, v: o.v ?? 0,
      dir: o.dir ?? 1, lane, ego: !!o.ego, parked: !!o.parked, cross: !!o.cross,
      lc: null, signal: 0, brake: 0, v0: o.v0 ?? 30, a: 0, yawOff: 0, cooldown: 3 + this.rng() * 6, dd: 0,
      hue: this.rng(),
    };
    if (!o.ego && !o.cross) this.vehicles.push(v);
    return v;
  }
  _laneV0(lane, dir) {
    const e = this.env, base = e.limit * MPH * e.vmean;
    const bias = dir === 1 ? (e.fwd > 1 ? (1 - lane / (e.fwd - 1)) * 0.12 - 0.04 : 0) : 0;   // left lanes a bit quicker
    return base * (1 + bias) * (0.94 + this.rng() * 0.12);
  }
  _populate() {
    const e = this.env;
    for (let li = 0; li < this.lanes.length; li++) {
      let s = this.ego.s + 8 + this.rng() * 28;
      if (li === this.ego.lane) s = this.ego.s + 34 + this.rng() * 18;
      while (s < this.ego.s + 300) {
        const type = this._pickType();
        this._makeVehicle(type, { s, lane: li, v: this._laneV0(li, 1) * 0.95, v0: this._laneV0(li, 1) });
        s += (1 / e.dens) * (0.5 + this.rng() * 1.2) + CAR_SIZE[type].len;
      }
      // a few behind (only when we're already rolling)
      let sb = this.ego.v > 12 ? this.ego.s - 30 - this.rng() * 30 : -Infinity;
      while (sb > this.ego.s - 90) {
        const type = this._pickType();
        this._makeVehicle(type, { s: sb, lane: li, v: this._laneV0(li, 1), v0: this._laneV0(li, 1) });
        sb -= (1 / e.dens) * (0.7 + this.rng()) + 10;
      }
    }
    for (let li = 0; li < this.oncLanes.length; li++) {
      let s = this.ego.s + 30 + this.rng() * 40;
      while (s < this.ego.s + 320) {
        const type = this._pickType();
        this._makeVehicle(type, { s, lane: li, dir: -1, v: this._laneV0(li, -1), v0: this._laneV0(li, -1) });
        s += (1 / e.dens) * (0.6 + this.rng() * 1.4) + 15;
      }
    }
    this._removeOverlaps();
  }
  _removeOverlaps() {
    const vs = this.vehicles.concat([this.ego]);
    this.vehicles = this.vehicles.filter((a) => !vs.some((b) => b !== a && a.dir === b.dir && Math.abs(a.d - b.d) < 2 && Math.abs(a.s - b.s) < (a.len + b.len) / 2 + 3 && b.id < a.id));
  }

  /* ---------------- helpers ---------------- */
  lightState(k, t = this.t) {
    const T = 44, tt = (t + this.inter[k].phase) % T;
    if (tt < 24) return 'green';
    if (tt < 27.5) return 'yellow';
    return 'red';
  }
  redStart(k, t = this.t) { const T = 44, tt = (t + this.inter[k].phase) % T; return tt >= 27.5 ? tt - 27.5 : -1; }
  _nextInter(s) {
    if (!this.env.lights) return null;
    // intersections are sorted by s
    let lo = 0, hi = this.inter.length - 1, ans = -1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (this.inter[m].s - 9 > s) { ans = m; hi = m - 1; } else lo = m + 1; }
    return ans < 0 ? null : this.inter[ans];
  }
  /** nearest obstacle ahead for vehicle a: returns {gap, v} or null */
  _leader(a, group) {
    let best = null;
    const dirm = a.dir;
    for (const b of group) {
      if (b === a || b.dir !== a.dir) continue;
      const rel = (b.s - a.s) * dirm;
      if (rel <= 0) continue;
      const need = (a.wid + b.wid) / 2 + 0.5;
      // consider cars mid-lane-change (either of us) toward each other's lane
      let dLat = Math.abs(b.d - a.d);
      if (a.lc) dLat = Math.min(dLat, Math.abs(b.d - a.lc.to), b.lc ? Math.abs(b.lc.to - a.lc.to) : 99);
      if (b.lc) dLat = Math.min(dLat, Math.abs(b.lc.to - a.d));
      if (dLat > need) continue;
      const gap = rel - (a.len + b.len) / 2;
      if (!best || gap < best.gap) best = { gap, v: b.v, b };
    }
    if (a.dir === 1 && this.env.lights && !a.cross) {
      const it = this._nextInter(a.s + a.len / 2);
      if (it) {
        const st = this.lightState(it.k), dist = it.s - 9 - (a.s + a.len / 2);
        const stopDist = (a.v * a.v) / (2 * 3.2);
        if ((st === 'red' && dist < 90) || (st === 'yellow' && dist > stopDist * 0.9 && dist < 90)) {
          if (!best || dist < best.gap) best = { gap: dist, v: 0, light: true };
        }
      }
    }
    return best;
  }
  _idm(a, lead, v0) {
    const A = 1.6, B = 2.2, T = a.ego ? (this.profile === 'hurry' ? 1.0 : this.profile === 'chill' ? 1.9 : 1.4) : 1.5, S0 = 2.5;
    let acc = A * (1 - Math.pow(a.v / Math.max(1, v0), 4));
    if (lead) {
      const dv = a.v - lead.v, sStar = S0 + Math.max(0, a.v * T + (a.v * dv) / (2 * Math.sqrt(A * B)));
      acc -= A * Math.pow(sStar / Math.max(0.5, lead.gap), 2);
    }
    return clamp(acc, -7.5, A);
  }
  _laneFree(a, dir, targetD, group) {
    for (const b of group) {
      if (b === a || b.dir !== a.dir) continue;
      const lat = Math.abs(b.d - targetD);
      const bd = b.lc ? Math.min(lat, Math.abs(b.lc.to - targetD)) : lat;
      if (bd > 2.4) continue;
      const rel = (b.s - a.s) * a.dir;
      const front = rel > 0 ? rel - (a.len + b.len) / 2 : 999;
      const back = rel <= 0 ? -rel - (a.len + b.len) / 2 : 999;
      // need gap ahead (account closing speed) and behind
      const closeAhead = Math.max(0, a.v - b.v) * 2.0 + 7;
      const closeBack = Math.max(0, b.v - a.v) * 2.2 + 8;
      if (front < closeAhead || back < closeBack) return false;
    }
    return true;
  }
  _tryLaneChange(a, group, force = false) {
    if (a.lc || a.cooldown > 0 || a.dir !== 1) return false;
    const opts = [];
    const left = a.lane - 1, right = a.lane + 1;
    if (left >= 0) opts.push(left);
    if (right < this.lanes.length) opts.push(right);
    if (!opts.length) return false;
    opts.sort(() => this.rng() - 0.5);
    for (const L of opts) {
      if (this._laneFree(a, 1, this.lanes[L].d, group)) {
        a.lc = { to: this.lanes[L].d, toLane: L, from: a.d, t: 0, dur: 3.6, pre: 1.3 };
        a.signal = L < a.lane ? -1 : 1;
        if (a.ego) this.events.push({ type: 'signal-on', dir: a.signal });
        return true;
      }
    }
    return false;
  }

  /* ---------------- update ---------------- */
  update(dt, ctl = {}) {
    dt = Math.min(dt, 0.1);
    this.t += dt;
    const e = this.env, ego = this.ego;
    const all = this.vehicles.concat([ego]);
    const fwd = all.filter((v) => v.dir === 1), onc = this.vehicles.filter((v) => v.dir === -1);
    this.limit = this.env.limit;

    // ---- ego longitudinal ----
    const prof = this.profile === 'hurry' ? 1.12 : this.profile === 'chill' ? 0.92 : 1.0;
    let v0 = this.limit * MPH * prof;
    // slow for curves
    const pa = this.path(ego.s).th, pb = this.path(ego.s + 40).th, kk = Math.abs(pb - pa) / 40;
    if (kk > 1e-4) v0 = Math.min(v0, Math.sqrt(2.3 / kk));
    if (ctl.stop) v0 = 0;
    let lead = this._leader(ego, fwd);
    if (ctl.stopGap != null && (!lead || ctl.stopGap < lead.gap)) lead = { gap: ctl.stopGap, v: 0, stopper: true };
    let aE = this._idm(ego, lead, v0);
    if (ctl.setSpeed != null) v0 = ctl.setSpeed;
    ego.a = aE;
    ego.v = Math.max(0, ego.v + aE * dt);
    if (ego.v < 0.02 && aE <= 0) ego.v = 0;
    ego.s += ego.v * dt;
    ego.brake = aE < -1.2 ? 1 : aE < -0.3 ? 0.5 : 0;
    // ego lane-change logic (blocked by slow leader)
    ego.cooldown -= dt;
    if (!ego.lc && ego.cooldown <= 0 && ego.v > 8 && !ctl.noLaneChange) {
      const blocked = lead && !lead.light && !lead.stopper && lead.gap < 70 && lead.v < ego.v - 1.0;
      const wantKeepRight = !blocked && ego.lane < this.lanes.length - 1 && this.rng() < 0.002 * 60 * dt * 5;
      if (blocked || wantKeepRight) { this._tryLaneChange(ego, fwd); }
      ego.cooldown = blocked ? 3 : 8;
    }

    // ---- NPC forward ----
    for (const a of this.vehicles) {
      if (a.parked) continue;
      const group = a.dir === 1 ? fwd : onc;
      let lead2;
      if (a.dir === -1) {
        lead2 = null;
        for (const b of onc) { if (b === a || b.lane !== a.lane) continue; const rel = a.s - b.s; if (rel <= 0) continue; const gap = rel - (a.len + b.len) / 2; if (!lead2 || gap < lead2.gap) lead2 = { gap, v: b.v }; }
      } else lead2 = this._leader(a, group);
      const acc = this._idm(a, lead2, a.v0);
      a.a = acc;
      a.v = Math.max(0, a.v + acc * dt);
      a.s += a.dir * a.v * dt;
      a.brake = acc < -1.2 ? 1 : acc < -0.3 ? 0.5 : (a.v < 0.4 && lead2 && lead2.gap < 6 ? 1 : 0);
      a.cooldown -= dt;
      if (a.dir === 1 && !a.lc && a.cooldown <= 0) {
        a.cooldown = 3 + this.rng() * 6;
        if (lead2 && !lead2.light && lead2.gap < 40 && lead2.v < a.v0 - 2.5 && this.rng() < 0.45) this._tryLaneChange(a, fwd);
        else if (this.rng() < 0.03) this._tryLaneChange(a, fwd);
      }
    }
    // ---- lane change progress ----
    for (const a of all) {
      if (!a.lc) { a.yawOff *= 0.9; continue; }
      a.lc.t += dt;
      const u = clamp((a.lc.t - a.lc.pre) / a.lc.dur, 0, 1);
      const prevD = a.d;
      a.d = a.lc.from + (a.lc.to - a.lc.from) * smooth(u);
      a.yawOff = a.v > 1 ? Math.atan2((a.d - prevD) / Math.max(dt, 1e-3), a.v) : 0;
      if (u >= 1) { a.lane = a.lc.toLane; a.lc = null; a.signal = 0; a.cooldown = 8; if (a.ego) this.events.push({ type: 'signal-off' }); }
    }

    // ---- intersections: cross traffic + pedestrians ----
    if (e.lights) this._updateIntersections(dt);

    // ---- spawn / despawn ----
    this._spawn(dt);
    this.vehicles = this.vehicles.filter((v) => v.s > ego.s - 110 && v.s < ego.s + 340);
    this._updateCross(dt);
    this._updatePeds(dt);
  }

  _spawn(dt) {
    const e = this.env, ego = this.ego;
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = 0.6;
    const fwd = this.vehicles.filter((v) => v.dir === 1);
    for (let li = 0; li < this.lanes.length; li++) {
      if (this.rng() > Math.min(0.9, e.dens * 40 * Math.max(0.3, ego.v / 28))) continue;
      const sFar = ego.s + 310, sNear = ego.s - 95;
      const clear = (s) => !fwd.some((b) => b.lane === li && Math.abs(b.s - s) < b.len + 16 + b.v * 0.65);
      const v0 = this._laneV0(li, 1);
      if (clear(sFar)) this._makeVehicle(this._pickType(), { s: sFar, lane: li, v: Math.min(v0, ego.v + 8) * 0.95 + 1, v0 });
      else if (this.rng() < 0.25 && clear(sNear) && ego.v > 12) {
        // fast overtaker from behind
        const t = this._pickType();
        this._makeVehicle(t, { s: sNear, lane: li, v: Math.min(v0 * 1.12, ego.v + 8), v0: v0 * 1.12 });
      }
    }
    for (let li = 0; li < this.oncLanes.length; li++) {
      if (this.rng() > 0.55) continue;
      const sFar = ego.s + 330;
      if (!this.vehicles.some((b) => b.dir === -1 && b.lane === li && Math.abs(b.s - sFar) < 30 + b.v * 1.2)) {
        const v0 = this._laneV0(li, -1);
        this._makeVehicle(this._pickType(), { s: sFar, lane: li, dir: -1, v: v0, v0 });
      }
    }
    // parked cars (static, seeded by index so they stay put)
    if (e.parked) {
      this._parkedUntil = this._parkedUntil ?? ego.s - 60;
      while (this._parkedUntil < ego.s + 320) {
        this._parkedUntil += 9 + this.rng() * 22;
        if (this.rng() < 0.7) {
          const side = this.rng() < 0.55 ? 1 : -1;
          const type = this._pickType();
          const p = this._makeVehicle(type, { s: this._parkedUntil, d: side * (this.rightEdge + 1.5), parked: true, v: 0, dir: side === 1 ? 1 : -1 });
          p.lane = -1;
        }
      }
    }
  }

  _updateIntersections(dt) {
    const ego = this.ego;
    for (const it of this.inter) {
      if (it.s < ego.s - 120) continue;
      if (it.s > ego.s + 260) break;
      const rs = this.redStart(it.k);
      // spawn cross vehicles during ego-red (not at the very start/end)
      if (rs > 1.5 && rs < 7 && it.crossT <= 0 && this.rng() < 0.9 * dt * 2.5) {
        const dirc = (it.k % 2 === 0) ? 1 : -1;
        const type = this._pickType();
        const v = this._makeVehicle(type, { s: it.s + (this.rng() - 0.5) * 6, d: -dirc * 62, v: 11 + this.rng() * 3, cross: true });
        v.dd = dirc * v.v; v.crossRow = it.k; this.crossList = this.crossList || []; this.crossList.push(v);
        it.crossT = 1.4 + this.rng() * 1.8;
      }
      it.crossT -= dt;
      // pedestrians
      if (rs > 1 && rs < 3 && !it.pedDone && it.k % 2 === 1) {
        it.pedDone = true;
        const n = 1 + Math.floor(this.rng() * 2);
        for (let i = 0; i < n; i++) this.peds.push({ id: this.nextId++, s: it.s - 6 + i * 0.8, d: 11 * (i % 2 ? -1 : 1), vd: -1.5 * (i % 2 ? -1 : 1) * (0.9 + this.rng() * 0.3), k: it.k, phase: this.rng() * 6 });
      }
      if (rs < 0) it.pedDone = false;
    }
  }
  _updateCross(dt) {
    if (!this.crossList) return;
    for (const v of this.crossList) { v.d += v.dd * dt; }
    this.crossList = this.crossList.filter((v) => Math.abs(v.d) < 66);
  }
  _updatePeds(dt) {
    for (const p of this.peds) { p.d += p.vd * dt; p.phase += dt * 6; }
    this.peds = this.peds.filter((p) => Math.abs(p.d) < 12.5 && p.s > this.ego.s - 100);
  }
  getCross() { return this.crossList || []; }

  /** snapshot of the upcoming intersection for the HUD */
  nextIntersection() {
    if (!this.env.lights) return null;
    const it = this._nextInter(this.ego.s);
    return it ? { ...it, dist: it.s - 9 - this.ego.s, state: this.lightState(it.k) } : null;
  }
  /** nearest same-direction vehicle ahead of the ego (for UI / tests) */
  egoLeader() { return this._leader(this.ego, this.vehicles.concat([this.ego]).filter((v) => v.dir === 1)); }
}
