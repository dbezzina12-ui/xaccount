// Exact (closed-form) math for a compiled model. No sampling.
//
// Why this is exact:
//   * Reel stops are independent and uniform, so the symbol in any one row
//     of reel i is distributed like the composition of strip i. A payline
//     takes one row per reel, so its five symbols are independent with
//     those marginals; enumerating every symbol tuple gives the exact
//     expected pay of one line, and by linearity of expectation the total
//     line return is nLines times that (every line has the same marginals).
//   * Free-spin wild multipliers are drawn independently per wild, so the
//     expected product over w wilds in a run is E[m]^w.
//   * Scatter counts: each reel shows 0 or 1 scatter (enforced by the model
//     compiler), so the count is a Poisson-binomial over the reels.
//   * Free spins are i.i.d. spins with retriggers, so by Wald's identity
//     E[feature win | N awarded] = N * e / (1 - r), where e is the expected
//     win of one free spin and r the expected spins added per free spin.
//   * Base hit rate: every line pay needs at least K matching reels from
//     reel 1, so whether any line pays depends only on the windows of
//     reels 1..K; we enumerate those windows exactly and treat the scatter
//     on the remaining reels by its exact distribution.
// The round cap (maxWinX) is the only non-linear rule; its effect is
// measured by the simulator, and these figures are reported as "uncapped".

import { evalLine } from '../../engine/core/game.js';

export function reelMarginals(m, set) {
  return m.strips[set].map((strip) => {
    const p = new Float64Array(m.nSym);
    for (const s of strip) p[s] += 1;
    for (let i = 0; i < m.nSym; i++) p[i] /= strip.length;
    return p;
  });
}

export function expectedMultiplier(m) {
  let s = 0;
  for (let i = 0; i < m.multValues.length; i++) s += m.multValues[i] * m.multWeights[i];
  return s / m.multTotal;
}

// Expected pay of ONE line in line-bet units, plus the breakdown by
// symbol and count and the probability that the line pays at all.
export function lineStats(m, set, wildMult = 1) {
  const R = m.reels;
  const H = m.rows;
  const marg = reelMarginals(m, set);
  const grid = new Int8Array(R * H);
  const mult = new Float64Array(R * H).fill(1);
  const line = new Int8Array(R); // row 0 of a synthetic grid
  const info = {};
  const bySymbol = Array.from({ length: m.nSym }, () => new Float64Array(R + 1));
  const hitBySymbol = Array.from({ length: m.nSym }, () => new Float64Array(R + 1));
  let ev = 0;
  let hit = 0;

  const support = marg.map((p) => [...p.keys()].filter((s) => p[s] > 0));
  const rec = (reel, prob) => {
    if (reel === R) {
      const w = evalLine(m, grid, mult, line, info);
      if (w > 0) {
        ev += prob * w;
        hit += prob;
        bySymbol[info.symbol][info.count] += prob * w;
        hitBySymbol[info.symbol][info.count] += prob;
      }
      return;
    }
    for (const s of support[reel]) {
      grid[reel * H] = s;
      mult[reel * H] = s === m.WILD ? wildMult : 1;
      rec(reel + 1, prob * marg[reel][s]);
    }
  };
  rec(0, 1);
  return { ev, hit, bySymbol, hitBySymbol };
}

// P(reel i shows a scatter) and the exact distribution of the total count.
export function scatterStats(m, set) {
  const H = m.rows;
  const perReel = m.strips[set].map((strip) => {
    let n = 0;
    for (let stop = 0; stop < strip.length; stop++) {
      for (let r = 0; r < H; r++) {
        if (strip[(stop + r) % strip.length] === m.SCATTER) {
          n++;
          break;
        }
      }
    }
    return n / strip.length;
  });
  let dist = new Float64Array(m.reels + 1);
  dist[0] = 1;
  for (const q of perReel) {
    const next = new Float64Array(m.reels + 1);
    for (let k = 0; k < m.reels; k++) {
      next[k] += dist[k] * (1 - q);
      next[k + 1] += dist[k] * q;
    }
    dist = next;
  }
  return { perReel, dist };
}

// Exact probability that a base spin pays anything (null if the model's
// shape doesn't allow the windowed method; use the simulator instead).
export function baseHitRate(m) {
  const R = m.reels;
  const H = m.rows;
  const strips = m.strips.base;
  if (m.WILD >= 0 && strips[0].includes(m.WILD)) return null;
  let K = Infinity;
  for (let s = 0; s < m.nSym; s++) {
    let first = 0;
    for (let n = 1; n <= R; n++) {
      if (m.pays[s * (R + 1) + n] > 0) {
        first = n;
        break;
      }
    }
    if (!first) continue;
    for (let n = first; n <= R; n++) if (!(m.pays[s * (R + 1) + n] > 0)) return null;
    if (K !== Infinity && first !== K) return null;
    K = first;
  }
  if (!(K <= R)) return null;

  // Scatter "hit" threshold and tail distribution over reels K+1..R.
  let T = Infinity;
  for (let k = 1; k <= R; k++) {
    if (m.scatterPayLB[k] > 0 || m.scatterAward[k] > 0) {
      T = k;
      break;
    }
  }
  const sc = scatterStats(m, 'base');
  let tail = new Float64Array(R + 1);
  tail[0] = 1;
  for (let i = K; i < R; i++) {
    const q = sc.perReel[i];
    const next = new Float64Array(R + 1);
    for (let k = 0; k < R; k++) {
      next[k] += tail[k] * (1 - q);
      next[k + 1] += tail[k] * q;
    }
    tail = next;
  }
  const atLeast = (need) => {
    if (need <= 0) return 1;
    let p = 0;
    for (let k = need; k <= R; k++) p += tail[k];
    return p;
  };

  const lens = strips.slice(0, K).map((s) => s.length);
  const stops = new Array(K).fill(0);
  let hits = 0;
  let total = 0;
  const win = new Int8Array(K * H);
  for (;;) {
    let scat = 0;
    for (let i = 0; i < K; i++) {
      for (let r = 0; r < H; r++) {
        const s = strips[i][(stops[i] + r) % lens[i]];
        win[i * H + r] = s;
        if (s === m.SCATTER) scat++;
      }
    }
    let lineWin = false;
    for (let li = 0; li < m.nLines && !lineWin; li++) {
      const line = m.lines[li];
      const base = win[line[0]];
      if (base === m.SCATTER || base === m.WILD) continue;
      let ok = true;
      for (let i = 1; i < K; i++) {
        const s = win[i * H + line[i]];
        if (s !== base && s !== m.WILD) {
          ok = false;
          break;
        }
      }
      lineWin = ok;
    }
    hits += lineWin ? 1 : atLeast(T - scat);
    total++;
    let j = K - 1;
    while (j >= 0 && ++stops[j] === lens[j]) stops[j--] = 0;
    if (j < 0) break;
  }
  return hits / total;
}

export function exactStats(m) {
  const nL = m.nLines;
  const R = m.reels;
  const eMult = expectedMultiplier(m);

  const baseLines = lineStats(m, 'base', 1);
  const baseSc = scatterStats(m, 'base');
  const freeLines = lineStats(m, 'free', eMult);
  const freeSc = scatterStats(m, 'free');

  let freeScatterLB = 0;
  let r = 0;
  for (let k = 0; k <= R; k++) {
    freeScatterLB += freeSc.dist[k] * m.scatterPayLB[k];
    r += freeSc.dist[k] * m.retrigger[k];
  }
  if (!(r < 1)) throw new Error(`free spins never end on average (r = ${r})`);
  const freeSpinLB = nL * freeLines.ev + freeScatterLB;
  const featureLB = (n) => (n * freeSpinLB) / (1 - r);

  let baseScatterLB = 0;
  let featureRTP_LB = 0;
  let triggerProb = 0;
  for (let k = 0; k <= R; k++) {
    baseScatterLB += baseSc.dist[k] * m.scatterPayLB[k];
    if (m.scatterAward[k] > 0) {
      triggerProb += baseSc.dist[k];
      featureRTP_LB += baseSc.dist[k] * featureLB(m.scatterAward[k]);
    }
  }
  const baseLineLB = nL * baseLines.ev;

  const rtpLines = baseLineLB / nL;
  const rtpScatter = baseScatterLB / nL;
  const rtpFeature = featureRTP_LB / nL;
  const awards = {};
  for (let k = 0; k <= R; k++) {
    if (m.scatterAward[k] > 0) {
      awards[k] = { prob: baseSc.dist[k], spins: m.scatterAward[k], avgWinX: featureLB(m.scatterAward[k]) / nL };
    }
  }

  return {
    rtp: rtpLines + rtpScatter + rtpFeature,
    rtpLines,
    rtpScatter,
    rtpFeature,
    baseLineHitPerLine: baseLines.hit,
    baseHitRate: baseHitRate(m),
    triggerProb,
    triggerOneIn: 1 / triggerProb,
    awards,
    expectedMultiplier: eMult,
    freeSpin: {
      avgWinX: freeSpinLB / nL,
      lineWinX: (nL * freeLines.ev) / nL,
      scatterWinX: freeScatterLB / nL,
      retriggerSpinsPerSpin: r,
      retriggerProb: m.retrigger.reduce((p, v, k) => p + (v > 0 ? freeSc.dist[k] : 0), 0),
    },
    bonusBuy: m.bonusBuy
      ? {
          priceX: m.bonusBuy.priceX,
          spins: m.bonusBuy.spins,
          avgWinX: featureLB(m.bonusBuy.spins) / nL,
          rtp: featureLB(m.bonusBuy.spins) / nL / m.bonusBuy.priceX,
        }
      : null,
    scatterPerReel: { base: baseSc.perReel, free: freeSc.perReel },
    scatterDist: { base: Array.from(baseSc.dist), free: Array.from(freeSc.dist) },
    // RTP contribution (x total bet) by symbol and count. Per-line EV in
    // line-bet units equals the RTP share, since total bet = nLines line bets.
    baseBySymbol: Object.fromEntries(
      m.symbols.map((s, i) => [s, Array.from(baseLines.bySymbol[i])]).filter(([, a]) => a.some((v) => v > 0)),
    ),
    freeBySymbol: Object.fromEntries(
      m.symbols.map((s, i) => [s, Array.from(freeLines.bySymbol[i])]).filter(([, a]) => a.some((v) => v > 0)),
    ),
  };
}
