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

Dylan: the rigs weren't working and the feet weren't planted. `runtime/nightfall-actors.js` is now a jointed rig; the art is unchanged apart from parts cut from it (four in the first pass, three more in the second).

- **Joints come from the art.** `tools/nightfall-rig.py` measures them (elbows = where sleeve and forearm overlap, the scythe grip = where the fist covers the shaft, the bow's nock and tips = fitted to the string pixels) into `runtime/assets/nightfall/rig.json`, and cuts four parts: `archer/bow-bare.webp` (the bow without its painted arrow and string; the wood behind the arrow is filled from the wrap above), `archer/arrow.webp`, and the draw arm split at the elbow (`draw-upper.webp`, `draw-fore.webp`, overlapping by a few pixels so bends never open a gap). Re-run it after any rig art change.
- **Bones, not separate CSS rotations.** Each part hangs from a bone that turns about its joint and carries its children: shoulder, elbow, then the scythe at the grip; the bow and bow arm turn together about the bow shoulder; the draw arm is solved (two-bone IK) so the fingers stay on the nock while aiming and drawing. The string is drawn live (tips, fingers, tips), snaps straight and rings out on release, and the arrow is loosed at the release point and nocked again. Parts stay flat siblings with their original draw order.
- **Feet planted.** The body (legs and boots) never moves; breathing scales the upper body about the soles. Both characters stand on one ground line with a soft contact shadow: on phones the soles sit on the bottom of the controller's first row (Buy Bonus, - and +), clear of the icon row, as in `art/source/layout-target.png`; on desktop on the floor just above the controller bar.
- **Lifecycle.** A slow idle (breathing, a little sway carried down the arms) at most 30 paints a second; none in a hidden tab, with the menu open, during an action or under reduced motion. Skip ends an action at once; the release still resolves at the same phase (strike .48, shot .57), and the arrow trail starts at the nocked arrow's head.
- **Arms seated (second pass).** Dylan: the arms weren't connected. The cutouts are separate tubes. Every reaper forearm has a socket cap on top that is meant to sit inside its sleeve, and every archer arm has a shoulder ball meant to sit on the body's. ChatGPT's placement boxes stacked them end to end, so the caps showed and the archer's arms hung from balls beside the body's own shoulders. Each arm now has a **rest placement** (its art's turn or move inside its bone, in `rig.json` `rest`):
  - **Reaper:**
    - Each forearm slides up into its sleeve. The scythe fist turns 15° on the shaft and slides 16 up it; the left hand rises 33 to the pouch.
    - Two new layers, `reaper/upper-*-hem.webp`, are each sleeve again less what the body covers, drawn over its forearm, so the forearm comes out of the sleeve.
    - The shaft runs over the sleeve and under the fist (`reaper/fore-right-fist.webp`), as in the layout target.
    - Both caps stay at least 3 rig units inside their sleeves at every elbow bend the strike uses. The tool asserts this.
  - **Archer:**
    - Each arm's ball is on the body's shoulder ball. The left is in full view; the right, half under the cape, is fitted from its outline.
    - The bow arm rises 18° and the bow sits in the hand. The open hand closes over the riser, and the arrow rests across it. The bow arm is now drawn over the body and the bow.
    - The string is held at the front of the fist's top knuckles (`fingers`) instead of a point in front of it.
    - The draw shoulder sits 5 rig units above the body's socket ball (`shoulderRaise`), toward the layout target where it is level with the cape's skull brooch. Higher than 5, the edge of the body's own ball shows during an aimed draw.
- **Art vs target (Dylan's check, `shots/art-vs-target.jpg`).**
  - **Reaper scythe hand: art.** The target raises the arm, with the fist above the wrist at chest height. `reaper/fore-right.webp` is drawn hanging, with the fist below the wrist, and no turn of it gives the target's hand.
  - **Archer: minor art notes.** The target closes the bow hand round the riser and tucks the draw shoulder under the cape. The cutouts have an open hand, and a socket ball that is lower than the target's, sits in front of the cape, and is smaller than the arm's ball.
  - The redraw request is in `collab/HANDOFF.md`.
- **Checks.** `tests/browser/nightfall-rig.e2e.mjs` measures:
  - every joint from the rendered transforms, on every frame of a real strike and shot (desktop, 390x844 and 390x693);
  - the soles and the release point;
  - the ground line at 390x844, 390x693, 375x667 and 1280x800;
  - the pause/skip/hidden/reduced-motion behaviour.

  It also checks the arms from the art's own pixels, through the drawn transforms, so these checks don't lean on the rig's pivots:
  - no pixel of a reaper socket cap shows;
  - the archer's arm balls sit on and hide the body's shoulder balls;
  - the bow hand covers at least 85% of the riser around the arrow's rest.

  With ChatGPT's original placement the cap check fails at once (46 of 46 points showing). `npm run test:nightfall` runs the engine checks; `engine.js` is byte-identical (SHA-256 876e2a6d...). Before/after: `shots/arms-before-after.jpg`.

## Reaper v2, the default (Claude, 2026-10-26)

Dylan approved it and asked for it in the game. The first rig is still there with `?reaper=v1`.

- **Art:** ChatGPT's registered bone-arm pieces (`art/source/reaper-v2/parts/`, from `Reaper-Arm-Pieces-v1`) and the shoulder mantle Dylan sent (`art/source/reaper-v2/shoulder-mantle.png`). There are no sleeves: the mantle's skull replaces the chest clasp, and the mantle hides the shoulder and elbow. Dylan approved putting all of it in the public repo.
- **Build:** `python3 tools/nightfall-reaper-v2.py` writes `runtime/assets/nightfall/reaper-v2/` (layers and `rig.json`).
- **Layers, back to front:** robe body; upper arm, forearm, and hand with the scythe; mantle; fist and scythe again (in front of the mantle, robe and boots); hood again (faded in while the blade is behind the head).
- **Strike** (`STRIKE_V2`): blade back behind the hood, over the top, then a chop toward the board. The release is at .48, as before.
- **Breathing:** the robe and mantle are warped row by row. The shoulders and hood rise 4 rig units, the chest stretches and widens a little, and the hips, legs and boots don't move. One breath every 3.8 s.
- **Debug:** `&reaperDebug=joints` makes the mantle and robe see-through.
- **Checks:** `tests/browser/nightfall-reaper-v2.e2e.mjs` reads the art's pixels on every frame (desktop, 390x844, 390x693):
  - the joints stay hidden through the strike and the idle;
  - the blade is clear of the hood while it fades;
  - the boots stay planted;
  - the warp has no seams.
- **Previews:** `shots/reaper-v2/` (strike at real speed and slowed, phone strike, breathing).

## Skeleton mage, in the archer's place (Claude, 2026-10-26)

This is the archer's replacement: Dylan approved a skeleton mage that bangs its staff. Dylan: "Push to game". The mage is the default, and the archer is still there with `?archer=archer`.

- **Art:**
  - ChatGPT's registered mage layers are in `art/source/mage-v1/`; ChatGPT's own `HANDOFF.md`, rig and proof are there too.
  - Dylan's `mantle.png` replaces ChatGPT's `robe-cover.png`. It has no sleeve, so the bone arm comes out from under a long flap and there is no sleeve to deform. A skinned bell sleeve was prototyped, but it showed cut edges where the art had no hidden sleeve cloth.
  - `python3 tools/nightfall-mage.py` builds `runtime/assets/nightfall/mage/`.
- **Layers, back to front:** body (robe, ribs, free arm, legs, boots); upper arm and forearm; the back of the fist, the staff and the fingers (one rigid grip); the head (`blink.webp` is its blink); the mantle (over the shoulder, elbow and neck).
- **Rig:**
  - The arm is solved from the shoulder to the grip every frame, so it follows both the breath and the staff. Its elbow matches ChatGPT's proof to 0.02 rig units.
  - The body and mantle breathe with the same warp as the reaper.
  - `&mageDebug=joints` makes the mantle and robe see-through.
- **The mantle's flap rides on the arm** (Dylan: "the flap in front of his arm should move too"):
  - During the slam the mantle is drawn through a triangle mesh. Each flap point moves with its nearest point on the arm: not at all near the shoulder, fully along the forearm, and easing off toward the wrist.
  - The cloth above the arm follows less with distance, and the tatters below hang from it.
  - It is pinned at the clasp and where the flap joins the capelet.
  - The cloth trails the arm slightly (more for the tatters further down) and swings a little past rest on the landing.
  - Out of the slam, the cheaper row warp handles the breathing.
- **Slam** (`SLAM`, from ChatGPT's timing; the action now runs 1.45 s so the flap settles):
  - lift 39 rig units by 0.6 s, hold to 0.75 s, slam to the impact at 0.91 s, a small bounce, the staff still by 1.2 s and the flap by 1.45 s;
  - the head looks up during the lift and nods into the impact, and the shoulders settle hard as the staff lands;
  - `shoot()` resolves at the impact with the crystal's position, so the game's existing trail starts there.
- **Checks:** `tests/browser/nightfall-mage.e2e.mjs` checks every frame of a real slam at desktop, 390x844 and 390x693, plus the idle:
  - no shoulder or elbow point shows;
  - the fingers stay on the shaft and the forearm on the wrist;
  - the feet stay planted;
  - the lifted staff stays on screen, and the slam resolves at the impact;
  - the mage shares the reaper's ground line;
  - the flap moves more than 15 units, never covers the fist, and is back at rest when the slam ends.
- **Previews:** `shots/mage/`.
- **Still open:**
  - The slam's effect on the reels still uses the archer's arrow trail; Dylan is choosing a mage effect.
  - The rules and intro copy still say "archer".
  - The free arm is part of the body, so it doesn't move.
