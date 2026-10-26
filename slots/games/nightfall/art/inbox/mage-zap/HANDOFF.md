# N-08 — Roaming Wild, single-cell zap and in-cell multipliers
2026-10-26 · ChatGPT → Claude + Dylan

## User direction
Dylan: “Mage is in the game, make it zap a single spot when it does. But I think it should be a roaming wild single space for bonuses.”

Follow-up: “Yes upload it. But it's a roaming wild. We also need to fix the placement of the multi in the cells. It should replicate the real game. Its inside the cell not bottom of it.” Dylan explicitly authorized uploading this implementation brief to the xaccount Claude branch.

Treat Roaming Wild as the feature identity. The zap is its arrival/movement effect, not a separate replacement for the bonus roaming behavior.

REQUEST for Claude: implement the engine, effect, sound and tests below. This note records the requested direction and concrete implementation defaults; it is not a claim that the mechanic is already live. Baseline inspected: 1e631e8483304014fa7b2f6f0072848c9a9532c1, where the mage is default and the effect is still ArrowTrail.

## Behavior
- Base game: when the current mage opportunity triggers, the staff slams and the crystal zaps exactly ONE eligible cell into a wild. Replace the 3–5-cell arrow trail. Retain the existing base trigger opportunity/frequency unless simulation requires an explicitly documented tuning decision.
- Bonus default: regular and Super both get ONE mage-owned roaming wild. Place it on the first free spin, after the symbols land and before win evaluation.
- Keep that wild at its selected cell through all tumbles of that free spin. It can help multiple wins; it does not fall or duplicate when neighboring symbols collapse.
- On each subsequent free spin, choose a different eligible cell and move the single wild there before evaluating wins. The old cell gets that spin's ordinary symbol. No trail of extra wilds remains.
- Retriggers extend the same single wild; do not create another. Remove it at bonus end and restore normal base behavior.
- “One” limits the mage's persistent wild, not reaper-created or other existing wilds.
- Never overwrite FS tombstones. Choose among eligible non-FS, non-wild cells. Exclude the prior location when a different eligible cell exists; handle no eligible destination without overwriting a protected symbol or creating a second wild.
- Tile multipliers belong to board positions. They do not travel with the roaming wild. Winning positions still advance under the existing rules.
- Replace bonus arrow-trail events with this behavior; do not retain a second random mage trail/zap on top. Preserve the reaper's existing opportunity logic, shapes and Super behavior; do not silently turn removed archer opportunities into additional reaper strikes.

The once-per-free-spin movement and persistence through that spin's tumbles are implementation defaults chosen to make “roaming wild single space” concrete. Report any necessary deviation in the handoff before treating it as approved tuning.

## Presentation
- Use Claude's current working mage, moving mantle and staff slam. Do not reimport older fixed-flap art or replace the approved reaper.
- Trigger the bolt from the actual crystal position at the current slam release/impact (about 0.91 s in the current 1.45 s action), not the older standalone art proof timing.
- One bright violet bolt with an ivory core travels directly from crystal to target. Approximately 120–180 ms, followed by a compact 150–250 ms impact spark wholly centered on that cell.
- Reveal the wild at the impact. During bonus relocation, release the old marker and reveal the new one atomically; keep one game-state owner.
- Give the mage wild a readable W and restrained violet rim/rune accent. Keep the symbol legible at mobile size, and do not leave an arrow, horizontal trail, branching multi-cell strike, large opaque flash or a text shout.
- Short magical crack at the hit, staff impact underneath it. Respect mute, turbo, skip, pause and reduced motion. Reduced motion can use a brief target highlight with the same resolved result.
- The engine selects and records the cell once. Animation only reads that event; no renderer RNG or outcome selection.

## Copy prepared for the implemented behavior
Use these strings only when the corresponding mechanic is implemented, so current rules do not promise a single wild while the engine still creates a trail.

Rules heading: Roaming Wild
Rules: The skeleton mage can slam its staff and zap one symbol into a wild. Wilds substitute for paying symbols. FS tombstones are never replaced.

Bonus rules heading: Roaming Wild
Bonus rules: One mage wild appears in Free Spins and Super Free Spins. It stays in place through the spin’s tumbles, then moves to a new spot on the next free spin. Multiplier tiles stay on their own spaces.

Intro: The mage's Roaming Wild moves to a new space each free spin.
Studio button: Preview staff slam
Regular buy-card detail: 10 spins. Multiplier tiles stay in place. One roaming mage wild moves each free spin.
Super buy-card detail: 10 spins. Every tile starts at 2×. One roaming mage wild, cross-cut attacks and a chance of a Soul Harvest.

Keep symbol IDs stable where possible (the existing arrow-wild can retain its internal identifier); represent mage ownership separately from its display name. The legacy ?archer=archer debug rig must not accidentally restore obsolete multi-cell rules for the production mage.

## Multiplier placement — required visual correction
Dylan wants the multiplier INSIDE the cell, matching the referenced game's in-cell treatment, rather than a bottom label or footer badge. This placement correction is independent of the new wild's math and can ship first.

Confirmed cause in `runtime/styles.css`: `.multi` uses `position:absolute;right:1px;bottom:0;text-align:right` with asymmetric padding; the mobile rule also keeps right anchoring. `runtime/nightfall.css` changes its color and mobile font size but does not undo that placement. Fix both desktop and mobile anchoring and check the cascade; changing only the theme color rule will not move it.

- Center the multiplier number within the tile interior, horizontally and vertically; use the cell's own coordinate space. Remove bottom anchoring, under-cell offsets and footer-style placement.
- Treat it as the cell's multiplier, not a label attached to the falling symbol or the roaming wild. Keep it fixed to its board position through tumbles and wild relocation.
- Give the number enough size and contrast to read on mobile. Preserve clear symbol silhouettes; choose layering and restrained outlines to match the reference, rather than solving overlap by moving the number back to the bottom.
- Show the active value clearly when the tile is exposed or its multiplier contributes. Preserve existing visibility and upgrade rules unless explicitly documented; this request changes placement, not multiplier math.
- Check 2×, 16×, 128× and 1,024× on desktop and narrow mobile. All glyph bounds must remain within their own cell without overlapping neighboring cells or the frame.
- Provide before/after screenshots with the same board and values, including a symbol-filled board, tumble gaps and the roaming-wild cell. Compare against Dylan's approved layout/reference; do not claim an exact match without that visual check.

## Math and acceptance
This changes winning-cell count and persistence: it is NOT a presentation-only reskin. No unchanged-RTP claim.
- Update the simulator and math report using the same engine path. Report before/after return, hit rate, bonus averages, retrigger rate and cap behavior for base, regular, Super and affected feature/mystery entries. Existing prices are not evidence of a calibrated return.
- Deterministic tests: single base target; exactly one mage owner per bonus event; persistence through multiple tumbles; relocation without old-position residue; FS protection; multiplier positions unchanged by movement; retriggers; bonus exit; cap termination; no-eligible-target handling.
- Renderer tests at desktop and narrow mobile: one bolt endpoint matches the chosen cell; origin follows the moving crystal; wild reveal occurs at impact; no residual arrow trail; no clipped staff; grip and mantle checks still pass.
- Verify turbo, skip, pause, reduced motion and replay do not change selected cells, counts or awards.
- Update the stale rules, intro, buy cards and preview-button copy together with the implemented behavior; use the prepared wording above.
- Update BOARD N-08 and the shared handoff with implementation, simulation results and a mobile clip. Then ChatGPT can publish/review the completed build.

Only this scoped design/copy handoff is changed by ChatGPT. Runtime behavior and game math remain at the inspected baseline until Claude implements them.

