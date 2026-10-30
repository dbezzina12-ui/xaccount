#!/usr/bin/env node
// Cyber Skunk catalogs: the weighted outcome tables the game plays from.
// Every entry is a seed the engine replays (engine.js, playRound); its weight
// says how often it is drawn. Built from the pools of cyber-skunk-pools.mjs.
//
// How a round is drawn (runtime/catalog.js):
//   base / enhanced / sprayjob: first the tier (none, regular, super, hidden) at
//     the natural trigger rates of the mode's scatter chance (exact binomial);
//     none -> a paid spin with fewer than 3 scatters (spin pool);
//     a tier -> its trigger spin (entry pool, forced 3/4/5 scatters) and a bonus
//     (the tier's natural bonus pool), paying min(25,000x, trigger + bonus).
//   ventbreak / overpressure: a bonus from the regular / super buy pool.
// A bought and a triggered bonus are the same rounds with the same average;
// only how often they reach the cap differs (MAX-WIN ODDS below).
//
// Shaping (DESIGN.md "Math acceptance"):
// - Each pool keeps its natural shape in quantile strata (one seed per
//   stratum, weighted by the stratum's size) plus its top outcomes one by one.
// - Bonus pools: a smooth log-space tilt w * exp(a*L + b*L^2), L = ln(1 + x),
//   fitted so the buy returns exactly 96% with a fairer median; the 25,000x
//   outcomes get an explicit rate so the max is rare but real.
// - No-bonus spin pools: tilted last so each mode returns exactly 96%.
// Weights are whole tickets summing to 1e9 per pool and per tier table.
//
//   node tools/math/cyber-skunk-catalogs.mjs --pools DIR [--extra-caps DIR]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { TOTAL, integerWeights, exactAverage } from './weights.mjs';

const RT = new URL('../../games/cyber-skunk/runtime/', import.meta.url);
const { CAP, MODES, triggerRates } = await import(new URL('rules.js', RT));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const dir = arg('--pools'); if (!dir) throw Error('--pools DIR (from cyber-skunk-pools.mjs)');

// ---- design targets ---------------------------------------------------------
const RTP = 0.96;
// MAX-WIN ODDS, set by Dylan (2026-10-30): the base game reaches the 25,000x
// cap 1 in 1,000,000 spins; a bought Vent Break 1 in 200,000; a bought
// Overpressure 1 in 50,000; Blackout Protocol 1 in 200, and every Blackout
// pays at least 1,000x.
// Per bonus: the exact mean (96% of the buy price; Blackout keeps its natural
// shape), the tilt's curvature and the cap rate of a bought one. A triggered
// Vent Break and Overpressure keep the same average and reach the cap more
// often, both scaled by one factor solved so base play lands on BASE_MAX
// (Blackout's own rate alone would put it near 1 in 30 million).
const BASE_MAX = 1 / 1e6;
const SHAPE = {
  regular: { mean: RTP * MODES.ventbreak.cost * 100, curve: -0.05, maxRate: 1 / 200000 },
  super: { mean: RTP * MODES.overpressure.cost * 100, curve: -0.03, maxRate: 1 / 50000 },
  hidden: { mean: null, curve: 0, maxRate: 1 / 200, min: 1000 * 100 }, // never sold
};
const TIER_SCATTERS = { regular: 3, super: 4, hidden: 5 };
const SIZE = { bonus: { strata: 14000, top: 1500 }, spin: { strata: 14000, top: 800 }, entry: { strata: 3000, top: 200 } };

// ---- pools ------------------------------------------------------------------
const load = (name, type = Int32Array, ext = 'i32') => { const b = readFileSync(`${dir}/${name}.${ext}`); return new type(b.buffer, b.byteOffset, b.length / type.BYTES_PER_ELEMENT); };
let rngState = 20261030;
const rand = () => { rngState = (rngState + 0x6d2b79f5) | 0; let t = rngState; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
// Rows [seed, value, count]: quantile strata (one seed each, weighted by its
// stratum's size) for the body, and every one of the top outcomes.
function compress(values, { strata, top }, keep = () => true, seedOf = (i) => i + 1) {
  const idx = []; for (let i = 0; i < values.length; i++) if (keep(i)) idx.push(i);
  idx.sort((a, b) => values[a] - values[b]);
  const n = idx.length, body = Math.max(0, n - top), per = body / strata, rows = [];
  for (let s = 0; s < strata && body; s++) {
    const lo = Math.floor(s * per), hi = Math.floor((s + 1) * per);
    if (hi > lo) { const i = idx[lo + Math.floor(rand() * (hi - lo))]; rows.push([seedOf(i), values[i], hi - lo]); }
  }
  for (let k = body; k < n; k++) rows.push([seedOf(idx[k]), values[idx[k]], 1]);
  return { rows, n };
}
const meanOf = (rows, w) => { let s = 0, t = 0; rows.forEach((r, i) => { s += r[1] * w[i]; t += w[i]; }); return s / t; };
const quantile = (rows, w, q) => { const o = rows.map((r, i) => [r[1], w[i]]).sort((a, b) => a[0] - b[0]); const t = w.reduce((a, b) => a + b, 0); let c = 0; for (const [v, x] of o) { c += x; if (c >= q * t) return v; } return o.at(-1)[0]; };

// The log-space tilt w * exp(a*L + b*L^2), L = ln(1 + x): b (the curvature)
// is a design choice per bonus, a is fitted by bisection to the exact mean.
// b < 0 moves weight from the extremes toward the middle (a fairer median at
// the price of the far tail); b = 0 is a plain exponential tilt.
function shape(rows, { mean, curve }) {
  const L = rows.map((r) => Math.log1p(r[1] / 100)), base = rows.map((r) => r[2]);
  const weights = (a, b) => base.map((c, i) => c * Math.exp(a * L[i] + b * L[i] * L[i]));
  let lo = -8, hi = 8;
  for (let k = 0; k < 80; k++) { const m = (lo + hi) / 2; if (meanOf(rows, weights(m, curve)) > mean) hi = m; else lo = m; }
  if (hi - lo > 1e-9 && (lo <= -7.99 || hi >= 7.99)) throw Error(`Cannot tilt to ${mean / 100}x`);
  return { w: weights((lo + hi) / 2, curve), a: (lo + hi) / 2, b: curve };
}

// A tier's rows, compressed once and shared by its buy and natural pools:
// the pool's own capped rounds plus those found by cyber-skunk-caps.mjs.
const bonusRowsCache = {};
function bonusRows(tier) {
  if (bonusRowsCache[tier]) return bonusRowsCache[tier];
  const values = load(`bonus-${tier}`), min = SHAPE[tier].min ?? 0, extraDir = arg('--extra-caps');
  const extra = extraDir && existsSync(`${extraDir}/caps-${tier}.json`) ? JSON.parse(readFileSync(`${extraDir}/caps-${tier}.json`)) : [];
  const { rows, n } = compress(values, SIZE.bonus, (i) => values[i] >= min);
  const known = new Set(rows.map((r) => r[0]));
  for (const seed of extra) if (!known.has(seed)) rows.push([seed, CAP, 0]);
  return (bonusRowsCache[tier] = { rows, n, values });
}
// A bonus pool: shaped body, the cap at its own rate, then an exact average.
// mean null keeps the natural shape (Blackout), the cap's share on top.
function bonusPool(tier, s = SHAPE[tier], name = `bonus-${tier}`) {
  const { rows, n } = bonusRows(tier);
  const caps = s.maxRate > 0 ? rows.filter((r) => r[1] >= CAP) : [], body = rows.filter((r) => r[1] < CAP);
  const natural = meanOf(rows, rows.map((r) => r[2])), capShare = caps.length ? s.maxRate : 0;
  // The body carries the rest of the mean once the cap's share is fixed.
  const fit = s.mean === null ? { w: body.map((r) => r[2]), a: 0, b: 0 } : shape(body, { mean: (s.mean - capShare * CAP) / (1 - capShare), curve: s.curve });
  const bodyTotal = fit.w.reduce((a, b) => a + b, 0);
  const shares = [...fit.w.map((x) => (x / bodyTotal) * (1 - capShare)), ...caps.map(() => capShare / caps.length)];
  const all = [...body, ...caps], mean = s.mean ?? Math.round(meanOf(all, shares) / 10) * 10;
  const w = exactAverage(all.map((r) => r[1]), integerWeights(shares), mean);
  return { name, rows: all, w, n, natural, fit, caps: caps.length, maxRate: capShare };
}

// Exact expectation of min(CAP, e + b) for entry and bonus catalogs (weights over TOTAL each).
function cappedSum(entry, bonus) {
  let eMean = 0, bMean = 0; entry.rows.forEach((r, i) => (eMean += r[1] * entry.w[i])); bonus.rows.forEach((r, i) => (bMean += r[1] * bonus.w[i]));
  let over = 0; const eMax = Math.max(...entry.rows.map((r) => r[1]));
  bonus.rows.forEach((rb, j) => { if (rb[1] + eMax <= CAP) return; entry.rows.forEach((re, i) => { const x = re[1] + rb[1] - CAP; if (x > 0) over += x * entry.w[i] * bonus.w[j]; }); });
  return eMean / TOTAL + bMean / TOTAL - over / TOTAL / TOTAL;
}
// Natural trigger rates: rules.js triggerRates (exact binomial on 6 reels; 5 or 6 start Blackout).
const tierRates = (mode) => triggerRates(MODES[mode].land);

// Exact chance that min(CAP, e + b) reaches the cap, for entry and bonus catalogs.
function capChance(entry, bonus) {
  const b = bonus.rows.map((r, j) => [r[1], bonus.w[j]]).sort((x, y) => y[0] - x[0]);
  let p = 0;
  entry.rows.forEach((re, i) => { let s = 0; for (const [v, w] of b) { if (re[1] + v < CAP) break; s += w; } p += entry.w[i] * s; });
  return p / TOTAL / TOTAL;
}

// ---- build ------------------------------------------------------------------
const pools = {}, seenEntries = new Map();
const report = (b) => {
  const m = meanOf(b.rows, b.w), capW = b.rows.reduce((a, r, i) => a + (r[1] >= CAP ? b.w[i] : 0), 0);
  console.log(`${b.name}: ${b.rows.length} entries from ${b.n.toLocaleString('en-US')} bonuses (${b.caps} reach the cap) · natural ${(b.natural / 100).toFixed(2)}x -> ${(m / 100).toFixed(4)}x · median ${(quantile(b.rows, b.w, 0.5) / 100).toFixed(1)}x · min ${(Math.min(...b.rows.map((r) => r[1])) / 100).toFixed(1)}x · cap ${capW ? `1 in ${Math.round(TOTAL / capW).toLocaleString('en-US')}` : 'never'} · tilt a=${b.fit.a.toFixed(4)} b=${b.fit.b.toFixed(4)}`);
};
// Bought bonuses (and Blackout, which is never sold and has one pool).
const buy = Object.fromEntries(['regular', 'super', 'hidden'].map((t) => [t, bonusPool(t)]));
// Trigger-spin pools. Modes whose trigger spins are the same draws share one
// pool (Signal Boost only changes the scatter chance).
function entryPool(mode, t) {
  const values = load(`entry-${mode}-${t}`), key = createHash('sha256').update(values).digest('hex');
  let entry = seenEntries.get(key);
  if (!entry) {
    const e = compress(values, SIZE.entry);
    entry = { name: `entry-${mode}-${t}`, rows: e.rows, n: e.n }; entry.w = integerWeights(entry.rows.map((r) => r[2]));
    pools[entry.name] = entry; seenEntries.set(key, entry);
  }
  return entry;
}
// Triggered Vent Break and Overpressure: their buy cap rates times one factor,
// solved so base play reaches the cap at BASE_MAX. A tier with no capped round
// to draw on leaves the factor to the other.
const baseTiers = integerWeights((() => { const r = tierRates('base'); return [1 - r.regular - r.super - r.hidden, r.regular, r.super, r.hidden]; })());
const naturalPools = (k) => ({
  regular: bonusPool('regular', { ...SHAPE.regular, maxRate: buy.regular.caps ? k * SHAPE.regular.maxRate : 0 }, 'bonus-regular-natural'),
  super: bonusPool('super', { ...SHAPE.super, maxRate: k * SHAPE.super.maxRate * (buy.regular.caps ? 1 : 1 + (baseTiers[1] * SHAPE.regular.maxRate) / (baseTiers[2] * SHAPE.super.maxRate)) }, 'bonus-super-natural'),
  hidden: buy.hidden,
});
const baseMax = (nat) => ['regular', 'super', 'hidden'].reduce((a, t, k) => a + (baseTiers[k + 1] / TOTAL) * capChance(entryPool('base', t), nat[t]), 0);
let k = 30, triggered;
for (let it = 0; it < 6; it++) {
  triggered = naturalPools(k);
  const T = triggered, m = baseMax(T), fixed = baseMax({ ...T, regular: { ...T.regular, w: T.regular.w.map((w, i) => (T.regular.rows[i][1] >= CAP ? 0 : w)) }, super: { ...T.super, w: T.super.w.map((w, i) => (T.super.rows[i][1] >= CAP ? 0 : w)) } });
  console.log(`natural cap factor ${k.toFixed(4)}: base max 1 in ${Math.round(1 / m).toLocaleString('en-US')}`);
  if (Math.abs(m / BASE_MAX - 1) < 2e-4) break;
  k *= (BASE_MAX - fixed) / (m - fixed);
}
for (const b of [...Object.values(buy), triggered.regular, triggered.super]) { report(b); pools[b.name] = b; }

const modes = {};
for (const mode of ['base', 'enhanced', 'sprayjob']) {
  const cost = MODES[mode].cost * 100, rates = tierRates(mode), pB = rates.regular + rates.super + rates.hidden;
  const tierW = integerWeights([1 - pB, rates.regular, rates.super, rates.hidden]);
  let fromBonus = 0; const entries = {}, bonuses = {};
  for (const [k, t] of ['regular', 'super', 'hidden'].entries()) {
    const entry = entryPool(mode, t);
    entries[t] = entry.name; bonuses[t] = triggered[t].name;
    fromBonus += (tierW[k + 1] / TOTAL) * cappedSum(entry, triggered[t]);
  }
  const spinValues = load(`spin-${mode}`), scatters = load(`spin-${mode}.scatters`, Int8Array, 'i8');
  const s = compress(spinValues, SIZE.spin, (i) => scatters[i] < 3);
  const spin = { name: `spin-${mode}`, rows: s.rows, n: s.n };
  const natural = meanOf(spin.rows, spin.rows.map((r) => r[2]));
  const target = (RTP * cost - fromBonus) / (tierW[0] / TOTAL);
  // A one-parameter tilt (w * (1 + x)^-theta) to the exact no-bonus average.
  const L = spin.rows.map((r) => Math.log1p(r[1] / 100)), wt = (th) => spin.rows.map((r, i) => r[2] * Math.exp(-th * L[i]));
  let lo = -3, hi = 3; for (let k = 0; k < 80; k++) { const m = (lo + hi) / 2; if (meanOf(spin.rows, wt(m)) > target) lo = m; else hi = m; }
  spin.w = exactAverage(spin.rows.map((r) => r[1]), integerWeights(wt(lo)), target); spin.theta = lo;
  pools[spin.name] = spin;
  const rtp = ((tierW[0] / TOTAL) * meanOf(spin.rows, spin.w) + fromBonus) / cost;
  modes[mode] = { cost: MODES[mode].cost, tiers: { none: tierW[0], regular: tierW[1], super: tierW[2], hidden: tierW[3] }, entries, bonuses };
  console.log(`${mode}: bonuses ${(fromBonus / cost * 100).toFixed(2)}% of the price · no-bonus spins ${(natural / 100).toFixed(4)}x -> ${(target / 100).toFixed(4)}x (theta ${lo.toFixed(4)}) · RTP ${(rtp * 100).toFixed(6)}%`);
}
modes.ventbreak = { cost: MODES.ventbreak.cost, pool: 'bonus-regular' };
modes.overpressure = { cost: MODES.overpressure.cost, pool: 'bonus-super' };

const catalog = {
  version: 'cs-2', total: TOTAL, cap: CAP, scatters: TIER_SCATTERS, modes,
  pools: Object.fromEntries(Object.entries(pools).map(([name, p]) => [name, p.rows.map((r, i) => [r[0], p.w[i], r[1]])])),
};
const out = new URL('catalog-data.js', RT);
writeFileSync(out, `// Generated by tools/math/cyber-skunk-catalogs.mjs. Do not edit: rebuild it.\n// pools: name -> [seed, weight, value in hundredths of the base bet]\nexport default ${JSON.stringify(catalog)};\n`);
console.log(`wrote ${out.pathname} (${(readFileSync(out).length / 1e6).toFixed(2)} MB, ${Object.values(catalog.pools).reduce((a, p) => a + p.length, 0).toLocaleString('en-US')} entries)`);
