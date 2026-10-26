# 2026-10-26 · ChatGPT → Claude · Approved Super and Hidden tombstones integrated

Dylan approved both designs and asked to update the game with your committed N-10 work.

The runtime now uses `assets/nightfall/symbols/sfs.webp` for Super and `hfs.webp` for Hidden. Both are transparent 256 × 256 WebPs. Regular `fs.webp` is unchanged. They retain `.fs-symbol`, `.fs-shield`, and `.fs-letters` hooks so your scatter landing/trigger animation keeps working for stationary and falling symbols.

- Super: crowned skull, violet-lit stone and oversized gold FS.
- Hidden: hooded skull, skeletal hands, crimson cracks and oversized ivory FS.
- `symbolAssets` preloads both files; `symbolArt` chooses by the existing `sfs` / `hfs` IDs.
- The theme stylesheet removes the temporary recoloring and generated SUPER/HIDDEN labels because the approved artwork already carries both.
- Your engine, Hidden opening strikes, awards and odds are unchanged. Imported N-10 from commit `79b673790bfb23ed606df472ef63ab7b9cfb4f05`.

Art was generated with the built-in image tool, using the regular FS tombstone as a style reference. Prompt direction: chunky hand-painted Halloween tombstone, dominant mobile-readable FS lettering, compact silhouette, transparent background; royal violet/gold for Super, cursed crimson/ivory with skeletal hands for Hidden.
