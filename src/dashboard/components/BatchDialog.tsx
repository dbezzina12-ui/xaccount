import { useMemo, useState } from 'react';
import type { Batch } from '../../types';
import { useStore } from '../store';
import { Modal } from './Modal';
import { newBatch } from '../../storage/batches';
import { listTimezones, tzOffsetLabel } from '../../utils/time';

/** Create a new batch (batch = null) or edit an existing one. */
export function BatchDialog({ batch, onClose }: { batch: Batch | null; onClose: () => void }) {
  const { state, dispatch, log } = useStore();
  const [name, setName] = useState(batch?.name ?? '');
  const [handle, setHandle] = useState(batch?.accountHandle ?? state.account?.handle ?? '');
  const [tz, setTz] = useState(batch?.timezone ?? state.settings.defaultTimezone);
  const zones = useMemo(() => listTimezones(), []);
  const hasScheduled = !!batch?.posts.some((p) => p.status === 'scheduled');

  const save = () => {
    const accountHandle = handle.trim().replace(/^@/, '');
    if (batch) {
      if (tz !== batch.timezone && hasScheduled && !confirm('Some posts are already scheduled in X. Changing the timezone only affects posts not yet scheduled. Continue?')) return;
      dispatch({ type: 'updateBatch', id: batch.id, patch: { name: name.trim() || batch.name, accountHandle, timezone: tz } });
    } else {
      const b = newBatch(name.trim() || 'Untitled batch', tz, accountHandle);
      dispatch({ type: 'addBatch', batch: b });
      log('info', `Created batch "${b.name}".`);
    }
    onClose();
  };

  return (
    <Modal
      title={batch ? 'Batch settings' : 'New batch'}
      onClose={onClose}
      width={520}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save}>
            {batch ? 'Save' : 'Create batch'}
          </button>
        </>
      }
    >
      <div className="form-grid one">
        <label>
          Batch name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Gamboligy Oct 1–7" autoFocus />
        </label>
        <label>
          X account for this batch
          <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@handle (optional)" />
          <span className="muted small">Before scheduling, the logged-in account is compared with this handle.</span>
        </label>
        <label>
          Timezone for post times
          <select value={tz} onChange={(e) => setTz(e.target.value)}>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z} ({tzOffsetLabel(z)})
              </option>
            ))}
          </select>
          <span className="muted small">Changing it keeps the same wall-clock times (e.g. 10:30 stays 10:30) in the new timezone.</span>
        </label>
      </div>
    </Modal>
  );
}
