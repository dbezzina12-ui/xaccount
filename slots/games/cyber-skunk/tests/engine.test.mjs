// Cyber Skunk engine (games/cyber-skunk/DESIGN.md): the route, the lines,
// the bonuses and the catalog split, on hand-built boards and seeded rounds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playRound, seeded, sprayRoute, paint, lineWins, drawBoard, at, OPENINGS } from '../runtime/engine.js';
import { CELLS, CAP, MAX_STEPS, MAX_SPINS, MAX_STICKY, MAX_RESERVOIR, PAYTABLE, BONUSES, MODES } from '../runtime/rules.js';

const board = (fill = 'T') => Array.from({ length: CELLS }, () => ({ s: fill }));
const vent = (cells, row, reel, dir) => { cells[at(row, reel)].vent = dir; return cells; };

test('a round is a pure function of its seeds', () => {
  for (const mode of Object.keys(MODES)) for (const seed of [1, 77, 4242]) assert.deepEqual(playRound({ mode, rng: seeded(seed) }), playRound({ mode, rng: seeded(seed) }), `${mode} ${seed}`);
});

test('the route lands on the left-most vent, follows each outlet, and gains 1 pressure per vent', () => {
  assert.equal(sprayRoute(board()), null, 'no vent, no spray');
  // Left-most vent at reel 2 (row 1, outlet down); the top one wins a tie on that reel.
  const cells = vent(vent(vent(board(), 3, 2, 1), 1, 2, 2), 3, 4, 0);
  const r = sprayRoute(cells);
  assert.equal(r.entry, at(1, 2));
  assert.deepEqual(r.path.map((p) => p.i), [at(1, 2), at(2, 2), at(3, 2), at(3, 3), at(3, 4), at(2, 4), at(1, 4), at(0, 4)]);
  assert.deepEqual(r.path.map((p) => p.pressure), [2, 2, 3, 3, 4, 4, 4, 4]);
  assert.equal(r.endPressure, 4);
});

test('a route never loops: it ends on a touched cell, at the edge, or after its step limit', () => {
  // A square of vents would cycle forever; the route stops when it returns.
  const loop = vent(vent(vent(vent(board(), 0, 0, 1), 0, 1, 2), 1, 1, 3), 1, 0, 0);
  const r = sprayRoute(loop);
  assert.equal(new Set(r.path.map((p) => p.i)).size, r.path.length);
  assert.equal(r.path.length, 4);
  for (let seed = 1; seed <= 3000; seed++) {
    const cells = drawBoard('free', seeded(seed)), route = sprayRoute(cells);
    if (!route) continue;
    assert.ok(route.path.length <= MAX_STEPS);
    assert.equal(new Set(route.path.map((p) => p.i)).size, route.path.length);
  }
});

test('touched cells turn wild, vents carry xN, scatters stay scatters', () => {
  const cells = vent(board(), 2, 0, 1); cells[at(2, 3)].s = 'S';
  const painted = paint(cells, sprayRoute(cells));
  assert.deepEqual(painted.map((c, i) => (c.wild ? `${i}:${c.multi}` : null)).filter(Boolean), [`${at(2, 0)}:2`, `${at(2, 1)}:1`, `${at(2, 2)}:1`, `${at(2, 4)}:1`, `${at(2, 5)}:1`]);
  assert.equal(painted[at(2, 3)].s, 'S'); assert.ok(!painted[at(2, 3)].wild);
  assert.equal(cells[at(2, 0)].wild, undefined, 'paint does not change the landed board');
});

test('lines: the first real symbol decides, wilds substitute, xN vents add up, six wilds pay as H1', () => {
  const cells = board('Q');
  for (const reel of [0, 1, 2]) cells[at(0, reel)] = { s: 'H2' };
  cells[at(0, 3)] = { s: 'K', wild: true, multi: 3 }; cells[at(0, 4)] = { s: 'J', wild: true, multi: 2 }; cells[at(0, 5)] = { s: 'A' };
  const top = lineWins(cells).find((w) => w.line === 0);
  assert.deepEqual([top.symbol, top.count, top.multi, top.amount], ['H2', 5, 5, PAYTABLE.H2[2] * 5]);
  const wilds = board('W'); wilds[at(1, 0)].s = 'S';
  assert.equal(lineWins(wilds).find((w) => w.line === 0).symbol, 'H1');
  assert.equal(lineWins(wilds).find((w) => w.line === 0).count, 6);
  assert.equal(lineWins(wilds).find((w) => w.line === 1), undefined, 'a scatter blocks its line');
});

test('every win is a whole 0.1x, every round stays within the 25,000x cap', () => {
  for (const mode of Object.keys(MODES)) for (let seed = 1; seed <= 400; seed++) {
    const r = playRound({ mode, rng: seeded(seed * 31 + mode.length) });
    assert.ok(r.total <= CAP && r.total % 10 === 0, `${mode} ${seed}: ${r.total}`);
    for (const e of r.events) if (e.type === 'wins') for (const w of e.wins) assert.equal(w.amount % 10, 0);
  }
});

test('Blackout Protocol opens with 4 vents on one route', () => {
  for (const shape of OPENINGS) {
    const cells = board(); for (const [row, reel, dir] of shape) vent(cells, row, reel, dir);
    assert.equal(sprayRoute(cells).path.filter((p) => p.vent).length, 4, JSON.stringify(shape));
  }
  const r = playRound({ mode: 'base', rng: seeded(9), forceBonus: 'hidden' });
  const start = r.events.find((e) => e.type === 'blackout');
  assert.equal(start.vents.length, 4); assert.equal(start.reservoir, BONUSES.hidden.reservoirStart);
});

test('bonus rules: sticky vents, Reservoir, retriggers and their caps', () => {
  for (let seed = 1; seed <= 300; seed++) for (const tier of ['regular', 'super', 'hidden']) {
    const r = playRound({ rng: seeded(seed), forceBonus: tier }), spins = r.events.filter((e) => e.type === 'reveal');
    assert.ok(spins.length <= MAX_SPINS);
    let before = null;
    for (const e of spins) {
      const sticky = e.board.flatMap((c, i) => (c.sticky ? [i] : []));
      assert.ok(sticky.length <= MAX_STICKY);
      if (before) for (const i of before) assert.ok(sticky.includes(i), 'a sticky vent stays');
      before = sticky;
    }
    for (const e of r.events.filter((x) => x.type === 'reservoir')) { assert.ok(BONUSES[tier].reservoir); assert.ok(e.after <= MAX_RESERVOIR && e.after >= e.before); }
  }
});

test('Spray Job always sprays from reel 1; a natural bonus is its trigger spin plus the bonus', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const spray = playRound({ mode: 'sprayjob', rng: seeded(seed) }).events.find((e) => e.type === 'spray' && !e.tier);
    assert.ok(spray && spray.entry % 6 === 0, `seed ${seed}`);
  }
  for (const [tier, scatters] of [['regular', 3], ['super', 4], ['hidden', 5]]) for (let seed = 1; seed <= 40; seed++) {
    const natural = playRound({ mode: 'base', rng: seeded(seed), bonusRng: seeded(seed + 1e6), triggerScatters: scatters });
    const trigger = natural.events.find((e) => e.type === 'wins' && e.spin === 0).paid, bonus = playRound({ rng: seeded(seed + 1e6), forceBonus: tier });
    assert.equal(natural.tier, tier);
    assert.equal(natural.total, Math.min(CAP, trigger + bonus.total), `${tier} ${seed}`);
  }
});
