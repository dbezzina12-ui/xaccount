// Particle effects: coin showers, sparkles, shockwave rings, floating text.
// All sizes are in device pixels; the stage passes its scale in.

const rand = (a, b) => a + Math.random() * (b - a);

export class Fx {
  constructor() {
    this.parts = [];
    this.rings = [];
    this.texts = [];
    this.shakeAmp = 0;
    this.shakeUntil = 0;
  }

  clear() {
    this.parts.length = 0;
    this.rings.length = 0;
    this.texts.length = 0;
  }

  coins(x, y, n, s, { spread = 1, up = 1, size = 1 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + rand(-0.9, 0.9) * spread;
      const v = rand(500, 1300) * s * up;
      this.parts.push({
        kind: 'coin',
        x: x + rand(-20, 20) * s,
        y,
        vx: Math.cos(a) * v * 0.6,
        vy: Math.sin(a) * v,
        g: 1500 * s,
        r: rand(16, 30) * s * size,
        spin: rand(0, Math.PI * 2),
        spinV: rand(6, 14) * (Math.random() < 0.5 ? -1 : 1),
        life: rand(1.6, 2.6),
        age: 0,
      });
    }
  }

  // Coins falling from the top edge: the "rain" during big wins.
  rain(w, n, s) {
    for (let i = 0; i < n; i++) {
      this.parts.push({
        kind: 'coin',
        x: rand(0, w),
        y: rand(-80, -20) * s,
        vx: rand(-60, 60) * s,
        vy: rand(200, 500) * s,
        g: 900 * s,
        r: rand(14, 28) * s,
        spin: rand(0, Math.PI * 2),
        spinV: rand(6, 14),
        life: 3,
        age: 0,
      });
    }
  }

  sparkles(x, y, n, s, color = '#fff6c0', radius = 60) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(40, 260) * s;
      this.parts.push({
        kind: 'spark',
        x: x + Math.cos(a) * rand(0, radius) * s,
        y: y + Math.sin(a) * rand(0, radius) * s,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 60 * s,
        g: 120 * s,
        r: rand(3, 8) * s,
        color,
        life: rand(0.5, 1.1),
        age: 0,
      });
    }
  }

  ring(x, y, r0, r1, color, dur = 0.5, width = 10) {
    this.rings.push({ x, y, r0, r1, color, dur, width, age: 0 });
  }

  float(x, y, text, { size = 40, color = '#fff', dur = 1.2, rise = 80, font = 'system-ui' } = {}) {
    this.texts.push({ x, y, text, size, color, dur, rise, font, age: 0 });
  }

  shake(amp, ms, t) {
    this.shakeAmp = Math.max(this.shakeAmp, amp);
    this.shakeUntil = Math.max(this.shakeUntil, t + ms);
  }

  shakeOffset(t) {
    if (t > this.shakeUntil) {
      this.shakeAmp = 0;
      return [0, 0];
    }
    const k = (this.shakeUntil - t) / 400;
    const a = this.shakeAmp * Math.min(1, k);
    return [rand(-a, a), rand(-a, a)];
  }

  update(dt) {
    for (const p of this.parts) {
      p.age += dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.spinV) p.spin += p.spinV * dt;
    }
    this.parts = this.parts.filter((p) => p.age < p.life);
    for (const r of this.rings) r.age += dt;
    this.rings = this.rings.filter((r) => r.age < r.dur);
    for (const t of this.texts) t.age += dt;
    this.texts = this.texts.filter((t) => t.age < t.dur);
  }

  draw(ctx, coinSprite) {
    for (const r of this.rings) {
      const k = r.age / r.dur;
      ctx.globalAlpha = (1 - k) ** 1.5;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * (1 - k * 0.7);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * (1 - (1 - k) ** 3), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const p of this.parts) {
      const fade = Math.min(1, (p.life - p.age) * 3);
      if (p.kind === 'coin') {
        const sx = Math.abs(Math.cos(p.spin));
        ctx.globalAlpha = fade;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(Math.max(0.12, sx), 1);
        ctx.drawImage(coinSprite, -p.r, -p.r, p.r * 2, p.r * 2);
        ctx.restore();
      }
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.parts) {
      if (p.kind !== 'spark') continue;
      const fade = 1 - p.age / p.life;
      ctx.globalAlpha = fade;
      ctx.fillStyle = p.color;
      const r = p.r * (0.6 + fade * 0.6);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - r * 2);
      ctx.quadraticCurveTo(p.x, p.y, p.x + r * 2, p.y);
      ctx.quadraticCurveTo(p.x, p.y, p.x, p.y + r * 2);
      ctx.quadraticCurveTo(p.x, p.y, p.x - r * 2, p.y);
      ctx.quadraticCurveTo(p.x, p.y, p.x, p.y - r * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const t of this.texts) {
      const k = t.age / t.dur;
      ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      const sc = k < 0.15 ? 0.6 + (k / 0.15) * 0.5 : 1.1 - Math.min(0.1, (k - 0.15) * 0.4);
      ctx.save();
      ctx.translate(t.x, t.y - t.rise * k);
      ctx.scale(sc, sc);
      ctx.font = `${t.size}px ${t.font}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = t.size * 0.16;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeText(t.text, 0, 0);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}
