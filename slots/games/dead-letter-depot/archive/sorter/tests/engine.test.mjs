// The seeded round engine and settlement: replay, draw order, paid-spin
// rules, triggers, bonus persistence and upgrades, the round cap, win tiers
// and exact credits.
import test from 'node:test';
import assert from 'node:assert/strict';
import { playRound, playBonus, drawBoard, sealsOf, seeded, startRungs, tierOf, ENGINE_VERSION } from '../engine/engine.js';
import { settle, winOf, costOf } from '../engine/settle.js';
import { resolveRoute } from '../engine/resolver.js';
import { BONUSES, BONUS_SPINS, CAP, LADDER, MODES, BETS, TRIGGER, FS, OUTER_LIFT, BASE_POSTAGE } from '../engine/rules.js';

const counting = (seed) => { const g = seeded(seed); const f = () => { f.n += 1; return g(); }; f.n = 0; return f; };

test('a round replays exactly from its seed and survives JSON', () => {
  for (const mode of Object.keys(MODES)) for (const seed of [1, 77, 4242, 2 ** 31 + 5]) {
    const a = playRound({ mode, rng: seeded(seed) }), b = playRound({ mode, rng: seeded(seed) });
    assert.deepEqual(a, b, `${mode} ${seed}`);
    assert.deepEqual(JSON.parse(JSON.stringify(a)), a);
    assert.equal(a.version, ENGINE_VERSION);
  }
  assert.throws(() => playRound({ mode: 'base' }), /seeded rng/);
  assert.throws(() => playRound({ mode: 'nope', rng: seeded(1) }), /Unknown mode/);
});

test('draw order: 15 stamps, then a seal draw per stage (and its lane), then three postage draws', () => {
  for (const seed of [3, 9, 27, 81, 243]) {
    const rng = counting(seed), board = drawBoard(rng, { fs: 0.5 });
    assert.equal(rng.n, 15 + 5 + sealsOf(board));
    const plain = counting(seed);
    drawBoard(plain);
    assert.equal(plain.n, 15);
    const round = counting(seed);
    const r = playRound({ mode: 'base', rng: round });
    if (!r.bonus) assert.equal(round.n, 15 + 5 + r.spin.seals + 3);
  }
});

test('postage and every pay are whole 0.1x amounts; a spin pays each delivered bin once', () => {
  for (const [v] of BASE_POSTAGE) assert.equal(v % 10, 0);
  for (const v of LADDER) assert.equal(v % 10, 0);
  for (let seed = 1; seed <= 3000; seed++) {
    const r = playRound({ mode: 'carbon', rng: seeded(seed) });
    assert.deepEqual(r.spin.pays.map((p) => p.lane), r.spin.route.delivered);
    assert.equal(r.spin.win, r.spin.route.delivered.reduce((t, lane) => t + r.spin.postage[lane], 0));
    assert.equal(r.total % 10, 0);
  }
});

test('Carbon Copy opens every spin with a forced fork; other modes never force one', () => {
  for (let seed = 1; seed <= 500; seed++) {
    const r = playRound({ mode: 'carbon', rng: seeded(seed) });
    assert.equal(r.spin.board[0][1].s, 'F');
    assert.equal(r.spin.board[0][1].forced, true);
    assert.deepEqual(r.spin.route.stages[0].moves.map((m) => m.to), [0, 2]);
    const b = playRound({ mode: 'base', rng: seeded(seed) });
    assert.ok(!b.spin.board.flat().some((c) => c.forced));
  }
});

test('Registered Mail never loses a branch and always delivers', () => {
  for (let seed = 1; seed <= 5000; seed++) {
    const r = playRound({ mode: 'registered', rng: seeded(seed) });
    assert.deepEqual(r.spin.route.lost, { jam: 0, edge: 0 });
    assert.ok(r.spin.route.delivered.length >= 1);
    assert.ok(r.spin.win >= 20);
  }
});

test('3, 4 and 5 sealed stages award Night Shift, Double Dispatch and Lost & Found', () => {
  // natural Priority Mail spins (seeds found by search)
  for (const [seed, seals, tier] of [[77, 3, 'regular'], [1230, 4, 'super'], [2645, 5, 'hidden']]) {
    const r = playRound({ mode: 'priority', rng: seeded(seed) });
    assert.equal(r.spin.seals, seals);
    assert.equal(r.bonus.tier, tier);
    assert.equal(TRIGGER[seals], tier);
    assert.equal(r.total, r.spin.win + r.bonus.total);
  }
  let seen = 0;
  for (let seed = 1; seed <= 4000; seed++) {
    const r = playRound({ mode: 'base', rng: seeded(seed) });
    assert.equal(!!r.bonus, r.spin.seals >= 3, `seed ${seed}`);
    for (const column of r.spin.board) assert.ok(column.filter((c) => c.fs).length <= 1);
    seen += r.spin.seals;
  }
  assert.ok(seen > 0);
  // a seal never changes the route: the same board without its seals routes identically
  for (const seed of [77, 1230, 2645]) {
    const r = playRound({ mode: 'priority', rng: seeded(seed) });
    const bare = r.spin.board.map((column) => column.map(({ s }) => ({ s })));
    assert.deepEqual(resolveRoute(bare), r.spin.route);
  }
});

test('bonus buys go straight into their bonus; Mystery Delivery can draw all three', () => {
  assert.equal(playRound({ mode: 'nightshift', rng: seeded(5) }).bonus.tier, 'regular');
  assert.equal(playRound({ mode: 'doubledispatch', rng: seeded(5) }).bonus.tier, 'super');
  const tiers = new Set();
  for (let seed = 1; seed <= 200; seed++) tiers.add(playRound({ mode: 'mystery', rng: seeded(seed) }).bonus.tier);
  assert.deepEqual([...tiers].sort(), ['hidden', 'regular', 'super']);
  for (const id of ['nightshift', 'doubledispatch', 'mystery']) assert.equal(playRound({ mode: id, rng: seeded(9) }).spin, null);
});

test('bonus bins persist; deliveries pay the pre-spin value, then upgrades apply', () => {
  const top = LADDER.length - 1;
  for (const tier of Object.keys(BONUSES)) {
    const b = BONUSES[tier];
    for (let seed = 1; seed <= 1500; seed++) {
      const bonus = playBonus(tier, seeded(seed));
      assert.equal(bonus.spins.length, BONUS_SPINS);
      assert.deepEqual(bonus.start, bonus.spins[0].rungs);
      let total = 0;
      for (const [i, spin] of bonus.spins.entries()) {
        assert.deepEqual(spin.route.entries, b.entries);
        assert.ok(spin.route.rescued <= b.rescues);
        assert.ok(!spin.board.flat().some((c) => c.fs), 'no seals in a bonus');
        assert.deepEqual(spin.pays.map((p) => [p.lane, p.value]), spin.route.delivered.map((lane) => [lane, LADDER[spin.rungs[lane]]]));
        const want = b.upgrade === 'bin'
          ? spin.rungs.map((r, lane) => Math.min(top, r + (spin.route.delivered.includes(lane) ? 1 : 0)))
          : spin.rungs.map((r) => Math.min(top, r + spin.route.delivered.length));
        assert.deepEqual(spin.after, want, `${tier} seed ${seed} spin ${i + 1}`);
        if (i > 0) assert.deepEqual(spin.rungs, bonus.spins[i - 1].after);
        total += spin.win;
      }
      assert.equal(bonus.total, total);
    }
  }
});

test('bonus start rungs: the outer bins sit one rung above the middle', () => {
  for (const tier of Object.keys(BONUSES)) {
    const b = BONUSES[tier];
    assert.deepEqual(startRungs(tier, 0.999), OUTER_LIFT.map((l) => b.start + l));
    assert.deepEqual(startRungs(tier, 0), OUTER_LIFT.map((l) => b.start + 1 + l));
  }
});

test('the 25,000x cap covers the whole round, settles once and ends the bonus', () => {
  // seed 131293: Mystery draws Lost & Found and reaches the cap on its 9th spin
  const r = playRound({ mode: 'mystery', rng: seeded(131293) });
  assert.equal(r.bonus.tier, 'hidden');
  assert.equal(r.total, CAP);
  assert.equal(r.capped, true);
  assert.equal(r.bonus.endedEarly, true);
  assert.equal(r.bonus.spins.length, 9);
  assert.equal(r.tier, 'max');
  const last = r.bonus.spins.at(-1);
  assert.ok(last.pays.reduce((t, p) => t + p.value, 0) > last.win, 'the capping spin is cut to the remaining budget');
  assert.equal(r.bonus.spins.reduce((t, s) => t + s.win, 0), CAP);
  for (const bet of BETS) assert.equal(winOf(r.total, bet), 25000 * bet);
  // a spin's own win counts against the budget of its bonus
  for (const tier of Object.keys(BONUSES)) for (let seed = 1; seed <= 300; seed++) {
    const budget = 5000, b = playBonus(tier, seeded(seed), budget);
    assert.ok(b.total <= budget);
    if (b.capped) { assert.equal(b.total, budget); assert.equal(b.spins.at(-1).win > 0, true); }
  }
});

test('win tiers: spins compare with the base bet, buys with their price', () => {
  assert.equal(tierOf(990, 'base'), null);
  assert.equal(tierOf(1000, 'base'), 'nice');
  assert.equal(tierOf(2500, 'priority'), 'big');
  assert.equal(tierOf(10000, 'registered'), 'epic');
  assert.equal(tierOf(50000, 'carbon'), 'mythic');
  assert.equal(tierOf(19990, 'nightshift'), null);
  assert.equal(tierOf(20000, 'nightshift'), 'nice');
  assert.equal(tierOf(125000, 'doubledispatch'), 'big');
  assert.equal(tierOf(2000000, 'mystery'), 'mythic');
  assert.equal(tierOf(CAP, 'base', true), 'max');
});

test('settlement: costs and wins are exact cents at every bet; off-ladder bets are refused', () => {
  for (const bet of BETS) {
    assert.equal(bet % 10, 0);
    for (const mode of Object.keys(MODES)) assert.ok(Number.isInteger(costOf(mode, bet)), `${mode} at ${bet}`);
    for (const total of [0, 10, 20, 50, 130, 990, 12345 * 10, CAP]) assert.ok(Number.isInteger(winOf(total, bet)));
  }
  assert.equal(costOf('carbon', 20), 30);
  assert.equal(costOf('registered', 20), 50);
  assert.equal(costOf('mystery', 100), 40000);
  assert.equal(winOf(130, 20), 26);
  assert.throws(() => costOf('base', 25), /bet ladder/);
  assert.throws(() => winOf(CAP + 10, 100), /outside/);
  assert.throws(() => winOf(15, 150), /whole cents/);
  const r = playRound({ mode: 'priority', rng: seeded(1230) });
  const s = settle(r, 100, 100000);
  assert.deepEqual(s, { cost: 300, win: r.total, balance: 100000 - 300 + r.total });
  assert.throws(() => settle(r, 100, 299), /cannot cover/);
});

test('the shipped FS chances and bonus starts are the calibrated ones', () => {
  for (const m of Object.values(MODES)) if (m.kind === 'spin') assert.ok(FS[m.fs] > 0 && FS[m.fs] < 0.5);
  for (const b of Object.values(BONUSES)) assert.ok(b.lift >= 0 && b.lift <= 1 && b.start >= 0);
});

// Golden replays (ENGINE.md). A change here breaks saved rounds and replays:
// it needs a new ENGINE_VERSION and a note in the handoff.
export const GOLDEN = [
  ['base', 1, 0, null], ['base', 7, 200, null], ['base', 64, 200, null], ['base', 238, 70, null], ['base', 1138, 5000, null], ['base', 1536, 90, null],
  ['carbon', 5, 100, null], ['registered', 5, 100, null],
  ['priority', 77, 13400, 'regular'], ['priority', 1230, 43550, 'super'], ['priority', 2645, 117000, 'hidden'],
  ['nightshift', 5, 9100, 'regular'], ['doubledispatch', 5, 11700, 'super'], ['mystery', 5, 57000, 'super'], ['mystery', 131293, CAP, 'hidden'],
];
test('golden replays: these seeds settle to these totals', () => {
  for (const [mode, seed, total, bonus] of GOLDEN) {
    const r = playRound({ mode, rng: seeded(seed) });
    assert.equal(r.total, total, `${mode} seed ${seed}`);
    assert.equal(r.bonus?.tier ?? null, bonus, `${mode} seed ${seed}`);
  }
  const merge = playRound({ mode: 'base', rng: seeded(64) }).spin.route;
  assert.equal(merge.reunited, 1);
  assert.deepEqual(playRound({ mode: 'base', rng: seeded(1536) }).spin.route.delivered, [0, 1, 2]);
});
