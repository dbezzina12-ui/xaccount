// The S-06 checklist against the real Zombify runtime: real art, outcome
// catalogs and rounds, inside the real studio editor; and (9) the Sounds tab,
// measured at the game's audio output. Skips on a checkout
// without the `npm run studio:prepare` assets. STUDIO_SHOTS=<dir> also saves
// a screenshot per check.
//
//   npm run test:studio-browser

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomFillSync } from 'node:crypto';
import { crc32, deflateSync } from 'node:zlib';
import { serve, chromium } from '../../tools/lib/browser.mjs';
import { AGENT_TOOLS, runtime, project, agentEdit, isBusy, whenReady, until, prepared } from './helpers.mjs';

const skip = prepared ? false : 'needs the Zombify assets: npm run studio:prepare';
const SHOTS = process.env.STUDIO_SHOTS && resolve(process.env.STUDIO_SHOTS);
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const shot = (page, name) => SHOTS && page.screenshot({ path: join(SHOTS, `${name}.jpg`), type: 'jpeg', quality: 80 });

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

async function openStudio(context, init) {
  const ctx = context ?? (await browser.newContext({ viewport: { width: 1440, height: 900 } }));
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.addInitScript(AGENT_TOOLS);
  if (init) await page.addInitScript(init);
  await page.goto(`${srv.url}studio/index.html`);
  await whenReady(page, 60000);
  page.ctx = ctx;
  return page;
}
const game = (page) => runtime(page).evaluate(() => ({ ...window.ZombifyStudioRuntime.status(), message: document.getElementById('message').textContent }));
const credits = (page) => runtime(page).evaluate(() => { const s = window.ZombifyStudioRuntime.read(); return { credits: s.credits, bet: s.bet, lastWin: s.lastWin }; });
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// Drives the game until the round has started and both sides are idle again
// (a layout test runs in the editor's preview board, not the game). Presses
// Continue whenever a bonus waits and, with skip, Skip while it animates.
// Every sample reads the editor before the game: the game finishes before the
// editor unlocks, so an unlocked editor next to a busy game is a real failure.
async function settle(page, { skip = false, sample, timeout = 240000 } = {}) {
  const t0 = Date.now();
  const seen = { samples: 0, unlockedWhileBusy: 0, unlockedAt: [], runningAt: null, continues: 0, skips: 0, started: false };
  let lastSkip = 0;
  for (;;) {
    const editor = await isBusy(page);
    const g = await game(page);
    const running = g.busy || g.awaitingOutbreak || g.autoplay;
    if (running || editor) seen.started = true;
    if (running) seen.runningAt ??= Date.now() - t0;
    if (running && !editor) { seen.unlockedWhileBusy++; seen.unlockedAt.push(Date.now() - t0); }
    if (!running && !editor && seen.started) break;
    if (Date.now() - t0 > timeout) throw Error(`the round did not finish (${g.message})`);
    seen.samples++;
    await sample?.(g, seen);
    if (await page.isVisible('#continue')) await page.click('#continue', { timeout: 1000 }).then(() => seen.continues++, () => {});
    else if (skip && Date.now() - lastSkip > 300 && !(await page.isDisabled('#spin'))) {
      lastSkip = Date.now();
      await page.click('#spin', { timeout: 300 }).then(() => seen.skips++, () => {});
    }
    await pause(50);
  }
  seen.ms = Date.now() - t0;
  seen.message = (await game(page)).message;
  return seen;
}
async function testSpin(page, mode, { speed = 'normal', ...options } = {}) {
  // Layout tests (not 6×5) only preview base spins, so the picker is disabled.
  if ((await page.inputValue('#preview-mode')) !== mode) await page.selectOption('#preview-mode', mode);
  if ((await page.inputValue('#speed')) !== speed) await page.selectOption('#speed', speed);
  await page.click('#spin');
  return settle(page, options);
}

// Where the reels layer sits on screen, in page coordinates.
async function reelsOnScreen(page) {
  const { project: p } = await project(page);
  const scene = p.scenes.desktop, l = scene.layers.find((x) => x.id === 'reels');
  const box = await page.locator('#canvas').boundingBox();
  const k = box.width / scene.width;
  return { layer: l, x: box.x + (l.x + l.w / 2) * k, y: box.y + (l.y + l.h / 2) * k, k };
}
const machineLeft = (page) => runtime(page).evaluate(() => getComputedStyle(document.querySelector('.machine')).left);

// A noisy RGBA PNG, so it stays large after compression.
function noisePNG(w, h) {
  const chunk = (type, data) => {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, 'ascii');
    data.copy(out, 8);
    out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  const raw = randomFillSync(Buffer.alloc((w * 4 + 1) * h));
  for (let row = 0; row < h; row++) raw[row * (w * 4 + 1)] = 0; // filter: none
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

test('1. base spins lock editing from the click until the reels settle, the first spin included', { skip }, async () => {
  const page = await openStudio();
  const start = (await reelsOnScreen(page)).layer.x;
  let late = 0;
  for (const which of ['first', 'second']) {
    let refused = 0, dragged = false;
    const round = await testSpin(page, 'base', {
      async sample(g, seen) {
        // Undo enabled or an edit accepted is fine only once the game has run
        // and stopped: the round ended between this sample's reads. Before the
        // game starts (the first spin decodes audio first) the editor must
        // already be locked.
        const ended = async () => seen.runningAt !== null && !(await game(page)).busy;
        if (!(await page.isDisabled('#undo'))) assert.ok(await ended(), `${which} spin: Undo enabled mid-round`);
        const accepted = await agentEdit(page, [{ type: 'grid', values: { symbolScale: 1.3 } }]).then(() => true, (e) => { assert.match(e.message, /Finish the current round/); return false; });
        if (accepted) { assert.ok(await ended(), `${which} spin: an edit was accepted mid-round`); late++; }
        else refused++;
        if (g.busy && !dragged) {
          dragged = true;
          const at = await reelsOnScreen(page);
          await page.mouse.move(at.x, at.y);
          await page.mouse.down();
          await page.mouse.move(at.x + 80, at.y + 30, { steps: 4 });
          await page.mouse.up();
          if (which === 'first') await shot(page, 's06-1-base-spin-locked');
        }
      },
    });
    assert.equal(round.unlockedWhileBusy, 0, `${which} spin: the editor unlocked while the game was busy`);
    assert.ok(refused >= 3, `${which} spin: only ${refused} edits were tried mid-round`);
    assert.doesNotMatch(round.message, /could not finish/);
  }
  assert.equal((await reelsOnScreen(page)).layer.x, start, 'a drag during a round moved the reels');
  assert.equal(await page.isDisabled('#undo'), !late, 'only edits made after a round ended can be undone');
  assert.deepEqual(page.errors, []);
  await page.ctx.close();
});

test('2. Outbreak waits locked for Continue, resumes on Continue, and the button goes when it ends', { skip }, async () => {
  const page = await openStudio();
  let waits = 0;
  const round = await testSpin(page, 'outbreak', {
    speed: 'turbo',
    async sample(g) {
      if (!g.awaitingOutbreak) return;
      if (!waits++) await shot(page, 's06-2-outbreak-continue');
      assert.equal(await page.isDisabled('#undo'), true);
      await page.waitForSelector('#continue:not([hidden])', { timeout: 2000 });
    },
  });
  assert.equal(round.unlockedWhileBusy, 0);
  assert.ok(round.continues >= 2, `Continue pressed ${round.continues} times (intro and summary expected)`);
  assert.equal(await page.isHidden('#continue'), true);
  assert.match(round.message, /PREVIEW COMPLETE/);
  assert.deepEqual(page.errors, []);
  await page.ctx.close();
});

test('3. Second Life, Super and Hidden Outbreak previews finish and unlock', { skip }, async () => {
  const page = await openStudio();
  const before = await credits(page);
  for (const [mode, options] of [['preview_feature', { speed: 'turbo' }], ['preview_super', { skip: true }], ['preview_hidden', { skip: true }]]) {
    const round = await testSpin(page, mode, options);
    assert.equal(round.unlockedWhileBusy, 0, `${mode}: unlocked mid-round`);
    assert.match(round.message, /PREVIEW COMPLETE/, `${mode} ended with "${round.message}"`);
    assert.equal(await isBusy(page), false);
    assert.equal(await page.isHidden('#continue'), true);
    assert.equal(await page.isDisabled('#undo'), true);
    await shot(page, `s06-3-${mode}-done`);
  }
  assert.equal((await credits(page)).credits, before.credits, 'previews cost nothing');
  assert.deepEqual(page.errors, []);
  await page.ctx.close();
});

test('4. Skip fast-forwards a long round', { skip }, async () => {
  const page = await openStudio();
  const full = await testSpin(page, 'single');
  const skipped = await testSpin(page, 'single', { skip: true });
  assert.ok(skipped.skips >= 1);
  assert.ok(skipped.ms < full.ms / 3, `skipped ${skipped.ms} ms vs ${full.ms} ms played out`);
  assert.match(skipped.message, /PREVIEW COMPLETE/);
  await page.ctx.close();
});

test('5. in Play mode, the game\'s own Spin and autoplay lock the editor until they stop', { skip }, async () => {
  const page = await openStudio();
  await page.click('#play');
  // The game's own Spin button, clicked through the studio canvas.
  const t0 = Date.now();
  await runtime(page).click('#spin');
  let gameAt = null, editorAt = null;
  const own = await settle(page, {
    async sample(g) {
      if (g.busy && gameAt === null) gameAt = Date.now() - t0;
      if ((await isBusy(page)) && editorAt === null) editorAt = Date.now() - t0;
    },
  });
  assert.ok(editorAt !== null && editorAt - gameAt < 500, `editor locked ${editorAt - gameAt} ms after the game started`);
  assert.doesNotMatch(own.message, /could not finish/);
  // Autoplay from the game's own menu; stop it after a few rounds.
  await runtime(page).click('#auto');
  await runtime(page).click('#auto-options button:first-child');
  const a0 = Date.now();
  let stopped = false, shotTaken = false;
  const auto = await settle(page, {
    async sample(g) {
      if (g.autoplay && !shotTaken) { shotTaken = true; await shot(page, 's06-5-autoplay-locked'); }
      if (!stopped && Date.now() - a0 > 8000) {
        stopped = true;
        if ((await game(page)).autoplay) await runtime(page).click('#auto');
      }
    },
  });
  // The editor learns that the game's own autoplay started at its next status
  // poll (100 ms); after that it must stay locked, between rounds included.
  // Edits in that gap are held by the bridge (studio.e2e.mjs covers that).
  const late = auto.unlockedAt.filter((t) => t - auto.runningAt >= 500);
  assert.deepEqual(late, [], `the editor unlocked during autoplay at ${late} ms (autoplay began at ${auto.runningAt} ms)`);
  console.log(`# autoplay: ${auto.samples} samples, ${auto.unlockedAt.length} unlocked (all within 500 ms of autoplay starting)`);
  assert.equal((await runtime(page).evaluate(() => window.ZombifyStudioRuntime.read().autoplay)).active, false);
  assert.equal(await isBusy(page), false);
  await page.click('#edit');
  assert.deepEqual(page.errors, []);
  await page.ctx.close();
});

test('6. 7×7 layout test, then 6×5: Zombify\'s board is intact and a base spin pays correctly', { skip }, async () => {
  const page = await openStudio();
  await page.click('[data-select="reels"]');
  await page.click('[data-grid="7,7"]');
  await testSpin(page, 'base');
  await shot(page, 's06-6-layout-7x7');
  await page.click('[data-grid="6,5"]');
  await until(async () => (await runtime(page).evaluate(() => getComputedStyle(document.getElementById('board')).display)) === 'grid');
  const board = await runtime(page).evaluate(() => {
    const b = document.getElementById('board');
    const preview = document.querySelector('.studio-preview-board');
    return { inline: b.style.display, tiles: b.querySelectorAll(':scope > .tile').length, layoutTest: document.getElementById('game').classList.contains('studio-layout-test'), preview: getComputedStyle(preview).display };
  });
  assert.deepEqual(board, { inline: '', tiles: 30, layoutTest: false, preview: 'none' });
  const before = await credits(page);
  const round = await testSpin(page, 'base');
  const after = await credits(page);
  assert.doesNotMatch(round.message, /could not finish/);
  assert.ok(Math.abs(after.credits - (before.credits - before.bet + after.lastWin)) < 0.005, `credits ${before.credits} → ${after.credits}, bet ${before.bet}, win ${after.lastWin}`);
  await shot(page, 's06-6-back-to-6x5');
  assert.deepEqual(page.errors, []);
  await page.ctx.close();
});

test('7. a large upload on WILD and the background keeps dragging the reels smooth', { skip }, async () => {
  const page = await openStudio();
  const png = noisePNG(1600, 1200);
  assert.ok(png.length > 7_000_000, `test image is ${png.length} bytes`);
  await page.click('[data-tab="assets"]');
  const chooser = page.waitForEvent('filechooser');
  await page.click('#upload');
  await (await chooser).setFiles({ name: 'large.png', mimeType: 'image/png', buffer: png });
  await page.waitForSelector('.asset-card:has-text("large.png")', { timeout: 20000 });
  const id = (await project(page)).project.assets.find((a) => a.name === 'large.png').id;
  await agentEdit(page, [{ type: 'symbol', id: 'wild', assetId: id }, { type: 'background', scene: 'desktop', values: { assetId: id } }]);
  await until(async () => (await runtime(page).evaluate(() => document.getElementById('studio-presentation').textContent)).includes('blob:'), 5000);
  await pause(1000);
  // Long tasks (>50 ms) in the editor and in the game while dragging.
  const watch = () => { window.__long = 0; new PerformanceObserver((l) => { window.__long += l.getEntries().length; }).observe({ type: 'longtask' }); };
  await page.evaluate(watch);
  await runtime(page).evaluate(watch);
  const at = await reelsOnScreen(page);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  const moves = [];
  for (let i = 1; i <= 40; i++) {
    const t = Date.now();
    await page.mouse.move(at.x + i * 4, at.y);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
    moves.push(Date.now() - t);
  }
  await page.mouse.up();
  const long = (await page.evaluate(() => window.__long)) + (await runtime(page).evaluate(() => window.__long));
  const mean = moves.reduce((a, b) => a + b, 0) / moves.length;
  console.log(`# drag with a ${(png.length / 1e6).toFixed(1)} MB upload: ${mean.toFixed(1)} ms per move, ${long} long tasks`);
  assert.ok(mean < 80, `${mean.toFixed(1)} ms per move`);
  assert.ok(long <= 4, `${long} long tasks while dragging`);
  const moved = (await reelsOnScreen(page)).layer.x;
  assert.equal(moved, at.layer.x + Math.round(160 / at.k));
  await until(async () => (await machineLeft(page)) === `${moved}px`, 3000);
  await shot(page, 's06-7-large-upload');
  assert.deepEqual(page.errors, []);
  await page.ctx.close();
});

test('8. an edit made right before closing the tab is there on reopen', { skip }, async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  let page = await openStudio(ctx);
  const x = (await reelsOnScreen(page)).layer.x + 37;
  await agentEdit(page, [{ type: 'layer', scene: 'desktop', id: 'reels', values: { x } }]);
  await page.close({ runBeforeUnload: true });
  page = await openStudio(ctx);
  // Either the save finished while the tab closed ("Saved in this browser"),
  // or it didn't and the journal restored the edit ("Restored your latest edits.").
  const how = await page.evaluate(() => (/Restored your latest edits/.test(document.getElementById('toast').textContent) ? 'journal' : document.getElementById('save-status').textContent));
  console.log(`# reopened via: ${how}`);
  assert.equal((await reelsOnScreen(page)).layer.x, x);
  await shot(page, 's06-8-reopened');
  await until(async () => (await machineLeft(page)) === `${x}px`, 5000);
  assert.deepEqual(page.errors, []);
  await ctx.close();
});

// Taps the game's audio output: everything the game connects to its
// AudioContext's destination goes through an analyser first. window.__record()
// then samples it every 50 ms until stopped, by the game's music scene
// (base/bonus): the loudest level at each test pitch, the most frequent peak
// pitch, and the mean and lowest RMS.
const AUDIO_TAP = () => {
  if (!location.pathname.includes('/games/zombify/runtime/')) return;
  const Real = window.AudioContext;
  const taps = [];
  window.AudioContext = class extends Real {
    constructor(...args) {
      super(...args);
      const input = this.createGain(), analyser = this.createAnalyser();
      analyser.fftSize = 8192;
      analyser.smoothingTimeConstant = 0;
      input.connect(analyser);
      input.connect(super.destination);
      Object.defineProperty(this, 'destination', { value: input });
      taps.push({ ctx: this, analyser });
    }
  };
  window.__record = (pitches) => {
    const { ctx, analyser } = taps.at(-1);
    const f = new Float32Array(analyser.frequencyBinCount), td = new Float32Array(analyser.fftSize), perBin = ctx.sampleRate / analyser.fftSize;
    const buckets = {};
    const sample = () => {
      const scene = window.ZombifyStudioRuntime.read().audio.scene;
      const b = (buckets[scene] ??= { max: Object.fromEntries(pitches.map((hz) => [hz, -Infinity])), peaks: {}, rms: 0, minRms: Infinity, n: 0 });
      analyser.getFloatFrequencyData(f);
      analyser.getFloatTimeDomainData(td);
      for (const hz of pitches) for (let i = Math.round(hz / perBin) - 2; i <= Math.round(hz / perBin) + 2; i++) b.max[hz] = Math.max(b.max[hz], f[i]);
      let top = 1;
      for (let i = 2; i < f.length; i++) if (f[i] > f[top]) top = i;
      const hz = Math.round((top * perBin) / 20) * 20;
      b.peaks[hz] = (b.peaks[hz] ?? 0) + 1;
      const rms = Math.sqrt(td.reduce((sum, v) => sum + v * v, 0) / td.length);
      b.rms += rms; b.minRms = Math.min(b.minRms, rms); b.n++;
    };
    const timer = setInterval(sample, 50);
    window.__stopRecording = () => {
      clearInterval(timer);
      return Object.fromEntries(Object.entries(buckets).map(([scene, b]) => [scene, { max: b.max, top: Number(Object.entries(b.peaks).sort((x, y) => y[1] - x[1])[0][0]), rms: b.rms / b.n, minRms: b.minRms }]));
    };
  };
};
// A mono 16-bit WAV of a pure tone, in whole cycles so a loop has no click.
function tone(hz, seconds) {
  const rate = 44100, n = Math.round(rate * seconds), wav = Buffer.alloc(44 + n * 2), f = Math.round(hz * seconds) / seconds;
  wav.write('RIFF'); wav.writeUInt32LE(36 + n * 2, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) wav.writeInt16LE(Math.round(0.5 * 32767 * Math.sin((2 * Math.PI * f * i) / rate)), 44 + i * 2);
  return wav;
}

test('9. sounds from the Sounds tab are what the game plays: loops, cues, volume, fade, loop off, restore', { skip }, async () => {
  const page = await openStudio(undefined, AUDIO_TAP);
  const PITCH = { 'music-base': 440, 'music-bonus': 660, spin: 1000, win: 1500, 'celebrate-nice': 1800 };
  const pitches = Object.values(PITCH);
  const record = async (during) => {
    await runtime(page).evaluate((p) => window.__record(p), pitches);
    try { await during(); } finally { page.heard = await runtime(page).evaluate(() => window.__stopRecording()); }
    return page.heard;
  };
  const listen = async (ms) => (await record(() => pause(ms))).base;
  const loud = (h, hz) => assert.ok(h.max[hz] > -45, `${hz} Hz should play: ${JSON.stringify(h)}`);
  const silent = (h, hz) => assert.ok(!(h.max[hz] > -90), `${hz} Hz should be silent: ${JSON.stringify(h)}`);
  const setSound = async (event, id, value) => {
    await page.selectOption('#sound-event', event);
    await page.evaluate(([id, value]) => {
      const el = document.getElementById(id);
      if (el.type === 'checkbox') el.checked = value; else el.value = String(value);
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, [id, value]);
  };

  // Upload a distinct tone for each event through the tab.
  await page.click('[data-tab="sounds"]');
  for (const [event, hz] of Object.entries(PITCH)) {
    await page.selectOption('#sound-event', event);
    await page.setInputFiles('#sound-file', { name: `tone-${hz}.wav`, mimeType: 'audio/wav', buffer: tone(hz, event.startsWith('music-') ? 3 : 1.2) });
    await page.waitForFunction((name) => document.querySelector('#sound-asset')?.selectedOptions[0]?.textContent === name, `tone-${hz}.wav`);
  }
  await shot(page, 's15-sounds-tab');
  // Game sound on, from the game's own menu, as a player would.
  await page.click('#play');
  await runtime(page).click('#menu');
  await runtime(page).click('#menu-music');
  await runtime(page).click('#menu-effects');
  await runtime(page).evaluate(() => document.getElementById('settings').close());
  await page.click('#edit');
  await pause(1500);

  // Idle: only the base tone, and still after its 3 s file has run out.
  let h = await listen(1000);
  loud(h, 440);
  for (const hz of [660, 1000, 1500, 1800]) silent(h, hz);
  const full = h.max[440], level = h.rms;
  await pause(2500);
  loud(await listen(800), 440);
  // Layout edits while it plays don't restart the music.
  const edits = Promise.all([0, 1, 2, 3, 4, 5].map((i) => pause(100 + i * 150).then(() => agentEdit(page, [{ type: 'layer', scene: 'desktop', id: 'reels', values: { x: 330 + i * 4 } }]))));
  h = await listen(1200);
  await edits;
  assert.ok(h.minRms > level * 0.9, `music dipped to ${h.minRms} (steady ${level}) during layout edits`);

  // A base spin plays the spin cue over the base music.
  h = (await record(() => testSpin(page, 'base'))).base;
  loud(h, 1000);
  assert.equal(h.top, 440);
  // Outbreak: the bonus tone takes over, and line wins play the win cue.
  h = await record(() => testSpin(page, 'outbreak', { speed: 'turbo' }));
  assert.equal(h.bonus?.top, 660, `bonus music: ${JSON.stringify(h)}`);
  loud(h.bonus, 1500);
  // The shared Nice Win track, from the game's own win preview.
  await page.click('#play');
  await runtime(page).click('#menu');
  await runtime(page).click('.menu-extra > summary');
  await runtime(page).click('.demo-tools > summary');
  h = (await record(async () => { await runtime(page).click('[data-win-preview="nice"]'); await settle(page, { timeout: 30000 }); })).base;
  loud(h, 1800);
  await page.click('#edit');
  await pause(2500);

  // Volume 25% is 12 dB down.
  await setSound('music-base', 'sound-volume', 25);
  await pause(1800);
  h = await listen(800);
  assert.ok(Math.abs(h.max[440] - (full - 12)) < 1.5, `25% volume: ${h.max[440]} dB vs ${full} dB at 100%`);
  await setSound('music-base', 'sound-volume', 100);
  await pause(1800);
  // A 2 s fade: the music restarts silent and rises to full over 2 s.
  await setSound('music-base', 'sound-fade', 2);
  h = await listen(900);
  assert.ok(h.minRms < level * 0.4, `fade-in started at ${h.minRms} (full ${level})`);
  await pause(1500);
  h = await listen(600);
  assert.ok(h.minRms > level * 0.9, `faded in to ${h.minRms} (full ${level})`);
  // Loop off: the 3 s tone plays once.
  await setSound('music-base', 'sound-fade', 0);
  await setSound('music-base', 'sound-loop', false);
  await pause(4500);
  silent(await listen(600), 440);
  // Restore: the original base music plays again; Undo brings the tone back.
  await page.click('#sound-reset');
  await pause(2500);
  h = await listen(1000);
  // The original track has a little energy near 440 Hz of its own.
  assert.ok(h.max[440] < full - 30 && h.top !== 440, `the tone is gone: ${JSON.stringify(h)}`);
  assert.ok(h.rms > 0.005, `original base music plays (${h.rms})`);
  await page.click('#undo');
  await pause(1500);
  loud(await listen(600), 440);
  await shot(page, 's15-sounds-restored');
  assert.deepEqual(page.errors, []);
  await page.ctx.close();
});
