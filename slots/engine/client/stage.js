// Canvas renderer. Draws whatever state the controller puts it in; it
// makes no game decisions. Coordinates are CSS pixels (the context is
// scaled by devicePixelRatio; sprites are rendered at device resolution).

import { Reel } from './reels.js';
import { SpriteCache, fit } from './assets.js';
import { Fx } from './fx.js';
import { Animated, ease, clamp, now } from './tween.js';

const TAU = Math.PI * 2;

export class Stage {
  constructor(root, { model, theme, art }) {
    this.model = model;
    this.theme = theme;
    this.art = art;
    this.pal = {
      bg: '#0d0820',
      bg2: '#2a1460',
      panel: 'rgba(8,6,24,0.78)',
      frame: '#ffd36b',
      accent: '#ffd84a',
      accent2: '#ff4fa3',
      text: '#ffffff',
      muted: '#c9c1ec',
      ...theme.palette,
    };
    this.font = theme.fonts?.display ?? 'system-ui, sans-serif';
    this.uiFont = theme.fonts?.ui ?? 'system-ui, sans-serif';

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'stage';
    root.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    const strips = model.json.reels.base.map((s) => s.trim().split(/\s+/));
    this.reels = strips.map((s, i) => new Reel(i, s, model.rows));
    this.sprites = new SpriteCache(model, theme, art);
    this.fx = new Fx();

    this.mode = 'base';
    this.bgMix = new Animated(0);
    this.dim = new Animated(0);
    this.cellPop = []; // [reel][row] = { t, kind }
    this.badges = []; // [reel][row] = multiplier shown on a free-spin wild
    for (let i = 0; i < model.reels; i++) {
      this.cellPop.push(new Array(model.rows).fill(null));
      this.badges.push(new Array(model.rows).fill(0));
    }
    this.winCells = new Set();
    this.lines = []; // line wins currently drawn
    this.lineLabel = null;
    this.centerWin = null; // { text, t0 }
    this.plaque = null; // { left, right }
    this.ov = null; // full-screen overlay
    this.hudHeight = 0;
    this.shimmer = { t: 0, reel: 0, row: 0 };
    this.temp = document.createElement('canvas');

    this.lineColors = model.lines.map((_, i) => `hsl(${(i * 137.508) % 360},95%,62%)`);
    this.bokeh = Array.from({ length: 28 }, () => ({ x: Math.random(), y: Math.random(), r: 0.5 + Math.random() * 2.5, s: 0.2 + Math.random() * 0.8, p: Math.random() * TAU }));

    this.canvas.addEventListener('pointerdown', () => this.onTap?.());
    this._resize = () => this.layout();
    window.addEventListener('resize', this._resize);
    this.layout();
    this._last = now();
    const loop = (t) => {
      this.frame(t);
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  // ---------------- layout ----------------

  layout() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const W = window.innerWidth;
    const H = window.innerHeight;
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);
    this.canvas.style.width = W + 'px';
    this.canvas.style.height = H + 'px';
    this.dpr = dpr;
    this.W = W;
    this.H = H;
    const R = this.model.reels;
    const Rows = this.model.rows;
    const avail = H - this.hudHeight;
    this.portrait = W / H < 0.85;
    // panel width = cell * (R + gaps + padding) with gap 3.5% and padding 10% of a cell
    const span = R + 0.035 * (R - 1) + 0.2;
    let cell;
    if (this.portrait) cell = Math.min((W - 12) / span, (avail * 0.5) / Rows);
    else cell = Math.min((W * 0.8) / span, (avail * 0.68) / Rows);
    cell = Math.floor(cell);
    const gap = Math.round(cell * 0.035);
    const pad = Math.round(cell * 0.1);
    const innerW = R * cell + (R - 1) * gap;
    const innerH = Rows * cell;
    const plaqueH = Math.round(Math.max(26, cell * 0.28));
    const x0 = Math.round((W - innerW) / 2);
    const logoMin = this.portrait ? avail * 0.2 : avail * 0.16;
    const freeSpace = avail - innerH - pad * 2 - plaqueH;
    const top = Math.max(logoMin, freeSpace * 0.5);
    const y0 = Math.round(Math.min(top + plaqueH + pad, avail - innerH - pad - 6));
    this.L = { cell, gap, pad, x0, y0, innerW, innerH, plaqueH, logo: { x: 0, y: 8, w: W, h: Math.max(0, y0 - pad - plaqueH - 14) } };
    this.sprites.build(cell * dpr);
    this.bgCache = null;
  }

  cellRect(reel, row) {
    const { cell, gap, x0, y0 } = this.L;
    return { x: x0 + reel * (cell + gap), y: y0 + row * cell, w: cell, h: cell };
  }

  cellCenter(reel, row) {
    const r = this.cellRect(reel, row);
    return [r.x + r.w / 2, r.y + r.h / 2];
  }

  // ---------------- state the controller drives ----------------

  setMode(mode, strips) {
    this.mode = mode;
    this.bgMix.go(mode === 'free' ? 1 : 0, 700, ease.inOutSine);
    if (strips) strips.forEach((s, i) => this.reels[i].setStrip(s, Math.floor(Math.random() * s.length)));
    this.clearBadges();
  }

  clearBadges() {
    for (const col of this.badges) col.fill(0);
  }

  landed(reel, { multipliers }) {
    const t = now();
    const r = this.reels[reel];
    for (let row = 0; row < this.model.rows; row++) {
      const sym = r.symbol(row);
      const kind = this.model.kind[this.model.index[sym]];
      if (kind === 'scatter' || kind === 'wild') {
        this.cellPop[reel][row] = { t, kind };
        const [cx, cy] = this.cellCenter(reel, row);
        const col = kind === 'scatter' ? this.pal.accent2 : this.pal.accent;
        this.fx.ring(cx, cy, this.L.cell * 0.2, this.L.cell * 0.75, col, 0.55, 8);
        this.fx.sparkles(cx, cy, kind === 'scatter' ? 18 : 10, 1, col, this.L.cell * 0.3);
      }
      const m = multipliers?.[reel]?.[row] ?? 1;
      if (m > 1) this.badges[reel][row] = m;
    }
  }

  setWins(lineWins, scatterCells) {
    this.winCells.clear();
    for (const lw of lineWins) for (const [r, c] of lw.cells) this.winCells.add(r * 10 + c);
    for (const [r, c] of scatterCells ?? []) this.winCells.add(r * 10 + c);
    this.lines = lineWins;
    this.lineLabel = null;
    this.winT0 = now();
    this.dim.go(this.winCells.size ? 1 : 0, 220);
  }

  focusLine(lw, label) {
    this.centerWin = null;
    this.winCells.clear();
    for (const [r, c] of lw.cells) this.winCells.add(r * 10 + c);
    this.lines = [lw];
    this.lineLabel = label;
    this.winT0 = now();
  }

  focusCells(cells, label) {
    this.centerWin = null;
    this.winCells.clear();
    for (const [r, c] of cells) this.winCells.add(r * 10 + c);
    this.lines = [];
    this.lineLabel = label;
    this.winT0 = now();
  }

  clearWins() {
    this.winCells.clear();
    this.lines = [];
    this.lineLabel = null;
    this.centerWin = null;
    this.dim.go(0, 150);
  }

  showCenterWin(text) {
    this.centerWin = { text, t0: now() };
  }

  // Full-screen overlay. Resolves when the controller calls closeOverlay().
  overlay(type, data = {}) {
    this.ov = { type, data, t0: now(), alpha: new Animated(0), lastTier: -1 };
    this.ov.alpha.go(1, 260);
  }

  async closeOverlay() {
    if (!this.ov) return;
    const ov = this.ov;
    await ov.alpha.go(0, 260);
    if (this.ov === ov) this.ov = null;
  }

  // ---------------- frame ----------------

  frame(t) {
    const dt = Math.min(0.05, (t - this._last) / 1000);
    this._last = t;
    for (const r of this.reels) r.update(t, dt);
    this.bgMix.update(t);
    this.dim.update(t);
    this.fx.update(dt);
    this.onFrame?.(t, dt);

    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawBackground(ctx, t);
    const [sx, sy] = this.fx.shakeOffset(t);
    ctx.save();
    ctx.translate(sx, sy);
    this.drawLogo(ctx, t);
    this.drawPanel(ctx, t);
    this.drawReels(ctx, t);
    this.drawBadges(ctx, t);
    this.drawLines(ctx, t);
    this.drawPlaque(ctx);
    this.drawCenterWin(ctx, t);
    ctx.restore();
    this.fx.draw(ctx, this.sprites.coin);
    if (this.ov) this.drawOverlay(ctx, t, dt);
  }

  // ---------------- drawing ----------------

  bgImage(free) {
    const a = this.art;
    if (free) return (this.portrait && a.bgFreePortrait) || a.bgFree || (this.portrait && a.bgBasePortrait) || a.bgBase;
    return (this.portrait && a.bgBasePortrait) || a.bgBase;
  }

  drawCover(ctx, img, alpha = 1) {
    const k = Math.max(this.W / img.width, this.H / img.height);
    const w = img.width * k;
    const h = img.height * k;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, (this.W - w) / 2, (this.H - h) / 2, w, h);
    ctx.globalAlpha = 1;
  }

  drawBackground(ctx, t) {
    const mix = this.bgMix.value;
    const base = this.bgImage(false);
    const free = this.art.bgFree ? this.bgImage(true) : null;
    if (base) {
      this.drawCover(ctx, base);
      if (free && mix > 0) this.drawCover(ctx, free, mix);
      else if (mix > 0) {
        ctx.fillStyle = this.pal.accent2;
        ctx.globalAlpha = 0.18 * mix;
        ctx.fillRect(0, 0, this.W, this.H);
        ctx.globalAlpha = 1;
      }
    } else {
      const g = ctx.createRadialGradient(this.W / 2, this.H * 0.35, 10, this.W / 2, this.H * 0.4, Math.max(this.W, this.H) * 0.8);
      g.addColorStop(0, mix > 0.5 ? this.pal.accent2 : this.pal.bg2);
      g.addColorStop(0.55, this.pal.bg2);
      g.addColorStop(1, this.pal.bg);
      ctx.fillStyle = this.pal.bg;
      ctx.fillRect(0, 0, this.W, this.H);
      ctx.globalAlpha = 0.85 + 0.15 * Math.abs(mix - 0.5) * 2;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.W, this.H);
      ctx.globalAlpha = 1;
      // slow light rays
      ctx.save();
      ctx.translate(this.W / 2, -this.H * 0.1);
      ctx.rotate(t * 0.00004);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 9; i++) {
        ctx.rotate(TAU / 9);
        ctx.fillStyle = `rgba(255,255,255,${0.025 + mix * 0.02})`;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-this.H * 0.18, this.H * 1.6);
        ctx.lineTo(this.H * 0.18, this.H * 1.6);
        ctx.fill();
      }
      ctx.restore();
    }
    // floating bokeh, both with and without art
    ctx.globalCompositeOperation = 'lighter';
    for (const b of this.bokeh) {
      const y = (b.y - t * 0.00002 * b.s) % 1;
      const yy = (y < 0 ? y + 1 : y) * this.H;
      const xx = b.x * this.W + Math.sin(t * 0.0005 * b.s + b.p) * 20;
      ctx.globalAlpha = 0.25 + 0.2 * Math.sin(t * 0.002 * b.s + b.p);
      ctx.fillStyle = mix > 0.5 ? this.pal.accent2 : this.pal.accent;
      ctx.beginPath();
      ctx.arc(xx, yy, b.r * 1.6, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  drawTitle(ctx, text, x, y, size, { colors, stroke = 'rgba(25,8,0,0.95)', glow = null, maxW = Infinity, font = this.font } = {}) {
    ctx.save();
    ctx.font = `${size}px ${font}`;
    const w = ctx.measureText(text).width;
    if (w > maxW) {
      const k = maxW / w;
      ctx.translate(x, y);
      ctx.scale(k, k);
      ctx.translate(-x, -y);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    if (glow) {
      ctx.shadowColor = glow;
      ctx.shadowBlur = size * 0.35;
    }
    ctx.lineWidth = size * 0.2;
    ctx.strokeStyle = stroke;
    ctx.strokeText(text, x, y + size * 0.04);
    ctx.shadowBlur = 0;
    const g = ctx.createLinearGradient(0, y - size * 0.5, 0, y + size * 0.5);
    const c = colors ?? ['#fffbe0', this.pal.accent, '#e07b00'];
    g.addColorStop(0, c[0]);
    g.addColorStop(0.5, c[1]);
    g.addColorStop(1, c[2]);
    ctx.fillStyle = g;
    ctx.fillText(text, x, y);
    ctx.lineWidth = Math.max(1, size * 0.025);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.strokeText(text, x, y);
    ctx.restore();
  }

  drawLogo(ctx, t) {
    const { logo } = this.L;
    if (logo.h < 30) return;
    const breathe = 1 + Math.sin(t * 0.0015) * 0.012;
    const cx = this.W / 2;
    const cy = logo.y + logo.h / 2;
    if (this.art.logo) {
      const { w, h } = fit(this.art.logo, Math.min(this.W * 0.9, logo.h * 3.2), logo.h, breathe);
      ctx.drawImage(this.art.logo, cx - w / 2, cy - h / 2, w, h);
    } else {
      const size = Math.min(logo.h * 0.6, this.W * (this.portrait ? 0.15 : 0.1));
      this.drawTitle(ctx, this.theme.title ?? this.model.json.title, cx, cy, size * breathe, { glow: this.pal.accent2, maxW: this.W * 0.9 });
    }
  }

  drawPanel(ctx, t) {
    const { x0, y0, innerW, innerH, pad, cell, gap } = this.L;
    const x = x0 - pad;
    const y = y0 - pad;
    const w = innerW + pad * 2;
    const h = innerH + pad * 2;
    const rad = pad * 1.4;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = cell * 0.4;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, rad);
    ctx.fillStyle = this.pal.panel;
    ctx.fill();
    ctx.restore();
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, '#fff6d0');
    g.addColorStop(0.3, this.pal.frame);
    g.addColorStop(0.7, this.mode === 'free' ? this.pal.accent2 : this.pal.frame);
    g.addColorStop(1, '#7a4a00');
    ctx.lineWidth = Math.max(3, pad * 0.32);
    ctx.strokeStyle = g;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, rad);
    ctx.stroke();
    // reel separators
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let i = 1; i < this.model.reels; i++) ctx.fillRect(x0 + i * (cell + gap) - gap / 2 - 1, y0, 2, innerH);
    // anticipation glow columns
    for (const r of this.reels) {
      if (!r.antic) continue;
      const cr = this.cellRect(r.i, 0);
      const pulse = 0.55 + 0.45 * Math.sin(t * 0.02);
      ctx.save();
      ctx.shadowColor = this.pal.accent2;
      ctx.shadowBlur = cell * 0.35 * pulse;
      ctx.strokeStyle = this.pal.accent2;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(cr.x - 2, y0 - 2, cell + 4, innerH + 4, 8);
      ctx.stroke();
      ctx.restore();
      if (Math.random() < 0.5) this.fx.sparkles(cr.x + Math.random() * cell, y0 + innerH, 1, 1, this.pal.accent2, 4);
    }
  }

  drawReels(ctx, t) {
    const { x0, y0, innerW, innerH, cell } = this.L;
    const rows = this.model.rows;
    const dim = this.dim.value;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0 - 2, y0, innerW + 4, innerH);
    ctx.clip();
    const sp = this.sprites.sprites;
    const winPhase = (t - (this.winT0 ?? 0)) / 1000;
    for (const reel of this.reels) {
      const base = Math.floor(reel.pos);
      const f = reel.pos - base;
      const fast = Math.abs(reel.vel) > 7;
      const rx = this.cellRect(reel.i, 0).x;
      // landing squash for the whole column
      const sinceLand = (t - reel.landedAt) / 1000;
      const squash = sinceLand < 0.25 ? 1 - 0.05 * Math.sin((sinceLand / 0.25) * Math.PI) : 1;
      for (let k = -1; k <= rows; k++) {
        const sym = reel.tape(base + k);
        const s = sp[sym];
        if (!s) continue;
        const y = y0 + (k - f) * cell;
        if (fast) {
          const stretch = 1 + Math.min(0.12, Math.abs(reel.vel) / 300);
          const h = s.blur.height / this.dpr;
          ctx.drawImage(s.blur, rx, y + cell / 2 - (h * stretch) / 2, cell, h * stretch);
          continue;
        }
        const idle = !reel.spinning;
        const row = k;
        let scale = squash;
        let win = false;
        if (idle && row >= 0 && row < rows) {
          const pop = this.cellPop[reel.i][row];
          if (pop) {
            const pk = (t - pop.t) / 450;
            if (pk < 1) scale *= ease.punch(pk);
            else this.cellPop[reel.i][row] = null;
          }
          win = this.winCells.has(reel.i * 10 + row);
        }
        const cx = rx + cell / 2;
        const cy = y + cell / 2;
        if (win) {
          const pulse = Math.sin(winPhase * Math.PI * 2 * 1.4);
          const gp = s.glowPad / this.dpr;
          ctx.globalAlpha = 0.55 + 0.35 * pulse;
          ctx.drawImage(s.glow, rx - gp, y - gp, cell + gp * 2, cell + gp * 2);
          ctx.globalAlpha = 1;
          const sxk = scale * (1.06 + 0.05 * pulse);
          const syk = scale * (1.06 - 0.03 * pulse);
          this.drawShiny(ctx, s.base, cx, cy, cell * sxk, cell * syk, (winPhase * 0.9) % 1.6);
        } else {
          const shimmer = idle && this.shimmer.reel === reel.i && this.shimmer.row === row ? (t - this.shimmer.t) / 900 : -1;
          if (shimmer >= 0 && shimmer < 1) this.drawShiny(ctx, s.base, cx, cy, cell * scale, cell * scale, shimmer * 1.6);
          else ctx.drawImage(s.base, cx - (cell * scale) / 2, cy - (cell * scale) / 2, cell * scale, cell * scale);
          if (dim > 0 && idle && row >= 0 && row < rows) {
            ctx.fillStyle = `rgba(5,3,15,${0.62 * dim})`;
            ctx.fillRect(rx, y, cell, cell);
          }
        }
      }
    }
    // depth shading at top and bottom of the window
    const sh = cell * 0.35;
    let g = ctx.createLinearGradient(0, y0, 0, y0 + sh);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x0 - 2, y0, innerW + 4, sh);
    g = ctx.createLinearGradient(0, y0 + innerH - sh, 0, y0 + innerH);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(x0 - 2, y0 + innerH - sh, innerW + 4, sh);
    ctx.restore();

    // idle shimmer: now and then a random symbol catches the light
    if (t - this.shimmer.t > 2600 && this.reels.every((r) => !r.spinning) && !this.winCells.size) {
      this.shimmer = { t, reel: Math.floor(Math.random() * this.model.reels), row: Math.floor(Math.random() * rows) };
    }
  }

  // Draw a sprite with a diagonal light sweep clipped to its pixels.
  drawShiny(ctx, img, cx, cy, w, h, phase) {
    const T = this.temp;
    if (T.width !== img.width || T.height !== img.height) {
      T.width = img.width;
      T.height = img.height;
    }
    const tc = T.getContext('2d');
    tc.globalCompositeOperation = 'source-over';
    tc.clearRect(0, 0, T.width, T.height);
    tc.drawImage(img, 0, 0);
    if (phase >= 0 && phase <= 1.2) {
      tc.globalCompositeOperation = 'source-atop';
      const p = phase * T.width * 1.6 - T.width * 0.3;
      const g = tc.createLinearGradient(p - T.width * 0.25, 0, p + T.width * 0.25, T.height * 0.5);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      tc.fillStyle = g;
      tc.fillRect(0, 0, T.width, T.height);
    }
    ctx.drawImage(T, cx - w / 2, cy - h / 2, w, h);
  }

  drawBadges(ctx, t) {
    const { cell } = this.L;
    for (let i = 0; i < this.model.reels; i++) {
      if (this.reels[i].spinning) continue;
      for (let r = 0; r < this.model.rows; r++) {
        const m = this.badges[i][r];
        if (!m) continue;
        const cr = this.cellRect(i, r);
        const pop = this.cellPop[i][r];
        const k = pop ? clamp((t - pop.t) / 380) : 1;
        const sc = ease.outBack(k, 2.5);
        const rad = cell * 0.19 * sc;
        const x = cr.x + cell * 0.78;
        const y = cr.y + cell * 0.22;
        const col = m >= 5 ? '#ff3d5a' : m >= 3 ? '#3d8bff' : '#22c55e';
        ctx.save();
        ctx.shadowColor = col;
        ctx.shadowBlur = cell * 0.15;
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, TAU);
        const g = ctx.createRadialGradient(x - rad * 0.3, y - rad * 0.3, rad * 0.1, x, y, rad);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.25, col);
        g.addColorStop(1, '#10061f');
        ctx.fillStyle = g;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.lineWidth = Math.max(2, cell * 0.025);
        ctx.strokeStyle = '#fff';
        ctx.stroke();
        ctx.restore();
        if (sc > 0.2) this.drawTitle(ctx, `x${m}`, x, y + rad * 0.04, rad * 0.95, { colors: ['#ffffff', '#ffffff', '#ffe9a8'], stroke: 'rgba(0,0,0,0.9)' });
      }
    }
  }

  drawLines(ctx, t) {
    if (!this.lines.length) return;
    const { cell } = this.L;
    const flow = (t / 18) % 40;
    for (const lw of this.lines) {
      const line = this.model.lines[lw.line];
      const color = this.lineColors[lw.line];
      const pts = Array.from(line, (row, reel) => this.cellCenter(reel, row));
      const first = this.cellRect(0, line[0]);
      const last = this.cellRect(this.model.reels - 1, line[this.model.reels - 1]);
      pts.unshift([first.x - this.L.pad * 0.8, pts[0][1]]);
      pts.push([last.x + last.w + this.L.pad * 0.8, pts[pts.length - 1][1]]);
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.shadowColor = color;
      ctx.shadowBlur = cell * 0.18;
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = Math.max(4, cell * 0.06);
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = Math.max(1.5, cell * 0.018);
      ctx.setLineDash([cell * 0.12, cell * 0.2]);
      ctx.lineDashOffset = -flow;
      ctx.stroke();
      ctx.setLineDash([]);
      // frames around the cells that form the win
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(3, cell * 0.035);
      for (const [r, c] of lw.cells) {
        const cr = this.cellRect(r, c);
        ctx.beginPath();
        ctx.roundRect(cr.x + 3, cr.y + 3, cr.w - 6, cr.h - 6, cell * 0.1);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (this.lineLabel && this.lines.length === 1) this.drawLabel(ctx, this.lines[0]);
    else if (this.lineLabel) this.drawPill(ctx, this.W / 2, this.L.y0 + this.L.innerH - cell * 0.2, this.lineLabel, this.pal.accent2);
  }

  drawPill(ctx, x, y, text, color) {
    const size = Math.max(14, this.L.cell * 0.17);
    ctx.save();
    ctx.font = `${size}px ${this.font}`;
    const w = ctx.measureText(text).width + size * 1.4;
    const h = size * 1.6;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
    ctx.fillStyle = 'rgba(8,4,20,0.9)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + size * 0.05);
    ctx.restore();
  }

  drawLabel(ctx, lw) {
    const mid = lw.cells[Math.floor((lw.cells.length - 1) / 2)];
    const [cx, cy] = this.cellCenter(mid[0], mid[1]);
    const y = cy + this.L.cell * (mid[1] === this.model.rows - 1 ? -0.42 : 0.42);
    this.drawPill(ctx, cx, y, this.lineLabel, this.lineColors[lw.line]);
  }

  drawPlaque(ctx) {
    if (!this.plaque) return;
    const { x0, y0, innerW, pad, plaqueH } = this.L;
    const y = y0 - pad - plaqueH / 2 - 2;
    const w = Math.min(innerW * 0.92, this.W - 24);
    const x = x0 + innerW / 2;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - plaqueH / 2, w, plaqueH, plaqueH / 2);
    ctx.fillStyle = 'rgba(8,4,20,0.82)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = this.mode === 'free' ? this.pal.accent2 : 'rgba(255,255,255,0.25)';
    ctx.stroke();
    ctx.textBaseline = 'middle';
    const size = plaqueH * 0.52;
    ctx.font = `${size}px ${this.font}`;
    ctx.fillStyle = this.pal.text;
    if (this.plaque.right) {
      ctx.textAlign = 'left';
      ctx.fillText(this.plaque.left, x - w / 2 + plaqueH * 0.6, y + 1);
      ctx.textAlign = 'right';
      ctx.fillStyle = this.pal.accent;
      ctx.fillText(this.plaque.right, x + w / 2 - plaqueH * 0.6, y + 1);
    } else {
      ctx.textAlign = 'center';
      ctx.fillStyle = this.pal.muted;
      const text = this.plaque.left;
      const tw = ctx.measureText(text).width;
      if (tw > w - plaqueH) ctx.font = `${size * ((w - plaqueH) / tw)}px ${this.font}`;
      ctx.fillText(text, x, y + 1);
    }
    ctx.restore();
  }

  drawCenterWin(ctx, t) {
    if (!this.centerWin) return;
    const k = (t - this.centerWin.t0) / 1000;
    if (k > 2.2) {
      this.centerWin = null;
      return;
    }
    const { x0, y0, innerW, innerH, cell } = this.L;
    const sc = k < 0.35 ? ease.outBack(k / 0.35, 2) : 1;
    const alpha = k > 1.8 ? 1 - (k - 1.8) / 0.4 : 1;
    ctx.globalAlpha = alpha;
    this.drawTitle(ctx, this.centerWin.text, x0 + innerW / 2, y0 + innerH / 2, cell * 0.5 * sc, { glow: this.pal.accent, maxW: innerW * 0.95 });
    ctx.globalAlpha = 1;
  }

  // ---------------- overlays ----------------

  drawOverlay(ctx, t, dt) {
    const ov = this.ov;
    const a = ov.alpha.update(t);
    const k = (t - ov.t0) / 1000;
    const { W, H } = this;
    const cx = W / 2;
    const unit = Math.min(W, H - this.hudHeight * 0.5);
    ctx.save();
    ctx.globalAlpha = a;
    const g = ctx.createRadialGradient(cx, H * 0.45, 10, cx, H * 0.45, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(16,5,34,0.8)');
    g.addColorStop(1, 'rgba(0,0,0,0.92)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // rotating sunburst behind every overlay
    ctx.save();
    ctx.translate(cx, H * 0.42);
    ctx.rotate(k * 0.25);
    ctx.globalCompositeOperation = 'lighter';
    const rays = 16;
    for (let i = 0; i < rays; i++) {
      ctx.rotate(TAU / rays);
      ctx.fillStyle = `rgba(255,210,90,${0.07 * a})`;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-unit * 0.09, unit);
      ctx.lineTo(unit * 0.09, unit);
      ctx.fill();
    }
    ctx.restore();

    const d = ov.data;
    const intro = ease.outBack(clamp(k / 0.55), 1.8);
    const banner = (img, text, y, size, colors) => {
      if (img) {
        const { w, h } = fit(img, W * 0.92, unit * 0.32, intro);
        ctx.drawImage(img, cx - w / 2, y - h / 2, w, h);
      } else this.drawTitle(ctx, text, cx, y, size * intro, { glow: this.pal.accent2, maxW: W * 0.92, colors });
    };

    if (ov.type === 'feature-intro') {
      banner(this.art.bannerFreeSpins, this.theme.strings?.freeSpins ?? 'FREE SPINS', H * 0.27, unit * 0.13);
      this.drawTitle(ctx, String(d.spins), cx, H * 0.45, unit * 0.24 * intro, { glow: this.pal.accent, colors: ['#ffffff', this.pal.accent, '#ff8a00'] });
      ctx.font = `${unit * 0.038}px ${this.font}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = this.pal.text;
      const lines = d.lines ?? [];
      lines.forEach((ln, i) => ctx.fillText(ln, cx, H * 0.6 + i * unit * 0.055, W * 0.9));
      if (k > 0.8) {
        ctx.globalAlpha = a * (0.55 + 0.45 * Math.sin(k * 5));
        ctx.font = `${unit * 0.034}px ${this.font}`;
        ctx.fillStyle = this.pal.accent;
        ctx.fillText(this.theme.strings?.tapToStart ?? 'TAP TO START', cx, H * 0.6 + lines.length * unit * 0.055 + unit * 0.05);
      }
    } else if (ov.type === 'bigwin') {
      const x = d.amount.update(t);
      const tiers = d.tiers;
      let tier = -1;
      for (let i = 0; i < tiers.length; i++) if (x >= tiers[i].minX) tier = i;
      if (tier !== ov.lastTier) {
        ov.lastTier = tier;
        ov.tierT = t;
        if (tier >= 0) {
          this.fx.shake(6 + tier * 4, 450, t);
          this.fx.coins(cx, H * 0.75, 40 + tier * 25, 1, { spread: 1.2 });
          this.onTier?.(tier);
        }
      }
      if (Math.random() < 0.6 + tier * 0.15) this.fx.rain(W, 1 + tier, 1);
      if (tier >= 0) {
        const tk = (t - ov.tierT) / 1000;
        const punch = tk < 0.5 ? ease.punch(tk / 0.5) : 1;
        const tr = tiers[tier];
        const img = this.art[tr.art];
        if (img) {
          const { w, h } = fit(img, W * 0.92, unit * 0.34, punch * intro);
          ctx.drawImage(img, cx - w / 2, H * 0.3 - h / 2, w, h);
        } else this.drawTitle(ctx, tr.label, cx, H * 0.3, unit * 0.14 * punch * intro, { glow: this.pal.accent2, maxW: W * 0.92 });
      }
      this.drawTitle(ctx, d.format(x), cx, H * 0.5, unit * 0.12, { glow: this.pal.accent, maxW: W * 0.9, colors: ['#ffffff', '#fff1a8', this.pal.accent] });
      ctx.font = `${unit * 0.035}px ${this.font}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = this.pal.muted;
      ctx.fillText(`${(x).toFixed(x < 100 ? 2 : 0)}x`, cx, H * 0.6);
    } else if (ov.type === 'feature-end') {
      banner(null, d.title, H * 0.3, unit * 0.1);
      this.drawTitle(ctx, d.amount, cx, H * 0.46, unit * 0.13 * intro, { glow: this.pal.accent, maxW: W * 0.9, colors: ['#ffffff', '#fff1a8', this.pal.accent] });
      ctx.font = `${unit * 0.036}px ${this.font}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = this.pal.muted;
      ctx.fillText(d.sub, cx, H * 0.57, W * 0.9);
      if (Math.random() < 0.3) this.fx.rain(W, 1, 1);
    } else if (ov.type === 'maxwin') {
      banner(this.art.bannerMax, this.theme.strings?.maxWin ?? 'MAX WIN', H * 0.3, unit * 0.15);
      this.drawTitle(ctx, d.amount, cx, H * 0.48, unit * 0.12, { glow: this.pal.accent, maxW: W * 0.9 });
      if (Math.random() < 0.9) this.fx.rain(W, 3, 1);
    } else if (ov.type === 'message') {
      this.drawTitle(ctx, d.title, cx, H * 0.4, unit * 0.1 * intro, { glow: this.pal.accent2, maxW: W * 0.9 });
      if (d.sub) {
        ctx.font = `${unit * 0.036}px ${this.font}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = this.pal.text;
        ctx.fillText(d.sub, cx, H * 0.5, W * 0.9);
      }
    }
    ctx.restore();
  }
}
