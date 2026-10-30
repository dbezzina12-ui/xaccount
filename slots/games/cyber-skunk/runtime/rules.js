// Cyber Skunk: the shipping rules (games/cyber-skunk/DESIGN.md). One config
// for the engine, the simulator, the buy screen, the confirmations and the
// rules page. Amounts are hundredths of the base bet; every pay is a whole
// 0.1x (a multiple of 10) and every multiplier is whole, so every win is too.

export const REELS = 6, ROWS = 4, CELLS = REELS * ROWS;
export const CAP = 2_500_000; // 25,000x the base bet, per round
export const MAX_STEPS = 24, MAX_STICKY = 10, MAX_RESERVOIR = 10, MAX_SPINS = 30;

// Cell index = row * REELS + reel. Rows count from 0 at the top.
export const LINES = Object.freeze([
  [0, 0, 0, 0, 0, 0], [1, 1, 1, 1, 1, 1], [2, 2, 2, 2, 2, 2], [3, 3, 3, 3, 3, 3],
  [0, 1, 2, 2, 1, 0], [3, 2, 1, 1, 2, 3], [1, 0, 0, 0, 0, 1], [2, 3, 3, 3, 3, 2],
  [0, 1, 0, 1, 0, 1], [3, 2, 3, 2, 3, 2], [1, 2, 1, 2, 1, 2], [2, 1, 2, 1, 2, 1],
  [0, 0, 1, 2, 3, 3], [3, 3, 2, 1, 0, 0], [1, 1, 0, 0, 1, 1], [2, 2, 3, 3, 2, 2],
  [0, 1, 1, 1, 1, 0], [3, 2, 2, 2, 2, 3], [1, 2, 2, 2, 2, 1], [2, 1, 1, 1, 1, 2],
].map(Object.freeze));

// Paying symbols, highest first, and their pays for 3, 4, 5 and 6 of a kind.
export const PAYTABLE = Object.freeze({
  H1: [50, 150, 500, 1500], H2: [40, 100, 300, 800], H3: [30, 80, 200, 500], H4: [20, 60, 150, 400],
  A: [10, 30, 80, 200], K: [10, 30, 60, 150], Q: [10, 20, 50, 120], J: [10, 20, 40, 100], T: [10, 20, 30, 80],
});
export const PAYING = Object.freeze(Object.keys(PAYTABLE));
export const NAMES = Object.freeze({ H1: 'Battery', H2: 'Rotor', H3: 'Canister', H4: 'Circuit key', A: 'A', K: 'K', Q: 'Q', J: 'J', T: '10', W: 'Wild', S: 'Scatter' });

// Vent outlets: 0 up, 1 right, 2 down, 3 left.
export const DIRS = Object.freeze([[-1, 0], [0, 1], [1, 0], [0, -1]]);

// How each kind of spin draws a board: symbol weights per reel, the chance a
// reel holds a scatter (at most one), and the chance a cell carries a vent.
const symbols = (w) => Object.freeze(w);
const BASE_SYMBOLS = symbols({ H1: 5, H2: 6, H3: 7, H4: 8, A: 10, K: 10, Q: 11, J: 11, T: 12, W: 1.2 });
const FREE_SYMBOLS = symbols({ H1: 6, H2: 7, H3: 8, H4: 9, A: 10, K: 10, Q: 10, J: 10, T: 10, W: 3 });
const LAND = Object.freeze({
  base: { symbols: BASE_SYMBOLS, scatter: 0.065, vent: 0.0045, minVents: 0, reelOneVent: false },
  enhanced: { symbols: BASE_SYMBOLS, scatter: 0.1125, vent: 0.0045, minVents: 0, reelOneVent: false }, // 96% at 3x without reshaping its spins
  // Spray Job: a vent on reel 1 and at least 3 in all, every spin.
  sprayjob: { symbols: BASE_SYMBOLS, scatter: 0.065, vent: 0.0045, minVents: 3, reelOneVent: true },
  free: { symbols: FREE_SYMBOLS, scatter: 0.05, vent: 0.045, minVents: 0, reelOneVent: false },
});
export function landing(kind) { return LAND[kind]; }

// The ways to play. cost is in multiples of the base bet.
export const MODES = Object.freeze({
  base: { title: 'Base Spins', cost: 1, land: 'base', persistent: false },
  enhanced: { title: 'Signal Boost', cost: 3, land: 'enhanced', persistent: true },
  sprayjob: { title: 'Spray Job', cost: 10, land: 'sprayjob', persistent: true },
  ventbreak: { title: 'Vent Break', cost: 100, buy: 'regular' },
  overpressure: { title: 'Overpressure', cost: 250, buy: 'super' },
});

// The bonuses. Only 5 scatters start Blackout Protocol; it is never sold.
export const BONUSES = Object.freeze({
  regular: { title: 'VENT BREAK', scatters: 3, spins: 12, sticky: true, reservoir: true, reservoirStart: 0, reservoirMax: 5, opening: false }, // a smaller Reservoir (Dylan, 2026-10-30: reach the 25,000x cap)
  super: { title: 'OVERPRESSURE', scatters: 4, spins: 10, sticky: true, reservoir: true, reservoirStart: 0, opening: false },
  hidden: { title: 'BLACKOUT PROTOCOL', scatters: 5, spins: 10, sticky: true, reservoir: true, reservoirStart: 3, opening: true },
});
export const RETRIGGER = Object.freeze({ scatters: 3, spins: 4 });
// The natural trigger rates of a way of landing: exact binomial chances of 3,
// 4 and 5+ scatters on 6 reels (at most one scatter per reel).
export function triggerRates(kind) {
  const p = LAND[kind].scatter, C = [1, 6, 15, 20, 15, 6, 1], P = (k) => C[k] * p ** k * (1 - p) ** (6 - k);
  return { regular: P(3), super: P(4), hidden: P(5) + P(6) };
}
export const bonusFor = (scatters) => (scatters >= 5 ? 'hidden' : scatters === 4 ? 'super' : scatters === 3 ? 'regular' : null);
