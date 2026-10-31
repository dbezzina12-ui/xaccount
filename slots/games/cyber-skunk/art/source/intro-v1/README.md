# Cyber Skunk intro art v1

Two exact 900×600 opaque RGB production sources live in `art/ui/`:

- `intro-route.png`: a 4×3 rules diagram using the shipping vent and WILD art. The route enters from the left, continues through an outlet-right ×2 vent, turns upward at an outlet-up ×3 vent, and shows the authoritative WILD faces.
- `intro-bonuses.png`: three blank mechanical plates for live mode labels, followed by exactly 3, 4 and 5 plain FS tiles. The art contains no prices, odds or fixed rules copy.

`build.py` creates both images deterministically with Pillow from the production files in `art/symbols/`. `manifest.json` records output hashes and invariants. `review.jpg` shows the native compositions at desktop-card and 270px phone-card sizes. Rebuild from the repository root with:

`python slots/games/cyber-skunk/art/source/intro-v1/build.py`

Runtime integration must keep the mode labels and explanatory copy live. The current asset loader replaces the generated fallback when these files are prepped; Claude should overlay `VENT BREAK`, `OVERPRESSURE` and `BLACKOUT PROTOCOL` on the three intentionally blank plates and verify phone readability. No math, rig or runtime state is encoded here.
