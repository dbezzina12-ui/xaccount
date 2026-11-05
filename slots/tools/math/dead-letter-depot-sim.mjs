#!/usr/bin/env node
// Dead Letter Depot (reels): Monte Carlo through the game's own engine, on
// worker threads. One fresh 32-bit seed per round, as the game does.
//   spins  - a spin mode's own pay and its bonus trigger counts (no bonus played)
//   bonus  - one bonus tier, bought (budget = the cap)
//   rounds - whole rounds through playRound (the cross-check)
// patch overrides landing chances ({ kind: { fs?, stamp? } }) for the fit.
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spinBoard, playBonus, playRound, seeded, compileLands, growMeter } from '../../games/dead-letter-depot/engine/engine.js';
import { LAND, MODES, CAP, PAYING, bonusFor } from '../../games/dead-letter-depot/engine/rules.js';

export const OVER = [0.1, 1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000];
const BINS = 700; // log10 histogram of x (base bets) from 1e-2 to 1e5, 0.01 decades per bin
const binOf = (x) => Math.max(0, Math.min(BINS - 1, Math.floor((Math.log10(x) + 2) * 100)));

export const landsFor = (patch = {}) => compileLands(Object.fromEntries(Object.entries(LAND).map(([k, l]) => [k, { ...l, ...(patch[k] ?? {}) }])));
const sum = (a) => a.reduce((t, x) => t + x, 0);

function blank(job) {
  return { job: job.job, n: 0, sum: 0, sum2: 0, hits: 0, max: 0, capped: 0, over: OVER.map(() => 0), hist: new Array(BINS).fill(0), zero: 0,
    trig: { regular: 0, super: 0, hidden: 0 }, retrig: 0, retrigBonuses: 0, spins: 0, tumbles: 0, tiers: { nice: 0, big: 0, epic: 0, mythic: 0, max: 0 }, drawn: { regular: 0, super: 0, hidden: 0 },
    clearsBy: Object.fromEntries(PAYING.map((s) => [s, 0])), clearHist: new Array(21).fill(0), meterHist: new Array(12).fill(0), active: 0 };
}

export function runChunk(job) {
  const out = blank(job), g = seeded(job.seed), lands = landsFor(job.patch);
  const add = (x) => {
    out.n += 1; out.sum += x; out.sum2 += x * x;
    if (x > 0) { out.hits += 1; out.hist[binOf(x)] += 1; } else out.zero += 1;
    if (x > out.max) out.max = x;
    for (let j = 0; j < OVER.length; j++) if (x >= OVER[j]) out.over[j] += 1;
  };
  for (let i = 0; i < job.n; i++) {
    const rng = seeded(Math.floor(g() * 4294967296));
    if (job.job === 'spins') {
      const m = MODES[job.mode], r = spinBoard(m.land, rng, { opening: m.opening, lands, scheme: job.scheme });
      const win = r.subtotal * growMeter(1, r.stampSum, r.clears, 'add', job.scheme);
      add(Math.min(win, CAP) / 100); out.tumbles += r.tumbles;
      for (const c of r.clears) out.clearsBy[c] += 1;
      out.clearHist[Math.min(20, r.clears.length)] += 1;
      const t = bonusFor(r.fs); if (t) out.trig[t] += 1;
    } else if (job.job === 'bonus') {
      const b = playBonus(job.tier, rng, CAP, { record: false, lands, scheme: job.scheme });
      add(b.total / 100); out.spins += b.awarded; out.retrig += b.retriggers; if (b.retriggers) out.retrigBonuses += 1; if (b.capped) out.capped += 1;
      for (const s of b.spins) { for (const c of s.clears) out.clearsBy[c] += 1; if (s.meter.active && s.subtotal > 0) out.active += 1; }
      out.clearHist[Math.min(20, b.clears)] += 1;
      out.meterHist[Math.min(11, Math.floor(Math.log2(Math.max(1, b.meter))))] += 1;
    } else {
      const r = playRound({ mode: job.mode, rng, record: false, lands, scheme: job.scheme });
      add(r.total / 100); if (r.capped) out.capped += 1;
      if (r.tier) out.tiers[r.tier] += 1;
      if (r.bonus) { (r.spin ? out.trig : out.drawn)[r.bonus.tier] += 1; out.retrig += r.bonus.retriggers; if (r.bonus.retriggers) out.retrigBonuses += 1; out.spins += r.bonus.awarded; }
    }
  }
  return out;
}

function merge(a, b) {
  const m = (x, y) => Object.fromEntries(Object.keys(x).map((k) => [k, x[k] + y[k]]));
  return { ...a, n: a.n + b.n, sum: a.sum + b.sum, sum2: a.sum2 + b.sum2, hits: a.hits + b.hits, max: Math.max(a.max, b.max), capped: a.capped + b.capped, zero: a.zero + b.zero,
    over: a.over.map((v, j) => v + b.over[j]), hist: a.hist.map((v, j) => v + b.hist[j]), trig: m(a.trig, b.trig), drawn: m(a.drawn, b.drawn), tiers: m(a.tiers, b.tiers),
    retrig: a.retrig + b.retrig, retrigBonuses: a.retrigBonuses + b.retrigBonuses, spins: a.spins + b.spins, tumbles: a.tumbles + b.tumbles,
    clearsBy: m(a.clearsBy, b.clearsBy), clearHist: a.clearHist.map((v, j) => v + b.clearHist[j]), meterHist: a.meterHist.map((v, j) => v + b.meterHist[j]), active: a.active + b.active };
}

// Mean, SD, standard error and quantiles (from the log histogram) of a job.
export function stats(r) {
  const mean = r.sum / r.n, sd = Math.sqrt(Math.max(0, r.sum2 / r.n - mean * mean));
  const q = (p) => { if (p * r.n <= r.zero) return 0; let c = r.zero; for (let j = 0; j < BINS; j++) { c += r.hist[j]; if (c >= p * r.n) return Math.round(10 ** ((j + 0.5) / 100 - 2) * 10) / 10; } return r.max; };
  return { n: r.n, mean, sd, se: sd / Math.sqrt(r.n), hit: r.hits / r.n, zero: r.zero / r.n, max: r.max, capped: r.capped, median: q(0.5), p90: q(0.9), p99: q(0.99),
    over: Object.fromEntries(OVER.map((x, j) => [x, r.over[j] / r.n])), trig: Object.fromEntries(Object.entries(r.trig).map(([k, v]) => [k, v / r.n])), drawn: r.drawn,
    retrigPerBonus: r.retrig, retrigBonuses: r.retrigBonuses, spins: r.spins, tumbles: r.tumbles / r.n, tiers: Object.fromEntries(Object.entries(r.tiers).map(([k, v]) => [k, v / r.n])),
    clearsBy: Object.fromEntries(Object.entries(r.clearsBy).map(([k, v]) => [k, v / r.n])), clearHist: r.clearHist.map((v) => v / r.n), meterHist: r.meterHist.map((v) => v / r.n), activePaying: r.active };
}

export async function run(job, threads = availableParallelism()) {
  const per = Math.ceil(job.n / threads);
  const parts = await Promise.all(Array.from({ length: threads }, (_, w) => {
    const n = Math.max(0, Math.min(per, job.n - w * per));
    if (!n) return null;
    return new Promise((resolve, reject) => {
      const worker = new Worker(fileURLToPath(import.meta.url), { workerData: { ...job, n, seed: (job.seed + 104729 * (w + 1)) >>> 0 } });
      worker.once('message', resolve); worker.once('error', reject);
    });
  }));
  return stats(parts.filter(Boolean).reduce(merge));
}

if (!isMainThread) parentPort.postMessage(runChunk(workerData));
else if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);
  const mode = arg('--mode', 'base'), n = Number(arg('--n', 1e6)), seed = Number(arg('--seed', 20261105));
  const t0 = Date.now(), s = await run({ job: 'rounds', mode, n, seed });
  const cost = MODES[mode].cost;
  console.log(`${mode}: RTP ${(100 * s.mean / cost).toFixed(3)}% ± ${(329 * s.se / cost).toFixed(3)} (99.9%) · hit ${(100 * s.hit).toFixed(2)}% · max ${s.max}x · capped ${s.capped} · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
