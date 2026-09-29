import { useState } from 'react';
import type { Batch, Post } from '../../types';
import { useStore } from '../store';
import { MediaThumb } from './MediaThumb';
import { validatePost } from '../../utils/validation';
import { formatDateShort, weekdayShort } from '../../utils/time';
import { stepLabel } from '../engine/runner';

interface Props {
  batch: Batch;
  locked: boolean;
  onEdit: (post: Post) => void;
  onDuplicate: (post: Post) => void;
  onRetry: (ids: string[]) => void;
}

const STATUS_LABEL: Record<Post['status'], string> = {
  draft: 'Draft',
  ready: 'Ready',
  scheduling: 'Scheduling',
  scheduled: 'Scheduled',
  failed: 'Failed',
};

export function PostTable({ batch, locked, onEdit, onDuplicate, onRetry }: Props) {
  const { state, dispatch } = useStore();
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const currentId = state.run.currentPostId;

  if (!batch.posts.length) {
    return (
      <div className="empty">
        <div className="empty-title">No posts in this batch yet</div>
        <div className="muted">Use “Add Post” or “Import Posts” to load this week's posts.</div>
      </div>
    );
  }

  const setField = (p: Post, patch: Partial<Post>) => dispatch({ type: 'updatePost', batchId: batch.id, postId: p.id, patch });
  const remove = (p: Post) => {
    if (p.status === 'scheduled' && !confirm('This post is already scheduled in X. Removing it here does NOT unschedule it in X. Remove from the list?')) return;
    dispatch({ type: 'deletePosts', batchId: batch.id, ids: [p.id] });
  };

  return (
    <table className="post-table">
      <thead>
        <tr>
          <th className="col-drag" />
          <th className="col-num">#</th>
          <th className="col-date">Date</th>
          <th className="col-time">Time</th>
          <th>Post text</th>
          <th className="col-media">Media</th>
          <th className="col-status">Status</th>
          <th className="col-actions">Actions</th>
        </tr>
      </thead>
      <tbody>
        {batch.posts.map((p, i) => {
          const v = validatePost(p, batch.timezone, state.settings);
          const frozen = locked || p.status === 'scheduled' || p.status === 'scheduling';
          const cls = [
            p.id === currentId ? 'row-active' : '',
            dragOver === i && dragFrom !== null && dragFrom !== i ? (dragFrom < i ? 'drop-below' : 'drop-above') : '',
            dragFrom === i ? 'dragging' : '',
          ].join(' ');
          return (
            <tr
              key={p.id}
              className={cls}
              onDragOver={(e) => {
                if (dragFrom === null) return;
                e.preventDefault();
                setDragOver(i);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragFrom !== null && dragFrom !== i) dispatch({ type: 'movePost', batchId: batch.id, from: dragFrom, to: i });
                setDragFrom(null);
                setDragOver(null);
              }}
            >
              <td className="col-drag">
                {!locked && (
                  <span
                    className="drag-handle"
                    draggable
                    title="Drag to reorder"
                    onDragStart={(e) => {
                      setDragFrom(i);
                      e.dataTransfer.effectAllowed = 'move';
                      const row = (e.target as HTMLElement).closest('tr');
                      if (row) e.dataTransfer.setDragImage(row, 20, 20);
                    }}
                    onDragEnd={() => {
                      setDragFrom(null);
                      setDragOver(null);
                    }}
                  >
                    ⋮⋮
                  </span>
                )}
              </td>
              <td className="col-num">{i + 1}</td>
              <td className="col-date">
                <input
                  type="date"
                  className="cell-input"
                  value={p.date ?? ''}
                  disabled={frozen}
                  onChange={(e) => setField(p, { date: e.target.value || null })}
                  title={p.date ? formatDateShort(p.date) : 'No date'}
                />
                {p.date && <span className="weekday">{weekdayShort(p.date)}</span>}
              </td>
              <td className="col-time">
                <input type="time" className="cell-input" value={p.time ?? ''} disabled={frozen} onChange={(e) => setField(p, { time: e.target.value || null })} />
              </td>
              <td className="col-text" onClick={() => onEdit(p)} title={p.text}>
                <div className="ptext-clamp">{p.text || <span className="muted">(no text)</span>}</div>
                <div className={`len ${v.length > state.settings.characterLimit ? 'over' : ''}`}>{v.length}</div>
              </td>
              <td className="col-media">
                {p.media.length ? (
                  <div className="media-cell">
                    {p.media.slice(0, 2).map((m) => (
                      <MediaThumb key={m.id} media={m} />
                    ))}
                    <span className="media-cell-name" title={p.media.map((m) => m.name).join(', ')}>
                      {p.media.length > 2 ? `+${p.media.length - 2} ` : ''}
                      {p.media[0].name}
                    </span>
                  </div>
                ) : (
                  <span className="muted">—</span>
                )}
              </td>
              <td className="col-status">
                <span className={`pill pill-${p.status}`}>{STATUS_LABEL[p.status]}</span>
                {p.uncertain && <span className="pill pill-uncertain" title="The Schedule click may have gone through. Check X's scheduled posts before retrying.">May be in X</span>}
                {p.verifiedInX === true && <span className="tag tag-ok" title="Found in X's scheduled list">✓ in X</span>}
                {p.verifiedInX === false && <span className="tag tag-warn" title="Not found in X's scheduled list — check manually">Not found</span>}
                {p.dryRun && p.status !== 'scheduled' && (
                  <span className={`tag ${p.dryRun.ok ? 'tag-ok' : 'tag-err'}`} title={p.dryRun.message}>
                    Dry run {p.dryRun.ok ? '✓' : '✗'}
                  </span>
                )}
                {p.status === 'failed' && p.error && (
                  <div className="status-detail msg-error" title={p.error}>
                    {p.failedStep ? `${stepLabel(p.failedStep)}: ` : ''}
                    {p.error}
                  </div>
                )}
                {p.status === 'draft' && v.errors[0] && <div className="status-detail muted">{v.errors[0]}</div>}
                {p.status === 'scheduling' && p.id === currentId && state.run.currentStep && <div className="status-detail">{stepLabel(state.run.currentStep)}…</div>}
                {p.status === 'ready' && v.warnings[0] && <div className="status-detail msg-warn" title={v.warnings.join('\n')}>{v.warnings[0]}</div>}
              </td>
              <td className="col-actions">
                <button className="btn-link" onClick={() => onEdit(p)}>
                  {p.status === 'scheduled' ? 'View' : 'Edit'}
                </button>
                <button className="btn-link" onClick={() => onDuplicate(p)} disabled={locked}>
                  Dup
                </button>
                {p.status === 'failed' && (
                  <button className="btn-link accent" onClick={() => onRetry([p.id])} disabled={locked}>
                    Retry
                  </button>
                )}
                <button className="btn-link danger" onClick={() => remove(p)} disabled={locked || p.status === 'scheduling'}>
                  Delete
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
