// The reel engine v2 and settlement: replay, draw order, pays anywhere with
// wilds, the tumble sequence (clears, drops, refills), collections, every job
// on the board, the meter (base spin-local; Regular on events; Super always;
// Hidden doubling), retriggers, the cap, tiers and exact credits.
//   node --test games/dead-letter-depot/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { playRound, playBonus, spinBoard, seeded, tierOf, growMeter, ENGINE_VERSION } from '../engine/engine.js';
import { settle, winOf, costOf } from '../engine/settle.js';
import { REELS, ROWS, MIN_MATCH, CAP, BONUSES, MODES, BETS, PAYTABLE, PAYING, JOBS, OPENING_VALUES, RETRIGGER, MAX_JOBS, INCREMENTS, bonusFor, payFor, targetsFor } from '../engine/rules.js';

const counting = (seed) => { const g = seeded(seed); const f = () => { f.n += 1; return g(); }; f.n = 0; return f; };
const sum = (a) => a.reduce((t, x) => t + x, 0);
const clone = (b) => b.map((reel) => reel.map((c) => ({ ...c })));
const countOf = (board, s) => board.flat().filter((c) => c.s === s).length;
const RANK = Object.fromEntries(PAYING.map((s, i) => [s, i]));
const mostCommon = (board) => PAYING.reduce((b, s) => (countOf(board, s) > countOf(board, b) ? s : b), PAYING[0]);

// Drop survivors and apply refills, checking the engine's drop list.
function gravity(board, gone, drops, refills) {
  const next = clone(board);
  for (let reel = 0; reel < REELS; reel++) {
    const survivors = [];
    for (let row = 0; row < ROWS; row++) if (!gone.has(`${reel},${row}`)) survivors.push({ row, cell: board[reel][row] });
    const empty = ROWS - survivors.length;
    survivors.forEach((sv, i) => { next[reel][empty + i] = sv.cell; if (sv.row !== empty + i) assert.ok(drops.some(([r, f, t]) => r === reel && f === sv.row && t === empty + i), `drop ${reel}:${sv.row}->${empty + i}`); });
    const fills = refills.filter(([r]) => r === reel);
    assert.equal(fills.length, empty, `reel ${reel} refills`);
    fills.forEach(([, row, s, v], i) => { assert.equal(row, i); next[reel][row] = s === 'ST' ? { s, v } : { s }; });
  }
  return next;
}
const applyChanges = (board, changes) => { for (const [reel, row, from, to] of changes) { assert.equal(board[reel][row].s, from); board[reel][row] = to === 'ST' ? board[reel][row] : { s: to }; } };

// Replay one recorded spin independently; returns the final board and its clears.
function checkSpin(spin, targets, before) {
  let board = spin.board, subtotal = 0, biggest = null;
  const col = { ...before }, clears = [], fired = {};
  for (const step of spin.steps) {
    const wilds = countOf(board, 'W'), joined = wilds ? mostCommon(board) : null;
    const winners = PAYING.filter((s) => countOf(board, s) + (s === joined ? wilds : 0) >= MIN_MATCH);
    assert.equal(step.kind, winners.length ? 'win' : 'expire');
    assert.deepEqual(step.wins.map((w) => w.s), winners);
    for (const w of step.wins) {
      const n = countOf(board, w.s), extra = w.s === joined ? wilds : 0;
      assert.equal(w.count, n + extra); assert.equal(w.wilds, extra); assert.equal(w.pay, payFor(w.s, n + extra));
      if (!biggest || w.pay > biggest.pay) biggest = w;
      col[w.s] += n;
    }
    assert.equal(step.pay, sum(step.wins.map((w) => w.pay)));
    subtotal += step.pay;
    const gone = new Set(), expected = [];
    for (let r = 0; r < REELS; r++) for (let w = 0; w < ROWS; w++) if (winners.includes(board[r][w].s) || board[r][w].s === 'W') { gone.add(`${r},${w}`); expected.push([r, w]); }
    assert.deepEqual(step.cleared, expected);
    const want = [];
    for (const s of PAYING) while (col[s] >= targets[s]) { col[s] -= targets[s]; fired[s] = (fired[s] ?? 0) + 1; want.push({ s, job: JOBS[s], fired: fired[s] <= MAX_JOBS }); clears.push(s); }
    assert.deepEqual(step.clears, want);
    assert.deepEqual(step.collections, col);
    board = gravity(board, gone, step.drops, step.refills);
    assert.deepEqual(step.jobs.map((j) => j.s), want.filter((c) => c.fired).map((c) => c.s));
    for (const job of step.jobs) {
      if (job.job === 'sweep') {
        const swept = new Set(job.changes.map(([r, w]) => `${r},${w}`));
        assert.equal(swept.size, countOf(board, '10'));
        board = gravity(board, swept, job.drops, job.refills);
      } else if (job.job === 'vault') { applyChanges(board, job.unpack.changes); applyChanges(board, job.wild.changes); const [r, w] = job.changes[0]; board[r][w] = { s: 'ST', v: job.stamp }; }
      else if (job.job === 'return') { assert.deepEqual(job.returned, biggest && { s: biggest.s, count: biggest.count, wilds: biggest.wilds, pay: biggest.pay }); subtotal += biggest ? biggest.pay : 0; }
      else if (job.job !== 'filter') applyChanges(board, job.changes);
    }
    assert.deepEqual(board, step.after);
  }
  for (const s of PAYING) assert.ok(countOf(board, s) < MIN_MATCH || spin.steps.length >= 40, 'tumbles stop only when nothing pays');
  assert.equal(countOf(board, 'W'), 0, 'no wilds survive a spin');
  assert.equal(spin.subtotal, subtotal);
  assert.equal(spin.fs, countOf(board, 'FS'));
  assert.deepEqual(spin.clears, clears);
  return { board, col };
}
const zero = () => Object.fromEntries(PAYING.map((s) => [s, 0]));

test('a round replays exactly from its seed, survives JSON, and recording never changes it', () => {
  for (const mode of Object.keys(MODES)) for (const seed of [1, 77, 4242, 2 ** 31 + 5]) {
    const a = playRound({ mode, rng: seeded(seed) });
    assert.deepEqual(playRound({ mode, rng: seeded(seed) }), a, `${mode} ${seed}`);
    assert.deepEqual(JSON.parse(JSON.stringify(a)), a);
    assert.equal(a.version, ENGINE_VERSION);
    assert.equal(playRound({ mode, rng: seeded(seed), record: false }).total, a.total);
  }
  assert.throws(() => playRound({ mode: 'base' }), /seeded rng/);
  assert.throws(() => playRound({ mode: 'nope', rng: seeded(1) }), /Unknown mode/);
});

test('draw order: one draw per landed cell, one more per stamp (natural, opening and vault), one per opening cell', () => {
  for (const [land, opening] of [['base', 0], ['special', 1], ['exposure', 2], ['regular', 0], ['hidden', 0]]) for (let seed = 1; seed <= 300; seed++) {
    const rng = counting(seed), r = spinBoard(land, rng, { opening, record: true, targets: targetsFor(land) });
    const landed = 30 + sum(r.steps.map((s) => s.refills.length + sum(s.jobs.map((j) => (j.refills?.length ?? 0)))));
    assert.equal(rng.n, landed + r.stampsAt.length + opening, `${land} seed ${seed}`);
  }
});

test('pays anywhere, wilds, tumbles, collections and every job agree with an independent replay', () => {
  const jobs = new Set();
  for (const mode of ['base', 'priority', 'special', 'exposure']) for (let seed = 1; seed <= 800; seed++) {
    const r = playRound({ mode, rng: seeded(seed) });
    checkSpin(r.spin, targetsFor('base'), zero());
  }
  for (const tier of Object.keys(BONUSES)) for (let seed = 1; seed <= 400; seed++) {
    const b = playBonus(tier, seeded(seed));
    let col = zero();
    for (const s of b.spins) {
      assert.deepEqual(s.collectionsBefore, col);
      col = checkSpin(s, targetsFor(tier), col).col;
      assert.deepEqual(s.collectionsAfter, col);
      for (const st of s.steps) for (const j of st.jobs) jobs.add(j.job);
    }
  }
  assert.deepEqual([...jobs].sort(), Object.values(JOBS).sort(), 'every job ran at least once');
  assert.equal(payFor('KEY', 7), 0); assert.equal(payFor('KEY', 8), PAYTABLE.KEY[0]); assert.equal(payFor('10', 30), PAYTABLE['10'][2]);
  assert.equal(RANK.KEY, 0);
});

test('the meter: stamps first, then clears; base is spin-local, Regular applies on events, Super always, Hidden doubles', () => {
  assert.equal(growMeter(1, 0, [], 'add'), 1);
  assert.equal(growMeter(1, 5, ['KEY', 'J'], 'add'), 1 + 5 + INCREMENTS.tiered.KEY + INCREMENTS.tiered.J);
  assert.equal(growMeter(1, 5, ['KEY', 'J'], 'add', 'flat'), 8);
  assert.equal(growMeter(30, 0, ['A', 'K'], 'double', 'tiered', 1000), 120);
  assert.equal(growMeter(10, 4, ['A'], 'double', 'tiered', 64), 28);
  assert.equal(growMeter(40, 0, ['A'], 'double', 'tiered', 64), 64);
  for (let seed = 1; seed <= 5000; seed++) {
    const r = playRound({ mode: 'base', rng: seeded(seed), record: false });
    assert.equal(r.spin.multiplier, growMeter(1, r.spin.stampSum, r.spin.clears, 'add'));
    assert.equal(r.spin.win, Math.min(CAP, r.spin.subtotal * r.spin.multiplier));
    assert.equal(r.total % 10, 0);
  }
  const seen = { inactive: 0, superQuiet: 0, both: 0 };
  for (const tier of Object.keys(BONUSES)) {
    const b = BONUSES[tier];
    for (let seed = 1; seed <= 1500; seed++) {
      const bonus = playBonus(tier, seeded(seed), CAP, { record: false });
      let meter = b.meter, total = 0, left = b.spins;
      for (const s of bonus.spins) {
        left -= 1;
        assert.equal(s.meter.start, meter);
        const grown = growMeter(meter, s.stampSum, s.clears, b.grow, 'tiered', b.ceiling ?? 1000);
        assert.equal(s.meter.after, grown);
        const event = s.stampSum > 0 || s.clears.length > 0;
        assert.equal(s.meter.event, event);
        assert.equal(s.meter.active, b.when === 'always' || event);
        assert.equal(s.multiplier, s.meter.active ? grown : 1);
        assert.equal(s.win, s.subtotal * s.multiplier);
        if (tier === 'regular' && !event && s.subtotal > 0 && meter > 1) seen.inactive += 1;
        if (tier === 'super' && !event && s.subtotal > 0) seen.superQuiet += 1;
        if (tier === 'hidden' && s.stampSum > 0 && s.clears.length > 0) seen.both += 1;
        meter = grown; total += s.paid;
        if (s.fs >= RETRIGGER.fs) { assert.equal(s.retrigger, RETRIGGER.spins); left += s.retrigger; } else assert.equal(s.retrigger, 0);
      }
      if (bonus.capped) assert.equal(bonus.total, CAP); else assert.equal(left, 0);
      assert.equal(bonus.total, total); assert.equal(bonus.meter, meter);
    }
  }
  for (const [k, v] of Object.entries(seen)) assert.ok(v > 0, `saw ${k}`);
});

test('opening stamps: Special Delivery places one, Double Exposure two, from the preview table, before evaluation', () => {
  const open = new Set(OPENING_VALUES.map(([v]) => v));
  for (const [mode, k] of [['special', 1], ['exposure', 2]]) for (let seed = 1; seed <= 400; seed++) {
    const r = playRound({ mode, rng: seeded(seed) });
    assert.equal(r.spin.opening.length, k);
    assert.equal(new Set(r.spin.opening.map(([a, b]) => `${a},${b}`)).size, k);
    for (const [reel, row, v] of r.spin.opening) { assert.ok(open.has(v)); assert.deepEqual(r.spin.board[reel][row], { s: 'ST', v }); }
    assert.ok(r.spin.stampSum >= sum(r.spin.opening.map((o) => o[2])));
  }
});

test('4, 5 and 6+ FS when the tumbles end award Night Shift, Double Post and Lost & Found', () => {
  assert.deepEqual([3, 4, 5, 6, 9].map(bonusFor), [null, 'regular', 'super', 'hidden', 'hidden']);
  let seen = 0;
  for (let seed = 1; seed <= 20000; seed++) {
    const r = playRound({ mode: 'priority', rng: seeded(seed), record: false });
    assert.equal(r.bonus?.tier ?? null, bonusFor(r.spin.fs), `seed ${seed}`);
    if (r.bonus) { seen += 1; assert.equal(r.total, Math.min(CAP, r.spin.win + r.bonus.total)); }
  }
  assert.ok(seen > 50);
  const tiers = new Set();
  for (let seed = 1; seed <= 100; seed++) tiers.add(playRound({ mode: 'mystery', rng: seeded(seed), record: false }).bonus.tier);
  assert.deepEqual([...tiers].sort(), ['hidden', 'regular', 'super']);
  assert.deepEqual(targetsFor('hidden').J * 2, targetsFor('super').J);
});

test('the 25,000x cap covers the whole round, settles once and ends the bonus', () => {
  for (const tier of Object.keys(BONUSES)) for (let seed = 1; seed <= 300; seed++) {
    const b = playBonus(tier, seeded(seed), 2000, { record: false });
    assert.ok(b.total <= 2000);
    if (b.capped) assert.equal(b.total, 2000);
    if (b.endedEarly) assert.ok(b.spins.length < b.awarded);
  }
  assert.equal(tierOf(CAP, 'base', true), 'max');
  for (const bet of BETS) assert.equal(winOf(CAP, bet), 25000 * bet);
});

test('win tiers and settlement', () => {
  assert.equal(tierOf(990, 'base'), null); assert.equal(tierOf(1000, 'base'), 'nice'); assert.equal(tierOf(2500, 'priority'), 'big');
  assert.equal(tierOf(19990, 'nightshift'), null); assert.equal(tierOf(20000, 'nightshift'), 'nice'); assert.equal(tierOf(2000000, 'mystery'), 'mythic');
  for (const bet of BETS) {
    for (const mode of Object.keys(MODES)) assert.ok(Number.isInteger(costOf(mode, bet)));
    for (const total of [0, 10, 40, 130, 990, 123450, CAP]) assert.ok(Number.isInteger(winOf(total, bet)));
  }
  assert.throws(() => costOf('base', 25), /bet ladder/);
  const r = playRound({ mode: 'priority', rng: seeded(12) });
  assert.deepEqual(settle(r, 100, 100000), { cost: 300, win: winOf(r.total, 100), balance: 100000 - 300 + winOf(r.total, 100) });
  assert.throws(() => settle(r, 100, 299), /cannot cover/);
});
