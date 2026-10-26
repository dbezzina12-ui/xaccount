// Night Fall's Roaming Wild (N-08; Claude, presentation): the mage's zap in
// real rounds with a fixed seed, at desktop and 390x844. One bolt per zap
// event, from the staff's crystal as it lands to the engine's chosen cell;
// the wild appears as the bolt lands, never before; the spark stays inside
// that cell; nothing is left on screen after the round. In free spins the
// one mage wild moves each spin (never two at once) and is never cleared
// after a win. Turbo, Skip, a pause and reduced motion change the
// presentation only: the same cells, the same award.
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
const DESK = [{ width: 1280, height: 800 }, {}], MOBILE = [{ width: 390, height: 844 }, PHONE];
// Seeds for the game's own RNG (crypto is fixed to them): a base spin whose
// zap makes a win, and a regular bonus buy.
const BASE = 20, BONUS = 3;

async function open([viewport, extra], { seed, turbo = false, reduced = false }) {
  const ctx = await browser.newContext({ viewport, ...extra, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.addInitScript(({ seed, turbo }) => {
    try { localStorage.setItem('nightfall-skip-intro', 'yes'); localStorage.setItem('nightfall-session-v1', JSON.stringify({ balance: 1000000, bet: 100, turbo, muted: true })); } catch {}
    const real = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = (a) => { if (a instanceof Uint32Array && a.length === 1) { a[0] = seed; return a; } return real(a); };
  }, { seed, turbo });
  await page.goto(`${srv.url}games/nightfall/runtime/index.html`);
  await page.waitForFunction(() => globalThis.NightFall?.state.ready && globalThis.NightFall.actors.archer.joints, null, { timeout: 60000 });
  await page.evaluate(RECORD);
  page.ctx = ctx;
  return page;
}

// In the page: every bolt the game plays, sampled each frame.
const RECORD = () => {
  const { bolt } = globalThis.NightFall.effects, mage = globalThis.NightFall.actors.archer, host = document.getElementById('arrow-effects');
  const log = (window.__zaps = { plays: [], svgs: 0, clearedWilds: 0 });
  new MutationObserver((list) => { for (const m of list) for (const n of m.addedNodes) if (n.nodeName === 'svg') log.svgs++; }).observe(host, { childList: true });
  // A mage wild that is cleared off the board after a win.
  new MutationObserver((list) => { for (const m of list) if (m.target.classList.contains('clearing') && m.target.dataset.kind === 'arrow-wild') log.clearedWilds++; }).observe(document.getElementById('board'), { subtree: true, attributeFilter: ['class'] });
  const wilds = () => [...document.querySelectorAll('#board .cell[data-kind=arrow-wild]')].length;
  const play = bolt.play.bind(bolt);
  bolt.play = (opts) => {
    const cell = opts.element, r = cell.getBoundingClientRect();
    const rec = { index: opts.index, origin: opts.origin, crystal: opts.origin, centre: { x: r.left + r.width / 2, y: r.top + r.height / 2 }, half: Math.min(r.width, r.height) / 2, before: cell.dataset.kind, frames: [], hitFrame: null };
    log.plays.push(rec);
    const onHit = opts.onHit;
    let live = true;
    const sample = () => {
      if (!live) return;
      const svg = host.querySelector('svg.mage-bolt'), core = svg?.querySelector('.bolt-core');
      const f = { kind: cell.dataset.kind, svgs: host.children.length, wilds: wilds(), paused: document.getElementById('menu').open, crystal: mage.releasePoint() };
      if (core) { const len = parseFloat(core.style.strokeDasharray); f.left = parseFloat(core.style.strokeDashoffset) / len; f.d = core.getAttribute('d'); f.ring = +svg.querySelector('.spark-ring').getAttribute('r'); f.spark = svg.querySelector('.bolt-spark').getAttribute('transform'); }
      rec.frames.push(f);
      requestAnimationFrame(sample);
    };
    // What is left of the bolt's path when the wild appears.
    const left = () => { const core = host.querySelector('svg.mage-bolt .bolt-core'); return core ? parseFloat(core.style.strokeDashoffset) / parseFloat(core.style.strokeDasharray) : undefined; };
    const done = play({ ...opts, onHit: () => { rec.hitFrame = rec.frames.length; rec.leftAtHit = left(); onHit(); rec.after = cell.dataset.kind; } });
    // Sampled after the bolt's own frame (and the mage's) each time.
    requestAnimationFrame(sample);
    return done.then(() => { live = false; rec.target = bolt.last.target; rec.end = host.children.length; setTimeout(() => { rec.lit = cell.classList.contains('mage-lit'); }, 60); });
  };
  // The engine's own round for this seed, for the expected cells.
  window.__expected = async (mode) => {
    const { generateRound, seedRng, RULES } = await import('./engine.js'), seed = new Uint32Array(1); crypto.getRandomValues(seed);
    const round = generateRound({ rng: seedRng(seed[0]), mode });
    // Wins the roaming wild is part of.
    let cell = -1, roamWins = 0;
    for (const e of round.events) { if (e.type === 'zap' && e.roam) cell = e.cell; if (e.type === 'win' && e.positions.includes(cell)) roamWins++; }
    return { cells: round.events.filter((e) => e.type === 'zap').map((e) => e.cell), total: round.total, roams: round.events.filter((e) => e.type === 'zap' && e.roam).length, roamWins, cost: mode === 'regular' ? RULES.bonusCost : 1 };
  };
};

// Spins (a bonus buy with `mode`), clicks through the splashes, and returns
// the log once the round settles. `during(page)` runs while it plays.
async function round(page, mode, during) {
  const expected = await page.evaluate((mode) => window.__expected(mode), mode);
  const start = await page.evaluate(() => globalThis.NightFall.state.balance);
  await page.evaluate((mode) => { void globalThis.NightFall.spin(mode); }, mode);
  const job = during?.(page);
  for (let t = 0; t < 900; t++) {
    const s = await page.evaluate(() => { const sp = document.getElementById('splash'); if (sp.open) document.getElementById('splash-continue').click(); return globalThis.NightFall.state.busy; });
    if (!s) break;
    await page.waitForTimeout(100);
  }
  await job;
  const log = await page.evaluate(() => ({ ...window.__zaps, host: document.getElementById('arrow-effects').children.length, flashes: document.querySelectorAll('.mage-zapped,.mage-lit').length, balance: globalThis.NightFall.state.balance }));
  // The bet is 100 credits; the award is what came back on top of the cost.
  return { expected, log, award: log.balance - start + expected.cost * 100 };
}

const near = (a, b, tol = 1) => Math.hypot(a.x - b.x, a.y - b.y) <= tol;
const ends = (d) => { const n = d.slice(1).split('L').map((p) => p.split(' ').map(Number)); return { first: { x: n[0][0], y: n[0][1] }, last: { x: n.at(-1)[0], y: n.at(-1)[1] } }; };

function assertBolts({ expected, log }, label, { motion = true } = {}) {
  assert.deepEqual(log.plays.map((p) => p.index), expected.cells, `${label}: one bolt per zap, to the engine's cell`);
  assert.equal(log.host, 0, `${label}: the effect layer is empty after the round`);
  assert.equal(log.flashes, 0, `${label}: no flash left on a cell`);
  for (const [k, p] of log.plays.entries()) {
    const at = `${label} zap ${k} (cell ${p.index})`;
    assert.equal(p.after, 'arrow-wild', `${at}: the wild appears on the hit`);
    assert.ok(near(p.origin, p.crystal), `${at}: the bolt leaves ${JSON.stringify(p.origin)}, the crystal lands at ${JSON.stringify(p.crystal)}`);
    assert.ok(near(p.target, p.centre), `${at}: the bolt ends at ${JSON.stringify(p.target)}, the cell's centre is ${JSON.stringify(p.centre)}`);
    assert.ok(p.crystal.y >= 0, `${at}: the crystal is off the top of the screen`);
    for (const f of p.frames) {
      assert.ok(f.svgs <= 1, `${at}: ${f.svgs} bolts on screen`);
      assert.ok(f.wilds <= 1, `${at}: ${f.wilds} mage wilds on the board at once`);
      if (f.left > 0) assert.equal(f.kind, p.before, `${at}: the wild showed before the bolt landed`);
      // The bolt starts on the crystal as it moves, and ends on the cell.
      if (f.d) { const e = ends(f.d); assert.ok(near(e.first, f.crystal, 0.1) && near(e.last, p.centre), `${at}: the bolt path runs ${f.d.slice(0, 40)}…, the crystal is at ${JSON.stringify(f.crystal)}`); }
      if (f.ring) assert.ok(f.ring <= p.half, `${at}: the spark (${f.ring.toFixed(1)}) leaves the cell (${p.half.toFixed(1)})`);
      if (f.spark) assert.equal(f.spark, `translate(${p.target.x} ${p.target.y})`, `${at}: the spark is off the cell`);
    }
    if (motion) {
      assert.ok(p.frames.some((f) => f.left > 0.2), `${at}: the bolt was never seen travelling`);
      assert.ok(p.frames.some((f) => f.ring > p.half * 0.5), `${at}: no spark`);
      assert.equal(p.leftAtHit ?? 0, 0, `${at}: the wild appeared with ${p.leftAtHit} of the bolt still to go`);
    }
  }
}

test('mage zap: one bolt from the crystal to the chosen cell, the wild on the hit, nothing left after', async () => {
  for (const vp of [DESK, MOBILE]) {
    const label = `${vp[0].width}x${vp[0].height}`, page = await open(vp, { seed: BASE });
    const r = await round(page);
    assert.equal(r.expected.cells.length, 1, 'the seed has one base zap');
    assertBolts(r, label);
    assert.equal(r.log.svgs, 1, `${label}: ${r.log.svgs} bolts drawn`);
    assert.equal(r.award, Math.round(r.expected.total * 100), `${label}: the award`);
    assert.deepEqual(page.errors, []);
    await page.ctx.close();
  }
});

test('roaming wild: the one mage wild moves each free spin, one bolt each', async () => {
  for (const vp of [MOBILE, DESK]) {
    const label = `${vp[0].width}x${vp[0].height} bonus`, page = await open(vp, { seed: BONUS, turbo: true });
    // Watch three free spins in turbo, then Skip the rest.
    const r = await round(page, 'regular', async (page) => {
      await page.waitForFunction(() => window.__zaps.plays.length >= 3 && window.__zaps.plays[2].after, null, { timeout: 60000 });
      await page.evaluate(() => { globalThis.NightFall.state.skip = true; });
    });
    assert.equal(r.expected.roams, r.expected.cells.length);
    assert.ok(r.expected.cells.length >= 10, `${label}: ${r.expected.cells.length} zaps`);
    for (let k = 1; k < r.expected.cells.length; k++) assert.notEqual(r.expected.cells[k], r.expected.cells[k - 1], `${label}: the wild stayed on ${r.expected.cells[k]}`);
    assert.equal(r.log.svgs, 3, `${label}: bolts drawn before Skip`);
    // It wins and stays: never cleared like a paid symbol.
    assert.ok(r.expected.roamWins > 0, `${label}: the seed has no win with the roaming wild`);
    assert.equal(r.log.clearedWilds, 0, `${label}: the roaming wild was cleared after a win`);
    assertBolts(r, label, { motion: false });
    for (const p of r.log.plays.slice(0, 3)) assert.ok(p.frames.some((f) => f.left > 0.2), `${label}: the bolt to ${p.index} was never seen travelling`);
    assert.equal(r.award, Math.round(r.expected.total * 100), `${label}: the award`);
    assert.deepEqual(page.errors, []);
    await page.ctx.close();
  }
});

test('turbo, skip, a pause and reduced motion change nothing but the show', async () => {
  const runs = {};
  for (const [name, opts, during] of [
    ['normal', {}],
    ['turbo', { turbo: true }],
    ['skip', {}, async (page) => { await page.waitForTimeout(500); await page.evaluate(() => { globalThis.NightFall.state.skip = true; }); }],
    // Pause (the menu) while the bolt is in flight: it holds where it is.
    ['pause', {}, async (page) => {
      await page.waitForFunction(() => window.__zaps.plays[0]?.frames.some((f) => f.left < 0.9 && f.left > 0), null, { timeout: 30000, polling: 'raf' });
      await page.evaluate(() => document.getElementById('menu').showModal());
      await page.waitForTimeout(400);
      await page.evaluate(() => document.getElementById('menu').close());
    }],
    ['reduced', { reduced: true }],
  ]) {
    const page = await open(MOBILE, { seed: BASE, ...opts });
    const r = await round(page, undefined, during);
    runs[name] = r;
    assertBolts(r, name, { motion: name === 'normal' || name === 'turbo' || name === 'pause' });
    if (name === 'pause') {
      const held = r.log.plays[0].frames.filter((f) => f.paused && f.left !== undefined).map((f) => f.left);
      assert.ok(held.length > 5, `pause: ${held.length} paused frames`);
      assert.ok(Math.max(...held) - Math.min(...held) < 1e-9, `pause: the bolt moved while paused (${held[0]} → ${held.at(-1)})`);
    }
    if (name === 'reduced') {
      assert.equal(r.log.svgs, 0, 'reduced motion: no bolt is drawn');
      assert.ok(r.log.plays[0].lit, 'reduced motion: the cell is highlighted instead');
    }
    assert.deepEqual(page.errors, []);
    await page.ctx.close();
  }
  for (const [name, r] of Object.entries(runs)) {
    assert.deepEqual(r.log.plays.map((p) => p.index), runs.normal.log.plays.map((p) => p.index), `${name}: the zapped cells`);
    assert.equal(r.award, runs.normal.award, `${name}: the award`);
  }
});
