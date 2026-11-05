// The math package: the shipped report matches the shipped engine and rules,
// and every mode measures 96% of its cost within its 99.9% interval.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LAND, MODES, BONUSES, MYSTERY } from '../engine/rules.js';
import { sourceHash } from '../../../tools/math/dead-letter-depot-report.mjs';

const summary = JSON.parse(readFileSync(new URL('../math/summary.json', import.meta.url), 'utf8'));

test('math/summary.json and MATH.md were regenerated after the last outcome change', () => {
  assert.equal(summary.source, sourceHash(), 'run node tools/math/dead-letter-depot-report.mjs');
  assert.match(readFileSync(new URL('../MATH.md', import.meta.url), 'utf8'), new RegExp(summary.source));
  assert.deepEqual(Object.keys(summary.modes).sort(), Object.keys(MODES).sort());
  for (const [id, m] of Object.entries(MODES)) if (m.kind === 'spin') assert.equal(summary.modes[id].fs, LAND[m.land].fs, id);
  for (const tier of Object.keys(BONUSES)) assert.equal(summary.bonuses[tier].stamp, LAND[tier].stamp, tier);
  assert.deepEqual(summary.mystery, MYSTERY);
});

test('every mode returns 96% of its cost within its 99.9% interval, two ways', () => {
  for (const [id, r] of Object.entries(summary.modes)) {
    assert.ok(Math.abs(r.rtp - 0.96) <= r.ci999, `${id} decomposed ${r.rtp} ± ${r.ci999}`);
    assert.ok(Math.abs(r.rounds.rtp - 0.96) <= r.rounds.ci999, `${id} whole rounds ${r.rounds.rtp} ± ${r.rounds.ci999}`);
    assert.ok(r.rounds.n >= 1e6);
  }
});

test('Priority Mail enters bonuses more often than a base spin; each bonus can retrigger', () => {
  assert.ok(summary.priorityEntryRatio > 3, `${summary.priorityEntryRatio}`);
  for (const b of Object.values(summary.bonuses)) assert.ok(b.retriggerChance > 0);
});
