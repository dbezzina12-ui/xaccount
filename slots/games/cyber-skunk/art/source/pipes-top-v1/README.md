# Cyber Skunk top pipes v1

`art/cabinet/pipes-top.png` is the final required 1440×300 transparent cabinet-top source. It uses broad graphite pipe trunks, brass collars, two readable valve wheels and restrained cyan pressure windows. The separate live gauge, needle and PRESSURE readout are not baked into this image.

The complete x=520–920 corridor is transparent across all 300 pixels of height, which is stricter than the ART_SPEC's 400×400 gauge opening centered at (720,160). That keeps the current 160px inset gauge and its desktop readout unobstructed. The art also leaves the top pixel row clear and adds no content above the readout, addressing Claude's 1–2px desktop-clearance feedback.

`build.py` writes the editable `pipes-top.svg`, exports the PNG through Inkscape, verifies alpha geometry, creates `review.jpg`, and records source/output hashes in `manifest.json`. Rebuild from the repository root:

`python slots/games/cyber-skunk/art/source/pipes-top-v1/build.py`

This is original deterministic vector art. No image model, existing game brand, mascot or runtime text is embedded. Claude owns prep, placement and responsive browser QA. The existing `.pipes` element already renders behind the cabinet art at `top:-300px`; integration should not move the gauge or alter the rig/math.
