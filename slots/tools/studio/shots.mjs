#!/usr/bin/env node
// Screenshots of the running studio editor (studio/index.html with the real
// checked-out runtime) at desktop and phone sizes → studio/shots/*.jpg
//
//   node tools/studio/shots.mjs

import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { serve, chromium, ROOT } from '../lib/browser.mjs';

const out = join(ROOT, 'studio', 'shots');
await mkdir(out, { recursive: true });
const srv = await serve();
const browser = await chromium();
const errors = [];

async function open(viewport, scale = 1) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: scale });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${srv.url}studio/index.html`);
  await page.waitForFunction(() => document.getElementById('canvas-loading').hidden, null, { timeout: 20000 });
  await page.waitForTimeout(2200); // let the runtime report its loading state
  return page;
}
const shot = async (page, name) => {
  await page.screenshot({ path: join(out, `${name}.jpg`), type: 'jpeg', quality: 85 });
  console.log(`  ${name}.jpg`);
};

let page = await open({ width: 1440, height: 900 });
await shot(page, 'desktop-scene');
await page.click('[data-select="reels"]');
await page.click('[data-grid="7,7"]');
await page.waitForTimeout(400);
await shot(page, 'desktop-layout-test-7x7');
await page.click('#spin');
await page.waitForTimeout(450);
await shot(page, 'desktop-layout-test-spinning');
await page.waitForFunction(() => !document.body.classList.contains('busy'), null, { timeout: 15000 });
await page.click('[data-grid="6,5"]');
await page.click('#mobile');
await page.waitForTimeout(600);
await shot(page, 'desktop-mobile-scene');
await page.close();

page = await open({ width: 390, height: 844 }, 2);
await shot(page, 'phone-editor');
await page.screenshot({ path: join(out, 'phone-editor-full.jpg'), type: 'jpeg', quality: 80, fullPage: true });
console.log('  phone-editor-full.jpg');
await page.close();

await browser.close();
srv.close();
if (errors.length) console.error('page errors:\n  ' + errors.join('\n  '));
