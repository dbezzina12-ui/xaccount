# Subway refresh asset record

Created with the native image generation tool; no external provider API. Final runtime assets (reconstructed by studio:prepare):

- `games/zombify/runtime/assets/studio/subway-desktop.webp`
- `games/zombify/runtime/assets/studio/subway-lab-desktop.webp`
- `games/zombify/runtime/assets/studio/subway-infected.webp`

## Production briefs

Desktop base: landscape 16:10 companion to the approved mobile station, frontal camera, same navy/purple tiles and warm lamps, quiet central gameplay wall, blank bolted title sign, stairwell far left and exact purple-haired green mascot on a turnstile far right. No baked symbols, controller, frame or lettering.

Desktop lab: landscape companion to the approved mobile lab, matching ink/cel palette and mascot, OUTBREAK sign high centre, observation window right with blank counter plate below, quiet central wall and shallow empty workbench below gameplay. A second edit lowered/compressed the bench to leave room for live reels and jars. No baked jars or controller.

Infected symbol atlas: transparent 1536×1024, 3 columns×2 rows, cells 512×512. Top row skater, nurse, builder; lower row cop, scientist, FS. Five distinct head/shoulder zombie transformations of approved human identities: asymmetrical faces, milky eyes, slack crooked jaws, missing teeth, damaged role accessories and torn clothes, no gore. Keep each role's clothing color; do not simply recolor a human. Last cell contains only large freestanding uppercase FS, cream faces, lime bevel, thick black outline; no barrel, biohazard, border or subtitle.

Atlas cell assignments and all crop geometry live in `studio/subway-theme.js`. Keep the alpha channel and preserve crop size/position when creating detached animation copies. Full generated originals are retained in this ChatGPT conversation; runtime WebP files are compressed equivalents, with exact SHA-256 hashes in `bundled-art/studio-manifest.json`.


## S-26 · Separate mascot and intro greeting (2026-10-25)

Five WebP assets are stored as exact-byte base64 parts in `bundled-art/studio-manifest.json`, reassembled by `npm run studio:prepare`.

- `subway-background-clean.webp`, `subway-desktop-clean.webp`, `subway-lab-clean.webp`, `subway-lab-desktop-clean.webp`: image-generation edits of the existing subway plates. Brief: remove only the mascot, reconstruct matching tiles/window/turnstile, preserve scene geometry, lighting and all other artwork. Original plates remain as loading/error fallbacks.
- `subway-mascot-parts.webp`: transparent 1536×1024, 3×2 puppet atlas. Brief: preserve existing green zombie, magenta hair, purple torn star shirt and cheeky expression; separate open/blinking heads, resting torso, torso with one free shoulder, and raised waving arm. Cleanup pass isolated parts onto alpha. Original generated source: `exec-420ecdf2-81c9-4fd0-a381-ce81710fbde4.png`. WebP quality 93; atlas rectangles are documented in `runtime/subway-mascot.js`.

No game symbol or outcome artwork was repurposed for this puppet. Runtime draws the head and arm separately; reduced motion uses one still pose.
