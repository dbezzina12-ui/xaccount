#!/usr/bin/env node
// Dead Letter Depot (reels): the math report. Regenerates
// games/dead-letter-depot/MATH.md and math/summary.json from Monte Carlo runs
// through the game's own engine.
//   node tools/math/dead-letter-depot-report.mjs [--spins 1e7] [--bonus 1e6] [--rounds 1e7] [--buys 1e6] [--seed 20261105]
//
// Each spin mode's RTP is measured two ways: decomposed (its own pay from
// --spins spin-only rounds, plus its trigger rates times the bonus averages
// from --bonus bought bonuses), which is the tighter figure; and whole rounds
// through playRound (--rounds, --buys) as an independent cross-check.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as R from '../../games/dead-letter-depot/engine/rules.js';
import { ENGINE_VERSION } from '../../games/dead-letter-depot/engine/engine.js';
import { run } from './dead-letter-depot-sim.mjs';

const GAME = new URL('../../games/dead-letter-depot/', import.meta.url);
const arg = (k, d) => (process.argv.includes(k) ? Number(process.argv[process.argv.indexOf(k) + 1]) : d);
const Z = 3.29; // 99.9% two-sided

export function sourceHash() {
  const h = createHash('sha256');
  for (const f of ['engine/rules.js', 'engine/engine.js']) h.update(readFileSync(new URL(f, GAME)));
  return h.digest('hex').slice(0, 16);
}

export async function build({ spinN = 1e7, bonusN = 1e6, roundN = 1e7, buyN = 1e6, seed = 20261105 } = {}) {
  const out = { game: 'dead-letter-depot', engine: ENGINE_VERSION, source: sourceHash(), seed, cap: R.CAP / 100, rtpTarget: R.RTP_TARGET, bonuses: {}, modes: {}, mystery: R.MYSTERY };
  for (const [tier, b] of Object.entries(R.BONUSES)) {
    const s = await run({ job: 'bonus', tier, n: bonusN, seed: seed + 1 });
    out.bonuses[tier] = { title: b.title, n: s.n, mean: s.mean, se: s.se, sd: s.sd, median: s.median, p90: s.p90, p99: s.p99, zero: s.zero, under25: 1 - s.over[25], max: s.max, capped: s.capped, spins: s.spins / s.n, retriggerChance: s.retrigBonuses / s.n, retriggersPerBonus: s.retrigPerBonus / s.n, stamp: R.LAND[tier].stamp, meter: b.meter, when: b.when, grow: b.grow, ceiling: b.ceiling ?? R.MAX_METER, clearsBy: s.clearsBy, clearHist: s.clearHist, meterHist: s.meterHist, activePayingShare: s.activePaying / Math.max(1, s.spins) };
    if (b.grow === 'add') {
      const f = await run({ job: 'bonus', tier, n: Math.round(bonusN / 2), seed: seed + 4, scheme: 'flat' });
      out.bonuses[tier].flat = { mean: f.mean, se: f.se, sd: f.sd, p99: f.p99, max: f.max, capped: f.capped, n: f.n };
    }
  }
  const B = out.bonuses;
  for (const [id, m] of Object.entries(R.MODES)) {
    const row = { title: m.title, kind: m.kind, cost: m.cost };
    if (m.kind === 'spin') {
      const s = await run({ job: 'spins', mode: id, n: spinN, seed: seed + 2 });
      const bonus = Object.entries(s.trig).reduce((a, [t, r]) => a + r * B[t].mean, 0);
      const varBonus = Object.entries(s.trig).reduce((a, [t, r]) => a + (B[t].mean ** 2) * r * (1 - r) / s.n + r * r * B[t].se ** 2, 0);
      Object.assign(row, { fs: R.LAND[m.land].fs, opening: m.opening, spinRtp: s.mean / m.cost, bonusRtp: bonus / m.cost, rtp: (s.mean + bonus) / m.cost, ci999: Z * Math.sqrt(s.se ** 2 + varBonus) / m.cost, spinHit: s.hit, tumbles: s.tumbles, trig: s.trig, bonusEvery: 1 / Object.values(s.trig).reduce((a, b) => a + b, 0), spinN: s.n, clearsBy: s.clearsBy, clearHist: s.clearHist });
      if (id === 'base') { const f = await run({ job: 'spins', mode: id, n: Math.round(spinN / 2), seed: seed + 5, scheme: 'flat' }); row.flatSpinRtp = f.mean / m.cost; }
    } else {
      const w = m.bonus ? { [m.bonus]: 1 } : R.MYSTERY;
      const mean = Object.entries(w).reduce((a, [t, p]) => a + p * B[t].mean, 0), se = Math.sqrt(Object.entries(w).reduce((a, [t, p]) => a + (p * B[t].se) ** 2, 0));
      Object.assign(row, { weights: w, rtp: mean / m.cost, ci999: Z * se / m.cost });
    }
    const r = await run({ job: 'rounds', mode: id, n: m.kind === 'buy' ? buyN : roundN, seed: seed + 3 });
    row.rounds = { n: r.n, rtp: r.mean / m.cost, ci999: Z * r.se / m.cost, sd: r.sd / m.cost, hit: r.hit, max: r.max, capped: r.capped, over: r.over, tiers: r.tiers, retriggerChance: r.retrigBonuses / Math.max(1, Object.values(r.trig).reduce((a, b) => a + b, 0) + Object.values(r.drawn).reduce((a, b) => a + b, 0)) };
    out.modes[id] = row;
  }
  const all = (id) => Object.values(out.modes[id].trig).reduce((a, b) => a + b, 0);
  out.priorityEntryRatio = all('priority') / all('base');
  return out;
}

const pct = (x, d = 2) => (100 * x).toFixed(d) + '%';
const every = (p, n) => (p > 0 ? '1 in ' + (1 / p >= 100 ? Math.round(1 / p).toLocaleString('en-US') : (1 / p).toFixed(1)) : n ? `not seen in ${n.toLocaleString('en-US')}` : 'never');
const x = (v) => v.toLocaleString('en-US', { maximumFractionDigits: 2 }) + '×';

export function markdown(s) {
  const L = [], modes = Object.entries(s.modes);
  L.push('# Dead Letter Depot · math sheet (reels v2: collections and the meter)', '');
  L.push(`Generated by \`tools/math/dead-letter-depot-report.mjs\` · engine \`${s.engine}\` · source \`${s.source}\` · seed ${s.seed} · **prototype math for producer review, not release-approved**.`, '');
  L.push('Every figure is simulated through the game\'s own engine. The 99.9% intervals are sampling uncertainty. The sorter prototype that came before is archived in [archive/sorter](archive/sorter/MATH.md); none of its figures apply here.', '');
  L.push('## How a round settles', '');
  L.push('- **The board.** 6 reels × 5 rows. Each cell lands a pay symbol, an FS or a multiplier stamp. Pay symbols by rank: KEY, PHONE, PARCEL, ENVELOPE (premiums), then A, K, Q, J, 10.');
  L.push('- **Pays.** 8 or more of a pay symbol anywhere pay. All winners clear together, survivors drop in order and refills fall from the top, until a check pays nothing.');
  L.push('- **Collections.** Every real symbol cleared in a win adds to its collection. Reaching the target is a **clear**: the symbol performs its job and the meter grows. Excess carries. Base collections last one spin; bonus collections carry across free spins.');
  L.push('- **Jobs** run on the settled board, in rank order. Each symbol fires at most 3 times a spin; later clears still grow the meter.');
  L.push('  - 10 sweeps every 10 off the board.');
  L.push('  - J converts every J to the most common visible premium.');
  L.push('  - Q copies the row with the most of the commonest symbol onto the row with the fewest.');
  L.push('  - K turns the reel with the fewest of the commonest symbol wild for the next check.');
  L.push('  - A stops the next low (10, then J, then Q) landing for the rest of the spin.');
  L.push('  - ENVELOPE pays the spin\'s biggest win again.');
  L.push('  - PARCEL unpacks four copies of the most common visible premium.');
  L.push('  - PHONE delivers the copies missing from the nearest match.');
  L.push('  - KEY opens the vault: a PARCEL unpack, a K wild reel and a multiplier stamp.');
  L.push('  - Wilds join only the most common symbol and leave after one check. Tie-breaks are higher rank, then reel order, top to bottom.');
  L.push('- **The meter.** Stamps add their value as they land. A clear adds its increment (KEY/PHONE +3, PARCEL/ENVELOPE +2, lows +1; *tiered*) or, in Lost & Found, doubles the meter. Per spin: stamps first, then clears, then the final meter multiplies the spin\'s tumble sum once.');
  L.push('  - **Base and paid spins:** a spin-local meter starting at 1×.');
  L.push(`  - **Night Shift:** the meter starts at ${R.BONUSES.regular.meter}×, carries through the bonus and applies only on a spin with a clear or a stamp. Otherwise wins pay face value.`);
  L.push(`  - **Double Post:** starts at ${R.BONUSES.super.meter}× and applies to every spin.`);
  L.push(`  - **Lost & Found:** halves the targets, applies to every spin, and doubles per clear up to ${R.BONUSES.hidden.ceiling}×.`);
  L.push('- **FS** on the final board: 4, 5 or 6+ award Night Shift, Double Post or Lost & Found (10 spins). In a bonus, 3+ FS add 5 spins.');
  L.push('- **Paid spins:** Priority Mail (3×) has a higher FS chance. Special Delivery (2×) and Double Exposure (2.5×) open with one or two previewed 2×–25× stamps. Buys: Night Shift 100×, Double Post 250×, Mystery 400× (' + Object.entries(s.mystery).map(([t, w]) => `${R.BONUSES[t].title} ${pct(w, 0)}`).join(', ') + ').');
  L.push('- **The cap** is 25,000× the base bet across the whole round. The round ends on the spin that reaches it.', '');
  L.push('## Every mode', '', '| Mode | Cost | RTP (99.9%) | Spin / bonus share | Whole-round check (99.9%) | Hit | Bonus entry | SD per cost | Capped |', '|---|---|---|---|---|---|---|---|---|');
  for (const [, r] of modes) L.push(`| ${r.title} | ${r.cost}× | **${pct(r.rtp)}** ± ${pct(r.ci999)} | ${r.kind === 'spin' ? `${pct(r.spinRtp)} / ${pct(r.bonusRtp)}` : 'bonus'} | ${pct(r.rounds.rtp)} ± ${pct(r.rounds.ci999)} | ${pct(r.rounds.hit)} | ${r.kind === 'spin' ? every(1 / r.bonusEvery) : '—'} | ${r.rounds.sd.toFixed(1)} | ${every(r.rounds.capped / r.rounds.n, r.rounds.n)} |`);
  L.push('', `Priority Mail enters a bonus **${s.priorityEntryRatio.toFixed(2)}×** as often as a base spin, at 3× the cost.`, '');
  L.push('### Bonus entry by tier', '', '| Mode | FS chance per cell | Night Shift (4 FS) | Double Post (5 FS) | Lost & Found (6+ FS) | Tumbles per spin |', '|---|---|---|---|---|---|');
  for (const [, r] of modes) if (r.kind === 'spin') L.push(`| ${r.title} | ${pct(r.fs, 3)} | ${every(r.trig.regular)} | ${every(r.trig.super)} | ${every(r.trig.hidden)} | ${r.tumbles.toFixed(3)} |`);
  L.push('', '## Bonuses', '', '| Bonus | Average (99.9%) | SD | Median | 90th | 99th | Pays 0 | Under 25× | Max seen | Reaches cap | Retrigger | Spins | Stamp chance |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const b of Object.values(s.bonuses)) L.push(`| ${b.title} | **${x(b.mean)}** ± ${(Z * b.se).toFixed(2)} | ${b.sd.toFixed(0)} | ${x(b.median)} | ${x(b.p90)} | ${x(b.p99)} | ${every(b.zero, b.n)} | ${pct(b.under25, 1)} | ${x(b.max)} | ${every(b.capped / b.n, b.n)} | ${pct(b.retriggerChance, 2)} | ${b.spins.toFixed(2)} | ${pct(b.stamp, 2)} |`);
  L.push('', '### Collections: how often each clears', '', 'Clears per base spin come from 10M spin-only rounds. Clears per bonus come from bought bonuses. Both include symbols that jobs create.', '', '| Symbol (job) | Base target | Base: clears per spin | Bonus target | Night Shift per bonus | Double Post per bonus | Lost & Found (half target) per bonus |', '|---|---|---|---|---|---|---|');
  for (const sym of R.PAYING) L.push(`| ${sym} (${R.JOBS[sym]}) | ${R.TARGETS.base[sym]} | ${every(s.modes.base.clearsBy[sym], s.modes.base.spinN)} | ${R.TARGETS.bonus[sym]} | ${s.bonuses.regular.clearsBy[sym].toFixed(3)} | ${s.bonuses.super.clearsBy[sym].toFixed(3)} | ${s.bonuses.hidden.clearsBy[sym].toFixed(3)} |`);
  L.push('', '### Multi-clear tail: clears per bonus', '', '| Clears | 0 | 1 | 2 | 3 | 4 | 5 | 6–9 | 10+ |', '|---|---|---|---|---|---|---|---|---|');
  for (const b of Object.values(s.bonuses)) { const h = b.clearHist; L.push(`| ${b.title} | ${[0, 1, 2, 3, 4, 5].map((k) => pct(h[k], 1)).join(' | ')} | ${pct(h.slice(6, 10).reduce((a, c) => a + c, 0), 2)} | ${pct(h.slice(10).reduce((a, c) => a + c, 0), 3)} |`); }
  const mh = s.bonuses.hidden.meterHist;
  L.push('', `Lost & Found's final meter: ${mh.map((p, k) => (p > 0 ? `${2 ** k}–${2 ** (k + 1) - 1}×: ${pct(p, 2)}` : null)).filter(Boolean).join(' · ')} (ceiling ${s.bonuses.hidden.ceiling}×).`, '');
  L.push('### Flat versus tiered increments', '', 'This uses the same stamp chances and seeds family. Tiered is the shipped scheme; flat gives every clear +1. Lost & Found doubles, so it is unaffected.', '', '| | Tiered average | Flat average | Flat 99th | Flat max seen |', '|---|---|---|---|---|');
  for (const b of Object.values(s.bonuses)) if (b.flat) L.push(`| ${b.title} | ${x(b.mean)} | ${x(b.flat.mean)} ± ${(Z * b.flat.se).toFixed(2)} | ${x(b.flat.p99)} | ${x(b.flat.max)} |`);
  L.push(`| Base spin RTP (spin only) | ${pct(s.modes.base.spinRtp)} | ${pct(s.modes.base.flatSpinRtp)} | | |`, '');
  L.push(`Stamp values (×, weight): ${R.STAMP_VALUES.map(([v, w]) => `${v} (${w})`).join(' · ')}. Opening stamps: ${R.OPENING_VALUES.map(([v, w]) => `${v} (${w})`).join(' · ')}.`, '');
  L.push('Paytable (× bet for 8–9 / 10–11 / 12+): ' + R.PAYING.map((k) => `${k} ${R.PAYTABLE[k].map((v) => v / 100).join('/')}`).join(' · ') + '.', '');
  L.push('## How often a round pays at least', '', '| Mode | ≥1× | ≥2× | ≥5× | ≥10× | ≥25× | ≥100× | ≥500× | ≥1,000× | ≥5,000× |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const [, r] of modes) L.push(`| ${r.title} | ${[1, 2, 5, 10, 25, 100, 500, 1000, 5000].map((v) => (r.rounds.over[v] >= 0.01 ? pct(r.rounds.over[v]) : every(r.rounds.over[v], r.rounds.n))).join(' | ')} |`);
  L.push('', '### Win tiers', '', 'Base and paid spins compare with the base bet (Nice 10×, Big 25×, Epic 100×, Mythic 500×). Buys compare with their price (2×, 5×, 25× and 50× the price).', '', '| Mode | Nice | Big | Epic | Mythic | Max |', '|---|---|---|---|---|---|');
  for (const [, r] of modes) L.push(`| ${r.title} | ${['nice', 'big', 'epic', 'mythic', 'max'].map((t) => every(r.rounds.tiers[t], r.rounds.n)).join(' | ')} |`);
  L.push('', '## Open questions for the producer', '');
  L.push('- **Prototype choices to confirm:**');
  L.push(`  - Meter starts: Night Shift ${R.BONUSES.regular.meter}×, Double Post ${R.BONUSES.super.meter}×, Lost & Found ${R.BONUSES.hidden.meter}×.`);
  L.push(`  - Lost & Found's doubling ceiling is ${R.BONUSES.hidden.ceiling}×. Without one it averaged far above its price and capped in most bonuses.`);
  L.push('  - A filters last one spin. A filter kept for the whole bonus thinned the refills for good and ran away.');
  L.push('  - Bonus targets and the tiered increments.');
  L.push('  - Prices, and Mystery at 40/35/25.');
  L.push('- **Night Shift versus Double Post.** With rare stamps, Night Shift\'s meter grows mostly through clears, and those also activate it. Its event rule therefore costs little, and Double Post needs a higher starting meter to be worth 2.5× the price.');
  const prem = Math.max(...R.PREMIUMS.map((p) => Math.max(s.bonuses.regular.clearsBy[p], s.bonuses.super.clearsBy[p])));
  if (prem < 0.01) L.push(`- **Premium collections almost never clear in Night Shift or Double Post** (KEY, PHONE, PARCEL and ENVELOPE under ${prem.toFixed(3)} clears per bonus). Premiums rarely make 8+ in the free-spin mix, so the vault, deliver, unpack and return jobs effectively never fire there. That is also why flat and tiered increments measure the same: almost every clear is a low, which is +1 either way. Lowering premium bonus targets to about 8–10, or weighting premiums up in free spins, would make them appear. Either needs a re-fit.`);
  L.push(`- **Night Shift is swingy.** ${pct(s.bonuses.regular.clearHist[0], 0)} of bonuses see no clear, the median is ${s.bonuses.regular.median}×, and ${pct(s.bonuses.regular.under25, 0)} pay under 25×. Lost & Found reaches its ${s.bonuses.hidden.ceiling}× meter ceiling in ${pct(s.bonuses.hidden.meterHist.slice(Math.log2(s.bonuses.hidden.ceiling)).reduce((a, c) => a + c, 0), 0)} of bonuses and the 25,000× cap in ${every(s.bonuses.hidden.capped / s.bonuses.hidden.n, s.bonuses.hidden.n)}.`);
  L.push('- **Job tie-breaks** are listed in `engine/engine.js` and ENGINE.md. Fixtures cover each job, and the example payloads Codex asked for: inactive Night Shift, late activation, Double Post with no event, and Lost & Found with a stamp and a clear in one spin.', '');
  return L.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const t0 = Date.now();
  const s = await build({ spinN: arg('--spins', 1e7), bonusN: arg('--bonus', 1e6), roundN: arg('--rounds', 1e7), buyN: arg('--buys', 1e6), seed: arg('--seed', 20261105) });
  mkdirSync(new URL('math/', GAME), { recursive: true });
  writeFileSync(new URL('math/summary.json', GAME), JSON.stringify(s, null, 1) + '\n');
  writeFileSync(new URL('MATH.md', GAME), markdown(s));
  console.log(`wrote MATH.md and math/summary.json (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  for (const [id, r] of Object.entries(s.modes)) console.log(`${id.padEnd(11)} ${pct(r.rtp, 3)} ± ${pct(r.ci999, 3)} · rounds ${pct(r.rounds.rtp, 3)} ± ${pct(r.rounds.ci999, 3)}`);
}
