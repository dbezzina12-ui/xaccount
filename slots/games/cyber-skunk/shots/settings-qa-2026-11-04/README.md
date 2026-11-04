# Settings and optional storage — 2026-11-04

Source: `255b8ec879379ea5804f843e767fd904a148eb31`. No newer Claude handoff. Added four real-browser regression cases; production runtime, art, rig, math, audio and browser helper are unchanged.

## Checked

**Four cases pass:** saved preferences and unavailable storage at desktop 1366×768 and touch-phone emulation 390×844. [Complete isolated log](browser.txt), [per-case JSON snapshots](desktop-saved.json), [source identity](source.json), [core log](core.txt).

- Native music/effects sliders reach both 0 and 100 using keyboard controls, then hold 23 and 99. Menu sound and Quick speed update state. Phone sound/Turbo shortcuts synchronize back to the menu; desktop uses its visible menu controls.
- With storage available, levels, mute and Turbo survive reload. Settings interactions leave the 1,234,567-cent balance and empty history unchanged, with no pending round. Reset free-play credits changes the balance to 1,000,000 cents, retains the selected preferences and empty history, and survives another reload.
- When Storage `getItem` and `setItem` throw `SecurityError`, startup uses defaults (1,000,000-cent balance, 60/80 levels, sound on, Normal speed). All tested controls still work for that session. Reload returns to those defaults, as persistence is unavailable.
- All observed menu rectangles stay inside the viewport; all four cases have zero page errors. This is a DOM/state check, not a complete visual-accessibility audit.
- Core: **139 passed, three existing skips**. All **119 runtime files** and the shared browser helper match the pickup commit. `source.json` identifies the runtime Git tree and new test's SHA-256.

The first harness attempted the hidden phone-only Turbo shortcut on desktop and timed out. It was corrected to exercise the visible desktop menu. An overlapping diagnostic run shared a log destination; the committed log is a subsequent isolated four-case invocation after both diagnostics exited. No production fix was needed.

## Reproduce from `slots/`

```sh
STUDIO_CHROMIUM_EXECUTABLE=/path/to/chromium \
CYBER_SKUNK_SETTINGS_EVIDENCE=games/cyber-skunk/shots/settings-qa-2026-11-04 \
node --test --test-concurrency=1 tests/browser/cyber-skunk-settings.e2e.mjs
npm test
git diff --exit-code HEAD -- games/cyber-skunk/runtime tools/lib/browser.mjs
```

Use an installed Playwright browser without the executable override where available. JSON outputs intentionally omit server URLs and request traces. [Phone saved](phone-saved.json), [desktop blocked](desktop-blocked.json), [phone blocked](phone-blocked.json).

## Limits and Claude's next tasks

No audible mix measurement, hardware phone, hosted build, paid round, busy-reset guard or nonempty-history reset is tested here. The new four cases ran separately from the earlier 58 together and eight autoplay cases. There are now **ten browser files / 70 cases**, not a combined 70-case pass.

Claude still owns weighted shipping preview selection: conditioning, full Spray Job natural bonuses, positive ticket/replay provenance, floors/diversity/distribution and saved-state acceptance. After runtime edits, refresh package hashes and run all ten files together plus core/game checks. Preserve the art export profile and fitted v4.1 overrides. Republish the existing private artifact, verify current served entry/assets and rendered desktop/phone, then finish lobby/physical-device and producer/math-owner sign-off. CS-06/CS-07 remain open.
