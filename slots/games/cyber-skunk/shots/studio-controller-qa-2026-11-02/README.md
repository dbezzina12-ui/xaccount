# Studio controller layout acceptance — 2026-11-02

Baseline runtime: `35da2ee85fec5c6be0191a99cba200341d1af3d2`. Chromium 153.0.8010.0, Playwright, touch-enabled page with `?studioLayout=viewport`.

`before.json` reproduces the tablet-portrait mismatch: 768×1024 selects a mobile stage but desktop controller, whose bottom is y=1139.01. `after.json` shows the fix across six viewport changes in the same page: the controller and stage agree, the original Play node survives, and balance remains 1,000,000 cents. At 768×1024 the mobile controller now ends at y=1024. Desktop 1366×768 retains its 1097.95px bar and 7.88px bottom clearance.

`actions.json` records successful increase/decrease and opening/closing the bet picker at tablet portrait and desktop sizes after the fix. `game-tests.txt` records 29 passing game tests. Source syntax and artifact packaging also pass; the manifest records the updated app/launch/page hashes.

The change applies only when Studio explicitly requests viewport-based layout. Normal device media selection is preserved. These are local source/browser checks, not hosted screenshots or physical-device performance certification. The preview-distribution and hosted-parity release gates remain open.
