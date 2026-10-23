// Spin evaluation and round flow. This is the only implementation of the
// game rules: the browser client plays back what these functions return,
// and the simulator runs these same functions millions of times.
//
// Rules (lines game):
//   - Line wins pay left to right from reel 1, on consecutive reels.
//   - The line's symbol is the first non-wild symbol on it; wilds substitute
//     for every symbol except the scatter. A line of only wilds pays as the
//     best symbol.
//   - In free spins each wild carries a multiplier; multipliers of the wilds
//     inside a winning run multiply together.
//   - Scatters pay anywhere (x total bet) and award free spins; scatters
//     during free spins retrigger.
//   - The whole round (base spin + every free spin) is capped at maxWinX;
//     reaching the cap ends the round.

export function evalLine(m, grid, mult, line, out) {
  const R = m.reels;
  const H = m.rows;
  const W = m.WILD;
  let base = -1;
  for (let i = 0; i < R; i++) {
    const s = grid[i * H + line[i]];
    if (s !== W) {
      base = s;
      break;
    }
  }
  if (base === m.SCATTER) return 0;
  if (base < 0) base = m.bestSym;
  let count = 0;
  let k = 1;
  for (let i = 0; i < R; i++) {
    const c = i * H + line[i];
    const s = grid[c];
    if (s === base) count++;
    else if (s === W) {
      count++;
      k *= mult[c];
    } else break;
  }
  const pay = m.pays[base * (R + 1) + count];
  if (pay === 0) return 0;
  if (out) {
    out.symbol = base;
    out.count = count;
    out.multiplier = k;
  }
  return pay * k;
}

const scratch = { winLB: 0, winX: 0, scatters: 0, award: 0 };

// mode: 'base' | 'free'. With detail=false the result object and grid are
// reused buffers (read them before the next call); with detail=true
// everything the client needs to animate the spin is returned.
export function spin(m, rng, mode, detail = false) {
  const free = mode === 'free';
  const strips = free ? m.strips.free : m.strips.base;
  const R = m.reels;
  const H = m.rows;
  const N = R * H;
  const grid = detail ? new Int8Array(N) : m._grid;
  const mult = detail ? new Float64Array(N) : m._mult;
  const stops = detail ? new Array(R) : null;

  for (let i = 0; i < R; i++) {
    const strip = strips[i];
    const len = strip.length;
    const stop = rng.int(len);
    if (stops) stops[i] = stop;
    for (let r = 0; r < H; r++) {
      let p = stop + r;
      if (p >= len) p -= len;
      grid[i * H + r] = strip[p];
    }
  }

  for (let c = 0; c < N; c++) {
    mult[c] = free && grid[c] === m.WILD ? m.multValues[rng.pick(m.multWeights, m.multTotal)] : 1;
  }

  let winLB = 0;
  const lineWins = detail ? [] : null;
  const info = detail ? {} : null;
  for (let li = 0; li < m.nLines; li++) {
    const line = m.lines[li];
    const w = evalLine(m, grid, mult, line, info);
    if (w > 0) {
      winLB += w;
      if (detail) {
        const cells = [];
        for (let i = 0; i < info.count; i++) cells.push([i, line[i]]);
        lineWins.push({
          line: li,
          symbol: m.symbols[info.symbol],
          count: info.count,
          multiplier: info.multiplier,
          winLB: w,
          winX: w / m.nLines,
          cells,
        });
      }
    }
  }

  let scatters = 0;
  const scatterCells = detail ? [] : null;
  for (let c = 0; c < N; c++) {
    if (grid[c] === m.SCATTER) {
      scatters++;
      if (detail) scatterCells.push([Math.floor(c / H), c % H]);
    }
  }
  const scatterLB = m.scatterPayLB[scatters];
  winLB += scatterLB;
  const award = free ? m.retrigger[scatters] : m.scatterAward[scatters];

  if (!detail) {
    scratch.winLB = winLB;
    scratch.winX = winLB / m.nLines;
    scratch.scatters = scatters;
    scratch.award = award;
    return scratch;
  }

  const reelsOut = [];
  const multsOut = [];
  for (let i = 0; i < R; i++) {
    const col = [];
    const mcol = [];
    for (let r = 0; r < H; r++) {
      col.push(m.symbols[grid[i * H + r]]);
      mcol.push(mult[i * H + r]);
    }
    reelsOut.push(col);
    multsOut.push(mcol);
  }
  return {
    mode,
    stops,
    grid: reelsOut, // grid[reel][row] = symbol id
    multipliers: multsOut, // multipliers[reel][row] (1 unless a free-spin wild)
    lineWins,
    scatter: { count: scatters, cells: scatterCells, winLB: scatterLB, winX: scatterLB / m.nLines },
    award,
    winLB,
    winX: winLB / m.nLines,
  };
}

const roundScratch = {
  buy: false,
  costX: 1,
  baseWinX: 0,
  freeWinX: 0,
  totalWinX: 0,
  triggered: false,
  freeSpinsAwarded: 0,
  freeSpinsInitial: 0,
  freeSpinsPlayed: 0,
  capped: false,
};

// One paid round: a base spin (or a bonus buy) plus any free spins it leads to.
// capLB overrides the max-win cap (the simulator uses Infinity to measure
// what the cap costs).
export function playRound(m, rng, { buy = false, detail = false, capLB = m.maxWinLB } = {}) {
  if (buy && !m.bonusBuy) throw new Error('this game has no bonus buy');
  const cap = capLB;
  let total = 0;
  let baseLB = 0;
  let freeLB = 0;
  let capped = false;
  let spinsLeft = 0;
  let awarded = 0;
  let played = 0;
  let base = null;
  const free = detail ? [] : null;

  if (buy) {
    spinsLeft = awarded = m.bonusBuy.spins;
  } else {
    const s = spin(m, rng, 'base', detail);
    baseLB = s.winLB;
    total = baseLB;
    spinsLeft = awarded = s.award;
    if (detail) base = s;
    if (total >= cap) {
      total = cap;
      capped = true;
      spinsLeft = 0;
    }
  }

  const initial = awarded;
  while (spinsLeft > 0) {
    spinsLeft--;
    played++;
    const s = spin(m, rng, 'free', detail);
    freeLB += s.winLB;
    total += s.winLB;
    spinsLeft += s.award;
    awarded += s.award;
    if (detail) free.push(s);
    if (total >= cap) {
      total = cap;
      capped = true;
      break;
    }
  }

  const out = detail ? {} : roundScratch;
  out.buy = buy;
  out.costX = buy ? m.bonusBuy.priceX : 1;
  out.baseWinX = baseLB / m.nLines;
  out.freeWinX = freeLB / m.nLines;
  out.totalWinX = total / m.nLines;
  out.triggered = awarded > 0;
  out.freeSpinsAwarded = awarded;
  out.freeSpinsInitial = initial;
  out.freeSpinsPlayed = played;
  out.capped = capped;
  if (detail) {
    out.base = base;
    out.free = free;
  }
  return out;
}
