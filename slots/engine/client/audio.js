// Synthesized sound effects (Web Audio): no audio files needed. A theme can
// replace these later with recorded sounds without touching game flow.

const STORE_KEY = 'slots.sound';

export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    try {
      this.enabled = localStorage.getItem(STORE_KEY) !== 'off';
    } catch {}
    this._antic = null;
  }

  // Browsers only allow audio after a user gesture; call from a tap/click.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 0.55 : 0;
    const comp = this.ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(this.ctx.destination);
  }

  setEnabled(on) {
    this.enabled = on;
    try {
      localStorage.setItem(STORE_KEY, on ? 'on' : 'off');
    } catch {}
    if (this.master) this.master.gain.value = on ? 0.55 : 0;
  }

  _ok() {
    return this.ctx && this.enabled;
  }

  tone({ f = 440, to = null, type = 'sine', dur = 0.2, vol = 0.3, attack = 0.005, at = 0 }) {
    if (!this._ok()) return;
    const c = this.ctx;
    const t = c.currentTime + at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noise({ dur = 0.2, vol = 0.2, freq = 1200, to = null, q = 1, type = 'bandpass', at = 0 }) {
    if (!this._ok()) return;
    const c = this.ctx;
    const t = c.currentTime + at;
    const len = Math.ceil(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  }

  button() {
    this.tone({ f: 880, to: 1320, type: 'triangle', dur: 0.06, vol: 0.12 });
  }
  spinStart() {
    this.noise({ dur: 0.35, vol: 0.18, freq: 400, to: 2400, q: 0.8 });
  }
  reelStop(i = 0) {
    this.tone({ f: 150 - i * 6, to: 55, type: 'sine', dur: 0.14, vol: 0.45 });
    this.noise({ dur: 0.05, vol: 0.12, freq: 3000, type: 'highpass' });
  }
  scatterLand(n = 1) {
    const base = [523.25, 659.25, 783.99, 1046.5, 1318.5][Math.min(n - 1, 4)];
    this.tone({ f: base, type: 'triangle', dur: 0.5, vol: 0.28 });
    this.tone({ f: base * 1.5, type: 'sine', dur: 0.6, vol: 0.14, at: 0.04 });
    this.tone({ f: base * 2, type: 'sine', dur: 0.7, vol: 0.08, at: 0.08 });
  }
  wildLand() {
    this.tone({ f: 330, to: 660, type: 'sawtooth', dur: 0.18, vol: 0.08 });
    this.tone({ f: 990, type: 'triangle', dur: 0.25, vol: 0.12, at: 0.05 });
  }
  anticipation(on) {
    if (!this._ok()) return;
    if (!on) {
      if (this._antic) {
        const { o, g, l } = this._antic;
        const t = this.ctx.currentTime;
        g.gain.setTargetAtTime(0.0001, t, 0.05);
        o.stop(t + 0.3);
        l.stop(t + 0.3);
        this._antic = null;
      }
      return;
    }
    if (this._antic) return;
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    const l = c.createOscillator();
    const lg = c.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(110, c.currentTime);
    o.frequency.linearRampToValueAtTime(330, c.currentTime + 3);
    l.frequency.value = 14;
    lg.gain.value = 0.05;
    l.connect(lg).connect(g.gain);
    g.gain.value = 0.06;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1400;
    o.connect(f).connect(g).connect(this.master);
    o.start();
    l.start();
    this._antic = { o, g, l };
  }
  win(level = 0) {
    const notes = [659.25, 783.99, 987.77, 1318.5];
    notes.slice(0, 2 + Math.min(level, 2)).forEach((f, i) => this.tone({ f, type: 'triangle', dur: 0.25, vol: 0.2, at: i * 0.07 }));
  }
  tick() {
    this.tone({ f: 1800 + Math.random() * 400, type: 'square', dur: 0.025, vol: 0.04 });
  }
  coin() {
    this.tone({ f: 2200 + Math.random() * 1600, type: 'sine', dur: 0.12, vol: 0.05 });
  }
  bigWin(tier = 0) {
    const root = 392 * 2 ** (tier / 12 * 3);
    [0, 4, 7, 12, 16].forEach((st, i) => this.tone({ f: root * 2 ** (st / 12), type: 'sawtooth', dur: 0.5, vol: 0.09, at: i * 0.09 }));
    [0, 7, 12].forEach((st) => this.tone({ f: root * 2 ** (st / 12) / 2, type: 'triangle', dur: 1.2, vol: 0.16, at: 0.45 }));
  }
  featureIntro() {
    this.noise({ dur: 1.2, vol: 0.12, freq: 200, to: 6000, q: 2 });
    [0, 3, 7, 10, 12, 15, 19, 24].forEach((st, i) => this.tone({ f: 261.6 * 2 ** (st / 12), type: 'triangle', dur: 0.3, vol: 0.14, at: i * 0.06 }));
  }
  retrigger() {
    [0, 7, 12, 19].forEach((st, i) => this.tone({ f: 523.25 * 2 ** (st / 12), type: 'square', dur: 0.2, vol: 0.07, at: i * 0.08 }));
  }
}
