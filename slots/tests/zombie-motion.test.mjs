// Zombie weight (S-20): feet stay on the floor through a step, the lunge leans
// in, contact holds for a beat, and jumps wait for takeoff and land fast.
// Presentation only. Rig-data tests skip without `npm run studio:prepare`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const R = new URL('../games/zombify/runtime/', import.meta.url);
const { pose, clipDuration } = await import(new URL('approved-rig-renderer.js', R));
const { stepPlan, stepPath, holdAt, jumpArc, downwardJumpPose, APPROACH, RECOVER, LEAN } = await import(new URL('rig-geometry.js', R));
const rigFile = (view) => new URL(`assets/approved-rig/${view}/rig.json`, R);
const skip = ['side', 'front', 'rear'].every((v) => existsSync(rigFile(v))) ? false : 'needs the rig data: npm run studio:prepare';
const rigs = skip ? null : Object.fromEntries(['side', 'front', 'rear'].map((v) => [v, { data: JSON.parse(readFileSync(rigFile(v))) }]));
// Phone-sized cells: 58 px with a 4 px gap.
const cell = (column, row) => ({ x: column * 62, y: row * 62, width: 58, height: 58 });

// Screen y of the lower boot, with the rig rotated about its origin.
function lowestBoot(data, plan, at, clip, time) {
  const world = pose(data, clip, time), c = Math.cos(at.rotation || 0), s = Math.sin(at.rotation || 0);
  return Math.max(...['boot_l', 'boot_r'].map((b) => at.y + world[b][4] * plan.scale * s - world[b][5] * plan.scale * c));
}

test('a horizontal step keeps the zombie\'s feet on the floor', { skip }, () => {
  for (const direction of ['left', 'right']) {
    const plan = stepPlan(rigs, cell(2, 2), cell(direction === 'right' ? 3 : 1, 2), direction), path = stepPath(plan), data = rigs.side.data;
    assert.equal(plan.strike.y, plan.start.y, 'the swat happens at floor height');
    const floor = lowestBoot(data, plan, { ...plan.start, rotation: 0 }, plan.rest, 0);
    const heights = [];
    for (let i = 0; i <= 12; i++) heights.push(lowestBoot(data, plan, path.approach((APPROACH * i) / 12), plan.rest, 0));
    for (let i = 0; i <= 12; i++) heights.push(lowestBoot(data, plan, { ...plan.strike, rotation: 0 }, plan.clip, (clipDuration(data, plan.clip) * i) / 12));
    for (let i = 0; i <= 12; i++) heights.push(lowestBoot(data, plan, path.recover((RECOVER * i) / 12), plan.move, (RECOVER * i) / 12 * (1.2 / RECOVER)));
    const worst = Math.max(...heights.map((y) => Math.abs(y - floor)));
    // Before S-20 the boots sank 10.3 px into the floor for the whole swat.
    assert.ok(worst <= 2, `${direction}: boots left the floor by ${worst.toFixed(1)} px`);
  }
});

test('the lunge leans toward the block and is upright again at contact', { skip }, () => {
  for (const [direction, sign] of [['right', 1], ['left', -1]]) {
    const plan = stepPlan(rigs, cell(2, 2), cell(2 + sign, 2), direction), path = stepPath(plan);
    assert.ok(Math.abs(path.approach(0).rotation) < 1e-9);
    assert.ok(Math.abs(path.approach(APPROACH).rotation) < 1e-9);
    assert.ok(Math.abs(path.approach(APPROACH / 2).rotation - sign * LEAN) < 1e-9);
    assert.deepEqual(path.approach(APPROACH), { x: plan.strike.x, y: plan.strike.y, rotation: path.approach(APPROACH).rotation });
    assert.deepEqual(path.recover(RECOVER), { ...plan.end, rotation: 0 });
  }
  const up = stepPlan(rigs, cell(2, 2), cell(2, 1), 'up');
  assert.equal(up.lean, 0, 'no lean while turning to climb');
});

test('a hit-stop holds the contact pose for a beat and moves later events', () => {
  const held = holdAt({ duration: 1.42, events: [{ name: 'swat_contact', time: 0.6 }, { name: 'settle', time: 1.12 }] }, 0.6, 0.1);
  assert.ok(Math.abs(held.duration - 1.52) < 1e-9);
  assert.deepEqual([0.3, 0.6, 0.65, 0.7, 1.0].map(held.time).map((t) => +t.toFixed(9)), [0.3, 0.6, 0.6, 0.6, 0.9]);
  assert.deepEqual(held.events.map((e) => [e.name, +e.time.toFixed(9)]), [['swat_contact', 0.6], ['settle', 1.22]]);
});

test('a jump stays put through the crouch and lands moving fast', () => {
  const start = { x: 10, y: 100 }, end = { x: 40, y: 160 }, timing = { takeoff: 0.43, land: 1.16, lift: 12 };
  assert.deepEqual(jumpArc(start, end, timing, 0.2), start);
  assert.deepEqual(jumpArc(start, end, timing, 0.43), start);
  const landed = jumpArc(start, end, timing, 1.16);
  assert.ok(Math.abs(landed.x - end.x) < 1e-9 && Math.abs(landed.y - end.y) < 1e-9);
  // It rises above both ends first.
  const path = Array.from({ length: 50 }, (_, i) => jumpArc(start, end, timing, 0.43 + (0.73 * i) / 49).y);
  assert.ok(Math.min(...path) < start.y - 11);
  // Falling speed at landing is well above the average (no easing to a stop).
  const dt = 0.005, speedAtLanding = (jumpArc(start, end, timing, 1.16).y - jumpArc(start, end, timing, 1.16 - dt).y) / dt;
  assert.ok(speedAtLanding > 1.5 * ((end.y - start.y) / (1.16 - 0.43)), `landing speed ${speedAtLanding.toFixed(0)} px/s`);
});

test('a downward jump lands on the block at contact, then steps into the cell', { skip }, () => {
  const plan = stepPlan(rigs, cell(2, 1), cell(2, 2), 'down');
  assert.deepEqual(downwardJumpPose(plan, 0.2), { x: plan.start.x, y: plan.start.y });
  const contact = downwardJumpPose(plan, plan.contact);
  assert.ok(Math.abs(contact.x - plan.strike.x) < 1e-6 && Math.abs(contact.y - plan.strike.y) < 1e-6);
  const end = downwardJumpPose(plan, plan.contact + 0.18 + 0.5);
  assert.ok(Math.abs(end.x - plan.end.x) < 1e-6 && Math.abs(end.y - plan.end.y) < 1e-6);
});
