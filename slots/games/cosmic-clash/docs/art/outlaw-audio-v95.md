# Long loops with quiet ambience

Replaces playback of each whole song and its outro with the long-loop edits
reviewed in the audio conversation. Original songs remain in Library and the
previous source revision.

| Track | Original section | Loop duration | Ambience spacing |
| --- | --- | --- | --- |
| Base | 32.182896–154.820188 seconds | 122.637292 seconds | 30.2–30.84 seconds |
| Bonus | 24.659583–141.431500 seconds | 116.771917 seconds | 38.5–39.38 seconds |

Both edits use a circular 650 ms blend at the music join. Three soft stereo
filtered-air sweeps alternate. One cue starts before the loop boundary and
trails over it; the others establish the same sound as recurring atmosphere.
The cue is kept at least 20 dB below the local music RMS, with an additional
0.055 linear peak cap (actual mixed levels are about 26–29 dB below the music).
There is no music duck, loud impact, or sudden cue at the seam.

Ambience is embedded in the music assets. It follows the music slider, mute,
pause and scene changes without a separate scheduler. Existing bonus restart,
base resume, SFX, outcome generation and scene transition code stay intact.

Rebuild using `scripts/render-loop-ambience.py` and the two original supplied
MP3 files. The script renders mastered tracks, listening previews and the
per-cue measurements in `loop-ambience-v95.json`. Preview copies include one
whole loop plus the first 25 seconds of the next cycle.
