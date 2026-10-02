// Orchestrates the drive display: parked view -> Self-Driving trips (city / highway) -> arrival -> loop.
import { World, MPH } from './world.js';
import { vehicleSize } from './models3d.js';
import { DriveScene } from './scene.js';
import { DriveUI } from './hud.js';
import { Trip } from './trip.js';
import { placeById, pickDestination, planRoute } from './routes.js';
import { store, model, paintHex, resolvedTheme, rangeMi } from '../state.js';
import { player } from '../media.js';
import { toast } from '../util.js';
import { Sound } from './sound.js';

// One long drive per trip: driveway + neighbourhood streets -> highway -> city streets to the destination.
const LEGS = {
  start: { env: 'city', layout: 'full', driveway: true },
  highway: { env: 'highway', layout: 'split' },
  city: { env: 'city', layout: 'full' },
  end: { env: 'city', layout: 'full' },
};

export class Director {
  constructor(root, deps) {
    this.deps = deps;           // { openApp, close }
    this.sound = new Sound();
    this.ui = new DriveUI(root, {
      shift: (g) => this.requestGear(g),
      startFSD: () => this.startFSD(),
      endTrip: () => this.endTrip(),
      setLayout: (l) => this.setLayout(l),
      toggle: (k) => store.set({ [k]: !store.get(k) }),
      media: (a) => (a === 'prev' ? player.prev() : a === 'next' ? player.next() : player.toggle()),
      openApp: (id) => deps.openApp(id),
      scene: null,
      stageScale: () => this.stageScale(),
    });
    this.scene = new DriveScene(this.ui.canvas, { paint: this.paintInt(), type: this.carType() });
    this.scene.dragAng = 0;
    this.ui.d.scene = this.scene;
    this.seed = Math.floor(Math.random() * 1000);
    this.state = 'park';
    this.layout = 'split';
    this.leg = null;
    this.segT = 0;
    this.paused = false;
    this.parkT = 0;
    this.autoDemo = false;
    this.session = { miles: 0, kwh: 0, sec: 0 };
    this.world = new World('city', this.seed, { v: 0 });
    this.trip = new Trip('long', this.seed);
    this.ctl = {};
    this.arrivedT = null;
    this.mapT = 0;
    this.last = performance.now();
    this.theme = resolvedTheme();
    this.scene.setTheme(this.theme);
    this.enterPark(true);
    store.subscribe((p) => {
      if ('paint' in p || 'model' in p) this.scene.setPaint(this.paintInt(), this.carType());
      if ('theme' in p) { this.theme = resolvedTheme(); this.scene.setTheme(this.theme); }
    });
    this._raf = requestAnimationFrame((t) => this.frame(t));
  }

  carType() { return store.get('model'); }
  paintInt() { return parseInt(paintHex().slice(1), 16); }
  stageScale() { const r = this.ui.viz.getBoundingClientRect(); return r.width / Math.max(1, this.ui.viz.offsetWidth) || 1; }
  setPaused(p) { this.paused = p; this.last = performance.now(); }

  /* ---------------- gear / state transitions ---------------- */
  requestGear(g) {
    const st = store.state;
    if (g === 'D') { if (this.state === 'park') this.startFSD(); return; }
    if (g === 'P') { if (this.state === 'drive') this.endTrip(); return; }
    if (g === 'R') { toast('Reverse is not available during Self-Driving demo'); return; }
    if (g === 'N') { if (this.state === 'drive') this.endTrip(); }
  }
  enterPark(first = false) {
    this.state = 'park';
    this.parkT = 0;
    this.scene.setMode('park'); this.ui.setMode('park');
    store.state._gear = 'P'; store.state._ap = false; store.state._speed = 0; store.state._target = 0;
    store.set({ _gear: 'P' });
    this.world.ego.v = 0;
    this.session = { miles: 0, kwh: 0, sec: 0 };
    this.prepareNext();
  }
  setStart(id) {
    store.set({ place: id }); this.at = id; this.arrivedAt = false;
    if (this.state === 'park') this.prepareNext();
  }
  /** choose where we go next; show an estimate right away and swap in the real route when it arrives */
  prepareNext() {
    if (this.destId && this.arrivedAt) { this.at = this.destId; store.set({ place: this.at }); }
    this.arrivedAt = false;
    this.seed = Math.floor(Math.random() * 100000);
    const from = placeById(this.at || store.get('place') || 'winterhaven'); this.at = from.id;
    const to = pickDestination(from.id);
    this.destId = to.id;
    const token = (this._prep = (this._prep || 0) + 1);
    this.trip = Trip.estimate(from, to, this.seed);
    planRoute(from.id, to.id).then((r) => { if (r && token === this._prep && this.state === 'park') this.trip = Trip.fromRoute(r); });
  }
  startFSD() {
    if (this.state !== 'park') return;
    store.set({ doors: { fl: false, fr: false, rl: false, rr: false }, frunk: false, trunk: false, locked: false, charging: false, chargePort: false });
    store.state._ap = true;
    store.set({ _gear: 'D' });
    this.sound.chime('engage');
    this.session = { miles: 0, kwh: 0, sec: 0 };
    this.beginLeg('start', true, 0);
  }
  beginLeg(name, fromRest, v0) {
    const seg = LEGS[name];
    this.leg = name;
    const seedN = this.seed + Math.floor(performance.now() % 1000) + (name === 'highway' ? 7 : name === 'end' ? 14 : 0);
    this.world = new World(seg.env, seedN, { v: fromRest ? 0 : v0, profile: 'standard', driveway: !!seg.driveway });
    this.segT = 0; this.arrivedT = null; this.ctl = {};
    this.state = 'drive';
    this.scene.setMode('drive'); this.setLayout(seg.layout);
    this.scene.setTheme(this.theme);
    this.ui.setFade(false);
  }
  endTrip() {
    if (this.state !== 'drive') return;
    this.ctl.stop = true; this.ctl.noLaneChange = true; this.parkAfterStop = true;
    toast('Pulling over…');
  }
  setLayout(l) { this.layout = l; if (this.state === 'drive') this.ui.setMode(l); }

  nextLeg(name) {
    const seg = LEGS[name];
    this.ui.setFade(true);
    const v = this.world.ego.v;
    this._transition = true;
    setTimeout(() => { this.beginLeg(name, false, Math.min(v, seg.env === 'highway' ? 28 : 12)); store.state._ap = true; this._transition = false; }, 750);
  }

  /* ---------------- main loop ---------------- */
  frame(t) {
    this._raf = requestAnimationFrame((tt) => this.frame(tt));
    const now = performance.now();
    if (this.paused || this.deps.isBusy()) { this.last = now; return; }
    let dt = (now - this.last) / 1000; this.last = now;
    dt = Math.min(dt, 0.1);
    const st = store.state;

    // pixel ratio: keep GPU work modest on high-DPI panels (e.g. Surface Studio)
    const scale = this.stageScale(), dpr = window.devicePixelRatio || 1;
    const q = st.s?.vizQuality ?? 'balanced';
    const maxMP = q === 'high' ? 3.2e6 : q === 'low' ? 0.8e6 : 1.8e6;
    const w = this.ui.canvas.clientWidth || 1, hh = this.ui.canvas.clientHeight || 1;
    const ratio = Math.max(0.6, Math.min(scale * dpr, Math.sqrt(maxMP / (w * hh)), 2));
    this.ui.resize(ratio);

    if (this.state === 'drive') this.driveStep(dt);
    else this.parkStep(dt);

    // HUD
    const nowPlaying = st._nowPlaying;
    const S = {
      world: this.world, trip: this.trip, units: st.units, clock24: st.clock24, theme: this.theme, soc: st.soc, odo: st.odo,
      driving: this.state === 'drive' && !this.ctl.stop, session: this.session, mode: this.ui.mode, gear: st._gear, profile: 'hurry',
      rangeMi: model().rangeMi, nowPlaying, playing: player.playing, seed: this.seed,
    };
    this.ui.update(dt, S);
    this.mapT -= dt;
    if (this.mapT <= 0) { this.mapT = this.ui.mode === 'full' ? 0.12 : 0.25; this.ui.drawMaps(S); }
  }

  parkStep(dt) {
    this.parkT += dt;
    this.scene.renderPark(dt, { drag: this.scene.dragAng });
    // project callouts
    const sc = this.scene;
    const L = vehicleSize(this.scene.carType || 'model3').len;
    this.ui.placeCallouts({
      frunk: sc.projectParked(0.0, 0.95, -L / 2 + 0.3), trunk: sc.projectParked(0.0, 1.0, L / 2 - 0.2), top: sc.projectParked(0, 1.55, 0),
    });
    const fr = store.state.frunk, tr = store.state.trunk;
    const setLbl = (el, open, name) => { const k = (open ? 'Close' : 'Open') + name; if (el._k !== k) { el._k = k; el.firstChild.textContent = open ? 'Close' : 'Open'; } };
    setLbl(this.ui.calFrunk, fr, 'Frunk'); setLbl(this.ui.calTrunk, tr, 'Trunk');
    // optional desk-display mode: start the next drive by itself after a pause
    this.autoDemo = store.state.s?.autoDemo ?? false;
    if (this.autoDemo && this.parkT > 25) this.startFSD();
  }

  driveStep(dt) {
    const w = this.world, st = store.state;
    this.segT += dt;
    const ctl = this.ctl;
    // move on to the next leg of the trip by distance
    const phase = this.trip.phase;
    if (phase !== this.leg && !ctl.stop && !this._transition) { this.nextLeg(phase); }
    // arrival: ease to a stop at the destination
    if (!ctl.stop) {
      const rem = this.trip.remaining;
      if (rem < 260) ctl.stopGap = Math.max(1, rem - 7);
    }
    w.update(dt, ctl);
    // events -> sound
    for (const ev of w.events.splice(0)) { if (ev.type === 'signal-on') this.sound.tickStart(); else if (ev.type === 'signal-off') this.sound.tickStop(); }
    // trip, session and store
    const d = w.ego.v * dt;
    this.trip.advance(d);
    const mi = d / 1609.344; this.session.miles += mi; this.session.sec += dt;
    this.session.kwh += mi * (0.19 + w.ego.v / 400);        // loosely 190-260 Wh/mi
    st._speed = w.ego.v / MPH; st._gear = 'D'; st._target = st._speed;
    // arrived or stopped?
    if (w.ego.v < 0.15 && (ctl.stop || ctl.stopGap != null)) {
      if (this.arrivedT == null) { this.arrivedT = 0; if (!ctl.stop) { toast('You have arrived'); this.arrivedAt = true; } this.sound.chime('arrive'); }
      this.arrivedT += dt;
      if (this.arrivedT > 2.2) { this.parkAfterStop = false; this.enterPark(); return; }
    }
    this.scene.renderDrive(w, dt);
  }
}
