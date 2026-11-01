#!/usr/bin/env node
// Cyber Skunk Mystery Buy (Dylan, 2026-11-01): one purchase reveals
// Overpressure or Blackout Protocol, never Vent Break, and pays at least 40x.
// Blackout comes from its own pool (bonus-hidden, every round 1,000x or more).
// Overpressure comes from mystery-super, cut from the bought pool (bonus-super):
// only its rounds of MYSTERY.floor or more, the ones over MYSTERY.bigOver made
// rarer by one factor, weighted so the whole buy returns 96% of its price.
// Adds mystery-super and modes.mystery to runtime/catalog-data.js; every other
// pool and mode is left as it is. Run after cyber-skunk-catalogs.mjs.
//
//   node tools/math/cyber-skunk-mystery.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const RT = new URL('../../games/cyber-skunk/runtime/', import.meta.url), FILE = new URL('catalog-data.js', RT);
const { default: data } = await import(FILE);
const { PLAY_OPTIONS, MYSTERY, MYSTERY_TIERS, MYSTERY_TICKETS } = await import(new URL('rules.js', RT));
const T = BigInt(data.total), COST = PLAY_OPTIONS.mystery.cost;
if (data.total !== MYSTERY_TICKETS) throw Error(`catalogs hold ${data.total} tickets, Mystery weights ${MYSTERY_TICKETS}`);
const tiers = Object.fromEntries(MYSTERY_TIERS.map((t) => [t.tier, t]));
if (Object.keys(tiers).join() !== 'super,hidden' || tiers.super.weight + tiers.hidden.weight !== data.total) throw Error('Mystery tiers must be super + hidden over all tickets');

// The Overpressure picks must carry what Blackout does not: sum of weight x
// value over mystery-super, so that the whole buy averages 96% of COST.
const sumOf = (rows) => rows.reduce((a, r) => a + BigInt(r[1]) * BigInt(r[2]), 0n);
const hiddenSum = sumOf(data.pools[tiers.hidden.pool]);
const want = (96n * BigInt(COST) * T * T - BigInt(tiers.hidden.weight) * hiddenSum) / BigInt(tiers.super.weight); // hundredths x tickets
const wantRound = (want / 10n) * 10n; // every value is a whole 0.1x: sums move in steps of 10

// Shares: the bought pool's own weights at or above the floor, the big wins x k.
const rows = data.pools['bonus-super'].filter((r) => r[2] >= MYSTERY.floor);
const lo = rows.filter((r) => r[2] <= MYSTERY.bigOver), hi = rows.filter((r) => r[2] > MYSTERY.bigOver);
const W = (a) => a.reduce((s, r) => s + r[1], 0), A = (a) => a.reduce((s, r) => s + r[1] * r[2], 0);
const mean = Number(want) / data.total;
const k = (mean * W(lo) - A(lo)) / (A(hi) - mean * W(hi));
if (!(k > 0 && k <= 1)) throw Error(`no weighting reaches ${(mean / 100).toFixed(2)}x with these limits (k = ${k})`);
const shares = rows.map((r) => r[1] * (r[2] > MYSTERY.bigOver ? k : 1)), shareSum = shares.reduce((a, b) => a + b, 0);

// Whole tickets: floor, the rest to the largest remainders, at least 1 each.
const raw = shares.map((s) => (s / shareSum) * data.total), w = raw.map((x) => Math.max(1, Math.floor(x)));
let left = data.total - w.reduce((a, b) => a + b, 0);
raw.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0) { w[i]++; left--; } });
if (left !== 0) throw Error('rounding left tickets over');

// Exact sum: move tickets between two rows, first a coarse pair, then a pair
// 0.1x apart, until sum(weight x value) is exactly wantRound.
const current = () => rows.reduce((a, r, i) => a + BigInt(w[i]) * BigInt(r[2]), 0n);
const heaviest = (pred) => rows.map((r, i) => i).filter((i) => pred(rows[i][2])).sort((a, b) => w[b] - w[a])[0];
function move(from, to, n) { if (n <= 0n) return; if (BigInt(w[from]) - n < 1n) throw Error('not enough tickets to move'); w[from] -= Number(n); w[to] += Number(n); }
{
  const a = heaviest((v) => v <= 10000), b = heaviest((v) => v > 30000 && v <= MYSTERY.bigOver), step = BigInt(rows[b][2] - rows[a][2]);
  const diff = wantRound - current(), n = (diff < 0n ? -diff : diff) / step;
  diff > 0n ? move(a, b, n) : move(b, a, n);
}
{
  const byValue = new Map(); rows.forEach((r, i) => { if (!byValue.has(r[2]) || w[i] > w[byValue.get(r[2])]) byValue.set(r[2], i); });
  const v = [...byValue.keys()].sort((x, y) => x - y).find((x) => byValue.has(x + 10) && x < 20000);
  const a = byValue.get(v), b = byValue.get(v + 10), diff = wantRound - current(), n = (diff < 0n ? -diff : diff) / 10n;
  diff > 0n ? move(a, b, n) : move(b, a, n);
}
if (current() !== wantRound) throw Error(`sum ${current()} is not ${wantRound}`);

data.pools['mystery-super'] = rows.map((r, i) => [r[0], w[i], r[2]]);
data.modes.mystery = { cost: COST, tiers: Object.fromEntries(MYSTERY_TIERS.map((t) => [t.tier, t.weight])), pools: Object.fromEntries(MYSTERY_TIERS.map((t) => [t.tier, t.pool])), floor: MYSTERY.floor, bigOver: MYSTERY.bigOver, bigOverWeight: Number(k.toFixed(6)) };
data.version = 'cs-2m';
const text = readFileSync(FILE, 'utf8'), head = text.slice(0, text.indexOf('export default '));
writeFileSync(FILE, `${head}export default ${JSON.stringify(data)};\n`);

const rtp = (Number(BigInt(tiers.super.weight) * wantRound + BigInt(tiers.hidden.weight) * hiddenSum) / Number(T * T)) / (COST * 100);
console.log(`mystery-super: ${rows.length} of ${data.pools['bonus-super'].length} Overpressure rounds (>= ${MYSTERY.floor / 100}x), wins over ${MYSTERY.bigOver / 100}x at ${(k * 100).toFixed(2)}% weight, average ${(Number(wantRound) / data.total / 100).toFixed(4)}x`);
console.log(`Mystery at ${COST}x: Overpressure ${(tiers.super.weight / 1e7).toFixed(4)}%, Blackout ${(tiers.hidden.weight / 1e7).toFixed(4)}%, RTP ${(rtp * 100).toFixed(9)}%`);
