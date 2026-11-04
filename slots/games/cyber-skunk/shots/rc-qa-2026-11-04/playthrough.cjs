// Release play-through on the served build (served index.html + the tested runtime
// files): loading ident, intro/explainer, controls, a Spray Job spray and a full
// Vent Break bonus at normal speed, with exact accounting. Emulated devices only.
const { chromium } = require('playwright');
const fs = require('fs');
const [base, out, device] = [process.argv[2], process.argv[3], process.argv[4]];
const DEVICES = {
  desktop: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
  iphone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' },
  android: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36' },
};
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext(DEVICES[device]);
  const p = await ctx.newPage();
  const errors = [], failed = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('requestfailed', (r) => failed.push(r.url()));
  p.on('response', (r) => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url()); });
  const shot = (name) => p.screenshot({ path: `${out}/${device}-${name}.png` });
  const st = () => p.evaluate(() => window.cyberSkunk.state);
  const control = (a) => p.locator('#controller').locator(`[data-action=${a}]`).first();
  const t0 = Date.now();
  await p.goto(base + 'index.html', { waitUntil: 'commit' });
  await p.waitForTimeout(250); await shot('01-first-frame');          // what a thumbnail capture sees first
  await p.waitForTimeout(1400); await shot('02-ident-lighting');
  await p.waitForTimeout(1900); await shot('03-ident-lit');
  await p.waitForFunction(() => window.cyberSkunk?.state.ready, null, { timeout: 30000 });
  await p.waitForTimeout(600); await shot('04-intro-explainer');
  const intro = await p.evaluate(() => { const img = document.querySelector('#intro .intro-mark'); return { visible: !document.getElementById('intro').hidden, logo: img?.getAttribute('src'), logoLoaded: !!(img?.complete && img.naturalWidth) }; });
  await p.locator('#intro-go').click();
  await p.waitForTimeout(900); await shot('05-base-controls');
  const s0 = await st();
  const controls = await p.evaluate(() => [...document.getElementById('controller').shadowRoot.querySelectorAll('button[data-action]')].filter((b) => b.getClientRects().length).map((b) => { const r = b.getBoundingClientRect(); return { a: b.dataset.action, w: Math.round(r.width), h: Math.round(r.height), in: r.left >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 }; }));

  // A Spray Job spin: the spray at normal speed.
  await control('buy').click();
  await p.locator('[data-view=feature]').click();
  await p.locator('[data-pick=sprayjob]').click();
  await p.waitForTimeout(300);
  await control('play').click();
  let sprayShot = false;
  for (let k = 0; k < 400 && (await st()).busy; k++) {
    if (!sprayShot && await p.evaluate(() => { const c = document.getElementById('jet'); return !!c && c.width > 0 && getComputedStyle(c).opacity !== '0' && document.querySelector('#reels .vent-card.reverse'); })) { await p.waitForTimeout(250); await shot('06-spray'); sprayShot = true; }
    if (!(await p.locator('#bonus-panel').isHidden())) await p.locator('#bonus-panel-go').click().catch(() => {});
    if (!(await p.locator('#bigwin').isHidden())) await p.locator('#win-dismiss').click().catch(() => {});
    await p.waitForTimeout(60);
  }
  await p.waitForFunction(() => !window.cyberSkunk.state.busy, null, { timeout: 120000 });
  await p.waitForTimeout(400); await shot('07-after-spray');
  await control('buy').click(); // Buy turns the feature off
  const s1 = await st();

  // A full Vent Break bonus at normal speed: Start, every free spin, the total.
  await control('buy').click();
  await p.locator('[data-pick=ventbreak]').click();
  await p.waitForTimeout(400); await shot('08-confirm');
  await p.locator('#confirm-ok').click();
  await p.waitForSelector('#bonus-panel:not([hidden])', { timeout: 30000 });
  await p.waitForTimeout(500); await shot('09-bonus-briefing');
  await p.locator('#bonus-panel-go').click();
  let mid = false, total = false;
  for (let k = 0; k < 3000 && (await st()).busy; k++) {
    if (!mid && /FREE SPIN [4-9]/.test(await p.locator('#status').textContent().catch(() => ''))) { await shot('10-free-spins'); mid = true; }
    if (!(await p.locator('#bigwin').isHidden())) {
      if (!total) { await p.waitForTimeout(2500); await shot('11-bonus-total'); total = true; }
      await p.locator('#win-dismiss').click().catch(() => {});
    }
    if (!(await p.locator('#bonus-panel').isHidden())) await p.locator('#bonus-panel-go').click().catch(() => {});
    await p.waitForTimeout(100);
  }
  await p.waitForFunction(() => !window.cyberSkunk.state.busy, null, { timeout: 180000 });
  await p.waitForTimeout(600); await shot('12-settled');
  const s2 = await st();
  const hist = await p.evaluate(() => JSON.parse(localStorage.getItem('cyber-skunk-session-v1')).history);
  // Reload: the settled credits come back.
  await p.reload(); await p.waitForFunction(() => window.cyberSkunk?.state.ready, null, { timeout: 30000 });
  const s3 = await st();
  const result = {
    device, seconds: Math.round((Date.now() - t0) / 1000), intro, controls,
    spray: { shot: sprayShot, cost: hist[1]?.cost, win: hist[1]?.win, mode: hist[1]?.mode },
    bonus: { cost: hist[0]?.cost, win: hist[0]?.win, mode: hist[0]?.mode, tier: hist[0]?.tier, midShot: mid, totalShot: total },
    balances: { start: s0.balance, afterSpray: s1.balance, afterBonus: s2.balance, afterReload: s3.balance },
    exact: s1.balance === s0.balance - hist[1].cost + hist[1].win && s2.balance === s1.balance - hist[0].cost + hist[0].win && s3.balance === s2.balance,
    errors, failed,
  };
  fs.writeFileSync(`${out}/${device}.json`, JSON.stringify(result, null, 1));
  console.log(JSON.stringify(result));
  await b.close();
})();
