#!/usr/bin/env node
// Finds more bonus seeds that reach the 25,000x cap, so the catalogs' max-win
// entries are many different rounds rather than a few repeated ones. Plays
// seeds past the pool's range (--from) through the engine on every core.
//
//   node tools/math/cyber-skunk-caps.mjs --tier super --from 2000001 --count 2e7 --out DIR
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { cpus } from 'node:os';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ENGINE = new URL('../../games/cyber-skunk/runtime/engine.js', import.meta.url).href;
if (!isMainThread) {
  const { playRound, seeded } = await import(ENGINE);
  const { CAP } = await import(new URL('../../games/cyber-skunk/runtime/rules.js', import.meta.url).href);
  const { tier, from, to } = workerData, found = [];
  for (let seed = from; seed < to; seed++) if (playRound({ rng: seeded(seed), forceBonus: tier }).total >= CAP) found.push(seed);
  parentPort.postMessage(found);
} else {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const tier = arg('--tier', 'super'), from = Number(arg('--from', 2000001)), count = Number(arg('--count', 2e7)), out = arg('--out');
  const T = cpus().length, per = Math.ceil(count / T), t0 = Date.now();
  const parts = await Promise.all(Array.from({ length: T }, (_, k) => new Promise((ok, bad) => { const w = new Worker(fileURLToPath(import.meta.url), { workerData: { tier, from: from + k * per, to: from + Math.min(count, (k + 1) * per) } }); w.once('message', ok); w.once('error', bad); })));
  const seeds = parts.flat().sort((a, b) => a - b);
  writeFileSync(`${out}/caps-${tier}.json`, JSON.stringify(seeds));
  console.log(`${tier}: ${seeds.length} capped bonuses in ${count.toLocaleString('en-US')} seeds from ${from} (1 in ${Math.round(count / Math.max(1, seeds.length)).toLocaleString('en-US')}), ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
