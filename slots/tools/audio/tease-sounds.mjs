#!/usr/bin/env node
// Synthesises Zombify's reel-anticipation sounds (S-20), original and
// reproducible (fixed noise seed), and encodes them with ffmpeg:
//   tease-swell-v1.mp3  2.4 s rising tension under a teasing reel: a low
//                       heartbeat that quickens, a filtered-noise riser and a
//                       close two-note pad gliding up. Ends soft; the reel's
//                       own landing thud is the hit.
//   tease-up-v1.mp3     1.0 s bell-like ping with air, when a tier is secured.
//
//   node tools/audio/tease-sounds.mjs

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const RATE = 44100, OUT = new URL('../../games/zombify/runtime/assets/audio/', import.meta.url);
let seed = 0x5eed;
const noise = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32) * 2 - 1;
// RBJ band-pass biquad whose centre can move every sample.
function bandpass(q) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x, freq) => {
    const w = (2 * Math.PI * freq) / RATE, a = Math.sin(w) / (2 * q), a0 = 1 + a;
    const y = ((a * x) - (a * x2) - (-2 * Math.cos(w) * y1) - ((1 - a) * y2)) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
}
const lowpass = (cut) => { let y = 0; const k = 1 - Math.exp((-2 * Math.PI * cut) / RATE); return (x) => (y += k * (x - y)); };
const highpass = (cut) => { const lp = lowpass(cut); return (x) => x - lp(x); };
function normalise(samples, peakDb) {
  const peak = samples.reduce((m, v) => Math.max(m, Math.abs(v)), 0), gain = 10 ** (peakDb / 20) / peak;
  return samples.map((v) => v * gain);
}

function swell(seconds = 2.4) {
  const n = Math.round(seconds * RATE), out = new Float64Array(n), riser = bandpass(2.2), pad = lowpass(1400);
  // Heartbeat thumps, closer together as the reel slows.
  const beats = [0.05, 0.52, 0.93, 1.27, 1.55, 1.78, 1.97, 2.12, 2.24];
  let phaseA = 0, phaseB = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE, p = t / seconds;
    let thump = 0;
    for (const b of beats) { const d = t - b; if (d >= 0 && d < 0.25) thump += Math.exp(-d / 0.07) * (Math.sin(2 * Math.PI * 49 * d) + 0.5 * Math.sin(2 * Math.PI * 98 * d)) * (0.55 + 0.45 * p); }
    const sweep = 500 * (3200 / 500) ** p;
    const air = riser(noise(), sweep) * 0.9 * p ** 2.2;
    // A minor second apart (A3, B♭3, audible on phone speakers), gliding up two
    // semitones: tension without melody.
    const glide = 2 ** ((2 * p) / 12);
    phaseA += (2 * Math.PI * 220 * glide) / RATE; phaseB += (2 * Math.PI * 233.08 * glide) / RATE;
    const tone = pad((Math.asin(Math.sin(phaseA)) + Math.asin(Math.sin(phaseB))) / Math.PI) * (0.25 + 0.75 * p);
    const env = Math.min(1, t / 0.06) * Math.min(1, (seconds - t) / 0.12);
    out[i] = env * (0.5 * thump + air + 0.55 * tone);
  }
  return normalise(out, -6);
}

function tierUp(seconds = 1.0) {
  const n = Math.round(seconds * RATE), out = new Float64Array(n), hiss = highpass(3000);
  const f = 659.25;
  for (let i = 0; i < n; i++) {
    const t = i / RATE, index = 0.5 + 3.5 * Math.exp(-t / 0.12);
    const bell = Math.sin(2 * Math.PI * f * t + index * Math.sin(2 * Math.PI * f * 2 * t)) * Math.exp(-t / 0.33)
      + 0.35 * Math.sin(2 * Math.PI * f * 2.01 * t) * Math.exp(-t / 0.16);
    const whoosh = hiss(noise()) * Math.sin(Math.PI * Math.min(1, t / 0.22)) * (t < 0.22 ? 0.35 : 0);
    out[i] = Math.min(1, t / 0.004) * Math.min(1, (seconds - t) / 0.08) * (bell + whoosh);
  }
  return normalise(out, -8);
}

const dir = mkdtempSync(join(tmpdir(), 'tease-'));
try {
  for (const [name, samples] of [['tease-swell-v1', swell()], ['tease-up-v1', tierUp()]]) {
    const pcm = Buffer.alloc(samples.length * 2);
    samples.forEach((v, i) => pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2));
    const raw = join(dir, `${name}.raw`);
    writeFileSync(raw, pcm);
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 's16le', '-ar', String(RATE), '-ac', '1', '-i', raw, '-codec:a', 'libmp3lame', '-b:a', '96k', new URL(`${name}.mp3`, OUT).pathname]);
    console.log(`wrote games/zombify/runtime/assets/audio/${name}.mp3 (${(samples.length / RATE).toFixed(2)} s)`);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
