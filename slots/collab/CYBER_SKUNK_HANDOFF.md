# Cyber Skunk continuation log

Newest entry first. Read alongside the [studio history](HANDOFF.md). This game-only log links the scoped batches without copying unrelated studio history or private playable URLs.

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
