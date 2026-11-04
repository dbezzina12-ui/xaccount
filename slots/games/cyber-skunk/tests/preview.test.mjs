// Free previews (catalog.js drawPreview) show shipping outcomes: each choice
// draws the shipping pools of the play it shows, with their weights, and every
// pick replays exactly. Samples use fixed seeds, so every run is the same.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../runtime/catalog-data.js';
import { PREVIEWS, drawPreview, drawRound } from '../runtime/catalog.js';
import { seeded } from '../runtime/engine.js';

const ticketsFrom = (seed) => { const r = seeded(seed); return (total = data.total) => Math.floor(r() * total); };
const fixed = (list) => () => { if (!list.length) throw Error('ran out of tickets'); return list.shift(); };
const rowsBySeed = (pool) => new Map(data.pools[pool].map(([seed, w, v]) => [seed, { w, v }]));

test('each preview choice draws the documented shipping pools', () => {
  assert.deepEqual(Object.keys(PREVIEWS).sort(), ['hidden', 'regular', 'sprayjob', 'super']);
  assert.deepEqual(PREVIEWS.sprayjob, { mode: 'sprayjob' });
  assert.deepEqual(PREVIEWS.regular, { mode: 'ventbreak' });
  assert.deepEqual(PREVIEWS.super, { mode: 'overpressure' });
  assert.deepEqual(PREVIEWS.hidden, { pool: 'bonus-hidden', tier: 'hidden' });
  assert.equal(data.modes.ventbreak.pool, 'bonus-regular');
  assert.equal(data.modes.overpressure.pool, 'bonus-super');
  // Blackout's pool is the one natural Blackouts draw in every paid spin mode.
  for (const mode of ['base', 'enhanced', 'sprayjob']) assert.equal(data.modes[mode].bonuses.hidden, 'bonus-hidden', mode);
  assert.throws(() => drawPreview('mystery'), /Unknown preview/);
  assert.throws(() => drawPreview('__proto__'), /Unknown preview/);
});

test('both ends of every preview pool replay their positive-weight catalog row', () => {
  for (const [choice, pool] of [['regular', 'bonus-regular'], ['super', 'bonus-super'], ['hidden', 'bonus-hidden']]) {
    const rows = data.pools[pool];
    for (const [t, row] of [[0, rows[0]], [data.total - 1, rows.at(-1)]]) {
      const got = drawPreview(choice, fixed([t]));
      assert.equal(got.draw.bonus, row[0], `${choice} ticket ${t}`);
      assert.equal(got.total, row[2]); assert.ok(row[1] >= 1);
      assert.equal(got.preview, choice);
    }
  }
  // Spray Job at its lowest ticket: no bonus, the first no-bonus spin row.
  const spin = data.pools['spin-sprayjob'][0];
  const got = drawPreview('sprayjob', fixed([0, 0]));
  assert.deepEqual(got.draw, { spin: spin[0] }); assert.equal(got.total, spin[2]);
  // And it is the same draw a paid Spray Job spin makes with the same tickets.
  assert.deepEqual(drawRound('sprayjob', fixed([0, 0])).draw, got.draw);
});

// Exact weighted share of rows at or above v, and the sample's.
const shareAtLeast = (rows, v) => rows.reduce((a, [, w, x]) => a + (x >= v ? w : 0), 0) / data.total;
const within = (hits, n, p, label) => {
  const sd = Math.sqrt(n * p * (1 - p)) || 1;
  assert.ok(Math.abs(hits - n * p) <= 5 * sd, `${label}: ${hits} of ${n}, expected ${(n * p).toFixed(1)} ± ${(5 * sd).toFixed(1)}`);
};

test('buy and Blackout previews follow their shipping weights (30,000 draws each)', () => {
  for (const [choice, pool, seed] of [['regular', 'bonus-regular', 101], ['super', 'bonus-super', 202], ['hidden', 'bonus-hidden', 303]]) {
    const rows = data.pools[pool], bySeed = rowsBySeed(pool), tickets = ticketsFrom(seed), N = 30000;
    const values = [], seen = new Set();
    for (let i = 0; i < N; i++) {
      const r = drawPreview(choice, tickets);
      const row = bySeed.get(r.draw.bonus);
      assert.ok(row && row.w >= 1 && row.v === r.total, `${choice}: seed ${r.draw.bonus} is not a positive-weight row paying ${r.total}`);
      values.push(r.total); seen.add(r.draw.bonus);
    }
    if (choice === 'hidden') assert.ok(Math.min(...values) >= 100000, 'every Blackout preview pays 1,000x or more');
    // The share of draws at or above each exact weighted quantile.
    const sorted = rows.map(([, w, v]) => [v, w]).sort((a, b) => a[0] - b[0]);
    for (const q of [0.25, 0.5, 0.75, 0.9, 0.99]) {
      let c = 0, v = sorted[0][0];
      for (const [x, w] of sorted) { c += w; if (c / data.total >= q) { v = x; break; } }
      const p = shareAtLeast(rows, v);
      within(values.filter((x) => x >= v).length, N, p, `${choice} share >= ${v / 100}x`);
    }
    assert.ok(seen.size > 2000, `${choice}: only ${seen.size} different outcomes in ${N}`);
  }
});

test('Spray Job previews always spray and keep natural bonuses (200,000 draws)', () => {
  const tickets = ticketsFrom(404), N = 200000, m = data.modes.sprayjob;
  const counts = { none: 0, regular: 0, super: 0, hidden: 0 };
  const spinRows = rowsBySeed('spin-sprayjob');
  let noBonusSum = 0;
  for (let i = 0; i < N; i++) {
    const r = drawPreview('sprayjob', tickets);
    assert.ok(r.events.some((e) => e.type === 'spray' && e.spin === 0), 'the Spray Job spin sprays');
    const tier = r.draw.tier ?? 'none'; counts[tier]++;
    if (tier === 'none') { assert.equal(spinRows.get(r.draw.spin)?.v, r.total); noBonusSum += r.total; }
    else { assert.ok(r.natural, 'a Spray Job bonus is a natural trigger'); assert.equal(r.tier, tier); }
  }
  for (const tier of ['regular', 'super']) within(counts[tier], N, m.tiers[tier] / data.total, `Spray Job ${tier} bonuses`);
  within(counts.none, N, m.tiers.none / data.total, 'Spray Job spins without a bonus');
  assert.ok(counts.regular + counts.super + counts.hidden > 0, 'natural bonuses occur in Spray Job previews');
  // No-bonus spins: their mean against the pool's exact weighted mean.
  const rows = data.pools['spin-sprayjob'];
  const mean = rows.reduce((a, [, w, v]) => a + w * v, 0) / data.total;
  const sd = Math.sqrt(rows.reduce((a, [, w, v]) => a + w * (v - mean) ** 2, 0) / data.total);
  assert.ok(Math.abs(noBonusSum / counts.none - mean) <= 5 * sd / Math.sqrt(counts.none), `no-bonus mean ${noBonusSum / counts.none} vs ${mean}`);
});
