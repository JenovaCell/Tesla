// Reusable touch widgets.
import { h, clamp } from './util.js';
import { icon } from './icons.js';

export function slider({ min = 0, max = 100, step = 1, value = 0, onChange, onInput }) {
  const el = h('div', { class: 'slider' }, h('div', { class: 'track' }), h('div', { class: 'fill' }), h('div', { class: 'knob' }));
  const fill = el.querySelector('.fill'), knob = el.querySelector('.knob');
  let v = value;
  const draw = () => { const f = (v - min) / (max - min); fill.style.width = f * 100 + '%'; knob.style.left = f * 100 + '%'; };
  const setFrom = (e) => {
    const r = el.getBoundingClientRect();
    const scale = r.width / el.offsetWidth || 1;           // account for stage CSS scale
    const f = clamp((e.clientX - r.left) / (el.offsetWidth * scale), 0, 1);
    v = clamp(Math.round((min + f * (max - min)) / step) * step, min, max);
    draw(); onInput?.(v);
  };
  el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); setFrom(e); el._drag = true; });
  el.addEventListener('pointermove', (e) => { if (el._drag) setFrom(e); });
  const end = () => { if (el._drag) { el._drag = false; onChange?.(v); } };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  el.set = (nv) => { v = nv; draw(); };
  draw();
  return el;
}

export function toggle(on, onChange) {
  const el = h('button', { class: 'toggle' + (on ? ' on' : '') });
  el.onclick = () => { on = !on; el.classList.toggle('on', on); onChange(on); };
  return el;
}
export function segmented(options, value, onChange) {
  const el = h('div', { class: 'seg' });
  options.forEach(([val, label]) => {
    el.append(h('button', { class: val === value ? 'active' : '', onclick: () => {
      el.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
      el.querySelector(`[data-v="${val}"]`).classList.add('active'); onChange(val);
    }, 'data-v': val }, label));
  });
  return el;
}
export function toggleBtn(on, ico, label, onclick) {
  return h('button', { class: on ? 'on' : '', onclick }, icon(ico, 30), label);
}
export function row(label, control, sub) {
  return h('div', { class: 'row' }, h('div', null, label, sub ? h('div', { class: 'sub' }, sub) : null), control);
}
