# Frozen Cyber Skunk source QA — 2026-11-02

Tested runtime: `b533d725d42e88a0f7467ac151fd7b9c578d77ee`. Node 24.22.1, Playwright 1.64.1, Chromium 153.0.8010.0. Runtime, engine, catalog, rules, browser test and math tools remained unchanged throughout the initial full run. After it finished, only the Studio test's readiness wait was corrected; all 119 runtime file hashes still match the frozen source.

## Evidence and limits

- `audit.json` records all 119 runtime file hashes, full math source/report hashes, paid-mode distributions, conditional bonus statistics and open gates.
- `catalog-replay.txt`: all 149,276 shipping entries replay exactly, plus 63,000 drawn rounds (20,000 each Base/Signal Boost/Spray Job; 1,000 each Vent Break/Overpressure/Mystery). The verifier's deterministic LCG starts at 7. Zero mismatches. This sampling is additional replay coverage, not an empirical estimate of rare max odds.
- `report-regeneration.txt`: the existing report generator ran in an isolated copy. Both generated `MATH.md` and `math/summary.json` are byte-identical to the committed versions. Their three recorded source hashes match. No math file was replaced. Exact weighted paid-mode calculations reproduce 96.000000% relative to each configured cost; session figures remain sampled as labelled by Claude's report.
- Hidden is a conditional pool, not a separately priced buy. Its 1,000× floor and approximately 1-in-200 cap frequency reproduce. Its contribution is included in naturally triggering paid modes and Mystery. This does not establish a separate 96% denominator for Hidden.
- `game-tests.txt`: 29/29. `core-tests.txt`: 127 passed, three existing skips. `package.txt`: 115 packaged files, 39 detected static references, zero missing. The static checker is not a claim that every dynamic reference was discovered.
- `browser-suite.txt` records the complete frozen-source browser run: **25 passed, one failed**. The Studio test sampled `bar.bottom` after the controller's layout flag changed but before resize fitting finished. The original isolated rerun passed (`original-studio-recheck.txt`). The repeated probe caught four premature desktop measurements at bottom 2110.73px; all 24 settled correctly (desktop bottom 760.12px at 768px height), preserved the Play node and preserved balance (`layout-probe.json`). The test now waits up to five seconds for stage/controller/parent and the required desktop geometry, retaining its original assertions. The three `corrected-studio-*.txt` logs record **3/3 passing focused reruns** after this test-only change. No new all-26-in-one-run pass is claimed. Rare-path cases steer shipping catalog tickets to exercise flow and settlement; they do not measure natural occurrence rates.

The known `freePreview()` fixed-seed bypass is **still open**. Shipping catalog replay and a Hidden pool floor do not validate that separate preview path. No hosted republish, served-file parity, physical iOS/Android test or producer/math-owner sign-off is claimed.

## Reproduce

From `slots/` at the tested commit, with Playwright installed:

```sh
STUDIO_CHROMIUM_EXECUTABLE=/path/to/chromium node --test --test-concurrency=1 tests/browser/cyber-skunk.e2e.mjs
npm run test:cyber-skunk
npm test
node tools/math/cyber-skunk-verify.mjs --draws 20000
node games/cyber-skunk/art/source/splash-v1/verify-package.mjs
```

The initial full log uses the original test at `b533d72`. On this evidence commit, repeat the corrected case with `node --test --test-name-pattern='Studio desktop uses' tests/browser/cyber-skunk.e2e.mjs`. The same Chromium override applies. Run `node games/cyber-skunk/shots/frozen-build-qa-2026-11-02/layout-probe.mjs` for the 24-switch measurements; it writes JSON to `/tmp/`.

For report regeneration, export the tested commit to a temporary directory with `git archive`, then run `node slots/tools/math/cyber-skunk-report.mjs` there. Compare its two outputs with the committed files using `cmp`. The generator writes those outputs, so use the isolated copy when preserving Claude's working files. The report's prose mentions the original larger replay run; this independent replay uses the explicit smaller draw count above.
