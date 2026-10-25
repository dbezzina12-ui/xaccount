// The zombie rig's zero-copy canvas path (OffscreenCanvas + bitmaprenderer)
// must draw what the 2D path draws, and browsers without it keep the 2D path.
// Skips without the `npm run studio:prepare` assets.
//
//   npm run test:studio-browser

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { serve, chromium } from '../../tools/lib/browser.mjs';
import { AGENT_TOOLS, prepared } from './helpers.mjs';

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

// Draws the same frames of several clips through rigSurface() and through the
// 2D paintRig() path, and returns the largest per-channel difference and which
// context each rigSurface canvas got.
async function compare(init) {
  const page = await browser.newPage();
  if (init) await page.addInitScript(init);
  // Any page on the test server gives the game's origin, so its modules and
  // rig art load; the base URL resolves them from the runtime folder.
  await page.goto(`${srv.url}games/zombify/runtime/assets/`);
  await page.setContent(`<base href="${srv.url}games/zombify/runtime/">`);
  return page.evaluate(async () => {
    const { rigSurface, paintRig } = await import('./rig-gpu.js');
    const { loadApprovedRig } = await import('./approved-rig.js');
    const { fitRig } = await import('./rig-geometry.js');
    const W = 120, H = 180, dpr = 2, results = { worst: 0, contexts: [] };
    for (const [view, clip, time] of [['front', 'idle', 0.7], ['front', 'jump_land', 1.16], ['side', 'crawl_swat_right', 0.6], ['rear', 'walk_up', 0.4]]) {
      const rig = await loadApprovedRig(view), fit = fitRig(rig.data, clip, W, H, { padding: 0.035, time });
      const a = document.createElement('canvas'), surface = rigSurface(a);
      surface.paint(rig, clip, time, fit, W, H, dpr);
      results.contexts.push(a.getContext('bitmaprenderer') ? 'bitmaprenderer' : '2d');
      const b = document.createElement('canvas');
      b.width = W * dpr; b.height = H * dpr;
      const bctx = b.getContext('2d');
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintRig(bctx, rig, clip, time, fit, W, H, dpr);
      // Read both back through one 2D canvas.
      const read = (c) => { const r = document.createElement('canvas'); r.width = W * dpr; r.height = H * dpr; const x = r.getContext('2d'); x.drawImage(c, 0, 0); return x.getImageData(0, 0, r.width, r.height).data; };
      const pa = read(a), pb = read(b);
      let worst = 0, opaque = 0;
      for (let i = 0; i < pa.length; i++) { worst = Math.max(worst, Math.abs(pa[i] - pb[i])); if (i % 4 === 3 && pa[i] > 0) opaque++; }
      results.worst = Math.max(results.worst, worst);
      results.opaque = (results.opaque ?? 0) + opaque;
    }
    return results;
  });
}

test('the zero-copy rig surface draws the same pixels as the 2D path', { skip }, async () => {
  const r = await compare();
  assert.deepEqual(r.contexts, ['bitmaprenderer', 'bitmaprenderer', 'bitmaprenderer', 'bitmaprenderer']);
  assert.ok(r.opaque > 1000, 'the rig was drawn');
  assert.ok(r.worst <= 2, `largest channel difference ${r.worst}`);
  console.log(`# largest channel difference between the two paths: ${r.worst}`);
});

test('without OffscreenCanvas the rig keeps the 2D path', { skip }, async () => {
  const r = await compare(() => { delete window.OffscreenCanvas; });
  assert.deepEqual(r.contexts, ['2d', '2d', '2d', '2d']);
  assert.ok(r.opaque > 1000, 'the rig was drawn');
  assert.equal(r.worst, 0);
});

// Every zombie move the game previews, on a phone-sized standalone page: the
// motion canvas, now sized to the move instead of the board, must never cut
// the zombie off (its 1-pixel border stays transparent on every frame).
test('zombie moves stay inside their motion canvas, which is a fraction of the board', { skip }, async () => {
  const page = await browser.newPage({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(AGENT_TOOLS);
  await page.addInitScript(() => {
    const seen = (window.__motion = { frames: 0, clipped: [], pixels: 0, layer: 0 });
    const real = ImageBitmapRenderingContext.prototype.transferFromImageBitmap;
    const probe = new OffscreenCanvas(1, 1), ctx = probe.getContext('2d', { willReadFrequently: true });
    ImageBitmapRenderingContext.prototype.transferFromImageBitmap = function (bitmap) {
      const host = this.canvas.parentElement;
      if (bitmap && host?.classList.contains('approved-rig-motion')) {
        const { width: w, height: h } = bitmap;
        probe.width = w; probe.height = h; ctx.drawImage(bitmap, 0, 0);
        const edges = [ctx.getImageData(0, 0, w, 1), ctx.getImageData(0, h - 1, w, 1), ctx.getImageData(0, 0, 1, h), ctx.getImageData(w - 1, 0, 1, h)];
        if (edges.some((e) => e.data.some((v, i) => i % 4 === 3 && v > 8))) seen.clipped.push(`${host.parentElement?.id}:${w}x${h}`);
        seen.frames++; seen.pixels += w * h;
        const layer = host.parentElement.getBoundingClientRect();
        seen.layer += layer.width * layer.height * Math.min(devicePixelRatio, 2) ** 2;
      }
      return real.call(this, bitmap);
    };
  });
  await page.goto(`${srv.url}games/zombify/runtime/index.html`);
  await page.waitForFunction(() => window.ZombifyStudioRuntime?.loading().status === 'ready', null, { timeout: 120000 });
  await page.waitForSelector('#guide-play:not([disabled])', { state: 'visible', timeout: 60000 });
  await page.click('#guide-play');
  await page.waitForFunction(() => !document.getElementById('welcome').open);
  for (const mode of ['single', 'showcase', 'triple', 'down', 'carriers', 'horizontal', 'horizontal_left', 'reel']) {
    await page.evaluate((mode) => window.__tools.start_zombify_round.execute({ mode }), mode);
    await page.waitForFunction(() => !window.ZombifyStudioRuntime.status().busy, null, { timeout: 120000 });
  }
  const m = await page.evaluate(() => window.__motion);
  console.log(`# ${m.frames} motion frames; ${(m.pixels / 1e6).toFixed(0)} MP drawn instead of ${(m.layer / 1e6).toFixed(0)} MP board-sized (${((1 - m.pixels / m.layer) * 100).toFixed(0)}% fewer)`);
  assert.ok(m.frames > 100, `${m.frames} motion frames`);
  assert.deepEqual([...new Set(m.clipped)], [], 'the zombie touched the edge of its motion canvas');
  assert.ok(m.pixels < m.layer * 0.6, 'the motion canvas is well under the board size');
  assert.deepEqual(errors, []);
  await page.close();
});

