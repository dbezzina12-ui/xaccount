import type { Settings } from '../types';
import { browserTimezone, isValidTimezone } from '../utils/time';
import { normalizePacing } from '../utils/pacing';
import { kvGet, kvSet } from './kv';

const KEY = 'xbs.settings';

export function defaultSettings(): Settings {
  return {
    defaultEarliest: '10:00',
    defaultLatest: '22:00',
    defaultMinGapMinutes: 90,
    defaultTimezone: browserTimezone(),
    defaultPostsPerDay: 5,
    characterLimit: 280,
    delayMinSec: 20,
    delayMaxSec: 60,
    breakEveryPosts: 10,
    breakMinutes: 4,
    dryRun: false,
    debug: false,
    closeAutomationWindow: true,
  };
}

export async function loadSettings(): Promise<Settings> {
  const stored = (await kvGet<Partial<Settings> & { delayBetweenPostsSec?: unknown }>(KEY)) ?? {};
  delete stored.delayBetweenPostsSec; // replaced by delayMinSec/delayMaxSec
  const s = { ...defaultSettings(), ...stored };
  Object.assign(s, normalizePacing(s));
  if (!isValidTimezone(s.defaultTimezone)) s.defaultTimezone = browserTimezone();
  return s;
}

export async function saveSettings(s: Settings): Promise<void> {
  await kvSet(KEY, s);
}
