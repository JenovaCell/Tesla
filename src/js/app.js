import { h, $, toast } from './util.js';
import { icon } from './icons.js';
import { store, model, resolvedTheme, simTick } from './state.js';
import { tempControl, climatePopup } from './climate.js';
import { slider } from './ui.js';
import { mountControls } from './controls.js';
import { mountTheater } from './apps/theater.js';
import { mountMusic } from './apps/music.js';
import { mountToybox } from './apps/toybox.js';
import { mountPhone, mountCalendar, mountEnergy, mountCamera, openBrowser } from './apps/misc.js';
import { initOSK } from './osk.js';
import { Director } from './drive/director.js';

const stage = $('#stage');
let director = null;
const ctx = { toast, shift: (g) => director?.requestGear(g), openApp, closeApp };

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
const ACCENT = { controls: null, music: '#ff4d6d', phone: '#34c759', calendar: '#ff9f0a', energy: '#ffd60a', theater: '#ff453a', toybox: '#bf5af2', camera: '#64d2ff', apps: null };
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
    Object.entries(APPS).filter(([k]) => k !== 'apps').map(([k, a]) =>
      h('button', { class: 'tile', onclick: () => (a.action ? a.action() : openApp(k)) },
        h('div', { class: 'logo', style: { background: 'linear-gradient(135deg,#3e6ae1,#2f4fa8)' } }, icon(a.icon, 36)), a.name)))));
}

/** True while something covers the drive display (an app sheet or a web player). */
function isBusy() {
  if (overlay) return true;
  const wl = document.getElementById('webLayer');
  return !!wl && [...wl.children].some((e) => e.style.display !== 'none');
}

/* ============ Build UI ============ */
function build() {
  stage.replaceChildren();
  const screen = h('div', { class: 'screen' });
  stage.append(screen, h('div', { id: 'webLayer' }));
  director = new Director(screen, { openApp, isBusy });
  window.drive = director;       // handy for debugging from the dev tools console
  screen.append(buildDock());
}

function buildDock() {
  const left = tempControl('L'), right = tempControl('R');
  let cp = null, vp = null;
  const toggleClimate = () => {
    if (cp) { cp._dispose?.(); cp.remove(); cp.scrim?.remove(); cp = null; return; }
    cp = climatePopup(toggleClimate);
    cp.scrim = h('div', { class: 'scrim', onpointerdown: toggleClimate });
    $('.screen').append(cp.scrim, cp);
  };
  document.addEventListener('open-climate', toggleClimate);
  const closeVol = () => { vp.scrim.remove(); vp.remove(); vp = null; };
  const vol = h('button', { class: 'dockbtn', onclick: () => {
    if (vp) return closeVol();
    vp = h('div', { class: 'popup', style: { right: '24px', bottom: 'calc(var(--dock-h) + 10px)', width: '460px', display: 'flex', alignItems: 'center', gap: '16px' } },
      icon('vol', 30), slider({ min: 0, max: 100, value: store.get('volume'), onChange: (v) => store.set({ volume: v }) }));
    vp.scrim = h('div', { class: 'scrim', onpointerdown: closeVol });
    $('.screen').append(vp.scrim, vp);
  } }, icon('vol', 28));
  const theme = h('button', { class: 'dockbtn', id: 'themeBtn', title: 'Light / Dark', onclick: () => store.set({ theme: resolvedTheme() === 'dark' ? 'light' : 'dark' }) });
  const full = h('button', { class: 'dockbtn', title: 'Fullscreen (F11)', onclick: () => toggleFullscreen() }, icon('full', 26));
  return h('div', { class: 'dock' }, left,
    h('div', { class: 'center' }, DOCK.map((id) => h('button', { class: 'dockbtn', 'data-app': id, title: APPS[id].name, style: ACCENT[id] ? { color: ACCENT[id] } : null, onclick: () => openApp(id) }, icon(APPS[id].icon, 30)))),
    right, vol, theme, full);
}
function toggleFullscreen() {
  if (window.host) window.host.toggleFullscreen();
  else document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
}

/* ============ Reactive updates ============ */
function refreshStatic() {
  const th = resolvedTheme();
  document.documentElement.dataset.theme = th;
  $('#themeBtn')?.replaceChildren(icon(th === 'dark' ? 'moon' : 'sun', 26));
  stage.style.filter = store.get('brightness') < 100 ? `brightness(${store.get('brightness') / 100})` : '';
  fit();
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

  const KEYS_VISUAL = ['model', 'theme', 'stretch', 'brightness', '_screenClean'];
  store.subscribe((p) => {
    if (Object.keys(p).some((k) => KEYS_VISUAL.includes(k))) refreshStatic();
    if ('_screenClean' in p) screenClean();
    if ('model' in p) setTimeout(() => toast(model().name), 50);
  });
  refreshStatic();

  setInterval(() => simTick(() => {}), 250);
  setInterval(() => { if (store.get('theme') === 'auto') refreshStatic(); }, 30000);
  window.addEventListener('resize', fit);

  const fsChange = (v) => { store.state._fullscreen = v; fit(); };
  window.host?.onFullscreen(fsChange); window.host?.isFullscreen().then(fsChange);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F11') { e.preventDefault(); toggleFullscreen(); }
    if (e.key === 'Escape' && store.state._fullscreen && !overlayId) window.host?.toggleFullscreen(false);
  });
  let cursorT;
  window.addEventListener('mousemove', () => { document.body.classList.remove('cursor-hide'); clearTimeout(cursorT); if (store.get('hideCursor')) cursorT = setTimeout(() => document.body.classList.add('cursor-hide'), 2500); });
  document.addEventListener('close-app', closeApp);
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
}
boot();
