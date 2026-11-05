#!/usr/bin/env node
// Dead Letter Depot: Monte Carlo cross-check. Plays whole rounds through the
// game's own engine (playRound), one fresh 32-bit seed per round as the game
// does, and compares every mode with the exact figures.
//   node tools/math/dead-letter-depot-sorter-sim.mjs [--n 4e6] [--buys 4e5] [--seed 20261105] [--json out.json]
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import { playRound, seeded } from '../../games/dead-letter-depot/archive/sorter/engine/engine.js';
import { MODES, CAP } from '../../games/dead-letter-depot/archive/sorter/engine/rules.js';

export const OVER = [1, 2, 5, 10, 25, 100, 500, 1000, 5000];

export function runChunk(mode, n, seed) {
  const g = seeded(seed), over = new Array(OVER.length).fill(0), tiers = {};
  let sum = 0, sum2 = 0, hits = 0, max = 0, capped = 0, triggers = 0;
  for (let i = 0; i < n; i++) {
    const r = playRound({ mode, rng: seeded(Math.floor(g() * 4294967296)) });
    const x = r.total / 100;
    sum += x; sum2 += x * x;
    if (x > 0) hits += 1;
    if (x > max) max = x;
    if (r.capped) capped += 1;
    if (r.bonus) { triggers += 1; tiers[r.bonus.tier] = (tiers[r.bonus.tier] ?? 0) + 1; }
    for (let j = 0; j < OVER.length; j++) if (x >= OVER[j]) over[j] += 1;
  }
  return { mode, n, sum, sum2, hits, max, capped, triggers, tiers, over };
}

const merge = (parts) => parts.reduce((a, b) => ({
  mode: a.mode, n: a.n + b.n, sum: a.sum + b.sum, sum2: a.sum2 + b.sum2, hits: a.hits + b.hits, max: Math.max(a.max, b.max), capped: a.capped + b.capped, triggers: a.triggers + b.triggers,
  tiers: Object.fromEntries([...new Set([...Object.keys(a.tiers), ...Object.keys(b.tiers)])].map((t) => [t, (a.tiers[t] ?? 0) + (b.tiers[t] ?? 0)])),
  over: a.over.map((v, j) => v + b.over[j]),
}));

export function summarize(r) {
  const cost = MODES[r.mode].cost, mean = r.sum / r.n, sd = Math.sqrt(Math.max(0, r.sum2 / r.n - mean * mean));
  const se = sd / Math.sqrt(r.n) / cost;
  return { mode: r.mode, n: r.n, cost, rtp: mean / cost, ci999: 3.29 * se, se, sd, hit: r.hits / r.n, max: r.max, capped: r.capped, bonusEvery: r.triggers ? r.n / r.triggers : null, tiers: r.tiers, over: Object.fromEntries(OVER.map((x, j) => [x, r.over[j] / r.n])) };
}

export async function simulate({ n = 4e6, buys = 4e5, seed = 20261105, modes = Object.keys(MODES), threads = availableParallelism() } = {}) {
  const out = {};
  for (const [k, mode] of modes.entries()) {
    const total = MODES[mode].kind === 'buy' ? buys : n, per = Math.ceil(total / threads);
    const parts = await Promise.all(Array.from({ length: threads }, (_, w) => new Promise((resolve, reject) => {
      const worker = new Worker(fileURLToPath(import.meta.url), { workerData: { mode, n: Math.min(per, total - w * per), seed: (seed + 7919 * (k * 64 + w)) >>> 0 } });
      worker.once('message', resolve); worker.once('error', reject);
    })));
    out[mode] = summarize(merge(parts.filter((p) => p.n > 0)));
  }
  return out;
}

if (!isMainThread) parentPort.postMessage(workerData.n > 0 ? runChunk(workerData.mode, workerData.n, workerData.seed) : { mode: workerData.mode, n: 0, sum: 0, sum2: 0, hits: 0, max: 0, capped: 0, triggers: 0, tiers: {}, over: OVER.map(() => 0) });
else if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (k, d) => (process.argv.includes(k) ? Number(process.argv[process.argv.indexOf(k) + 1]) : d);
  const { measure } = await import('./dead-letter-depot-sorter-exact.mjs');
  const exact = measure();
  const t0 = Date.now(), seed = arg('--seed', 20261105);
  const res = await simulate({ n: arg('--n', 4e6), buys: arg('--buys', 4e5), seed });
  for (const s of Object.values(res)) {
    const e = exact.modes[s.mode].rtp, z = (s.rtp - e) / s.se;
    console.log(`${s.mode.padEnd(15)} n ${s.n.toExponential(1)} · RTP ${(100 * s.rtp).toFixed(3)}% ± ${(100 * s.ci999).toFixed(3)} (99.9%) · exact ${(100 * e).toFixed(3)}% · z ${z.toFixed(2)} · hit ${(100 * s.hit).toFixed(2)}% · max ${s.max}x · capped ${s.capped}${s.bonusEvery ? ` · bonus 1 in ${Math.round(s.bonusEvery)}` : ''}`);
  }
  console.log(`${((Date.now() - t0) / 1000).toFixed(0)} s, seed ${seed}, cap ${CAP / 100}x`);
  const out = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null;
  if (out) writeFileSync(out, JSON.stringify({ seed, results: res }, null, 1) + '\n');
}
