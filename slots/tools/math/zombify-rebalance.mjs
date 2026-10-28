#!/usr/bin/env node
// Zombify catalog rebalance (Dylan, 2026-10-28). Rewrites the two outcome
// catalogs the game draws from:
//
// - Second Life (feature-outcomes.js, second-life-v3): the round now starts
//   with 2, 3 or 4 zombies and every heart after the first brings in another
//   (runtime/feature-spin.js). Plays seeds 1..N through that code and builds a
//   new weighted catalog: the starting-zombie mix (75/20/5%) and the respin mix
//   (no heart 78%, one 20%, two or more 2%) are held exactly, and payouts are
//   tilted within them so the feature returns exactly 96% at 10x.
// - Hidden (outcomes.js pool `hidden`): only outcomes paying 1,000x or more,
//   reshaped slightly so the bonus averages exactly 2,256x. Mystery Buy rises
//   to 400x and the enhanced spin to 3.3x (config.js) to pay for it.
// - Base and enhanced spins (pools `base`, `enhanced`): payouts tilted so each
//   returns exactly 96% with the new Hidden.
//
// Every other pool is copied unchanged. Weights are integers summing to 1e9,
// each at least 1, and every pool's average is hit exactly (integer sums).
//
//   node tools/math/zombify-rebalance.mjs [--seeds 2000000] [--from v125/outcomes.js]
//
// The v125 outcome catalog is read from --from, or fetched from the import
// source (behind a proxy: NODE_USE_ENV_PROXY=1), and must match its v125 hash.
//
// Then: node tools/math/zombify-verify.mjs && node tools/math/zombify-report.mjs

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const RT = new URL('../../games/zombify/runtime/', import.meta.url);
const TOTAL = 1e9;

if (!isMainThread) {
  const { makeFeatureRound } = await import(new URL('feature-spin.js', RT)), { seeded } = await import(new URL('math.js', RT));
  const { from, to } = workerData, out = new Int32Array((to - from) * 5);
  for (let s = from, k = 0; s < to; s++, k += 5) { const r = makeFeatureRound({ rng: seeded(s) }); out.set([s, r.total, r.hearts, r.spins, r.events[0].zombies], k); }
  parentPort.postMessage(out, [out.buffer]);
} else {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const { FEATURE_SPIN, BONUS_BUYS, SPIN_MODES } = await import(new URL('config.js', RT));
  const { ENTRY, TIERS, MYSTERY, poolDist, sumCapped } = await import('./zombify.js');
  const V125 = 'a3bcb569f510da3e1d49dc36c85f73ae65cf7f9188c1848b18b5cf6bfe54bf14';
  const source = JSON.parse(readFileSync(new URL('../import-manifest.json', RT), 'utf8')).source;
  const bytes = arg('--from') ? readFileSync(arg('--from')) : Buffer.from(await (await fetch(new URL('outcomes.js', source))).arrayBuffer());
  if (createHash('sha256').update(bytes).digest('hex') !== V125) throw Error('Not the v125 outcomes.js: rebalance only from the verified v125 catalog');
  const text = bytes.toString('utf8'), data = JSON.parse(text.slice(text.indexOf('export default ') + 15, text.lastIndexOf(';')));

  // ---- weights -------------------------------------------------------------
  // Integer weights summing to TOTAL (each >= 1) from real-valued shares, then
  // an exact average: move single tickets between entries until sum(w*v) is
  // exactly target * TOTAL.
  function integerWeights(shares, total = TOTAL) {
    const sum = shares.reduce((a, x) => a + x, 0), raw = shares.map((x) => Math.max(1, (x / sum) * total)), w = raw.map(Math.floor);
    let left = total - w.reduce((a, x) => a + x, 0);
    const order = raw.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0]);
    for (let k = 0; left > 0; k = (k + 1) % order.length, left--) w[order[k][1]]++;
    for (let k = 0; left < 0; k = (k + 1) % order.length) if (w[order[k][1]] > 1) { w[order[k][1]]--; left++; }
    return w;
  }
  function exactAverage(values, w, target) { return exactSum(values, w, BigInt(Math.round(target * TOTAL))); }
  // Move tickets between entries (the total stays) until sum(w*v) === goal.
  function exactSum(values, w, goal) {
    const total = w.reduce((t, x) => t + x, 0);
    let have = values.reduce((a, v, i) => a + BigInt(v) * BigInt(w[i]), 0n);
    const byValue = new Map(); values.forEach((v, i) => { if (!byValue.has(v)) byValue.set(v, []); byValue.get(v).push(i); });
    const sorted = [...byValue.keys()].sort((a, b) => a - b);
    // Big steps: lowest <-> highest value; then an exact pair for the rest.
    for (let guard = 0; have !== goal && guard < 1e6; guard++) {
      const diff = goal - have, up = diff > 0n, need = up ? diff : -diff;
      let moved = false;
      // An exact pair: values a, b with b - a === need (move one ticket a -> b, or b -> a).
      if (need <= BigInt(sorted.at(-1) - sorted[0])) {
        const n = Number(need);
        for (const a of sorted) {
          if (!byValue.has(a + n)) continue;
          const from = up ? byValue.get(a).find((i) => w[i] > 1) : byValue.get(a + n).find((i) => w[i] > 1), to = up ? byValue.get(a + n)[0] : byValue.get(a)[0];
          if (from === undefined) continue;
          w[from]--; w[to]++; have += up ? need : -need; moved = true; break;
        }
      }
      if (moved) continue;
      // Otherwise a bulk move between the extremes that does not overshoot.
      const lo = sorted[0], hi = sorted.at(-1), span = BigInt(hi - lo), steps = need / span;
      const fromList = up ? byValue.get(lo) : byValue.get(hi), toIndex = (up ? byValue.get(hi) : byValue.get(lo))[0];
      const from = fromList.reduce((best, i) => (w[i] > w[best] ? i : best), fromList[0]);
      const k = Number(steps > 0n ? (steps < BigInt(w[from] - 1) ? steps : BigInt(w[from] - 1)) : 0n);
      if (k > 0) { w[from] -= k; w[toIndex] += k; have += (up ? 1n : -1n) * BigInt(k) * span; continue; }
      // Near the goal: the largest single move that does not overshoot, from
      // an entry that can spare a ticket.
      const spare = (v) => byValue.get(v).find((i) => w[i] > 1);
      let best = null;
      for (let x = 0, y = 0; x < sorted.length; x++) {
        if (y < x) y = x;
        while (y + 1 < sorted.length && sorted[y + 1] - sorted[x] <= Number(need)) y++;
        if (up && spare(sorted[x]) === undefined) continue;
        for (let z = y; z > x; z--) {
          if (!up && spare(sorted[z]) === undefined) continue;
          if (!best || sorted[z] - sorted[x] > best[1] - best[0]) best = [sorted[x], sorted[z]];
          break;
        }
      }
      if (!best) throw Error('Cannot reach the exact average');
      const [a, b] = best, f = spare(up ? a : b), t = byValue.get(up ? b : a)[0];
      w[f]--; w[t]++; have += (up ? 1n : -1n) * BigInt(b - a);
    }
    if (have !== goal) throw Error('Exact average not reached');
    if (w.reduce((t, x) => t + x, 0) !== total || w.some((x) => !(x >= 1))) throw Error('Weights must be whole tickets summing to the total');
    return w;
  }
  // A pool from parallel arrays, in the catalog format [seed, cumulative, value, c3, c4].
  function pool(rows, w) { let cum = 0; return { total: TOTAL, entries: rows.map((r, i) => (cum += w[i], [r[0], cum, r[2], r[3], r[4]])) }; }
  function rowsOf(p) { let prev = 0; return p.entries.map((e) => { const w = e[1] - prev; prev = e[1]; return { e, w }; }); }
  // Tilt a pool w * (1 + v)^-theta (v in bets) to an exact average.
  function tilt(p, target) {
    const rows = rowsOf(p), ev = (theta) => { let W = 0, V = 0; for (const { e, w } of rows) { const x = w * Math.pow(1 + e[2] / 100, -theta); W += x; V += x * e[2]; } return V / W; };
    let lo = -3, hi = 3; for (let k = 0; k < 80; k++) { const mid = (lo + hi) / 2; if (ev(mid) > target) lo = mid; else hi = mid; }
    const shares = rows.map(({ e, w }) => w * Math.pow(1 + e[2] / 100, -lo));
    const w = exactAverage(rows.map(({ e }) => e[2]), integerWeights(shares), target);
    return { pool: pool(rows.map(({ e }) => e), w), theta: lo };
  }
  const mean = (p) => { let prev = 0, s = 0; for (const e of p.entries) { s += (e[1] - prev) * e[2]; prev = e[1]; } return s / p.total; };
  const distMean = (d) => [...d].reduce((a, [v, q]) => a + v * q, 0);

  // ---- Hidden: 1,000x or more, averaging exactly 2,256x ----------------------
  const HIDDEN_FLOOR = 100000, HIDDEN_MEAN = 225600;
  const kept = { total: 0, entries: [] }; let cum = 0;
  for (const { e, w } of rowsOf(data.pools.hidden)) if (e[2] >= HIDDEN_FLOOR) kept.entries.push([e[0], (cum += w), e[2], e[3], e[4]]);
  kept.total = cum;
  const hidden = tilt(kept, HIDDEN_MEAN);
  console.log(`hidden: ${hidden.pool.entries.length} of ${data.pools.hidden.entries.length} outcomes kept (>= ${HIDDEN_FLOOR / 100}x), average ${(mean(kept) / 100).toFixed(2)}x -> ${(mean(hidden.pool) / 100).toFixed(2)}x (theta ${hidden.theta.toFixed(4)})`);

  // ---- Base and enhanced: exactly 96% with the new Hidden --------------------
  const pools = { ...data.pools, hidden: hidden.pool };
  const natural = Object.fromEntries(Object.keys(TIERS).map((t) => [t, sumCapped(poolDist(pools[t]), poolDist(pools[`entry_${t}`]))]));
  const bonusMean = Object.entries(TIERS).reduce((a, [t, p]) => a + p * distMean(natural[t]), 0);
  for (const kind of ['base', 'enhanced']) {
    const cost = SPIN_MODES[kind].cost * 100, target = (0.96 * cost - ENTRY[kind] * bonusMean) / (1 - ENTRY[kind]);
    const before = mean(pools[kind]), t = tilt(pools[kind], target); pools[kind] = t.pool;
    console.log(`${kind}: no-bonus spins average ${(before / 100).toFixed(4)}x -> ${(target / 100).toFixed(4)}x (theta ${t.theta.toFixed(4)}) for 96% at ${cost / 100}x`);
  }
  const mysteryMean = Object.entries(MYSTERY).reduce((a, [t, p]) => a + p * mean(pools[t]), 0);
  console.log(`mystery: average ${(mysteryMean / 100).toFixed(2)}x at ${BONUS_BUYS.buy_mystery.cost}x = ${(mysteryMean / BONUS_BUYS.buy_mystery.cost).toFixed(4)}%`);

  // ---- Second Life ---------------------------------------------------------
  const N = Number(arg('--seeds', 2e6)), T = 4, per = Math.ceil(N / T), t0 = Date.now();
  const parts = await Promise.all(Array.from({ length: T }, (_, k) => new Promise((ok, bad) => { const w = new Worker(fileURLToPath(import.meta.url), { workerData: { from: 1 + k * per, to: 1 + Math.min(N, (k + 1) * per) } }); w.once('message', ok); w.once('error', bad); })));
  const rounds = []; for (const p of parts) for (let k = 0; k < p.length; k += 5) rounds.push([p[k], 0, p[k + 1], p[k + 2], p[k + 3], p[k + 4]]);
  console.log(`second life: ${rounds.length} rounds played in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  // Two mixes are held exactly: the starting zombies (FEATURE_SPIN.startZombies)
  // and the respins: no heart 78%, one heart 20%, two or more 2% (the v125
  // feature gave a respin 22% of the time). Within them payouts are tilted,
  // w ~ natural * (1 + win)^-theta, wins under 1x bet damped, with theta set
  // so the feature returns exactly 96%. The two mixes are fitted together by
  // iterative proportional fitting.
  const SMALL = 0.1, starts = FEATURE_SPIN.startZombies, HEARTS = [[0, 0.78], [1, 0.2], [2, 0.02]];
  const heartClass = (h) => Math.min(2, h), cellOf = (r) => `${r[5]}:${heartClass(r[3])}`;
  const shape = (v, theta) => Math.pow(1 + v / 100, -theta) * (v > 0 && v < 100 ? SMALL : 1);
  function fitMix(theta) {
    // Per cell (start x heart class): tilted mass and payout.
    const cells = new Map();
    for (const r of rounds) { const k = cellOf(r), x = shape(r[2], theta), c = cells.get(k) ?? { mass: 0, pay: 0 }; c.mass += x; c.pay += x * r[2]; cells.set(k, c); }
    const A = new Map(starts.map(([z]) => [z, 1])), B = new Map(HEARTS.map(([h]) => [h, 1]));
    for (let it = 0; it < 200; it++) {
      for (const [z, share] of starts) { let m = 0; for (const [h] of HEARTS) m += (cells.get(`${z}:${h}`)?.mass ?? 0) * A.get(z) * B.get(h); A.set(z, A.get(z) * share / m); }
      for (const [h, share] of HEARTS) { let m = 0; for (const [z] of starts) m += (cells.get(`${z}:${h}`)?.mass ?? 0) * A.get(z) * B.get(h); B.set(h, B.get(h) * share / m); }
    }
    let mean = 0; for (const [k, c] of cells) { const [z, h] = k.split(':').map(Number); mean += c.pay * A.get(z) * B.get(h); }
    return { A, B, mean };
  }
  let lo = 0, hi = 5; for (let k = 0; k < 60; k++) { const mid = (lo + hi) / 2; if (fitMix(mid).mean > 0.96 * FEATURE_SPIN.cost * 100) lo = mid; else hi = mid; }
  const theta = lo, { A, B } = fitMix(theta), factor = (r) => shape(r[2], theta) * A.get(r[5]) * B.get(heartClass(r[3]));
  // A catalog: per cell and payout band, up to PER rounds (in seed order), each
  // carrying its own share of the band's probability.
  const PER = 220, edges = [0, 1, 50, 100, 150, 200, 300, 400, 500, 700, 1000, 1500, 2000, 3000, 4000, 5000, 7000, 10000, 15000, 20000, 30000, 50000, 100000, 250000, Infinity];
  const byCell = new Map();
  for (const r of rounds) { const k = cellOf(r); if (!byCell.has(k)) byCell.set(k, []); byCell.get(k).push(r); }
  const cells = [...byCell.keys()], cellMass = new Map(cells.map((k) => [k, byCell.get(k).reduce((a, r) => a + factor(r), 0)]));
  const allMass = [...cellMass.values()].reduce((a, x) => a + x, 0);
  // Whole tickets per cell with both mixes exact: floors, then the remainders
  // where both the row (start) and the column (hearts) still need them.
  const rowNeed = new Map(starts.map(([z, share]) => [z, Math.round(share * TOTAL)])), colNeed = new Map(HEARTS.map(([h, share]) => [h, Math.round(share * TOTAL)]));
  const cellTotal = new Map(), frac = [];
  for (const k of cells) { const [z, h] = k.split(':').map(Number), x = cellMass.get(k) / allMass * TOTAL, f = Math.floor(x); cellTotal.set(k, f); rowNeed.set(z, rowNeed.get(z) - f); colNeed.set(h, colNeed.get(h) - f); frac.push([x - f, k]); }
  frac.sort((a, b) => b[0] - a[0]);
  for (let pass = 0; pass < 10 && [...rowNeed.values()].some((x) => x); pass++) for (const [, k] of frac) { const [z, h] = k.split(':').map(Number); if (rowNeed.get(z) > 0 && colNeed.get(h) > 0) { cellTotal.set(k, cellTotal.get(k) + 1); rowNeed.set(z, rowNeed.get(z) - 1); colNeed.set(h, colNeed.get(h) - 1); } }
  if ([...rowNeed.values(), ...colNeed.values()].some((x) => x)) throw Error('Cannot round the mixes to whole tickets');
  const chosen = [];
  for (const k of cells) {
    const group = byCell.get(k), picks = [], shares = [];
    for (let b = 0; b < edges.length - 1; b++) {
      const band = group.filter((r) => r[2] >= edges[b] && r[2] < edges[b + 1]); if (!band.length) continue;
      const mass = band.reduce((a, r) => a + factor(r), 0), pick = band.slice(0, PER), local = pick.reduce((a, r) => a + factor(r), 0);
      for (const r of pick) { picks.push(r); shares.push(mass * factor(r) / local); }
    }
    const w = integerWeights(shares, cellTotal.get(k));
    picks.forEach((r, i) => { chosen.push({ r, k, w: w[i] }); });
  }
  // The exact average: ticket moves inside the biggest cell only, so both mixes stay exact.
  const goal = BigInt(Math.round(0.96 * FEATURE_SPIN.cost * 100 * TOTAL)), big = cells.reduce((a, k) => (cellTotal.get(k) > cellTotal.get(a) ? k : a));
  const inBig = chosen.filter((c) => c.k === big), others = chosen.filter((c) => c.k !== big).reduce((a, c) => a + BigInt(c.r[2]) * BigInt(c.w), 0n);
  const bigW = exactSum(inBig.map((c) => c.r[2]), inBig.map((c) => c.w), goal - others); inBig.forEach((c, i) => { c.w = bigW[i]; });
  chosen.sort((a, b) => a.r[0] - b.r[0]);
  const featurePool = pool(chosen.map((c) => [c.r[0], 0, c.r[2], c.r[3], c.r[4]]), chosen.map((c) => c.w));
  console.log(`second life: theta ${theta.toFixed(4)}, ${featurePool.entries.length} outcomes, average ${(mean(featurePool) / 100).toFixed(4)}x at ${FEATURE_SPIN.cost}x`);

  // ---- write ---------------------------------------------------------------
  // The feature catalog's source hash covers the code that replays it (as the
  // game's own tests check); the outcome catalog's covers this tool and config.
  const featureSource = ['math.js', 'config.js', 'paylines.js', 'feature-spin.js'].reduce((h, f) => h.update(readFileSync(new URL(f, RT))), createHash('sha256')).digest('hex');
  const toolHash = createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url))).update(readFileSync(new URL('config.js', RT))).digest('hex');
  writeFileSync(new URL('outcomes.js', RT), `// Rebalanced by tools/math/zombify-rebalance.mjs from the v125 catalogs (Hidden 1,000x+, base/enhanced at 96%).\nexport default ${JSON.stringify({ version: 'zombify-96-v2', sourceHash: toolHash, pools })};\n`);
  writeFileSync(new URL('feature-outcomes.js', RT), `// Generated by tools/math/zombify-rebalance.mjs (Second Life with 2-4 zombies and heart joins).\nexport default ${JSON.stringify({ version: 'second-life-v3', sourceHash: featureSource, pool: featurePool })};\n`);
  console.log('wrote outcomes.js (zombify-96-v2) and feature-outcomes.js (second-life-v3)');
}
