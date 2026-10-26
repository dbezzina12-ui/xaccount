# Night Fall: math sheet

> Owned by Claude. Measured by `node tools/math/nightfall-sim.mjs`, which plays whole rounds through the game's own engine (`runtime/engine.js`, `generateRound`). Night Fall's math is **development math**: these are simulated measurements with 95% confidence intervals, not certified returns. Prices and pays are playtest values; only the Super buy has been balanced.

## Where it stands (2026-10-26)

| Mode (price) | Return | Notes |
|---|---|---|
| Base spin (1×) | 65.59% ± 1.79% | Not balanced yet (BOARD N-09) |
| Reaper Strike spin (4×) | 96.68% ± 1.02% | |
| Free Spins buy (120×) | 70.32% ± 1.15% | Not balanced yet (BOARD N-09) |
| **Super Free Spins buy (500×)** | **96.28% ± 0.91%** | Balanced: option B below |

## Super balance, option B (2026-10-26)

Dylan: Super should be priced at 500×, and "Go B so it doesn't feel like the mage happens every spin". What changed:

- **Price:** Super Free Spins 550× → **500×**.
- **The mage wild in Super** appears on about **half** the free spins (`roamChance.super` 0.5), about 5.2 times per bonus. When it appears, it behaves as before: it holds its cell through the spin's tumbles and lands somewhere other than where it was last. Free spins without it have no mage wild at all.
- **Cross-cuts:** the reaper's cross-cut chance in Super goes from 34% to **25%** of the attack draws that come after the tumbles (`strikeChance.super`). Soul Harvest stays 10% of cross-cuts.
- **Unchanged:** regular Free Spins keep the wild on every spin. No extra random draw happens there, so regular rounds, the base game and Reaper Strike spins play out exactly as before; their figures reproduced to the last digit.

| Super Free Spins | Before N-08 (550×) | N-08, wild every spin (550×) | **Option B (500×)** |
|---|---|---|---|
| Return | 98.81% ± 0.86% | 187.73% ± 1.68% | **96.28% ± 0.91%** |
| Average award | 543.4× | 1,032.5× | **481.4×** |
| Mage wild appearances per bonus | 0 | 10.4 | **5.2** |
| Free spins played | 10.38 | 10.39 | 10.37 |
| Retriggers per bonus | 0.038 | 0.039 | 0.037 |
| Reaches the 25,000× cap | 1 in 2,532 | 1 in 460 | **1 in 3,226** |

Super's return depends far more on the cross-cuts than on the mage wild. With no mage wild at all and 34% cross-cuts it already averaged 541×. At 20% it averaged 255×, and at 10% it averaged 122×. The other two options that reach about 96% at 500× (100,000 bonuses each) were:
- cross-cuts 28% with the wild on a quarter of spins: 95.8% ± 1.2%;
- cross-cuts 20% with the wild every spin: 97.8% ± 1.4%.

## N-08: Roaming Wild (2026-10-26)

Dylan: "make it zap a single spot when it does. But I think it should be a roaming wild single space for bonuses." What changed in the engine:

- **Base game.** The mage keeps the archer's opportunity (the horizontal half of the one attack draw after the tumbles, 18% of spins that reach it). It now zaps **one** cell wild instead of a 3–5 cell trail. The cell is any cell that is not an FS tombstone or already wild.
- **Free Spins and Super Free Spins.** One mage wild lands after each free spin's drop (in Super, since option B, on about half the spins) and before wins are evaluated. It holds its cell through every tumble of that spin; the column falls past it, and it stays even when it wins. On the next free spin it moves to a different cell. Retriggers keep the same single wild. It never lands on an FS tombstone, and it is gone when the bonus ends.
- **No other mage attack in free spins.** The horizontal draws that used to be archer trails in regular free spins now do nothing. They are not given to the reaper, whose vertical strikes keep their old frequency. Super keeps its cross-cuts and Soul Harvest.
- **Multipliers stay on their cells.** The wild does not carry a multiplier. Its cell upgrades when the wild wins, like any winning cell. A cross-cut over the wild leaves it the mage's.
- The Reaper Strike feature spins (4× bet, mode `feature`) never had archer trails. Only the bonus they can trigger changed.

The internal symbol ID stays `arrow-wild` (display name: Mage wild).

## Before and after N-08

Same simulator and seeds for both columns. The before column is the engine at `1e631e8`; the after column is N-08 as first built, with the wild on every free spin and Super still at 550× (`math/sim-n08-every-spin.json`). Rounds: base 4,000,000, feature 2,000,000, regular buy 200,000, Super buy 200,000.

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

## Still to balance (decision for Dylan)

- **Base game, 65.6%:** the base attack chance (18% of spins that reach it, shared by the mage and the reaper) measured 85.9% ± 3.1% at 30% and 109.2% ± 2.4% at 45%. About **36%** would put the base near 96%. Raising every pay instead (pay scale 0.46 → 0.673) would lift all modes together, including Super.
- **Free Spins buy, 70.3% at 120×:** about **88×** would make it 96% as it plays now. The alternative is to give the bonus more value, such as more wild or reaper action, at 120×. With the mage wild on only part of the spins, it measured 46.7% (half the spins) and 40.9% (a third). Without the mage wild it measured 29.1%.

## Reproduce

```
node tools/math/nightfall-sim.mjs --json games/nightfall/math/sim-after.json
node tools/math/nightfall-sim.mjs --engine <copy of engine.js at 1e631e8> --json games/nightfall/math/sim-before.json
```

About 2 min 20 s each on 4 cores. The figures are in `math/sim-after.json` (as it plays now), `math/sim-before.json` (the archer, before N-08) and `math/sim-n08-every-spin.json` (N-08 before option B). The option scans used copies of the engine with one value changed and 50,000–100,000 bonuses each.
