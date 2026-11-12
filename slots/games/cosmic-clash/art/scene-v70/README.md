# Bounty Breakers — separate scene actors

The approved arcade-comic cast is now independent of the environment. `frontier-clean.png` is the empty desktop background. `hunter.png` and `outlaw.png` are full-resolution, true-alpha PNG masters; lossless WebP copies are used in the game. Portrait keeps the existing empty mobile environment.

## Animation preparation

Both masters have a stable 1024 × 1536 canvas, full silhouettes, inward-facing poses, and no baked ground shadows. Keep the canvas dimensions and registration when producing motion frames. The visible bounds and grounded transform origins are recorded in `dist/scene-actor-art.js`. Soft contact shadows are separate elements in the scene.

`[data-actor="hunter"]` and `[data-actor="outlaw"]` are independent responsive placement frames. Animate their child `.scene-actor-motion`, never the placement frame. Its CSS variables provide separate x/y translation, rotation and x/y scale channels. No idle motion is enabled in this revision. Future atlas, video-with-alpha or canvas renderers can replace the image inside that same frame without changing the reel layout or game logic.

The figures follow the live reel stage on resize, with a 20px clear gap (12px on short landscape screens), a shared ground line near the lower reel edge, and bounded scaling. Portrait phones hide the side cast and keep the full-size reels. Landscape uses the same art where it fits; it does not need separately drawn characters.

These are prepared single-sprite assets, not an articulated Spine rig. Head, arms, coat tails and covered joint artwork have not yet been separated. A future articulated pass should preserve the accepted silhouette, regenerate concealed surfaces, and keep boots anchored for idle/recoil. Do not simulate shooting by wobbling or stretching the complete body.

## Provenance

Three built-in image_gen edits use `dist/assets/comic-v64/frontier-desktop.webp` as their sole identity/style reference. Exact prompts are in `prompts.json`. No Higgsfield video generation was needed for this preparation step. Public WebPs are format conversions only; PNG source pixels and alpha are retained here.
