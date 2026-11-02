#!/usr/bin/env node
// Fits RoboBees' MATH block (games/robobees/dist/rules.mjs) so every mode returns 96%, by simulating the game's own
// rules (robobees-sim.mjs). Every step uses fixed seeds, so each measured curve is smooth in its knob.
//
//   node tools/math/robobees-fit.mjs            print the fitted MATH
//   node tools/math/robobees-fit.mjs --write    and write them into rules.mjs
//   node tools/math/robobees-fit.mjs --refine super,random,full32 [--scale 4] --write
//                                               re-solve only those knobs from the shipped MATH, on 4x the spins
//
// 1. Bonus averages are pinned by their buy prices: Regular 96x (100x buy), Super 240x (250x buy), and Hidden 2,400x,
//    which makes the Mystery Buy's 50/40/10 mix return 96% of 400x.
// 2. Line pays keep their shape and scale by one factor, rounded to 0.01x, so base spins return 96% with those bonuses
//    at their trigger chances. The base FS chance then absorbs the rounding.
// 3. One knob per bonus: Regular's second-Wild chance (it always lands one, on premium-rich symbols), Super's Wild
//    chance, and Hidden's odds of boosting 2 or 3 cells rather than 1 (1 : x : x/3; it always lands one Wild, a second
//    3% of the time).
// 4. One knob per paid feature, each at its price: Signal Boost's FS chance (3x); Pollen Charge's second-Wild chance
//    (20x; it always lands one, its seeds lean to 16x and 32x, and 8% of tumble tiles are Wild); Hive Overdrive's
//    tumble-Wild chance (250x; one opening Wild, a second 15% of the time, on premium-rich symbols). The two seeded
//    features keep most of their Wilds for the tumbles, so long chains and big hits carry more of their return.
// A paid mode's return: its line wins plus, for each bonus, the chance of triggering it (importance-sampled) times its
// target average.
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {simulate} from './robobees-sim.mjs';

const RULES = fileURLToPath(new URL('../../games/robobees/dist/rules.mjs', import.meta.url));
export const RTP = 0.96;
export const TARGET = {regular: 96, super: 240, hidden: 2400};
export const PRICE = {enhanced: 3, random: 20, full32: 250};
export const BOOST = 0.2;
const SHAPE = {hive: [2, 6, 18], nectar: [1.4, 4, 12], stinger: [1, 3, 9], rotor: [0.8, 2, 7], beacon: [0.6, 1.8, 6], A: [0.4, 1.2, 4], K: [0.4, 1.2, 4], Q: [0.3, 0.9, 3], J: [0.3, 0.9, 3], 10: [0.3, 0.9, 3]};
const N = {base: 4e6, enhanced: 3e6, random: 2e6, full32: 4e5, regular: 3e5, super: 3e5, hidden: 1.5e5};

/** what a paid mode returns per spin: line wins plus each bonus's trigger chance times its target */
export const modeReturn = (l) => l.mean + l.rates.regular * TARGET.regular + l.rates.super * TARGET.super + l.rates.hidden * TARGET.hidden;

/** a root of f on [lo, hi] (f increasing or decreasing), Illinois regula falsi, to tolerance tol in x */
async function solve(f, lo, hi, tol, label) {
  let flo = await f(lo);
  let fhi = await f(hi);
  if (flo * fhi > 0) throw Error(`${label}: no root in [${lo}, ${hi}] (f = ${flo}, ${fhi})`);
  let side = 0;
  for (let i = 0; i < 40; i++) {
    const x = (lo * fhi - hi * flo) / (fhi - flo);
    const fx = await f(x);
    console.error(`  ${label} ${x.toFixed(6)} → ${fx >= 0 ? '+' : ''}${fx.toFixed(5)}`);
    if (Math.abs(hi - lo) < tol || fx === 0) return x;
    if (fx * fhi > 0) {
      hi = x;
      fhi = fx;
      if (side === 1) flo /= 2;
      side = 1;
    } else {
      lo = x;
      flo = fx;
      if (side === -1) fhi /= 2;
      side = -1;
    }
    if (Math.abs(hi - lo) < tol) return (lo * fhi - hi * flo) / (fhi - flo);
  }
  throw Error(`${label}: did not converge`);
}

export async function fit() {
  const math = {
    cap: 25000,
    pays: SHAPE,
    weights: {base: [2, 3], random: [2, 3], full32: [4, 2], regular: [4, 2], super: [2, 3], hidden: [2, 3]},
    wilds: {base: [0.33, 0.08], random: [1, 0.05], full32: [1, 0.15], regular: [1, 0.3], super: [0.4, 0.1], hidden: [1, 0.03]},
    refillWild: {base: 0.02, random: 0.08, full32: 0.17, regular: 0.02, super: 0.02, hidden: 0.02},
    scatter: {base: 0.075, enhanced: 0.115},
    boosts: [1, 0.5, 0.5 / 3],
    pollen: [0.05, 0.08, 0.12, 0.35, 0.4],
    mystery: [0.5, 0.4, 0.1],
  };
  const tuned = (patch) => {
    const m = structuredClone(math);
    for (const [path, v] of Object.entries(patch)) {
      const ks = path.split('.');
      let o = m;
      while (ks.length > 1) o = o[ks.shift()];
      o[ks[0]] = v;
    }
    return m;
  };
  const paid = (m, feature, seed) => simulate('lines', m, {feature, n: N[feature ?? 'base'], seed, boost: BOOST});
  const bonus = async (m, mode, seed) => (await simulate('bonus', m, {mode, n: N[mode], seed})).mean;
  // 2. scale the line pays, then let the base FS chance absorb their rounding
  const l0 = await paid(math, null, 11);
  const k = (RTP - (modeReturn(l0) - l0.mean)) / l0.mean;
  math.pays = Object.fromEntries(Object.entries(SHAPE).map(([s, v]) => [s, v.map((x) => Math.round(x * k * 100) / 100)]));
  console.error(`line pays x${k.toFixed(4)} (base lines ${l0.mean.toFixed(4)} per spin before)`);
  math.scatter.base = await solve(async (p) => modeReturn(await paid(tuned({'scatter.base': p}), null, 11)) - RTP, 0.06, 0.09, 2e-6, 'base FS chance');
  // 3. the bonuses
  math.wilds.regular[1] = await solve(async (x) => (await bonus(tuned({'wilds.regular': [1, x]}), 'regular', 21)) - TARGET.regular, 0, 1, 1e-5, 'regular 2nd wild');
  math.wilds.super[0] = await solve(async (x) => (await bonus(tuned({'wilds.super': [x, 0.1]}), 'super', 22)) - TARGET.super, 0.15, 1, 1e-5, 'super wild');
  const b = await solve(async (x) => (await bonus(tuned({boosts: [1, x, x / 3]}), 'hidden', 23)) - TARGET.hidden, 0.001, 1.5, 1e-5, 'hidden boosts');
  math.boosts = [1, b, b / 3];
  // 4. the paid features
  math.scatter.enhanced = await solve(async (p) => modeReturn(await paid(tuned({'scatter.enhanced': p}), 'enhanced', 12)) / PRICE.enhanced - RTP, 0.08, 0.3, 2e-6, 'signal boost FS chance');
  math.wilds.random[1] = await solve(async (x) => modeReturn(await paid(tuned({'wilds.random': [1, x]}), 'random', 14)) / PRICE.random - RTP, 0, 1, 1e-5, 'pollen 2nd wild');
  math.refillWild.full32 = await solve(async (x) => modeReturn(await paid(tuned({'refillWild.full32': x}), 'full32', 15)) / PRICE.full32 - RTP, 0.005, 0.4, 1e-5, 'overdrive tumble wild');
  const round = (x, d) => Math.round(x * 10 ** d) / 10 ** d;
  for (const key of ['base', 'enhanced']) math.scatter[key] = round(math.scatter[key], 6);
  math.wilds.regular[1] = round(math.wilds.regular[1], 5);
  math.wilds.super[0] = round(math.wilds.super[0], 5);
  math.wilds.random[1] = round(math.wilds.random[1], 5);
  math.refillWild.full32 = round(math.refillWild.full32, 5);
  math.boosts = math.boosts.map((v) => round(v, 5));
  return {math};
}

/** re-solves the named knobs from the shipped MATH on scale x the spins, near their current values */
export async function refine(names, done = () => {}, scale = 4) {
  const R = await import(new URL('file://' + RULES).href);
  const math = structuredClone(R.MATH);
  const big = (k) => N[k] * scale;
  const near = (x, lo, hi) => [Math.max(lo, x * 0.92), Math.min(hi, x * 1.08)];
  const paid = async (m, feature, seed) => modeReturn(await simulate('lines', m, {feature, n: big(feature ?? 'base'), seed, boost: BOOST}));
  const bonus = async (m, mode, seed) => (await simulate('bonus', m, {mode, n: big(mode), seed})).mean;
  const knobs = {
    regular: {get: () => math.wilds.regular[1], set: (m, x) => (m.wilds.regular[1] = x), f: (m) => bonus(m, 'regular', 31).then((v) => v - TARGET.regular), range: [0, 1]},
    super: {get: () => math.wilds.super[0], set: (m, x) => (m.wilds.super[0] = x), f: (m) => bonus(m, 'super', 32).then((v) => v - TARGET.super), range: [0.15, 1]},
    hidden: {get: () => math.boosts[1], set: (m, x) => (m.boosts = [1, x, Math.round((x / 3) * 1e6) / 1e6]), f: (m) => bonus(m, 'hidden', 33).then((v) => v - TARGET.hidden), range: [0.001, 1.5]},
    enhanced: {get: () => math.scatter.enhanced, set: (m, x) => (m.scatter.enhanced = x), f: (m) => paid(m, 'enhanced', 34).then((v) => v / PRICE.enhanced - RTP), range: [0.08, 0.3]},
    random: {get: () => math.wilds.random[1], set: (m, x) => (m.wilds.random[1] = x), f: (m) => paid(m, 'random', 35).then((v) => v / PRICE.random - RTP), range: [0, 0.2], wide: true},
    full32: {get: () => math.refillWild.full32, set: (m, x) => (m.refillWild.full32 = x), f: (m) => paid(m, 'full32', 36).then((v) => v / PRICE.full32 - RTP), range: [0.005, 0.4]},
  };
  for (const name of names) {
    const k = knobs[name];
    const [lo, hi] = k.wide ? k.range : near(k.get(), ...k.range);
    const x = await solve(async (v) => {
      const m = structuredClone(math);
      k.set(m, v);
      return k.f(m);
    }, lo, hi, 2e-4 * (k.wide ? 0.05 : k.get()), `refine ${name}`);
    k.set(math, Math.round(x * 1e6) / 1e6);
    done({math});
  }
  return {math};
}

/** rewrites rules.mjs's MATH block */
export function write({math}) {
  let src = fs.readFileSync(RULES, 'utf8');
  const a = src.indexOf('export const MATH={');
  const b = src.indexOf('\n};\n', a) + 4;
  const j = (v) => JSON.stringify(v).replace(/"([A-Za-z_][A-Za-z0-9_]*|\d+)":/g, '$1:');
  const block = `export const MATH={\n${Object.entries(math).map(([k, v]) => ` ${k}:${j(v)},`).join('\n')}\n};\n`;
  src = src.slice(0, a) + block + src.slice(b);
  fs.writeFileSync(RULES, src);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const t0 = Date.now();
  const at = process.argv.indexOf('--refine');
  // a refine saves after each knob, so a long run keeps what it has solved
  const save = (r) => {
    write(r);
    console.error(`wrote ${RULES}`);
  };
  const r = at > 0 ? await refine(process.argv[at + 1].split(','), process.argv.includes('--write') ? save : undefined, Number(process.argv[process.argv.indexOf('--scale') + 1]) || 4) : await fit();
  console.log(JSON.stringify(r, null, 1));
  if (process.argv.includes('--write') && at < 0) save(r);
  console.error(`${((Date.now() - t0) / 60000).toFixed(1)} min`);
}
