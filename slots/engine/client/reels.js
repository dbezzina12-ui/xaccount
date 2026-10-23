// One spinning reel. Position is measured in symbols along a "tape":
// tape index j shows strip[j mod len], and row r of the window shows tape
// index floor(pos) + r. Spinning moves symbols DOWN, so pos decreases.
//
// Stopping: the math already decided the stop index T. To land on it after
// a short, natural deceleration we splice the real strip segment ending at
// T into the tape just above the window (off screen, so the splice is
// invisible), ease into it with a small overshoot, then settle back.

import { ease, clamp } from './tween.js';

const mod = (a, n) => ((a % n) + n) % n;

export class Reel {
  constructor(index, strip, rows) {
    this.i = index;
    this.rows = rows;
    this.setStrip(strip, Math.floor(Math.random() * strip.length));
    this.state = 'idle';
    this.vel = 0;
    this.speed = 22;
    this.antic = false;
    this.landedAt = -1e9;
  }

  setStrip(strip, stop) {
    this.strip = strip;
    this.len = strip.length;
    this.over = new Map();
    this.pos = stop;
  }

  tape(j) {
    const o = this.over.get(j);
    return o !== undefined ? o : this.strip[mod(j, this.len)];
  }

  // Symbol currently in row r (valid when the reel is at rest).
  symbol(r) {
    return this.tape(Math.floor(this.pos) + r);
  }

  start(t, { speed = 22, delay = 0 } = {}) {
    this.speed = speed;
    this.state = 'windup';
    this.t0 = t + delay;
    this.p0 = this.pos;
    this.pending = null;
    this.antic = false;
    return new Promise((r) => (this._started = r));
  }

  // Resolves when the reel has landed and settled on `stop`.
  stop(stop, { travel = 3, quick = false } = {}) {
    return new Promise((resolve) => {
      this.pending = { stop, travel, quick, resolve };
      if (this.state === 'spin') this._beginStop(this._now ?? performance.now());
    });
  }

  _beginStop(t) {
    const { stop, travel, quick } = this.pending;
    const j0 = Math.floor(this.pos);
    const n = Math.max(3, travel);
    const J = j0 - n; // tape index that will be the top row when stopped
    this.over.clear();
    for (let r = -2; J + r <= j0 - 1; r++) this.over.set(J + r, this.strip[mod(stop + r, this.len)]);
    this.target = J;
    this.stopTo = stop;
    const overshoot = quick ? 0.12 : 0.2;
    this.ps = this.pos;
    this.pe = J - overshoot;
    // Quadratic brake: starts at the current speed (duration = 2·d/v) and
    // stops crisply at the overshoot point, so the bounce reads as a snap.
    const v = Math.max(this.vel, 8);
    this.decelDur = clamp((2 * (this.ps - this.pe)) / v, 0.1, 1.2) * 1000;
    this.settleDur = quick ? 120 : 190;
    this.tStop = t;
    this.state = 'decel';
  }

  update(t, dt) {
    this._now = t;
    switch (this.state) {
      case 'windup': {
        if (t < this.t0) break;
        const k = clamp((t - this.t0) / 120);
        this.pos = this.p0 + 0.3 * ease.outQuad(k);
        if (k >= 1) {
          this.state = 'accel';
          this.tAccel = t;
          this._started?.();
        }
        break;
      }
      case 'accel': {
        const k = clamp((t - this.tAccel) / 170);
        this.vel = this.speed * ease.inQuad(k);
        this.pos -= this.vel * dt;
        if (k >= 1) {
          this.state = 'spin';
          if (this.pending) this._beginStop(t);
        }
        break;
      }
      case 'spin': {
        const v = this.speed * (this.antic ? 1.45 : 1);
        this.vel += (v - this.vel) * Math.min(1, dt * 6);
        this.pos -= this.vel * dt;
        break;
      }
      case 'decel': {
        const k = clamp((t - this.tStop) / this.decelDur);
        const prev = this.pos;
        this.pos = this.ps - (this.ps - this.pe) * ease.outQuad(k);
        this.vel = dt > 0 ? (prev - this.pos) / dt : 0;
        if (k >= 1) {
          this.state = 'settle';
          this.tSettle = t;
          this.vel = 0;
        }
        break;
      }
      case 'settle': {
        const k = clamp((t - this.tSettle) / this.settleDur);
        this.pos = this.pe + (this.target - this.pe) * ease.outBack(k, 2.2);
        if (k >= 1) {
          // Back to plain strip coordinates; the window shows the same symbols.
          this.over.clear();
          this.pos = this.stopTo;
          this.state = 'idle';
          this.antic = false;
          this.landedAt = t;
          const p = this.pending;
          this.pending = null;
          p?.resolve();
        }
        break;
      }
    }
  }

  get spinning() {
    return this.state !== 'idle';
  }
}
