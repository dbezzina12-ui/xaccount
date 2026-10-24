// Exact distributions for Zombify v125, read straight from its outcome catalogs.
//
// The runtime (games/zombify/runtime/outcome-model.js) never computes a payout
// at spin time: it draws a ticket, picks the catalog entry whose cumulative
// weight covers it, and replays that entry's seed to animate a result already
// known to pay entry[2]. So the catalogs ARE the math, and every figure here is
// exact. Values are in hundredths of the bet, as in the catalogs.

import { BONUS_BUYS, FEATURE_SPIN, SPIN_MODES } from '../../games/zombify/runtime/config.js';
import { CAP } from '../../games/zombify/runtime/math.js';

export { CAP };
// outcome-model.js: base spins enter a bonus on ticket(275) === 0, enhanced on
// ticket(50) === 0; then ticket(100) picks 90 regular / 9 super / 1 hidden.
export const ENTRY = { base: 1 / 275, enhanced: 1 / 50 };
export const TIERS = { regular: 0.9, super: 0.09, hidden: 0.01 };
export const MYSTERY = { regular: 0.4, super: 0.5, hidden: 0.1 };

export async function loadCatalogs() {
  const data = (await import('../../games/zombify/runtime/outcomes.js')).default;
  const feature = (await import('../../games/zombify/runtime/feature-outcomes.js')).default;
  return { data, feature };
}

// Entry i covers tickets [cum(i-1), cum(i)) out of pool.total.
export function poolDist(pool) {
  const d = new Map();
  let prev = 0;
  for (const e of pool.entries) {
    const w = (e[1] - prev) / pool.total;
    if (w <= 0) throw Error('Catalog weights must increase');
    prev = e[1];
    d.set(e[2], (d.get(e[2]) ?? 0) + w);
  }
  if (prev !== pool.total) throw Error('Catalog weights must end at the pool total');
  return d;
}

export function mix(parts) {
  const d = new Map();
  for (const [p, dist] of parts) for (const [v, q] of dist) d.set(v, (d.get(v) ?? 0) + p * q);
  return d;
}

// A natural bonus pays the trigger spin plus the bonus, capped (outcome-model.js).
export function sumCapped(a, b, cap = CAP) {
  const d = new Map();
  for (const [x, p] of a) for (const [y, q] of b) {
    const v = Math.min(cap, x + y);
    d.set(v, (d.get(v) ?? 0) + p * q);
  }
  return d;
}

export function modes({ data, feature }) {
  const pool = (k) => poolDist(data.pools[k]);
  const natural = Object.fromEntries(Object.keys(TIERS).map((t) => [t, sumCapped(pool(t), pool(`entry_${t}`))]));
  const bonus = mix(Object.entries(TIERS).map(([t, p]) => [p, natural[t]]));
  const spin = (kind) => ({
    kind, cost: SPIN_MODES[kind].cost, entry: ENTRY[kind],
    dist: mix([[1 - ENTRY[kind], pool(kind)], [ENTRY[kind], bonus]]),
    parts: { noBonus: pool(kind), bonus, natural },
  });
  return [
    { ...spin('base'), title: 'Base spin' },
    { ...spin('enhanced'), title: 'Enhanced spin' },
    { kind: 'buy_outbreak', title: 'Buy Outbreak', cost: BONUS_BUYS.buy_outbreak.cost, dist: pool('regular') },
    { kind: 'buy_super', title: 'Buy Super Outbreak', cost: BONUS_BUYS.buy_super.cost, dist: pool('super') },
    {
      kind: 'buy_mystery', title: 'Buy Mystery Outbreak', cost: BONUS_BUYS.buy_mystery.cost,
      dist: mix(Object.entries(MYSTERY).map(([t, p]) => [p, pool(t)])),
    },
    { kind: 'buy_feature', title: 'Second Life', cost: FEATURE_SPIN.cost, dist: poolDist(feature.pool) },
  ];
}

// Win bands in multiples of the mode's cost: no win, then [lo, hi) from EDGES.
export const EDGES = [0, 1, 2, 5, 10, 20, 50, 100, 250, 1000, Infinity];
const band = (r) => (r === 0 ? 0 : EDGES.findIndex((lo, i) => r >= lo && r < EDGES[i + 1]) + 1);

export function stats({ dist, cost }) {
  const c = cost * 100;
  let mean = 0, sq = 0, hit = 0, even = 0, max = 0, capped = 0, mass = 0;
  const bands = EDGES.map(() => 0);
  for (const [v, p] of dist) {
    mass += p; mean += p * v; sq += p * v * v; max = Math.max(max, v);
    if (v > 0) hit += p;
    if (v >= c) even += p;
    if (v >= CAP) capped += p;
    bands[band(v / c)] += p;
  }
  if (Math.abs(mass - 1) > 1e-9) throw Error(`Probabilities sum to ${mass}`);
  const rtp = mean / c;
  return { rtp, hit, breakEven: even, sd: Math.sqrt(sq / c / c - rtp * rtp), maxBet: max / 100, maxCost: max / c, capped, bands };
}
