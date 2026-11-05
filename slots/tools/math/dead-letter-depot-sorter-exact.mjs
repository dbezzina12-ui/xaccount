// Dead Letter Depot: exact math. Every figure here is computed over the whole
// state space (no sampling), with the game's own resolver deciding each stage:
// a board's stamps are independent per cell, so the delivered bins of a spin
// follow from a stage-by-stage walk over the lanes holding letters. FS seals
// and postage are independent of the route, and a bonus's bins depend only on
// which bins were delivered, so the bonus totals follow from a walk over spins.
//
// tools/math/dead-letter-depot-sorter-sim.mjs replays rounds through the engine to
// cross-check these figures; tools/math/dead-letter-depot-sorter-report.mjs prints them.
import { stepStage } from '../../games/dead-letter-depot/archive/sorter/engine/resolver.js';
import { STAGES, LANES, ENTRY, STAMPS } from '../../games/dead-letter-depot/archive/sorter/engine/sorter.js';
import * as RULES from '../../games/dead-letter-depot/archive/sorter/engine/rules.js';

const keyOf = (lanes) => lanes.join('');
const lanesOfKey = (k) => (k === '' ? [] : [...k].map(Number));

// The delivered-bins distribution of one spin: Map 'lanes' -> probability.
export function routeDist({ stamps, entries = [ENTRY], rescues = 0, fork = false }) {
  const total = STAMPS.reduce((t, s) => t + stamps[s], 0), p = Object.fromEntries(STAMPS.map((s) => [s, stamps[s] / total]));
  const columns = [];
  for (const a of STAMPS) for (const b of STAMPS) for (const c of STAMPS) columns.push({ cells: [a, b, c], p: p[a] * p[b] * p[c] });
  const forkColumns = [];
  for (const a of STAMPS) for (const c of STAMPS) forkColumns.push({ cells: [a, 'F', c], p: p[a] * p[c] });
  let states = new Map([[keyOf([...new Set(entries)].sort()) + '|' + rescues, { active: [...new Set(entries)].sort(), left: rescues, p: 1 }]]);
  for (let stage = 0; stage < STAGES; stage++) {
    const next = new Map(), cols = fork && stage === 0 ? forkColumns : columns;
    for (const st of states.values()) {
      for (const col of cols) {
        const step = stepStage(col.cells.map((s) => ({ s })), st.active, st.left);
        const k = keyOf(step.out) + '|' + step.rescues;
        const e = next.get(k);
        if (e) e.p += st.p * col.p; else next.set(k, { active: step.out, left: step.rescues, p: st.p * col.p });
      }
    }
    states = next;
  }
  const out = new Map();
  for (const st of states.values()) out.set(keyOf(st.active), (out.get(keyOf(st.active)) ?? 0) + st.p);
  return out;
}

const addTo = (map, k, p) => map.set(k, (map.get(k) ?? 0) + p);
const convolve = (a, b) => { const out = new Map(); for (const [x, p] of a) for (const [y, q] of b) addTo(out, x + y, p * q); return out; };

// One base/paid spin's own pay: delivered bins x fresh postage.
export function spinPayDist(route, postage = RULES.BASE_POSTAGE) {
  const wt = postage.reduce((t, [, w]) => t + w, 0);
  const one = new Map(postage.map(([v, w]) => [v, w / wt]));
  const bySize = [new Map([[0, 1]])];
  for (let k = 1; k <= LANES; k++) bySize.push(convolve(bySize[k - 1], one));
  const out = new Map();
  for (const [key, p] of route) for (const [v, q] of bySize[key.length]) addTo(out, v, p * q);
  return out;
}

// Seal count per spin: binomial over the stages.
export function sealDist(fs) {
  const out = [];
  for (let k = 0; k <= STAGES; k++) { let c = 1; for (let i = 1; i <= k; i++) c = (c * (STAGES - k + i)) / i; out.push(c * fs ** k * (1 - fs) ** (STAGES - k)); }
  return out;
}
export function triggerRates(fs, trigger = RULES.TRIGGER) {
  const seals = sealDist(fs), rates = {};
  for (const [k, tier] of Object.entries(trigger)) rates[tier] = (rates[tier] ?? 0) + seals[Number(k)];
  return rates;
}

// A bonus's uncapped total distribution for one start rung (all bins offset
// by OUTER_LIFT). Totals at or over cap are pooled at cap.
export function bonusDistAt(tier, start, rules = RULES) {
  const b = rules.BONUSES[tier], L = rules.LADDER, top = L.length - 1, cap = rules.CAP, spins = rules.BONUS_SPINS;
  const route = [...routeDist({ stamps: rules.BONUS_STAMPS, entries: b.entries, rescues: b.rescues })].map(([k, p]) => ({ lanes: lanesOfKey(k), p }));
  const rung0 = rules.OUTER_LIFT.map((lift) => Math.min(top, start + lift));
  const value = (lane, ups) => L[Math.min(top, rung0[lane] + ups)];
  if (b.upgrade === 'bin') {
    // deliveries per bin: (n0, n1, n2), each at most spins
    let st = new Map([['0,0,0', 1]]);
    for (let t = 0; t < spins; t++) {
      const nx = new Map();
      for (const [k, p] of st) { const n = k.split(',').map(Number); for (const r of route) { const m = n.slice(); for (const lane of r.lanes) m[lane] += 1; addTo(nx, m.join(','), p * r.p); } }
      st = nx;
    }
    const out = new Map();
    for (const [k, p] of st) {
      const n = k.split(',').map(Number);
      let total = 0;
      for (let lane = 0; lane < LANES; lane++) for (let i = 0; i < n[lane]; i++) total += value(lane, i);
      addTo(out, Math.min(total, cap), p);
    }
    return out;
  }
  // shared: state (upgrades so far, total so far)
  let st = new Map([['0|0', { ups: 0, total: 0, p: 1 }]]);
  for (let t = 0; t < spins; t++) {
    const nx = new Map();
    for (const s of st.values()) {
      for (const r of route) {
        let win = 0;
        for (const lane of r.lanes) win += value(lane, s.ups);
        const total = Math.min(cap, s.total + win), ups = total >= cap ? 0 : Math.min(s.ups + r.lanes.length, top);
        const k = total >= cap ? 'cap' : ups + '|' + total;
        const e = nx.get(k);
        if (e) e.p += s.p * r.p; else nx.set(k, { ups, total, p: s.p * r.p });
      }
    }
    st = nx;
  }
  const out = new Map();
  for (const s of st.values()) addTo(out, s.total, s.p);
  return out;
}

export function bonusDist(tier, rules = RULES) {
  const b = rules.BONUSES[tier];
  const lo = bonusDistAt(tier, b.start, rules), hi = bonusDistAt(tier, b.start + 1, rules), out = new Map();
  for (const [v, p] of lo) addTo(out, v, p * (1 - b.lift));
  for (const [v, p] of hi) addTo(out, v, p * b.lift);
  return out;
}

export const mean = (d) => { let m = 0; for (const [v, p] of d) m += v * p; return m; };
export const moment2 = (d) => { let m = 0; for (const [v, p] of d) m += v * v * p; return m; };

// E[min(x + y, cap)] for independent x ~ X, y ~ Y.
export function cappedSumMean(X, Y, cap) {
  const ys = [...Y].sort((a, b) => a[0] - b[0]);
  const suffP = new Array(ys.length + 1).fill(0), suffPV = new Array(ys.length + 1).fill(0);
  for (let i = ys.length - 1; i >= 0; i--) { suffP[i] = suffP[i + 1] + ys[i][1]; suffPV[i] = suffPV[i + 1] + ys[i][1] * ys[i][0]; }
  let over = 0;
  for (const [x, px] of X) {
    // y > cap - x
    let lo = 0, hi = ys.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (ys[mid][0] > cap - x) hi = mid; else lo = mid + 1; }
    over += px * (suffPV[lo] + (x - cap) * suffP[lo]);
  }
  return mean(X) + mean(Y) - over;
}

// The whole round distribution for a spin mode, as Map total -> probability.
export function roundDist(X, rates, bonuses, cap) {
  const out = new Map();
  const pNone = 1 - Object.values(rates).reduce((a, b) => a + b, 0);
  for (const [x, p] of X) addTo(out, x, p * pNone);
  for (const [tier, r] of Object.entries(rates)) {
    if (!r) continue;
    for (const [x, px] of X) for (const [y, py] of bonuses[tier]) addTo(out, Math.min(cap, x + y), r * px * py);
  }
  return out;
}

export function spinRoute(mode, rules = RULES) {
  const m = rules.MODES[mode];
  return routeDist({ stamps: rules.BASE_STAMPS, entries: [ENTRY], rescues: m.rescues ?? 0, fork: !!m.fork });
}

// Everything the report and the fit need, from one set of rules. A spin
// mode's return is its own pay plus, per tier, the trigger chance times what
// that bonus adds to the round under the cap (bonusAdds), so returnAt(fs)
// re-prices a spin mode for any FS chance without re-walking the bonuses.
export function measure(rules = RULES, cached = null) {
  const bonuses = cached ?? Object.fromEntries(Object.keys(rules.BONUSES).map((t) => [t, bonusDist(t, rules)]));
  const bonusMean = Object.fromEntries(Object.entries(bonuses).map(([t, d]) => [t, mean(d)]));
  const modes = {};
  for (const [id, m] of Object.entries(rules.MODES)) {
    if (m.kind === 'spin') {
      const route = spinRoute(id, rules), X = spinPayDist(route, rules.BASE_POSTAGE);
      const bonusAdds = Object.fromEntries(Object.keys(bonuses).map((tier) => [tier, cappedSumMean(X, bonuses[tier], rules.CAP) - mean(X)]));
      const returnAt = (fs) => { const rates = triggerRates(fs, rules.TRIGGER); return (mean(X) + Object.entries(rates).reduce((t, [tier, r]) => t + r * bonusAdds[tier], 0)) / (m.cost * 100); };
      const rates = triggerRates(rules.FS[m.fs], rules.TRIGGER);
      const capLoss = Object.entries(rates).reduce((t, [tier, r]) => t + r * (bonusMean[tier] - bonusAdds[tier]), 0);
      modes[id] = { cost: m.cost, route, X, rates, bonusAdds, returnAt, rtp: returnAt(rules.FS[m.fs]), spinRtp: mean(X) / (m.cost * 100), capLoss };
    } else {
      const w = m.bonus ? { [m.bonus]: 1 } : rules.MYSTERY;
      const ret = Object.entries(w).reduce((t, [tier, p]) => t + p * bonusMean[tier], 0);
      modes[id] = { cost: m.cost, weights: w, rtp: ret / (m.cost * 100) };
    }
  }
  return { bonuses, bonusMean, modes };
}

// P(total >= x) from a distribution.
export const tail = (d, x) => { let p = 0; for (const [v, q] of d) if (v >= x) p += q; return p; };
