// Bonus entry is a single timed cue. Some low-refresh embeds resolve WAAPI's
// finished promise only at the next paint, adding a stall between every beat.
export async function finishEntryBeat(animations) {
  const end = Math.max(0, ...animations.map(a => a.effect.getComputedTiming().endTime));
  const deadline = setTimeout(() => {
    for (const animation of animations) {
      if (animation.playState === 'running') animation.finish();
    }
  }, end + 20);
  try {
    await Promise.all(animations.map(a => a.finished));
  } finally {
    clearTimeout(deadline);
  }
}
