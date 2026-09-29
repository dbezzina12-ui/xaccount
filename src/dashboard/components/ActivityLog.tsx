import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { clockTime } from '../../utils/time';

export function ActivityLog() {
  const { state, dispatch } = useStore();
  const endRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = boxRef.current;
    // Auto-scroll only if the user is already near the bottom.
    if (box && box.scrollHeight - box.scrollTop - box.clientHeight < 80) endRef.current?.scrollIntoView({ block: 'end' });
  }, [state.logs.length]);

  const copy = () => {
    const text = state.logs.map((l) => `${clockTime(l.at)} [${l.level}] ${l.message}`).join('\n');
    void navigator.clipboard.writeText(text);
  };

  return (
    <section className="panel log-panel">
      <div className="panel-head">
        <h3>Activity log</h3>
        {state.settings.debug && <span className="tag tag-debug">DEBUG</span>}
        <span className="spacer" />
        <button className="btn-link" onClick={copy} disabled={!state.logs.length}>
          Copy
        </button>
        <button className="btn-link" onClick={() => dispatch({ type: 'clearLogs' })} disabled={!state.logs.length}>
          Clear
        </button>
      </div>
      <div className="log" ref={boxRef}>
        {!state.logs.length && <div className="muted small">Nothing yet.</div>}
        {state.logs.map((l) => (
          <div key={l.id} className={`log-line log-${l.level}`}>
            <span className="log-time">{clockTime(l.at)}</span>
            <span className="log-msg">{l.message}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </section>
  );
}
