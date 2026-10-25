// Shared by the studio browser suites.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../../tools/lib/browser.mjs';

// Real-runtime suites need the `npm run studio:prepare` files. Review pages
// (rig-review.html) aren't part of the game.
export const prepared = JSON.parse(readFileSync(join(ROOT, 'games/zombify/import-manifest.json'), 'utf8')).files.every((f) => f.path.endsWith('.html') || existsSync(join(ROOT, 'games/zombify/runtime', f.path)));

// Captures the studio's agent tools so tests can read/edit the project
// through the same validated API an agent uses.
export const AGENT_TOOLS = () => {
  const tools = {};
  window.__tools = tools;
  document.modelContext = { registerTool: (spec) => { tools[spec.name] = spec; } };
};
export const runtime = (page) => page.frames().find((f) => f.url().includes('/games/zombify/runtime/'));
export const project = (page) => page.evaluate(() => window.__tools.read_slot_studio.execute({}));
export const agentEdit = (page, operations) => page.evaluate((ops) => window.__tools.edit_slot_studio.execute({ operations: ops }), operations);
export const isBusy = (page) => page.evaluate(() => document.body.classList.contains('busy'));
export async function whenReady(page, timeout = 15000) {
  await page.waitForFunction(() => window.__tools?.read_slot_studio && document.getElementById('canvas-loading').hidden, null, { timeout });
  await page.waitForFunction(() => !document.getElementById('spin').disabled, null, { timeout });
}
export async function until(fn, timeout = 10000) {
  const t0 = Date.now();
  for (;;) {
    if (await fn()) return;
    if (Date.now() - t0 > timeout) throw Error('timed out');
    await new Promise((r) => setTimeout(r, 40));
  }
}

// Taps the game's audio output: everything the game connects to its
// AudioContext's destination goes through an analyser first. window.__record()
// then samples it every 50 ms until stopped, by the game's music scene
// (base/bonus): the loudest level at each test pitch, the most frequent peak
// pitch, and the mean and lowest RMS.
export const AUDIO_TAP = () => {
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
  // The loudest level (dB) near each pitch right now, and the output's RMS.
  window.__level = (pitches) => {
    const { ctx, analyser } = taps.at(-1) ?? {};
    if (!analyser) return null;
    const f = new Float32Array(analyser.frequencyBinCount), td = new Float32Array(analyser.fftSize), perBin = ctx.sampleRate / analyser.fftSize;
    analyser.getFloatFrequencyData(f);
    analyser.getFloatTimeDomainData(td);
    const level = Object.fromEntries(pitches.map((hz) => { let m = -Infinity; for (let i = Math.round(hz / perBin) - 2; i <= Math.round(hz / perBin) + 2; i++) m = Math.max(m, f[i]); return [hz, m]; }));
    return { ...level, rms: Math.sqrt(td.reduce((sum, v) => sum + v * v, 0) / td.length), state: ctx.state };
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
export function tone(hz, seconds) {
  const rate = 44100, n = Math.round(rate * seconds), wav = Buffer.alloc(44 + n * 2), f = Math.round(hz * seconds) / seconds;
  wav.write('RIFF'); wav.writeUInt32LE(36 + n * 2, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) wav.writeInt16LE(Math.round(0.5 * 32767 * Math.sin((2 * Math.PI * f * i) / rate)), 44 + i * 2);
  return wav;
}
