import { h } from '../util.js';
import { icon } from '../icons.js';
import { store } from '../state.js';
import { openWebShell, isWebActive, stopWeb } from '../webshell.js';
import { player } from '../media.js';

export const SOURCES = [
  ['Spotify', 'https://open.spotify.com/', '#1db954'],
  ['YouTube Music', 'https://music.youtube.com/', '#ff0033'],
  ['Apple Music', 'https://music.apple.com/', '#fa2d48'],
  ['Amazon Music', 'https://music.amazon.com/', '#25d1da'],
  ['Tidal', 'https://listen.tidal.com/', '#111'],
  ['Deezer', 'https://www.deezer.com/', '#a238ff'],
  ['TuneIn Radio', 'https://tunein.com/', '#14d8cc'],
  ['SoundCloud', 'https://soundcloud.com/', '#ff5500'],
];

export function mountMusic(root, ctx) {
  const fileIn = h('input', { type: 'file', accept: 'audio/*', multiple: true, style: { display: 'none' }, onchange: (e) => player.load(e.target.files) });
  const wrap = h('div', { class: 'scroll', style: { flex: 1, padding: '0 26px 26px' } });
  root.append(fileIn, wrap);
  const draw = () => {
    wrap.replaceChildren(
      h('div', { class: 'card', style: { display: 'flex', gap: '24px', alignItems: 'center', marginBottom: '20px' } },
        h('div', { class: 'minimedia', style: { position: 'static', boxShadow: 'none', background: 'transparent', flex: 1, width: 'auto' } },
          h('div', { class: 'art' }, icon('music', 34)),
          h('div', { class: 'meta' }, h('b', null, player.list[player.idx]?.name || 'Nothing playing'), h('span', null, 'USB / Local files'))),
        h('button', { class: 'iconbtn', onclick: () => player.prev() }, icon('prev', 26)),
        h('button', { class: 'iconbtn', style: { width: '70px', height: '70px', borderRadius: '35px' }, onclick: () => player.toggle() }, icon(player.playing ? 'pause' : 'play', 30)),
        h('button', { class: 'iconbtn', onclick: () => player.next() }, icon('next', 26)),
        h('button', { class: 'btn primary', onclick: () => fileIn.click() }, icon('plus', 22), 'Add music files')),
      h('div', { class: 'card', style: { display: 'flex', gap: '18px', alignItems: 'center', marginBottom: '20px' } },
        icon('vol', 30), h('div', { style: { flex: 1 } }, '', volume()), h('b', null, store.get('volume'))),
      h('div', { class: 'h2' }, 'Streaming'),
      h('div', { class: 'appgrid', style: { padding: 0 } }, SOURCES.map(([name, url, color]) =>
        h('button', { class: 'tile', onclick: () => {
          openWebShell({ id: 'music:' + name, url, keepAlive: true });
          store.set({ _nowPlaying: { title: name, source: 'Streaming', web: 'music:' + name } });
        } }, h('div', { class: 'logo', style: { background: color } }, icon('music', 34)), name,
        isWebActive('music:' + name) ? h('span', { class: 'pill' }, 'playing in background') : null))),
    );
  };
  function volume() {
    const s = document.createElement('div'); s.style.width = '100%';
    import('../ui.js').then(({ slider }) => s.append(slider({ min: 0, max: 100, value: store.get('volume'), onChange: (v) => { store.set({ volume: v }); draw(); } })));
    return s;
  }
  draw();
  return player.on(draw);
}

export function stopNowPlaying() {
  const np = store.get('_nowPlaying');
  if (np?.web) stopWeb(np.web);
  if (player.audio.src) player.audio.pause();
  store.set({ _nowPlaying: null });
}
