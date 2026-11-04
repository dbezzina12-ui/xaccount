# Cyber Skunk source release check, November 4

Tested commit `831f270d5514f31a056e7c138ac8e06beef6aeda`, runtime tree `010ba457955b172fed8d17c4a5b2cbc20e76c710`. All eleven browser files passed together, 72/72 with zero skips. [Case names and results](browser.txt). Runtime, browser helper and test sources matched Git after the run. Chromium phone cases use emulation.

The four-choice preview browser test also passed independently on desktop and phone. Completing, stopping and reloading during previews preserve the saved session. A paid spin after the previews settles exactly. The game suite passed 33/33, including weighted preview distribution and natural Spray Job triggers. Core passed 139 with three existing skips.

**Additional Spray Job → natural Blackout UI check.** In the existing preview browser harness on a 390×844 viewport with a 200-cent bet, feed the first Hidden tier ticket (sum preceding Spray Job tier weights), then entry ticket 0 and bonus ticket 0. Open Spray Job from Free previews and play it out using Stop. The entry seed was 1 and the natural Hidden bonus seed was 1378548. Three tickets were consumed. Peak displayed win was 200000 cents, exactly the 1000× shipping result. The shop reopened and pre/post wallet, bet, previous win, pending round and saved session snapshots matched. Both ends of the none/Regular/Super/Hidden Spray Job tier ranges replayed the expected positive-weight entry and bonus rows and included the opening spray.

**Math and package.** An isolated regeneration byte-matched both MATH.md and math/summary.json. These include the distributions, natural-entry rates and cap odds. All six priced modes returned 96% of actual cost. Hidden is conditional and its least positive-weight outcome is 1000×. [Verifier output](math-replay.txt) covers all 149276 catalog entries plus 63000 paid draws. The local packager found 115 files, 38 static references and zero missing. Its refreshed manifest includes the changed launch, app and page hashes.

From `slots/` on the tested revision:

```sh
STUDIO_CHROMIUM_EXECUTABLE=/path/to/chromium node --test --test-concurrency=3 tests/browser/cyber-skunk*.e2e.mjs
npm run test:cyber-skunk
npm test
node tools/math/cyber-skunk-verify.mjs --draws 20000
node games/cyber-skunk/art/source/splash-v1/verify-package.mjs
```

Run `node slots/tools/math/cyber-skunk-report.mjs` in a temporary export of that revision and compare both generated reports to Git. Hosted entry/assets, actual lobby launch and thumbnail, physical phones and final engineering approval still require evidence on the published candidate. Audio belongs to Dylan.
