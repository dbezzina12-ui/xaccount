// Dead Letter Depot: the six-symbol bonus trial (dld-six-1). Authoritative
// rules for Codex's producer trial (presentation/six-trial.mjs, 2026-11-05).
// It is kept apart from the release engine and its math: same board, tumbles
// and settlement (engine.js), no stamps and no collection jobs.
//
// Each bonus draws a rack of six symbols: three basics and three premiums
// (Lost & Found: two premiums plus KEY). In every tumble, each paying group of
// a rack symbol moves the meter: a basic adds +1, a premium adds +3, KEY
// doubles. Additions apply before the doubling. The meter carries through
// the bonus (up to the tier's ceiling) and multiplies each spin's tumble
// subtotal once:
//   Night Shift     only on a spin with a rack hit (else face value)
//   Double Post     every spin; the meter starts at 10x
//   Lost & Found    every spin
// Base and paid spins have no rack and pay face value.
//
// Draw order: as engine.js for boards; a bonus then draws its rack (the
// premiums, then the basics, each without replacement) before its first free
// spin; Mystery Delivery draws its tier first.
import { compileLands, spinBoard, tierOf, seeded } from './engine.js';
import { PAYING, PREMIUMS, LOWS, CAP, BONUSES, RETRIGGER, MAX_FREE_SPINS, MYSTERY, LAND, bonusFor } from './rules.js';

export const SIX_VERSION = 'dld-six-1', LADDER_VERSION = 'dld-six-2', BALANCED_VERSION = 'dld-six-3', STEADY_VERSION = 'dld-six-4';
export { seeded };

// The trial's landings: no stamps. Free spins land thick basics so rack hits
// are common; Lost & Found lands KEY often enough to double. Fitted by
// tools/math/dead-letter-depot-six.mjs: lowScale (Night Shift, Double Post),
// keyWeight (Lost & Found) and fs (base, Priority Mail).
const FREE = Object.freeze({ KEY: 6, PHONE: 7, PARCEL: 8, ENVELOPE: 9, A: 22, K: 23, Q: 24, J: 25, 10: 28 });
const HIDDEN = Object.freeze({ KEY: 30, PHONE: 7, PARCEL: 8, ENVELOPE: 9, A: 20, K: 21, Q: 22, J: 23, 10: 25 });
export const SIX = Object.freeze({
  base: Object.freeze({ pays: LAND.base.pays, fs: 0.0212, lowScale: 1 }),
  priority: Object.freeze({ pays: LAND.base.pays, fs: 0.0314, lowScale: 1 }),
  regular: Object.freeze({ pays: FREE, fs: 0.012, lowScale: 1.1226, start: 1, ceiling: 250, when: 'hit' }),
  super: Object.freeze({ pays: FREE, fs: 0.012, lowScale: 1.1259, start: 10, ceiling: 250, when: 'always' }),
  hidden: Object.freeze({ pays: HIDDEN, fs: 0.012, lowScale: 1, keyWeight: 31.1585, start: 1, ceiling: 1000, when: 'always' }),
});
// The ladder variant (Dylan, 2026-11-05 17:14 Cancún; dld-six-2): every rack
// symbol has its own next addition (basics start at +1, premiums at +3) that
// doubles each time that symbol pays; the first KEY match multiplies the
// whole meter by 2 and every later one by 4. Its own fitted landings.
export const SIX_LADDER = Object.freeze({
  base: Object.freeze({ pays: LAND.base.pays, fs: 0.0212, lowScale: 1 }),
  priority: Object.freeze({ pays: LAND.base.pays, fs: 0.0314, lowScale: 1 }),
  regular: Object.freeze({ pays: FREE, fs: 0.012, lowScale: 0.8929, start: 1, ceiling: 250, when: 'hit', ladder: true }),
  super: Object.freeze({ pays: FREE, fs: 0.012, lowScale: 0.956, start: 10, ceiling: 250, when: 'always', ladder: true }),
  hidden: Object.freeze({ pays: HIDDEN, fs: 0.012, lowScale: 1, keyWeight: 25.2363, start: 1, ceiling: 1000, when: 'always', ladder: true }),
});
// The balanced ladder (Dylan, 2026-11-06: "everything super balanced, mid
// wins", a 1,000x minimum on Lost & Found with a decent max rate, Mystery
// Double Post 90% / Lost & Found 10%; dld-six-3). Ladder rules, plus:
//   floor    Lost & Found pays at least this (hundredths) when it ends
//   ceiling  Night Shift and Double Post meters stop lower, trimming rare spikes
//   rack     base and Priority Mail spins draw this many basics before landing;
//            each paying group of one adds +1 to that spin's own meter (from 1x)
// Its own fitted landings.
export const SIX_BALANCED = Object.freeze({
  base: Object.freeze({ pays: LAND.base.pays, fs: 0.0179, lowScale: 1, rack: 2 }),
  priority: Object.freeze({ pays: LAND.base.pays, fs: 0.0298, lowScale: 1, rack: 2 }),
  regular: Object.freeze({ pays: FREE, fs: 0.012, lowScale: 0.9011, start: 1, ceiling: 100, when: 'hit', ladder: true }),
  super: Object.freeze({ pays: FREE, fs: 0.012, lowScale: 0.9656, start: 10, ceiling: 100, when: 'always', ladder: true }),
  hidden: Object.freeze({ pays: HIDDEN, fs: 0.012, lowScale: 1, keyWeight: 25.096, start: 1, ceiling: 1000, when: 'always', ladder: true, floor: 100000 }),
});
export const BALANCED_MYSTERY = Object.freeze({ regular: 0, super: 0.9, hidden: 0.1 });

// The steady ladder (Dylan, 2026-11-06: "steadier for everything, going past
// 1,000x by itself"; dld-six-4). The balanced rules with every bonus's value
// moved from rare spikes into a higher, steadier meter: higher starts, lower
// Night Shift and Double Post ceilings, and Lost & Found starting at 50x with
// fewer KEYs and thicker basics, so about half its bonuses pass 1,000x
// naturally. lowScale is fitted for every bonus.
export const SIX_STEADY = Object.freeze({
  base: Object.freeze({ pays: LAND.base.pays, fs: 0.0179, lowScale: 1, rack: 2 }),
  priority: Object.freeze({ pays: LAND.base.pays, fs: 0.0298, lowScale: 1, rack: 2 }),
  regular: Object.freeze({ pays: FREE, fs: 0.012, lowScale: 0.8789, start: 3, ceiling: 40, when: 'hit', ladder: true }),
  super: Object.freeze({ pays: FREE, fs: 0.012, lowScale: 0.9097, start: 15, ceiling: 50, when: 'always', ladder: true }),
  hidden: Object.freeze({ pays: HIDDEN, fs: 0.012, lowScale: 1.5512, keyWeight: 10, start: 50, ceiling: 1000, when: 'always', ladder: true, floor: 100000 }),
});
export const SIX_MODES = Object.freeze({
  base: Object.freeze({ title: 'Base Spin', cost: 1, kind: 'spin', land: 'base' }),
  priority: Object.freeze({ title: 'Priority Mail', cost: 3, kind: 'spin', land: 'priority' }),
  nightshift: Object.freeze({ title: 'Night Shift', cost: 100, kind: 'buy', bonus: 'regular' }),
  doublepost: Object.freeze({ title: 'Double Post', cost: 250, kind: 'buy', bonus: 'super' }),
  mystery: Object.freeze({ title: 'Mystery Delivery', cost: 400, kind: 'buy', bonus: null }),
});
export const SIX_MYSTERY = MYSTERY;
export const ADD = Object.freeze(Object.fromEntries(PAYING.map((s) => [s, s === 'KEY' ? 0 : LOWS.includes(s) ? 1 : 3])));

export const sixLands = (spec = SIX) => compileLands(Object.fromEntries(Object.entries(spec).map(([k, l]) => [k, {
  pays: Object.fromEntries(PAYING.map((s) => [s, LOWS.includes(s) ? l.pays[s] * l.lowScale : s === 'KEY' && l.keyWeight ? l.keyWeight : l.pays[s]])), fs: l.fs, stamp: 0,
}])));
const LANDS = sixLands();
export const VARIANTS = Object.freeze({
  flat: Object.freeze({ version: SIX_VERSION, spec: SIX, lands: LANDS }),
  ladder: Object.freeze({ version: LADDER_VERSION, spec: SIX_LADDER, lands: sixLands(SIX_LADDER) }),
  balanced: Object.freeze({ version: BALANCED_VERSION, spec: SIX_BALANCED, lands: sixLands(SIX_BALANCED), mystery: BALANCED_MYSTERY }),
  steady: Object.freeze({ version: STEADY_VERSION, spec: SIX_STEADY, lands: sixLands(SIX_STEADY), mystery: BALANCED_MYSTERY }),
});
const NEVER = Object.freeze(Object.fromEntries(PAYING.map((s) => [s, Infinity])));

function sample(pool, count, rng) {
  const bag = [...pool];
  return Array.from({ length: count }, () => bag.splice(Math.floor(rng() * bag.length), 1)[0]);
}
// The rack: premiums first (Lost & Found: two of PHONE/PARCEL/ENVELOPE plus KEY), then three basics.
export function selectRack(tier, rng) {
  const premiums = tier === 'hidden' ? [...sample(PREMIUMS.filter((s) => s !== 'KEY'), 2, rng), 'KEY'] : sample(PREMIUMS, 3, rng);
  return [...sample(LOWS, 3, rng), ...premiums];
}
// One tumble's meter event: additions, then KEY doubles, then the ceiling.
export function meterStep(before, wins, rack, ceiling = Infinity) {
  const hits = wins.map((w) => w.s).filter((s) => rack.includes(s));
  const add = hits.reduce((t, s) => t + ADD[s], 0), doubled = hits.includes('KEY');
  return { hits, add, doubled, before, after: Math.min(ceiling, (before + add) * (doubled ? 2 : 1)) };
}

// One tumble's ladder event: each racked non-KEY hit adds its next addition
// (in rank order), which then doubles; a KEY hit multiplies by the KEY factor
// (2, then 4); then the ceiling. state carries across the bonus.
export function ladderStep(before, wins, rack, state, ceiling = Infinity) {
  const hits = wins.map((w) => w.s).filter((s) => rack.includes(s));
  let value = before, add = 0, keyFactor = 1;
  for (const s of hits) if (s !== 'KEY') { add += state.next[s]; state.next[s] = Math.min(CAP / 100, state.next[s] * 2); }
  value += add;
  if (hits.includes('KEY')) { keyFactor = state.nextKey; value *= keyFactor; state.nextKey = 4; }
  return { hits, add, doubled: keyFactor > 1, keyFactor, before, after: Math.min(ceiling, value), next: { ...state.next }, nextKey: state.nextKey };
}
export const ladderState = (rack) => ({ next: Object.fromEntries(rack.filter((s) => s !== 'KEY').map((s) => [s, ADD[s]])), nextKey: 2 });

function freeSpin(tier, rng, rack, meter, budget, { lands, spec, record, state }) {
  const r = spinBoard(tier, rng, { lands, targets: NEVER, record: true });
  const t = spec[tier], events = [];
  let value = meter;
  for (const step of r.steps) { const e = t.ladder ? ladderStep(value, step.wins, rack, state, t.ceiling) : meterStep(value, step.wins, rack, t.ceiling); events.push(e); value = e.after; if (record) step.rack = e; }
  const hit = events.some((e) => e.hits.length > 0), active = t.when === 'always' || hit;
  const multiplier = active ? value : 1, win = r.subtotal * multiplier, paid = Math.min(win, budget);
  const out = { subtotal: r.subtotal, meter: { start: meter, after: value, active, hit }, keyHits: events.filter((e) => e.doubled).length, multiplier, win, paid, fs: r.fs, retrigger: 0 };
  if (record) Object.assign(out, { board: r.board, steps: r.steps });
  return out;
}

export function playSixBonus(tier, rng, budget = CAP, { lands = LANDS, spec = SIX, record = true } = {}) {
  const rack = selectRack(tier, rng), spins = [], state = spec[tier].ladder ? ladderState(rack) : null;
  let meter = spec[tier].start, awarded = BONUSES[tier].spins, total = 0;
  while (spins.length < awarded && total < budget) {
    const s = freeSpin(tier, rng, rack, meter, budget - total, { lands, spec, record, state });
    meter = s.meter.after;
    if (s.fs >= RETRIGGER.fs && awarded < MAX_FREE_SPINS) { s.retrigger = Math.min(RETRIGGER.spins, MAX_FREE_SPINS - awarded); awarded += s.retrigger; }
    total += s.paid; spins.push(s);
  }
  // a guaranteed minimum tops the bonus up when it ends (never past the cap)
  const floorTopUp = spec[tier].floor && total < Math.min(spec[tier].floor, budget) ? Math.min(spec[tier].floor, budget) - total : 0;
  total += floorTopUp;
  return { tier, title: BONUSES[tier].title, rack, spins, awarded, meter, total, floorTopUp, capped: total >= budget, keyHits: spins.reduce((t, s) => t + s.keyHits, 0) };
}

// One base or Priority Mail spin. With a spin rack (balanced), the rack is
// drawn first, then the board; each paying group of a racked basic adds +1 to
// the spin's meter, which multiplies the tumble subtotal once.
export function playSixSpin(land, rng, { lands, spec, record = false }) {
  const k = spec[land].rack ?? 0, rack = k ? sample(LOWS, k, rng) : null;
  const r = spinBoard(land, rng, { lands, targets: NEVER, record: record || !!rack });
  let meter = 1;
  if (rack) for (const step of r.steps) {
    const hits = step.wins.map((w) => w.s).filter((s) => rack.includes(s)), e = { hits, add: hits.length, before: meter, after: meter + hits.length };
    meter = e.after; if (record) step.rack = e;
  }
  const spin = { rack, subtotal: r.subtotal, multiplier: meter, win: Math.min(CAP, r.subtotal * meter), fs: r.fs };
  if (record) Object.assign(spin, { board: r.board, steps: r.steps });
  return spin;
}

// variant 'flat' (dld-six-1), 'ladder' (dld-six-2), 'balanced' (dld-six-3) or 'steady' (dld-six-4); tools may pass spec and lands.
export function playSixRound({ mode = 'base', rng, variant = 'flat', lands = null, spec = null, record = true } = {}) {
  const v = VARIANTS[variant];
  if (!v) throw Error(`Unknown trial variant ${variant}`);
  spec ??= v.spec; lands ??= v.lands;
  const m = SIX_MODES[mode];
  if (!m) throw Error(`Unknown trial mode ${mode}`);
  if (typeof rng !== 'function') throw Error('playSixRound needs a seeded rng');
  let spin = null, tier = m.bonus ?? null, total = 0;
  if (m.kind === 'spin') {
    spin = playSixSpin(m.land, rng, { lands, spec, record });
    if (!spin.rack) delete spin.rack;
    total = spin.win; tier = bonusFor(spin.fs);
  } else if (mode === 'mystery') {
    const w = v.mystery ?? SIX_MYSTERY, u = rng(); tier = u < w.regular ? 'regular' : u < w.regular + w.super ? 'super' : 'hidden';
  }
  const bonus = tier && total < CAP ? playSixBonus(tier, rng, CAP - total, { lands, spec, record }) : null;
  if (bonus) total += bonus.total;
  const capped = total >= CAP;
  return { version: v.version, mode, cost: m.cost, spin, bonus, total, capped, tier: tierOf(total, mode, capped) };
}
