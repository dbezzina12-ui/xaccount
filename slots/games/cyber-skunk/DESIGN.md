# Cyber Skunk: rules v1 (Claude's math contract)

> Merged on 2026-10-30.
> - **From ChatGPT** (`STYLE.md` and the style frame): the theme, look, names and Dylan's six modes.
> - **Made exact here:** the route rules the math needs.
> - **From Claude's first draft:** pressure that rises at every vent.
>
> Claude owns these rules, the engine and the math. ChatGPT owns the art, names and copy. Propose changes in a handoff note.

## Board and pays

**The board:**
- **Grid:** 6 reels × 4 rows.
- **Lines:** 20 fixed lines (listed in `runtime/rules.js`). They pay left to right from reel 1, for 3, 4, 5 or 6 of a kind. Each line pays its best win.
- **Max win:** **25,000×** the base bet over a whole round, including bonuses. Reaching it ends the round.

**Symbols:**
- **H1 battery, H2 rotor, H3 canister, H4 key:** high pays.
- **L1–L5 A, K, Q, J, 10:** low pays.
- **W, the skunk-stripe wild:** substitutes for every paying symbol. A line of wilds alone pays as H1.
- **S, the FS scatter:** lands at most once per reel and pays nothing on lines.
- **Pays:** every pay is a whole 0.1× of the base bet, and every multiplier is whole, so every win is a whole 0.1×. The final paytable is set by the calibration in `MATH.md`.

## Backpressure: the spray route

- **Vents.** An **elbow vent** is an overlay on a cell; the symbol underneath stays. Each vent has an **outlet** pointing up, right, down or left.
- **When the spray fires.** If at least one vent is on the board after the reels stop, Cyber Skunk swings his tail over his shoulder and sprays.

**The route:**
1. The route enters from the **left edge**, on the row of the **left-most vent** (the top one, if two share a reel), and moves right.
2. It moves one cell at a time. **A vent sends it out through its outlet, whichever side it came in**, and adds **+1 pressure**. Pressure starts at 1.
3. Every cell the route touches becomes **wild for this spin**, carrying the pressure at that moment. A vent cell carries the pressure just raised. Pressure 1 is a plain wild; pressure 2 and up shows **×N**.
4. **Scatters** are touched but stay scatters: they never become wild.
5. The route ends when it would leave the board, enter a cell it has already touched, or take its 24th step. A route never loops and never branches.

**Evaluation:**
- The route resolves completely before evaluation: the transformed board is evaluated once, and scatters are counted once, on the landed board.
- **Line multiplier:** the sum of the ×N wilds in a winning line (×2 + ×3 = ×5). A winning line with no ×N wild pays ×1.

## Modes

| Mode | Name | Cost | What it does |
| --- | --- | --- | --- |
| Base | Base Spins | 1× | Vents land now and then. 3 / 4 / 5 scatters start **Vent Break / Overpressure / Blackout Protocol**. |
| Enhanced | **Signal Boost** | 3× per spin, on until switched off | Scatters land more often, so the bonuses come about 3–4 times as often (the measured figure is in `MATH.md`). Same rules. |
| Feature Spins | **Spray Job** | 10× per spin, on until switched off | Every spin lands at least 2 vents, so the spray always fires. Scatters work as normal. |
| Regular bonus | **Vent Break** | buy 100× | 10 free spins. Every vent that lands **stays** until the bonus ends (up to 12), so the route grows into a maze. Pressure restarts at 1 each spin. |
| Super bonus | **Overpressure** | buy 250× | 10 free spins with sticky vents and a **Reservoir**: after each spin's route, its pressure gained (pressure − 1) is banked in the cabinet gauge (up to 10), and every later route starts at **1 + the Reservoir**. |
| Hidden bonus | **Blackout Protocol** | not for sale | 10 free spins. It opens with the network activation: the lights go out, then 4 vents light up as one route and the Reservoir starts at 3. After that it plays as Overpressure. Only 5 scatters start it. |

- **Retriggers:** 3 or more scatters during any bonus add +4 spins, up to 30 spins in total. They never upgrade the tier.
- **Buy prices:** the 3×, 10×, 100× and 250× prices are targets. The calibration either meets them at exactly 96%, or `MATH.md` says why a price moved.

## Math acceptance (Claude; ChatGPT's gates in `STYLE.md`)

- **Exactly 96.00% in every mode,** measured against the full cost.
  - **How:** weighted catalogs of seeded rounds that the game replays and checks, as for Zombify.
  - **Proof:** every catalog entry replayed with 0 mismatches. The catalogs export to Stake Engine's lookup tables and books unchanged.
- **The report shows, per mode:** zero-return rate, hit rate, return ≥ cost, median, p90, p99 and p99.9, win bands, natural bonus rates, max-win odds, RTP by feature and 100-round sessions.
- **Max-win targets:**
  - base game: about one in millions;
  - Blackout Protocol: max no more often than 1 in 1,000 of its bonuses;
  - the max is never a payout target.
- **Previews** draw from the same distribution as their tier and never touch the balance.
