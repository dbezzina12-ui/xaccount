# Combined source-build QA — 2026-11-03

Tested commit: `d0b6f679069db99831d21b8b7b866271620e8b61`. **36/36 browser tests passed in one sequential invocation; zero failures and zero skips.** Node 24.22.1, Playwright 1.64.1, Chromium 153.0.8010.0. All three Cyber Skunk browser files are included; `browser-tests.txt` and `audit.json` record the result. No runtime or test file was edited during this run, and no case was removed or skipped to obtain a pass.

`audit.json` fingerprints all 119 runtime files, three browser files and two shared test helpers before/after the run. All 124 final fingerprints match both the initial records and the tested Git commit. It also checks that the existing math report's engine/rules/catalog hashes still match. This batch does not rerun or rewrite Claude's math report: the complete catalog replay and identical report regeneration remain in `../frozen-build-qa-2026-11-02/` for those unchanged sources.

`game-tests.txt` records 29 game tests passing. `core-tests.txt` records 127 passing with three existing skips. `package.txt` records 115 files, 39 detected static references and zero missing. Static dependency detection is not a claim to discover every dynamic reference.

Browser cases cover paid modes, normal/skip settlement, controls, loading, intro, menu/confirmation, scatter/bonus entry, rare cap/retrigger paths, recovery, audio levels, Studio switching, per-spin Stop and award keyboard handling. Rare paths steer tickets from real shipping catalogs; they prove presentation/accounting paths, not natural occurrence frequencies. The suite does not prove free-preview distribution fidelity: the already-reported fixed-seed bypass remains open.

This is local Chromium evidence. It does not establish hosted publication/hash parity, physical iOS/Android behavior, or owner/math-owner sign-off. The game remains a playtest until those gates and preview sampling are cleared.

From `slots/` at the tested commit, with Playwright installed:

```sh
STUDIO_CHROMIUM_EXECUTABLE=/path/to/chromium node --test --test-concurrency=1 tests/browser/cyber-skunk*.e2e.mjs
npm run test:cyber-skunk
npm test
node games/cyber-skunk/art/source/splash-v1/verify-package.mjs
```

Omit the browser override when Playwright's bundled Chromium is installed. Older scoped reports retain their original limitations; this log is the evidence to consult for this combined source revision.
