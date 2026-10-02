// Synthesised UI sounds (turn-signal ticks, chimes). Original tones, not recordings.
import { store } from '../state.js';

export class Sound {
  constructor() { this.ac = null; this.tick = null; this.flip = false; }
  _ctx() {
    if (!this.ac) { try { this.ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) { return null; } }
    if (this.ac.state === 'suspended') this.ac.resume().catch(() => {});
    return this.ac;
  }
  _vol() { return Math.pow(store.get('volume') / 100, 1.6); }
  _note(f, t0, dur, gain = 0.12, type = 'sine') {
    const ac = this._ctx(); if (!ac) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = f;
    const v = gain * this._vol();
    g.gain.setValueAtTime(0.0001, ac.currentTime + t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), ac.currentTime + t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + t0 + dur);
    o.connect(g).connect(ac.destination); o.start(ac.currentTime + t0); o.stop(ac.currentTime + t0 + dur + 0.05);
  }
  chime(kind) {
    if (kind === 'engage') { this._note(784, 0, 0.5, 0.12); this._note(1175, 0.16, 0.7, 0.1); }
    else if (kind === 'arrive') { this._note(988, 0, 0.5, 0.1); this._note(740, 0.18, 0.8, 0.09); }
  }
  tickStart() {
    this.tickStop();
    const click = () => { this.flip = !this.flip; this._note(this.flip ? 1900 : 1500, 0, 0.035, 0.1, 'square'); };
    click(); this.tick = setInterval(click, 385);
  }
  tickStop() { if (this.tick) { clearInterval(this.tick); this.tick = null; } }
}
