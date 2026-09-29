import { useMemo, useRef, useState } from 'react';
import type { Batch, MediaRef } from '../../types';
import { makePost, useStore } from '../store';
import { Modal } from './Modal';
import { parseCsv, parsePlainText, type ImportRow, type SlashDateOrder } from '../../utils/importers';
import { storeMediaFiles } from '../mediaActions';
import { formatDateShort, formatTime12 } from '../../utils/time';

type Mode = 'text' | 'csv';

const TEXT_EXAMPLE = `Post number one.

Post number two.
It can span multiple lines.

Post number three.`;

const CSV_EXAMPLE = `text,date,time,media
"New game coming this Friday!",2026-10-01,10:30,preview.mp4
"Which bonus would you pick?",2026-10-01,1:15 PM,image.png
"Text-only post",,,`;

export function ImportDialog({ batch, onClose }: { batch: Batch; onClose: () => void }) {
  const { dispatch, log } = useStore();
  const [mode, setMode] = useState<Mode>('text');
  const [raw, setRaw] = useState('');
  const [slashOrder, setSlashOrder] = useState<SlashDateOrder>(() => (navigator.language === 'en-US' ? 'MDY' : 'DMY'));
  const [replace, setReplace] = useState(false);
  const [files, setFiles] = useState<Map<string, File>>(new Map());
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo((): { rows: ImportRow[]; errors: string[] } => {
    if (!raw.trim()) return { rows: [], errors: [] };
    return mode === 'text' ? { rows: parsePlainText(raw), errors: [] } : parseCsv(raw, slashOrder);
  }, [raw, mode, slashOrder]);

  const mediaNames = useMemo(() => Array.from(new Set(parsed.rows.flatMap((r) => r.mediaNames))), [parsed]);
  const unmatched = mediaNames.filter((n) => !files.has(n.toLowerCase()));

  const loadTextFile = async (f: File) => {
    const text = await f.text();
    setMode(/\.csv$/i.test(f.name) || f.type === 'text/csv' ? 'csv' : 'text');
    setRaw(text);
  };

  const addMediaFiles = (list: FileList | null) => {
    if (!list) return;
    const next = new Map(files);
    for (const f of Array.from(list)) next.set(f.name.toLowerCase(), f);
    setFiles(next);
  };

  const doImport = async () => {
    setBusy(true);
    try {
      // Store each referenced file once, even if several rows use it.
      const stored = new Map<string, MediaRef>();
      for (const name of mediaNames) {
        const f = files.get(name.toLowerCase());
        if (!f) continue;
        const r = await storeMediaFiles([f]);
        if (r.added[0]) stored.set(name.toLowerCase(), r.added[0]);
        r.rejected.forEach((msg) => log('warn', `Import: ${msg}`));
      }
      const posts = parsed.rows.map((r) =>
        makePost({
          text: r.text,
          date: r.date,
          time: r.time,
          media: r.mediaNames.map((n) => stored.get(n.toLowerCase())).filter((m): m is MediaRef => !!m),
        }),
      );
      dispatch({ type: 'addPosts', batchId: batch.id, posts, replace });
      log('info', `Imported ${posts.length} post${posts.length === 1 ? '' : 's'}${replace ? ' (queue replaced)' : ''}.`);
      if (unmatched.length) log('warn', `Import: ${unmatched.length} media file(s) were not selected and were skipped: ${unmatched.join(', ')}`);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Import posts"
      onClose={onClose}
      width={820}
      footer={
        <>
          <label className="check">
            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} /> Replace current queue
          </label>
          <span className="spacer" />
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!parsed.rows.length || busy} onClick={() => void doImport()}>
            {busy ? 'Importing…' : `Import ${parsed.rows.length || ''} post${parsed.rows.length === 1 ? '' : 's'}`}
          </button>
        </>
      }
    >
      <div className="tabs">
        <button className={mode === 'text' ? 'tab active' : 'tab'} onClick={() => setMode('text')}>
          Plain text
        </button>
        <button className={mode === 'csv' ? 'tab active' : 'tab'} onClick={() => setMode('csv')}>
          CSV
        </button>
        <span className="spacer" />
        <button className="btn btn-sm" onClick={() => fileRef.current?.click()}>
          Load .txt / .csv file…
        </button>
        <input ref={fileRef} type="file" accept=".txt,.csv,text/plain,text/csv" hidden onChange={(e) => e.target.files?.[0] && void loadTextFile(e.target.files[0])} />
      </div>

      <p className="muted small">
        {mode === 'text'
          ? 'One post per block — separate posts with a blank line.'
          : 'Header row required. Columns: text, date, time, media (only text is required). Dates: YYYY-MM-DD (or slash dates, see below). Times: 13:15 or 1:15 PM. Multiple media: separate with ";".'}
      </p>
      <textarea className="import-text mono" value={raw} onChange={(e) => setRaw(e.target.value)} placeholder={mode === 'text' ? TEXT_EXAMPLE : CSV_EXAMPLE} rows={10} />

      {mode === 'csv' && (
        <div className="row gap small">
          <label>
            Slash dates like 03/04/2026 mean:{' '}
            <select value={slashOrder} onChange={(e) => setSlashOrder(e.target.value as SlashDateOrder)}>
              <option value="MDY">Month/Day/Year</option>
              <option value="DMY">Day/Month/Year</option>
            </select>
          </label>
        </div>
      )}

      {parsed.errors.map((e) => (
        <div className="msg-error small" key={e}>
          {e}
        </div>
      ))}

      {mediaNames.length > 0 && (
        <div className="notice">
          <strong>Media files referenced: {mediaNames.length}</strong>
          <p className="small">
            Chrome does not let extensions read files from disk paths (a security restriction), so the paths in your CSV can't be opened directly. Select the files — or the whole
            folder — below and they will be matched by file name. Nothing is uploaded anywhere except into X's composer during scheduling.
          </p>
          <div className="row gap">
            <label className="btn btn-sm">
              Select files…
              <input type="file" multiple hidden onChange={(e) => addMediaFiles(e.target.files)} />
            </label>
            <label className="btn btn-sm">
              Select folder…
              <input type="file" hidden {...({ webkitdirectory: '' } as Record<string, string>)} onChange={(e) => addMediaFiles(e.target.files)} />
            </label>
            <span className={unmatched.length ? 'msg-warn small' : 'msg-ok small'}>
              {mediaNames.length - unmatched.length}/{mediaNames.length} matched
            </span>
          </div>
          {unmatched.length > 0 && <div className="small muted">Missing: {unmatched.join(', ')}</div>}
        </div>
      )}

      {parsed.rows.length > 0 && (
        <div className="preview">
          <div className="preview-head">
            Preview · {parsed.rows.length} post{parsed.rows.length === 1 ? '' : 's'}
          </div>
          <table className="preview-table">
            <tbody>
              {parsed.rows.slice(0, 50).map((r, i) => (
                <tr key={i}>
                  <td className="num">{i + 1}</td>
                  <td className="nowrap">{r.date ? formatDateShort(r.date) : '—'}</td>
                  <td className="nowrap">{r.time ? formatTime12(r.time) : '—'}</td>
                  <td className="ptext">{r.text.slice(0, 140)}</td>
                  <td className="small">
                    {r.mediaNames.map((n) => (
                      <div key={n} className={files.has(n.toLowerCase()) ? '' : 'msg-warn'}>
                        {n}
                      </div>
                    ))}
                    {r.warnings.map((w) => (
                      <div key={w} className="msg-warn">
                        {w}
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {parsed.rows.length > 50 && <div className="muted small">…and {parsed.rows.length - 50} more</div>}
        </div>
      )}
    </Modal>
  );
}
