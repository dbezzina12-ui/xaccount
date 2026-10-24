// Browser regressions for the Screens tab (Studio pass 1) on the real Zombify
// runtime. Skips until studio/screens.js is in this checkout (pass 1 lives in
// the Sites source until it is reconciled), or without studio:prepare assets.
//
//   npm run test:studio-browser

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { serve, chromium, ROOT } from '../../tools/lib/browser.mjs';
import { AGENT_TOOLS, runtime, project, isBusy, whenReady, until, prepared } from './helpers.mjs';

const skip = !existsSync(join(ROOT, 'studio/screens.js')) ? 'Screens tab not in this checkout' : !prepared ? 'needs the Zombify assets: npm run studio:prepare' : false;
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

async function openStudio(ctx) {
  ctx ??= await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.addInitScript(AGENT_TOOLS);
  await page.goto(`${srv.url}studio/index.html`);
  await whenReady(page, 60000);
  page.ctx = ctx;
  // Every toast, so a brief one isn't missed.
  page.toasts = [];
  await page.exposeFunction('__toast', (t) => page.toasts.push(t));
  await page.evaluate(() => new MutationObserver(() => { const t = document.getElementById('toast'); if (!t.hidden) window.__toast(t.textContent); }).observe(document.getElementById('toast'), { subtree: true, childList: true, characterData: true, attributes: true }));
  return page;
}
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const holdPreview = async (page, screen) => {
  await page.click('[data-tab="screens"]');
  await page.selectOption('#screen-kind', screen);
  await page.waitForFunction(() => /^Held/.test(document.getElementById('screen-status').textContent), null, { timeout: 15000 });
};
const setLabel = async (page, screen, text) => {
  await page.selectOption('#screen-kind', screen);
  await page.selectOption('#screen-part', 'heading');
  await page.fill('[data-screen-style="text"]', text);
  await page.locator('[data-screen-style="text"]').blur();
};
// Plays a seeded preview at Turbo with Skip and returns every bonus heading shown.
async function headings(page, mode) {
  await runtime(page).evaluate(() => {
    window.__headings = [];
    const f = document.getElementById('feature'), h = document.getElementById('feature-heading');
    new MutationObserver(() => { if (!f.open) return; const v = `${f.dataset.view}:${h.textContent}`; if (window.__headings.at(-1) !== v) window.__headings.push(v); }).observe(f, { subtree: true, childList: true, characterData: true, attributes: true });
  });
  await page.selectOption('#preview-mode', mode);
  await page.selectOption('#speed', 'turbo');
  await page.click('#spin');
  await until(() => isBusy(page), 5000);
  while (await isBusy(page)) {
    if (await page.isVisible('#continue')) await page.click('#continue', { timeout: 500 }).catch(() => {});
    else if (!(await page.isDisabled('#spin'))) await page.click('#spin', { timeout: 300 }).catch(() => {});
    await pause(150);
  }
  // Which headings each view showed; the dialog may reopen on the last round's view first.
  return [...new Set(await runtime(page).evaluate(() => window.__headings.filter((v) => /^(intro|result):/.test(v))))].sort();
}

test('switching editor tabs during a round shows no error', { skip }, async () => {
  const page = await openStudio();
  await page.selectOption('#preview-mode', 'single');
  await page.click('#spin');
  await until(() => isBusy(page), 5000);
  for (const tab of ['screens', 'assets', 'sounds', 'layers']) await page.click(`[data-tab="${tab}"]`);
  await until(async () => !(await isBusy(page)), 30000);
  assert.deepEqual(page.toasts.filter((t) => /preview/i.test(t)), []);
  assert.deepEqual(page.errors, []);
  await page.ctx.close();
});

test('Play closes a held preview, so the game\'s own Spin plays', { skip }, async () => {
  const page = await openStudio();
  await holdPreview(page, 'bonus');
  await page.click('#play');
  await until(async () => (await runtime(page).evaluate(() => document.querySelectorAll('iframe[data-screen-preview]').length)) === 0, 3000);
  await runtime(page).click('#spin');
  await until(() => runtime(page).evaluate(() => window.ZombifyStudioRuntime.status().busy), 5000);
  await until(async () => !(await isBusy(page)), 30000);
  assert.deepEqual(page.errors, []);
  await page.ctx.close();
});

test('bonus intro and result label wording applies in the live game and Reset restores the game\'s own', { skip }, async () => {
  const page = await openStudio();
  await page.click('[data-tab="screens"]');
  await setLabel(page, 'bonus', 'INFECTION!');
  await setLabel(page, 'result', 'ALL CLEAR');
  await page.click('[data-tab="layers"]');
  assert.deepEqual(await headings(page, 'preview_super'), ['intro:INFECTION!', 'result:ALL CLEAR']);
  await page.click('[data-tab="screens"]');
  for (const screen of ['bonus', 'result']) {
    await page.selectOption('#screen-kind', screen);
    await page.selectOption('#screen-part', 'heading');
    await page.click('#screen-reset');
  }
  await page.click('[data-tab="layers"]');
  assert.deepEqual(await headings(page, 'preview_super'), ['intro:SUPER OUTBREAK', 'result:SUPER OUTBREAK']);
  assert.deepEqual(page.errors, []);
  await page.ctx.close();
});

test('label wording typed and the tab closed without leaving the field is kept', { skip }, async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  let page = await openStudio(ctx);
  await page.click('[data-tab="screens"]');
  await page.selectOption('#screen-kind', 'bonus');
  await page.selectOption('#screen-part', 'heading');
  await page.click('[data-screen-style="text"]');
  await page.keyboard.type('CLOSE TEST');
  await page.close({ runBeforeUnload: true });
  page = await openStudio(ctx);
  assert.equal((await project(page)).project.scenes.desktop.screens?.bonus?.heading?.text, 'CLOSE TEST');
  await ctx.close();
});
