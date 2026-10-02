// Phone, Calendar, Energy, Camera, Browser, App launcher
import { h, toast } from '../util.js';
import { icon } from '../icons.js';
import { store, model, mi2, distUnit, rangeMi } from '../state.js';
import { openWebShell } from '../webshell.js';

/* ---------------- Phone ---------------- */
export function mountPhone(root) {
  const contacts = [['Mom', '555-0100'], ['Dad', '555-0101'], ['Alex Rivera', '555-0143'], ['Work', '555-0177'], ['Pizza Place', '555-0199']];
  let num = '';
  const disp = h('div', { style: { fontSize: '44px', height: '64px', letterSpacing: '2px', marginBottom: '14px' } }, '');
  const pad = h('div', { class: 'dial' }, ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((k) =>
    h('button', { onclick: () => { num += k; disp.textContent = num; } }, k)));
  const call = (n, who) => {
    const ov = h('div', { class: 'overlay', style: { zIndex: 50, alignItems: 'center', justifyContent: 'center', gap: '12px' } },
      h('div', { style: { width: '120px', height: '120px', borderRadius: '60px', background: 'var(--panel3)', display: 'grid', placeItems: 'center' } }, icon('phone', 56)),
      h('div', { style: { fontSize: '36px' } }, who || n), h('div', { class: 'muted' }, 'Calling… (simulated)'),
      h('button', { class: 'btn danger', style: { marginTop: '22px', width: '220px' }, onclick: () => ov.remove() }, 'End call'));
    root.append(ov);
    setTimeout(() => ov.querySelector('.muted') && (ov.querySelector('.muted').textContent = 'Connected 00:01'), 2000);
  };
  root.append(h('div', { style: { display: 'flex', gap: '40px', padding: '10px 40px', flex: 1, minHeight: 0 } },
    h('div', { class: 'card', style: { width: '420px' } }, disp, pad,
      h('div', { style: { display: 'flex', gap: '14px', marginTop: '16px' } },
        h('button', { class: 'btn', onclick: () => { num = num.slice(0, -1); disp.textContent = num; } }, '⌫'),
        h('button', { class: 'btn primary', style: { flex: 1 }, onclick: () => num && call(num) }, icon('phone', 22), 'Call'))),
    h('div', { class: 'card scroll', style: { flex: 1 } }, h('div', { class: 'h2' }, 'Favorites'),
      contacts.map(([n, p]) => h('div', { class: 'row' }, h('div', null, n, h('div', { class: 'sub' }, p)),
        h('button', { class: 'iconbtn', onclick: () => call(p, n) }, icon('phone', 24)))))));
}

/* ---------------- Calendar ---------------- */
export function mountCalendar(root) {
  const KEY = 'teslaSim.cal';
  let events = []; try { events = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (_) {}
  let cur = new Date(); cur.setDate(1);
  const grid = h('div', { class: 'cal-grid' });
  const title = h('div', { style: { fontSize: '30px', flex: 1 } });
  const input = h('input', { class: 'big-input', 'data-osk': '1', placeholder: 'New event title for selected day…', style: { flex: 1 } });
  let sel = new Date();
  const key = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  const draw = () => {
    title.textContent = cur.toLocaleDateString([], { month: 'long', year: 'numeric' });
    grid.replaceChildren(...['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => h('div', { class: 'muted', style: { textAlign: 'center' } }, d)));
    const start = new Date(cur); start.setDate(1 - start.getDay());
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const k = key(d), evs = events.filter((e) => e.k === k);
      const cell = h('button', { class: 'd' + (d.getMonth() !== cur.getMonth() ? ' dim' : '') + (k === key(new Date()) ? ' today' : '') + (k === key(sel) ? ' sel' : ''),
        style: k === key(sel) ? { outline: '2px solid var(--accent)' } : null, onclick: () => { sel = d; draw(); } }, d.getDate(), evs.map((e) => h('i', null, e.t)));
      grid.append(cell);
    }
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && input.value.trim()) { events.push({ k: key(sel), t: input.value.trim() }); localStorage.setItem(KEY, JSON.stringify(events)); input.value = ''; draw(); toast('Event added'); } });
  root.append(h('div', { class: 'scroll', style: { flex: 1, padding: '0 28px 28px' } },
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' } },
      h('button', { class: 'iconbtn', onclick: () => { cur.setMonth(cur.getMonth() - 1); draw(); } }, icon('back', 24)), title,
      h('button', { class: 'iconbtn', onclick: () => { cur.setMonth(cur.getMonth() + 1); draw(); } }, icon('chev', 24))),
    grid, h('div', { style: { display: 'flex', gap: '12px', marginTop: '16px' } }, input)));
  draw();
}

/* ---------------- Energy ---------------- */
export function mountEnergy(root) {
  const m = model();
  const wrap = h('div', { class: 'scroll', style: { flex: 1, padding: '0 28px 28px' } });
  root.append(wrap);
  const series = []; let v = 240; for (let i = 0; i < 60; i++) { v = Math.max(150, Math.min(420, v + (Math.random() - .5) * 40)); series.push(v); }
  const draw = () => {
    const proj = Math.round(mi2(rangeMi())), whmi = Math.round((m.battery * 1000) / m.rangeMi);
    const w = 1100, hgt = 300, max = 450;
    const pts = series.map((s, i) => `${(i / 59) * w},${hgt - (s / max) * hgt}`).join(' ');
    const svg = `<svg viewBox="0 0 ${w} ${hgt}" width="100%" height="320" preserveAspectRatio="none">
      <polyline points="${pts}" fill="none" stroke="#3e6ae1" stroke-width="3"/>
      <polyline points="0,${hgt - (whmi / max) * hgt} ${w},${hgt - (whmi / max) * hgt}" stroke="#2fb36d" stroke-dasharray="8 8" stroke-width="2"/></svg>`;
    wrap.replaceChildren(
      h('div', { style: { display: 'flex', gap: '18px', marginBottom: '18px' } },
        ...[['Range', `${proj} ${distUnit()}`], ['Battery', `${Math.round(store.get('soc'))}%`], ['Rated', `${whmi} Wh/${distUnit()}`], ['Speed', `${Math.round(store.get('_speed'))} mph`]]
          .map(([k, val]) => h('div', { class: 'card', style: { flex: 1 } }, h('div', { class: 'muted' }, k), h('div', { style: { fontSize: '40px', fontWeight: 300 } }, val)))),
      h('div', { class: 'card' }, h('div', { class: 'h2' }, 'Consumption (simulated trace)'), h('div', { html: svg }),
        h('div', { class: 'muted' }, 'Blue: instantaneous Wh/mi · Green: rated average')));
  };
  draw();
  const t = setInterval(draw, 2000);
  return () => clearInterval(t);
}

/* ---------------- Camera (uses the PC webcam) ---------------- */
export function mountCamera(root) {
  const video = h('video', { autoplay: true, muted: true, playsinline: true, style: { width: '100%', height: '100%', objectFit: 'cover', borderRadius: '18px', background: '#050607' } });
  const msg = h('div', { class: 'muted', style: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' } }, 'Requesting camera…');
  const cams = ['Front', 'Left repeater', 'Right repeater', 'Rear'];
  const grid = h('div', { style: { flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: '14px', padding: '0 24px 24px' } });
  const clones = cams.map((c) => h('div', { style: { position: 'relative', borderRadius: '18px', overflow: 'hidden', background: '#050607' } },
    h('video', { autoplay: true, muted: true, playsinline: true, style: { width: '100%', height: '100%', objectFit: 'cover', transform: c === 'Rear' ? 'scaleX(-1)' : 'none' } }),
    h('div', { class: 'pill', style: { position: 'absolute', left: '12px', bottom: '12px', background: 'rgba(0,0,0,.6)', color: '#fff' } }, c)));
  grid.append(...clones);
  root.append(grid, msg);
  let stream;
  navigator.mediaDevices?.getUserMedia({ video: true }).then((s) => { stream = s; msg.remove(); clones.forEach((c) => (c.querySelector('video').srcObject = s)); })
    .catch(() => { msg.textContent = 'No camera available — showing placeholder. (Plug in/enable a webcam to see live feeds.)'; });
  return () => stream?.getTracks().forEach((t) => t.stop());
}

/* Backup camera overlay (auto in Reverse) */
export function backupCamera(onExit) {
  const video = h('video', { autoplay: true, muted: true, playsinline: true, style: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' } });
  const guide = h('div', { html: '<svg viewBox="0 0 100 60" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%"><path d="M22 58 L38 22 M78 58 L62 22" stroke="#3ddc84" stroke-width=".7" fill="none"/><path d="M30 40H70M26 50H74" stroke="#f5a524" stroke-width=".6"/></svg>' });
  const el = h('div', { class: 'overlay', style: { zIndex: 55, background: '#050607', top: '64px' } }, video, guide,
    h('div', { class: 'pill', style: { position: 'absolute', left: '24px', top: '24px', background: 'rgba(0,0,0,.6)', color: '#fff', fontSize: '18px' } }, 'Rear camera'));
  navigator.mediaDevices?.getUserMedia({ video: true }).then((s) => { video.srcObject = s; el._stream = s; }).catch(() => {});
  el._stop = () => el._stream?.getTracks().forEach((t) => t.stop());
  return el;
}

/* ---------------- Browser ---------------- */
export function openBrowser() {
  openWebShell({ id: 'browser', url: 'https://www.google.com', keepAlive: true });
}
