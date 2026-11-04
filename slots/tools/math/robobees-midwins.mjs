#!/usr/bin/env node
// RoboBees base-game what-if (Dylan, 2026-11-04: "the mid wins should be good so we keep people playing for a
// longer period of time"). The paytable, the bonuses, the buys, Pollen Charge and Hive Overdrive stay as shipped:
// the bonuses share the paytable, so it can't change without moving their 96%. An option changes only base-spin
// settings (premium share, opening Wilds, tumble Wilds), then the base FS chance is solved so base spins return 96%
// with each bonus at its pinned average, as robobees-fit.mjs does.
//
//   node tools/math/robobees-midwins.mjs [--n 2e6] [--only name]
import {simulate} from './robobees-sim.mjs';
import {MATH} from '../../games/robobees/dist/rules.mjs';
import {RTP, modeReturn} from './robobees-fit.mjs';

const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);
const N = Number(arg('--n', 2e6));
const OVER = [1, 2, 5, 10, 25, 50, 100, 500];
export const OPTIONS = {
  current: {},
  'more premiums (3:3)': {weights: [3, 3]},
  'tumble Wilds 4%': {refill: 0.04},
  'opening Wilds 50% / 12%': {wilds: [0.5, 0.12]},
  'tumble Wilds 3.5% + premiums 2.5:3': {refill: 0.035, weights: [2.5, 3]},
  'tumble Wilds 5%': {refill: 0.05},
  'tumble Wilds 6%': {refill: 0.06},
  'tumble Wilds 5% + opening 40% / 10%': {refill: 0.05, wilds: [0.4, 0.1]},
};

const configure = (opt, scatter) => {
  const m = structuredClone(MATH);
  if (opt.weights) m.weights.base = opt.weights;
  if (opt.wilds) m.wilds.base = opt.wilds;
  if (opt.refill) m.refillWild.base = opt.refill;
  m.scatter.base = scatter;
  return m;
};

export async function measure(opt, n = N) {
  // Solve the base FS chance for 96% (regula falsi on fixed seeds, so the curve is smooth in its knob).
  const ret = async (p) => modeReturn(await simulate('lines', configure(opt, p), {n, seed: 41, boost: 0.2})) - RTP;
  let lo = 0.03, hi = 0.1, flo = await ret(lo), fhi = await ret(hi), p = MATH.scatter.base;
  if (flo > 0) return {error: `even a ${lo} FS chance returns ${(100 * (flo + RTP)).toFixed(2)}%`};
  for (let i = 0; i < 8; i++) {
    p = (lo * fhi - hi * flo) / (fhi - flo);
    const f = await ret(p);
    if (Math.abs(f) < 0.0005) break;
    if (f > 0) { hi = p; fhi = f; } else { lo = p; flo = f; }
  }
  const l = await simulate('lines', configure(opt, p), {n, seed: 42, boost: 0.2, over: OVER});
  const bonusRate = l.rates.regular + l.rates.super + l.rates.hidden;
  return {
    scatter: p, rtp: modeReturn(l), lineShare: l.mean, bonusEvery: 1 / bonusRate, hit: l.hits / l.n, lineSd: l.sd,
    over: Object.fromEntries(OVER.map((x, j) => [x, l.over[j] / l.n])), capEvery: l.capped ? l.n / l.capped : Infinity,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pct = (x) => (x >= 0.01 ? (100 * x).toFixed(2) + '%' : x > 0 ? '1 in ' + Math.round(1 / x).toLocaleString('en-US') : '—');
  const only = arg('--only', null);
  for (const [name, opt] of Object.entries(OPTIONS)) {
    if (only && name !== only) continue;
    const t0 = Date.now(), m = await measure(opt);
    console.log(`\n## ${name}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    if (m.error) { console.log(m.error); continue; }
    console.log(`FS chance ${(100 * m.scatter).toFixed(3)}% · RTP ${(100 * m.rtp).toFixed(2)}% · line wins ${(100 * m.lineShare).toFixed(1)}% · bonus 1 in ${Math.round(m.bonusEvery)} · hit ${(100 * m.hit).toFixed(1)}% · line SD ${m.lineSd.toFixed(2)}`);
    console.log('spin pays (line wins) ' + Object.entries(m.over).map(([x, v]) => `>=${x}x ${pct(v)}`).join(' · '));
  }
}
