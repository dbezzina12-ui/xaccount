#!/usr/bin/env node
// Dead Letter Depot (reels): calibrate the prototype math to 96% by cost.
//   node tools/math/dead-letter-depot-fit.mjs [--bonus 3e5] [--spins 6e6] [--spins-only] [--write]
//
// 1. Each bonus's stamp chance is solved for its target average: Night Shift
//    and Double Post for their buy prices at 96%, Lost & Found for whatever
//    average makes Mystery Delivery 96% at its price with the MYSTERY chances.
// 2. Each spin mode's FS chance is solved so the mode returns 96% of its
//    cost: its own pay plus its trigger rates times those bonus averages.
// Both use regula falsi on fixed seeds (common random numbers), so each curve
// is smooth in its knob. --write rewrites those chances in engine/rules.js.
import { readFileSync, writeFileSync } from 'node:fs';
import { LAND, MODES, MYSTERY, RTP_TARGET, BONUSES } from '../../games/dead-letter-depot/engine/rules.js';
import { run } from './dead-letter-depot-sim.mjs';

const RTP = RTP_TARGET;
const arg = (k, d) => (process.argv.includes(k) ? Number(process.argv[process.argv.indexOf(k) + 1]) : d);
const round6 = (x) => Math.round(x * 1e6) / 1e6;

async function solve(g, lo, hi, label, tol) {
  // works for a rising or a falling curve
  let flo = await g(lo), fhi = await g(hi), x = lo;
  const sign = flo <= 0 ? 1 : -1, f = async (v) => sign * (await g(v));
  flo *= sign; fhi *= sign;
  if (flo > 0 || fhi < 0) throw Error(`${label}: no root between ${lo} (${sign * flo}) and ${hi} (${sign * fhi})`);
  for (let i = 0; i < 14; i++) {
    x = (lo * fhi - hi * flo) / (fhi - flo);
    const fx = await f(x);
    if (Math.abs(fx) < tol) break;
    if (fx > 0) { hi = x; fhi = fx; flo /= 2; } else { lo = x; flo = fx; fhi /= 2; } // Illinois step
  }
  return round6(x);
}

export function targets() {
  const price = (tier) => Object.values(MODES).find((m) => m.bonus === tier).cost;
  const t = { regular: RTP * price('regular'), super: RTP * price('super') };
  t.hidden = (RTP * MODES.mystery.cost - MYSTERY.regular * t.regular - MYSTERY.super * t.super) / MYSTERY.hidden;
  return t;
}

export async function fit({ bonusN = 4e5, spinN = 6e6, seed = 777, spinsOnly = false, save = null } = {}) {
  const t = targets(), patch = {}, means = {};
  const range = { regular: [0.0005, 0.04], super: [0.0005, 0.05], hidden: [0.0005, 0.04] };
  for (const tier of Object.keys(BONUSES)) {
    if (!spinsOnly) {
      const f = async (stamp) => (await run({ job: 'bonus', tier, n: bonusN, seed, patch: { [tier]: { stamp } } })).mean - t[tier];
      patch[tier] = { stamp: await solve(f, ...range[tier], tier, 0.001 * t[tier]) };
    } else patch[tier] = { stamp: LAND[tier].stamp };
    means[tier] = (await run({ job: 'bonus', tier, n: bonusN, seed, patch })).mean;
    if (save) save({ [tier]: patch[tier] });
  }
  for (const [mode, m] of Object.entries(MODES)) {
    if (m.kind !== 'spin') continue;
    const f = async (fs) => {
      const s = await run({ job: 'spins', mode, n: spinN, seed, patch: { ...patch, [m.land]: { fs } } });
      return (s.mean + Object.entries(s.trig).reduce((a, [tier, r]) => a + r * means[tier], 0)) / m.cost - RTP;
    };
    patch[m.land] = { fs: await solve(f, 0.002, 0.08, mode, 0.0005) };
    if (save) save({ [m.land]: patch[m.land] });
  }
  return { targets: t, patch, means };
}

export function write(patch) {
  const path = new URL('../../games/dead-letter-depot/engine/rules.js', import.meta.url);
  let src = readFileSync(path, 'utf8');
  for (const [kind, p] of Object.entries(patch)) {
    const re = new RegExp(`(  ${kind}: Object\\.freeze\\(\\{ pays: \\w+, fs: )([0-9.]+)(, stamp: )([0-9.]+)( \\}\\),)`);
    if (!re.test(src)) throw Error(`Could not find the ${kind} landing in rules.js`);
    src = src.replace(re, (_, a, fs, b, stamp, c) => `${a}${p.fs ?? fs}${b}${p.stamp ?? stamp}${c}`);
  }
  writeFileSync(path, src);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const t0 = Date.now();
  const r = await fit({ bonusN: arg('--bonus', 4e5), spinN: arg('--spins', 6e6), spinsOnly: process.argv.includes('--spins-only'), save: process.argv.includes('--write') ? write : null });
  for (const tier of Object.keys(BONUSES)) console.log(`${BONUSES[tier].title.padEnd(14)} target ${r.targets[tier].toFixed(2)}x · stamp chance ${r.patch[tier].stamp} (was ${LAND[tier].stamp}) · fitted average ${r.means[tier].toFixed(2)}x`);
  for (const [mode, m] of Object.entries(MODES)) if (m.kind === 'spin') console.log(`${m.title.padEnd(16)} FS chance ${r.patch[m.land].fs} (was ${LAND[m.land].fs})`);
  console.log(`${((Date.now() - t0) / 1000).toFixed(0)} s`);
  if (process.argv.includes('--write')) console.log('wrote games/dead-letter-depot/engine/rules.js as each knob solved');
}
