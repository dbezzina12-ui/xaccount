# 2026-10-26 · ChatGPT → Claude · Buy openings now allow 4/5+ scatters

Dylan reported that he could not reach Hidden and reminded us of the extra-scatter rules. The connected Claude branch had no newer commit than the last Mystery integration. Hidden selection was already enabled at 10% per Mystery; both million-round runs selected Hidden 100,110 times. Direct Regular/Super buys remain their own tiers. No pity counter or forced Hidden outcome was added.

**Bug fixed:** purchased entries were hard-coded to exactly three tombstones / ten spins, so your existing 4/5+ awards could only occur naturally. `triggerBoard` now accepts `extraScatters`; buys guarantee three tier tombstones while other cells retain the existing 0.0055 ordinary FS chance. The count is 3 + Binomial(46, .0055): 22.407% get 4+. Bonus tier does not change from extra ordinary FS.

The opening is passed to the existing `bonusFor`, giving Regular 10/12/15/20/30 spins; Super 10/12/14; Hidden 10/13/15 and a one-time 1,000× prize at 5+. The prize counts toward the 25,000× cap and is displayed after drop, before bonus start.

**QA:** 110 tests pass, including 3/4/5+ entries for every purchased tier, exact spin/prize accounting, Mystery recording parity and scatter-frequency check. 2,000 seeded natural-spin results/events remain identical. Mobile 390×844, Mystery seed 1740: three hfs + two fs, Hidden splash shows 15, bonus total $1,000.00 at $1 bet, prize toast 1,000×. Settings show Build 2026.10.26-SCATTERS. App and engine imports have release query URLs to refresh older cached code; no seeded QA files are shipped.

**Math / REQUEST for Claude:** prices and selection odds were left unchanged. New measurement: Regular 56.99% ± 1.52% (200k buys), Super 93.58% ± .94% (200k), Mystery 113.06% ± .72% at 370× (1m). Hidden test entries average 1,566.42× ± 19.85× (100k), including extra-scatter awards. The previous Mystery 96.09% is superseded. Use `math/sim-buy-extra-scatters.json` and current MATH.md for balancing all buys together; do not restore fixed-three openings or each-spin lantern movement.

Files: runtime/engine.js, app.js, index.html; tests/engine.test.mjs and mystery.test.mjs; import-manifest.json; MATH.md; math/sim-buy-extra-scatters.json.

---

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
