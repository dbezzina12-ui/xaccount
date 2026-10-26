# Desktop composition — 2026-10-26

Dylan requested the larger desktop cast and quieter graveyard shown in his supplied landscape reference.

- Desktop characters now follow board height (about 630 px visible at the 1787 × 880 reference viewport), with actual cutout bounds limiting the size to the available side lanes. The old 490 px stage-height cap is removed. Boots share a ground line just above the controller.
- Board width reserves room for the cast; the title clears the scythe. Narrow laptops fit all three without cropping the resting art or covering cells.
- New background: `runtime/assets/nightfall/background-desktop-v2.webp` (1774 × 887, 81,652 bytes). Quiet teal fog, small moon, distant graves/trees and a plain cobblestone floor. Original desktop asset retained for rollback; portrait uses its existing background and positioning.
- Claude's reaper/mage cutouts, bone transforms and animation timelines are unchanged. No math, odds, bonus or controller code changes.
- Runtime, CSS and adapter URLs are refreshed; settings identify `2026.10.26-DESKTOP`.

Validation: 110 existing tests pass. Browser review at 1787 × 880, 1364 × 938 and 390 × 844. Desktop art fits the side lanes; portrait retains its approved composition.

## Art generation

Created with the built-in image-generation tool using Dylan's supplied desktop reference. Full prompt:

Use case: stylized-concept. Asset type: background-only landscape game plate, 2048 x 1024 or equivalent 2:1 landscape. Input image is a reference for the background only. Recreate its quiet, simple dark teal-blue haunted graveyard and cobblestone foreground. Remove all foreground characters, scythe, staff, reels/board, symbols, logo, words, buttons, controller and UI entirely; fill the removed areas naturally with the same subdued background. The sky should occupy the top 82 percent, largely empty dark navy/teal soft mist, a small dim hazy moon in the upper right at x90% y11%, distant barely visible tombstones mostly at the far left/right lower sides, sparse bare crooked tree silhouettes at extreme left and right. Broad flat old blue cobblestone floor across the bottom 16 percent, horizontal horizon at about y84%, no central path perspective vanishing point. Keep central area simple and dark so a game board will stand out. Painterly hand illustrated game background matching the reference palette and line rendering, subdued low contrast. No castle, no house, no church, no gates, no jack-o-lanterns, no glowing windows, no dramatic rays, no huge moon, no bright lights. Only clean empty environment.

## Files

`runtime/nightfall-actors.js` (desktop placement only), `runtime/nightfall.css`, `runtime/index.html`, `runtime/app.js` (asset/cache/build labels only), `runtime/studio-adapter.js`, and the new background above.

