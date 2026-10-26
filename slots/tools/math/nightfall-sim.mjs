#!/usr/bin/env node
// Night Fall Monte Carlo: plays whole rounds through the game's own engine
// (games/nightfall/runtime/engine.js, generateRound) for each mode, seeded,
// across worker threads, and writes the measured figures as JSON.
//
//   node tools/math/nightfall-sim.mjs [--engine PATH] [--rounds base=4e6,feature=2e6,regular=2e5,super=2e5,hidden=0] [--json OUT]
//
// `hidden` (no price; it is only won) reports its average award per bonus.
//
// Night Fall's math is development math (its rules say so): these are
// measurements with confidence intervals, not certified returns.

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const MODES = ['base', 'feature', 'regular', 'super', 'hidden'];
const COST = { base: 1, feature: 'featureCost', regular: 'bonusCost', super: 'superCost', hidden: 1 };

if (!isMainThread) {
  const { engine, mode, from, to } = workerData;
  const { generateRound, seedRng, RULES } = await import(engine);
  const s = { n: 0, sum: 0, sq: 0, hits: 0, bonuses: 0, bonusSum: 0, played: 0, retriggers: 0, capped: 0, max: 0, mage: 0, roams: 0, roamerStrikes: 0, bursts: 0, naturalSuper: 0, naturalHidden: 0, superWins: 0, hiddenWins: 0, regularWins: 0 };
  for (let i = from; i < to; i++) {
    const r = generateRound({ rng: seedRng(i * 7919 + 104729 * (MODES.indexOf(mode) + 1)), mode, record: false });
    s.n++; s.sum += r.total; s.sq += r.total * r.total; if (r.total > 0) s.hits++;
    if (r.bonusMode) { s.bonuses++; s.bonusSum += r.total; s.played += r.played; s.retriggers += r.retriggers; }
    // Bonuses won from base or Reaper Strike spins, by kind, and what they paid.
    if (r.bonusMode && (mode === 'base' || mode === 'feature')) { const k = r.bonusMode === 'super' ? 'Super' : r.bonusMode === 'hidden' ? 'Hidden' : ''; if (k) s['natural' + k]++; s[(r.bonusMode) + 'Wins'] += r.total; }
    if (r.capped) s.capped++; if (r.total > s.max) s.max = r.total;
    s.mage += r.mageZaps || 0; s.roams += r.roams || 0; s.roamerStrikes += r.roamerStrikes || 0; s.bursts += r.bursts || 0;
  }
  parentPort.postMessage({ s, cost: typeof COST[mode] === 'number' ? COST[mode] : RULES[COST[mode]] });
} else {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const engine = pathToFileURL(resolve(arg('--engine', fileURLToPath(new URL('../../games/nightfall/runtime/engine.js', import.meta.url))))).href;
  const rounds = { base: 4e6, feature: 2e6, regular: 2e5, super: 2e5, hidden: 0 };
  for (const kv of (arg('--rounds', '') || '').split(',').filter(Boolean)) { const [k, v] = kv.split('='); rounds[k] = Number(v); }
  const threads = Math.max(1, cpus().length);
  const out = { engine: arg('--engine', 'games/nightfall/runtime/engine.js'), generated: new Date().toISOString(), modes: {} };
  const t0 = Date.now();
  for (const mode of MODES.filter((m) => rounds[m] > 0)) {
    const n = rounds[mode], per = Math.ceil(n / threads);
    const parts = await Promise.all(Array.from({ length: threads }, (_, k) => new Promise((ok, bad) => {
      const w = new Worker(fileURLToPath(import.meta.url), { workerData: { engine, mode, from: k * per + 1, to: Math.min(n, (k + 1) * per) + 1 } });
      w.once('message', ok); w.once('error', bad);
    })));
    const s = parts.reduce((a, { s: b }) => { for (const k in b) a[k] = k === 'max' ? Math.max(a[k] || 0, b[k]) : (a[k] || 0) + b[k]; return a; }, {});
    const cost = parts[0].cost, mean = s.sum / s.n, sd = Math.sqrt(Math.max(0, s.sq / s.n - mean * mean));
    out.modes[mode] = {
      rounds: s.n, cost, rtp: mean / cost, ci95: 1.96 * sd / Math.sqrt(s.n) / cost, sdPerCost: sd / cost,
      hitRate: s.hits / s.n, bonusRate: s.bonuses / s.n, bonusAverage: s.bonuses ? s.bonusSum / s.bonuses : 0,
      freeSpinsPerBonus: s.bonuses ? s.played / s.bonuses : 0, retriggersPerBonus: s.bonuses ? s.retriggers / s.bonuses : 0,
      capRate: s.capped / s.n, maxWin: s.max, mageZapsPerRound: s.mage / s.n, roamsPerBonus: s.bonuses ? s.roams / s.bonuses : 0,
      roamersPerBonus: s.bonuses ? s.roamerStrikes / s.bonuses : 0, burstsPerBonus: s.bonuses ? s.bursts / s.bonuses : 0,
      naturalSuperRate: s.naturalSuper / s.n, naturalHiddenRate: s.naturalHidden / s.n,
      // Return from each kind of won bonus (base and Reaper Strike spins), per cost.
      returnFrom: { regular: s.regularWins / s.n / cost, super: s.superWins / s.n / cost, hidden: s.hiddenWins / s.n / cost },
    };
    console.log(mode.padEnd(8), `${s.n.toLocaleString('en-US')} rounds`, `RTP ${(mean / cost * 100).toFixed(3)}% ± ${(out.modes[mode].ci95 * 100).toFixed(3)}%`, `hit ${(s.hits / s.n * 100).toFixed(2)}%`);
  }
  out.seconds = Math.round((Date.now() - t0) / 1000);
  const json = arg('--json');
  if (json) writeFileSync(json, JSON.stringify(out, null, 1) + '\n');
  console.log(`${out.seconds}s`);
}
