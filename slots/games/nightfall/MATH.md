# Night Fall: current development math

## 2026-10-26 — Mystery Buy

Mystery costs **370× base bet** in playtest credits. One RNG draw chooses **40% Regular / 50% Super / 10% Hidden**, then that existing ten-spin bonus runs unchanged. Hidden is now accessible through Mystery as well as a natural Hidden scatter trigger; there is no direct Hidden buy.

| Measurement | Result |
|---|---:|
| Whole Mystery buys | 1,000,000 |
| Return / 370× price | **96.09% ± 0.61 percentage points** |
| Average award | 355.54× base bet |
| Selected Regular / Super / Hidden | 399,851 / 500,039 / 100,110 |
| Cap rate | 0.078% |

This is a Monte Carlo development estimate, not certification. The 370× price was chosen from the existing measured bonus values (~353.91× weighted average / 0.96), rounded to 370×, then independently verified above. Reprice Mystery when Claude retunes its underlying bonuses; the standalone regular and Super buys still need the balancing pass described below.

`math/sim-mystery.json` records the current engine hash and full output. The earlier `math/sim-after.json` remains the original measurement of the underlying tiers with its original hash. All 1,000 checked existing-mode rounds (200 each of base, feature, regular, Super and Hidden) reproduce the previous engine's outcomes and complete event sequences exactly; the sole additional return metadata is `purchaseMode`.

The menu and confirmation show the same odds from `RULES.mystery`. Selection happens once in the engine after purchase confirmation; animation never rerolls it. The selected tier's own scatter art drops before its bonus splash. Hidden keeps its opening multiplier strikes and starting lantern. History records Mystery Buy plus the selected tier and the single 370× charge. Total award is capped at 25,000× base bet as for every other round.

Reproduce:

```sh
node tools/math/nightfall-sim.mjs --rounds base=0,feature=0,regular=0,super=0,hidden=0,mystery=1000000 --json games/nightfall/math/sim-mystery.json
```

108 Site tests pass, including exact probability boundaries, deterministic selection, equivalence to each selected bonus, all three scatter artworks and recorded/unrecorded parity.

## 2026-10-26 — hold lanterns until a winning use

Dylan corrected the roaming rule: a lantern stays visible in its cell between spins and moves only after contributing to a win. This supersedes the earlier rule that moved every lantern at the start of every free spin.

**These measurements supersede the previous ~96% figures. The new rule is implemented, but balance has NOT been retuned.** Claude owns the next balancing pass. No paytable, price, attack probability, scatter probability or win cap was changed. This remains a play-money development build, not certified math.

## Reproducible simulation

Measured using the existing `tools/math/nightfall-sim.mjs` against this runtime's `generateRound`, with its normal deterministic seeds and worker partitioning. Full output is `math/sim-after.json`; the engine SHA-256 is recorded there and in `import-manifest.json`. Intervals are approximate 95% Monte Carlo confidence intervals, in percentage points.

| Mode | Whole rounds | Measured return |
|---|---:|---:|
| Base spin (1×) | 4,000,000 | 75.25% ± 2.93% |
| Reaper Strike (4×) | 2,000,000 | 100.61% ± 1.86% |
| Free Spins buy (120×) | 200,000 | 47.06% ± 1.19% |
| Super buy (500×) | 200,000 | 82.74% ± 0.81% |

Hidden is won only, so it has no buy-price RTP. Across 100,000 ten-spin Hidden bonuses, average award is **1,244.8× ± 16.6×** base bet. The 25,000× cap occurred in 0.559% of those bonuses.

The change reduces repeated wins on the same multiplier tile: a used lantern now leaves that tile after the winning tumble instead of camping there through the entire cascade. Regular and Super both need rebalancing before their earlier return targets can be claimed. This report deliberately does not silently tune frequencies to compensate.

## Exact lantern contract

- During any bonus, a single mage zap creates one `roam-wild`, using the animated soul-lantern art. It persists for the remainder of the bonus, including retriggers. Additional single shots add lanterns.
- A three-cell burst creates `arrow-wild` symbols with the regular W art. These remain temporary, clear in wins, and expire on the next spin.
- Existing lantern cells are reserved before a new free-spin board is generated. They are present in the `drop` event's board and `fixed` list. No symbol or scatter is generated underneath them; no random new scatter is overwritten.
- Unused lanterns stay in their exact cells across spins and tumbles. Presentation excludes those cells from both departure and initial drop animation.
- After a winning cluster is paid, the winning tumble resolves around all lanterns. Only lanterns in that win's union of positions may then move, once per win resolution (even if shared by multiple clusters).
- Each used lantern selects an eligible paying-symbol cell uniformly, excluding scatters and all current wilds. It swaps with that symbol. The target symbol fills its old cell; no scatter is lost and no cell is left empty. The next evaluation uses that resulting board. A lantern may move again if it participates in a later win.
- If no eligible target exists, the lantern stays. It is never deleted merely for lacking a target.
- Tile multipliers stay on their cells and are never carried with the lantern.
- At the round cap, the bonus ends immediately, so no further relocation is needed.
- Hidden's one starting lantern uses `from: -1` to materialize after its first drop. This is the only relocation event not caused by a winning use.

## Scatters and tiers

Natural scatter probabilities are unchanged: `scatterChance = 0.0055`; in base and Reaper Strike, 4.2% of tombstones are Super (`sfs`) and 0.107% are Hidden (`hfs`). Special tombstones do not randomly land during free spins.

Three or more total tombstones trigger a bonus. A Hidden tombstone takes precedence, otherwise any Super tombstone starts Super, otherwise regular Free Spins. Existing awards remain unchanged:

| Trigger | Spins / additional award |
|---|---|
| Regular, 3 / 4 / 5 / 6 / 7+ | 10 / 12 / 15 / 20 / 30 spins |
| Super, 3 / 4 / 5+ | 10 / 12 / 14 spins |
| Hidden, 3 / 4 / 5+ | 10 / 13 / 15 spins; 5+ also pays 1,000× |

Super buys now visibly drop three approved `sfs` tombstones, fixing an `fs` presentation mismatch. Regular buys drop `fs`; Hidden previews drop `hfs`. Buy opening board positions and RNG consumption are unchanged by that artwork correction. The Super buy menu and confirmation also use `sfs.webp`.

Hidden still starts with 2× tiles, 3–5 opening mage strikes upgrading a plus of cells, one starting lantern, and a 15% mage strike chance. Regular and Super keep their 11% and 7.5% chances. Half of bonus mage strikes create a lantern; half create a temporary burst. All prior Reaper behavior, prices, and the 25,000× total cap remain.

## Reproduce

```sh
node tools/math/nightfall-sim.mjs --rounds base=4000000,feature=2000000,regular=200000,super=200000,hidden=100000 --json games/nightfall/math/sim-after.json
```

105 Site tests pass, including the engine's all-tier lantern checks, retriggers, reduced motion, distinct artwork and exclusion of held lanterns from departure/drop motion. Mobile presentation is checked separately. Earlier math sheets and measurements remain available in Git history before this correction.
