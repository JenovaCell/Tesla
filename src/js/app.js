import { h, $, fmtTime, toast } from './util.js';
import { icon } from './icons.js';
import { store, model, resolvedTheme, simTick, speedFromMph, distUnit, tempStr, rangeMi, mi2 } from './state.js';
import { carSVG } from './car.js';
import * as nav from './nav.js';
import { tempControl, climatePopup } from './climate.js';
import { slider } from './ui.js';
import { mountControls } from './controls.js';
import { mountTheater } from './apps/theater.js';
import { mountMusic, stopNowPlaying } from './apps/music.js';
import { mountToybox } from './apps/toybox.js';
import { mountPhone, mountCalendar, mountEnergy, mountCamera, backupCamera, openBrowser } from './apps/misc.js';
import { initOSK } from './osk.js';
import { player } from './media.js';

const stage = $('#stage');
const ctx = { toast, shift, openApp, closeApp };

/* ============ App registry ============ */
const APPS = {
  controls: { name: 'Controls', icon: 'car', mount: (r) => mountControls(r) },
  music: { name: 'Media', icon: 'music', mount: (r) => mountMusic(r, ctx) },
  phone: { name: 'Phone', icon: 'phone', mount: (r) => mountPhone(r) },
  calendar: { name: 'Calendar', icon: 'cal', mount: (r) => mountCalendar(r) },
  energy: { name: 'Energy', icon: 'energy', mount: (r) => mountEnergy(r) },
  theater: { name: 'Theater', icon: 'film', mount: (r) => mountTheater(r, ctx) },
  toybox: { name: 'Toybox', icon: 'toy', mount: (r) => mountToybox(r, ctx) },
  camera: { name: 'Camera', icon: 'cam', mount: (r) => mountCamera(r) },
  browser: { name: 'Web', icon: 'globe', action: () => { closeApp(); openBrowser(); } },
  apps: { name: 'Apps', icon: 'apps', mount: (r) => mountLauncher(r) },
};
const DOCK = ['controls', 'music', 'phone', 'calendar', 'energy', 'theater', 'toybox', 'camera', 'apps'];

let overlay = null, overlayId = null, overlayDispose = null;
function closeApp() {
  overlayDispose?.(); overlay?.remove(); overlay = overlayId = overlayDispose = null;
  document.querySelectorAll('.dockbtn').forEach((b) => b.classList.remove('active'));
}
function openApp(id, opts = {}) {
  const app = APPS[id];
  if (app.action) return app.action();
  if (overlayId === id) return closeApp();
  closeApp();
  const body = h('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' } });
  overlay = h('div', { class: 'overlay sheet' },
    h('div', { class: 'overlay-head' }, icon(app.icon, 32), app.name, h('div', { class: 'sp' }),
      h('button', { class: 'iconbtn', onclick: closeApp }, icon('close', 26))), body);
  $('.screen').append(overlay);
  overlayId = id;
  overlayDispose = app.mount(body, opts);
  document.querySelector(`.dockbtn[data-app="${id}"]`)?.classList.add('active');
}
function mountLauncher(root) {
  root.append(h('div', { class: 'scroll', style: { flex: 1 } }, h('div', { class: 'appgrid' },
    [...Object.entries(APPS).filter(([k]) => k !== 'apps'), ['nav', { name: 'Navigation', icon: 'nav', action: () => closeApp() }]].map(([k, a]) =>
      h('button', { class: 'tile', onclick: () => (a.action ? a.action() : openApp(k)) },
        h('div', { class: 'logo', style: { background: 'linear-gradient(135deg,#3e6ae1,#2f4fa8)' } }, icon(a.icon, 36)), a.name)))));
}

/* ============ Gear / drive logic ============ */
let backup = null;
function shift(g) {
  const st = store.state;
  if (g === st._gear) return;
  if (g === 'P' && st._speed > 2) return toast('Stop the vehicle before shifting to Park');
  if ((g === 'D' && st._gear === 'R' || g === 'R' && st._gear === 'D') && st._speed > 2) return toast('Come to a stop first');
  if (g !== 'P' && Object.values(st.doors).some(Boolean)) return toast('Close all doors first');
  if (g !== 'P' && (st.frunk || st.trunk)) return toast('Close the ' + (st.frunk ? 'frunk' : 'trunk') + ' first');
  const patch = { _gear: g };
  if (g === 'P' || g === 'N') patch._target = 0;
  if (g !== 'P') { patch.charging = false; patch.chargePort = false; }
  store.set(patch);
}
function applyGearSideEffects() {
  const g = store.get('_gear');
  if (g === 'R' && !backup) { backup = backupCamera(); $('.screen').append(backup); }
  if (g !== 'R' && backup) { backup._stop(); backup.remove(); backup = null; }
}

/* ============ Build UI ============ */
let hudSpeed, hudUnit, battPct, battRange, battBar, carHolder, roadEl, tripStats, setSpeedVal, clockEl, tempEl, gearBtns = {};
let mapSearchResults, tripCard, miniMedia;

function build() {
  stage.replaceChildren();
  const screen = h('div', { class: 'screen' });
  stage.append(screen, h('div', { id: 'webLayer' }));
  screen.append(buildStatus(), h('div', { class: 'main' }, buildLeft(), buildRight()), buildDock());
}

function buildStatus() {
  const gears = h('div', { class: 'gears' }, ['P', 'R', 'N', 'D'].map((g) => {
    const b = h('button', { onclick: () => shift(g) }, g); gearBtns[g] = b; return b;
  }));
  clockEl = h('span'); tempEl = h('span');
  const lockChip = h('div', { class: 'chip', id: 'lockChip', onclick: () => store.set({ locked: !store.get('locked') }) });
  const sentryChip = h('div', { class: 'chip', id: 'sentryChip', onclick: () => store.set({ sentry: !store.get('sentry') }) }, icon('sentry', 24));
  const fsBtn = h('button', { class: 'chip', id: 'fsBtn', title: 'Fullscreen (F11)', onclick: () => window.host?.toggleFullscreen() || (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()) }, icon('full', 24));
  const themeBtn = h('button', { class: 'chip', id: 'themeBtn', title: 'Light / Dark', onclick: () => store.set({ theme: resolvedTheme() === 'dark' ? 'light' : 'dark' }) });
  return h('div', { class: 'statusbar' }, gears, lockChip, sentryChip, h('span', { class: 'sp' }),
    h('div', { class: 'chip', onclick: () => openApp('controls') }, icon('wifi', 22), icon('bt', 22)),
    themeBtn, fsBtn,
    h('div', { class: 'chip', style: { color: 'var(--text)' } }, tempEl), h('div', { style: { fontWeight: 600, minWidth: '70px', textAlign: 'right' } }, clockEl));
}

function buildLeft() {
  hudSpeed = h('div', { class: 'speed' }, '0'); hudUnit = h('small');
  battPct = h('span'); battRange = h('small'); battBar = h('i');
  roadEl = h('div', { class: 'road' }, [-1, 0, 1].map(() => h('i')));
  carHolder = h('div', { style: { display: 'contents' } });
  setSpeedVal = h('b', { style: { width: '80px', textAlign: 'right' } }, '0');
  const pedal = h('div', { id: 'pedal', style: { display: 'none', padding: '0 24px 14px', alignItems: 'center', gap: '16px' } },
    h('span', { class: 'muted', style: { width: '90px' } }, 'Set speed'),
    slider({ min: 0, max: 90, value: 0, onInput: (v) => { setSpeedVal.textContent = speedFromMph(v); }, onChange: (v) => store.set({ _target: v }) }),
    setSpeedVal, h('button', { class: 'btn danger', onclick: () => { store.set({ _target: 0 }); pedal.querySelector('.slider').set(0); setSpeedVal.textContent = '0'; } }, 'Brake'));
  const q = (id, ico, label, fn) => h('button', { id: 'q-' + id, onclick: fn }, icon(ico, 30), label);
  const quick = h('div', { class: 'quick' },
    q('frunk', 'frunk', 'Frunk', () => store.set({ frunk: !store.get('frunk') })),
    q('trunk', 'trunk', model().trunk, () => store.set({ trunk: !store.get('trunk') })),
    q('lock', 'lock', 'Lock', () => store.set({ locked: !store.get('locked') })),
    q('port', 'port', 'Charge port', () => store.set({ chargePort: !store.get('chargePort'), charging: false })),
    q('lights', 'light', 'Lights', () => store.set({ headlights: !store.get('headlights') })),
    q('doors', 'car', 'Doors', () => { const d = store.get('doors'); const any = Object.values(d).some(Boolean); store.set({ doors: { fl: !any, fr: !any, rl: !any, rr: !any } }); }));
  return h('div', { class: 'left' }, h('div', { class: 'carview' },
    h('div', { class: 'hud' }, h('div', null, hudSpeed, hudUnit),
      h('div', { class: 'batt' }, battPct, h('div', { class: 'bar' }, battBar), battRange)),
    h('div', { class: 'carstage' }, roadEl, carHolder), pedal, quick));
}

function buildRight() {
  const mapEl = h('div', { id: 'map' });
  const input = h('input', { 'data-osk': '1', placeholder: 'Navigate', spellcheck: 'false' });
  mapSearchResults = h('div', { class: 'results', style: { display: 'none' } });
  const run = async () => {
    const q = input.value.trim(); if (!q) return;
    mapSearchResults.style.display = 'block'; mapSearchResults.replaceChildren(h('button', null, 'Searching…'));
    try {
      const res = await nav.search(q);
      mapSearchResults.replaceChildren(...(res.length ? res.map((r) => h('button', { onclick: () => pick(r) }, r.name, h('small', null, r.addr))) : [h('button', null, 'No results')]));
    } catch (e) { mapSearchResults.replaceChildren(h('button', null, 'Search unavailable (offline?)')); }
  };
  async function pick(r) {
    mapSearchResults.style.display = 'none'; input.value = ''; input.blur();
    try { await nav.routeTo(r); toast('Route to ' + r.name); updateTrip(); }
    catch (e) { toast('Could not get a route'); }
  }
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
  const bar = h('div', { class: 'searchbar' }, icon('search', 26), input,
    h('button', { class: 'iconbtn', style: { width: '44px', height: '44px' }, onclick: run }, icon('chev', 22)));
  tripCard = h('div', { class: 'card tripcard', style: { display: 'none' } });
  miniMedia = h('div', { class: 'minimedia', style: { display: 'none' } });
  const ctl = h('div', { class: 'mapctl' },
    h('button', { class: 'iconbtn', onclick: () => nav.zoom(1) }, icon('plus', 26)),
    h('button', { class: 'iconbtn', onclick: () => nav.zoom(-1) }, h('span', { style: { fontSize: '30px', lineHeight: 1 } }, '−')),
    h('button', { class: 'iconbtn', onclick: () => nav.recenter() }, icon('nav', 24)));
  const right = h('div', { class: 'right' }, mapEl, bar, mapSearchResults, ctl, tripCard, miniMedia);
  queueMicrotask(() => nav.mountMap(mapEl));
  return right;
}

function updateTrip() {
  const r = nav.remaining();
  if (!r) { tripCard.style.display = 'none'; tripStats = null; tripCard.replaceChildren(); return; }
  if (!tripStats) {
    tripStats = h('div', { class: 'muted', style: { margin: '6px 0 14px' } });
    tripCard.replaceChildren(
      h('div', { style: { fontSize: '22px', fontWeight: 500 } }, store.get('_route').dest.name), tripStats,
      h('div', { style: { display: 'flex', gap: '10px' } },
        h('button', { class: 'btn primary', onclick: () => { shift('D'); if (store.get('_gear') === 'D') { store.set({ _target: 30 }); $('#pedal .slider')?.set(30); } } }, 'Start drive sim'),
        h('button', { class: 'btn', onclick: () => nav.cancelRoute() }, 'Cancel')));
  }
  tripCard.style.display = 'block';
  tripStats.textContent = `${r.miles.toFixed(1)} ${r.unit} · ${r.mins} min · arrive ${fmtTime(new Date(Date.now() + r.mins * 60000), store.get('clock24'))}`;
}

function updateMini() {
  const np = store.get('_nowPlaying');
  if (!np) { miniMedia.style.display = 'none'; return; }
  const local = np.source === 'USB / Local';
  miniMedia.style.display = 'flex';
  miniMedia.replaceChildren(...[
    h('div', { class: 'art' }, icon('music', 30)), h('div', { class: 'meta' }, h('b', null, np.title), h('span', null, np.source)),
    local && h('button', { class: 'iconbtn', onclick: () => player.prev() }, icon('prev', 22)),
    local ? h('button', { class: 'iconbtn', onclick: () => player.toggle() }, icon(player.playing ? 'pause' : 'play', 22)) : h('button', { class: 'btn', onclick: () => openApp('music') }, 'Open'),
    local && h('button', { class: 'iconbtn', onclick: () => player.next() }, icon('next', 22)),
    h('button', { class: 'iconbtn', onclick: () => stopNowPlaying() }, icon('close', 20)),
  ].filter(Boolean));
}

function buildDock() {
  const left = tempControl('L'), right = tempControl('R');
  let cp = null;
  const toggleClimate = () => {
    if (cp) { cp._dispose?.(); cp.remove(); cp.scrim?.remove(); cp = null; return; }
    cp = climatePopup(toggleClimate);
    cp.scrim = h('div', { class: 'scrim', onpointerdown: toggleClimate });
    $('.screen').append(cp.scrim, cp);
  };
  document.addEventListener('open-climate', toggleClimate);
  const vol = h('button', { class: 'dockbtn', onclick: () => {
    if (vp) { vp.scrim.remove(); vp.remove(); vp = null; return; }
    vp = h('div', { class: 'popup', style: { right: '24px', bottom: '116px', width: '460px', display: 'flex', alignItems: 'center', gap: '16px' } },
      icon('vol', 30), slider({ min: 0, max: 100, value: store.get('volume'), onChange: (v) => store.set({ volume: v }) }));
    vp.scrim = h('div', { class: 'scrim', onpointerdown: () => { vp.scrim.remove(); vp.remove(); vp = null; } });
    $('.screen').append(vp.scrim, vp);
  } }, icon('vol', 32));
  let vp = null;
  return h('div', { class: 'dock' }, left,
    h('div', { class: 'center' }, DOCK.map((id) => h('button', { class: 'dockbtn', 'data-app': id, title: APPS[id].name, onclick: () => openApp(id) }, icon(APPS[id].icon, 36)))),
    right, vol);
}

/* ============ Reactive updates ============ */
function refreshStatic() {
  const st = store.state, m = model();
  const th = resolvedTheme();
  document.documentElement.dataset.theme = th;
  $('#themeBtn')?.replaceChildren(icon(th === 'dark' ? 'moon' : 'sun', 24));
  $('#lockChip')?.replaceChildren(icon(st.locked ? 'lock' : 'unlock', 24));
  $('#lockChip')?.classList.toggle('on', st.locked);
  $('#sentryChip')?.classList.toggle('alert', st.sentry);
  $('#sentryChip')?.classList.toggle('on', false);
  for (const g of 'PRND') gearBtns[g]?.classList.toggle('active', st._gear === g);
  const on = (id, v) => $('#q-' + id)?.classList.toggle('on', !!v);
  on('frunk', st.frunk); on('trunk', st.trunk); on('lock', st.locked); on('port', st.chargePort); on('lights', st.headlights || st.lights === 'on');
  on('doors', Object.values(st.doors).some(Boolean));
  const tl = $('#q-trunk'); if (tl) tl.lastChild.textContent = m.trunk;
  const lk = $('#q-lock'); if (lk) { lk.replaceChildren(icon(st.locked ? 'lock' : 'unlock', 30), st.locked ? 'Locked' : 'Unlocked'); }
  const ped = $('#pedal'); if (ped) ped.style.display = st._gear === 'D' || st._gear === 'R' ? 'flex' : 'none';
  stage.style.filter = st.brightness < 100 ? `brightness(${st.brightness / 100})` : '';
  carHolder.replaceChildren(carSVG());
  tickText();
  updateTrip(); updateMini(); applyGearSideEffects();
  fit();
}
function tickText() {
  const st = store.state, m = model();
  hudSpeed.textContent = speedFromMph(st._speed);
  hudUnit.textContent = (distUnit() === 'km' ? 'km/h' : 'mph') + ' · ' + { P: 'Park', R: 'Reverse', N: 'Neutral', D: 'Drive' }[st._gear];
  battPct.textContent = Math.round(st.soc) + '%';
  battRange.textContent = `${Math.round(mi2(rangeMi()))} ${distUnit()}${st.charging ? ' · charging' : ''}`;
  battBar.style.width = st.soc + '%'; battBar.style.background = st.soc < 20 ? 'var(--bad)' : st.soc < 35 ? 'var(--warn)' : st.charging ? 'var(--accent)' : 'var(--good)';
  clockEl.textContent = fmtTime(new Date(), st.clock24); tempEl.textContent = tempStr(st._outside);
  const moving = st._speed > 1;
  roadEl.classList.toggle('on', moving);
  if (moving) roadEl.querySelectorAll('i').forEach((el, i) => {
    el.style.animationDuration = Math.max(0.35, 3.2 - st._speed / 30) + 's'; el.style.animationDelay = (i * -1.1) + 's';
    el.style.marginLeft = (-3 + (i - 1) * 110) + 'px';
  });
  updateTrip();
}

/* ============ Stage scaling / fullscreen ============ */
function fit() {
  const base = model().screen, W = window.innerWidth, H = window.innerHeight;
  const s = Math.min(W / base.w, H / base.h);
  const stretch = store.get('stretch');
  stage.style.width = (stretch ? W / s : base.w) + 'px';
  stage.style.height = (stretch ? H / s : base.h) + 'px';
  stage.style.transform = `translate(-50%,-50%) scale(${s})`;
  document.body.classList.toggle('windowed', !store.get('_fullscreen') && !stretch);
}

function screenClean() {
  if (!store.get('_screenClean')) return;
  let t;
  const ov = h('div', { style: { position: 'fixed', inset: 0, background: '#000', zIndex: 99999, display: 'grid', placeItems: 'center', color: '#444', fontSize: '26px', textAlign: 'center' } },
    'Screen clean mode\nPress and hold for 3 seconds to exit');
  ov.style.whiteSpace = 'pre-line';
  const end = () => clearTimeout(t);
  ov.addEventListener('pointerdown', () => { t = setTimeout(() => { ov.remove(); store.set({ _screenClean: false }); }, 3000); });
  ov.addEventListener('pointerup', end); ov.addEventListener('pointercancel', end);
  document.body.append(ov);
}

/* ============ Boot ============ */
function boot() {
  build();
  initOSK(stage);
  const splash = h('div', { class: 'splash' }, h('div', { style: { textAlign: 'center' } }, h('div', { class: 'logo' }, 'TOUCH\nSCREEN\nSIM'), h('div', { style: { marginTop: '22px', color: '#889', letterSpacing: '3px' } }, model().name.toUpperCase())));
  splash.querySelector('.logo').style.whiteSpace = 'pre-line';
  stage.append(splash);
  setTimeout(() => splash.classList.add('out'), 1100); setTimeout(() => splash.remove(), 1800);

  const KEYS_VISUAL = ['model', 'paint', 'wheel', 'doors', 'frunk', 'trunk', 'locked', 'sentry', 'headlights', 'lights', 'flash', 'chargePort', 'charging',
    'theme', 'stretch', 'brightness', 'units', 'tempUnit', 'clock24', '_gear', '_route', '_nowPlaying', '_screenClean'];
  store.subscribe((p) => {
    if (Object.keys(p).some((k) => KEYS_VISUAL.includes(k))) refreshStatic();
    if ('_screenClean' in p) screenClean();
    if ('model' in p) setTimeout(() => toast(model().name), 50);
  });
  refreshStatic();
  player.on(updateMini);

  setInterval(() => { simTick(nav.advance); tickText(); }, 250);
  setInterval(() => { clockEl.textContent = fmtTime(new Date(), store.get('clock24')); if (store.get('theme') === 'auto') refreshStatic(); }, 30000);
  window.addEventListener('resize', fit);

  // fullscreen state + shortcuts + cursor autohide
  const fsChange = (v) => { store.state._fullscreen = v; fit(); };
  window.host?.onFullscreen(fsChange); window.host?.isFullscreen().then(fsChange);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F11') { e.preventDefault(); window.host ? window.host.toggleFullscreen() : (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()); }
    if (e.key === 'Escape' && store.state._fullscreen && !overlayId) window.host?.toggleFullscreen(false);
  });
  let cursorT;
  window.addEventListener('mousemove', () => { document.body.classList.remove('cursor-hide'); clearTimeout(cursorT); if (store.get('hideCursor')) cursorT = setTimeout(() => document.body.classList.add('cursor-hide'), 2500); });
  document.addEventListener('close-app', closeApp);
  // Stop kiosk-style accidents: block context menu + zoom gestures
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
}
boot();
