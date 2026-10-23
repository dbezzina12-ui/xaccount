#!/usr/bin/env node
// Captures in-game screenshots (real outcomes via ?demo= seeds) so art can
// be reviewed in context. Output: games/<id>/shots/*.jpg
//
//   node tools/shots.mjs [game-001] [--only idle,spin,...]

import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { serve, chromium, ROOT } from './lib/browser.mjs';

const args = process.argv.slice(2);
const game = args.find((a) => !a.startsWith('--')) ?? 'game-001';
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
const outDir = join(ROOT, 'games', game, 'shots');
const srv = await serve();
const url = srv.url;
const browser = await chromium();
await mkdir(outDir, { recursive: true });
const errors = [];

async function open(query, viewport = { width: 1600, height: 900 }, scale = 1) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: scale });
  page.on('pageerror', (e) => errors.push(`${query}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errors.push(`${query}: ${m.text()}`));
  await page.goto(`${url}?game=${game}&${query}`);
  await page.waitForFunction(() => window.__slot?.ready, null, { timeout: 30000 });
  await page.waitForTimeout(700);
  return page;
}
const until = (page, fn, timeout = 30000) => page.waitForFunction(fn, null, { timeout, polling: 50 });
const shot = async (page, name) => {
  await page.screenshot({ path: join(outDir, `${name}.jpg`), type: 'jpeg', quality: 86 });
  console.log(`  ${name}.jpg`);
};

const scenes = {
  async idle() {
    const p = await open('seed=7');
    await shot(p, 'idle');
    await p.close();
  },
  async spin() {
    const p = await open('seed=7');
    await p.evaluate(() => __slot.ctrl.spinPressed());
    await p.waitForTimeout(380);
    await shot(p, 'spinning');
    await p.close();
  },
  async win() {
    const p = await open('demo=win');
    await p.evaluate(() => __slot.ctrl.spinPressed());
    await until(p, () => __slot.stage.lines.length === 1 && __slot.stage.lineLabel);
    await p.waitForTimeout(250);
    await shot(p, 'line-win');
    await p.close();
  },
  async bigwin() {
    const p = await open('demo=bigwin');
    await p.evaluate(() => __slot.ctrl.spinPressed());
    await until(p, () => __slot.stage.ov?.type === 'bigwin' && __slot.stage.ov.lastTier >= 0);
    await p.waitForTimeout(700);
    await shot(p, 'big-win');
    await p.close();
  },
  async feature() {
    const p = await open('demo=epic');
    await p.evaluate(() => __slot.ctrl.spinPressed());
    await until(p, () => __slot.stage.ov?.type === 'feature-intro');
    await p.waitForTimeout(900);
    await shot(p, 'feature-intro');
    await p.evaluate(() => __slot.ctrl.tap());
    // a landed free spin that shows something: a win, or multiplier badges
    await until(p, () => {
      const st = __slot.stage;
      return st.mode === 'free' && !st.ov && st.reels.every((r) => !r.spinning) && (st.lines.length > 0 || st.badges.some((c) => c.some(Boolean)));
    }, 120000);
    await p.waitForTimeout(450);
    await shot(p, 'free-spins');
    await p.close();
  },
  async portrait() {
    const p = await open('seed=7', { width: 430, height: 932 }, 2);
    await shot(p, 'portrait');
    await p.evaluate(() => __slot.ctrl.showInfo());
    await p.waitForTimeout(300);
    await shot(p, 'portrait-info');
    await p.close();
  },
};

console.log(`screenshots → ${outDir}`);
for (const [name, fn] of Object.entries(scenes)) {
  if (only && !only.includes(name)) continue;
  try {
    await fn();
  } catch (e) {
    errors.push(`${name}: ${e.message.split('\n')[0]}`);
  }
}
await browser.close();
srv.close();
if (errors.length) {
  console.error('errors:\n  ' + errors.join('\n  '));
  process.exitCode = 1;
}
