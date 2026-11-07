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

export const SIX_VERSION = 'dld-six-1', LADDER_VERSION = 'dld-six-2', BALANCED_VERSION = 'dld-six-3', STEADY_VERSION = 'dld-six-4', KEYRING_VERSION = 'dld-six-5', VAULT_VERSION = 'dld-six-6', VAULT2_VERSION = 'dld-six-7', PERKS_VERSION = 'dld-six-8';
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
// The key ring (Dylan, 2026-11-06: "smoother payouts and meaningful Key
// action"; dld-six-5). The steady base game, Lost & Found minimum and Mystery
// weights, plus:
//   keyRack  every bonus racks KEY (with two of PHONE, PARCEL, ENVELOPE)
//   addCap   the ladder's additions still double after each pay, but only up to
//            [basic, premium]: basics +1 then +2, premiums +3 then +6
//   ring     every KEY that lands in a bonus (first board and refills) turns one
//            notch; each full ring of `ring` notches adds `ringAdd` to the meter.
//            Notches carry across free spins.
//   vault    the first KEY match (8+ KEYs paying) opens the vault: the meter goes
//            to its ceiling and stays there for the rest of the bonus
// KEY no longer multiplies. Night Shift applies the meter on a spin with a rack
// hit, a ring fill or an open vault. lowScale is fitted for every bonus.
export const SIX_KEYRING = Object.freeze({
  base: Object.freeze({ pays: LAND.base.pays, fs: 0.0179, lowScale: 1, rack: 2 }),
  priority: Object.freeze({ pays: LAND.base.pays, fs: 0.0298, lowScale: 1, rack: 2 }),
  regular: Object.freeze({ pays: FREE, fs: 0.012, lowScale: 0.7798, keyWeight: 4, start: 3, ceiling: 60, when: 'hit', ladder: true, keyRack: true, addCap: Object.freeze([2, 6]), ring: 5, ringAdd: 3, vault: true }),
  super: Object.freeze({ pays: FREE, fs: 0.012, lowScale: 0.7831, keyWeight: 4, start: 15, ceiling: 100, when: 'always', ladder: true, keyRack: true, addCap: Object.freeze([2, 6]), ring: 5, ringAdd: 6, vault: true }),
  hidden: Object.freeze({ pays: HIDDEN, fs: 0.012, lowScale: 1.3495, keyWeight: 7, start: 40, ceiling: 1000, when: 'always', ladder: true, keyRack: true, addCap: Object.freeze([2, 6]), ring: 5, ringAdd: 25, vault: true, floor: 100000 }),
});
// The vault (Dylan, 2026-11-06: medium pays in Night Shift and Double Post
// with a chance at the max, decent base hits, an easier Lost & Found max over
// its 1,000x minimum, and fewer losing buys; dld-six-6). The key ring rules,
// plus:
//   ceiling  1,000x in every bonus, so the vault opens at 1,000x everywhere
//   addCap   per bonus: Night Shift and Double Post basics add nothing (in Night
//            Shift a racked hit still switches the meter on) and premiums add
//            +1; Lost & Found keeps +1/+2 and +3/+6
//   rackRule 'double': a racked basic's paying group doubles the base spin meter
// Night Shift and Double Post land thick basics (few dead spins) under small,
// steady meters; their max-win chance is the vault. lowScale is fitted for
// every bonus; the base and Priority Mail lowScale is set by hand.
export const SIX_VAULT = Object.freeze({
  base: Object.freeze({ pays: LAND.base.pays, fs: 0.0181, lowScale: 0.96, rack: 2, rackRule: 'double' }),
  priority: Object.freeze({ pays: LAND.base.pays, fs: 0.03, lowScale: 0.96, rack: 2, rackRule: 'double' }),
  regular: Object.freeze({ pays: FREE, fs: 0.012, lowScale: 1.6837, keyWeight: 5, start: 2, ceiling: 1000, when: 'hit', ladder: true, keyRack: true, addCap: Object.freeze([0, 1]), ring: 5, ringAdd: 1, vault: true }),
  super: Object.freeze({ pays: FREE, fs: 0.012, lowScale: 1.9586, keyWeight: 5.5, start: 5, ceiling: 1000, when: 'always', ladder: true, keyRack: true, addCap: Object.freeze([0, 1]), ring: 5, ringAdd: 1, vault: true }),
  hidden: Object.freeze({ pays: HIDDEN, fs: 0.012, lowScale: 1.4582, keyWeight: 9, start: 30, ceiling: 1000, when: 'always', ladder: true, keyRack: true, addCap: Object.freeze([2, 6]), ring: 5, ringAdd: 20, vault: true, floor: 100000 }),
});
// Vault 2 (Dylan, 2026-11-06: much rarer Night Shift and Double Post max wins,
// about 1 in 250,000 and 1 in 100,000, for bigger hits in their other rounds;
// Lost & Found max about 1 in 250; decent base wins; dld-six-7). The vault
// rules, plus:
//   ceiling  the first KEY match opens the vault at the ceiling: Night Shift
//            60x, Double Post 120x, Lost & Found 1,000x
//   innerAt  a second KEY match in the same bonus opens the inner vault: the
//            meter goes to 1,000x for the rest of the bonus (the max-win path)
// Night Shift and Double Post land more KEYs (so the vault opens about 1 in
// 400 bonuses) on a 7-notch ring. lowScale is fitted for every bonus.
export const SIX_VAULT2 = Object.freeze({
  base: Object.freeze({ pays: LAND.base.pays, fs: 0.0181, lowScale: 0.96, rack: 2, rackRule: 'double' }),
  priority: Object.freeze({ pays: LAND.base.pays, fs: 0.03, lowScale: 0.96, rack: 2, rackRule: 'double' }),
  regular: Object.freeze({ pays: FREE, fs: 0.012, lowScale: 1.8102, keyWeight: 8.5, start: 2, ceiling: 60, innerAt: 1000, when: 'hit', ladder: true, keyRack: true, addCap: Object.freeze([0, 1]), ring: 7, ringAdd: 1, vault: true }),
  super: Object.freeze({ pays: FREE, fs: 0.012, lowScale: 2.12, keyWeight: 9, start: 5, ceiling: 120, innerAt: 1000, when: 'always', ladder: true, keyRack: true, addCap: Object.freeze([0, 1]), ring: 7, ringAdd: 1, vault: true }),
  hidden: Object.freeze({ pays: HIDDEN, fs: 0.012, lowScale: 1.4908, keyWeight: 8.5, start: 30, ceiling: 1000, when: 'always', ladder: true, keyRack: true, addCap: Object.freeze([2, 6]), ring: 5, ringAdd: 20, vault: true, floor: 100000 }),
});
// Perks and the vault reveal (Dylan, 2026-11-07; dld-six-8). Every bonus has a
// 5-notch key ring: every KEY that lands turns a notch, and each full ring
// opens the vault, which reveals a multiplier drawn from the bonus's table
// and adds it to the bonus multiplier for the rest of the bonus. Lost & Found
// also opens a vault before its first spin (its starting multiplier). The
// multiplier applies to every spin. Bonuses start with perks:
//   build    two marked basics; each paying group of one turns a ring notch
//   return   3+ ENVELOPEs on the board: the spin's wins pay twice when it ends
//   unpack   5+ PARCELs on the board turn four more cells into its most common premium
//   deliver  2+ PHONEs on the board bring in the symbols missing from the nearest group
// Night Shift draws 2 of them at random; Double Post and Lost & Found get all
// 4. A premium perk fires at most once a spin (the first check that finds
// enough of its symbol: engine.js spinBoard perks) and at most `charges` times
// a bonus. The counts are balanced so the four perks are worth about the same
// in Night Shift. Draw order: the perks, Build's basics, Lost & Found's
// opening vault, then the spins; each reveal is drawn when its ring fills,
// after that spin's board. The base game is Vault 2's.
export const PERKS = Object.freeze(['build', 'return', 'unpack', 'deliver']);
export const PERK_SYMBOL = Object.freeze({ return: 'ENVELOPE', unpack: 'PARCEL', deliver: 'PHONE' });
const table = (rows) => Object.freeze(rows.map((r) => Object.freeze(r)));
// How many of a perk's symbol on the board fire it (balanced so the four perks
// are worth about the same in Night Shift).
const PERK_AT = Object.freeze({ return: 3, unpack: 5, deliver: 2 });
// Each premium perk works at most this many times a bonus (Build is not limited).
const CHARGES_3 = Object.freeze({ return: 3, unpack: 3, deliver: 3 }), CHARGES_2 = Object.freeze({ return: 2, unpack: 2, deliver: 2 });
export const SIX_PERKS = Object.freeze({
  base: Object.freeze({ pays: LAND.base.pays, fs: 0.0181, lowScale: 0.96, rack: 2, rackRule: 'double' }),
  priority: Object.freeze({ pays: LAND.base.pays, fs: 0.03, lowScale: 0.96, rack: 2, rackRule: 'double' }),
  regular: Object.freeze({ pays: FREE, fs: 0.012, lowScale: 1.102, keyWeight: 4, start: 2, ceiling: 1000, ring: 5, perks: 2, perkAt: PERK_AT, charges: CHARGES_3, buildMarks: 2,
    reveal: table([[1, 75], [2, 18], [3, 4], [5, 2], [10, 0.7], [25, 0.25], [100, 0.04], [1000, 0.002]]) }),
  super: Object.freeze({ pays: FREE, fs: 0.012, lowScale: 1.0159, keyWeight: 3.5, start: 5, ceiling: 1000, ring: 5, perks: 4, perkAt: PERK_AT, charges: CHARGES_2, buildMarks: 2,
    reveal: table([[1, 60], [2, 25], [3, 8], [5, 4], [10, 2], [25, 0.6], [100, 0.1], [250, 0.02], [1000, 0.0014]]) }),
  hidden: Object.freeze({ pays: HIDDEN, fs: 0.012, lowScale: 1.4615, keyWeight: 6, start: 0, ceiling: 1000, ring: 5, perks: 4, perkAt: PERK_AT, charges: CHARGES_3, buildMarks: 2, floor: 100000,
    opening: table([[15, 25], [20, 25], [25, 20], [30, 15], [40, 8], [60, 2], [250, 0.4], [1000, 0.3]]),
    reveal: table([[1, 40], [2, 30], [5, 15], [10, 8], [25, 4], [50, 1.5], [100, 0.5], [250, 0.1], [1000, 0.02]]) }),
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
  pays: Object.fromEntries(PAYING.map((s) => [s, LOWS.includes(s) ? l.pays[s] * l.lowScale : s === 'KEY' ? (l.keyWeight || l.pays[s]) : l.premScale ? l.pays[s] * l.premScale : l.pays[s]])), fs: l.fs, stamp: 0,
}])));
const LANDS = sixLands();
export const VARIANTS = Object.freeze({
  flat: Object.freeze({ version: SIX_VERSION, spec: SIX, lands: LANDS }),
  ladder: Object.freeze({ version: LADDER_VERSION, spec: SIX_LADDER, lands: sixLands(SIX_LADDER) }),
  balanced: Object.freeze({ version: BALANCED_VERSION, spec: SIX_BALANCED, lands: sixLands(SIX_BALANCED), mystery: BALANCED_MYSTERY }),
  steady: Object.freeze({ version: STEADY_VERSION, spec: SIX_STEADY, lands: sixLands(SIX_STEADY), mystery: BALANCED_MYSTERY }),
  keyring: Object.freeze({ version: KEYRING_VERSION, spec: SIX_KEYRING, lands: sixLands(SIX_KEYRING), mystery: BALANCED_MYSTERY }),
  vault: Object.freeze({ version: VAULT_VERSION, spec: SIX_VAULT, lands: sixLands(SIX_VAULT), mystery: BALANCED_MYSTERY }),
  vault2: Object.freeze({ version: VAULT2_VERSION, spec: SIX_VAULT2, lands: sixLands(SIX_VAULT2), mystery: BALANCED_MYSTERY }),
  perks: Object.freeze({ version: PERKS_VERSION, spec: SIX_PERKS, lands: sixLands(SIX_PERKS), mystery: BALANCED_MYSTERY }),
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

// One key-ring event (dld-six-5, dld-six-6): racked non-KEY hits add their next
// addition (never more than t.addCap), which then doubles up to t.addCap; a KEY match opens the vault; then the
// KEYs that landed (`keys`: the first board's, or this tumble's refills) turn
// notches, each full ring adding t.ringAdd; then the ceiling. An open vault
// holds the meter at the ceiling; with t.innerAt, a later KEY match opens the
// inner vault, which holds it at t.innerAt. state carries across the bonus.
export function ringStep(before, wins, keys, rack, state, t) {
  const hits = wins.map((w) => w.s).filter((s) => rack.includes(s));
  let add = 0;
  for (const s of hits) if (s !== 'KEY') { const cap = t.addCap[LOWS.includes(s) ? 0 : 1]; add += Math.min(cap, state.next[s]); state.next[s] = Math.min(cap, state.next[s] * 2); }
  const opened = hits.includes('KEY') && !state.vault, innerOpened = !!t.innerAt && hits.includes('KEY') && state.vault && !opened && !state.inner;
  if (opened) state.vault = true;
  if (innerOpened) state.inner = true;
  const notches = state.notches + keys, fills = Math.floor(notches / t.ring);
  state.notches = notches % t.ring;
  const after = state.inner ? t.innerAt : state.vault ? t.ceiling : Math.min(t.ceiling, before + add + fills * t.ringAdd);
  const e = { hits, add, keys, fills, notches: state.notches, opened, vault: state.vault, before, after, next: { ...state.next } };
  if (t.innerAt) Object.assign(e, { innerOpened, inner: !!state.inner });
  return e;
}
export const ringState = (rack) => ({ next: ladderState(rack).next, notches: 0, vault: false });
const keysIn = (symbols) => symbols.reduce((n, s) => n + (s === 'KEY' ? 1 : 0), 0);

// A key-ring free spin: the first board's KEYs turn notches, then each tumble
// (wins, then its refills' KEYs). The final meter multiplies the subtotal once.
function ringSpin(tier, rng, rack, meter, budget, { lands, spec, record, state }) {
  const r = spinBoard(tier, rng, { lands, targets: NEVER, record: true });
  const t = spec[tier], land = ringStep(meter, [], keysIn(r.board.flat().map((c) => c.s)), rack, state, t);
  let value = land.after, fills = land.fills, hit = false, keyHits = 0;
  for (const step of r.steps) {
    const e = ringStep(value, step.wins, keysIn(step.refills.map((f) => f[2])), rack, state, t);
    value = e.after; fills += e.fills;
    if (e.hits.some((s) => s !== 'KEY')) hit = true;
    if (e.hits.includes('KEY')) keyHits += 1;
    if (record) step.rack = e;
  }
  const active = t.when === 'always' || hit || fills > 0 || state.vault;
  const multiplier = active ? value : 1, win = r.subtotal * multiplier, paid = Math.min(win, budget);
  const out = { subtotal: r.subtotal, meter: { start: meter, after: value, active, hit, fills, vault: state.vault, notches: state.notches }, keyHits, multiplier, win, paid, fs: r.fs, retrigger: 0 };
  if (t.innerAt) out.meter.inner = !!state.inner;
  if (record) Object.assign(out, { board: r.board, land, steps: r.steps });
  return out;
}

// ---- perks (dld-six-8) ----
export const revealFrom = (rows, u) => { let r = u * rows.reduce((a, [, w]) => a + w, 0); for (const [v, w] of rows) if ((r -= w) < 0) return v; return rows.at(-1)[0]; };
export const PERK_OF = Object.freeze(Object.fromEntries(Object.entries(PERK_SYMBOL).map(([p, s]) => [s, p])));
export function drawPerks(t, rng) {
  const drawn = t.perks >= PERKS.length ? [...PERKS] : sample(PERKS, t.perks, rng);
  return PERKS.filter((p) => drawn.includes(p));
}
// One perk event: the KEYs that landed and each paying group of a Build basic
// turn notches; each full ring opens the vault, whose reveal adds to the meter.
export function perkStep(before, wins, keys, state, t, rng) {
  const hits = state.build ? wins.map((w) => w.s).filter((s) => state.build.includes(s)) : [];
  const notches = state.notches + keys + hits.length, fills = Math.floor(notches / t.ring), reveals = [];
  state.notches = notches % t.ring;
  for (let i = 0; i < fills; i++) reveals.push(revealFrom(t.reveal, rng()));
  return { hits, keys, fills, notches: state.notches, reveals, before, after: Math.min(t.ceiling, before + reveals.reduce((a, b) => a + b, 0)) };
}
function perkSpin(tier, rng, meter, budget, { lands, spec, record, state, perks }) {
  const r = spinBoard(tier, rng, { lands, targets: NEVER, record: true, perks });
  const t = spec[tier], land = perkStep(meter, [], keysIn(r.board.flat().map((c) => c.s)), state, t, rng), reveals = [...land.reveals];
  let value = land.after, fills = land.fills;
  for (const step of r.steps) {
    const e = perkStep(value, step.wins, keysIn(step.refills.map((f) => f[2])), state, t, rng);
    value = e.after; fills += e.fills; reveals.push(...e.reveals);
    if (record) step.rack = e;
  }
  const win = r.subtotal * value, paid = Math.min(win, budget);
  const out = { subtotal: r.subtotal, meter: { start: meter, after: value, fills, notches: state.notches, active: true }, reveals, perks: (r.perks ?? []).map((f) => ({ ...f, perk: PERK_OF[f.s] })), multiplier: value, win, paid, fs: r.fs, retrigger: 0, keyHits: 0 };
  if (record) Object.assign(out, { board: r.board, land, steps: r.steps });
  return out;
}
function perkBonus(tier, rng, budget, { lands, spec, record }) {
  const t = spec[tier], perks = drawPerks(t, rng), build = perks.includes('build') ? sample(LOWS, t.buildMarks, rng) : null;
  const opening = t.opening ? revealFrom(t.opening, rng()) : 0, charges = Object.fromEntries(perks.filter((p) => PERK_SYMBOL[p]).map((p) => [p, t.charges[p]]));
  const state = { build, notches: 0 }, spins = [];
  let meter = Math.min(t.ceiling, t.start + opening), awarded = BONUSES[tier].spins, total = 0;
  while (spins.length < awarded && total < budget) {
    const triggers = Object.keys(charges).filter((p) => charges[p] > 0).map((p) => [PERK_SYMBOL[p], t.perkAt[p]]);
    const s = perkSpin(tier, rng, meter, budget - total, { lands, spec, record, state, perks: triggers });
    for (const f of s.perks) charges[f.perk] -= 1;
    s.charges = { ...charges };
    meter = s.meter.after;
    if (s.fs >= RETRIGGER.fs && awarded < MAX_FREE_SPINS) { s.retrigger = Math.min(RETRIGGER.spins, MAX_FREE_SPINS - awarded); awarded += s.retrigger; }
    total += s.paid; spins.push(s);
  }
  const floorTopUp = t.floor && total < Math.min(t.floor, budget) ? Math.min(t.floor, budget) - total : 0;
  total += floorTopUp;
  return { tier, title: BONUSES[tier].title, perks, build, rack: build ?? [], opening, spins, awarded, meter, total, floorTopUp, capped: total >= budget, keyHits: 0,
    ringFills: spins.reduce((a, s) => a + s.meter.fills, 0), reveals: spins.flatMap((s) => s.reveals), perkFires: spins.reduce((a, s) => a + s.perks.length, 0) };
}

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
  if (spec[tier].perks) return perkBonus(tier, rng, budget, { lands, spec, record });
  const t = spec[tier], rack = selectRack(t.keyRack ? 'hidden' : tier, rng), spins = [], state = t.ring ? ringState(rack) : t.ladder ? ladderState(rack) : null;
  let meter = spec[tier].start, awarded = BONUSES[tier].spins, total = 0;
  while (spins.length < awarded && total < budget) {
    const s = (t.ring ? ringSpin : freeSpin)(tier, rng, rack, meter, budget - total, { lands, spec, record, state });
    meter = s.meter.after;
    if (s.fs >= RETRIGGER.fs && awarded < MAX_FREE_SPINS) { s.retrigger = Math.min(RETRIGGER.spins, MAX_FREE_SPINS - awarded); awarded += s.retrigger; }
    total += s.paid; spins.push(s);
  }
  // a guaranteed minimum tops the bonus up when it ends (never past the cap)
  const floorTopUp = spec[tier].floor && total < Math.min(spec[tier].floor, budget) ? Math.min(spec[tier].floor, budget) - total : 0;
  total += floorTopUp;
  const out = { tier, title: BONUSES[tier].title, rack, spins, awarded, meter, total, floorTopUp, capped: total >= budget, keyHits: spins.reduce((a, s) => a + s.keyHits, 0) };
  if (t.ring) Object.assign(out, { ringFills: spins.reduce((a, s) => a + s.meter.fills, 0), vault: state.vault });
  if (t.innerAt) out.inner = !!state.inner;
  return out;
}

// One base or Priority Mail spin. With a spin rack (balanced), the rack is
// drawn first, then the board; each paying group of a racked basic adds +1 to
// the spin's meter (rackRule 'double': doubles it), which multiplies the
// tumble subtotal once.
export function playSixSpin(land, rng, { lands, spec, record = false }) {
  const k = spec[land].rack ?? 0, rack = k ? sample(LOWS, k, rng) : null;
  const r = spinBoard(land, rng, { lands, targets: NEVER, record: record || !!rack });
  let meter = 1;
  if (rack) for (const step of r.steps) {
    const hits = step.wins.map((w) => w.s).filter((s) => rack.includes(s));
    const e = spec[land].rackRule === 'double' ? { hits, factor: 2 ** hits.length, before: meter, after: meter * 2 ** hits.length } : { hits, add: hits.length, before: meter, after: meter + hits.length };
    meter = e.after; if (record) step.rack = e;
  }
  const spin = { rack, subtotal: r.subtotal, multiplier: meter, win: Math.min(CAP, r.subtotal * meter), fs: r.fs };
  if (record) Object.assign(spin, { board: r.board, steps: r.steps });
  return spin;
}

// variant 'flat' (dld-six-1), 'ladder' (dld-six-2), 'balanced' (dld-six-3), 'steady' (dld-six-4), 'keyring' (dld-six-5), 'vault' (dld-six-6), 'vault2' (dld-six-7) or 'perks' (dld-six-8); tools may pass spec and lands.
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
