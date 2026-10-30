// Cyber Skunk audio: original, synthesized live with WebAudio (no samples).
// Music is one step sequencer driving five stems (drums, bass, keys, tension,
// pulse) off a single clock, so stems stay phase-aligned when a track changes
// or one is silenced; changes land on the next bar. Effects and music meet in
// a limiter; music ducks under big wins. Nothing plays before a user gesture.
const BPM = 118, STEP = 60 / BPM / 4, BAR = 16;
const midi = (n) => 440 * 2 ** ((n - 69) / 12);
// Four-bar progression in A minor: Am, F, G, Em (roots for the bass, triads for the keys).
const ROOTS = [33, 29, 31, 28], CHORDS = [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]];
const KICK = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0], KICK_B = [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0];
const SNARE = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0.35];
const BASS = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0], BASS_OCT = [0, 0, 0, 12, 0, 0, 0, 0, 0, 0, 0, 12, 0, 0, 7, 0];
const TRACKS = {
  base: { drums: 1, bass: 0.8, keys: 0.5, tension: 0, pulse: 0 },
  bonus: { drums: 1, bass: 0.9, keys: 0.35, tension: 0.55, pulse: 0 },
  blackout: { drums: 0, bass: 0, keys: 0, tension: 0.25, pulse: 1 },
  hidden: { drums: 1, bass: 1, keys: 0.3, tension: 0.6, pulse: 0.6 },
};

export class GameAudio {
  constructor() { this.ctx = null; this.muted = false; this.levels = { music: 0.6, fx: 0.8 }; this.track = 'base'; this.mix = { ...TRACKS.base }; this.hidden = false; }

  async unlock() {
    if (!this.ctx) this.#init();
    if (this.ctx.state === 'suspended' && !this.hidden) await this.ctx.resume().catch(() => {});
  }
  setMuted(muted) { this.muted = muted; this.#levels(); }
  setLevels(music, fx) { this.levels = { music, fx }; this.#levels(); }
  suspend(hidden) { this.hidden = hidden; if (!this.ctx) return; if (hidden) this.ctx.suspend(); else this.ctx.resume(); }
  music(track) { if (TRACKS[track]) this.track = track; }
  duck(on) {
    if (!this.ctx) return;
    const g = this.duckGain.gain, t = this.ctx.currentTime;
    g.cancelScheduledValues(t); g.setTargetAtTime(on ? 0.3 : 1, t, on ? 0.06 : 0.35);
  }

  #init() {
    const ctx = (this.ctx = new (globalThis.AudioContext || globalThis.webkitAudioContext)());
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -9; limiter.knee.value = 2; limiter.ratio.value = 14; limiter.attack.value = 0.002; limiter.release.value = 0.22;
    this.master = ctx.createGain(); this.master.connect(limiter); limiter.connect(ctx.destination);
    this.fxBus = ctx.createGain(); this.fxBus.connect(this.master);
    this.musicBus = ctx.createGain(); this.duckGain = ctx.createGain(); this.musicBus.connect(this.duckGain); this.duckGain.connect(this.master);
    this.stems = {};
    for (const name of Object.keys(TRACKS.base)) { const g = ctx.createGain(); g.gain.value = 0; g.connect(this.musicBus); this.stems[name] = g; }
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    this.#levels();
    this.step = 0; this.next = ctx.currentTime + 0.1;
    setInterval(() => this.#schedule(), 25);
  }
  #levels() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.85, t, 0.03);
    this.musicBus.gain.setTargetAtTime(this.levels.music * 0.55, t, 0.05);
    this.fxBus.gain.setTargetAtTime(this.levels.fx, t, 0.05);
  }

  // ---- building blocks ----
  #osc({ type = 'sine', f, f2, at, dur, gain = 0.3, attack = 0.005, out, filter, detune = 0 }) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, at); o.detune.value = detune;
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(f2, 1), at + dur);
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(gain, at + attack); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    let node = o;
    if (filter) { const fl = this.#filter(filter, at, dur); node.connect(fl); node = fl; }
    node.connect(g); g.connect(out || this.fxBus);
    o.start(at); o.stop(at + dur + 0.02);
  }
  #noise({ at, dur, gain = 0.3, attack = 0.003, out, filter }) {
    const c = this.ctx, s = c.createBufferSource(), g = c.createGain();
    s.buffer = this.noiseBuf; s.loop = true;
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(gain, at + attack); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    let node = s;
    if (filter) { const fl = this.#filter(filter, at, dur); node.connect(fl); node = fl; }
    node.connect(g); g.connect(out || this.fxBus);
    s.start(at, Math.random()); s.stop(at + dur + 0.02);
  }
  #filter({ type = 'lowpass', f, f2, q = 1 }, at, dur) {
    const fl = this.ctx.createBiquadFilter();
    fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f, at);
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, at + dur);
    return fl;
  }
  #bell(note, at, gain = 0.18, dur = 1.1, out) {
    this.#osc({ f: midi(note), at, dur, gain, out });
    this.#osc({ f: midi(note) * 2.76, at, dur: dur * 0.45, gain: gain * 0.35, out });
    this.#osc({ type: 'triangle', f: midi(note) * 5.4, at, dur: dur * 0.2, gain: gain * 0.15, out });
  }
  #stab(notes, at, dur = 0.5, gain = 0.12, bright = 2400, out) {
    for (const n of notes) for (const det of [-9, 9]) this.#osc({ type: 'sawtooth', f: midi(n), at, dur, gain, detune: det, attack: 0.01, out, filter: { f: bright, f2: 300, q: 2 } });
  }
  #thump(at, f = 120, gain = 0.6, dur = 0.22, out) { this.#osc({ f, f2: 38, at, dur, gain, attack: 0.002, out }); }

  // ---- music ----
  #schedule() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    while (this.next < this.ctx.currentTime + 0.14) {
      const s = this.step % BAR, bar = Math.floor(this.step / BAR);
      if (s === 0) this.#applyMix(this.next);
      if (!this.muted && this.levels.music > 0) this.#playStep(s, bar, this.next);
      this.step++; this.next += STEP;
    }
  }
  #applyMix(at) {
    const want = TRACKS[this.track];
    for (const [name, g] of Object.entries(this.stems)) { g.gain.cancelScheduledValues(at); g.gain.setTargetAtTime(want[name], at, 0.05); }
    this.mix = { ...want };
  }
  #playStep(s, bar, at) {
    const m = this.mix, chord = bar % 4, out = this.stems;
    if (m.drums) {
      if ((bar % 2 ? KICK_B : KICK)[s]) this.#thump(at, 130, 0.9, 0.3, out.drums);
      if (SNARE[s]) { this.#noise({ at, dur: 0.16, gain: 0.45 * SNARE[s], out: out.drums, filter: { type: 'bandpass', f: 1900, q: 0.8 } }); this.#osc({ type: 'triangle', f: 210, f2: 150, at, dur: 0.09, gain: 0.25 * SNARE[s], out: out.drums }); }
      if (s % 2 === 0) this.#noise({ at, dur: s === 14 ? 0.22 : 0.035, gain: s % 4 === 2 ? 0.16 : 0.08, out: out.drums, filter: { type: 'highpass', f: 7500 } });
      if (s === 7 || s === 15) this.#noise({ at, dur: 0.05, gain: 0.12, out: out.drums, filter: { type: 'bandpass', f: 3200, q: 6 } }); // metal tick
    }
    if (m.bass && BASS[s]) this.#osc({ type: 'sawtooth', f: midi(ROOTS[chord] + BASS_OCT[s]), at, dur: STEP * 1.7, gain: 0.32, attack: 0.004, out: out.bass, filter: { f: 900, f2: 180, q: 6 } });
    if (m.keys && (s === 6 || s === 14)) this.#stab(CHORDS[chord], at, STEP * 2.2, 0.05, 1800, out.keys);
    if (m.tension) {
      if (s === 0) for (const n of CHORDS[chord]) this.#osc({ type: 'sawtooth', f: midi(n + 12), at, dur: STEP * BAR, gain: 0.025, attack: STEP * 6, detune: 7, out: out.tension, filter: { f: 700, f2: 2600, q: 3 } });
      if (s % 2 === 1) this.#noise({ at, dur: 0.03, gain: 0.07, out: out.tension, filter: { type: 'bandpass', f: 5200, q: 9 } });
    }
    if (m.pulse && (s === 0 || s === 8)) {
      this.#osc({ f: 55, f2: 45, at, dur: STEP * 6, gain: 0.5, attack: 0.02, out: out.pulse });
      this.#osc({ type: 'sawtooth', f: 110, f2: 90, at, dur: STEP * 5, gain: 0.18, attack: 0.02, out: out.pulse, filter: { f: 1400, f2: 300, q: 4 } }); // what a phone speaker hears of it
      this.#noise({ at, dur: STEP * 4, gain: 0.05, attack: 0.08, out: out.pulse, filter: { type: 'bandpass', f: 500, f2: 260, q: 2 } });
    }
  }

  // ---- effects ----
  play(name, o = {}) {
    if (!this.ctx || this.muted || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime + 0.005;
    switch (name) {
      case 'click': this.#osc({ type: 'square', f: 1400, f2: 900, at: t, dur: 0.04, gain: 0.2, filter: { f: 3000 } }); break;
      case 'tick': this.#osc({ f: 1100, at: t, dur: 0.03, gain: 0.36 }); break;
      case 'buy': this.#thump(t, 160, 0.5); this.#bell(81, t + 0.05, 0.12, 0.8); this.#bell(88, t + 0.12, 0.1, 0.9); break;
      case 'spin': this.#noise({ at: t, dur: 0.5, gain: 0.12, attack: 0.05, filter: { type: 'bandpass', f: 300, f2: 1100, q: 2 } }); this.#noise({ at: t, dur: 0.45, gain: 0.22, attack: 0.08, filter: { type: 'bandpass', f: 700, f2: 2600, q: 1.2 } }); this.#thump(t, 90, 0.4, 0.15); break;
      case 'stop': { // the thump is felt; the clunk and the click are what a phone speaker plays
        const i = o.index || 0;
        this.#thump(t, 100 - i * 4, 0.6, 0.12);
        this.#osc({ type: 'triangle', f: 560 - i * 14, f2: 240, at: t, dur: 0.09, gain: 0.45, attack: 0.002 });
        this.#noise({ at: t, dur: 0.05, gain: 0.4, filter: { type: 'bandpass', f: 2600, q: 3 } });
        break;
      }
      case 'scatter': { const k = Math.min(4, o.index || 0); this.#thump(t, 110, 0.45, 0.14); this.#bell([69, 73, 76, 81, 85][k], t, 0.2, 1.2); this.#bell([76, 81, 85, 88, 93][k], t + 0.06, 0.12, 1); break; }
      case 'vent-land': this.#noise({ at: t, dur: 0.08, gain: 0.3, filter: { type: 'highpass', f: 2800 } }); this.#osc({ type: 'square', f: 220, f2: 180, at: t, dur: 0.07, gain: 0.12, filter: { f: 1400 } }); break;
      case 'tease':
        this.#noise({ at: t, dur: 1.6, gain: 0.12, attack: 1.2, filter: { type: 'bandpass', f: 400, f2: 2800, q: 3 } });
        for (let k = 0; k < 6; k++) { this.#osc({ f: 55, at: t + k * 0.25, dur: 0.2, gain: 0.25 }); this.#noise({ at: t + k * 0.25, dur: 0.03, gain: 0.08 + k * 0.02, filter: { type: 'bandpass', f: 1800, q: 2 } }); }
        break;
      case 'tease-hit': this.#stab([57, 64, 69, 73], t, 0.9, 0.06, 3200); this.#thump(t, 140, 0.8, 0.4); break;
      case 'tease-miss': this.#osc({ type: 'sawtooth', f: 330, f2: 110, at: t, dur: 0.5, gain: 0.12, filter: { f: 1200, f2: 300 } }); break;
      case 'charge': this.#osc({ f: 180, f2: 720, at: t, dur: 0.55, gain: 0.12, attack: 0.3 }); this.#noise({ at: t, dur: 0.55, gain: 0.1, attack: 0.45, filter: { type: 'highpass', f: 2000, f2: 5000 } }); break;
      case 'spray': this.#noise({ at: t, dur: 0.9, gain: 0.32, attack: 0.01, filter: { type: 'bandpass', f: 2600, f2: 1300, q: 0.7 } }); this.#thump(t, 160, 0.6, 0.2); break;
      case 'paint': { // a splat per wild cell, climbing the A minor pentatonic as the spray travels
        const k = o.k || 0;
        this.#noise({ at: t, dur: 0.07, gain: 0.55, filter: { type: 'bandpass', f: 1400 + k * 90, q: 1.4 } });
        this.#osc({ f: midi([69, 72, 74, 76, 79, 81, 84, 86, 88, 91][Math.min(k, 9)]), at: t, dur: 0.14, gain: 0.14 });
        break;
      }
      case 'vent': { const p = o.pressure || 2; this.#noise({ at: t, dur: 0.35, gain: 0.25, filter: { type: 'bandpass', f: 3800, f2: 1600, q: 1.2 } }); this.#bell(64 + Math.min(p, 14) * 2, t, 0.18, 0.7); this.#thump(t, 120, 0.4, 0.12); break; }
      case 'gauge': for (let k = 0; k < 5; k++) this.#osc({ type: 'square', f: 600 + k * 120, at: t + k * 0.05, dur: 0.025, gain: 0.09, filter: { f: 2500 } }); this.#bell(76, t + 0.25, 0.18, 0.6); break;
      case 'release': this.#noise({ at: t, dur: 1.2, gain: 0.3, filter: { type: 'bandpass', f: 4200, f2: 900, q: 0.8 } }); this.#thump(t, 70, 0.9, 0.7); break;
      case 'blackout': this.#osc({ type: 'sawtooth', f: 420, f2: 30, at: t, dur: 1.3, gain: 0.2, filter: { f: 2000, f2: 120 } }); this.#noise({ at: t, dur: 0.05, gain: 0.4, filter: { type: 'highpass', f: 1500 } }); break;
      case 'retrigger': this.#thump(t, 140, 0.5, 0.2); this.#stab([69, 73, 76], t, 0.3, 0.11, 3600); this.#stab([73, 76, 81], t + 0.18, 0.5, 0.11, 4000); break;
      case 'bonus-in': {
        const dark = o.tier === 'hidden', root = dark ? 45 : o.tier === 'super' ? 50 : 57;
        this.#thump(t, 90, 1, 0.8);
        this.#stab([root, root + 7, root + 12], t, 0.4, 0.07, 2000);
        this.#stab([root + 3, root + 10, root + 15], t + 0.3, 0.4, 0.07, 2600);
        this.#stab([root + 7, root + 12, root + 16, root + 19], t + 0.6, 1.4, 0.07, 3400);
        break;
      }
      case 'win': { const n = Math.min(3 + Math.floor((o.size || 0) / 300), 6); for (let k = 0; k < n; k++) this.#bell([69, 73, 76, 81, 85, 88][k], t + k * 0.07, 0.12, 0.6); break; }
      case 'win-big': for (let k = 0; k < 6; k++) this.#bell([69, 73, 76, 81, 85, 88][k], t + k * 0.06, 0.14, 0.9); this.#stab([57, 61, 64, 69], t + 0.36, 1, 0.05, 3000); break;
      case 'bigwin': case 'max': {
        const big = name === 'max';
        this.#thump(t, 80, 1, 1); this.#noise({ at: t, dur: 1.4, gain: 0.25, filter: { type: 'highpass', f: 3000, f2: 8000 } });
        this.#stab([57, 64, 69, 73, 76], t, big ? 2.4 : 1.6, 0.06, 4000);
        for (let k = 0; k < (big ? 12 : 8); k++) this.#bell([81, 85, 88, 93][k % 4] + (k >= 8 ? 12 : 0), t + 0.2 + k * 0.08, 0.1, 0.8);
        break;
      }
    }
  }
}
