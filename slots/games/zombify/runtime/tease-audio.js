// Anticipation audio follows what has actually landed (S-20). Presentation
// only: it reads the settled scatter count, never the outcome.
// - Each reel still teasing gets a swell, a semitone higher per tier secured;
//   the swell ends when that reel lands.
// - Securing a tier during the tease plays a short ping (Outbreak, Super,
//   Hidden, each higher).
// - Music dips a little while the tease plays and returns when it ends.
// Skip, a hidden tab or a new spin stop effects in the audio director; this
// never starts a swell while skipping.
const semitones = (n) => 2 ** (n / 12);
export function createTeaseAudio({ play, stopCue, focus, shouldSkip = () => false }) {
  let landed = 0, active = false;
  return {
    // A reel has settled: `count` scatters have landed so far, and `waiting`
    // says whether a later reel is still spinning in its tease.
    settle({ count, waiting }) {
      stopCue('tease');
      if (shouldSkip()) return;
      const tier = Math.min(5, count);
      if (landed >= 2 && tier >= 3 && tier > landed) play('tease-up', { rate: semitones(2 * (tier - 3)) });
      landed = Math.max(landed, tier);
      if (tier >= 2 && waiting) {
        if (!active) { active = true; focus(true); }
        play('tease', { rate: semitones(tier - 2), intensity: 1 + 0.04 * (tier - 2) });
      }
    },
    clear() {
      stopCue('tease');
      if (active) { active = false; focus(false); }
      landed = 0;
    },
  };
}
