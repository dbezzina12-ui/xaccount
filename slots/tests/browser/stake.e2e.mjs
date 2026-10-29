// Zombify on Stake Engine (Dylan, 2026-10-29): the real game, launched as
// Engine launches it (?sessionID=…&rgs_url=…), against a stand-in RGS that
// answers authenticate, play, end-round and replay with real catalog outcomes
// as books (the recipe format tools/stake/zombify-export.mjs publishes).
// Checks the money (debits, payouts, balance), the bet levels and currency,
// resuming an unfinished round, a replay link, Stake.us words and the
// jurisdiction switches. Skips without the `npm run studio:prepare` assets.
//
//   npm run test:studio-browser
//   STAKE_BUILD=1 node --test tests/browser/stake.e2e.mjs   (the built upload,
//   dist/stake/zombify/frontend, after node tools/stake/build-zombify.mjs)

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { serve, chromium } from '../../tools/lib/browser.mjs';
import { AGENT_TOOLS, until, prepared } from './helpers.mjs';

const skip = prepared ? false : 'needs the Zombify assets: npm run studio:prepare';
const RT = new URL('../../games/zombify/runtime/', import.meta.url);
const MONEY = 1_000_000, RGS = 'rgs.stake-test.example';
const GAME = process.env.STAKE_BUILD ? 'dist/stake/zombify/frontend/index.html' : 'games/zombify/runtime/index.html';

let srv, browser, books;
before(async () => {
  if (skip) return;
  srv = await serve();
  browser = await chromium();
  // Real outcomes as books: { events: [recipe], payoutMultiplier } (hundredths of the bet).
  const data = (await import(new URL('outcomes.js', RT))).default, feature = (await import(new URL('feature-outcomes.js', RT))).default;
  const base = data.pools.base.entries.find((e) => e[2] >= 200 && e[2] <= 2000), loss = data.pools.base.entries.find((e) => e[2] === 0);
  const sup = data.pools.super.entries.find((e) => e[2] > 25000 && e[2] < 60000), life = feature.pool.entries.find((e) => e[3] === 1 && e[2] > 0);
  const reg = data.pools.regular.entries.find((e) => e[2] > 5000 && e[2] < 15000), hid = data.pools.hidden.entries.find((e) => e[2] < 150000);
  books = {
    base: { events: [{ type: 'spin', seed: base[0], scatters: base[3] }], payoutMultiplier: base[2] },
    loss: { events: [{ type: 'spin', seed: loss[0], scatters: loss[3] }], payoutMultiplier: 0 },
    super: { events: [{ type: 'bonus', tier: 'super', seed: sup[0], clustered: sup[4] ? 1 : 0 }], payoutMultiplier: sup[2] },
    outbreak: { events: [{ type: 'bonus', tier: 'regular', seed: reg[0], clustered: reg[4] ? 1 : 0 }], payoutMultiplier: reg[2] },
    hidden: { events: [{ type: 'bonus', tier: 'hidden', seed: hid[0], clustered: hid[4] ? 1 : 0 }], payoutMultiplier: hid[2] },
    secondlife: { events: [{ type: 'secondLife', seed: life[0], hearts: life[3], spins: life[4] }], payoutMultiplier: life[2] },
  };
});
after(async () => { await browser?.close(); srv?.close(); });

// A stand-in RGS. Each play takes the next queued book; money moves as Engine
// moves it: play debits bet x cost, end-round pays bet x payoutMultiplier.
function createRgs({ balance = 1000 * MONEY, jurisdiction = {}, round = null, queue = [] } = {}) {
  const cost = { base: 1, enhanced: 3.3, outbreak: 100, super: 250, mystery: 460, secondlife: 10 };
  const state = { balance, active: round, calls: [] };
  state.handle = async (route) => {
    const request = route.request(), path = new URL(request.url()).pathname, body = request.postDataJSON?.() ?? null;
    state.calls.push({ path, body });
    const reply = (json, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(json) });
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (path === '/wallet/authenticate') return reply({ balance: { amount: state.balance, currency: 'USD' }, config: { minBet: 100000, maxBet: 100 * MONEY, stepBet: 100000, defaultBetLevel: MONEY, betLevels: [100000, 200000, 500000, MONEY, 2 * MONEY, 5 * MONEY, 10 * MONEY], jurisdiction }, round: state.active });
    if (path === '/wallet/play') {
      const debit = Math.round(body.amount * cost[body.mode]);
      if (debit > state.balance) return reply({ error: 'ERR_IPB', code: 'ERR_IPB', message: 'insufficient balance' }, 400);
      const book = queue.shift();
      state.balance -= debit;
      state.active = { betID: state.calls.length, amount: body.amount, payout: (body.amount * book.payoutMultiplier) / 100, payoutMultiplier: book.payoutMultiplier / 100, active: book.payoutMultiplier > 0, state: book.events, mode: body.mode, event: null };
      return reply({ balance: { amount: state.balance, currency: 'USD' }, round: state.active });
    }
    if (path === '/wallet/end-round') {
      if (state.active?.active) state.balance += state.active.payout;
      if (state.active) state.active = { ...state.active, active: false };
      return reply({ balance: { amount: state.balance, currency: 'USD' } });
    }
    if (path.startsWith('/bet/replay/')) return reply({ payoutMultiplier: books.super.payoutMultiplier / 100, state: books.super.events });
    return reply({ error: 'ERR_VAL' }, 400);
  };
  return state;
}

async function open(rgs, query = '', viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.errors = []; page.on('pageerror', (e) => page.errors.push(e.message));
  // Every file the game asks for must be there (the built upload leaves unreferenced art out).
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes(RGS)) page.errors.push(`${r.status()} ${r.url()}`); });
  page.ctx = ctx;
  await page.addInitScript(AGENT_TOOLS);
  await page.route(`https://${RGS}/**`, rgs.handle);
  await page.goto(`${srv.url}${GAME}?sessionID=test-session&lang=en&device=desktop&rgs_url=${RGS}${query}`);
  await page.waitForSelector('#guide-play', { state: 'visible', timeout: 60000 });
  await page.click('#guide-play');
  await page.evaluate(() => { document.getElementById('speed').value = 'turbo'; document.getElementById('speed').dispatchEvent(new Event('change')); });
  return page;
}
const state = (page) => page.evaluate(() => window.__tools.read_zombify_state.execute({}));
// Plays out the current round, tapping through any bonus continue and celebration.
async function settle(page, timeout = 90000) {
  const t0 = Date.now();
  await until(async () => (await state(page)).busy || Date.now() - t0 > 4000, 6000).catch(() => {});
  while ((await state(page)).busy) {
    if (Date.now() - t0 > timeout) throw Error('round did not finish');
    await page.evaluate(() => { const c = document.getElementById('feature-continue'); if (c && !c.closest('dialog')?.hidden && c.offsetParent) c.click(); if (window.__tools.continue_zombify_outbreak) try { window.__tools.continue_zombify_outbreak.execute({}); } catch {} });
    await page.waitForTimeout(250);
  }
}
const text = (page, id) => page.$eval(`#${id}`, (e) => e.textContent.trim());

test('a base spin and a Super buy: Engine debits and pays, the game shows the same money', { skip }, async () => {
  const rgs = createRgs({ queue: [books.base, books.super] });
  const page = await open(rgs);
  await until(async () => (await text(page, 'balance')) === '$1,000.00', 20000);
  assert.equal(await text(page, 'bet'), '$1.00', 'Engine default bet level');
  for (const hidden of ['.edition', '#menu-reset', '.shop-previews', '.prototype-note']) assert.equal(await page.$eval(hidden, (e) => getComputedStyle(e).display), 'none', `${hidden} hidden on Stake`);
  // Base spin.
  await page.click('#mobile-controller #play');
  await settle(page);
  const win = (books.base.payoutMultiplier / 100) * 1;
  assert.deepEqual(rgs.calls.filter((c) => c.path === '/wallet/play').map((c) => c.body), [{ sessionID: 'test-session', amount: MONEY, mode: 'base' }]);
  assert.ok(rgs.calls.some((c) => c.path === '/wallet/end-round'), 'a win is settled with end-round');
  assert.equal(rgs.balance, 1000 * MONEY - MONEY + win * MONEY);
  assert.equal(await text(page, 'balance'), `$${(1000 - 1 + win).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  assert.equal(await text(page, 'last-win'), `$${win.toFixed(2)}`);
  // Super buy: 250x.
  await page.click('#mobile-controller #buy'); await page.click('#buy-super'); await page.click('#purchase');
  await settle(page);
  const plays = rgs.calls.filter((c) => c.path === '/wallet/play');
  assert.deepEqual(plays.at(-1).body, { sessionID: 'test-session', amount: MONEY, mode: 'super' });
  const superWin = books.super.payoutMultiplier / 100;
  assert.equal(rgs.balance, (1000 - 1 + win - 250 + superWin) * MONEY);
  assert.equal(await text(page, 'balance'), `$${(1000 - 1 + win - 250 + superWin).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  assert.deepEqual(page.errors, []);
  await page.ctx.close();
});

test('an Outbreak buy and a Mystery buy that reveals Hidden', { skip }, async () => {
  const rgs = createRgs({ balance: 2000 * MONEY, queue: [books.outbreak, books.hidden] });
  const page = await open(rgs);
  await until(async () => (await text(page, 'balance')) === '$2,000.00', 20000);
  for (const [button, mode] of [['#buy-outbreak', 'outbreak'], ['#buy-mystery', 'mystery']]) {
    await page.click('#mobile-controller #buy'); await page.click(button); await page.click('#purchase');
    await settle(page, 150000);
    assert.equal(rgs.calls.filter((c) => c.path === '/wallet/play').at(-1).body.mode, mode);
  }
  const expected = 2000 - 100 - 460 + (books.outbreak.payoutMultiplier + books.hidden.payoutMultiplier) / 100;
  assert.equal(rgs.balance, expected * MONEY);
  assert.equal(await text(page, 'balance'), `$${expected.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  assert.deepEqual(page.errors, []);
  await page.ctx.close();
});

test('a losing spin needs no end-round; too little balance is refused before any request', { skip }, async () => {
  const rgs = createRgs({ balance: 1.5 * MONEY, queue: [books.loss] });
  const page = await open(rgs);
  await until(async () => (await text(page, 'balance')) === '$1.50', 20000);
  await page.click('#mobile-controller #play'); await settle(page);
  assert.equal(rgs.calls.filter((c) => c.path === '/wallet/end-round').length, 0);
  assert.equal(await text(page, 'balance'), '$0.50');
  // Super costs 250.00 and a spin 1.00: the buy is unavailable and a spin is refused in the game.
  const before = rgs.calls.length;
  await page.click('#mobile-controller #buy');
  assert.equal(await page.isDisabled('#buy-super'), true);
  await page.keyboard.press('Escape');
  await page.click('#mobile-controller #play');
  await until(async () => /Insufficient balance/.test(await text(page, 'toast')), 5000);
  assert.equal(rgs.calls.length, before, 'no request reached Engine');
  await page.ctx.close();
});

test('an unfinished Second Life round is replayed and settled after the welcome screen', { skip }, async () => {
  const b = books.secondlife, rgs = createRgs({ balance: 500 * MONEY, round: { betID: 7, amount: 2 * MONEY, payout: 2 * b.payoutMultiplier * 10000, payoutMultiplier: b.payoutMultiplier / 100, active: true, state: b.events, mode: 'secondlife', event: null } });
  const page = await open(rgs);
  await until(async () => rgs.calls.some((c) => c.path === '/wallet/end-round'), 90000);
  await settle(page);
  assert.equal(rgs.calls.filter((c) => c.path === '/wallet/play').length, 0, 'no new bet');
  assert.equal(rgs.balance, 500 * MONEY + 2 * b.payoutMultiplier * 10000);
  assert.equal(await text(page, 'last-win'), `$${((2 * b.payoutMultiplier) / 100).toFixed(2)}`);
  assert.deepEqual(page.errors, []);
  await page.ctx.close();
});

test('a replay link shows the round without touching the wallet', { skip }, async () => {
  const rgs = createRgs();
  const page = await open(rgs, '&replay=true&game=zombify&version=1&mode=super&event=42&amount=1000000');
  await until(async () => /REPLAY COMPLETE/.test(await text(page, 'message')), 90000).catch(async () => { await settle(page); });
  await settle(page);
  assert.match(await text(page, 'message'), /REPLAY COMPLETE/);
  assert.ok(rgs.calls.some((c) => c.path === '/bet/replay/zombify/1/super/42'));
  assert.equal(rgs.calls.filter((c) => c.path.startsWith('/wallet/')).length, 0);
  assert.deepEqual(page.errors, []);
  await page.ctx.close();
});

test('Stake.us words and jurisdiction switches', { skip }, async () => {
  const rgs = createRgs({ jurisdiction: { disabledAutoplay: true, disabledTurbo: true, disabledBuyFeature: true } });
  const page = await open(rgs, '&social=true', { width: 390, height: 844 });
  await until(async () => (await text(page, 'balance')) === '$1,000.00', 20000);
  const words = await page.evaluate(() => document.body.innerText + ' ' + [...document.getElementById('mobile-controller').shadowRoot.querySelectorAll('*')].map((e) => e.textContent).join(' '));
  assert.doesNotMatch(words, /\bBUY\b|\bBET\b/, 'no buying or betting words');
  const hidden = await page.evaluate(() => ({ auto: getComputedStyle(document.getElementById('auto')).display, buy: getComputedStyle(document.getElementById('buy')).display, phoneAuto: document.getElementById('mobile-controller').shadowRoot.getElementById('auto').hidden, phoneTurbo: document.getElementById('mobile-controller').shadowRoot.getElementById('turbo').hidden }));
  assert.deepEqual(hidden, { auto: 'none', buy: 'none', phoneAuto: true, phoneTurbo: true });
  await page.ctx.close();
});
