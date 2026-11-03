# Keyboard dialog QA

Source `c88fa37933534c8337ec686171188e20966d5e18`, new regression `tests/browser/cyber-skunk-dialog-keys.e2e.mjs`. **2/2 passed**, zero skips, desktop 1366×768 and touch phone 390×844. Production runtime, art, math, rig and audio are unchanged. Node 24.22.1, Playwright 1.64.1, Chromium 153.0.8010.0.

Each viewport opens the shop, bet picker, autoplay and settings with Enter, traverses focus forward/backward, then closes with Escape. Focus returns to the originating controller button. Rules and history opened through settings return to Settings. Dialogs have rendered headings and traversal never focuses an underlying game control; native browser chrome/body focus is allowed. All three bonus buys are opened by keyboard and cancelled with both Escape and Enter on Back. After every cancellation the restored card owns focus, the wallet remains 1,000,000 cents, history stays empty and no spin is running. Across both viewports this covers twelve buy cancellations. No free-preview path or paid outcome is exercised.

`desktop.json` and `phone.json` record the checks. `source-audit.json` verifies all 119 runtime files plus the browser helper against Git, and fingerprints the new test. Core passes 127 with three existing skips (`core-tests.txt`). The existing 46-case source and eight-case export passes remain separate; the expanded seven-file/56-case browser suite has not run together.

The initial attempt passed phone but timed out on a desktop confirmation reopening (`first-attempt.txt`). The original fixture did not wait for the shop's ticket-tear guard to clear after cancellation. The final fixture waits for that visible readiness state and restored focus, bounded to five seconds on restoration; it retains every confirmation, focus, balance and history assertion. No runtime change was made to obtain this pass. This tests Chromium keyboard behavior, not a physical phone keyboard, screen reader or hosted artifact.

```sh
# from slots/
STUDIO_CHROMIUM_EXECUTABLE=/path/to/chromium \
CYBER_SKUNK_DIALOG_EVIDENCE=/tmp/dialog-proof \
node --test --test-concurrency=1 tests/browser/cyber-skunk-dialog-keys.e2e.mjs
```

The known preview sampler, hosted parity, physical devices and final sign-off remain open.
