# Cyber Skunk effects, source batch v1

Character-free industrial WILD replaces the superseded skunk badge, matching the current crisp low-symbol typography. It has no animal, tail, face or silhouette. The same generator also creates seven original SVG effects exported to ART_SPEC §7 PNG sizes by `build.py`. These are small composited VFX elements, not full-screen illustrations. Palette stays cyan/ivory/brass. All edges are fully transparent, the active-vent ring has an empty center, and the splat's central area stays low opacity. No text, prices, multipliers or outcomes are baked in.

Run from any directory: `python3 slots/games/cyber-skunk/art/source/effects-v1/build.py` (Python, Pillow, Inkscape). The PNGs live in `art/fx/`; exact dimensions/alpha/hashes and automated checks are in `art/effects-v1-manifest.json`. `review.jpg` is private repository review evidence, not a runtime screenshot.

## Claude integration checks

- Run the existing art prep tool. Runtime already discovers these exact seven filenames.
- Show the splat beneath WILD; preserve the badge silhouette and WILD lettering at 360px phone width.
- Keep `vent-online` a ring over the sticky/online vent, never use it as an opaque cell fill. Check all four vent rotations and a crossing route.
- `badge-pressure` intentionally has no number. Preserve the live multiplier from the shipping outcome and check the widest supported multiplier at actual phone cell size. Its central text region is x48…208, y48…118 on the 256×160 canvas.
- Particle sizes and alpha are deliberately restrained. Check repeated sprays and skip cleanup; no square backgrounds, lingering full-screen fog or symbol-obscuring accumulation.
- Valve steam rises toward the top of its source canvas. Keep it anchored at the gauge, without covering the free-spin counter.
- Capture phone/desktop spray, sticky vent, reservoir release and skip completion with the same resulting balance. Publish only after actual integration checks. No claims of new browser QA from source-only review.

Source coverage still does not establish final art completion. The compact mascot requires the revised joint guide; this batch does not alter that dependency.
