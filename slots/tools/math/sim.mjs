#!/usr/bin/env node
// Monte Carlo simulator. Plays the real round logic (engine/core/game.js)
// on worker threads with independent seeded RNG streams.
//
//   node tools/math/sim.mjs games/game-001/model.json --rounds 1e8 --threads 4
//   node tools/math/sim.mjs games/game-001/model.json --buy --rounds 1e7
//   ... --json games/game-001/math/sim-base.json   (save results)
//
// Everything is measured per round in multiples of the round's cost
// (1x bet for a spin, priceX for a bonus buy).

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { availableParallelism } from 'node:os';
import { compileModel } from '../../engine/core/model.js';
import { playRound } from '../../engine/core/game.js';
import { SeededRng } from '../../engine/core/rng.js';

// Upper edges (x bet) of the win-distribution buckets; the last bucket is
// "hit the max-win cap".
export const BUCKETS = [0, 1, 2, 5, 10, 20, 50, 100, 250, 500, 1000, 2500, 5000];

function simulate(modelJson, rounds, seed, buy) {
  const m = compileModel(modelJson);
  const rng = new SeededRng(seed);
  const hist = new Float64Array(BUCKETS.length + 2);
  let sum = 0;
  let sumSq = 0;
  let baseSum = 0;
  let freeSum = 0;
  let hits = 0;
  let triggers = 0;
  let featureSum = 0;
  let featureSumSq = 0;
  let freeSpins = 0;
  let capped = 0;
  let capLoss = 0;
  let max = 0;
  const state = [0, 0, 0, 0];
  const after = [0, 0, 0, 0];
  for (let i = 0; i < rounds; i++) {
    rng.save(state);
    let r = playRound(m, rng, { buy });
    if (r.capped) {
      // Replay the same round without the cap: the paired difference is
      // exactly what the cap took from this round.
      r = { ...r };
      rng.save(after);
      rng.restore(state);
      capLoss += playRound(m, rng, { buy, capLB: Infinity }).totalWinX - r.totalWinX;
      rng.restore(after);
    }
    const x = r.totalWinX;
    sum += x;
    sumSq += x * x;
    baseSum += r.baseWinX;
    freeSum += r.freeWinX;
    if (x > 0) hits++;
    if (r.triggered) {
      triggers++;
      featureSum += r.freeWinX;
      featureSumSq += r.freeWinX * r.freeWinX;
      freeSpins += r.freeSpinsPlayed;
    }
    if (r.capped) capped++;
    if (x > max) max = x;
    // bucket: 0 => exactly zero; then (prev, edge]; overflow; cap
    let b;
    if (r.capped) b = BUCKETS.length + 1;
    else if (x === 0) b = 0;
    else {
      b = BUCKETS.length;
      const xr = x / r.costX;
      for (let j = 1; j < BUCKETS.length; j++) {
        if (xr < BUCKETS[j]) {
          b = j;
          break;
        }
      }
    }
    hist[b]++;
  }
  return { rounds, sum, sumSq, baseSum, freeSum, hits, triggers, featureSum, featureSumSq, freeSpins, capped, capLoss, max, hist: Array.from(hist) };
}

export async function runSim(modelJson, { rounds = 1e7, threads = availableParallelism(), seed = 1, buy = false } = {}) {
  const per = Math.ceil(rounds / threads);
  const self = fileURLToPath(import.meta.url);
  const parts = await Promise.all(
    Array.from({ length: threads }, (_, t) =>
      new Promise((resolve, reject) => {
        const w = new Worker(self, { workerData: { modelJson, rounds: per, seed: seed * 1000003 + t * 7919 + 1, buy } });
        w.once('message', resolve);
        w.once('error', reject);
      }),
    ),
  );
  const acc = parts.reduce((a, p) => {
    for (const k of Object.keys(p)) {
      if (k === 'hist') a.hist = a.hist ? a.hist.map((v, i) => v + p.hist[i]) : p.hist.slice();
      else if (k === 'max') a.max = Math.max(a.max ?? 0, p.max);
      else a[k] = (a[k] ?? 0) + p[k];
    }
    return a;
  }, {});
  const m = compileModel(modelJson);
  const cost = buy ? m.bonusBuy.priceX : 1;
  const n = acc.rounds;
  const mean = acc.sum / n;
  const variance = acc.sumSq / n - mean * mean;
  const sd = Math.sqrt(Math.max(0, variance));
  const fsMean = acc.triggers ? acc.featureSum / acc.triggers : 0;
  const fsSd = acc.triggers ? Math.sqrt(Math.max(0, acc.featureSumSq / acc.triggers - fsMean * fsMean)) : 0;
  return {
    mode: buy ? 'bonus-buy' : 'base',
    rounds: n,
    seed,
    threads,
    rtp: mean / cost,
    rtpCI95: (1.96 * sd) / Math.sqrt(n) / cost,
    rtpBase: acc.baseSum / n / cost,
    rtpFeature: acc.freeSum / n / cost,
    sd: sd / cost,
    hitRate: acc.hits / n,
    triggerOneIn: acc.triggers ? n / acc.triggers : Infinity,
    feature: { avgWinX: fsMean, sdX: fsSd, avgSpins: acc.triggers ? acc.freeSpins / acc.triggers : 0 },
    capped: acc.capped,
    // RTP the cap removes (paired estimate: each capped round replayed uncapped).
    capCost: acc.capLoss / n / cost,
    capOneIn: acc.capped ? n / acc.capped : Infinity,
    maxWinX: acc.max,
    buckets: BUCKETS,
    hist: acc.hist,
  };
}

if (!isMainThread) {
  const { modelJson, rounds, seed, buy } = workerData;
  parentPort.postMessage(simulate(modelJson, rounds, seed, buy));
} else if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (name, def) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : def;
  };
  const path = args.find((a) => a.endsWith('.json') && args[args.indexOf(a) - 1] !== '--json') ?? 'games/game-001/model.json';
  const modelJson = JSON.parse(readFileSync(path, 'utf8'));
  const t0 = Date.now();
  const res = await runSim(modelJson, {
    rounds: Number(opt('rounds', 1e7)),
    threads: Number(opt('threads', availableParallelism())),
    seed: Number(opt('seed', 1)),
    buy: args.includes('--buy'),
  });
  const secs = (Date.now() - t0) / 1000;
  const pct = (x) => (x * 100).toFixed(3) + '%';
  console.log(`${res.mode}: ${res.rounds.toLocaleString()} rounds in ${secs.toFixed(1)}s`);
  console.log(`RTP ${pct(res.rtp)} ± ${pct(res.rtpCI95)} (95% CI)   base ${pct(res.rtpBase)}  feature ${pct(res.rtpFeature)}`);
  console.log(`SD ${res.sd.toFixed(2)}x   hit rate ${pct(res.hitRate)}   feature 1 in ${res.triggerOneIn.toFixed(1)}   avg feature ${res.feature.avgWinX.toFixed(2)}x (sd ${res.feature.sdX.toFixed(1)})`);
  console.log(`max win ${res.maxWinX.toFixed(2)}x   capped ${res.capped} (1 in ${res.capOneIn.toFixed(0)}), cap costs ${pct(res.capCost)} RTP`);
  const out = opt('json', null);
  if (out) {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify({ ...res, seconds: secs, at: new Date().toISOString() }, null, 2) + '\n');
    console.log(`saved ${out}`);
  }
}
