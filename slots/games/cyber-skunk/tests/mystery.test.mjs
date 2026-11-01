import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../runtime/catalog-data.js';
import { drawRound } from '../runtime/catalog.js';
import { MYSTERY_TIERS, PLAY_OPTIONS } from '../runtime/rules.js';

test('Mystery pays exactly 96% against the 400× purchase', () => {
  const { cost } = PLAY_OPTIONS.mystery;
  assert.equal(cost, 400);
  let expected = 0n, totalWeight = 0;
  for (const { tier, weight } of MYSTERY_TIERS) {
    const rows = data.pools['bonus-' + tier];
    assert.equal(rows.reduce((sum, row) => sum + row[1], 0), data.total);
    expected += BigInt(weight) * rows.reduce((sum, [, w, win]) => sum + BigInt(w) * BigInt(win), 0n);
    totalWeight += weight;
  }
  assert.equal(totalWeight, 10000);
  assert.equal(expected, BigInt(data.total) * 10000n * BigInt(cost) * 96n);
});

test('both ends of each Mystery tier replay the selected catalog bonus', () => {
  let start = 0;
  for (const {tier, weight} of MYSTERY_TIERS) {
    const end = start + weight * (data.total / 10000);
    for (const [tierTicket, poolTicket] of [[start,0],[end-1,data.total-1]]) {
      const draws = [tierTicket,poolTicket];
      const got = drawRound('mystery', () => draws.shift());
      const rows = data.pools['bonus-'+tier], row = poolTicket ? rows.at(-1) : rows[0];
      assert.deepEqual(got.draw,{tier,bonus:row[0]});
      assert.equal(got.tier,tier); assert.equal(got.total,row[2]);
      assert.equal(got.mode,'mystery'); assert.equal(got.natural,false); assert.equal(draws.length,0);
    }
    start = end;
  }
});
