import { createStore, clamp } from './util.js';
import { MODELS } from './models.js';

export const store = createStore({
  model: 'modely', paint: 0, wheel: 0,
  theme: 'auto', brightness: 100, clock24: false, units: 'mi', tempUnit: 'F', stretch: false, hideCursor: true,
  volume: 45,
  locked: true, sentry: false, doors: { fl: false, fr: false, rl: false, rr: false }, frunk: false, trunk: false,
  chargePort: false, charging: false, chargeLimit: 80, lights: 'auto', headlights: false, flash: 0, mirrorsFolded: false,
  soc: 78, odo: 4821.4, tripA: 0, tripB: 0, tires: [42, 42, 41, 42],
  climate: { on: true, auto: true, L: 70, R: 70, fan: 3, ac: true, recirc: false, defrostF: false, defrostR: false,
    seatL: 0, seatR: 0, seatRL: 0, seatRR: 0, wheelHeat: false, bioweapon: false, dog: false, camp: false, keepOn: false, overheat: true },
  s: {},   // generic settings (see controls.js)
  events: [],
  pos: { lat: 37.3947, lng: -122.1503, name: 'Palo Alto, CA' },
  recents: [],
  // volatile (underscore = not persisted)
  _gear: 'P', _ap: false, _speed: 0, _target: 0, _cabin: 72, _outside: 61, _route: null, _routeProgress: 0, _routeDist: 0,
  _screenClean: false, _fullscreen: false, _nowPlaying: null,
});

export const model = () => MODELS[store.get('model')] || MODELS.modely;
export const paintHex = () => model().paints[store.get('paint')]?.[1] ?? model().paints[0][1];
export const setting = (key, def) => (key in store.state.s ? store.state.s[key] : def);
export const setSetting = (key, v) => store.set({ s: { ...store.state.s, [key]: v } });

// Units helpers
export const mi2 = (mi) => (store.get('units') === 'km' ? mi * 1.609344 : mi);
export const distUnit = () => store.get('units');
export const speedFromMph = (mph) => Math.round(mi2(mph));
export const toTemp = (f) => (store.get('tempUnit') === 'C' ? (Math.round(((f - 32) * 5) / 9 * 2) / 2).toFixed(1).replace(/\.0$/, '') : Math.round(f));
export const tempStr = (f) => `${toTemp(f)}°`;
export const rangeMi = () => (model().rangeMi * store.get('soc')) / 100;

export function resolvedTheme() {
  const t = store.get('theme');
  if (t !== 'auto') return t;
  const hr = new Date().getHours();
  return hr >= 7 && hr < 19 ? 'light' : 'dark';
}

// ---- Simulation tick (called every 250 ms) ----
let last = performance.now();
export function simTick(onRouteAdvance) {
  const now = performance.now();
  const dt = Math.min(1, (now - last) / 1000); last = now;
  const st = store.state;
  const patch = {};

  // speed model: ease toward target (skipped while the drive display owns the speed)
  const moving = st._gear === 'D' || st._gear === 'R';
  let sp = st._speed;
  if (!st._ap) {
    const maxMph = st._gear === 'R' ? 8 : model().topMph;
    const target = moving ? clamp(st._target, 0, maxMph) : 0;
    const rate = target > st._speed ? (model().zeroTo60 < 3.5 ? 22 : 14) : 28;
    sp = st._speed + clamp(target - st._speed, -rate * dt, rate * dt);
    if (Math.abs(sp - st._speed) > 0.01) patch._speed = sp < 0.05 ? 0 : sp;
  }

  if (sp > 0.1) {
    const miles = (sp / 3600) * dt;
    patch.odo = st.odo + miles;
    patch.tripA = st.tripA + miles;
    patch.tripB = st.tripB + miles;
    patch.soc = clamp(st.soc - miles * (100 / model().rangeMi) * (0.9 + sp / 140), 0, 100);
  }
  // charging
  if (st.charging && st.chargePort && st._gear === 'P') {
    if (st.soc >= st.chargeLimit) { patch.charging = false; }
    else patch.soc = clamp((patch.soc ?? st.soc) + dt * 0.12, 0, 100); // ~ fast demo rate
  }
  // cabin temperature drifts toward HVAC setpoint (or outside temp when off)
  const c = st.climate;
  const set = c.on ? (c.L + c.R) / 2 : st._outside;
  const cab = st._cabin + clamp(set - st._cabin, -0.35 * dt, 0.35 * dt);
  if (Math.abs(cab - st._cabin) > 0.005) patch._cabin = cab;
  // lights flash counter (light show)
  if (Object.keys(patch).length) store.set(patch);
}
