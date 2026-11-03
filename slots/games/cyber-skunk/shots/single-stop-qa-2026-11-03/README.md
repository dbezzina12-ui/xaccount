# Single-Stop bonus regression — 2026-11-03

Source: `68259011df23679b1b76b0797cde0d59550780cb`. Node 24.22.1, Playwright 1.64.1, Chromium 153.0.8010.0. No runtime, engine, catalog, rig, audio or production-art file changed.

Four focused browser cases passed: Vent Break and Overpressure at 1366×768 desktop and 390×844 touch phone. Each buys through the real shop and confirmation, starts the bonus, presses Stop **once** during free spin 1, then leaves the controller untouched while checking free spin 2. After another 200ms, all six reels still spin, `skip` is false, the bonus remains busy, history has no completed round and the balance still contains only the original debit. Subsequent deliberate Stops finish the remaining spins; one history row and the final balance must match the catalog outcome exactly. No page errors occurred.

| Paid mode | Shipping seed | Cost, cents | Award, cents | Next spin | Balance during bonus | Final balance |
|---|---:|---:|---:|---|---:|---:|
| Vent Break | 653812 | 10000 | 20 | 2 / 12 | 990000 | 990020 |
| Overpressure | 253677 | 25000 | 0 | 2 / 10 | 975000 | 975000 |

Both viewport cases produced these values. Starting balance is 1,000,000 cents, base bet 100 cents. The fixture queues a ticket for the lowest-paying existing row of each shipping buy pool; the game still draws and replays that row normally. It is a pacing/accounting regression, not a distribution or preview-fidelity test. Quiet outcomes intentionally avoid win-tier popups. Hidden, retriggers, Stop during a win popup, physical devices and hosted parity are outside these four cases.

`browser-tests.txt` is the focused four-case log; the four JSON files contain observed values. `game-tests.txt`: 29 passed. `core-tests.txt`: 127 passed, three existing skips. The prior 26-case suite was not repeated for this test-only addition; its original result and Studio readiness correction remain recorded in `../frozen-build-qa-2026-11-02/`. Do not claim one new 30-case combined pass.

From `slots/`, with Playwright installed:

```sh
STUDIO_CHROMIUM_EXECUTABLE=/path/to/chromium node --test tests/browser/cyber-skunk-stop.e2e.mjs
```

Set `CYBER_SKUNK_STOP_EVIDENCE` to an output directory to save the four JSON records. To run both Cyber Skunk browser files after Claude's next runtime change, use `node --test --test-concurrency=1 tests/browser/cyber-skunk*.e2e.mjs` with the same browser override when needed.
