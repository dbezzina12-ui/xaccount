import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileModel } from '../engine/core/model.js';
import { spin, playRound, evalLine } from '../engine/core/game.js';
import { SeededRng, CryptoRng } from '../engine/core/rng.js';
import { exactStats } from '../tools/math/exact.js';
import { buildStrip } from '../tools/math/strips.js';

const GAME = JSON.parse(readFileSync(new URL('../games/game-001/model.json', import.meta.url), 'utf8'));

// RNG that returns queued values from int()/pick(), for hand-built outcomes.
class StubRng {
  constructor(ints = [], picks = []) {
    this.ints = ints;
    this.picks = picks;
  }
  int() {
    return this.ints.shift() ?? 0;
  }
  pick() {
    return this.picks.shift() ?? 0;
  }
}

// Builds a 5x3 grid buffer from rows written top to bottom.
function grid(m, rows) {
  const g = new Int8Array(m.reels * m.rows);
  rows.forEach((row, r) => row.split(/\s+/).forEach((id, reel) => (g[reel * m.rows + r] = m.index[id])));
  return g;
}
const ones = (m) => new Float64Array(m.reels * m.rows).fill(1);

test('seeded rng is reproducible and save/restore round-trips', () => {
  const a = new SeededRng(42);
  const b = new SeededRng(42);
  for (let i = 0; i < 1000; i++) assert.equal(a.nextU32(), b.nextU32());
  const st = a.save();
  const x = [a.int(1000), a.int(1000), a.int(1000)];
  a.restore(st);
  assert.deepEqual([a.int(1000), a.int(1000), a.int(1000)], x);
});

test('rng int(n) is uniform (chi-square) for both sources', () => {
  for (const rng of [new SeededRng(7), new CryptoRng()]) {
    const n = 7;
    const N = 700000;
    const c = new Array(n).fill(0);
    for (let i = 0; i < N; i++) c[rng.int(n)]++;
    const e = N / n;
    const chi = c.reduce((s, v) => s + (v - e) ** 2 / e, 0);
    assert.ok(chi < 22.46, `chi-square ${chi.toFixed(2)} exceeds p=0.001 critical value (df=6)`);
  }
});

test('line evaluation: plain, wild substitution, multipliers, scatter', () => {
  const m = compileModel(GAME);
  const line = m.lines[0]; // middle row
  const pay = (s, n) => GAME.pays[s][n];
  let g = grid(m, ['L1 L1 L1 L1 L1', 'H1 H1 H1 L2 L3', 'L4 L4 L4 L4 L4']);
  assert.equal(evalLine(m, g, ones(m), line), pay('H1', 3));
  g = grid(m, ['L1 L1 L1 L1 L1', 'H2 W H2 H2 L3', 'L4 L4 L4 L4 L4']);
  assert.equal(evalLine(m, g, ones(m), line), pay('H2', 4));
  const mult = ones(m);
  mult[1 * 3 + 1] = 2;
  mult[2 * 3 + 1] = 5;
  g = grid(m, ['L1 L1 L1 L1 L1', 'H3 W W H3 L3', 'L4 L4 L4 L4 L4']);
  assert.equal(evalLine(m, g, mult, line), pay('H3', 4) * 10, 'multipliers in the run multiply');
  g = grid(m, ['L1 L1 L1 L1 L1', 'H3 W W L5 W', 'L4 L4 L4 L4 L4']);
  assert.equal(evalLine(m, g, mult, line), pay('H3', 3) * 10, 'wild after the break does not count');
  g = grid(m, ['L1 L1 L1 L1 L1', 'S W W S S', 'L4 L4 L4 L4 L4']);
  assert.equal(evalLine(m, g, ones(m), line), 0, 'wild never substitutes for the scatter');
  g = grid(m, ['L1 L1 L1 L1 L1', 'H1 H1 L2 H1 H1', 'L4 L4 L4 L4 L4']);
  assert.equal(evalLine(m, g, ones(m), line), 0, '2 of a kind pays nothing');
});

test('spin reads the window from the strips at the drawn stops', () => {
  const m = compileModel(GAME);
  const stops = [0, 5, 10, 15, 20];
  const s = spin(m, new StubRng(stops.slice()), 'base', true);
  assert.deepEqual(s.stops, stops);
  for (let i = 0; i < 5; i++) {
    const strip = GAME.reels.base[i].split(' ');
    for (let r = 0; r < 3; r++) assert.equal(s.grid[i][r], strip[(stops[i] + r) % strip.length]);
  }
  const recount = s.lineWins.reduce((a, w) => a + w.winLB, 0) + s.scatter.winLB;
  assert.equal(recount, s.winLB);
});

test('detail and fast paths agree round for round', () => {
  const m = compileModel(GAME);
  const a = new SeededRng(99);
  const b = new SeededRng(99);
  for (let i = 0; i < 20000; i++) {
    const buy = i % 50 === 0;
    const fast = playRound(m, a, { buy }).totalWinX;
    const slow = playRound(m, b, { buy, detail: true });
    assert.equal(fast, slow.totalWinX);
    const parts = (slow.base?.winX ?? 0) + slow.free.reduce((s, x) => s + x.winX, 0);
    if (!slow.capped) assert.ok(Math.abs(parts - slow.totalWinX) < 1e-9);
  }
});

test('max-win cap ends the round at exactly the cap', () => {
  const m = compileModel({ ...GAME, maxWinX: 3 });
  const rng = new SeededRng(5);
  let capped = 0;
  for (let i = 0; i < 20000; i++) {
    const r = playRound(m, rng, { buy: i % 10 === 0, detail: true });
    assert.ok(r.totalWinX <= 3 + 1e-12);
    if (r.capped) {
      capped++;
      assert.equal(r.totalWinX, 3);
    }
  }
  assert.ok(capped > 0);
});

test('model compiler rejects rule breaks', () => {
  const bad = (patch, re) => assert.throws(() => compileModel({ ...structuredClone(GAME), ...patch(structuredClone(GAME)) }), re);
  bad((g) => ({ reels: { ...g.reels, base: [g.reels.base[1], ...g.reels.base.slice(1)] } }), /wild is only allowed/);
  bad((g) => ({ reels: { ...g.reels, base: ['S L1 S L2 L3 L4 L5', ...g.reels.base.slice(1)] } }), /scatters/);
  bad((g) => ({ reels: { ...g.reels, free: ['L1 L2 ZZ L3 L4 L5', ...g.reels.free.slice(1)] } }), /unknown symbol ZZ/);
  bad((g) => ({ paylines: [...g.paylines, g.paylines[0]] }), /duplicate paylines/);
  bad((g) => ({ pays: { ...g.pays, W: { 5: 100 } } }), /only high\/low/);
});

test('strip builder keeps counts, spaces scatters, is deterministic', () => {
  const counts = { S: 3, H1: 4, H2: 6, L1: 12, L2: 15, W: 2 };
  const a = buildStrip(counts, { seed: 3 });
  assert.equal(a, buildStrip(counts, { seed: 3 }));
  const ids = a.split(' ');
  for (const [k, v] of Object.entries(counts)) assert.equal(ids.filter((x) => x === k).length, v);
  const pos = ids.map((x, i) => (x === 'S' ? i : -1)).filter((i) => i >= 0);
  for (let i = 0; i < pos.length; i++) {
    const gap = (pos[(i + 1) % pos.length] - pos[i] + ids.length) % ids.length;
    assert.ok(gap >= 3, `scatters ${gap} apart`);
  }
});

test('exact math matches simulation (base game, hit rate, trigger rate, bonus buy)', () => {
  const m = compileModel(GAME);
  const ex = exactStats(m);
  const rng = new SeededRng(2024);
  const N = 1500000;
  let base = 0;
  let base2 = 0;
  let hits = 0;
  let trig = 0;
  for (let i = 0; i < N; i++) {
    const s = spin(m, rng, 'base');
    base += s.winX;
    base2 += s.winX * s.winX;
    if (s.winX > 0) hits++;
    if (s.award > 0) trig++;
  }
  const mean = base / N;
  const se = Math.sqrt((base2 / N - mean * mean) / N);
  const exBase = ex.rtpLines + ex.rtpScatter;
  assert.ok(Math.abs(mean - exBase) < 4 * se, `base ${mean} vs exact ${exBase} (se ${se})`);
  const h = hits / N;
  assert.ok(Math.abs(h - ex.baseHitRate) < 4 * Math.sqrt((h * (1 - h)) / N), `hit ${h} vs ${ex.baseHitRate}`);
  const p = trig / N;
  assert.ok(Math.abs(p - ex.triggerProb) < 4 * Math.sqrt((p * (1 - p)) / N), `trigger ${p} vs ${ex.triggerProb}`);

  const B = 150000;
  let buySum = 0;
  let buy2 = 0;
  for (let i = 0; i < B; i++) {
    const x = playRound(m, rng, { buy: true }).totalWinX;
    buySum += x;
    buy2 += x * x;
  }
  const bm = buySum / B;
  const bse = Math.sqrt((buy2 / B - bm * bm) / B);
  assert.ok(Math.abs(bm - ex.bonusBuy.avgWinX) < 4 * bse, `bonus ${bm} vs exact ${ex.bonusBuy.avgWinX} (se ${bse})`);
});

test('game-001 headline math stays on target', () => {
  const ex = exactStats(compileModel(GAME));
  assert.ok(ex.rtp > 0.962 && ex.rtp < 0.9635, `RTP ${ex.rtp}`);
  assert.ok(ex.bonusBuy.rtp > 0.962 && ex.bonusBuy.rtp < 0.966, `bonus buy RTP ${ex.bonusBuy.rtp}`);
  assert.ok(ex.triggerOneIn > 200 && ex.triggerOneIn < 350, `trigger 1 in ${ex.triggerOneIn}`);
});
