// Night Fall's bonus tiers (Claude, 2026-10-26): base spins with fixed seeds
// that land a gold Super tombstone (Super Free Spins) and three of them (Hidden
// Free Spins), on a phone. The gold tombstone shows on the board, the right
// bonus starts with the right spin count and 2x tiles, Hidden's first spin puts
// its roamer out with a bolt from the crystal, and the award is the engine's.
//
//   npm run test:studio-browser

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { serve, chromium } from '../../tools/lib/browser.mjs';

let srv;
let browser;
before(async () => { srv = await serve(); browser = await chromium(); });
after(async () => { await browser?.close(); srv?.close(); });

// Base-spin seeds for the game's own RNG: 2 tombstones + 1 gold (Super, 10
// spins); 3 gold (Hidden, 10 spins).
const SUPER = 9430, HIDDEN = 2559963;

async function open(seed) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.addInitScript((seed) => {
    try { localStorage.setItem('nightfall-skip-intro', 'yes'); localStorage.setItem('nightfall-session-v1', JSON.stringify({ balance: 1000000, bet: 100, turbo: true, muted: true })); } catch {}
    const real = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = (a) => { if (a instanceof Uint32Array && a.length === 1) { a[0] = seed; return a; } return real(a); };
  }, seed);
  await page.goto(`${srv.url}games/nightfall/runtime/index.html`);
  await page.waitForFunction(() => globalThis.NightFall?.state.ready && globalThis.NightFall.actors.archer.joints, null, { timeout: 60000 });
  page.ctx = ctx;
  return page;
}

// Plays a base spin into its bonus: records the gold tombstones seen, the
// splash, the bonus classes, the first free spin's tiles and bolts; Skips
// after the first free spin settles; returns the award against the engine's.
async function play(page) {
  return page.evaluate(async () => {
    const { generateRound, seedRng } = await import('./engine.js'), seed = new Uint32Array(1); crypto.getRandomValues(seed);
    const round = generateRound({ rng: seedRng(seed[0]) }), out = { round: { mode: round.bonusMode, total: round.total, start: round.events.find((e) => e.type === 'bonusStart') }, gold: 0, golden: false, bolts: [] };
    const { bolt, } = globalThis.NightFall.effects, play = bolt.play.bind(bolt), mage = globalThis.NightFall.actors.archer;
    bolt.play = (o) => { out.bolts.push({ index: o.index, origin: o.origin, crystal: mage.releasePoint() }); return play(o); };
    const board = document.getElementById('board');
    new MutationObserver(() => {
      const gold = board.querySelectorAll('.cell[data-kind=sfs]');
      out.gold = Math.max(out.gold, gold.length);
      if ([...gold].some((c) => c.querySelector('.fs-super'))) out.golden = true;
    }).observe(board, { subtree: true, attributes: true, attributeFilter: ['data-kind'] });
    const start = globalThis.NightFall.state.balance;
    const done = globalThis.NightFall.spin();
    // The splash: its title and count, then continue.
    while (!document.getElementById('splash').open) await new Promise((r) => setTimeout(r, 50));
    out.splash = { title: document.getElementById('splash-title').textContent, value: document.getElementById('splash-value').textContent };
    out.classes = [...document.body.classList].filter((c) => c.endsWith('bonus'));
    out.mode = document.getElementById('mode-name').textContent;
    document.getElementById('splash-continue').click();
    // The first free spin's drop: every tile at 2x.
    while (!globalThis.NightFall.state.bonus || document.getElementById('fs-left').textContent === String(out.round.start.count)) await new Promise((r) => setTimeout(r, 30));
    while (document.querySelector('#board[data-motion]')) await new Promise((r) => setTimeout(r, 20));
    await new Promise((r) => setTimeout(r, 200));
    out.tiles = [...document.querySelectorAll('#board .multi')].map((m) => m.hidden ? '' : m.textContent);
    // Skip the rest, clicking through the end splash.
    globalThis.NightFall.state.skip = true;
    const clicker = setInterval(() => { if (document.getElementById('splash').open) document.getElementById('splash-continue').click(); }, 50);
    await done; clearInterval(clicker);
    out.award = globalThis.NightFall.state.balance - start + 100;
    out.host = document.getElementById('arrow-effects').children.length;
    out.after = [...document.body.classList].filter((c) => c.endsWith('bonus'));
    return out;
  });
}

test('a gold tombstone in a base spin starts Super Free Spins', async () => {
  const page = await open(SUPER);
  const r = await play(page);
  assert.equal(r.round.mode, 'super');
  assert.ok(r.gold >= 1 && r.golden, `the gold tombstone showed (${r.gold})`);
  assert.deepEqual(r.splash, { title: 'SUPER FREE SPINS', value: String(r.round.start.count) });
  assert.deepEqual(r.classes.sort(), ['bonus', 'super-bonus']);
  assert.equal(r.mode, 'SOUL HARVEST');
  assert.ok(r.tiles.filter((t) => t).length > 40 && r.tiles.every((t) => !t || /^\d+×$/.test(t)), `tiles: ${r.tiles.join(' ')}`);
  assert.equal(r.award, Math.round(r.round.total * 100), 'the award');
  assert.equal(r.host, 0);
  assert.deepEqual(r.after, []);
  assert.deepEqual(page.errors, []);
  await page.ctx.close();
});

test('three gold tombstones start Hidden Free Spins, with a roamer out on the first spin', async () => {
  const page = await open(HIDDEN);
  const r = await play(page);
  assert.equal(r.round.mode, 'hidden');
  assert.ok(r.gold >= 3 && r.golden, `three gold tombstones showed (${r.gold})`);
  assert.deepEqual(r.splash, { title: 'HIDDEN FREE SPINS', value: String(r.round.start.count) });
  assert.deepEqual(r.classes.sort(), ['bonus', 'hidden-bonus', 'super-bonus']);
  assert.equal(r.mode, 'HIDDEN CRYPT');
  // The first spin's roamer: a bolt from the crystal.
  assert.ok(r.bolts.length >= 1, 'a bolt put the roamer out');
  const b = r.bolts[0];
  assert.ok(Math.hypot(b.origin.x - b.crystal.x, b.origin.y - b.crystal.y) < 1, 'the bolt left the crystal');
  assert.equal(r.award, Math.round(r.round.total * 100), 'the award');
  assert.equal(r.host, 0);
  assert.deepEqual(r.after, []);
  assert.deepEqual(page.errors, []);
  await page.ctx.close();
});
