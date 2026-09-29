import { useMemo, useState } from 'react';
import type { Settings } from '../../types';
import { useStore } from '../store';
import { browserTimezone, listTimezones, tzLongName, tzOffsetLabel } from '../../utils/time';
import { defaultSettings } from '../../storage/settings';

export function SettingsView({ onBack }: { onBack: () => void }) {
  const { state, dispatch, log } = useStore();
  const [s, setS] = useState<Settings>(state.settings);
  const zones = useMemo(() => listTimezones(), []);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((x) => ({ ...x, [k]: v }));
  const dirty = JSON.stringify(s) !== JSON.stringify(state.settings);

  const save = () => {
    dispatch({ type: 'setSettings', settings: s });
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
            Pause between posts (seconds)
            <input type="number" min={1} max={60} value={s.delayBetweenPostsSec} onChange={(e) => set('delayBetweenPostsSec', Math.max(1, Number(e.target.value) || 3))} />
          </label>
          <div />
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
