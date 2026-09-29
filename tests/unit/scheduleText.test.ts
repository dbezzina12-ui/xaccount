import { describe, expect, it } from 'vitest';
import { scheduleTextMatches } from '../../src/content/xAutomation';

const when = { year: 2026, month: 10, day: 1, hour: 10, minute: 30 };

describe('scheduleTextMatches (safety gate text check)', () => {
  it('accepts the US format X uses', () => {
    expect(scheduleTextMatches('Will send on Thu, Oct 1, 2026 at 10:30 AM', when)).toBe(true);
    expect(scheduleTextMatches('Will send on Thu, October 1, 2026 at 10:30\u202fAM', when)).toBe(true);
  });
  it('accepts UK day-month order and 24h clock', () => {
    expect(scheduleTextMatches('Will send on Thu, 1 Oct 2026 at 10:30', when)).toBe(true);
    expect(scheduleTextMatches('Will send on 1 Oct 2026 at 22:30', { ...when, hour: 22 })).toBe(true);
  });
  it('rejects wrong day, month, year, time or meridiem', () => {
    expect(scheduleTextMatches('Will send on Fri, Oct 2, 2026 at 10:30 AM', when)).toBe(false);
    expect(scheduleTextMatches('Will send on Thu, Nov 1, 2026 at 10:30 AM', when)).toBe(false);
    expect(scheduleTextMatches('Will send on Thu, Oct 1, 2027 at 10:30 AM', when)).toBe(false);
    expect(scheduleTextMatches('Will send on Thu, Oct 1, 2026 at 10:31 AM', when)).toBe(false);
    expect(scheduleTextMatches('Will send on Thu, Oct 1, 2026 at 10:30 PM', when)).toBe(false);
    expect(scheduleTextMatches('Will send on Thu, Oct 11, 2026 at 10:30 AM', when)).toBe(false);
  });
  it('handles midnight and noon', () => {
    expect(scheduleTextMatches('Will send on Oct 1, 2026 at 12:05 AM', { ...when, hour: 0, minute: 5 })).toBe(true);
    expect(scheduleTextMatches('Will send on Oct 1, 2026 at 12:05 PM', { ...when, hour: 12, minute: 5 })).toBe(true);
    expect(scheduleTextMatches('Will send on Oct 1, 2026 at 12:05 PM', { ...when, hour: 0, minute: 5 })).toBe(false);
  });
});
