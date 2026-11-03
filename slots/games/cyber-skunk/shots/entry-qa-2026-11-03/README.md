# Shared launch route correction

Base `c27480d447704989c32694c6ced15b7cbf034bb8` plus the hashed `slots/index.html` patch in this batch. Previously `slots/index.html?game=cyber-skunk` invoked the old model-based launcher, which requests a nonexistent Cyber Skunk `model.json`. That game selection now replaces the page with `games/cyber-skunk/runtime/index.html`. Other query values and the fragment survive; `game` is removed. Default and other game selections retain the legacy boot call. Direct runtime/artifact entry is unchanged.

**Browser: 2/2 passed**, desktop 1366×768 and touch phone 390×844. Node 24.22.1, Playwright 1.62.1, Chromium 153.0.8010.0. Each starts through the shared route, proves no `model.json` request and a real shipping catalog load, dismisses the normal intro, plays an ordinary crypto-drawn base round and checks exact cost/win/balance/history. Reload retains credits and the one settled history entry, with no active round. No outcome fixture or preview bypass is injected. `desktop.json` and `phone.json` record the seeds, awards, request counts and model/catalog booleans. Request URLs are omitted: automated approval review rejected a raw localhost UUID-bearing trace as possible session metadata. No page errors or failed requests occurred.

The seven routing checks in `tests/cyber-skunk-entry.test.mjs` exercise the shipped inline decision, including a nested deployment path, parameters/hash, and legacy default/Game 001/Zombify/Night Fall calls. Core: **134 passed, three existing skips**. Game: **29 passed**. All 119 runtime files and the old client launcher match Git (`source-audit.json`). Only the shared HTML launch decision changes production behavior; math, rig, audio, catalogs, assets and the standalone runtime are unchanged.

The initial browser fixture referenced the app global before it existed after redirect; both cases stopped with a ReferenceError (`initial-fixture.txt`). The final readiness predicate uses `window.cyberSkunk?.state.ready`, retaining every navigation and settlement assertion. Standard browser installation returned truncated archives; validation used the alternate Chromium distribution. Neither dependency recovery nor the initial fixture failure is a game-release failure.

From `slots/`:

```sh
STUDIO_CHROMIUM_EXECUTABLE=/path/to/chromium \
CYBER_SKUNK_ENTRY_EVIDENCE=/tmp/entry-proof \
node --test --test-concurrency=1 tests/browser/cyber-skunk-entry.e2e.mjs
npm test
npm run test:cyber-skunk
```

This clears the local shared-route launch gap. It does not approve a lobby thumbnail, prove an external lobby links here, update the private artifact or clear hosted parity. The expanded eight-file/58-case browser glob has not run together; previous 46+8+2 and these two entry cases are separate evidence. Preview sampling, hosted/device verification and final sign-off remain open.
