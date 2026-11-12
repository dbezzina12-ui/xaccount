# Bounty Breakers artwork

Original generated artwork, September 9, 2026. All three source images are included unchanged in dist/assets. Cropping is performed at display time. Exact generation prompts are recorded in art-prompts.json.

- bounty-environment.png: sci-fi frontier arena background.
- bounty-symbols.png: ten game symbols.
- bounty-portraits.png: opposing hunter and outlaw portraits.

The Gamboligy studio logo and licensed Barlow fonts were carried over from the owner’s Relic of Profit project. Font licenses remain in the font assets folder. Bounty Breakers now uses its own original synthesized chiptune / dubstep score; soundtrack provenance is in dist/assets/audio/NOTICE.txt and credits.json.

September 10 feature update: `dist/assets/duel-badge.png` replaces the VS text symbol with crossed orange/cyan pulse revolvers. `dist/assets/bounty-vault.png` replaces the scatter with an armored energy cache. Both are original 1254×1254 transparent PNGs, preserved unchanged. Exact prompts and source hashes are recorded in `dist/assets/feature-art-provenance.json`. Temporary Crossfire wilds use the existing bounty chip artwork with a purple treatment and a WILD label.

Reel duel update: `golden-w.png` is the ordinary and expanded-wild mark. `duel-fighters.png` contains the Hunter aiming down in its left panel and the Outlaw aiming up in its right panel; the panels are stacked within each reel in CSS. Source pixels are unchanged. Exact prompts and hashes: `dist/assets/reel-art-provenance.json`.

Boss update: `dist/assets/boss-fighter.png` is the original generated gold warlord (793×1983), used unchanged in the upper fighter position and resolved Boss reel. `boss-art-provenance.json` records the prompt and hash. The attempted electric badge raster was rejected because its transparency was baked as a checkerboard; the existing transparent crossed-pistol image is retained and receives an animated cyan frame, glow, and DUEL label in the interface.

Title update: `dist/assets/bounty-breakers-title.png` is the original 1921×819 transparent generated game logo, used unchanged in the header and intro. Gold BOUNTY, cyan BREAKERS, a fractured badge and restrained bullet details tie it to the duel artwork. Its sibling prompt and provenance files record the single generation and source hash.

Bonus shop update: `bonus-showdown.png`, `bonus-last-stand.png`, and `bonus-mystery.png` are three original 1254×1254 RGB game illustrations, used unchanged. They show exactly three amber vaults, four cyan vaults, and one purple vault with a question mark, respectively. The same illustrations appear on the bonus introductions. `bonus-art-provenance.json` records original paths, prompts and hashes. The images are fitted with contain, with no destructive crop or pixel edits.

Cel symbol update, September 10: `cel-premium-atlas.png` (1254×1254, 2×2) contains Hunter, pulse revolver, energy blade and bounty chip. `cel-duel-letter-atlas.png` (1254×1254, 2×2) contains D/U/E/L. `cel-feature-atlas.png` (2172×724, 3×1) contains crossed revolvers, a golden W and an open vault with large SCATTER lettering. All three original rasters are preserved byte-for-byte and sliced into equal cells in CSS. They replace the earlier symbol artwork on reels, in the paytable, in the feature guide and on the two feature-spin cards; the three bonus purchase illustrations remain. `dist/assets/cel-art-provenance.json` records prompts, references, source hashes, cell bounds and source-image inspection. The opaque navy backgrounds contain subtle variation. No raster editing or post-processing was performed.

October 9 environment update: `scene-v107/spaceport-desktop.webp` and `spaceport-mobile.webp` are generated comic frontier spaceport plates, color/light matched to the existing Hunter and Outlaw. They retain the blue canyon and orange moon, with closer metal/wood porches, amber left-side lamps and cyan right-side machinery. WebP encoding only, no crop or resize. Scene integration adds silhouette-projected ground shadows, preserves per-boot contact shadows, and places restrained drifting haze over the feet. Existing Spine actor animation and gameplay are unchanged. Provenance: `dist/assets/scene-v107/provenance.json`.

Frontier ink edition: the cabinet uses custom vector lettering and nine-slice rails; the D/U/E/L ranks are a transparent vector atlas. Four newly illustrated premium symbols share one transparent WebP atlas. The landscape and portrait spaceports were illustrated separately for their respective framing. The VS, vault, and Wild illustrations carry through reels, shop, guide, and bonus entry; the VS and vault rig textures retain their previous registration and timings. The four win tiers use new transparent badges. The original duel footage, character animation, controller, soundtrack and outcome data are retained. See dist/assets/frontier-ink/ and dist/assets/wins/ink-*.webp.

Cosmic Clash — Foundry lettering. The cabinet and guide use a custom geometric wordmark in ivory titanium and amber. The large FS letters have separately lit bevels and extrusion faces; the vault uses gunmetal, brass hardware and a teal interior. The masters and registered native Spine pages are generated by scripts/build-foundry-art.py. The skeleton, animation clips and VS art are unchanged.

Cabinet rework: Foundry shell with wide gunmetal sidewalls, brass edge strips, reinforced corners and a recessed continuous reel bed. Its source is scripts/build-foundry-cabinet.py. The old bottom status row has no layout space; routine status and line details are now assistive announcements, while failures use a dismissible error dialog. The Foundry title, FS rig and animated VS assets remain unchanged.
