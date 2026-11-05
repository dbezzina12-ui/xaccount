// Dead Letter Depot: the shipping rules. One config for the engine, the exact
// calculator, the simulator and the screen's buy cards and rules page. Art and
// presentation never decide outcomes: the engine settles a whole round from a
// seeded random source before anything animates.
//
// Amounts are hundredths of the base bet. Every postage value is a whole 0.1x
// (a multiple of 10), so with a bet in whole 10 cents every win is exact cents.
//
// PROTOTYPE MATH: the figures below are calibrated by
// tools/math/dead-letter-depot-fit.mjs and measured by
// tools/math/dead-letter-depot-report.mjs (games/dead-letter-depot/MATH.md).
// Read the RTP from that report, never from these comments.

export { STAGES, LANES, ENTRY, STAMPS, STAMP_NAMES } from './sorter.js';
export const CAP = 2_500_000;                              // 25,000x the base bet across the whole round
export const BONUS_SPINS = 10;

// Stamp weights. Base spins and every paid spin share BASE so Priority Mail,
// Carbon Copy and Registered Mail change only what their card says.
export const BASE_STAMPS = Object.freeze({ U: 21, S: 42, D: 21, F: 6, J: 10 });
export const BONUS_STAMPS = Object.freeze({ U: 18, S: 48, D: 18, F: 12, J: 4 });

// Postage on the three bins of a base or paid spin, drawn afresh for each bin
// every spin and shown before the letter drops: [value in hundredths, weight].
export const BASE_POSTAGE = Object.freeze([
  [20, 3600], [50, 2800], [100, 1700], [200, 1000], [300, 520], [500, 320], [1000, 165],
  [2000, 55], [5000, 16], [10000, 5], [25000, 1.4], [50000, 0.45],
].map(Object.freeze));

// The bonus postage ladder (hundredths). A bin's value is a rung; an upgrade
// moves it one rung up and the top rung holds.
export const LADDER = Object.freeze([
  100, 200, 300, 500, 800, 1200, 2000, 3000, 5000, 8000, 12000, 20000, 30000, 50000,
  80000, 120000, 200000, 300000, 500000,
]);

// FS: each stage independently carries at most one FS seal, on a random lane,
// over whatever stamp is there (a seal never changes the route). 3, 4 or 5
// stages with a seal award Night Shift, Double Dispatch or Lost & Found.
// fs is the chance per stage, solved per mode for 96% by cost.
export const FS = Object.freeze({ base: 0.078844, priority: 0.139281, carbon: 0.090716, registered: 0.095232 });
export const TRIGGER = Object.freeze({ 3: 'regular', 4: 'super', 5: 'hidden' });

// The bonuses. All play BONUS_SPINS spins on BONUS_STAMPS with no FS seals.
// The bins start on a rung (start, or start + 1 with chance lift; the outer
// bins one rung above the middle bin) and keep their value for the whole
// bonus. A delivery pays its bin's value; after the spin pays, upgrades apply:
//   bin    (Night Shift)     each bin that received a delivery rises one rung
//   shared (Double Dispatch, Lost & Found) every bin rises one rung per delivery
export const BONUSES = Object.freeze({
  regular: Object.freeze({ title: 'Night Shift', entries: Object.freeze([1]), rescues: 0, upgrade: 'bin', start: 3, lift: 0.2903 }),
  super: Object.freeze({ title: 'Double Dispatch', entries: Object.freeze([0, 2]), rescues: 0, upgrade: 'shared', start: 1, lift: 0.279449 }),
  hidden: Object.freeze({ title: 'Lost & Found', entries: Object.freeze([0, 1, 2]), rescues: 1, upgrade: 'shared', start: 1, lift: 0.27485 }),
});
export const OUTER_LIFT = Object.freeze([1, 0, 1]); // rungs above start for bins 0, 1, 2

// The ways to play. cost is in multiples of the base bet.
//   spin modes: one board; FS seals can trigger a bonus
//   buy modes: straight into a bonus
export const MODES = Object.freeze({
  base: Object.freeze({ title: 'Base Spin', cost: 1, kind: 'spin', fs: 'base' }),
  priority: Object.freeze({ title: 'Priority Mail', cost: 3, kind: 'spin', fs: 'priority' }),
  carbon: Object.freeze({ title: 'Carbon Copy', cost: 1.5, kind: 'spin', fs: 'carbon', fork: true }),
  registered: Object.freeze({ title: 'Registered Mail', cost: 2.5, kind: 'spin', fs: 'registered', rescues: Infinity }),
  nightshift: Object.freeze({ title: 'Night Shift', cost: 100, kind: 'buy', bonus: 'regular' }),
  doubledispatch: Object.freeze({ title: 'Double Dispatch', cost: 250, kind: 'buy', bonus: 'super' }),
  mystery: Object.freeze({ title: 'Mystery Delivery', cost: 400, kind: 'buy', bonus: null }),
});
// Mystery Delivery draws one of the three bonuses with these chances.
export const MYSTERY = Object.freeze({ regular: 0.4, super: 0.35, hidden: 0.25 });
// Bonus averages the fit solves for (x base bet): the buy prices at 96%, and
// Lost & Found whatever makes Mystery Delivery 96% at its price.
export const TARGETS = Object.freeze({ rtp: 0.96 });

// Win tiers for the presentation. Base and paid spins compare with the base
// bet (min); a bonus buy compares with its price (perCost x price).
export const TIERS = Object.freeze({
  nice: Object.freeze({ title: 'Nice Win', min: 10, perCost: 2 }),
  big: Object.freeze({ title: 'Big Win', min: 25, perCost: 5 }),
  epic: Object.freeze({ title: 'Epic Win', min: 100, perCost: 25 }),
  mythic: Object.freeze({ title: 'Mythic Win', min: 500, perCost: 50 }),
});

// Bets in cents. Whole 10 cents keep every settled win exact.
export const BETS = Object.freeze([20, 40, 60, 80, 100, 150, 200, 300, 400, 500, 1000, 2000, 5000, 10000]);
