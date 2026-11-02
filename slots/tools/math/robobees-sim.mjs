// RoboBees simulator: plays the game's own rules (games/robobees/dist/rules.mjs) across worker threads, with a given
// MATH block swapped in, so the fit and the report measure exactly the code the game runs.
//
//   const r = await simulate('bonus', MATH, {mode: 'regular', n: 2e5, seed: 1});
//
// Tasks (every amount in x the bet):
//   lines   {feature, n}: n paid spins without playing their bonuses: line-win sum, hits, triggers, sampled wins
//   bonus   {mode, n, carry}: n bonuses from their start: sum, sum of squares, cap hits, sampled totals
//   rounds  {feature, n}: n paid spins with their bonuses played, as the game does: per-round totals sampled
import {Worker, isMainThread, parentPort, workerData} from 'node:worker_threads';
import os from 'node:os';
import {fileURLToPath} from 'node:url';

const RULES = new URL('../../games/robobees/dist/rules.mjs', import.meta.url).href;
// a private, seeded generator (mulberry32): the game's Math.random stays untouched
export const rngOf = (seed) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = s;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
};
// keep at most this many values per worker for percentiles (a uniform reservoir sample)
const KEEP = 250000;

async function work({task, math, opts, seed}) {
  const R = await import(RULES);
  Object.assign(R.MATH, structuredClone(math));
  const rng = rngOf(seed);
  const pick = rngOf(seed ^ 0x9e3779b9);
  const sample = [];
  let seen = 0;
  const keep = (v) => {
    seen++;
    if (sample.length < KEEP) sample.push(v);
    else {
      const j = Math.floor(pick() * seen);
      if (j < KEEP) sample[j] = v;
    }
  };
  const bonus = (mode, carry = 0) => {
    let st = R.start(mode, carry);
    let capped = false;
    while (st.left > 0) {
      const r = R.spin(st, rng);
      capped ||= r.capped;
      st = r.state;
    }
    return {total: st.total, capped};
  };
  const out = {n: opts.n, sum: 0, sq: 0, hits: 0, capped: 0, max: 0, trig: {regular: 0, super: 0, hidden: 0}};
  if (task === 'bonus') {
    for (let i = 0; i < opts.n; i++) {
      const b = bonus(opts.mode, opts.carry || 0);
      out.sum += b.total;
      out.sq += b.total * b.total;
      out.capped += b.capped;
      out.max = Math.max(out.max, b.total);
      if (b.total > 0) out.hits++;
      keep(b.total);
    }
  } else {
    let st = R.start();
    for (let i = 0; i < opts.n; i++) {
      const r = R.spin(st, rng, opts.feature);
      st = r.state;
      let w = r.amount;
      if (r.trigger) {
        out.trig[r.trigger]++;
        if (task === 'rounds') {
          const b = bonus(r.trigger, r.amount);
          w += b.total;
          out.capped += b.capped || r.capped;
        }
      } else if (r.capped) out.capped++;
      out.sum += w;
      out.sq += w * w;
      out.max = Math.max(out.max, w);
      if (w > 0) out.hits++;
      keep(w);
    }
  }
  out.sample = Float64Array.from(sample);
  out.seen = seen;
  return out;
}

/** runs a task over every core and merges the results; samples are concatenated (each weighted by its share) */
export async function simulate(task, math, opts) {
  const cores = Math.max(1, os.cpus().length);
  const n = Math.ceil(opts.n / cores);
  const parts = await Promise.all(
    Array.from({length: cores}, (_, k) => new Promise((resolve, reject) => {
      const w = new Worker(fileURLToPath(import.meta.url), {workerData: {task, math, opts: {...opts, n}, seed: (opts.seed ?? 1) * 1000003 + k * 7919}});
      w.on('message', resolve);
      w.on('error', reject);
    })),
  );
  const out = {n: 0, sum: 0, sq: 0, hits: 0, capped: 0, max: 0, trig: {regular: 0, super: 0, hidden: 0}, sample: []};
  for (const p of parts) {
    for (const k of ['n', 'sum', 'sq', 'hits', 'capped']) out[k] += p[k];
    out.max = Math.max(out.max, p.max);
    for (const k in out.trig) out.trig[k] += p.trig[k];
    for (const v of p.sample) out.sample.push(v);
  }
  out.mean = out.sum / out.n;
  out.sd = Math.sqrt(Math.max(0, out.sq / out.n - out.mean * out.mean));
  out.se = out.sd / Math.sqrt(out.n);
  return out;
}

if (!isMainThread) parentPort.postMessage(await work(workerData));
