import { describe, expect, it } from 'vitest';
import { autoSchedule, mulberry32, placeInWindow } from '../../src/utils/autoSchedule';
import { hhmmToMinutes, zonedToUtc } from '../../src/utils/time';

const TZ = 'Europe/Malta';
// "Now" = Sunday 2026-10-04 09:00 Malta time, so the Mon–Sun range is entirely in the future.
const NOW = zonedToUtc({ year: 2026, month: 10, day: 4, hour: 9, minute: 0 }, TZ);

function abs(slot: { date: string; time: string }) {
  return new Date(slot.date + 'T00:00:00Z').getTime() / 60000 + hhmmToMinutes(slot.time)!;
}

describe('autoSchedule', () => {
  const base = {
    startDate: '2026-10-05',
    endDate: '2026-10-11',
    earliest: '10:00',
    latest: '22:00',
    minGapMinutes: 90,
    maxPerDay: 5,
    timezone: TZ,
    now: NOW,
  };

  it('fits 30 posts in a week and respects every constraint', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const r = autoSchedule(30, { ...base, random: mulberry32(seed) });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.slots).toHaveLength(30);
      const perDay = new Map<string, number>();
      for (const s of r.slots) {
        expect(s.date >= base.startDate && s.date <= base.endDate).toBe(true);
        const m = hhmmToMinutes(s.time)!;
        expect(m).toBeGreaterThanOrEqual(600);
        expect(m).toBeLessThanOrEqual(1320);
        perDay.set(s.date, (perDay.get(s.date) ?? 0) + 1);
      }
      for (const n of perDay.values()) expect(n).toBeLessThanOrEqual(5);
      const sorted = r.slots.map(abs).sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(90);
    }
  });

  it('spreads posts evenly across days', () => {
    const r = autoSchedule(30, { ...base, random: mulberry32(7) });
    if (!r.ok) throw new Error(r.error);
    const counts = r.perDay.map((d) => d.count);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    expect(r.perDay).toHaveLength(7);
  });

  it('varies times from day to day', () => {
    const r = autoSchedule(21, { ...base, random: mulberry32(3) });
    if (!r.ok) throw new Error(r.error);
    const firstOfDay = r.perDay.map((d) => r.slots.find((s) => s.date === d.date)!.time);
    expect(new Set(firstOfDay).size).toBeGreaterThan(3);
  });

  it('reports when posts cannot fit', () => {
    const r = autoSchedule(40, { ...base, random: mulberry32(1) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.capacity).toBe(35);
  });

  it('capacity is limited by the gap when no daily max', () => {
    // 10:00-22:00 with 90 min gap => 9 slots per day
    const r = autoSchedule(10, { ...base, endDate: '2026-10-05', maxPerDay: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.capacity).toBe(9);
    const ok = autoSchedule(9, { ...base, endDate: '2026-10-05', maxPerDay: 0, random: mulberry32(2) });
    expect(ok.ok).toBe(true);
  });

  it('skips past days and the past part of today', () => {
    // now = 2026-10-04 09:00; range starts 2026-10-03 (past) through 2026-10-04 (today)
    const r = autoSchedule(3, { ...base, startDate: '2026-10-03', endDate: '2026-10-04', random: mulberry32(5) });
    if (!r.ok) throw new Error(r.error);
    for (const s of r.slots) {
      expect(s.date).toBe('2026-10-04');
      expect(hhmmToMinutes(s.time)!).toBeGreaterThanOrEqual(600);
    }
  });

  it('validates inputs', () => {
    expect(autoSchedule(1, { ...base, earliest: '22:00', latest: '10:00' }).ok).toBe(false);
    expect(autoSchedule(1, { ...base, startDate: '2026-10-11', endDate: '2026-10-05' }).ok).toBe(false);
  });

  it('placeInWindow handles tight windows', () => {
    const t = placeInWindow(5, 600, 960, 90, mulberry32(9)); // exactly 5 slots fit
    expect(t).toEqual([600, 690, 780, 870, 960]);
  });
});
