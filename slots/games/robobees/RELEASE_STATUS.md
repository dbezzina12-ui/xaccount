# RoboBees release status

**Private playtest.** The [studio checklist](../../collab/GAME_RELEASE_CHECKLIST.md) defines release sign-off. This status tracks current evidence and the work still open. Dylan owns producer approval, ChatGPT owns art and presentation, and Claude owns math calibration. Math evidence was last updated on 2026-11-02, on branch `ccr-52c8075e-57i9ob`.

| Area | Status | Evidence / next check |
|---|---|---|
| 5×4 left-to-right rules and tumbles | Verified in the mechanics build | `node tests/bonus-rules.mjs` checks 50,000 spins, gravity, intersecting paylines, cell multipliers and Wild counts. |
| Symbols and bonus identity | On the main game link | Original machinery in separated colours, animated honey-glass FS, live mascot and sprite fallback. Inspect both graphics paths on physical phones. |
| Bonus buys and feature spins | Playable | Three bonus outcomes and three feature spins: Signal Boost (enhanced spins), plus the two seeded multiplier features. Scout Run was removed at Dylan's request. The 32× isolated replay is `?preview=tumble`. |
| Win presentation | Implemented | Five tier treatments and cues in `?preview=wins`. Test a settled Epic in `?preview=tumble`. First tap reveals the exact amount and second tap continues. Normal play advances automatically. |
| Cap and live Max event | Implemented — device check open | 25,000× per round, counting the trigger spin and its free spins together (Dylan's choice). The spin that reaches it pays only what is left, ends the round and plays Max. A capped round credits exactly 25,000× in cents at $0.10 and $500 (`credit()` in `rules.mjs`). The rules suite reached the cap in 88 rounds and checked the cents of 327 capped rounds. Still to do: watch a live Max on a phone. |
| Feature economics | Calibrated — awaiting Dylan's sign-off | Each mode was fitted to 96% by `tools/math/robobees-fit.mjs`, then checked on independent seeds by `tools/math/robobees-report.mjs` ([MATH.md](MATH.md): 32M base spins, 2M Regular and 2M Super bonuses, 1M Hidden). Base 95.93%, Signal Boost 95.73%, Pollen Charge 96.04%, Hive Overdrive 95.78%, Worker Shift buy 95.94%, Swarm Protocol buy 96.19%, Mystery 96.02%, each ±0.14–0.33% (95% interval). `npm test` fails if the sheet no longer matches the shipped `MATH` block, or any mode falls outside its 99.9% interval. Pollen Charge and Hive Overdrive use the Medium big-hit shape Dylan chose: fewer opening Wilds and more tumble Wilds. MATH.md has a Big hits table. Open: Signal Boost could be tightened toward 96%. |
| Sound and motion sign-off | Open — art / QA | Verify the five stings with real speakers and headphones, all music loops and mix levels, mute/skip and reduced motion on physical iOS and Android devices. |
| Controller, recovery and endurance | Partial — QA | Exercise each shop at stake extremes, reload during each bonus and win count, check saved credits, lifecycle edges and a long autoplay run. Capture cold launch, peak frame time and memory. |
| Lobby and release acceptance | Open — Dylan | Approve thumbnail and full-screen layouts, verify ordinary and lobby links, document the rollback build and sign off after math and device QA. |

Keep evidence on the branch. A preview can verify artwork and controls; math approval requires the actual settled game outcome.
