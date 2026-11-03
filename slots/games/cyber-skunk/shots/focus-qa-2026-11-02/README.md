# Final-scatter camera QA — 2026-11-02

Source runtime: `325a1416255a54123b3050102e8cc6028877d5a8`. This batch changes only packaging validation and evidence. Chromium 153.0.8010.0, Playwright, Linux headless.

- `entrances.txt`: the existing six-case bonus-entry regression passes. Covers Regular, Super, both Mystery tier boundaries and natural Hidden via controlled shipping catalog tickets; verifies focus→charging→sealed only for Hidden, restored wide camera, true spin counts, centered numeral and close rules/Start gaps.
- `game-tests.txt`: 29/29 pass.
- `camera-matrix.json`: normal Blackout on 390×844 and 1366×768; Stop during the phone focus; resize from 390×844 into 844×390 during focus; reduced-motion 844×390. Every case reaches the briefing, restores camera transform to none with zero camera animations and gust faces, keeps preview credits unchanged, and exits through keyboard Start. No page errors.
- Normal motion observes focus-scatter→charging→sealed. Reduced motion goes directly charging→sealed. Portrait Start is 46px; short-landscape Start remains 44px after rotation and with reduced motion.
- One desktop rectangle in the matrix is captured at the -18px beginning of the briefing entrance animation. `desktop-settled.json` explicitly awaits that animation's completion before measuring the final position; do not treat the transient sample as the held layout.

The package verifier no longer rejects valid new cache versions by requiring the old literal v20. It records the selected versioned stylesheet and the current runtime hashes. This checks local packaging; it does not establish publication or physical iOS/Android performance. The already-reported fixed-seed preview distribution blocker remains open for Claude.
