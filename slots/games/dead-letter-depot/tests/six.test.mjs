// The six-symbol bonus trial (engine/six.js, dld-six-1): replay, the rack,
// per-tumble meter events (additions before KEY doubles, ceilings), when the
// meter applies, no stamps or jobs, settlement and golden seeds. Its math is
// in SIX.md and never feeds the release figures.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { playSixRound, playSixBonus, selectRack, meterStep, ladderStep, ladderState, ringStep, ringState, SIX, SIX_LADDER, SIX_BALANCED, SIX_STEADY, SIX_KEYRING, SIX_VAULT, SIX_VAULT2, SIX_PERKS, PERKS, PERK_SYMBOL, perkStep, revealFrom, BALANCED_MYSTERY, VARIANTS, SIX_VERSION, LADDER_VERSION, BALANCED_VERSION, STEADY_VERSION, KEYRING_VERSION, VAULT_VERSION, VAULT2_VERSION, PERKS_VERSION, seeded } from '../engine/six.js';
import { settle, winOf } from '../engine/settle.js';
import { spinBoard } from '../engine/engine.js';
import { PREMIUMS, LOWS, CAP } from '../engine/rules.js';
import { sixHash } from '../../../tools/math/dead-letter-depot-six.mjs';

test('a trial round replays exactly from its seed and survives JSON', () => {
  for (const mode of ['base', 'priority', 'nightshift', 'doublepost', 'mystery']) for (const seed of [1, 77, 21737, 2 ** 31 + 9]) {
    const a = playSixRound({ mode, rng: seeded(seed) });
    assert.deepEqual(playSixRound({ mode, rng: seeded(seed) }), a);
    assert.deepEqual(JSON.parse(JSON.stringify(a)), a);
    assert.equal(a.version, SIX_VERSION);
    assert.equal(playSixRound({ mode, rng: seeded(seed), record: false }).total, a.total, 'recording never changes the outcome');
    for (const [variant, version] of [['keyring', KEYRING_VERSION], ['vault', VAULT_VERSION], ['vault2', VAULT2_VERSION], ['perks', PERKS_VERSION]]) {
      const k = playSixRound({ mode, rng: seeded(seed), variant });
      assert.deepEqual(JSON.parse(JSON.stringify(k)), k);
      assert.equal(k.version, version);
      assert.equal(playSixRound({ mode, rng: seeded(seed), variant, record: false }).total, k.total, `recording never changes a ${variant} outcome`);
    }
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
// Steady golden replays (dld-six-4).
export const STEADY_GOLDEN = [
  ['base', 134, 1440], ['base', 1672, 700],                      // the spin rack lifts a base win; natural Night Shift
  ['nightshift', 4, 17660], ['doublepost', 1, 23680],            // steady Night Shift; Double Post
  ['mystery', 4, 1147860], ['mystery', 89, 100000], ['mystery', 1, 23720], // Lost & Found past 1,000x by itself; at the minimum; Double Post
  ['mystery', 4901, CAP],                                        // Lost & Found reaches the cap
];
// Key-ring golden replays (dld-six-5).
export const KEYRING_GOLDEN = [
  ['base', 134, 1440], ['base', 1672, 6840],                     // the spin rack lifts a base win; natural Night Shift with ring fills
  ['priority', 1845, 264720],                                    // natural Lost & Found
  ['nightshift', 1, 3260], ['doublepost', 1, 10600],             // a ring fill activates a spin with no rack hit; Double Post with 3 fills
  ['doublepost', 2913, 289480],                                  // Double Post opens the vault
  ['mystery', 4, 220100], ['mystery', 43, 100000], ['mystery', 1, 34440], // Lost & Found past 1,000x by itself; at the minimum; Double Post
  ['mystery', 7407, CAP],                                        // Lost & Found opens the vault and reaches the cap
];
// Vault golden replays (dld-six-6).
export const VAULT_GOLDEN = [
  ['base', 134, 1920], ['base', 1672, 3940],                     // the base rack doubles twice; natural Night Shift
  ['priority', 1845, 162140],                                    // natural Lost & Found
  ['nightshift', 1, 6120], ['nightshift', 24393, CAP],           // a ring fill activates a spin with no rack hit; the Night Shift vault reaches the cap
  ['doublepost', 7, 31180], ['doublepost', 950, CAP],            // Double Post; its vault reaches the cap
  ['mystery', 4, 194800], ['mystery', 89, 100000], ['mystery', 1, 12460], // Lost & Found past 1,000x by itself; at the minimum; Double Post
  ['mystery', 2910, CAP],                                        // the Lost & Found vault reaches the cap
];
// Vault 2 golden replays (dld-six-7).
export const VAULT2_GOLDEN = [
  ['base', 134, 1920], ['base', 1672, 3440],                     // the base rack doubles twice; natural Night Shift
  ['priority', 1845, 100000],                                    // natural Lost & Found at the minimum
  ['nightshift', 1, 6180], ['nightshift', 284, 447660],          // a ring fill activates a spin with no rack hit; the 60x vault
  ['doublepost', 4, 20300], ['doublepost', 422, 418500],         // Double Post; the 120x vault
  ['mystery', 4, 295240], ['mystery', 89, 100000], ['mystery', 1, 19220], // Lost & Found past 1,000x by itself; at the minimum; Double Post
  ['mystery', 2572, CAP],                                        // the Lost & Found vault reaches the cap
  ['nightshift', 14287, CAP], ['doublepost', 646910, CAP],       // inner vaults (a second KEY match) reach the cap
];
// Perks golden replays (dld-six-8).
export const PERKS_GOLDEN = [
  ['base', 134, 1920], ['base', 1672, 19600],                    // the base rack doubles twice; natural Night Shift
  ['nightshift', 7, 20660], ['nightshift', 5, 11860],            // Build + Return with Return firing; Unpack + Deliver, both firing
  ['nightshift', 9, 27600],                                      // a +10x vault reveal
  ['doublepost', 1, 25920], ['doublepost', 19, 65100],           // every perk fires; a +25x reveal
  ['mystery', 89, 124940], ['mystery', 4, 100000], ['mystery', 1, 27460], // Lost & Found opens at 30x+ and passes 1,000x by itself; at the minimum; Double Post
  ['mystery', 1629, CAP],                                        // Lost & Found opens at 1,000x and reaches the cap
];
test('golden replays settle to these totals', () => {
  for (const [mode, seed, total] of PERKS_GOLDEN) assert.equal(playSixRound({ mode, rng: seeded(seed), record: false, variant: 'perks' }).total, total, `perks ${mode} ${seed}`);
  for (const [mode, seed, total] of VAULT2_GOLDEN) assert.equal(playSixRound({ mode, rng: seeded(seed), record: false, variant: 'vault2' }).total, total, `vault2 ${mode} ${seed}`);
  for (const [mode, seed, total] of VAULT_GOLDEN) assert.equal(playSixRound({ mode, rng: seeded(seed), record: false, variant: 'vault' }).total, total, `vault ${mode} ${seed}`);
  for (const [mode, seed, total] of KEYRING_GOLDEN) assert.equal(playSixRound({ mode, rng: seeded(seed), record: false, variant: 'keyring' }).total, total, `keyring ${mode} ${seed}`);
  for (const [mode, seed, total] of STEADY_GOLDEN) assert.equal(playSixRound({ mode, rng: seeded(seed), record: false, variant: 'steady' }).total, total, `steady ${mode} ${seed}`);
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

test('steady: higher meters, lower ceilings, Lost & Found from 50x with its 1,000x minimum', () => {
  assert.equal(playSixRound({ mode: 'base', rng: seeded(3), variant: 'steady' }).version, STEADY_VERSION);
  let natural = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const b = playSixBonus('hidden', seeded(seed), CAP, { spec: VARIANTS.steady.spec, lands: VARIANTS.steady.lands, record: false });
    assert.equal(b.spins[0].meter.start, SIX_STEADY.hidden.start);
    assert.ok(b.total >= SIX_STEADY.hidden.floor);
    if (!b.floorTopUp) natural += 1;
    for (const s of b.spins) assert.ok(s.meter.after <= SIX_STEADY.hidden.ceiling);
  }
  assert.ok(natural > 75, `${natural}/300 Lost & Found bonuses passed 1,000x by themselves`);
  for (const tier of ['regular', 'super']) for (let seed = 1; seed <= 200; seed++) {
    const b = playSixBonus(tier, seeded(seed), CAP, { spec: VARIANTS.steady.spec, lands: VARIANTS.steady.lands, record: false });
    for (const s of b.spins) assert.ok(s.meter.after <= SIX_STEADY[tier].ceiling);
  }
});

test('key ring: every bonus racks KEY with two other premiums and three basics', () => {
  for (const variant of ['keyring', 'vault', 'vault2']) for (const tier of ['regular', 'super', 'hidden']) for (let seed = 1; seed <= 200; seed++) {
    const { rack } = playSixBonus(tier, seeded(seed), CAP, { spec: VARIANTS[variant].spec, lands: VARIANTS[variant].lands, record: false });
    assert.equal(new Set(rack).size, 6);
    assert.equal(rack.filter((s) => LOWS.includes(s)).length, 3);
    assert.ok(rack.includes('KEY'));
  }
});

test('key ring events: capped ladder additions, notches carry, a full ring adds, a KEY match opens the vault', () => {
  const w = (...x) => x.map((s) => ({ s })), t = SIX_KEYRING.super;
  const rack = ['Q', 'K', '10', 'PHONE', 'PARCEL', 'KEY'], st = ringState(rack);
  assert.deepEqual(st, { next: { Q: 1, K: 1, 10: 1, PHONE: 3, PARCEL: 3 }, notches: 0, vault: false });
  let e = ringStep(15, [], 3, rack, st, t);
  assert.deepEqual([e.add, e.fills, e.notches, e.after], [0, 0, 3, 15], 'three KEYs on the first board turn three notches');
  e = ringStep(e.after, w('Q', 'PHONE'), 2, rack, st, t);
  assert.deepEqual([e.add, e.fills, e.notches, e.after, e.next.Q, e.next.PHONE], [4, 1, 0, 15 + 4 + t.ringAdd, 2, 6], 'additions, then two refill KEYs fill the ring');
  e = ringStep(e.after, w('Q', 'PHONE', 'J'), 0, rack, st, t);
  assert.deepEqual([e.add, e.after, e.next.Q, e.next.PHONE], [8, 27 + t.ringAdd, 2, 6], 'additions stop doubling at +2 and +6; unracked J never moves the meter');
  e = ringStep(e.after, [], 11, rack, st, t);
  assert.deepEqual([e.fills, e.notches, e.after], [2, 1, 27 + 3 * t.ringAdd], 'eleven KEYs: two full rings and one notch carried');
  assert.equal(ringStep(95, [], 5, rack, { ...ringState(rack) }, t).after, t.ceiling, 'a ring fill stops at the ceiling');
  e = ringStep(e.after, w('KEY'), 0, rack, st, t);
  assert.deepEqual([e.opened, e.vault, e.after], [true, true, t.ceiling], 'a KEY match opens the vault');
  e = ringStep(e.after, w('K'), 0, rack, st, t);
  assert.deepEqual([e.opened, e.vault, e.after], [false, true, t.ceiling], 'the vault holds the meter at the ceiling');
});

for (const variant of ['keyring', 'vault', 'vault2']) test(`${variant} bonuses replay their key-ring events and apply the meter by the tier rule`, () => {
  const seen = { fill: 0, quietRing: 0, vault: 0, floor: 0, faceValue: 0 };
  for (const tier of ['regular', 'super', 'hidden']) for (let seed = 1; seed <= 200; seed++) {
    const b = playSixBonus(tier, seeded(seed), CAP, { spec: VARIANTS[variant].spec, lands: VARIANTS[variant].lands }), t = VARIANTS[variant].spec[tier], st = ringState(b.rack);
    let meter = t.start, total = 0, fills = 0;
    for (const s of b.spins) {
      assert.equal(s.meter.start, meter);
      const keys0 = s.board.flat().filter((c) => c.s === 'KEY').length, land = ringStep(meter, [], keys0, b.rack, st, t);
      assert.deepEqual(s.land, land); meter = land.after;
      let spinFills = land.fills, hit = false;
      for (const step of s.steps) {
        const e = ringStep(meter, step.wins, step.refills.filter((f) => f[2] === 'KEY').length, b.rack, st, t);
        assert.deepEqual(step.rack, e); meter = e.after; spinFills += e.fills;
        if (e.hits.some((x) => x !== 'KEY')) hit = true;
        if (e.opened) seen.vault += 1;
      }
      const active = t.when === 'always' || hit || spinFills > 0 || st.vault;
      assert.deepEqual([s.meter.after, s.meter.fills, s.meter.hit, s.meter.active, s.meter.vault], [meter, spinFills, hit, active, st.vault]);
      assert.ok(meter <= (st.inner ? t.innerAt : t.ceiling));
      assert.equal(s.multiplier, active ? meter : 1);
      assert.equal(s.win, s.subtotal * s.multiplier);
      if (spinFills) seen.fill += 1;
      if (tier === 'regular' && !hit && spinFills && !st.vault) seen.quietRing += 1;
      if (tier === 'regular' && !active && s.subtotal) seen.faceValue += 1;
      fills += spinFills; total += s.paid;
    }
    assert.equal(b.ringFills, fills);
    assert.equal(b.vault, st.vault);
    assert.equal(b.total, Math.max(total, t.floor ? Math.min(t.floor, CAP) : 0));
    if (b.floorTopUp) seen.floor += 1;
  }
  for (const [k, v] of Object.entries(seen)) if (k !== 'vault') assert.ok(v > 0, `saw ${k}`);
});

for (const variant of ['keyring', 'vault', 'vault2']) test(`${variant}: the vault opens on a KEY match and pays at the ceiling from then on`, () => {
  let found = 0;
  const spec = VARIANTS[variant].spec;
  for (let seed = 1; seed <= 6000 && found < 3; seed++) {
    const b = playSixBonus('hidden', seeded(seed), CAP, { spec, lands: VARIANTS[variant].lands, record: false });
    if (!b.vault) continue;
    found += 1;
    const at = b.spins.findIndex((s) => s.meter.vault);
    assert.equal(b.spins[at].keyHits > 0, true, 'the vault opens on the spin with the KEY match');
    for (const s of b.spins.slice(at)) assert.deepEqual([s.meter.after, s.multiplier], [spec.hidden.ceiling, spec.hidden.ceiling]);
    for (const s of b.spins.slice(0, at)) assert.equal(s.meter.vault, false);
  }
  assert.ok(found > 0, 'a Lost & Found vault within 6,000 seeds');
});

test('vault: Night Shift basics switch the meter on without adding; premiums add +1; every vault is 1,000x', () => {
  const w = (...x) => x.map((s) => ({ s })), t = SIX_VAULT.regular, rack = ['Q', 'K', '10', 'PHONE', 'PARCEL', 'KEY'], st = ringState(rack);
  let e = ringStep(2, w('Q', 'K'), 0, rack, st, t);
  assert.deepEqual([e.hits, e.add, e.after], [['Q', 'K'], 0, 2], 'racked basics are hits that add nothing');
  e = ringStep(e.after, w('PHONE'), 0, rack, st, t);
  e = ringStep(e.after, w('PHONE'), 0, rack, st, t);
  assert.deepEqual([e.add, e.after, e.next.PHONE], [1, 4, 1], 'a racked premium adds +1 every time');
  e = ringStep(e.after, [], 5, rack, st, t);
  assert.equal(e.after, 4 + t.ringAdd);
  for (const tier of ['regular', 'super', 'hidden']) assert.equal(SIX_VAULT[tier].ceiling, 1000);
});

test('vault 2: the first KEY match opens the vault at the ceiling, a second opens the 1,000x inner vault', () => {
  const w = (...x) => x.map((s) => ({ s })), rack = ['Q', 'K', '10', 'PHONE', 'PARCEL', 'KEY'];
  for (const tier of ['regular', 'super']) {
    const t = SIX_VAULT2[tier], st = ringState(rack);
    let e = ringStep(t.start, w('Q'), 0, rack, st, t);
    assert.deepEqual([e.opened, e.innerOpened, e.inner, e.after], [false, false, false, t.start]);
    e = ringStep(e.after, w('KEY'), 0, rack, st, t);
    assert.deepEqual([e.opened, e.innerOpened, e.vault, e.inner, e.after], [true, false, true, false, t.ceiling], `${tier} vault`);
    e = ringStep(e.after, w('K'), 7, rack, st, t);
    assert.equal(e.after, t.ceiling, 'ring fills never lift an open vault');
    e = ringStep(e.after, w('KEY'), 0, rack, st, t);
    assert.deepEqual([e.opened, e.innerOpened, e.inner, e.after], [false, true, true, t.innerAt], `${tier} inner vault`);
    e = ringStep(e.after, w('KEY'), 0, rack, st, t);
    assert.deepEqual([e.innerOpened, e.after], [false, t.innerAt]);
  }
  assert.equal(SIX_VAULT2.hidden.innerAt, undefined, 'Lost & Found opens straight at 1,000x');
  const k = ringStep(1, [], 0, rack, ringState(rack), SIX_KEYRING.super);
  assert.equal('inner' in k, false, 'earlier variants keep their event shape');
});

const perkSpec = VARIANTS.perks.spec, perkLands = VARIANTS.perks.lands;
test('perks: Night Shift draws 2 of the 4, Double Post and Lost & Found all 4; Build marks two basics; only Lost & Found opens a vault first', () => {
  const pairs = new Set();
  for (const tier of ['regular', 'super', 'hidden']) for (let seed = 1; seed <= 300; seed++) {
    const b = playSixBonus(tier, seeded(seed), CAP, { spec: perkSpec, lands: perkLands, record: false });
    assert.equal(b.perks.length, SIX_PERKS[tier].perks);
    assert.deepEqual(b.perks, PERKS.filter((p) => b.perks.includes(p)), 'perks are listed in the canonical order');
    if (tier === 'regular') pairs.add(b.perks.join('+'));
    if (b.perks.includes('build')) { assert.equal(b.build.length, SIX_PERKS[tier].buildMarks); assert.ok(b.build.every((x) => LOWS.includes(x)) && new Set(b.build).size === b.build.length); } else assert.equal(b.build, null);
    if (tier === 'hidden') assert.ok(SIX_PERKS.hidden.opening.some(([v]) => v === b.opening)); else assert.equal(b.opening, 0);
    assert.equal(b.spins[0].meter.start, Math.min(SIX_PERKS[tier].ceiling, SIX_PERKS[tier].start + b.opening));
  }
  assert.equal(pairs.size, 6, 'every Night Shift pair occurs');
});

test('engine perks: each fires at most once a spin, only with enough of its symbol on the board; Return pays the spin twice', () => {
  const seen = { return: 0, unpack: 0, deliver: 0 };
  for (let seed = 1; seed <= 3000; seed++) {
    const r = spinBoard('hidden', seeded(seed), { lands: perkLands, targets: Object.fromEntries(['KEY', 'PHONE', 'PARCEL', 'ENVELOPE', 'A', 'K', 'Q', 'J', '10'].map((x) => [x, Infinity])), record: true, perks: [['ENVELOPE', 3], ['PARCEL', 5], ['PHONE', 2]] });
    const plain = spinBoard('hidden', seeded(seed), { lands: perkLands, targets: Object.fromEntries(['KEY', 'PHONE', 'PARCEL', 'ENVELOPE', 'A', 'K', 'Q', 'J', '10'].map((x) => [x, Infinity])), record: true });
    assert.equal(new Set(r.perks.map((f) => f.s)).size, r.perks.length, 'once a spin each');
    for (const f of r.perks) seen[f.job] += 1;
    const ret = r.perks.find((f) => f.job === 'return');
    if (ret) assert.equal(r.subtotal, 2 * ret.returned);
    if (!r.perks.length) assert.deepEqual([r.subtotal, r.board], [plain.subtotal, plain.board], 'no perk, same spin');
    if (!r.perks.length) for (const b of [r.board, ...r.steps.map((st) => st.after)]) {
      const n = (x) => b.flat().filter((c) => c.s === x).length;
      assert.ok(n('ENVELOPE') < 3 && n('PARCEL') < 5 && n('PHONE') < 2, 'a perk with enough symbols always fires');
    }
  }
  for (const [k, v] of Object.entries(seen)) assert.ok(v > 0, `saw ${k}`);
});

test('perk events: KEYs and Build hits turn notches; each full ring reveals a multiplier that adds', () => {
  const w = (...x) => x.map((s) => ({ s })), t = SIX_PERKS.super, st = { build: ['Q', 'K'], notches: 0 };
  let e = perkStep(5, [], 3, st, t, () => 0.5);
  assert.deepEqual([e.hits, e.fills, e.notches, e.reveals, e.after], [[], 0, 3, [], 5]);
  e = perkStep(e.after, w('Q', 'J', 'K'), 1, st, t, () => 0);
  assert.deepEqual([e.hits, e.fills, e.notches, e.reveals, e.after], [['Q', 'K'], 1, 1, [t.reveal[0][0]], 5 + t.reveal[0][0]], 'two Build hits and one KEY fill the ring; unmarked J never counts');
  e = perkStep(e.after, [], 9, st, t, () => 0.999999);
  assert.deepEqual([e.fills, e.notches, e.reveals], [2, 0, [t.reveal.at(-1)[0], t.reveal.at(-1)[0]]]);
  assert.equal(e.after, t.ceiling, 'the meter stops at the ceiling');
  assert.equal(revealFrom([[1, 1], [2, 3]], 0.24), 1);
  assert.equal(revealFrom([[1, 1], [2, 3]], 0.26), 2);
});

test('perk bonuses replay: spin meters add their reveals, charges are kept, wins and totals add up', () => {
  let fires = 0, reveals = 0, floors = 0;
  for (const tier of ['regular', 'super', 'hidden']) for (let seed = 1; seed <= 150; seed++) {
    const b = playSixBonus(tier, seeded(seed), CAP, { spec: perkSpec, lands: perkLands }), t = SIX_PERKS[tier];
    const left = Object.fromEntries(b.perks.filter((p) => PERK_SYMBOL[p]).map((p) => [p, t.charges[p]]));
    let meter = b.spins[0].meter.start, total = 0, fills = 0;
    for (const s of b.spins) {
      assert.equal(s.meter.start, meter);
      const events = [s.land, ...s.steps.map((st) => st.rack)];
      for (const [i, e] of events.entries()) {
        assert.equal(e.before, i ? events[i - 1].after : meter);
        assert.equal(e.after, Math.min(t.ceiling, e.before + e.reveals.reduce((a, v) => a + v, 0)));
        for (const v of e.reveals) assert.ok(t.reveal.some(([x]) => x === v));
        if (!b.build) assert.equal(e.hits.length, 0);
      }
      meter = s.meter.after;
      assert.equal(meter, events.at(-1).after);
      assert.equal(s.meter.fills, events.reduce((a, e) => a + e.fills, 0));
      for (const f of s.perks) { assert.ok(b.perks.includes(f.perk)); left[f.perk] -= 1; assert.ok(left[f.perk] >= 0, 'never past its charges'); fires += 1; }
      assert.deepEqual(s.charges, left);
      assert.equal(s.multiplier, meter);
      assert.equal(s.win, s.subtotal * meter);
      total += s.paid; fills += s.meter.fills; reveals += s.reveals.length;
    }
    assert.equal(b.ringFills, fills);
    assert.equal(b.total, total + b.floorTopUp);
    if (t.floor) assert.ok(b.total >= t.floor);
    if (b.floorTopUp) floors += 1;
  }
  assert.ok(fires > 0 && reveals > 0 && floors > 0);
});

test('vault: a racked basic doubles the base spin meter', () => {
  let doubled = 0;
  for (let seed = 1; seed <= 3000; seed++) {
    const r = playSixRound({ mode: 'base', rng: seeded(seed), variant: 'vault' });
    assert.equal(r.spin.rack.length, SIX_VAULT.base.rack);
    let m = 1;
    for (const st of r.spin.steps) { const hits = st.wins.map((x) => x.s).filter((s) => r.spin.rack.includes(s)); assert.deepEqual(st.rack, { hits, factor: 2 ** hits.length, before: m, after: m * 2 ** hits.length }); m *= 2 ** hits.length; }
    assert.equal(r.spin.multiplier, m);
    assert.equal(r.spin.win, Math.min(CAP, r.spin.subtotal * m));
    if (m >= 4) doubled += 1;
  }
  assert.ok(doubled > 10, `${doubled} base spins doubled twice or more`);
});

for (const [variant, file, spec] of [['flat', 'six-summary.json', SIX], ['ladder', 'six-ladder-summary.json', SIX_LADDER], ['balanced', 'six-balanced-summary.json', SIX_BALANCED], ['steady', 'six-steady-summary.json', SIX_STEADY], ['keyring', 'six-keyring-summary.json', SIX_KEYRING], ['vault', 'six-vault-summary.json', SIX_VAULT], ['vault2', 'six-vault2-summary.json', SIX_VAULT2], ['perks', 'six-perks-summary.json', SIX_PERKS]]) test(`the ${variant} trial report was regenerated after the last trial change`, () => {
  const s = JSON.parse(readFileSync(new URL(`../math/${file}`, import.meta.url), 'utf8'));
  assert.equal(s.source, sixHash(), `run node tools/math/dead-letter-depot-six.mjs --variant ${variant}`);
  assert.deepEqual(s.spec, JSON.parse(JSON.stringify(spec)));
  for (const [id, r] of Object.entries(s.modes)) assert.ok(Math.abs(r.rtp - 0.96) <= r.ci999, `${variant} ${id} ${r.rtp} ± ${r.ci999}`);
});
