/**
 * Shared data model. Everything in here is plain JSON (safe for
 * chrome.storage.local). Media binary data lives in IndexedDB and is
 * referenced by `MediaRef.id`.
 */

export type PostStatus = 'draft' | 'ready' | 'scheduling' | 'scheduled' | 'failed';

export type MediaKind = 'image' | 'gif' | 'video';

export interface MediaRef {
  /** Key of the blob in IndexedDB (store "media"). */
  id: string;
  name: string;
  mimeType: string;
  size: number;
  kind: MediaKind;
  /** Video duration in seconds when it could be read locally. */
  durationSec?: number;
  width?: number;
  height?: number;
}

export interface Post {
  id: string;
  text: string;
  media: MediaRef[];
  /** Wall-clock date in the batch timezone, `YYYY-MM-DD`. */
  date: string | null;
  /** Wall-clock time in the batch timezone, `HH:mm` (24h). */
  time: string | null;
  status: PostStatus;
  /** Last error message (status === 'failed'). */
  error?: string;
  /** Automation step at which the last failure happened. */
  failedStep?: string;
  /**
   * True when a failure happened after (or while) the final Schedule click
   * was sent, i.e. the post MAY exist in X already. Retrying such a post
   * could create a duplicate, so the UI warns first.
   */
  uncertain?: boolean;
  /** ISO timestamp of the successful schedule. */
  scheduledAt?: string;
  /** Result of the last dry run for this post. */
  dryRun?: { ok: boolean; at: string; message?: string };
  /** Result of "Verify in X" (scheduled list cross-check). */
  verifiedInX?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Batch {
  id: string;
  name: string;
  /** Handle (without @) this batch is meant for. Empty = not bound. */
  accountHandle: string;
  /** IANA timezone that post dates/times are expressed in. */
  timezone: string;
  posts: Post[];
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  defaultEarliest: string; // HH:mm
  defaultLatest: string; // HH:mm
  defaultMinGapMinutes: number;
  defaultTimezone: string;
  defaultPostsPerDay: number; // 0 = no limit
  /** Weighted character limit used for pre-flight validation (X free = 280). */
  characterLimit: number;
  /** Seconds to wait between posts during a bulk run. */
  delayBetweenPostsSec: number;
  dryRun: boolean;
  debug: boolean;
  /** Close the automation window when a run finishes. */
  closeAutomationWindow: boolean;
}

export interface DetectedAccount {
  handle: string | null;
  displayName?: string | null;
  detectedAt: string;
  url?: string;
}

/* ------------------------------------------------------------------ */
/* Messaging between the dashboard (orchestrator) and the content script */
/* ------------------------------------------------------------------ */

/** Wall-clock time in the *browser's* local timezone - what X's UI expects. */
export interface LocalDateTime {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number; // 0-59
}

export interface ScheduleJob {
  postId: string;
  postNumber: number;
  text: string;
  media: Array<Pick<MediaRef, 'id' | 'name' | 'mimeType' | 'size' | 'kind'>>;
  when: LocalDateTime;
  /** Expected timezone long name (e.g. "Central European Summer Time"), informational. */
  expectedTimezoneName?: string;
  dryRun: boolean;
  debug: boolean;
}

export type LogLevel = 'debug' | 'info' | 'success' | 'warn' | 'error';

export interface ScheduleResult {
  ok: boolean;
  dryRun: boolean;
  error?: string;
  step?: string;
  uncertain?: boolean;
  /** Confirmation text seen in X (toast or composer banner). */
  confirmation?: string;
}

/** One-shot messages (chrome.tabs.sendMessage). */
export type ContentRequest =
  | { type: 'xbs:ping' }
  | { type: 'xbs:getAccount' }
  | { type: 'xbs:readScheduledList' };

export interface PingResponse {
  ok: true;
  url: string;
  lang: string;
  loggedIn: boolean;
}

export interface ScheduledListResponse {
  ok: boolean;
  error?: string;
  /** Normalised text snapshots gathered while scrolling the list. */
  texts: string[];
  itemCount: number;
}

/** Port messages, dashboard -> content ("xbs-run" port). */
export type PortInbound =
  | { type: 'mediaBegin'; id: string; name: string; mimeType: string; size: number; chunks: number }
  | { type: 'mediaChunk'; id: string; index: number; data: string }
  | { type: 'schedule'; job: ScheduleJob };

/** Port messages, content -> dashboard. */
export type PortOutbound =
  | { type: 'mediaAck'; id: string; index: number }
  | { type: 'log'; level: LogLevel; message: string }
  | { type: 'step'; step: string }
  | { type: 'result'; result: ScheduleResult };

export const RUN_PORT_NAME = 'xbs-run';
