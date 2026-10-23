// Builds reel strips from symbol counts, deterministically from a seed.
// Order doesn't change RTP (only the counts do), but it shapes how wins
// cluster across lines, so we:
//   - space scatters evenly (the compiler requires >= rows apart),
//   - shuffle everything else,
//   - break up adjacent repeats so symbols don't stack by accident.

import { SeededRng } from '../../engine/core/rng.js';

export function buildStrip(counts, { scatter = 'S', seed = 1, rows = 3 } = {}) {
  const rng = new SeededRng(seed);
  const L = Object.values(counts).reduce((a, b) => a + b, 0);
  const strip = new Array(L).fill(null);
  const nS = counts[scatter] ?? 0;
  if (nS * rows > L) throw new Error(`strip of ${L} can't space ${nS} scatters`);
  const offset = rng.int(Math.max(1, Math.floor(L / Math.max(1, nS))));
  for (let j = 0; j < nS; j++) strip[(offset + Math.floor((j * L) / nS)) % L] = scatter;

  const rest = [];
  for (const [sym, n] of Object.entries(counts)) if (sym !== scatter) for (let i = 0; i < n; i++) rest.push(sym);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  let k = 0;
  for (let i = 0; i < L; i++) if (strip[i] === null) strip[i] = rest[k++];

  // Repair adjacent repeats by swapping with a random compatible slot.
  const free = [...strip.keys()].filter((i) => strip[i] !== scatter);
  const bad = (i) => {
    const s = strip[i];
    return s === strip[(i + 1) % L] || s === strip[(i - 1 + L) % L];
  };
  for (let pass = 0; pass < 50; pass++) {
    let changed = false;
    for (const i of free) {
      if (!bad(i)) continue;
      for (let tries = 0; tries < 40; tries++) {
        const j = free[rng.int(free.length)];
        if (strip[j] === strip[i]) continue;
        [strip[i], strip[j]] = [strip[j], strip[i]];
        if (!bad(i) && !bad(j)) {
          changed = true;
          break;
        }
        [strip[i], strip[j]] = [strip[j], strip[i]];
      }
    }
    if (!changed) break;
  }
  return strip.join(' ');
}
