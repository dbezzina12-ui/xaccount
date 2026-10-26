# Night Fall: current development math

## 2026-10-26 — extra scatters on purchased bonuses

Dylan flagged that buys were always showing exactly three scatters, although Claude's natural trigger rules already supported 4/5+ awards. The opening is corrected for Regular, Super, Hidden and Mystery. This is a play-money development build, not certified math.

### Opening and awards

Each buy guarantees three tier tombstones in three distinct positions. The other 46 cells independently retain `RULES.scatterChance = 0.0055` for ordinary FS tombstones; they are not forced to be paying symbols. Thus total starting scatters are `3 + Binomial(46, 0.0055)`, and **22.407%** of buys have at least four. There is no new arbitrary count-weight table. All extra scatters are ordinary FS, so they add awards without changing the chosen bonus tier or Mystery's advertised tier odds.

The existing `bonusFor` is the single source for both purchased and natural awards, counting all tombstone kinds:

| Tier | 3 scatters | 4 scatters | 5+ scatters |
|---|---:|---:|---|
| Regular | 10 spins | 12 spins | 15 with 5; 20 with 6; 30 with 7+ |
| Super | 10 spins | 12 spins | 14 spins |
| Hidden | 10 spins | 13 spins | 15 spins + 1,000× base bet |

Hidden's 1,000× prize is credited once after the scatter drop and before bonus start, and is included in the 25,000× total-round cap. Opening symbols, awarded spin count, displayed splash and monetary accounting all derive from the same result.

### Hidden reachability

Mystery remains **40% Regular / 50% Super / 10% Hidden**. Every selection is independent: 10% is not a guarantee of one Hidden in ten buys. Direct Regular and Super buys stay in their selected tier. Hidden can also trigger naturally from 3+ total tombstones including a Hidden one. It still has no direct public buy.

One million Mystery rounds selected **399,851 Regular / 500,039 Super / 100,110 Hidden**. These counts are identical to the prior Mystery run because selection is still the first seeded RNG draw; extra scatters change the selected bonus's opening, not its tier.

## Current measured buy returns

Prices, probabilities and paytable have not been retuned as part of the scatter correction. The added spins/prize increase buy returns, so the prior 96.09% Mystery estimate is **superseded**. Claude's balancing pass must use this mechanic and rerun all buys together.

| Mode | Rounds | Return with approximate 95% interval |
|---|---:|---:|
| Regular buy (120×) | 200,000 | 56.99% ± 1.52% |
| Super buy (500×) | 200,000 | 93.58% ± 0.94% |
| Mystery buy (370×) | 1,000,000 | 113.06% ± 0.72% |

Hidden test entries (100,000; same 3+ opening distribution, not a direct public buy) average **1,566.42× ± 19.85×** base bet, including the possible opening prize. This is an average award, not RTP at a Hidden buy price.

Full current output and engine SHA-256: `math/sim-buy-extra-scatters.json`. Earlier `math/sim-mystery.json` and `math/sim-after.json` are retained as historical measurements, with their original hashes, and are not current buy-return claims.

Base and Reaper Strike paths are unchanged. 2,000 seeded natural-spin rounds (1,000 per mode), including triggered bonuses, match the preceding engine's complete results and event sequences. Their earlier measurements remain 75.25% ± 2.93% (4m base rounds) and 100.61% ± 1.86% (2m feature rounds) after the hold-until-use lantern correction. These are development estimates and still need balancing.

## Lantern and bonus contract retained

A single bonus mage zap adds one persistent animated lantern; a burst adds three temporary W wilds. Lanterns reserve their cells before each free-spin drop and remain visible there. Only a lantern used in a winning cluster may relocate after the winning tumble, swapping with an eligible paying symbol. Scatters and other wilds cannot be overwritten. No eligible destination means it stays, never disappears. Unused lanterns keep their cells, including across retriggers. Tile multipliers stay behind. Hidden keeps its 3–5 opening multiplier strikes and one starting lantern. None of those rules changed in this update.

## Reproduce and verify

```sh
node tools/math/nightfall-sim.mjs --rounds base=0,feature=0,regular=200000,super=200000,hidden=100000,mystery=1000000 --json games/nightfall/math/sim-buy-extra-scatters.json
```

110 Site tests pass. New checks cover extra-scatter frequency, 3/4/5+ entries for every purchase mode, exact shared spin/prize awards, prize accounting and caps. Example Mystery seeds: 1 = Super with 4 scatters / 12 spins; 4 = Hidden with 4 / 13; 6 = Super with 5 / 14; 1740 = Hidden with 5 / 15 + 1,000×. These are deterministic local QA fixtures only; production uses crypto-generated random seeds.

App and engine URLs now carry the release query `20261026-extra-scatters`. Settings show **Build 2026.10.26-SCATTERS** so an old open tab can be identified after refresh.
