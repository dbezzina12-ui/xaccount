// Dead Letter Depot (reels v2: collections and the multiplier meter). One
// config for the engine, the simulator, the fit and the screen. Art and
// presentation never decide outcomes.
//
// Amounts are hundredths of the base bet. Every pay is a whole 0.1x (a
// multiple of 10) and the meter is a whole number, so every award is a whole
// 0.1x and, with a bet in whole 10 cents, exact cents.
//
// PROTOTYPE (Dylan's collection brief, 2026-11-05): starting values, prices,
// targets, increments and the event order are provisional. Fitted figures come
// from tools/math/dead-letter-depot-fit.mjs; read the RTP from MATH.md.

export const REELS = 6, ROWS = 5, CELLS = REELS * ROWS;   // cell = reel * ROWS + row; row 0 is the top
export const MIN_MATCH = 8;                               // 8 or more of a pay symbol anywhere pays
export const CAP = 2_500_000;                             // 25,000x the base bet across the whole round
// Cascade safeguards: a spin stops after MAX_TUMBLES checks; each symbol's job
// fires at most MAX_JOBS times in one spin (extra clears still grow the meter);
// the meter never exceeds MAX_METER.
export const MAX_TUMBLES = 40, MAX_JOBS = 3, MAX_METER = 1000, MAX_FREE_SPINS = 60;

// Pay symbols, highest rank first: pays for 8-9, 10-11 and 12+ anywhere.
export const PAYTABLE = Object.freeze({
  KEY: Object.freeze([2000, 5000, 10000]),
  PHONE: Object.freeze([800, 2000, 5000]),
  PARCEL: Object.freeze([500, 1200, 3000]),
  ENVELOPE: Object.freeze([300, 800, 2000]),
  A: Object.freeze([200, 400, 1600]),
  K: Object.freeze([160, 300, 1200]),
  Q: Object.freeze([100, 200, 800]),
  J: Object.freeze([80, 160, 600]),
  10: Object.freeze([40, 100, 400]),
});
export const PAYING = Object.freeze(['KEY', 'PHONE', 'PARCEL', 'ENVELOPE', 'A', 'K', 'Q', 'J', '10']); // rank order
export const PREMIUMS = Object.freeze(['KEY', 'PHONE', 'PARCEL', 'ENVELOPE']);
export const LOWS = Object.freeze(['A', 'K', 'Q', 'J', '10']);
export const FILTERABLE = Object.freeze(['10', 'J', 'Q']);          // A filters these from refills, in this order
export const FS = 'FS', STAMP = 'ST', WILD = 'W';
export const payFor = (symbol, count) => (count < MIN_MATCH ? 0 : PAYTABLE[symbol][count >= 12 ? 2 : count >= 10 ? 1 : 0]);

// What each collection does when it clears (engine.js has the exact rules).
export const JOBS = Object.freeze({
  10: 'sweep',        // every 10 leaves the board (no pay); survivors drop and refill
  J: 'convert',       // every J becomes the most common visible premium
  Q: 'copy',          // the best row is copied onto the weakest row
  K: 'wild',          // a reel turns wild for the next check
  A: 'filter',        // the next low (10, J, Q) stops landing in refills for the rest of the spin
  ENVELOPE: 'return', // the spin's biggest win so far pays again
  PARCEL: 'unpack',   // four copies of the most common visible premium
  PHONE: 'deliver',   // the copies missing from the nearest match arrive
  KEY: 'vault',       // unpack, wild reel and a multiplier stamp
});

// Collection targets: symbols a collection needs (cleared in wins; wilds and
// job removals never count). Base collections last one spin; bonus progress
// carries across free spins. Lost & Found halves the bonus targets.
export const TARGETS = Object.freeze({
  base: Object.freeze({ KEY: 10, PHONE: 10, PARCEL: 10, ENVELOPE: 12, A: 12, K: 12, Q: 14, J: 14, 10: 14 }),
  bonus: Object.freeze({ KEY: 12, PHONE: 12, PARCEL: 14, ENVELOPE: 16, A: 18, K: 18, Q: 20, J: 20, 10: 24 }),
});
export const targetsFor = (kind) => (kind === 'hidden' ? Object.fromEntries(Object.entries(TARGETS.bonus).map(([k, v]) => [k, Math.max(1, Math.round(v / 2))])) : kind === 'regular' || kind === 'super' ? TARGETS.bonus : TARGETS.base);

// Meter increments per collection clear. 'tiered' is the default; 'flat' is
// the comparison the brief asked for (tools pass incrementScheme).
export const INCREMENTS = Object.freeze({
  flat: Object.freeze({ KEY: 1, PHONE: 1, PARCEL: 1, ENVELOPE: 1, A: 1, K: 1, Q: 1, J: 1, 10: 1 }),
  tiered: Object.freeze({ KEY: 3, PHONE: 3, PARCEL: 2, ENVELOPE: 2, A: 1, K: 1, Q: 1, J: 1, 10: 1 }),
});
export const INCREMENT_SCHEME = 'tiered';

// Stamp values (added to the meter as they land) and their weights.
export const STAMP_VALUES = Object.freeze([
  [1, 300], [2, 260], [3, 160], [5, 100], [8, 50], [10, 40], [15, 15], [20, 10], [25, 6], [50, 3], [100, 1],
].map(Object.freeze));
// Opening stamps (Special Delivery, Double Exposure), previewed before the spin.
export const OPENING_VALUES = Object.freeze([[2, 30], [3, 25], [4, 15], [5, 12], [8, 8], [10, 6], [15, 3], [25, 1]].map(Object.freeze));

// How each kind of spin lands a cell (initial board and every refill):
// relative weights of the pay symbols, then the FS and stamp chances per cell.
// The fit solves each spin mode's fs (96% of its cost) and each bonus's stamp
// chance (its target average); everything else is set by hand.
const PAYS_BASE = Object.freeze({ KEY: 6, PHONE: 7, PARCEL: 8, ENVELOPE: 9, A: 11, K: 12, Q: 13, J: 14, 10: 15 });
const PAYS_FREE = Object.freeze({ KEY: 5, PHONE: 6, PARCEL: 7, ENVELOPE: 8, A: 16, K: 17, Q: 18, J: 19, 10: 21 });
const PAYS_HIDDEN = Object.freeze({ KEY: 5, PHONE: 6, PARCEL: 7, ENVELOPE: 8, A: 14, K: 15, Q: 16, J: 17, 10: 19 });
export const LAND = Object.freeze({
  base: Object.freeze({ pays: PAYS_BASE, fs: 0.018394, stamp: 0.004 }),
  priority: Object.freeze({ pays: PAYS_BASE, fs: 0.030746, stamp: 0.004 }),
  special: Object.freeze({ pays: PAYS_BASE, fs: 0.023757, stamp: 0.004 }),
  exposure: Object.freeze({ pays: PAYS_BASE, fs: 0.024565, stamp: 0.004 }),
  regular: Object.freeze({ pays: PAYS_FREE, fs: 0.012, stamp: 0.008891 }),
  super: Object.freeze({ pays: PAYS_FREE, fs: 0.012, stamp: 0.012733 }),
  hidden: Object.freeze({ pays: PAYS_HIDDEN, fs: 0.012, stamp: 0.010149 }),
});

// FS on the board when a spin's tumbles end: 4, 5 or 6+ award Night Shift,
// Double Post or Lost & Found. In a bonus, 3+ FS add RETRIGGER spins.
export const bonusFor = (fs) => (fs >= 6 ? 'hidden' : fs === 5 ? 'super' : fs === 4 ? 'regular' : null);
export const RETRIGGER = Object.freeze({ fs: 3, spins: 5 });

// The bonuses. The meter starts at `meter` and carries through the bonus.
//   when 'event':  the meter applies only to a spin with a collection clear or a stamp landing
//   when 'always': the meter applies to every spin
//   grow 'add':    a clear adds its increment;  'double': a clear doubles the meter
//   ceiling:       the most the meter can reach (MAX_METER unless set)
// Stamps always add. In a spin: stamps first, then clears, then the final
// meter multiplies the spin's tumble sum once. A filter (A) lasts for its spin.
export const BONUSES = Object.freeze({
  regular: Object.freeze({ title: 'Night Shift', spins: 10, meter: 1, when: 'event', grow: 'add' }),
  super: Object.freeze({ title: 'Double Post', spins: 10, meter: 10, when: 'always', grow: 'add' }),
  hidden: Object.freeze({ title: 'Lost & Found', spins: 10, meter: 1, when: 'always', grow: 'double', ceiling: 64 }),
});

// The ways to play. cost is in multiples of the base bet.
export const MODES = Object.freeze({
  base: Object.freeze({ title: 'Base Spin', cost: 1, kind: 'spin', land: 'base', opening: 0 }),
  priority: Object.freeze({ title: 'Priority Mail', cost: 3, kind: 'spin', land: 'priority', opening: 0 }),
  special: Object.freeze({ title: 'Special Delivery', cost: 2.5, kind: 'spin', land: 'special', opening: 1 }),
  exposure: Object.freeze({ title: 'Double Exposure', cost: 3, kind: 'spin', land: 'exposure', opening: 2 }),
  nightshift: Object.freeze({ title: 'Night Shift', cost: 100, kind: 'buy', bonus: 'regular' }),
  doublepost: Object.freeze({ title: 'Double Post', cost: 250, kind: 'buy', bonus: 'super' }),
  mystery: Object.freeze({ title: 'Mystery Delivery', cost: 400, kind: 'buy', bonus: null }),
});
export const MYSTERY = Object.freeze({ regular: 0.4, super: 0.35, hidden: 0.25 });
export const RTP_TARGET = 0.96;

// Win tiers for the presentation. Spins compare with the base bet; buys with
// their price (perCost x price).
export const TIERS = Object.freeze({
  nice: Object.freeze({ title: 'Nice Win', min: 10, perCost: 2 }),
  big: Object.freeze({ title: 'Big Win', min: 25, perCost: 5 }),
  epic: Object.freeze({ title: 'Epic Win', min: 100, perCost: 25 }),
  mythic: Object.freeze({ title: 'Mythic Win', min: 500, perCost: 50 }),
});

// Bets in cents. Whole 10 cents keep every settled win exact.
export const BETS = Object.freeze([20, 40, 60, 80, 100, 150, 200, 300, 400, 500, 1000, 2000, 5000, 10000]);
