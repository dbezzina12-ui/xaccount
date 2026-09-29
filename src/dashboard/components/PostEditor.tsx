import { useMemo, useRef, useState } from 'react';
import type { Batch, MediaRef, Post } from '../../types';
import { makePost, useStore } from '../store';
import { Modal } from './Modal';
import { MediaThumb } from './MediaThumb';
import { storeMediaFiles } from '../mediaActions';
import { MEDIA_ACCEPT, formatBytes } from '../../utils/media';
import { validatePost } from '../../utils/validation';
import { tzOffsetLabel } from '../../utils/time';
import { uid } from '../../utils/id';

interface Props {
  batch: Batch;
  /** Existing post, or null to create a new one. */
  post: Post | null;
  onClose: () => void;
  locked: boolean;
}

export function PostEditor({ batch, post, onClose, locked }: Props) {
  const { state, dispatch } = useStore();
  const [text, setText] = useState(post?.text ?? '');
  const [media, setMedia] = useState<MediaRef[]>(post?.media ?? []);
  const [date, setDate] = useState(post?.date ?? '');
  const [time, setTime] = useState(post?.time ?? '');
  const [busy, setBusy] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scheduled = post?.status === 'scheduled';
  const readOnly = scheduled || locked;

  const draft: Post = useMemo(
    () => ({ ...(post ?? makePost()), text, media, date: date || null, time: time || null, status: 'draft' }),
    [post, text, media, date, time],
  );
  const v = validatePost(draft, batch.timezone, state.settings);
  const over = v.length > state.settings.characterLimit;

  const addFiles = async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    const r = await storeMediaFiles(files);
    setMedia((m) => [...m, ...r.added]);
    setRejected(r.rejected);
    setBusy(false);
  };

  const save = () => {
    const patch = { text, media, date: date || null, time: time || null };
    if (post) dispatch({ type: 'updatePost', batchId: batch.id, postId: post.id, patch });
    else dispatch({ type: 'addPosts', batchId: batch.id, posts: [makePost(patch)] });
    onClose();
  };

  const duplicate = () => {
    if (!post) return;
    const copy = makePost({ text, media: media.map((m) => ({ ...m })), date: date || null, time: time || null });
    copy.id = uid('p_');
    dispatch({ type: 'addPosts', batchId: batch.id, posts: [copy], afterId: post.id });
    onClose();
  };

  const remove = () => {
    if (!post) return;
    if (!confirm('Delete this post from the queue?')) return;
    dispatch({ type: 'deletePosts', batchId: batch.id, ids: [post.id] });
    onClose();
  };

  const unschedule = () => {
    if (!post) return;
    if (!confirm("Mark this post as NOT scheduled? Only do this if it's no longer in X's scheduled queue (e.g. you deleted it in X). It will be scheduled again on the next run.")) return;
    const status = validatePost({ ...post, status: 'draft' }, batch.timezone, state.settings).errors.length ? 'draft' : 'ready';
    dispatch({ type: 'updatePost', batchId: batch.id, postId: post.id, patch: { status, scheduledAt: undefined, verifiedInX: undefined } });
    onClose();
  };

  return (
    <Modal
      title={post ? `Edit post ${batch.posts.indexOf(post) + 1}` : 'New post'}
      onClose={onClose}
      width={680}
      footer={
        <>
          {post && (
            <button className="btn btn-danger-ghost" onClick={remove} disabled={locked}>
              Delete
            </button>
          )}
          {post && (
            <button className="btn" onClick={duplicate} disabled={locked}>
              Duplicate
            </button>
          )}
          <span className="spacer" />
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save} disabled={readOnly || busy}>
            Save
          </button>
        </>
      }
    >
      {scheduled && (
        <div className="notice notice-ok">
          This post is already in X's scheduled queue. Edits here would not change X.{' '}
          <button className="link" onClick={unschedule}>
            Mark as not scheduled…
          </button>
        </div>
      )}
      {locked && !scheduled && <div className="notice">Editing is disabled while a run is in progress.</div>}

      <label className="field-label">Text</label>
      <textarea className="editor-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="What do you want to post?" rows={7} disabled={readOnly} autoFocus />
      <div className={`char-count ${over ? 'over' : v.length > state.settings.characterLimit * 0.9 ? 'near' : ''}`}>
        {v.length} / {state.settings.characterLimit}
        <span className="muted"> · URLs count as 23, emoji as 2</span>
      </div>

      <label className="field-label">Media</label>
      <div
        className={`dropzone ${dragOver ? 'drag' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!readOnly) void addFiles(Array.from(e.dataTransfer.files));
        }}
      >
        {media.map((m) => (
          <div className="media-item" key={m.id}>
            <MediaThumb media={m} size={48} />
            <div className="media-meta">
              <div className="media-name">{m.name}</div>
              <div className="muted small">
                {m.kind.toUpperCase()} · {formatBytes(m.size)}
                {m.durationSec ? ` · ${Math.round(m.durationSec)}s` : ''}
                {m.width ? ` · ${m.width}×${m.height}` : ''}
              </div>
            </div>
            {!readOnly && (
              <button className="icon-btn" onClick={() => setMedia((all) => all.filter((x) => x.id !== m.id))} aria-label="Remove media">
                ✕
              </button>
            )}
          </div>
        ))}
        {!readOnly && (
          <button className="btn btn-sm" onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? 'Adding…' : media.length ? 'Add more' : 'Attach image / video'}
          </button>
        )}
        {!media.length && <span className="muted small">or drop files here · JPG, PNG, WEBP, GIF, MP4, MOV · up to 4 images or 1 video/GIF</span>}
        <input ref={fileRef} type="file" accept={MEDIA_ACCEPT} multiple hidden onChange={(e) => void addFiles(Array.from(e.target.files ?? [])).then(() => (e.target.value = ''))} />
      </div>
      {rejected.map((r) => (
        <div className="msg-error small" key={r}>
          {r}
        </div>
      ))}

      <div className="row gap">
        <div>
          <label className="field-label">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={readOnly} />
        </div>
        <div>
          <label className="field-label">Time</label>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={readOnly} />
        </div>
        <div className="tz-hint">
          <label className="field-label">Timezone</label>
          <div className="muted">
            {batch.timezone} ({tzOffsetLabel(batch.timezone)})
          </div>
        </div>
      </div>

      {(v.errors.length > 0 || v.warnings.length > 0) && (
        <ul className="validation">
          {v.errors.map((e) => (
            <li key={e} className="msg-error">
              {e}
            </li>
          ))}
          {v.warnings.map((w) => (
            <li key={w} className="msg-warn">
              {w}
            </li>
          ))}
        </ul>
      )}
      {!v.errors.length && <div className="msg-ok small">Ready to schedule.</div>}
    </Modal>
  );
}
