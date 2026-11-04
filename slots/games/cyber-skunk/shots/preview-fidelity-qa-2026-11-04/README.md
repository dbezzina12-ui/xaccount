# Four-choice preview fidelity diagnostic

Source `bef5bcb0f2c3f13b6b906bea731af9cea15399cb`; runtime matches the previously frozen `f490a17` build. No runtime, outcome selection, catalog, math, rig, audio or production art changes. This batch makes the existing preview blocker reproducible through all four current shop buttons. It does not fix or clear it.

Eight actual UI invocations completed: two per choice, desktop 1366×768, $1 base bet. The UI receives no test tickets or resolver overrides; a separate offline seed-811 replay is used only for comparison. A DOM observer records rendered award amounts; a delegating wrapper counts two-word crypto calls used by catalog tickets without changing their output. The probe uses ordinary Start/Stop/dismiss controls to finish presentation.

| Preview choice | First displayed total | Second displayed total | Catalog-ticket crypto calls | Balance/saved session |
|---|---:|---:|---:|---|
| Spray Job | 0× | 0× | 0 / 0 | unchanged |
| Vent Break | 8.2× | 8.2× | 0 / 0 | unchanged |
| Overpressure | 9.6× | 9.6× | 0 / 0 | unchanged |
| Blackout Protocol | 507.4× | 507.4× | 0 / 0 | unchanged |

Every observed total matches the inspected `seeded(811)` resolver call. In the current positive-weight shipping pools, seed 811 is absent from the Regular/Super buy pools, their separate natural pools, Hidden and no-bonus Spray Job pool. Hidden's positive-weight shipping minimum is **1,000×**, so its 507.4× preview violates the shipping support. `report.json` records pool support, row counts, ticket sums and all eight runs. These observations plus source inspection establish the current deterministic bypass; two runs per choice do not estimate a distribution or prove a future sampler's diversity.

Every invocation returned to the shop idle, with the wallet, previous win and complete saved session unchanged. Page errors: zero. All **119 runtime files match Git after the probe** (`source-audit.json`); the app hash captured at probe start also matches. Core: **134 passed, three existing skips**. The earlier 58-case combined pass remains the source-suite evidence; it was not rerun. Node 24.22.1 / Playwright 1.62.1 / Chromium 153.0.8010.0.

The initial harness observed an accessor on a copy returned by `cyberSkunk.state` and missed the Regular award (`initial-harness.txt`). The final harness observes `#bigwin-amount` directly and completes all eight invocations with its assertions intact. No production fix was used to obtain that result.

From `slots/`:

```sh
STUDIO_CHROMIUM_EXECUTABLE=/path/to/chromium \
node games/cyber-skunk/shots/preview-fidelity-qa-2026-11-04/probe.mjs /tmp/preview-diagnostic
```

The command exits zero when the diagnostic completes; **`previewFidelityAccepted` remains false**. It is deliberately outside normal test discovery. It targets the known seed-811 path and refuses to run if that source marker disappears; after a sampler repair, replace it with acceptance checks rather than retaining its legacy-total assertions.

## Exact repair/acceptance handoff for Claude

1. Document each preview's conditioning. Regular/Super **buy** pools (`bonus-regular`, `bonus-super`) are distinct configuration choices from natural conditional pools (`bonus-regular-natural`, `bonus-super-natural`). If displaying a natural trigger, draw its shipping entry and bonus pools together. Hidden has `bonus-hidden`; no standalone paid Hidden price should be invented. Use the actual shipping weights, not a uniform seed-row choice.
2. Spray Job's shipping draw includes its natural bonus tier tickets. The current preview forces `triggerScatters:0`; do not silently exclude those outcomes from a preview advertised as representative of the full mode.
3. Verify selected seeds have positive shipping weight and replay to their recorded totals; Hidden must always meet its 1,000× floor through shipping selection. Avoid replacing low results with a fabricated floor or keeping a single scripted seed.
4. Verify a weighted distribution against the documented conditional law with reproducible tickets/seeds and an appropriate sample size. Keep that work separate from paid-mode 96% RTP and rare-max/natural-trigger reports. This eight-run diagnostic is not a substitute.
5. Preserve wallet/history/pending/previous-win state and restore the board, feature state and controller after Start, Stop, cancellation and completion; then play a real charged round. Retain current keyboard/Stop/rig guards. Refresh package hashes and rerun all eight source browser files after the runtime repair, followed by hosted parity and device sign-off.
