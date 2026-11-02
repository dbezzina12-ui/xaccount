# RoboBees release status

**Private playtest.** The [studio checklist](../../collab/GAME_RELEASE_CHECKLIST.md) defines release sign-off. This status tracks current evidence and the work still open. Dylan owns producer approval, ChatGPT owns art and presentation, and Claude owns math calibration.

| Area | Status | Evidence / next check |
|---|---|---|
| 5×4 left-to-right rules and tumbles | Verified in the mechanics build | `node tests/bonus-rules.mjs` checks 50,000 spins, gravity, intersecting paylines, cell multipliers and Wild counts. |
| Symbols and bonus identity | On the main game link | Original machinery in separated colours, animated honey-glass FS, live mascot and sprite fallback. Inspect both graphics paths on physical phones. |
| Bonus buys and feature spins | Playable | Three bonus outcomes, two seeded multiplier features, plus Signal Boost and Scout Run. The 32× isolated replay is `?preview=tumble`. |
| Win presentation | Implemented | Five tier treatments and cues in `?preview=wins`. Test a settled Epic in `?preview=tumble`. First tap reveals the exact amount and second tap continues. Normal play advances automatically. |
| Cap and live Max event | Open — Claude / Dylan | The current model is uncapped. Max has a gallery replay. Connect live Max to an authoritative capped outcome when the ceiling and scope are approved. A high uncapped result remains Mythic. |
| Feature economics | Open — Claude | At 20× and 250× prices, initial 30,000-spin samples averaged 6.27× and 30.73× base bet. Recalibrate and independently verify each paid mode and buy. A Hidden sample exceeded the proposed 25,000× ceiling. |
| Sound and motion sign-off | Open — art / QA | Verify the five stings with real speakers and headphones, all music loops and mix levels, mute/skip and reduced motion on physical iOS and Android devices. |
| Controller, recovery and endurance | Partial — QA | Exercise each shop at stake extremes, reload during each bonus and win count, check saved credits, lifecycle edges and a long autoplay run. Capture cold launch, peak frame time and memory. |
| Lobby and release acceptance | Open — Dylan | Approve thumbnail and full-screen layouts, verify ordinary and lobby links, document the rollback build and sign off after math and device QA. |

Keep evidence on the branch. A preview can verify artwork and controls; math approval requires the actual settled game outcome.
