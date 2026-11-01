import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../runtime/catalog-data.js';
import { drawRound } from '../runtime/catalog.js';
import { MYSTERY, MYSTERY_TIERS, MYSTERY_TICKETS, PLAY_OPTIONS } from '../runtime/rules.js';

const sum = (rows) => rows.reduce((a, [, w, v]) => a + BigInt(w) * BigInt(v), 0n);

test('Mystery reveals Overpressure or Blackout only, its weights covering every ticket', () => {
  assert.deepEqual(MYSTERY_TIERS.map((t) => t.tier), ['super', 'hidden']);
  assert.equal(MYSTERY_TICKETS, data.total);
  assert.equal(MYSTERY_TIERS.reduce((a, t) => a + t.weight, 0), data.total);
  for (const { pool } of MYSTERY_TIERS) assert.equal(data.pools[pool].reduce((a, r) => a + r[1], 0), data.total);
  assert.deepEqual(data.modes.mystery.tiers, Object.fromEntries(MYSTERY_TIERS.map((t) => [t.tier, t.weight])));
});

test('Mystery returns 96% of its 400x price, to a billionth of the cost', () => {
  const { cost } = PLAY_OPTIONS.mystery, T = BigInt(data.total);
  assert.equal(cost, 400);
  const got = MYSTERY_TIERS.reduce((a, { pool, weight }) => a + BigInt(weight) * sum(data.pools[pool]), 0n);
  const want = T * T * BigInt(cost) * 96n; // hundredths: 96% of cost x 100
  const off = Number(got - want) / Number(T * T * BigInt(cost) * 100n);
  assert.ok(Math.abs(off) < 1e-9, `Mystery is ${off} of the cost away from 96%`);
});

test('every Mystery pays at least 40x, every Blackout at least 1,000x', () => {
  const [superPool, hiddenPool] = MYSTERY_TIERS.map((t) => data.pools[t.pool]);
  assert.ok(superPool.every((r) => r[2] >= MYSTERY.floor), 'an Overpressure pick under the floor');
  assert.ok(hiddenPool.every((r) => r[2] >= 100000), 'a Blackout under 1,000x');
  // Its Overpressure rounds are the bought pool's own, never new ones.
  const bought = new Map(data.pools['bonus-super'].map((r) => [r[0], r[2]]));
  assert.ok(superPool.every((r) => bought.get(r[0]) === r[2]));
});

test('both ends of each Mystery tier replay the selected catalog bonus', () => {
  let start = 0;
  for (const { tier, pool, weight } of MYSTERY_TIERS) {
    const end = start + weight;
    for (const [tierTicket, poolTicket] of [[start, 0], [end - 1, data.total - 1]]) {
      const draws = [tierTicket, poolTicket];
      const got = drawRound('mystery', () => draws.shift());
      const rows = data.pools[pool], row = poolTicket ? rows.at(-1) : rows[0];
      assert.deepEqual(got.draw, { tier, bonus: row[0] });
      assert.equal(got.tier, tier); assert.equal(got.total, row[2]);
      assert.equal(got.mode, 'mystery'); assert.equal(got.natural, false); assert.equal(draws.length, 0);
    }
    start = end;
  }
});
