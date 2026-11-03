# Shop presentation QA — 2026-11-02

Base: `171079c`. Source-only Chromium 153, touch enabled and reduced motion. No hosted publication claim.

`before.json` records the phone shop's 32×39px bet buttons, 36×40px Close and 36px Back. `after.json` records six final viewport checks: all visible shop/receipt buttons at least 44×44px, clear header, visible receipt title/actions, restored bet and Mystery ticket focus, unchanged balance. The landscape screenshot shows the complete receipt; the phone screenshot shows the 360px shop. `game-tests.txt` and `core-tests.txt` are the post-patch unit runs.

The broad browser run passed 26/26 (`browser-suite.txt`). It began on the base source before this small copy/CSS patch and continued while it was applied. Its log is supplementary regression evidence, not a frozen-final-tree certification. Claude must repeat the complete suite on the final published tree. The six focused checks ran after the final patch.

Reproduce from `slots/`: `STUDIO_CHROMIUM_EXECUTABLE=/path/to/chromium node games/cyber-skunk/shots/shop-targets-qa-2026-11-02/reproduce.mjs`. It writes measurements and screenshots to `/tmp/`; omit the environment override when Playwright's bundled browser is installed.
