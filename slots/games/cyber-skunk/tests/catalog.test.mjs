// Cyber Skunk catalogs (MATH.md): whole-ticket weights, exact 96% per mode,
// the max-win gates, and the game's draws replaying exactly. The full replay of
// every entry is tools/math/cyber-skunk-verify.mjs; this samples every pool.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import data from '../runtime/catalog-data.js';
import { drawRound, pick } from '../runtime/catalog.js';
import { playRound, seeded } from '../runtime/engine.js';
import { CAP, MODES, triggerRates } from '../runtime/rules.js';

const summary = JSON.parse(readFileSync(new URL('../math/summary.json', import.meta.url)));

test('every pool and tier table is whole tickets summing to 1e9', () => {
  for (const [name, rows] of Object.entries(data.pools)) {
    assert.equal(rows.reduce((a, r) => a + r[1], 0), data.total, name);
    for (const [seed, w, v] of rows) assert.ok(Number.isInteger(seed) && Number.isInteger(w) && w >= 1 && v % 10 === 0 && v <= CAP, `${name} ${seed}`);
  }
  for (const [mode, m] of Object.entries(data.modes)) if (m.tiers) assert.equal(Object.values(m.tiers).reduce((a, b) => a + b, 0), data.total, mode);
});

test('every paid mode returns 96% of its cost; the report matches the shipped catalogs', () => {
  for (const [mode, s] of Object.entries(summary.modes)) {
    assert.equal(s.rtp, '96.000000%', mode);
    assert.ok(Math.abs(s.rtpDeviation) < 1e-8, `${mode} deviates ${s.rtpDeviation}`);
    assert.equal(s.cost, MODES[mode].cost, `${mode} price`);
  }
  // The ticket-weighted means of the buys, exactly.
  for (const [mode, pool] of [['ventbreak', 'bonus-regular'], ['overpressure', 'bonus-super']]) {
    const sum = data.pools[pool].reduce((a, [, w, v]) => a + BigInt(w) * BigInt(v), 0n);
    assert.equal(sum, BigInt(data.total) * BigInt(MODES[mode].cost * 96), mode);
  }
});

test("max-win odds are Dylan's: base 1 in 1,000,000, bought Overpressure 1 in 50,000, Blackout 1 in 200 and at least 1,000x", () => {
  const near = (p, target, label) => assert.ok(Math.abs(p / target - 1) < 0.01, `${label}: 1 in ${Math.round(1 / p)}`);
  near(summary.modes.base.maxOdds, 1 / 1e6, 'base');
  near(summary.bonuses.super.max, 1 / 50000, 'bought Overpressure');
  near(summary.bonuses.hidden.max, 1 / 200, 'Blackout Protocol');
  // A bought Vent Break caps 1 in 200,000 once capped rounds exist to draw (cyber-skunk-caps.mjs).
  if (summary.bonuses.regular.max) near(summary.bonuses.regular.max, 1 / 200000, 'bought Vent Break');
  assert.ok(data.pools['bonus-hidden'].every(([, , v]) => v >= 100000), 'every Blackout pays at least 1,000x');
  assert.ok(summary.bonuses.regular.zero === 0 || summary.bonuses.regular.zero < 0.01);
  for (const mode of ['base', 'enhanced', 'sprayjob']) assert.ok(summary.modes[mode].zero > 0.2, `${mode} has genuine losses`);
});

test('a triggered bonus averages the same as a bought one', () => {
  const mean = (name) => Number(data.pools[name].reduce((a, [, w, v]) => a + BigInt(w) * BigInt(v), 0n)) / data.total;
  for (const t of ['regular', 'super']) assert.equal(mean(data.modes.base.bonuses[t]), mean(`bonus-${t}`), t);
  assert.equal(data.modes.enhanced.bonuses.super, data.modes.base.bonuses.super, 'every paid spin mode triggers the same bonus pools');
});

test('tier tables carry the natural trigger rates of rules.js', () => {
  for (const mode of ['base', 'enhanced', 'sprayjob']) {
    const rates = triggerRates(MODES[mode].land);
    for (const t of ['regular', 'super', 'hidden']) assert.ok(Math.abs(data.modes[mode].tiers[t] / data.total - rates[t]) < 2e-9, `${mode} ${t}`);
  }
});

test('a sample of every pool replays exactly through the engine', () => {
  for (const [name, rows] of Object.entries(data.pools)) {
    const [kind, mode, tier] = name.split('-');
    for (let k = 0; k < rows.length; k += Math.ceil(rows.length / 60)) {
      const [seed, , value] = rows[k];
      const paid = kind === 'bonus' ? playRound({ rng: seeded(seed), forceBonus: mode }).total
        : kind === 'spin' ? playRound({ mode, rng: seeded(seed) }).total
          : playRound({ mode, rng: seeded(seed), bonusRng: seeded(1), triggerScatters: data.scatters[tier] }).events.find((e) => e.type === 'wins').paid;
      assert.equal(paid, value, `${name} seed ${seed}`);
    }
  }
});

test('the game draws rounds from the catalogs and they replay exactly', () => {
  let n = 11; const ticket = () => { n = (n * 48271) % 2147483647; return Math.floor((n / 2147483647) * data.total); };
  for (const mode of Object.keys(MODES)) for (let k = 0; k < 300; k++) {
    const r = drawRound(mode, ticket);
    assert.ok(r.total >= 0 && r.total <= CAP && r.total % 10 === 0, mode);
    if (MODES[mode].buy) assert.ok(r.tier, `${mode} always plays its bonus`);
  }
  // Forced draws into each tier: the trigger spin plus the bonus, capped.
  for (const tier of ['regular', 'super', 'hidden']) {
    const tiers = data.modes.base.tiers, before = ['none', 'regular', 'super', 'hidden'].slice(0, ['none', 'regular', 'super', 'hidden'].indexOf(tier)).reduce((a, k) => a + tiers[k], 0);
    let first = true; const r = drawRound('base', () => (first ? ((first = false), before) : 0));
    assert.equal(r.tier, tier);
    assert.equal(r.total, Math.min(CAP, pick(data.modes.base.entries[tier], 0).value + pick(data.modes.base.bonuses[tier], 0).value));
  }
});

test('a replay that disagrees with the catalog is refused', () => {
  const rows = data.pools['bonus-regular'], saved = rows[0][2];
  rows[0][2] = saved + 10;
  try { assert.throws(() => drawRound('ventbreak', () => 0), /mismatch/); } finally { rows[0][2] = saved; }
});
