#!/usr/bin/env node
// Profiles the standalone Zombify game as a midrange Android phone would run
// it: Pixel 5 viewport, touch and pixel ratio, with the CPU slowed down
// (default 4×, the usual "midrange mobile" setting). Plays real rounds through
// the game's own facade and reports, per round: frame-time distribution,
// dropped frames, long tasks; memory after each round (after a GC); and, for
// one traced pass, where main-thread and raster time goes.
//
// This is an emulation. Headless Chromium rasterises on the CPU (no phone
// GPU), and nothing here measures iOS Safari. Use ?perf on a real phone for
// device numbers (games/zombify/runtime/perf-probe.js).
//
//   node tools/perf/zombify-phone.mjs [--cpu 4] [--spins 20] [--json out.json]

import { writeFileSync } from 'node:fs';
import { serve, chromium } from '../lib/browser.mjs';

const arg = (name, d) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : d; };
const CPU = Number(arg('--cpu', 4)), SPINS = Number(arg('--spins', 20)), JSON_OUT = arg('--json');
const PIXEL5 = { viewport: { width: 393, height: 851 }, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36' };

// In the page: every animation frame's interval, and long tasks.
const RECORDER = () => {
  const perf = (window.__perf = { frames: [], long: [] });
  let last = 0;
  const tick = (t) => { if (last) perf.frames.push(t - last); last = t; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  new PerformanceObserver((list) => { for (const e of list.getEntries()) perf.long.push(e.duration); }).observe({ type: 'longtask', buffered: true });
  perf.reset = () => { perf.frames.length = 0; perf.long.length = 0; };
};

const q = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
function frameStats(frames, long) {
  const s = [...frames].sort((a, b) => a - b), n = s.length;
  const over = (ms) => frames.filter((f) => f > ms).length / n;
  return { frames: n, p50: q(s, 0.5), p90: q(s, 0.9), p95: q(s, 0.95), p99: q(s, 0.99), max: s[n - 1],
    dropped: over(16.7 * 1.5), janky: over(33.4 * 1.5), longTasks: long.length, longTaskMs: long.reduce((a, b) => a + b, 0) };
}

// Trace events, grouped the way DevTools' summary groups them.
const GROUPS = {
  script: ['FunctionCall', 'EvaluateScript', 'v8.compile', 'TimerFire', 'FireAnimationFrame', 'RunMicrotasks', 'EventDispatch', 'V8.GCScavenger', 'MajorGC', 'MinorGC'],
  style: ['UpdateLayoutTree', 'ParseAuthorStyleSheet'], layout: ['Layout'], prepaint: ['PrePaint'], paint: ['Paint', 'PaintImage'],
  composite: ['Layerize', 'Commit', 'CompositeLayers', 'UpdateLayer'], raster: ['RasterTask'], decode: ['Decode Image', 'ImageDecodeTask', 'Decode LazyPixelRef'],
};
function traceSummary(buffer) {
  const { traceEvents } = JSON.parse(buffer.toString());
  const names = new Map();
  for (const e of traceEvents) if (e.ph === 'M' && e.name === 'thread_name') names.set(`${e.pid}:${e.tid}`, e.args.name);
  const byGroup = Object.fromEntries(Object.keys(GROUPS).map((g) => [g, 0])), byName = new Map();
  let start = Infinity, end = 0;
  for (const e of traceEvents) {
    if (e.ph !== 'X' || !e.dur) continue;
    const thread = names.get(`${e.pid}:${e.tid}`) ?? '';
    if (!/CrRendererMain|Compositor|Raster/.test(thread)) continue;
    start = Math.min(start, e.ts); end = Math.max(end, e.ts + e.dur);
    const group = Object.entries(GROUPS).find(([, list]) => list.includes(e.name))?.[0];
    if (!group) continue;
    byGroup[group] += e.dur / 1000;
    const key = `${group}: ${e.name}`;
    byName.set(key, (byName.get(key) ?? 0) + e.dur / 1000);
  }
  return { seconds: (end - start) / 1e6, ms: Object.fromEntries(Object.entries(byGroup).map(([k, v]) => [k, Math.round(v)])),
    top: [...byName].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => [k, Math.round(v)]) };
}

const srv = await serve();
const browser = await chromium();
const context = await browser.newContext(PIXEL5);
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(RECORDER);
const cdp = await context.newCDPSession(page);
await cdp.send('Performance.enable');
await page.goto(`${srv.url}games/zombify/runtime/index.html`);
await page.waitForFunction(() => window.ZombifyStudioRuntime?.loading().status === 'ready', null, { timeout: 120000 });
await page.waitForSelector('#guide-play:not([disabled])', { state: 'visible', timeout: 60000 });
await page.click('#guide-play');
await page.waitForFunction(() => !document.getElementById('welcome').open);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });

async function memory() {
  await cdp.send('HeapProfiler.collectGarbage');
  const { metrics } = await cdp.send('Performance.getMetrics');
  const m = Object.fromEntries(metrics.map((x) => [x.name, x.value]));
  return { heapMB: +(m.JSHeapUsedSize / 1048576).toFixed(1), nodes: m.Nodes, listeners: m.JSEventListeners, layoutObjects: m.LayoutObjects };
}
async function round(mode) {
  await page.evaluate(() => window.__perf.reset());
  await page.evaluate((mode) => { window.__done = false; window.ZombifyStudioRuntime.start(mode).finally(() => { window.__done = true; }); }, mode);
  for (;;) {
    const s = await page.evaluate(() => ({ done: window.__done, waiting: window.ZombifyStudioRuntime.status().awaitingOutbreak }));
    if (s.done) break;
    if (s.waiting) await page.evaluate(() => window.ZombifyStudioRuntime.continue());
    await page.waitForTimeout(200);
  }
  const { frames, long } = await page.evaluate(() => window.__perf);
  return frameStats(frames, long);
}

const report = { device: 'Pixel 5 (emulated)', cpuSlowdown: CPU, rounds: [], memory: [], trace: {} };
report.memory.push({ after: 'start', ...(await memory()) });
// Traced pass: the zombie walk and expansion, a plain spin and an Outbreak.
for (const mode of ['single', 'reel', 'base', 'outbreak']) {
  await browser.startTracing(page, { categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'blink', 'cc'] });
  const stats = await round(mode);
  report.trace[mode] = traceSummary(await browser.stopTracing());
  report.rounds.push({ mode, traced: true, ...stats });
}
// Untraced repeats, for frame times without tracing overhead and for memory growth.
for (let i = 0; i < SPINS; i++) {
  report.rounds.push({ mode: 'base', ...(await round('base')) });
  if (i % 5 === 4) report.memory.push({ after: `${i + 1} spins`, ...(await memory()) });
}
for (const mode of ['single', 'reel', 'outbreak']) report.rounds.push({ mode, ...(await round(mode)) });
report.memory.push({ after: 'end', ...(await memory()) });
report.errors = errors;
await browser.close();
srv.close();

const f = (x) => (typeof x === 'number' ? (Number.isInteger(x) ? String(x) : x.toFixed(1)) : x);
const pct = (x) => `${(x * 100).toFixed(1)}%`;
console.log(`Zombify on an emulated Pixel 5, CPU ${CPU}× slower. Frame intervals in ms (60 fps = 16.7).`);
console.log('mode      traced frames  p50   p90   p95   p99   max    dropped janky  long tasks');
for (const r of report.rounds) console.log(`${r.mode.padEnd(9)} ${r.traced ? 'yes   ' : '      '} ${String(r.frames).padStart(6)} ${[r.p50, r.p90, r.p95, r.p99, r.max].map((x) => f(x).padStart(5)).join(' ')}  ${pct(r.dropped).padStart(6)} ${pct(r.janky).padStart(6)}  ${r.longTasks} (${Math.round(r.longTaskMs)} ms)`);
console.log('\nMain-thread and raster time in the traced rounds (ms):');
for (const [mode, t] of Object.entries(report.trace)) console.log(`${mode.padEnd(9)} ${t.seconds.toFixed(1)} s  ${Object.entries(t.ms).map(([k, v]) => `${k} ${v}`).join(' · ')}\n          top: ${t.top.map(([k, v]) => `${k} ${v}`).join(' | ')}`);
console.log('\nMemory after GC:');
for (const m of report.memory) console.log(`${m.after.padEnd(10)} heap ${m.heapMB} MB · ${m.nodes} nodes · ${m.listeners} listeners · ${m.layoutObjects} layout objects`);
if (errors.length) console.log('\nPage errors:', errors);
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(report, null, 1) + '\n');
