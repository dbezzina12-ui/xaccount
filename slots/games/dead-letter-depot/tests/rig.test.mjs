// Frank's rig: clips, planted feet in both renderers, the parent chain,
// reduced motion and the depot:frank cue wiring. Presentation only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pose, track, heroTransform, partMatrices, drawOrder, apply, attachFrank, CLIPS, ROLES } from '../rig/frank.js';

const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const idle = (t) => pose(t, []);
const ts = Array.from({ length: 200 }, (_, i) => i * 0.037);

test('reduced motion is a static rest pose whatever is playing', () => {
  const p = pose(12.3, [{ clip: 'stamp', start: 12.2, opts: 50 }, { clip: 'salute', start: 12, opts: 'hidden' }], { reduced: true });
  for (const r of ROLES) assert.deepEqual(p[r], { r: 0, x: 0, y: 0, sx: 1, sy: 1 });
});

test('idle breathes gently and stays bounded', () => {
  for (const t of ts) { const p = idle(t); assert.ok(Math.abs(p.torso.sy - 1) <= 0.0121); assert.ok(Math.abs(p.head.r) <= 1.21); assert.equal(p['wing-near'].r, 0); }
  assert.ok(Math.abs(idle(0.9).torso.sy - idle(2.7).torso.sy) > 0.01, 'the chest rises and falls');
});

test('hero mode keeps the feet planted through every clip', () => {
  const feet = [612, 1480];
  for (const [clip, opts] of [['stamp', 2], ['stamp', 100], ['salute', 'regular'], ['salute', 'hidden'], ['letter', {}], ['blink', {}]]) for (const t of ts) {
    const m = heroTransform(pose(t, [{ clip, start: 1, opts }]), feet), [x, y] = apply(m, feet);
    assert.ok(near(x, feet[0], 1e-6) && near(y, feet[1], 1e-6), `${clip} at ${t}`);
  }
});

test('stamp: wind-up, contact squash at 0.2 s, recoil, then back to idle; bigger values hit harder', () => {
  const at = (u, v = 10) => pose(5 + u, [{ clip: 'stamp', start: 5, opts: v }]);
  assert.ok(at(0.14)['wing-near'].r < 0, 'wind-up lifts the wing');
  const hit = at(0.2);
  assert.ok(hit['wing-near'].r > 40 && hit.body.sy < 1 && hit.body.sx > 1, 'contact slams and squashes');
  assert.ok(at(0.34).body.sy > idle(5.34).body.sy, 'recoil stretches back');
  const end = at(0.95), rest = idle(5.95);
  for (const r of ROLES) assert.ok(near(end[r].r, rest[r].r, 1e-9) && near(end[r].sy, rest[r].sy, 1e-9), `${r} settles`);
  assert.ok(1 - at(0.2, 100).body.sy > 1 - at(0.2, 2).body.sy, 'a 100x stamp hits harder than 2x');
  assert.ok(CLIPS.stamp(1e9).intensity <= 1.6);
});

test('salute: the wing comes up to the brow and holds longer for bigger bonuses', () => {
  const mid = pose(3, [{ clip: 'salute', start: 2, opts: 'regular' }]);
  assert.ok(mid['wing-near'].r < -80 && mid['hand-near'].r > 10);
  assert.ok(CLIPS.salute('hidden').length > CLIPS.salute('super').length && CLIPS.salute('super').length > CLIPS.salute('regular').length);
  const L = CLIPS.salute('regular').length;
  assert.ok(near(pose(2 + L + 0.01, [{ clip: 'salute', start: 2, opts: 'regular' }])['wing-near'].r, 0), 'released at the end');
});

test('blink closes and reopens the eyelids; letter check lifts the letter and tilts the head', () => {
  assert.equal(pose(1.08, [{ clip: 'blink', start: 1, opts: {} }]).eyelids.sy, 1);
  assert.equal(pose(1.2, [{ clip: 'blink', start: 1, opts: {} }]).eyelids.sy, 1, 'outside the clip the lids rest at their drawn state');
  const read = pose(2, [{ clip: 'letter', start: 1, opts: {} }]);
  assert.ok(read['wing-near'].r < -30 && read.letter.r > 5 && read.head.r > idle(2).head.r + 4);
  assert.equal(track([[0, 0], [1, 1]], 0.5), 0.5);
});

test('parts mode: children follow their parents, the body turns about the feet, draw order is by z', () => {
  const manifest = {
    width: 1200, height: 1600, feet: [600, 1500],
    parts: [
      { id: 'legs', pivot: [600, 1300], z: 1 }, { id: 'torso', pivot: [600, 1200], parent: 'legs', z: 3 },
      { id: 'head', pivot: [620, 700], parent: 'torso', z: 5 }, { id: 'wing', pivot: [720, 860], parent: 'torso', z: 6 },
      { id: 'forewing', pivot: [860, 1000], parent: 'wing', z: 7 }, { id: 'hand', pivot: [960, 1120], parent: 'forewing', z: 8 },
    ],
    roles: { torso: 'torso', head: 'head', 'wing-near': 'wing', 'forewing-near': 'forewing', 'hand-near': 'hand' },
  };
  for (const t of ts) {
    const p = pose(t, [{ clip: 'stamp', start: 1, opts: 20 }, { clip: 'salute', start: 4, opts: 'super' }]), w = partMatrices(manifest, p);
    const [fx, fy] = apply(w.get('legs'), manifest.feet);
    assert.ok(near(fx, 600, 1e-6) && near(fy, 1500, 1e-6), 'feet planted');
    // the forewing's pivot rides exactly where its parent wing carries it
    const carried = apply(w.get('wing'), [860, 1000]), own = apply(w.get('forewing'), [860, 1000]);
    assert.ok(near(carried[0], own[0], 1e-6) && near(carried[1], own[1], 1e-6), 'joint stays connected');
  }
  assert.deepEqual(drawOrder(manifest).map((q) => q.id), ['legs', 'torso', 'head', 'wing', 'forewing', 'hand']);
});

test('depot:frank cues: stamp plays the stamp clip with its meter value, bonus plays the salute with its tier', () => {
  const root = new EventTarget(), calls = [];
  const off = attachFrank(root, { play: (clip, opts) => calls.push([clip, opts]) });
  root.dispatchEvent(new CustomEvent('depot:frank', { detail: { action: 'stamp', value: 25 } }));
  root.dispatchEvent(new CustomEvent('depot:frank', { detail: { action: 'bonus', tier: 'hidden' } }));
  root.dispatchEvent(new CustomEvent('depot:frank', { detail: { action: 'other' } }));
  off();
  root.dispatchEvent(new CustomEvent('depot:frank', { detail: { action: 'stamp', value: 2 } }));
  assert.deepEqual(calls, [['stamp', 25], ['salute', 'hidden']]);
});
