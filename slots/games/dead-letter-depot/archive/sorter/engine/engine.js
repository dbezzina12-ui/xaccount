// Dead Letter Depot: the pure round engine. Every round is decided here, from a
// seeded random source, before anything animates; the screen, the simulator and
// the tests all call playRound. The draw order below is part of the replay
// contract: change it only with a new ENGINE_VERSION.
//
// Spin draw order: 15 stamps (stage by stage, top lane first), then for each
// stage one draw for an FS seal and, if it lands, one for its lane, then the
// three bins' postage (top first). A bonus draws one value for its start rung,
// then 15 stamps per spin. Mystery Delivery draws its bonus first.
import { STAGES, LANES, ENTRY, CAP, BONUS_SPINS, BASE_STAMPS, BONUS_STAMPS, BASE_POSTAGE, LADDER, FS, TRIGGER, BONUSES, OUTER_LIFT, MODES, MYSTERY, TIERS } from './rules.js';
import { resolveRoute } from './resolver.js';

export const ENGINE_VERSION = 'dld-engine-1';

// mulberry32: small, fast, the same in every browser and in Node.
export function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pickKey = (weights, u) => {
  let total = 0; for (const k in weights) total += weights[k];
  let r = u * total; for (const k in weights) { r -= weights[k]; if (r < 0) return k; }
  return Object.keys(weights).at(-1);
};
const pickRow = (rows, u) => {
  let total = 0; for (const [, w] of rows) total += w;
  let r = u * total; for (const [v, w] of rows) { r -= w; if (r < 0) return v; }
  return rows.at(-1)[0];
};

// A board: STAGES columns of LANES cells { s, fs? , forced? }.
export function drawBoard(rng, { stamps = BASE_STAMPS, fs = 0, fork = false } = {}) {
  const board = [];
  for (let stage = 0; stage < STAGES; stage++) {
    const column = [];
    for (let lane = 0; lane < LANES; lane++) column.push({ s: pickKey(stamps, rng()) });
    board.push(column);
  }
  if (fs > 0) for (let stage = 0; stage < STAGES; stage++) if (rng() < fs) board[stage][Math.min(LANES - 1, Math.floor(rng() * LANES))].fs = true;
  if (fork) board[0][ENTRY] = { ...board[0][ENTRY], s: 'F', forced: true };
  return board;
}
export const sealsOf = (board) => board.reduce((n, column) => n + (column.some((c) => c.fs) ? 1 : 0), 0);
export const drawPostage = (rng) => Array.from({ length: LANES }, () => pickRow(BASE_POSTAGE, rng()));

// The bin rungs a bonus starts on.
export function startRungs(tier, u) {
  const b = BONUSES[tier], start = b.start + (u < b.lift ? 1 : 0);
  return OUTER_LIFT.map((lift) => Math.min(LADDER.length - 1, start + lift));
}

// One bonus. budget is what the round may still pay before the cap.
export function playBonus(tier, rng, budget = CAP) {
  const b = BONUSES[tier];
  if (!b) throw Error(`Unknown bonus ${tier}`);
  let rungs = startRungs(tier, rng()), total = 0, capped = false;
  const start = rungs.slice(), spins = [];
  for (let n = 0; n < BONUS_SPINS && !capped; n++) {
    const board = drawBoard(rng, { stamps: BONUS_STAMPS });
    const route = resolveRoute(board, { entries: b.entries, rescues: b.rescues });
    const before = rungs.slice(), pays = [];
    let win = 0;
    for (const lane of route.delivered) {
      const value = LADDER[before[lane]], paid = Math.min(value, budget - total - win);
      pays.push({ lane, value, paid }); win += paid;
    }
    total += win;
    if (total >= budget) capped = true;
    if (b.upgrade === 'bin') for (const lane of route.delivered) rungs[lane] = Math.min(LADDER.length - 1, rungs[lane] + 1);
    else rungs = rungs.map((r) => Math.min(LADDER.length - 1, r + route.delivered.length));
    spins.push({ spin: n + 1, board, route, rungs: before, pays, win, after: rungs.slice() });
  }
  return { tier, title: b.title, start, spins, total, capped, endedEarly: capped && spins.length < BONUS_SPINS };
}

// Spin modes (base and paid spins) compare with the base bet; a bonus buy
// compares with its price.
export function tierOf(total, mode = 'base', capped = false) {
  if (capped) return 'max';
  const m = MODES[mode], x = total / 100;
  for (const id of ['mythic', 'epic', 'big', 'nice']) if (x >= (m.kind === 'buy' ? TIERS[id].perCost * m.cost : TIERS[id].min)) return id;
  return null;
}

// One round of a mode. forceBonus (QA and catalogs) replaces the spin's seal
// count with that tier's trigger.
export function playRound({ mode = 'base', rng, forceBonus = null } = {}) {
  const m = MODES[mode];
  if (!m) throw Error(`Unknown mode ${mode}`);
  if (typeof rng !== 'function') throw Error('playRound needs a seeded rng');
  if (m.kind === 'buy') {
    const tier = m.bonus ?? pickKey(MYSTERY, rng());
    const bonus = playBonus(tier, rng, CAP);
    return { version: ENGINE_VERSION, mode, cost: m.cost, spin: null, bonus, total: bonus.total, capped: bonus.capped, tier: tierOf(bonus.total, mode, bonus.capped) };
  }
  const board = drawBoard(rng, { stamps: BASE_STAMPS, fs: FS[m.fs], fork: !!m.fork });
  const postage = drawPostage(rng);
  const route = resolveRoute(board, { entries: [ENTRY], rescues: m.rescues ?? 0 });
  const pays = route.delivered.map((lane) => ({ lane, value: postage[lane], paid: postage[lane] }));
  const spinWin = pays.reduce((t, p) => t + p.value, 0); // a spin alone never reaches the cap
  const seals = sealsOf(board);
  const triggered = forceBonus ?? TRIGGER[Math.min(seals, STAGES)] ?? null;
  const bonus = triggered ? playBonus(triggered, rng, CAP - spinWin) : null;
  const total = spinWin + (bonus ? bonus.total : 0), capped = !!bonus?.capped;
  return { version: ENGINE_VERSION, mode, cost: m.cost, spin: { board, postage, route, pays, win: spinWin, seals }, bonus, total, capped, tier: tierOf(total, mode, capped) };
}
