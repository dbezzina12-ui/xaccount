# Dead Letter Depot · engine contract

Owner: Claude (engine, math, settlement). The screen (Codex) plays settled rounds and never decides an outcome. The math figures are in [MATH.md](MATH.md); the rules config is [engine/rules.js](engine/rules.js).

## Playing a round

```js
import { playRound, seeded, ENGINE_VERSION } from './engine/engine.js';
import { settle, costOf } from './engine/settle.js';

const seed = crypto.getRandomValues(new Uint32Array(1))[0];
const round = playRound({ mode, rng: seeded(seed) });   // the whole round, settled
const { cost, win, balance } = settle(round, bet, oldBalance);
```

1. Check the balance covers `costOf(mode, bet)`.
2. Save `{ seed, mode, bet, version: ENGINE_VERSION }` before anything animates. On reload, `playRound` with the same seed and mode gives the identical round.
3. Debit `cost` when the round starts and credit `win` once at the end. The presentation can skip or stop, but it can't change either amount.

**Units.** `round.total` and every `value`/`paid` are in hundredths of the base bet. `win` is in cents, which `settle` and `winOf` produce. Bets come from `BETS` (whole 10 cents), so every win is exact cents.

## Modes

| `mode` | Card | Cost | Letter enters | Rescues per spin | Opening | FS chance per stage |
|---|---|---|---|---|---|---|
| `base` | Base Spin | 1× | middle lane | 0 | — | `FS.base` |
| `priority` | Priority Mail | 3× | middle lane | 0 | — | `FS.priority` |
| `carbon` | Carbon Copy | 1.5× | middle lane | 0 | stage 1 middle is a forced Fork (`forced: true`) | `FS.carbon` |
| `registered` | Registered Mail | 2.5× | middle lane | unlimited (nothing is lost) | — | `FS.registered` |
| `nightshift` | Night Shift buy | 100× | — | — | straight into Night Shift | — |
| `doubledispatch` | Double Dispatch buy | 250× | — | — | straight into Double Dispatch | — |
| `mystery` | Mystery Delivery | 400× | — | — | draws a bonus: 40% / 35% / 25% | — |

| Bonus (`bonus.tier`) | Title | Letters enter | Rescues per spin | Upgrade after each spin |
|---|---|---|---|---|
| `regular` | Night Shift | middle lane | 0 | each delivered bin +1 rung |
| `super` | Double Dispatch | top + bottom lanes | 0 | every bin +1 rung per delivery |
| `hidden` | Lost & Found | all three lanes | 1 | every bin +1 rung per delivery |

Seals on 3, 4 or 5 stages trigger `regular`, `super` or `hidden`. A bonus plays 10 spins, with no seals and no retriggers.

## The payload

```js
round = {
  version, mode, cost,        // cost in multiples of the base bet
  total,                      // the round's settled total (hundredths); credit winOf(total, bet)
  capped, tier,               // tier: null | 'nice' | 'big' | 'epic' | 'mythic' | 'max'
  spin: null | {              // null for a bonus buy
    board,                    // [stage][lane] = { s: 'U'|'S'|'D'|'F'|'J', fs?: true, forced?: true }
    postage,                  // [top, middle, bottom] bin values, shown before the letter drops
    route,                    // resolveRoute output: { entries, stages[], delivered, lost, rescued, reunited }
    pays,                     // [{ lane, value, paid }] one per delivered bin
    win,                      // the spin's own pay
    seals,                    // stages carrying an FS seal (3+ triggers the bonus)
  },
  bonus: null | {
    tier, title,
    start,                    // starting rung per bin (LADDER index); value = LADDER[rung]
    spins: [{ spin, board, route, rungs, pays, win, after }],
                              // rungs: before the spin (what it pays); after: once upgrades apply
    total, capped, endedEarly,
  },
}
```

**Route stages.** `route.stages[i]` is `{ stage, in, moves, merged, out }`. Each move is `{ from, to | null, kind, stamp, cause? }`, with `kind` one of `up`, `straight`, `down`, `fork`, `jam`, `edge` or `rescue`. A `rescue` has `cause: 'jam' | 'edge'`. `merged` lists the lanes where copies reunited that stage.

**Order on screen.**
1. Show the postage.
2. Drop the letter and play `moves` stage by stage.
3. Pay `pays`.
4. Reveal the seals.
5. Play the bonus: for each spin, show bins at `LADDER[rungs[lane]]`, route, pay, then animate the bins up to `after`.
6. Show the total.

If `capped`, the round stops on the spin that reached 25,000×. That spin's `paid` can be less than its `value`.

**Win tiers.** Base and paid spins compare with the base bet: Nice 10×, Big 25×, Epic 100×, Mythic 500×. Buys compare with their price: 2×, 5×, 25× and 50× the price. Use `round.tier`; it is already settled.

## Golden replays

These are pinned in `tests/engine.test.mjs`. Use them for demos and browser QA.

| Mode | Seed | Total | What happens |
|---|---|---|---|
| base | 1 | 0 | jammed, no delivery |
| base | 7 | 2× | one delivery, middle bin |
| base | 64 | 2× | fork, one arm lost at the edge, copies reunite |
| base | 238 | 0.7× | two bins |
| base | 1536 | 0.9× | all three bins |
| base | 1138 | 50× | top bin at 50× postage |
| carbon / registered | 5 | 1× / 1× | forced opening fork / protected route |
| priority | 77 | 134× | natural Night Shift |
| priority | 1230 | 435.5× | natural Double Dispatch |
| priority | 2645 | 1,170× | natural Lost & Found |
| nightshift / doubledispatch / mystery | 5 | 91× / 117× / 570× | bought bonuses (Mystery draws Double Dispatch) |
| mystery | 131293 | 25,000× | Lost & Found reaches the cap on spin 9 |
