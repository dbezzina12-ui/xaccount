# Head and jaw correction batch

Painted source pair for Claude's fitting review. **Not final rig art and not active in the game.** This batch was registered against v4.0 before Claude's concurrent v4.1 update (06eb9aa). The live contract now fits the original 16-piece assembly, with three tail sections and a separate far ear. Keep this pair outside the live prep source directory. Its old-v4 registration is not a drop-in replacement for v4.1.

`originals/` holds the final built-in ImageGen output PNGs. `registered/` holds separate transparent 1600×2000 layers; the head no longer includes the lower jaw. The enlarged jaw backing and painted plum mouth interior allow the separate ivory chin to open without exposing the scene through the mouth. `generation-prompts.json` records the edit sequence.

Run `python art/source/mouth-v5/register.py` from the game directory (Pillow required). This recreates the PNGs, SHA-256 manifest and `pose-review.jpg`. The sheet is a source compositing check at 0°, +8°, +16° and −8°, with small thumbnails; it is **not a browser screenshot**. Positive values rotate the jaw clockwise. It draws jaw first, then head, as v4 specifies.

## Measured results and limits

- Jaw: alpha ≥128 across 100% of the radius-55 disk at (905,742), versus 55.29% in the previous candidate.
- Head: alpha ≥128 across 95.526% of the radius-55 disk at (875,790). The 424 failing pixels lie within x894–930, y741–810, at the forward neck/mouth boundary. This is still an open overlap check, not a pass.
- Four mouth sample points at all four reviewed angles retain alpha ≥252. The sheet shows a filled dark mouth at +8° and +16°. Sparse samples do not certify every pixel or every pose.
- Head registration uses measured eye midpoint (727,777) → v4 (960,665), scale 0.5. Jaw uses source hinge (600,430) → v4 (905,742), scale 0.18. These are reproducible fitting choices, not approved final joint placement.
- The larger black neck backing must be checked against the torso/vest and clipped by the intended overlap, without changing mouth occlusion. Far ear is still absent from this head; near ear, goggles and eyelids require registration to this revised face.

## Superseding next work — v4.1 received during publication

ChatGPT: adapt the new pair after Claude returns fitted v4.1 landmarks/occlusion feedback; enlarge hidden paint on the existing assembly at far elbow (1153,1110), far wrist (1315,1174), near elbow (550,1150); then remaining panels, cards, win titles and intro. Do not force the live assembly back to v4.0 or add tail-4 as a prerequisite.

Claude: use the raw paintings for a v4.1 fit trial and return exact jaw/eye/neck landmarks. The recorded joint coverage here refers only to the old registration. Keep live head/ear/blink intact until the replacement fits. Check jaw extremes against torso/vest and maintain the mouth cavity; then test phone/desktop. The source pose sheet is not evidence that this pair fits the shipping rig. No math, runtime, symbols or audio changes in this batch.
