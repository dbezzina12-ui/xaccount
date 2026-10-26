# Night Fall: current development math

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
