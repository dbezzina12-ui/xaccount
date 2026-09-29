import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { clockTime } from '../../utils/time';

export function ActivityLog() {
  const { state, dispatch } = useStore();
  const boxRef = useRef<HTMLDivElement>(null);
  // Follow new lines unless the user has scrolled up to read something.
  const stick = useRef(true);

  useEffect(() => {
    const box = boxRef.current;
    if (box && stick.current) box.scrollTop = box.scrollHeight;
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
      <div
        className="log"
        ref={boxRef}
        onScroll={(e) => {
          const b = e.currentTarget;
          stick.current = b.scrollHeight - b.scrollTop - b.clientHeight < 40;
        }}
      >
        {!state.logs.length && <div className="muted small">Nothing yet.</div>}
        {state.logs.map((l) => (
          <div key={l.id} className={`log-line log-${l.level}`}>
            <span className="log-time">{clockTime(l.at)}</span>
            <span className="log-msg">{l.message}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
