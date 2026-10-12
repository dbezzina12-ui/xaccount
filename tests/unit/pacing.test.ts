import { describe, expect, it } from 'vitest';
import { estimateRunMs, isBreakDue, normalizePacing, pickBreakMs, pickDelayMs } from '../../src/utils/pacing';
import { mulberry32 } from '../../src/utils/autoSchedule';

const P = { delayMinSec: 20, delayMaxSec: 60, breakEveryPosts: 10, breakMinutes: 4 };

describe('pacing', () => {
  it('delays stay within min..max', () => {
    const r = mulberry32(1);
    for (let i = 0; i < 1000; i++) {
      const d = pickDelayMs(P, r);
      expect(d).toBeGreaterThanOrEqual(20_000);
      expect(d).toBeLessThanOrEqual(60_000);
    }
  });
  it('fixes min > max and negative values', () => {
    expect(normalizePacing({ delayMinSec: 50, delayMaxSec: 10, breakEveryPosts: -3, breakMinutes: -1 })).toEqual({ delayMinSec: 50, delayMaxSec: 50, breakEveryPosts: 0, breakMinutes: 0 });
    expect(pickDelayMs({ ...P, delayMinSec: 5, delayMaxSec: 5 })).toBe(5000);
  });
  it('takes a break after every N posts only', () => {
    const due = Array.from({ length: 30 }, (_, i) => i + 1).filter((n) => isBreakDue(n, P));
    expect(due).toEqual([10, 20, 30]);
    expect(isBreakDue(10, { ...P, breakEveryPosts: 0 })).toBe(false);
    expect(isBreakDue(10, { ...P, breakMinutes: 0 })).toBe(false);
  });
  it('break length varies by ±20%', () => {
    const r = mulberry32(2);
    for (let i = 0; i < 500; i++) {
      const b = pickBreakMs(P, r);
      expect(b).toBeGreaterThanOrEqual(0.8 * 240_000);
      expect(b).toBeLessThanOrEqual(1.2 * 240_000);
    }
  });
  it('estimates run time', () => {
    // 30 posts → 29 gaps: breaks after posts 10 and 20, normal 40s average waits for the other 27.
    expect(estimateRunMs(30, P, false, 20_000)).toBe(30 * 20_000 + 27 * 40_000 + 2 * 240_000);
    expect(estimateRunMs(1, P)).toBe(20_000);
    expect(estimateRunMs(0, P)).toBe(0);
    expect(estimateRunMs(3, P, true, 20_000)).toBe(3 * 20_000 + 2 * 2000);
  });
});
