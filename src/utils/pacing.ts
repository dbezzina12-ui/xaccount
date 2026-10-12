/**
 * Pacing between posts during a bulk run, so the extension doesn't push
 * dozens of posts into X's composer back-to-back:
 *  - a random wait between delayMinSec and delayMaxSec after each post
 *  - a longer break (breakMinutes, ±20%) after every breakEveryPosts posts
 *
 * Dry runs never schedule anything, so they use a short fixed pause instead.
 */
import type { Settings } from '../types';

export type PacingSettings = Pick<Settings, 'delayMinSec' | 'delayMaxSec' | 'breakEveryPosts' | 'breakMinutes'>;

export const DRY_RUN_DELAY_MS = 2000;

/** Rough time X needs to go through one post (page load, text, media, dialogs). */
export const AVG_POST_MS = 20_000;

export function normalizePacing(p: PacingSettings): PacingSettings {
  const min = Math.max(1, Math.round(Number(p.delayMinSec) || 1));
  const max = Math.max(min, Math.round(Number(p.delayMaxSec) || min));
  return {
    delayMinSec: min,
    delayMaxSec: max,
    breakEveryPosts: Math.max(0, Math.round(Number(p.breakEveryPosts) || 0)),
    breakMinutes: Math.max(0, Number(p.breakMinutes) || 0),
  };
}

/** Random wait (ms) between two posts. */
export function pickDelayMs(p: PacingSettings, rand: () => number = Math.random): number {
  const { delayMinSec, delayMaxSec } = normalizePacing(p);
  return Math.round((delayMinSec + rand() * (delayMaxSec - delayMinSec)) * 1000);
}

/** True when a longer break is due after `doneInRun` posts have been processed. */
export function isBreakDue(doneInRun: number, p: PacingSettings): boolean {
  const { breakEveryPosts, breakMinutes } = normalizePacing(p);
  return breakEveryPosts > 0 && breakMinutes > 0 && doneInRun > 0 && doneInRun % breakEveryPosts === 0;
}

/** Length of a longer break (ms), varied by ±20%. */
export function pickBreakMs(p: PacingSettings, rand: () => number = Math.random): number {
  return Math.round(normalizePacing(p).breakMinutes * 60_000 * (0.8 + rand() * 0.4));
}

/** Estimated duration (ms) of a run of `count` posts. */
export function estimateRunMs(count: number, p: PacingSettings, dryRun = false, perPostMs = AVG_POST_MS): number {
  if (count <= 0) return 0;
  const n = normalizePacing(p);
  const gaps = count - 1;
  if (dryRun) return count * perPostMs + gaps * DRY_RUN_DELAY_MS;
  const avgDelay = ((n.delayMinSec + n.delayMaxSec) / 2) * 1000;
  const breaks = n.breakEveryPosts > 0 && n.breakMinutes > 0 ? Math.floor(gaps / n.breakEveryPosts) : 0;
  // A break replaces the normal wait at that point.
  return count * perPostMs + (gaps - breaks) * avgDelay + breaks * n.breakMinutes * 60_000;
}

export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.round(totalSec / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}

export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function describePacing(p: PacingSettings): string {
  const n = normalizePacing(p);
  const wait = n.delayMinSec === n.delayMaxSec ? `${n.delayMinSec}s` : `${n.delayMinSec}–${n.delayMaxSec}s`;
  const brk = n.breakEveryPosts > 0 && n.breakMinutes > 0 ? `, ~${n.breakMinutes} min break every ${n.breakEveryPosts} posts` : '';
  return `${wait} between posts${brk}`;
}
