// Embedded browser used by Theater, Music and Web Browser. Uses Electron <webview> with a persistent
// partition so Netflix / Disney+ / Spotify logins survive restarts. Falls back to <iframe> outside Electron.
// Shells live in a persistent layer and are hidden (not detached) so music keeps playing in the background.
import { h } from './util.js';
import { icon } from './icons.js';
import { store } from './state.js';

const hasHost = !!window.host;
const cache = new Map(); // id -> { shell, view, entry }

export function normalizeUrl(s) {
  s = (s || '').trim();
  if (!s) return 'https://www.google.com';
  if (/^[a-z]+:\/\//i.test(s)) return s;
  if (/^[\w-]+(\.[\w-]+)+(\/|$|:)/.test(s)) return 'https://' + s;
  return 'https://www.google.com/search?q=' + encodeURIComponent(s);
}

function makeView(url) {
  if (hasHost) {
    const v = document.createElement('webview');
    v.setAttribute('src', url);
    v.setAttribute('partition', 'persist:streaming');
    v.setAttribute('allowpopups', '');
    return v;
  }
  const f = document.createElement('iframe');
  f.src = url; f.setAttribute('allow', 'autoplay; fullscreen; encrypted-media');
  f.style.border = '0';
  return f;
}

const layer = () => document.getElementById('webLayer');

/** opts: { id, url, keepAlive, onClose } -- shows the shell (creating it on first use). */
export function openWebShell(opts) {
  let c = cache.get(opts.id);
  if (c) { c.shell.style.display = 'flex'; c.opts = opts; return c; }

  const view = makeView(opts.url);
  view.style.cssText = 'flex:1;width:100%;background:#000';
  const urlBox = h('input', { class: 'url', value: opts.url, spellcheck: 'false', 'data-osk': '1' });
  const shell = h('div', { class: 'webshell' });
  c = { shell, view, opts };
  cache.set(opts.id, c);
  let immersive = false;
  const nav = (fn) => () => { try { fn(); } catch (_) {} };
  const peek = h('div', { style: { position: 'absolute', top: 0, left: 0, right: 0, height: '18px', zIndex: 7, display: 'none' },
    onpointerdown: () => setImmersive(false) });
  const setImmersive = (v) => { immersive = v; shell.classList.toggle('immersive', v); peek.style.display = v ? 'block' : 'none'; };

  const bar = h('div', { class: 'webbar' },
    h('button', { class: 'iconbtn', title: 'Close', onclick: () => closeWebShell(opts.id) }, icon('close', 26)),
    h('button', { class: 'iconbtn', onclick: nav(() => view.goBack()) }, icon('back', 26)),
    h('button', { class: 'iconbtn', onclick: nav(() => view.goForward()) }, icon('chev', 26)),
    h('button', { class: 'iconbtn', onclick: nav(() => (view.reload ? view.reload() : (view.src = view.src))) }, icon('recirc', 24)),
    urlBox,
    h('button', { class: 'iconbtn', title: 'Hide bar', onclick: () => setImmersive(!immersive) }, icon('full', 24)),
  );
  urlBox.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const u = normalizeUrl(urlBox.value);
    hasHost ? view.loadURL(u) : (view.src = u);
    urlBox.blur();
  });
  if (hasHost) {
    const upd = (e) => { if (e.url) urlBox.value = e.url; };
    view.addEventListener('did-navigate', upd);
    view.addEventListener('did-navigate-in-page', upd);
    view.addEventListener('dom-ready', applyVolume);
  }
  function applyVolume() {
    if (!hasHost) return;
    const v = store.get('volume') / 100;
    try { view.setAudioMuted(v === 0); view.executeJavaScript(`document.querySelectorAll('video,audio').forEach(m=>{try{m.volume=${v}}catch(e){}})`); } catch (_) {}
  }
  store.subscribe((p) => { if ('volume' in p) applyVolume(); });

  shell.append(bar, view, peek);
  layer().append(shell);
  shell.style.display = 'flex';
  return c;
}

/** Hide (keepAlive) or destroy a shell, then fire its onClose callback. */
export function closeWebShell(id) {
  const c = cache.get(id);
  if (!c) return;
  if (c.opts.keepAlive) c.shell.style.display = 'none';
  else { cache.delete(id); c.shell.remove(); }
  c.opts.onClose?.();
}

export function stopWeb(id) {
  const c = cache.get(id);
  if (c) { cache.delete(id); c.shell.remove(); }
}
export const isWebActive = (id) => cache.has(id);
