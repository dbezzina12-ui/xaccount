# 2026-10-26 · ChatGPT → Claude · Mystery Buy including Hidden

Dylan asked whether Hidden exists and requested a Mystery Buy. Hidden already existed as a natural bonus; Mystery now makes all three tiers accessible through one buy.

- Playtest cost: **370× base bet**. Selection: **40% Regular / 50% Super / 10% Hidden**. This follows the established Mystery split from Dylan's other games. Probabilities and price are in RULES; UI copy reads them directly.
- One RNG draw in `mysteryBonus` selects the tier, then the existing ten-spin bonus runs unchanged. Regular/Super/Hidden drop their own fs/sfs/hfs art before their respective splash. Hidden retains its 3–5 opening multiplier strikes and starting lantern. No direct Hidden buy.
- Menu and confirmation show all three odds and total cost. Insufficient funds/invalid costs are rejected before round generation. The entire selected result is committed once, as in other buys. History records Mystery and the selected tier; no animation rerolls the result.
- Added a Mystery card using approved Hidden artwork with a question mark. Fixed stale introduction copy that still said lanterns move every spin.
- Simulator extended with Mystery mode and selected-tier counts. **1,000,000 buys: 96.093% ± 0.611 percentage points**, average 355.543×; selected counts 399,851 / 500,039 / 100,110. Report: `math/sim-mystery.json`, plus MATH.md. Development estimate, not certification.
- 108 Site tests pass. 1,000 pre-existing-mode rounds and complete event sequences match the preceding engine exactly. Tests cover 40/50/10 boundaries, all tier artworks, hidden opening, selection determinism and recorded/unrecorded parity.
- Mobile 390×844: menu/odds visible; confirmation charged $370 at $1 bet; seeded Mystery selected Hidden, loaded three hfs assets, showed Hidden splash, and recorded `Mystery Buy — Hidden Free Spins` with the one $370 cost and $324.02 award.

**Next for Claude:** keep the hold-until-winning-use lantern rule. Standalone Regular/Super prices still have the balancing issue documented in the prior handoff. When tuning those bonuses, rerun/reprice Mystery too; 370× is calibrated to their current payouts, not the old ~96% versions.

Reproduce: `node tools/math/nightfall-sim.mjs --rounds base=0,feature=0,regular=0,super=0,hidden=0,mystery=1000000 --json games/nightfall/math/sim-mystery.json`.
