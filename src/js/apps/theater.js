// Theater: streaming tiles. Video is Park-only, like the real car. Opens each service in the embedded browser.
import { h } from '../util.js';
import { icon } from '../icons.js';
import { store } from '../state.js';
import { openWebShell, closeWebShell } from '../webshell.js';

export const SERVICES = [
  ['Netflix', 'https://www.netflix.com/browse', '#e50914', 'N'],
  ['Disney+', 'https://www.disneyplus.com/', '#113ccf', 'D+'],
  ['YouTube', 'https://www.youtube.com/tv', '#ff0000', '▶'],
  ['Hulu', 'https://www.hulu.com/', '#1ce783', 'hulu'],
  ['Max', 'https://play.max.com/', '#5a2bd8', 'max'],
  ['Prime Video', 'https://www.primevideo.com/', '#00a8e1', 'prime'],
  ['Apple TV+', 'https://tv.apple.com/', '#1c1c1e', 'tv'],
  ['Paramount+', 'https://www.paramountplus.com/', '#0064ff', 'P+'],
  ['Peacock', 'https://www.peacocktv.com/', '#111111', 'pcock'],
  ['Twitch', 'https://www.twitch.tv/', '#9146ff', 'tw'],
  ['Tubi', 'https://tubitv.com/', '#fa382f', 'tubi'],
  ['Plex', 'https://app.plex.tv/', '#e5a00d', 'plex'],
  ['Crunchyroll', 'https://www.crunchyroll.com/', '#f47521', 'cr'],
  ['Vimeo', 'https://vimeo.com/watch', '#1ab7ea', 'v'],
];

export function mountTheater(root, ctx) {
  const gear = () => store.get('_gear');
  const wrap = h('div', { class: 'scroll', style: { flex: 1 } });
  root.append(wrap);
  function draw() {
    const parked = gear() === 'P';
    wrap.replaceChildren(...[
      h('div', { class: 'appgrid' }, SERVICES.map(([name, url, color, mark]) =>
        h('button', { class: 'tile' + (parked ? '' : ' disabled'), onclick: () => launch(name, url) },
          h('div', { class: 'logo', style: { background: color, fontSize: mark.length > 3 ? '17px' : '28px' } }, mark), name))),
      parked ? null : h('div', { style: { padding: '0 26px 26px' } },
        h('div', { class: 'card', style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
          h('span', null, 'Video is available only while in Park.'),
          h('button', { class: 'btn primary', onclick: () => ctx.shift('P') }, 'Shift to Park'))),
      h('div', { class: 'muted', style: { padding: '0 28px 30px', fontSize: '16px' } },
        'Services open in the built-in browser. Sign in once and the session is remembered. HD/4K playback depends on Widevine DRM in this PC build.'),
    ].filter(Boolean));
  }
  function launch(name, url) {
    if (gear() !== 'P') return ctx.toast('Shift to Park to watch video');
    const id = 'theater:' + name;
    openWebShell({ id, url });
    // Stop playback if the car leaves Park, like the real thing.
    const un = store.subscribe((p) => {
      if ('_gear' in p && p._gear !== 'P') { closeWebShell(id); un(); ctx.toast('Video stopped: not in Park'); }
    });
  }
  draw();
  const un = store.subscribe((p) => { if ('_gear' in p) draw(); });
  return un;
}
