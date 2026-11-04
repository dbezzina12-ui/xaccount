# Cyber Skunk release status

Current ordered continuation tasks: [game-specific handoff](../../collab/CYBER_SKUNK_HANDOFF.md). The studio-wide handoff remains historical context; this scoped log links the newer evidence batches.

| Game | Branch / source | Playable link | Build / audience | Producer | Art | Math / engineering | QA |
|---|---|---|---|---|---|---|---|
| Cyber Skunk | `claude/blissful-rubin-xou20i`, frozen 58-case source `f490a17` | Existing private artifact; URL intentionally omitted from this public record | Private playtest; newest hosted parity unverified | Dylan | ChatGPT | Claude | ChatGPT + Claude |

The playable artifact was verified on an earlier revision. Current source includes the neon GG ident, final splashes, named Mystery copy, card/bonus presentation, shared entry, controller/shop corrections and keyboard award handling. All **58 browser tests passed together** on frozen `f490a17`, including both updated neon expectations. All 132 source fingerprints match that commit and remained unchanged. Core: 134 passed/three existing skips; game: 29 passed. See [combined evidence](shots/combined-58-qa-2026-11-04/README.md). This supersedes the split 56/58 plus focused reruns and earlier 46+8+2+2 gaps for this source. Prior complete catalog replay/report regeneration remains in `shots/frozen-build-qa-2026-11-02/` for unchanged math sources. Source QA does not establish preview fidelity or hosted parity. Preview sampling, physical-device checks and sign-off remain open.

**Local artifact export:** source `897de9c` additionally passes eight new manifest-only package browser checks: 115 exported files byte-match source and HTTP, 621 requests succeed, four viewport launches/shops and eight ordinary shipping rounds settle exactly. All 119 runtime files plus builder match Git. [Evidence and reproduction](shots/artifact-local-qa-2026-11-03/README.md). This uses a minimal local skeleton; the hosted service remains unverified. The new eight cases passed separately from the earlier 46; no combined 54-case run is claimed.

## 1. Brief and rules

- [x] Theme, six-reel route mechanic, fixed symbols, three bonus tiers and all paid modes are defined in `STYLE.md`, `DESIGN.md` and `MATH.md`.
- [x] Base, Signal Boost, Spray Job, Vent Break, Overpressure, Blackout Protocol and the later 500× Mystery pass derive from shipping rules/catalogs.
- [x] Payout units, bonus floors, 25,000× cap and natural trigger rates are documented in `MATH.md`.

## 2. Art and layout

- [x] Art export repeatability from `fca0890`: added twelve explicit source-bound compiled exports so normal prep preserves current symbol, cabinet and logo dimensions/crops. Temporary canonical rebuild matches **68/68** ordinary/mascot outputs byte-for-byte; 202 fingerprints unchanged and all 119 runtime files match Git. Six profile failure/preservation tests pass; inventory 49/49 + 16/16, no problems; core 139 passed/three existing skips and game 29/29. No runtime image, PNG master or fitted rig change. [Report and reproduction](shots/art-export-profile-qa-2026-11-04/README.md). No new browser or hosted claim.

- [x] Compact mascot lineage at `193e044`: canonical temporary export matches all 19 runtime mascot files byte-for-byte, using 14 registered pieces plus fitted eyelids/nozzle; all 16 registered originals are separate 1600×2000 inputs. Crop/pivot/source hashes are recorded. [Audit and reproduction](shots/mascot-lineage-qa-2026-11-04/README.md). This is source/export identity, not hosted or all-pose sign-off.

- [x] Studio loading ident is the neon GG sign Dylan picked on 2026-11-04 (inline SVG, glow without CSS filters). Checked at 1920×1080, 1366×768, 390×844 and 360×800. Evidence: `shots/neon-ident-2026-11-04-*.jpg`. Zombify and RoboBees still use the old diagonal join.

- [x] Read-only inventory rechecked at `8225f1c`: 49/49 required art sources, 16/16 registered pieces, no reported problems. This proves source availability, not every rig pose or current hosted integration. [Audit and links](shots/coordination-audit-2026-11-03/README.md).

- [x] Art prep reports 49/49 ART_SPEC inputs, 16/16 registered mascot pieces and no problems.
- [x] Symbols, cabinet, backgrounds, logo, panels, buy cards, wins, effects, intro diagrams, controller texture, icon and opening splashes are shipping assets.
- [x] The articulated v4.1 mascot, seated nozzle, fitted eyelids, card flip and final paying face were browser-checked on the prior artifact revision.
- [x] Current opening splash crop, single-logo presentation, card contrast and controls inspected at 360/390/430px portrait and 1366/1920px desktop. Evidence: `shots/qa-2026-11-02/`.
- [x] Shared source launch `index.html?game=cyber-skunk` now routes to the standalone shipping runtime rather than requesting a nonexistent legacy model. Desktop/phone launch, real round settlement and reload of settled credits/history pass; seven routing checks preserve the legacy boot calls. [Source patch and evidence](shots/entry-qa-2026-11-03/README.md).
- [ ] Actual lobby thumbnail, external lobby wiring and hosted entry remain unverified.

## 3. Spin and feature flow

- [x] Settings/storage at source `255b8ec`: four desktop/phone cases pass for slider endpoints, sound/speed synchronization, reload persistence, free-play credit reset and usable defaults when storage throws. Menu bounds fit; zero page errors, runtime/helper unchanged. Core 139 passed/three existing skips. [Evidence, reproduction and scope](shots/settings-qa-2026-11-04/README.md). No audible/hosted/device approval; ten browser files now contain 70 cases, with the new four verified separately.

- [x] Existing per-spin Stop scope verified at `6825901`: one Stop in free spin 1 leaves free spin 2 spinning normally, with no early settlement. Vent Break/Overpressure pass at desktop and touch phone; all four cases preserve the exact cost and catalog award. New regression/evidence: `shots/single-stop-qa-2026-11-03/`. Runtime unchanged; this is focused coverage, not a new combined-suite or hosted claim.

- [x] Final-scatter camera source `325a141`: focused six-entry regression passes; normal/Stop/resize/reduced-motion probes restore the wide camera with no leftover animation or gust faces. Evidence and precise scope: `shots/focus-qa-2026-11-02/`.

- [x] Held award layout aligns the large spin numeral to the middle of the viewport with FREE SPINS underneath. Phone checks at 390×740 and 320×568 and short landscape at 844×390 showed zero midpoint offset and no panel scroll.

- [x] Extractor follow-up: all three tiers fit at 844×390; short-landscape Start corrected from 40px to 44px. Portrait/desktop centering, reduced motion, normal entrance and keyboard Start inspected. Evidence: `shots/extractor-qa-2026-11-02/`.
- [ ] **Preview fidelity blocker:** `freePreview()` bypasses shipping catalogs with fixed seed 811. Hidden repeats a 507.4× sample below its shipping 1,000× floor. Claude must replace the default sampler with weighted conditional shipping outcomes and test distribution/floors plus unchanged credits/history.
- All four current preview choices now have a reproducible UI diagnostic at `bef5bcb`: eight invocations, repeated totals, zero catalog-ticket crypto calls, unchanged saved sessions and no page errors. It distinguishes buy/natural pool conditioning and full Spray Job behavior for Claude's repair. [Report and acceptance handoff](shots/preview-fidelity-qa-2026-11-04/README.md). Diagnostic completion does not clear this blocker or constitute a new combined-suite pass.

- [x] Blackout entrance and award spacing. Four landed FS frame the next spinning reel before the fifth symbol settles. Checked a desktop Blackout hit and a portrait Overpressure miss. The hall returns to its normal scale for the nozzle splash, fan and held award. Start reveals the four vents with 3 pressure. Overpressure went directly to the spray and fan. Rules/Start gaps were 18/21px at 1363×936 and 14/17px at 390×740. The numeral remained centered on both axes.
- [x] Extractor entrance on the Vent Hall playtest. The camera splash tracks the animated nozzle and the fan blast lifts and restores reel faces; the title, count, mechanic, kicker and Start were centered to the nearest pixel on desktop and a 390px phone layout. The free previews showed 3/4/5 FS and the corresponding 12/10/10 award. Desktop and 390×844 phone checks covered the held briefing, keyboard/touch Start, and stopping the trigger without skipping the first free spin.

- [x] Prior browser evidence exercises base, Enhanced, Feature Spins, Regular, Super and naturally reachable Hidden play.
- [x] Deterministic engine/catalog tests cover routes, scatters, sticky vents, Reservoir, retriggers, skip and the total cap.
- [x] Historical runtime `d766d02`: 25/25 browser checks passed; phone/desktop captures and complete log archived in `shots/qa-2026-11-02/`.

- [x] Frozen runtime `b533d72`: full run 25 passed/one Studio resize-readiness assertion failed. A 24-switch probe reproduced premature measurements but all settled correctly; the test-only wait now checks completed layout before its original assertions. Focused reruns and original failure are archived in `shots/frozen-build-qa-2026-11-02/`. No final all-26-in-one-run claim or hosted claim.

## 4. Controller and purchases

- [x] Stake-limit follow-up on `3af617f` (`stake-prices-1`): desktop high ticket prices now fit their intrinsic content width. Eight stake cases plus two existing shop cases pass: configured prices, receipt/cancel fields, exact-credit/one-cent-short Regular affordability, and exact 2/2000-cent shipping awards at 10/10000-cent bets. Four viewport price probes and desktop frame reviewed. Synthetic test wallets only; no cost/math change. Evidence/limits: `shots/stake-qa-2026-11-03/`. Not a new combined 46-case or hosted claim.

- [x] Shop bet/Close/Back targets are at least 44px; landscape confirmation shows the whole receipt without initial clipping. Six touch-enabled viewport checks preserve bet, balance and return focus. Reservoir copy derives from the existing config. Evidence: `shots/shop-targets-qa-2026-11-02/`; hosted review remains open.

- [x] Studio aspect-ratio correction after `35da2ee`: stage/controller agree through six desktop/phone/tablet viewport changes on a touch-enabled page; original controls/state survive. The 768×1024 portrait controller is on-screen instead of extending to y=1139. Evidence: `shots/studio-controller-qa-2026-11-02/`.

- [x] Studio desktop/phone controller switching on a touch-style preview. At 1366×768 the desktop bar is 1098px wide and the whole Spin circle is visible. At 390×844 the Slim Rail is 390px wide. Bet adjustments worked after switching back.
- [x] Play/Stop, +/−, bet picker, circular Auto, mode shop and confirmations are present.
- [x] Autoplay queue QA at `160791b`: eight desktop/phone cases cover the selected ten rounds, circular Auto cancellation without skipping the current spin, insufficient credits, and no further paid queue after a shipping natural Regular bonus. Exact history/balances and no unexpected draws. [Evidence](shots/autoplay-qa-2026-11-04/README.md). New eight-case pass is separate from the earlier 58; no combined 66-case or hosted claim.
- [x] Local keyboard dialog QA at `c88fa37`: desktop/phone Enter opens, forward/backward focus traversal, Escape restoration, rules/history navigation and twelve bonus-buy cancellations pass with unchanged wallet/history and no spin. New two-case regression passes separately from the earlier 46+8; no combined 56-case or hosted accessibility claim. [Evidence](shots/dialog-keyboard-qa-2026-11-03/README.md).
- [x] Shipping config supplies prices, costs, balance math and mode copy; game tests cover Mystery's 500× price, 90/10 tickets and floors.
- [x] Portrait BET picker measured exactly 44px at 360×800, 390×844 and 430×932; picker and both circular −/+ buttons exercised. Rectangles/interactions: `shots/qa-2026-11-02/measurements.json`.
- [x] Mystery pass labels, 90/10 odds and 40×/1,000× minimum copy fit at all three phone widths. Screenshot: `shots/qa-2026-11-02/mystery-phone.jpg`.

## 5. Wins, sound and pacing

- [x] Rare MAX-total keyboard checks at `23d7dca`: bought Overpressure on desktop/held Enter and base → Hidden on touch phone/held Escape each settle 25000× once with exact cost/history and no repeat wager. Positive-weight shipping tickets are steered in the fixture; this is not a frequency measurement or an individual MAX-spin keyboard claim. Evidence: `shots/rare-win-keys-qa-2026-11-03/`. Runtime unchanged; targeted 2/2, not a new combined 38-case pass.

- [x] Keyboard award dismissal (`win-keys-1`): Space/Enter/Escape use the pointer-dismiss action; held keys cannot become a second wager; open dialogs keep keyboard priority. Six new cases plus six existing popup/Studio/Stop checks pass, with exact shipping awards/history. Evidence: `shots/win-keys-qa-2026-11-03/`. Source-only patch; not a new combined-suite or hosted claim.

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

- [x] `npm run test:cyber-skunk`: 29/29 on final-scatter source `325a141`; see `shots/focus-qa-2026-11-02/game-tests.txt`.
- [x] Every paid mode returns 96% of actual cost; exact catalogs replay through the shipping engine.
- [x] Tests cover natural triggers, Mystery selection, bonus floors, finite routes, deterministic replay, rounding and cap accounting.
- [x] `npm test`: 127 pass, 3 documented rig-data skips on 2026-11-02 current source.
- [x] Extractor artifact candidate: 115 files, 39 detected static dependencies and 0 missing; refreshed hashes are in `art/source/splash-v1/package-manifest.json`.

## 7. Device QA and release

- [x] Current combined run at `b186858`: **46/46 browser tests, one invocation, zero failures/skips**; game 29/29; core 127 passed/three existing skips; package 115 files/39 detected references/zero missing. No runtime/test edits; 126 fingerprints match before/after and Git. This supersedes earlier split-run and latest-CSS coverage gaps, not preview/hosted/device gates. Evidence: `shots/combined-46-qa-2026-11-03/`.

- [x] Combined local source run at `d0b6f67`: **36/36 browser tests in one invocation, zero skips**; game 29/29; core 127 passed/three existing skips; static package 115 files/39 detected references/zero missing. No runtime/test edits during execution; 124 fingerprints match before/after and the tested commit. This supersedes the earlier split-run limitation, not the preview-fidelity or hosted/physical-device gates. Evidence: `shots/combined-browser-qa-2026-11-03/`.

- [x] Earlier artifact revision: 25 browser checks passed and the private artifact was published.
- [x] Current source packages locally with both splash WebPs and all detected HTML/CSS/JS dependencies. This is not hosted parity.
- [x] Current source inspected at 360×800, 390×844, 430×932, 1366×768 and 1920×1080, with no intro scroll; controller targets and interactions measured. Source browser suite passes guide open/close/reload. The shipping guide intentionally reappears on reload and has no “don't show again” setting.
- [ ] Physical safe areas, iOS/Android performance and reduced-motion/keyboard checks on the hosted build remain open.
- [ ] Republish the existing artifact, verify served source/file hashes include both splash WebPs, `styles.css?v=desktop-rail-1` and `entry-shop.css?v=neon-ident-1`, and record the rollback point.
- Direct-root served-asset checker is available: `node tools/cyber-skunk-served-parity.mjs ASSET_ROOT_URL/ REPORT.json`. It covers 115 files/132 bare and versioned requests plus required JS/CSS/SVG MIME; five local fixture tests and CLI exit checks pass. [Scope and evidence](shots/served-parity-tool-qa-2026-11-04/README.md). It has not checked the hosted artifact and does not verify its entry document, wrapper, rendering or devices.
- [ ] Dylan and Claude math/engineering sign-off remain the release decision.
