// "Controls" app: left category list + settings panels (v14 style).
import { h, toast } from './util.js';
import { icon } from './icons.js';
import { store, model, setting, setSetting, tempStr, distUnit, mi2 } from './state.js';
import { MODELS, MODEL_ORDER } from './models.js';
import { slider, toggle, segmented, row } from './ui.js';

const tog = (key, label, def = false, sub) => row(label, toggle(setting(key, def), (v) => setSetting(key, v)), sub);
const seg = (key, label, opts, def) => row(label, segmented(opts, setting(key, def), (v) => setSetting(key, v)));
const sl = (key, label, min, max, def, fmt = (v) => v) => {
  const val = h('b', { style: { width: '90px', textAlign: 'right' } }, fmt(setting(key, def)));
  return row(label, h('div', { style: { display: 'flex', gap: '14px', alignItems: 'center', width: '480px' } },
    slider({ min, max, value: setting(key, def), onInput: (v) => { val.textContent = fmt(v); }, onChange: (v) => setSetting(key, v) }), val));
};
const act = (label, fn, cls = '') => h('button', { class: 'btn ' + cls, onclick: fn }, label);
const toggleBool = (key, label, sub) => row(label, toggle(!!store.get(key), (v) => store.set({ [key]: v })), sub);

const PANELS = {
  quick: ['Quick Controls', 'bolt', () => {
    const st = store.state;
    const btn = (ico, label, on, fn) => h('button', { class: on ? 'on' : '', onclick: fn }, icon(ico, 34), label);
    return [h('div', { class: 'quick', style: { padding: 0 } },
      btn('frunk', 'Frunk', st.frunk, () => store.set({ frunk: !st.frunk })),
      btn('trunk', model().trunk, st.trunk, () => store.set({ trunk: !st.trunk })),
      btn('port', 'Charge port', st.chargePort, () => store.set({ chargePort: !st.chargePort, charging: false })),
      btn(st.locked ? 'lock' : 'unlock', st.locked ? 'Locked' : 'Unlocked', !st.locked, () => store.set({ locked: !st.locked })),
      btn('sentry', 'Sentry', st.sentry, () => store.set({ sentry: !st.sentry })),
      btn('light', 'Lights', st.headlights, () => store.set({ headlights: !st.headlights })),
      btn('bt', 'Fold mirrors', st.mirrorsFolded, () => store.set({ mirrorsFolded: !st.mirrorsFolded })),
      btn('fan', 'Wipers', setting('wipers', false), () => { setSetting('wipers', true); toast('Wipers: one sweep'); setTimeout(() => setSetting('wipers', false), 1500); }),
      btn('car', 'Window vent', setting('windowsVent', false), () => setSetting('windowsVent', !setting('windowsVent', false))),
      btn('horn', 'Honk', false, () => { beep(); }),
      btn('light', 'Flash lights', false, () => { let n = 0; const id = setInterval(() => { store.set({ flash: store.get('flash') + 1 }); if (++n > 5) { clearInterval(id); store.set({ flash: 0 }); } }, 220); }),
      btn('cam', 'Save dashcam clip', false, () => toast('Dashcam clip saved')),
    ), h('div', { style: { marginTop: '18px' } }, row('Open / close doors',
      h('div', { style: { display: 'flex', gap: '10px' } }, ...['fl', 'fr', 'rl', 'rr'].map((d) =>
        h('button', { class: 'btn ' + (st.doors[d] ? 'primary' : ''), onclick: () => store.set({ doors: { ...st.doors, [d]: !st.doors[d] } }) },
          { fl: 'Front L', fr: 'Front R', rl: 'Rear L', rr: 'Rear R' }[d])))))];
  }],
  pedals: ['Pedals & Steering', 'wheel', () => [
    seg('accel', 'Acceleration', [['chill', 'Chill'], ['standard', 'Standard'], ['sport', 'Sport']], 'standard'),
    seg('steer', 'Steering feel', [['comfort', 'Comfort'], ['standard', 'Standard'], ['sport', 'Sport']], 'standard'),
    seg('stopping', 'Stopping mode', [['creep', 'Creep'], ['roll', 'Roll'], ['hold', 'Hold']], 'hold'),
    tog('regen', 'Standard regen braking', true), tog('slip', 'Slip start', false),
  ]],
  charging: ['Charging', 'port', () => {
    const st = store.state, m = model();
    const kwh = (m.battery * st.soc) / 100;
    return [
      row('Battery', h('b', null, `${Math.round(st.soc)}%  ·  ${Math.round(mi2((m.rangeMi * st.soc) / 100))} ${distUnit()}  ·  ${kwh.toFixed(1)} kWh`)),
      row('Charge limit', h('div', { style: { display: 'flex', gap: '14px', alignItems: 'center', width: '480px' } },
        slider({ min: 50, max: 100, step: 5, value: st.chargeLimit, onChange: (v) => store.set({ chargeLimit: v }) }), h('b', null, st.chargeLimit + '%'))),
      row('Charge port door', toggle(st.chargePort, (v) => store.set({ chargePort: v, charging: v ? st.charging : false }))),
      row('Charging (plug in & start, parked)', toggle(st.charging, (v) => {
        if (!st.chargePort) { toast('Open the charge port first'); store.set({ charging: false }); return; }
        if (store.get('_gear') !== 'P') { toast('Shift to Park to charge'); return; }
        store.set({ charging: v });
      }), 'Simulated fast charge rate'),
      seg('chargeAmps', 'Charge current', [['16', '16 A'], ['32', '32 A'], ['48', '48 A']], '32'),
      tog('schedCharge', 'Scheduled charging', false), tog('preheat', 'Precondition for departure', false),
    ];
  }],
  autopilot: ['Autopilot', 'wheel', () => [
    seg('ap', 'Autopilot features', [['tacc', 'Traffic-Aware Cruise'], ['autosteer', 'Autosteer']], 'autosteer'),
    tog('fsd', 'Full Self-Driving (Supervised)', true, 'Simulated; shows the visualization only'),
    sl('follow', 'Following distance', 1, 7, 3), sl('speedOffset', 'Set speed offset (mph)', -10, 15, 0),
    tog('navAP', 'Navigate on Autopilot', true), tog('autoLane', 'Auto lane change', true),
    tog('laneDep', 'Lane departure avoidance', true), tog('summon', 'Summon / Actually Smart Summon', true),
    seg('fsdProfile', 'FSD profile', [['chill', 'Chill'], ['average', 'Average'], ['assertive', 'Assertive']], 'average'),
  ]],
  locks: ['Locks', 'lock', () => [
    toggleBool('locked', 'Vehicle locked'), tog('walkAway', 'Walk-away door lock', true), tog('unlockPark', 'Unlock on park', false),
    tog('autoFold', 'Fold mirrors on lock', true), tog('childLock', 'Child-protection rear locks', false), tog('pin', 'PIN to Drive', false),
    toggleBool('sentry', 'Sentry Mode'), tog('sentryExcl', 'Exclude Home from Sentry', true),
  ]],
  lights: ['Lights', 'light', () => [
    row('Exterior lights', segmented([['off', 'Off'], ['park', 'Park'], ['on', 'On'], ['auto', 'Auto']], store.get('lights'), (v) => store.set({ lights: v }))),
    tog('autoHigh', 'Auto high beam', true), tog('fog', 'Fog lights', false), tog('drl', 'Daytime running lights', true),
    sl('ambient', 'Ambient light brightness', 0, 100, 60, (v) => v + '%'), tog('interior', 'Interior lights on exit', true),
  ]],
  display: ['Display', 'sun', () => [
    row('Theme', segmented([['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']], store.get('theme'), (v) => store.set({ theme: v }))),
    row('Brightness', h('div', { style: { display: 'flex', gap: '14px', alignItems: 'center', width: '480px' } },
      slider({ min: 20, max: 100, value: store.get('brightness'), onChange: (v) => store.set({ brightness: v }) }))),
    row('Clock', segmented([['false', '12h'], ['true', '24h']], String(store.get('clock24')), (v) => store.set({ clock24: v === 'true' }))),
    row('Distance units', segmented([['mi', 'Miles'], ['km', 'Kilometers']], store.get('units'), (v) => store.set({ units: v }))),
    row('Temperature', segmented([['F', '°F'], ['C', '°C']], store.get('tempUnit'), (v) => store.set({ tempUnit: v }))),
    row('Fill the whole window', toggle(store.get('stretch'), (v) => store.set({ stretch: v })), 'Off keeps the real screen aspect ratio of the selected car'),
    row('Hide mouse cursor (touch kiosk)', toggle(store.get('hideCursor'), (v) => store.set({ hideCursor: v }))),
    row('Screen clean mode', act('Start', () => { document.dispatchEvent(new CustomEvent('close-app')); store.set({ _screenClean: true }); })),
  ]],
  trips: ['Trips', 'nav', () => {
    const st = store.state, f = (mi) => `${mi2(mi).toFixed(1)} ${distUnit()}`;
    return [row('Odometer', h('b', null, f(st.odo))),
      row('Trip A', h('div', { style: { display: 'flex', gap: '14px', alignItems: 'center' } }, h('b', null, f(st.tripA)), act('Reset', () => store.set({ tripA: 0 })))),
      row('Trip B', h('div', { style: { display: 'flex', gap: '14px', alignItems: 'center' } }, h('b', null, f(st.tripB)), act('Reset', () => store.set({ tripB: 0 })))),
      row('Efficiency (est.)', h('b', null, `${Math.round(model().battery * 1000 / model().rangeMi)} Wh/${distUnit()}`))];
  }],
  navigation: ['Navigation', 'nav', () => [
    seg('mapMode', 'Map view', [['north', 'North up'], ['heading', 'Heading up']], 'north'),
    tog('avoidTolls', 'Avoid tolls', false), tog('avoidHwy', 'Avoid highways', false), tog('traffic', 'Show traffic (visual only)', true),
    tog('chargerRoute', 'Add Supercharger stops', true), row('Car location', h('b', null, store.get('pos').name || 'Custom')),
  ]],
  safety: ['Safety', 'sentry', () => [
    seg('fcw', 'Forward collision warning', [['off', 'Off'], ['late', 'Late'], ['med', 'Medium'], ['early', 'Early']], 'med'),
    tog('aeb', 'Automatic emergency braking', true), tog('blind', 'Blind spot collision warning chime', true),
    tog('speedWarn', 'Speed limit warning', false), tog('cabinCam', 'Cabin camera', false), tog('childLeft', 'Cabin overheat / child left alone', true),
  ]],
  service: ['Service', 'gear', () => [
    row('Tire pressure (psi)', h('div', { style: { display: 'flex', gap: '18px' } }, ...store.get('tires').map((p, i) => h('span', { class: 'pill' }, ['FL', 'FR', 'RL', 'RR'][i] + ' ' + p)))),
    row('Wiper service mode', act('Enter', () => toast('Wipers raised (simulated)'))),
    row('Vehicle', h('b', null, `${model().name}`)), row('VIN', h('span', { class: 'muted' }, 'SIMULATED0000000')),
    row('Factory reset simulator data', act('Reset', () => { localStorage.clear(); location.reload(); }, 'danger')),
  ]],
  software: ['Software', 'apps', () => [
    row('Version', h('b', null, 'Tesla Screen Sim · UI v14-style')), row('Status', h('span', { class: 'muted' }, 'Up to date (simulated)')),
    tog('advanced', 'Advanced preferences', false), seg('updates', 'Software updates', [['adv', 'Advanced'], ['std', 'Standard']], 'std'),
  ]],
  network: ['Wi-Fi & Bluetooth', 'wifi', () => [
    tog('wifi', 'Wi-Fi', true, 'The simulator uses this PC’s connection'), tog('bt', 'Bluetooth', true),
    row('Paired phone', h('b', null, 'Pixel / iPhone (simulated)')), tog('hotspot', 'Mobile hotspot', false),
  ]],
  sim: ['Simulator', 'car', () => {
    const cur = model();
    const el = h('div');
    const rebuild = () => { el.replaceChildren(...build()); };
    const build = () => {
      const m = model();
      return [
        h('div', { class: 'h2' }, 'Choose vehicle'),
        h('div', { class: 'seg', style: { flexWrap: 'wrap', marginBottom: '22px' } }, MODEL_ORDER.map((k) =>
          h('button', { class: k === store.get('model') ? 'active' : '', onclick: () => { store.set({ model: k, paint: 0, wheel: 0 }); rebuild(); } }, MODELS[k].name))),
        h('div', { class: 'muted', style: { margin: '-10px 0 18px' } },
          `${m.screen.inches}" display · ${m.battery} kWh · ~${Math.round(mi2(m.rangeMi))} ${distUnit()} · 0-60 in ${m.zeroTo60}s${m.note ? ' · ' + m.note : ''}`),
        h('div', { class: 'h2' }, 'Paint'),
        h('div', { class: 'swatches', style: { marginBottom: '22px' } }, m.paints.map(([n, hex], i) =>
          h('button', { class: 'swatch' + (i === store.get('paint') ? ' active' : ''), title: n, style: { background: hex }, onclick: () => { store.set({ paint: i }); rebuild(); } }))),
        h('div', { class: 'h2' }, 'Wheels'),
        h('div', { class: 'seg', style: { marginBottom: '26px', flexWrap: 'wrap' } }, m.wheels.map((w, i) =>
          h('button', { class: i === store.get('wheel') ? 'active' : '', onclick: () => { store.set({ wheel: i }); rebuild(); } }, w))),
        h('div', { class: 'h2' }, 'Drive display'),
        tog('autoDemo', 'Auto-run Self-Driving demo (loops, for a desk display)', true),
        seg('vizQuality', 'Graphics quality', [['low', 'Low'], ['balanced', 'Balanced'], ['high', 'High']], 'balanced'),
        row('Start / stop the drive now', act('Toggle', () => { const d = window.drive; if (!d) return; d.state === 'park' ? d.startFSD() : d.endTrip(); document.dispatchEvent(new CustomEvent('close-app')); })),
        row('Fullscreen (F11)', act('Toggle', () => window.host?.toggleFullscreen())),
        row('Exit simulator', act('Quit', () => window.host?.quit(), 'danger')),
      ];
    };
    el.append(...build());
    return [el];
  }],
};

export const CONTROL_TABS = Object.keys(PANELS);

function beep() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'square'; o.frequency.value = 410; g.gain.value = 0.05; o.connect(g).connect(ac.destination); o.start(); setTimeout(() => { o.stop(); ac.close(); }, 450);
  } catch (_) {}
}

export function mountControls(root, startTab = 'quick') {
  let tab = startTab;
  const list = h('div', { class: 'tabs-v scroll' });
  const content = h('div', { class: 'scroll', style: { flex: 1, padding: '10px 36px 36px' } });
  const draw = () => {
    list.replaceChildren(...Object.entries(PANELS).map(([k, [name, ico]]) =>
      h('button', { class: k === tab ? 'active' : '', onclick: () => { tab = k; draw(); } }, icon(ico, 28), name)));
    content.replaceChildren(h('div', { class: 'h2', style: { marginTop: '8px' } }, PANELS[tab][0]), h('div', { class: 'card' }, ...PANELS[tab][2]()));
  };
  draw();
  // Live refresh for panels that mirror simulation state. High-frequency sim keys are ignored; the
  // charging/trips panels refresh on a slow timer instead. Never redraw mid-drag.
  const NOISY = new Set(['soc', 'odo', 'tripA', 'tripB', 'pos', 'recents', 'events', 'volume', 'flash']);
  const dragging = () => !!content.querySelector('.slider') && content.matches(':active');
  const redraw = () => { if (dragging()) return; const top = content.scrollTop; draw(); content.scrollTop = top; };
  const un = store.subscribe((p) => {
    const keys = Object.keys(p);
    if (keys.every((k) => (k.startsWith('_') && k !== '_gear') || NOISY.has(k))) return;
    if (tab === 'sim' && keys.some((k) => ['model', 'paint', 'wheel'].includes(k))) return; // sim panel rebuilds itself
    redraw();
  });
  const timer = setInterval(() => { if (tab === 'charging' || tab === 'trips') redraw(); }, 1500);
  root.append(list, content);
  root.style.flexDirection = 'row';
  return () => { un(); clearInterval(timer); };
}
