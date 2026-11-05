# Dead Letter Depot · hourly collaboration report
Newest entries first. Work on codex/dead-letter-depot. Scope changes to this game.

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