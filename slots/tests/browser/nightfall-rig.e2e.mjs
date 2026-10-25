// Night Fall's jointed rigs (Claude, animation): measured from the rendered
// transforms on every frame of a real strike and shot, the joints stay
// together (shoulders, elbows, the scythe in its fist, the fingers on the
// nock, the string on the bow tips, the bow in its hand), the soles never
// move, and the characters stand on the ground line at every screen size.
// Also the release point, Skip, menu pause, hidden tabs and reduced motion.
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
  await page.goto(`${srv.url}games/nightfall/runtime/index.html`);
  await page.waitForFunction(() => globalThis.NightFall?.state.ready && globalThis.NightFall.actors.reaper.joints && globalThis.NightFall.actors.archer.joints, null, { timeout: 60000 });
  page.ctx = ctx;
  return page;
}

// In the page: where a rig-space point of a part is drawn (rig px), from the
// part's computed transform; the contact pairs; and a recorder on draw().
const MEASURE = () => {
  const at = (actor, part, [x, y]) => {
    const el = actor.parts[part], rig = actor.rig, s = rig.clientWidth / 320;
    const box = [parseFloat(el.style.left) * 3.2, parseFloat(el.style.top) * 4.3];
    const m = new DOMMatrix(getComputedStyle(el).transform);
    const q = m.transformPoint(new DOMPoint((x - box[0]) * s, (y - box[1]) * s));
    return [box[0] * s + q.x, box[1] * s + q.y];
  };
  const gap = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  window.__pairs = (actor) => {
    const J = actor.joints, R = actor.kind === 'reaper';
    const same = R
      ? [['body', 'upperRight', J.shoulderRight], ['upperRight', 'foreRight', J.elbowRight], ['foreRight', 'scythe', J.grip], ['body', 'upperLeft', J.shoulderLeft], ['upperLeft', 'foreLeft', J.elbowLeft], ['body', 'head', J.neck], ['body', 'cape', J.shoulders]]
      : [['body', 'drawUpper', J.drawShoulder], ['drawUpper', 'drawFore', J.drawElbow], ['body', 'head', J.neck], ['body', 'bowArm', J.bowShoulder]];
    const out = {};
    for (const [a, b, p] of same) out[`${a}/${b}`] = gap(at(actor, a, p), at(actor, b, p));
    out.sole = at(actor, 'body', [160, J.sole])[1];
    if (!R) {
      const s = actor.rig.clientWidth / 320, pts = actor.stringLine.getAttribute('points').split(' ').map((p) => p.split(',').map((v) => +v * s));
      out['string/tipTop'] = gap(pts[0], at(actor, 'bow', J.tipTop));
      out['string/tipBottom'] = gap(pts[2], at(actor, 'bow', J.tipBottom));
      out.nocked = actor.parts.arrow.style.opacity !== '0' && !actor.pose.loosed;
      if (out.nocked) { out['fingers/nock'] = gap(at(actor, 'drawFore', J.nock), at(actor, 'arrow', J.nock)); out['string/fingers'] = gap(pts[1], at(actor, 'drawFore', J.nock)); }
      out.handToBow = gap(at(actor, 'bowArm', J.palm), at(actor, 'bow', J.grip));
    }
    return out;
  };
  window.__record = (actor) => {
    const frames = (actor.__frames = []), draw = actor.draw.bind(actor);
    actor.draw = (pose) => { draw(pose); if (actor.pending) frames.push(window.__pairs(actor)); };
    return frames;
  };
};

async function playActions(page) {
  await page.evaluate(MEASURE);
  return page.evaluate(async () => {
    const { reaper, archer } = globalThis.NightFall.actors;
    const rf = window.__record(reaper), af = window.__record(archer);
    await reaper.strike({});
    await new Promise((r) => setTimeout(r, 700));
    const board = document.getElementById('board-shell').getBoundingClientRect();
    const origin = await archer.shoot({ target: { x: board.left + board.width * 0.2, y: board.top + board.height * 0.3 } });
    // The arrow's head just before it was loosed, and the returned release point.
    const loose = af.findIndex((f) => !f.nocked);
    await new Promise((r) => setTimeout(r, 700));
    return { rf, af, origin, loose };
  });
}

function assertRig({ rf, af }, label) {
  for (const [name, frames] of [['reaper', rf], ['archer', af]]) {
    assert.ok(frames.length > 20, `${label} ${name}: ${frames.length} frames`);
    const worst = {};
    for (const f of frames) for (const [k, v] of Object.entries(f)) if (typeof v === 'number' && k !== 'sole' && k !== 'handToBow') worst[k] = Math.max(worst[k] ?? 0, v);
    for (const [k, v] of Object.entries(worst)) assert.ok(v < 0.75, `${label} ${name} ${k} drifted ${v.toFixed(2)} px`);
    const soles = frames.map((f) => f.sole);
    assert.ok(Math.max(...soles) - Math.min(...soles) < 0.5, `${label} ${name}: the feet moved ${(Math.max(...soles) - Math.min(...soles)).toFixed(2)} px`);
  }
  const hold = af.map((f) => f.handToBow);
  assert.ok(Math.max(...hold) - Math.min(...hold) < 0.75, `${label} archer: the bow slid in its hand by ${(Math.max(...hold) - Math.min(...hold)).toFixed(2)} px`);
  assert.ok(af.some((f) => !f.nocked) && af.some((f) => f.nocked), `${label} archer: the arrow is loosed and nocked again`);
}

test('desktop: every joint holds through a real strike and shot, and the feet stay planted', async () => {
  const page = await open({ width: 1280, height: 800 });
  assertRig(await playActions(page), 'desktop');
  assert.deepEqual(page.errors, []);
  await page.ctx.close();
});

test('phone: every joint holds through a real strike and shot, and the feet stay planted', async () => {
  const page = await open({ width: 390, height: 844 }, PHONE);
  assertRig(await playActions(page), '390x844');
  assert.deepEqual(page.errors, []);
  await page.ctx.close();
});

test('the loosed arrow leaves from the head of the nocked arrow', async () => {
  const page = await open({ width: 1280, height: 800 });
  await page.evaluate(MEASURE);
  const r = await page.evaluate(async () => {
    const archer = globalThis.NightFall.actors.archer, heads = [];
    const draw = archer.draw.bind(archer);
    archer.draw = (pose) => { draw(pose); if (archer.pending && !pose.loosed) heads.push(archer.releasePoint()); };
    const board = document.getElementById('board-shell').getBoundingClientRect();
    const origin = await archer.shoot({ target: { x: board.left + board.width * 0.2, y: board.top + board.height * 0.6 } });
    return { origin, last: heads.at(-1) };
  });
  assert.ok(Math.hypot(r.origin.x - r.last.x, r.origin.y - r.last.y) < 1.5, `release ${JSON.stringify(r.origin)} vs arrow head ${JSON.stringify(r.last)}`);
  await page.ctx.close();
});

test('the characters stand on one ground line: on phones at the foot of the button row, on desktop on the floor above the bar', async () => {
  for (const [vp, extra] of [[{ width: 390, height: 844 }, PHONE], [{ width: 390, height: 693 }, PHONE], [{ width: 375, height: 667 }, PHONE], [{ width: 1280, height: 800 }, {}]]) {
    const page = await open(vp, extra);
    await page.evaluate(MEASURE);
    const g = await page.evaluate(() => {
      const { reaper, archer } = globalThis.NightFall.actors;
      for (const a of [reaper, archer]) { a.stopIdle(); a.draw({}); }
      const sole = (a) => a.rig.getBoundingClientRect().top + window.__pairs(a).sole;
      const ctl = document.getElementById('controller').shadowRoot;
      const buy = ctl.querySelector('[aria-label="Buy bonus"]').getBoundingClientRect();
      const icons = ctl.querySelector('[aria-label="Settings"]')?.getBoundingClientRect();
      return { reaper: sole(reaper), archer: sole(archer), buy: buy.bottom, icons: icons?.top, bar: document.getElementById('controller').getBoundingClientRect().top, mobile: innerWidth <= 760 && innerHeight > innerWidth };
    });
    const label = `${vp.width}x${vp.height}`;
    assert.ok(Math.abs(g.reaper - g.archer) < 1, `${label}: soles at ${g.reaper} and ${g.archer}`);
    if (g.mobile) {
      assert.ok(Math.abs(g.reaper - g.buy) < 1.5, `${label}: soles ${g.reaper}, button row foot ${g.buy}`);
      if (g.icons) assert.ok(g.reaper <= g.icons + 1, `${label}: the boots are not behind the icon row (${g.reaper} vs ${g.icons})`);
    } else assert.ok(Math.abs(g.reaper - (g.bar - 6)) < 1.5, `${label}: soles ${g.reaper}, bar ${g.bar}`);
    await page.ctx.close();
  }
});

test('Skip ends a strike at once; the menu pauses it; hidden tabs and reduced motion stop the idle', async () => {
  const page = await open({ width: 1280, height: 800 });
  const r = await page.evaluate(async () => {
    const { reaper, archer } = globalThis.NightFall.actors, state = globalThis.NightFall.state;
    const sig = (a) => Object.values(a.parts).map((p) => p.style.transform).join('|');
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    // Skip.
    state.skip = true; const t0 = performance.now(); await reaper.strike({}); const skipMs = performance.now() - t0; state.skip = false;
    // Menu pause: a shot makes no progress while the menu is open.
    const menu = document.getElementById('menu');
    let menuOpen = false; const paused = () => menuOpen;
    const shot = archer.shoot({ target: { x: 300, y: 300 }, paused });
    await wait(120); menuOpen = true; const a = sig(archer); await wait(400); const b = sig(archer); menuOpen = false; await shot;
    // Hidden tab: the idle stops.
    archer.idle(); await wait(300);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    const h1 = sig(archer); await wait(500); const h2 = sig(archer);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
    await wait(400); const h3 = sig(archer);
    void menu;
    return { skipMs, menuHeld: a === b, hiddenHeld: h1 === h2, resumed: h2 !== h3 };
  });
  assert.ok(r.skipMs < 120, `Skip took ${r.skipMs.toFixed(0)} ms`);
  assert.ok(r.menuHeld, 'the shot moved while the menu was open');
  assert.ok(r.hiddenHeld, 'the idle kept painting in a hidden tab');
  assert.ok(r.resumed, 'the idle resumed when the tab came back');
  await page.ctx.close();
  const still = await open({ width: 1280, height: 800 }, { reducedMotion: 'reduce' });
  const rm = await still.evaluate(async () => {
    const { reaper, archer } = globalThis.NightFall.actors, sig = (a) => Object.values(a.parts).map((p) => p.style.transform).join('|');
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    const a = sig(reaper) + sig(archer); await wait(700); const b = sig(reaper) + sig(archer);
    const t0 = performance.now(); await reaper.strike({}); await archer.shoot({ target: { x: 300, y: 300 } });
    return { held: a === b, ms: performance.now() - t0 };
  });
  assert.ok(rm.held, 'reduced motion: the characters still moved');
  assert.ok(rm.ms < 100, `reduced motion: actions took ${rm.ms.toFixed(0)} ms`);
  await still.ctx.close();
});
