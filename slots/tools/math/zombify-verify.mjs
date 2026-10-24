#!/usr/bin/env node
// Checks Zombify's catalogs against the real engine, without changing either.
//
// 1. Replays every catalog entry through games/zombify/runtime and confirms the
//    engine pays exactly what the catalog says (bonus tables through every buy
//    path that uses them; Second Life entries with their hearts and spins).
// 2. Natural bonuses (trigger spin + bonus): every trigger entry, paired with a
//    deterministic sample of bonus entries, through base and enhanced spins.
// 3. Plays rounds through the real session (createSession().begin/finish, the
//    path the game uses) and compares sample RTP and hit rate with the exact math.
//
//   node tools/math/zombify-verify.mjs [--rounds 2000000]   writes games/zombify/math/verify.json

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { writeFileSync, mkdirSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';

const runtime = (f) => new URL(`../../games/zombify/runtime/${f}`, import.meta.url).href;

if (!isMainThread) {
  const { makeRound, seeded, CAP } = await import(runtime('math.js'));
  const { makeFeatureRound } = await import(runtime('feature-spin.js'));
  const { BONUS_FEATURES } = await import(runtime('config.js'));
  const { createSession } = await import(runtime('session.js'));
  const { data, feature } = await (await import('./zombify.js')).loadCatalogs();
  const out = [];
  for (const job of workerData.jobs) {
    let checked = 0;
    const bad = [];
    const fail = (what) => bad.length < 5 && bad.push(what);
    if (job.type === 'pool') {
      const entries = job.pool === 'feature' ? feature.pool.entries : data.pools[job.pool].entries;
      for (let i = job.from; i < job.to; i++) {
        const e = entries[i];
        if (job.pool === 'feature') {
          const r = makeFeatureRound({ rng: seeded(e[0]) });
          if (r.total !== e[2] || r.hearts !== e[3] || r.spins !== e[4]) fail({ seed: e[0], want: e.slice(2), got: [r.total, r.hearts, r.spins] });
        } else {
          const r = job.tier
            ? makeRound({ kind: job.kind, rng: seeded(e[0]), forcedTier: job.tier, clustered: !!e[4] })
            : makeRound({ kind: job.kind, rng: seeded(e[0]), forcedScatters: e[3], baseOnly: true });
          if (r.total !== e[2]) fail({ seed: e[0], want: e[2], got: r.total });
        }
        checked++;
      }
    } else if (job.type === 'natural') {
      const triggers = data.pools[`entry_${job.tier}`].entries, bonuses = data.pools[job.tier].entries;
      const pick = seeded(job.salt);
      for (let i = job.from; i < job.to; i++) {
        const t = triggers[i], b = bonuses[Math.floor(pick() * bonuses.length)];
        const r = makeRound({ kind: job.kind, rng: seeded(t[0]), forcedScatters: BONUS_FEATURES[job.tier].scatters, bonusRng: seeded(b[0]), clustered: !!b[4] });
        if (r.total !== Math.min(CAP, b[2] + t[2])) fail({ trigger: t[0], bonus: b[0], want: Math.min(CAP, b[2] + t[2]), got: r.total });
        checked++;
      }
    } else if (job.type === 'session') {
      // The real round path: ticket draws, catalog lookup, replay, validation, crediting.
      const s = createSession(), rng = seeded(job.salt);
      let sum = 0, sq = 0, hits = 0, bonuses = 0, errors = 0;
      for (let i = 0; i < job.rounds; i++) {
        s.reset();
        try {
          const round = s.begin(job.kind, rng), v = round.result.total;
          sum += v; sq += v * v; if (v > 0) hits++; if (round.result.bonus) bonuses++;
          s.finish(round);
        } catch (error) { errors++; fail(error.message); }
      }
      out.push({ ...job, sum, sq, hits, bonuses, errors, bad });
      continue;
    }
    out.push({ ...job, checked, bad });
  }
  parentPort.postMessage(out);
} else {
  const arg = (name, d) => { const i = process.argv.indexOf(name); return i > 0 ? Number(process.argv[i + 1]) : d; };
  const baseRounds = arg('--rounds', 2_000_000);
  const z = await import('./zombify.js');
  const catalogs = await z.loadCatalogs();
  const { data, feature } = catalogs;
  const exact = Object.fromEntries(z.modes(catalogs).map((m) => [m.kind, { cost: m.cost, ...z.stats(m) }]));
  const jobs = [];
  const chunk = (base, n, size) => { for (let from = 0; from < n; from += size) jobs.push({ ...base, from, to: Math.min(n, from + size) }); };
  for (const kind of ['base', 'enhanced']) chunk({ type: 'pool', pool: kind, kind }, data.pools[kind].entries.length, 4000);
  const uses = { regular: ['buy_outbreak', 'buy_mystery'], super: ['buy_super', 'buy_mystery'], hidden: ['buy_mystery'] };
  for (const [tier, kinds] of Object.entries(uses)) for (const kind of kinds) chunk({ type: 'pool', pool: tier, tier, kind }, data.pools[tier].entries.length, 2000);
  chunk({ type: 'pool', pool: 'feature' }, feature.pool.entries.length, 4000);
  for (const tier of Object.keys(uses)) for (const kind of ['base', 'enhanced']) chunk({ type: 'natural', tier, kind, salt: tier.length * 7919 + kind.length }, data.pools[`entry_${tier}`].entries.length, 500);
  const plan = { base: baseRounds, enhanced: Math.round(baseRounds / 4), buy_outbreak: 40000, buy_super: 40000, buy_mystery: 40000, buy_feature: 400000 };
  const slices = 8;
  for (const [kind, rounds] of Object.entries(plan)) for (let k = 0; k < slices; k++) jobs.push({ type: 'session', kind, rounds: Math.ceil(rounds / slices), salt: 1000003 * (k + 1) + kind.length });
  // Spread the expensive bonus replays evenly across workers.
  const lanes = Math.max(1, Math.min(availableParallelism(), 8));
  const queues = Array.from({ length: lanes }, () => []);
  jobs.forEach((job, i) => queues[i % lanes].push(job));
  const t0 = Date.now();
  const results = (await Promise.all(queues.map((q) => new Promise((resolve, reject) => {
    const w = new Worker(fileURLToPath(import.meta.url), { workerData: { jobs: q } });
    w.once('message', resolve); w.once('error', reject);
  })))).flat();
  const replay = {};
  for (const r of results.filter((r) => r.type !== 'session')) {
    const key = r.type === 'natural' ? `natural ${r.tier} (${r.kind})` : r.pool === 'feature' ? 'Second Life' : r.tier ? `${r.tier} via ${r.kind}` : `${r.pool} spins`;
    const row = (replay[key] ??= { checked: 0, mismatches: 0, examples: [] });
    row.checked += r.checked; row.mismatches += r.bad.length; row.examples.push(...r.bad.slice(0, 5 - row.examples.length));
  }
  const sessions = {};
  for (const r of results.filter((r) => r.type === 'session')) {
    const row = (sessions[r.kind] ??= { rounds: 0, sum: 0, sq: 0, hits: 0, bonuses: 0, errors: 0 });
    row.rounds += r.rounds; row.sum += r.sum; row.sq += r.sq; row.hits += r.hits; row.bonuses += r.bonuses; row.errors += r.errors;
  }
  for (const [kind, row] of Object.entries(sessions)) {
    const c = exact[kind].cost * 100, mean = row.sum / row.rounds, sd = Math.sqrt(Math.max(0, row.sq / row.rounds - mean * mean));
    Object.assign(row, { rtp: mean / c, ci95: (1.96 * sd) / Math.sqrt(row.rounds) / c, hitRate: row.hits / row.rounds, exactRtp: exact[kind].rtp, exactHit: exact[kind].hit });
    row.withinCi = Math.abs(row.rtp - row.exactRtp) <= row.ci95;
    delete row.sum; delete row.sq;
  }
  const report = {
    generated: new Date().toISOString(), seconds: Math.round((Date.now() - t0) / 1000), modelVersion: data.version, featureVersion: feature.version,
    sourceHash: data.sourceHash, featureSourceHash: feature.sourceHash, replay, sessions,
  };
  mkdirSync(new URL('../../games/zombify/math/', import.meta.url), { recursive: true });
  writeFileSync(new URL('../../games/zombify/math/verify.json', import.meta.url), JSON.stringify(report, null, 1) + '\n');
  const mism = Object.values(replay).reduce((n, r) => n + r.mismatches, 0), checked = Object.values(replay).reduce((n, r) => n + r.checked, 0);
  console.log(`Replayed ${checked.toLocaleString('en-US')} catalog outcomes: ${mism} mismatches. ${report.seconds}s.`);
  for (const [k, r] of Object.entries(sessions)) console.log(`${k.padEnd(13)} ${r.rounds.toLocaleString('en-US').padStart(10)} rounds  RTP ${(r.rtp * 100).toFixed(3)}% ± ${(r.ci95 * 100).toFixed(3)}% (exact ${(r.exactRtp * 100).toFixed(3)}%)  hit ${(r.hitRate * 100).toFixed(2)}% (exact ${(r.exactHit * 100).toFixed(2)}%)  errors ${r.errors}`);
  if (mism || Object.values(sessions).some((r) => r.errors)) process.exitCode = 1;
}
