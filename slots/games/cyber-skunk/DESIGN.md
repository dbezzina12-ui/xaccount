# Cyber Skunk: game design

> Dylan, 2026-10-30: "a good slot game idea that has never been done before. Needs to have correct math not max win all the time." The full game is due in 24 hours. Claude owns the mechanics, math, engine, rig and audio; ChatGPT owns art, names and copy (`ART_SPEC.md`). Propose changes in a handoff note.

## The pitch

Neo-Musk City is a rain-soaked neon alley at night. **Static, the Cyber Skunk**, is a hacker skunk with a chrome cyber-tail that ends in a spray cannon. His signature move is the **Ricochet Spray**: a neon beam he fires into the reels, which bounces off mirror Prisms and paints everything it crosses into Wilds. The new idea is the beam itself:
- **Path.** It follows real mirror physics.
- **Multiplier.** It grows with every bounce.
- **Free Spins.** The Prisms stay, so the board becomes a maze the beam has to find its way through.

## Grid and pays

- **Board:** 6 reels × 5 rows, **15,625 ways**. Symbols pay left to right on adjacent reels from reel 1, 3 to 6 of a kind.
- **Pays:** `pay × number of ways`, in multiples of the base bet. Every pay is a whole 0.1×, so every win is too, as Stake Engine requires.
- **Max win:** a round stops paying at **10,000×** the base bet.

| Symbol | 3 | 4 | 5 | 6 |
| --- | --- | --- | --- | --- |
| H1 Cyber Skunk (gold) | 0.5 | 1.5 | 4 | 10 |
| H2 Raccoon netrunner | 0.4 | 1 | 2.5 | 6 |
| H3 Possum courier | 0.3 | 0.8 | 2 | 4 |
| H4 Rat drone pilot | 0.2 | 0.6 | 1.5 | 3 |
| A | 0.1 | 0.3 | 0.8 | 1.5 |
| K | 0.1 | 0.3 | 0.6 | 1.2 |
| Q | 0.1 | 0.2 | 0.5 | 1 |
| J | 0.1 | 0.2 | 0.4 | 0.8 |
| 10 | 0.1 | 0.2 | 0.3 | 0.6 |

**Special symbols:**
- **WILD (spray tag):** substitutes for every paying symbol.
- **PRISM `/` and `\`:** an angled chrome mirror. It pays nothing and blocks ways until the beam hits it.
- **SKUNK BADGE:** the scatter. It lands at most once per reel.

## Ricochet Spray

1. **When it fires.** If at least one Prism lands, Static fires. The beam enters from the left edge on the row of the **left-most Prism** (the top one, if two share a reel) and travels right.
2. **Bounces.** Each Prism it reaches deflects it 90° (`/` turns right→up and down→left; `\` turns right→down and up→left). Every bounce adds **+1** to the beam's multiplier, which starts at ×1.
3. **Painting.** Every cell the beam crosses becomes a **Spray Wild** carrying the beam's multiplier at that moment. A Prism it hits becomes a Wild with the new multiplier. Scatters are crossed but not painted. Where two passes cross, the higher multiplier stays.
4. **End.** The beam ends when it leaves the board, after 16 bounces, or when it would repeat a cell in the same direction.
5. **Multipliers on a way are added together** (×2 and ×3 on one way make ×5). A way without a multiplier pays ×1. Plain ×1 Spray Wilds, crossed before the first bounce, substitute without multiplying.
6. **Wild-only ways** pay as Cyber Skunk (H1). A way with at least one real symbol pays as that symbol.

## Free Spins: Overdrive

- **Trigger:** 3, 4 or 5+ Skunk Badges anywhere.

  | Badges | Feature | Free spins |
  | --- | --- | --- |
  | 3 | **Overdrive** | 10 |
  | 4 | **Overdrive** | 12 |
  | 5+ | **Super Overdrive** | 12 |

- **Overdrive: sticky Prisms.** Every Prism that lands stays in place for the rest of the bonus, up to 10. Every spin with a Prism on the board fires the beam, which starts at ×1 each spin. The maze grows: later spins bounce more and paint more.
- **Super Overdrive: sticky Prisms plus a persistent Charge.** The bonus starts with 2 Prisms already in place. Every bounce adds +1 to a **Charge** that never resets for the rest of the bonus, and the beam starts each spin at ×(1 + Charge).
- **Retriggers:** 3 or more Badges during the bonus give +5 spins, up to 40 spins in total.

## Ways to play (the buy screen)

| Option | Cost | What it does |
| --- | --- | --- |
| Spin | 1× | The base game. |
| **Spray Boost** | 2× per spin | Prisms and Badges land far more often: free spins about 3× as often. It stays on until switched off. |
| **Buy Overdrive** | ~100× | Starts Overdrive (10 spins) at once. |
| **Buy Super Overdrive** | ~400× | Starts Super Overdrive (12 spins) at once. |

The math sets the final prices: each mode returns exactly 96%.

## Math targets (Claude)

- **RTP:** exactly **96.00%** in every mode.
- **Base game:** about 1 in 3.5 spins wins something. Free spins come about 1 in 220 spins; Super about 1 in 3,000.
- **Max win:** 10,000×, rare. The base game should reach it no more often than about 1 in 20 million spins. "Not max win all the time."
- **Exactness:** every outcome is a seeded round the game replays exactly. Weighted outcome catalogs make each mode exactly 96%, and the same catalogs become the Stake Engine lookup tables and books (as for Zombify).

## Presentation (AAA)

- **Mascot:** Static stands beside the reels, on the left on desktop and above the reels on mobile. He is a fully rigged character (Claude rigs and animates; ChatGPT draws the layered parts). Animations:
  - idle breathing and a twitching ear;
  - a tail sway;
  - **aim and fire** (the tail cannon swings to the beam's row, recoils, and the muzzle flashes);
  - a laugh or dance on big wins;
  - a hype pose on bonus triggers.
- **The beam:** an additive neon line drawn cell by cell, with a ping and a ×N pop on every bounce. Painted cells flash into Spray Wilds with dripping paint.
- **Reels:** a stop with bounce, anticipation on the 2nd Badge, and win lines that show the ways as glowing cell outlines.
- **Big wins:** Big, Mega and Epic tiers with a count-up, a neon title, rain sparks, and Static dancing.
- **Audio:** a synthwave base loop, a heavier Overdrive loop, and effects for every event. Claude makes the audio.
- **Controls:** shared desktop and mobile controllers covering spin, auto, turbo, bet, the buy screen, the menu and sound. The rules include the full paytable and RTP.
- **Builds:** a free-play build, and a Stake Engine build with the RGS, resume, replay and social words, as for Zombify.
