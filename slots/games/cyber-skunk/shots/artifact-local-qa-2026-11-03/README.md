# Local artifact package verification

Tested source: `897de9c4d64d45b8855aa5157e7bb9357f24466d`. New packaging regression: `tests/browser/cyber-skunk-artifact.e2e.mjs`. **8/8 passed, zero skips**, Node 24.22.1 / Playwright 1.64.1 / Chromium 153.0.8010.0. No production runtime, art, math, catalog, rig, audio or builder file changed.

The test invokes the real artifact builder in a temporary directory, copies only the 115 entries named by its `files.json`, and serves that directory. A minimal HTML/viewport wrapper surrounds the exported fragment, modelling a static skeleton. There is no source-tree fallback. All 115 files match their source bytes both on disk and over HTTP. All 119 runtime files plus the builder match the tested Git source after execution. `audit.json` records hashes and all 621 requests; none returned an error. The generated fragment retains the current `stake-prices-1` and `win-keys-1` URLs.

Fresh sessions at 360×740, 390×844, 430×932 and 1366×768 load, contain the controller without horizontal overflow and expose all five paid choices. All three buy confirmations match config prices; cancellation preserves credits. Phone and desktop screenshots were inspected: `artifact-390.jpg`, `artifact-1366.jpg`.

At 390×844 and 1366×768, ordinary crypto draws play base, Signal Boost, Spray Job and purchased Vent Break through the controller. No tickets, fixed seeds, forced bonuses or free previews are injected. Each produces four history rows with costs 100/300/1,000/10,000 cents and exact whole-cent settlement. From 1,000,000 cents, phone ends at 990,580 and desktop at 989,730; recorded catalog seeds and awards are in the audit. Repeated Stop/Start/dismiss actions accelerate presentation while preserving catalog settlement. These eight rounds are smoke coverage, not a distribution or rare-event sample.

Game checks: 29 passed. Core: 127 passed, three existing skips. The previous frozen 46-case source run remains separate evidence; the expanded 54-case glob has not been run together. No new math calibration is claimed.

From `slots/`:

```sh
STUDIO_CHROMIUM_EXECUTABLE=/path/to/chromium \
CYBER_SKUNK_ARTIFACT_EVIDENCE=/tmp/cyber-artifact-proof \
node --test --test-concurrency=1 tests/browser/cyber-skunk-artifact.e2e.mjs
```

This proves local packaging with the stated wrapper. It does **not** test the hosted service's skeleton, sandbox, caching, remote served hashes or physical devices. Claude must still fix the known fixed-seed free-preview path, then rerun the final frozen suite, republish the existing private artifact and provide hosted parity plus device/owner sign-off. This remains a playtest.
