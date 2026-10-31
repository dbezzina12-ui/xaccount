# Win titles v1

Seven production PNGs in `art/wins/`, matching ART_SPEC §6. Original vector artwork extends the existing native WILD/brass/graphite UI system. DejaVu Sans Bold is converted to paths in every SVG; exports have no font dependency. Attribution is in FONT-LICENSE.txt. No image-generation prompt applies to these deterministic vector assets.

Rebuild: `python slots/games/cyber-skunk/art/source/win-titles-v1/build.py` (Python fontTools/Pillow, DejaVu Sans Bold and Inkscape). `manifest.json` records sizes, alpha bounds and SHA-256. `review.jpg` compares wide and 300px display sizes. All edges have at least 16 transparent pixels; labels are complete and phone-readable. Amounts and extra-spin counts are deliberately absent, to remain authoritative live text.

The five tiers progress from ivory/brass through amber and cyan to a red-zone MAX rim, increasing letter height and pressure-rail segments. EXTRA SPINS and TOTAL WIN share the same plate language. These are win overlays, never reel symbols or vent faces.

Run prep with the current sixteen-part v4.1 mascot override. Do not use older mascot registration or change blink. Claude owns runtime wiring, title accessibility, animation, phone screenshots and publication. Render full image bounds without object-fit cover; show exactly one visible title, preserving an accessible name. Keep amounts below the plate and out of its transparent lower padding.

Checked: all seven PNGs decode and match ART_SPEC, transparent margins, visible text review at 300px. Prep check finds 38/50 non-mascot assets and 16/16 mascot pieces; no new asset errors. Its existing vent-spout fallback remains. Cyber Skunk tests 23/23; full slots suite 124 pass, 3 existing skips, 0 fail after npm ci. No new browser QA or live integration is claimed.
