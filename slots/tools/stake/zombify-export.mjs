#!/usr/bin/env node
// Zombify for Stake Engine: the math files Engine publishes (Dylan, 2026-10-29).
//
// One bet mode per way to play. Each mode is a lookup table (CSV rows of id,
// weight, payoutMultiplier, all uint64) and a books file (one JSON line per
// outcome, zstd-compressed) whose single event is the recipe the game replays
// (runtime/outcome-model.js roundFromBook). Rows and books match by position.
//
// - Outbreak, Super, Mystery and Second Life use the catalogs' own outcomes
//   and weights (Mystery: 9 x Super + 1 x Hidden).
// - Base and enhanced spins are the no-bonus outcomes plus natural bonuses:
//   every bonus outcome paired with one trigger spin, the trigger spins shared
//   out evenly. That pairing differs a little from the free-play game's free
//   pairing, so the no-bonus weights are moved ticket by ticket until the mode
//   returns exactly 96%.
//
// Every book is replayed through roundFromBook and must pay its
// payoutMultiplier; every mode must return exactly 96%; and the checks
// Engine runs on upload (Stake's math-sdk utils/rgs_verification.py) run here:
// whole uint64 weights and payouts, payouts in steps of 10 (0.1x), books and
// table in the same order with the same payouts.
//
//   node tools/stake/zombify-export.mjs [--out dist/stake/zombify/math]

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { zstdCompressSync, zstdDecompressSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const RT = new URL('../../games/zombify/runtime/', import.meta.url);

if (!isMainThread) {
  // Replay a slice of one mode's books; report the first few mismatches.
  const { roundFromBook } = await import(new URL('outcome-model.js', RT));
  const { kind, books } = workerData, bad = [];
  for (const book of books) {
    try { roundFromBook(kind, book); } catch (error) { if (bad.length < 5) bad.push({ id: book.id, error: error.message }); }
  }
  parentPort.postMessage(bad);
} else {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const OUT = resolve(arg('--out', fileURLToPath(new URL('../../dist/stake/zombify/math/', import.meta.url))));
  const { STAKE_MODES } = await import(new URL('stake.js', RT));
  const { BONUS_FEATURES } = await import(new URL('config.js', RT));
  const { CAP, seeded } = await import(new URL('math.js', RT));
  const { loadCatalogs, TIERS, ENTRY, MYSTERY } = await import('../math/zombify.js');
  const { data, feature } = await loadCatalogs();

  const rowsOf = (pool) => { let prev = 0; return pool.entries.map((e) => { const w = e[1] - prev; prev = e[1]; return { e, w }; }); };
  const bonusEvent = (tier, e) => ({ type: 'bonus', tier, seed: e[0], clustered: e[4] ? 1 : 0 });

  // Moves whole tickets between rows (values v, weights w as Numbers, the
  // total kept) until sum(w*v) === goal; only rows in `movable` change.
  function exactSum(rows, movable, goal) {
    let have = rows.reduce((a, r) => a + BigInt(r.v) * BigInt(r.w), 0n);
    const byValue = new Map(); for (const i of movable) { const v = rows[i].v; if (!byValue.has(v)) byValue.set(v, []); byValue.get(v).push(i); }
    const sorted = [...byValue.keys()].sort((a, b) => a - b), spare = (v) => byValue.get(v).find((i) => rows[i].w > 1);
    for (let guard = 0; have !== goal; guard++) {
      if (guard > 1e6) throw Error('Cannot reach the exact return');
      const up = goal > have, need = up ? goal - have : have - goal;
      // Bulk: lowest <-> highest value, as far as it goes without overshooting.
      const lo = sorted[0], hi = sorted.at(-1), span = BigInt(hi - lo), from = spare(up ? lo : hi);
      if (from !== undefined && need >= span) {
        const k = need / span < BigInt(rows[from].w - 1) ? need / span : BigInt(rows[from].w - 1);
        rows[from].w -= Number(k); rows[byValue.get(up ? hi : lo)[0]].w += Number(k); have += (up ? 1n : -1n) * k * span; continue;
      }
      // Fine: one ticket between two values exactly `need` apart, else the largest step under it.
      let best = null;
      for (const a of sorted) for (let j = sorted.length - 1; j >= 0 && sorted[j] > a; j--) {
        const d = BigInt(sorted[j] - a); if (d > need) continue;
        if (up ? spare(a) === undefined : spare(sorted[j]) === undefined) continue;
        if (!best || d > best[2]) best = [a, sorted[j], d];
        break;
      }
      if (!best) throw Error('Cannot reach the exact return');
      const [a, b, d] = best; rows[spare(up ? a : b)].w--; rows[byValue.get(up ? b : a)[0]].w++; have += up ? d : -d;
    }
  }

  // Base and enhanced: N-1 parts no bonus (x100 so tiers 90/9/1 stay whole), 1 part bonus.
  function spinMode(kind) {
    const N = Math.round(1 / ENTRY[kind]), rows = [], movable = [];
    for (const { e, w } of rowsOf(data.pools[kind])) { movable.push(rows.length); rows.push({ w: (N - 1) * 100 * w, v: e[2], event: { type: 'spin', seed: e[0], scatters: e[3] } }); }
    for (const [tier, share] of Object.entries(TIERS)) {
      const triggers = data.pools[`entry_${tier}`].entries;
      if (rowsOf(data.pools[`entry_${tier}`]).some(({ w }) => w !== 1)) throw Error('Trigger spins are expected to be equally likely');
      // Trigger spins dealt out in shuffled rounds, so each is used equally often.
      const rng = seeded(tier.length * 7919 + N), deck = [];
      const draw = () => { if (!deck.length) { deck.push(...triggers.keys()); for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; } } return triggers[deck.pop()]; };
      for (const { e, w } of rowsOf(data.pools[tier])) {
        const t = draw();
        rows.push({ w: Math.round(share * 100) * w, v: Math.min(CAP, e[2] + t[2]), event: { type: 'spin', tier, trigger: t[0], bonus: e[0], clustered: e[4] ? 1 : 0 } });
      }
    }
    return { rows, movable };
  }

  const modes = [];
  for (const mode of STAKE_MODES) {
    let rows, movable = null;
    if (mode.kind === 'base' || mode.kind === 'enhanced') ({ rows, movable } = spinMode(mode.kind));
    else if (mode.kind === 'buy_feature') rows = rowsOf(feature.pool).map(({ e, w }) => ({ w, v: e[2], event: { type: 'secondLife', seed: e[0], hearts: e[3], spins: e[4] } }));
    else if (mode.kind === 'buy_mystery') rows = Object.entries(MYSTERY).flatMap(([tier, p]) => rowsOf(data.pools[tier]).map(({ e, w }) => ({ w: Math.round(p * 10) * w, v: e[2], event: bonusEvent(tier, e) })));
    else { const tier = BONUS_FEATURES[{ buy_outbreak: 'regular', buy_super: 'super' }[mode.kind]].tier; rows = rowsOf(data.pools[tier]).map(({ e, w }) => ({ w, v: e[2], event: bonusEvent(tier, e) })); }
    // Exactly 96%: sum(w*v) / (sum(w) * cost * 100) = 96 / 100.
    const W = rows.reduce((a, r) => a + BigInt(r.w), 0n), costUnits = BigInt(Math.round(mode.cost * 100)), goal = (96n * W * costUnits) / 100n;
    if ((96n * W * costUnits) % 100n) throw Error(`${mode.name}: 96% is not a whole sum`);
    if (movable) exactSum(rows, movable, goal);
    const sum = rows.reduce((a, r) => a + BigInt(r.v) * BigInt(r.w), 0n);
    if (sum !== goal) throw Error(`${mode.name}: returns ${Number(sum) / Number(W) / Number(costUnits)}, not exactly 96%`);
    modes.push({ ...mode, rows, W });
  }

  // Every book replayed by the game's own code, four workers at a time.
  const t0 = Date.now(), jobs = [];
  for (const m of modes) for (let i = 0; i < m.rows.length; i += 6000) jobs.push({ kind: m.kind, name: m.name, books: m.rows.slice(i, i + 6000).map((r, k) => ({ id: i + k + 1, events: [r.event], payoutMultiplier: r.v })) });
  const run = (job) => new Promise((ok, bad) => { const w = new Worker(fileURLToPath(import.meta.url), { workerData: { kind: job.kind, books: job.books } }); w.once('message', ok); w.once('error', bad); });
  const mismatches = [];
  for (let next = 0; next < jobs.length; ) { const slice = jobs.slice(next, (next += 4)); (await Promise.all(slice.map(run))).forEach((bad, i) => bad.forEach((b) => mismatches.push({ mode: slice[i].name, ...b }))); }
  if (mismatches.length) { console.error(mismatches.slice(0, 10)); throw Error(`${mismatches.length} books do not replay to their payout`); }
  console.log(`replayed ${modes.reduce((n, m) => n + m.rows.length, 0).toLocaleString('en-US')} books through roundFromBook: 0 mismatches (${((Date.now() - t0) / 1000).toFixed(0)}s)`);

  // Stake's "3-star" volatility figures (math-sdk utils/analysis/distribution_functions.py,
  // get_etl_cvar_p5k_10k_vales) beside the limits its verification warns above.
  // They rate volatility; they do not block an upload.
  function volatility(lut, W, cost) {
    const dist = new Map(); for (const [, w, v] of lut) dist.set(Number(v) / 100, (dist.get(Number(v) / 100) ?? 0) + Number(w) / W);
    const scale = cost >= 1000 ? 0.2 : cost >= 500 ? 0.5 : cost >= 200 ? 0.8 : 1, ordered = [...dist].sort((a, b) => a[0] - b[0]);
    let p5k = 0, p10k = 0, etl10k = 0, etl40b = 0, acc = 0, tail = ordered[0][0];
    for (const [win, p] of ordered) { if (win >= 10000) { p10k += p; etl10k += win * p; } if (win >= 5000) p5k += p; if (win >= 40 * cost) etl40b += win * p; }
    for (const [win, p] of ordered) { acc += p; if (acc >= 0.999) { tail = win; break; } }
    let tp = 0, tv = 0; for (const [win, p] of ordered) if (win >= tail) { tp += p; tv += win * p; }
    const figures = { prob5k: p5k * scale, prob10k: p10k * scale, etl40b, etl10k, cvar: tv / tp / cost }, limits = { prob5k: 1e-2, prob10k: 0.5e-2, etl40b: 0.9, etl10k: 0.8, cvar: 800 };
    return { ...Object.fromEntries(Object.entries(figures).map(([k, v]) => [k, Number(v.toPrecision(4))])), over3Star: Object.keys(limits).filter((k) => figures[k] > limits[k]) };
  }

  // Write, then read back and check as Engine does.
  mkdirSync(OUT, { recursive: true });
  const index = { modes: modes.map((m) => ({ name: m.name, cost: m.cost, events: `books_${m.name}.jsonl.zst`, weights: `lookUpTable_${m.name}_0.csv` })) };
  writeFileSync(resolve(OUT, 'index.json'), JSON.stringify(index, null, 2) + '\n');
  const summary = { generated: new Date().toISOString(), cap: CAP / 100, modes: {} };
  for (const m of modes) {
    const csv = m.rows.map((r, i) => `${i + 1},${r.w},${r.v}`).join('\n') + '\n';
    const books = m.rows.map((r, i) => JSON.stringify({ id: i + 1, events: [r.event], payoutMultiplier: r.v })).join('\n') + '\n';
    writeFileSync(resolve(OUT, `lookUpTable_${m.name}_0.csv`), csv);
    writeFileSync(resolve(OUT, `books_${m.name}.jsonl.zst`), zstdCompressSync(Buffer.from(books)));

    const lut = readFileSync(resolve(OUT, `lookUpTable_${m.name}_0.csv`), 'utf8').trim().split('\n').map((line) => line.split(',').map(BigInt));
    const back = zstdDecompressSync(readFileSync(resolve(OUT, `books_${m.name}.jsonl.zst`))).toString('utf8').trim().split('\n').map((l) => JSON.parse(l));
    if (lut.length !== back.length) throw Error(`${m.name}: table and books differ in length`);
    let W = 0n, S = 0n, hits = 0n, capped = 0n, max = 0n;
    lut.forEach(([id, w, v], i) => {
      const b = back[i];
      if (!('id' in b && 'events' in b && 'payoutMultiplier' in b)) throw Error(`${m.name}: book ${i + 1} lacks a required key`);
      if (BigInt(b.payoutMultiplier) !== v || BigInt(b.id) !== id) throw Error(`${m.name}: row ${i + 1} differs from its book`);
      if (w < 0n || v < 0n || v % 10n || (v > 0n && v < 10n)) throw Error(`${m.name}: row ${i + 1} breaks Engine's format`);
      W += w; S += w * v; if (v > 0n) hits += w; if (v >= BigInt(CAP)) capped += w; if (v > max) max = v;
    });
    if (W > 2n ** 64n - 1n) throw Error(`${m.name}: weights overflow uint64`);
    const costUnits = BigInt(Math.round(m.cost * 100));
    if (S * 100n !== 96n * W * costUnits) throw Error(`${m.name}: not exactly 96% after writing`);
    summary.modes[m.name] = { kind: m.kind, cost: m.cost, outcomes: lut.length, rtp: Number((S * 1000000n) / (W * costUnits)) / 1e6, hitRate: Number((hits * 1000000n) / W) / 1e6, maxWin: Number(max) / 100, maxWinOneIn: capped ? Math.round(Number(W) / Number(capped)) : null, volatility: volatility(lut, Number(W), m.cost) };
    console.log(`${m.name.padEnd(10)} cost ${String(m.cost).padEnd(4)} ${String(lut.length).padStart(7)} outcomes  RTP ${(summary.modes[m.name].rtp * 100).toFixed(4)}%  hit ${(summary.modes[m.name].hitRate * 100).toFixed(2)}%  max ${summary.modes[m.name].maxWin}x${capped ? ` (1 in ${summary.modes[m.name].maxWinOneIn.toLocaleString('en-US')})` : ''}${summary.modes[m.name].volatility.over3Star.length ? `  above 3-star: ${summary.modes[m.name].volatility.over3Star.join(', ')}` : ''}`);
  }
  writeFileSync(new URL('../../games/zombify/math/stake-summary.json', import.meta.url), JSON.stringify(summary, null, 1) + '\n');
  console.log(`wrote ${OUT}`);
}
