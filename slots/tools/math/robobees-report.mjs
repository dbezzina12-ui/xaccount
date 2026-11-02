#!/usr/bin/env node
// Writes RoboBees' math sheet, games/robobees/MATH.md and math/summary.json, from the shipped MATH block in rules.mjs,
// by simulating the game's own rules with fresh seeds (robobees-sim.mjs).
//
//   node tools/math/robobees-report.mjs [--scale 1]
//
// A mode's RTP is put together from its parts, which keeps the error small: the line wins of millions of paid spins,
// plus each bonus's trigger chance (importance-sampled from shadow spins at a raised FS chance) times its measured
// average. The ± is a 95% interval. Shapes (hit rate, median, percentiles, bands) come from whole rounds played as the
// game plays them.
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {BOOST} from './robobees-fit.mjs';
import {simulate} from './robobees-sim.mjs';

const ROOT = fileURLToPath(new URL('../../games/robobees/', import.meta.url));
const R = await import(new URL('dist/rules.mjs', 'file://' + ROOT).href);
const MATH = structuredClone(R.MATH);
const scale = Number(process.argv[process.argv.indexOf('--scale') + 1]) || 1;
const N = {regular: 1e6 * scale, super: 1e6 * scale, hidden: 5e5 * scale};
const t0 = Date.now();
const log = (s) => console.error(`${((Date.now() - t0) / 1000).toFixed(0).padStart(4)} s  ${s}`);

const MODES = ['regular', 'super', 'hidden'];
const NAMES = {regular: 'Worker Shift (Regular)', super: 'Swarm Protocol (Super)', hidden: 'Queen Override (Hidden)'};
// lines: paid spins for the line wins and trigger chances; rounds: whole rounds for the shapes
const FEATURES = [
// seed: each mode's own streams (paid spins 200 + seed, whole rounds 300 + seed), fixed so a mode's figures don't move
// when another mode is added or removed
  {id: 'base', label: 'Base spins', cost: 1, feature: null, scatter: MATH.scatter.base, lines: 1.6e7, rounds: 6e6, seed: 1},
  {id: 'enhanced', label: 'Signal Boost', cost: R.features.enhanced.price, feature: 'enhanced', scatter: MATH.scatter.enhanced, lines: 8e6, rounds: 3e6, seed: 2},
  {id: 'random', label: 'Pollen Charge', cost: R.features.random.price, feature: 'random', scatter: MATH.scatter.base, lines: 4e6, rounds: 2e6, seed: 4},
  {id: 'full32', label: 'Hive Overdrive', cost: R.features.full32.price, feature: 'full32', scatter: MATH.scatter.base, lines: 1e6, rounds: 5e5, seed: 5},
].map((f) => ({...f, lines: f.lines * scale, rounds: f.rounds * scale}));

// ---------------------------------------------------------------- measure
const bonus = {};
for (const [i, m] of MODES.entries()) {
  bonus[m] = await simulate('bonus', MATH, {mode: m, n: N[m], seed: 101 + i});
  log(`${m}: ${bonus[m].mean.toFixed(2)}x ± ${(1.96 * bonus[m].se).toFixed(2)}`);
}
const lines = {};
const rounds = {};
for (const f of FEATURES) {
  lines[f.id] = await simulate('lines', MATH, {feature: f.feature, n: f.lines, seed: 200 + f.seed, boost: BOOST});
  rounds[f.id] = await simulate('rounds', MATH, {feature: f.feature, n: f.rounds, seed: 300 + f.seed});
  log(`${f.id}: lines ${lines[f.id].mean.toFixed(4)}, rounds sampled`);
}

// ---------------------------------------------------------------- figures
const sorted = (a) => Float64Array.from(a).sort();
const q = (s, p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
const share = (s, f) => s.reduce((n, v) => n + (f(v) ? 1 : 0), 0) / s.length;
const odds = (p) => (p > 0 ? `1 in ${Math.round(1 / p).toLocaleString('en-US')}` : 'not seen');
const pct = (x, d = 2) => `${(100 * x).toFixed(d)}%`;
const x = (v) => `${v >= 100 ? Math.round(v).toLocaleString('en-US') : +v.toFixed(v < 1 ? 2 : 1)}x`;

const modes = {};
for (const f of FEATURES) {
  const P = lines[f.id].rates;
  const parts = {lines: lines[f.id].mean, ...Object.fromEntries(MODES.map((m) => [m, P[m] * bonus[m].mean]))};
  const ret = Object.values(parts).reduce((a, b) => a + b, 0);
  const se = Math.sqrt(lines[f.id].se ** 2 + MODES.reduce((a, m) => a + (P[m] * bonus[m].se) ** 2 + (lines[f.id].ratesSe[m] * bonus[m].mean) ** 2, 0));
  const s = sorted(rounds[f.id].sample);
  // a round reaches the cap on its paid spin, or in the bonus it triggers
  const capOdds = lines[f.id].capped / lines[f.id].n + MODES.reduce((a, m) => a + P[m] * (bonus[m].capped / bonus[m].n), 0);
  modes[f.id] = {
    label: f.label, cost: f.cost, rtp: ret / f.cost, ci: (1.96 * se) / f.cost, parts: Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, v / f.cost])),
    hit: share(s, (v) => v > 0), atLeastCost: share(s, (v) => v >= f.cost), median: q(s, 0.5), p90: q(s, 0.9), p99: q(s, 0.99), p999: q(s, 0.999),
    sdPerCost: rounds[f.id].sd / f.cost, cap: capOdds, sample: s, max: rounds[f.id].max,
    bonusRate: MODES.reduce((a, m) => a + P[m], 0), rates: P, scatter: f.scatter,
  };
}
const buyOf = (id, mix) => {
  const cost = R.buys[id].price;
  const mean = MODES.reduce((a, m) => a + (mix[m] || 0) * bonus[m].mean, 0);
  const se = Math.sqrt(MODES.reduce((a, m) => a + ((mix[m] || 0) * bonus[m].se) ** 2, 0));
  // a mixture's sample: each part's sample in proportion to its weight
  const total = 4e5;
  const s = sorted(MODES.flatMap((m) => (mix[m] ? Array.from({length: Math.round(total * mix[m])}, (_, i) => bonus[m].sample[i % bonus[m].sample.length]) : [])));
  const capOdds = MODES.reduce((a, m) => a + (mix[m] || 0) * (bonus[m].capped / bonus[m].n), 0);
  return {label: R.buys[id].label + (id === 'mystery' ? '' : ' (buy)'), cost, rtp: mean / cost, ci: (1.96 * se) / cost, hit: share(s, (v) => v > 0), atLeastCost: share(s, (v) => v >= cost), median: q(s, 0.5), p90: q(s, 0.9), p99: q(s, 0.99), p999: q(s, 0.999), sdPerCost: Math.sqrt(MODES.reduce((a, m) => a + (mix[m] || 0) * (bonus[m].sd ** 2 + bonus[m].mean ** 2), 0) - mean ** 2) / cost, cap: capOdds, mix, max: Math.max(...MODES.filter((m) => mix[m]).map((m) => bonus[m].max))};
};
const [mR, mS, mH] = MATH.mystery;
const buys = {regular: buyOf('regular', {regular: 1}), super: buyOf('super', {super: 1}), mystery: buyOf('mystery', {regular: mR, super: mS, hidden: mH})};
const each = Object.fromEntries(MODES.map((m) => {
  const s = sorted(bonus[m].sample);
  return [m, {mean: bonus[m].mean, ci: 1.96 * bonus[m].se, min: s[0], median: q(s, 0.5), p90: q(s, 0.9), p99: q(s, 0.99), noWin: share(s, (v) => v === 0), over1000: share(s, (v) => v >= 1000), over10000: share(s, (v) => v >= 10000), cap: bonus[m].capped / bonus[m].n, n: bonus[m].n, max: bonus[m].max}];
}));

// ---------------------------------------------------------------- the sheet
const rows = [...FEATURES.map((f) => modes[f.id]), buys.regular, buys.super, buys.mystery];
const md = [];
md.push('# RoboBees: math (generated)', '');
md.push('> Generated by `tools/math/robobees-report.mjs` from the shipped `MATH` block in `dist/rules.mjs`, by playing the game\'s own rules. Fitted by `tools/math/robobees-fit.mjs`. Do not edit by hand: change the fit, rerun it with `--write`, then rerun this report.');
md.push(`> Figures are simulated, not exact. Each paid mode's RTP is its line wins over millions of paid spins (${FEATURES.map((f) => `${f.label} ${(f.lines / 1e6).toLocaleString('en-US')}M`).join(', ')}), plus each bonus's trigger chance times its average over ${(N.regular / 1e6).toFixed(1)} million Regular, ${(N.super / 1e6).toFixed(1)} million Super and ${(N.hidden / 1e6).toFixed(1)} million Hidden bonuses. Trigger chances are importance-sampled: each paid spin is shadowed by one from the same state at a ${100 * BOOST}% FS chance per reel, weighted back to the true chance. **±** is a 95% interval. Hit rates, medians, percentiles and bands come from whole rounds played as the game plays them (${FEATURES.map((f) => `${f.label} ${(f.rounds / 1e6).toLocaleString('en-US')}M`).join(', ')}).`);
md.push(`> Seeds: bonuses ${MODES.map((m, i) => `${m} ${101 + i}`).join(', ')}; paid spins ${FEATURES.map((f) => `${f.id} ${200 + f.seed}`).join(', ')}; whole rounds ${FEATURES.map((f) => `${f.id} ${300 + f.seed}`).join(', ')} (\`robobees-sim.mjs\`, one stream per worker).`, '');
md.push('## Summary', '');
md.push(`| Mode | Cost | RTP | Hit rate | Returns at least the cost | Median | p90 | p99 | p99.9 | SD per cost | Highest seen | Reaches the ${MATH.cap.toLocaleString('en-US')}x cap |`);
md.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const r of rows) md.push(`| ${r.label} | ${r.cost}x | **${pct(r.rtp)}** ± ${pct(r.ci)} | ${pct(r.hit, 1)} | ${pct(r.atLeastCost, 1)} | ${x(r.median)} | ${x(r.p90)} | ${x(r.p99)} | ${x(r.p999)} | ${r.sdPerCost.toFixed(2)} | ${x(r.max)} | ${odds(r.cap)} |`);
md.push('');
md.push(`- **Max win** is ${MATH.cap.toLocaleString('en-US')}x the base bet per round, counted once across the trigger spin and the bonus. Reaching it ends the round.`);
md.push(`- **Mystery Buy** reveals Regular ${pct(mR, 0)}, Super ${pct(mS, 0)} or Hidden ${pct(mH, 0)}. Hidden is never sold on its own.`);
md.push(`- **Pollen Charge** and **Hive Overdrive** pay their wins on the base bet: they return 96% of their ${modes.random.cost}x and ${modes.full32.cost}x prices. Each draws its own symbols and Wilds (below) and keeps the base FS chance.`);
md.push('- **Buys** are measured on the bought bonus alone: a bought round has no paid trigger spin.', '');
md.push('## Natural bonus rates', '');
md.push('| Mode | Scatter chance per reel | Worker Shift (3 FS) | Swarm Protocol (4 FS) | Queen Override (5 FS) | Any bonus |');
md.push('| --- | --- | --- | --- | --- | --- |');
for (const f of FEATURES) {
  const m = modes[f.id];
  md.push(`| ${m.label} | ${(100 * m.scatter).toFixed(4)}% | ${odds(m.rates.regular)} | ${odds(m.rates.super)} | ${odds(m.rates.hidden)} | ${odds(m.bonusRate)} |`);
}
md.push('', '- A bonus triggers when a paid spin settles with 3, 4 or 5 FS, at most one per reel; FS land on the opening board and on refills, and survive tumbles. Rates are importance-sampled (see above).', '');
md.push('## RTP by part', '');
md.push('| Mode | Line wins | Worker Shift | Swarm Protocol | Queen Override |');
md.push('| --- | --- | --- | --- | --- |');
for (const f of FEATURES) {
  const p = modes[f.id].parts;
  md.push(`| ${modes[f.id].label} | ${pct(p.lines)} | ${pct(p.regular)} | ${pct(p.super)} | ${pct(p.hidden)} |`);
}
md.push('', '## Each bonus on its own', '');
md.push('| Bonus | Spins | Average | Lowest | Median | p90 | p99 | No win | 1,000x+ | 10,000x+ | Highest seen | Reaches the cap |');
md.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const m of MODES) {
  const e = each[m];
  md.push(`| ${NAMES[m]} | 10 | ${x(e.mean)} ± ${x(e.ci)} | ${x(e.min)} | ${x(e.median)} | ${x(e.p90)} | ${x(e.p99)} | ${e.noWin ? odds(e.noWin) : 'never seen'} | ${e.over1000 ? pct(e.over1000) : '—'} | ${e.over10000 ? odds(e.over10000) : '—'} | ${x(e.max)} | ${e.cap ? odds(e.cap) : 'not seen'} |`);
}
md.push('', '- A bought and a triggered bonus play the same rules; a triggered one adds its trigger spin\'s pay, and the two together are capped.', '');
md.push('## Win bands (share of rounds)', '');
const bands = [[0, 0, 'No win'], [1e-9, 1, '0.01x to under 1x'], [1, 2, '1x to under 2x'], [2, 5, '2x to under 5x'], [5, 10, '5x to under 10x'], [10, 50, '10x to under 50x'], [50, 100, '50x to under 100x'], [100, 1000, '100x to under 1,000x'], [1000, Infinity, '1,000x or more']];
md.push(`| Round pays | ${FEATURES.map((f) => modes[f.id].label).join(' | ')} |`);
md.push(`| --- | ${FEATURES.map(() => '---').join(' | ')} |`);
for (const [lo, hi, label] of bands) {
  const cells = FEATURES.map((f) => {
    const s = modes[f.id].sample;
    const v = share(s, (w) => (hi === 0 ? w === 0 : w >= lo && w < hi));
    return v === 0 ? '—' : v < 0.01 ? odds(v) : pct(v);
  });
  md.push(`| ${label} | ${cells.join(' | ')} |`);
}
md.push('', '## The settings', '');
md.push('`dist/rules.mjs` → `MATH`. Line pays are per line, x the base bet, for 3, 4 and 5 of a kind; a line multiplies its pay by the sum of its cells\' charges (at least 1).', '');
md.push('| Symbol | 3 | 4 | 5 |', '| --- | --- | --- | --- |');
for (const [s, v] of Object.entries(MATH.pays)) md.push(`| ${s} | ${v[0]}x | ${v[1]}x | ${v[2]}x |`);
md.push('');
const KINDS = ['base', 'random', 'full32', ...MODES];
md.push('| Setting | Base spins | Pollen Charge | Hive Overdrive | Worker Shift | Swarm Protocol | Queen Override |', '| --- | --- | --- | --- | --- | --- | --- |');
md.push(`| Draw weight of each premium : each rank | ${KINDS.map((m) => MATH.weights[m].join(' : ')).join(' | ')} |`);
md.push(`| Chance of a first / a second opening Wild | ${KINDS.map((m) => MATH.wilds[m].map((v) => pct(v, v === 1 || v === 0 ? 0 : 2)).join(' / ')).join(' | ')} |`);
md.push(`| A dropped tile's chance to be a Wild | ${KINDS.map((m) => pct(MATH.refillWild[m])).join(' | ')} |`);
md.push(`| Starting charges | carried from the last paid spin | 6–12 cells at 2x–32x | every cell 32x | none | every cell 2x | every cell 2x |`);
md.push('', `- Signal Boost draws as base spins. Scatter chance per reel: base ${(100 * MATH.scatter.base).toFixed(4)}%, Signal Boost ${(100 * MATH.scatter.enhanced).toFixed(4)}%.`);
md.push(`- Pollen Charge's seeds: 2x, 4x, 8x, 16x and 32x at ${MATH.pollen.map((v) => pct(v / MATH.pollen.reduce((a, b) => a + b, 0), 1)).join(', ')}.`);
md.push(`- Queen Override's bee boosts per spin, 1 : 2 : 3 cells, at ${MATH.boosts.map((v) => +v.toFixed(4)).join(' : ')}.`, '');
fs.writeFileSync(ROOT + 'MATH.md', md.join('\n') + '\n');
fs.mkdirSync(ROOT + 'math', {recursive: true});
const strip = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => k !== 'sample'));
fs.writeFileSync(ROOT + 'math/summary.json', JSON.stringify({generated: 'tools/math/robobees-report.mjs', math: MATH, prices: {...Object.fromEntries(Object.entries(R.features).map(([k, v]) => [k, v.price])), ...Object.fromEntries(Object.entries(R.buys).map(([k, v]) => [k, v.price]))}, modes: Object.fromEntries(Object.entries(modes).map(([k, v]) => [k, strip(v)])), buys, bonuses: each, n: {...N, ...Object.fromEntries(FEATURES.map((f) => [f.id, {lines: f.lines, rounds: f.rounds}]))}}, null, 1) + '\n');
log(`wrote ${ROOT}MATH.md and math/summary.json`);
for (const r of rows) console.log(`${r.label.padEnd(26)} ${String(r.cost).padStart(6)}x  RTP ${pct(r.rtp)} ± ${pct(r.ci)}`);
