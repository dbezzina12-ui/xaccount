# Combined browser verification — 2026-11-03

Tested source: `b1868581a07262793ac46d6565171eb2ebeaa41e`. **46/46 browser tests passed in one sequential invocation, zero failures and zero skips.** Node 24.22.1, Playwright 1.64.1, Chromium 153.0.8010.0. All five Cyber Skunk browser files are included; `browser-tests.txt` and `audit.json` record the result. All 126 fingerprints match the tested Git commit and their initial values after execution. No runtime or test file changed; only evidence and release documentation change in this batch.

The fingerprint set contains 119 runtime files, five browser test files and two shared helpers (126 files). It includes the latest desktop intrinsic price width/CSS cache change, rare MAX total keyboard paths, stake-limit/cent-accounting cases, per-spin Stop and ordinary award-keyboard regressions, together with the original game suite. No case is removed or skipped to obtain a pass.

`game-tests.txt` records 29 passed. `core-tests.txt` records 127 passed and three existing skips. `package.txt` records 115 packaged files, 39 detected static references and zero missing. The existing math report's engine/rules/catalog source hashes still match; no new RTP calibration, catalog replay or report regeneration is claimed.

Rare-path and accounting fixtures steer positive-weight shipping tickets. They exercise real replay/UI/settlement paths; they do not measure random occurrence frequencies. Some pricing pages use isolated synthetic wallets to cover large buys, without changing shipping credits.

**Open gates:** the known fixed-seed `freePreview()` bypass is not cleared by these tests. Hosted republish/served-file parity, physical iOS/Android and producer/math-owner sign-off also remain unverified. This is local source-build evidence, not a completed-release claim.

From `slots/` at the tested commit, with Playwright installed:

```sh
STUDIO_CHROMIUM_EXECUTABLE=/path/to/chromium node --test --test-concurrency=1 tests/browser/cyber-skunk*.e2e.mjs
npm run test:cyber-skunk
npm test
node games/cyber-skunk/art/source/splash-v1/verify-package.mjs
```

Omit the override if Playwright's bundled browser is installed. Older scoped reports retain their original counts and limitations; consult this report for this combined source revision.
