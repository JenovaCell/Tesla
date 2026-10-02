// On-screen keyboard shown for any text field marked data-osk (or .big-input).
import { h } from './util.js';
import { icon } from './icons.js';

const ROWS = [
  ['1','2','3','4','5','6','7','8','9','0'],
  ['q','w','e','r','t','y','u','i','o','p'],
  ['a','s','d','f','g','h','j','k','l'],
  ['⇧','z','x','c','v','b','n','m','⌫'],
  ['?123','.','space','-','⏎'],
];
const SYM = [
  ['1','2','3','4','5','6','7','8','9','0'],
  ['@','#','$','%','&','*','(',')','/','\\'],
  ['!','"',"'",':',';','+','=','_','~'],
  ['⇧','<','>','[',']','{','}','|','⌫'],
  ['abc',',','space','.','⏎'],
];

export function initOSK(stage) {
  let kb = null, target = null, shift = false, sym = false;
  const wants = (el) => el && (el.matches?.('input[data-osk], textarea[data-osk], .big-input'));

  function render() {
    if (!kb) return;
    kb.replaceChildren();
    (sym ? SYM : ROWS).forEach((row) => {
      kb.append(h('div', { class: 'krow' }, row.map((k) => {
        const cls = 'key' + (k === 'space' ? ' space' : ['⇧', '⌫', '?123', 'abc', '⏎'].includes(k) ? ' wide' : '') + (k === '⇧' && shift ? ' on' : '');
        const label = k === 'space' ? '' : (shift && k.length === 1 ? k.toUpperCase() : k);
        return h('button', { class: cls, onpointerdown: (e) => { e.preventDefault(); press(k); } }, label);
      })));
    });
  }
  function press(k) {
    if (!target) return;
    if (k === '⇧') { shift = !shift; return render(); }
    if (k === '?123') { sym = true; return render(); }
    if (k === 'abc') { sym = false; return render(); }
    if (k === '⏎') { target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return hide(); }
    if (k === '⌫') {
      const s = target.selectionStart, e = target.selectionEnd;
      if (s === e && s > 0) target.setRangeText('', s - 1, e, 'end'); else target.setRangeText('', s, e, 'end');
    } else {
      const ch = k === 'space' ? ' ' : shift ? k.toUpperCase() : k;
      target.setRangeText(ch, target.selectionStart, target.selectionEnd, 'end');
      if (shift) { shift = false; render(); }
    }
    target.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function show(el) {
    target = el;
    if (!kb) { kb = h('div', { class: 'osk', onpointerdown: (e) => e.preventDefault() }); stage.append(kb); render(); }
  }
  function hide() { kb?.remove(); kb = null; target = null; }

  document.addEventListener('focusin', (e) => { if (wants(e.target)) show(e.target); });
  document.addEventListener('focusout', (e) => { if (wants(e.target)) setTimeout(() => { if (!wants(document.activeElement)) hide(); }, 120); });
  return { hide };
}
