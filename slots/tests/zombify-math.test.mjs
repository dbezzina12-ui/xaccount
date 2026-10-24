// Pins Zombify's measured math (games/zombify/MATH.md). Zombify was imported
// with its math unchanged (D-004), so these only fail if a catalog or the
// runtime's tier draw changes; then re-measure deliberately, never loosen the
// pins to make a failure go away. Skips on a checkout without the catalogs
// (`npm run studio:prepare` provides them).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const runtime = (f) => new URL(`../games/zombify/runtime/${f}`, import.meta.url);
const skip = existsSync(runtime('outcomes.js')) && existsSync(runtime('feature-outcomes.js')) ? false : 'needs the Zombify catalogs: npm run studio:prepare';
const z = await import('../tools/math/zombify.js');
const close = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b}`);

// ticket(n, rng) is floor(rng() * n), so feeding the midpoint of every cell
// enumerates choosePaidTier's draws exactly.
function tierOdds(choosePaidTier, kind, sizes) {
  const odds = {};
  const cells = sizes.reduce((n, s) => n * s, 1);
  const walk = (picked) => {
    if (picked.length === sizes.length) {
      const draws = picked.map((v, i) => (v + 0.5) / sizes[i]);
      const tier = choosePaidTier(kind, () => draws.shift()) ?? 'none';
      odds[tier] = (odds[tier] ?? 0) + 1 / cells;
      return;
    }
    for (let v = 0; v < sizes[picked.length]; v++) walk([...picked, v]);
  };
  walk([]);
  return odds;
}

test('the runtime draws bonuses with the odds the math sheet assumes', { skip }, async () => {
  const { choosePaidTier } = await import(runtime('outcome-model.js'));
  for (const [kind, n] of [['base', 275], ['enhanced', 50]]) {
    const odds = tierOdds(choosePaidTier, kind, [n, 100]);
    close(odds.none, 1 - z.ENTRY[kind], 1e-12, `${kind} no bonus`);
    for (const [tier, p] of Object.entries(z.TIERS)) close(odds[tier], z.ENTRY[kind] * p, 1e-12, `${kind} ${tier}`);
  }
  const mystery = tierOdds(choosePaidTier, 'buy_mystery', [10]);
  for (const [tier, p] of Object.entries(z.MYSTERY)) close(mystery[tier], p, 1e-12, `mystery ${tier}`);
  assert.equal(choosePaidTier('buy_outbreak'), 'regular');
  assert.equal(choosePaidTier('buy_super'), 'super');
});

test('every mode returns exactly 96%, with the measured hit rates, spread and cap odds', { skip }, async () => {
  const catalogs = await z.loadCatalogs();
  assert.equal(catalogs.data.version, 'zombify-96-v1');
  assert.equal(catalogs.feature.version, 'second-life-v2');
  assert.equal(z.CAP, 2_500_000);
  const pins = {
    base: { cost: 1, hit: 0.275, sd: 17.81, maxBet: 25000, capOneIn: 7_499_993 },
    enhanced: { cost: 3, hit: 0.285, sd: 13.71, maxBet: 25000, capOneIn: 1_363_635 },
    buy_outbreak: { cost: 100, hit: 0.9952, sd: 1.68, maxBet: 25000, capOneIn: 1_000_000 },
    buy_super: { cost: 250, hit: 0.9937, sd: 1.59, maxBet: 25000, capOneIn: 10_000 },
    buy_mystery: { cost: 250, hit: 0.9942, sd: 2.46, maxBet: 25000, capOneIn: 3_144 },
    buy_feature: { cost: 10, hit: 0.6546, sd: 1.79, maxBet: 1104.32, capOneIn: 0 },
  };
  const all = z.modes(catalogs);
  assert.deepEqual(all.map((m) => m.kind), Object.keys(pins));
  for (const m of all) {
    const s = z.stats(m), pin = pins[m.kind];
    assert.equal(m.cost, pin.cost, `${m.kind} cost`);
    close(s.rtp, 0.96, 1e-9, `${m.kind} RTP`);
    close(s.hit, pin.hit, 5e-5, `${m.kind} hit rate`);
    close(s.sd, pin.sd, 0.005, `${m.kind} SD`);
    assert.equal(s.maxBet, pin.maxBet, `${m.kind} max win`);
    assert.equal(s.capped ? Math.round(1 / s.capped) : 0, pin.capOneIn, `${m.kind} cap odds`);
  }
});

test('the committed math sheet matches the catalogs it was measured from', { skip }, async () => {
  const catalogs = await z.loadCatalogs();
  const dir = new URL('../games/zombify/', import.meta.url);
  const summary = JSON.parse(readFileSync(new URL('math/summary.json', dir), 'utf8'));
  const verify = JSON.parse(readFileSync(new URL('math/verify.json', dir), 'utf8'));
  assert.equal(summary.modelVersion, catalogs.data.version);
  assert.equal(summary.featureVersion, catalogs.feature.version);
  for (const m of z.modes(catalogs)) {
    const s = z.stats(m);
    for (const key of ['rtp', 'hit', 'sd', 'capped']) close(summary.modes[m.kind][key], s[key], 1e-12, `summary ${m.kind} ${key}`);
  }
  assert.equal(verify.sourceHash, catalogs.data.sourceHash);
  assert.equal(verify.featureSourceHash, catalogs.feature.sourceHash);
  assert.equal(Object.values(verify.replay).reduce((n, r) => n + r.mismatches, 0), 0);
  assert.ok(Object.values(verify.sessions).every((r) => r.errors === 0 && r.withinCi));
  assert.match(readFileSync(new URL('MATH.md', dir), 'utf8'), /0 mismatches/);
});
