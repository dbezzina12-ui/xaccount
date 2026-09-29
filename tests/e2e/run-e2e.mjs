/**
 * End-to-end test: loads the built extension (dist/) into Chromium, serves
 * tests/e2e/mock-x/index.html in place of x.com, and drives the dashboard:
 * import → auto schedule → attach media → dry run → real run → verify →
 * safety scenarios (broken schedule UI, missing controls, account mismatch).
 *
 * Usage: npm run test:e2e   (set CHROME_PATH to use a specific Chromium)
 */
import { chromium } from 'playwright-core';
import { readFileSync, mkdtempSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';

const ROOT = resolve(import.meta.dirname, '../..');
const DIST = join(ROOT, 'dist');
const MOCK = readFileSync(join(ROOT, 'tests/e2e/mock-x/index.html'), 'utf8');
const OUT = join(ROOT, 'test-results');
mkdirSync(OUT, { recursive: true });
const executablePath = process.env.CHROME_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

const log = (...a) => console.log('•', ...a);
let failures = 0;
async function step(name, fn) {
  const t = Date.now();
  try {
    await fn();
    console.log(`✔ ${name} (${((Date.now() - t) / 1000).toFixed(1)}s)`);
  } catch (e) {
    failures++;
    console.error(`✘ ${name}\n  ${e.stack || e}`);
    await dash?.screenshot({ path: join(OUT, `fail-${name.replace(/\W+/g, '_')}.png`) }).catch(() => {});
    throw e;
  }
}

const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'xbs-e2e-')), {
  executablePath,
  headless: true,
  viewport: { width: 1440, height: 900 },
  env: { ...process.env, TZ: 'Europe/Malta' },
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});
await ctx.route(/^https:\/\/(x|twitter)\.com\//, (route) => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: MOCK }));

let [sw] = ctx.serviceWorkers();
if (!sw) sw = await ctx.waitForEvent('serviceworker');
const extId = new URL(sw.url()).host;
log('extension id', extId);

const dash = await ctx.newPage();
dash.on('pageerror', (e) => console.error('dashboard error:', e.message));
await dash.goto(`chrome-extension://${extId}/dashboard.html`);
await dash.getByText('X Bulk Scheduler').first().waitFor();

async function mock(fn, arg) {
  const p = await ctx.newPage();
  await p.goto('https://x.com/home');
  const r = await p.evaluate(fn, arg);
  await p.close();
  return r;
}
const readMock = (key) => mock((k) => JSON.parse(localStorage.getItem(k) || '[]'), key);
const setMode = (m) => mock((m) => localStorage.setItem('mock.mode', m), m);
// Batches are persisted with a 250 ms debounce.
const getBatch = async () => {
  await dash.waitForTimeout(450);
  return dash.evaluate(async () => (await chrome.storage.local.get('xbs.batches'))['xbs.batches'][0]);
};
const confirmBtn = (re) => dash.locator('.modal-foot button', { hasText: re });
const waitText = (re, timeout = 120_000) => dash.getByText(re).first().waitFor({ timeout });

try {
  await step('import 3 posts (plain text)', async () => {
    await dash.getByRole('button', { name: 'Import Posts' }).click();
    await dash.locator('textarea.import-text').fill('First post of the week 🚀\nWith a second line.\n\nWhich bonus would you pick? #poll\n\nThird post, text only. https://example.com/page');
    await confirmBtn(/^Import 3 posts$/).click();
    await dash.locator('.post-table tbody tr').nth(2).waitFor();
  });

  await step('auto schedule', async () => {
    await dash.getByRole('button', { name: 'Auto Schedule' }).click();
    await confirmBtn(/Apply to 3 posts/).click();
    const b = await getBatch();
    assert.equal(b.posts.filter((p) => p.date && p.time && p.status === 'ready').length, 3);
  });

  await step('attach image to post 1 and video to post 2', async () => {
    const png = readFileSync(join(ROOT, 'public/icons/icon128.png'));
    await dash.locator('.post-table .col-text').nth(0).click();
    await dash.locator('.modal input[type=file]').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: png });
    await dash.locator('.modal .media-item').waitFor();
    await confirmBtn(/^Save$/).click();

    const video = Buffer.alloc(9 * 1024 * 1024, 7); // 9 MB → 3 transfer chunks
    await dash.locator('.post-table .col-text').nth(1).click();
    await dash.locator('.modal input[type=file]').setInputFiles({ name: 'clip.mp4', mimeType: 'video/mp4', buffer: video });
    await dash.locator('.modal .media-item').waitFor({ timeout: 15_000 });
    await confirmBtn(/^Save$/).click();
    const b = await getBatch();
    assert.equal(b.posts[0].media[0].name, 'photo.png');
    assert.equal(b.posts[1].media[0].name, 'clip.mp4');
  });

  await step('dry run: everything verified, nothing scheduled or published', async () => {
    await dash.getByLabel('Dry run').check();
    await dash.getByText('DRY RUN MODE').waitFor();
    await dash.getByRole('button', { name: 'Dry Run All' }).click();
    await confirmBtn(/Start dry run/).click();
    await waitText(/Dry run finished: 3\/3 posts passed/);
    assert.deepEqual(await readMock('mock.scheduled'), []);
    assert.deepEqual(await readMock('mock.published'), []);
    assert.deepEqual(await readMock('mock.drafts'), [], 'dry run must discard drafts, not save them');
    const b = await getBatch();
    assert.ok(b.posts.every((p) => p.status === 'ready' && p.dryRun?.ok));
  });

  await step('schedule all: 3/3 scheduled with correct times and media', async () => {
    await dash.getByLabel('Dry run').uncheck();
    await dash.getByRole('button', { name: 'Schedule All' }).click();
    await confirmBtn(/Schedule 3 post/).click();
    await waitText('3/3 posts successfully scheduled.');
    const scheduled = await readMock('mock.scheduled');
    const published = await readMock('mock.published');
    assert.equal(published.length, 0, 'nothing may be published immediately');
    assert.equal(scheduled.length, 3);
    const b = await getBatch();
    b.posts.forEach((p, i) => {
      const s = scheduled[i];
      const [y, m, d] = p.date.split('-').map(Number);
      const [h, min] = p.time.split(':').map(Number);
      assert.deepEqual(s.when, { y, m, d, h, min }, `post ${i + 1} time`);
      assert.equal(s.text.replace(/\s+/g, ' ').trim(), p.text.replace(/\s+/g, ' ').trim(), `post ${i + 1} text`);
      assert.equal(p.status, 'scheduled');
    });
    assert.deepEqual(scheduled[0].media, ['photo.png']);
    assert.deepEqual(scheduled[1].media, ['clip.mp4']);
    assert.equal(b.accountHandle, 'mockuser', 'batch auto-linked to detected account');
  });

  await step('verify in X finds all 3', async () => {
    await dash.getByRole('button', { name: 'Verify in X' }).click();
    await waitText(/found 3\/3/);
  });

  await step('SAFETY: submit label stays "Post" → fails, never clicks', async () => {
    await setMode('brokenSchedule');
    await dash.getByRole('button', { name: '+ Add Post' }).click();
    await dash.locator('.modal textarea').fill('Safety check post');
    const b = await getBatch();
    await dash.locator('.modal input[type=date]').fill(b.posts[2].date);
    await dash.locator('.modal input[type=time]').fill('21:59');
    await confirmBtn(/^Save$/).click();
    await dash.getByRole('button', { name: 'Schedule All' }).click();
    await confirmBtn(/Schedule 1 post/).click();
    await waitText(/0\/1 posts scheduled — 1 failed/);
    assert.equal((await readMock('mock.published')).length, 0, 'must never publish');
    assert.equal((await readMock('mock.scheduled')).length, 3);
    const p = (await getBatch()).posts[3];
    assert.equal(p.status, 'failed');
    assert.match(p.error, /Refusing/);
    assert.ok(!p.uncertain);
    log('error shown:', p.error);
  });

  await step('SAFETY: missing Schedule button → clear error', async () => {
    await setMode('noScheduleButton');
    await dash.getByRole('button', { name: 'Retry', exact: true }).click();
    await confirmBtn(/Schedule 1 post/).click();
    await dash.locator('.post-table').getByText('Could not locate Schedule button.').waitFor({ timeout: 120_000 });
    await waitText(/0\/1 posts scheduled — 1 failed/);
    const p = (await getBatch()).posts[3];
    assert.equal(p.error, 'Could not locate Schedule button.');
    assert.equal((await readMock('mock.published')).length, 0);
  });

  await step('retry failed with insertText fallback (editor ignores paste)', async () => {
    await setMode('nopaste');
    await dash.getByRole('button', { name: /Retry 1 failed/ }).click();
    await confirmBtn(/Schedule 1 post/).click();
    await waitText('1/1 posts successfully scheduled.');
    assert.equal((await readMock('mock.scheduled')).length, 4);
    assert.equal((await readMock('mock.published')).length, 0);
  });

  await step('account mismatch warning', async () => {
    await setMode('normal');
    await dash.getByRole('button', { name: 'Batch settings' }).click();
    await dash.locator('.modal input').nth(1).fill('@SomeoneElse');
    await confirmBtn(/^Save$/).click();
    await dash.getByRole('button', { name: '+ Add Post' }).click();
    await dash.locator('.modal textarea').fill('Mismatch post');
    const b = await getBatch();
    await dash.locator('.modal input[type=date]').fill(b.posts[2].date);
    await dash.locator('.modal input[type=time]').fill('08:00');
    await confirmBtn(/^Save$/).click();
    await dash.getByRole('button', { name: 'Schedule All' }).click();
    await confirmBtn(/Schedule 1 post/).click();
    await dash.getByText('This batch was created for').last().waitFor();
    const txt = await dash.locator('.modal').innerText();
    assert.match(txt, /This batch was created for @SomeoneElse but you are currently logged into @mockuser/);
    await confirmBtn(/^Cancel$/).click();
    assert.equal((await readMock('mock.scheduled')).length, 4);
  });

  await step('stop finishes the current post and starts no more', async () => {
    await dash.getByRole('button', { name: 'New batch' }).click();
    await dash.locator('.modal input').first().fill('Stop test');
    await confirmBtn(/Create batch/).click();
    await dash.getByRole('button', { name: 'Import Posts' }).click();
    await dash.locator('textarea.import-text').fill('Stop A\n\nStop B\n\nStop C');
    await confirmBtn(/^Import 3 posts$/).click();
    await dash.getByRole('button', { name: 'Auto Schedule' }).click();
    await confirmBtn(/Apply to 3 posts/).click();
    await dash.getByRole('button', { name: 'Schedule All' }).click();
    await confirmBtn(/Schedule 3 post/).click();
    await dash.getByText(/Post 1: scheduling for/).first().waitFor({ timeout: 60_000 });
    await dash.getByRole('button', { name: 'Stop' }).click();
    await waitText(/1\/3 posts scheduled \(stopped early\)/);
    const texts = (await readMock('mock.scheduled')).map((s) => s.text);
    assert.equal(texts.filter((t) => t.startsWith('Stop')).length, 1);
  });

  await dash.screenshot({ path: join(OUT, 'dashboard.png') });
} finally {
  await ctx.close();
}
console.log(failures ? `\n${failures} step(s) failed` : '\nAll e2e steps passed.');
process.exit(failures ? 1 : 0);
