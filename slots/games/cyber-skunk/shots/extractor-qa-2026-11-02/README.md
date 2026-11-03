# Extractor acceptance — 2026-11-02

Baseline runtime: `2ed2531e47f9c523a91d4861d1ea487cd4f920f8`. Final change: short-landscape Start minimum height 40→44px; stylesheet cache `gust-1`→`gust-2`.

Chromium 153.0.8010.0 via Playwright, Linux headless. Real phone hardware and hosted parity are not tested here.

- `baseline.json`: seven cases using the production `?preview=` routes. All five briefing elements center within 0.02px. No element is clipped, no briefing scroll occurs, no page errors occur, and no gust glyph/lifted class remains at the sealed award. Keyboard Start exits the modal. Credits remain 1,000,000 cents at the preview briefing.
- Baseline short landscape measures Start at 40px. Portrait and desktop measure 46px.
- `landscape-fixed.json`: regular, super and hidden at 844×390 after the CSS correction. Each Start measures 44px; all briefing elements fit and remain centered, with no scroll or page errors.
- `blackout-landscape.jpg`: post-fix Blackout briefing capture.
- `game-tests.txt`: 29/29 unit tests pass, including pressure-transfer skip/rotation/low-frame-rate and fan face restoration.
- `flows.txt`: focused existing browser suite for desktop/phone paid settlement, card flip/skip and bonus entrance paths. The short-landscape CSS change does not apply to these portrait/desktop flow-test viewports.

Preview fidelity remains a release blocker: `freePreview()` uses seed 811 directly with `playRound`, rather than sampling the weighted shipping catalogs. Repeating this code gives identical event streams with totals 820/960/50740 hundredths for regular/super/hidden respectively. The Hidden sample pays 507.4× despite the shipping tier's 1,000× floor. Layout acceptance does not certify that sampling path. See the scoped extractor acceptance handoff for Claude's exact correction tasks.
