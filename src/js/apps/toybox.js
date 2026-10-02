import { h, toast } from '../util.js';
import { icon } from '../icons.js';
import { store } from '../state.js';

const TOYS = [
  ['Snake', 'game', snake], ['2048', 'game', game2048], ['Sketchpad', 'pen', sketch],
  ['Boombox', 'horn', boombox], ['Romance Mode', 'fire', romance], ['Light Show', 'light', lightshow],
];

export function mountToybox(root, ctx) {
  const home = h('div', { class: 'scroll', style: { flex: 1 } },
    h('div', { class: 'appgrid' }, TOYS.map(([name, ico, fn]) => h('button', { class: 'tile', onclick: () => open(name, fn) },
      h('div', { class: 'logo', style: { background: 'linear-gradient(135deg,#3e6ae1,#8a5cf6)' } }, icon(ico, 36)), name))));
  root.append(home);
  let stop = null;
  function open(name, fn) {
    if (name !== 'Boombox' && name !== 'Light Show' && store.get('_gear') !== 'P' && ['Snake', '2048', 'Sketchpad'].includes(name)) return toast('Arcade is available in Park only');
    const view = h('div', { class: 'overlay', style: { zIndex: 45 } },
      h('div', { class: 'overlay-head' }, h('button', { class: 'iconbtn', onclick: () => { stop?.(); view.remove(); } }, icon('back', 26)), name));
    const body = h('div', { style: { flex: 1, position: 'relative', minHeight: 0 } });
    view.append(body); root.append(view);
    stop = fn(body, ctx);
  }
  return () => stop?.();
}

/* -------- Snake -------- */
function snake(box) {
  const cv = h('canvas', { class: 'fill' }); box.append(cv);
  const score = h('div', { class: 'pill', style: { position: 'absolute', right: '24px', top: '0' } }, 'Score 0'); box.append(score);
  const N = 22; let s, dir, food, pts, alive, timer;
  const size = () => { cv.width = box.clientWidth; cv.height = box.clientHeight; };
  size();
  function reset() { s = [[11, 11], [10, 11], [9, 11]]; dir = [1, 0]; food = [5, 5]; pts = 0; alive = true; }
  reset();
  const turn = (dx, dy) => { if (dx !== -dir[0] || dy !== -dir[1]) dir = [dx, dy]; };
  let sx, sy;
  cv.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; if (!alive) reset(); });
  cv.addEventListener('pointerup', (e) => {
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
    Math.abs(dx) > Math.abs(dy) ? turn(Math.sign(dx), 0) : turn(0, Math.sign(dy));
  });
  const key = (e) => ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key] && turn(...{ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]));
  window.addEventListener('keydown', key);
  function step() {
    if (!alive) return;
    const hd = [s[0][0] + dir[0], s[0][1] + dir[1]];
    if (hd[0] < 0 || hd[1] < 0 || hd[0] >= N || hd[1] >= N || s.some((p) => p[0] === hd[0] && p[1] === hd[1])) { alive = false; return draw(); }
    s.unshift(hd);
    if (hd[0] === food[0] && hd[1] === food[1]) { pts++; score.textContent = 'Score ' + pts; food = [Math.floor(Math.random() * N), Math.floor(Math.random() * N)]; } else s.pop();
    draw();
  }
  function draw() {
    const c = cv.getContext('2d'), cs = Math.min(cv.width, cv.height) / N, ox = (cv.width - cs * N) / 2, oy = (cv.height - cs * N) / 2;
    c.clearRect(0, 0, cv.width, cv.height); c.fillStyle = 'rgba(128,128,128,.12)'; c.fillRect(ox, oy, cs * N, cs * N);
    c.fillStyle = '#e5484d'; c.beginPath(); c.arc(ox + food[0] * cs + cs / 2, oy + food[1] * cs + cs / 2, cs / 2.4, 0, 7); c.fill();
    s.forEach((p, i) => { c.fillStyle = i ? '#3e6ae1' : '#8fb0ff'; c.fillRect(ox + p[0] * cs + 1, oy + p[1] * cs + 1, cs - 2, cs - 2); });
    if (!alive) { c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(0, 0, cv.width, cv.height); c.fillStyle = '#fff'; c.font = '40px sans-serif'; c.textAlign = 'center'; c.fillText('Game over — tap to restart', cv.width / 2, cv.height / 2); }
  }
  timer = setInterval(step, 120); draw();
  return () => { clearInterval(timer); window.removeEventListener('keydown', key); };
}

/* -------- 2048 -------- */
function game2048(box) {
  let g = Array.from({ length: 4 }, () => Array(4).fill(0));
  const add = () => { const e = []; g.forEach((r, y) => r.forEach((v, x) => !v && e.push([x, y]))); if (!e.length) return; const [x, y] = e[Math.floor(Math.random() * e.length)]; g[y][x] = Math.random() < .9 ? 2 : 4; };
  add(); add();
  const board = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4,130px)', gap: '12px', position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', touchAction: 'none' } });
  box.append(board);
  const colors = { 0: 'var(--panel2)', 2: '#e8d9c0', 4: '#e6c98f', 8: '#f2a65a', 16: '#f08a4b', 32: '#ee6b47', 64: '#e84a32', 128: '#e8c14a', 256: '#e6b92f', 512: '#dcab16', 1024: '#cf9d00', 2048: '#3e6ae1' };
  const draw = () => board.replaceChildren(...g.flat().map((v) => h('div', { style: { height: '130px', borderRadius: '14px', display: 'grid', placeItems: 'center', fontSize: v > 512 ? '38px' : '46px', fontWeight: 600, background: colors[v] || '#3e6ae1', color: v > 4 ? '#fff' : '#3a3228' } }, v || '')));
  const slide = (row) => { const a = row.filter(Boolean); for (let i = 0; i < a.length - 1; i++) if (a[i] === a[i + 1]) { a[i] *= 2; a.splice(i + 1, 1); } while (a.length < 4) a.push(0); return a; };
  function move(d) {
    const before = JSON.stringify(g);
    if (d === 'l') g = g.map(slide);
    if (d === 'r') g = g.map((r) => slide(r.slice().reverse()).reverse());
    if (d === 'u' || d === 'd') { const t = g[0].map((_, x) => g.map((r) => r[x])); const m = t.map((c) => (d === 'u' ? slide(c) : slide(c.slice().reverse()).reverse())); g = g.map((_, y) => m.map((c) => c[y])); }
    if (JSON.stringify(g) !== before) add();
    draw();
  }
  let sx, sy;
  box.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; });
  box.addEventListener('pointerup', (e) => { const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.max(Math.abs(dx), Math.abs(dy)) < 25) return; Math.abs(dx) > Math.abs(dy) ? move(dx > 0 ? 'r' : 'l') : move(dy > 0 ? 'd' : 'u'); });
  const key = (e) => { const m = { ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'u', ArrowDown: 'd' }[e.key]; if (m) move(m); };
  window.addEventListener('keydown', key); draw();
  return () => window.removeEventListener('keydown', key);
}

/* -------- Sketchpad (multi-touch) -------- */
function sketch(box) {
  const cv = h('canvas', { class: 'fill', style: { background: 'var(--panel2)' } }); box.append(cv);
  cv.width = box.clientWidth; cv.height = box.clientHeight;
  const c = cv.getContext('2d'); let color = '#3e6ae1', w = 6; const last = new Map();
  const pal = h('div', { style: { position: 'absolute', left: '20px', top: '14px', display: 'flex', gap: '10px', zIndex: 3 } },
    ['#3e6ae1', '#e5484d', '#2fb36d', '#f5a524', '#ffffff', '#000000'].map((col) => h('button', { class: 'swatch', style: { background: col, width: '48px', height: '48px' }, onclick: () => (color = col) })),
    h('button', { class: 'btn', onclick: () => c.clearRect(0, 0, cv.width, cv.height) }, 'Clear'),
    h('button', { class: 'btn', onclick: () => (w = w === 6 ? 16 : 6) }, 'Brush size'));
  box.append(pal);
  const pos = (e) => { const r = cv.getBoundingClientRect(); const sc = r.width / cv.width; return [(e.clientX - r.left) / sc, (e.clientY - r.top) / sc]; };
  cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); last.set(e.pointerId, pos(e)); });
  cv.addEventListener('pointermove', (e) => { const p = last.get(e.pointerId); if (!p) return; const n = pos(e); c.strokeStyle = color; c.lineWidth = w * (e.pressure ? .5 + e.pressure : 1); c.lineCap = 'round'; c.beginPath(); c.moveTo(...p); c.lineTo(...n); c.stroke(); last.set(e.pointerId, n); });
  const up = (e) => last.delete(e.pointerId); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
}

/* -------- Boombox (synth horns / tones) -------- */
function boombox(box) {
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  const tone = (f, d = .5, type = 'sawtooth') => { const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = f; g.gain.value = .08 * (store.get('volume') / 50); o.connect(g).connect(ac.destination); o.start(); g.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + d); o.stop(ac.currentTime + d); };
  const sounds = [['Horn', () => { tone(380, .8, 'square'); tone(480, .8, 'square'); }], ['Dixie-ish', () => [392, 392, 523, 392, 523].forEach((f, i) => setTimeout(() => tone(f, .3, 'square'), i * 220))],
    ['Siren', () => { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sawtooth'; g.gain.value = .06; o.connect(g).connect(ac.destination); o.frequency.setValueAtTime(600, ac.currentTime); for (let i = 0; i < 6; i++) o.frequency.linearRampToValueAtTime(i % 2 ? 600 : 1000, ac.currentTime + i * .4 + .4); o.start(); o.stop(ac.currentTime + 2.4); }],
    ['Chime', () => [784, 988, 1175].forEach((f, i) => setTimeout(() => tone(f, .9, 'sine'), i * 140))], ['Low rumble', () => tone(55, 1.5, 'sawtooth')], ['Beep', () => tone(880, .2, 'square')]];
  box.append(h('div', { class: 'appgrid' }, sounds.map(([n, fn]) => h('button', { class: 'tile', onclick: fn }, icon('horn', 40), n))));
  return () => ac.close();
}

/* -------- Romance Mode (fireplace) -------- */
function romance(box) {
  const cv = h('canvas', { class: 'fill', style: { background: '#0a0605' } }); box.append(cv);
  cv.width = box.clientWidth; cv.height = box.clientHeight; const c = cv.getContext('2d');
  const ps = []; let raf;
  const loop = () => {
    c.globalCompositeOperation = 'source-over'; c.fillStyle = 'rgba(10,6,5,.22)'; c.fillRect(0, 0, cv.width, cv.height);
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 14; i++) ps.push({ x: cv.width / 2 + (Math.random() - .5) * 360, y: cv.height - 60, vx: (Math.random() - .5) * 1.2, vy: -2 - Math.random() * 4, r: 10 + Math.random() * 26, l: 1 });
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i]; p.x += p.vx + Math.sin(p.y / 30) * .6; p.y += p.vy; p.l -= .014; p.r *= .985;
      if (p.l <= 0) { ps.splice(i, 1); continue; }
      const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r); g.addColorStop(0, `rgba(255,${Math.floor(120 + 120 * p.l)},40,${p.l * .5})`); g.addColorStop(1, 'rgba(255,60,0,0)');
      c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 7); c.fill();
    }
    raf = requestAnimationFrame(loop);
  };
  loop();
  return () => cancelAnimationFrame(raf);
}

/* -------- Light Show (flashes car lights in rhythm) -------- */
function lightshow(box, ctx) {
  let n = 0, id;
  const btn = h('button', { class: 'btn primary', style: { position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', fontSize: '28px', padding: '28px 50px' }, onclick: () => {
    if (id) { clearInterval(id); id = null; store.set({ flash: 0 }); btn.textContent = 'Start light show'; return; }
    btn.textContent = 'Stop'; const pattern = [1, 1, 0, 1, 0, 0, 1, 1, 1, 0];
    id = setInterval(() => { store.set({ flash: pattern[n++ % pattern.length] ? 1 : 0 }); }, 260);
  } }, 'Start light show');
  box.append(btn, h('div', { class: 'muted', style: { position: 'absolute', bottom: '24px', width: '100%', textAlign: 'center' } }, 'Watch the car on the left panel — close this window to see it.'));
  return () => { clearInterval(id); store.set({ flash: 0 }); };
}
