# Dead Letter Depot · reel engine contract (v2: collections and the meter)

Owner: Claude (engine, math, settlement). The screen (Codex) plays settled rounds and never decides an outcome. The math is in [MATH.md](MATH.md), the rules config in [engine/rules.js](engine/rules.js), and the fixture set in [fixtures/rounds.json](fixtures/rounds.json). The sorter prototype is archived in [archive/sorter](archive/sorter/ENGINE.md).

Engine version **`dld-reels-2`**. This is a prototype for producer review: targets, starting meters, increments, prices and event order are provisional.

## Playing a round

```js
import { playRound, seeded, ENGINE_VERSION } from './engine/engine.js';
import { settle, costOf } from './engine/settle.js';

const seed = crypto.getRandomValues(new Uint32Array(1))[0];
const round = playRound({ mode, rng: seeded(seed) });   // the whole round, settled
const { cost, win, balance } = settle(round, bet, oldBalance);
```

1. Check that the balance covers `costOf(mode, bet)`.
2. Save `{ seed, mode, bet, version: ENGINE_VERSION }` before anything animates. The same seed and mode replay the identical round.
3. Debit `cost` once at the start and credit `win` once at the end.

Units: round amounts are hundredths of the base bet; `settle` gives cents.

## Rules the screen must show in this order

- **A check** counts each pay symbol anywhere; 8 or more pay. Wilds (`W`, from K and the KEY vault) join only the most common pay symbol (ties go to the higher rank). Wilds leave after that check whether or not they paid.
- **After a paying check:**
  1. The winning cells clear, and the real symbols cleared add to their collections.
  2. Any collection at its target **clears**, in rank order, and the excess carries.
  3. Survivors drop and refills land.
  4. The cleared collections' **jobs** run on the settled board, in rank order. Each symbol's job fires at most 3 times per spin; extra clears still grow the meter.
- **Rank:** KEY, PHONE, PARCEL, ENVELOPE (premiums), then A, K, Q, J, 10.
- **Tie-breaks:**
  - The *most common visible premium* is the highest count, then the higher rank. If none is visible, it falls back to ENVELOPE (J), PARCEL (PARCEL) or KEY (vault).
  - *s\** is the most common pay symbol: highest count, then higher rank.
  - *Donor cells* are pay-symbol cells, lowest-ranked symbol first, then reel by reel, top to bottom.

| Symbol | Job | Exactly what happens |
|---|---|---|
| 10 | sweep | every 10 leaves the board (no pay, no collection); survivors drop and refills land |
| J | convert | every J becomes the most common visible premium |
| Q | copy | the row with the most s\* (topmost on ties) is copied onto the row with the fewest (bottom-most on ties); only pay symbols over pay symbols |
| K | wild | the reel with the fewest s\* (leftmost on ties) turns its pay symbols into W for the next check |
| A | filter | the next of 10, J, Q stops landing in refills for the rest of this spin |
| ENVELOPE | return | the spin's biggest single win so far (by pay) pays again |
| PARCEL | unpack | the 4 first donor cells become the most common visible premium |
| PHONE | deliver | the pay symbol with the most copies under 8 gets exactly the missing copies from donor cells |
| KEY | vault | PARCEL's unpack, then K's wild reel, then a multiplier stamp (one draw for its value) on the first donor cell |

- **The meter:**
  - Stamps add their value as they land.
  - A clear adds its increment: KEY and PHONE +3, PARCEL and ENVELOPE +2, lows +1.
  - In Lost & Found, a clear doubles the meter instead.
  - Within a spin: stamps first, then clears, then the final meter multiplies the spin's tumble sum (all pays plus ENVELOPE returns) once.
- **How each mode uses the meter:**
  - Base and paid spins: a spin-local meter starting at 1×.
  - Night Shift: the meter carries; it applies only on a spin with a clear or a stamp, and otherwise wins pay face value.
  - Double Post: starts at 10× and applies every spin.
  - Lost & Found: half targets, applies every spin, and doubles per clear up to 64×.

## The payload

```js
round = { version, mode, cost, total, capped, tier, spin, bonus }
spin  = { targets, board, opening, steps, stampsAt, subtotal, stampSum, clears, multiplier, win, fs, tumbles }   // base and paid spins
bonus = { tier, title, targets, awarded, retriggers, clears, meter, total, capped, endedEarly, spins: [freeSpin] }
freeSpin = {
  spin, board, steps, stampsAt, subtotal, stampSum, clears,
  meter: { start, after, active, event },   // active: the meter multiplied this spin
  multiplier, win, paid, fs, retrigger,
  collectionsBefore, collectionsAfter, filteredBefore, filteredAfter,
}
step = {
  kind: 'win' | 'expire',                    // expire: no win, the wilds leave
  wins: [{ s, count, wilds, pay, cells: [[reel, row]] }],
  pay, cleared: [[reel, row]],
  collect: { [symbol]: cleared count },      // what this check added
  clears: [{ s, job, fired }],               // fired false: over the 3-a-spin job limit
  drops: [[reel, fromRow, toRow]], refills: [[reel, row, s] | [reel, row, 'ST', value]],
  jobs: [{ s, job, changes: [[reel, row, from, to]], ...details }],
  collections: { [symbol]: progress after this check },
  after,                                     // the board once jobs have run
}
```

**Job details:**
- `sweep`: `changes` lists the removed cells, then `drops` and `refills` for its own settle.
- `convert`, `unpack`, `deliver`: `symbol`.
- `copy`: `symbol`, `from`, `to` (rows).
- `wild`: `reel`.
- `filter`: `filtered`.
- `return`: `returned` (the win paid again).
- `vault`: `unpack`, `wild`, the stamp in `changes`, and `stamp` (its value).

`targets` holds each symbol's collection target for that spin or bonus (the rack's denominators). `step.collections` and `collectionsBefore`/`collectionsAfter` are the numerators. `stampsAt` lists every stamp with `value`, `at`, `step` and `source` (`land`, `refill`, `opening`, `vault`). A drop's distance is `toRow - fromRow`.

**Order on screen.**
1. Land the board (opening stamps first on paid spins).
2. For each step:
   - Highlight the wins.
   - Clear them and fill the collection bars by `collect`.
   - Flash each `clears` entry.
   - Drop and refill.
   - Play each job's `changes`.
3. Apply `multiplier` once to the spin's tumble sum.
4. In a bonus:
   - Show `meter.start` and grow it to `meter.after`.
   - Light the meter only when `meter.active`.
   - Carry `collectionsAfter` into the next spin.
5. Finish with `total`. A capped round ends on the spin that reached 25,000×.

**Frank's rig actions** (rig pending his layered art): bank or return a stamp as it lands, and slam it into the meter as the multiplier applies.

## Fixtures

[fixtures/rounds.json](fixtures/rounds.json) holds named scenarios with their seed, mode, full payload and settlement at a $1 bet from $1,000:
- **Base:** no win, one tumble, a cascade, a stamp lifting the meter, a collection clear.
- **Natural bonuses:** each of the three.
- **Feature spins:** both opening-stamp spins.
- **Codex's four examples:** `regular-inactive`, `regular-late`, `super-no-event`, `hidden-clear-and-stamp`.
- **One per job:** `job-sweep`, `job-convert`, `job-copy`, `job-wild`, `job-filter`, `job-return`, `job-unpack`, `job-deliver`, `job-vault`.
- **Other:** a retrigger, each Mystery reveal, and a capped round if one was found.

The tests replay every fixture.
