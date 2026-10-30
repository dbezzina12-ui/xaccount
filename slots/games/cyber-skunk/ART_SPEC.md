# Cyber Skunk: art spec v3 (contract)

> Spec by Claude; art by ChatGPT. **Follows ChatGPT's `STYLE.md` and style frame** (`art/inbox/cyber-skunk-style-v1.webp`): its palette, its mascot, its symbols and its cabinet language. The rules are in `DESIGN.md`.
>
> Commit each finished file to `games/cyber-skunk/art/` under exactly the name below, as a PNG with alpha. Say in your handoff note which files are done. Claude converts the files, rigs the mascot and wires everything in. Until then the game runs on Claude's placeholders, so files can arrive in any order.

## Priority order

1. **Mascot layers (§1).** Claude needs rig time.
2. **Symbols, vent, wild and scatter (§2).**
3. **Cabinet and gauge (§3).**
4. **Logo and backgrounds (§4).**
5. **Bonus panels and buy cards (§5).**
6. **Win titles and gameplay effects (§6, §7).** New in v3: the splat, the pressure tag and the win titles show on every spray and every big win.
7. **Intro screen, controller texture and icon (§8).** New in v3.

## 1. Mascot: rig contract (Claude rigs and animates)

**Registration:**
- **Canvas:** **1600 × 2000 px, transparent**, identical for every layer. Every layer is drawn **in place**: stacking them in the order below at (0, 0) reproduces `mascot/full.png`.
- **Baseline:** soles on y = 1880.
- **Guide:** `art/rig/guide-v1.jpg` shows the pose, scale and every joint. `art/rig/pivots.json` is authoritative: each part's pivot (the point it rotates around), its parent and its draw order. Paint to the guide. If you need a joint moved, say so in your note and Claude updates the guide first.

**The pose (rest).** Your style-frame skunk, standing free beside the reels rather than leaning on the cabinet:
- **Body:** a 3/4 view facing **right** (toward the reels); weight on the far leg, boots planted on the floor grill.
- **Near arm (the brass gauntlet):** hand on the hip, as in the frame.
- **Far arm:** relaxed, the elbow out, an open hand toward the reels (the guide's re-posed far arm).
- **Tail:** curls up behind the body; its tip ends near the shoulder, pointing right.
- **Tail tip:** a small brass **pressure nozzle** (a separate layer), aimed right.

**The spray (the key animation).** The tail swings up and over the shoulder until the nozzle points at the reels: the cyan line in the guide. So the tail is **4 overlapping fur segments**, each a fluffy cylinder whose ends tuck under the previous segment. Every segment must still look right turned **±35°** around its pivot.

**Rules for every layer:**
1. **Complete behind occluders.** Draw each part whole, including what other parts hide: the torso under the arms, the tail root behind the hips, the hip behind the hand.
2. **Overlapping joints.** At every joint the child ends in a rounded cap reaching **at least 40 px** (and at least 10% of the limb's width) under its parent at rest. Never end a moving part exactly at a visible edge.
3. **Separate occluders.** The **pauldron** (near shoulder plate) and **cuff** (gauntlet wrist ring) are separate front layers, so the joints underneath can turn.
4. **Nothing baked in.** No glow, shadow, ground, steam or background on any layer. Claude adds them.
5. **Same style** as the style frame: painted, dimensional, phone-readable silhouette.

**Layers, back to front** (folder `mascot/`; the pivots are in `pivots.json`):

| # | File | Part | Pivot (joint) |
| --- | --- | --- | --- |
| 1 | `tail-1.png` | Tail root segment, from under the hips | tail_root |
| 2 | `tail-2.png` | Tail segment 2 | tail_1 |
| 3 | `tail-3.png` | Tail segment 3 | tail_2 |
| 4 | `tail-4.png` | Tail tip segment | tail_3 |
| 5 | `nozzle.png` | Brass pressure nozzle at the tail tip | tail_tip |
| 6 | `far-upper-arm.png` | Far arm: shoulder to elbow (black sleeve) | far_shoulder |
| 7 | `far-forearm.png` | Far forearm | far_elbow |
| 8 | `far-hand.png` | Far open hand, black glove | far_wrist |
| 9 | `far-thigh.png` | Far thigh (cargo trousers) | far_hip |
| 10 | `far-shin.png` | Far shin | far_knee |
| 11 | `far-boot.png` | Far boot | far_ankle |
| 12 | `torso.png` | Chest, cropped jacket, top, belt, pouches and pelvis | pelvis |
| 13 | `near-thigh.png` | Near thigh | near_hip |
| 14 | `near-shin.png` | Near shin | near_knee |
| 15 | `near-boot.png` | Near boot | near_ankle |
| 16 | `head.png` | Head and crest with the far ear, without jaw, eyelids, goggles or near ear; neck cap under the collar | neck |
| 17 | `ear.png` | Near ear | ear |
| 18 | `jaw.png` | Lower jaw and mouth (sly closed grin) | jaw |
| 19 | `eyelids.png` | Upper eyelids only, drawn closed (for blinks) | neck |
| 20 | `goggles.png` | Amber welding goggles on the forehead | neck |
| 21 | `near-upper-arm.png` | Near arm: shoulder to elbow | near_shoulder |
| 22 | `near-forearm.png` | Near forearm with the brass gauntlet | near_elbow |
| 23 | `near-hand.png` | Near hand on the hip | near_wrist |
| 24 | `near-cuff.png` | The gauntlet's wrist ring (occluder) | near_wrist |
| 25 | `near-pauldron.png` | Brass shoulder fitting (occluder) | near_shoulder |
| — | `full.png` | Every layer above, flattened (the reference) | — |

## 2. Symbols and overlays (folder `symbols/`)

**Format:** **512 × 512 px, transparent**, art filling about 440 px. No glow and no cell backing; the reels draw the backing.

| File | Symbol |
| --- | --- |
| `h1-battery.png` | H1: amber battery, top pay |
| `h2-rotor.png` | H2: ventilation rotor |
| `h3-canister.png` | H3: cyan plasma canister |
| `h4-key.png` | H4: circuit key |
| `a.png` `k.png` `q.png` `j.png` `ten.png` | L1–L5: A, K, Q, J, 10 in clean ivory, on a dark plate |
| `wild.png` | W: the skunk-stripe badge with **WILD**. It is also how a sprayed cell looks; Claude adds the cyan spray. |
| `scatter-plate.png` | S: the plate behind the big **FS** |
| `scatter-letters.png` | S: the **FS** lettering alone, crisp, on the same canvas (it animates separately) |
| `vent.png` | **The elbow vent overlay** (not a symbol: it sits on top of one). A brass and steel elbow pipe, **inlet on the left edge, outlet pointing up**, with a cyan glow inside the mouth. Claude rotates it for the other three outlets and draws the steam. It must read at 120 px. |

## 3. Cabinet and gauge (folder `cabinet/`)

- **`cabinet.png`, 1440 × 1060 px.** The frame from your style frame: front-on, parallel edges, matte graphite, strong bevel, brass inner lip and amber side lights.
  - **The reel window** is fully transparent at **x 120 to 1320, y 130 to 930**: 6 reels × 4 rows of 200 px.
  - **The bottom band**, y 950 to 1060, is a blank control shelf. Claude draws the controls onto it, so leave no buttons in the art.
  - The game scales the cabinet uniformly on every screen and never stretches it.
- **`gauge-face.png`, 400 × 400 px.** The round pressure gauge for the top of the cabinet: dial from 0 to 10, with a red zone at 7 to 10.
- **`gauge-needle.png`, 400 × 400 px.** The needle alone, pointing straight up, with its pivot at the centre (200, 200). It shows the bonus Reservoir.
- **`pipes-top.png`, 1440 × 300 px.** The pipes, valve and gauge mount rising from the cabinet's top edge. Leave a 400 × 400 hole for the gauge, centred at (720, 160).

## 4. Logo and backgrounds

| File | Size | What |
| --- | --- | --- |
| `logo.png` | 1600 × 560 | **CYBER SKUNK**, as in your frame |
| `bg-desktop.png` | 2560 × 1440 | The industrial vent hall. Quiet in the centre and right, where the cabinet goes; open floor grill on the left for the mascot. |
| `bg-mobile.png` | 1440 × 2560 | The same hall, portrait. Space at the top for the logo and the mascot's upper body; quiet in the middle for the cabinet. |
| `bg-bonus-desktop.png` | 2560 × 1440 | The same hall during the bonuses: the vent fans spinning, cyan pressure light. Claude tints it per tier. |
| `bg-bonus-mobile.png` | 1440 × 2560 | The same, portrait |

## 5. Bonus panels and buy cards

| File | Size | What |
| --- | --- | --- |
| `panel-vent-break.png` | 1600 × 900 | Bonus entrance title art "VENT BREAK", transparent |
| `panel-overpressure.png` | 1600 × 900 | "OVERPRESSURE" |
| `panel-blackout.png` | 1600 × 900 | "BLACKOUT PROTOCOL": dark, with a single cyan pulse |
| `card-signal-boost.png` | 720 × 480 | Buy screen: Signal Boost (enhanced spins) |
| `card-spray-job.png` | 720 × 480 | Buy screen: Spray Job (feature spins) |
| `card-vent-break.png` | 720 × 480 | Buy screen: Vent Break |
| `card-overpressure.png` | 720 × 480 | Buy screen: Overpressure |

The text on the panels and cards is art. Prices and counts stay live text, which Claude draws.

## 6. Win titles and banners (folder `wins/`), new in v3

Transparent wordmarks in the logo's industrial lettering. The amounts stay live text, which Claude draws under them.

| File | Size | What |
| --- | --- | --- |
| `win-nice.png` | 1600 × 560 | "NICE WIN": ivory and brass, the calmest of the five |
| `win-big.png` | 1600 × 560 | "BIG WIN": amber, a little heat |
| `win-epic.png` | 1600 × 560 | "EPIC WIN": amber with cyan pressure light bleeding through cracks |
| `win-mythic.png` | 1600 × 560 | "MYTHIC WIN": cyan-white, like the plasma canister |
| `win-max.png` | 1600 × 560 | "MAX WIN": the gauge's red zone; it shows once in millions of spins |
| `banner-extra-spins.png` | 1200 × 360 | "EXTRA SPINS" for a retrigger. The number (+4) is live text. |
| `title-total-win.png` | 1200 × 360 | "TOTAL WIN" on the bonus-complete panel |

**Escalation:** each tier is visibly bigger and hotter than the one before. All five share one letterform, so they read as a set.

## 7. Gameplay effects (folder `fx/`), new in v3

Transparent, centred, with soft edges and no background. Claude animates, scales and tints them; keep them restrained, so they never hide a symbol's identity.

| File | Size | What, and how the game uses it |
| --- | --- | --- |
| `fx-splat.png` | 512 × 512 | Cyan-white skunk-spray splat. It sits **behind** the wild badge on every sprayed cell, so a painted cell is obvious at a glance. Keep its middle 300 px calm: the badge sits there. |
| `badge-pressure.png` | 256 × 160 | Brass pressure tag (riveted plate, small gauge tick). The live "×2", "×5" number sits on it, in a vent cell's corner. |
| `vent-online.png` | 512 × 512 | Cyan glow ring around a vent that is live: sticky in a bonus, or lit in the Blackout opening. Draw a ring, not a disc; the vent shows through. |
| `fx-mist.png` | 256 × 256 | A soft cyan mist puff (spray particles). |
| `fx-droplet.png` | 64 × 64 | One droplet, cyan-white with a highlight (the jet's droplets). |
| `fx-spark.png` | 128 × 128 | A brass four-point spark (vent hits, the pressure going up). |
| `fx-steam.png` | 512 × 512 | A white steam burst from a valve (the Reservoir releasing at the gauge). |

## 8. Intro screen, controller texture and icon (folder `ui/`), new in v3

| File | Size | What |
| --- | --- | --- |
| `splash-desktop.png` | 1920 × 1080 | The opening screen, behind the intro: the hall, the skunk mid-spray, the cabinet glowing. Keep the **lower 40 % calm**; the intro cards and Play button sit there. |
| `splash-mobile.png` | 1080 × 1920 | The same, portrait. Keep the lower 45 % calm. |
| `intro-route.png` | 900 × 600 | Intro card 1, "BACKPRESSURE": a spray line running through two elbow vents on a small 4 × 3 board, cells it touches painted wild, the vents tagged ×2 and ×3. A diagram, so a phone player gets it in two seconds. |
| `intro-bonuses.png` | 900 × 600 | Intro card 2: three plates, for VENT BREAK, OVERPRESSURE and BLACKOUT PROTOCOL, with 3, 4 and 5 FS scatters under them. The plates carry no text; Claude labels them live. |
| `controller-texture.png` | 512 × 512 | **Seamless** tile: graphite brushed steel with faint brass rivets, for the phone controller's buttons and plate. Low contrast, so icons stay readable. |
| `icon.png` | 512 × 512 | App and tab icon: the skunk's head with the amber goggles, on graphite, readable at 32 px. |

