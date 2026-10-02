// Original line icons (24x24 grid, stroke-based) so no third-party or Tesla assets are bundled.
const P = {
  car: '<path d="M5 15l1.5-5A2 2 0 0 1 8.4 8.6h7.2a2 2 0 0 1 1.9 1.4L19 15"/><rect x="3" y="15" width="18" height="4" rx="1.5"/><circle cx="7.5" cy="19" r="1.2"/><circle cx="16.5" cy="19" r="1.2"/>',
  nav: '<path d="M12 21s-6-5.6-6-10a6 6 0 0 1 12 0c0 4.4-6 10-6 10z"/><circle cx="12" cy="11" r="2.2"/>',
  music: '<path d="M9 18V6l10-2v12"/><circle cx="7" cy="18" r="2.2"/><circle cx="17" cy="16" r="2.2"/>',
  phone: '<path d="M6 3h3l1.5 4-2 1.3a11 11 0 0 0 6.2 6.2L16 12.5l4 1.5v3a2 2 0 0 1-2 2A15 15 0 0 1 4 5a2 2 0 0 1 2-2z"/>',
  cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  energy: '<path d="M13 2L5 13h6l-1 9 8-11h-6z"/>',
  toy: '<path d="M12 3l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.3 6.8 19l1-5.8L3.6 9.1l5.8-.8z"/>',
  film: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9.5v5l4.5-2.5z"/>',
  apps: '<rect x="4" y="4" width="6" height="6" rx="1.2"/><rect x="14" y="4" width="6" height="6" rx="1.2"/><rect x="4" y="14" width="6" height="6" rx="1.2"/><rect x="14" y="14" width="6" height="6" rx="1.2"/>',
  cam: '<path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  unlock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-1.8"/>',
  bolt: '<path d="M13 2L5 13h6l-1 9 8-11h-6z"/>',
  fan: '<circle cx="12" cy="12" r="1.6"/><path d="M12 10.4C12 6 14 3 17 4s1 6-5 6.4zM13.6 12c4.400 0 7.400 2 6.400 5s-6 1-6.400-5zM12 13.600C12 18 10 21 7 20s-1-6 5-6.400zM10.400 12C6 12 3 10 4 7s6-1 6.400 5z"/>',
  heat: '<path d="M8 19c-2-3 2-4 0-8M13 19c-2-3 2-4 0-8M18 19c-2-3 2-4 0-8"/>',
  snow: '<path d="M12 3v18M4.2 7.500l15.600 9M19.800 7.500l-15.600 9"/>',
  defrost: '<path d="M4 17c0-5 3-9 8-9s8 4 8 9z"/><path d="M9 5c-1-1 1-2 0-3M13 5c-1-1 1-2 0-3M17 5c-1-1 1-2 0-3"/>',
  recirc: '<path d="M5 12a7 7 0 0 1 12-4.900L19 9M19 12a7 7 0 0 1-12 4.900L5 15"/><path d="M19 4v5h-5M5 20v-5h5"/>',
  heatseat: '<path d="M8 3l1.200 9h5.600l2.200 8H9.500M9.200 12L6 20"/><path d="M17 3c-1 1.200 1 2.200 0 3.400M20 3c-1 1.200 1 2.200 0 3.400M23 3c-1 1.200 1 2.200 0 3.400"/>',
  seat: '<path d="M8 3l1 8h6l2 9H9M9 11l-3 9"/>',
  wheel: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><path d="M3.200 11h5.800M15 11h5.800M12 14v7"/>',
  bt: '<path d="M7 7l10 10-5 4V3l5 4L7 17"/>',
  wifi: '<path d="M2 9a15 15 0 0 1 20 0M5 12.500a10 10 0 0 1 14 0M8.500 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19" r="1"/>',
  sentry: '<circle cx="12" cy="12" r="4"/><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/>',
  mic: '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  vol: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M18.500 6.500a8 8 0 0 1 0 11"/>',
  play: '<path d="M7 4l13 8-13 8z" fill="currentColor"/>',
  pause: '<rect x="6" y="4" width="4" height="16" fill="currentColor"/><rect x="14" y="4" width="4" height="16" fill="currentColor"/>',
  next: '<path d="M5 5l10 7-10 7zM18 5v14"/>',
  prev: '<path d="M19 5L9 12l10 7zM6 5v14"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chev: '<path d="M9 5l7 7-7 7"/>',
  search: '<circle cx="11" cy="11" r="6.500"/><path d="M16 16l5 5"/>',
  home: '<path d="M3 11l9-7 9 7M5 10v10h14V10"/>',
  work: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2"/>',
  full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.900 4.900l2.100 2.100M17 17l2.100 2.100M19.100 4.900L17 7M7 17l-2.100 2.100"/>',
  moon: '<path d="M20 14.500A8 8 0 0 1 9.500 4 8 8 0 1 0 20 14.500z"/>',
  light: '<path d="M4 9c4-3 8-3 12 0M4 13c4-3 8-3 12 0M4 17c4-3 8-3 12 0M20 8v10"/>',
  trunk: '<path d="M3 15l2-6h10l5 3v3zM3 15h17"/>',
  frunk: '<path d="M21 15l-2-6H9l-5 3v3zM21 15H4"/>',
  port: '<circle cx="12" cy="12" r="8"/><path d="M12 7v6M9 9v2a3 3 0 0 0 6 0V9"/>',
  fire: '<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z"/>',
  game: '<rect x="3" y="8" width="18" height="10" rx="4"/><path d="M8 11v4M6 13h4M15 12h.01M17.500 14h.01"/>',
  pen: '<path d="M4 20l1-4L16 5l3 3L8 19z"/>',
  horn: '<path d="M4 10v4h3l7 4V6l-7 4z"/><path d="M17 9l3-2M17 12h3M17 15l3 2"/>',
  trash: '<path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12.500l4.500 4.500L19 7"/>',
};
export function icon(name, size = 28, extra = '') {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('width', size); s.setAttribute('height', size);
  s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '1.7'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
  s.setAttribute('class', 'ico ' + extra);
  s.innerHTML = P[name] || P.apps;
  return s;
}
