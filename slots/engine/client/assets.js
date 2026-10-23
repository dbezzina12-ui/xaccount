// Art loading. Every file listed in ART_FILES is optional: if the PNG is in
// the game's art/ folder it is used, otherwise a procedural placeholder is
// drawn, so the game always runs and art can land one file at a time.
// Symbol PNGs are auto-trimmed to their visible pixels, so the padding an
// image generator adds doesn't change how big a symbol looks on the reels.

export const ART_FILES = {
  symbols: (model) => model.symbols.map((id) => ({ key: id, file: `symbols/${id}.png` })),
  scenes: [
    { key: 'bgBase', file: 'bg-base.png' },
    { key: 'bgBasePortrait', file: 'bg-base-portrait.png' },
    { key: 'bgFree', file: 'bg-free.png' },
    { key: 'bgFreePortrait', file: 'bg-free-portrait.png' },
    { key: 'logo', file: 'logo.png', trim: true },
    { key: 'bannerFreeSpins', file: 'banner-free-spins.png', trim: true },
    { key: 'bannerBig', file: 'banner-big-win.png', trim: true },
    { key: 'bannerMega', file: 'banner-mega-win.png', trim: true },
    { key: 'bannerEpic', file: 'banner-epic-win.png', trim: true },
    { key: 'bannerMax', file: 'banner-max-win.png', trim: true },
    { key: 'coin', file: 'fx-coin.png', trim: true },
  ],
};

function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

// Crop to visible pixels and report whether the image has transparency.
function inspect(img, { trim }) {
  const probe = 256;
  const k = Math.min(1, probe / Math.max(img.width, img.height));
  const pw = Math.max(1, Math.round(img.width * k));
  const ph = Math.max(1, Math.round(img.height * k));
  const c = canvas(pw, ph);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, pw, ph);
  let data;
  try {
    data = ctx.getImageData(0, 0, pw, ph).data;
  } catch {
    return { image: img, transparent: null };
  }
  const a = (x, y) => data[(y * pw + x) * 4 + 3];
  const corners = [a(0, 0), a(pw - 1, 0), a(0, ph - 1), a(pw - 1, ph - 1)];
  const transparent = corners.some((v) => v < 200);
  if (!trim || !transparent) return { image: img, transparent };
  let x0 = pw;
  let y0 = ph;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < ph; y++) {
    for (let x = 0; x < pw; x++) {
      if (a(x, y) > 12) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return { image: img, transparent };
  const sx = Math.max(0, Math.floor(x0 / k) - 2);
  const sy = Math.max(0, Math.floor(y0 / k) - 2);
  const sw = Math.min(img.width - sx, Math.ceil((x1 - x0 + 1) / k) + 4);
  const sh = Math.min(img.height - sy, Math.ceil((y1 - y0 + 1) / k) + 4);
  const out = canvas(sw, sh);
  out.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return { image: out, transparent };
}

export async function loadArt(artBase, model) {
  const list = [...ART_FILES.symbols(model).map((e) => ({ ...e, trim: true, symbol: true })), ...ART_FILES.scenes];
  const art = { symbols: {}, report: [] };
  await Promise.all(
    list.map(async (e) => {
      const img = await loadImage(artBase + e.file);
      if (!img) {
        art.report.push({ file: e.file, status: 'missing' });
        return;
      }
      const { image, transparent } = inspect(img, { trim: e.trim });
      const needsAlpha = e.trim;
      const status = needsAlpha && transparent === false ? 'no-transparency' : 'ok';
      art.report.push({ file: e.file, status, width: img.width, height: img.height });
      if (e.symbol) art.symbols[e.key] = image;
      else art[e.key] = image;
    }),
  );
  art.report.sort((a, b) => a.file.localeCompare(b.file));
  const bad = art.report.filter((r) => r.status === 'no-transparency');
  if (bad.length) console.warn('[art] these PNGs have no transparent background:', bad.map((r) => r.file).join(', '));
  return art;
}

// ---------- placeholders (used until the real PNG exists) ----------

const GEMS = {
  H1: { sides: 6, hue: 350, name: 'ruby' },
  H2: { sides: 4, hue: 280, name: 'amethyst' },
  H3: { sides: 8, hue: 140, name: 'emerald' },
  H4: { sides: 24, hue: 205, name: 'sapphire' },
};
const RANKS = { L1: ['A', 28], L2: ['K', 330], L3: ['Q', 180], L4: ['J', 95], L5: ['10', 205] };

function poly(ctx, cx, cy, r, n, rot = -Math.PI / 2, squash = 1) {
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r * squash;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
}

function drawGem(ctx, S, { sides, hue }) {
  const c = S / 2;
  const r = S * 0.42;
  const rot = sides === 4 ? -Math.PI / 2 : -Math.PI / 2 + Math.PI / sides;
  const squash = sides === 4 ? 1.12 : 1;
  ctx.save();
  ctx.shadowColor = `hsla(${hue},90%,40%,0.6)`;
  ctx.shadowBlur = S * 0.08;
  const g = ctx.createLinearGradient(0, c - r, 0, c + r);
  g.addColorStop(0, `hsl(${hue},95%,72%)`);
  g.addColorStop(0.5, `hsl(${hue},85%,48%)`);
  g.addColorStop(1, `hsl(${hue},90%,24%)`);
  poly(ctx, c, c, r, sides, rot, squash);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = S * 0.02;
  ctx.strokeStyle = `hsl(${hue},90%,85%)`;
  poly(ctx, c, c, r, sides, rot, squash);
  ctx.stroke();
  // facets
  const ri = r * 0.55;
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = S * 0.01;
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * r, c + Math.sin(a) * r * squash);
    ctx.lineTo(c + Math.cos(a) * ri, c + Math.sin(a) * ri * squash);
    ctx.stroke();
  }
  const tg = ctx.createLinearGradient(c - ri, c - ri, c + ri, c + ri);
  tg.addColorStop(0, `hsla(${hue},100%,90%,0.9)`);
  tg.addColorStop(1, `hsla(${hue},90%,55%,0.6)`);
  poly(ctx, c, c, ri, sides, rot, squash);
  ctx.fillStyle = tg;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(c - r * 0.3, c - r * 0.42, r * 0.22, r * 0.1, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fill();
}

function drawRank(ctx, S, [ch, hue], font) {
  const c = S / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${ch.length > 1 ? S * 0.56 : S * 0.72}px ${font}`;
  ctx.lineJoin = 'round';
  ctx.lineWidth = S * 0.09;
  ctx.strokeStyle = `hsl(${hue},70%,14%)`;
  ctx.strokeText(ch, c, c + S * 0.04);
  const g = ctx.createLinearGradient(0, S * 0.15, 0, S * 0.85);
  g.addColorStop(0, `hsl(${hue},100%,82%)`);
  g.addColorStop(0.55, `hsl(${hue},90%,55%)`);
  g.addColorStop(1, `hsl(${hue},90%,34%)`);
  ctx.fillStyle = g;
  ctx.fillText(ch, c, c + S * 0.04);
  ctx.lineWidth = S * 0.015;
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.strokeText(ch, c, c + S * 0.04);
}

function drawBadge(ctx, S, label, colors, font, star) {
  const c = S / 2;
  ctx.save();
  // burst
  ctx.translate(c, c);
  ctx.fillStyle = colors[2];
  for (let i = 0; i < 16; i++) {
    ctx.rotate(Math.PI / 8);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(S * 0.05, -S * 0.48);
    ctx.lineTo(-S * 0.05, -S * 0.48);
    ctx.fill();
  }
  ctx.restore();
  ctx.save();
  if (star) {
    poly(ctx, c, c, S * 0.4, 10, -Math.PI / 2);
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
      const r = i % 2 ? S * 0.2 : S * 0.44;
      const x = c + Math.cos(a) * r;
      const y = c + Math.sin(a) * r;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
  } else {
    const w = S * 0.84;
    const h = S * 0.5;
    ctx.beginPath();
    ctx.roundRect(c - w / 2, c - h / 2, w, h, S * 0.1);
  }
  const g = ctx.createLinearGradient(0, S * 0.2, 0, S * 0.8);
  g.addColorStop(0, colors[0]);
  g.addColorStop(1, colors[1]);
  ctx.fillStyle = g;
  ctx.shadowColor = colors[1];
  ctx.shadowBlur = S * 0.1;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = S * 0.025;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.stroke();
  ctx.restore();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${S * (label.length > 4 ? 0.17 : 0.24)}px ${font}`;
  ctx.lineJoin = 'round';
  ctx.lineWidth = S * 0.05;
  ctx.strokeStyle = 'rgba(30,10,0,0.9)';
  const y = star ? c + S * 0.02 : c + S * 0.015;
  ctx.strokeText(label, c, y);
  ctx.fillStyle = '#fff';
  ctx.fillText(label, c, y);
}

// `order` is the symbol's position among symbols of its kind, so any game's
// symbols get distinct placeholders (gems for highs, letters for lows).
export function placeholderSymbol(id, kind, S, theme, order = 0) {
  const cv = canvas(S, S);
  const ctx = cv.getContext('2d');
  const font = theme.fonts?.display ?? 'system-ui';
  const gems = Object.values(GEMS);
  const hues = [28, 330, 180, 95, 205, 260, 55];
  if (GEMS[id]) drawGem(ctx, S, GEMS[id]);
  else if (RANKS[id]) drawRank(ctx, S, RANKS[id], font);
  else if (kind === 'high') {
    const g = gems[order % gems.length];
    drawGem(ctx, S, { ...g, hue: (g.hue + 47 * Math.floor(order / gems.length)) % 360 });
  } else if (kind === 'low') drawRank(ctx, S, [id.length <= 2 ? id : id[0], hues[order % hues.length]], font);
  else if (kind === 'wild') drawBadge(ctx, S, theme.strings?.wild ?? 'WILD', ['#ffe680', '#e08a00', 'rgba(255,200,40,0.35)'], font, false);
  else if (kind === 'scatter') drawBadge(ctx, S, theme.strings?.scatter ?? 'BONUS', ['#ff7ad9', '#7a1cff', 'rgba(200,90,255,0.35)'], font, true);
  else {
    ctx.fillStyle = '#888';
    ctx.fillRect(S * 0.1, S * 0.1, S * 0.8, S * 0.8);
    ctx.fillStyle = '#fff';
    ctx.font = `${S * 0.3}px ${font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(id, S / 2, S / 2);
  }
  return cv;
}

export function placeholderCoin(S) {
  const cv = canvas(S, S);
  const ctx = cv.getContext('2d');
  const c = S / 2;
  const g = ctx.createRadialGradient(c - S * 0.15, c - S * 0.15, S * 0.05, c, c, S * 0.5);
  g.addColorStop(0, '#fff6c0');
  g.addColorStop(0.4, '#ffcf3a');
  g.addColorStop(1, '#b86e00');
  ctx.beginPath();
  ctx.arc(c, c, S * 0.46, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = S * 0.06;
  ctx.strokeStyle = '#a65f00';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(c, c, S * 0.3, 0, Math.PI * 2);
  ctx.lineWidth = S * 0.04;
  ctx.strokeStyle = 'rgba(255,240,180,0.8)';
  ctx.stroke();
  return cv;
}

// ---------- per-size sprite cache ----------

// Fit an image inside a box, preserving aspect ratio.
export function fit(img, w, h, scale = 1) {
  const k = Math.min(w / img.width, h / img.height) * scale;
  return { w: img.width * k, h: img.height * k };
}

function silhouette(src, color) {
  const c = canvas(src.width, src.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

export class SpriteCache {
  constructor(model, theme, art) {
    this.model = model;
    this.theme = theme;
    this.art = art;
    this.px = 0;
    this.sprites = {};
  }

  // Render every symbol at the current cell size (in device pixels).
  build(px) {
    px = Math.round(px);
    if (px === this.px) return;
    this.px = px;
    const accent = this.theme.palette?.accent ?? '#ffd84a';
    const seen = {};
    for (let i = 0; i < this.model.symbols.length; i++) {
      const id = this.model.symbols[i];
      const kind = this.model.kind[i];
      const order = (seen[kind] = (seen[kind] ?? -1) + 1);
      const src = this.art.symbols[id] ?? placeholderSymbol(id, kind, px * 2, this.theme, order);
      const scale = this.theme.symbolScale?.[id] ?? 0.9;
      const base = canvas(px, px);
      const { w, h } = fit(src, px, px, scale);
      const bctx = base.getContext('2d');
      bctx.imageSmoothingQuality = 'high';
      bctx.drawImage(src, (px - w) / 2, (px - h) / 2, w, h);

      // Vertical motion-blur smear for spinning reels.
      const pad = Math.round(px * 0.2);
      const blur = canvas(px, px + pad * 2);
      const blctx = blur.getContext('2d');
      // One tap every ~1.5 device px so the smear reads as a streak, not copies.
      const taps = Math.max(12, Math.round(pad / 1.5) * 2 + 1);
      for (let t = 0; t < taps; t++) {
        const u = (t / (taps - 1)) * 2 - 1;
        blctx.globalAlpha = 0.05 + 0.1 * (1 - Math.abs(u));
        blctx.drawImage(base, 0, pad + u * pad);
      }

      // Soft glow behind winning symbols.
      const gpad = Math.round(px * 0.25);
      const glow = canvas(px + gpad * 2, px + gpad * 2);
      const gctx = glow.getContext('2d');
      const sil = silhouette(base, this.theme.glow?.[id] ?? accent);
      gctx.shadowColor = this.theme.glow?.[id] ?? accent;
      gctx.shadowBlur = px * 0.14;
      gctx.shadowOffsetX = glow.width * 2;
      gctx.drawImage(sil, gpad - glow.width * 2, gpad);
      gctx.drawImage(sil, gpad - glow.width * 2, gpad);

      this.sprites[id] = { base, blur, blurPad: pad, glow, glowPad: gpad };
    }
    this.coin = this.art.coin ?? placeholderCoin(128);
  }
}
