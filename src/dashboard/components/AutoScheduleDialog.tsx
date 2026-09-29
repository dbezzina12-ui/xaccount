import { useMemo, useState } from 'react';
import type { Batch } from '../../types';
import { useStore } from '../store';
import { Modal } from './Modal';
import { autoSchedule, type AutoScheduleResult } from '../../utils/autoSchedule';
import { addDays, formatDateShort, formatTime12, todayIn, tzOffsetLabel } from '../../utils/time';

type Scope = 'unscheduled' | 'undated';

export function AutoScheduleDialog({ batch, onClose }: { batch: Batch; onClose: () => void }) {
  const { state, dispatch, log } = useStore();
  const s = state.settings;
  const tomorrow = addDays(todayIn(batch.timezone), 1);
  const [start, setStart] = useState(tomorrow);
  const [end, setEnd] = useState(addDays(tomorrow, 6));
  const [earliest, setEarliest] = useState(s.defaultEarliest);
  const [latest, setLatest] = useState(s.defaultLatest);
  const [gap, setGap] = useState(s.defaultMinGapMinutes);
  const [maxPerDay, setMaxPerDay] = useState(s.defaultPostsPerDay);
  const [scope, setScope] = useState<Scope>('unscheduled');
  const [seed, setSeed] = useState(0);

  const targets = batch.posts.filter((p) => p.status !== 'scheduled' && p.status !== 'scheduling' && (scope === 'unscheduled' || !p.date || !p.time));

  const result: AutoScheduleResult = useMemo(
    () => autoSchedule(targets.length, { startDate: start, endDate: end, earliest, latest, minGapMinutes: gap, maxPerDay, timezone: batch.timezone }),
    // seed forces a re-roll
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [targets.length, start, end, earliest, latest, gap, maxPerDay, batch.timezone, seed],
  );

  const apply = () => {
    if (!result.ok) return;
    result.slots.forEach((slot, i) => {
      dispatch({ type: 'updatePost', batchId: batch.id, postId: targets[i].id, patch: { date: slot.date, time: slot.time } });
    });
    log('info', `Auto-scheduled ${result.slots.length} posts between ${formatDateShort(start)} and ${formatDateShort(end)}.`);
    onClose();
  };

  return (
    <Modal
      title="Auto schedule"
      onClose={onClose}
      width={720}
      footer={
        <>
          <button className="btn" onClick={() => setSeed((x) => x + 1)} disabled={!result.ok}>
            ↻ Shuffle times
          </button>
          <span className="spacer" />
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!result.ok || !targets.length} onClick={apply}>
            Apply to {targets.length} post{targets.length === 1 ? '' : 's'}
          </button>
        </>
      }
    >
      <p className="muted small">
        Posts are assigned in list order (drag rows to reorder first). Times vary naturally from day to day while respecting every constraint. Timezone:{' '}
        <strong>
          {batch.timezone} ({tzOffsetLabel(batch.timezone)})
        </strong>
      </p>
      <div className="form-grid">
        <label>
          Start date
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label>
          End date
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
        <label>
          Earliest posting time
          <input type="time" value={earliest} onChange={(e) => setEarliest(e.target.value)} />
        </label>
        <label>
          Latest posting time
          <input type="time" value={latest} onChange={(e) => setLatest(e.target.value)} />
        </label>
        <label>
          Minimum gap (minutes)
          <input type="number" min={1} max={1440} value={gap} onChange={(e) => setGap(Math.max(1, Number(e.target.value) || 1))} />
        </label>
        <label>
          Max posts per day (0 = no limit)
          <input type="number" min={0} max={100} value={maxPerDay} onChange={(e) => setMaxPerDay(Math.max(0, Number(e.target.value) || 0))} />
        </label>
        <label className="span2">
          Apply to
          <select value={scope} onChange={(e) => setScope(e.target.value as Scope)}>
            <option value="unscheduled">All posts not yet scheduled in X ({batch.posts.filter((p) => p.status !== 'scheduled' && p.status !== 'scheduling').length})</option>
            <option value="undated">Only posts without a date/time ({batch.posts.filter((p) => p.status !== 'scheduled' && (!p.date || !p.time)).length})</option>
          </select>
        </label>
      </div>

      {!targets.length && <div className="notice">No posts match — add or import posts first.</div>}
      {targets.length > 0 && !result.ok && <div className="notice notice-error">{result.error}</div>}
      {targets.length > 0 && result.ok && (
        <div className="auto-preview">
          <div className="preview-head">Preview</div>
          <div className="day-grid">
            {result.perDay.map((d) => (
              <div key={d.date} className="day-col">
                <div className="day-name">{formatDateShort(d.date)}</div>
                {result.slots
                  .map((slot, i) => ({ slot, i }))
                  .filter(({ slot }) => slot.date === d.date)
                  .map(({ slot, i }) => (
                    <div key={i} className="day-slot" title={targets[i].text}>
                      <span className="mono">{formatTime12(slot.time)}</span> <span className="muted">#{batch.posts.indexOf(targets[i]) + 1}</span>
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
