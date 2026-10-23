# Game 001: art spec

Owner: Claude writes this spec; ChatGPT makes the art. Theme: **not chosen yet** (see `collab/DECISIONS.md`).

Sizes match what ChatGPT's image tool outputs natively, so nothing needs resizing. Larger images at the same aspect ratio are fine. Exact file names only matter once Claude places them; drops into `art/inbox/` can have any name.

## What the engine already does (don't paint it)

The engine animates **static** PNGs: spin motion blur, landing bounce, win pulse and glow outline (traced from your alpha edge), light sweeps, coin/sparkle particles, payline drawing, the x2/x3/x5 multiplier badges, banner entrances, screen shake, and the counters and text in the HUD.

So: **one still image per item. No sprite sheets, no animation frames, no UI, no numbers.**

## Symbols: 11 files, `art/symbols/<ID>.png`

**1024×1024, transparent background**, one subject, centered, filling about 85–90% of the canvas. Front-on, same lighting (top-left key light) and the same rendering style across all 11. Glow or soft shadow is fine if it stays inside the canvas.

| ID | Tier | Pays (5 / 4 / 3 of a kind, × bet) | Brief |
|---|---|---|---|
| `H1` | top | 100 / 20 / 5 | Most valuable thing in the theme. Richest detail, warmest color. |
| `H2` | high | 50 / 12.5 / 3 | |
| `H3` | high | 25 / 7.5 / 2.5 | |
| `H4` | high | 15 / 5 / 2 | Least of the highs, still clearly "premium" next to the lows. |
| `L1` | low | 10 / 3 / 1.25 | Lows: simpler and smaller-feeling. Card ranks (A K Q J 10) styled to the theme, or five small theme icons. |
| `L2` | low | 7.5 / 2.5 / 1 | |
| `L3` | low | 6 / 2 / 0.75 | |
| `L4` | low | 5 / 1.5 / 0.6 | |
| `L5` | low | 4 / 1.25 / 0.5 | |
| `W` | wild | substitutes | Must read **WILD** at a glance (the word may be in the art). **Keep the top-right quarter free of important detail**: the engine draws the multiplier badge there in free spins. |
| `S` | scatter | 3+ anywhere = free spins | The most eye-catching symbol. May carry the word **BONUS** or **FREE SPINS**. |

Readability test: all 11 must be distinguishable at **96×96 px**, by silhouette and by color. Avoid two symbols sharing a dominant hue.

## Backgrounds: 4 files, `art/`

Opaque, **no text, no UI, no reels or frames** (the engine draws the reel panel).

| File | Size | Use |
|---|---|---|
| `bg-base.png` | 1536×1024 | Desktop/landscape, base game |
| `bg-free.png` | 1536×1024 | Desktop/landscape, free spins (same place, more intense: night, powered up, stormy…) |
| `bg-base-portrait.png` | 1024×1536 | Phones, base game |
| `bg-free-portrait.png` | 1024×1536 | Phones, free spins |

Composition, because the reel panel sits on top:

- **Landscape:** the reel panel covers the center, about 64% of the width and 66% of the height, sitting slightly low. Keep that area simple and darker, and put the scenery in the outer ring, especially the left and right edges and the top. The top and bottom ~5% may be cropped on wide screens.
- **Portrait:** the reels span the full width from ~28% to ~58% of the height. The top ~25% is behind the logo. The bottom ~20% is behind the control bar. The outer ~15% at the left and right may be cropped on tall phones.

## Logo and banners: 6 files, `art/`

**1536×1024, transparent background**, wordmark only (the engine trims empty space). Bold, high contrast, readable at 300 px wide. Wide shapes (about 3:1) fit best.

| File | Text |
|---|---|
| `logo.png` | The game's name |
| `banner-free-spins.png` | FREE SPINS |
| `banner-big-win.png` | BIG WIN |
| `banner-mega-win.png` | MEGA WIN |
| `banner-epic-win.png` | EPIC WIN |
| `banner-max-win.png` | MAX WIN |

## Particle: 1 file

`art/fx-coin.png`: **1024×1024, transparent**. One coin or token (or a gem or ember, whatever fits the theme), front-on. It's used for coin showers, rendered at 20–60 px and spun around its vertical axis, so it should be simple and round-ish.

## Skin: `theme.json` (ChatGPT edits directly or sends the values)

- `title`: game name.
- `palette`:
  - `bg`: page color.
  - `panel`: reel window fill, semi-transparent.
  - `frame`: reel frame.
  - `accent`: wins, glows, spin button.
  - `accent2`: bonus and free spins, buy button, anticipation.
  - `text`, `muted`.
- `fonts.display` + `googleFonts`: one Google Font for headings and numbers. Pick something chunky that's legible as digits.
- `symbolNames`: e.g. `"H1": "Dragon Egg"`. Used in the paytable.
- `symbolScale`: optional per-symbol size tweak (default 0.9 of the cell).
- `glow`: optional per-symbol glow color.
- `winTiers[].label`: the banner wording. Thresholds stay as set.
- `strings`: on-screen copy (plaque line, feature intro lines).

## Order of work

1. Three theme concepts, then Dylan picks one.
2. One **style frame**: a 1536×1024 mockup of the full game screen in the chosen theme (background, logo, 5×3 reels with symbols in place). Dylan approves the look, and it becomes the reference for everything after.
3. Symbols (all 11 in one pass, so the style stays consistent).
4. Backgrounds (base, free, both orientations).
5. Logo, banners, coin, `theme.json` values.

Progress check, any time: the ⓘ panel in the game lists every file as delivered (✓), missing (·), or needing a transparent background (!). `art/REPORT.md` has the same list.
