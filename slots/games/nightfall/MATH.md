# Night Fall: math sheet

> Owned by Claude. Measured by `node tools/math/nightfall-sim.mjs`, which plays whole rounds through the game's own engine (`runtime/engine.js`, `generateRound`). Night Fall's math is **development math**: these are simulated measurements with 95% confidence intervals, not certified returns. Prices and pays are playtest values and have not been tuned.

## N-08: Roaming Wild (2026-10-26)

Dylan: "make it zap a single spot when it does. But I think it should be a roaming wild single space for bonuses." What changed in the engine:

- **Base game.** The mage keeps the archer's opportunity (the horizontal half of the one attack draw after the tumbles, 18% of spins that reach it). It now zaps **one** cell wild instead of a 3–5 cell trail. The cell is any cell that is not an FS tombstone or already wild.
- **Free Spins and Super Free Spins.** One mage wild lands after each free spin's drop and before wins are evaluated. It holds its cell through every tumble of that spin; the column falls past it, and it stays even when it wins. On the next free spin it moves to a different cell. Retriggers keep the same single wild. It never lands on an FS tombstone, and it is gone when the bonus ends.
- **No other mage attack in free spins.** The horizontal draws that used to be archer trails in regular free spins now do nothing. They are not given to the reaper, whose vertical strikes keep their old frequency. Super keeps its cross-cuts and Soul Harvest.
- **Multipliers stay on their cells.** The wild does not carry a multiplier. Its cell upgrades when the wild wins, like any winning cell. A cross-cut over the wild leaves it the mage's.
- The Reaper Strike feature spins (4× bet, mode `feature`) never had archer trails. Only the bonus they can trigger changed.

The internal symbol ID stays `arrow-wild` (display name: Mage wild).

## Before and after

Same simulator and seeds for both columns; the before column is the engine at `1e631e8`. Rounds: base 4,000,000, feature 2,000,000, regular buy 200,000, Super buy 200,000.

| Mode (cost) | Metric | Before (archer trail) | After (Roaming Wild) |
|---|---|---|---|
| **Base spin** (1×) | Return | 101.19% ± 2.11% | **65.59% ± 1.79%** |
| | from the base game itself | 64.27% | 39.47% |
| | from free spins it triggers | 36.92% | 26.12% |
| | Hit rate | 38.88% | 33.31% |
| | Free spins trigger | 1 in 306 | 1 in 329 |
| | Average triggered bonus | 113.0× | 85.9× |
| | Mage zaps per spin | 0 | 0.090 (1 in 11) |
| **Reaper Strike spin** (4×) | Return | 100.95% ± 1.21% | **96.68% ± 1.02%** |
| | Hit rate | 99.11% | 99.11% |
| | Average triggered bonus | 123.4× | 93.0× |
| **Free Spins buy** (120×) | Return | 91.33% ± 1.42% | **70.32% ± 1.15%** |
| | Average award | 109.6× | 84.4× |
| | Free spins played | 10.38 | 10.36 |
| | Retriggers per bonus | 0.037 | 0.035 |
| | Reaches the 25,000× cap | 1 in 20,000 | 1 in 100,000 |
| **Super Free Spins buy** (550×) | Return | 98.81% ± 0.86% | **187.73% ± 1.68%** |
| | Average award | 543.4× | 1,032.5× |
| | Free spins played | 10.38 | 10.39 |
| | Retriggers per bonus | 0.038 | 0.039 |
| | Reaches the 25,000× cap | 1 in 2,532 | 1 in 460 |

Every free spin had exactly one mage wild (10.4 relocations per bonus = free spins played). The cap still ends the round. The cap rate for the regular buy rests on 1–10 capped rounds in 200,000, so it is rough.

### Where the change comes from

One more regular-buy run (100,000 rounds) used the new engine with no roaming wild. Free Spins returned **29.1%** without either mage feature. So the old archer trail was worth about +62 points of the regular bonus, and the roaming wild is worth about +41. Super never had trails; the roaming wild adds about +89 points there. Every Super tile starts at 2×, so a wild that stays put and keeps winning builds multipliers fast.

## Tuning: not applied (decision for Dylan)

The trigger frequency and every price and pay are unchanged, as the N-08 brief asked. The new returns are far apart: the base game dropped to about 66%, and the Super buy now pays out almost twice its price. Here are the simplest levers, worked out from the measurements (pays scale linearly, apart from the cap):

- **Reprice the buys to about 96%:** Free Spins 120× → **88×**, Super 550× → **1,075×**. Reaper Strike spins are already at 96.7% and can stay at 4×.
- **Raise the base game to about 96%:** the pay scale would go from 0.46 to **0.673**. That raises every mode by the same factor, so the buys would then need **129×** and **1,575×**, and Reaper Strike spins **5.9×**. Another option is a higher base attack chance, which would need its own simulation.

## Reproduce

```
node tools/math/nightfall-sim.mjs --json games/nightfall/math/sim-after.json
node tools/math/nightfall-sim.mjs --engine <copy of engine.js at 1e631e8> --json games/nightfall/math/sim-before.json
```

About 2 min 15 s each on 4 cores. The figures are in `math/sim-before.json` and `math/sim-after.json`.
