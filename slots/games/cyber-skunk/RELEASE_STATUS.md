# Cyber Skunk release status

| Game | Branch / source | Playable link | Build / audience | Producer | Art | Math / engineering | QA |
|---|---|---|---|---|---|---|---|
| Cyber Skunk | `claude/blissful-rubin-xou20i`, based on `cf7b4d1` plus the newest scoped handoff | Existing private artifact; URL intentionally omitted from this public record | Private playtest; newest source is not yet republished | Dylan | ChatGPT | Claude | ChatGPT + Claude |

The playable artifact was verified on the earlier revision. The current source adds the 44px portrait BET correction, named Mystery copy and final opening splashes. Do not call those changes live until Claude records browser and served-file parity evidence below.

## 1. Brief and rules

- [x] Theme, six-reel route mechanic, fixed symbols, three bonus tiers and all paid modes are defined in `STYLE.md`, `DESIGN.md` and `MATH.md`.
- [x] Base, Signal Boost, Spray Job, Vent Break, Overpressure, Blackout Protocol and the later 500× Mystery pass derive from shipping rules/catalogs.
- [x] Payout units, bonus floors, 25,000× cap and natural trigger rates are documented in `MATH.md`.

## 2. Art and layout

- [x] Art prep reports 49/49 ART_SPEC inputs, 16/16 registered mascot pieces and no problems.
- [x] Symbols, cabinet, backgrounds, logo, panels, buy cards, wins, effects, intro diagrams, controller texture, icon and opening splashes are shipping assets.
- [x] The articulated v4.1 mascot, seated nozzle, fitted eyelids, card flip and final paying face were browser-checked on the prior artifact revision.
- [ ] Current opening splash crop, single-logo presentation, card contrast and controls need phone/desktop browser evidence.
- [ ] Lobby thumbnail and ordinary lobby entry have not been recorded here.

## 3. Spin and feature flow

- [x] Prior browser evidence exercises base, Enhanced, Feature Spins, Regular, Super and naturally reachable Hidden play.
- [x] Deterministic engine/catalog tests cover routes, scatters, sticky vents, Reservoir, retriggers, skip and the total cap.
- [ ] Re-run all 25 browser checks on the current source and archive current phone/desktop captures.

## 4. Controller and purchases

- [x] Play/Stop, +/−, bet picker, circular Auto, mode shop and confirmations are present.
- [x] Shipping config supplies prices, costs, balance math and mode copy; game tests cover Mystery's 500× price, 90/10 tickets and floors.
- [ ] Measure the portrait BET picker at ≥44px on 360×800, 390×844 and 430×932; exercise BET and both circular −/+ buttons.
- [ ] Confirm the Mystery pass copy has no clipping on those phones.

## 5. Wins, sound and pacing

| Tier | Source art | Runtime status | Current-release evidence |
|---|---|---|---|
| Nice | `art/wins/win-nice.png` | integrated | prior browser build; current rerun pending |
| Big | `art/wins/win-big.png` | integrated | prior browser build; current rerun pending |
| Epic | `art/wins/win-epic.png` | integrated | prior browser build; current rerun pending |
| Mythic | `art/wins/win-mythic.png` | integrated | prior browser build; current rerun pending |
| Max | `art/wins/win-max.png` | integrated | catalog/cap tests pass; current browser rerun pending |

- [x] Original audio and responsive win art were integrated and checked on the prior artifact revision.
- [ ] Current packaged-build audio, mute/skip and win-tier browser checks need to be recorded by Claude.

## 6. Math, settlement and recovery

- [x] `npm run test:cyber-skunk`: 27/27 on 2026-11-02 current source.
- [x] Every paid mode returns 96% of actual cost; exact catalogs replay through the shipping engine.
- [x] Tests cover natural triggers, Mystery selection, bonus floors, finite routes, deterministic replay, rounding and cap accounting.
- [x] `npm test`: 127 pass, 3 documented rig-data skips on 2026-11-02 current source.

## 7. Device QA and release

- [x] Earlier artifact revision: 25 browser checks passed and the private artifact was published.
- [ ] Current source: run at 360×800, 390×844, 430×932, 1366×768 and 1920×1080; verify no scroll, safe areas, first-open/close/focus, “don't show again” and reduced motion.
- [ ] Republish the existing artifact, verify the served commit/file hashes include both splash WebPs and `styles.css?v=20`, and record the rollback point.
- [ ] Dylan and Claude math/engineering sign-off remain the release decision.
