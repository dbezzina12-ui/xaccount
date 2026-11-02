// RoboBees simulator: plays the game's own rules (games/robobees/dist/rules.mjs) across worker threads, with a given
// MATH block swapped in, so the fit and the report measure exactly the code the game runs.
//
//   const r = await simulate('bonus', MATH, {mode: 'regular', n: 2e5, seed: 1});
//
// Tasks (every amount in x the bet):
//   lines   {feature, n}: n paid spins without playing their bonuses: line-win sum, hits, triggers, sampled wins
//   bonus   {mode, n, carry}: n bonuses from their start: sum, sum of squares, cap hits, sampled totals
//   rounds  {feature, n}: n paid spins with their bonuses played, as the game does: per-round totals sampled
// opts.over: thresholds (x the base bet); out.over counts the rounds or bonuses paying at least each one
// With {boost: q}, each paid spin of 'lines' is shadowed by a second spin from the same state with the FS chance per
// reel raised to q, weighted by how much likelier q made its FS draws (importance sampling): an unbiased and precise
// measure of the chance of ending on 3, 4 or 5 FS (rates), even for the rare 5-FS trigger. The chain itself runs at
// the true chance, so charges carried between paid spins keep their true distribution.
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
  // a bonus from its start; a Pollen Charge or Hive Overdrive trigger passes the multipliers it keeps
  const bonus = (mode, carry = 0, charges = null) => {
    let st = R.start(mode, carry, charges);
    let capped = false;
    while (st.left > 0) {
      const r = R.spin(st, rng);
      capped ||= r.maxWin;
      st = r.state;
    }
    return {total: st.total, capped};
  };
  const key = opts.feature in R.MATH.scatter ? opts.feature : 'base';
  const p = R.MATH.scatter[key];
  const shadowRng = rngOf(seed ^ 0x5bd1e995);
  // the likelihood of a spin's FS draws at chance a over chance b, read from its boards
  const isFS = (id) => id === 'FS';
  const ratio = (r, a, b) => {
    let w = 1;
    for (let c = 0; c < 5; c++) {
      const opening = [c, c + 5, c + 10, c + 15].some((i) => isFS(r.steps[0].landed[i]));
      w *= opening ? a / b : (1 - a) / (1 - b);
    }
    for (let n = 1; n < r.steps.length; n++) {
      const step = r.steps[n];
      const prev = r.steps[n - 1].board;
      for (let c = 0; c < 5; c++) {
        const col = [c, c + 5, c + 10, c + 15];
        const count = col.filter((i) => step.from[i] < 0).length;
        if (!count || col.some((i) => isFS(prev[i]))) continue;
        const pa = 1 - (1 - a) ** (count / 4);
        const pb = 1 - (1 - b) ** (count / 4);
        w *= col.some((i) => step.from[i] < 0 && isFS(step.landed[i])) ? pa / pb : (1 - pa) / (1 - pb);
      }
    }
    return w;
  };
  const shadow = (st) => {
    R.MATH.scatter[key] = opts.boost;
    const r = R.spin(st, shadowRng, opts.feature);
    R.MATH.scatter[key] = p;
    const w = ratio(r, p, opts.boost);
    out.w += w;
    const k = {regular: 3, super: 4, hidden: 5}[r.trigger];
    if (k) {
      out['p' + k] += w;
      out['q' + k] += w * w;
    }
  };
  // bsum: what the bonuses each trigger kind led to paid (rounds); lsum: the paid spins' own wins (rounds)
  const out = {n: opts.n, sum: 0, sq: 0, hits: 0, capped: 0, max: 0, trig: {regular: 0, super: 0, hidden: 0}, bsum: {regular: 0, super: 0, hidden: 0}, lsum: 0, p3: 0, p4: 0, p5: 0, q3: 0, q4: 0, q5: 0, w: 0};
  const over = opts.over || [];
  out.over = over.map(() => 0);
  const count = (v) => {
    for (let j = 0; j < over.length; j++) if (v >= over[j] - 1e-9) out.over[j]++;
  };
  if (task === 'bonus') {
    for (let i = 0; i < opts.n; i++) {
      const b = bonus(opts.mode, opts.carry || 0);
      out.sum += b.total;
      out.sq += b.total * b.total;
      out.capped += b.capped;
      out.max = Math.max(out.max, b.total);
      if (b.total > 0) out.hits++;
      count(b.total);
      keep(b.total);
    }
  } else {
    let st = R.start();
    for (let i = 0; i < opts.n; i++) {
      if (opts.boost) shadow(st);
      const r = R.spin(st, rng, opts.feature);
      st = r.state;
      let w = r.amount;
      if (r.trigger) {
        out.trig[r.trigger]++;
        if (task === 'rounds') {
          const b = bonus(r.trigger, r.amount, r.charges);
          w += b.total;
          out.bsum[r.trigger] += b.total;
          out.capped += b.capped;
        }
      } else if (r.maxWin) out.capped++;
      out.lsum += r.amount;
      out.sum += w;
      out.sq += w * w;
      out.max = Math.max(out.max, w);
      if (w > 0) out.hits++;
      count(w);
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
  const out = {n: 0, sum: 0, sq: 0, hits: 0, capped: 0, max: 0, trig: {regular: 0, super: 0, hidden: 0}, bsum: {regular: 0, super: 0, hidden: 0}, lsum: 0, p3: 0, p4: 0, p5: 0, q3: 0, q4: 0, q5: 0, w: 0, sample: [], over: (opts.over || []).map(() => 0)};
  for (const p of parts) {
    p.over.forEach((c, j) => (out.over[j] += c));
    for (const k of ['n', 'sum', 'sq', 'hits', 'capped', 'lsum', 'p3', 'p4', 'p5', 'q3', 'q4', 'q5', 'w']) out[k] += p[k];
    out.max = Math.max(out.max, p.max);
    for (const k in out.trig) {
      out.trig[k] += p.trig[k];
      out.bsum[k] += p.bsum[k];
    }
    for (const v of p.sample) out.sample.push(v);
  }
  out.mean = out.sum / out.n;
  // importance-sampled trigger chances (with a boost); without one, the direct counts
  out.rates = opts.boost ? {regular: out.p3 / out.n, super: out.p4 / out.n, hidden: out.p5 / out.n} : {regular: out.trig.regular / out.n, super: out.trig.super / out.n, hidden: out.trig.hidden / out.n};
  out.weight = out.w / out.n;
  // the standard errors of the importance-sampled rates
  const seOf = (sum, sq) => Math.sqrt(Math.max(0, sq / out.n - (sum / out.n) ** 2) / out.n);
  out.ratesSe = {regular: seOf(out.p3, out.q3), super: seOf(out.p4, out.q4), hidden: seOf(out.p5, out.q5)};
  out.sd = Math.sqrt(Math.max(0, out.sq / out.n - out.mean * out.mean));
  out.se = out.sd / Math.sqrt(out.n);
  return out;
}

if (!isMainThread) parentPort.postMessage(await work(workerData));
