// The six-symbol bonus trial (engine/six.js, dld-six-1): replay, the rack,
// per-tumble meter events (additions before KEY doubles, ceilings), when the
// meter applies, no stamps or jobs, settlement and golden seeds. Its math is
// in SIX.md and never feeds the release figures.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { playSixRound, playSixBonus, selectRack, meterStep, ladderStep, ladderState, SIX, SIX_LADDER, SIX_BALANCED, BALANCED_MYSTERY, VARIANTS, SIX_VERSION, LADDER_VERSION, BALANCED_VERSION, seeded } from '../engine/six.js';
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
// Ladder golden replays (dld-six-2).
export const LADDER_GOLDEN = [
  ['base', 52, 3180],                                            // natural Night Shift
  ['nightshift', 8, 8560], ['nightshift', 4, 22280],             // first rack hit on spin 7+; the ladder climbs to 36x
  ['mystery', 20, 652600], ['mystery', 7, 1440], ['mystery', 1, 17620], // Lost & Found KEY x2 then x4 (3 matches); Night Shift; Double Post
  ['mystery', 432, CAP],                                         // Lost & Found reaches the cap
];
// Balanced golden replays (dld-six-3).
export const BALANCED_GOLDEN = [
  ['base', 134, 1440], ['base', 1672, 460],                      // the spin rack lifts a base win; natural Night Shift
  ['priority', 1845, 100000],                                    // natural Lost & Found, topped up to 1,000x
  ['nightshift', 8, 8560], ['doublepost', 3, 66340],             // first rack hit on spin 7+; Double Post
  ['mystery', 4, 100000], ['mystery', 170, 188580], ['mystery', 1, 23040], // Lost & Found at the minimum; above it; Double Post
  ['mystery', 916, CAP],                                         // Lost & Found reaches the cap
];
test('golden replays settle to these totals', () => {
  for (const [mode, seed, total] of BALANCED_GOLDEN) assert.equal(playSixRound({ mode, rng: seeded(seed), record: false, variant: 'balanced' }).total, total, `balanced ${mode} ${seed}`);
  for (const [mode, seed, total] of GOLDEN) assert.equal(playSixRound({ mode, rng: seeded(seed), record: false }).total, total, `${mode} ${seed}`);
  for (const [mode, seed, total] of LADDER_GOLDEN) assert.equal(playSixRound({ mode, rng: seeded(seed), record: false, variant: 'ladder' }).total, total, `ladder ${mode} ${seed}`);
});

test('ladder events: each racked symbol\'s addition doubles after it pays; KEY multiplies by 2, then 4', () => {
  const w = (...x) => x.map((s) => ({ s }));
  const rack = ['Q', 'K', '10', 'PHONE', 'PARCEL', 'KEY'], st = ladderState(rack);
  assert.deepEqual(st, { next: { Q: 1, K: 1, 10: 1, PHONE: 3, PARCEL: 3 }, nextKey: 2 });
  let e = ladderStep(1, w('Q', 'PHONE'), rack, st);
  assert.deepEqual([e.add, e.after, e.next.Q, e.next.PHONE], [4, 5, 2, 6]);
  e = ladderStep(e.after, w('Q', 'J'), rack, st);
  assert.deepEqual([e.add, e.after, e.next.Q], [2, 7, 4], 'unracked J pays but never moves the meter');
  e = ladderStep(e.after, w('KEY'), rack, st);
  assert.deepEqual([e.keyFactor, e.after, e.nextKey], [2, 14, 4]);
  e = ladderStep(e.after, w('K', 'KEY'), rack, st);
  assert.deepEqual([e.add, e.keyFactor, e.after], [1, 4, 60], 'additions first, then the later KEY quadruples');
  assert.equal(ladderStep(200, w('KEY'), rack, st, 250).after, 250);
});

test('ladder bonuses replay their events from a fresh ladder per bonus', () => {
  let keys = 0;
  for (const tier of ['regular', 'super', 'hidden']) for (let seed = 1; seed <= 200; seed++) {
    const b = playSixBonus(tier, seeded(seed), CAP, { spec: VARIANTS.ladder.spec, lands: VARIANTS.ladder.lands }), t = SIX_LADDER[tier], st = ladderState(b.rack);
    let meter = t.start, total = 0;
    for (const s of b.spins) {
      for (const step of s.steps) { const e = ladderStep(meter, step.wins, b.rack, st, t.ceiling); assert.deepEqual(step.rack, e); meter = e.after; if (e.doubled) keys += 1; }
      assert.equal(s.meter.after, meter);
      assert.equal(s.multiplier, s.meter.active ? meter : 1);
      total += s.paid;
    }
    assert.equal(b.total, total);
  }
  assert.ok(keys > 0);
  const r = playSixRound({ mode: 'mystery', rng: seeded(4), variant: 'ladder' });
  assert.equal(r.version, LADDER_VERSION);
  assert.equal(playSixRound({ mode: 'mystery', rng: seeded(4) }).version, SIX_VERSION);
});

test('balanced: base spins draw a two-basic rack that adds +1 per paying group to the spin meter', () => {
  let lifted = 0;
  for (let seed = 1; seed <= 3000; seed++) {
    const r = playSixRound({ mode: 'base', rng: seeded(seed), variant: 'balanced' });
    assert.equal(r.version, BALANCED_VERSION);
    assert.equal(r.spin.rack.length, SIX_BALANCED.base.rack);
    assert.ok(r.spin.rack.every((s) => LOWS.includes(s)) && new Set(r.spin.rack).size === r.spin.rack.length);
    let m = 1;
    for (const st of r.spin.steps) { const hits = st.wins.map((w) => w.s).filter((s) => r.spin.rack.includes(s)); assert.deepEqual(st.rack, { hits, add: hits.length, before: m, after: m + hits.length }); m += hits.length; }
    assert.equal(r.spin.multiplier, m);
    assert.equal(r.spin.win, Math.min(CAP, r.spin.subtotal * m));
    if (m > 1) lifted += 1;
  }
  assert.ok(lifted > 50);
});

test('balanced: Lost & Found pays at least 1,000x; Mystery draws Double Post or Lost & Found only', () => {
  let topped = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const b = playSixBonus('hidden', seeded(seed), CAP, { spec: VARIANTS.balanced.spec, lands: VARIANTS.balanced.lands, record: false });
    assert.ok(b.total >= SIX_BALANCED.hidden.floor);
    const natural = b.spins.reduce((t, s) => t + s.paid, 0);
    assert.equal(b.floorTopUp, Math.max(0, SIX_BALANCED.hidden.floor - natural));
    if (b.floorTopUp) topped += 1;
  }
  assert.ok(topped > 0);
  const capped = playSixBonus('hidden', seeded(3), 50000, { spec: VARIANTS.balanced.spec, lands: VARIANTS.balanced.lands, record: false });
  assert.equal(capped.total, 50000, 'the minimum never pays past the cap budget');
  assert.equal(BALANCED_MYSTERY.regular, 0);
  const tiers = new Set();
  for (let seed = 1; seed <= 300; seed++) tiers.add(playSixRound({ mode: 'mystery', rng: seeded(seed), variant: 'balanced', record: false }).bonus.tier);
  assert.deepEqual([...tiers].sort(), ['hidden', 'super']);
});

for (const [variant, file, spec] of [['flat', 'six-summary.json', SIX], ['ladder', 'six-ladder-summary.json', SIX_LADDER], ['balanced', 'six-balanced-summary.json', SIX_BALANCED]]) test(`the ${variant} trial report was regenerated after the last trial change`, () => {
  const s = JSON.parse(readFileSync(new URL(`../math/${file}`, import.meta.url), 'utf8'));
  assert.equal(s.source, sixHash(), `run node tools/math/dead-letter-depot-six.mjs --variant ${variant}`);
  assert.deepEqual(s.spec, JSON.parse(JSON.stringify(spec)));
  for (const [id, r] of Object.entries(s.modes)) assert.ok(Math.abs(r.rtp - 0.96) <= r.ci999, `${variant} ${id} ${r.rtp} ± ${r.ci999}`);
});
