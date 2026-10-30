// Whole-ticket catalog weights (shared by the Cyber Skunk catalogs; the same
// routines as tools/math/zombify-rebalance.mjs, which keeps its own copy).
// - integerWeights: real-valued shares to integer weights summing to a total, each >= 1.
// - exactAverage / exactSum: move single tickets between entries until
//   sum(weight * value) hits the goal exactly (values are whole 0.1x, so the
//   goal is rounded to their common divisor).
export const TOTAL = 1e9;

export function integerWeights(shares, total = TOTAL) {
  const sum = shares.reduce((a, x) => a + x, 0), raw = shares.map((x) => Math.max(1, (x / sum) * total)), w = raw.map(Math.floor);
  let left = total - w.reduce((a, x) => a + x, 0);
  const order = raw.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) w[order[k][1]]++;
  for (let k = 0; left < 0; k = (k + 1) % order.length) if (w[order[k][1]] > 1) { w[order[k][1]]--; left++; }
  return w;
}
// Every value is a whole 0.1x, so sums move in steps of their common divisor:
// aim at the nearest reachable sum (within 1e-10 of the target average).
export const gcd = (a, b) => (b ? gcd(b, a % b) : a);
export function exactAverage(values, w, target) { const g = values.reduce(gcd, 0) || 1; return exactSum(values, w, BigInt(Math.round((target * TOTAL) / g)) * BigInt(g)); }
// Move tickets between entries (the total stays) until sum(w*v) === goal.
export function exactSum(values, w, goal) {
  const total = w.reduce((t, x) => t + x, 0);
  let have = values.reduce((a, v, i) => a + BigInt(v) * BigInt(w[i]), 0n);
  const byValue = new Map(); values.forEach((v, i) => { if (!byValue.has(v)) byValue.set(v, []); byValue.get(v).push(i); });
  const sorted = [...byValue.keys()].sort((a, b) => a - b);
  // Big steps: lowest <-> highest value; then an exact pair for the rest.
  for (let guard = 0; have !== goal && guard < 1e6; guard++) {
    const diff = goal - have, up = diff > 0n, need = up ? diff : -diff;
    let moved = false;
    // An exact pair: values a, b with b - a === need (move one ticket a -> b, or b -> a).
    if (need <= BigInt(sorted.at(-1) - sorted[0])) {
      const n = Number(need);
      for (const a of sorted) {
        if (!byValue.has(a + n)) continue;
        const from = up ? byValue.get(a).find((i) => w[i] > 1) : byValue.get(a + n).find((i) => w[i] > 1), to = up ? byValue.get(a + n)[0] : byValue.get(a)[0];
        if (from === undefined) continue;
        w[from]--; w[to]++; have += up ? need : -need; moved = true; break;
      }
    }
    if (moved) continue;
    // Otherwise a bulk move between the extremes that does not overshoot.
    const lo = sorted[0], hi = sorted.at(-1), span = BigInt(hi - lo), steps = need / span;
    const fromList = up ? byValue.get(lo) : byValue.get(hi), toIndex = (up ? byValue.get(hi) : byValue.get(lo))[0];
    const from = fromList.reduce((best, i) => (w[i] > w[best] ? i : best), fromList[0]);
    const k = Number(steps > 0n ? (steps < BigInt(w[from] - 1) ? steps : BigInt(w[from] - 1)) : 0n);
    if (k > 0) { w[from] -= k; w[toIndex] += k; have += (up ? 1n : -1n) * BigInt(k) * span; continue; }
    // Near the goal: the largest single move that does not overshoot, from
    // an entry that can spare a ticket.
    const spare = (v) => byValue.get(v).find((i) => w[i] > 1);
    let best = null;
    for (let x = 0, y = 0; x < sorted.length; x++) {
      if (y < x) y = x;
      while (y + 1 < sorted.length && sorted[y + 1] - sorted[x] <= Number(need)) y++;
      if (up && spare(sorted[x]) === undefined) continue;
      for (let z = y; z > x; z--) {
        if (!up && spare(sorted[z]) === undefined) continue;
        if (!best || sorted[z] - sorted[x] > best[1] - best[0]) best = [sorted[x], sorted[z]];
        break;
      }
    }
    if (!best) throw Error('Cannot reach the exact average');
    const [a, b] = best, f = spare(up ? a : b), t = byValue.get(up ? b : a)[0];
    w[f]--; w[t]++; have += (up ? 1n : -1n) * BigInt(b - a);
  }
  if (have !== goal) throw Error('Exact average not reached');
  if (w.reduce((t, x) => t + x, 0) !== total || w.some((x) => !(x >= 1))) throw Error('Weights must be whole tickets summing to the total');
  return w;
}
