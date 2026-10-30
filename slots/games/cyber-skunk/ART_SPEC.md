# Cyber Skunk: art spec

> Spec by Claude; art by ChatGPT. The game design is in `DESIGN.md`. Commit each finished file to `games/cyber-skunk/art/` **under exactly the name below** as a PNG, and say which files are done in your handoff note. Claude converts the files for the game, rigs the mascot and wires everything in. Until your art lands, the game runs on Claude's neon placeholders, so you can drop files in any order.

## Look

- **AAA cartoon cyberpunk.** Bold cel shading, thick dark outlines (about 6 px at full size), saturated neon on deep night blues.
- **Palette anchors:** neon magenta `#ff2bd6`, cyan `#20f0ff`, toxic green `#7dff3a`, violet `#8a3cff`, gold `#ffc531`, night `#0b0f24`.
- **The skunk's stripe** is neon green, glowing.
- **Family resemblance.** The same line weight and shading on every asset.
- **Original only.** No real brands, logos or existing characters.

## Priority order

1. **The mascot's layered parts** (Claude needs time to rig them).
2. The symbols.
3. The logo.
4. The backgrounds.
5. The cabinet.
6. The Overdrive backgrounds and buy-screen cards.

## 1. Mascot: Static, the Cyber Skunk (rigged by Claude)

**The character.** A lean, cocky hacker skunk, about 1.6 heads to the shoulder (cartoon proportions). He wears:
- a cropped black tech jacket with magenta trim;
- a cyan visor over his eyes (a separate layer, so it can glow);
- fingerless gloves.

**The tail is the star.** It is a big fluffy skunk tail with chrome cyber segments. It curls up behind his back and over his shoulder, and ends in a **chrome spray cannon** with a glowing green muzzle pointing toward the reels.

**Pose and canvas.**
- **Pose:** a 3/4 view facing **right** (the reels are to his right on desktop). Standing, weight on the back leg, the front hand in a confident "finger guns" or open-palm gesture.
- **Canvas:** **1400 × 1800 px, transparent**, the same for every layer. Feet on y = 1740, body centred on x = 620. The tail and cannon fit inside the canvas, with the muzzle around (1180, 420).

**Rules for every layer:**
1. **Drawn in place.** Stacking all the layers in the order below at (0, 0) must reproduce `mascot/full.png` exactly.
2. **Complete behind occluders.** Draw each part whole, including what other parts hide: the torso behind the arms, the tail base behind the hips.
3. **Overlapping joints.** At every joint the child part ends in a rounded cap that reaches about 40 px under its parent: shoulders under the jacket, the elbow cap under the upper arm, the wrist under the forearm, hips under the jacket, knees under the thigh, each tail segment under the one before it. Never end a moving part exactly at a visible edge.
4. **Nothing baked in.** No glow, shadow, ground or background on any layer. Claude adds the glow.

**Layers, back to front** (folder `mascot/`):

| # | File | What |
| --- | --- | --- |
| 1 | `tail-1.png` | Tail base: from under the jacket at the lower back, fluffy. |
| 2 | `tail-2.png` | Middle tail segment (chrome ring at each end). |
| 3 | `tail-3.png` | Upper curl over the shoulder. |
| 4 | `tail-cannon.png` | The chrome spray cannon at the tail tip, muzzle toward the reels. |
| 5 | `arm-back-upper.png` | Far arm: shoulder to elbow. |
| 6 | `arm-back-fore.png` | Far forearm: elbow to wrist. |
| 7 | `hand-back.png` | Far hand. |
| 8 | `leg-back-thigh.png` | Far thigh. |
| 9 | `leg-back-shin.png` | Far shin. |
| 10 | `foot-back.png` | Far sneaker. |
| 11 | `torso.png` | Chest, jacket, belly and hips (pelvis included). |
| 12 | `leg-front-thigh.png` | Near thigh. |
| 13 | `leg-front-shin.png` | Near shin. |
| 14 | `foot-front.png` | Near sneaker. |
| 15 | `ear-back.png` | Far ear. |
| 16 | `head.png` | Head without the far ear, near ear, jaw or visor. Neck cap under the jacket collar. |
| 17 | `jaw.png` | Lower jaw and mouth (closed grin), so he can talk and laugh. |
| 18 | `visor.png` | The cyan visor. |
| 19 | `ear-front.png` | Near ear. |
| 20 | `arm-front-upper.png` | Near arm: shoulder to elbow. |
| 21 | `arm-front-fore.png` | Near forearm. |
| 22 | `hand-front.png` | Near hand (the gesture). |
| — | `full.png` | Every layer above, flattened (the reference). |
| — | `pivots.json` | Your best guess at each joint centre on the canvas, e.g. `{"arm-front-upper":[700,760], "arm-front-fore":[820,980], …}`: the point each part rotates around (shoulder, elbow, wrist, hip, knee, ankle, neck, ear root, jaw hinge, tail joints). Claude will refine it. |

## 2. Symbols (folder `symbols/`)

**Format:** **512 × 512 px, transparent.** The art fills about 440 px, centred. No glow (Claude adds it) and no cell background (the reels have one).

| File | Symbol |
| --- | --- |
| `h1-skunk.png` | Static's portrait, head and shoulders, in a **gold** hex badge frame (top pay). |
| `h2-raccoon.png` | A raccoon netrunner with headset and goggles, in a **magenta** frame. |
| `h3-possum.png` | A possum courier with helmet and backpack, in a **cyan** frame. |
| `h4-rat.png` | A rat drone pilot with goggles and a tiny drone, in a **green** frame. |
| `a.png` `k.png` `q.png` `j.png` `ten.png` | Neon-tube sign letters A, K, Q, J, 10, each its own colour (violet, cyan, magenta, orange, green), on a dark chip. |
| `wild.png` | A graffiti spray tag reading **WILD**, magenta and green, with drips. |
| `wild-spray.png` | The same tag freshly sprayed: wet, glowing, with paint splatter. It marks the cells the beam paints. |
| `prism.png` | A chrome triangular prism block whose mirror face runs **bottom-left to top-right (`/`)**, with neon cyan edges. Claude rotates it for `\`. |
| `badge.png` | The scatter: a neon **skunk-head emblem** badge, glowing green and magenta. |

## 3. Logo

`logo.png`: **"CYBER SKUNK"** as a neon and chrome title with a small skunk-tail swoosh. **1600 × 560 px, transparent.**

## 4. Backgrounds

| File | Size | Scene |
| --- | --- | --- |
| `bg-desktop.png` | 2560 × 1440 | Rainy neon alley in Neo-Musk City at night: wet street reflections, holographic billboards, fire escapes, steam. The centre and right stay calm and darker (the reels go there); the left third is open floor where Static stands. |
| `bg-mobile.png` | 1080 × 2340 | The same scene, portrait. The upper third is open for Static and the logo, and the middle is calm for the reels. |
| `bg-overdrive-desktop.png` | 2560 × 1440 | The same alley, cranked up: magenta and red alarm light, glitch billboards, sparks. For Free Spins. |
| `bg-overdrive-mobile.png` | 1080 × 2340 | The same, portrait. |

## 5. Reel cabinet

`cabinet.png`: **1400 × 1240 px, transparent.**
- **The window:** fully transparent at **x 160 to 1240, y 140 to 1040** (1080 × 900, six reels of 180 px, five rows of 180 px).
- **The frame:** chrome and dark metal with neon tube trim (cyan and magenta), small rivets, a graffiti-tagged plate along the bottom, and cable bundles on the sides.
- **Inside the window:** nothing; the game draws the reel backing.

## 6. Buy screen and extras

| File | Size | What |
| --- | --- | --- |
| `buy-boost.png` | 720 × 480 | Spray Boost card art: the spray cannon overcharging, green energy. |
| `buy-overdrive.png` | 720 × 480 | Overdrive card art: a beam bouncing between three prisms. |
| `buy-super.png` | 720 × 480 | Super Overdrive card art: a gold-tinted maze of prisms, with Static grinning. |
| `splash-overdrive.png` | 1600 × 900 | Bonus intro title "OVERDRIVE": neon, transparent background. |
| `splash-super.png` | 1600 × 900 | Bonus intro title "SUPER OVERDRIVE": gold and neon, transparent. |

## Also yours

- **`theme.json`:** palette, fonts (open-licence fonts only; Claude bundles them) and symbol names.
- **`STYLE.md`:** the look in a few lines.
- **Copy:** feature names and rules wording; Claude will send the draft rules for your polish.
