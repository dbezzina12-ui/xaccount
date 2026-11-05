// The math package: the shipped report matches the shipped rules, every mode
// is calibrated, and the engine reproduces the exact calculator.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { playRound, playBonus, seeded } from '../engine/engine.js';
import { CAP, MODES } from '../engine/rules.js';
import { measure, mean, moment2 } from '../../../tools/math/dead-letter-depot-exact.mjs';
import { sourceHash } from '../../../tools/math/dead-letter-depot-report.mjs';

const summary = JSON.parse(readFileSync(new URL('../math/summary.json', import.meta.url), 'utf8'));
const exact = measure();

test('math/summary.json and MATH.md were regenerated after the last outcome change', () => {
  assert.equal(summary.source, sourceHash(), 'run node tools/math/dead-letter-depot-report.mjs');
  for (const [id, r] of Object.entries(summary.modes)) assert.ok(Math.abs(r.rtp - exact.modes[id].rtp) < 1e-12, id);
  const md = readFileSync(new URL('../MATH.md', import.meta.url), 'utf8');
  assert.match(md, new RegExp(summary.source));
});

test('every mode returns 96% of its cost, exactly', () => {
  assert.deepEqual(Object.keys(exact.modes).sort(), Object.keys(MODES).sort());
  for (const [id, r] of Object.entries(exact.modes)) assert.ok(Math.abs(r.rtp - 0.96) < 1e-5, `${id} ${r.rtp}`);
  assert.ok(Math.abs(summary.priorityEntryRatio - 5) < 0.05, `Priority Mail entry ${summary.priorityEntryRatio}x`);
});

test('the recorded Monte Carlo cross-check sits inside its 99.9% interval for every mode', () => {
  assert.ok(summary.sim, 'the report was generated without --no-sim');
  for (const [id, r] of Object.entries(summary.sim.results)) {
    assert.ok(r.n >= 1e6, id);
    assert.ok(Math.abs(r.rtp - exact.modes[id].rtp) <= r.ci999, `${id}: ${r.rtp} vs ${exact.modes[id].rtp} ± ${r.ci999}`);
  }
});

test('the cap is reachable but a single spin never reaches it', () => {
  assert.ok(summary.modes.mystery.tiers.max > 0);
  assert.ok(summary.modes.doubledispatch.tiers.max > 0);
  assert.ok(summary.modes.base.tiers.max > 0);
  for (const id of ['base', 'priority', 'carbon', 'registered']) assert.ok(Math.max(...exact.modes[id].X.keys()) < CAP);
});

test('the engine reproduces the exact route, spin pay and trigger figures', () => {
  const g = seeded(31337);
  for (const mode of ['base', 'carbon', 'registered']) {
    const n = 60000, counts = new Map();
    let pay = 0, trig = 0;
    for (let i = 0; i < n; i++) {
      const r = playRound({ mode, rng: seeded(Math.floor(g() * 4294967296)) });
      const k = r.spin.route.delivered.join('');
      counts.set(k, (counts.get(k) ?? 0) + 1);
      pay += r.spin.win; if (r.bonus) trig += 1;
    }
    let chi = 0, cells = 0;
    for (const [k, p] of exact.modes[mode].route) { const e = p * n; if (e >= 5) { chi += ((counts.get(k) ?? 0) - e) ** 2 / e; cells += 1; } }
    assert.ok(chi < 3 * cells + 20, `${mode} route chi2 ${chi.toFixed(1)} over ${cells} cells`);
    const X = exact.modes[mode].X, mx = mean(X), sx = Math.sqrt(moment2(X) - mx * mx);
    assert.ok(Math.abs(pay / n - mx) < 4.5 * sx / Math.sqrt(n), `${mode} spin pay`);
    const rate = Object.values(exact.modes[mode].rates).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(trig / n - rate) < 4.5 * Math.sqrt(rate / n), `${mode} trigger rate`);
  }
});

test('the engine reproduces each bonus average', () => {
  const g = seeded(4711);
  for (const tier of Object.keys(exact.bonuses)) {
    const n = 15000, d = exact.bonuses[tier], m = mean(d), sd = Math.sqrt(moment2(d) - m * m);
    let s = 0;
    for (let i = 0; i < n; i++) s += playBonus(tier, seeded(Math.floor(g() * 4294967296))).total;
    assert.ok(Math.abs(s / n - m) < 4.5 * sd / Math.sqrt(n), `${tier}: ${s / n / 100} vs ${m / 100}`);
  }
});
