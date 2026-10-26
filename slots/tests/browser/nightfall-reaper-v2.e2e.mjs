// Night Fall reaper v2 candidate (`?reaper=v2`; Claude, animation): ChatGPT's
// bone arm under Dylan's shoulder mantle. Checked from the art's own pixels,
// through the drawn transforms, on every frame of a real strike at desktop,
// 390x844 and 390x693: the shoulder and elbow never show from under the
// mantle (or the fist); the hood layer only fades while the blade is clear of
// it; the boots stay planted; and the reaper stands on the archer's ground line.
//
// The v2 art is git-ignored until Dylan clears it, so this skips without it
// (make it with tools/nightfall-reaper-v2.py).
//
//   npm run test:studio-browser

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { serve, chromium } from '../../tools/lib/browser.mjs';

const ART = new URL('../../games/nightfall/runtime/assets/nightfall/reaper-v2/rig.json', import.meta.url);
const skip = !existsSync(ART) && 'reaper v2 art not present (git-ignored; run tools/nightfall-reaper-v2.py)';

let srv;
let browser;
before(async () => { if (skip) return; srv = await serve(); browser = await chromium(); });
after(async () => { await browser?.close(); srv?.close(); });

const PHONE = { deviceScaleFactor: 2, isMobile: true, hasTouch: true };
async function open(viewport, extra = {}) {
  const ctx = await browser.newContext({ viewport, ...extra });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.addInitScript(() => { try { localStorage.setItem('nightfall-skip-intro', 'yes'); } catch {} });
  await page.goto(`${srv.url}games/nightfall/runtime/index.html?reaper=v2`);
  await page.waitForFunction(() => globalThis.NightFall?.state.ready && globalThis.NightFall.actors.reaper.joints && globalThis.NightFall.actors.archer.joints, null, { timeout: 60000 });
  await page.evaluate(MEASURE);
  page.ctx = ctx;
  return page;
}

// In the page: where a native pixel of a part's image is drawn (rig px) and
// back; a part's alpha at a native pixel; whether a point of a part is under
// an opaque, fully shown part drawn over it; and a recorder on draw().
const MEASURE = () => {
  const box = (el) => ({ x: parseFloat(el.style.left) / 100 * el.parentElement.clientWidth, y: parseFloat(el.style.top) / 100 * el.parentElement.clientHeight, w: el.offsetWidth, h: el.offsetHeight, m: new DOMMatrix(getComputedStyle(el).transform) });
  const drawn = (el, [u, v]) => { const b = box(el), q = b.m.transformPoint(new DOMPoint(u * b.w / el.naturalWidth, v * b.h / el.naturalHeight)); return [b.x + q.x, b.y + q.y]; };
  const native = (el, [x, y]) => { const b = box(el), q = b.m.inverse().transformPoint(new DOMPoint(x - b.x, y - b.y)); return [q.x * el.naturalWidth / b.w, q.y * el.naturalHeight / b.h]; };
  const alphas = new Map();
  const alphaAt = (el, [u, v]) => {
    let a = alphas.get(el.src);
    if (!a) { const c = document.createElement('canvas'); c.width = el.naturalWidth; c.height = el.naturalHeight; const g = c.getContext('2d'); g.drawImage(el, 0, 0); a = { d: g.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height }; alphas.set(el.src, a); }
    const x = Math.round(u), y = Math.round(v);
    return x < 0 || y < 0 || x >= a.w || y >= a.h ? 0 : a.d[(y * a.w + x) * 4 + 3];
  };
  const shown = (el) => parseFloat(el.style.opacity || '1') >= 0.99;
  const hidden = (actor, part, pt) => {
    const z = +actor.parts[part].style.zIndex;
    return Object.values(actor.parts).some((o) => +o.style.zIndex > z && shown(o) && alphaAt(o, native(o, pt)) >= 128);
  };
  window.__v2 = (actor) => {
    const J = actor.joints, P = actor.parts, out = {};
    // Shoulder and elbow points showing.
    for (const [part, file] of [['armUpper', 'arm-upper'], ['armFore', 'arm-fore']]) out[`${file} joint points showing`] = J.checks.joints[file].filter((p) => !hidden(actor, part, drawn(P[part], p))).length;
    // Blade points on the hood while the hood layer is part-faded.
    const fade = parseFloat(P.head.style.opacity || '0');
    out.fade = fade;
    out['blade points on the fading hood'] = fade > 0.01 && fade < 0.99 ? J.checks.blade.filter((p) => alphaAt(P.head, native(P.head, drawn(P.handFront, p))) >= 128).length : 0;
    // The soles: the body's bottom centre, drawn.
    const b = actor.spec.parts.body.box, el = P.body;
    out.sole = drawn(el, [(J.feet[0] - b[0]) / b[2] * el.naturalWidth, (J.sole - b[1]) / b[3] * el.naturalHeight])[1];
    return out;
  };
  window.__record = (actor) => {
    const frames = (actor.__frames = []), draw = actor.draw.bind(actor);
    actor.draw = (pose) => { draw(pose); if (actor.pending) frames.push(window.__v2(actor)); };
    return frames;
  };
};

async function strike(page) {
  return page.evaluate(async () => {
    const { reaper } = globalThis.NightFall.actors;
    reaper.stopIdle(); reaper.draw({});
    const rest = window.__v2(reaper);
    const frames = window.__record(reaper);
    await reaper.strike({});
    await new Promise((r) => setTimeout(r, 600));
    return { rest, frames, v2: reaper.v2, blade: reaper.bladePoint() };
  });
}

function assertStrike({ rest, frames, v2, blade }, label) {
  assert.ok(v2, `${label}: the v2 reaper loaded`);
  assert.ok(Number.isFinite(blade.x) && Number.isFinite(blade.y), `${label}: blade point ${JSON.stringify(blade)}`);
  assert.ok(frames.length > 20, `${label}: ${frames.length} frames`);
  for (const [i, f] of [['rest', rest], ...frames.map((f, k) => [k, f])]) {
    for (const [k, v] of Object.entries(f)) if (k.includes('showing') || k.includes('blade points')) assert.equal(v, 0, `${label} frame ${i}: ${k}: ${v}`);
  }
  assert.ok(frames.some((f) => f.fade > 0.99), `${label}: the hood layer covers the blade in the wind-up`);
  const soles = [rest, ...frames].map((f) => f.sole);
  assert.ok(Math.max(...soles) - Math.min(...soles) < 0.5, `${label}: the feet moved ${(Math.max(...soles) - Math.min(...soles)).toFixed(2)} px`);
}

test('reaper v2: the shoulder and elbow stay hidden through a real strike, on desktop and phones', { skip }, async () => {
  for (const [vp, extra] of [[{ width: 1280, height: 800 }, {}], [{ width: 390, height: 844 }, PHONE], [{ width: 390, height: 693 }, PHONE]]) {
    const page = await open(vp, extra);
    assertStrike(await strike(page), `${vp.width}x${vp.height}`);
    assert.deepEqual(page.errors, []);
    await page.ctx.close();
  }
});

test('reaper v2 stands on the archer\'s ground line', { skip }, async () => {
  for (const [vp, extra] of [[{ width: 390, height: 844 }, PHONE], [{ width: 1280, height: 800 }, {}]]) {
    const page = await open(vp, extra);
    const g = await page.evaluate(() => {
      const { reaper, archer } = globalThis.NightFall.actors;
      for (const a of [reaper, archer]) { a.stopIdle(); a.draw({}); }
      return { reaper: reaper.rig.getBoundingClientRect().top + window.__v2(reaper).sole, archerGround: archer.ground, reaperGround: reaper.ground };
    });
    assert.ok(Math.abs(g.reaper - g.reaperGround) < 1.5, `${vp.width}x${vp.height}: soles ${g.reaper}, ground ${g.reaperGround}`);
    assert.ok(Math.abs(g.reaperGround - g.archerGround) < 0.5, `${vp.width}x${vp.height}: grounds ${g.reaperGround} vs ${g.archerGround}`);
    await page.ctx.close();
  }
});
