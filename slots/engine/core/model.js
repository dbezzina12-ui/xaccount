// Compiles a game's model.json into the typed-array form the evaluator uses,
// and rejects models that break the rules the math and the visuals rely on.
//
// Units: line pays are integer multiples of the LINE bet. Scatter pays are
// multiples of the TOTAL bet. Internally every win is kept in integer
// line-bet units ("LB") so sums are exact; divide by lineCount for x-bet.

const KINDS = new Set(['high', 'low', 'wild', 'scatter']);

function fail(msg) {
  throw new Error(`model.json: ${msg}`);
}

function countTable(obj, reels, what) {
  const t = new Float64Array(reels + 1);
  for (const [k, v] of Object.entries(obj ?? {})) {
    const n = Number(k);
    if (!Number.isInteger(n) || n < 1 || n > reels) fail(`${what}: count "${k}" is not 1..${reels}`);
    if (!(v >= 0)) fail(`${what}: value for ${k} must be >= 0`);
    t[n] = v;
  }
  return t;
}

export function compileModel(json) {
  const reels = json.grid?.reels;
  const rows = json.grid?.rows;
  if (!(reels >= 3 && rows >= 1)) fail('grid needs reels >= 3 and rows >= 1');

  const symbols = Object.keys(json.symbols ?? {});
  if (symbols.length > 127) fail('too many symbols');
  const index = Object.fromEntries(symbols.map((s, i) => [s, i]));
  const kind = symbols.map((s) => {
    const k = json.symbols[s].kind;
    if (!KINDS.has(k)) fail(`symbol ${s} has unknown kind "${k}"`);
    return k;
  });
  const WILD = kind.indexOf('wild');
  const SCATTER = kind.indexOf('scatter');
  if (kind.filter((k) => k === 'wild').length > 1) fail('at most one wild symbol');
  if (SCATTER < 0 || kind.filter((k) => k === 'scatter').length > 1) fail('exactly one scatter symbol');

  const nSym = symbols.length;
  const pays = new Float64Array(nSym * (reels + 1));
  for (const [s, table] of Object.entries(json.pays ?? {})) {
    const i = index[s];
    if (i === undefined) fail(`pays: unknown symbol ${s}`);
    if (kind[i] !== 'high' && kind[i] !== 'low') fail(`pays: ${s} is ${kind[i]}; only high/low symbols have line pays`);
    const t = countTable(table, reels, `pays.${s}`);
    for (let n = 0; n <= reels; n++) {
      if (!Number.isInteger(t[n])) fail(`pays.${s}: line pays must be whole line-bet multiples`);
      pays[i * (reels + 1) + n] = t[n];
    }
  }
  // Best paying symbol: what an all-wild line pays as.
  let bestSym = -1;
  for (let i = 0; i < nSym; i++) {
    if (bestSym < 0 || pays[i * (reels + 1) + reels] > pays[bestSym * (reels + 1) + reels]) {
      if (kind[i] === 'high' || kind[i] === 'low') bestSym = i;
    }
  }

  const lines = (json.paylines ?? []).map((l, li) => {
    if (l.length !== reels) fail(`payline ${li + 1} must have ${reels} entries`);
    for (const r of l) if (!(Number.isInteger(r) && r >= 0 && r < rows)) fail(`payline ${li + 1} row ${r} out of range`);
    return Int8Array.from(l);
  });
  if (lines.length === 0) fail('at least one payline');
  const seen = new Set(lines.map((l) => l.join()));
  if (seen.size !== lines.length) fail('duplicate paylines');
  const nLines = lines.length;

  const sc = json.scatter ?? {};
  if (sc.symbol !== symbols[SCATTER]) fail(`scatter.symbol must be "${symbols[SCATTER]}"`);
  const scatterPayX = countTable(sc.pays, reels, 'scatter.pays');
  const scatterAward = countTable(sc.awards, reels, 'scatter.awards');
  const fs = json.freeSpins ?? {};
  const retrigger = countTable(fs.retrigger, reels, 'freeSpins.retrigger');
  const wm = fs.wildMultipliers ?? { values: [1], weights: [1] };
  if (wm.values.length !== wm.weights.length || wm.values.length === 0) fail('wildMultipliers values/weights mismatch');
  for (const v of wm.values) if (!(Number.isInteger(v) && v >= 1)) fail('wild multipliers must be whole numbers >= 1');
  for (const w of wm.weights) if (!(Number.isInteger(w) && w > 0)) fail('wild multiplier weights must be positive integers');
  const multTotal = wm.weights.reduce((a, b) => a + b, 0);

  const wildReels = WILD >= 0 ? new Set((json.symbols[symbols[WILD]].reels ?? []).map((r) => r - 1)) : new Set();

  const strips = {};
  for (const set of ['base', 'free']) {
    const raw = json.reels?.[set];
    if (!Array.isArray(raw) || raw.length !== reels) fail(`reels.${set} needs ${reels} strips`);
    strips[set] = raw.map((str, ri) => {
      const ids = str.trim().split(/\s+/);
      if (ids.length < rows + 2) fail(`reels.${set}[${ri}] is too short`);
      const strip = Int8Array.from(ids.map((id) => {
        const i = index[id];
        if (i === undefined) fail(`reels.${set}[${ri}] has unknown symbol ${id}`);
        return i;
      }));
      if (WILD >= 0 && !wildReels.has(ri) && strip.includes(WILD)) {
        fail(`reels.${set}[${ri}] contains ${symbols[WILD]} but the wild is only allowed on reels ${[...wildReels].map((r) => r + 1).join(',')}`);
      }
      // At most one scatter in any visible window, so a reel shows 0 or 1.
      for (let stop = 0; stop < strip.length; stop++) {
        let n = 0;
        for (let r = 0; r < rows; r++) if (strip[(stop + r) % strip.length] === SCATTER) n++;
        if (n > 1) fail(`reels.${set}[${ri}] can show ${n} scatters at stop ${stop}; space them at least ${rows} apart`);
      }
      return strip;
    });
  }

  const maxWinX = json.maxWinX;
  if (!(maxWinX > 0)) fail('maxWinX must be > 0');
  const bb = json.bonusBuy ?? null;
  if (bb && !(bb.priceX > 0 && Number.isInteger(bb.spins) && bb.spins > 0)) fail('bonusBuy needs priceX > 0 and whole spins > 0');

  return {
    json,
    id: json.id,
    reels,
    rows,
    symbols,
    index,
    kind,
    WILD,
    SCATTER,
    nSym,
    bestSym,
    pays,
    lines,
    nLines,
    scatterPayX,
    // Scatter pays converted to integer line-bet units (exact when pays are whole).
    scatterPayLB: scatterPayX.map((x) => x * nLines),
    scatterAward,
    retrigger,
    multValues: wm.values.slice(),
    multWeights: wm.weights.slice(),
    multTotal,
    wildReels,
    strips,
    maxWinX,
    maxWinLB: maxWinX * nLines,
    bonusBuy: bb,
    // Reused scratch buffers for the allocation-free simulation path.
    _grid: new Int8Array(reels * rows),
    _mult: new Float64Array(reels * rows),
  };
}
