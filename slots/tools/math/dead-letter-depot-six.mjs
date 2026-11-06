#!/usr/bin/env node
// Dead Letter Depot: the six-symbol bonus trial (engine/six.js). Simulates,
// fits and reports it APART from the release math (MATH.md), on worker
// threads, through the trial engine itself.
//   node tools/math/dead-letter-depot-six.mjs [--variant flat|ladder|balanced|steady|keyring|vault] [--fit] [--write] [--render] [--bonus 4e5] [--spins 6e6]
// --fit solves Night Shift and Double Post lowScale, Lost & Found keyWeight
// (Mystery 400x at 96%) and the base and Priority Mail FS chances; --write
// stores them in engine/six.js. Without --fit it measures and writes
// games/dead-letter-depot/SIX.md and math/six-summary.json.
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { playSixBonus, playSixRound, playSixSpin, sixLands, selectRack, VARIANTS, SIX_MODES, SIX_MYSTERY, seeded } from '../../games/dead-letter-depot/engine/six.js';
import { spinBoard } from '../../games/dead-letter-depot/engine/engine.js';
import { CAP, PAYING, LOWS, bonusFor } from '../../games/dead-letter-depot/engine/rules.js';

const GAME = new URL('../../games/dead-letter-depot/', import.meta.url);
const BONUS_NAMES = { regular: 'Night Shift', super: 'Double Post', hidden: 'Lost & Found' };
const RTP = 0.96, Z = 3.29, NEVER = Object.fromEntries(PAYING.map((s) => [s, Infinity]));
const OVER = [1, 5, 10, 25, 50, 100, 125, 250, 500, 1000, 5000, 25000];
const specWith = (patch = {}, variant = 'flat') => Object.fromEntries(Object.entries(VARIANTS[variant].spec).map(([k, v]) => [k, { ...v, ...(patch[k] ?? {}) }]));

// ---- worker jobs ----
export function chunk(job) {
  const variant = job.variant ?? 'flat', spec = specWith(job.patch, variant), lands = sixLands(spec), g = seeded(job.seed);
  const o = { n: 0, floored: 0, sum: 0, sum2: 0, max: 0, capped: 0, zero: 0, over: OVER.map(() => 0), trig: { regular: 0, super: 0, hidden: 0 }, keyRack: 0, keyBonus: 0, keyHits: 0, hitSpins: 0, spins: 0, retrig: 0, meterHist: new Array(12).fill(0), tiers: {}, vals: job.job === 'bonus' ? new Float64Array(job.n) : null, ringFills: 0, ringBonus: 0, vaults: 0, fillHist: new Array(8).fill(0), activeSpins: 0 };
  const add = (x) => { o.n++; o.sum += x; o.sum2 += x * x; if (x > o.max) o.max = x; if (!x) o.zero++; for (let j = 0; j < OVER.length; j++) if (x >= OVER[j]) o.over[j]++; };
  const noteBonus = (b) => {
    if (b.rack.includes('KEY')) { o.keyRack++; if (b.keyHits) o.keyBonus++; o.keyHits += b.keyHits; }
    for (const s of b.spins) { o.spins++; if (s.meter.hit) o.hitSpins++; if (s.meter.active) o.activeSpins++; if (s.retrigger) o.retrig++; }
    o.meterHist[Math.min(11, Math.floor(Math.log2(Math.max(1, b.meter))))]++;
    if (b.ringFills !== undefined) { o.ringFills += b.ringFills; if (b.ringFills) o.ringBonus++; if (b.vault) o.vaults++; o.fillHist[Math.min(7, b.ringFills)]++; }
  };
  for (let i = 0; i < job.n; i++) {
    const rng = seeded(Math.floor(g() * 4294967296));
    if (job.job === 'bonus') { const b = playSixBonus(job.tier, rng, CAP, { lands, spec, record: false }); add(b.total / 100); o.vals[i] = b.total / 100; if (b.capped) o.capped++; if (b.floorTopUp) o.floored++; noteBonus(b); }
    else if (job.job === 'spins') { const m = SIX_MODES[job.mode], r = playSixSpin(m.land, rng, { lands, spec }); add(r.win / 100); const t = bonusFor(r.fs); if (t) o.trig[t]++; }
    else { const r = playSixRound({ mode: job.mode, rng, variant, lands, spec, record: false }); add(r.total / 100); if (r.capped) o.capped++; if (r.bonus) { noteBonus(r.bonus); o.tiers[r.bonus.tier] = (o.tiers[r.bonus.tier] ?? 0) + 1; } }
  }
  return o;
}
const merge = (a, b) => ({ ...a, n: a.n + b.n, floored: a.floored + b.floored, sum: a.sum + b.sum, sum2: a.sum2 + b.sum2, max: Math.max(a.max, b.max), capped: a.capped + b.capped, zero: a.zero + b.zero, over: a.over.map((v, j) => v + b.over[j]),
  trig: Object.fromEntries(Object.keys(a.trig).map((k) => [k, a.trig[k] + b.trig[k]])), keyRack: a.keyRack + b.keyRack, keyBonus: a.keyBonus + b.keyBonus, keyHits: a.keyHits + b.keyHits, hitSpins: a.hitSpins + b.hitSpins, spins: a.spins + b.spins, retrig: a.retrig + b.retrig,
  meterHist: a.meterHist.map((v, j) => v + b.meterHist[j]), vals: a.vals && b.vals ? Float64Array.from([...a.vals, ...b.vals]) : null, ringFills: a.ringFills + b.ringFills, ringBonus: a.ringBonus + b.ringBonus, vaults: a.vaults + b.vaults, fillHist: a.fillHist.map((v, j) => v + b.fillHist[j]), activeSpins: (a.activeSpins ?? 0) + (b.activeSpins ?? 0), tiers: Object.fromEntries([...new Set([...Object.keys(a.tiers), ...Object.keys(b.tiers)])].map((k) => [k, (a.tiers[k] ?? 0) + (b.tiers[k] ?? 0)])) });
export async function run(job, threads = availableParallelism()) {
  const per = Math.ceil(job.n / threads);
  const parts = await Promise.all(Array.from({ length: threads }, (_, w) => new Promise((resolve, reject) => {
    const n = Math.max(0, Math.min(per, job.n - w * per));
    const worker = new Worker(fileURLToPath(import.meta.url), { workerData: { ...job, n, seed: (job.seed + 104729 * (w + 1)) >>> 0 } });
    worker.once('message', resolve); worker.once('error', reject);
  })));
  const r = parts.reduce(merge), mean = r.sum / r.n, sd = Math.sqrt(Math.max(0, r.sum2 / r.n - mean * mean));
  return { ...r, mean, sd, se: sd / Math.sqrt(r.n) };
}

// ---- fit ----
async function solve(g, lo, hi, tol) {
  let flo = await g(lo), fhi = await g(hi), x = lo;
  const sign = flo <= 0 ? 1 : -1; flo *= sign; fhi *= sign;
  if (flo > 0 || fhi < 0) throw Error(`no root between ${lo} and ${hi}`);
  for (let i = 0; i < 14; i++) { x = (lo * fhi - hi * flo) / (fhi - flo); const fx = sign * (await g(x)); if (Math.abs(fx) < tol) break; if (fx > 0) { hi = x; fhi = fx; flo /= 2; } else { lo = x; flo = fx; fhi /= 2; } }
  return Math.round(x * 1e4) / 1e4;
}
export async function fit({ bonusN = 4e5, spinN = 6e6, seed = 913, variant = 'flat' } = {}) {
  const target = { regular: RTP * 100, super: RTP * 250 }, w = VARIANTS[variant].mystery ?? SIX_MYSTERY;
  target.hidden = (RTP * 400 - w.regular * target.regular - w.super * target.super) / w.hidden;
  const patch = {}, means = {};
  const ranges = variant === 'vault' ? [['regular', 'lowScale', 1.3, 2.3], ['super', 'lowScale', 1.5, 2.6], ['hidden', 'lowScale', 1.2, 1.8]] : variant === 'keyring' ? [['regular', 'lowScale', 0.65, 0.9], ['super', 'lowScale', 0.65, 0.9], ['hidden', 'lowScale', 1.25, 1.45]] : variant === 'steady' ? [['regular', 'lowScale', 0.4, 2], ['super', 'lowScale', 0.4, 2], ['hidden', 'lowScale', 0.8, 2.5]] : variant === 'balanced' ? [['regular', 'lowScale', 0.4, 2], ['super', 'lowScale', 0.4, 2], ['hidden', 'keyWeight', 10, 45]] : variant === 'ladder' ? [['regular', 'lowScale', 0.3, 1.6], ['super', 'lowScale', 0.3, 1.6], ['hidden', 'keyWeight', 3, 45]] : [['regular', 'lowScale', 0.8, 1.6], ['super', 'lowScale', 0.8, 1.6], ['hidden', 'keyWeight', 20, 45]];
  for (const [tier, knob, lo, hi] of ranges) {
    const f = async (v) => (await run({ job: 'bonus', tier, n: bonusN, seed, variant, patch: { ...patch, [tier]: { [knob]: v } } })).mean - target[tier];
    patch[tier] = { [knob]: await solve(f, lo, hi, 0.002 * target[tier]) };
    means[tier] = (await run({ job: 'bonus', tier, n: bonusN, seed, variant, patch })).mean;
    console.log(`${tier} ${knob} ${patch[tier][knob]} -> ${means[tier].toFixed(2)}x (target ${target[tier].toFixed(2)})`);
  }
  for (const mode of ['base', 'priority']) {
    const cost = SIX_MODES[mode].cost;
    const f = async (fs) => { const s = await run({ job: 'spins', mode, n: spinN, seed, variant, patch: { ...patch, [mode]: { fs } } }); return (s.mean + Object.entries(s.trig).reduce((a, [t, c]) => a + (c / s.n) * means[t], 0)) / cost - RTP; };
    patch[mode] = { fs: await solve(f, 0.002, 0.08, 0.0005) };
    console.log(`${mode} fs ${patch[mode].fs}`);
  }
  return { target, patch, means };
}
function write(patch, variant = 'flat') {
  const path = new URL('engine/six.js', GAME), src = readFileSync(path, 'utf8');
  const block = { flat: 'SIX', ladder: 'SIX_LADDER', balanced: 'SIX_BALANCED', steady: 'SIX_STEADY', keyring: 'SIX_KEYRING', vault: 'SIX_VAULT' }[variant];
  if (!block) throw Error(`Unknown variant ${variant}`);
  const head = `export const ${block} = Object.freeze({`, a = src.indexOf(head), b = src.indexOf('\n});', a);
  if (a < 0) throw Error(`no ${head} in six.js`);
  let text = src.slice(a, b);
  for (const [tier, p] of Object.entries(patch)) for (const [k, v] of Object.entries(p)) {
    const re = new RegExp(`(  ${tier}: Object\\.freeze\\(\\{[^\\n]*?${k}: )([0-9.]+)`);
    if (!re.test(text)) throw Error(`no ${tier}.${k} in ${head}`);
    text = text.replace(re, `$1${v}`);
  }
  writeFileSync(path, src.slice(0, a) + text + src.slice(b));
}

// ---- report ----
const pct = (x, d = 2) => (100 * x).toFixed(d) + '%';
const every = (p, n) => (p > 0 ? '1 in ' + (1 / p >= 100 ? Math.round(1 / p).toLocaleString('en-US') : (1 / p).toFixed(1)) : `not seen in ${n.toLocaleString('en-US')}`);
export const sixHash = () => createHash('sha256').update(readFileSync(new URL('engine/six.js', GAME))).update(readFileSync(new URL('engine/engine.js', GAME))).update(readFileSync(new URL('engine/rules.js', GAME))).digest('hex').slice(0, 16);

// Replacement stamp-feature concepts, measured at the base FS chance: a paid
// spin that carries a spin-local rack (no carry-over).
async function concepts(seed) {
  const out = [];
  for (const [name, rack, start] of [['Rack Spin: three random basics, meter from 1x', 'basics', 1], ['Premium Rack Spin: three basics + KEY, meter from 2x', 'key', 2]]) {
    const n = 2e6, g = seeded(seed + name.length), lands = sixLands(specWith());
    let sum = 0, sum2 = 0;
    for (let i = 0; i < n; i++) {
      const rng = seeded(Math.floor(g() * 4294967296));
      const r = spinBoard('base', rng, { lands, targets: NEVER, record: true });
      const pick = rack === 'key' ? [...selectRack('regular', rng).slice(0, 3), 'KEY'] : selectRack('regular', rng).slice(0, 3);
      let m = start; for (const st of r.steps) { const hits = st.wins.map((w) => w.s).filter((s) => pick.includes(s)); m = (m + hits.reduce((t, s) => t + (s === 'KEY' ? 0 : LOWS.includes(s) ? 1 : 3), 0)) * (hits.includes('KEY') ? 2 : 1); }
      const x = Math.min(CAP, r.subtotal * m) / 100; sum += x; sum2 += x * x;
    }
    const mean = sum / n;
    out.push({ name, spinValue: mean, se: Math.sqrt(sum2 / n - mean * mean) / Math.sqrt(n) });
  }
  return out;
}

const quantiles = (vals) => { const v = Float64Array.from(vals).sort(); return Object.fromEntries([0.1, 0.25, 0.5, 0.75, 0.9].map((q) => [q, v[Math.floor(q * (v.length - 1))]])); };
async function report({ bonusN = 1e6, spinN = 1e7, roundN = 1e7, buyN = 1e6, seed = 20261106, variant = 'flat' } = {}) {
  const s = { variant, version: VARIANTS[variant].version, source: sixHash(), seed, spec: VARIANTS[variant].spec, mystery: VARIANTS[variant].mystery ?? SIX_MYSTERY, bonuses: {}, modes: {} };
  for (const tier of ['regular', 'super', 'hidden']) {
    const r = await run({ job: 'bonus', tier, n: bonusN, seed: seed + 1, variant });
    s.bonuses[tier] = { floorShare: r.floored / r.n, n: r.n, mean: r.mean, se: r.se, sd: r.sd, zero: r.zero / r.n, max: r.max, capped: r.capped, over: Object.fromEntries(OVER.map((x, j) => [x, r.over[j] / r.n])), keyInRack: r.keyRack / r.n, keyBonusShare: r.keyRack ? r.keyBonus / r.keyRack : 0, keyHitsPerKeyBonus: r.keyRack ? r.keyHits / r.keyRack : 0, hitSpinShare: r.hitSpins / r.spins, spins: r.spins / r.n, retriggerPerBonus: r.retrig / r.n, meterHist: r.meterHist.map((v) => v / r.n), quantiles: quantiles(r.vals) };
    if (VARIANTS[variant].spec[tier].ring) Object.assign(s.bonuses[tier], { activeSpinShare: r.activeSpins / r.spins, ringFillsPerBonus: r.ringFills / r.n, ringShare: r.ringBonus / r.n, vaultShare: r.vaults / r.n, fillHist: r.fillHist.map((v) => v / r.n) });
  }
  const B = s.bonuses;
  for (const [id, m] of Object.entries(SIX_MODES)) {
    const row = { title: m.title, cost: m.cost };
    if (m.kind === 'spin') {
      const sp = await run({ job: 'spins', mode: id, n: spinN, seed: seed + 2, variant });
      const rates = Object.fromEntries(Object.entries(sp.trig).map(([t, c]) => [t, c / sp.n]));
      const bonus = Object.entries(rates).reduce((a, [t, r]) => a + r * B[t].mean, 0);
      const v = sp.se ** 2 + Object.entries(rates).reduce((a, [t, r]) => a + B[t].mean ** 2 * r * (1 - r) / sp.n + r * r * B[t].se ** 2, 0);
      Object.assign(row, { fs: s.spec[m.land].fs, spinRtp: sp.mean / m.cost, rtp: (sp.mean + bonus) / m.cost, ci999: Z * Math.sqrt(v) / m.cost, rates });
    } else {
      const w = m.bonus ? { [m.bonus]: 1 } : s.mystery, mean = Object.entries(w).reduce((a, [t, p]) => a + p * B[t].mean, 0);
      Object.assign(row, { weights: w, rtp: mean / m.cost, ci999: Z * Math.sqrt(Object.entries(w).reduce((a, [t, p]) => a + (p * B[t].se) ** 2, 0)) / m.cost });
    }
    const r = await run({ job: 'rounds', mode: id, n: m.kind === 'buy' ? buyN : roundN, seed: seed + 3, variant });
    row.rounds = { n: r.n, rtp: r.mean / m.cost, ci999: Z * r.se / m.cost, hit: 1 - r.zero / r.n, capped: r.capped, max: r.max, over: Object.fromEntries(OVER.map((x, j) => [x, r.over[j] / r.n])) };
    s.modes[id] = row;
  }
  s.concepts = variant === 'flat' ? await concepts(seed) : [];
  return s;
}

function markdown(s) {
  const L = [], b = s.bonuses;
  const ladder = s.variant !== 'flat', vault = s.variant === 'vault', ring = s.variant === 'keyring' || vault, balanced = s.variant === 'balanced' || s.variant === 'steady' || ring;
  L.push(`# Dead Letter Depot · six-symbol bonus trial${vault ? ', the vault' : ring ? ', key ring' : s.variant === 'steady' ? ', steady ladder' : balanced ? ', balanced ladder' : ladder ? ', ladder variant' : ''} (separate from release math)`, '');
  L.push(`Generated by \`tools/math/dead-letter-depot-six.mjs\` · trial engine \`${s.version}\` · source \`${s.source}\` · seed ${s.seed}. **This is a producer trial.** These figures are not the release RTP in [MATH.md](MATH.md).`, '');
  L.push('## Rules as the trial engine settles them', '');
  L.push('- **Board.** The same 6×5 pay-anywhere tumbles. There are no stamps and no collection jobs.');
  if (balanced) L.push(`- **Base and Priority Mail spins** first draw a rack of ${s.spec.base.rack} basics. Each paying group of a racked basic ${s.spec.base.rackRule === 'double' ? 'doubles' : 'adds +1 to'} that spin's meter, which starts at 1× and multiplies the spin's tumble subtotal once. Their FS chance is fitted for 96%.`);
  else L.push('- **Base and Priority Mail spins** have no rack and pay face value. Their FS chance is fitted for 96%.');
  if (ring) {
    const r = s.spec.regular;
    L.push('- **The rack.** Each bonus draws six symbols: three basics, two of PHONE, PARCEL and ENVELOPE, and KEY. **Every bonus racks KEY.** The rack is fixed for the whole bonus.');
    const adds = (t) => [['basics', 1, t.addCap[0]], ['premiums', 3, t.addCap[1]]].map(([w, a, c]) => (c <= 0 ? `${w} add nothing` : c <= a ? `${w} +${c}` : `${w} +${a}, then +${c}`)).join(', ');
    if (vault) L.push(`- **The meter.** Each racked basic or premium that pays adds to the meter: Night Shift ${adds(s.spec.regular)}; Double Post ${adds(s.spec.super)}; Lost & Found ${adds(s.spec.hidden)}. KEY never multiplies. The meter carries through the bonus and multiplies each spin's tumble subtotal once.`);
    else L.push(`- **The meter (capped ladder).** Each racked basic or premium that pays adds its next addition, which then doubles, but only up to +${r.addCap[0]} for basics and +${r.addCap[1]} for premiums (basics +1, then +${r.addCap[0]}; premiums +3, then +${r.addCap[1]}). KEY no longer multiplies the meter. The meter carries through the bonus and multiplies each spin's tumble subtotal once.`);
    L.push(`- **The key ring.** Every KEY that lands in a bonus, on the first board or in a refill, turns one notch. Each full ring of ${r.ring} notches adds to the meter: Night Shift +${s.spec.regular.ringAdd}, Double Post +${s.spec.super.ringAdd}, Lost & Found +${s.spec.hidden.ringAdd}. Notches carry across free spins.`);
    L.push(`- **The vault.** The first KEY match (8 or more KEYs paying) opens the vault: the meter goes to its ceiling${vault ? ` (${s.spec.regular.ceiling.toLocaleString('en-US')}× in every bonus)` : ''} and stays there for the rest of the bonus.`);
  } else L.push('- **The rack.** Each bonus draws six symbols: three basics and three premiums. Lost & Found always has KEY plus two other premiums. The rack is fixed for the whole bonus.');
  if (ring) {} else if (ladder) L.push('- **The meter (ladder).** Every rack symbol has its own next addition: basics start at +1 and premiums at +3. Each time that symbol pays, its addition goes on the meter and then doubles for next time. The first KEY match multiplies the whole meter by 2, and every later one by 4. Additions apply before the KEY. The meter carries through the bonus and multiplies each spin\'s tumble subtotal once.');
  else L.push('- **The meter.** In each tumble, every paying group of a rack symbol moves the meter: a basic adds +1, a premium adds +3, and KEY doubles. Additions apply before the doubling. The meter carries through the bonus and multiplies each spin\'s tumble subtotal once.');
  L.push(`  - **Night Shift** starts at ${s.spec.regular.start}× and applies only on a spin with a rack hit${ring ? ', a ring fill or an open vault' : ''}.`);
  L.push(`  - **Double Post** starts at ${s.spec.super.start}× and applies every spin.`);
  L.push(`  - **Lost & Found** starts at ${s.spec.hidden.start}× and applies every spin.`);
  L.push(`  - Ceilings are ${s.spec.regular.ceiling}× / ${s.spec.super.ceiling}× / ${s.spec.hidden.ceiling}×.`);
  if (s.spec.hidden.floor) L.push(`  - **Lost & Found pays at least ${(s.spec.hidden.floor / 100).toLocaleString('en-US')}×.** A bonus that ends below it is topped up to it.`);
  L.push(`- **Free-spin landings (fitted).** Night Shift basics ×${s.spec.regular.lowScale}${ring ? ` and KEY weight ${s.spec.regular.keyWeight}` : ''}, Double Post basics ×${s.spec.super.lowScale}${ring ? ` and KEY weight ${s.spec.super.keyWeight}` : ''}, Lost & Found basics ×${s.spec.hidden.lowScale} and KEY weight ${s.spec.hidden.keyWeight}. Mystery Delivery draws ${Object.entries(s.mystery).map(([t, w]) => `${t} ${pct(w, 0)}`).join(', ')}.`, '');
  L.push('## Every mode', '', '| Mode | Cost | RTP (99.9%) | Whole-round check | Hit | Capped |', '|---|---|---|---|---|---|');
  for (const r of Object.values(s.modes)) L.push(`| ${r.title} | ${r.cost}× | **${pct(r.rtp)}** ± ${pct(r.ci999)} | ${pct(r.rounds.rtp)} ± ${pct(r.rounds.ci999)} | ${pct(r.rounds.hit)} | ${every(r.rounds.capped / r.rounds.n, r.rounds.n)} |`);
  L.push('', '### How often a round pays at least', '', '| Mode | ≥1× | ≥5× | ≥10× | ≥25× | ≥100× | ≥500× | ≥1,000× | ≥5,000× |', '|---|---|---|---|---|---|---|---|---|');
  for (const r of Object.values(s.modes)) if (r.rounds.over) L.push(`| ${r.title} | ${[1, 5, 10, 25, 100, 500, 1000, 5000].map((x) => (r.rounds.over[x] >= 0.01 ? pct(r.rounds.over[x]) : every(r.rounds.over[x], r.rounds.n))).join(' | ')} |`);
  const anyOf = (rates) => Object.values(rates).reduce((a, b) => a + b, 0);
  L.push('', `Bonus entry: base ${Object.entries(s.modes.base.rates).map(([t, r]) => `${t} ${every(r)}`).join(', ')} (any bonus ${every(anyOf(s.modes.base.rates))}); Priority Mail ${Object.entries(s.modes.priority.rates).map(([t, r]) => `${t} ${every(r)}`).join(', ')} (any bonus ${every(anyOf(s.modes.priority.rates))}).`, '');
  const q = (x) => (x.quantiles ? `${x.quantiles[0.5].toLocaleString('en-US')}× | ${x.quantiles[0.25].toLocaleString('en-US')}–${x.quantiles[0.75].toLocaleString('en-US')}×` : '— | —');
  if (ring) {
    L.push('## Bonuses', '', '| Bonus | Average (99.9%) | SD | Median | Middle half | Pays 0 | ≥25× | ≥100× | ≥500× | ≥1,000× | ≥5,000× | Max seen | Reaches cap | Paid at the minimum | Ring fills per bonus | Bonuses with a ring fill | Vault opens | Spins with a rack hit |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const [t, x] of Object.entries(b)) L.push(`| ${t} | **${x.mean.toFixed(2)}×** ± ${(Z * x.se).toFixed(2)} | ${x.sd.toFixed(0)} | ${q(x)} | ${every(x.zero, x.n)} | ${pct(x.over[25], 1)} | ${pct(x.over[100], 1)} | ${pct(x.over[500], 1)} | ${pct(x.over[1000], 2)} | ${pct(x.over[5000], 2)} | ${x.max.toLocaleString('en-US')}× | ${every(x.capped / x.n, x.n)} | ${x.floorShare ? pct(x.floorShare, 1) : '—'} | ${x.ringFillsPerBonus.toFixed(2)} | ${pct(x.ringShare, 1)} | ${every(x.vaultShare, x.n)} | ${pct(x.hitSpinShare, 0)} |`);
    L.push('', ...Object.entries(b).map(([t, x]) => `- ${BONUS_NAMES[t]} ring fills: ${x.fillHist.map((p, k) => (p > 0.0005 ? `${k}${k === 7 ? '+' : ''}: ${pct(p, 1)}` : null)).filter(Boolean).join(' · ')}.`));
  } else {
    L.push('## Bonuses', '', '| Bonus | Average (99.9%) | SD | Median | Middle half | Pays 0 | ≥25× | ≥100× | ≥500× | ≥1,000× | ≥5,000× | Max seen | Reaches cap | Paid at the minimum | KEY in rack | Bonuses with a KEY double (when racked) | Spins with a rack hit |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const [t, x] of Object.entries(b)) L.push(`| ${t} | **${x.mean.toFixed(2)}×** ± ${(Z * x.se).toFixed(2)} | ${x.sd.toFixed(0)} | ${q(x)} | ${every(x.zero, x.n)} | ${pct(x.over[25], 1)} | ${pct(x.over[100], 1)} | ${pct(x.over[500], 1)} | ${pct(x.over[1000], 2)} | ${pct(x.over[5000], 2)} | ${x.max.toLocaleString('en-US')}× | ${every(x.capped / x.n, x.n)} | ${x.floorShare ? pct(x.floorShare, 1) : '—'} | ${pct(x.keyInRack, 0)} | ${pct(x.keyBonusShare, 2)} | ${pct(x.hitSpinShare, 0)} |`);
  }
  L.push('', `Lost & Found's final meter: ${b.hidden.meterHist.map((p, k) => (p > 0.0005 ? `${2 ** k}–${2 ** (k + 1) - 1}×: ${pct(p, 1)}` : null)).filter(Boolean).join(' · ')}.`, '');
  const baseBonus = (s.modes.base.rtp - s.modes.base.spinRtp) * s.modes.base.cost;
  if (s.concepts.length) L.push('## Replacement stamp-feature concepts', '', `Paid spins that carry a spin-local rack (no carry-over), measured at the base FS chance. A spin at that chance also carries ${baseBonus.toFixed(3)}× of bonus value.`, '', '| Concept | Spin value (99.9%) | Price for 96% with bonus value |', '|---|---|---|');
  for (const c of s.concepts) L.push(`| ${c.name} | ${c.spinValue.toFixed(3)}× ± ${(Z * c.se).toFixed(3)} | ${((c.spinValue + baseBonus) / RTP).toFixed(2)}× |`);
  if (s.concepts.length) L.push('', 'At these values neither concept can replace Special Delivery or Double Exposure as a premium-priced spin. A paid version would need a higher starting meter or more spins.');
  L.push('', '## Findings for the producer', '');
  if (ring) {
    L.push(`- **KEY acts in almost every bonus.** The ring fills at least once in ${pct(b.regular.ringShare, 1)} of Night Shift, ${pct(b.super.ringShare, 1)} of Double Post and ${pct(b.hidden.ringShare, 1)} of Lost & Found bonuses (${b.regular.ringFillsPerBonus.toFixed(1)}, ${b.super.ringFillsPerBonus.toFixed(1)} and ${b.hidden.ringFillsPerBonus.toFixed(1)} fills on average).`);
    const buy = (x, cost) => `pays back at least its price in ${pct(x.over[cost], 0)} of buys and less than half of it in ${pct(1 - x.over[cost / 2], 0)}`;
    if (b.regular.over[50] !== undefined) L.push(`- **Buys:** Night Shift (100×) ${buy(b.regular, 100)}; Double Post (250×) ${buy(b.super, 250)}.`);
    L.push(`- **The vault is the max-win path.** A KEY match opens it in 1 of every ${Math.round(1 / b.hidden.vaultShare).toLocaleString('en-US')} Lost & Found bonuses, and Lost & Found reaches the cap ${every(b.hidden.capped / b.hidden.n, b.hidden.n)}. Night Shift and Double Post open it ${every(b.regular.vaultShare, b.regular.n)} and ${every(b.super.vaultShare, b.super.n)}.`);
    L.push(`- **Lost & Found:** ${pct(1 - b.hidden.floorShare, 0)} of bonuses pass 1,000× by themselves, and the 1,000× minimum pays the other ${pct(b.hidden.floorShare, 0)}. The median bonus pays ${b.hidden.quantiles[0.5].toLocaleString('en-US')}×.`);
    L.push(`- **Night Shift applies its meter on ${pct(b.regular.activeSpinShare, 0)} of its spins** (${pct(b.regular.hitSpinShare, 0)} have a rack hit; the rest of them a ring fill or an open vault). The others pay face value.`);
    L.push('- **Golden seeds** are in `tests/six.test.mjs`. Each free spin records its first board\'s ring event in `land` and each tumble\'s in `steps[].rack` (`hits`, `add`, `keys`, `fills`, `notches`, `opened`, `vault`, `before`, `after`, `next`). `meter` sums the spin: `fills`, `vault`, `notches`, `hit`, `active`.', '');
    return L.join('\n');
  }
  L.push(`- **KEY almost never doubles in Night Shift or Double Post** (${pct(b.regular.keyBonusShare, 1)} and ${pct(b.super.keyBonusShare, 1)} of bonuses with KEY racked). Their meters grow from basics and a few premiums. Making KEY land more there would add the doubling, but also variance.`);
  L.push(`- **Lost & Found's value comes from KEY doubles.** ${pct(b.hidden.keyBonusShare, 0)} of its bonuses double at least once, it reaches the cap ${every(b.hidden.capped / b.hidden.n, b.hidden.n)}, and its free spins land KEY at weight ${s.spec.hidden.keyWeight} to get there.`);
  L.push(`- **Night Shift activates on ${pct(b.regular.hitSpinShare, 0)} of its spins.** The rest pay face value.`);
  if (b.hidden.floorShare) L.push(`- **The 1,000× minimum pays ${pct(b.hidden.floorShare, 0)} of Lost & Found bonuses.** Its ladder is all-or-nothing: either KEY doubles stack and it runs big, or they don't and it stays under 1,000×. Fewer bonuses would sit at the minimum only with a steadier meter (a higher start or more spins), which changes the bonus's shape.`);
  L.push(`- **Golden seeds** are in \`tests/six.test.mjs\`. Each free spin's per-tumble meter events are in \`steps[].rack\` (\`hits\`, \`add\`, \`doubled\`, \`before\`, \`after\`${ladder ? ', plus `keyFactor`, `next` and `nextKey` for the ladder' : ''}).`, '');
  return L.join('\n');
}

if (!isMainThread) parentPort.postMessage(chunk(workerData));
else if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (k, d) => (process.argv.includes(k) ? Number(process.argv[process.argv.indexOf(k) + 1]) : d), t0 = Date.now();
  const variant = process.argv.includes('--variant') ? process.argv[process.argv.indexOf('--variant') + 1] : 'flat';
  const files = { flat: ['math/six-summary.json', 'SIX.md'], ladder: ['math/six-ladder-summary.json', 'SIX-LADDER.md'], balanced: ['math/six-balanced-summary.json', 'SIX-BALANCED.md'], steady: ['math/six-steady-summary.json', 'SIX-STEADY.md'], keyring: ['math/six-keyring-summary.json', 'SIX-KEYRING.md'], vault: ['math/six-vault-summary.json', 'SIX-VAULT.md'] }[variant];
  if (process.argv.includes('--render')) {
    writeFileSync(new URL(files[1], GAME), markdown(JSON.parse(readFileSync(new URL(files[0], GAME), 'utf8'))));
    console.log(`re-rendered ${files[1]} from ${files[0]}`);
  } else if (process.argv.includes('--fit')) {
    const r = await fit({ bonusN: arg('--bonus', 4e5), spinN: arg('--spins', 6e6), variant });
    if (process.argv.includes('--write')) { write(r.patch, variant); console.log('wrote engine/six.js'); }
  } else {
    const s = await report({ bonusN: arg('--bonus', 1e6), spinN: arg('--spins', 1e7), variant });
    writeFileSync(new URL(files[0], GAME), JSON.stringify(s, null, 1) + '\n');
    writeFileSync(new URL(files[1], GAME), markdown(s));
    for (const [id, r] of Object.entries(s.modes)) console.log(`${id.padEnd(10)} ${pct(r.rtp, 3)} ± ${pct(r.ci999, 3)} · rounds ${pct(r.rounds.rtp, 3)} ± ${pct(r.rounds.ci999, 3)}`);
  }
  console.log(`${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
