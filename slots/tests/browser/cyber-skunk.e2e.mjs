// Cyber Skunk in a real browser, desktop and phone: rounds of every way to play
// through the real controller and buy screen, with no page errors, the money
// matching the round history, the buy screen's order and its confirmation,
// and skip leaving no overlay behind.
//
//   node --test tests/browser/cyber-skunk.e2e.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { serve, chromium } from '../../tools/lib/browser.mjs';

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
  return { page, errors };
}
const state = (page) => page.evaluate(() => window.cyberSkunk.state);
const control = (page, action) => page.locator(`[data-action=${action}]`).first();
// Presses Play (Stop while busy) until the round settles: skip must always finish it.
async function finish(page) {
  for (let k = 0; k < 400 && (await state(page)).busy; k++) {
    if (!(await page.locator('#bonus-panel').isHidden())) await page.locator('#bonus-panel-go').click().catch(() => {});
    else await control(page, 'play').click().catch(() => {});
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

test('the rules show the shipping prices and 96% RTP', async () => {
  const { page } = await open({ width: 1366, height: 768 });
  await control(page, 'settings').click();
  await page.locator('#menu-rules').click();
  const text = await page.locator('#rules-body').textContent();
  for (const s of ['96.00%', '25,000×', 'VENT BREAK', 'OVERPRESSURE', 'BLACKOUT PROTOCOL', '100× base bet', '250× base bet', '3× base bet per spin', '10× base bet per spin']) assert.ok(text.includes(s), s);
  await page.close();
});
