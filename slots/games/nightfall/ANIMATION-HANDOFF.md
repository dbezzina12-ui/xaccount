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

## Claude rig pass (2026-10-25)

Dylan: the rigs weren't working and the feet weren't planted. `runtime/nightfall-actors.js` is now a jointed rig; the art is unchanged apart from four parts cut from it.

- **Joints come from the art.** `tools/nightfall-rig.py` measures them (elbows = where sleeve and forearm overlap, the scythe grip = where the fist covers the shaft, the bow's nock and tips = fitted to the string pixels) into `runtime/assets/nightfall/rig.json`, and cuts four parts: `archer/bow-bare.webp` (the bow without its painted arrow and string; the wood behind the arrow is filled from the wrap above), `archer/arrow.webp`, and the draw arm split at the elbow (`draw-upper.webp`, `draw-fore.webp`, overlapping by a few pixels so bends never open a gap). Re-run it after any rig art change.
- **Bones, not separate CSS rotations.** Each part hangs from a bone that turns about its joint and carries its children: shoulder, elbow, then the scythe at the grip; the bow and bow arm turn together about the bow shoulder; the draw arm is solved (two-bone IK) so the fingers stay on the nock while aiming and drawing. The string is drawn live (tips, fingers, tips), snaps straight and rings out on release, and the arrow is loosed at the release point and nocked again. Parts stay flat siblings with their original draw order.
- **Feet planted.** The body (legs and boots) never moves; breathing scales the upper body about the soles. Both characters stand on one ground line with a soft contact shadow: on phones the soles sit on the bottom of the controller's first row (Buy Bonus, - and +), clear of the icon row, as in `art/source/layout-target.png`; on desktop on the floor just above the controller bar.
- **Lifecycle.** A slow idle (breathing, a little sway carried down the arms) at most 30 paints a second; none in a hidden tab, with the menu open, during an action or under reduced motion. Skip ends an action at once; the release still resolves at the same phase (strike .48, shot .57), and the arrow trail starts at the nocked arrow's head.
- **Checks.** `tests/browser/nightfall-rig.e2e.mjs` measures every joint from the rendered transforms on every frame of a real strike and shot (desktop and 390x844), the soles, the release point, the ground line at 390x844, 390x693, 375x667 and 1280x800, and the pause/skip/hidden/reduced-motion behaviour. `npm run test:nightfall` runs the engine checks; `engine.js` is byte-identical (SHA-256 876e2a6d...).
