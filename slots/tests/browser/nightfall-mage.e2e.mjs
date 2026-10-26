// Night Fall's skeleton mage (`?archer=mage`; Claude, animation): ChatGPT's
// mage layers under Dylan's shoulder mantle. Checked from the art's own
// pixels, through the drawn transforms, on every frame of a real staff slam
// at desktop, 390x844 and 390x693: the shoulder and elbow never show from
// under the mantle; the fingers stay closed on the shaft; the forearm stays
// on the wrist; the boots stay planted; the lifted crystal stays on screen;
// the slam resolves at the impact. Breathing: the joints stay hidden through
// the idle cycle. The art is made by tools/nightfall-mage.py.
//
//   npm run test:studio-browser

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { serve, chromium } from '../../tools/lib/browser.mjs';

let srv;
let browser;
before(async () => { srv = await serve(); browser = await chromium(); });
after(async () => { await browser?.close(); srv?.close(); });

const PHONE = { deviceScaleFactor: 2, isMobile: true, hasTouch: true };
async function open(viewport, extra = {}) {
  const ctx = await browser.newContext({ viewport, ...extra });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.addInitScript(() => { try { localStorage.setItem('nightfall-skip-intro', 'yes'); } catch {} });
  await page.goto(`${srv.url}games/nightfall/runtime/index.html?archer=mage`);
  await page.waitForFunction(() => globalThis.NightFall?.state.ready && globalThis.NightFall.actors.reaper.joints && globalThis.NightFall.actors.archer.joints, null, { timeout: 60000 });
  await page.evaluate(MEASURE);
  page.ctx = ctx;
  return page;
}

const MEASURE = () => {
  const box = (el) => ({ x: parseFloat(el.style.left) / 100 * el.parentElement.clientWidth, y: parseFloat(el.style.top) / 100 * el.parentElement.clientHeight, w: el.offsetWidth, h: el.offsetHeight, m: new DOMMatrix(getComputedStyle(el).transform) });
  // Parts are images, or canvases (the breathing robe and mantle).
  const nw = (el) => el.naturalWidth || el.width, nh = (el) => el.naturalHeight || el.height;
  const drawn = (el, [u, v]) => { const b = box(el), q = b.m.transformPoint(new DOMPoint(u * b.w / nw(el), v * b.h / nh(el))); return [b.x + q.x, b.y + q.y]; };
  const native = (el, [x, y]) => { const b = box(el), q = b.m.inverse().transformPoint(new DOMPoint(x - b.x, y - b.y)); return [q.x * nw(el) / b.w, q.y * nh(el) / b.h]; };
  const alphas = new Map();
  window.__pixels = (el) => {
    if (el.getContext) { const d = el.getContext('2d').getImageData(0, 0, el.width, el.height); return { d: d.data, w: el.width, h: el.height }; }
    const c = document.createElement('canvas'); c.width = el.naturalWidth; c.height = el.naturalHeight; const g = c.getContext('2d'); g.drawImage(el, 0, 0);
    return { d: g.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height };
  };
  const alphaAt = (el, [u, v]) => {
    let a = alphas.get(el);
    if (!a) { a = window.__pixels(el); alphas.set(el, a); }
    const x = Math.round(u), y = Math.round(v);
    return x < 0 || y < 0 || x >= a.w || y >= a.h ? 0 : a.d[(y * a.w + x) * 4 + 3];
  };
  const shown = (el) => parseFloat(el.style.opacity || '1') >= 0.99;
  const hidden = (actor, part, pt) => {
    const z = +actor.parts[part].style.zIndex;
    return Object.values(actor.parts).some((o) => +o.style.zIndex > z && shown(o) && alphaAt(o, native(o, pt)) >= 128);
  };
  window.__mage = (actor) => {
    for (const el of alphas.keys()) if (el.getContext) alphas.delete(el);
    const J = actor.joints, P = actor.parts, out = {}, unit = actor.rig.clientWidth / actor.size[0];
    for (const [part, file] of [['armUpper', 'arm-upper'], ['armFore', 'arm-fore']]) out[`${file} joint points showing`] = J.checks.joints[file].filter((p) => !hidden(actor, part, drawn(P[part], p))).length;
    // The grip: under every finger point there is shaft.
    out['finger points off the shaft'] = J.checks.grip.filter((p) => alphaAt(P.staff, native(P.staff, drawn(P.fingers, p))) < 128).length;
    // The wrist: the forearm's wrist and the fist's wrist, drawn (screen px).
    const at = (part, [x, y]) => { const el = P[part], b = actor.spec.parts[part].box; return drawn(el, [(x - b[0]) / b[2] * nw(el), (y - b[1]) / b[3] * nh(el)]); };
    const w1 = at('armFore', J.wrist), w2 = at('handBack', J.wrist);
    out.wristGap = Math.hypot(w1[0] - w2[0], w1[1] - w2[1]); void unit;
    out.sole = at('body', [J.feet[0], J.sole])[1];
    out.staffTop = P.staff.getBoundingClientRect().top;
    out.crystal = actor.releasePoint().y;
    return out;
  };
  window.__record = (actor) => {
    const frames = (actor.__frames = []), draw = actor.draw.bind(actor);
    actor.draw = (pose) => { draw(pose); if (actor.pending) frames.push(window.__mage(actor)); };
    return frames;
  };
};

async function slam(page) {
  return page.evaluate(async () => {
    const { archer } = globalThis.NightFall.actors;
    archer.stopIdle(); archer.draw({});
    const rest = window.__mage(archer);
    const frames = window.__record(archer);
    const origin = await archer.shoot({});
    const atImpact = window.__mage(archer);
    await new Promise((r) => setTimeout(r, 700));
    return { kind: archer.kind, rest, frames, origin, atImpact, lift: archer.joints.lift, unit: archer.rig.clientWidth / archer.size[0] };
  });
}

test('mage: the shoulder and elbow stay hidden, the grip closed and the feet planted through a real slam', async () => {
  for (const [vp, extra] of [[{ width: 1280, height: 800 }, {}], [{ width: 390, height: 844 }, PHONE], [{ width: 390, height: 693 }, PHONE]]) {
    const page = await open(vp, extra);
    const r = await slam(page), label = `${vp.width}x${vp.height}`;
    assert.equal(r.kind, 'mage', `${label}: the mage loaded`);
    assert.ok(r.frames.length > 20, `${label}: ${r.frames.length} frames`);
    for (const [i, f] of [['rest', r.rest], ...r.frames.map((f, k) => [k, f])]) {
      for (const [k, v] of Object.entries(f)) if (k.includes('showing') || k.includes('off the shaft')) assert.equal(v, 0, `${label} frame ${i}: ${k}: ${v}`);
      assert.ok(f.wristGap < 0.75, `${label} frame ${i}: the forearm is ${f.wristGap.toFixed(2)} px off the wrist`);
      assert.ok(f.staffTop >= 0, `${label} frame ${i}: the staff is cut off at the top (${f.staffTop.toFixed(1)})`);
    }
    const soles = [r.rest, ...r.frames].map((f) => f.sole);
    assert.ok(Math.max(...soles) - Math.min(...soles) < 0.5, `${label}: the feet moved`);
    // The staff really lifts, and the slam resolves at the impact (staff down).
    const high = Math.min(...r.frames.map((f) => f.crystal));
    assert.ok((r.rest.crystal - high) / r.unit > r.lift * 0.95, `${label}: the crystal rose ${((r.rest.crystal - high) / r.unit).toFixed(1)} of ${r.lift} units`);
    assert.ok(Math.abs(r.origin.y - r.rest.crystal) / r.unit < 1.5, `${label}: released ${((r.origin.y - r.rest.crystal) / r.unit).toFixed(2)} units from the landed crystal`);
    assert.deepEqual(page.errors, []);
    await page.ctx.close();
  }
});

test('mage: stands on the reaper\'s ground line and breathes with the joints hidden', async () => {
  for (const [vp, extra] of [[{ width: 390, height: 844 }, PHONE], [{ width: 1280, height: 800 }, {}]]) {
    const page = await open(vp, extra);
    const g = await page.evaluate(() => {
      const { reaper, archer } = globalThis.NightFall.actors;
      for (const a of [reaper, archer]) { a.stopIdle(); a.draw({}); }
      const rest = window.__mage(archer);
      let worst = 0, soles = [];
      for (let t = 0; t < 2 * archer.spec.breath.period; t += 0.1) { archer.draw(archer.idlePose(t)); const f = window.__mage(archer); worst = Math.max(worst, f['arm-upper joint points showing'] + f['arm-fore joint points showing'] + f['finger points off the shaft']); soles.push(f.sole); }
      return { sole: archer.rig.getBoundingClientRect().top + rest.sole, ground: archer.ground, reaperGround: reaper.ground, worst, soleMove: Math.max(...soles) - Math.min(...soles) };
    });
    const label = `${vp.width}x${vp.height}`;
    assert.ok(Math.abs(g.sole - g.ground) < 1.5, `${label}: soles ${g.sole}, ground ${g.ground}`);
    assert.ok(Math.abs(g.ground - g.reaperGround) < 0.5, `${label}: grounds ${g.ground} vs ${g.reaperGround}`);
    assert.equal(g.worst, 0, `${label}: joint or grip points failing during the idle: ${g.worst}`);
    assert.ok(g.soleMove < 0.5, `${label}: the feet moved ${g.soleMove.toFixed(2)} px while breathing`);
    assert.deepEqual(page.errors, []);
    await page.ctx.close();
  }
});
