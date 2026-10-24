// Browser tests for the studio editor and its runtime bridge. They run the
// real studio/index.html, studio/editor.js and studio/bridge.js in Chromium.
// The game iframe is served by tests/browser/fake-runtime.html, a stand-in
// with the same ZombifyStudioRuntime contract as runtime/app.js (the real
// runtime needs `npm run studio:prepare` assets; zombify.e2e.mjs drives it).
// One test also loads the real runtime page as checked out.
//
//   npm run test:studio-browser

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { serve, chromium, ROOT } from '../../tools/lib/browser.mjs';
import { AGENT_TOOLS, runtime, project, agentEdit, isBusy, whenReady, until } from './helpers.mjs';

let srv;
let browser;
const FAKE = await readFile(join(ROOT, 'tests/browser/fake-runtime.html'), 'utf8');
// 1×1 transparent PNG, used for uploads.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

before(async () => {
  srv = await serve();
  browser = await chromium();
});
after(async () => {
  await browser?.close();
  srv?.close();
});

async function openStudio({ fake = {}, viewport = { width: 1440, height: 900 }, context, runtimeHTML } = {}) {
  const ctx = context ?? (await browser.newContext({ viewport }));
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.addInitScript(AGENT_TOOLS);
  // runtimeHTML: undefined → stand-in; null → the real checked-out runtime.
  if (runtimeHTML !== null) {
    const body = (runtimeHTML ?? FAKE).replace('<script>', `<script>window.__fakeInit=${JSON.stringify(fake)};</script><script>`);
    await page.route('**/games/zombify/runtime/index.html', (route) => route.fulfill({ body, contentType: 'text/html' }));
  }
  await page.goto(`${srv.url}studio/index.html`);
  page.ctx = ctx;
  return page;
}
const fakeLog = async (page) => (await runtime(page).evaluate(() => window.__fake.log)).join(' ');

test('editing stays locked from Test spin until the round ends, even while the game decodes audio', async () => {
  const page = await openStudio({ fake: { prepareMs: 2200, roundMs: 900 } });
  await whenReady(page);
  await page.click('#spin');
  let samples = 0, late = false;
  for (;;) {
    // Editor first, game last: the game ends before the editor unlocks, so an
    // unlock seen while the round still runs is a real failure, not a race
    // with the round's last frame.
    const busy = await isBusy(page);
    const accepted = await agentEdit(page, [{ type: 'grid', values: { symbolScale: 1.2 } }]).then(() => true, (e) => { assert.match(e.message, /Finish the current round/); return false; });
    if ((await fakeLog(page)).includes('end:base')) { late = accepted; break; }
    assert.equal(busy, true, `editor unlocked mid-round (${await fakeLog(page)})`);
    assert.equal(accepted, false, 'an edit was accepted mid-round');
    samples++;
    await new Promise((r) => setTimeout(r, 60));
  }
  assert.ok(samples >= 5, `only ${samples} samples taken during the round`);
  await until(async () => !(await isBusy(page)));
  assert.equal((await project(page)).project.grid.symbolScale, late ? 1.2 : 1.08);
  await page.ctx.close();
});

test('a round started from the game itself locks the editor, and no edit reaches the game mid-round', async () => {
  const page = await openStudio({ fake: { roundMs: 1500 } });
  await whenReady(page);
  const before = (await project(page)).project.scenes.desktop.layers[0].x;
  // Start from inside the game (its own Spin button) without waiting for the
  // round, then edit the moment it is running, before any poll notices.
  await runtime(page).evaluate(() => { window.ZombifyStudioRuntime.start('base'); });
  await until(() => runtime(page).evaluate(() => window.__fake.busy), 2000);
  await agentEdit(page, [{ type: 'layer', scene: 'desktop', id: 'reels', values: { x: before + 40 } }]).catch(() => {});
  await until(() => isBusy(page), 1000);
  await until(async () => (await fakeLog(page)).includes('end:base'), 5000);
  await until(async () => !(await isBusy(page)));
  // Whatever the editor ended up with, the game must show the same layout.
  const editorX = (await project(page)).project.scenes.desktop.layers[0].x;
  await until(async () => (await runtime(page).evaluate(() => getComputedStyle(document.querySelector('.machine')).left)) === `${editorX}px`, 3000);
  await page.ctx.close();
});

test('Outbreak continuation keeps the round locked until Continue, then finishes cleanly', async () => {
  const page = await openStudio({ fake: { awaitBonus: true, roundMs: 300 } });
  await whenReady(page);
  await page.selectOption('#preview-mode', 'outbreak');
  await page.click('#spin');
  await page.waitForSelector('#continue:not([hidden])', { timeout: 5000 });
  assert.equal(await isBusy(page), true);
  assert.equal(await page.isDisabled('#undo'), true);
  await page.click('#continue');
  await until(async () => (await fakeLog(page)).includes('end:outbreak'));
  await until(async () => !(await isBusy(page)));
  assert.equal(await page.isHidden('#continue'), true);
  assert.match(await fakeLog(page), /start:outbreak continued end:outbreak/);
  await page.ctx.close();
});

test('a game preview that stops answering mid-spin can be recovered', async () => {
  const page = await openStudio({ fake: { prepareMs: 60000 } });
  await whenReady(page);
  await page.click('#spin');
  // The iframe goes away (crash, navigation): nothing will ever answer.
  await page.evaluate(() => { document.getElementById('runtime').src = 'about:blank'; });
  await page.waitForSelector('#runtime-problem:not([hidden])', { timeout: 15000 });
  assert.equal(await isBusy(page), false);
  await page.ctx.close();
});

test('a layout-test spin, then 6×5 again, gives Zombify back an untouched grid board', async () => {
  const page = await openStudio();
  await whenReady(page);
  await page.click('[data-select="reels"]');
  await page.click('[data-grid="5,4"]');
  await page.click('#spin');
  await until(async () => !(await isBusy(page)));
  await page.click('[data-grid="6,5"]');
  const board = await runtime(page).evaluate(() => {
    const b = document.getElementById('board');
    return { display: getComputedStyle(b).display, inline: b.style.display, tiles: b.querySelectorAll(':scope > .tile').length };
  });
  assert.deepEqual(board, { display: 'grid', inline: '', tiles: 30 });
  await page.ctx.close();
});

test('the checked-out runtime without prepared assets explains what is missing', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  // Answer the files `studio:prepare` provides with 404, as on a fresh checkout.
  const prepared = new Set(JSON.parse(await readFile(join(ROOT, 'games/zombify/import-manifest.json'), 'utf8')).files.map((f) => f.path));
  await ctx.route('**/games/zombify/runtime/**', (route) => {
    const path = decodeURIComponent(new URL(route.request().url()).pathname).split('/games/zombify/runtime/')[1];
    return prepared.has(path) ? route.fulfill({ status: 404, body: '' }) : route.continue();
  });
  const page = await openStudio({ runtimeHTML: null, context: ctx });
  await page.waitForFunction(() => /game code didn.t load in this checkout.*studio:prepare/.test(document.getElementById('runtime-problem')?.textContent ?? ''), null, { timeout: 20000 });
  assert.equal(await page.isDisabled('#spin'), true);
  await page.ctx.close();
});

test('an edit closed within the autosave delay is still saved', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  let page = await openStudio({ context: ctx });
  await whenReady(page);
  await agentEdit(page, [{ type: 'grid', values: { symbolScale: 1.25 } }]);
  await page.close({ runBeforeUnload: true });
  page = await openStudio({ context: ctx });
  await whenReady(page);
  assert.equal((await project(page)).project.grid.symbolScale, 1.25);
  await ctx.close();
});

test('upload, save, reload, export and import keep the uploaded image', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  let page = await openStudio({ context: ctx });
  await whenReady(page);
  await page.click('[data-tab="assets"]');
  const chooser = page.waitForEvent('filechooser');
  await page.click('#upload');
  await (await chooser).setFiles({ name: 'goo.png', mimeType: 'image/png', buffer: PNG });
  await page.waitForSelector('.asset-card:has-text("goo.png")');
  await page.waitForFunction(() => document.getElementById('save-status').textContent === 'Saved in this browser');
  await page.reload();
  await whenReady(page);
  const saved = (await project(page)).project;
  const upload = saved.assets.find((a) => a.name === 'goo.png');
  assert.ok(upload, 'upload survives reload');
  const download = page.waitForEvent('download');
  await page.click('#export');
  const file = await (await download).path();
  const exported = JSON.parse(await readFile(file, 'utf8'));
  assert.match(exported.assets.find((a) => a.id === upload.id).src, /^data:image\/png;base64,/);
  const fresh = await openStudio();
  await whenReady(fresh);
  const importer = fresh.waitForEvent('filechooser');
  await fresh.click('#import');
  await (await importer).setFiles(file);
  await until(async () => (await project(fresh)).project.assets.some((a) => a.id === upload.id));
  await fresh.ctx.close();
  await ctx.close();
});

test('undo and redo walk the history and the game follows', async () => {
  const page = await openStudio();
  await whenReady(page);
  await agentEdit(page, [{ type: 'grid', values: { columns: 7, rows: 7 } }]);
  await agentEdit(page, [{ type: 'background', scene: 'desktop', values: { blur: 4 } }]);
  const tiles = () => runtime(page).evaluate(() => document.querySelectorAll('#game .studio-preview-board .studio-preview-tile, #game .studio-preview-board .tile').length);
  await page.click('#undo');
  await page.click('#undo');
  assert.equal((await project(page)).project.grid.columns, 6);
  await until(async () => (await runtime(page).evaluate(() => getComputedStyle(document.getElementById('board')).display)) === 'grid');
  await page.click('#redo');
  assert.equal((await project(page)).project.grid.columns, 7);
  await until(async () => (await tiles()) >= 49);
  assert.deepEqual(page.errors, []);
  await page.ctx.close();
});

test('Send backward puts an image layer behind the reels in the game', async () => {
  const page = await openStudio();
  await whenReady(page);
  const reels = (await project(page)).project.scenes.desktop.layers.find((l) => l.id === 'reels');
  const layer = { id: 'image-over', name: 'Overlay', kind: 'image', x: reels.x + 40, y: reels.y + 40, w: 120, h: 120, visible: true, locked: false, opacity: 1, assetId: 'mascot' };
  await agentEdit(page, [{ type: 'addLayer', scene: 'desktop', layer }]);
  const topAt = () => runtime(page).evaluate(([x, y]) => {
    // Image layers ignore the pointer; make them hit-testable just for this probe.
    for (const img of document.querySelectorAll('.studio-extra')) img.style.pointerEvents = 'auto';
    const el = document.elementsFromPoint(x, y).find((e) => e.classList.contains('studio-extra') || e.closest?.('.machine'));
    return el?.classList.contains('studio-extra') ? 'image' : 'reels';
  }, [reels.x + 100, reels.y + 100]);
  await until(async () => (await topAt()) === 'image', 3000);
  await agentEdit(page, [{ type: 'reorder', scene: 'desktop', id: 'image-over', index: 0 }]);
  await until(async () => (await topAt()) === 'reels', 3000);
  await page.ctx.close();
});

test('uploaded image bytes never cross into the game iframe', async () => {
  const page = await openStudio();
  await whenReady(page);
  await runtime(page).evaluate(() => { window.__sizes = []; addEventListener('message', (e) => window.__sizes.push(JSON.stringify(e.data).length)); });
  await page.click('[data-tab="assets"]');
  const chooser = page.waitForEvent('filechooser');
  await page.click('#upload');
  const big = Buffer.concat([PNG, Buffer.alloc(3 * 1024 * 1024)]); // valid PNG followed by padding
  await (await chooser).setFiles({ name: 'big.png', mimeType: 'image/png', buffer: big });
  await page.waitForSelector('.asset-card:has-text("big.png")');
  const id = (await project(page)).project.assets.find((a) => a.name === 'big.png').id;
  await agentEdit(page, [{ type: 'symbol', id: 'wild', assetId: id }]);
  for (let i = 0; i < 10; i++) await agentEdit(page, [{ type: 'layer', scene: 'desktop', id: 'reels', values: { x: 300 + i } }]);
  await until(async () => (await runtime(page).evaluate(() => document.getElementById('studio-presentation').textContent)).includes('blob:'), 3000);
  const largest = await runtime(page).evaluate(() => Math.max(...window.__sizes));
  assert.ok(largest < 200000, `largest message into the game was ${largest} bytes`);
  const card = await page.getAttribute('.asset-card:has-text("big.png") img', 'src');
  assert.match(card, /^blob:/);
  await page.ctx.close();
});

test('importing a file that is not a project explains the problem', async () => {
  const page = await openStudio();
  await whenReady(page);
  const importer = page.waitForEvent('filechooser');
  await page.click('#import');
  await (await importer).setFiles({ name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('not json at all') });
  await page.waitForFunction(() => /isn’t a Studio project/.test(document.getElementById('toast').textContent));
  assert.equal((await project(page)).project.name, 'Zombify');
  await page.ctx.close();
});
