# Cyber Skunk release status

| Game | Branch / source | Playable link | Build / audience | Producer | Art | Math / engineering | QA |
|---|---|---|---|---|---|---|---|
| Cyber Skunk | `claude/blissful-rubin-xou20i`, tested runtime `d766d02` plus the newest evidence handoff | Existing private artifact; URL intentionally omitted from this public record | Private playtest; newest source is not yet republished | Dylan | ChatGPT | Claude | ChatGPT + Claude |

The playable artifact was verified on the earlier revision. The current source adds the 44px portrait BET correction, named Mystery copy and final opening splashes. Do not call those changes live until Claude records browser and served-file parity evidence below.

## 1. Brief and rules

- [x] Theme, six-reel route mechanic, fixed symbols, three bonus tiers and all paid modes are defined in `STYLE.md`, `DESIGN.md` and `MATH.md`.
- [x] Base, Signal Boost, Spray Job, Vent Break, Overpressure, Blackout Protocol and the later 500× Mystery pass derive from shipping rules/catalogs.
- [x] Payout units, bonus floors, 25,000× cap and natural trigger rates are documented in `MATH.md`.

## 2. Art and layout

- [x] Art prep reports 49/49 ART_SPEC inputs, 16/16 registered mascot pieces and no problems.
- [x] Symbols, cabinet, backgrounds, logo, panels, buy cards, wins, effects, intro diagrams, controller texture, icon and opening splashes are shipping assets.
- [x] The articulated v4.1 mascot, seated nozzle, fitted eyelids, card flip and final paying face were browser-checked on the prior artifact revision.
- [x] Current opening splash crop, single-logo presentation, card contrast and controls inspected at 360/390/430px portrait and 1366/1920px desktop. Evidence: `shots/qa-2026-11-02/`.
- [ ] Lobby thumbnail and ordinary lobby entry have not been recorded here.

## 3. Spin and feature flow

- [x] Held award layout aligns the large spin numeral to the middle of the viewport with FREE SPINS underneath. Phone checks at 390×740 and 320×568 and short landscape at 844×390 showed zero midpoint offset and no panel scroll.

- [x] Extractor follow-up: all three tiers fit at 844×390; short-landscape Start corrected from 40px to 44px. Portrait/desktop centering, reduced motion, normal entrance and keyboard Start inspected. Evidence: `shots/extractor-qa-2026-11-02/`.
- [ ] **Preview fidelity blocker:** `freePreview()` bypasses shipping catalogs with fixed seed 811. Hidden repeats a 507.4× sample below its shipping 1,000× floor. Claude must replace the default sampler with weighted conditional shipping outcomes and test distribution/floors plus unchanged credits/history.

- [x] Extractor entrance on the Vent Hall playtest. The camera splash tracks the animated nozzle and the fan blast lifts and restores reel faces; the title, count, mechanic, kicker and Start were centered to the nearest pixel on desktop and a 390px phone layout. The free previews showed 3/4/5 FS and the corresponding 12/10/10 award. Desktop and 390×844 phone checks covered the held briefing, keyboard/touch Start, and stopping the trigger without skipping the first free spin.

- [x] Prior browser evidence exercises base, Enhanced, Feature Spins, Regular, Super and naturally reachable Hidden play.
- [x] Deterministic engine/catalog tests cover routes, scatters, sticky vents, Reservoir, retriggers, skip and the total cap.
- [x] Current runtime `d766d02`: 25/25 browser checks passed; phone/desktop captures and complete log archived in `shots/qa-2026-11-02/`.

## 4. Controller and purchases

- [x] Play/Stop, +/−, bet picker, circular Auto, mode shop and confirmations are present.
- [x] Shipping config supplies prices, costs, balance math and mode copy; game tests cover Mystery's 500× price, 90/10 tickets and floors.
- [x] Portrait BET picker measured exactly 44px at 360×800, 390×844 and 430×932; picker and both circular −/+ buttons exercised. Rectangles/interactions: `shots/qa-2026-11-02/measurements.json`.
- [x] Mystery pass labels, 90/10 odds and 40×/1,000× minimum copy fit at all three phone widths. Screenshot: `shots/qa-2026-11-02/mystery-phone.jpg`.

## 5. Wins, sound and pacing

| Tier | Source art | Runtime status | Current-release evidence |
|---|---|---|---|
| Nice | `art/wins/win-nice.png` | integrated | source spin/bonus popup suite passes; hosted verification pending |
| Big | `art/wins/win-big.png` | integrated | source spin/bonus popup suite passes; hosted verification pending |
| Epic | `art/wins/win-epic.png` | integrated | source spin/bonus popup suite passes; hosted verification pending |
| Mythic | `art/wins/win-mythic.png` | integrated | source spin/bonus popup suite passes; hosted verification pending |
| Max | `art/wins/win-max.png` | integrated | source rare-cap and total-win browser checks pass; hosted verification pending |

- [x] Original audio and responsive win art were integrated and checked on the prior artifact revision.
- [x] Current source browser suite passes offline audio levels, skip and spin/bonus win-total presentation. Hosted-build audio/mute and physical-phone checks remain open.

## 6. Math, settlement and recovery

- [x] `npm run test:cyber-skunk`: 29/29 on extractor source `2ed2531`; see `shots/extractor-qa-2026-11-02/game-tests.txt`.
- [x] Every paid mode returns 96% of actual cost; exact catalogs replay through the shipping engine.
- [x] Tests cover natural triggers, Mystery selection, bonus floors, finite routes, deterministic replay, rounding and cap accounting.
- [x] `npm test`: 127 pass, 3 documented rig-data skips on 2026-11-02 current source.
- [x] Extractor artifact candidate: 115 files, 39 detected static dependencies and 0 missing; refreshed hashes are in `art/source/splash-v1/package-manifest.json`.

## 7. Device QA and release

- [x] Earlier artifact revision: 25 browser checks passed and the private artifact was published.
- [x] Current source packages locally with both splash WebPs and all detected HTML/CSS/JS dependencies. This is not hosted parity.
- [x] Current source inspected at 360×800, 390×844, 430×932, 1366×768 and 1920×1080, with no intro scroll; controller targets and interactions measured. Source browser suite passes guide open/close/reload. The shipping guide intentionally reappears on reload and has no “don't show again” setting.
- [ ] Physical safe areas, iOS/Android performance and reduced-motion/keyboard checks on the hosted build remain open.
- [ ] Republish the existing artifact, verify the served commit/file hashes include both splash WebPs and `styles.css?v=20`, and record the rollback point.
- [ ] Dylan and Claude math/engineering sign-off remain the release decision.
