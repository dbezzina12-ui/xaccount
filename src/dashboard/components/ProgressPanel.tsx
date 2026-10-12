import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { stepLabel, type BulkRunner } from '../engine/runner';
import { estimateRunMs, formatCountdown, formatDuration } from '../../utils/pacing';

/** Re-render every second while `active` (for countdowns). */
function useTick(active: boolean) {
  const [, setN] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setN((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [active]);
}

interface Props {
  runner: BulkRunner;
  onRetryFailed: () => void;
  onVerify: () => void;
  failedCount: number;
  scheduledCount: number;
}

export function ProgressPanel({ runner, onRetryFailed, onVerify, failedCount, scheduledCount }: Props) {
  const { state } = useStore();
  const r = state.run;
  const active = ['running', 'paused', 'stopping'].includes(r.status);
  const pct = r.total ? Math.round((r.processed / r.total) * 100) : 0;
  const remaining = Math.max(0, r.total - r.processed);
  useTick(active);
  const waitLeft = r.nextPostAt ? Math.max(0, r.nextPostAt - Date.now()) : 0;
  // Remaining = current wait + the posts still to do (incl. their waits/breaks).
  const etaMs = active && remaining > 0 ? waitLeft + estimateRunMs(remaining, state.settings, r.dryRun, r.avgPostMs ?? undefined) : 0;

  if (r.status === 'idle' && !failedCount && !scheduledCount) return null;

  return (
    <section className={`panel progress-panel ${r.dryRun ? 'is-dry' : ''}`}>
      {r.status === 'preparing' && <div className="progress-title">Connecting to X…</div>}
      {active && (
        <>
          <div className="progress-title">
            {r.status === 'paused' ? 'Paused' : r.status === 'stopping' ? 'Stopping after current post…' : r.dryRun ? 'Dry run in progress…' : 'Scheduling posts…'}
          </div>
          <div className="bar">
            <div className="bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="progress-count">
            <span className="big">
              {r.processed} / {r.total}
            </span>
            <span className="muted">{pct}%</span>
          </div>
          <dl className="stats">
            <dt>Current</dt>
            <dd>{r.currentNumber ? `Post ${r.currentNumber}` : '—'}</dd>
            <dt>Step</dt>
            <dd>
              {r.nextPostAt
                ? `${r.waitReason === 'break' ? 'Break' : 'Waiting'} — next post in ${formatCountdown(waitLeft)}${r.status === 'paused' ? ' (paused)' : ''}`
                : stepLabel(r.currentStep) || '—'}
            </dd>
            <dt>{r.dryRun ? 'Passed' : 'Scheduled'}</dt>
            <dd className="ok">{r.succeeded}</dd>
            <dt>Failed</dt>
            <dd className={r.failed ? 'err' : ''}>{r.failed}</dd>
            <dt>Remaining</dt>
            <dd>
              {remaining}
              {etaMs > 0 && <span className="muted"> · about {formatDuration(etaMs)} left</span>}
            </dd>
          </dl>
          <div className="row gap">
            {r.status === 'paused' ? (
              <button className="btn btn-primary" onClick={() => runner.resume()}>
                Resume
              </button>
            ) : (
              <button className="btn" onClick={() => runner.pause()} disabled={r.status !== 'running'}>
                Pause
              </button>
            )}
            <button className="btn btn-danger" onClick={() => runner.stop()} disabled={r.status === 'stopping'}>
              Stop
            </button>
          </div>
          <div className="muted small">Keep this dashboard open until the run finishes. Pause/Stop take effect after the current post, or straight away while waiting between posts.</div>
        </>
      )}
      {r.status === 'finished' && r.summary && (
        <div className={`summary ${r.allScheduled ? 'summary-ok' : r.failed ? 'summary-warn' : ''}`}>
          <div className="summary-text">{r.summary}</div>
          {r.allScheduled && <div className="small">All posts are now in X's native scheduled queue. You can close Chrome or shut down — X will publish them.</div>}
        </div>
      )}
      {!active && r.status !== 'preparing' && (
        <div className="row gap wrap">
          {failedCount > 0 && (
            <button className="btn btn-primary" onClick={onRetryFailed}>
              Retry {failedCount} failed
            </button>
          )}
          {scheduledCount > 0 && (
            <button className="btn" onClick={onVerify} title="Open X's scheduled posts list and check each post is there">
              Verify in X
            </button>
          )}
          {r.status === 'finished' && (
            <button className="btn btn-ghost" onClick={() => runner.resetState()}>
              Dismiss
            </button>
          )}
        </div>
      )}
    </section>
  );
}
