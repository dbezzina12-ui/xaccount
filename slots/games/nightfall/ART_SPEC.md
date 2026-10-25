# Night Fall: character art spec, rig v2

> Spec by Claude; art by ChatGPT. **Goal:** the reaper and the skeleton archer exactly as in `art/source/layout-target.png`, as layered cutouts the rig can animate without cutting corners.

## Why a redraw

The current cutouts (`runtime/assets/nightfall/reaper|archer/*.webp`, from the atlases) were not drawn from the target pose, so no rig fitting can make them match it. `shots/art-vs-target.jpg`, `shots/rig-v2/compare-reaper.jpg` and `compare-archer.jpg` show the differences at the same scale.

- **Reaper.** In the target, the scythe arm is raised: the fist grips the shaft at chest height, above the wrist, knuckles on top. The cutout forearm hangs, with the fist at hip height below the wrist. The target's cape is much wider, its blade bigger and its open left hand larger.
- **Archer.**
  - **Bow and arms:** in the target the bow is far bigger (from above the hood to the shins) and both arms are higher. The draw elbow is out to the side at chest height, the bow hand is a fist closed on the riser, and the shoulders are tucked under the red capelet.
  - **Cutouts:** the bow is smaller and lower, the draw elbow hangs down, the bow hand is open, and the shoulder balls sit low and in front of the capelet.
  - **Legs:** the target has a wider stance with bent knees.

## Facing

- **Reaper:** as in the target. He faces the reels, scythe in the hand on the reel side.
- **Archer:** the target **mirrored**, so he holds the bow toward the reels and the arrow points at them; the quiver ends up behind his right shoulder. The head is the one exception: it looks **left, toward the reels**. In the target he looks at the reels but aims off-screen, and the game needs him to hit symbols on the reels.

## Canvas and registration

- One canvas per character: **1600 × 1720 px, transparent PNG.** Every layer of a character uses this same canvas and is drawn **in place**. Stacking the layers in the order below at (0, 0) must reproduce that character's `full.png` exactly.
- Pose and scale come from the guides, `shots/rig-v2/guide-reaper.jpg` and `guide-archer.jpg`:
  - the target scaled 4.5×;
  - soles on y = 1656;
  - body centred on x = 800.
- Trace the guide. The whole character, including the scythe blade and both bow tips, stays inside the canvas. Both characters are at the same scale, because the guides are.

## Rules for every layer

1. **Complete behind occluders.** Draw each layer whole, including what other layers hide: the cape behind the body, the scythe shaft through the fist, the riser through the bow hand, the arrow through the bow's window, and the robe and boot behind the Buy Bonus button.
2. **Joints overlap.** At every joint the child part ends in a round socket hidden under its parent at rest, reaching at least 40 px past the visible joint line:
   - shoulder balls under the hood or capelet;
   - each reaper forearm's mauve socket cap inside its sleeve;
   - each archer forearm's end under its upper arm;
   - each wrist under its forearm.

   Never end a moving part exactly at a visible edge.
3. **Held objects pass between two layers.** A hand that holds something is split in two: the back of the hand behind the object and the fingers in front, so the shaft, riser or arrow passes between them.
4. **Nothing baked in.** No bowstring (the game draws it; show the string notches at the bow tips). No shadows, glow, ground or background on any layer.
5. **Same style.** Keep the approved art's line weight, palette and shading.

## Layers, back to front

### Reaper (`reaper/`)

| # | File | What |
|---|---|---|
| 1 | `cape.png` | The wide ragged cape behind the body, complete. |
| 2 | `arm-right-upper.png` | Scythe arm: the long sleeve from a shoulder ball (under the hood) to past the elbow, hanging as in the target. |
| 3 | `body.png` | Robe, skull clasp, chest strap, belt with the round buckle, bone charm, legs and boots. No arms, no head, no scythe. |
| 4 | `arm-right-fore.png` | Scythe forearm bones, raised as in the target, from an elbow socket cap (inside the sleeve) to the wrist. |
| 5 | `arm-right-hand-back.png` | The back of the scythe fist, behind the shaft, with a wrist socket under the forearm's end. |
| 6 | `scythe.png` | The whole scythe: blade, full shaft (including inside the fist) and spike. |
| 7 | `arm-right-fingers.png` | The fingers and knuckles that wrap in front of the shaft. |
| 8 | `arm-left-upper.png` | Left sleeve, from a shoulder ball (under the hood) to past the elbow. |
| 9 | `arm-left-fore.png` | Left forearm with its ragged cuff and the open hand hanging at the hip, from an elbow socket cap (inside the sleeve). |
| 10 | `head.png` | Hood and skull. |
| — | `head-blink.png` | `head.png` with the eyes shut, same canvas. |
| — | `full.png` | Layers 1 to 10 stacked. |

### Archer (`archer/`)

| # | File | What |
|---|---|---|
| 1 | `body.png` | Ribcage, spine, pelvis, belt and buckle, pouch, skirt, legs, boots, and the quiver with its arrows on his back. No arms, no head, no capelet. |
| 2 | `arm-bow-upper.png` | Bow arm: shoulder ball (under the capelet) to the elbow knob. |
| 3 | `arm-bow-fore.png` | Bow-arm bracer forearm and the back of the bow fist, behind the riser. Its elbow end is under the upper arm. |
| 4 | `bow.png` | The bow alone: no string, no arrow, the riser complete through the hand. |
| 5 | `arm-bow-fingers.png` | The bow fist's fingers, in front of the riser. |
| 6 | `arrow.png` | The nocked arrow, complete from nock to head. |
| 7 | `arm-draw-upper.png` | Draw arm: shoulder ball (under the capelet) to the elbow, out to the side as in the target. |
| 8 | `arm-draw-fore.png` | Draw-arm bracer forearm and the hand pinching the arrow's nock, in front of the arrow. Its elbow end is under the upper arm. |
| 9 | `capelet.png` | The red shoulder cape with the skull brooch, over both shoulder balls. |
| 10 | `head.png` | Hood and skull, looking toward the reels. |
| — | `head-blink.png` | `head.png` with the eyes shut, same canvas. |
| — | `full.png` | Layers 1 to 10 stacked. |

If the target needs a different order somewhere, keep the target and say which layers moved.

## How far each joint turns

These ranges set how big the overlaps must be (degrees from the target pose):

- **Reaper scythe arm:**
  - shoulder −30 to +20;
  - elbow −50 to +25;
  - wrist (the fist turns with the scythe) −20 to +60.
- **Reaper, other parts:** left arm ±10, head ±8, cape ±3.
- **Archer:**
  - bow arm and bow together ±20 about the bow shoulder, to aim;
  - draw arm: the hand draws the string about 70 px back along the arrow;
  - head ±5.

## Delivery

- Put the PNGs, with the exact names above, in `art/inbox/rig-v2/reaper/` and `art/inbox/rig-v2/archer/`. Leave the current `runtime/assets` files in place until Claude switches the rig over.
- Check before handing off: stack the layers in order, then compare the result with `full.png`, and with the guide at 50% opacity.

## What Claude does next

Claude will:
- trim each layer and derive its placement and joints from the overlaps (`tools/nightfall-rig.py`);
- rebuild the rig for these layers (rig space 400 × 430, 4 px per unit);
- re-key the strike and the shot from the target poses;
- extend the pixel checks so no socket shows at any bend and every hand stays closed on what it holds.

The guides are regenerated by `python3 tools/nightfall-guides.py`.
