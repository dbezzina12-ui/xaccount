/**
 * Pre-flight validation for a post. Errors block scheduling; warnings are shown
 * but don't block (X's own composer has the final say during automation).
 */
import type { Post, Settings } from '../types';
import { checkMediaSet } from './media';
import { weightedLength } from './textCount';
import { parseDate, parseTime, postInstant } from './time';

/** Posts must be at least this far in the future when they are queued. */
export const MIN_LEAD_MINUTES = 5;

export interface PostValidation {
  errors: string[];
  warnings: string[];
  length: number;
}

export function validatePost(post: Post, timezone: string, settings: Pick<Settings, 'characterLimit'>, now = Date.now()): PostValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const length = weightedLength(post.text);
  if (!post.text.trim() && !post.media.length) errors.push('Post has no text or media.');
  if (length > settings.characterLimit) errors.push(`Text is ${length} characters; limit is ${settings.characterLimit}.`);
  if (!post.date) errors.push('No date set.');
  else if (!parseDate(post.date)) errors.push('Invalid date.');
  if (!post.time) errors.push('No time set.');
  else if (!parseTime(post.time)) errors.push('Invalid time.');
  const at = postInstant(post.date, post.time, timezone);
  if (at !== null) {
    if (at < now + MIN_LEAD_MINUTES * 60_000) errors.push('Scheduled time is in the past (or less than 5 minutes away).');
    if (at > now + 540 * 86_400_000) errors.push('X only allows scheduling up to about 18 months ahead.');
  }
  const media = checkMediaSet(post.media);
  errors.push(...media.errors);
  warnings.push(...media.warnings);
  return { errors, warnings, length };
}

/** Draft/Ready is derived from validity; other statuses are sticky. */
export function derivedStatus(post: Post, timezone: string, settings: Pick<Settings, 'characterLimit'>): Post['status'] {
  if (post.status === 'scheduled' || post.status === 'scheduling' || post.status === 'failed') return post.status;
  return validatePost(post, timezone, settings).errors.length ? 'draft' : 'ready';
}
