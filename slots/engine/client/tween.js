// Easing curves and timing helpers for the client.

export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const now = () => performance.now();

export const ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - (1 - t) ** 3,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  outQuart: (t) => 1 - (1 - t) ** 4,
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t, s = 1.70158) => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2,
  outElastic: (t) => (t === 0 || t === 1 ? t : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
  // Rises past 1 then settles: for "punch" scale effects.
  punch: (t) => (t >= 1 ? 1 : 1 + Math.sin(t * Math.PI) * (1 - t) * 0.6),
};

// Lets a long presentation be cut short: every sleep() races the skip
// signal, so one tap fast-forwards whatever is currently waiting.
export class Skipper {
  constructor() {
    this.arm();
  }
  arm() {
    this.promise = new Promise((r) => (this._resolve = r));
  }
  fire() {
    const r = this._resolve;
    this.arm();
    r();
  }
  sleep(ms) {
    if (ms <= 0) return Promise.resolve();
    let t;
    return Promise.race([new Promise((r) => (t = setTimeout(r, ms))), this.promise]).finally(() => clearTimeout(t));
  }
}

// A value that animates toward targets over time; read .value each frame.
export class Animated {
  constructor(v = 0) {
    this.value = v;
    this.from = v;
    this.to = v;
    this.t0 = 0;
    this.dur = 0;
    this.fn = ease.linear;
  }
  set(v) {
    this.value = this.from = this.to = v;
    this.dur = 0;
  }
  go(to, dur, fn = ease.outCubic) {
    this.from = this.value;
    this.to = to;
    this.t0 = now();
    this.dur = dur;
    this.fn = fn;
    return new Promise((r) => (this._done = r));
  }
  finish() {
    this.dur = 0;
    this.value = this.to;
    this._done?.();
  }
  get busy() {
    return this.dur > 0;
  }
  update(t) {
    if (this.dur <= 0) return this.value;
    const k = clamp((t - this.t0) / this.dur);
    this.value = lerp(this.from, this.to, this.fn(k));
    if (k >= 1) this.finish();
    return this.value;
  }
}
