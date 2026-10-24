# Studio pass 1 review snapshot

Exact active editor source from Sites commit 05771c968ebf63cede13b34eb468346648a0bea8, published October 24, 2026. Previous GitHub handoffs described Site-only changes; this snapshot supplies the actual code without replacing the older active xaccount source before reconciliation.

Run from this directory:

```sh
node --test tests/*.test.mjs
```

studio/ contains active editor modules, HTML and CSS. For browser integration, overlay these files into the current full Sites checkout (dist/studio), or a prepared and reconciled xaccount checkout (slots/studio). Preserve existing game/sound runtime and room/frame artwork from Sites. Only the audio manifest needed by focused tests is included from the runtime. The full game runtime and binary artwork are not duplicated here; this review folder alone is not a deployment package.

Read QA.md for checks and remaining review. Held values are samples; win artwork uses the existing idle fallback, not an animation playback. Only plain labels accept wording; counts and amounts stay game-controlled. No keys, API chat, math changes or background triggers.

Review before pass 2 (alignment/reusable presets), then pass 3 (saved versions/game export).

