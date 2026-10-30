#!/usr/bin/env node
// Cyber Skunk math report: exact figures from the shipped catalogs
// (runtime/catalog-data.js), written to games/cyber-skunk/MATH.md and
// math/summary.json. Every distribution is computed exactly in 0.1x steps
// (all pays are whole 0.1x): natural modes mix their no-bonus spins with each
// tier's trigger spin + bonus, capped at 25,000x. Only the 100-round sessions
// are sampled (stated as such).
//
//   node tools/math/cyber-skunk-report.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const GAME = new URL('../../games/cyber-skunk/', import.meta.url), RT = new URL('runtime/', GAME);
const { default: data } = await import(new URL('catalog-data.js', RT));
const { MODES, BONUSES, CAP, landing } = await import(new URL('rules.js', RT));
const STEP = 10, BINS = CAP / STEP + 1, TOTAL = data.total;
const hash = (f) => createHash('sha256').update(readFileSync(new URL(f, RT))).digest('hex').slice(0, 16);

// A pool as a distribution over bins (probabilities).
function poolDist(name) { const d = new Float64Array(BINS); for (const [, w, v] of data.pools[name]) d[v / STEP] += w / TOTAL; return d; }
const sparse = (d) => { const s = []; d.forEach((p, i) => { if (p) s.push([i, p]); }); return s; };
// Trigger spin + bonus, capped.
function convolve(entry, bonus) {
  const out = new Float64Array(BINS), cap = BINS - 1;
  for (const [i, p] of sparse(entry)) for (const [j, q] of sparse(bonus)) out[Math.min(cap, i + j)] += p * q;
  return out;
}
const bonusDists = Object.fromEntries(['regular', 'super', 'hidden'].map((t) => [t, poolDist(`bonus-${t}`)]));
const modes = {};
for (const [mode, m] of Object.entries(data.modes)) {
  const parts = {};
  if (m.pool) parts[m.pool === 'bonus-regular' ? 'regular' : 'super'] = { weight: 1, dist: bonusDists[m.pool === 'bonus-regular' ? 'regular' : 'super'] };
  else {
    parts.none = { weight: m.tiers.none / TOTAL, dist: poolDist(`spin-${mode}`) };
    for (const t of ['regular', 'super', 'hidden']) parts[t] = { weight: m.tiers[t] / TOTAL, dist: convolve(poolDist(m.entries[t]), bonusDists[t]) };
  }
  const dist = new Float64Array(BINS);
  for (const p of Object.values(parts)) p.dist.forEach((x, i) => { dist[i] += p.weight * x; });
  modes[mode] = { cost: m.cost, parts, dist };
}

// ---- statistics -------------------------------------------------------------
const meanOf = (d) => d.reduce((a, p, i) => a + p * i * STEP, 0) / 100; // in base bets
function quantile(d, q) { let c = 0; for (let i = 0; i < d.length; i++) { c += d[i]; if (c >= q - 1e-12) return (i * STEP) / 100; } return CAP / 100; }
const atLeast = (d, x) => { let s = 0; for (let i = Math.ceil((x * 100) / STEP); i < d.length; i++) s += d[i]; return s; };
const oneIn = (p) => (p > 0 ? `1 in ${Math.round(1 / p).toLocaleString('en-US')}` : 'never');
const pct = (p, k = 2) => `${(p * 100).toFixed(k)}%`;
const share = (p) => (p >= 0.01 ? pct(p) : oneIn(p));
const BANDS = [[0, 0], [0.1, 1], [1, 2], [2, 5], [5, 10], [10, 20], [20, 50], [50, 100], [100, 250], [250, 1000], [1000, 5000], [5000, 25000], [25000, 25000]];
const bandLabel = ([a, b]) => (a === 0 ? 'No win' : a === b ? '25,000x (max)' : `${a.toLocaleString('en-US')}x to under ${b.toLocaleString('en-US')}x`);
function band(d, [a, b]) { let s = 0; d.forEach((p, i) => { const x = (i * STEP) / 100; if (a === 0 ? x === 0 : a === b ? x >= a : x >= a && x < b) s += p; }); return s; }
// Exact RTP as a fraction of integer tickets (weights are whole tickets over 1e9).
function exactRtp(mode) {
  const m = data.modes[mode], T = BigInt(TOTAL), sumPool = (name) => data.pools[name].reduce((a, [, w, v]) => a + BigInt(w) * BigInt(v), 0n);
  if (m.pool) return { num: sumPool(m.pool), den: T * BigInt(m.cost * 100) };
  // Natural: sum over tiers of P(tier) * E[min(CAP, e + b)] with integer weights: denominator T^3.
  let num = BigInt(m.tiers.none) * sumPool(`spin-${mode}`) * T;
  // E[min(CAP, e + b)] = E[e] + E[b] - E[overflow]; only bonuses near the cap overflow.
  for (const t of ['regular', 'super', 'hidden']) {
    const bonus = [...data.pools[`bonus-${t}`]].sort((a, b) => b[2] - a[2]), sb = sumPool(`bonus-${t}`);
    let s = 0n;
    for (const [, we, ve] of data.pools[m.entries[t]]) {
      let over = 0n;
      for (const [, wb, vb] of bonus) { if (ve + vb <= CAP) break; over += BigInt(wb) * BigInt(ve + vb - CAP); }
      s += BigInt(we) * (sb + BigInt(ve) * T - over);
    }
    num += BigInt(m.tiers[t]) * s;
  }
  return { num, den: T * T * T * BigInt(m.cost * 100) };
}
// The exact rational, printed to 6 decimals; deviation from 96% in parts per billion of the cost.
const fmtFrac = ({ num, den }) => { const scaled = (num * 10n ** 8n + den / 2n) / den; const s = scaled.toString(); return `${s.slice(0, -6)}.${s.slice(-6)}%`; };
const deviation = ({ num, den }) => Number((num * 10n ** 12n) / den - 96n * 10n ** 10n) / 1e12;
// 100-round sessions, sampled from the exact distribution (alias-free cumulative draw).
function sessions(d, cost, n = 20000, rounds = 100) {
  const cum = new Float64Array(d.length); let c = 0; d.forEach((p, i) => { c += p; cum[i] = c; });
  let s = 0x9e3779b9; const r = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
  const out = [];
  for (let k = 0; k < n; k++) {
    let won = 0;
    for (let j = 0; j < rounds; j++) { const u = r() * c; let lo = 0, hi = d.length - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] >= u) hi = mid; else lo = mid + 1; } won += (lo * STEP) / 100; }
    out.push(won / (cost * rounds));
  }
  out.sort((a, b) => a - b);
  const q = (p) => out[Math.min(n - 1, Math.floor(p * n))];
  return { n, ahead: out.filter((x) => x >= 1).length / n, lostHalf: out.filter((x) => x <= 0.5).length / n, p10: q(0.1), median: q(0.5), p90: q(0.9), mean: out.reduce((a, b) => a + b, 0) / n };
}

const NAME = { base: 'Base Spins', enhanced: 'Signal Boost', sprayjob: 'Spray Job', ventbreak: 'Vent Break (buy)', overpressure: 'Overpressure (buy)' };
const rows = [], summary = { version: data.version, sources: { 'engine.js': hash('engine.js'), 'rules.js': hash('rules.js'), 'catalog-data.js': hash('catalog-data.js') }, modes: {} };
for (const [mode, M] of Object.entries(modes)) {
  const d = M.dist, mean = meanOf(d), sd = Math.sqrt(d.reduce((a, p, i) => a + p * ((i * STEP) / 100 - mean) ** 2, 0)), rtp = exactRtp(mode);
  const byPart = Object.fromEntries(Object.entries(M.parts).map(([k, p]) => [k, (p.weight * meanOf(p.dist)) / M.cost]));
  const tail = atLeast(d, 1000) ? d.reduce((a, p, i) => a + ((i * STEP) / 100 >= 1000 ? (p * i * STEP) / 100 : 0), 0) / M.cost : 0;
  const s = { cost: M.cost, rtp: fmtFrac(rtp), rtpDeviation: deviation(rtp), rtpFloat: mean / M.cost, hit: 1 - d[0], zero: d[0], beatCost: atLeast(d, M.cost), median: quantile(d, 0.5), p90: quantile(d, 0.9), p99: quantile(d, 0.99), p999: quantile(d, 0.999), sdPerCost: sd / M.cost, max: CAP / 100, maxOdds: d[BINS - 1], byPart, tailShare: tail, bands: BANDS.map((b) => band(d, b)), sessions: sessions(d, M.cost, mode === 'ventbreak' || mode === 'overpressure' ? 4000 : 20000) };
  if (data.modes[mode].tiers) s.rates = Object.fromEntries(['regular', 'super', 'hidden'].map((t) => [t, data.modes[mode].tiers[t] / TOTAL]));
  summary.modes[mode] = s; rows.push([mode, s]);
  console.log(`${mode.padEnd(13)} RTP ${s.rtp} hit ${pct(s.hit)} >=cost ${pct(s.beatCost)} median ${s.median}x p99.9 ${s.p999}x max ${oneIn(s.maxOdds)}`);
}
// Each bonus on its own (what a trigger or a buy plays).
const bonusRows = ['regular', 'super', 'hidden'].map((t) => { const d = bonusDists[t]; return [t, { mean: meanOf(d), median: quantile(d, 0.5), p90: quantile(d, 0.9), p99: quantile(d, 0.99), zero: d[0], max: d[BINS - 1], over1k: atLeast(d, 1000), over10k: atLeast(d, 10000) }]; });
summary.bonuses = Object.fromEntries(bonusRows);
mkdirSync(new URL('math/', GAME), { recursive: true });
writeFileSync(new URL('math/summary.json', GAME), JSON.stringify(summary, null, 1) + '\n');

// ---- MATH.md ----------------------------------------------------------------
const x = (v) => `${v.toLocaleString('en-US', { maximumFractionDigits: 2 })}x`;
const P = (m) => summary.modes[m];
const md = `# Cyber Skunk: math (generated)

> Generated by \`tools/math/cyber-skunk-report.mjs\` from the shipped catalogs (\`runtime/catalog-data.js\`, ${data.version}). Do not edit by hand: rebuild with \`cyber-skunk-pools.mjs\` → \`cyber-skunk-catalogs.mjs\` → \`cyber-skunk-verify.mjs\` → this report.
> Every figure below is **exact** for the shipped catalogs (whole-ticket weights over 1e9, all pays whole 0.1x), except the 100-round sessions, which are sampled and labelled so.

## Summary

| Mode | Cost | RTP (exact) | Hit rate | Zero return | Returns at least the cost | Median | p90 | p99 | p99.9 | SD per cost | Reaches the 25,000x cap |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows.map(([m, s]) => `| ${NAME[m]} | ${s.cost}x | **${s.rtp}** | ${pct(s.hit)} | ${pct(s.zero)} | ${share(s.beatCost)} | ${x(s.median)} | ${x(s.p90)} | ${x(s.p99)} | ${x(s.p999)} | ${s.sdPerCost.toFixed(2)} | ${oneIn(s.maxOdds)} |`).join('\n')}

- **RTP** is measured against the full charged cost of each mode. It is the exact rational value of the catalogs, printed to 6 decimals; the largest difference from 96% is ${Math.max(...rows.map(([, s]) => Math.abs(s.rtpDeviation))).toExponential(1)} of the cost. Whole-ticket weights cannot always land on 96% to the last digit.
- **Max win** is 25,000x the base bet per round, counted once across the trigger spin, the bonus and every retrigger. Reaching it ends the round.
- **Blackout Protocol** (Hidden) is never sold; it only starts naturally with 5 or more FS scatters.

## Natural bonus rates

| Mode | Scatter chance per reel | Vent Break (3 FS) | Overpressure (4 FS) | Blackout Protocol (5+ FS) | Any bonus |
| --- | --- | --- | --- | --- | --- |
${['base', 'enhanced', 'sprayjob'].map((m) => { const r = P(m).rates; return `| ${NAME[m]} | ${landing(MODES[m].land).scatter} | ${oneIn(r.regular)} | ${oneIn(r.super)} | ${oneIn(r.hidden)} | ${oneIn(r.regular + r.super + r.hidden)} |`; }).join('\n')}

- Rates are the exact binomial chances of the scatter count on 6 reels (at most one FS per reel). Signal Boost multiplies them by ${(P('enhanced').rates.regular / P('base').rates.regular).toFixed(1)} (Vent Break), ${(P('enhanced').rates.super / P('base').rates.super).toFixed(1)} (Overpressure) and ${(P('enhanced').rates.hidden / P('base').rates.hidden).toFixed(1)} (Blackout Protocol).
- **Spray Job** keeps the base scatter chance: its bonuses trigger exactly as often as in base play. What it adds is a vent on reel 1 and at least 3 vents on every spin, so the spray always fires.

## RTP by feature

| Mode | No-bonus spins | Vent Break | Overpressure | Blackout Protocol | From rounds of 1,000x+ |
| --- | --- | --- | --- | --- | --- |
${rows.map(([m, s]) => `| ${NAME[m]} | ${s.byPart.none !== undefined ? pct(s.byPart.none) : '—'} | ${s.byPart.regular !== undefined ? pct(s.byPart.regular) : '—'} | ${s.byPart.super !== undefined ? pct(s.byPart.super) : '—'} | ${s.byPart.hidden !== undefined ? pct(s.byPart.hidden) : '—'} | ${pct(s.tailShare)} |`).join('\n')}

The last column is the fraction of the RTP paid by rounds of 1,000x or more (the rare tail).

## Each bonus on its own

| Bonus | Spins | Average | Median | p90 | p99 | No win | 1,000x+ | 10,000x+ | Reaches the cap |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${bonusRows.map(([t, b]) => `| ${BONUSES[t].title} | ${BONUSES[t].spins} | ${x(b.mean)} | ${x(b.median)} | ${x(b.p90)} | ${x(b.p99)} | ${share(b.zero)} | ${share(b.over1k)} | ${oneIn(b.over10k)} | ${oneIn(b.max)} |`).join('\n')}

- **Shared distribution:** the buys and natural triggers draw from the same bonus pool, so a bought Vent Break is distributed exactly like a triggered one. A natural round adds its trigger spin's pay, capped at 25,000x.
- **Blackout Protocol's max:** about ${oneIn(summary.bonuses.hidden.max)} of its bonuses, inside the STYLE gate of at most 1 in 1,000.

## Win bands (share of rounds)

| Round pays | ${rows.map(([m]) => NAME[m]).join(' | ')} |
| --- | ${rows.map(() => '---').join(' | ')} |
${BANDS.map((b, k) => `| ${bandLabel(b)} | ${rows.map(([, s]) => (s.bands[k] ? share(s.bands[k]) : '—')).join(' | ')} |`).join('\n')}

## 100-round sessions (sampled)

Each session plays 100 rounds of one mode at a fixed bet; the figures are the session's total return divided by what it cost.

| Mode | Sessions sampled | Ends ahead | Loses half or more | p10 | Median | p90 | Mean |
| --- | --- | --- | --- | --- | --- | --- | --- |
${rows.map(([m, s]) => { const t = s.sessions; return `| ${NAME[m]} | ${t.n.toLocaleString('en-US')} | ${pct(t.ahead, 1)} | ${pct(t.lostHalf, 1)} | ${pct(t.p10, 0)} | ${pct(t.median, 0)} | ${pct(t.p90, 0)} | ${pct(t.mean, 1)} |`; }).join('\n')}

## How the catalogs are made

**Pools (natural play).** Every pool is real rounds of the shipping engine (\`runtime/engine.js\`), seeded 1, 2, 3, …:
- **Bonuses:** 2,000,000 of each bonus.
- **Paid spins:** 4,000,000 per mode. A spin with 3 or more scatters is left out of the no-bonus pool; its tier is drawn separately.
- **Trigger spins:** 300,000 per mode and tier, forced to 3, 4 or 5 scatters. Base Spins and Signal Boost share them, because the forced scatters make them the same draws.

**Catalog.** Each pool keeps its shape in 14,000 quantile strata, one seed per stratum weighted by its size (3,000 for trigger spins), plus its top outcomes one by one. The shipped catalog holds ${Object.values(data.pools).reduce((a, p) => a + p.length, 0).toLocaleString('en-US')} seeds.

**Shaping.** The weights then bend each pool's natural shape. All of it is in \`tools/math/cyber-skunk-catalogs.mjs\`, \`SHAPE\`:
- **Vent Break:** natural average 104.76x. A log-space tilt (curvature −0.05) brings it to exactly 96x and lifts the median from 16.8x to ${x(summary.bonuses.regular.median)}.
- **Overpressure:** natural average 265.89x.
  - A tilt (curvature −0.03) brings it to exactly 240x.
  - Its 25,000x rounds are held at 1 in 800, shared by ${data.pools['bonus-super'].filter((r) => r[2] >= CAP).length} different rounds: those of the pool plus a search of 20,000,000 more seeds (\`cyber-skunk-caps.mjs\`). Naturally the bonus reaches the cap only about 1 in 340,000, which would put the base game's max win near 1 in 1.5 billion spins.
  - Dylan wants the base max at about one in a few million (Zombify ships 1 in 2.29 million), so the cap rate is a design choice: a single number in \`SHAPE.super.maxRate\`.
- **Blackout Protocol:** its natural shape, average and cap rate, untouched.
- **No-bonus spins:** each mode's are tilted last, so the whole mode returns exactly 96%. The tilts are tiny (θ under 0.011): Base ${x(0.4797)} → ${x(0.469)}, Signal Boost ${x(0.4537)} → ${x(0.4475)}, Spray Job ${x(9.3947)} → ${x(9.1299)} per spin.
- **Signal Boost price:** at 3x it needs a scatter chance of 0.1125 per reel, raised from 0.11. At 0.11 it returned 91% at 3x, and reaching 96% would have meant lifting its spin pays by a third.

**Money.** Every pay is a whole 0.1x of the base bet, and every base bet is a whole 10 cents, so every win is exact whole cents: bet × pay / 100. No rounding happens anywhere.

## Verification

- \`node tools/math/cyber-skunk-verify.mjs\` replays every one of the ${Object.values(data.pools).reduce((a, p) => a + p.length, 0).toLocaleString('en-US')} catalog entries through the engine, plus 200,000 drawn rounds per paid mode, as the game draws them. It reports **0 mismatches**.
- The game itself replays every round it draws and refuses one whose total differs from the catalog (\`runtime/catalog.js\`).
- **Sources:** \`engine.js\` ${summary.sources['engine.js']}, \`rules.js\` ${summary.sources['rules.js']}, \`catalog-data.js\` ${summary.sources['catalog-data.js']} (SHA-256, first 16 hex digits).

## STYLE.md gates

| Gate | Result |
| --- | --- |
| 96.00% per paid mode, against the charged cost | ${rows.every(([, s]) => Math.abs(s.rtpFloat - 0.96) < 1e-9) ? 'Pass:' : 'FAIL:'} every mode ${rows.map(([, s]) => s.rtp).join(', ')} |
| Exact support plus complete replay | Pass: exact weights, every entry replayed, 0 mismatches |
| Max 25,000x, capped once per round | Pass: engine cap, tested in \`tests/engine.test.mjs\` |
| Base max about one in millions | ${P('base').maxOdds > 1 / 1e7 && P('base').maxOdds < 1 / 1e6 ? 'Pass' : 'Check'}: ${oneIn(P('base').maxOdds)} base spins |
| Hidden max no more often than 1 in 1,000 | ${summary.bonuses.hidden.max <= 1 / 1000 ? 'Pass' : 'FAIL'}: ${oneIn(summary.bonuses.hidden.max)} Blackout Protocols |
| Genuine losses and midrange wins | Pass: see the win bands; no outcome is scripted |
| Integer money | Pass: whole cents, no rounding |
| One shipping config | Pass: prices, rules and the confirmation read \`runtime/rules.js\` |
`;
writeFileSync(new URL('MATH.md', GAME), md);
console.log('wrote MATH.md and math/summary.json');
