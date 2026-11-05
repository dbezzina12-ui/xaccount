// The six-symbol bonus trial (engine/six.js, dld-six-1): replay, the rack,
// per-tumble meter events (additions before KEY doubles, ceilings), when the
// meter applies, no stamps or jobs, settlement and golden seeds. Its math is
// in SIX.md and never feeds the release figures.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { playSixRound, playSixBonus, selectRack, meterStep, SIX, SIX_VERSION, seeded } from '../engine/six.js';
import { settle, winOf } from '../engine/settle.js';
import { PREMIUMS, LOWS, CAP } from '../engine/rules.js';
import { sixHash } from '../../../tools/math/dead-letter-depot-six.mjs';

test('a trial round replays exactly from its seed and survives JSON', () => {
  for (const mode of ['base', 'priority', 'nightshift', 'doublepost', 'mystery']) for (const seed of [1, 77, 21737, 2 ** 31 + 9]) {
    const a = playSixRound({ mode, rng: seeded(seed) });
    assert.deepEqual(playSixRound({ mode, rng: seeded(seed) }), a);
    assert.deepEqual(JSON.parse(JSON.stringify(a)), a);
    assert.equal(a.version, SIX_VERSION);
    assert.equal(playSixRound({ mode, rng: seeded(seed), record: false }).total, a.total, 'recording never changes the outcome');
  }
});

test('the rack: three basics and three premiums, all distinct; Lost & Found always racks KEY', () => {
  let keyless = 0;
  for (let seed = 1; seed <= 3000; seed++) for (const tier of ['regular', 'super', 'hidden']) {
    const rack = selectRack(tier, seeded(seed));
    assert.equal(new Set(rack).size, 6);
    assert.equal(rack.filter((s) => LOWS.includes(s)).length, 3);
    assert.equal(rack.filter((s) => PREMIUMS.includes(s)).length, 3);
    if (tier === 'hidden') assert.ok(rack.includes('KEY')); else if (!rack.includes('KEY')) keyless += 1;
  }
  assert.ok(keyless > 0, 'Night Shift and Double Post can rack without KEY');
});

test('meter events: basics +1, premiums +3, additions before the KEY double, capped at the ceiling', () => {
  const w = (...s) => s.map((x) => ({ s: x }));
  const rack = ['Q', 'K', '10', 'PHONE', 'PARCEL', 'KEY'];
  assert.deepEqual(meterStep(3, w('Q', 'J'), rack), { hits: ['Q'], add: 1, doubled: false, before: 3, after: 4 });
  assert.deepEqual(meterStep(3, w('Q', 'KEY'), rack), { hits: ['Q', 'KEY'], add: 1, doubled: true, before: 3, after: 8 });
  assert.equal(meterStep(10, w('PHONE', 'K'), rack).after, 14);
  assert.equal(meterStep(200, w('KEY'), rack, 250).after, 250);
  assert.equal(meterStep(5, w('A', 'ENVELOPE'), rack).after, 5, 'unracked symbols pay but never move the meter');
});

test('every free spin replays its meter events and applies the meter by the tier rule', () => {
  const seen = { lateHit: 0, quiet: 0, keyDouble: 0 };
  for (const tier of ['regular', 'super', 'hidden']) for (let seed = 1; seed <= 300; seed++) {
    const b = playSixBonus(tier, seeded(seed)), t = SIX[tier];
    let meter = t.start, total = 0, firstHit = -1;
    for (const [i, s] of b.spins.entries()) {
      assert.equal(s.meter.start, meter);
      for (const st of s.steps) {
        assert.equal(st.jobs.length, 0, 'no collection jobs in the trial');
        const e = meterStep(meter, st.wins, b.rack, t.ceiling);
        assert.deepEqual(st.rack, e); meter = e.after;
        if (e.doubled) seen.keyDouble += 1;
      }
      for (const cell of s.board.flat()) assert.notEqual(cell.s, 'ST', 'no stamps in the trial');
      assert.equal(s.meter.after, meter);
      const hit = s.steps.some((st) => st.rack.hits.length > 0);
      assert.equal(s.meter.hit, hit);
      assert.equal(s.meter.active, t.when === 'always' || hit);
      assert.equal(s.multiplier, s.meter.active ? meter : 1);
      assert.equal(s.win, s.subtotal * s.multiplier);
      if (tier === 'regular' && hit && firstHit < 0) firstHit = i;
      if (tier === 'regular' && !hit && s.subtotal > 0) seen.quiet += 1;
      total += s.paid;
    }
    if (firstHit >= 6) seen.lateHit += 1;
    assert.equal(b.total, total);
    assert.equal(b.meter, meter);
  }
  for (const [k, v] of Object.entries(seen)) assert.ok(v > 0, `saw ${k}`);
});

test('base and Priority Mail spins have no rack and pay face value; the cap holds', () => {
  for (let seed = 1; seed <= 3000; seed++) {
    const r = playSixRound({ mode: 'base', rng: seeded(seed), record: false });
    assert.equal(r.spin.multiplier, 1);
    assert.equal(r.total, Math.min(CAP, r.spin.subtotal + (r.bonus ? r.bonus.total : 0)));
  }
  const b = playSixBonus('hidden', seeded(4), 3000, { record: false });
  assert.ok(b.total <= 3000);
});

test('settlement is exact cents', () => {
  const r = playSixRound({ mode: 'doublepost', rng: seeded(1) });
  assert.deepEqual(settle(r, 100, 100000), { cost: 25000, win: winOf(r.total, 100), balance: 100000 - 25000 + winOf(r.total, 100) });
});

// Golden replays for the screen (dld-six-1). A change here needs a new SIX_VERSION.
export const GOLDEN = [
  ['base', 52, 5900], ['priority', 4499, 14340],                 // natural Night Shift; natural Lost & Found
  ['nightshift', 8, 2520], ['nightshift', 1, 12220],             // first rack hit on spin 7+; quiet face-value spins and hits
  ['doublepost', 587, 115740], ['doublepost', 10, 26820],        // a KEY double; no KEY in the rack
  ['mystery', 4, 71800], ['mystery', 7, 10060], ['mystery', 1, 16900], // Lost & Found with 2 KEY doubles; Night Shift; Double Post
  ['mystery', 371, CAP],                                         // Lost & Found reaches the 25,000x cap
];
test('golden replays settle to these totals', () => {
  for (const [mode, seed, total] of GOLDEN) assert.equal(playSixRound({ mode, rng: seeded(seed), record: false }).total, total, `${mode} ${seed}`);
});

test('SIX.md and math/six-summary.json were regenerated after the last trial change', () => {
  const s = JSON.parse(readFileSync(new URL('../math/six-summary.json', import.meta.url), 'utf8'));
  assert.equal(s.source, sixHash(), 'run node tools/math/dead-letter-depot-six.mjs');
  assert.deepEqual(s.spec, JSON.parse(JSON.stringify(SIX)));
  for (const [id, r] of Object.entries(s.modes)) assert.ok(Math.abs(r.rtp - 0.96) <= r.ci999, `${id} ${r.rtp} ± ${r.ci999}`);
});
