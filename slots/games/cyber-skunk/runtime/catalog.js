// Cyber Skunk outcomes: every paid round is drawn from the weighted catalogs
// (catalog-data.js, built by tools/math/cyber-skunk-catalogs.mjs; MATH.md) and
// replayed through the engine, which must reproduce the catalog's value.
//   base / enhanced / sprayjob: a tier at the mode's natural trigger rates, then
//     a no-bonus spin, or a trigger spin (forced 3/4/5 scatters) plus a bonus
//     from the tier's natural pool (modes[mode].bonuses).
//   ventbreak / overpressure: a bonus from the regular / super buy pool.
import data from './catalog-data.js';
import { playRound, seeded } from './engine.js';

// Cumulative weights per pool, for a binary search per draw.
const cumulative = new Map();
function table(name) {
  if (!cumulative.has(name)) {
    const rows = data.pools[name]; if (!rows) throw Error(`No pool ${name}`);
    const cum = new Float64Array(rows.length); let c = 0;
    rows.forEach((r, i) => { c += r[1]; cum[i] = c; });
    cumulative.set(name, { rows, cum });
  }
  return cumulative.get(name);
}
// A whole ticket in [0, total), from 53 random bits.
export function cryptoTicket(total = data.total) {
  const u = crypto.getRandomValues(new Uint32Array(2));
  return Math.floor(((u[0] * 2 ** 21 + (u[1] >>> 11)) / 2 ** 53) * total);
}
export function pick(name, ticket) {
  const { rows, cum } = table(name);
  let lo = 0, hi = rows.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] > ticket) hi = mid; else lo = mid + 1; }
  return { seed: rows[lo][0], value: rows[lo][2] };
}
export const entryPool = (mode, tier) => data.modes[mode].entries?.[tier] ?? `entry-${mode}-${tier}`;

// Draws and replays one round of a mode. ticket(total) supplies the draws.
export function drawRound(mode, ticket = cryptoTicket) {
  const m = data.modes[mode];
  if (!m) throw Error(`Unknown mode ${mode}`);
  let round, expect, draw;
  if (m.pool) {
    const b = pick(m.pool, ticket());
    round = playRound({ mode, rng: seeded(b.seed) }); expect = b.value; draw = { bonus: b.seed };
  } else {
    let t = ticket(), tier = 'none';
    for (const [name, w] of Object.entries(m.tiers)) { if (t < w) { tier = name; break; } t -= w; }
    if (tier === 'none') {
      const s = pick(`spin-${mode}`, ticket());
      round = playRound({ mode, rng: seeded(s.seed) }); expect = s.value; draw = { spin: s.seed };
    } else {
      const e = pick(entryPool(mode, tier), ticket()), b = pick(m.bonuses?.[tier] ?? `bonus-${tier}`, ticket());
      round = playRound({ mode, rng: seeded(e.seed), bonusRng: seeded(b.seed), triggerScatters: data.scatters[tier] });
      expect = Math.min(data.cap, e.value + b.value); draw = { entry: e.seed, bonus: b.seed, tier };
    }
  }
  if (round.total !== expect) throw Error(`Catalog replay mismatch in ${mode}: ${JSON.stringify(draw)} paid ${round.total}, expected ${expect}`);
  return { ...round, draw };
}
export const CATALOG_VERSION = data.version;
