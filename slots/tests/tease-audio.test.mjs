// Anticipation audio (S-20): what plays as scatters land, and how the audio
// director routes, ducks and stops it. Presentation only.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTeaseAudio } from '../games/zombify/runtime/tease-audio.js';
import { createGameAudio } from '../games/zombify/runtime/game-audio.js';
import { AUDIO_CUES } from '../games/zombify/runtime/audio-manifest.js';
import { SOUND_EVENTS } from '../studio/sound-schema.js';

const st = (n) => +(2 ** (n / 12)).toFixed(4);
function record(skip = () => false) {
  const calls = [];
  const audio = createTeaseAudio({
    play: (name, o) => calls.push(`${name}@${st(Math.log2(o.rate) * 12)}`),
    stopCue: (name) => calls.push(`stop ${name}`),
    focus: (on) => calls.push(on ? 'focus on' : 'focus off'),
    shouldSkip: skip,
  });
  return { calls, audio };
}
// Lands reels in order with the given running scatter counts; reels after the
// second scatter tease (as reelTeasePlan does for a base spin).
function land(audio, counts) {
  const trigger = counts.findIndex((c) => c >= 2);
  counts.forEach((count, reel) => audio.settle({ count, waiting: trigger >= 0 && reel < counts.length - 1 }));
  audio.clear();
}

test('a 5-scatter tease: a swell per waiting reel, a semitone up per tier, and a ping per tier secured', () => {
  const { calls, audio } = record();
  land(audio, [2, 3, 3, 4, 5, 5]);
  assert.deepEqual(calls, [
    'stop tease', 'focus on', `tease@${st(0)}`,
    'stop tease', `tease-up@${st(0)}`, `tease@${st(1)}`,
    'stop tease', `tease@${st(1)}`,
    'stop tease', `tease-up@${st(2)}`, `tease@${st(2)}`,
    'stop tease', `tease-up@${st(4)}`, `tease@${st(3)}`,
    'stop tease',
    'stop tease', 'focus off',
  ]);
});

test('a two-scatter miss swells under every waiting reel and secures nothing', () => {
  const { calls, audio } = record();
  land(audio, [2, 2, 2, 2, 2, 2]);
  assert.equal(calls.filter((c) => c.startsWith('tease@')).length, 5);
  assert.ok(!calls.some((c) => c.startsWith('tease-up')));
  assert.deepEqual(calls.slice(-2), ['stop tease', 'focus off']);
});

test('no tease, no anticipation audio; and nothing new starts while skipping', () => {
  const none = record();
  land(none.audio, [0, 1, 1, 1, 1, 1]);
  assert.ok(!none.calls.some((c) => /^tease|focus/.test(c)));
  let skipping = false;
  const skip = record(() => skipping);
  skip.audio.settle({ count: 2, waiting: true });
  skipping = true;
  for (const count of [3, 4, 5]) skip.audio.settle({ count, waiting: true });
  skip.audio.clear();
  assert.deepEqual(skip.calls, ['stop tease', 'focus on', `tease@${st(0)}`, 'stop tease', 'stop tease', 'stop tease', 'stop tease', 'focus off']);
});

test('the Sounds tab can override both anticipation cues', () => {
  for (const cue of ['tease', 'tease-up']) {
    assert.ok(AUDIO_CUES[cue], cue);
    assert.ok(SOUND_EVENTS.includes(cue), `${cue} is editable in the Sounds tab`);
  }
});

// The real director with a stand-in AudioContext.
function director() {
  const gains = [], sources = [];
  let time = 10;
  // Ramps land at once here; `history` keeps every value asked for.
  const param = () => ({ value: 1, history: [], cancelAndHoldAtTime() {}, cancelScheduledValues() {}, setValueAtTime(v) { this.value = v; this.history.push(v); }, linearRampToValueAtTime(v) { this.value = v; this.history.push(v); } });
  const node = (extra = {}) => ({ connect(to) { this.to = to; }, disconnect() {}, ...extra });
  const ctx = {
    state: 'running', get currentTime() { return time; }, destination: { name: 'out' }, resume: async () => {}, close: async () => {},
    createGain() { const n = node({ gain: param() }); gains.push(n); return n; },
    createDynamicsCompressor() { return node(Object.fromEntries(['threshold', 'knee', 'ratio', 'attack', 'release'].map((k) => [k, param()]))); },
    createBufferSource() { const n = node({ playbackRate: param(), start() {}, stop() { this.stopped = true; } }); sources.push(n); return n; },
    decodeAudioData: async () => ({ duration: 2 }),
  };
  const env = { fetch: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }), addEventListener() {}, removeEventListener() {} };
  const audio = createGameAudio({ env, doc: { hidden: false, addEventListener() {}, removeEventListener() {} }, createContext: () => ctx,
    assets: { 'tease-swell': 'a', 'tease-up': 'b', vial: 'c', 'music-base': 'm' },
    cues: { tease: { files: ['tease-swell'], gain: 0.3, gap: 0 }, 'tease-up': { files: ['tease-up'], gain: 0.4, gap: 0 }, vial: { files: ['vial'], gain: 0.5, gap: 0 } } });
  return { audio, gains, sources, tick: (s) => { time += s; } };
}

test('the director plays swells on their own bus, ducks them under scatters, and stops only them', async () => {
  const { audio, sources, tick } = director();
  await audio.setEnabled(true);
  await audio.prepare();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(audio.play('tease'), true);
  const swell = sources.at(-1);
  const teaseBus = swell.to.to?.gain ? swell.to.to : swell.to;
  tick(0.1);
  assert.equal(audio.play('vial'), true);
  const vial = sources.at(-1);
  assert.notEqual(vial.to.to ?? vial.to, teaseBus, 'scatters are not on the swell bus');
  assert.deepEqual(teaseBus.gain.history, [0.4, 0.4, 1], 'the swell dips under the scatter, then comes back');
  assert.equal(audio.read().teasing, 1);
  audio.stopCue('tease');
  assert.equal(swell.stopped, true);
  assert.notEqual(vial.stopped, true, 'the scatter sound keeps playing');
  assert.equal(audio.read().teasing, 0);
  audio.focus(true);
  assert.equal(audio.read().focused, true);
  audio.focus(false);
  assert.equal(audio.read().focused, false);
  audio.destroy();
});
