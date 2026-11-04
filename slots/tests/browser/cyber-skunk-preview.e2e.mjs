// Free previews through the real shop buttons, desktop and phone: every choice
// draws a shipping outcome with ordinary catalog tickets (never a fixed seed),
// a known ticket shows exactly its catalog row, and completing, stopping or
// reloading a preview leaves credits, bet, previous win, history and the saved
// session exactly as they were. Then a charged round settles normally.
//
//   node --test tests/browser/cyber-skunk-preview.e2e.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { serve, chromium } from '../../tools/lib/browser.mjs';

const GAME = 'games/cyber-skunk/runtime/index.html', KEY = 'cyber-skunk-session-v1';
let srv, browser;
before(async () => { srv = await serve(); browser = await chromium(); });
after(async () => { await browser?.close(); srv?.close(); });

const control = (p, a) => p.locator(`[data-action=${a}]`).first();
const state = (p) => p.evaluate(() => window.cyberSkunk.state);
const saved = (p) => p.evaluate((k) => localStorage.getItem(k), KEY);

// Counts catalog draws (two-word crypto requests) and can feed chosen tickets.
async function open(width, height) {
  const p = await browser.newPage({ viewport: { width, height }, isMobile: width < height, hasTouch: width < height });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await p.addInitScript(([k, v]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(k, v); sessionStorage.setItem('seeded', '1'); } },
    [KEY, JSON.stringify({ balance: 1_000_000, bet: 200, speed: 'turbo', muted: true, history: [] })]);
  await p.addInitScript(() => {
    window.draws = 0; window.feed = [];
    const real = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = (a) => {
      if (!(a instanceof Uint32Array && a.length === 2)) return real(a);
      window.draws++;
      if (!window.feed.length) return real(a);
      const { ticket, total } = window.feed.shift(), n = Math.floor(((ticket + 0.5) / total) * 2 ** 53);
      a[0] = Math.floor(n / 2 ** 21); a[1] = (n % 2 ** 21) * 2 ** 11; return a;
    };
    // The largest win the preview shows (state.win carries the round's running total).
    window.peak = 0; setInterval(() => { const w = window.cyberSkunk?.state.win; if (w > window.peak) window.peak = w; }, 10);
  });
  await p.goto(srv.url + GAME);
  await p.waitForFunction(() => window.cyberSkunk?.state.ready);
  if (await p.locator('#intro').isVisible()) await p.locator('#intro-go').click();
  return { p, errors };
}
// Plays out whatever is on screen: Start on a bonus panel, dismiss a held win,
// and with stop=true presses Stop as well. Returns when the round is over.
async function playOut(p, stop) {
  for (let k = 0; k < 2400 && (await state(p)).busy; k++) {
    await p.evaluate((stop) => {
      if (!document.getElementById('bonus-panel').hidden) document.getElementById('bonus-panel-go')?.click();
      else if (!document.getElementById('bigwin').hidden) document.getElementById('win-dismiss').click();
      else if (stop) document.getElementById('controller').shadowRoot.querySelector('[data-action=play]')?.click();
    }, stop);
    await p.waitForTimeout(50);
  }
  await p.waitForFunction(() => !window.cyberSkunk.state.busy, null, { timeout: 60000 });
}
async function startPreview(p, choice) {
  if (!(await p.locator('#buy-menu').isVisible())) await control(p, 'buy').click();
  await p.locator('[data-view=preview]').click();
  await p.evaluate(() => { window.draws = 0; window.peak = 0; });
  await p.locator(`[data-preview=${choice}]`).click();
  await p.waitForFunction(() => window.cyberSkunk.state.busy);
}
const snapshot = async (p) => { const s = await state(p); return { balance: s.balance, bet: s.bet, win: s.win, pending: s.pending, saved: await saved(p) }; };

for (const [label, width, height] of [['desktop', 1366, 768], ['phone', 390, 844]]) {
  test(`${label}: free previews are shipping draws and leave the session untouched`, async () => {
    const { p, errors } = await open(width, height);
    try {
      // A real paid round first, so there is a history and a previous win to keep.
      const ticket = await p.evaluate(async () => {
        const { default: d } = await import('./catalog-data.js');
        const rows = d.pools['spin-base'], i = rows.findIndex((r) => r[1] > 0 && r[2] >= 200);
        return rows.slice(0, i).reduce((n, r) => n + r[1], 0);
      });
      await p.evaluate((t) => window.feed.push({ ticket: 0, total: 1e9 }, { ticket: t, total: 1e9 }), ticket);
      await control(p, 'play').click();
      await playOut(p, false);
      const before = await snapshot(p);
      assert.ok(before.win > 0, 'the paid round left a previous win');
      assert.equal(JSON.parse(before.saved).history.length, 1);

      // Each choice, played out and stopped.
      for (const [choice, how] of [['sprayjob', 'complete'], ['regular', 'stop'], ['super', 'complete'], ['hidden', 'stop'], ['sprayjob', 'stop'], ['regular', 'complete']]) {
        await startPreview(p, choice);
        await playOut(p, how === 'stop');
        const drawn = await p.evaluate(() => window.draws);
        assert.ok(drawn >= 1, `${choice} drew ${drawn} catalog tickets`);
        const after = await snapshot(p);
        assert.deepEqual(after, before, `${choice} (${how}) changed the session`);
        assert.ok(await p.locator('#buy-menu').isVisible(), 'the shop reopens after a preview');
      }

      // A known ticket shows exactly its catalog row: the first Blackout row.
      const row = await p.evaluate(async () => { const { default: d } = await import('./catalog-data.js'); return d.pools['bonus-hidden'][0]; });
      await p.evaluate(() => window.feed.push({ ticket: 0, total: 1e9 }));
      await startPreview(p, 'hidden');
      await playOut(p, false);
      const bet = (await state(p)).bet;
      assert.equal(await p.evaluate(() => window.peak), Math.round((bet * row[2]) / 100), 'the Blackout preview shows its catalog total');
      assert.ok(row[2] >= 100000, 'Blackout rows pay 1,000x or more');
      assert.deepEqual(await snapshot(p), before);

      // Unsteered Blackout previews never show less than 1,000x the bet.
      for (let k = 0; k < 2; k++) {
        await startPreview(p, 'hidden');
        await playOut(p, true);
        assert.ok(await p.evaluate(() => window.peak) >= 1000 * bet, 'a Blackout preview below 1,000x');
      }

      // Leaving mid-preview: a reload restores exactly the saved session. (A reload
      // always shows the previous win as $0.00: it is never saved, preview or not.)
      for (const choice of ['sprayjob', 'regular', 'super', 'hidden']) {
        await startPreview(p, choice);
        await p.waitForTimeout(400);
        await p.reload();
        await p.waitForFunction(() => window.cyberSkunk?.state.ready);
        if (await p.locator('#intro').isVisible()) await p.locator('#intro-go').click();
        const after = await snapshot(p);
        assert.deepEqual({ ...after, win: before.win }, before, `${choice}: reload mid-preview changed the session`);
        assert.equal(after.win, 0);
      }

      // Then a real charged round settles from the same session.
      await p.locator('#buy-menu').evaluate((d) => d.close());
      const s0 = await state(p);
      await control(p, 'play').click();
      await playOut(p, true);
      const hist = JSON.parse(await saved(p)).history, s1 = await state(p);
      assert.equal(hist.length, 2);
      assert.equal(s1.balance, s0.balance - hist[0].cost + hist[0].win, 'the charged round settles exactly');
      assert.equal(hist[0].cost, s0.bet);
      assert.deepEqual(errors, []);
    } finally { await p.close(); }
  });
}
