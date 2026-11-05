// Dead Letter Depot (reels v2): the pure round engine with collections, jobs
// and the multiplier meter. Every round is decided here, from a seeded random
// source, before anything animates. The draw order is part of the replay
// contract: change it only with a new ENGINE_VERSION.
//
// Draw order. A landed cell takes one draw (FS, stamp or which pay symbol) and
// a stamp one more for its value. A spin draws its 30 cells reel by reel, top
// to bottom; then each opening stamp draws its cell and value; then every
// refill draws its cells reel by reel, top to bottom; a vault stamp draws its
// value when the vault opens. A bonus buy draws nothing first; Mystery
// Delivery draws its bonus first.
//
// A check counts each pay symbol anywhere; 8+ pay. Wilds (from K and the KEY
// vault) join only the most common pay symbol (ties: higher rank) and leave
// the board after the next check whether or not they paid. After a check pays:
//   1. every winning cell clears; real symbols add to their collections
//   2. collections that reach their target clear (rank order, excess carries)
//   3. survivors drop in order and refills fall in from the top
//   4. the cleared collections' jobs run on the settled board, in rank order
// A spin ends when a check pays nothing and no wilds remain.
//
// Tie-breaks used by the jobs:
//   most common visible premium: highest count, then higher rank; none -> the job's fallback
//   most common pay symbol (s*): highest count, then higher rank
//   donor cells: pay-symbol cells, lowest-ranked symbol first, then reel by reel, top to bottom
import {
  REELS, ROWS, CELLS, MIN_MATCH, CAP, MAX_TUMBLES, MAX_JOBS, MAX_METER, MAX_FREE_SPINS, PAYING, PREMIUMS, FILTERABLE,
  FS, STAMP, WILD, JOBS, STAMP_VALUES, OPENING_VALUES, LAND, BONUSES, RETRIGGER, MODES, MYSTERY, TIERS, INCREMENTS, INCREMENT_SCHEME,
  bonusFor, payFor, targetsFor,
} from './rules.js';

export const ENGINE_VERSION = 'dld-reels-2';

// mulberry32: small, fast, the same in every browser and in Node.
export function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const NPAY = PAYING.length, FS_CODE = NPAY, STAMP_CODE = NPAY + 1, WILD_CODE = NPAY + 2, EMPTY = -1;
const NAME = [...PAYING, FS, STAMP, WILD];
const CODE = Object.fromEntries(PAYING.map((s, i) => [s, i]));
const PREMIUM_CODES = PREMIUMS.map((s) => CODE[s]);
const FILTER_CODES = FILTERABLE.map((s) => CODE[s]);
const cumulative = (weights) => { let t = 0; const c = weights.map((w) => (t += w)); return { c, total: t }; };
const pickCum = ({ c, total }, u) => { const r = u * total; for (let i = 0; i < c.length; i++) if (r < c[i]) return i; return c.length - 1; };
const STAMP_CUM = cumulative(STAMP_VALUES.map(([, w]) => w)), STAMP_VAL = STAMP_VALUES.map(([v]) => v);
const OPEN_CUM = cumulative(OPENING_VALUES.map(([, w]) => w)), OPEN_VAL = OPENING_VALUES.map(([v]) => v);
const stampValue = (u) => STAMP_VAL[pickCum(STAMP_CUM, u)];
const openingValue = (u) => OPEN_VAL[pickCum(OPEN_CUM, u)];
export const cellOf = (reel, row) => reel * ROWS + row;
const at = (cell) => [Math.floor(cell / ROWS), cell % ROWS];

// A landing compiled for drawing, with one pay table per filter state
// (bit i set = FILTERABLE[i] no longer lands). Tools may pass their own lands.
export const compileLand = (l) => ({
  fs: l.fs, stamp: l.stamp,
  pays: Array.from({ length: 1 << FILTER_CODES.length }, (_, mask) => cumulative(PAYING.map((s, i) => (FILTER_CODES.some((f, b) => f === i && mask & (1 << b)) ? 0 : l.pays[s])))),
});
export const compileLands = (spec) => Object.fromEntries(Object.entries(spec).map(([k, l]) => [k, compileLand(l)]));
const LANDS = compileLands(LAND);

// Spin state shared by the helpers below.
function makeSpin(land, rng, { targets, collections, filter, record, scheme }) {
  return { land, rng, targets, col: collections, filter, rec: record ? { steps: [], stampsAt: [] } : null, sym: new Int8Array(CELLS), val: new Int16Array(CELLS), stampSum: 0, stampCount: 0, clears: [], fired: new Int8Array(NPAY), subtotal: 0, biggest: null, inc: INCREMENTS[scheme], step: 0 };
}
function landCell(S, cell, source) {
  const u = S.rng(), land = S.land;
  if (u < land.stamp) { S.sym[cell] = STAMP_CODE; addStamp(S, cell, stampValue(S.rng()), source); return; }
  if (u < land.stamp + land.fs) { S.sym[cell] = FS_CODE; S.val[cell] = 0; return; }
  S.sym[cell] = pickCum(land.pays[S.filter], (u - land.stamp - land.fs) / (1 - land.stamp - land.fs)); S.val[cell] = 0;
}
function addStamp(S, cell, value, source) {
  S.sym[cell] = STAMP_CODE; S.val[cell] = value; S.stampSum += value; S.stampCount += 1;
  if (S.rec) S.rec.stampsAt.push({ value, at: at(cell), step: S.step, source });
}
const boardOf = (S) => Array.from({ length: REELS }, (_, reel) => Array.from({ length: ROWS }, (_, row) => {
  const c = cellOf(reel, row);
  return S.sym[c] === STAMP_CODE ? { s: STAMP, v: S.val[c] } : { s: NAME[S.sym[c]] };
}));
// Drop survivors and refill every EMPTY cell; returns what moved and landed.
function settle(S) {
  const drops = [], refills = [];
  for (let reel = 0; reel < REELS; reel++) {
    let to = ROWS - 1;
    for (let row = ROWS - 1; row >= 0; row--) {
      const c = cellOf(reel, row);
      if (S.sym[c] === EMPTY) continue;
      if (row !== to) { const d = cellOf(reel, to); S.sym[d] = S.sym[c]; S.val[d] = S.val[c]; S.sym[c] = EMPTY; S.val[c] = 0; drops.push([reel, row, to]); }
      to--;
    }
    for (let row = 0; row <= to; row++) {
      const c = cellOf(reel, row);
      landCell(S, c, 'refill');
      refills.push(S.sym[c] === STAMP_CODE ? [reel, row, STAMP, S.val[c]] : [reel, row, NAME[S.sym[c]]]);
    }
  }
  return { drops, refills };
}
const countsOf = (S) => { const n = new Int32Array(NPAY); for (let c = 0; c < CELLS; c++) if (S.sym[c] >= 0 && S.sym[c] < NPAY) n[S.sym[c]]++; return n; };
const best = (n, codes) => { let b = -1; for (const i of codes) if (b < 0 || n[i] > n[b]) b = i; return b; }; // codes in rank order, so ties keep the higher rank
const ALL = PAYING.map((_, i) => i);
const commonPremium = (S, fallback) => { const n = countsOf(S), p = best(n, PREMIUM_CODES); return n[p] > 0 ? p : fallback; };
// Pay-symbol cells other than `except`: lowest-ranked symbol first, then cell order.
function donors(S, except) {
  const out = [];
  for (let s = NPAY - 1; s >= 0; s--) if (s !== except) for (let c = 0; c < CELLS; c++) if (S.sym[c] === s) out.push(c);
  return out;
}
const change = (S, cell, to, changes) => { changes.push([...at(cell), NAME[S.sym[cell]], NAME[to]]); S.sym[cell] = to; S.val[cell] = 0; };

function unpack(S, job, fallback) {
  const p = commonPremium(S, fallback);
  for (const c of donors(S, p).slice(0, 4)) change(S, c, p, job.changes);
  job.symbol = NAME[p];
}
function wildReel(S, job) {
  const n = countsOf(S), s = best(n, ALL);
  let reel = 0, fewest = Infinity;
  for (let r = 0; r < REELS; r++) { let k = 0; for (let row = 0; row < ROWS; row++) if (S.sym[cellOf(r, row)] === s) k++; if (k < fewest) { fewest = k; reel = r; } }
  for (let row = 0; row < ROWS; row++) { const c = cellOf(reel, row); if (S.sym[c] < NPAY) change(S, c, WILD_CODE, job.changes); }
  job.reel = reel;
}
// The job of one cleared collection, on the settled board.
function runJob(S, code) {
  const kind = JOBS[PAYING[code]], job = { s: PAYING[code], job: kind, changes: [] };
  if (kind === 'sweep') {
    for (let c = 0; c < CELLS; c++) if (S.sym[c] === CODE['10']) { job.changes.push([...at(c), '10', null]); S.sym[c] = EMPTY; }
    Object.assign(job, settle(S));
  } else if (kind === 'convert') {
    const p = commonPremium(S, CODE.ENVELOPE);
    for (let c = 0; c < CELLS; c++) if (S.sym[c] === CODE.J) change(S, c, p, job.changes);
    job.symbol = NAME[p];
  } else if (kind === 'copy') {
    const s = best(countsOf(S), ALL), inRow = (r) => { let k = 0; for (let reel = 0; reel < REELS; reel++) if (S.sym[cellOf(reel, r)] === s) k++; return k; };
    let src = 0, dst = -1;
    for (let r = 1; r < ROWS; r++) if (inRow(r) > inRow(src)) src = r;
    for (let r = ROWS - 1; r >= 0; r--) if (r !== src && (dst < 0 || inRow(r) < inRow(dst))) dst = r;
    for (let reel = 0; reel < REELS; reel++) { const a = cellOf(reel, src), b = cellOf(reel, dst); if (S.sym[a] < NPAY && S.sym[b] < NPAY && S.sym[a] !== S.sym[b]) change(S, b, S.sym[a], job.changes); }
    Object.assign(job, { symbol: NAME[s], from: src, to: dst });
  } else if (kind === 'wild') wildReel(S, job);
  else if (kind === 'filter') {
    const b = FILTER_CODES.findIndex((_, i) => !(S.filter & (1 << i)));
    if (b >= 0) { S.filter |= 1 << b; job.filtered = FILTERABLE[b]; } else job.filtered = null;
  } else if (kind === 'return') {
    job.returned = S.biggest ? { ...S.biggest } : null;
    if (S.biggest) S.subtotal += S.biggest.pay;
  } else if (kind === 'unpack') unpack(S, job, CODE.PARCEL);
  else if (kind === 'deliver') {
    const n = countsOf(S); let s = -1;
    for (let i = 0; i < NPAY; i++) if (n[i] < MIN_MATCH && (s < 0 || n[i] > n[s])) s = i;
    if (s >= 0) for (const c of donors(S, s).slice(0, MIN_MATCH - n[s])) change(S, c, s, job.changes);
    job.symbol = s >= 0 ? NAME[s] : null;
  } else if (kind === 'vault') {
    const parts = { unpack: { changes: [] }, wild: { changes: [] } };
    unpack(S, parts.unpack, CODE.KEY); wildReel(S, parts.wild);
    const target = donors(S, -1)[0];
    if (target !== undefined) { job.changes.push([...at(target), NAME[S.sym[target]], STAMP]); addStamp(S, target, stampValue(S.rng()), 'vault'); job.stamp = S.val[target]; }
    Object.assign(job, { unpack: parts.unpack, wild: parts.wild });
  }
  return job;
}

// One spin: land, opening stamps, then checks until nothing pays.
export function spinBoard(landKind, rng, { opening = 0, record = false, lands = LANDS, targets = targetsFor('base'), collections = null, filter = 0, scheme = INCREMENT_SCHEME } = {}) {
  const land = lands[landKind];
  if (!land) throw Error(`Unknown landing ${landKind}`);
  const col = collections ?? new Int32Array(NPAY), before = Array.from(col), filterBefore = filter;
  const S = makeSpin(land, rng, { targets, collections: col, filter, record, scheme });
  for (let c = 0; c < CELLS; c++) landCell(S, c, 'land');
  const openingAt = [];
  for (let k = 0; k < opening; k++) {
    let free = 0; for (let c = 0; c < CELLS; c++) if (S.sym[c] !== STAMP_CODE) free++;
    let n = Math.floor(rng() * free), cell = 0;
    for (let c = 0; c < CELLS; c++) if (S.sym[c] !== STAMP_CODE && n-- === 0) { cell = c; break; }
    addStamp(S, cell, openingValue(rng()), 'opening'); openingAt.push([...at(cell), S.val[cell]]);
  }
  const board = S.rec ? boardOf(S) : null;
  const target = PAYING.map((s) => targets[s]);
  for (; S.step < MAX_TUMBLES; ) {
    const n = countsOf(S);
    let wilds = 0; for (let c = 0; c < CELLS; c++) if (S.sym[c] === WILD_CODE) wilds++;
    const joined = wilds ? best(n, ALL) : -1;
    const winners = [];
    for (let s = 0; s < NPAY; s++) if (n[s] + (s === joined ? wilds : 0) >= MIN_MATCH) winners.push(s);
    if (!winners.length && !wilds) break;
    S.step += 1;
    const step = S.rec ? { kind: winners.length ? 'win' : 'expire', wins: [], pay: 0, cleared: [], collect: {}, clears: [], jobs: [] } : null;
    let pay = 0;
    for (const s of winners) {
      const w = s === joined ? wilds : 0, p = payFor(PAYING[s], n[s] + w);
      pay += p;
      const win = { s: PAYING[s], count: n[s] + w, wilds: w, pay: p };
      if (!S.biggest || p > S.biggest.pay) S.biggest = win;
      if (step) step.wins.push({ ...win, cells: Array.from({ length: CELLS }, (_, c) => c).filter((c) => S.sym[c] === s || (w && S.sym[c] === WILD_CODE)).map(at) });
      col[s] += n[s];
      if (step) step.collect[PAYING[s]] = n[s];
    }
    S.subtotal += pay;
    const isWin = winners.length > 0;
    for (let c = 0; c < CELLS; c++) if ((S.sym[c] >= 0 && S.sym[c] < NPAY && isWin && winners.includes(S.sym[c])) || S.sym[c] === WILD_CODE) { if (step) step.cleared.push(at(c)); S.sym[c] = EMPTY; }
    const queue = [];
    for (let s = 0; s < NPAY; s++) while (col[s] >= target[s]) {
      col[s] -= target[s]; S.clears.push(PAYING[s]);
      const fires = S.fired[s] < MAX_JOBS;
      if (fires) { S.fired[s] += 1; queue.push(s); }
      if (step) step.clears.push({ s: PAYING[s], job: JOBS[PAYING[s]], fired: fires });
    }
    const moved = settle(S);
    const jobs = queue.map((s) => runJob(S, s));
    if (step) Object.assign(step, { pay, drops: moved.drops, refills: moved.refills, jobs, collections: Object.fromEntries(PAYING.map((s, i) => [s, col[i]])), after: boardOf(S) }), S.rec.steps.push(step);
  }
  let fs = 0; for (let c = 0; c < CELLS; c++) if (S.sym[c] === FS_CODE) fs++;
  const out = { subtotal: S.subtotal, stampSum: S.stampSum, stampCount: S.stampCount, clears: S.clears, fs, tumbles: S.step, filter: S.filter, collections: col };
  if (S.rec) Object.assign(out, { board, opening: openingAt, steps: S.rec.steps, stampsAt: S.rec.stampsAt, collectionsBefore: Object.fromEntries(PAYING.map((s, i) => [s, before[i]])), filteredBefore: FILTERABLE.filter((_, i) => filterBefore & (1 << i)), filteredAfter: FILTERABLE.filter((_, i) => S.filter & (1 << i)) });
  return out;
}

// The meter after a spin: stamps first, then clears (add increments or double), capped.
export function growMeter(start, stampSum, clears, grow, scheme = INCREMENT_SCHEME, ceiling = MAX_METER) {
  let m = start + stampSum;
  for (const s of clears) m = grow === 'double' ? m * 2 : m + INCREMENTS[scheme][s];
  return Math.min(ceiling, m);
}

const pickKey = (weights, u) => { let total = 0; for (const k in weights) total += weights[k]; let r = u * total; for (const k in weights) { r -= weights[k]; if (r < 0) return k; } return Object.keys(weights).at(-1); };

// One bonus. budget is what the round may still pay before the cap.
// targets and meter override the rules for tools exploring alternatives.
export function playBonus(tier, rng, budget = CAP, { record = true, lands = LANDS, scheme = INCREMENT_SCHEME, targets = targetsFor(tier), meter: meterStart = null, ceiling = null } = {}) {
  const b = BONUSES[tier];
  if (!b) throw Error(`Unknown bonus ${tier}`);
  const col = new Int32Array(NPAY), spins = [];
  let left = b.spins, awarded = b.spins, meter = meterStart ?? b.meter, total = 0, capped = false, n = 0, retriggers = 0, clears = 0;
  while (left > 0 && !capped) {
    left -= 1; n += 1;
    // collections carry across free spins; an A filter lasts for its own spin
    const r = spinBoard(tier, rng, { record, lands, targets, collections: col, filter: 0, scheme });
    clears += r.clears.length;
    const start = meter, grown = growMeter(meter, r.stampSum, r.clears, b.grow, scheme, ceiling ?? b.ceiling ?? MAX_METER);
    const event = r.stampCount > 0 || r.clears.length > 0, active = b.when === 'always' || event;
    const multiplier = active ? grown : 1, win = r.subtotal * multiplier, paid = Math.min(win, budget - total);
    meter = grown; total += paid;
    if (total >= budget) capped = true;
    let extra = 0;
    if (r.fs >= RETRIGGER.fs && awarded < MAX_FREE_SPINS) { extra = Math.min(RETRIGGER.spins, MAX_FREE_SPINS - awarded); left += extra; awarded += extra; retriggers += 1; }
    const s = { spin: n, subtotal: r.subtotal, stampSum: r.stampSum, clears: r.clears, meter: { start, after: grown, active, event }, multiplier, win, paid, fs: r.fs, retrigger: extra };
    if (record) Object.assign(s, { board: r.board, steps: r.steps, stampsAt: r.stampsAt, collectionsBefore: r.collectionsBefore, collectionsAfter: Object.fromEntries(PAYING.map((x, i) => [x, col[i]])), filteredBefore: r.filteredBefore, filteredAfter: r.filteredAfter });
    spins.push(s);
  }
  return { tier, title: b.title, targets: { ...targets }, spins, awarded, retriggers, clears, meter, total, capped, endedEarly: capped && left > 0 };
}

// Spins compare with the base bet; a bonus buy compares with its price.
export function tierOf(total, mode = 'base', capped = false) {
  if (capped) return 'max';
  const m = MODES[mode], x = total / 100;
  for (const id of ['mythic', 'epic', 'big', 'nice']) if (x >= (m.kind === 'buy' ? TIERS[id].perCost * m.cost : TIERS[id].min)) return id;
  return null;
}

// One round of a mode. forceBonus (QA and previews) sets the spin's bonus.
export function playRound({ mode = 'base', rng, forceBonus = null, record = true, lands = LANDS, scheme = INCREMENT_SCHEME } = {}) {
  const m = MODES[mode];
  if (!m) throw Error(`Unknown mode ${mode}`);
  if (typeof rng !== 'function') throw Error('playRound needs a seeded rng');
  if (m.kind === 'buy') {
    const tier = m.bonus ?? pickKey(MYSTERY, rng());
    const bonus = playBonus(tier, rng, CAP, { record, lands, scheme });
    return { version: ENGINE_VERSION, mode, cost: m.cost, spin: null, bonus, total: bonus.total, capped: bonus.capped, tier: tierOf(bonus.total, mode, bonus.capped) };
  }
  const r = spinBoard(m.land, rng, { opening: m.opening, record, lands, scheme });
  const multiplier = growMeter(1, r.stampSum, r.clears, 'add', scheme);
  const win = Math.min(CAP, r.subtotal * multiplier);
  const triggered = forceBonus ?? bonusFor(r.fs);
  const bonus = triggered && win < CAP ? playBonus(triggered, rng, CAP - win, { record, lands, scheme }) : null;
  const total = win + (bonus ? bonus.total : 0), capped = total >= CAP;
  const spin = { subtotal: r.subtotal, stampSum: r.stampSum, clears: r.clears, multiplier, win, fs: r.fs, tumbles: r.tumbles };
  if (record) Object.assign(spin, { targets: { ...targetsFor('base') }, board: r.board, opening: r.opening, steps: r.steps, stampsAt: r.stampsAt });
  return { version: ENGINE_VERSION, mode, cost: m.cost, spin, bonus, total, capped, tier: tierOf(total, mode, capped) };
}
