// Generates the extension's PNG icons (no image dependencies needed).
// Run: node scripts/gen-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [18, 21, 27];
const ACCENT = [110, 139, 255];
const FG = [230, 232, 235];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

// Shape in unit coordinates (0..1). Returns [r,g,b,a] or null.
function shade(x, y) {
  const r = 0.18; // corner radius
  const inRounded = (px, py, x0, y0, x1, y1, rad) => {
    if (px < x0 || px > x1 || py < y0 || py > y1) return false;
    const cx = Math.min(Math.max(px, x0 + rad), x1 - rad);
    const cy = Math.min(Math.max(py, y0 + rad), y1 - rad);
    return (px - cx) ** 2 + (py - cy) ** 2 <= rad * rad;
  };
  if (!inRounded(x, y, 0.02, 0.02, 0.98, 0.98, r)) return null;
  // Three queue bars, the first one accent coloured, plus a clock dot.
  const bars = [
    [0.2, 0.24, 0.8, 0.36, ACCENT],
    [0.2, 0.44, 0.7, 0.56, FG],
    [0.2, 0.64, 0.55, 0.76, FG],
  ];
  for (const [x0, y0, x1, y1, col] of bars) if (inRounded(x, y, x0, y0, x1, y1, 0.05)) return [...col, 255];
  const d = Math.hypot(x - 0.74, y - 0.7);
  if (d <= 0.13 && d >= 0.09) return [...ACCENT, 255];
  if (d < 0.09 && ((Math.abs(x - 0.74) < 0.018 && y <= 0.7 && y > 0.63) || (Math.abs(y - 0.7) < 0.018 && x >= 0.74 && x < 0.79))) return [...ACCENT, 255];
  return [...BG, 255];
}

function png(size) {
  const ss = 4;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let acc = [0, 0, 0, 0];
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        const c = shade((x + (sx + 0.5) / ss) / size, (y + (sy + 0.5) / ss) / size);
        if (c) { acc[0] += c[0] * c[3]; acc[1] += c[1] * c[3]; acc[2] += c[2] * c[3]; acc[3] += c[3]; }
      }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      const a = acc[3] / (ss * ss);
      raw[o] = acc[3] ? acc[0] / acc[3] : 0;
      raw[o + 1] = acc[3] ? acc[1] / acc[3] : 0;
      raw[o + 2] = acc[3] ? acc[2] / acc[3] : 0;
      raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public/icons', { recursive: true });
for (const s of [16, 32, 48, 128]) writeFileSync(`public/icons/icon${s}.png`, png(s));
console.log('icons written');
