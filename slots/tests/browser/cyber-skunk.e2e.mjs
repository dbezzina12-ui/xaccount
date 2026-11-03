// Cyber Skunk in a real browser, desktop and phone: rounds of every way to play
// through the real controller and buy screen, with no page errors, the money
// matching the round history, the buy screen's order and its confirmation,
// and skip leaving no overlay behind. Also the audio mix, rendered offline by
// tools/audio/cyber-skunk-levels.mjs: nothing clips, nothing is buried.
//
//   node --test tests/browser/cyber-skunk.e2e.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { serve, chromium } from '../../tools/lib/browser.mjs';
import { measure } from '../../tools/audio/cyber-skunk-levels.mjs';

const GAME = 'games/cyber-skunk/runtime/index.html', KEY = 'cyber-skunk-session-v1', START = 1_000_000;
let srv, browser;
before(async () => { srv = await serve(); browser = await chromium(); });
after(async () => { await browser?.close(); srv?.close(); });

async function open({ width, height, session = null }) {
  const phone = width < height, page = await browser.newPage({ viewport: { width, height }, isMobile: phone, hasTouch: phone });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  if (session) await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [KEY, JSON.stringify(session)]);
  await page.goto(srv.url + GAME);
  await page.waitForFunction(() => window.cyberSkunk?.state.ready);
  if (await page.locator('#intro').isVisible()) await page.locator('#intro-go').click();
  return { page, errors };
}
const state = (page) => page.evaluate(() => window.cyberSkunk.state);
const control = (page, action) => page.locator(`[data-action=${action}]`).first();
// Presses Stop until the round settles: skip must always finish it. The
// check and the press happen in one step in the page, so a press can never
// land just after the round ends and start a new one.
async function finish(page) {
  for (let k = 0; k < 400 && (await state(page)).busy; k++) {
    if (!(await page.locator('#bonus-panel').isHidden())) await page.locator('#bonus-panel-go').click().catch(() => {});
    else await page.evaluate(() => { if (window.cyberSkunk.state.busy) document.getElementById('controller').shadowRoot.querySelector('[data-action=play]')?.click(); });
    await page.waitForTimeout(60);
  }
  await page.waitForFunction(() => !window.cyberSkunk.state.busy, null, { timeout: 30000 });
}
const history = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)).history, KEY);

for (const [label, size] of [['desktop', { width: 1366, height: 768 }], ['phone', { width: 390, height: 844 }]]) {
  test(`${label}: base, Spray Job, Vent Break and Overpressure settle exactly`, async () => {
    const { page, errors } = await open(size);
    await control(page, 'play').click();
    await finish(page);
    // Spray Job on, one spin, off again.
    await control(page, 'buy').click();
    await page.locator('[data-view=feature]').click();
    await page.locator('[data-pick=sprayjob]').click();
    assert.ok(await page.locator('#confirm').isHidden());
    assert.equal((await state(page)).feature, 'sprayjob');
    await control(page, 'play').click();
    await page.waitForTimeout(400);
    await finish(page);
    await control(page, 'buy').click();
    assert.equal((await state(page)).feature, null, 'Buy turns a feature off');
    for (const mode of ['ventbreak', 'overpressure']) {
      await control(page, 'buy').click();
      await page.locator(`[data-pick=${mode}]`).click();
      await page.locator('#confirm-ok').click();
      await page.waitForSelector('#bonus-panel:not([hidden])', { timeout: 20000 });
      await finish(page);
    }
    const rounds = await history(page), s = await state(page);
    assert.deepEqual(rounds.map((r) => r.mode).reverse(), ['base', 'sprayjob', 'ventbreak', 'overpressure']);
    assert.equal(s.balance, START + rounds.reduce((a, r) => a - r.cost + r.win, 0), 'balance = start - costs + wins');
    assert.deepEqual(rounds.map((r) => r.cost).reverse(), [100, 1000, 10000, 25000]);
    for (const r of rounds) assert.ok(Number.isInteger(r.win) && r.win >= 0);
    assert.ok(rounds.slice(0, 2).every((r) => r.tier), 'the buys play their bonus');
    // Nothing left on screen after skipping.
    assert.ok(await page.locator('#bonus-panel').isHidden());
    assert.ok(await page.locator('#bigwin').isHidden());
    assert.ok(await page.locator('#bonus-hud').isHidden());
    assert.deepEqual(errors, []);
    await page.close();
  });
}

test('phone pressure strip fits the lower casting above the bonus panels', async () => {
  for (const [width, height] of [[360, 640], [360, 800], [390, 844], [430, 932]]) {
    const { page } = await open({ width, height });
    try {
      // Exercise the longest labels and maximum win without waiting for a rare draw.
      await page.evaluate(() => {
        document.querySelector('#bonus-hud').hidden = false;
        document.querySelector('#hud-tier').textContent = 'BLACKOUT PROTOCOL';
        document.querySelector('#hud-spins').textContent = '10 / 10';
        document.querySelector('#hud-win').textContent = '12,500,000.00';
      });
      const box = (selector) => page.locator(selector).boundingBox();
      const cabinet = await box('#cabinet'), dial = await box('.gauge'), readout = await box('#pressure-meter .gauge-readout');
      const spins = await box('#bonus-hud > span:first-child'), win = await box('#bonus-hud > span:last-child');
      const controller = await box('#controller');
      assert.equal(await page.locator('#cabinet > #pressure-meter').count(), 1);
      const reels = await box('#reels');
      assert.ok(dial.y >= reels.y + reels.height && dial.y + dial.height <= cabinet.y + cabinet.height, 'strip sits in the lower casting');
      assert.ok(readout.y >= dial.y && readout.y + readout.height < dial.y + dial.height, 'readout fits inside rail housing');
      assert.ok(dial.y + dial.height < controller.y, 'entire gauge clears controls');
      assert.ok(Math.min(spins.y, win.y) > dial.y + dial.height, 'bonus panels clear the pressure strip');
      for (const id of ['#hud-tier', '#hud-win']) {
        const label = await box(id), panel = id === '#hud-tier' ? spins : win;
        assert.ok(label.x >= panel.x && label.x + label.width <= panel.x + panel.width, 'bonus text fits its panel');
      }
      assert.ok((await control(page, 'bet').boundingBox()).height >= 44);
      await control(page, 'bet').click();
      assert.ok(await page.locator('#bet-picker').isVisible());
      await page.locator('[data-close=bet-picker]').click();
      const stake = (await state(page)).bet;
      await control(page, 'betPlus').click();
      assert.ok((await state(page)).bet > stake);
      await control(page, 'betMinus').click();
      assert.equal((await state(page)).bet, stake);
      assert.ok(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight));
    } finally {
      await page.close();
    }
  }
});

test('vents: full symbol lands, centred reverse flips for spray, skip restores the paying face', async () => {
  const { page, errors } = await open({ width: 390, height: 844 });
  assert.equal(await page.locator('.tier-strip').count(), 0, 'no persistent bonus ladder');
  await control(page, 'buy').click();
  await page.locator('[data-view=feature]').click();
  await page.locator('[data-pick=sprayjob]').click();
  assert.ok(await page.locator('#confirm').isHidden());
  await control(page, 'play').click();
  await page.waitForFunction(() => document.querySelector('#reels .reel.spinning'));
  assert.equal(await page.locator('#reels .reel.spinning .reverse').count(), 0, 'spinning cards show their normal face');
  await page.waitForSelector('#reels .vent-card.reverse');
  const reverse = await page.locator('#reels .vent-card.reverse').evaluateAll((cards) => cards.map((card) => {
    const front = card.querySelector('.card-front'), back = card.querySelector('.card-back');
    const c = card.getBoundingClientRect(), v = back.querySelector('.vent-art').getBoundingClientRect();
    const symbol = getComputedStyle(front.querySelector('.sym'));
    return { separate: !!front.querySelector('.sym') && !front.querySelector('.vent-art'), hiddenBack: getComputedStyle(back).backfaceVisibility,
      fullSize: symbol.scale === 'none' && symbol.translate === 'none',
      contained: v.left >= c.left && v.right <= c.right && v.top >= c.top && v.bottom <= c.bottom };
  }));
  assert.ok(reverse.length >= 3, 'Spray Job flips at least three vents');
  for (const c of reverse) assert.deepEqual(c, { separate: true, hiddenBack: 'hidden', fullSize: true, contained: true });
  await finish(page); // skip while reverse is visible, then check the settled result
  assert.equal(await page.locator('#reels .cell').count(), 24);
  assert.equal(await page.locator('#reels .cell[data-i].landed').count(), 24);
  assert.equal(await page.locator('#reels .reverse').count(), 0, 'no card is stranded on its reverse');
  assert.ok(await page.locator('#reels .wild .sym').count() > 0, 'sprayed cards expose their WILD face');
  const rounds = await history(page), s = await state(page);
  assert.equal(s.balance, START - rounds[0].cost + rounds[0].win, 'skip preserves accounting');
  await control(page, 'settings').click();
  await page.locator('#menu-rules').click();
  const fs = page.locator('#rules .scatter-letters');
  assert.equal(await fs.getAttribute('alt'), 'FS');
  assert.ok(await fs.evaluate((el) => el.currentSrc.endsWith('/fs-amethyst.webp') && el.naturalWidth === 512));
  assert.deepEqual(errors, []);
  await page.close();
});

test('buy screen: Feature Spins first, Bonus Buys second, Hidden as information; short balance disables confirm', async () => {
  const { page, errors } = await open({ width: 1366, height: 768, session: { balance: 5000, bet: 100 } });
  await control(page, 'buy').click();
  assert.ok(await page.locator('#bonus-section').isVisible());
  assert.ok(await page.locator('#feature-section').isHidden());
  assert.deepEqual(await page.locator('#feature-cards [data-pick]').evaluateAll((b) => b.map((x) => x.dataset.pick)), ['enhanced', 'sprayjob']);
  assert.deepEqual(await page.locator('#bonus-cards [data-pick]').evaluateAll((b) => b.map((x) => x.dataset.pick)), ['ventbreak', 'overpressure', 'mystery']);
  assert.ok(await page.locator('[data-pick=mystery]').isDisabled());
  assert.equal(await page.locator('.hidden-tier [data-pick]').count(), 0, 'Blackout Protocol is not for sale');
  // $50 cannot pay for a $250 Overpressure: the card and the confirmation both refuse.
  assert.ok(await page.locator('[data-pick=overpressure]').isDisabled());
  await page.locator('[data-view=feature]').click();
  assert.match(await page.locator('[data-mode=enhanced].offer').innerText(), /4\.63× bonus chance/i);
  for (const mode of ['enhanced', 'sprayjob']) {
    await page.locator('[data-pick='+mode+']').click();
    assert.ok(await page.locator('#confirm').isHidden());
    assert.ok(await page.locator('#buy-menu').isHidden());
    assert.equal((await state(page)).feature, mode);
    assert.equal((await state(page)).balance, 5000, 'activation charges nothing');
    await control(page, 'buy').click();
    assert.equal((await state(page)).feature, null);
    if (mode === 'enhanced') {
      await control(page, 'buy').click();
      await page.locator('[data-view=feature]').click();
    }
  }
  assert.deepEqual(errors, []);
  await page.close();
});

test('the intro shows before the first spin, and returns on reload', async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.goto(srv.url + GAME);
  await page.waitForSelector('#intro:not([hidden])');
  const go = await page.locator('#intro-go').boundingBox();
  assert.ok(go && go.y + go.height <= 844, 'Play is on screen without scrolling');
  assert.equal(await page.locator('.guide-board:visible i').count(),24);
  await page.locator('#intro-go').click();
  assert.ok(await page.locator('#intro').isHidden());
  await page.reload();
  await page.waitForFunction(() => window.cyberSkunk?.state.ready);
  assert.ok(await page.locator('#intro').isVisible(), 'guide returns after reload');
  await page.close();
});

test('the feature guide pages on phones and can be reopened from the menu', async () => {
  for (const [width, height] of [[360, 640], [390, 844], [430, 932], [1366, 768]]) {
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: width < 760 });
    try {
      await page.goto(srv.url + GAME + '?intro=1');
      await page.waitForSelector('#intro:not([hidden])');
      const visible = page.locator('.intro-card:visible');
      assert.equal(await visible.count(), width < 760 ? 1 : 3);
      const enter = await page.locator('#intro-go').boundingBox();
      assert.ok(enter.y + enter.height <= height);
      if (width === 390) await page.screenshot({ path: '/tmp/cyber-skunk-feature-guide.png', animations: 'disabled' });
      if (width < 760) {
        await page.locator('#guide-next').click();
        assert.equal(await visible.locator('h3').textContent(), 'Backpressure');
        await page.locator('#guide-next').press('ArrowRight');
        assert.equal(await visible.locator('h3').textContent(), 'The Reservoir');
        await page.locator('.guide-dots button').first().click();
        assert.equal(await visible.locator('h3').textContent(), 'Free Spins');
      }
      await page.locator('#intro-go').click();
      await control(page, 'settings').click();
      await page.locator('#menu-guide').click();
      assert.ok(await page.locator('#intro').isVisible());
    } finally { await page.close(); }
  }
});
test('the rules show the shipping prices and 96% RTP', async () => {
  const { page } = await open({ width: 1366, height: 768 });
  await control(page, 'settings').click();
  await page.locator('#menu-rules').click();
  const text = await page.locator('#rules-body').textContent();
  for (const s of ['96.00%', '25,000×', 'VENT BREAK', 'OVERPRESSURE', 'BLACKOUT PROTOCOL', '100× base bet', '250× base bet', '3× base bet per spin', '10× base bet per spin']) assert.ok(text.includes(s), s);
  await page.close();
});

test('audio: nothing clips, the music sits under the reels, the big moments are loudest, phones hear the reels', async () => {
  const { music, effects, mix } = await measure();
  for (const [name, v] of [...Object.entries(music), ...Object.entries(effects), ['mix', mix]]) assert.ok(v.peak <= -1, `${name} peaks at ${v.peak} dBFS after the limiter`);
  for (const t of ['base', 'bonus', 'hidden']) assert.ok(music[t].i >= -27 && music[t].i <= -21, `${t} music at ${music[t].i} LUFS`);
  const reel = ['click', 'tick', 'spin', 'stop', 'vent-land', 'paint'], big = ['bonus-in', 'bigwin', 'max'];
  for (const [name, v] of Object.entries(effects)) assert.ok(v.m >= -33, `${name} is buried at ${v.m} LUFS`);
  for (const b of big) for (const r of reel) assert.ok(effects[b].m >= effects[r].m + 8, `${b} not clearly above ${r}`);
  const loudest = Math.max(...Object.values(effects).map((v) => v.m));
  for (const b of ['bigwin', 'max']) assert.ok(effects[b].m >= loudest - 0.5, `${b} is not the loudest effect`);
  // A phone speaker loses the thumps; the reel sounds must still reach the music's level there.
  for (const r of reel) assert.ok(effects[r].phone >= music.base.phone - 6, `${r} at ${effects[r].phone} on a phone, music at ${music.base.phone}`);
});

// Rare outcomes through the real UI. The page's random tickets are steered so
// drawRound lands on a chosen catalog row; the round is still drawn, replayed
// and checked by the game exactly as in play.
const STEER = () => {
  window.__tickets = [];
  const real = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = (a) => {
    if (!(a instanceof Uint32Array && a.length === 2 && window.__tickets.length)) return real(a);
    const { t, total } = window.__tickets.shift(), x = Math.floor(((t + 0.5) / total) * 2 ** 53);
    a[0] = Math.floor(x / 2 ** 21); a[1] = (x % 2 ** 21) * 2 ** 11;
    return a;
  };
  // What the round showed, however briefly.
  window.__seen = new Set();
  new MutationObserver(() => {
    const app = document.getElementById('app'), big = document.getElementById('bigwin');
    if (app && 'blackout' in app.dataset) window.__seen.add('blackout');
    if (big && !big.hidden) window.__seen.add(`bigwin-${big.dataset.tier}`);
    if (document.getElementById('reel-banner')?.hidden === false) window.__seen.add('banner');
  }).observe(document, { subtree: true, attributes: true, attributeFilter: ['hidden', 'data-blackout', 'data-tier'] });
};
// Queues the tickets for one outcome and returns its value (hundredths of the bet).
const steer = (page, kind) => page.evaluate(async (kind) => {
  const { default: d } = await import('./catalog-data.js'), { playRound, seeded } = await import('./engine.js');
  const start = (pool, i) => d.pools[pool].slice(0, i).reduce((a, r) => a + r[1], 0), T = (t) => ({ t, total: d.total });
  if (kind === 'blackout') {
    const { none, regular, super: sup } = d.modes.base.tiers, rows = d.pools['bonus-hidden'];
    const b = rows.reduce((k, r, i) => (r[2] > rows[k][2] ? i : k), 0);
    window.__tickets.push(T(none + regular + sup), T(0), T(start('bonus-hidden', b)));
    return Math.min(d.cap, d.pools['entry-base-hidden'][0][2] + rows[b][2]);
  }
  if (kind === 'cap') {
    const i = d.pools['bonus-super'].findIndex((r) => r[2] === d.cap);
    window.__tickets.push(T(start('bonus-super', i)));
    return d.cap;
  }
  const rows = d.pools['bonus-regular'];
  const i = rows.findIndex((r) => playRound({ mode: 'ventbreak', rng: seeded(r[0]) }).events.some((e) => e.type === 'retrigger'));
  window.__tickets.push(T(start('bonus-regular', i)));
  return rows[i][2];
}, kind);

for (const [width,height] of [[360,640],[390,844],[430,932],[1366,768]]) test(`natural FS trigger fits at rest and during its landing pulse (${width}×${height})`, async () => {
  const page = await browser.newPage({viewport:{width,height},isMobile:width<760,hasTouch:width<760});
  try {
    await page.addInitScript(STEER);
    await page.goto(srv.url + GAME);
    await page.locator('#intro-go').click();
    await steer(page, 'blackout');
    await control(page, 'play').click();
    await page.waitForFunction(() => document.querySelectorAll('#fs-faces .fs-raised').length >= 5);
    const visible = await page.locator('#fs-faces .fs-raised').evaluateAll(faces => faces.every(face => {
      const cell = document.querySelector('.cell[data-i="' + face.dataset.cell + '"]'), img = face.querySelector('img');
      const tile = cell.getBoundingClientRect(), box = face.getBoundingClientRect();
      return img.complete && img.naturalWidth === 512 && getComputedStyle(cell.querySelector('.sym')).visibility === 'hidden'
        && box.width > tile.width && Math.abs((box.left+box.width/2)-(tile.left+tile.width/2)) < 2;
    }));
    assert.ok(visible);
    if (width === 390) await page.screenshot({path:'/tmp/fs-raised-verified.png'});
  } finally { await page.close(); }
});
test('loading precedes the guide, category buttons switch, and Mystery settles once', async () => {
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  try {
    await page.addInitScript(STEER);
    let resume;
    const gate=new Promise(resolve => {resume=resolve});
    await page.route('**/app.js?v=*',async route=>{await gate;await route.continue();});
    await page.goto(srv.url+GAME,{waitUntil:'domcontentloaded'});
    await page.locator('#loading-screen').waitFor();
    assert.ok(await page.locator('#app').evaluate(app=>app.inert));
    await page.screenshot({path:'/tmp/cyber-real-loading.png'});
    resume();
    await page.locator('#intro-go').click();
    assert.ok(await page.locator('#loading-screen').isHidden());
    await control(page,'buy').click();
    await page.locator('[data-view=feature]').click();
    assert.ok(await page.locator('[data-pick=sprayjob]').isVisible());
    assert.ok(await page.locator('[data-pick=mystery]').isHidden());
    await page.locator('[data-view=bonus]').click();
    await page.screenshot({path:'/tmp/cyber-real-buy.png'});
    await page.locator('[data-pick=mystery]').click();
    await page.locator('#confirm[open]').waitFor();
    assert.equal(await page.locator('#confirm-total').textContent(),'$500.00');
    await page.locator('#confirm-cancel').click();
    assert.ok(await page.locator('[data-pick=mystery]').isVisible());
    assert.equal((await state(page)).balance,START);
    await page.locator('[data-pick=mystery]').click();
    await page.evaluate(()=>window.__tickets.push({t:950000000,total:1000000000},{t:0,total:1000000000}));
    await page.locator('#confirm-ok').click();
    await page.locator('#bonus-panel-go').waitFor();
    assert.equal(await page.locator('#bonus-panel-title img').getAttribute('alt'),'BLACKOUT PROTOCOL');
    assert.equal(await page.locator('#bonus-panel-kicker').textContent(),'MYSTERY BUY REVEALS');
    assert.equal((await state(page)).balance,START-50000);
    await page.reload();
    await page.waitForFunction(()=>window.cyberSkunk?.state.ready);
    const [round]=await history(page);
    assert.equal(round.mode,'mystery');assert.equal(round.tier,'hidden');assert.equal(round.cost,50000);
    assert.equal((await state(page)).balance,START-50000+round.win);
    await page.reload();await page.waitForFunction(()=>window.cyberSkunk?.state.ready);
    assert.equal((await history(page)).length,1);
  } finally {await page.close();}
});
test('Mystery purchase finishes through the controller and credits the exact win', async () => {
  const {page,errors}=await open({width:1366,height:768,session:{speed:'turbo',introHidden:true}});
  try {
    await control(page,'buy').click();await page.locator('[data-pick=mystery]').click();
    await page.locator('#confirm-ok').click();await page.locator('#bonus-panel-go').waitFor();
    await finish(page);const [round]=await history(page);
    assert.equal(round.mode,'mystery');assert.equal(round.cost,50000);assert.ok(round.seed.tier===round.tier);
    assert.equal((await state(page)).balance,START-round.cost+round.win);
    assert.deepEqual(errors,[]);
  } finally {await page.close();}
});
test('failed startup offers a working reload', async () => {
  const page=await browser.newPage({viewport:{width:1366,height:768}});
  try {
    await page.route('**/app.js?v=*',r=>r.abort());await page.goto(srv.url+GAME);
    await page.locator('#load-retry').waitFor(); await page.unroute('**/app.js?v=*');
    await page.locator('#load-retry').click();await page.locator('#intro-go').waitFor();assert.ok(await page.locator('#loading-screen').isHidden());
  } finally {await page.close();}
});
for (const [kind, mode, size, shows] of [
  ['blackout', 'base', { width: 1920, height: 1080 }, ['blackout', 'bigwin-max']],
  ['cap', 'overpressure', { width: 390, height: 844 }, ['bigwin-max']],
  ['retrigger', 'ventbreak', { width: 1366, height: 768 }, ['banner']],
]) {
  test(`rare path, ${kind} (${size.width}×${size.height}): plays, shows ${shows.join(' and ')}, settles exactly, and the page never scrolls`, async () => {
    const phone = size.width < size.height, page = await browser.newPage({ viewport: size, isMobile: phone, hasTouch: phone });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [KEY, JSON.stringify({ introHidden: true, speed: 'turbo' })]);
    await page.addInitScript(STEER);
    await page.goto(srv.url + GAME);
    await page.waitForFunction(() => window.cyberSkunk?.state.ready);
    await page.locator('#intro-go').click();
    const value = await steer(page, kind);
    if (mode === 'base') await control(page, 'play').click();
    else { await control(page, 'buy').click(); await page.locator(`[data-pick=${mode}]`).click(); await page.locator('#confirm-ok').click(); }
    await page.waitForTimeout(400);
    await finish(page);
    const [round] = await history(page), s = await state(page), seen = await page.evaluate(() => [...window.__seen]);
    assert.equal(round.mode, mode);
    assert.equal(round.win, value, 'paid the steered catalog value at a $1 bet');
    assert.equal(s.balance, START - round.cost + round.win);
    for (const x of shows) assert.ok(seen.includes(x), `${x} was shown (saw ${seen.join(', ')})`);
    assert.equal(await page.evaluate(() => { const app = document.getElementById('app'); app.scrollTop = 120; return app.scrollTop; }), 0, 'the game area cannot scroll');
    assert.deepEqual(errors, []);
    await page.close();
  });
}

test('a reload mid-bonus loses nothing: the round is paid on the next visit and kept in history', async () => {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(([k, v]) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem(k, v); } }, [KEY, JSON.stringify({ introHidden: true })]);
  await page.addInitScript(STEER);
  await page.goto(srv.url + GAME);
  await page.waitForFunction(() => window.cyberSkunk?.state.ready);
  await page.locator('#intro-go').click();
  const value = await steer(page, 'cap');
  await control(page, 'buy').click(); await page.locator('[data-pick=overpressure]').click(); await page.locator('#confirm-ok').click();
  await page.waitForSelector('#bonus-panel:not([hidden])', { timeout: 20000 });
  assert.equal((await state(page)).balance, START - 25000, 'mid-round, only the cost has moved');
  await page.reload();
  await page.waitForFunction(() => window.cyberSkunk?.state.ready);
  const [round] = await history(page), s = await state(page);
  assert.equal(s.balance, START - 25000 + value, 'the win was paid on reload');
  assert.deepEqual([round.mode, round.cost, round.win], ['overpressure', 25000, value]);
  assert.equal(s.pending, null);
  assert.match(await page.locator('#toast').textContent(), /finished while you were away: WIN \$25,000\.00/);
  // A second reload pays nothing more.
  await page.reload();
  await page.waitForFunction(() => window.cyberSkunk?.state.ready);
  assert.equal((await state(page)).balance, START - 25000 + value);
  assert.equal((await history(page)).length, 1);
  assert.deepEqual(errors, []);
  await page.close();
});

test('Zombify shop sections and free previews preserve credits and history', async () => {
  for (const size of [{width:390,height:844},{width:1366,height:768}]) {
    const {page, errors} = await open({...size, session:{speed:'turbo'}});
    try {
      await control(page,'buy').click();
      await page.screenshot({path:'/tmp/cyber-shop-'+size.width+'.png'});
      await page.locator('[data-view=preview]').click();
      await page.locator('[data-preview=hidden]').click();
      await page.locator('#bonus-panel-go').waitFor();
      assert.equal(await page.locator('#bonus-panel-kicker').textContent(),'FREE PREVIEW');
      await finish(page);
      assert.equal((await state(page)).balance,START);
      assert.equal((await state(page)).pending,null);
      assert.ok(await page.locator('#buy-menu').isVisible());
      assert.equal(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).history?.length||0,KEY),0);
      assert.deepEqual(errors,[]);
    } finally { await page.close(); }
  }
});
test('studio ident advances to a gated guide on slow loads', async () => {
  const page = await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  let release;
  const gate = new Promise(resolve=>{release=resolve});
  try {
    await page.route('**/assets/symbols/a.webp*', async route=>{await gate;await route.continue();});
    await page.goto(srv.url+GAME,{waitUntil:'domcontentloaded'});
    await page.locator('.studio-monogram').waitFor();
    assert.equal(await page.locator('#loading-screen canvas, #studio-mascot').count(),0);
    await page.waitForTimeout(3200);
    await page.screenshot({path:'/tmp/cyber-studio-ident.png'});
    await page.locator('#intro:not([hidden])').waitFor();
    assert.ok(await page.locator('#intro-go').isDisabled());
    assert.ok(await page.locator('#guide-loading').isVisible());
    release();
    await page.locator('#intro-go').click();
    assert.ok(await page.locator('#intro').isHidden());
  } finally {release();await page.close();}
});
test('polished shop and single unboxed bonus result on phones and desktop', async () => {
  for (const [width,height] of [[360,640],[1366,768]]) {
    const {page,errors}=await open({width,height,session:{speed:'turbo'}});
    try {
      await control(page,'buy').click();
      const shots='/tmp/';
      await page.screenshot({path:shots+'dispatch-shop-'+width+'.png'});
      assert.equal(await page.locator('.offer:visible').count(),3);
      assert.equal(await page.locator('.shop-options').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);
      await page.locator('[data-view=feature]').click();
      assert.equal(await page.locator('.offer:visible').count(),2);
      await page.locator('[data-view=bonus]').click();
      await page.locator('[data-pick=overpressure]').click();
      await page.locator('#confirm-cancel').click();
      assert.equal((await state(page)).balance,START);
      await page.addInitScript(STEER);
      await page.reload();await page.locator('#intro-go').click();
      const expected=await steer(page,'cap');
      await control(page,'buy').click();
      await page.locator('[data-pick=overpressure]').click();
      await page.locator('#confirm-ok').click();
      await page.locator('#bonus-panel-go').click();
      const skipToWin=setInterval(()=>page.evaluate(()=>{
        if(window.cyberSkunk.state.busy && document.getElementById('bigwin').hidden)
          document.getElementById('controller').shadowRoot.querySelector('[data-action=play]').click();
      }).catch(()=>{}),100);
      try {
        await page.locator('#bigwin[data-scope="bonus-total"]:not([hidden])').waitFor({timeout:90000});
        assert.equal(await page.locator('#bigwin-title').textContent(),'MAX WIN');
        assert.equal(await page.locator('#bigwin-title img').count(),0);
        const win=await page.locator('#bigwin').boundingBox(), reels=await page.locator('#reels').boundingBox();
        assert.ok(['x','y','width','height'].every(k=>Math.abs(win[k]-reels[k])<1));
        assert.ok(await control(page,'play').isVisible());
        await page.waitForTimeout(280);
        await page.screenshot({path:shots+'dispatch-win-'+width+'.png'});
      } finally {clearInterval(skipToWin);}
      await page.waitForFunction(()=>!window.cyberSkunk.state.busy);
      assert.equal((await state(page)).balance,START-25000+expected);
      assert.deepEqual(errors,[]);
    } finally {await page.close();}
  }
});

test('scatter landing precedes the held bonus briefing on every entry path', async () => {
  const cases = [
    ['ventbreak',null,3,'VENT BREAK'], ['overpressure',null,4,'OVERPRESSURE'],
    // Mystery: Overpressure for tickets below 900,000,000 (rules.js MYSTERY_TIERS), Blackout above; never Vent Break.
    ['mystery',0,4,'OVERPRESSURE'], ['mystery',899999999,4,'OVERPRESSURE'],
    ['mystery',900000000,5,'BLACKOUT PROTOCOL'], ['base',null,5,'BLACKOUT PROTOCOL'],
  ];
  for (const [mode,ticket,count,title] of cases) {
    const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    try {
      await page.addInitScript(STEER);
      await page.goto(srv.url+GAME);
      await page.locator('#intro-go').click();
      await page.evaluate(() => {
        window.entryPhases = [];
        const dialog = document.getElementById('buy-stinger');
        new MutationObserver(() => window.entryPhases.push(dialog.dataset.phase))
          .observe(dialog, { attributes:true, attributeFilter:['data-phase'] });
      });
      if (mode === 'base') {
        await steer(page,'blackout');
        await control(page,'play').click();
      } else {
        await control(page,'buy').click();
        await page.locator('[data-pick='+mode+']').click();
        if (ticket !== null) await page.evaluate(t=>window.__tickets.push({t,total:1000000000},{t:0,total:1000000000}),ticket);
        await page.locator('#confirm-ok').click();
      }
      await page.locator('#reels .spinning').first().waitFor();
      assert.ok(await page.locator('#buy-stinger').isHidden());
      await page.waitForFunction(n=>document.querySelectorAll('#fs-faces .fs-raised').length===n && !document.querySelector('#reels .spinning'),count);
      assert.ok(await page.locator('#bonus-panel').isHidden());
      await page.locator('#buy-stinger[open][data-phase=sealed] #bonus-panel-go').waitFor();
      assert.deepEqual(await page.evaluate(() => window.entryPhases),
        count === 5 ? ['power-cut','emergency','charging','sealed'] : ['charging','sealed']);
      assert.equal(await page.locator('#bonus-panel-title img').getAttribute('alt'),title);
      assert.equal(await page.locator('#bonus-panel-award').textContent(),(count===3?'12':'10')+' FREE SPINS');
      await page.waitForTimeout(650);
      assert.equal(await page.locator('#buy-stinger').getAttribute('data-phase'),'sealed');
      const awardLayout=await page.locator('#bonus-panel-award').evaluate(el=>{
        const viewport=el.closest('dialog').getBoundingClientRect(),line=el.getBoundingClientRect();
        const digits=document.createRange();digits.selectNodeContents(el.firstChild);
        const ink=digits.getBoundingClientRect(),unit=el.querySelector('small').getBoundingClientRect();
        const rules=document.querySelector('#bonus-panel-text').getBoundingClientRect();
        const start=document.querySelector('#bonus-panel-go').getBoundingClientRect();
        return {rulesGap:rules.top-unit.bottom,buttonGap:start.top-rules.bottom,dx:ink.left+ink.width/2-viewport.left-viewport.width/2,
          dy:line.top+line.height/2-viewport.top-viewport.height/2,stacked:unit.top>=line.bottom};
      });
      assert.ok(Math.abs(awardLayout.dx)<1&&Math.abs(awardLayout.dy)<1);
      assert.ok(awardLayout.stacked);
      assert.ok(awardLayout.rulesGap>=0 && awardLayout.rulesGap<=26);
      assert.ok(awardLayout.buttonGap>=0 && awardLayout.buttonGap<=26);
      await page.locator('#bonus-panel-go').click();
      await page.locator('#buy-stinger').waitFor({state:'hidden'});
      assert.ok(await page.locator('#bonus-hud').isVisible());
    } finally {await page.close();}
  }
});

test('tier popups use each spin payout on the winning board, and the bonus has a separate total', async () => {
  for (const bonus of [false, true]) {
    const page = await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    try {
      await page.addInitScript(STEER);
      await page.addInitScript(k=>localStorage.setItem(k,JSON.stringify({speed:'turbo'})),KEY);
      await page.goto(srv.url+GAME); await page.locator('#intro-go').click();
      const expected = await page.evaluate(async bonus => {
        const {default:d} = await import('./catalog-data.js');
        const {playRound,seeded} = await import('./engine.js');
        const pool = d.pools[bonus?'bonus-regular':'spin-base'];
        // This bought round has small wins between Nice, Big, Epic and Mythic spins.
        const i = pool.findIndex(([seed,,paid])=> bonus ? seed===1057196 : paid>=2500 && paid<10000);
        if (i<0) throw Error('Missing test round');
        const [seed,,total] = pool[i];
        const queue = t=>window.__tickets.push({t,total:d.total});
        if (!bonus) queue(0);
        queue(pool.slice(0,i).reduce((s,row)=>s+row[1],0));
        const round = playRound(bonus ? {mode:'ventbreak',rng:seeded(seed)} : {mode:'base',rng:seeded(seed)});
        const tier = p=>p>=50000?'MYTHIC WIN':p>=10000?'EPIC WIN':p>=2500?'BIG WIN':'NICE WIN';
        const basis = p=>(p/100).toLocaleString('en-US',{maximumFractionDigits:1})+'× BASE BET';
        window.winLog=[];
        const el=document.getElementById('bigwin');
        new MutationObserver(()=>{
          if (el.hidden) return;
          window.winLog.push([el.dataset.scope,document.getElementById('bigwin-title').textContent,
            document.getElementById('win-basis').textContent,document.getElementById('win-context').textContent,
            !!document.querySelector('#reels .cell.win')]);
        }).observe(el,{attributes:true,attributeFilter:['hidden']});
        return { total, popups:round.events.filter(e=>e.type==='wins'&&e.paid>=1000).map(e=>[
          'spin',tier(e.paid),basis(e.paid),bonus?'FREE SPIN '+e.spin+' OF '+e.of:'LINE WIN',true]) };
      },bonus);
      if(bonus) {
        await control(page,'buy').click();await page.locator('[data-pick=ventbreak]').click();await page.locator('#confirm-ok').click();await page.locator('#bonus-panel-go').click();
        await page.locator('#bigwin[data-tier=epic][data-scope=spin]:visible').waitFor({timeout:100000});
        await page.waitForFunction(()=>document.getElementById('bigwin-amount').textContent==='$106.60');
      } else await control(page,'play').click();
      await page.waitForFunction(()=>!window.cyberSkunk.state.busy,null,{timeout:100000});
      const log=await page.evaluate(()=>window.winLog);
      assert.deepEqual(log.filter(x=>x[0]==='spin'),expected.popups);
      assert.equal(log.filter(x=>x[0]==='bonus-total').length,bonus?1:0);
      if(bonus) assert.equal(log.at(-1)[0],'bonus-total');
      assert.equal((await history(page))[0].win,expected.total);
      assert.equal((await state(page)).balance,START-(bonus?10000:100)+expected.total);
    } finally {await page.close();}
  }
});
