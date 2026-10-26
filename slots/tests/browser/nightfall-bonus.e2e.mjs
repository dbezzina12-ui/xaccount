// Night Fall's bonus tiers (Claude, 2026-10-26): base spins with fixed seeds
// that land a gold Super tombstone (Super Free Spins) and a Hidden tombstone
// (Hidden Free Spins), on a phone. The special tombstone shows on the board,
// the right bonus starts with the right spin count and 2x tiles. Hidden clears
// the board and the mage's 3 to 5 opening strikes raise the engine's tiles
// before its first spin puts the roamer out. The award is the engine's.
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
// spins); 2 tombstones + 1 Hidden (Hidden, 10 spins).
const SUPER = 9430, HIDDEN = 206172;

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
    const round = generateRound({ rng: seedRng(seed[0]) }), out = { round: { mode: round.bonusMode, total: round.total, start: round.events.find((e) => e.type === 'bonusStart'), opening: round.events.find((e) => e.type === 'hiddenStrikes') }, sfs: 0, hfs: 0, styled: { sfs: false, hfs: false }, bolts: [] };
    const { bolt, } = globalThis.NightFall.effects, play = bolt.play.bind(bolt), mage = globalThis.NightFall.actors.archer;
    bolt.play = (o) => { out.bolts.push({ index: o.index, origin: o.origin, crystal: mage.releasePoint(), freeSpin: document.getElementById('status').textContent !== 'THE HIDDEN CRYPT OPENS' }); return play(o); };
    const board = document.getElementById('board');
    new MutationObserver(() => {
      for (const [kind, cls] of [['sfs', '.fs-super'], ['hfs', '.fs-hidden']]) {
        const cells = board.querySelectorAll(`.cell[data-kind=${kind}]`);
        out[kind] = Math.max(out[kind], cells.length);
        if ([...cells].some((c) => c.querySelector(cls))) out.styled[kind] = true;
      }
    }).observe(board, { subtree: true, attributes: true, attributeFilter: ['data-kind'] });
    const start = globalThis.NightFall.state.balance;
    const done = globalThis.NightFall.spin();
    // The splash: its title and count, then continue.
    while (!document.getElementById('splash').open) await new Promise((r) => setTimeout(r, 50));
    out.splash = { title: document.getElementById('splash-title').textContent, value: document.getElementById('splash-value').textContent };
    out.classes = [...document.body.classList].filter((c) => c.endsWith('bonus'));
    out.mode = document.getElementById('mode-name').textContent;
    document.getElementById('splash-continue').click();
    // The tiles as the first free spin's symbols start to drop (before any of its wins).
    await new Promise((ok) => { const watch = new MutationObserver(() => { if (board.dataset.motion === 'drop') { out.tiles = [...document.querySelectorAll('#board .multi')].map((m) => (m.hidden ? '' : m.textContent)); watch.disconnect(); ok(); } }); watch.observe(board, { attributes: true, attributeFilter: ['data-motion'] }); });
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
  assert.ok(r.sfs >= 1 && r.styled.sfs && !r.hfs, `the gold tombstone showed (${r.sfs})`);
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

test('a Hidden tombstone starts Hidden Free Spins, with a roamer out on the first spin', async () => {
  const page = await open(HIDDEN);
  const r = await play(page);
  assert.equal(r.round.mode, 'hidden');
  assert.ok(r.hfs >= 1 && r.styled.hfs, `the Hidden tombstone showed (${r.hfs})`);
  assert.deepEqual(r.splash, { title: 'HIDDEN FREE SPINS', value: String(r.round.start.count) });
  assert.deepEqual(r.classes.sort(), ['bonus', 'hidden-bonus', 'super-bonus']);
  assert.equal(r.mode, 'HIDDEN CRYPT');
  // The opening: one bolt per strike, to the engine's tiles, before the first free spin.
  const opening = r.bolts.filter((b) => !b.freeSpin);
  assert.deepEqual(opening.map((b) => b.index), r.round.opening.strikes.map((s) => s.cell), 'one bolt per opening strike');
  assert.ok(opening.length >= 3 && opening.length <= 5);
  // The first free spin starts on the raised tiles, then its roamer goes out with a bolt.
  const raised = r.round.opening.hits.map((h) => (h >= 2 ? 2 ** (h - 1) + '×' : ''));
  assert.deepEqual(r.tiles, raised, 'the tiles the strikes raised');
  assert.ok(r.tiles.some((t) => parseInt(t) >= 4));
  assert.ok(r.bolts.some((b) => b.freeSpin), 'a bolt put the roamer out');
  for (const b of r.bolts) assert.ok(Math.hypot(b.origin.x - b.crystal.x, b.origin.y - b.crystal.y) < 1, 'each bolt left the crystal');
  assert.equal(r.award, Math.round(r.round.total * 100), 'the award');
  assert.equal(r.host, 0);
  assert.deepEqual(r.after, []);
  assert.deepEqual(page.errors, []);
  await page.ctx.close();
});
