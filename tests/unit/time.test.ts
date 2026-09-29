import { describe, expect, it } from 'vitest';
import { addDays, dateRange, utcToZoned, zonedToUtc, tzOffsetLabel } from '../../src/utils/time';

describe('timezone conversion', () => {
  it('round-trips wall clock <-> UTC', () => {
    const w = { year: 2026, month: 10, day: 1, hour: 10, minute: 30 };
    for (const tz of ['Europe/Malta', 'America/New_York', 'Asia/Kolkata', 'UTC', 'Australia/Sydney']) {
      const utc = zonedToUtc(w, tz);
      const back = utcToZoned(utc, tz);
      expect({ ...back, second: undefined }).toMatchObject({ ...w, second: undefined });
    }
  });
  it('handles DST boundaries (Malta, last Sunday of October)', () => {
    const before = zonedToUtc({ year: 2026, month: 10, day: 24, hour: 12, minute: 0 }, 'Europe/Malta');
    const after = zonedToUtc({ year: 2026, month: 10, day: 26, hour: 12, minute: 0 }, 'Europe/Malta');
    expect(new Date(before).toISOString()).toBe('2026-10-24T10:00:00.000Z');
    expect(new Date(after).toISOString()).toBe('2026-10-26T11:00:00.000Z');
  });
  it('converts between zones', () => {
    const utc = zonedToUtc({ year: 2026, month: 10, day: 1, hour: 10, minute: 30 }, 'Europe/Malta');
    expect(utcToZoned(utc, 'America/New_York')).toMatchObject({ year: 2026, month: 10, day: 1, hour: 4, minute: 30 });
  });
  it('labels offsets', () => {
    expect(tzOffsetLabel('Asia/Kolkata', Date.UTC(2026, 0, 1))).toBe('GMT+5:30');
    expect(tzOffsetLabel('UTC')).toBe('GMT+0');
  });
});

describe('date helpers', () => {
  it('addDays and dateRange', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(dateRange('2026-10-05', '2026-10-11')).toHaveLength(7);
    expect(dateRange('2026-10-11', '2026-10-05')).toHaveLength(0);
  });
});
