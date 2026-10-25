// The intro's waving subway mascot (S-26). Its raised arm is a separate part:
// across a whole wave the shoulder must stay covered (no background between
// the sleeve and the arm) and the hand must stay inside the canvas.
// Skips without the `npm run studio:prepare` artwork.
//
//   npm run test:studio-browser

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { serve, chromium, ROOT } from '../../tools/lib/browser.mjs';

const atlas = join(ROOT, 'games/zombify/runtime/assets/studio/subway-mascot-parts.webp');
const skip = existsSync(atlas) ? false : 'needs the subway mascot artwork: npm run studio:prepare';
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

test('the waving arm stays attached at the shoulder and inside the canvas at every phase', { skip }, async () => {
  const page = await browser.newPage();
  await page.goto(`${srv.url}games/zombify/runtime/assets/`);
  await page.setContent(`<base href="${srv.url}games/zombify/runtime/">`);
  const r = await page.evaluate(async () => {
    const { paintMascot, MASCOT_ATLAS } = await import('./subway-mascot.js');
    const image = new Image();
    image.src = MASCOT_ATLAS;
    await image.decode();
    // World units: the wave canvas is 520 x 450.
    const canvas = document.createElement('canvas');
    canvas.width = 520;
    canvas.height = 450;
    const ctx = canvas.getContext('2d', { willReadFrequently: true }), out = { phases: 0, edge: [], gaps: [], arm: 0 };
    for (let i = 0; i < 84; i++) {
      const t = (i * 1.05) / 84;
      paintMascot(canvas, image, { mode: 'wave', seconds: t });
      const d = ctx.getImageData(0, 0, 520, 450).data, alpha = (x, y) => d[(y * 520 + x) * 4 + 3];
      out.phases++;
      let edge = 0;
      for (let y = 0; y < 450; y++) edge = Math.max(edge, alpha(519, y), alpha(518, y));
      for (let x = 330; x < 520; x++) edge = Math.max(edge, alpha(x, 0), alpha(x, 1));
      if (edge > 8) out.edge.push(+t.toFixed(3));
      // The joint, between the sleeve's top and bottom outlines (world y
      // 298-342) and across the sleeve's open end (x 326-346).
      let gap = 0;
      for (let y = 298; y <= 342; y++) for (const x of [326, 336, 346]) if (alpha(x, y) < 200) gap++;
      if (gap) out.gaps.push(+t.toFixed(3));
      // The arm is drawn: the forearm crosses x 420 somewhere above the sleeve.
      let arm = 0;
      for (let y = 120; y < 300; y++) if (alpha(420, y) > 200) arm++;
      out.arm = Math.max(out.arm, arm);
    }
    return out;
  });
  assert.equal(r.phases, 84);
  assert.ok(r.arm > 20, 'the raised arm is drawn');
  assert.deepEqual(r.gaps, [], 'background shows between the sleeve and the arm');
  assert.deepEqual(r.edge, [], 'the hand runs off the canvas');
  await page.close();
});
