// Media engine: local-file player + a "now playing" registry the mini-player reads.
import { store } from './state.js';

export const player = {
  audio: new Audio(),
  list: [], idx: -1,
  listeners: new Set(),
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  emit() { this.listeners.forEach((f) => f()); },
  load(files) {
    this.list = [...this.list, ...[...files].map((f) => ({ name: f.name.replace(/\.[^.]+$/, ''), url: URL.createObjectURL(f) }))];
    if (this.idx < 0 && this.list.length) this.play(0);
    this.emit();
  },
  play(i) {
    if (!this.list.length) return;
    this.idx = (i + this.list.length) % this.list.length;
    this.audio.src = this.list[this.idx].url;
    this.audio.volume = store.get('volume') / 100;
    this.audio.play().catch(() => {});
    store.set({ _nowPlaying: { title: this.list[this.idx].name, source: 'USB / Local' } });
    this.emit();
  },
  toggle() { if (!this.audio.src) return; this.audio.paused ? this.audio.play() : this.audio.pause(); this.emit(); },
  next() { this.play(this.idx + 1); }, prev() { this.play(this.idx - 1); },
  get playing() { return !!this.audio.src && !this.audio.paused; },
};
player.audio.addEventListener('ended', () => player.next());
player.audio.addEventListener('play', () => player.emit());
player.audio.addEventListener('pause', () => player.emit());
store.subscribe((p) => { if ('volume' in p) player.audio.volume = p.volume / 100; });
