# Cyber Skunk source-browser evidence — 2026-11-02

Tested runtime: shared commit `d766d027d6f3d4e1713651b46805a36658cf1d5b`. This evidence-only batch changes no runtime files.

Browser: Chromium 153.0.8010.0, headless Linux, Playwright. The browser executable was extracted from the npm `@sparticuz/chromium` package after the normal Playwright browser download failed. Browser dependencies are local-only and are not added to the project package or lock file.

## Test results

- `STUDIO_CHROMIUM_EXECUTABLE=/tmp/cyber-skunk-chromium node --test tests/browser/cyber-skunk.e2e.mjs`: 25 passed, 0 failed, 0 skipped, about 596 seconds. Complete log: `browser-suite.txt`.
- `npm run test:cyber-skunk`: 27 passed. Complete log: `game-tests.txt`.
- `npm test`: 127 passed, 0 failed, 3 existing rig-data skips. Complete log: `core-tests.txt`.
- Package verification: 111 files, 35 detected static references, 0 missing; runtime hashes remain identical to the committed package manifest.

The browser suite exercises ordinary settlements, guaranteed spray/card flip/skip, insufficient funds, guide/reload, offline audio levels, natural FS entry, Mystery accounting, startup retry, rare Hidden/cap/retrigger paths, recovery, free previews, slow loading, bonus entrances and separate spin/bonus win totals. Rare cases steer catalog tickets in tests; they are not observations of natural event frequency.

## Responsive inspection

| Viewport | Correct splash | Intro scroll | BET picker | −/+ actions | Page errors |
|---|---|---|---|---|---|
| 360×800 | portrait | none | 44px | raise and restore stake; picker opens | none |
| 390×844 | portrait | none | 44px | raise and restore stake; picker opens | none |
| 430×932 | portrait | none | 44px | raise and restore stake; picker opens | none |
| 1366×768 | landscape | none | 73.96px after desktop scaling | covered by suite | none |
| 1920×1080 | landscape | none | 104px | covered by suite | none |

`measurements.json` records the observed rectangles and interactions. Its intro Play rectangles were sampled during the entry scale animation; they are not settled touch-target measurements. Controller measurements were sampled after dismissing the intro. Screenshots cancel CSS animations to show the completed entry composition.

Inspected the phone and desktop intro: a single visible logo, complete CTA and readable feature copy. The 360px Mystery ticket fits its 90.00% Overpressure / 10.00% Blackout Protocol labels, 40× minimum and Blackout 1,000× minimum. The production intro always opens on reload; there is no “don't show again” checkbox to test. Earlier handoff requests mentioning that checkbox were stale.

Screenshots are local source builds, not captures of the hosted artifact. The browser uses emulated viewport dimensions; real iOS/Android performance, physical safe areas and hosted served-file parity remain separate release gates.
