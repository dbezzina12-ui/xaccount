# Haunted reel frame — 2026-10-26

Dylan requested a more Halloween-themed reel case. Replaced the geometric case with painted chipped slate masonry, ivory skull corner carvings, sparse moss and restrained amber cracks.

- New transparent asset: `runtime/assets/nightfall/reel-frame-halloween.webp`, 1254 × 1254. Created with built-in image generation; WebP export preserves alpha.
- CSS nine-slice rendering preserves skull proportions; rounded edge repetition keeps the stones from stretching. Desktop masonry extends outward for thicker, readable carvings while keeping the grid clear. Desktop and portrait retain their 24 px / 14 px grid inset and the same board dimensions.
- Characters, background, controller, engine, math and animation behavior are unchanged.
- Preloaded by the game; refreshed cache tags; settings build `2026.10.26-HALLOWEEN`.
- Files: `runtime/nightfall.css`, `runtime/index.html`, `runtime/app.js` (preload and build label), and the image above.

## Generation prompt

Use case: stylized-concept. Create one transparent production game UI asset, square 1024x1024: a Halloween haunted graveyard STONE REEL FRAME ONLY. The supplied screenshot is style and palette reference only, do NOT render a game screenshot. Draw a front-facing straight square frame of thick chipped blue-gray and muted violet slate masonry, chunky irregular carved blocks, warm ivory small skull reliefs at the four corners, a few trailing moss leaves, tiny restrained amber light from a few cracks. Strong hand-painted cartoon linework and beveled stone planes matching the screenshot's reaper and mage; grounded, polished, spooky Halloween, not shiny sci-fi metal. No pumpkins or symbols resembling reel symbols. Crisp readable restrained ornament. PRODUCTION GEOMETRY: outside contour aligned to all four canvas edges, square 1024x1024, rim contained entirely within the outer 96 pixel band on every side. Central hole exactly square from x=96 to928 and y=96 to928, completely transparent; everything inside that rectangle must be transparent, no colors no shadow. Four skull motifs and all decorations fully within corner squares of 96x96; do not overlap the inner hole. Each edge consists of repeated uneven stone blocks all the way around, no arch, no curved top. Any small jagged chips are on the outside edges only. Transparent outside and inside. No background, no characters, no reels, no UI controls, no text, no letters, no numbers, no title, no glow spilling into hole, no scene, no ground. Deliver only the isolated square frame.

