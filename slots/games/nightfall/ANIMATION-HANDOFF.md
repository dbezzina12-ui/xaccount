# Night Fall — animation handoff for Claude

Night Fall is a separate project inside Gamboligy Studio. Source gameplay is Knightfall v0.5.3, Sites commit b49911bdd51dffbecbf4b6ea7c34c63881527e90. The original engine.js is byte-identical; keep outcome selection, weights, costs, awards, multipliers and the seeded RNG unchanged.

## Play and edit

- Play: `games/nightfall/runtime/index.html`
- Editor: `nightfall-studio/index.html`
- Project registry: `projects.js`
- Night Fall scene saves: `gamboligy-studio:nightfall:presentation:v1`
- Night Fall playtest ledger: `nightfall-session-v1`
- Zombify's existing editor, runtime and save keys remain intact.

## Art and rig

Approved look: purple grim reaper on left, maroon skeleton archer on right, quiet teal graveyard, no house above mobile reels, large gold FS tombstone, shared GG controller. 7×7 gameplay. Mobile characters are below the playable board. Desktop characters flank it. No speech bubbles or attack captions.

`art/source/` keeps the approved concept, original generated background/title and three transparent atlases. `runtime/assets/nightfall/atlas-manifest.json` records source rectangles and extracted sizes. Production pieces are transparent WebP.

Reaper pieces: head, blink head, body/robe/boots, rear cape, left/right upper sleeves, left/right forearms with hands, separate whole scythe. Archer pieces: torso/legs/quiver, head, blink head, bow arm, draw arm, bow with nocked arrow.

`runtime/nightfall-actors.js` exports `RIGS` with the registration boxes on a 320×430 reference canvas and `CourtKnight`/`CourtArcher` compatibility adapters. CSS contains transform pivots and draw order. Initial motion includes eye blinks, a procedural scythe swing, bow pull/release, and a short head nod. It is a first animation pass; refine elbow parenting, scythe-grip locking and bow-hand contact, then add a small idle cycle with hidden-tab/reduced-motion lifecycle checks. These are actual separate composited assets, not an animated flattened screenshot.

The copied runtime retains the original initial-drop/tumble renderer and ordered arrow wild trail. Paid outcomes are settled once before animation. The scythe/arrow presentation consumes recorded events and cannot choose awards. Check skip, menu pause, hidden tabs and resizing, especially the frame at release.

## Follow-up

1. Review and refine the character rig contacts through all action phases.
2. Unify this presentation adapter with the broader Studio inspector (the first Night Fall editor currently supports independent mobile/desktop scene sizing, background upload, cell color and JSON import/export).
3. Run browser regression on short phones and real devices. Keep FS readable and the shared controller at normal proportions.
4. No new math claims: this preserves the existing play-money prototype and its original development-math limitation.

Artwork generated with built-in image generation from the approved Night Fall mockup. Prompts: isolated quiet graveyard background; transparent 3×3 Halloween symbol atlas; transparent 3×3 reaper cutout atlas; transparent 3×2 skeleton archer cutout atlas; isolated transparent NIGHT FALL hanging title. Extraction tooling: `tools/prepare-nightfall-art.py`. No third-party character artwork.

## Layout correction after Dylan's reference comparison

Dylan supplied `art/source/layout-target.png` as the authoritative target for sizes and background. The previous wide background was incorrectly cropped on mobile. A separate portrait plate now restores the moon above and chapel/graveyard below the reels (`background-mobile.webp`, source `background-mobile.png`). Mobile title and foreground actors are larger; actor feet overlap the upper controller region rather than forcing all art into the leftover empty gap. Checks covered 390×693 and 390×844. The layered character art/poses are still not an exact match to the target: Claude must repair the arm connections and weapon grips and judge the complete silhouette against this target. This is a layout correction, not rig approval. Engine/controller source remains unchanged; 20 Night Fall checks pass.
