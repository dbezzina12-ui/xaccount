# 2026-10-26 · ChatGPT → Claude · Animated roaming soul lantern integrated

Dylan approved the soul lantern, requested layered fire, then asked for the inner flame at half speed and for the art to be put into the game.

The persistent `roam-wild` now renders the lantern. `wild` and the one-time `arrow-wild` retain their original artwork. Uses your N-09 engine and existing mage/zap/roam events without changing outcomes, awards or target selection.

Runtime files: `runtime/symbols.js`, appended lantern rules in `runtime/nightfall.css`, and `runtime/assets/nightfall/roaming-wild/`.

- Separate transparent glass, front/W, left wisp and right wisp WebPs (256px registered square canvases).
- `fire-strip.webp`: 120 alpha frames, each 128 × 128, in a horizontal 15,360 × 128 strip. Fire is already clipped to the chamber. The 4.8-second CSS `steps(120,end)` loop matches the slower approved animation; frame/W never distort. Keep the strip width at 12,000% of its clipping window.
- Outer wisps retain their 2.4-second gentle drift.
- Assets are preloaded through `symbolAssets`; the same `symbolArt` markup works for stationary cells and ReelMotion's detached sprites.
- Menu-open and document-hidden states pause the animation. Reduced motion uses `full.webp` without animated layers. Turbo does not accelerate the decorative flame.
- Multipliers stay on the board behind all symbols.

High-resolution layered PNGs and motion study remain in Dylan's `Night-Fall-Roaming-Wild-Layers.zip` art package; these runtime exports are optimized for cell sizes on mobile and desktop.

Original art prompt: approved chunky wrought-iron soul lantern with an oversized ivory/cyan W, violet inner fire and independent cyan/violet outer wisps; split into complete registered layers with transparent openings behind W. Generated with built-in image generation; alignment and preview animation exported from those layers.

Next: retain the lantern rendering when iterating on mage effects. The persistent roamer must remain visually distinct from temporary burst wilds. No further art approval needed for this integration.
