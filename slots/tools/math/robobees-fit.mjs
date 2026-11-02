#!/usr/bin/env node
// Fits RoboBees' MATH block (games/robobees/dist/rules.mjs) so every mode returns 96%, by simulating the game's own
// rules (robobees-sim.mjs). Every step uses fixed seeds, so each measured curve is smooth in its knob.
//
//   node tools/math/robobees-fit.mjs            print the fitted MATH and Scout Run's price
//   node tools/math/robobees-fit.mjs --write    and write them into rules.mjs
//
// 1. Bonus averages are pinned by their buy prices: Regular 96x (100x buy), Super 240x (250x buy), and Hidden 2,400x,
//    which makes the Mystery Buy's 50/40/10 mix return 96% of 400x.
// 2. Line pays keep their shape and scale by one factor, rounded to 0.01x, so base spins return 96% with those bonuses.
//    The base scatter chance then absorbs the rounding.
// 3. Each bonus has one knob: Regular's second-Wild chance (it always lands one Wild, on premium-rich reels), Super's
//    Wild chance, Hidden's second-Wild chance (it always lands one, and boosts 1, 2 or 3 cells at 6:3:1).
// 4. Signal Boost's scatter chance makes its 3x spins return 96%. Scout Run keeps the base game and adds its Wild: its
//    price is what it returns over 96%.
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {simulate} from './robobees-sim.mjs';

const RULES = fileURLToPath(new URL('../../games/robobees/dist/rules.mjs', import.meta.url));
export const RTP = 0.96;
export const TARGET = {regular: 96, super: 240, hidden: 2400};
const SHAPE = {hive: [2, 6, 18], nectar: [1.4, 4, 12], stinger: [1, 3, 9], rotor: [0.8, 2, 7], beacon: [0.6, 1.8, 6], A: [0.4, 1.2, 4], K: [0.4, 1.2, 4], Q: [0.3, 0.9, 3], J: [0.3, 0.9, 3], 10: [0.3, 0.9, 3]};
const N = {lines: 8e6, regular: 3e5, super: 3e5, hidden: 1.5e5};

/** chance of exactly k FS on 5 reels, each landing one with chance p */
export const fsChance = (p, k) => [1, 5, 10, 10, 5, 1][k] * p ** k * (1 - p) ** (5 - k);
/** what a paid spin's bonuses return on average, if each bonus pays its target */
export const bonusReturn = (p) => fsChance(p, 3) * TARGET.regular + fsChance(p, 4) * TARGET.super + fsChance(p, 5) * TARGET.hidden;

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
    weights: {base: [2, 3], regular: [4, 2], super: [2, 3], hidden: [2, 3]},
    wilds: {base: [0.33, 0.08], regular: [1, 0.3], super: [0.4, 0.1], hidden: [1, 0.05]},
    scatter: {base: 0.075, enhanced: 0.115},
    boosts: [6, 3, 1],
    mystery: [0.5, 0.4, 0.1],
  };
  const lines = async (m, feature, seed) => (await simulate('lines', m, {feature, n: N.lines, seed})).mean;
  // 2. scale the line pays
  const l0 = await lines(math, null, 11);
  const k = (RTP - bonusReturn(math.scatter.base)) / l0;
  math.pays = Object.fromEntries(Object.entries(SHAPE).map(([s, v]) => [s, v.map((x) => Math.round(x * k * 100) / 100)]));
  console.error(`line pays x${k.toFixed(4)} (base lines ${l0.toFixed(4)} per spin before)`);
  // the base scatter chance absorbs the rounding of the pays
  math.scatter.base = await solve(async (p) => (await lines({...math, scatter: {...math.scatter, base: p}}, null, 11)) + bonusReturn(p) - RTP, 0.06, 0.09, 2e-6, 'base scatter');
  // 3. one knob per bonus
  const bonus = async (mode, m, seed) => (await simulate('bonus', m, {mode, n: N[mode], seed})).mean;
  math.wilds.regular[1] = await solve(async (x) => (await bonus('regular', {...math, wilds: {...math.wilds, regular: [1, x]}}, 21)) - TARGET.regular, 0, 1, 1e-5, 'regular 2nd wild');
  math.wilds.super[0] = await solve(async (x) => (await bonus('super', {...math, wilds: {...math.wilds, super: [x, 0.1]}}, 22)) - TARGET.super, 0.15, 0.95, 1e-5, 'super wild');
  math.wilds.hidden[1] = await solve(async (x) => (await bonus('hidden', {...math, wilds: {...math.wilds, hidden: [1, x]}}, 23)) - TARGET.hidden, 0, 0.6, 1e-5, 'hidden 2nd wild');
  // 4. Signal Boost's scatter, then Scout Run's price
  math.scatter.enhanced = await solve(async (p) => ((await lines({...math, scatter: {...math.scatter, enhanced: p}}, 'enhanced', 12)) + bonusReturn(p)) / 3 - RTP, 0.1, 0.25, 2e-6, 'signal boost scatter');
  const scout = (await lines(math, 'scout', 13)) + bonusReturn(math.scatter.base);
  const round = (x, d) => Math.round(x * 10 ** d) / 10 ** d;
  math.scatter.base = round(math.scatter.base, 6);
  math.scatter.enhanced = round(math.scatter.enhanced, 6);
  math.wilds.regular[1] = round(math.wilds.regular[1], 5);
  math.wilds.super[0] = round(math.wilds.super[0], 5);
  math.wilds.hidden[1] = round(math.wilds.hidden[1], 5);
  return {math, scoutPrice: round(scout / RTP, 2), scoutReturn: scout};
}

/** rewrites rules.mjs's MATH block and Scout Run's price */
export function write({math, scoutPrice}) {
  let src = fs.readFileSync(RULES, 'utf8');
  const a = src.indexOf('export const MATH={');
  const b = src.indexOf('\n};\n', a) + 4;
  const j = (v) => JSON.stringify(v).replace(/"([A-Za-z_][A-Za-z0-9_]*|\d+)":/g, '$1:');
  const block = `export const MATH={\n cap:${math.cap},\n pays:${j(math.pays)},\n weights:${j(math.weights)},\n wilds:${j(math.wilds)},\n scatter:${j(math.scatter)},\n boosts:${j(math.boosts)},\n mystery:${j(math.mystery)},\n};\n`;
  src = src.slice(0, a) + block + src.slice(b);
  src = src.replace(/(scout:\{price:)[0-9.]+/, `$1${scoutPrice}`);
  fs.writeFileSync(RULES, src);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const t0 = Date.now();
  const r = await fit();
  console.log(JSON.stringify(r, null, 1));
  if (process.argv.includes('--write')) {
    write(r);
    console.error(`wrote ${RULES}`);
  }
  console.error(`${((Date.now() - t0) / 60000).toFixed(1)} min`);
}
