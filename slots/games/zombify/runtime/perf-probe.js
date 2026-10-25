// On-device frame-time recorder, loaded only with ?perf in the URL. Measures
// what this phone actually renders: every animation frame's interval, grouped
// by round, with dropped frames counted against the display's own refresh rate
// (60, 90 or 120 Hz). "Copy report" puts the numbers on the clipboard so they
// can be pasted into a handoff. Long tasks and heap size are reported where the
// browser exposes them (Chrome; not Safari). Presentation only.

const quantile = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] : 0);
const round1 = (x) => Math.round(x * 10) / 10;

// Frame intervals (ms) → percentiles and dropped/janky shares. A frame is
// dropped when it took more than 1.5 display intervals, janky over 3.
export function summarise(intervals, refresh) {
  const s = Float64Array.from(intervals).sort(), n = s.length;
  const interval = refresh ?? quantile(s, 0.5);
  const share = (k) => (n ? intervals.filter((f) => f > interval * k).length / n : 0);
  return { frames: n, p50: round1(quantile(s, 0.5)), p95: round1(quantile(s, 0.95)), p99: round1(quantile(s, 0.99)), max: round1(s[n - 1] ?? 0), dropped: round1(share(1.5) * 100), janky: round1(share(3) * 100) };
}

export function startPerfProbe({ doc = document, win = window } = {}) {
  const session = [], rounds = [], heap = [];
  let current = null, last = 0, longTasks = 0, refresh = null;
  const memory = () => (win.performance.memory ? round1(win.performance.memory.usedJSHeapSize / 1048576) : null);
  try { new PerformanceObserver((list) => { longTasks += list.getEntries().length; if (current) current.long += list.getEntries().length; }).observe({ type: 'longtask', buffered: true }); } catch { longTasks = null; }
  const tick = (t) => {
    if (last && !doc.hidden) {
      const dt = t - last;
      session.push(dt); current?.frames.push(dt);
      if (session.length > 18000) session.splice(0, 6000);
    }
    last = doc.hidden ? 0 : t;
    win.requestAnimationFrame(tick);
  };
  win.requestAnimationFrame(tick);
  // The display's interval: the median of the first two seconds of frames.
  win.setTimeout(() => { refresh = summarise(session).p50 || 16.7; }, 2000);

  const hud = doc.createElement('div');
  hud.id = 'perf-probe';
  hud.setAttribute('role', 'status');
  hud.style.cssText = 'position:fixed;left:6px;top:6px;z-index:2147483647;font:600 11px/1.35 ui-monospace,monospace;color:#d8ffe0;background:#061008d9;border:1px solid #4d7a54;border-radius:6px;padding:5px 7px;pointer-events:auto;max-width:calc(100vw - 12px)';
  const text = doc.createElement('div'), copy = doc.createElement('button'), reset = doc.createElement('button');
  for (const [b, label] of [[copy, 'Copy report'], [reset, 'Reset']]) { b.type = 'button'; b.textContent = label; b.style.cssText = 'margin:4px 6px 0 0;font:inherit;padding:2px 6px;border-radius:4px;border:1px solid #4d7a54;background:#10261a;color:inherit'; }
  hud.append(text, copy, reset);
  (doc.body ?? doc.documentElement).append(hud);

  const report = () => ({
    device: { userAgent: win.navigator.userAgent, devicePixelRatio: win.devicePixelRatio, viewport: [win.innerWidth, win.innerHeight], refreshMs: refresh && round1(refresh) },
    session: summarise(session, refresh), longTasks, heapMB: heap,
    rounds: rounds.map(({ mode, frames, long }) => ({ mode, ...summarise(frames, refresh), longTasks: longTasks === null ? null : long })),
  });
  copy.onclick = async () => {
    const json = JSON.stringify(report(), null, 1);
    try { await win.navigator.clipboard.writeText(json); copy.textContent = 'Copied'; } catch { win.prompt('Copy this report', json); }
    win.setTimeout(() => { copy.textContent = 'Copy report'; }, 1500);
  };
  reset.onclick = () => { session.length = 0; rounds.length = 0; heap.length = 0; };

  // Rounds: from the game reporting busy until it is idle again.
  win.setInterval(() => {
    const rt = win.ZombifyStudioRuntime, busy = !!rt?.status().busy;
    if (busy && !current) current = { mode: rt.read().mode, frames: [], long: 0 };
    else if (!busy && current) { rounds.push(current); current = null; const m = memory(); if (m !== null) heap.push(m); }
    const recent = session.slice(-60), fps = recent.length ? 1000 / (recent.reduce((a, b) => a + b, 0) / recent.length) : 0;
    const last = rounds.at(-1) && summarise(rounds.at(-1).frames, refresh), all = summarise(session, refresh);
    text.textContent = `${Math.round(fps)} fps · ${all.dropped}% dropped · ${rounds.length} rounds${last ? ` · last round p95 ${last.p95} ms, ${last.dropped}% dropped` : ''}`;
  }, 500);
  return { report };
}

if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('perf')) window.ZombifyPerfProbe = startPerfProbe();
