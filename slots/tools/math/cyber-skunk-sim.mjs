#!/usr/bin/env node
// Cyber Skunk Monte Carlo: plays whole rounds through the game's own engine
// (games/cyber-skunk/runtime/engine.js, playRound), seeded, on every core,
// and prints each mode's return and shape. Calibration aid; the shipped
// figures come from the weighted catalogs (MATH.md).
//
//   node tools/math/cyber-skunk-sim.mjs [--rounds base=2e6,enhanced=1e6,sprayjob=2e5,ventbreak=2e4,overpressure=2e4,hidden=5e3]
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';

const ENGINE = new URL('../../games/cyber-skunk/runtime/engine.js', import.meta.url).href;
if (!isMainThread) {
  const { playRound, seeded } = await import(ENGINE);
  const { mode, from, to } = workerData, play = mode === 'hidden' ? 'base' : mode;
  const s = { n: 0, sum: 0, sq: 0, hits: 0, beatCost: 0, sprays: 0, capped: 0, max: 0, tiers: { regular: 0, super: 0, hidden: 0 }, tierSum: { regular: 0, super: 0, hidden: 0 }, bands: new Array(12).fill(0) };
  for (let i = from; i < to; i++) {
    const r = playRound({ mode: play, rng: seeded(i * 2654435761 + 97 * (mode.length + 1)), forceBonus: mode === 'hidden' ? 'hidden' : null });
    s.n++; s.sum += r.total; s.sq += r.total * r.total; if (r.total > 0) s.hits++; if (r.capped) s.capped++; if (r.total > s.max) s.max = r.total;
    if (r.events.some((e) => e.type === 'spray' && !e.tier)) s.sprays++;
    if (r.tier) { s.tiers[r.tier]++; s.tierSum[r.tier] += r.total; }
    s.raw = (s.raw || 0); s.cost = workerData.cost;
    if (r.total >= workerData.cost * 100) s.beatCost++;
    const x = r.total / 100, edges = [0, 0.5, 1, 2, 5, 10, 20, 50, 100, 500, 2500, Infinity];
    s.bands[x === 0 ? 0 : 1 + edges.findIndex((e, k) => x >= e && x < edges[k + 1])]++;
  }
  parentPort.postMessage(s);
} else {
  const { MODES } = await import(new URL('../../games/cyber-skunk/runtime/rules.js', import.meta.url).href);
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const rounds = { base: 2e6, enhanced: 1e6, sprayjob: 2e5, ventbreak: 2e4, overpressure: 2e4, hidden: 5e3 };
  for (const kv of (arg('--rounds', '') || '').split(',').filter(Boolean)) { const [k, v] = kv.split('='); rounds[k] = Number(v); }
  const T = cpus().length;
  for (const [mode, n] of Object.entries(rounds).filter(([, n]) => n > 0)) {
    const cost = mode === 'hidden' ? 1 : MODES[mode].cost, per = Math.ceil(n / T), t0 = Date.now();
    const parts = await Promise.all(Array.from({ length: T }, (_, k) => new Promise((ok, bad) => { const w = new Worker(fileURLToPath(import.meta.url), { workerData: { mode, cost, from: k * per, to: Math.min(n, (k + 1) * per) } }); w.once('message', ok); w.once('error', bad); })));
    const s = parts.reduce((a, b) => { for (const k of ['n', 'sum', 'sq', 'hits', 'beatCost', 'sprays', 'capped']) a[k] += b[k]; a.max = Math.max(a.max, b.max); for (const t in a.tiers) { a.tiers[t] += b.tiers[t]; a.tierSum[t] += b.tierSum[t]; } a.bands = a.bands.map((v, i) => v + b.bands[i]); return a; });
    const mean = s.sum / s.n / 100, sd = Math.sqrt(Math.max(0, s.sq / s.n / 1e4 - mean * mean)), rtp = mean / cost, ci = 1.96 * sd / Math.sqrt(s.n) / cost;
    const oneIn = (k) => (k ? `1 in ${Math.round(s.n / k).toLocaleString('en-US')}` : 'none');
    console.log(`${mode.padEnd(13)} ${s.n.toLocaleString('en-US')} rounds  RTP ${(rtp * 100).toFixed(2)}% ± ${(ci * 100).toFixed(2)}  hit ${(s.hits / s.n * 100).toFixed(1)}%  ≥cost ${(s.beatCost / s.n * 100).toFixed(1)}%  spray ${(s.sprays / s.n * 100).toFixed(1)}%  max ${(s.max / 100).toFixed(1)}x  capped ${oneIn(s.capped)}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    if (mode !== 'hidden') console.log(`              bonuses: regular ${oneIn(s.tiers.regular)} avg ${(s.tierSum.regular / Math.max(1, s.tiers.regular) / 100).toFixed(1)}x · super ${oneIn(s.tiers.super)} avg ${(s.tierSum.super / Math.max(1, s.tiers.super) / 100).toFixed(1)}x · hidden ${oneIn(s.tiers.hidden)} avg ${(s.tierSum.hidden / Math.max(1, s.tiers.hidden) / 100).toFixed(1)}x · RTP from bonuses ${((s.tierSum.regular + s.tierSum.super + s.tierSum.hidden) / s.n / 100 / cost * 100).toFixed(1)}%`);
    console.log(`              bands: ${['0', '<.5', '.5-1', '1-2', '2-5', '5-10', '10-20', '20-50', '50-100', '100-500', '500-2500', '2500+'].map((b, i) => `${b}:${(s.bands[i] / s.n * 100).toFixed(2)}%`).join(' ')}`);
  }
}
