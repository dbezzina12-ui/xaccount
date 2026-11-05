# Dead Letter Depot · hourly collaboration report
Newest entries first. Work on codex/dead-letter-depot. Scope changes to this game.

## 2026-11-05 14:48 UTC · Codex → Claude · Art build, mechanics on hold

Dylan is considering the core mechanics. Hold new mechanic, pricing, math and settlement work pending his direction. Treat the prior reel-engine proposal as provisional. Keep existing work available for review.

Codex published private Site source fe07e3539acacb41f9f6dcf54d78b4bafe079da2 from GitHub baseline 44a141d. Replaced all eleven symbol illustrations, title, cabinet and depot environment. Frank's new three-quarter illustration is static presentation art; the existing layered rig source is a separate asset. Checked the 1363×936 desktop and 390×844 phone layouts in Chromium. The phone spin completed both tumbles and returned to Spin with 4 illustrative credits. Next owner Dylan for art feedback and mechanics direction.

## 2026-11-05 14:01 UTC · Codex → Claude · Producer pivot to conventional tumble reels

Dylan rejected the sorter and requested a normal slot with Cyber Skunk as the art reference. Supersedes all sorter requests, including tuning its Night Shift floor. The private playable now opens on 6×5 reels with nine pay symbols, FS and value stamps. Eight matching pays anywhere. Show each win, clear those cells, drop survivors in order and continue. Art and sample play are in private Site source 55cea3d5a184008045ce7646c3ecf0d118d9c908. Branch baseline aedc048. No existing sorter award, RTP result or balance carries into the new game.

**Request for Claude:** Build a separate versioned reel engine, deterministic payload and settlement. Start with Night Shift: four FS open 10 free spins. On a blank bonus spin Frank saves new stamps for the next spin. On a paying spin, add live and held values, multiply the whole spin's tumble subtotal once, then consume them. With no stamps, use 1×. A held stamp expires after its last eligible miss and all stamps clear at bonus end. Double Post introduces paired stamps. Mystery can reveal either of those or Hidden Lost & Found, which gives each missed stamp two future spins to connect. Special Delivery and Double Exposure preview one/two opening stamps. Priority Mail should increase the chance of entering a bonus. Its preview forces four FS solely to demonstrate entry. Return simulated RTP per cost, feature costs, trigger and retrigger odds, cap rates and Mystery weights for producer review. Scope rig actions to banking, returning and consuming stamps. Send Codex a fixture set with board, winning cells, survivor/refill mapping, stamp expiry, mode, award and final settlement.

**Evidence:** Intro and three-panel guide, real desktop and 390×844 portrait layout, two-clear base spin (4 illustrative credits) and Night Shift blank → held 5× → 3 × 5 = 15 with eight FS left. Checked 560 authored cases for omitted/extra matches and terminal boards. Demos are scripted, with no wallet or RTP claim. Next owner Claude, then Codex binds and verifies the settled payload. Dylan reviews the feel.

## 2026-11-05 04:49 UTC · Codex → Claude · settled round presentation

Bound the playtest to playRound, settle, costOf and winOf from engine 0224599. Postage appears before the route, bins pay before FS reveal, and bonus bins rise from rungs to after. The screen uses a saved seed, engine version, original balance and playback position. Debit occurs once at entry and credit once at round end.

Verification: all 34 game tests passed independently. In Chromium, Mystery seed 131293 held the post-buy balance at 9,600 through nine Hidden spins, showed a 25,000× receipt and ended at 34,600. The isolated replay leaves the regular demo wallet alone. A normal Night Shift buy survived reload at entry and during its first spin; after replay, nine free spins remained and the debit was unchanged. The desk shows 1.5× Carbon Copy, 2.5× Registered Mail and 40/35/25 Mystery weights.

Next: Claude owns Frank's rig after receiving the art pack. Dylan owns the proposed rules and floor decision. The public branch still lacks the private art package; the producer has a ZIP. No production merge.

## 2026-11-05 04:35 UTC (Nov 4, 23:35 Cancún) · Claude → Codex · settled payload, rescues and math
**Tested SHA:** `0224599`. `npm run test:dead-letter-depot` passes 34/34 (resolver 14, engine 14, math 6). Core `npm test` passes 131/131.

**Your questions.**
- **Payload:** `playRound({ mode, rng: seeded(seed) })` returns the whole settled round, and `settle(round, bet, balance)` returns `{ cost, win, balance }` in cents. The schema, the order on screen and the save/reload rule are in [ENGINE.md](../games/dead-letter-depot/ENGINE.md).
- **Rescue allowance per spin:**
  - Base, Priority Mail, Carbon Copy, Night Shift and Double Dispatch: 0.
  - Registered Mail: unlimited (no branch is ever lost).
  - Lost & Found: 1, spent stage by stage, top lane first.
- **Entries:**
  - Base, Priority Mail, Carbon Copy, Registered Mail and Night Shift: middle lane.
  - Double Dispatch: top and bottom lanes.
  - Lost & Found: all three lanes.
- **Carbon Copy's** stage-1 middle cell is a forced Fork, marked `forced: true`.

**Did:**
- **Engine** ([`engine/engine.js`](../games/dead-letter-depot/engine/engine.js)): seeded with mulberry32, with a fixed draw order. Version `dld-engine-1`.
- **Rules** ([`engine/rules.js`](../games/dead-letter-depot/engine/rules.js)) and **settlement** ([`engine/settle.js`](../games/dead-letter-depot/engine/settle.js)): wins are exact cents on a 10-cent bet ladder.
- **Spins:** fresh postage on each bin before the drop. FS seals sit over stamps and never change the route; 3, 4 or 5 sealed stages award Night Shift, Double Dispatch or Lost & Found.
- **Bonuses:** 10 spins with persistent bins. Night Shift raises each delivered bin. Double Dispatch and Lost & Found use shared upgrades: every bin rises per delivery.
- **Cap:** 25,000× across the whole round, settled once; the bonus ends on the capping spin.
- **Exact calculator:** computed over the whole state space using the game's resolver. A fit tool solves every mode to 96% by cost.
- **Cross-check:** a Monte Carlo run of 10M spins and 1M buys through `playRound`. Every mode lands inside its 99.9% interval. Figures are in [MATH.md](../games/dead-letter-depot/MATH.md).
- **Golden replay seeds** are listed in ENGINE.md and pinned by the tests.

**Measured (exact):**
- **Every mode returns 96.00%:** Base 1×, Priority Mail 3×, Carbon Copy 1.5×, Registered Mail 2.5×, Night Shift 100×, Double Dispatch 250×, Mystery Delivery 400×.
- **Base spin:** the letter is delivered on 36.1% of spins, and a round pays something 36.4% of the time. A spin pays 5× or more 2.6% of the time and 10× or more 1.35% of the time.
- **Base bonus odds:** Night Shift 1 in 240, Double Dispatch 1 in 5,619, Lost & Found 1 in 328,214.
- **Priority Mail** enters a bonus 5.00× as often as a base spin.
- **Bonus averages:** Night Shift 96×, Double Dispatch 240×, Lost & Found 1,046×. Lost & Found reaches the cap 1 in 41,285 bonuses; Mystery Delivery 1 in 164,953.

**Next for Codex:** Bind payout and bonus presentation to the payload:
1. Show the postage, then play the route moves.
2. Pay the delivered bins.
3. Reveal the seals.
4. In bonuses, show bins at `LADDER[rungs[lane]]`, then animate them to `after`.
5. Show the capped finish.
6. Debit at start and credit `winOf(total, bet)` once.

Replace the provisional settlement with `settle`. Use the golden seeds for browser QA. Please land `art/frank/` with the rig manifest (pivots, parents, draw order) when ready.

**Next for Claude:** Rig Frank's idle, stamp slam, jam recoil, bonus salute and reduced-motion poses once `art/frank/` lands. Checking hourly.

**Questions for Dylan:**
1. Do you confirm these prototype interpretations?
   - Shared upgrades count per delivery.
   - Lost & Found keeps shared upgrades.
   - Registered Mail rescues everything.
   - Bonuses have no retriggers.
   - Paid spins cost 1.5× (Carbon Copy) and 2.5× (Registered Mail).
   - Mystery Delivery draws 40/35/25.
2. Should Night Shift get a floor? It currently pays nothing 1 in 6,814 bonuses.

**Blocked on:** nothing.

## 2026-11-05 04:27 UTC · Codex → Claude · route playback verified

Verified resolver 1ba1fe9 against 14/14 tests. The playtest screen now consumes stages[].moves, merged and delivered. Fixed-board browser checks: SFS DSU SSS SSS SSS splits and reunites into City once; SFS JSJ SSS SSS SSS with one rescue marks one saved and one jammed copy and delivers Air; SUS FSS SSS SSS SSS loses the upper fork arm and delivers City. All three replays preserved demo credit. 7,000 seeded presentation rounds passed structural checks.

Next owner: Claude. Please provide the settled playRound payload and final rescue allowance for each mode. Codex will bind payout and bonus presentation after that handoff. The private playtest still uses provisional settlement.

## 2026-11-05 04:10 UTC (Nov 4, 23:10 Cancún) · Claude → Codex · route resolver and fixtures
**Did:** Added the authoritative mail-routing resolver as pure modules: [`engine/sorter.js`](../games/dead-letter-depot/engine/sorter.js) (geometry) and [`engine/resolver.js`](../games/dead-letter-depot/engine/resolver.js). There are 14 route fixtures in [`tests/resolver.test.mjs`](../games/dead-letter-depot/tests/resolver.test.mjs) covering straight runs, up/down, edge loss (top, bottom, last stage), forks (including at an edge), merges, jams, exactly-once delivery, all three bins, rescues in route order, unlimited rescues and multiple entries. They also check purity and input validation. `node --test games/dead-letter-depot/tests/*.test.mjs` passes 14/14. The tested SHA is the commit carrying this entry.

**Runtime contract (for the screen):**
- **Board:** `board[stage][lane] = { s, fs?, forced? }`, 5 stages × 3 lanes, with lane 0 at the top. The stamps are `U` up, `S` straight, `D` down, `F` fork (one copy up, one down), and `J` jam.
- **Calling the resolver:** `resolveRoute(board, { entries = [1], rescues = 0 })` returns `{ entries, stages[], delivered, lost: { jam, edge }, rescued, reunited }`. Each `stages[i]` is `{ stage, in, moves, merged, out }`, and each move is `{ from, to | null, kind, stamp, cause? }`. A move's `kind` is `up`, `straight`, `down`, `fork`, `jam`, `edge` or `rescue`.
- **Animating a route:** animate `moves` stage by stage. Show `merged` lanes as copies reuniting. `delivered` lists the bins that receive a letter (ascending, each at most once).
- **Rescues** carry a lost branch straight on in its own lane, spent stage by stage, top lane first, and a fork's upper arm before its lower arm.
- The resolver never draws randomness and never pays. The seeded engine, postage and settlement come next, and are not committed until they are calibrated and measured.

**Next for Codex:** Build the route animation on this contract with fixed boards (the fixture boards make good demo cases). Please don't hard-code outcomes in the screen; it will receive whole settled rounds from `playRound`.
**Next for Claude:** Seeded engine, postage and bonus rules, settlement, exact calculator plus a Monte Carlo cross-check, then calibrate to 96% by cost with the 25,000× round cap, `MATH.md`, and rig Frank once `art/frank/` lands.
**Questions for Dylan:** none yet. Rule interpretations will be listed with the math.
**Blocked on:** nothing.

## 2026-11-05 UTC · Codex → Claude · kickoff
Dylan requested an original game. A night-shift postal pigeon named Frank operates a five-stage mechanical mail sorter. Each spin drops a letter into the middle lane of a three-lane cabinet. Track stamps send it up, straight, or down one lane into the next column. Forks split it, jams kill that branch, and reunited copies count once. Only deliveries that leave the fifth stage score. The suspense is following the envelope and seeing whether the last sorter sends it to the valuable bin.

**Claude can start now.** Own the authoritative seeded resolver, math package, settlement and Spine rig. Codex owns the art, screen setup, demo choreography and rig parts. Implement in separate files in slots/games/dead-letter-depot. Read slots/AGENTS.md and slots/collab/GAME_RELEASE_CHECKLIST.md. Start with route fixtures (edge loss, fork, merge, jam, exactly-once delivery) while Codex lands art/frank. Read the rig manifest before binding bones. Deliver idle, stamp, jam recoil, bonus salute and reduced-motion poses. Record the runtime contract and tested SHA here.

**Requested modes.** Base; Priority Mail (enhanced, target 3× cost and 5× natural bonus entry rate); Carbon Copy (feature spin with an opening fork); Registered Mail (feature spin with a protected route); Night Shift (regular, 10 spins, successful bins gain persistent value); Double Dispatch (super, 10 spins, inject from two lanes, shared bin upgrades); Lost & Found (hidden, 10 spins, three entry lanes plus one automatic rescue per spin). Three/four/five FS on distinct columns award Regular/Super/Hidden. Mystery draws one of all three. Prototype prices Regular 100×, Super 250×, Mystery 400×. Calibrate weights; never claim RTP until measured. Target 96% by cost, 25,000× cap across entire round. Art never decides outcomes.

**Handoff loop.** Pull before working. Commit to this branch or open a PR into it if restricted to a Claude branch. Post meaningful changes, tests, blockers and next owner here newest first, with SHA/PR. Check hourly while open. No blank heartbeat commits. Dylan signs off before release.