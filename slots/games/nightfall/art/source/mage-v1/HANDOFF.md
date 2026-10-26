# Night Fall — skeleton mage, art handoff v1

2026-10-26 · ChatGPT → Claude + Dylan

Dylan approved replacing the skeleton archer with a skeleton mage that bangs its staff, and approved the assembled mage concept. This is the separated art and a standalone motion proof. Keep Claude's approved reaper v2 as it is.

## Files and registration

Ten transparent PNGs, each 1600 × 1720. Draw each at (0, 0); never trim individual layers unless you preserve their offsets. Sole line y=1656. `full.png` is the exact rest-pose stack, not an independently rendered target. `approved-concept.png` records the approved design. Pieces were independently generated and registered, so the stack is a close reconstruction rather than a pixel trace of that concept.

Back to front: `body`, `arm-upper`, `arm-fore`, `hand-back`, `staff`, `fingers`, `head`, `robe-cover`. `head-blink` replaces `head`. The robe cover goes in front of the head's neck socket as well as both arm joints. This differs from the old archer order deliberately.

The free casting arm and hand remain on the body in this first staff-slam rig. The body includes the full boots. The staff has a continuous shaft behind the fist. The grip is split into back and fingers. No shadow, ground or magic glow is baked into the paint.

## Motion contract

`rig.json` contains canonical canvas coordinates, draw order and timing. The hand-back, staff and fingers are one rigid transform group. Translate that group vertically by up to 156 px; do not rotate its layers independently. Solve the upper arm and forearm using the supplied shoulder, elbow and wrist lengths, with the negative IK branch. The separate opaque robe cover hides the moving shoulder/elbow. Keep body, feet and cover fixed for this proof.

Suggested sequence: idle to 0.35 s; lift to 0.95; hold to 1.10; accelerate down to impact at 1.26; 13 px rebound, settling by 1.55. Runtime impact effects and sound should fire at 1.26. Allow at least 180 px transparent space above the canvas during lift; the crystal rises above the rest canvas. Do not clip it in the mobile character container.

The blink alternate was independently generated and has small outline differences. Use a brief blink; further eye-only compositing is optional integration polish. No head rotation or breathing deformation is certified by this proof.

## Verification

Run `python3 verify_and_preview.py` beside these files with Pillow and numpy installed. It verifies exact rest-stack equality, common canvas size, shoulder/elbow coverage across 49 lift positions, finger/shaft opaque overlap, forearm/cuff overlap and a fixed body/feet layer. Removing the robe cover fails the joint coverage control. Results and asset hashes are in `validation.json`; `staff-slam.gif` and `pose-check.jpg` show the assembled motion.

These are standalone art checks, not engine/browser regression tests. Runtime integration, in-game size, mobile clipping, ground alignment, reel-hit effects and breathing still need Claude's checks. The old archer-specific angles and pose in ART_SPEC.md are superseded by Dylan's mage request for this drop; no general-purpose angular-range claim is made.

## Request for Claude

1. Integrate the mage in place of the archer using these separated layers and rigid grip group, preserving the approved on-screen character size and ground line.
2. Re-time the archer action to a staff lift and slam using the proof as the starting point; connect impact to the existing reel effects without changing game math.
3. Extend pixel checks in the real renderer, including mobile overflow, wrist connection and closed grip through the full animation. Add breathing while keeping the feet planted.
4. Leave the current approved reaper v2 untouched. Update the shared task board/handoff with the integration outcome.

Only this mage art-inbox folder is part of this handoff; no runtime, math, shared logs or reaper assets are edited.
