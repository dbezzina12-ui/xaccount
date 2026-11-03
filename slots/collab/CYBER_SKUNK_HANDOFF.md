# Cyber Skunk continuation log

Newest entry first. Read alongside the [studio history](HANDOFF.md). This game-only log links the scoped batches without copying unrelated studio history or private playable URLs.

## 2026-11-03 08:34 Toronto · ChatGPT → Claude · Keyboard dialog regression

**Picked up:** `c88fa37`; no newer Claude handoff. Production files are unchanged. Added desktop/phone keyboard QA for shop, bet picker, autoplay, settings, rules/history and all three buy cancellations via both Escape and Enter on Back. Focus returns to the correct controller/card; all twelve cancellations preserve credits/history and leave play idle. **2/2 passed**; core 127 passed/three existing skips. [Logs, initial fixture timeout, source hashes and reproduction](../games/cyber-skunk/shots/dialog-keyboard-qa-2026-11-03/README.md).

**Next for Claude:** 1. Fix weighted conditional shipping preview selection, floors/diversity and unchanged credits/history. 2. Refresh package hashes and freeze the final source; run all **seven** `tests/browser/cyber-skunk*.e2e.mjs` files together (currently 56 cases), plus game/core checks. Current 46+8+2 passes are separate runs. 3. Republish the existing private artifact and return served hashes plus phone/desktop proof; finish physical-device and producer/math-owner sign-off.

**Questions for Dylan:** none. **Blocked on:** existing sampler/hosted/device/sign-off gates. CS-06/CS-07 remain open; continuation stays enabled.

## 2026-11-03 07:35 Toronto · ChatGPT → Claude · Exported artifact tested locally

**Picked up:** `897de9c`; no newer Claude sampler/publication handoff. Added a packaging browser regression and evidence; production runtime/art/math/rig/audio/builder are unchanged.

**Did/checked:** real artifact builder, isolated manifest-only directory and a minimal local HTML skeleton: **8/8 passed**. All 115 exported files match source and HTTP bytes; 119 runtime files plus builder match Git. All 621 requests succeeded. Four widths (360/390/430/1366) launch and expose config-priced buys/features; phone/desktop screenshots inspected. Eight ordinary crypto-drawn shipping rounds cover base, Enhanced, Feature and Regular bonus with exact history/balance accounting. Game 29 passed; core 127 passed/three existing skips. [Evidence, seeds, hashes, limits and reproduction](../games/cyber-skunk/shots/artifact-local-qa-2026-11-03/README.md).

**Scope:** local package verification, not hosted-service/sandbox/cache parity. Earlier 46-case source pass remains valid for unchanged runtime; the new eight cases passed separately, not as one 54-case run. This does not clear the preview sampler or final release gates.

**Next for Claude:** 1. Replace fixed-seed `freePreview()` with weighted conditional shipping pools and validate floors/diversity/distribution plus unchanged credits/history. 2. Refresh package hashes after that runtime edit; freeze and run all **six** `tests/browser/cyber-skunk*.e2e.mjs` files together (currently 54 cases), plus game/core checks. `CYBER_SKUNK_ARTIFACT_EVIDENCE` optionally records package proof. 3. Republish the existing private artifact; return exact source/served hashes and phone/desktop evidence. Complete physical-device and owner/math-owner sign-off before calling it finished.

**Questions for Dylan:** none. **Blocked on:** existing sampler, hosted/device checks and sign-off. CS-06/CS-07 remain open; continuation remains enabled.

## 2026-11-03 06:26 Toronto · ChatGPT → Claude · Frozen 46-case source pass

**Picked up:** `b186858`; no newer Claude sampler/publication handoff was present. No runtime, tests, math, catalog, art, rig or audio changed in this batch.

**Did/checked:** all five Cyber Skunk browser files pass together: **46/46, zero failures/skips**. This includes the latest desktop price-width CSS plus stake, rare MAX-total, Stop and award-keyboard checks and the original game suite. All 119 runtime files, five browser files and two helpers match both their initial fingerprints and the tested Git commit. Game 29/29; core 127 passed/three existing skips; package 115 files/39 detected references/zero missing. Existing math-report source hashes still match; no new replay/calibration is claimed. [Complete log, audit and reproduction](../games/cyber-skunk/shots/combined-46-qa-2026-11-03/README.md).

**Scope:** supersedes the earlier split-run/46-case gap for this source, including `stake-prices-1`. It does not clear fixed-seed preview fidelity, hosted parity, physical devices or final sign-off. Still a playtest; CS-06/CS-07 remain open.

**Next for Claude:** 1. Replace `freePreview()`'s fixed-seed bypass with documented weighted conditional shipping pools; validate floors, distribution/diversity and unchanged credits/history. 2. After that runtime edit, refresh package hashes, freeze the final tree and rerun `node --test --test-concurrency=1 tests/browser/cyber-skunk*.e2e.mjs` plus game/core checks. Preserve all current UI/rig guards. 3. Republish the existing private artifact and return exact published source, served hashes and phone/desktop evidence; complete physical-device and owner/math-owner checks before declaring completion.

**Questions for Dylan:** none. **Blocked on:** existing preview sampler and hosted/device verification/sign-off. Keep continuation enabled.

## 2026-11-03 05:22 Toronto · ChatGPT → Claude · Current source and blockers made discoverable

**Picked up:** `8225f1c`. No newer Claude preview-sampler/publication handoff was present. The top of the studio log predates several scoped batches, and STYLE still described the game as only a first style frame. STYLE now links here and distinguishes the original provisional brief from shipping config/current rig contract. No runtime, math, rig, audio, production-art or test file changed.

**Fresh checks:** read-only prep finds **49/49 art sources, 16/16 registered pieces, no problems**. The legacy preview code still calls `seeded(811)`; its Hidden result remains below the shipping pool's floor. Existing math-report source hashes and required package-file hashes match current inputs. Local links are checked. Evidence and precise limits: [coordination audit](../games/cyber-skunk/shots/coordination-audit-2026-11-03/README.md).

**Current evidence to preserve:**

- [Latest desktop price correction and stake QA](batches/2026-11-03-0424-cyber-skunk-stakes.md): source `8225f1c`, 10 targeted browser passes, not a combined 46-case pass.
- [Frozen combined browser run](batches/2026-11-03-0226-cyber-skunk-combined-qa.md): 36/36 on `d0b6f67`, before the later CSS correction.
- [Rare MAX total keyboard paths](batches/2026-11-03-0326-cyber-skunk-rare-win-keys.md): two targeted shipping-path checks; not an empirical frequency estimate.
- [Complete catalog replay/report reproduction](batches/2026-11-02-2320-cyber-skunk-frozen-qa.md): 149276 entries and 63000 draws replayed, byte-identical reports for unchanged math sources. No new replay is claimed today.
- [Release checklist/status](../games/cyber-skunk/RELEASE_STATUS.md): CS-06/CS-07 stay open. No evidence here establishes current hosted parity or physical-device sign-off.

**Next for Claude, in order:**

1. Replace `freePreview()`'s fixed-seed bypass with weighted conditional shipping outcomes. State the tier pool used by each preview; check floors, distribution/diversity and unchanged credits/history. Keep Hidden reachable through the existing paid-play trigger path. Do not alter calibrated math merely to fit a demonstration.
2. Refresh package hashes after that runtime change. Freeze the resulting source and run all five browser files: `node --test --test-concurrency=1 tests/browser/cyber-skunk*.e2e.mjs`, plus required game/core checks. Preserve per-spin Stop reset, held-key guards, bounded Studio readiness, intrinsic desktop price widths, four-FS camera and fitted v4.1 eyelids/nozzle.
3. Republish the existing private artifact and record the exact published source plus served-file/hash parity and phone/desktop evidence. Physical iOS/Android and producer/math-owner checks still precede completion.

**Next for ChatGPT:** pick up a concrete source-art/UI issue from Claude's screenshots or continue independent QA; required art sources are delivered. Optional jaw/head work requires a matched current contract, not an obsolete fit.

**Questions for Dylan:** none. **Blocked on:** existing preview-sampler correction and hosted/device verification/sign-off. Keep continuation enabled. No completion claim.
