#!/usr/bin/env node
// Dead Letter Depot: calibrate the prototype math to 96% by cost, exactly.
//   node tools/math/dead-letter-depot-fit.mjs [--write]
//
// 1. Each bonus's average is linear in its start lift (the chance its bins
//    start one rung higher), so each lift is solved directly. Night Shift and
//    Double Dispatch are solved for their buy prices at 96%; Lost & Found for
//    whatever average makes Mystery Delivery 96% at its price with the
//    MYSTERY chances.
// 2. Each spin mode's FS chance per stage is then solved by bisection so the
//    mode returns 96% of its cost (its route, postage and price stay fixed).
// --write rewrites those numbers in games/dead-letter-depot/engine/rules.js.
import { readFileSync, writeFileSync } from 'node:fs';
import * as RULES from '../../games/dead-letter-depot/engine/rules.js';
import { bonusDistAt, mean, measure, triggerRates } from './dead-letter-depot-exact.mjs';

const RTP = RULES.TARGETS.rtp;
const round6 = (x) => Math.round(x * 1e6) / 1e6;

export function solveLift(tier, target, rules = RULES) {
  const top = rules.LADDER.length - 1;
  let prev = mean(bonusDistAt(tier, 0, rules));
  if (target < prev) throw Error(`${tier}: even start rung 0 averages ${(prev / 100).toFixed(1)}x, over the ${(target / 100).toFixed(1)}x target`);
  for (let start = 0; start < top; start++) {
    const next = mean(bonusDistAt(tier, start + 1, rules));
    if (target <= next) return { start, lift: round6((target - prev) / (next - prev)), lo: prev, hi: next };
    prev = next;
  }
  throw Error(`${tier}: the top rung cannot reach ${(target / 100).toFixed(1)}x`);
}

export function fit(rules = RULES) {
  const buy = (tier) => Object.values(rules.MODES).find((m) => m.bonus === tier);
  const targets = { regular: RTP * buy('regular').cost * 100, super: RTP * buy('super').cost * 100 };
  const w = rules.MYSTERY, mystery = rules.MODES.mystery.cost * 100 * RTP;
  targets.hidden = (mystery - w.regular * targets.regular - w.super * targets.super) / w.hidden;
  const bonuses = {}, solved = {};
  for (const tier of Object.keys(rules.BONUSES)) {
    solved[tier] = solveLift(tier, targets[tier], rules);
    bonuses[tier] = Object.freeze({ ...rules.BONUSES[tier], start: solved[tier].start, lift: solved[tier].lift });
  }
  let next = { ...rules, BONUSES: Object.freeze(bonuses) };
  const fs = {}, base = measure(next);
  for (const [id, m] of Object.entries(rules.MODES)) {
    if (m.kind !== 'spin') continue;
    const rtpAt = base.modes[id].returnAt;
    let lo = 0, hi = 0.6;
    if (rtpAt(lo) > RTP) throw Error(`${id}: returns ${(100 * rtpAt(lo)).toFixed(2)}% with no FS at all`);
    for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (rtpAt(mid) < RTP) lo = mid; else hi = mid; }
    fs[m.fs] = round6((lo + hi) / 2);
  }
  next = { ...next, FS: Object.freeze({ ...rules.FS, ...fs }) };
  return { targets, solved, fs, rules: next };
}

function write(result) {
  const path = new URL('../../games/dead-letter-depot/engine/rules.js', import.meta.url);
  let src = readFileSync(path, 'utf8');
  const fsLine = `export const FS = Object.freeze({ ${Object.entries(result.rules.FS).map(([k, v]) => `${k}: ${v}`).join(', ')} });`;
  src = src.replace(/^export const FS = Object\.freeze\(\{[^\n]*\}\);$/m, fsLine);
  for (const [tier, b] of Object.entries(result.rules.BONUSES)) {
    const re = new RegExp(`(  ${tier}: Object\\.freeze\\(\\{[^\\n]*?)start: [0-9.]+, lift: [0-9.]+( \\}\\),)`);
    if (!re.test(src)) throw Error(`Could not find the ${tier} bonus line in rules.js`);
    src = src.replace(re, `$1start: ${b.start}, lift: ${b.lift}$2`);
  }
  writeFileSync(path, src);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const t0 = Date.now(), r = fit();
  for (const [tier, s] of Object.entries(r.solved)) console.log(`${RULES.BONUSES[tier].title.padEnd(16)} target ${(r.targets[tier] / 100).toFixed(2)}x · start rung ${s.start} (${RULES.LADDER[s.start] / 100}x middle) lift ${s.lift} · between ${(s.lo / 100).toFixed(1)}x and ${(s.hi / 100).toFixed(1)}x`);
  const m = measure(r.rules);
  for (const [id, x] of Object.entries(m.modes)) {
    const rates = x.rates ? Object.entries(x.rates).map(([t, v]) => `${t} 1 in ${Math.round(1 / v).toLocaleString('en-US')}`).join(' · ') : '';
    console.log(`${id.padEnd(15)} cost ${String(x.cost).padStart(4)}x · RTP ${(100 * x.rtp).toFixed(4)}%${x.rates ? ` · FS ${r.rules.FS[RULES.MODES[id].fs]} · spin ${(100 * x.spinRtp).toFixed(2)}% · ${rates}` : ''}`);
  }
  const all = (id) => Object.values(m.modes[id].rates).reduce((a, b) => a + b, 0);
  console.log(`Priority Mail natural bonus entry: ${(all('priority') / all('base')).toFixed(2)}x the base rate (target 5x)`);
  console.log(`${((Date.now() - t0) / 1000).toFixed(1)} s`);
  if (process.argv.includes('--write')) { write(r); console.log('wrote games/dead-letter-depot/engine/rules.js'); }
}
