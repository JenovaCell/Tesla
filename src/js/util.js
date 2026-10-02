// Tiny DOM + store helpers (no framework, no build step).
export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, kids);
  return el;
}
function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k.nodeType ? k : document.createTextNode(String(k)));
  }
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const fmtTime = (d, h24) =>
  d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: !h24 }).replace(/\s?(AM|PM)/i, '');

// Persistent reactive store: set() merges, notifies subscribers, saves to localStorage.
const KEY = 'teslaSim.v1';
export function createStore(defaults) {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (_) {}
  const state = { ...defaults, ...saved };
  const subs = new Set();
  const persistKeys = new Set(Object.keys(defaults).filter((k) => !k.startsWith('_')));
  return {
    state,
    get: (k) => state[k],
    set(patch) {
      Object.assign(state, patch);
      try {
        localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(Object.entries(state).filter(([k]) => persistKeys.has(k)))));
      } catch (_) {}
      subs.forEach((fn) => fn(patch, state));
    },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
}

// Simple toast
export function toast(msg, ms = 2200) {
  const root = document.getElementById('toasts');
  if (!root) return;
  const t = h('div', { class: 'toast' }, msg);
  root.append(t);
  setTimeout(() => t.classList.add('out'), ms);
  setTimeout(() => t.remove(), ms + 400);
}
