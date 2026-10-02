import { h } from './util.js';
import { icon } from './icons.js';
import { store, tempStr } from './state.js';
import { slider, toggleBtn } from './ui.js';

const setC = (p) => store.set({ climate: { ...store.get('climate'), ...p } });

export function tempControl(side) {
  const root = h('div', { class: 'temp' + (side === 'R' ? ' r' : '') });
  const render = () => {
    const c = store.get('climate'), seatKey = side === 'L' ? 'seatL' : 'seatR', lv = c[seatKey];
    const step = (d) => () => setC({ [side]: Math.min(82, Math.max(60, c[side] + (store.get('tempUnit') === 'C' ? d * 1.8 : d))), on: true });
    // like the real bar: dim chevrons around a number with a tiny "Manual" caption; the seat-heat glyph only shows while it is on
    const seat = h('button', { class: 'seat', title: 'Seat heat', onclick: () => setC({ [seatKey]: (lv + 1) % 4 }) }, icon('heatseat', 34));
    const dn = h('button', { class: 'step', onclick: step(-1) }, icon('back', 18));
    const up = h('button', { class: 'step', onclick: step(1) }, icon('chev', 18));
    const val = h('div', { class: 'val', onclick: () => document.dispatchEvent(new CustomEvent('open-climate')) },
      h('small', null, c.auto ? 'Auto' : 'Manual'), h('b', null, c.on ? tempStr(c[side]) : 'OFF'));
    const parts = side === 'L' ? [dn, val, up, ...(lv ? [seat] : [])] : [...(lv ? [seat] : []), dn, val, up];
    root.replaceChildren(...parts);
  };
  render();
  store.subscribe((p) => { if ('climate' in p || 'tempUnit' in p) render(); });
  return root;
}

export function climatePopup(close) {
  const el = h('div', { class: 'popup', style: { left: '50%', bottom: '112px', transform: 'translateX(-50%)', width: '860px' } });
  const render = () => {
    const c = store.get('climate');
    const t = (key, ico, label) => toggleBtn(!!c[key], ico, label, () => setC({ [key]: !c[key] }));
    el.replaceChildren(
      h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' } },
        h('div', { class: 'h2', style: { margin: 0 } }, c.on ? `Cabin ${tempStr(store.get('_cabin'))}` : 'Climate off'),
        h('div', { style: { display: 'flex', gap: '10px' } },
          h('button', { class: 'btn ' + (c.on ? 'primary' : ''), onclick: () => setC({ on: !c.on }) }, c.on ? 'ON' : 'OFF'),
          h('button', { class: 'iconbtn', onclick: close }, icon('close', 24)))),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '16px', margin: '6px 0 14px' } },
        icon('fan', 30), slider({ min: 0, max: 7, step: 1, value: c.fan, onChange: (v) => setC({ fan: v, on: true }) }),
        h('b', { style: { width: '30px', fontSize: '24px' } }, c.fan)),
      h('div', { class: 'quick', style: { padding: 0 } },
        t('auto', 'fan', 'Auto'), t('ac', 'snow', 'A/C'), t('recirc', 'recirc', 'Recirculate'),
        t('defrostF', 'defrost', 'Front defrost'), t('defrostR', 'defrost', 'Rear defrost'), t('wheelHeat', 'wheel', 'Wheel heat'),
        t('bioweapon', 'fan', 'Bioweapon defense'), t('dog', 'fire', 'Dog mode'), t('camp', 'moon', 'Camp mode'),
        t('keepOn', 'sun', 'Keep climate on'), t('overheat', 'sun', 'Overheat protect')),
      h('div', { style: { display: 'flex', gap: '12px', marginTop: '14px', alignItems: 'center' } },
        h('span', { class: 'muted' }, 'Front seats'),
        ...['seatL', 'seatR'].map((k) => h('button', { class: 'btn', onclick: () => setC({ [k]: (c[k] + 1) % 4 }) },
          icon('heat', 22), k === 'seatL' ? 'Driver' : 'Passenger', ' ', c[k] ? '●'.repeat(c[k]) : 'off'))),
      h('div', { style: { display: 'flex', gap: '12px', marginTop: '10px', alignItems: 'center' } },
        h('span', { class: 'muted' }, 'Rear seats'),
        ...['seatRL', 'seatRR'].map((k) => h('button', { class: 'btn', onclick: () => setC({ [k]: (c[k] + 1) % 4 }) },
          icon('heat', 22), k === 'seatRL' ? 'Left' : 'Right', ' ', c[k] ? '●'.repeat(c[k]) : 'off'))),
    );
  };
  render();
  el._dispose = store.subscribe((p) => { if ('climate' in p || '_cabin' in p) render(); });
  return el;
}
