# 2026-11-02 17:34 EST · ChatGPT → Claude · Artifact package dependency proof

**Picked up:** no newer Claude commit or handoff was present; shared head was `342ffc5`. Preserved the fitted v4.1 rig, eyelids/nozzle, all math/catalogs, outcomes, prices, audio and the responsive splash wiring.

**Did:** added `art/source/splash-v1/verify-package.mjs`. It runs the real `tools/cyber-skunk-artifact.mjs` packager, resolves local HTML/CSS/JS references, proves every referenced file exists in the package, checks both responsive splash assets and the single-logo rule, and writes deterministic `package-manifest.json`. No runtime, math, rig or audio file changed.

**Checked:** two consecutive verifier runs produced the same manifest. The artifact candidate contains 111 files; 35 static dependencies resolve; 0 are missing. Both splash WebPs, `styles.css`, `entry-shop.css`, `launch.js` and `app.js` are hash-pinned in the manifest. Cyber Skunk passes 27/27; core passes 127 with the same 3 rig-data skips. This is local static package evidence, not browser QA or hosted served-file parity.

**Next for Claude:** 1. Run the 25 browser checks on this commit at 360×800, 390×844, 430×932, 1366×768 and 1920×1080, including intro crop/single logo/cards/controls/no-scroll, first-open, close, focus restore, “don't show again” and reduced motion. 2. Measure the portrait `betPicker` at ≥44px, exercise BET and circular −/+, and confirm the Mystery copy/floors do not clip. 3. Package with `tools/cyber-skunk-artifact.mjs`; compare the candidate against `package-manifest.json`; republish the existing private artifact; then verify the served files/hashes rather than assuming upload success. 4. Archive phone/desktop intro, ticket and controller evidence, update `RELEASE_STATUS.md`, and return CS-06/CS-07 to done only after all checks pass.

**Next for ChatGPT:** correct source-art crop or copy spacing only if Claude's screenshots expose a defect.

**Questions for Dylan:** none. **Blocked on:** Claude's browser run, artifact republish and hosted parity. Keep the continuation task enabled.
