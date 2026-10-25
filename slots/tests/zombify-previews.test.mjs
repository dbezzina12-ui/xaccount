// Zombify's free Super and Hidden previews (S-28) play real bonuses: the same
// catalog draw, replay and check as a natural bonus, never credited. They used
// to replay one scripted round, so every Hidden preview paid the 25,000x cap.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makePaidRound, pickEntry, CATALOG_PREVIEWS } from '../games/zombify/runtime/outcome-model.js';
import { makeRound, seeded, CAP } from '../games/zombify/runtime/math.js';
import { createSession } from '../games/zombify/runtime/session.js';
import { loadCatalogs, poolDist, sumCapped } from '../tools/math/zombify.js';

const mean = (dist) => [...dist].reduce((sum, [v, p]) => sum + v * p, 0);

const { data } = await loadCatalogs();
// Uniform draws that pick fixed tickets: the round and the check get the same ones.
const draws = (...tickets) => { const q = tickets.map((t) => (t + 0.5) / 1e9); return () => q.shift(); };

test('each preview is the natural bonus for its tickets: trigger spin plus bonus, capped', () => {
  for (const [kind, tier] of Object.entries(CATALOG_PREVIEWS)) {
    const pool = data.pools[tier], entry = data.pools[`entry_${tier}`];
    for (let i = 0; i < 25; i++) {
      const a = Math.floor((i * 104729 * 9973) % pool.total), b = Math.floor((i * 7919 * 15485863) % entry.total);
      const round = makePaidRound({ kind, rng: draws(a, b) });
      const bonus = pickEntry(pool, draws(a)), trigger = pickEntry(entry, draws(b));
      assert.equal(round.total, Math.min(CAP, bonus[2] + trigger[2]), `${kind} ticket ${a}/${b}`);
      assert.equal(round.events.find((e) => e.type === 'bonusStart').tier, tier);
      assert.equal(round.events.find((e) => e.type === 'bonusStart').bought, false, 'a preview is not a bought bonus');
    }
  }
});

test('a Hidden preview averages the real 816x, not the cap; Super averages 240x', () => {
  // Exact, from the catalogs: the distribution every preview is drawn from.
  const value = (tier) => mean(sumCapped(poolDist(data.pools[tier]), poolDist(data.pools[`entry_${tier}`]))) / 100;
  assert.ok(Math.abs(value('hidden') - 816.08) < 0.01, `hidden ${value('hidden')}`);
  assert.ok(Math.abs(value('super') - 240.08) < 0.01, `super ${value('super')}`);
  // And in play: varied wins, almost never the cap.
  const wins = Array.from({ length: 40 }, (_, i) => makePaidRound({ kind: 'preview_hidden', rng: seeded(900 + i) }).total);
  assert.ok(new Set(wins).size > 30, 'previews differ from one another');
  assert.ok(wins.filter((w) => w >= CAP).length <= 2, `${wins.filter((w) => w >= CAP).length} of 40 capped`);
});

test('previews never change credits; the scripted demonstrations are still available to the generator', () => {
  const session = createSession(), before = session.read().credits;
  for (const kind of Object.keys(CATALOG_PREVIEWS)) {
    const round = session.begin(kind);
    assert.equal(round.preview, true);
    session.finish(round);
    assert.equal(session.read().credits, before, kind);
  }
  // math.js keeps the scripted round (used by its own tests): it caps.
  assert.equal(makeRound({ kind: 'preview_hidden', rng: seeded(2) }).total, CAP);
});
