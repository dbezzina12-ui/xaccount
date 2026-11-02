# Cyber Skunk opening splashes v1

This deterministic batch completes ART_SPEC §8's final two source inputs:

- `art/ui/splash-desktop.png` — exact 1920×1080 indexed PNG, lower 40% quiet.
- `art/ui/splash-mobile.png` — exact 1080×1920 indexed PNG, lower 45% quiet.

Both are static opening illustrations assembled from the approved production hall, cabinet, logo, character-free symbols and compact mascot reference. The flattened splash mascot does not replace the articulated v4.1 runtime rig. Prices, rules, controls and outcomes remain live UI and are not baked into the art.

Run `python3 slots/games/cyber-skunk/art/source/splash-v1/build.py` from any directory. The builder recreates both PNGs, `review.jpg`, and `manifest.json` with hashes and safe-zone luminance checks. The repo PNGs use a deterministic 96-colour painted palette and a 2/3-scale master inside the exact target canvas; prep converts them to runtime WebP.
