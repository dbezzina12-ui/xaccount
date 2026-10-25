import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarise } from '../games/zombify/runtime/perf-probe.js';

test('frame summaries count drops against the display refresh, at 60 and 120 Hz', () => {
  const sixty = [...Array(95).fill(16.7), 33.4, 33.4, 50.1, 50.1, 120];
  // 50.1 ms is three 60 Hz intervals (two frames missed): janky.
  assert.deepEqual(summarise(sixty, 16.7), { frames: 100, p50: 16.7, p95: 33.4, p99: 120, max: 120, dropped: 5, janky: 3 });
  // The same 16.7 ms frames are every-other-frame drops on a 120 Hz display.
  const oneTwenty = [...Array(90).fill(8.3), ...Array(10).fill(16.7)];
  assert.equal(summarise(oneTwenty).dropped, 10);
  assert.equal(summarise(oneTwenty, 8.3).p50, 8.3);
  assert.deepEqual(summarise([]), { frames: 0, p50: 0, p95: 0, p99: 0, max: 0, dropped: 0, janky: 0 });
});
