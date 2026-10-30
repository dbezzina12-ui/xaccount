#!/usr/bin/env node
// Cyber Skunk outcome pools: plays seeded rounds through the game's own engine
// (games/cyber-skunk/runtime/engine.js) on every core and writes each pool's
// values (hundredths of the base bet, seed = index + 1) as Int32 binaries.
// cyber-skunk-catalogs.mjs builds the weighted catalogs from them.
//
// Pools:
//   bonus-<tier>         a bonus alone (playRound forceBonus): the buys and every natural trigger
//   spin-<mode>          a paid spin of base / enhanced / sprayjob; its scatter count rides in a
//                        second file, so spins that trigger can be left out of the no-bonus pool
//   entry-<mode>-<tier>  a trigger spin forced to 3 / 4 / 5 scatters (its own pay only)
//
//   node tools/math/cyber-skunk-pools.mjs --out DIR [--bonus 2e6] [--spins 4e6] [--entries 3e5] [--only NAME]
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { cpus } from 'node:os';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ENGINE = new URL('../../games/cyber-skunk/runtime/engine.js', import.meta.url).href;
export const TIERS = { regular: 3, super: 4, hidden: 5 };
export const SPIN_MODES = ['base', 'enhanced', 'sprayjob'];

if (!isMainThread) {
  const { playRound, seeded } = await import(ENGINE);
  const { kind, mode, tier, from, to } = workerData, n = to - from;
  const value = new Int32Array(n), extra = new Int8Array(n);
  for (let k = 0; k < n; k++) {
    const seed = from + k + 1;
    if (kind === 'bonus') value[k] = playRound({ rng: seeded(seed), forceBonus: tier }).total;
    else if (kind === 'spin') {
      const r = playRound({ mode, rng: seeded(seed), bonusRng: () => 0.5 });
      const first = r.events.find((e) => e.type === 'reveal'), win = r.events.find((e) => e.type === 'wins');
      value[k] = win.paid; extra[k] = first.scatters.length;
    } else {
      // The trigger spin's own pay; the bonus that follows comes from bonus-<tier>.
      const r = playRound({ mode, rng: seeded(seed), bonusRng: seeded(1), triggerScatters: TIERS[tier] });
      value[k] = r.events.find((e) => e.type === 'wins').paid;
    }
  }
  parentPort.postMessage({ value, extra }, [value.buffer, extra.buffer]);
} else {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const out = arg('--out'); if (!out) throw Error('--out DIR');
  mkdirSync(out, { recursive: true });
  const sizes = { bonus: Number(arg('--bonus', 2e6)), spin: Number(arg('--spins', 4e6)), entry: Number(arg('--entries', 3e5)) };
  const only = arg('--only'); let jobs = [
    ...Object.keys(TIERS).map((tier) => ({ name: `bonus-${tier}`, kind: 'bonus', tier })),
    ...SPIN_MODES.map((mode) => ({ name: `spin-${mode}`, kind: 'spin', mode })),
    ...SPIN_MODES.flatMap((mode) => Object.keys(TIERS).map((tier) => ({ name: `entry-${mode}-${tier}`, kind: 'entry', mode, tier }))),
  ];
  if (only) jobs = jobs.filter((j) => j.name === only);
  const T = cpus().length, run = (wd) => new Promise((ok, bad) => { const w = new Worker(fileURLToPath(import.meta.url), { workerData: wd }); w.once('message', ok); w.once('error', bad); });
  for (const job of jobs) {
    const n = sizes[job.kind], per = Math.ceil(n / T), t0 = Date.now();
    const parts = await Promise.all(Array.from({ length: T }, (_, k) => run({ ...job, from: k * per, to: Math.min(n, (k + 1) * per) })));
    const value = new Int32Array(n), extra = new Int8Array(n);
    let at = 0; for (const p of parts) { value.set(p.value, at); extra.set(p.extra, at); at += p.value.length; }
    writeFileSync(`${out}/${job.name}.i32`, Buffer.from(value.buffer));
    if (job.kind === 'spin') writeFileSync(`${out}/${job.name}.scatters.i8`, Buffer.from(extra.buffer));
    let sum = 0, max = 0; for (const v of value) { sum += v; if (v > max) max = v; }
    console.log(`${job.name.padEnd(24)} ${n.toLocaleString('en-US').padStart(10)} rounds  average ${(sum / n / 100).toFixed(3)}x  max ${(max / 100).toFixed(1)}x  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
}
