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

export const SIX_VERSION = 'dld-six-1';
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

function freeSpin(tier, rng, rack, meter, budget, { lands, spec, record }) {
  const r = spinBoard(tier, rng, { lands, targets: NEVER, record: true });
  const t = spec[tier], events = [];
  let value = meter;
  for (const step of r.steps) { const e = meterStep(value, step.wins, rack, t.ceiling); events.push(e); value = e.after; if (record) step.rack = e; }
  const hit = events.some((e) => e.hits.length > 0), active = t.when === 'always' || hit;
  const multiplier = active ? value : 1, win = r.subtotal * multiplier, paid = Math.min(win, budget);
  const out = { subtotal: r.subtotal, meter: { start: meter, after: value, active, hit }, keyHits: events.filter((e) => e.doubled).length, multiplier, win, paid, fs: r.fs, retrigger: 0 };
  if (record) Object.assign(out, { board: r.board, steps: r.steps });
  return out;
}

export function playSixBonus(tier, rng, budget = CAP, { lands = LANDS, spec = SIX, record = true } = {}) {
  const rack = selectRack(tier, rng), spins = [];
  let meter = spec[tier].start, awarded = BONUSES[tier].spins, total = 0;
  while (spins.length < awarded && total < budget) {
    const s = freeSpin(tier, rng, rack, meter, budget - total, { lands, spec, record });
    meter = s.meter.after;
    if (s.fs >= RETRIGGER.fs && awarded < MAX_FREE_SPINS) { s.retrigger = Math.min(RETRIGGER.spins, MAX_FREE_SPINS - awarded); awarded += s.retrigger; }
    total += s.paid; spins.push(s);
  }
  return { tier, title: BONUSES[tier].title, rack, spins, awarded, meter, total, capped: total >= budget, keyHits: spins.reduce((t, s) => t + s.keyHits, 0) };
}

export function playSixRound({ mode = 'base', rng, lands = LANDS, spec = SIX, record = true } = {}) {
  const m = SIX_MODES[mode];
  if (!m) throw Error(`Unknown trial mode ${mode}`);
  if (typeof rng !== 'function') throw Error('playSixRound needs a seeded rng');
  let spin = null, tier = m.bonus ?? null, total = 0;
  if (m.kind === 'spin') {
    const r = spinBoard(m.land, rng, { lands, targets: NEVER, record });
    spin = { subtotal: r.subtotal, multiplier: 1, win: Math.min(CAP, r.subtotal), fs: r.fs, ...(record ? { board: r.board, steps: r.steps } : {}) };
    total = spin.win; tier = bonusFor(r.fs);
  } else if (mode === 'mystery') {
    const u = rng(); tier = u < SIX_MYSTERY.regular ? 'regular' : u < SIX_MYSTERY.regular + SIX_MYSTERY.super ? 'super' : 'hidden';
  }
  const bonus = tier && total < CAP ? playSixBonus(tier, rng, CAP - total, { lands, spec, record }) : null;
  if (bonus) total += bonus.total;
  const capped = total >= CAP;
  return { version: SIX_VERSION, mode, cost: m.cost, spin, bonus, total, capped, tier: tierOf(total, mode, capped) };
}
