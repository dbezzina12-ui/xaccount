// Cyber Skunk mascot rig (ART_SPEC §1): the contract file, the joint chain,
// planted feet and the tail's usable range, for every clip over time.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Skunk, prepare, apply, CLIP_NAMES, SPRAY_TARGET } from '../runtime/rig.js';

const contract = JSON.parse(readFileSync(new URL('../art/rig/pivots.json', import.meta.url)));
const shipped = JSON.parse(readFileSync(new URL('../runtime/assets/mascot/pivots.json', import.meta.url)));
const v4 = JSON.parse(readFileSync(new URL('../art/rig/pivots-v4.json', import.meta.url)));
const rig4 = Object.assign(Object.create(Skunk.prototype), prepare(v4));
const rig = Object.assign(Object.create(Skunk.prototype), prepare(contract));
const times = Array.from({ length: 60 }, (_, k) => k * 0.05 + (k % 7) * 0.31);
const rotation = (m) => Math.atan2(m[1], m[0]) * (180 / Math.PI);

test('the game ships the same pivots as the art contract', () => {
  // v4 replaces v1 in the game once all of its pieces are in (cyber-skunk-prep.py).
  if (shipped.version === 4) { assert.deepEqual(shipped, v4); return; }
  assert.deepEqual(shipped, contract);
  const orders = Object.values(contract.parts).map((p) => p.order).sort((a, b) => a - b);
  assert.deepEqual(orders, Array.from({ length: 25 }, (_, k) => k + 1));
  for (const [k, p] of Object.entries(contract.parts)) if (p.parent) assert.ok(contract.parts[p.parent], `${k} has a real parent`);
  assert.equal(contract.parts['tail-1'].parent, 'torso', 'the tail root hangs from the hips');
});

test('the spray pose reaches over the head within the ±35° each segment allows', () => {
  const { angles, error } = rig.sprayPose;
  assert.ok(error < 2, `nozzle misses by ${error}px`);
  for (const a of angles) assert.ok(Math.abs(a) <= 35 + 1e-9, `segment turns ${a}°`);
  assert.ok(SPRAY_TARGET[1] < contract.joints.ear[1] + 10, 'the nozzle ends above the head');
});

test('no joint ever separates: each part turns about a point its parent carries', () => {
  for (const clip of CLIP_NAMES) for (const t of times) {
    const M = rig.world(rig.pose(clip, t));
    for (const [k, p] of Object.entries(contract.parts)) {
      if (!p.parent) continue;
      const a = apply(M[k], p.pivot), b = apply(M[p.parent], p.pivot);
      assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.01, `${clip} t=${t.toFixed(2)}: ${k} leaves ${p.parent}`);
    }
  }
});

test('both boots stay planted, flat on the floor, in every clip', () => {
  for (const clip of CLIP_NAMES) for (const t of times) {
    const M = rig.world(rig.pose(clip, t));
    for (const side of ['near', 'far']) {
      const ankle = contract.joints[`${side}_ankle`], at = apply(M[`${side}-boot`], ankle);
      assert.ok(Math.hypot(at[0] - ankle[0], at[1] - ankle[1]) < 0.5, `${clip} t=${t.toFixed(2)}: ${side} ankle slides`);
      assert.ok(Math.abs(rotation(M[`${side}-boot`])) < 0.01, `${clip}: ${side} boot tilts`);
    }
  }
});

test('tail segments stay inside their ±35° range in every clip', () => {
  for (const clip of CLIP_NAMES) for (const t of times) {
    const P = rig.pose(clip, t);
    for (const k of ['tail-1', 'tail-2', 'tail-3', 'tail-4']) assert.ok(Math.abs(P[k]?.r || 0) <= 35 + 1e-6, `${clip} t=${t.toFixed(2)}: ${k} at ${P[k]?.r}°`);
  }
});

test('rig v4 (compact, waist up): 17 pieces, every joint holds and the tail stays in range in every clip', () => {
  prepare(v4); // its own tail settings for the poses below
  const orders = Object.values(v4.parts).map((p) => p.order).sort((a, b) => a - b);
  assert.deepEqual(orders, Array.from({ length: 17 }, (_, k) => k + 1));
  for (const [k, p] of Object.entries(v4.parts)) if (p.parent) assert.ok(v4.parts[p.parent], `${k} has a real parent`);
  assert.equal(rig4.legs.length, 0, 'no legs');
  const { angles, error } = rig4.sprayPose;
  assert.ok(error < 2, `nozzle misses by ${error}px`);
  for (const a of angles) assert.ok(Math.abs(a) <= 35 + 1e-9, `segment turns ${a}°`);
  for (const clip of CLIP_NAMES) for (const t of times) {
    const P = rig4.pose(clip, t), M = rig4.world(P);
    for (const [k, p] of Object.entries(v4.parts)) {
      if (!p.parent) continue;
      const a = apply(M[k], p.pivot), b = apply(M[p.parent], p.pivot);
      assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.01, `${clip} t=${t.toFixed(2)}: ${k} leaves ${p.parent}`);
    }
    for (const k of ['tail-1', 'tail-2', 'tail-3', 'tail-4']) assert.ok(Math.abs(P[k]?.r || 0) <= 35 + 1e-6, `${clip} t=${t.toFixed(2)}: ${k} at ${P[k]?.r}°`);
  }
  prepare(contract); // the module's tail tuck back to v1's for the tests above
});
