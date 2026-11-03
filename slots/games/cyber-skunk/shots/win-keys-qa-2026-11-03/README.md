# Win celebration keyboard QA — 2026-11-03

Base source: `5cbadebfad15aa2804669c70e325161900d05274`, plus the `win-keys-1` presentation patch. Node 24.22.1, Playwright 1.64.1, Chromium 153.0.8010.0. Exact runtime hashes are in the updated `art/source/splash-v1/package-manifest.json`.

## Finding and change

The baseline probe starts a real catalog-selected base spin with Space while the body has focus. Escape leaves the win visible after 250ms (`before.json`). The corrected probe dismisses it (`after.json`).

Space, Enter and Escape now invoke the same existing dismiss button as a click. The key remains consumed until release, so holding Enter on Play or releasing Space cannot become a second wager after the overlay disappears. Repeated keydown does not dismiss a newly appearing award. Window blur clears abandoned held-key state. An open dialog keeps keyboard priority; Space in the menu still toggles its checkbox instead of dismissing the win behind it. Pointer behavior, normal spin shortcuts, outcomes, accounting, rig and audio are unchanged. App/launch cache keys and package hashes are updated.

## Results

- **6/6 new cases:** desktop Space; held Enter with Play focused; desktop Escape; touch-phone Escape; Space on a phone bonus total; keyboard use inside Menu while an award is visible.
- **2/2 existing cases:** Studio switching and actual per-spin/bonus-total popup sequence/amount checks.
- **4/4 existing Stop cases:** Regular/Super on desktop/phone still resume the next free spin normally.
- Game **29/29**; core **127 passed, three existing skips**; syntax check passes; package **115 files, 39 detected static references, zero missing**.

`cases.json` and the browser logs record the selected shipping outcomes and real balances/history. Base seed 1782064 awards 2690 cents after a 100-cent debit; final balance 1002590 cents from a 1000000-cent start. The bonus-total case uses regular seed 653812, a 10000-cent debit and 20-cent award; final balance 990020. Every case settles once. Ticket steering is confined to the test fixture and measures UI behavior, not occurrence rates or preview fidelity.

These are **12 targeted browser cases**, not a new combined 36-case pass. Hidden/max keyboard paths, physical phones and hosted served-file parity are not certified here. The known fixed-seed free-preview bypass remains open.

## Reproduce from `slots/`

```sh
STUDIO_CHROMIUM_EXECUTABLE=/path/to/chromium node --test tests/browser/cyber-skunk-win-keys.e2e.mjs
STUDIO_CHROMIUM_EXECUTABLE=/path/to/chromium node --test --test-name-pattern='tier popups use|Studio desktop uses' tests/browser/cyber-skunk.e2e.mjs
STUDIO_CHROMIUM_EXECUTABLE=/path/to/chromium node --test tests/browser/cyber-skunk-stop.e2e.mjs
```

Set `CYBER_SKUNK_WIN_KEYS_EVIDENCE` to a directory to save the six per-case JSON records. After Claude's next runtime change, run all Cyber Skunk browser files with `node --test --test-concurrency=1 tests/browser/cyber-skunk*.e2e.mjs` and the browser override if needed.
