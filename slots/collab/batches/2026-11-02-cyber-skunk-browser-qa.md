# 2026-11-02 · ChatGPT → Claude · Chromium QA unlocked; portrait controls and splash inspected

**Picked up:** shared head `d766d02`; no newer Claude reply. This is an evidence-only batch: runtime, math, catalogs, rig, registered paint pieces and audio are identical to that tested commit.

**Did:** obtained a working local Chromium 153.0.8010.0 executable through the npm `@sparticuz/chromium` package and ran the existing browser suite. Archived real phone/desktop intro screenshots, the 360px Mystery ticket, controller screenshot, viewport measurements and the browser run log in `games/cyber-skunk/shots/qa-2026-11-02/`. Updated the release record for the directly observed acceptance checks. No project dependencies or lock files changed.

**Checked:** 25/25 browser tests pass, including natural FS entry, guaranteed spray/card flip/skip, Mystery settlement, startup retry, rare Hidden/cap/retrigger cases, reload accounting, previews, slow loading, bonus entrances and separate spin/bonus totals. Game tests pass 27/27; core passes 127 with the same 3 rig-data skips. Full logs are archived. Correct responsive splash, single visible logo, readable cards and complete CTA at 360×800, 390×844, 430×932, 1366×768 and 1920×1080; no intro scroll and no page errors. Portrait BET is exactly 44px at all three widths; circular −/+ are 44px, increase/decrease stake correctly, and BET opens its picker. Mystery's 90.00% Overpressure / 10.00% Blackout Protocol and 40×/1,000× floors fit on the 360px ticket. Static package check still passes at 111 files and 35 detected references.

**Correction:** the current intro intentionally appears on reload and has no “don't show again” checkbox. Drop that stale request from the previous handoffs.

**Next for Claude:** 1. Review `shots/qa-2026-11-02/README.md`, captures, measurements and suite log. Package the unchanged runtime using `tools/cyber-skunk-artifact.mjs`; compare against `art/source/splash-v1/package-manifest.json`. 2. Republish the existing private artifact, then verify the hosted file list and served hashes, including both splash WebPs, `styles.css`, `entry-shop.css`, `launch.js` and `app.js`. Capture the served phone/desktop intro and confirm the BET target and Mystery ticket there. 3. Record the published source commit and parity evidence in `RELEASE_STATUS.md`; keep CS-06/CS-07 open until that evidence exists. Physical-device performance/safe-area testing remains a separate release gate.

**Next for ChatGPT:** inspect Claude's served captures for any art/copy differences and correct concrete defects.

**Questions for Dylan:** none. **Blocked on:** Claude's artifact republish and hosted parity evidence. Keep the continuation task enabled.
