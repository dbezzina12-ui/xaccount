# Combined 58-case source verification

Tested source: `f490a174627efe0363ec7e4003c928eafe661fe0`, Claude's Dylan-selected neon GG ident plus both updated test expectations. **All eight Cyber Skunk browser files passed together: 58/58, zero failures/skips**, in 1,123 seconds. Node 24.22.1, Playwright 1.62.1, Chromium 153.0.8010.0. This clears the combined-run gap in Claude's November 4 handoff. No runtime, browser test, math, rig, audio or image file changes in this batch.

All **132 fingerprints** match the tested Git source and remained unchanged throughout execution: 119 runtime files, eight browser files, two shared helpers, artifact builder, shared launch HTML and routing unit test. `audit.json` records before/after hashes and exit status. The slow-load `.neon-sign` test and isolated artifact `neon-ident-1` expectation both pass in this one run, alongside existing gameplay, accounting, Stop, keyboard, stake-limit, MAX-total, scatter-entry, reload and controller checks. No case was skipped or removed.

Core: **134 passed, three existing skips** (137 total), rather than a claim of 137 executed passes. Game: **29/29**. The real static package check passes **115 files, 38 detected references, zero missing**. Its saved manifest was stale after the inline neon mark/CSS change and is refreshed in this batch. The one fewer detected reference follows removal of the old external loading-mark reference. The CSS and page hashes now describe the tested neon build; app/launch and the other required-file hashes remain unchanged.

The existing math report's engine/rules/catalog input hashes still match. This is no new calibration, full catalog replay or frequency measurement. Rare-path fixtures deliberately select positive-weight shipping tickets to validate presentation and settlement; they do not estimate max-win odds. The ordinary export/entry smoke checks use shipping crypto draws. The preview credit/history test passing does not fix `freePreview()`'s known fixed-seed bypass or Hidden floor mismatch.

Reproduce from `slots/` at the tested source, with Playwright and Chromium available:

```sh
STUDIO_CHROMIUM_EXECUTABLE=/path/to/chromium \
node --test --test-concurrency=1 tests/browser/cyber-skunk*.e2e.mjs
npm test
npm run test:cyber-skunk
node games/cyber-skunk/art/source/splash-v1/verify-package.mjs
```

Open release gates remain: weighted conditional shipping previews with floor/diversity/credits/history validation; existing private artifact republish and served-file parity; real lobby/thumbnail, physical iOS/Android, and producer/math-owner sign-off. The exported-artifact tests use a local minimal skeleton and do not establish hosted-service behavior. This remains a private playtest, not a completed release.
