# Reaper arm pieces — v1 integration prototype

Dylan's direction: the arm must actually connect behind the robe. Keep a real upper arm and forearm underneath the clothing, and use the robe to cover the joints. Do not fuse the whole arm into one shoulder-driven sprite.

## Files to use

Use `parts/`, whose six transparent RGBA PNGs are all **1600 × 1720**, already registered in place. Do not auto-crop, center individually, or infer a pivot from an image bounding box.

| PNG | Role | Driven by |
|---|---|---|
| `arm-upper.png` | Complete humerus, including concealed rounded shoulder and elbow ends | Shoulder |
| `arm-fore.png` | Complete radius/ulna assembly, including concealed elbow and wrist ends | Elbow, inheriting shoulder |
| `hand-scythe.png` | Gripping hand and entire scythe together | Wrist, inheriting elbow and shoulder |
| `sleeve-upper.png` | Upper sleeve concealing the upper arm | Same transform as upper arm |
| `sleeve-fore.png` | Bell sleeve concealing the forearm | Same transform as forearm |
| `body.png` | Repaired torso/robe with no weapon arm or scythe | Body/root |

The body currently includes the head, hood, cape, relaxed opposite arm, and legs. This is a scoped weapon-arm package, not the complete multi-part character requested by the original ART_SPEC. Original generated images are in `sources/`; their coordinates differ. Use the registered `parts/` for integration. Prompts and the registration matrices are included for provenance.

## Rig setup

Common-canvas pivots (x,y pixels): shoulder **(997.80, 801.00)**; elbow **(1065.64, 948.20)**; wrist **(1164.20, 784.36)**. `rig.json` is authoritative. Positive rotation is clockwise in screen coordinates.

With `R(angle,pivot)` meaning a rotation around a common-canvas pivot:

```
upper = bodyTransform * R(shoulderAngle, shoulderPivot)
fore  = upper         * R(elbowAngle, elbowPivot)
hand  = fore          * R(wristAngle, wristPivot)
```

Do not add the parent translation twice. These are canvas-space sprites and pivot locations, matching the affine cutout approach in the existing `upperRight → foreRight → scythe` chain. When downscaling to the existing 320 × 430 runtime, account for the different aspect ratio: preserve the artwork's aspect ratio and apply the same transform to every part and pivot.

Back-to-front draw order used in the proof:

1. Upper arm.
2. Forearm.
3. Hand + scythe.
4. Lower sleeve.
5. Upper sleeve.
6. Body/robe, covering the concealed arm roots.

The hand/scythe sits underneath the cuff so the short wrist stump tucks inside it. The fixed grip is intentional: rotate the hand and scythe together at the wrist. No independent shaft movement through the fingers. The upper sleeve and lower sleeve remain separate, each following its own bone.

## What has been checked

`proof/assembled.png` is the actual assembled art. `proof/connection.png` compares the dressed character with the hidden bones revealed. `proof/poses.png` shows four poses; `proof/arm-motion.gif` shows their interpolated loop. These are rendered from the delivered pieces, not image-generated animation.

48 frames check alpha-mask contact at the elbow and wrist and confirm the shoulder joint stays covered by the body. Detailed results are in `proof/checks.json`. The sampled pose keys are `(shoulder, elbow, wrist)` in degrees: rest `(0,0,0)`, elbow bent `(-8,-18,18)`, arm raised `(-12,-10,10)`, return `(8,10,-10)`.

These checks establish contact for this cycle only. They do not validate every independent angle combination, the original 40px overlap requirement throughout the full motion range, or the production attack animation. The robe is rigid; cloth is not simulated. The chosen body-in-front order can hide the scythe when it crosses the torso or legs. Claude must resolve that draw-order transition for a forward strike; do not accept occlusion through the boots as a finished attack.

## Next for Claude

1. Import into a separate candidate asset directory, preserving existing working art and rig. Suggested target: `games/nightfall/art/characters/reaper-hidden-arm-v1/`.
2. Map the upper/fore/hand hierarchy and common-canvas pivots into the existing actor. Keep a debug toggle that hides both sleeves and fades the body, so the real connection is inspectable.
3. Play the included short cycle, then the actual rest, wind-up, strike and recovery at desktop and mobile actor sizes. Check shoulder/elbow coverage, cuff contact, grip, weapon/face intersections, and shaft/feet occlusion.
4. Adjust pivots, draw-order transitions or requested overlap extensions based on an actual failed pose. Keep this a candidate until the full strike is shown working. Do not reinstate the rejected one-piece arm or treat this as mesh-ready art.

The build script is included for reproducibility. It uses Pillow and NumPy to register and transform the generated assets; it does not repaint them. Built-in imagegen produced the six source layers. The public repository handoff contains text only; Dylan supplies this private ZIP to Claude.
