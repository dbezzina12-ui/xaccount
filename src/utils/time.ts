/**
 * Timezone helpers built on Intl (no dependencies).
 *
 * Posts store a wall-clock date/time in their batch's timezone. X's
 * scheduling dialog works in the browser's local timezone, so right before
 * automation we convert: batch wall clock -> UTC instant -> browser wall clock.
 */
import type { LocalDateTime } from '../types';

export function browserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function listTimezones(): string[] {
  const anyIntl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
  const list = anyIntl.supportedValuesOf ? anyIntl.supportedValuesOf('timeZone') : [];
  const out = list.length ? [...list] : ['UTC'];
  const own = browserTimezone();
  if (!out.includes(own)) out.unshift(own);
  if (!out.includes('UTC')) out.push('UTC');
  return out;
}

const partsCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string): Intl.DateTimeFormat {
  let f = partsCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    partsCache.set(tz, f);
  }
  return f;
}

/** Wall clock of a UTC instant in the given timezone. */
export function utcToZoned(utcMs: number, tz: string): LocalDateTime & { second: number } {
  const parts = fmt(tz).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') % 24,
    minute: get('minute'),
    second: get('second'),
  };
}

/** Offset (ms) of tz from UTC at the given instant. */
export function tzOffsetMs(utcMs: number, tz: string): number {
  const z = utcToZoned(utcMs, tz);
  const asUtc = Date.UTC(z.year, z.month - 1, z.day, z.hour, z.minute, z.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** UTC instant for a wall-clock time in the given timezone. */
export function zonedToUtc(w: LocalDateTime, tz: string): number {
  const guess = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, 0);
  let utc = guess - tzOffsetMs(guess, tz);
  // Second pass handles instants near DST transitions.
  const off2 = tzOffsetMs(utc, tz);
  utc = guess - off2;
  return utc;
}

export function parseDate(date: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const year = +m[1], month = +m[2], day = +m[3];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function parseTime(time: string): { hour: number; minute: number } | null {
  const m = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m) return null;
  const hour = +m[1], minute = +m[2];
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatDateISO(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

export function minutesToHHMM(min: number): string {
  return `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;
}

export function hhmmToMinutes(t: string): number | null {
  const p = parseTime(t);
  return p ? p.hour * 60 + p.minute : null;
}

/** Add days to a YYYY-MM-DD string (calendar arithmetic, timezone independent). */
export function addDays(date: string, n: number): string {
  const p = parseDate(date);
  if (!p) return date;
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day + n));
  return formatDateISO(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Inclusive list of dates from start to end. */
export function dateRange(start: string, end: string): string[] {
  const out: string[] = [];
  if (!parseDate(start) || !parseDate(end) || start > end) return out;
  let d = start;
  while (d <= end && out.length < 400) {
    out.push(d);
    d = addDays(d, 1);
  }
  return out;
}

/** Today's date (YYYY-MM-DD) in a timezone. */
export function todayIn(tz: string, now = Date.now()): string {
  const z = utcToZoned(now, tz);
  return formatDateISO(z.year, z.month, z.day);
}

/** Current minute-of-day in a timezone. */
export function nowMinutesIn(tz: string, now = Date.now()): number {
  const z = utcToZoned(now, tz);
  return z.hour * 60 + z.minute;
}

/** UTC instant of a post's date/time in its batch timezone, or null. */
export function postInstant(date: string | null, time: string | null, tz: string): number | null {
  if (!date || !time) return null;
  const d = parseDate(date);
  const t = parseTime(time);
  if (!d || !t) return null;
  return zonedToUtc({ ...d, ...t }, tz);
}

/** Convert a batch wall-clock date/time into the browser-local wall clock X expects. */
export function toBrowserLocal(date: string, time: string, batchTz: string): LocalDateTime | null {
  const utc = postInstant(date, time, batchTz);
  if (utc === null) return null;
  const z = utcToZoned(utc, browserTimezone());
  return { year: z.year, month: z.month, day: z.day, hour: z.hour, minute: z.minute };
}

/** "GMT+2" style label for a timezone at a given instant. */
export function tzOffsetLabel(tz: string, at = Date.now()): string {
  const off = Math.round(tzOffsetMs(at, tz) / 60000);
  const sign = off >= 0 ? '+' : '-';
  const a = Math.abs(off);
  return `GMT${sign}${Math.floor(a / 60)}${a % 60 ? ':' + pad2(a % 60) : ''}`;
}

/** Long timezone name as Chrome renders it (e.g. "Central European Summer Time"). */
export function tzLongName(tz: string, at = Date.now()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'long' }).formatToParts(new Date(at));
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? tz;
  } catch {
    return tz;
  }
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatDateShort(date: string | null): string {
  const p = date ? parseDate(date) : null;
  if (!p) return '—';
  const wd = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
  return `${WEEKDAYS_SHORT[wd]} ${MONTHS_SHORT[p.month - 1]} ${p.day}`;
}

export function weekdayShort(date: string): string {
  const p = parseDate(date);
  if (!p) return '';
  return WEEKDAYS_SHORT[new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay()];
}

export function formatTime12(time: string | null): string {
  const p = time ? parseTime(time) : null;
  if (!p) return '—';
  const h = p.hour % 12 === 0 ? 12 : p.hour % 12;
  return `${h}:${pad2(p.minute)} ${p.hour < 12 ? 'AM' : 'PM'}`;
}

export function formatLocal(w: LocalDateTime): string {
  const h = w.hour % 12 === 0 ? 12 : w.hour % 12;
  return `${MONTHS_SHORT[w.month - 1]} ${w.day}, ${w.year} ${h}:${pad2(w.minute)} ${w.hour < 12 ? 'AM' : 'PM'}`;
}

export function clockTime(d = new Date()): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}
