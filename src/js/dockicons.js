// Flat, colourful dock glyphs (no tile behind them), modelled on the real bottom bar. All artwork is original.
const W = 'stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" fill="none"';
const sq = (fill, inner) => `<rect x="2" y="2" width="36" height="36" rx="10" fill="${fill}"/>${inner}`;
const G = {
  car: '<path d="M9 19l2.400-6.200A3 3 0 0 1 14.200 11h11.600a3 3 0 0 1 2.800 1.800L31 19" fill="#cfd2d9"/><rect x="5" y="18" width="30" height="10" rx="4" fill="#cfd2d9"/><path d="M13 14h14l1.600 4H11.400z" fill="#2a2c33"/><circle cx="11" cy="23" r="2" fill="#2a2c33"/><circle cx="29" cy="23" r="2" fill="#2a2c33"/><rect x="8" y="27" width="6" height="4" rx="1.500" fill="#cfd2d9"/><rect x="26" y="27" width="6" height="4" rx="1.500" fill="#cfd2d9"/>',
  phone: `<circle cx="20" cy="20" r="18" fill="#2fc65a"/><g transform="translate(8 8) scale(1)"><path d="M6 3h3l1.500 4-2 1.300a11 11 0 0 0 6.200 6.200L16 12.500l4 1.500v3a2 2 0 0 1-2 2A15 15 0 0 1 4 5a2 2 0 0 1 2-2z" ${W}/></g>`,
  theater: sq('#e5322d', '<path d="M16 12.500v15l12-7.500z" fill="#fff"/>'),
  music: sq('url(#gm)', '<path d="M16 28V13l12-2.500v15" ' + W + '/><circle cx="13.500" cy="28" r="3" fill="#fff"/><circle cx="25.500" cy="25.500" r="3" fill="#fff"/>'),
  camera: '<circle cx="20" cy="20" r="18" fill="#6a35a8"/><circle cx="20" cy="20" r="14" fill="#1f1030"/><circle cx="20" cy="20" r="9" fill="none" stroke="#b58cf5" stroke-width="2.500"/><circle cx="20" cy="20" r="4.500" fill="#d9c2ff"/><circle cx="15.500" cy="15" r="2" fill="#fff" opacity=".7"/>',
  toybox: sq('#1b8f4c', `<path d="M9 14h6l10 12h6M9 26h6l3-3.600M22 17.600L25 14h6M28 10.500l3.500 3.500-3.500 3.500M28 22.500l3.500 3.500-3.500 3.500" ${W}/>`),
  calendar: `<rect x="2" y="2" width="36" height="36" rx="10" fill="#f4f4f6"/><path d="M2 12a10 10 0 0 1 10-10h16a10 10 0 0 1 10 10v2H2z" fill="#ff453a"/><text x="20" y="32" text-anchor="middle" font-size="17" font-weight="600" fill="#1c1c1e" font-family="Inter,Segoe UI,sans-serif">${new Date().getDate()}</text>`,
  energy: sq('#ffc928', '<path d="M22 8l-9 14h6l-1.500 10 9.500-15h-6.500z" fill="#1c1c1e"/>'),
  apps: '<rect x="2" y="2" width="36" height="36" rx="9" fill="none" stroke="#9aa0aa" stroke-width="2"/><circle cx="12" cy="13" r="4" fill="#2fc65a"/><rect x="21" y="9" width="9" height="8" rx="2" fill="#ff9f0a"/><rect x="9" y="22" width="9" height="9" rx="2" fill="#ff453a"/><rect x="21" y="22" width="9" height="9" rx="2" fill="#3e8bff"/>',
  bluetooth: sq('#2a7cf6', '<path d="M13 14l14 12-7 6V8l7 6-14 12" ' + W + '/>'),
  road: '<path d="M4 35L15 5h10l11 30z" fill="#5d616b"/><path d="M20 8v7M20 19v6M20 29v5" stroke="#3e8bff" stroke-width="2.500" stroke-linecap="round"/><path d="M4 35L15 5h10l11 30z" fill="none" stroke="#8d919b" stroke-width="1"/>',
};
export function dockGlyph(name, size = 42) {
  const t = document.createElement('span');
  t.className = 'dg';
  t.innerHTML = `<svg viewBox="0 0 40 40" width="${size}" height="${size}"><defs><linearGradient id="gm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6b81"/><stop offset="1" stop-color="#ff2d55"/></linearGradient></defs>${G[name] || G.apps}</svg>`;
  return t;
}
