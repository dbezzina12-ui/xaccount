// Cyber Skunk in a real browser, desktop and phone: rounds of every way to play
// through the real controller and buy screen, with no page errors, the money
// matching the round history, the buy screen's order and its confirmation,
// and skip leaving no overlay behind. Also the audio mix, rendered offline by
// tools/audio/cyber-skunk-levels.mjs: nothing clips, nothing is buried.
//
//   node --test tests/browser/cyber-skunk.e2e.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { serve, chromium } from '../../tools/lib/browser.mjs';
import { measure } from '../../tools/audio/cyber-skunk-levels.mjs';

const GAME = 'games/cyber-skunk/runtime/index.html', KEY = 'cyber-skunk-session-v1', START = 1_000_000;
let srv, browser;
before(async () => { srv = await serve(); browser = await chromium(); });
after(async () => { await browser?.close(); srv?.close(); });

async function open({ width, height, session = null }) {
  const phone = width < height, page = await browser.newPage({ viewport: { width, height }, isMobile: phone, hasTouch: phone });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  if (session) await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [KEY, JSON.stringify(session)]);
  await page.goto(srv.url + GAME);
  await page.waitForFunction(() => window.cyberSkunk?.state.ready);
  if (await page.locator('#intro').isVisible()) await page.locator('#intro-go').click();
  return { page, errors };
}
const state = (page) => page.evaluate(() => window.cyberSkunk.state);
const control = (page, action) => page.locator(`[data-action=${action}]`).first();
// Presses Stop until the round settles: skip must always finish it. The
// check and the press happen in one step in the page, so a press can never
// land just after the round ends and start a new one.
async function finish(page) {
  for (let k = 0; k < 400 && (await state(page)).busy; k++) {
    if (!(await page.locator('#bonus-panel').isHidden())) await page.locator('#bonus-panel-go').click().catch(() => {});
    else await page.evaluate(() => { if (window.cyberSkunk.state.busy) document.getElementById('controller').shadowRoot.querySelector('[data-action=play]')?.click(); });
    await page.waitForTimeout(60);
  }
  await page.waitForFunction(() => !window.cyberSkunk.state.busy, null, { timeout: 30000 });
}
const history = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)).history, KEY);

for (const [label, size] of [['desktop', { width: 1366, height: 768 }], ['phone', { width: 390, height: 844 }]]) {
  test(`${label}: base, Spray Job, Vent Break and Overpressure settle exactly`, async () => {
    const { page, errors } = await open(size);
    await control(page, 'play').click();
    await finish(page);
    // Spray Job on, one spin, off again.
    await control(page, 'buy').click();
    await page.locator('[data-pick=sprayjob]').click();
    await page.locator('#confirm-ok').click();
    assert.equal((await state(page)).feature, 'sprayjob');
    await control(page, 'play').click();
    await page.waitForTimeout(400);
    await finish(page);
    await control(page, 'buy').click();
    assert.equal((await state(page)).feature, null, 'Buy turns a feature off');
    for (const mode of ['ventbreak', 'overpressure']) {
      await control(page, 'buy').click();
      await page.locator(`[data-pick=${mode}]`).click();
      await page.locator('#confirm-ok').click();
      await page.waitForSelector('#bonus-panel:not([hidden])', { timeout: 20000 });
      await finish(page);
    }
    const rounds = await history(page), s = await state(page);
    assert.deepEqual(rounds.map((r) => r.mode).reverse(), ['base', 'sprayjob', 'ventbreak', 'overpressure']);
    assert.equal(s.balance, START + rounds.reduce((a, r) => a - r.cost + r.win, 0), 'balance = start - costs + wins');
    assert.deepEqual(rounds.map((r) => r.cost).reverse(), [100, 1000, 10000, 25000]);
    for (const r of rounds) assert.ok(Number.isInteger(r.win) && r.win >= 0);
    assert.ok(rounds.slice(0, 2).every((r) => r.tier), 'the buys play their bonus');
    // Nothing left on screen after skipping.
    assert.ok(await page.locator('#bonus-panel').isHidden());
    assert.ok(await page.locator('#bigwin').isHidden());
    assert.ok(await page.locator('#bonus-hud').isHidden());
    assert.deepEqual(errors, []);
    await page.close();
  });
}

test('vents: full symbol lands, centred reverse flips for spray, skip restores the paying face', async () => {
  const { page, errors } = await open({ width: 390, height: 844 });
  assert.equal(await page.locator('.tier-strip').count(), 0, 'no persistent bonus ladder');
  const dial = await page.locator('.gauge').boundingBox();
  const readout = await page.locator('.gauge-readout').boundingBox();
  assert.ok(readout.y + readout.height < dial.y, 'pressure number sits above the dial');
  await control(page, 'buy').click();
  await page.locator('[data-pick=sprayjob]').click();
  await page.locator('#confirm-ok').click();
  await control(page, 'play').click();
  await page.waitForFunction(() => document.querySelector('#reels .reel.spinning'));
  assert.equal(await page.locator('#reels .reel.spinning .reverse').count(), 0, 'spinning cards show their normal face');
  await page.waitForSelector('#reels .vent-card.reverse');
  const reverse = await page.locator('#reels .vent-card.reverse').evaluateAll((cards) => cards.map((card) => {
    const front = card.querySelector('.card-front'), back = card.querySelector('.card-back');
    const c = card.getBoundingClientRect(), v = back.querySelector('.vent-art').getBoundingClientRect();
    const symbol = getComputedStyle(front.querySelector('.sym'));
    return { separate: !!front.querySelector('.sym') && !front.querySelector('.vent-art'), hiddenBack: getComputedStyle(back).backfaceVisibility,
      fullSize: symbol.scale === 'none' && symbol.translate === 'none',
      contained: v.left >= c.left && v.right <= c.right && v.top >= c.top && v.bottom <= c.bottom };
  }));
  assert.ok(reverse.length >= 3, 'Spray Job flips at least three vents');
  for (const c of reverse) assert.deepEqual(c, { separate: true, hiddenBack: 'hidden', fullSize: true, contained: true });
  await finish(page); // skip while reverse is visible, then check the settled result
  assert.equal(await page.locator('#reels .cell').count(), 24);
  assert.equal(await page.locator('#reels .cell[data-i].landed').count(), 24);
  assert.equal(await page.locator('#reels .reverse').count(), 0, 'no card is stranded on its reverse');
  assert.ok(await page.locator('#reels .wild .sym').count() > 0, 'sprayed cards expose their WILD face');
  const rounds = await history(page), s = await state(page);
  assert.equal(s.balance, START - rounds[0].cost + rounds[0].win, 'skip preserves accounting');
  await control(page, 'settings').click();
  await page.locator('#menu-rules').click();
  const fs = page.locator('#rules .scatter-letters');
  assert.equal(await fs.textContent(), 'FS');
  assert.equal(await fs.evaluate((el) => el.parentElement.querySelectorAll('rect,path,image,img').length), 0, 'FS is only lettering, with no plate');
  assert.deepEqual(errors, []);
  await page.close();
});

test('buy screen: Feature Spins first, Bonus Buys second, Hidden as information; short balance disables confirm', async () => {
  const { page, errors } = await open({ width: 1366, height: 768, session: { balance: 5000, bet: 100 } });
  await control(page, 'buy').click();
  const sections = await page.locator('#buy-menu h3').allTextContents();
  assert.deepEqual(sections, ['FEATURE SPINS', 'BONUS BUYS', 'HIDDEN']);
  assert.deepEqual(await page.locator('#feature-cards [data-pick]').evaluateAll((b) => b.map((x) => x.dataset.pick)), ['enhanced', 'sprayjob']);
  assert.deepEqual(await page.locator('#bonus-cards [data-pick]').evaluateAll((b) => b.map((x) => x.dataset.pick)), ['ventbreak', 'overpressure']);
  assert.equal(await page.locator('.hidden-tier [data-pick]').count(), 0, 'Blackout Protocol is not for sale');
  // $50 cannot pay for a $250 Overpressure: the card and the confirmation both refuse.
  assert.ok(await page.locator('[data-pick=overpressure]').isDisabled());
  await page.locator('[data-pick=sprayjob]').click();
  assert.equal(await page.locator('#confirm-total').textContent(), '$10.00');
  assert.ok(await page.locator('#confirm-ok').isEnabled(), '$10 Spray Job is affordable');
  await page.locator('#confirm-cancel').click();
  assert.equal((await state(page)).balance, 5000, 'cancel charges nothing');
  assert.deepEqual(errors, []);
  await page.close();
});

test('the intro shows before the first spin, and "Don\'t show this again" sticks', async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.goto(srv.url + GAME);
  await page.waitForSelector('#intro:not([hidden])');
  const go = await page.locator('#intro-go').boundingBox();
  assert.ok(go && go.y + go.height <= 844, 'Play is on screen without scrolling');
  await page.locator('#intro-hide').check();
  await page.locator('#intro-go').click();
  assert.ok(await page.locator('#intro').isHidden());
  await page.reload();
  await page.waitForFunction(() => window.cyberSkunk?.state.ready);
  assert.ok(await page.locator('#intro').isHidden(), 'stays hidden after a reload');
  await page.close();
});

test('the rules show the shipping prices and 96% RTP', async () => {
  const { page } = await open({ width: 1366, height: 768 });
  await control(page, 'settings').click();
  await page.locator('#menu-rules').click();
  const text = await page.locator('#rules-body').textContent();
  for (const s of ['96.00%', '25,000×', 'VENT BREAK', 'OVERPRESSURE', 'BLACKOUT PROTOCOL', '100× base bet', '250× base bet', '3× base bet per spin', '10× base bet per spin']) assert.ok(text.includes(s), s);
  await page.close();
});

test('audio: nothing clips, the music sits under the reels, the big moments are loudest, phones hear the reels', async () => {
  const { music, effects, mix } = await measure();
  for (const [name, v] of [...Object.entries(music), ...Object.entries(effects), ['mix', mix]]) assert.ok(v.peak <= -1, `${name} peaks at ${v.peak} dBFS after the limiter`);
  for (const t of ['base', 'bonus', 'hidden']) assert.ok(music[t].i >= -27 && music[t].i <= -21, `${t} music at ${music[t].i} LUFS`);
  const reel = ['click', 'tick', 'spin', 'stop', 'vent-land', 'paint'], big = ['bonus-in', 'bigwin', 'max'];
  for (const [name, v] of Object.entries(effects)) assert.ok(v.m >= -33, `${name} is buried at ${v.m} LUFS`);
  for (const b of big) for (const r of reel) assert.ok(effects[b].m >= effects[r].m + 8, `${b} not clearly above ${r}`);
  const loudest = Math.max(...Object.values(effects).map((v) => v.m));
  for (const b of ['bigwin', 'max']) assert.ok(effects[b].m >= loudest - 0.5, `${b} is not the loudest effect`);
  // A phone speaker loses the thumps; the reel sounds must still reach the music's level there.
  for (const r of reel) assert.ok(effects[r].phone >= music.base.phone - 6, `${r} at ${effects[r].phone} on a phone, music at ${music.base.phone}`);
});

// Rare outcomes through the real UI. The page's random tickets are steered so
// drawRound lands on a chosen catalog row; the round is still drawn, replayed
// and checked by the game exactly as in play.
const STEER = () => {
  window.__tickets = [];
  const real = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = (a) => {
    if (!(a instanceof Uint32Array && a.length === 2 && window.__tickets.length)) return real(a);
    const { t, total } = window.__tickets.shift(), x = Math.floor(((t + 0.5) / total) * 2 ** 53);
    a[0] = Math.floor(x / 2 ** 21); a[1] = (x % 2 ** 21) * 2 ** 11;
    return a;
  };
  // What the round showed, however briefly.
  window.__seen = new Set();
  new MutationObserver(() => {
    const app = document.getElementById('app'), big = document.getElementById('bigwin');
    if (app && 'blackout' in app.dataset) window.__seen.add('blackout');
    if (big && !big.hidden) window.__seen.add(`bigwin-${big.dataset.tier}`);
    if (document.getElementById('reel-banner')?.hidden === false) window.__seen.add('banner');
  }).observe(document, { subtree: true, attributes: true, attributeFilter: ['hidden', 'data-blackout', 'data-tier'] });
};
// Queues the tickets for one outcome and returns its value (hundredths of the bet).
const steer = (page, kind) => page.evaluate(async (kind) => {
  const { default: d } = await import('./catalog-data.js'), { playRound, seeded } = await import('./engine.js');
  const start = (pool, i) => d.pools[pool].slice(0, i).reduce((a, r) => a + r[1], 0), T = (t) => ({ t, total: d.total });
  if (kind === 'blackout') {
    const { none, regular, super: sup } = d.modes.base.tiers, rows = d.pools['bonus-hidden'];
    const b = rows.reduce((k, r, i) => (r[2] > rows[k][2] ? i : k), 0);
    window.__tickets.push(T(none + regular + sup), T(0), T(start('bonus-hidden', b)));
    return Math.min(d.cap, d.pools['entry-base-hidden'][0][2] + rows[b][2]);
  }
  if (kind === 'cap') {
    const i = d.pools['bonus-super'].findIndex((r) => r[2] === d.cap);
    window.__tickets.push(T(start('bonus-super', i)));
    return d.cap;
  }
  const rows = d.pools['bonus-regular'];
  const i = rows.findIndex((r) => playRound({ mode: 'ventbreak', rng: seeded(r[0]) }).events.some((e) => e.type === 'retrigger'));
  window.__tickets.push(T(start('bonus-regular', i)));
  return rows[i][2];
}, kind);

for (const [kind, mode, size, shows] of [
  ['blackout', 'base', { width: 1920, height: 1080 }, ['blackout', 'bigwin-max']],
  ['cap', 'overpressure', { width: 390, height: 844 }, ['bigwin-max']],
  ['retrigger', 'ventbreak', { width: 1366, height: 768 }, ['banner']],
]) {
  test(`rare path, ${kind} (${size.width}×${size.height}): plays, shows ${shows.join(' and ')}, settles exactly, and the page never scrolls`, async () => {
    const phone = size.width < size.height, page = await browser.newPage({ viewport: size, isMobile: phone, hasTouch: phone });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [KEY, JSON.stringify({ introHidden: true, speed: 'turbo' })]);
    await page.addInitScript(STEER);
    await page.goto(srv.url + GAME);
    await page.waitForFunction(() => window.cyberSkunk?.state.ready);
    const value = await steer(page, kind);
    if (mode === 'base') await control(page, 'play').click();
    else { await control(page, 'buy').click(); await page.locator(`[data-pick=${mode}]`).click(); await page.locator('#confirm-ok').click(); }
    await page.waitForTimeout(400);
    await finish(page);
    const [round] = await history(page), s = await state(page), seen = await page.evaluate(() => [...window.__seen]);
    assert.equal(round.mode, mode);
    assert.equal(round.win, value, 'paid the steered catalog value at a $1 bet');
    assert.equal(s.balance, START - round.cost + round.win);
    for (const x of shows) assert.ok(seen.includes(x), `${x} was shown (saw ${seen.join(', ')})`);
    assert.equal(await page.evaluate(() => { const app = document.getElementById('app'); app.scrollTop = 120; return app.scrollTop; }), 0, 'the game area cannot scroll');
    assert.deepEqual(errors, []);
    await page.close();
  });
}

test('a reload mid-bonus loses nothing: the round is paid on the next visit and kept in history', async () => {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(([k, v]) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem(k, v); } }, [KEY, JSON.stringify({ introHidden: true })]);
  await page.addInitScript(STEER);
  await page.goto(srv.url + GAME);
  await page.waitForFunction(() => window.cyberSkunk?.state.ready);
  const value = await steer(page, 'cap');
  await control(page, 'buy').click(); await page.locator('[data-pick=overpressure]').click(); await page.locator('#confirm-ok').click();
  await page.waitForSelector('#bonus-panel:not([hidden])', { timeout: 20000 });
  assert.equal((await state(page)).balance, START - 25000, 'mid-round, only the cost has moved');
  await page.reload();
  await page.waitForFunction(() => window.cyberSkunk?.state.ready);
  const [round] = await history(page), s = await state(page);
  assert.equal(s.balance, START - 25000 + value, 'the win was paid on reload');
  assert.deepEqual([round.mode, round.cost, round.win], ['overpressure', 25000, value]);
  assert.equal(s.pending, null);
  assert.match(await page.locator('#toast').textContent(), /finished while you were away: WIN \$25,000\.00/);
  // A second reload pays nothing more.
  await page.reload();
  await page.waitForFunction(() => window.cyberSkunk?.state.ready);
  assert.equal((await state(page)).balance, START - 25000 + value);
  assert.equal((await history(page)).length, 1);
  assert.deepEqual(errors, []);
  await page.close();
});
