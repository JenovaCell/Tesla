// Top-down vehicle render (original vector art). Doors, closures and lights react to state.
import { store, model, paintHex } from './state.js';

const BODIES = {
  sedan: {
    body: 'M100 24C150 24 177 48 179 104L183 322C183 380 150 414 100 414C50 414 17 380 17 322L21 104C23 48 50 24 100 24Z',
    glass: 'M54 150Q100 128 146 150L152 252Q100 268 48 252Z', roof: 'M62 168Q100 152 138 168L141 244Q100 256 59 244Z',
    hood: 'M45 60Q100 22 155 60L158 128Q100 112 42 128Z', doorsY: [150, 252, 330], wheelY: [96, 348], w: 200,
  },
  suv: {
    body: 'M100 26C152 26 178 48 180 104L184 338C184 386 150 416 100 416C50 416 16 386 16 338L20 104C22 48 48 26 100 26Z',
    glass: 'M52 148Q100 128 148 148L154 290Q100 304 46 290Z', roof: 'M60 164Q100 150 140 164L143 284Q100 296 57 284Z',
    hood: 'M44 60Q100 24 156 60L159 126Q100 110 41 126Z', doorsY: [148, 238, 330], wheelY: [96, 352], w: 200,
  },
  truck: {
    body: 'M70 24L130 24L184 120L190 408L10 408L16 120Z',
    glass: 'M50 138L150 138L156 232L44 232Z', roof: 'M58 152L142 152L146 226L54 226Z',
    hood: 'M62 40L138 40L172 112L28 112Z', doorsY: [138, 236, 330], wheelY: [88, 348], w: 200, bed: true,
  },
};

export function carSVG(opts = {}) {
  const st = store.state, m = model(), b = BODIES[m.body], paint = paintHex();
  const dark = parseInt(paint.slice(1), 16) < 0x333333;
  const edge = dark ? 'rgba(255,255,255,.28)' : 'rgba(0,0,0,.35)';
  const door = st.doors;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '-70 0 340 440'); svg.setAttribute('class', 'car');
  const hl = st.headlights || st.lights === 'on' || (st.lights === 'auto' && (document.documentElement.dataset.theme === 'dark'));
  const flash = st.flash % 2 === 1;
  const lockedTint = st.locked ? '' : '<circle cx="100" cy="212" r="5" fill="#f5a524"/>';
  const doorShape = (x, y, h, side, open, falcon) => {
    const hx = side === 'l' ? 21 : 179;
    const dir = side === 'l' ? 1 : -1;
    const ang = open ? (falcon ? dir * 75 : dir * 38) : 0;
    const w = 20;
    const rx = side === 'l' ? hx - 2 : hx - w + 2;
    return `<g transform="rotate(${ang} ${hx} ${y})" style="transition: transform .45s ease"><rect x="${rx}" y="${y}" width="${w}" height="${h}" rx="6" fill="${paint}" stroke="${edge}" stroke-width="1.5"/></g>`;
  };
  const [d1, d2, d3] = b.doorsY;
  const fal = m.falconDoors;
  const glow = hl ? `
    <path d="M52 28L-10 -60 L100 -90 L210 -60 L148 28Z" fill="url(#hlg)" opacity=".55" transform="translate(0 6)"/>` : '';
  svg.innerHTML = `
  <defs>
    <linearGradient id="paint" x1="0" x2="1"><stop offset="0" stop-color="${paint}"/><stop offset=".5" stop-color="${paint}" stop-opacity=".9"/><stop offset="1" stop-color="${paint}"/></linearGradient>
    <radialGradient id="hlg" cx=".5" cy="1" r="1"><stop offset="0" stop-color="#fff6c8" stop-opacity=".9"/><stop offset="1" stop-color="#fff6c8" stop-opacity="0"/></radialGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient>
  </defs>
  ${glow}
  <!-- wheels -->
  ${[b.wheelY[0], b.wheelY[1]].map((y) => `<rect x="4" y="${y - 28}" width="18" height="56" rx="8" fill="#0b0b0c"/><rect x="178" y="${y - 28}" width="18" height="56" rx="8" fill="#0b0b0c"/>`).join('')}
  ${opts.compact ? '' : `<path d="M20 408Q100 436 180 408" fill="none" stroke="rgba(0,0,0,.18)" stroke-width="10" opacity=".4"/>`}
  <!-- frunk / trunk -->
  <g style="transform-origin:100px 100px; transform:${st.frunk ? 'translateY(-26px) scaleY(.96)' : 'none'}; transition: transform .45s">
    <path d="${b.hood}" fill="${paint}" stroke="${edge}" stroke-width="1.5"/></g>
  <path d="${b.body}" fill="url(#paint)" stroke="${edge}" stroke-width="2" ${st.frunk ? 'opacity=".95"' : ''}/>
  <path d="${b.body}" fill="url(#sheen)"/>
  <path d="${b.glass}" fill="#0c1218" opacity=".92"/>
  <path d="${b.roof}" fill="${paint}" opacity=".95"/>
  <path d="${b.roof}" fill="url(#sheen)" opacity=".7"/>
  ${b.bed ? `<rect x="26" y="262" width="148" height="132" rx="6" fill="#000" opacity=".28"/>` : ''}
  <!-- seams -->
  <path d="M22 ${d1}H178M22 ${d2}H178" stroke="${edge}" stroke-width="1.2"/>
  <!-- trunk -->
  <g style="transform-origin:100px 392px; transform:${st.trunk ? 'translateY(30px)' : 'none'}; transition: transform .45s">
    <rect x="48" y="378" width="104" height="30" rx="12" fill="${paint}" stroke="${edge}" stroke-width="1.5"/></g>
  <!-- doors -->
  ${doorShape(0, d1, d2 - d1, 'l', door.fl)}${doorShape(0, d1, d2 - d1, 'r', door.fr)}
  ${doorShape(0, d2, d3 - d2, 'l', door.rl, fal)}${doorShape(0, d2, d3 - d2, 'r', door.rr, fal)}
  <!-- lights -->
  <path d="M40 38Q58 32 78 36L74 46Q58 44 42 50Z M160 38Q142 32 122 36L126 46Q142 44 158 50Z" fill="${hl || flash ? '#fff3b0' : '#c9ccd2'}" ${hl || flash ? 'filter="drop-shadow(0 0 8px #fff3b0)"' : ''}/>
  <path d="M30 404Q48 412 76 410L74 400Q50 402 34 394Z M170 404Q152 412 124 410L126 400Q150 402 166 394Z" fill="${(hl || flash) ? '#ff2a2a' : '#7c1d1d'}" ${hl || flash ? 'filter="drop-shadow(0 0 7px #ff2a2a)"' : ''}/>
  ${st.chargePort ? `<circle cx="26" cy="372" r="6" fill="${st.charging ? '#2fb36d' : '#3e6ae1'}"><animate attributeName="opacity" values="1;.3;1" dur="1.4s" repeatCount="indefinite"/></circle>` : ''}
  ${st.sentry ? `<circle cx="100" cy="212" r="46" fill="none" stroke="#e5484d" stroke-width="3" opacity=".85"><animate attributeName="r" values="40;78;40" dur="2.6s" repeatCount="indefinite"/><animate attributeName="opacity" values=".9;0;.9" dur="2.6s" repeatCount="indefinite"/></circle>` : ''}
  ${lockedTint}
  `;
  return svg;
}
