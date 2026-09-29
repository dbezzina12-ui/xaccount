/**
 * Auto-scheduler: distributes N posts across a date range while respecting
 * an earliest/latest time window, a minimum gap and an optional daily max.
 *
 * Approach:
 *  1. Work out each day's usable window (today's window starts after "now").
 *  2. Capacity per day = min(maxPerDay, floor(window / gap) + 1).
 *  3. Spread the posts evenly across days (random tie-breaks for remainders).
 *  4. Within a day, split the window into k equal segments and jitter each
 *     post inside its segment. The jitter is bounded so consecutive posts
 *     stay >= gap apart, and it differs every day, so you don't get the
 *     same robotic times each day.
 *  5. A repair pass enforces the gap across the whole sequence (including
 *     across midnight) and a final check guarantees every constraint.
 */
import { dateRange, hhmmToMinutes, minutesToHHMM, nowMinutesIn, todayIn } from './time';

export interface AutoScheduleOptions {
  startDate: string;
  endDate: string;
  earliest: string; // HH:mm
  latest: string; // HH:mm
  minGapMinutes: number;
  /** 0 = no daily limit. */
  maxPerDay: number;
  timezone: string;
  /** Current time (ms); used to skip already-past slots today. */
  now?: number;
  /** Minimum minutes between "now" and the first slot today. */
  minLeadMinutes?: number;
  random?: () => number;
}

export interface Slot {
  date: string;
  time: string;
}

export type AutoScheduleResult =
  | { ok: true; slots: Slot[]; perDay: Array<{ date: string; count: number }> }
  | { ok: false; error: string; capacity: number };

interface DayWindow {
  date: string;
  index: number;
  start: number; // minute of day
  end: number;
  capacity: number;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function dayCapacity(start: number, end: number, gap: number, maxPerDay: number): number {
  if (end < start) return 0;
  const byGap = Math.floor((end - start) / Math.max(gap, 1)) + 1;
  return maxPerDay > 0 ? Math.min(byGap, maxPerDay) : byGap;
}

export function buildDayWindows(opts: AutoScheduleOptions): DayWindow[] | string {
  const earliest = hhmmToMinutes(opts.earliest);
  const latest = hhmmToMinutes(opts.latest);
  if (earliest === null || latest === null) return 'Earliest and latest times must be valid (HH:MM).';
  if (latest < earliest) return 'Latest posting time must be after the earliest posting time.';
  const days = dateRange(opts.startDate, opts.endDate);
  if (!days.length) return 'End date must be on or after the start date.';
  const gap = Math.max(1, Math.round(opts.minGapMinutes));
  const now = opts.now ?? Date.now();
  const today = todayIn(opts.timezone, now);
  const lead = opts.minLeadMinutes ?? 15;
  const nowMin = nowMinutesIn(opts.timezone, now);

  return days.map((date, index) => {
    let start = earliest;
    let end = latest;
    if (date < today) {
      end = -1; // entirely in the past
    } else if (date === today) {
      start = Math.max(start, nowMin + lead);
    }
    return { date, index, start, end, capacity: end < start ? 0 : dayCapacity(start, end, gap, opts.maxPerDay) };
  });
}

export function autoSchedule(count: number, opts: AutoScheduleOptions): AutoScheduleResult {
  const rand = opts.random ?? Math.random;
  const windows = buildDayWindows(opts);
  if (typeof windows === 'string') return { ok: false, error: windows, capacity: 0 };
  const capacity = windows.reduce((s, w) => s + w.capacity, 0);
  if (count <= 0) return { ok: true, slots: [], perDay: [] };
  if (count > capacity) {
    return {
      ok: false,
      capacity,
      error:
        `Cannot fit ${count} posts: these settings allow at most ${capacity}. ` +
        `Widen the date range or time window, reduce the minimum gap, or raise the daily maximum.`,
    };
  }
  const gap = Math.max(1, Math.round(opts.minGapMinutes));

  // Try a few random layouts; the repair pass almost always succeeds first time.
  for (let attempt = 0; attempt < 25; attempt++) {
    const slots = tryLayout(count, windows, gap, rand);
    if (slots) {
      const perDay = windows
        .map((w) => ({ date: w.date, count: slots.filter((s) => s.date === w.date).length }))
        .filter((d) => d.count > 0);
      return { ok: true, slots, perDay };
    }
  }
  return {
    ok: false,
    capacity,
    error: 'Could not satisfy the minimum gap across midnight. Narrow the daily time window or reduce the gap.',
  };
}

function tryLayout(count: number, windows: DayWindow[], gap: number, rand: () => number): Slot[] | null {
  // 1. Distribute counts evenly (water-filling with random tie-breaks).
  const counts = windows.map(() => 0);
  for (let n = 0; n < count; n++) {
    let best: number[] = [];
    let bestVal = Infinity;
    windows.forEach((w, i) => {
      if (counts[i] >= w.capacity) return;
      if (counts[i] < bestVal) {
        bestVal = counts[i];
        best = [i];
      } else if (counts[i] === bestVal) best.push(i);
    });
    if (!best.length) return null;
    counts[best[Math.floor(rand() * best.length)]]++;
  }

  // 2. Place times within each day.
  interface Item { dayIdx: number; abs: number; lo: number; hi: number }
  const items: Item[] = [];
  windows.forEach((w, i) => {
    const k = counts[i];
    if (!k) return;
    const times = placeInWindow(k, w.start, w.end, gap, rand);
    for (const t of times) items.push({ dayIdx: w.index, abs: w.index * 1440 + t, lo: w.index * 1440 + w.start, hi: w.index * 1440 + w.end });
  });

  // 3. Repair pass over the whole sequence (handles gaps across midnight too).
  for (let i = 0; i < items.length; i++) {
    const prev = i > 0 ? items[i - 1].abs + gap : -Infinity;
    items[i].abs = Math.max(items[i].abs, items[i].lo, prev);
  }
  for (let i = items.length - 1; i >= 0; i--) {
    const next = i < items.length - 1 ? items[i + 1].abs - gap : Infinity;
    items[i].abs = Math.min(items[i].abs, items[i].hi, next);
  }

  // 4. Verify every constraint; never return an invalid schedule.
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.abs < it.lo || it.abs > it.hi) return null;
    if (i > 0 && it.abs - items[i - 1].abs < gap) return null;
  }
  const perDayCheck = new Map<number, number>();
  for (const it of items) perDayCheck.set(it.dayIdx, (perDayCheck.get(it.dayIdx) ?? 0) + 1);
  for (const w of windows) if ((perDayCheck.get(w.index) ?? 0) > w.capacity) return null;

  return items.map((it) => ({
    date: windows[it.dayIdx].date,
    time: minutesToHHMM(it.abs - it.dayIdx * 1440),
  }));
}

/** k sorted minute values in [start, end], consecutive values >= gap apart. */
export function placeInWindow(k: number, start: number, end: number, gap: number, rand: () => number): number[] {
  const W = end - start;
  if (k === 1) {
    // Anywhere in the middle 70% of the window.
    return [Math.round(start + W * (0.15 + 0.7 * rand()))];
  }
  const seg = W / k;
  let raw: number[];
  if (seg >= gap) {
    // Jitter inside equal segments; |jitter| <= (seg - gap) / 2 keeps gaps >= gap.
    const J = (seg - gap) / 2;
    raw = Array.from({ length: k }, (_, i) => start + (i + 0.5) * seg + (rand() * 2 - 1) * J);
  } else {
    // Tight window: uniformly random valid layout.
    const slack = Math.max(0, W - (k - 1) * gap);
    const u = Array.from({ length: k }, () => rand() * slack).sort((a, b) => a - b);
    raw = u.map((v, i) => start + v + i * gap);
  }
  // Integer minutes, then local repair so rounding can't break the gap.
  const t = raw.map((v) => Math.round(v));
  for (let i = 0; i < k; i++) t[i] = Math.max(t[i], start, i ? t[i - 1] + gap : start);
  for (let i = k - 1; i >= 0; i--) t[i] = Math.min(t[i], end, i < k - 1 ? t[i + 1] - gap : end);
  return t;
}
