import { useMemo, useState } from 'react';
import type { Settings } from '../../types';
import { useStore } from '../store';
import { browserTimezone, listTimezones, tzLongName, tzOffsetLabel } from '../../utils/time';
import { defaultSettings } from '../../storage/settings';
import { describePacing, estimateRunMs, formatDuration, normalizePacing } from '../../utils/pacing';

export function SettingsView({ onBack }: { onBack: () => void }) {
  const { state, dispatch, log } = useStore();
  const [s, setS] = useState<Settings>(state.settings);
  const zones = useMemo(() => listTimezones(), []);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((x) => ({ ...x, [k]: v }));
  const dirty = JSON.stringify(s) !== JSON.stringify(state.settings);

  const save = () => {
    const fixed = { ...s, ...normalizePacing(s) };
    setS(fixed);
    dispatch({ type: 'setSettings', settings: fixed });
    log('info', 'Settings saved.');
  };

  return (
    <div className="settings">
      <div className="settings-head">
        <button className="btn btn-ghost" onClick={onBack}>
          ← Back to queue
        </button>
        <h2>Settings</h2>
        <span className="spacer" />
        <button className="btn" onClick={() => setS({ ...defaultSettings(), dryRun: s.dryRun, debug: s.debug })}>
          Reset defaults
        </button>
        <button className="btn btn-primary" onClick={save} disabled={!dirty}>
          Save settings
        </button>
      </div>

      <section className="panel">
        <h3>Scheduling defaults</h3>
        <p className="muted small">Used to pre-fill the Auto Schedule tool.</p>
        <div className="form-grid">
          <label>
            Default earliest post time
            <input type="time" value={s.defaultEarliest} onChange={(e) => set('defaultEarliest', e.target.value)} />
          </label>
          <label>
            Default latest post time
            <input type="time" value={s.defaultLatest} onChange={(e) => set('defaultLatest', e.target.value)} />
          </label>
          <label>
            Default minimum gap (minutes)
            <input type="number" min={1} value={s.defaultMinGapMinutes} onChange={(e) => set('defaultMinGapMinutes', Math.max(1, Number(e.target.value) || 1))} />
          </label>
          <label>
            Default posts per day (0 = no limit)
            <input type="number" min={0} value={s.defaultPostsPerDay} onChange={(e) => set('defaultPostsPerDay', Math.max(0, Number(e.target.value) || 0))} />
          </label>
          <label className="span2">
            Default timezone (for new batches)
            <select value={s.defaultTimezone} onChange={(e) => set('defaultTimezone', e.target.value)}>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z} ({tzOffsetLabel(z)})
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="tz-box">
          <div>
            Selected: <strong>{s.defaultTimezone}</strong> — {tzLongName(s.defaultTimezone)} ({tzOffsetLabel(s.defaultTimezone)})
          </div>
          <div>
            This browser: <strong>{browserTimezone()}</strong> — {tzLongName(browserTimezone())} ({tzOffsetLabel(browserTimezone())})
          </div>
          <div className="muted small">
            X's scheduler uses this browser's timezone. If a batch uses a different timezone, times are converted automatically before they are entered into X, and the
            activity log shows the converted time.
          </div>
        </div>
      </section>

      <section className="panel">
        <h3>Validation</h3>
        <div className="form-grid">
          <label>
            Character limit
            <select value={[280, 25000].includes(s.characterLimit) ? String(s.characterLimit) : 'custom'} onChange={(e) => e.target.value !== 'custom' && set('characterLimit', Number(e.target.value))}>
              <option value="280">280 — standard account</option>
              <option value="25000">25,000 — X Premium</option>
              <option value="custom">Custom…</option>
            </select>
          </label>
          <label>
            Custom limit
            <input type="number" min={1} value={s.characterLimit} onChange={(e) => set('characterLimit', Math.max(1, Number(e.target.value) || 280))} />
          </label>
        </div>
        <p className="muted small">X doesn't expose your limit reliably, so choose it here. X's composer still has the final say: if it rejects a post, that post fails with a clear message.</p>
      </section>

      <section className="panel">
        <h3>Automation</h3>
        <div className="form-grid">
          <label>
            Wait between posts — minimum (seconds)
            <input type="number" min={1} max={3600} value={s.delayMinSec} onChange={(e) => set('delayMinSec', Math.max(1, Number(e.target.value) || 1))} />
          </label>
          <label>
            Wait between posts — maximum (seconds)
            <input type="number" min={1} max={3600} value={s.delayMaxSec} onChange={(e) => set('delayMaxSec', Math.max(1, Number(e.target.value) || 1))} />
          </label>
          <label>
            Longer break every … posts (0 = never)
            <input type="number" min={0} max={500} value={s.breakEveryPosts} onChange={(e) => set('breakEveryPosts', Math.max(0, Number(e.target.value) || 0))} />
          </label>
          <label>
            Break length (minutes)
            <input type="number" min={0} max={120} step={0.5} value={s.breakMinutes} onChange={(e) => set('breakMinutes', Math.max(0, Number(e.target.value) || 0))} />
          </label>
          <p className="muted small span2">
            Posts are entered into X one at a time with a random wait in this range, plus a longer break (±20%) every N posts, so X never sees a burst of
            scheduling. Currently: {describePacing(s)}. A batch of 30 posts takes about {formatDuration(estimateRunMs(30, s))}. Dry runs use a short 2-second pause
            instead, since nothing is scheduled.
          </p>
          <label className="check span2">
            <input type="checkbox" checked={s.closeAutomationWindow} onChange={(e) => set('closeAutomationWindow', e.target.checked)} />
            Close the X automation window when a run finishes without failures
          </label>
          <label className="check span2">
            <input type="checkbox" checked={s.dryRun} onChange={(e) => set('dryRun', e.target.checked)} />
            <span>
              <strong>Dry run mode</strong> — go through every step but never click the final “Schedule” button
            </span>
          </label>
          <label className="check span2">
            <input type="checkbox" checked={s.debug} onChange={(e) => set('debug', e.target.checked)} />
            <span>
              <strong>Debug mode</strong> — log every automation step and selector lookup (never logs cookies or credentials)
            </span>
          </label>
        </div>
      </section>
    </div>
  );
}
