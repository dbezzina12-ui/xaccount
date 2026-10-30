#!/usr/bin/env node
// Cyber Skunk gain staging: renders the game's own audio code (runtime/audio.js)
// offline in Chromium, every effect and every music track at the default
// settings (music 60, effects 80), and measures each one. Loudness is BS.1770
// K-weighted: LUFS-M is the loudest 400 ms, LUFS-I the gated whole (music).
// "phone M" is LUFS-M through a 500 Hz high-pass, roughly a phone speaker.
// Peaks are sample peaks in dBFS, before the master limiter and after it.
//
//   node tools/audio/cyber-skunk-levels.mjs [--json OUT]
//
// The browser test imports measure() to keep the mix inside these bounds:
// nothing reaches 0 dBFS after the limiter, the music sits under the reel
// sounds, and the big moments stay the loudest things in the game.
import { writeFileSync } from 'node:fs';
import { serve, chromium } from '../lib/browser.mjs';

export const EFFECTS = [
  ['click'], ['tick'], ['spin'], ['stop'], ['vent-land'], ['paint'], ['scatter', { index: 2 }], ['tease', {}, 1.8], ['tease-hit'], ['tease-miss'],
  ['charge'], ['spray'], ['vent', { pressure: 4 }], ['gauge'], ['retrigger'], ['win', { size: 200 }], ['win-big'], ['buy'],
  ['release', {}, 1.4], ['blackout', {}, 1.5], ['bonus-in', { tier: 'regular' }, 2.2], ['bigwin', {}, 2.2], ['max', {}, 2.8],
];
export const TRACKS = ['base', 'bonus', 'blackout', 'hidden'];

// Runs in the page: GameAudio on an OfflineAudioContext that answers like a
// running one, with its clock under our control so the sequencer schedules
// whole bars at once. limiter:false swaps the master limiter for a plain gain.
async function inPage({ effects, tracks }) {
  const { GameAudio } = await import('/games/cyber-skunk/runtime/audio.js');
  const RATE = 48000;
  async function render(seconds, limiter, go) {
    class Ctx extends OfflineAudioContext {
      constructor() { super(2, Math.ceil(seconds * RATE), RATE); this.t = 0; }
      get state() { return 'running'; }
      get currentTime() { return this.t; }
      resume() { return Promise.resolve(); }
      suspend() { return Promise.resolve(); }
      createDynamicsCompressor() { return limiter ? super.createDynamicsCompressor() : Object.assign(this.createGain(), { threshold: {}, knee: {}, ratio: {}, attack: {}, release: {} }); }
    }
    globalThis.AudioContext = Ctx;
    const a = new GameAudio();
    a.setLevels(0.6, 0.8);
    await a.unlock();
    await go(a);
    const buf = await a.ctx.startRendering();
    a.ctx.t = -1; // parks this instance's sequencer (it schedules only up to the clock)
    return [buf.getChannelData(0), buf.getChannelData(1)];
  }
  function biquads(x, stages) {
    const out = Float32Array.from(x);
    for (const [b0, b1, b2, a1, a2] of stages) {
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      for (let i = 0; i < out.length; i++) { const v = out[i], y = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = v; y2 = y1; y1 = y; out[i] = y; }
    }
    return out;
  }
  // BS.1770 K-weighting at 48 kHz (shelf, then high-pass).
  const K = [[1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585], [1, -2, 1, -1.99004745483398, 0.99007225036621]];
  // A phone speaker, roughly: nothing much below 500 Hz (two Butterworth high-passes).
  const hp = (f) => { const w = (2 * Math.PI * f) / RATE, c = Math.cos(w), al = Math.sin(w) / Math.SQRT2, a0 = 1 + al; return [(1 + c) / 2 / a0, -(1 + c) / a0, (1 + c) / 2 / a0, (-2 * c) / a0, (1 - al) / a0]; };
  const PHONE = [hp(500), hp(500), ...K];
  const db = (v) => (v > 0 ? 20 * Math.log10(v) : -Infinity);
  const lufs = (ms) => -0.691 + 10 * Math.log10(ms);
  function blocks([l, r], stages) {
    const kl = biquads(l, stages), kr = biquads(r, stages), W = 0.4 * RATE, H = 0.1 * RATE, out = [];
    for (let s = 0; s + W <= l.length; s += H) { let e = 0; for (let i = s; i < s + W; i++) e += kl[i] * kl[i] + kr[i] * kr[i]; out.push(e / W); }
    return out;
  }
  function measure(ch) {
    let peak = 0;
    for (const x of ch) for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]));
    const b = blocks(ch, K), m = b.length ? lufs(Math.max(...b)) : -Infinity;
    const abs = b.filter((z) => lufs(z) > -70), rel = abs.length ? lufs(abs.reduce((a, z) => a + z, 0) / abs.length) - 10 : -70;
    const gated = abs.filter((z) => lufs(z) > rel), i = gated.length ? lufs(gated.reduce((a, z) => a + z, 0) / gated.length) : -Infinity;
    return { peak: db(peak), m, i, phone: lufs(Math.max(...blocks(ch, PHONE))) };
  }
  const round = (v) => (Number.isFinite(v) ? Math.round(v * 10) / 10 : null);
  const both = async (seconds, go) => {
    const pre = measure(await render(seconds, false, go)), post = measure(await render(seconds, true, go));
    return { m: round(post.m), i: round(post.i), phone: round(post.phone), prePeak: round(pre.peak), peak: round(post.peak) };
  };
  const tick = () => new Promise((r) => setTimeout(r, 80));
  const out = { music: {}, effects: {} };
  // Each effect plays 1.5 s in, once the limiter has settled as it has mid-game.
  for (const [name, o = {}, seconds = 1.2] of effects) out.effects[name] = await both(seconds + 1.9, (a) => { a.setLevels(0, 0.8); a.ctx.t = 1.5; a.play(name, o); });
  // Eight bars of each track; the first bar applies the mix, so start on bar 0.
  const bars = 8, seconds = (bars * 16 * 60) / 118 / 4 + 0.3;
  for (const track of tracks) out.music[track] = await both(seconds, async (a) => { a.music(track); a.ctx.t = seconds - 0.3; await tick(); });
  // A loud round over the base music: spin, six stops, a spray along three
  // cells and a vent, a big line win, then a ducked big-win celebration.
  out.mix = await both(11, async (a) => {
    const at = (t, fn) => { a.ctx.t = t; fn(); };
    at(1.5, () => a.play('spin'));
    for (let r = 0; r < 6; r++) at(2 + r * 0.15, () => a.play(r === 2 ? 'scatter' : 'stop', { index: r }));
    at(3, () => a.play('charge')); at(3.5, () => a.play('spray'));
    for (let k = 0; k < 3; k++) at(3.6 + k * 0.1, () => a.play('paint', { k }));
    at(3.9, () => a.play('vent', { pressure: 3 })); at(5, () => a.play('win-big'));
    at(6, () => { a.duck(true); a.play('bigwin'); }); at(9, () => a.duck(false));
    a.ctx.t = 10.7; await tick();
  });
  return out;
}

export async function measure({ effects = EFFECTS, tracks = TRACKS } = {}) {
  const srv = await serve(), browser = await chromium();
  try {
    const page = await browser.newPage();
    await page.goto(srv.url + 'games/cyber-skunk/runtime/audio.js');
    return await page.evaluate(inPage, { effects, tracks });
  } finally { await browser.close(); srv.close(); }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const res = await measure(), json = process.argv.indexOf('--json');
  const COLS = ['m', 'i', 'phone', 'prePeak', 'peak'], HEAD = ['LUFS-M', 'LUFS-I', 'phone M', 'pre pk', 'peak'];
  const row = (name, v) => name.padEnd(12) + COLS.map((c) => String(v[c] ?? '').padStart(8)).join('');
  console.log('sound'.padEnd(12) + HEAD.map((h) => h.padStart(8)).join(''));
  for (const [k, v] of Object.entries(res.music)) console.log(row(`♪ ${k}`, v));
  for (const [k, v] of Object.entries(res.effects)) console.log(row(k, v));
  console.log(row('MIX', res.mix));
  if (json > 0) writeFileSync(process.argv[json + 1], JSON.stringify(res, null, 1) + '\n');
}
