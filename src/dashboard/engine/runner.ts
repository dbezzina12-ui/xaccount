/**
 * Bulk scheduling engine. Processes posts strictly one at a time:
 * load composer → run job in the X tab → record result → short pause → next.
 *
 * Pause / Stop take effect at the safe point between posts - a post that is
 * mid-flight always finishes (or fails) cleanly first.
 */
import type { Batch, LogLevel, Post, ScheduleJob, Settings } from '../../types';
import { X_URLS } from '../../content/xSelectors';
import { validatePost } from '../../utils/validation';
import { browserTimezone, formatLocal, toBrowserLocal, tzLongName } from '../../utils/time';
import { alnumKey } from '../../utils/text';
import { nowIso } from '../../utils/id';
import { TabGoneError, XTabController } from './xTab';

export type RunStatus = 'idle' | 'preparing' | 'running' | 'paused' | 'stopping' | 'finished';

export interface RunState {
  status: RunStatus;
  dryRun: boolean;
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  currentPostId: string | null;
  currentNumber: number | null;
  currentStep: string | null;
  summary: string | null;
  /** True when every post in the run succeeded (and it wasn't a dry run). */
  allScheduled: boolean;
}

export const IDLE_STATE: RunState = {
  status: 'idle',
  dryRun: false,
  total: 0,
  processed: 0,
  succeeded: 0,
  failed: 0,
  currentPostId: null,
  currentNumber: null,
  currentStep: null,
  summary: null,
  allScheduled: false,
};

export interface RunnerDeps {
  getBatch(batchId: string): Batch | undefined;
  getSettings(): Settings;
  updatePost(batchId: string, postId: string, patch: Partial<Post>): void;
  log(level: LogLevel, message: string): void;
  onState(state: RunState): void;
}

const STEP_LABELS: Record<string, string> = {
  'transfer-media': 'Sending media to the X tab',
  preflight: 'Preflight checks',
  'find-composer': 'Opening composer',
  'enter-text': 'Entering text',
  'upload-media': 'Uploading media',
  validate: 'Validating content',
  'open-scheduler': 'Opening schedule dialog',
  'set-date': 'Setting date',
  'set-time': 'Setting time',
  'verify-date': 'Verifying date/time',
  'confirm-date': 'Confirming date/time',
  'verify-composer': 'Final safety check',
  schedule: 'Clicking Schedule',
  'verify-scheduled': 'Confirming with X',
};

export function stepLabel(step: string | null): string {
  return step ? (STEP_LABELS[step] ?? step) : '';
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class BulkRunner {
  readonly xtab = new XTabController();
  private state: RunState = { ...IDLE_STATE };
  private pauseRequested = false;
  private stopRequested = false;
  private resumeWaiters: Array<() => void> = [];

  constructor(private deps: RunnerDeps) {}

  getState(): RunState {
    return this.state;
  }

  private set(patch: Partial<RunState>) {
    this.state = { ...this.state, ...patch };
    this.deps.onState(this.state);
  }

  isBusy(): boolean {
    return ['preparing', 'running', 'paused', 'stopping'].includes(this.state.status);
  }

  pause() {
    if (this.state.status !== 'running') return;
    this.pauseRequested = true;
    this.deps.log('warn', 'Pause requested — will pause after the current post.');
  }

  resume() {
    this.pauseRequested = false;
    const w = this.resumeWaiters;
    this.resumeWaiters = [];
    w.forEach((f) => f());
  }

  stop() {
    if (!this.isBusy()) return;
    this.stopRequested = true;
    this.set({ status: 'stopping' });
    this.deps.log('warn', 'Stop requested — no further posts will be started.');
    this.resume();
  }

  resetState() {
    if (!this.isBusy()) this.set({ ...IDLE_STATE });
  }

  /** Open the automation window on X and read the logged-in handle. */
  async detectAccount(): Promise<{ handle: string | null; loggedIn: boolean }> {
    this.set({ ...IDLE_STATE, status: 'preparing' });
    try {
      await this.xtab.open(X_URLS.home);
      const acct = await this.xtab.getAccount();
      return { handle: acct.handle, loggedIn: acct.loggedIn };
    } finally {
      if (this.state.status === 'preparing') this.set({ status: 'idle' });
    }
  }

  async run(batchId: string, postIds: string[]): Promise<void> {
    const settings = this.deps.getSettings();
    const dry = settings.dryRun;
    const log = this.deps.log;
    this.pauseRequested = false;
    this.stopRequested = false;
    this.set({ ...IDLE_STATE, status: 'running', dryRun: dry, total: postIds.length });
    log('info', `${dry ? 'DRY RUN started' : 'Bulk scheduling started'}: ${postIds.length} post${postIds.length === 1 ? '' : 's'}.`);
    const tzName = tzLongName(browserTimezone());

    let consecutiveFailures = 0;
    let stoppedEarly = false;

    for (let i = 0; i < postIds.length; i++) {
      if (this.stopRequested) {
        stoppedEarly = true;
        break;
      }
      if (this.pauseRequested) {
        this.set({ status: 'paused', currentStep: null });
        log('warn', 'Paused. Press Resume to continue.');
        await new Promise<void>((r) => this.resumeWaiters.push(r));
        if (this.stopRequested) {
          stoppedEarly = true;
          break;
        }
        this.set({ status: 'running' });
        log('info', 'Resumed.');
      }

      const batch = this.deps.getBatch(batchId);
      const post = batch?.posts.find((p) => p.id === postIds[i]);
      if (!batch || !post) continue;
      const number = batch.posts.indexOf(post) + 1;
      this.set({ currentPostId: post.id, currentNumber: number, currentStep: null });

      const ok = await this.processOne(batch, post, number, dry, settings, tzName);
      if (ok === 'tab-gone') {
        this.set({ processed: this.state.processed + 1, failed: this.state.failed + 1 });
        log('error', 'The X window was closed — run stopped. Remaining posts were not touched.');
        stoppedEarly = true;
        break;
      }
      if (ok) {
        consecutiveFailures = 0;
        this.set({ processed: this.state.processed + 1, succeeded: this.state.succeeded + 1 });
      } else {
        consecutiveFailures++;
        this.set({ processed: this.state.processed + 1, failed: this.state.failed + 1 });
      }

      const remaining = postIds.length - i - 1;
      if (consecutiveFailures >= 3 && remaining > 0) {
        log('error', "Stopped after 3 failures in a row — X's interface may have changed. Try a Dry run with Debug mode on (see TROUBLESHOOTING.md).");
        stoppedEarly = true;
        break;
      }
      if (remaining > 0 && !this.stopRequested) {
        const base = Math.max(0.5, settings.delayBetweenPostsSec) * 1000;
        const until = Date.now() + base * (0.75 + Math.random() * 0.5);
        while (Date.now() < until && !this.stopRequested) await sleep(200);
      }
    }

    const { succeeded, failed, total } = this.state;
    let summary: string;
    if (dry) summary = `Dry run finished: ${succeeded}/${total} posts passed every check. Nothing was scheduled.`;
    else if (failed === 0 && succeeded === total) summary = `${succeeded}/${total} posts successfully scheduled.`;
    else summary = `${succeeded}/${total} posts scheduled${failed ? ` — ${failed} failed` : ''}${stoppedEarly ? ' (stopped early)' : ''}.`;
    const allScheduled = !dry && succeeded === total && failed === 0;
    this.set({ status: 'finished', currentPostId: null, currentNumber: null, currentStep: null, summary, allScheduled });
    log(allScheduled || (dry && failed === 0) ? 'success' : failed ? 'warn' : 'info', summary);

    if (settings.closeAutomationWindow && !settings.debug && failed === 0) await this.xtab.close();
  }

  /** Returns true on success, false on failure, 'tab-gone' if the X window disappeared. */
  private async processOne(batch: Batch, post: Post, number: number, dry: boolean, settings: Settings, tzName: string): Promise<boolean | 'tab-gone'> {
    const log = this.deps.log;
    const update = (patch: Partial<Post>) => this.deps.updatePost(batch.id, post.id, { ...patch, updatedAt: nowIso() });
    const fail = (error: string, step: string, uncertain = false) => {
      if (dry) update({ dryRun: { ok: false, at: nowIso(), message: error } });
      else update({ status: 'failed', error, failedStep: step, uncertain });
      log('error', `Post ${number} failed${step ? ` (${stepLabel(step)})` : ''}: ${error}`);
    };

    const v = validatePost(post, batch.timezone, settings);
    if (v.errors.length) {
      fail(v.errors[0], 'validate');
      return false;
    }
    const when = toBrowserLocal(post.date!, post.time!, batch.timezone);
    if (!when) {
      fail('Invalid date/time.', 'validate');
      return false;
    }

    if (!dry) update({ status: 'scheduling', error: undefined, failedStep: undefined, uncertain: false });
    log('info', `Post ${number}: ${dry ? 'dry run' : 'scheduling'} for ${formatLocal(when)} (${tzName})`);

    const job: ScheduleJob = {
      postId: post.id,
      postNumber: number,
      text: post.text,
      media: post.media.map(({ id, name, mimeType, size, kind }) => ({ id, name, mimeType, size, kind })),
      when,
      expectedTimezoneName: tzName,
      dryRun: dry,
      debug: settings.debug,
    };

    try {
      await this.xtab.navigate(X_URLS.compose);
      const res = await this.xtab.runJob(
        job,
        (level, message) => log(level, message),
        (step) => this.set({ currentStep: step }),
      );
      if (res.ok) {
        if (dry) {
          update({ dryRun: { ok: true, at: nowIso(), message: res.confirmation } });
          log('success', `Post ${number} dry run passed — ${res.confirmation ?? 'verified'}`);
        } else {
          update({ status: 'scheduled', scheduledAt: nowIso(), error: undefined, failedStep: undefined, uncertain: false, verifiedInX: undefined });
          log('success', `Post ${number} scheduled successfully`);
        }
        return true;
      }
      fail(res.error ?? 'Unknown error.', res.step ?? '', !!res.uncertain);
      if (res.uncertain) log('warn', `Post ${number} MAY have been scheduled — check X's scheduled posts before retrying it.`);
      return false;
    } catch (e) {
      if (e instanceof TabGoneError) {
        fail(e.message, 'navigate');
        return 'tab-gone';
      }
      fail((e as Error).message ?? String(e), 'navigate');
      return false;
    }
  }

  /**
   * Cross-check: open X's scheduled posts list and look for each post that
   * this batch marked as scheduled.
   */
  async verifyInX(batchId: string): Promise<void> {
    const log = this.deps.log;
    const batch = this.deps.getBatch(batchId);
    if (!batch) return;
    const targets = batch.posts.filter((p) => p.status === 'scheduled');
    if (!targets.length) {
      log('info', 'No scheduled posts in this batch to verify.');
      return;
    }
    this.set({ ...IDLE_STATE, status: 'preparing' });
    try {
      log('info', "Opening X's scheduled posts list…");
      await this.xtab.open(X_URLS.scheduledList);
      const r = await this.xtab.readScheduledList();
      if (!r.ok) throw new Error(r.error ?? "Could not read X's scheduled posts list.");
      const page = alnumKey(r.texts.join(' '));
      let found = 0;
      let checked = 0;
      for (const p of targets) {
        const key = alnumKey(p.text).slice(0, 40);
        if (!key) continue; // media-only posts can't be matched by text
        checked++;
        const ok = page.includes(key);
        if (ok) found++;
        this.deps.updatePost(batchId, p.id, { verifiedInX: ok });
      }
      const lvl: LogLevel = found === checked ? 'success' : 'warn';
      log(lvl, `Verify in X: found ${found}/${checked} of this batch's scheduled posts in X's scheduled list (X lists ~${r.itemCount} scheduled posts in total).`);
      if (found < checked) log('warn', 'Posts marked "Not found" may be truncated or shown differently by X — check them manually in X before re-scheduling.');
    } catch (e) {
      log('error', `Verify in X failed: ${(e as Error).message}`);
    } finally {
      this.set({ status: 'idle' });
    }
  }
}
