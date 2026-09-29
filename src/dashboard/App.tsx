import { useEffect, useMemo, useState } from 'react';
import type { Post } from '../types';
import { makePost, referencedMediaIds, useStore } from './store';
import { BulkRunner } from './engine/runner';
import { detectFromOpenTabs } from './engine/account';
import { collectGarbage } from '../storage/media';
import { validatePost } from '../utils/validation';
import { browserTimezone, formatDateShort, formatTime12, postInstant, tzOffsetLabel } from '../utils/time';
import { uid } from '../utils/id';
import { PostTable } from './components/PostTable';
import { PostEditor } from './components/PostEditor';
import { ImportDialog } from './components/ImportDialog';
import { AutoScheduleDialog } from './components/AutoScheduleDialog';
import { ProgressPanel } from './components/ProgressPanel';
import { ActivityLog } from './components/ActivityLog';
import { SettingsView } from './components/SettingsView';
import { BatchDialog } from './components/BatchDialog';
import { ConfirmDialog, Modal } from './components/Modal';

type Dialog =
  | { kind: 'none' }
  | { kind: 'edit'; post: Post | null }
  | { kind: 'import' }
  | { kind: 'auto' }
  | { kind: 'batch'; isNew: boolean }
  | { kind: 'clear' }
  | { kind: 'deleteBatch' }
  | { kind: 'confirmRun'; ids: string[]; skipped: string[]; uncertain: string[] }
  | { kind: 'noAccount'; ids: string[] }
  | { kind: 'mismatch'; ids: string[]; detected: string };

const sameHandle = (a?: string | null, b?: string | null) => !!a && !!b && a.replace(/^@/, '').toLowerCase() === b.replace(/^@/, '').toLowerCase();

export function App() {
  const { state, dispatch, stateRef, activeBatch, log } = useStore();
  const [view, setView] = useState<'queue' | 'settings'>(() => (location.hash === '#settings' ? 'settings' : 'queue'));
  const [dialog, setDialog] = useState<Dialog>({ kind: 'none' });
  const [detecting, setDetecting] = useState(false);

  const runner = useMemo(
    () =>
      new BulkRunner({
        getBatch: (id) => stateRef.current.batches.find((b) => b.id === id),
        getSettings: () => stateRef.current.settings,
        updatePost: (batchId, postId, patch) => dispatch({ type: 'updatePost', batchId, postId, patch }),
        log: (level, message) => log(level, message),
        onState: (run) => dispatch({ type: 'setRun', run }),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const busy = ['preparing', 'running', 'paused', 'stopping'].includes(state.run.status);

  useEffect(() => {
    const onHash = () => setView(location.hash === '#settings' ? 'settings' : 'queue');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Warn before closing the dashboard mid-run.
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (runner.isBusy()) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [runner]);

  const refreshAccount = async () => {
    setDetecting(true);
    try {
      const a = await detectFromOpenTabs();
      if (a) dispatch({ type: 'setAccount', account: a });
      else log('info', 'No open x.com tab reported an account. Open x.com (logged in) in a tab, or just press Schedule All — it opens X and checks.');
    } finally {
      setDetecting(false);
    }
  };
  useEffect(() => {
    if (state.loaded) void detectFromOpenTabs().then((a) => a && dispatch({ type: 'setAccount', account: a }));
  }, [state.loaded, dispatch]);

  const gc = () => setTimeout(() => void collectGarbage(referencedMediaIds(stateRef.current.batches)).catch(() => {}), 800);

  if (!state.loaded) return <div className="loading">Loading…</div>;

  const goto = (v: 'queue' | 'settings') => {
    location.hash = v === 'settings' ? '#settings' : '';
    setView(v);
  };

  if (view === 'settings') {
    return (
      <div className="app">
        <SettingsView onBack={() => goto('queue')} />
      </div>
    );
  }

  const batch = activeBatch;
  const posts = batch?.posts ?? [];
  const counts = {
    total: posts.length,
    ready: posts.filter((p) => p.status === 'ready').length,
    draft: posts.filter((p) => p.status === 'draft').length,
    scheduled: posts.filter((p) => p.status === 'scheduled').length,
    failed: posts.filter((p) => p.status === 'failed').length,
  };
  const acctHandle = state.account?.handle ?? null;
  const mismatch = !!batch?.accountHandle && !!acctHandle && !sameHandle(batch.accountHandle, acctHandle);
  const browserTz = browserTimezone();

  /* ------------------------------ run flow ------------------------------ */

  const requestRun = (onlyIds?: string[]) => {
    if (!batch || busy) return;
    const pool = onlyIds ? posts.filter((p) => onlyIds.includes(p.id)) : posts.filter((p) => p.status === 'ready' || (p.status === 'failed' && !p.uncertain));
    const skipped: string[] = [];
    const ids: string[] = [];
    for (const p of pool) {
      const v = validatePost(p, batch.timezone, state.settings);
      if (v.errors.length) skipped.push(`Post ${posts.indexOf(p) + 1}: ${v.errors[0]}`);
      else ids.push(p.id);
    }
    if (!onlyIds) {
      const drafts = posts.filter((p) => p.status === 'draft');
      drafts.forEach((p) => {
        const e = validatePost(p, batch.timezone, state.settings).errors[0];
        if (!skipped.some((s) => s.startsWith(`Post ${posts.indexOf(p) + 1}:`))) skipped.push(`Post ${posts.indexOf(p) + 1}: ${e ?? 'draft'}`);
      });
      posts.filter((p) => p.status === 'failed' && p.uncertain).forEach((p) => skipped.push(`Post ${posts.indexOf(p) + 1}: may already be in X (use Retry to force)`));
    }
    const uncertain = posts.filter((p) => ids.includes(p.id) && p.uncertain).map((p) => p.id);
    if (!ids.length) {
      log('warn', skipped.length ? `Nothing to schedule. ${skipped.length} post(s) need attention first.` : 'Nothing to schedule — all posts are already scheduled.');
      skipped.slice(0, 10).forEach((s) => log('warn', s));
      return;
    }
    setDialog({ kind: 'confirmRun', ids, skipped, uncertain });
  };

  const retryFailed = () => requestRun(posts.filter((p) => p.status === 'failed').map((p) => p.id));

  const prepareAndRun = async (ids: string[]) => {
    if (!batch) return;
    setDialog({ kind: 'none' });
    log('info', 'Opening X to check the logged-in account…');
    let handle: string | null = null;
    try {
      const r = await runner.detectAccount();
      handle = r.handle;
    } catch (e) {
      log('error', `Could not open X: ${(e as Error).message}`);
      return;
    }
    if (!handle) {
      setDialog({ kind: 'noAccount', ids });
      return;
    }
    dispatch({ type: 'setAccount', account: { handle, detectedAt: new Date().toISOString() } });
    log('info', `Logged in as @${handle}.`);
    const b = stateRef.current.batches.find((x) => x.id === batch.id);
    if (b?.accountHandle && !sameHandle(b.accountHandle, handle)) {
      setDialog({ kind: 'mismatch', ids, detected: handle });
      return;
    }
    if (b && !b.accountHandle) {
      dispatch({ type: 'updateBatch', id: b.id, patch: { accountHandle: handle } });
      log('info', `Batch "${b.name}" is now linked to @${handle}.`);
    }
    await runner.run(batch.id, ids);
  };

  /* ------------------------------ actions ------------------------------ */

  const duplicate = (p: Post) => {
    if (!batch) return;
    const copy = makePost({ text: p.text, media: p.media.map((m) => ({ ...m })), date: p.date, time: p.time });
    copy.id = uid('p_');
    dispatch({ type: 'addPosts', batchId: batch.id, posts: [copy], afterId: p.id });
  };

  const sortByDate = () => {
    if (!batch) return;
    const key = (p: Post) => postInstant(p.date, p.time, batch.timezone) ?? Number.MAX_SAFE_INTEGER;
    dispatch({ type: 'setPosts', batchId: batch.id, posts: [...posts].sort((a, b) => key(a) - key(b)) });
  };

  const clearQueue = (mode: 'scheduled' | 'all') => {
    if (!batch) return;
    const ids = mode === 'all' ? posts.map((p) => p.id) : posts.filter((p) => p.status === 'scheduled').map((p) => p.id);
    dispatch({ type: 'deletePosts', batchId: batch.id, ids });
    log('info', `Removed ${ids.length} post(s) from "${batch.name}".`);
    setDialog({ kind: 'none' });
    gc();
  };

  const deleteBatch = () => {
    if (!batch) return;
    dispatch({ type: 'deleteBatch', id: batch.id });
    log('info', `Deleted batch "${batch.name}".`);
    setDialog({ kind: 'none' });
    gc();
  };

  /* ------------------------------ render ------------------------------ */

  const firstLast = (() => {
    if (dialog.kind !== 'confirmRun' || !batch) return null;
    const sel = posts.filter((p) => dialog.ids.includes(p.id));
    const sorted = [...sel].sort((a, b) => (postInstant(a.date, a.time, batch.timezone) ?? 0) - (postInstant(b.date, b.time, batch.timezone) ?? 0));
    return { first: sorted[0], last: sorted[sorted.length - 1] };
  })();

  return (
    <div className="app">
      {state.settings.dryRun && (
        <div className="dry-banner">
          <strong>DRY RUN MODE</strong> — nothing will be scheduled. Every step runs except the final “Schedule” click.
          <button className="btn btn-sm" onClick={() => dispatch({ type: 'setSettings', settings: { ...state.settings, dryRun: false } })} disabled={busy}>
            Turn off
          </button>
        </div>
      )}

      <header className="topbar">
        <div className="brand">
          <img src="icons/icon32.png" alt="" width={22} height={22} />
          <span>X Bulk Scheduler</span>
        </div>

        <div className="batch-picker">
          <select value={state.activeBatchId} onChange={(e) => dispatch({ type: 'setActiveBatch', id: e.target.value })} disabled={busy} aria-label="Batch">
            {state.batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
                {b.accountHandle ? ` · @${b.accountHandle}` : ''}
              </option>
            ))}
          </select>
          <button className="btn btn-sm" onClick={() => setDialog({ kind: 'batch', isNew: true })} disabled={busy}>
            New batch
          </button>
          <button className="btn btn-sm" onClick={() => setDialog({ kind: 'batch', isNew: false })} disabled={busy || !batch} title="Rename, account, timezone">
            Batch settings
          </button>
          <button className="btn btn-sm btn-danger-ghost" onClick={() => setDialog({ kind: 'deleteBatch' })} disabled={busy || !batch} title="Delete batch">
            Delete
          </button>
        </div>

        <span className="spacer" />

        <div className={`account ${mismatch ? 'account-warn' : ''}`} title={state.account ? `Detected ${new Date(state.account.detectedAt).toLocaleString()}` : ''}>
          <span className="muted small">Current account</span>
          <strong>{acctHandle ? `@${acctHandle}` : 'Not detected'}</strong>
          <button className="icon-btn" onClick={() => void refreshAccount()} disabled={detecting} title="Re-detect from open x.com tabs">
            ↻
          </button>
        </div>

        <label className="switch" title="Dry run: never clicks the final Schedule button">
          <input type="checkbox" checked={state.settings.dryRun} disabled={busy} onChange={(e) => dispatch({ type: 'setSettings', settings: { ...state.settings, dryRun: e.target.checked } })} />
          <span>Dry run</span>
        </label>
        <label className="switch" title="Log every automation step and selector">
          <input type="checkbox" checked={state.settings.debug} onChange={(e) => dispatch({ type: 'setSettings', settings: { ...state.settings, debug: e.target.checked } })} />
          <span>Debug</span>
        </label>
        <button className="btn btn-sm btn-ghost" onClick={() => goto('settings')} disabled={busy}>
          Settings
        </button>
      </header>

      {mismatch && batch && (
        <div className="notice notice-warn inline-notice">
          This batch was created for <strong>@{batch.accountHandle}</strong> but you are currently logged into <strong>@{acctHandle}</strong>. Switch accounts in X before scheduling.
        </div>
      )}

      <div className="toolbar">
        <button className="btn" onClick={() => setDialog({ kind: 'edit', post: null })} disabled={busy || !batch}>
          + Add Post
        </button>
        <button className="btn" onClick={() => setDialog({ kind: 'import' })} disabled={busy || !batch}>
          Import Posts
        </button>
        <button className="btn" onClick={() => setDialog({ kind: 'auto' })} disabled={busy || !posts.length}>
          Auto Schedule
        </button>
        <button className="btn btn-ghost" onClick={sortByDate} disabled={busy || posts.length < 2} title="Sort the list chronologically">
          Sort by time
        </button>
        <button className={`btn ${state.settings.dryRun ? 'btn-warn' : 'btn-primary'}`} onClick={() => requestRun()} disabled={busy || !posts.length}>
          {state.settings.dryRun ? 'Dry Run All' : 'Schedule All'}
        </button>
        <button className="btn btn-danger-ghost" onClick={() => setDialog({ kind: 'clear' })} disabled={busy || !posts.length}>
          Clear Queue
        </button>
        <span className="spacer" />
        <div className="counts">
          <span>{counts.total} posts</span>
          <span className="c-ready">{counts.ready} ready</span>
          {counts.draft > 0 && <span className="c-draft">{counts.draft} draft</span>}
          <span className="c-scheduled">{counts.scheduled} scheduled</span>
          {counts.failed > 0 && <span className="c-failed">{counts.failed} failed</span>}
        </div>
      </div>

      <div className="main">
        <div className="table-wrap">
          {batch && (
            <div className="tz-line">
              Times shown in <strong>{batch.timezone}</strong> ({tzOffsetLabel(batch.timezone)})
              {batch.timezone !== browserTz && (
                <span className="msg-warn">
                  {' '}
                  · this browser is in {browserTz} ({tzOffsetLabel(browserTz)}) — times are converted automatically for X
                </span>
              )}
            </div>
          )}
          {batch && <PostTable batch={batch} locked={busy} onEdit={(p) => setDialog({ kind: 'edit', post: p })} onDuplicate={duplicate} onRetry={(ids) => requestRun(ids)} />}
        </div>
        <aside className="sidebar">
          <ProgressPanel runner={runner} onRetryFailed={retryFailed} onVerify={() => batch && void runner.verifyInX(batch.id)} failedCount={counts.failed} scheduledCount={counts.scheduled} />
          <ActivityLog />
        </aside>
      </div>

      {/* ------------------------------ dialogs ------------------------------ */}
      {dialog.kind === 'edit' && batch && (
        <PostEditor
          batch={batch}
          post={dialog.post ? (posts.find((p) => p.id === dialog.post!.id) ?? null) : null}
          locked={busy}
          onClose={() => {
            setDialog({ kind: 'none' });
            gc();
          }}
        />
      )}
      {dialog.kind === 'import' && batch && <ImportDialog batch={batch} onClose={() => setDialog({ kind: 'none' })} />}
      {dialog.kind === 'auto' && batch && <AutoScheduleDialog batch={batch} onClose={() => setDialog({ kind: 'none' })} />}
      {dialog.kind === 'batch' && <BatchDialog batch={dialog.isNew ? null : (batch ?? null)} onClose={() => setDialog({ kind: 'none' })} />}

      {dialog.kind === 'clear' && (
        <Modal
          title="Clear queue"
          onClose={() => setDialog({ kind: 'none' })}
          width={480}
          footer={
            <>
              <button className="btn" onClick={() => setDialog({ kind: 'none' })}>
                Cancel
              </button>
              <button className="btn" onClick={() => clearQueue('scheduled')} disabled={!counts.scheduled}>
                Remove scheduled only ({counts.scheduled})
              </button>
              <button className="btn btn-danger" onClick={() => clearQueue('all')}>
                Remove all ({counts.total})
              </button>
            </>
          }
        >
          <p>Removing posts here never touches X — posts already scheduled in X stay scheduled.</p>
        </Modal>
      )}

      {dialog.kind === 'deleteBatch' && batch && (
        <ConfirmDialog
          title="Delete batch"
          danger
          confirmLabel="Delete batch"
          message={
            <>
              Delete <strong>{batch.name}</strong> and its {posts.length} post(s)? This can't be undone. Posts already scheduled in X are not affected.
            </>
          }
          onConfirm={deleteBatch}
          onCancel={() => setDialog({ kind: 'none' })}
        />
      )}

      {dialog.kind === 'confirmRun' && batch && firstLast && (
        <ConfirmDialog
          title={state.settings.dryRun ? `Dry run ${dialog.ids.length} post(s)?` : `Schedule ${dialog.ids.length} post(s) on X?`}
          confirmLabel={state.settings.dryRun ? 'Start dry run' : `Schedule ${dialog.ids.length} post(s)`}
          message={
            <div className="confirm-run">
              {state.settings.dryRun ? (
                <div className="notice notice-warn">DRY RUN — the final “Schedule” button will NOT be clicked. Nothing will be scheduled.</div>
              ) : (
                <div className="notice">A separate X window will open and each post will be scheduled one at a time using X's own scheduler. Keep this dashboard open until it finishes.</div>
              )}
              <dl className="kv">
                <dt>Batch</dt>
                <dd>{batch.name}</dd>
                <dt>Account</dt>
                <dd>{batch.accountHandle ? `@${batch.accountHandle}` : 'Not set — will use the logged-in account'}</dd>
                <dt>First post</dt>
                <dd>
                  {formatDateShort(firstLast.first.date)} {formatTime12(firstLast.first.time)}
                </dd>
                <dt>Last post</dt>
                <dd>
                  {formatDateShort(firstLast.last.date)} {formatTime12(firstLast.last.time)}
                </dd>
                <dt>Timezone</dt>
                <dd>
                  {batch.timezone} ({tzOffsetLabel(batch.timezone)})
                </dd>
              </dl>
              {dialog.uncertain.length > 0 && (
                <div className="notice notice-warn">
                  {dialog.uncertain.length} post(s) may already be in X's scheduled queue (a previous attempt was interrupted after clicking Schedule). Check X first to avoid duplicates.
                </div>
              )}
              {dialog.skipped.length > 0 && (
                <details className="small">
                  <summary>{dialog.skipped.length} post(s) will be skipped</summary>
                  <ul>
                    {dialog.skipped.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          }
          extra={
            dialog.uncertain.length > 0 ? (
              <button className="btn" onClick={() => void prepareAndRun(dialog.ids.filter((id) => !dialog.uncertain.includes(id)))}>
                Skip uncertain
              </button>
            ) : undefined
          }
          onConfirm={() => void prepareAndRun(dialog.ids)}
          onCancel={() => setDialog({ kind: 'none' })}
        />
      )}

      {dialog.kind === 'noAccount' && (
        <ConfirmDialog
          title="Not logged into X"
          confirmLabel="Continue"
          message="Could not detect a logged-in X account in the X window. Log into X there (your password is never seen by this extension), then press Continue."
          onConfirm={() => void prepareAndRun(dialog.ids)}
          onCancel={() => {
            setDialog({ kind: 'none' });
            log('warn', 'Run cancelled: no logged-in X account.');
          }}
        />
      )}

      {dialog.kind === 'mismatch' && batch && (
        <ConfirmDialog
          title="Different X account"
          confirmLabel="Continue"
          message={
            <>
              <p>
                This batch was created for <strong>@{batch.accountHandle}</strong> but you are currently logged into <strong>@{dialog.detected}</strong>.
              </p>
              <p className="muted small">Switch to @{batch.accountHandle} in the X window, then press Continue (the account is checked again).</p>
            </>
          }
          extra={
            <button
              className="btn"
              onClick={() => {
                dispatch({ type: 'updateBatch', id: batch.id, patch: { accountHandle: dialog.detected } });
                log('warn', `Batch "${batch.name}" re-assigned to @${dialog.detected}.`);
                void prepareAndRun(dialog.ids);
              }}
            >
              Use @{dialog.detected} instead
            </button>
          }
          onConfirm={() => void prepareAndRun(dialog.ids)}
          onCancel={() => {
            setDialog({ kind: 'none' });
            log('warn', 'Run cancelled: account mismatch.');
          }}
        />
      )}
    </div>
  );
}
