// Reel anticipation (S-20) on the real Zombify runtime, with deterministic
// outcomes. The test feeds chosen values to the game's ticket draw
// (crypto.getRandomValues), so the game selects real catalog outcomes and
// validates their payout as always; no math, catalog or selection code changes.
// Skips without the `npm run studio:prepare` assets.
//
//   npm run test:studio-browser

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { serve, chromium } from '../../tools/lib/browser.mjs';
import { AGENT_TOOLS, AUDIO_TAP, tone, runtime, isBusy, whenReady, until, prepared } from './helpers.mjs';

const skip = prepared ? false : 'needs the Zombify assets: npm run studio:prepare';
const rt = (f) => new URL(`../../games/zombify/runtime/${f}`, import.meta.url).href;

// Catalog outcomes, as ticket draws in the order the game makes them: a base
// spin draws ticket(275) (0 = bonus), then the base pool; a bonus draws its
// tier (of 100), the bonus pool, then the trigger spin pool.
const FIXTURES = {
  // Both scatters on reel 1: reels 2-6 tease, and no third scatter lands.
  miss: { tickets: [1, 46930000], landed: [2, 2, 2, 2, 2, 2], win: 0.3 },
  regular: { tickets: [0, 0, 0, 46], landed: [2, 3, 3, 3, 3, 3], win: 0.7, ladder: ['OUTBREAK SIGNAL', 'OUTBREAK SECURED'], heading: 'OUTBREAK' },
  super: { tickets: [0, 90, 0, 7], landed: [2, 2, 2, 2, 3, 4], win: 2004.6, ladder: ['OUTBREAK SIGNAL', 'OUTBREAK SECURED', 'SUPER OUTBREAK SECURED'], heading: 'SUPER OUTBREAK' },
  hidden: { tickets: [0, 99, 0, 8], landed: [2, 3, 3, 4, 5, 5], win: 7871.6, ladder: ['OUTBREAK SIGNAL', 'OUTBREAK SECURED', 'SUPER OUTBREAK SECURED', 'HIDDEN OUTBREAK SECURED'], heading: 'HIDDEN OUTBREAK' },
};

// In the game frame: a ticket queue in front of crypto.getRandomValues, and a
// recorder for the tease status and waiting reels.
const INSTRUMENT = () => {
  if (!location.pathname.includes('/games/zombify/runtime/')) return;
  const queue = [], real = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = (a) => {
    if (queue.length && a instanceof Uint32Array && a.length === 1) { a[0] = queue.shift(); return a; }
    return real(a);
  };
  window.__force = (tickets) => { queue.length = 0; queue.push(...tickets); };
  window.__queued = () => queue.length;
  window.__watch = () => {
    const seen = { titles: [], maxWaiting: 0, active: false, start: performance.now(), end: null };
    window.__seen = seen;
    const record = () => {
      const title = document.querySelector('.tease-status:not([hidden]) strong')?.textContent;
      if (title && seen.titles.at(-1) !== title) seen.titles.push(title);
      seen.maxWaiting = Math.max(seen.maxWaiting, document.querySelectorAll('.tease-waiting').length);
      const active = !!document.querySelector('.tease-active');
      if (active) seen.active = true;
      else if (seen.active && seen.end === null) seen.end = performance.now() - seen.start;
    };
    // The tease camera (S-27): the most the scene was pushed in, and whether
    // the status covered the title sign exactly.
    const near = document.querySelector('#game > .play-area'), sign = document.querySelector('#game > .play-area .brand');
    Object.assign(seen, { maxZoom: 1, signCovered: null });
    clearInterval(window.__zoomTimer);
    window.__zoomTimer = setInterval(() => {
      seen.maxZoom = Math.max(seen.maxZoom, parseFloat(getComputedStyle(near).scale) || 1);
      const status = document.querySelector('.tease-status:not([hidden])');
      // Compared once its entrance pop has finished (it scales from 92%).
      if (status && sign && seen.signCovered === null && !status.getAnimations().length) {
        const a = status.getBoundingClientRect(), b = sign.getBoundingClientRect();
        seen.signCovered = ['left', 'top', 'width', 'height'].every((k) => Math.abs(a[k] - b[k]) < 1.5);
      }
    }, 40);
    window.__observer?.disconnect();
    window.__observer = new MutationObserver(record);
    window.__observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'hidden'] });
  };
};

let srv;
let browser;
before(async () => {
  if (skip) return;
  srv = await serve();
  browser = await chromium();
});
after(async () => {
  await browser?.close();
  srv?.close();
});

async function openStudio({ init = [], ...options } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.addInitScript(AGENT_TOOLS);
  await page.addInitScript(INSTRUMENT);
  for (const script of init) await page.addInitScript(script);
  await page.goto(`${srv.url}studio/index.html`);
  await whenReady(page, 60000);
  page.ctx = ctx;
  return page;
}
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const game = (page) => runtime(page).evaluate(() => {
  const s = window.ZombifyStudioRuntime.read();
  return { busy: s.busy, lastWin: s.lastWin, board: s.board, shown: [...document.querySelectorAll('#board > .tile')].map((t) => t.dataset.kind), heading: document.getElementById('feature-heading').textContent };
});
// After a round the camera is at rest: no zoom or lean, origins restored,
// nothing still animating.
const cameraAtRest = (page) => runtime(page).evaluate(() => [document.querySelector('#game > .play-area'), document.querySelector('#game > .studio-background')]
  .every((el) => { const c = getComputedStyle(el); return ['none', '1'].includes(c.scale) && ['none', '0px', '0px 0px'].includes(c.translate) && !el.style.transformOrigin && el.getAnimations().length === 0; }));
// Leftovers a finished tease must not leave behind.
const leftovers = (page) => runtime(page).evaluate(() => ['.tease-stage', '.tease-status', '.tease-active', '.tease-waiting', '.tease-muted', '.fs-locked', '.tease-camera-in'].filter((s) => document.querySelector(s)));

// Starts a base Test spin with the fixture's outcome and drives it to the end:
// Continue whenever a bonus waits, and fast-forward once the trigger spin's
// tease is over. The fast-forward calls the game's skip(), which does nothing
// between rounds; clicking the studio button there would start a new spin.
// `skipAt` clicks the studio's Skip button once, when it first returns true.
async function play(page, fixture, { speed = 'normal', skipAt = (seen) => false, during } = {}) {
  await runtime(page).evaluate((t) => { window.__force(t); window.__watch(); }, fixture.tickets);
  if ((await page.inputValue('#preview-mode')) !== 'base') await page.selectOption('#preview-mode', 'base');
  if ((await page.inputValue('#speed')) !== speed) await page.selectOption('#speed', speed);
  const t0 = Date.now();
  await page.click('#spin');
  await until(() => isBusy(page), 5000);
  let lastSkip = 0, clicked = false;
  while (await isBusy(page)) {
    const seen = await runtime(page).evaluate(() => window.__seen);
    await during?.(seen);
    if (await page.isVisible('#continue')) await page.click('#continue', { timeout: 500 }).catch(() => {});
    else if (!clicked && (await skipAt(seen))) { clicked = true; await page.click('#spin'); }
    else if (seen.end !== null && Date.now() - lastSkip > 250) { lastSkip = Date.now(); await runtime(page).evaluate(() => window.ZombifyStudioRuntime.skip()); }
    await pause(40);
  }
  const seen = await runtime(page).evaluate(() => window.__seen);
  assert.equal(await runtime(page).evaluate(() => window.__queued()), 0, 'the game drew every forced ticket');
  return { ...seen, ms: Date.now() - t0, ...(await game(page)) };
}
function assertLanded(round, fixture) {
  assert.deepEqual(round.shown, round.board, 'the board on screen is the selected board');
  // lastWin is in cents; the fixtures are in credits at a 1.00 bet.
  assert.ok(Math.abs(round.lastWin / 100 - fixture.win) < 0.005, `won ${round.lastWin / 100}, catalog says ${fixture.win}`);
}

test('the fixtures are the catalog outcomes they claim to be', { skip }, async () => {
  const { makeRound, seeded } = await import(rt('math.js'));
  const { BONUS_FEATURES } = await import(rt('config.js'));
  const data = (await import(rt('outcomes.js'))).default;
  const pick = (pool, ticket) => pool.entries.find((e) => e[1] > ticket);
  const landed = (board) => Array.from({ length: 6 }, (_, reel) => board.filter((c, i) => i % 6 <= reel && c.kind === 'vial').length);
  const miss = pick(data.pools.base, FIXTURES.miss.tickets[1]);
  assert.equal(miss[3], 2);
  assert.equal(miss[2] / 100, FIXTURES.miss.win);
  assert.deepEqual(landed(makeRound({ kind: 'base', rng: seeded(miss[0]), forcedScatters: 2, baseOnly: true }).events[0].board), FIXTURES.miss.landed);
  for (const tier of ['regular', 'super', 'hidden']) {
    const f = FIXTURES[tier], bonus = pick(data.pools[tier], f.tickets[2]), trigger = pick(data.pools[`entry_${tier}`], f.tickets[3]);
    assert.equal(Math.min(2500000, bonus[2] + trigger[2]) / 100, f.win);
    const board = makeRound({ kind: 'base', rng: seeded(trigger[0]), forcedScatters: BONUS_FEATURES[tier].scatters, bonusRng: seeded(bonus[0]), clustered: !!bonus[4] }).events[0].board;
    assert.deepEqual(landed(board), f.landed, tier);
  }
});

test('two scatters then a miss: the rest of the reels tease, nothing is promised, and the tease clears', { skip }, async () => {
  const page = await openStudio();
  const round = await play(page, FIXTURES.miss);
  assert.deepEqual(round.titles, ['OUTBREAK SIGNAL']);
  assert.ok(round.maxWaiting >= 3, `${round.maxWaiting} reels waited`);
  assert.ok(round.maxZoom > 1.01, `the camera pushed in to ${round.maxZoom}`);
  assert.equal(round.signCovered, true, 'the status covers the title sign');
  assert.ok(await cameraAtRest(page), 'the camera is back at rest');
  assertLanded(round, FIXTURES.miss);
  assert.deepEqual(await leftovers(page), []);
  assert.deepEqual(page.errors, []);
  await page.ctx.close();
});

test('3, 4 and 5 scatters: the status climbs one tier per landed scatter, then that bonus starts', { skip }, async () => {
  const page = await openStudio();
  for (const [tier, speed] of [['hidden', 'normal'], ['super', 'turbo'], ['regular', 'quick']]) {
    const f = FIXTURES[tier];
    let heading = null;
    const round = await play(page, f, { speed, during: async () => { if (heading === null && (await page.isVisible('#continue'))) heading = (await game(page)).heading; } });
    assert.deepEqual(round.titles, f.ladder, `${tier} at ${speed}`);
    assert.equal(heading, f.heading, `${tier} bonus intro`);
    assert.ok(round.maxZoom > 1.02, `${tier}: the camera pushed in to ${round.maxZoom}`);
    assert.ok(await cameraAtRest(page), `${tier}: the camera is back at rest`);
    assertLanded(round, f);
    assert.deepEqual(await leftovers(page), [], tier);
  }
  assert.deepEqual(page.errors, []);
  await page.ctx.close();
});

test('Skip during anticipation clears the tease at once and lands the same board', { skip }, async () => {
  const page = await openStudio();
  let skippedAt = null;
  const round = await play(page, FIXTURES.miss, { skipAt: (seen) => { if (seen.active && skippedAt === null) skippedAt = Date.now(); return seen.active; } });
  assert.ok(skippedAt, 'the tease started');
  assert.ok(Date.now() - skippedAt < 2500, `the round ended ${Date.now() - skippedAt} ms after Skip`);
  assert.ok(await cameraAtRest(page), 'Skip leaves the camera at rest');
  assertLanded(round, FIXTURES.miss);
  assert.deepEqual(await leftovers(page), []);
  await page.ctx.close();
});

test('Turbo anticipation is shorter than Normal, and the next spin is clean', { skip }, async () => {
  const page = await openStudio();
  const normal = await play(page, FIXTURES.miss);
  const turbo = await play(page, FIXTURES.miss, { speed: 'turbo' });
  assert.ok(turbo.end < normal.end * 0.75, `tease ended at ${turbo.end} ms at Turbo, ${normal.end} ms at Normal`);
  assertLanded(turbo, FIXTURES.miss);
  // An ordinary spin straight after: no tease, nothing left over.
  await runtime(page).evaluate(() => window.__watch());
  await page.selectOption('#speed', 'normal');
  await page.click('#spin');
  await until(() => isBusy(page), 5000);
  await until(async () => !(await isBusy(page)), 60000);
  const after = await game(page);
  assert.deepEqual(after.shown, after.board);
  assert.deepEqual(await leftovers(page), []);
  await page.ctx.close();
});

test('with reduced motion there is no tease animation, and the outcome is the same', { skip }, async () => {
  const page = await openStudio({ reducedMotion: 'reduce' });
  const round = await play(page, FIXTURES.miss);
  assert.equal(round.active, false, 'no tease under reduced motion');
  assert.equal(round.maxZoom, 1, 'no camera push under reduced motion');
  assertLanded(round, FIXTURES.miss);
  assert.deepEqual(await leftovers(page), []);
  await page.ctx.close();
});

test('hiding the tab mid-tease, then coming back, still lands the selected board', { skip }, async () => {
  const page = await openStudio();
  let hid = false;
  const setHidden = (hidden) => runtime(page).evaluate((hidden) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
  const round = await play(page, FIXTURES.miss, {
    during: async (seen) => {
      if (seen.active && !hid) { hid = true; await setHidden(true); await pause(1200); await setHidden(false); }
    },
  });
  assert.ok(hid, 'the tab was hidden during the tease');
  assert.ok(await cameraAtRest(page), 'the camera is back at rest after the hidden tab');
  assertLanded(round, FIXTURES.miss);
  assert.deepEqual(await leftovers(page), []);
  assert.deepEqual(page.errors, []);
  await page.ctx.close();
});

// The anticipation swell, measured at the game's audio output. A 1200 Hz tone
// replaces it through the Sounds tab (so the override is proven to work) and a
// 440 Hz tone replaces the base music. The reel sounds leak up to about -73 dB
// at 1200 Hz on their own; the swell measures -55 to -35 dB, so below -60 dB
// means no swell.
test('anticipation audio plays only while reels tease, dips the music, and stops on landing, Skip and a hidden tab', { skip }, async () => {
  const page = await openStudio({ init: [AUDIO_TAP] });
  const SWELL = 1200, MUSIC = 440;
  await page.click('[data-tab="sounds"]');
  for (const [event, hz, seconds] of [['tease', SWELL, 2.4], ['music-base', MUSIC, 3]]) {
    await page.selectOption('#sound-event', event);
    await page.setInputFiles('#sound-file', { name: `tone-${hz}.wav`, mimeType: 'audio/wav', buffer: tone(hz, seconds) });
    await page.waitForFunction((name) => document.querySelector('#sound-asset')?.selectedOptions[0]?.textContent === name, `tone-${hz}.wav`);
  }
  await page.click('#play');
  await runtime(page).click('#menu');
  await runtime(page).click('#menu-music');
  await runtime(page).click('#menu-effects');
  await runtime(page).evaluate(() => document.getElementById('settings').close());
  await page.click('#edit');
  await pause(1500);
  const sample = () => runtime(page).evaluate((p) => ({ teasing: !!document.querySelector('.tease-active'), ...window.__level(p) }), [SWELL, MUSIC]);
  const quietMusic = (await sample())[MUSIC];
  assert.ok(quietMusic > -45, `base music plays (${quietMusic} dB)`);

  // A full two-scatter miss.
  const samples = [];
  const round = await play(page, FIXTURES.miss, { during: async () => samples.push(await sample()) });
  assertLanded(round, FIXTURES.miss);
  const during = samples.filter((x) => x.teasing), outside = samples.filter((x) => !x.teasing);
  assert.ok(during.length > 10, `${during.length} samples while teasing`);
  assert.ok(during.filter((x) => x[SWELL] > -50).length >= during.length * 0.7, 'the swell plays while reels tease');
  assert.ok(outside.slice(0, 5).every((x) => !(x[SWELL] > -60)), 'no swell before the tease');
  const musicDuring = during.slice(5).map((x) => x[MUSIC]).sort((a, b) => a - b)[Math.floor((during.length - 5) / 2)];
  assert.ok(musicDuring < quietMusic - 2, `music dips while teasing (${musicDuring.toFixed(1)} dB vs ${quietMusic.toFixed(1)} dB)`);
  await pause(1200);
  const after = await sample();
  assert.ok(!(after[SWELL] > -60), 'the swell is gone once the reels land');
  assert.ok(Math.abs(after[MUSIC] - quietMusic) < 1, 'the music is back to its level');

  // Skip mid-tease: the swell stops at once.
  await runtime(page).evaluate((t) => { window.__force(t); window.__watch(); }, FIXTURES.miss.tickets);
  await page.click('#spin');
  await until(async () => (await sample())[SWELL] > -50, 15000);
  const skippedAt = Date.now();
  await page.click('#spin');
  let silentAfterSkip = null;
  while (Date.now() - skippedAt < 1500) { if (!((await sample())[SWELL] > -60)) { silentAfterSkip = Date.now() - skippedAt; break; } await pause(20); }
  assert.ok(silentAfterSkip !== null && silentAfterSkip < 400, `silent ${silentAfterSkip} ms after Skip`);
  console.log(`# swell ${Math.round(during.map((x) => x[SWELL]).sort((x, y) => x - y)[Math.floor(during.length / 2)])} dB while teasing; music ${(musicDuring - quietMusic).toFixed(1)} dB under it; silent ${silentAfterSkip} ms after Skip`);
  await until(async () => !(await isBusy(page)), 30000);
  assertLanded(await game(page), FIXTURES.miss);

  // Hidden tab mid-tease: the game suspends its audio; the round still lands.
  const setHidden = (hidden) => runtime(page).evaluate((hidden) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
  let hidden = null;
  const third = await play(page, FIXTURES.miss, {
    during: async (seen) => {
      if (seen.active && hidden === null && (await sample())[SWELL] > -50) {
        await setHidden(true);
        await pause(300);
        hidden = await runtime(page).evaluate(() => window.ZombifyStudioRuntime.read().audio.teasing);
        await setHidden(false);
      }
    },
  });
  assert.equal(hidden, 0, 'no swell left playing in a hidden tab');
  assertLanded(third, FIXTURES.miss);
  assert.deepEqual(page.errors, []);
  await page.ctx.close();
});

