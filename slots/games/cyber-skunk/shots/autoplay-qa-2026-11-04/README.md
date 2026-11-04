# Autoplay queue QA

Base source `160791bca8784eea27cc198fbe7b4234319fb745`; new regression `tests/browser/cyber-skunk-auto.e2e.mjs`. **8/8 passed**, zero skips, desktop 1366×768 and touch phone 390×844. Node 24.22.1 / Playwright 1.62.1 / Chromium 153.0.8010.0. No runtime, math, art, rig, audio or catalog change was required.

All cases use the real circular Auto button and its 10-round chooser. Positive-weight shipping tickets select a quiet zero-win base round (`spin` seed 606), or a natural Vent Break (`entry` 77, `bonus` 653812 from the natural pool). Expected results are replayed by shipping `drawRound()`. The UI receives tickets through crypto only; no `forceBonus`, resolver override or free-preview path is injected. These are deterministic behavior fixtures, not estimates of random occurrence frequencies or RTP.

Each row passes at both viewports. Amounts are integer play-money cents at a 100-cent base bet:

| Case | Charged rounds | Start → final balance | Consumed tickets | Result |
|---|---:|---:|---:|---|
| Selected count | 10 | 1,000,000 → 999,000 | 20 | Exactly ten history rows; queue ends |
| Cancel through Auto during spinning | 1 | 1,000,000 → 999,900 | 2 | Auto becomes 0 while spin stays busy and skip stays false; no next charge |
| Insufficient credits for another round | 2 | 250 → 50 | 4 | Stops before a third draw/debit; unused tickets remain |
| Natural Regular bonus | 1 | 1,000,000 → 999,920 | 3 | Full natural bonus round settles; no further paid autoplay |

The natural fixture uses the base mode's real tier tickets and configured natural entry/bonus pools, paying 20 cents after a 100-cent charge. Start/Stop/dismiss controls accelerate that bonus's presentation. Count/cancel/funds cases do not use Stop to force settlement. Every result has exact history/seed/cost/win accounting, zero unexpected catalog draws and no page errors. After queue completion, the test waits 800 ms (beyond the 350 ms scheduling interval) and verifies idle state, zero Auto and the inactive accessible state. Bet controls are disabled while the queue is active. `desktop-*.json` and `phone-*.json` contain the observations.

Core: **139 passed, three existing skips**. All 119 runtime files and the shared browser helper match Git after execution (`source-audit.json`); the new test has its own fingerprint. The previous 58-case frozen source result remains separate evidence. The expanded nine-file/66-case browser glob has not run together. This is local Chromium QA, not physical-phone or hosted verification.

From `slots/`:

```sh
STUDIO_CHROMIUM_EXECUTABLE=/path/to/chromium \
CYBER_SKUNK_AUTO_EVIDENCE=/tmp/autoplay-proof \
node --test --test-concurrency=1 tests/browser/cyber-skunk-auto.e2e.mjs
npm test
```

Preview fidelity, hosted asset/page parity, actual lobby/device checks and producer/math-owner sign-off remain open. Preserve these autoplay guards when Claude repairs the preview sampler and freezes the next build.
