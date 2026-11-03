# Rare MAX-total keyboard QA — 2026-11-03

Tested source: `23d7dcaf5cf28084ce08e6439f772b83b229eab0`. Node 24.22.1, Playwright 1.64.1, Chromium 153.0.8010.0. No runtime, math, catalog, art, rig or audio file changed.

Two focused browser cases pass through real shipping `drawRound()` paths and UI:

| Case | Cost, cents | Bonus seed | Award, cents | Dismiss key | Final balance, cents |
|---|---:|---:|---:|---|---:|
| Desktop bought Overpressure | 25000 | 614838 | 2500000 | Held Enter on Play | 3475000 |
| Touch phone base → Blackout | 100 | 68471 (entry seed 40) | 2500000 | Held Escape | 3499900 |

Starting balance is 1000000 cents and base bet 100 cents. Before dismissal, MAX WIN is visible as a bonus total, the pending award equals the cap, history is empty and balance reflects only the original debit. After dismissal and repeated keydown/release, the popup amount is `$25,000.00`, exactly one history row records the correct mode/tier/cost/award, balance is exact, and no second wager starts. No page errors occur.

The fixture selects positive-weight shipping tickets, not the free-preview path or a hand-built outcome. Base has 6585 Hidden-tier tickets out of 1000000000; the selected Hidden cap row has weight 40901. The selected bought-Super cap row has weight 308. This demonstrates the supported base-entry path and cap settlement under ticket steering; it does not measure random occurrence frequency or recalibrate RTP. The existing report remains authoritative for distributions.

The driver clicks Start once and waits while the entry dialog closes. It fast-forwards earlier spins/popups with atomic scope checks, so it cannot accidentally dismiss the final total before the real keyboard action under test. Scope is **MAX bonus totals**, not individual MAX-spin popup keyboard behavior, all keys/devices, physical phones or hosted parity.

`browser-tests.txt`: 2/2 targeted passes. `cases.json`: observed states. `game-tests.txt`: 29 passed. `core-tests.txt`: 127 passed/three existing skips. The prior frozen 36-case pass remains in `../combined-browser-qa-2026-11-03/`; this is not a new combined 38-case pass. Fixed-seed free-preview fidelity and hosted/device/sign-off gates remain open.

From `slots/` with Playwright installed:

```sh
STUDIO_CHROMIUM_EXECUTABLE=/path/to/chromium node --test tests/browser/cyber-skunk-rare-win-keys.e2e.mjs
```

Set `CYBER_SKUNK_RARE_KEYS_EVIDENCE` to save the two JSON records. After Claude's next runtime change, run all four browser files with `node --test --test-concurrency=1 tests/browser/cyber-skunk*.e2e.mjs` and the browser override when needed.
