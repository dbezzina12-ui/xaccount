# Night Fall: math sheet

> Owned by Claude. Measured by `node tools/math/nightfall-sim.mjs`, which plays whole rounds through the game's own engine (`runtime/engine.js`, `generateRound`). Night Fall's math is **development math**: these are simulated measurements with 95% confidence intervals, not certified returns. Prices and pays are playtest values. The base spin and both bonus buys are balanced to about 96%; Reaper Strike spins are at 110.4%.

## Where it stands (2026-10-26)

| Mode (price) | Return | Notes |
|---|---|---|
| **Base spin (1×)** | **95.71% ± 2.96%** | 20,000,000 spins. Base-game wins 40.9%, won Free Spins 33.9%, won Super 18.4%, won Hidden 2.6%. Base attack chance 19% |
| Reaper Strike spin (4×) | 110.40% ± 2.43% | 4,000,000 spins. Its guaranteed strike wins bonuses more often (Super 1 in 1,440, Hidden 1 in 47,000). About 4.6× would make it 96% |
| **Free Spins buy (120×)** | **96.69% ± 3.84%** | Sticky roamers and bursts |
| **Super Free Spins buy (500×)** | **95.61% ± 1.18%** | Sticky roamers and bursts, cross-cuts 25% |
| Hidden Free Spins (won only) | 2,008.8× average (10 spins) | 100,000 bonuses; reaches the 25,000× cap 1 in 35 |

## Gold and Hidden tombstones, the bonus tiers (2026-10-26)

Dylan: people should be able to spin into a Super, and Hidden should match Hacksaw's odds where possible. Hacksaw doesn't publish its odds, so this matches their structure. Their hidden bonus is their 5-scatter tier, and 5 tombstones land about 1 in 100,000 spins here. Their super bonus is the 4-scatter tier, about 1 in 5,000 here; Dylan chose a more generous Super.

In base and Reaper Strike spins, a tombstone lands as a **Hidden tombstone** (`hfs`) 0.107% of the time, about 1 tombstone in 935. It lands **gold** (`sfs`) 4.2% of the time (`RULES.hiddenScatter`, `RULES.superScatter`). There are none in free spins. What a spin's tombstones start (`bonusFor`), counting all kinds:

| Tombstones at the end of the spin | Bonus | How often (base spins) |
|---|---|---|
| 3+, none special | Free Spins, 10 / 12 / 15 / 20 / 30 spins for 3 / 4 / 5 / 6 / 7+ | 1 in 374 |
| 3 with a gold one | **Super Free Spins**, 10 spins | |
| 4 with a gold one | Super, 12 spins | about 1 in 33,000 |
| 5+ with a gold one | Super, 14 spins | about 1 in 540,000 |
| any Super, all counts | | **1 in 2,673** (20,000,000 spins) |
| 3 with a Hidden one | **Hidden Free Spins**, 10 spins | |
| 4 with a Hidden one | Hidden, 13 spins | about 1 in 1.3 million |
| 5+ with a Hidden one | 1,000× bet, then Hidden, 15 spins | about 1 in 20 million |
| any Hidden, all counts | | **1 in 90,909** (220 in 20,000,000 spins) |

A Hidden tombstone beats gold. The rows marked "about" are worked out from how often a spin ends with exactly 3, 4 and 5 tombstones (1 in 335, 1 in 5,200, 1 in 105,000; measured over 4,000,000 spins at the 30% attack chance) and the shares above.

**Hidden Free Spins** (Claude's first version, for Dylan to change): everything in Super (tiles start at 2×, cross-cuts on 25% of spins, Soul Harvest), plus one roamer already out from the first spin, and the mage strikes on 15% of spins. It averages 2,008.8× (± 29.8×) for 10 spins; the ones won in base spins, some with 13 or 15 spins, averaged about 2,330×.

**Paying for them.** Won Supers add 18.4% to the base spin and won Hidden 2.6%. The base attack chance is **19%** of spins (`strikeChance.base`; it was 30% before the special tombstones), so base-game wins are 40.9%. Free Spins come a little less often (1 in 374 instead of 1 in 311), because triggers with a special tombstone start Super or Hidden instead.

The first version of these tiers (3 gold for Hidden, about 1 in 3.5 million) is superseded.

## Base game balance (2026-10-26, before Super tombstones)

Superseded: with Super tombstones the base attack chance is 20% (above). Dylan: "raise that so base spins are closer to RTP". The one attack draw after a base spin's tumbles goes from 18% to **30%** of spins (`strikeChance.base`). The mage and the reaper still share it half and half. The mage now zaps on 1 spin in 6.7 (was 1 in 11), and the reaper strikes about as often.

| Base attack chance | Base-game wins | Free spins trigger | Return |
|---|---|---|---|
| 18% (before) | 39.47% | 1 in 329 | 79.99% ± 6.54% |
| **30% (now)** | **57.23%** | **1 in 311** | **95.99% ± 2.67%** |
| 32% | 60.32% | 1 in 310 | about 98.3% |
| 34% | 63.28% | 1 in 308 | about 101.6% |

The triggered free spins make the base return very noisy: one spin's SD is 61× the bet. So the rows are read two ways: the base-game wins (precise), plus the trigger rate times the value of a triggered bonus. That value is about 118× (the 120× buy's 116× average, scaled up for the slightly longer bonuses that 4+ tombstones give). This estimate gives 95.2% at 30%. The 30% row was then confirmed directly with 20,000,000 spins: 95.99% ± 2.67%, hit rate 38.36%, average triggered bonus 120.6×. The 32% and 34% rows are estimates from 4,000,000 spins each.

## Sticky roamers and bursts (current, 2026-10-26)

Dylan: "It's supposed to be sticky wilds that roam. So if it strikes at spin 1 it's in all the next spins. Mage is probably going to have to strike less." Then: "Adds a second roamer, we could make it so that if it strikes and it doesn't stay and it's a one time thing then it makes like 3 wilds."

- **The mage's free-spin strike.** After the drop of each free spin, the mage strikes with a chance of **11%** in Free Spins and **7.5%** in Super (`RULES.mage.chance`). It strikes before wins are evaluated.
- **A roamer, half of strikes** (`RULES.mage.roamer`). One cell becomes a roaming wild (`roam-wild`). It stays for the rest of the bonus, retriggers included. It holds its cell through every tumble of a spin, and the column falls past it. It stays when it wins. After each later drop it moves to another cell. Roamers stack: each roamer strike adds one more.
- **A burst, the other half.** Three cells (`RULES.mage.burst`) become one-time mage wilds (`arrow-wild`) for that spin only. They clear and fall like any wild.
- **Never** on an FS tombstone or an existing wild. A roamer that finds no free cell is lost, and a burst takes what cells it can.
- **Multipliers stay on their cells.** A cross-cut over a mage wild leaves it as it is.
- **Unchanged:** the base game's single zap, Super's cross-cut chance (25%, from option B), the reaper's strikes and the free-spin triggers.

| | Free Spins buy (120×) | Super buy (500×) |
|---|---|---|
| Return | 96.69% ± 3.84% | 95.61% ± 1.18% |
| Average award | 116.0× | 478.1× |
| Roamer strikes per bonus | 0.57 | 0.39 |
| Bursts per bonus | 0.57 | 0.39 |
| Reaches the 25,000× cap | 1 in 840 | 1 in 775 |
| SD per buy (× price) | 8.8 | 2.7 |

200,000 buys each. Roamers that stay all bonus build big multipliers, so the bonuses are much more volatile than before. The Free Spins buy return has a wide interval (±3.8%) for that reason, and so does the base game (±6.5% over 4,000,000 spins).

How the strike chance was chosen (50,000 bonuses each, roamer/burst half and half):

| Strike chance | 3% | 5% | 7% | 9% | 12% |
|---|---|---|---|---|---|
| Free Spins at 120× | 35.8% | 43.0% | 55.4% | 72.1% | 112.5% |
| Super at 500× | 77.9% | 84.5% | 93.7% | 104.7% | 124.1% |

Confirmed with 200,000 bonuses: Free Spins 85.3% at 10% and 96.7% at 11%; Super 95.6% at 7.5% and 98.7% at 8%. Roamers alone, stacking without bursts, ran away quickly: Free Spins measured 85.9% at a 5% strike chance and 267% at 10%.

## Super balance, option B (2026-10-26, superseded)

Replaced by sticky roamers and bursts above; Super keeps its 500× price and 25% cross-cuts from here. Dylan: Super should be priced at 500×, and "Go B so it doesn't feel like the mage happens every spin". What changed:

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

## N-08: Roaming Wild, first version (2026-10-26)

The base-game zap below is still current; the free-spin mechanic was replaced by sticky roamers and bursts (above).

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

- **Reaper Strike spins, 110.4% ± 2.4% at 4×:** they trigger bonuses more often (1 in 178; Super 1 in 1,440; Hidden 1 in 47,000), so they gained the most from the roamers and the special tombstones. The base attack chance doesn't touch them, since their strike is guaranteed. A price of about **4.6×** would make them 96%; so would a smaller guaranteed strike.

## Reproduce

```
node tools/math/nightfall-sim.mjs --json games/nightfall/math/sim-after.json
node tools/math/nightfall-sim.mjs --engine <copy of engine.js at 1e631e8> --json games/nightfall/math/sim-before.json
```

About 2 min 20 s each on 4 cores, or about 6 min with `--rounds base=2e7,feature=4e6,hidden=1e5` (the current figures). The figures are in `math/sim-after.json` (as it plays now), `math/sim-before.json` (the archer, before N-08), `math/sim-n08-every-spin.json` (N-08 as first built) and `math/sim-option-b.json` (Super option B). The option scans used copies of the engine with one value changed and 50,000–100,000 bonuses each.
