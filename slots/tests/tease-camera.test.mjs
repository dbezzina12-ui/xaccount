// The tease camera's push (S-27): how far it zooms for each landed FS count
// and reel, and that it stays out of layouts without separable scene layers.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { teaseZoom, punch, PUSH, createTeaseCamera } from '../games/zombify/runtime/tease-camera.js';

test('no push before two FS; then it grows with every tier and landed reel, up to the full push', () => {
  for (const strength of [PUSH.phone, PUSH.desktop]) {
    assert.equal(teaseZoom(0, 0, strength), 1);
    assert.equal(teaseZoom(1, 3, strength), 1);
    let last = 1;
    for (const count of [2, 3, 4, 5]) {
      const z = teaseZoom(count, 0, strength);
      assert.ok(z > last, `${count} FS pushes further`);
      last = z;
    }
    assert.ok(teaseZoom(2, 1, strength) > teaseZoom(2, 0, strength), 'a landed reel creeps it in');
    assert.equal(teaseZoom(5, 9, strength), 1 + strength, 'never past the full push');
    assert.equal(teaseZoom(9, 0, strength), teaseZoom(5, 0, strength), 'six or more FS count as five');
  }
});

test('the phone push, punch included, leaves at most a sliver of the board off screen', () => {
  // A phone board fills about 386 of 390 px; at the peak it overflows by
  // (scale - 1) x 386 px, shared between both sides.
  const peak = 1 + PUSH.phone + punch(PUSH.phone);
  assert.ok((peak - 1) * 386 < 30, `${((peak - 1) * 386).toFixed(1)} px overflow at the peak`);
  assert.ok(PUSH.far < 1, 'the background moves less than the reels');
});

test('without the Studio scene layers the camera does nothing', async () => {
  const none = createTeaseCamera({ game: null });
  none.push({ count: 3, landed: 1, drop: true, focus: 4 });
  assert.equal(none.active(), false);
  await none.release({ secured: true });
  const bare = { ownerDocument: { defaultView: {} }, querySelector: () => null, querySelectorAll: () => [] };
  assert.equal(createTeaseCamera({ game: bare }).active(), false);
});
