// ?perf on the standalone game shows the frame-time recorder and reports each
// round. Skips without the `npm run studio:prepare` assets.
//
//   npm run test:studio-browser

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { serve, chromium } from '../../tools/lib/browser.mjs';
import { prepared } from './helpers.mjs';

const skip = prepared ? false : 'needs the Zombify assets: npm run studio:prepare';
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

test('?perf records frame times per round and copies a report', { skip }, async () => {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${srv.url}games/zombify/runtime/index.html?perf`);
  await page.waitForFunction(() => window.ZombifyStudioRuntime?.loading().status === 'ready', null, { timeout: 120000 });
  await page.waitForSelector('#guide-play:not([disabled])', { state: 'visible', timeout: 60000 });
  await page.click('#guide-play');
  await page.waitForFunction(() => !document.getElementById('welcome').open);
  await page.evaluate(() => window.ZombifyStudioRuntime.start('single'));
  await page.waitForFunction(() => /1 rounds · last round p95/.test(document.getElementById('perf-probe')?.textContent), null, { timeout: 10000 });
  await page.click('#perf-probe button:has-text("Copy report")');
  const report = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()));
  assert.equal(report.rounds.length, 1);
  assert.equal(report.rounds[0].mode, 'single');
  assert.ok(report.rounds[0].frames > 30, `${report.rounds[0].frames} frames`);
  assert.ok(report.device.refreshMs > 5 && report.device.refreshMs < 40);
  assert.equal(typeof report.rounds[0].longTasks, 'number');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('without ?perf there is no recorder', { skip }, async () => {
  const page = await browser.newPage();
  await page.goto(`${srv.url}games/zombify/runtime/index.html`);
  await page.waitForFunction(() => window.ZombifyStudioRuntime?.loading().status === 'ready', null, { timeout: 120000 });
  assert.equal(await page.$('#perf-probe'), null);
  assert.equal(await page.evaluate(() => 'ZombifyPerfProbe' in window), false);
  await page.close();
});
