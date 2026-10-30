// Cyber Skunk: the pure round engine (games/cyber-skunk/DESIGN.md). Every
// round is decided here, from a seeded random source, before anything
// animates; the game, the simulator and the catalogs all call playRound.
import { REELS, ROWS, CELLS, CAP, MAX_STEPS, MAX_STICKY, MAX_RESERVOIR, MAX_SPINS, LINES, PAYTABLE, PAYING, DIRS, MODES, BONUSES, RETRIGGER, landing, bonusFor } from './rules.js';

// mulberry32: small, fast, the same in every browser and in Node.
export function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (weights, rng) => { let total = 0; for (const k in weights) total += weights[k]; let r = rng() * total; for (const k in weights) { r -= weights[k]; if (r < 0) return k; } return Object.keys(weights).at(-1); };
export const reelOf = (i) => i % REELS, rowOf = (i) => Math.floor(i / REELS), at = (row, reel) => row * REELS + reel;

// A landed board: CELLS of { s, vent? }, vent = outlet 0 up / 1 right / 2 down / 3 left.
// scatters: land exactly that many (a trigger spin from the catalogs).
export function drawBoard(kind, rng, sticky = new Map(), scatters = null) {
  const land = landing(kind), cells = [];
  for (let i = 0; i < CELLS; i++) cells.push({ s: pick(land.symbols, rng) });
  if (scatters === null) {
    for (let reel = 0; reel < REELS; reel++) if (rng() < land.scatter) cells[at(Math.floor(rng() * ROWS), reel)].s = 'S';
  } else {
    const reels = [0, 1, 2, 3, 4, 5];
    for (let k = 0; k < scatters; k++) { const reel = reels.splice(Math.floor(rng() * reels.length), 1)[0]; cells[at(Math.floor(rng() * ROWS), reel)].s = 'S'; }
  }
  for (let i = 0; i < CELLS; i++) if (rng() < land.vent) cells[i].vent = Math.floor(rng() * 4);
  // Spray Job: a vent on reel 1, then at least minVents vents, on cells without one.
  if (land.reelOneVent && ![0, 1, 2, 3].some((row) => cells[at(row, 0)].vent !== undefined)) cells[at(Math.floor(rng() * ROWS), 0)].vent = Math.floor(rng() * 4);
  for (let guard = 0; cells.filter((c) => c.vent !== undefined).length < land.minVents && guard < 100; guard++) {
    const i = Math.floor(rng() * CELLS); if (cells[i].vent === undefined) cells[i].vent = Math.floor(rng() * 4);
  }
  // Sticky vents (bonuses) keep their place and outlet.
  for (const [i, dir] of sticky) { cells[i].vent = dir; cells[i].sticky = true; }
  return cells;
}

// The spray route: the spray lands on the left-most vent (the top one when
// two share a reel); a vent sends it out of its outlet and adds 1 pressure;
// every touched cell is recorded with the pressure at that moment. Ends at
// the edge, at a touched cell, or after MAX_STEPS. Never loops or branches.
export function sprayRoute(cells, startPressure = 1) {
  let first = -1;
  for (let reel = 0; reel < REELS && first < 0; reel++) for (let row = 0; row < ROWS; row++) if (cells[at(row, reel)].vent !== undefined) { first = at(row, reel); break; }
  if (first < 0) return null;
  let row = rowOf(first), reel = reelOf(first), dir = 1, pressure = startPressure;
  const path = [], seen = new Set();
  for (let step = 0; step < MAX_STEPS; step++) {
    if (row < 0 || row >= ROWS || reel < 0 || reel >= REELS) break;
    const i = at(row, reel);
    if (seen.has(i)) break;
    seen.add(i);
    const vent = cells[i].vent;
    if (vent !== undefined) { pressure++; dir = vent; }
    path.push({ i, pressure, vent: vent !== undefined, dir });
    row += DIRS[dir][0]; reel += DIRS[dir][1];
  }
  return { entry: first, path, startPressure, endPressure: pressure };
}

// Applies a route: touched cells (except scatters) become wild; a vent the
// route passes becomes a wild carrying x the pressure it raised.
export function paint(cells, route) {
  const out = cells.map((c) => ({ ...c }));
  if (route) for (const { i, pressure, vent } of route.path) if (out[i].s !== 'S') { out[i].wild = true; out[i].multi = vent ? pressure : 1; }
  return out;
}

const isWild = (c) => c.s === 'W' || !!c.wild;
const multOf = (c) => (c.wild && c.multi >= 2 ? c.multi : 0);

// The 20 lines, each paying its best win. Wilds substitute; the first real
// symbol decides the line (six wilds alone pay as H1). A line pays x the sum
// of its xN wilds (x1 when there is none).
export function lineWins(cells) {
  const wins = [];
  LINES.forEach((rows, line) => {
    const lc = rows.map((row, reel) => cells[at(row, reel)]);
    let best = null;
    const consider = (symbol, count) => {
      if (count < 3) return;
      const used = lc.slice(0, count), multi = Math.max(1, used.reduce((t, c) => t + multOf(c), 0));
      const amount = PAYTABLE[symbol][count - 3] * multi;
      if (!best || amount > best.amount) best = { line, symbol, count, multi, base: PAYTABLE[symbol][count - 3], amount, cells: rows.slice(0, count).map((row, reel) => at(row, reel)) };
    };
    let lead = 0; while (lead < REELS && isWild(lc[lead])) lead++;
    if (lead === REELS) consider('H1', lead);
    const first = lc[lead];
    if (first && PAYING.includes(first.s)) { let n = lead; while (n < REELS && (isWild(lc[n]) || lc[n].s === first.s)) n++; consider(first.s, n); }
    if (best) wins.push(best);
  });
  return wins;
}

export const scatterCells = (cells) => cells.flatMap((c, i) => (c.s === 'S' ? [i] : []));

// Blackout Protocol's opening: 4 vents that form one route, from fixed shapes.
// [row, reel, outlet]; each shape's route passes all 4 vents (engine.test.mjs).
const OPENINGS = [
  [[1, 1, 2], [3, 1, 1], [3, 4, 0], [0, 4, 1]],
  [[2, 1, 1], [2, 3, 0], [0, 3, 1], [0, 5, 2]],
  [[0, 2, 2], [2, 2, 1], [2, 4, 0], [1, 4, 1]],
  [[3, 1, 1], [3, 3, 0], [1, 3, 1], [1, 5, 2]],
];
export { OPENINGS };

// One complete round. mode: base | enhanced | sprayjob | ventbreak | overpressure.
// rng plays the paid spin; bonusRng (default: rng) plays any bonus after it.
// The catalogs replay rounds exactly: triggerScatters forces the paid spin's
// scatter count, forceBonus plays a bonus without the paid spin (the buys).
export function playRound({ mode = 'base', rng, bonusRng = rng, forceBonus = null, triggerScatters = null } = {}) {
  const m = MODES[mode];
  if (!m) throw Error('Unknown mode');
  const events = [];
  let total = 0, capped = false;
  const award = (amount) => { const paid = Math.min(amount, CAP - total); total += paid; if (total >= CAP) capped = true; return paid; };

  let draw = rng;
  const spin = (kind, sticky, startPressure, label, scatters = null) => {
    const landed = drawBoard(kind, draw, sticky, scatters);
    events.push({ type: 'reveal', ...label, board: landed, scatters: scatterCells(landed) });
    const route = sprayRoute(landed, startPressure);
    const board = paint(landed, route);
    if (route) events.push({ type: 'spray', ...label, ...route });
    const wins = lineWins(board), raw = wins.reduce((t, w) => t + w.amount, 0), paid = award(raw);
    events.push({ type: 'wins', ...label, board, wins, amount: raw, paid, total });
    return { landed, route, scatters: scatterCells(landed).length };
  };

  let tier = forceBonus || m.buy || null, natural = false;
  if (!m.buy && !forceBonus) {
    const first = spin(m.land, new Map(), 1, { spin: 0 }, triggerScatters);
    tier = bonusFor(first.scatters); natural = !!tier;
  }
  draw = bonusRng;
  if (tier && !capped) {
    const b = BONUSES[tier], sticky = new Map();
    let reservoir = b.reservoirStart, spins = b.spins, played = 0;
    events.push({ type: 'bonusStart', tier, spins, natural, reservoir });
    if (b.opening) {
      const shape = OPENINGS[Math.floor(draw() * OPENINGS.length)];
      for (const [row, reel, dir] of shape) sticky.set(at(row, reel), dir);
      events.push({ type: 'blackout', vents: [...sticky].map(([i, dir]) => ({ i, dir })), reservoir });
    }
    while (played < spins && !capped) {
      played++;
      const start = b.reservoir ? 1 + reservoir : 1;
      const r = spin('free', sticky, start, { spin: played, of: spins, tier, reservoir });
      for (let i = 0; i < r.landed.length; i++) if (r.landed[i].vent !== undefined && !sticky.has(i) && sticky.size < MAX_STICKY) sticky.set(i, r.landed[i].vent);
      if (b.reservoir && r.route) {
        const before = reservoir; reservoir = Math.min(MAX_RESERVOIR, reservoir + (r.route.endPressure - r.route.startPressure));
        if (reservoir !== before) events.push({ type: 'reservoir', before, after: reservoir });
      }
      if (r.scatters >= RETRIGGER.scatters && spins < MAX_SPINS) {
        const add = Math.min(RETRIGGER.spins, MAX_SPINS - spins); spins += add;
        events.push({ type: 'retrigger', add, spins });
      }
    }
    events.push({ type: 'bonusEnd', tier, total, played });
  }
  events.push({ type: 'roundEnd', total, capped, tier });
  return { mode, total, capped, tier, natural, events };
}
