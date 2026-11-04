// Cyber Skunk outcomes: every paid round is drawn from the weighted catalogs
// (catalog-data.js, built by tools/math/cyber-skunk-catalogs.mjs; MATH.md) and
// replayed through the engine, which must reproduce the catalog's value.
//   base / enhanced / sprayjob: a tier at the mode's natural trigger rates, then
//     a no-bonus spin, or a trigger spin (forced 3/4/5 scatters) plus a bonus
//     from the tier's natural pool (modes[mode].bonuses).
//   ventbreak / overpressure: a bonus from the regular / super buy pool.
import { MYSTERY_TIERS } from './rules.js?v=8';
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
  if (mode === 'mystery') {
    let roll = ticket(); // the tier weights are whole tickets out of data.total
    for (const { tier, pool, weight } of MYSTERY_TIERS) {
      if (roll < weight) {
        const bonus = pick(pool, ticket());
        const round = playRound({rng: seeded(bonus.seed), forceBonus: tier});
        if (round.total !== bonus.value) throw Error('Mystery bonus replay mismatch');
        return {...round, mode, draw: {tier, bonus: bonus.seed}};
      }
      roll -= weight;
    }
    throw Error('Invalid mystery ticket');
  }
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
// Free previews (shop → Free previews). Each choice is a shipping outcome, drawn
// with the same tickets and weights as the play it shows, and replayed exactly;
// nothing is charged, credited or saved (app.js freePreview).
//   sprayjob  the paid Spray Job spin, drawRound('sprayjob'): its natural tier
//             tickets (modes.sprayjob.tiers), then spin-sprayjob, or a trigger
//             spin from entry-sprayjob-<tier> plus the natural bonus pool
//             (bonus-regular-natural / bonus-super-natural / bonus-hidden).
//             Every Spray Job spin sprays; natural bonuses stay possible.
//   regular   the Vent Break buy, drawRound('ventbreak'): bonus-regular.
//   super     the Overpressure buy, drawRound('overpressure'): bonus-super.
//   hidden    Blackout Protocol has no buy of its own; its shipping bonus pool
//             bonus-hidden (natural Blackouts and Mystery's Blackout tier both
//             draw it), every round 1,000x or more.
export const PREVIEWS = Object.freeze({
  sprayjob: Object.freeze({ mode: 'sprayjob' }),
  regular: Object.freeze({ mode: 'ventbreak' }),
  super: Object.freeze({ mode: 'overpressure' }),
  hidden: Object.freeze({ pool: 'bonus-hidden', tier: 'hidden' }),
});
export function drawPreview(choice, ticket = cryptoTicket) {
  const p = Object.hasOwn(PREVIEWS, choice) ? PREVIEWS[choice] : null;
  if (!p) throw Error(`Unknown preview ${choice}`);
  if (p.mode) return { ...drawRound(p.mode, ticket), mode: p.mode, preview: choice };
  const b = pick(p.pool, ticket());
  const round = playRound({ rng: seeded(b.seed), forceBonus: p.tier });
  if (round.total !== b.value) throw Error(`Preview replay mismatch in ${p.pool}: seed ${b.seed} paid ${round.total}, expected ${b.value}`);
  return { ...round, mode: null, preview: choice, draw: { tier: p.tier, bonus: b.seed } };
}
// The paid-spin draw uses these integer tickets to select the starting bonus tier.
export function freeSpinsChance(mode) {
  const { regular, super: superBonus, hidden } = data.modes[mode].tiers;
  return (regular + superBonus + hidden) / data.total;
}
export const CATALOG_VERSION = data.version;
