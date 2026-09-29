/**
 * Runs ONE post through X's native scheduling workflow, step by step:
 *
 *   preflight → find composer → enter text → upload media → validate →
 *   open scheduler → set date → set time → verify dialog → confirm dialog →
 *   SAFETY GATE (banner + "Schedule" label) → click Schedule → verify
 *
 * Any failure stops the post, discards the draft (unless the Schedule click
 * may already have gone through) and returns a descriptive error.
 */
import type { ScheduleJob, ScheduleResult } from '../types';
import { AutomationError, type Logger } from './dom';
import {
  assertPostAccepted,
  attachMedia,
  confirmScheduleDialog,
  confirmScheduledPost,
  discardComposer,
  findComposer,
  enterPostText,
  openScheduler,
  preflight,
  setScheduleDate,
  setScheduleTime,
  snapshotToasts,
  verifyComposerSchedule,
  verifyPostScheduled,
  verifyScheduleDialog,
} from './xAutomation';

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Generous, size-based upload timeout (video processing can be slow). */
export function uploadTimeoutMs(files: File[]): number {
  const mb = files.reduce((s, f) => s + f.size, 0) / 1024 / 1024;
  const hasVideo = files.some((f) => f.type.startsWith('video/'));
  const ms = hasVideo ? 180_000 + mb * 4000 : 60_000 + mb * 3000;
  return Math.min(ms, 20 * 60_000);
}

export async function runScheduleJob(job: ScheduleJob, files: File[], log: Logger, onStep: (step: string) => void): Promise<ScheduleResult> {
  let current = 'preflight';
  let clicked = false;
  const step = (id: string, message: string, level: 'info' | 'debug' = 'debug') => {
    current = id;
    onStep(id);
    log(level, message);
  };
  const w = job.when;
  const whenLabel = `${w.year}-${pad2(w.month)}-${pad2(w.day)} ${pad2(w.hour)}:${pad2(w.minute)} (browser local time)`;

  try {
    step('preflight', `Post ${job.postNumber}: preflight checks`);
    preflight(log);

    step('find-composer', `Post ${job.postNumber}: waiting for the composer`);
    await findComposer(log);

    step('enter-text', `Post ${job.postNumber}: entering text`);
    await enterPostText(job.text, log);

    if (files.length) {
      step('upload-media', `Uploading media for Post ${job.postNumber}`, 'info');
      await attachMedia(files, log, uploadTimeoutMs(files));
      log('info', `Media upload complete for Post ${job.postNumber}`);
    }

    step('validate', `Post ${job.postNumber}: checking X accepts the content`);
    assertPostAccepted(log);

    step('open-scheduler', `Post ${job.postNumber}: opening the schedule dialog`);
    await openScheduler(log);

    step('set-date', `Post ${job.postNumber}: setting date/time to ${whenLabel}`);
    await setScheduleDate(w, log);
    step('set-time', `Post ${job.postNumber}: setting time`);
    await setScheduleTime(w, log);

    step('verify-date', `Post ${job.postNumber}: verifying the schedule dialog`);
    verifyScheduleDialog(w, log);

    step('confirm-date', `Post ${job.postNumber}: confirming the schedule dialog`);
    await confirmScheduleDialog(log);

    step('verify-composer', `Post ${job.postNumber}: final safety check before scheduling`);
    const { submit, banner } = await verifyComposerSchedule(w, job.text, job.media.length, log);
    log('debug', `Safety gate passed: "${banner}" and button reads "Schedule".`);

    if (job.dryRun) {
      log('warn', `DRY RUN — Post ${job.postNumber} verified ("${banner}"). NOT clicking Schedule; discarding draft.`);
      await discardComposer(log);
      return { ok: true, dryRun: true, confirmation: banner };
    }

    step('schedule', `Post ${job.postNumber}: clicking Schedule`);
    const ignore = snapshotToasts();
    clicked = true;
    confirmScheduledPost(submit, log);

    step('verify-scheduled', `Post ${job.postNumber}: waiting for X to confirm`);
    const confirmation = await verifyPostScheduled(log, ignore);
    return { ok: true, dryRun: false, confirmation };
  } catch (e) {
    const err =
      e instanceof AutomationError
        ? e
        : new AutomationError(`Unexpected error: ${(e as Error)?.message ?? String(e)}`, current, clicked);
    // "Aborted before clicking" errors thrown by confirmScheduledPost are not uncertain.
    const uncertain = clicked && err.step !== 'schedule' ? err.uncertain : false;
    if (!uncertain) {
      try {
        await discardComposer(log);
      } catch {
        /* best effort */
      }
    }
    return { ok: false, dryRun: job.dryRun, error: err.message, step: err.step, uncertain };
  }
}
