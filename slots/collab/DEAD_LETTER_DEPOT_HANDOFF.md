# Dead Letter Depot · hourly collaboration report
Newest entries first. Work on codex/dead-letter-depot. Scope changes to this game.

## 2026-11-06 02:20 UTC · Codex → Dylan / Claude · Illustrated win celebrations

Dylan requested generated artwork beyond text. Nice, Big, Epic, Mythic, Max and Total Win now use six original transparent postal illustrations: airmail, bursting parcels, the rotary phone and brass keys. Each enters with an impact, subtle float and the existing mail burst. The live two-decimal count remains separate below. No surrounding panel. The gallery closes its own card while playing and now includes Total Win.

Published private game `659d802ce0d5a86f47b41cb9cc8311a0315ef0a0` and Studio `5ec53adc5502ac7037efc4abe49e2297cbb4f41f`. [All-six gallery](https://dead-letter-depot.djames1.chatgpt.site/?playtest=power&preview=wins). Based on collaboration `1566c61`; no new Claude handoff or open PR targeting this branch.

Evidence: inspected all six at 390×844, Total at 1366×768, Max at desktop and 844×390; checked the real gallery's launch/return. All six 1536×1024 WebPs decode with alpha. Studio's built runtime exactly matches the checked source for the three modified modules and six images. Five ledger tests pass; Studio 194 passed, three skipped; build, syntax and whitespace checks pass. Representative captures are in private source `source-art/win-celebrations-v2/qa/`. This is preview presentation coverage, not a newly settled all-tier release test. The deployed URL retains its owner sign-in gate; local visual QA used the exact packaged runtime.

Integration: [asset manifest](../games/dead-letter-depot/art/WIN_CELEBRATIONS_V2.md), updated `presentation/win-show.{mjs,css}`, and [gallery patch](../games/dead-letter-depot/presentation/illustrated-wins.patch). Source PNGs and complete ImageGen prompts are in the private game's `source-art/win-celebrations-v2/`; runtime images in `dist/art/night-mail/wins-v2/`. The selected image decodes before the count starts, with a readable text fallback. Existing cumulative BONUS WIN and decimal formatting remain. No math, settlement, rig, audio or unrelated game changes.

Next owner: Dylan for visual review; Claude to preserve the presenter and six assets in his final rig/engine integration. Physical-device and full release gates remain open. No production branch merge.

## 2026-11-06 01:47 UTC · Codex → Dylan / Claude · Unframed wins and cumulative bonus totals

Dylan requested this presentation pass, including the Cyber Skunk counter. Nice, Big, Epic, Mythic and Max now use full-screen transparent overlays with large foil lettering, a count-up and flying mail. Return to Sender uses the same sequence for the final bonus total, with one Back to reels action. Balance, stake and wins always retain two decimal places. The controller shows BONUS WIN through losing free spins and restores the recorded total on reload.

Published private game `dab0387256e858e0ae3822801dabfa42fa822dbf`, Studio `d94df179b642a3d31fa7ead66f8330cee82abbd8`, Cyber Skunk `58aac74387a4c80c6a5f29d419d7febb3af57c8c`. [Win gallery](https://dead-letter-depot.djames1.chatgpt.site/?playtest=power&preview=wins) · [Return to Sender](https://dead-letter-depot.djames1.chatgpt.site/?playtest=power) · [Cyber Skunk](https://cyber-skunk.djames1.chatgpt.site/vent-hall/). Based on collaboration `9d6561e`; no new Claude handoff or open PR targeting the branch.

Evidence: five counter tests pass across the collections, flat and ladder engines, all stake values, dead spins, capped awards and restored cursors; 24 old trial resume totals also match. Browser gallery checked all five tiers at 390×844 and Max/Epic at 1366×768. Below-tier Total Win and the bonus summary also checked. Mystery seed 20 restored at spin nine, retained 6,526.00 through its last two losing spins, finished at 6,526.00 and retained that win after reload. The count-up is clamped at zero even when a browser supplies an older animation timestamp. Its overlay measured 390×844, transparent background, zero border. These are producer fixtures and tier previews, not full release certification.

Cyber Skunk already uses cumulative engine events while playing. Its preview completion and page initialization were resetting the displayed win. The final preview now retains its total as PREVIEW WIN; paid recovery restores BONUS WIN. Browser Vent Break seed 811 retained $4.50 on dead spins seven/eight and $8.20 on eleven/twelve, ending at PREVIEW WIN $8.20 with the balance unchanged. A synthetic interrupted $123.45 award recovered once and stayed $123.45 after another reload. Cyber's nine existing tests pass. Studio: 194 passed, three skipped; build, syntax and whitespace checks passed. Math, outcome selection and settlement were not changed.

Integration: [Return to Sender adapter patch](../games/dead-letter-depot/presentation/win-display.patch), updated presentation modules and [counter tests](../games/dead-letter-depot/tests/win-display.test.mjs). The Barlow Condensed ExtraBold font and its OFL license are in the private source's `dist/fonts/`. [Cyber counter patch](../games/cyber-skunk/win-counter.patch) is intentionally scoped to the private runtime's presentation; it does not replace Claude's newer repository catalog or engine.

Next owner: Dylan for visual review; Claude to carry the scoped display patch into his current Cyber Skunk artifact and retain these presentation changes when integrating the final rig/math. No production branch merge. Remaining release gates remain open.

## 2026-11-05 20:19 Cancún · Codex → Dylan / Claude · Parcel opens at the camera

Dylan’s entrance sends Frank’s parcel toward the viewer. Its wax seal splits, the paper grows across the screen, and four paper flaps open around the bonus ticket. [Private replay](https://dead-letter-depot.djames1.chatgpt.site/?playtest=power&preview=delivery). Published game `3efc40b0e9f2c56e69085b3f2934623bf66c3338` and Studio `ed575581d3227caa49fea3540f81cfdf40a9da7c`.

QA used Mystery seed 20 in Chromium at 390×844 and 1366×768. Both showed the seal breaking at 361 ms after release, paper covering the scene at 639 ms and the enabled ticket at 896 ms. Phone frames were inspected at release, seal separation, full cover and flap opening. Both tickets started the bonus. Studio suite 194 passed, three skipped; syntax and whitespace checks passed.

New registered art is in private Site source at `art/night-mail/camera-parcel.webp` and `art/night-mail/parcel-paper.webp`. Built-in ImageGen produced the close-up parcel and matching paper with wax and cord removed, preserving the original silhouette, folds, warm lighting and transparent background.

Next owner Claude for the final rig. Use the parcel-wing grip at SVG `120,389`. The presentation adapter in `presentation/return-delivery.mjs` carries the camera throw, broken seal and four flap layers. Dylan to review the replay. Latest branch and handoffs were inspected; no new Claude handoff or open PR targeting this branch.

## 2026-11-05 20:00 Cancún · Codex → Claude / Dylan · Faster throw-to-bonus cue

Dylan requested mail immediately with the throw. Mail now starts on parcel release and falls from the top edge. The flight, badge drop and mail overlap. Full coverage precedes the ticket reveal. Timed completion prevents delayed Web Animations promises from adding stalls in low-refresh embeds. [Private replay](https://dead-letter-depot.djames1.chatgpt.site/?playtest=power&preview=delivery). Game `0282ecad07e8814fe633e523d010a5679708bb43`, Studio `ad23c66c821f34b2e2cd5d811e5c842070f9a9a5`.

QA in Chromium with Mystery seed 20: at 390×844, mail began 4 ms after release, full-cover cut at 527 ms and ticket ready at 877 ms. At 1366×768, 2 ms, 525 ms and 873 ms respectively. Both started ten free spins. Reduced-motion entrance reached an enabled Start button. Deadline checks covered stalled, finished, paused and cancelled animations. Studio tests 194 passed, three skipped.

Next owner Claude for the final rig. Preserve the release-triggered mail and this entry timing. Dylan can review the faster replay.

## 2026-11-06 00:18 UTC · Codex → Claude / Dylan · Frank’s throw and falling mail

Frank winds up with the wing that carries the parcel. The projectile leaves its moving grip, knocks down the badge and exposes the meter. Falling airmail covers the entire screen before the bonus ticket opens, then falls clear. [Private replay](https://dead-letter-depot.djames1.chatgpt.site/?playtest=power&preview=delivery) · game `8d7e5d7a3d0c2b58d8cd1030a3713527063f34ce` · Studio `2c1a4831d1c2f452ad2e71b735972da4b6f2ee4f`.

QA used the packaged runtime in Chromium at 390×844 and 1366×768. Seed 20 showed six scatters; the release center matched the moving grip within 0.02 CSS px on both. At the cut, 60 portrait or 42 landscape envelopes covered the screen. The Start button enabled after the mail cleared and opened the ten free spins. Studio suite: 194 passed, three skipped.

**Next for Claude:** fit this grip to the final rig using the [bare torso](https://dead-letter-depot.djames1.chatgpt.site/art/night-mail/frank-motion/torso-bare.webp), [loaded wing](https://dead-letter-depot.djames1.chatgpt.site/art/night-mail/frank-motion/wing-held.webp) and [empty wing](https://dead-letter-depot.djames1.chatgpt.site/art/night-mail/frank-motion/wing-open.webp). Wing bounds `0,265,194,258`, pivot `118,300`, parcel grip `120,389`, measured in Frank’s SVG artboard. Use the transformed grip at release. Dylan can replay the entrance in the link above.

## 2026-11-05 18:26 Cancún · Codex → Dylan / Claude · Calibrated ladder and flat playtests

[Play the ladder Key replay](https://dead-letter-depot.djames1.chatgpt.site/?playtest=power&preview=delivery) · [Flat comparison](https://dead-letter-depot.djames1.chatgpt.site/?playtest=six). Private game `bd942b7769505952cf714a78c5b012f242c5357e`, Studio `3625276af13dcef9b9497667a1228c0dcd4c90b7`. Reviewed Claude handoff `d3a78b9` / engine `188f651`; no open PR targeting the project branch. Both builds use Claude’s unchanged engine and settlement. Legacy rounds resume with their recorded engine. The adapter maps recorded rack events for the HUD.

QA: all 7 ladder and 10 flat golden seeds matched expected credits and every reconstructed tumble. Desktop Mystery seed 20 reached the 6,526× receipt after ten free spins (Key ×2, ×4, ×4). At 375×667, the same replay’s seventh-spin scene displayed 24×, four spins left and Key ×4. Studio tests: 194 passed, three skipped. Next: Dylan to choose ladder vs flat, Key frequency for Regular/Super, and acceptable Hidden cap frequency. Claude owns release calibration and the final rig once Dylan attaches the [private Frank layers](https://dead-letter-depot.djames1.chatgpt.site/collab/frank-rig-reference.zip).

## 2026-11-05 23:15 UTC (18:15 Cancún) · Claude → Codex / Dylan · ladder trial calibrated (dld-six-2)
**Tested SHA:** `188f651` (merged with your `20fa237`). `npm run test:dead-letter-depot` 33/33 (trial 11), core 131/131.

**Did:** Added your 17:14 ladder rules to [`engine/six.js`](../games/dead-letter-depot/engine/six.js) as `dld-six-2`. Call it with `playSixRound({ mode, rng: seeded(seed), variant: 'ladder' })`.
- **Ladder rules:** each rack symbol's next addition (basics +1, premiums +3) doubles after it pays. The first KEY match multiplies the meter by 2, and every later one by 4. Additions come before the KEY.
- **Per-tumble events** are in `steps[].rack`: `hits`, `add`, `keyFactor`, `before`, `after`, `next`, `nextKey`. These match your `advanceLadders`.
- **Fitted landings** (`SIX_LADDER`): Night Shift basics ×0.89, Double Post ×0.96, Lost & Found KEY weight 25.2. FS chance: base 2.12%, Priority Mail 3.14%.
- **Report:** [SIX-LADDER.md](../games/dead-letter-depot/SIX-LADDER.md). Every mode measures 96% within its 99.9% interval.
- **Flat trial:** `dld-six-1` ([SIX.md](../games/dead-letter-depot/SIX.md)) is kept for comparison, regenerated unchanged.
- **Golden seeds:** 7 ladder seeds in `tests/six.test.mjs`. Mystery seed 432 reaches the cap.

**Ladder versus flat** (same prices, both at 96%):

| | Ladder | Flat |
|---|---|---|
| Night Shift SD | 200 | 92 |
| Night Shift bonuses at 1,000×+ | 0.74% | 0.02% |
| Lost & Found cap | 1 in 114 | 1 in 373 |
| Lost & Found pays 0 | 1 in 39 | 1 in 85 |

- **Spins with a rack hit:** Night Shift 31% (flat 39%).
- **KEY in Night Shift and Double Post:** still almost never matches (under 0.2% of racked bonuses), and Double Post never matched KEY twice in 400,000 bonuses. If Dylan wants KEY moments there, KEY must land more often in those free spins.

**Next for Codex:** bind the ladder playtest to `variant: 'ladder'` in place of `six-ladders-1`. The fitted landings change replays, so use the golden seeds.
**Next for Claude:**
- Frank's final rig, carrying the parcel-release cue, once the private layers reach me. Dylan: attach the ZIP here.
- The release math, whichever trial Dylan keeps.

**Questions for Dylan:**
1. Do you keep the ladder or the flat rules?
2. Should KEY appear in Night Shift and Double Post?
3. Is Lost & Found capping 1 in 114 bonuses acceptable?

**Blocked on:** the Frank layers (private).

## 2026-11-05 23:07 UTC · Codex → Dylan / Claude · Return to Sender

Dylan selected **Return to Sender** as the display title. The branch, game directory, round versions and save keys retain their existing identifiers. [Replay the parcel entry](https://dead-letter-depot.djames1.chatgpt.site/?playtest=power&preview=delivery) · [Move the shared title/counter mount in Studio](https://gamboligy-studio.djames1.chatgpt.site/dead-letter-depot-studio/index.html?view=phone&scene=bonus). Game source `82d8533bd6aa4f70408c50718615224f0ac716f3`, Studio source `5d85163697cbd10cfed541beebec0564f7910d90`, based on collaboration `8d85c23`.

Six landed scatters → Frank winds up and releases the red-wax parcel → the badge swings off its left pin → global multiplier and spins left appear on the same mount → bonus ticket. Browser checks: desktop and 390×844 phone; initial Hidden 1×/10, then 5×/8. Reload restored 7×/4 without replaying entry. Short-phone 375×667 register clears the cabinet; Studio suite 194 passed, 3 skipped. The entry sequence reads the existing bonus cursor. Art lives in the private game source under `dist/art/night-mail/`. Next: Dylan to play the entry; Claude to continue the ladder calibration and carry the release cue into the final rig.

## 2026-11-05 22:45 UTC · Codex → Dylan · Editable Studio layout

[Open the Depot layout editor](https://gamboligy-studio.djames1.chatgpt.site/dead-letter-depot-studio/index.html?view=phone&scene=base). Private Studio source `44ead68ce9bbd4741e730550ad272fbd2c4701db`, using game `e5bbc16` from branch `2232673`. Phone and Desktop have separate placement and scale for Frank, title, reels/rack, controller and the bonus-only multiplier. Save layout applies to Studio Play. Browser preview verified a 32 px right / 22 px up phone drag across reload, desktop nudge in Play, and multiplier visibility. Studio suite: 194 passed, 3 skipped. The editor opens the ladder playtest. Claude’s just-landed `dld-six-1` is the separate flat trial. Next: Dylan to save preferred positions; Codex to carry the approved layout to the standalone playtest.


## 2026-11-05 22:45 UTC (17:45 Cancún) · Claude → Codex / Dylan · six-symbol trial engine (flat), calibrated; ladder next
**Tested SHA:** `1c9e621` (merged with your `2232673`). `npm run test:dead-letter-depot` 30/30 (trial 8), core 131/131.

**Did:** Built [`engine/six.js`](../games/dead-letter-depot/engine/six.js) (`dld-six-1`), the authoritative version of your `six-trial-1` rules.
- **What it keeps from yours:** the same rack, the same draw order, and per-tumble meter events in `steps[].rack` (`hits`, `add`, `doubled`, `before`, `after`). No stamps, no jobs.
- **Fitted landings** (as written, Night Shift was 45× and Lost & Found 34×):
  - free-spin basics thickened (Night Shift ×1.12, Double Post ×1.13);
  - Lost & Found KEY weight 31.2;
  - FS chance: base 2.12%, Priority Mail 3.14%.
- **Report:** [SIX.md](../games/dead-letter-depot/SIX.md), kept apart from the release MATH.md. Every mode measures 96% within its 99.9% interval.
- **Golden seeds:** 10, in `tests/six.test.mjs`, including a capped round: Mystery seed 371.

**Findings:**
- **Bonus averages:** Night Shift 96×, Double Post 240×, Lost & Found 1,047× (Mystery 400× at 40/35/25).
- **Night Shift's meter applies on 39% of its spins;** the rest pay face value.
- **KEY doubles in only about 0.1% of Night Shift and Double Post bonuses**, even when racked.
- **Lost & Found:** 93% of bonuses double at least once, and it caps 1 in 373.
- **Rack-spin concepts** to replace the stamp features price at about 1.4× and 1.8× with bonus value. Neither is a premium feature as it stands.

**Next for Claude:** the ladder rules from your 17:14 entry, as `dld-six-2`, with their own fit and report.
**Next for Codex:** use `playSixRound({ mode, rng: seeded(seed) })` from `engine/six.js` in place of `six-trial-1`. Note that the fitted landings change every replay, so seed 21737 no longer replays as before.
**Blocked on:** nothing. Frank's parts rig still waits on the private ZIP.

## 2026-11-05 17:20 Cancún · Codex → Dylan / Claude · Full mobile Frank and bonus-only multiplier

[Private playtest](https://dead-letter-depot.djames1.chatgpt.site/?playtest=power), source `e5bbc164b4db695ceda15e62844c62bbec02647b` from collaboration `5c70cd2`. The full mobile rig sits between the reels and Spin, and the multiplier is visible only in free spins. Chromium 390×844 base: 209 px mascot, no plaque. 375×667 resumed Hidden: 125 px mascot, plaque at 7× then 14×. Boots cleared Spin by 8 px and the controller fit both viewports. Next: Dylan to review on phone; Claude to continue ladder math.

## 2026-11-05 17:14 Cancún · Codex → Claude / Dylan · Repeat matches and global Key boosts

Dylan clarified that Keys multiply the global meter. [Private ladder playtest](https://dead-letter-depot.djames1.chatgpt.site/?playtest=power), source `384baee9183a936db3cacebd8a32af1bce493d5d`, based on collaboration `22641b1`. Each listed symbol has its own next addition. Basics start at +1 and premiums at +3; each paying group doubles that symbol’s next addition. Add within the tumble first. The first listed Key match multiplies the whole global meter by 2, subsequent matches by 4. The meter carries to later spins. Past payouts are final. The regular activation, 3+3 lineup, Hidden Key guarantee and 25,000× round cap carry over. This is an isolated trial with separate resume state.

The new mobile stage shows a 215px-wide Frank portrait below the cabinet at 390×844. Multiplier plaque beside title; checked 375×667, 390×844 and 1280×720 browser layouts, plus scatter entrance and six-symbol bonus at 390. Checked 2,500 seeded rounds against per-spin and cap arithmetic. Seed 10145 plays Hidden with Queens adding +1/+2/+4/+8/+16, Keys moving 7×→14×, unit-stake total 721.60. Explicit fixture verified first/second Key operations. Next: Claude to simulate this rule set, including repeat-key frequency, cap exposure and per-tier distributions; Dylan to compare the new pacing on phone.

## 2026-11-05 17:04 Cancún · Codex → Claude / Dylan · Six-symbol bonus trial and win animations

[Private six-symbol playtest](https://dead-letter-depot.djames1.chatgpt.site/?playtest=six), site source `9a9027c248148866482f1a1bed357cc48abe1233`, based on collaboration `363efe1`. Separate demo balance and replay version. Three basics and three premiums fixed per bonus. Every listed paying group adds +1 (basic), +3 (premium), or doubles (Keys). Apply additions before Keys within a tumble. Final spin meter multiplies the tumble subtotal once. Regular requires a hit that spin; Super starts at 10× and stays active; Hidden always includes Keys and stays active. No stamp landings or jobs in the trial. The old stamp-feature buys are omitted there pending a replacement design.

From the trial guide, Play Key replay uses Mystery seed 21737: six scatter entry, second spin Queens 2→3 then Keys 3→6. The demo replay pays 182.60 at unit stake; free run buttons do not affect balance. 1,750 reproducible trial rounds / 11,795 spins checked for rack composition, activation, stamp/job exclusion, cap, total and cent settlement. Checked all five win dialogs in a 390×844 Chromium viewport, plus the desktop Key replay and mid-bonus refresh. All five celebration tiers consume the round's returned tier, bonus spins also show qualifying wins inline. Max is preview coverage only.

**Next for Claude:** simulate and calibrate this exact variant per tier and mode (including Mystery mix, Key-hit frequency with/without Keys drawn, cap rate and replacement stamp-feature concepts). Give Codex the versioned authoritative rack, per-tumble meter events and golden seeds. Keep trial results separate from release RTP. Dylan to judge replay and celebration pacing.

## 2026-11-05 16:32 Cancún · Codex → Dylan / Claude · Scatter entry and phone controller

Private playtest source `9357933db83894ec3676a95c7c91b337e6dbca76`, reviewed against collaboration head `5541d10`. Bought entries now use the settled tier to drop 4/5/6 scatters, with the last scatter on reel six before the salute. Natural entries use their engine board. The phone's utility controls sit above the spin row. The compact enamel multiplier sits in the cabinet header on phone and desktop.

Chromium: at 390×844 the spin button ended at y=793; seed 2443 displayed a 100× stamp and 101× global. A Mystery-to-Hidden replay showed six scatters before the ticket and settled to 138640 cents. A desktop natural Regular replay showed four before the ticket and settled to 181260 cents. Across 3,000 sampled bought entry boards, every tier had its correct scatter count and zero paying groups. Next: Dylan to check thumb reach on his phone; Claude continues rig and sound. No engine changes required.

## 2026-11-05 16:25 Cancún · Codex → Dylan / Claude · Quieter callouts and multiplier display

Private playtest source `650b6499894558e6af9041d1b5b52bf92a13b0ad` published. The global multiplier has a dedicated stored/active readout, stamps carry large high-contrast values, and meter changes and entry confirmations no longer generate a second mail card. Collection cards require an actual effect, once per job type per spin; extra-spin cards remain. Mobile seed 2443 showed a 100× stamp and 101× global value at 390×844. Desktop natural Night Shift seed 52 showed Kings and Queens cards only and ended at the expected 181260 cents. Next: Dylan playtests readability; Claude continues final rig and sound.

## 2026-11-05 15:40 Cancún · Codex → Dylan / Claude · Motion pass playable

[Private playtest](https://dead-letter-depot.djames1.chatgpt.site) published source `9be382f7cceb83e2e2c319d7d1f07338e85e5b58` from collaboration candidate `3a84f82`. Applied the integration patch and baked five registered illustration layers in the private checkout to avoid recomputing masks per frame. Chromium showed wing rise, cap contact and recovery, with the same actor carried into the full-screen ticket. Checked the bought Double Post entrance at 1000×700 and the natural Night Shift at 390×844. The phone controller ended at y=844. Collection cards appeared in the clipped cabinet footer below row five. Natural seed 52 completed ten spins for 813.60 credits and a final balance of 1,812.60, matching settlement. No open PR targeting the project branch.

Next: Dylan playtests timing; Claude owns final rig and sound. Physical-device QA remains open.

## 2026-11-05 20:15 UTC · Codex → Codex / Claude · Whole-round motion pass staged; private visual QA open

Dylan wants the Cyber Skunk transition quality through the full round. Only bonus entry gets a full-screen stinger. In-round jobs, meter changes and extra spins use a small, readable mail card in the cabinet footer. This candidate adds a bottom-docked controller, separate head/eyelid/shoulder/elbow motion, anticipation after three visible base scatters, win holds and tumble exits, a physical envelope cover and reveal, tier lighting, and a count-up of the settled bonus total. The same Frank instance travels from stage into the bonus screen.

**Evidence:** Inspected Cyber Skunk's runtime app, rig and CSS; its natural hold, cover and release are 900/460/520 ms. Tested the new rig joint tracks and listener teardown, column-stop timing (0/67/134/611/678/745 ms after three qualifying columns), and card entry/dwell/exit (240/1350/145 ms; reduced-motion and skip paths checked). Engine reference balances at 100-cent stake and 100000-cent start: natural base seed 52 = 181260; Double Post seed 1 = 116480; Mystery hidden seed 20 = 138640. These are source checks, not an integrated visual pass.

**Next — Codex:** Private site remains at `829de764c07650c4dbed1b950ca32e2ccac65007`. Workspace and browser disconnected before integration. Copy `presentation/{frank-motion,stage-motion,landing,dispatch}.mjs` and `presentation/stage-motion.css` to `dist/presentation/` in that source checkout. Apply `presentation/private-playtest.patch` there with `git apply --check --unidiff-zero` first. Verify actual wing seams and cap contact, no board/card overlap, portrait and desktop deck baselines, and real-time entry/exit plus single settlement. Fix issues before publishing to Dylan's private playtest. Keep private artwork there. Claude retains final rig/sound and engine ownership. No production merge.

## 2026-11-05 20:05 UTC · Codex → Dylan / Claude · Salute and collection timing

[Private playable build](https://dead-letter-depot.djames1.chatgpt.site), source `829de764c07650c4dbed1b950ca32e2ccac65007`, checked against `ae98ab3`. Frank now has a drawn wing-to-cap pose on the stage and on the full-screen bonus ticket. Natural entries lift the actual FS tiles toward Frank. Bought and Mystery entries identify the ticket. Acknowledging the ticket starts the free spins. Collections now identify the completed symbol and the actual engine effect before board changes. Meter events and retriggers get separate beats. Read time is independent of reduced motion.

**Evidence.** Chromium at 390×844 (Mystery → Lost & Found) and 1000×610 (Double Post). Natural seed 52: four FS, Night Shift, reel 4 wild and row 5 copied to row 2; Turbo kept captions for about 1.1 seconds. End balance 181260 cents, equal to settlement. Checked 102 job announcements across 337 engine steps, covering all nine job types and the multi-part vault. Eight rig tests passed.

**Next owner.** Claude: fit the articulated near wing and use the new [private salute pose](https://dead-letter-depot.djames1.chatgpt.site/art/night-mail/frank-salute.webp) as the target. The pose currently swaps in as key art. Sync the final postal sound cue with the ticket strike, about 0.36 seconds after the full-screen reveal starts. Dylan: playtest pacing. No production merge.

## 2026-11-05 19:37 UTC · Codex → Dylan / Claude · Frank hero rig playable; current-look layers ready

Integrated Claude’s `69b4f78` adapter from handoff `f2a9a80` into [the private build](https://dead-letter-depot.djames1.chatgpt.site), source `63eff5c586d4e16dce442a340fddff3a9bb6841a`. Replaced CSS breathing with the cue-driven hero renderer. Feet anchor is (308,864) on the 712×900 hero, scaled with the displayed image on resize.

**Evidence:** Eight rig tests passed against the shipped JS. Chromium at 390×844 and 1280×720 applied distinct stamp and salute transforms, with zero CSS animation competing on the hero. Current-look split: nine visible registered layers reproduce all visible RGBA pixels of the approved hero at rest. A tenth closed-eye overlay and the original 19-part kit are included. Exposed joint surfaces still need articulated pose QA.

**Next:** Dylan downloads the [updated private rig ZIP](https://dead-letter-depot.djames1.chatgpt.site/collab/frank-rig-reference.zip) and attaches the file directly in Claude’s chat (Claude’s direct request returned 401). Claude fits pivots and checks seams, blink and letter handling on the current art; return a parts preview for Codex QA. Private artwork stays off this public branch. No open target PR at inspection.

## 2026-11-05 19:15 UTC (14:15 Cancún) · Claude → Codex / Dylan · Frank rig adapter; reference ZIP blocked
**Tested SHA:** `69b4f78`. `npm run test:dead-letter-depot` 22/22 (rig 8), core 131/131. The preview was checked in Chromium at 1280×720 and 390×844 with no console errors.

**Blocked:** `frank-rig-reference.zip` on the private Site returns **401** to me, so I couldn't read the current hero or the 19-part kit. **Exact assets needed** (Dylan: attach the ZIP in my chat, or have Codex commit it under `games/dead-letter-depot/art/frank/`, since this repo is public):
1. `current-look/frank.webp` (the hero). From it I'll measure his feet anchor.
2. The `frank/` kit: parts, pivots, draw order and README. I'll map its part names to the rig's roles.
3. For blink and the letter check in the *current* look: the hero split into transparent layers on the hero's canvas. Minimum set:
   - legs/feet, body, head, eyelids-closed;
   - near wing, near forewing, near wingtip;
   - letter, tail, far wing.

   I fit the pivots myself.

**Did:** [`rig/frank.js`](../games/dead-letter-depot/rig/frank.js) with [`rig/preview.html`](../games/dead-letter-depot/rig/preview.html).
- **Clips:**
  - Idle: breathing, blink, an occasional letter check.
  - Stamp: wind-up, contact squash at 0.2 s, recoil and settle, harder for a bigger meter value.
  - Salute: the bonus salute, held longer for Double Post and Lost & Found.
  - Reduced motion is static, and cues are ignored.
- **Two renderers, feet planted in both** (tested):
  - **Hero mode** moves the current illustration as one piece about its feet, so the silhouette never changes. You can use it now.
  - **Parts mode** draws a layered manifest with parent chains and draw order.
- **Randomness:** presentation-only; the engine's RNG is never touched.

**Next for Codex:** to replace the fallback now in hero mode:
- `createFrank(postmasterEl, { hero: '<frank.webp url>', feet: [x, y] })`
- then `attachFrank(document, frank)`

The rig listens for your bubbling `depot:frank` (`stamp` with `value`, `bonus` with `tier`). Open `rig/preview.html?hero=<url>&feet=x,y` for visual QA. When the layers land I'll switch it to parts mode, with the same API.
**Next for Claude:** parts rig and pivot fitting once the assets above are reachable. Re-fit the math when Dylan decides on premium targets and the Lost & Found ceiling.
**Questions for Dylan:** may the Frank art go in this public repo, or will you attach the ZIP here?
**Blocked on:** the reference ZIP (401).

## 2026-11-05 18:15 UTC · Codex → Claude · studio controls, dispatch tickets and Frank rig

**Playable:** [private producer build](https://dead-letter-depot.djames1.chatgpt.site), source `d2584580f7a9b31ac77864a1413ac32abf324f59`, collaboration baseline `5a22b22`. Mounted Cyber Skunk’s Gamboligy v3.3.1 controller and adapted its two-part shop tickets, section switch and receipt to Depot prices. Raised the phone cabinet from y=303 to 148. Frank breathes and the title catches light while idle, with reduced-motion support.

**Evidence:** Chromium 390×844 (mobile controller bottom 692) and 1280×720 (desktop bottom 629). In both, raised base stake to 1.50, opened all three bonus tickets and three feature offers, enabled and disabled Special Delivery and reached the Night Shift receipt. Physical-device QA remains open.

**Next for Claude:** [Private rig reference ZIP](https://dead-letter-depot.djames1.chatgpt.site/collab/frank-rig-reference.zip) contains the current hero image in `current-look/frank.webp` and the earlier 19-part registered kit, pivots, draw order and README under `frank/`. The kit is a motion reference; preserve the current hero silhouette. Build a planted-feet idle with breathing, blink and an occasional letter check. Add stamp contact/recoil and a bonus salute. The private runtime dispatches a bubbling `depot:frank` CustomEvent from `.postmaster` with `detail.action` equal to `stamp` (meter value) or `bonus` (tier). Keep reduced motion static. Return a rig preview and adapter on the collaboration branch so Codex can replace the fallback after visual QA. If private access or matching layers block you, identify the exact assets needed.

## 2026-11-05 17:45 UTC · Codex → Dylan · bonus layout correction

Private Site source `6de0baf596095752a454ddb29f111848ad1e75dc`. Followed the Cyber Skunk runtime stage layout. The rack appears above the reels only during free spins. Desktop gives Frank a separate column and portrait pairs him with the logo above the cabinet. The envelope wipe and bonus welcome fill the viewport. Chromium measured a 1280×720 and 390×844 wipe. Dylan can playtest the layout. Claude retains the rig and math.

## 2026-11-05 16:19 UTC · Codex → Dylan / Claude · engine-backed private playtest

**Playable:** [Dead Letter Depot](https://dead-letter-depot.djames1.chatgpt.site) · private Site source `6da5b1ef3d0ae217f3cc7f80f9a80b4e96ed9bf3`. Integrated Claude handoff `c0075f9` (engine `23afe0f`). No open target PR at inspection.

**Did:** Replaced scripted cues with settled boards, counts, targets, job transformations and meter activation. Conventional vertical drops, scatter-to-envelope stinger, auto-advancing free spins, priced feature desk and tab-local demo settlement are in the playtest.

**Evidence:** Replayed 28 supplied fixtures including all nine jobs, the four meter cases and the cap. All 280 step-end boards agreed after animating explicit movements across 247 spins and 93 jobs. Eight engine tests passed. Chromium desktop and 390×844 viewport inspected. Natural four-scatter fixture seed 52 entered Night Shift and carried the counters across free spins.

**Next:** Dylan decides whether premium jobs should occur more frequently and whether to keep the Hidden 64× ceiling. Claude owns any re-fit and Frank’s rig; the older layered ZIP is private and distinct from the current static key art. Codex owns further presentation, interruption and physical-device QA. Final audio and win tiers remain open.

## 2026-11-05 15:56 UTC (10:56 Cancún) · Claude → Codex / Dylan · collections, jobs and the meter: engine and prototype math
**Tested SHA:** `23afe0f`. Suites: `npm run test:dead-letter-depot` 13/13, `npm run test:dead-letter-depot-sorter` 34/34, core `npm test` 131/131.

**Did:**
- **Engine:** `dld-reels-2`, in [`engine/`](../games/dead-letter-depot/engine/), built to the collection brief:
  - 6×5 pay-anywhere tumbles.
  - The nine jobs, with deterministic tie-breaks.
  - Collections: base targets last one spin; bonus targets carry across free spins; Lost & Found halves them.
  - The meter: stamps first, then clears, then the final meter once on the tumble sum. Base is spin-local; Night Shift applies on clear or stamp spins only; Double Post applies always, starting at 10×; Lost & Found doubles per clear, up to 64×.
  - Retriggers, the 25,000× round cap and exact-cents settlement.
- **Contract and tie-breaks:** in [ENGINE.md](../games/dead-letter-depot/ENGINE.md). The payload now includes `targets` and per-step `collections`, for your rack.
- **Math:** simulator, fit and report in [MATH.md](../games/dead-letter-depot/MATH.md):
  - every mode at 96% within its 99.9% interval, two ways;
  - completion rates per symbol, including job-made symbols;
  - the clears-per-bonus tail;
  - flat versus tiered;
  - cap rates.
- **Sorter:** archived in `archive/sorter`, with its tests intact.

**Fixtures** ([fixtures/rounds.json](../games/dead-letter-depot/fixtures/rounds.json)): 28 replayable rounds, each with board, winning cells, drops and refills, collections, jobs, meter, award and settlement:
- Your four examples: `regular-inactive`, `regular-late`, `super-no-event` and `hidden-clear-and-stamp`.
- One per job: `job-sweep` … `job-vault`.
- A capped round: Mystery seed 6776.

**Measured (provisional prototype):**
- **Base:** 96.4% (spin 62%, bonus 34%), hit 22%, bonus 1 in 344.
- **Priority Mail (3×):** bonus entry 5.8× as often as base.
- **Feature spins:** Special Delivery 2.5×, Double Exposure 3×.
- **Night Shift (100×):** averages 96.7×, median 32×.
- **Double Post (250×):** 240×.
- **Lost & Found:** 1,052× (Mystery 400× at 40/35/25).
- **Cap:** Lost & Found 1 in 1,344; Mystery 1 in 5,618.

**Findings for Dylan:**
1. **Premium collections almost never clear in Night Shift or Double Post** (under 0.002 per bonus), so the vault, deliver, unpack and return jobs effectively don't happen there. As a result, flat and tiered increments measure the same, because nearly every clear is a low worth +1 either way. Fix: premium bonus targets of about 8–10, or more premiums in free spins; either needs a re-fit.
2. **Night Shift is swingy:** 42% of bonuses have no clear and 44% pay under 25×.
3. **Lost & Found sits on its 64× ceiling in 51% of bonuses.** Without the ceiling, doubling ran to the cap in most bonuses.
4. **Two of my prototype choices to confirm:**
   - A's filter lasts one spin. Kept for the whole bonus, it thinned the refills for good and ran away.
   - Double Post starts its meter at 10×, so it's worth its 2.5× price.

**Next for Codex:** bind the payload. Use `targets` plus the `step.collections` snapshots for the cubbies. A drop's distance is `toRow - fromRow`. Play job `changes` after each refill. Light the meter only when `meter.active`. Replay the fixtures for QA.
**Next for Claude:** re-fit once Dylan picks targets and starting meters; rig Frank's bank/return/consume actions when his layered art lands.
**Questions for Dylan:** findings 1–4 above. Also confirm the prices (feature spins 2.5× and 3×) and Mystery at 40/35/25.
**Blocked on:** nothing for the engine.

## 2026-11-05 · Codex → Codex / Claude · Drops, collection rack and bonus entrance

Prepared presentation/landing.mjs and landing.css against private Site source fe07e35, branch baseline 58fd18a. The renderer takes supplied progress counts and targets. Claude owns those counts and activation events; preview values are illustrative. No new engine handoff was present at inspection.

Codex next: mount the rack below the cabinet. Replace the old roll/bounce loop with dropReels after drawing the incoming grid without legacy .roll/.land classes. On tumble pass the supplied row-major distances. Cancel motion on current-spin Stop. On natural entry pass committed FS tile nodes to mailStinger before bonus intro; for direct/Mystery entry pass an empty array and the chosen bonus name. Call the entrance once, after outcome selection and before the first free spin. Reduced motion uses the existing bonus intro immediately. The nine cubbies should persist across bonus spins and receive snapshots from Claude.

JS harness checked a 6×5 incoming grid, movement of only the indicated survivor/refill tiles, 19/20 counter text and cleanup after four scatter flights. Browser, phone layout and deployment still pending because the private Site checkout was unavailable. Resume this Codex integration at the next available workspace, independently of bonus math. Claude continues bonuses.

## 2026-11-05 · Dylan via Codex → Claude · Collections and global multiplier

Resume design and math prototyping for the 6×5 pay-anywhere tumbles. Every paying symbol keeps its own job. Filling its collection performs that job AND increases the shared multiplier. Stamps can also add to the multiplier. A collection clear means reaching the symbol's target, distinct from an ordinary eight-symbol payout. Base collections span one spin and its tumbles. Bonus collection progress spans free spins.

Prior job set to prototype: 10 sweeps the tens; J converts jacks into the most common visible premium; Q copies a row; K makes a reel wild for the next check; A filters a low rank from refills; envelopes return the biggest matching group; parcels unpack four matching premiums; phones deliver missing copies to complete a match; keys open the three-parcel vault (premium delivery, wild reel, multiplier stamp). Post the deterministic tie-breakers, eligible targets and cascade safeguards with the fixtures.

Regular carries a global meter through the bonus. A collection clear or stamp landing activates the meter for that spin. Otherwise wins pay at face value. Super applies the meter to every winning spin. Hidden inherits always-on, halves the Super targets (20 jacks → 10), and doubles the entire meter per completed collection (30× → 60× → 120× for two clears). Preserve each job in Hidden. Prototype doubling in place of the usual rank increment, with stamps still additive. For a common event order, test stamps first, then doubles, then apply the final meter once to the sum of tumble wins. Base uses a spin-local multiplier. These ordering details are test assumptions.

Next owner Claude: simulate flat versus modest rank-tiered increments, actual completion frequencies including job-generated symbols, multi-clear tail exposure, per-mode RTP and cap hits. Starting values, prices, thresholds, award increments and the interaction order are provisional. Supply example payloads for inactive Regular, Regular activated late, Super with no event, and Hidden with simultaneous clear/stamp. Codex will bind presentation after handoff. Current private build still plays the earlier scripted rules.

## 2026-11-05 14:48 UTC · Codex → Claude · Art build, mechanics on hold

Dylan is considering the core mechanics. Hold new mechanic, pricing, math and settlement work pending his direction. Treat the prior reel-engine proposal as provisional. Keep existing work available for review.

Codex published private Site source fe07e3539acacb41f9f6dcf54d78b4bafe079da2 from GitHub baseline 44a141d. Replaced all eleven symbol illustrations, title, cabinet and depot environment. Frank's new three-quarter illustration is static presentation art; the existing layered rig source is a separate asset. Checked the 1363×936 desktop and 390×844 phone layouts in Chromium. The phone spin completed both tumbles and returned to Spin with 4 illustrative credits. Next owner Dylan for art feedback and mechanics direction.

## 2026-11-05 14:01 UTC · Codex → Claude · Producer pivot to conventional tumble reels

Dylan rejected the sorter and requested a normal slot with Cyber Skunk as the art reference. Supersedes all sorter requests, including tuning its Night Shift floor. The private playable now opens on 6×5 reels with nine pay symbols, FS and value stamps. Eight matching pays anywhere. Show each win, clear those cells, drop survivors in order and continue. Art and sample play are in private Site source 55cea3d5a184008045ce7646c3ecf0d118d9c908. Branch baseline aedc048. No existing sorter award, RTP result or balance carries into the new game.

**Request for Claude:** Build a separate versioned reel engine, deterministic payload and settlement. Start with Night Shift: four FS open 10 free spins. On a blank bonus spin Frank saves new stamps for the next spin. On a paying spin, add live and held values, multiply the whole spin's tumble subtotal once, then consume them. With no stamps, use 1×. A held stamp expires after its last eligible miss and all stamps clear at bonus end. Double Post introduces paired stamps. Mystery can reveal either of those or Hidden Lost & Found, which gives each missed stamp two future spins to connect. Special Delivery and Double Exposure preview one/two opening stamps. Priority Mail should increase the chance of entering a bonus. Its preview forces four FS solely to demonstrate entry. Return simulated RTP per cost, feature costs, trigger and retrigger odds, cap rates and Mystery weights for producer review. Scope rig actions to banking, returning and consuming stamps. Send Codex a fixture set with board, winning cells, survivor/refill mapping, stamp expiry, mode, award and final settlement.

**Evidence:** Intro and three-panel guide, real desktop and 390×844 portrait layout, two-clear base spin (4 illustrative credits) and Night Shift blank → held 5× → 3 × 5 = 15 with eight FS left. Checked 560 authored cases for omitted/extra matches and terminal boards. Demos are scripted, with no wallet or RTP claim. Next owner Claude, then Codex binds and verifies the settled payload. Dylan reviews the feel.

## 2026-11-05 04:49 UTC · Codex → Claude · settled round presentation

Bound the playtest to playRound, settle, costOf and winOf from engine 0224599. Postage appears before the route, bins pay before FS reveal, and bonus bins rise from rungs to after. The screen uses a saved seed, engine version, original balance and playback position. Debit occurs once at entry and credit once at round end.

Verification: all 34 game tests passed independently. In Chromium, Mystery seed 131293 held the post-buy balance at 9,600 through nine Hidden spins, showed a 25,000× receipt and ended at 34,600. The isolated replay leaves the regular demo wallet alone. A normal Night Shift buy survived reload at entry and during its first spin; after replay, nine free spins remained and the debit was unchanged. The desk shows 1.5× Carbon Copy, 2.5× Registered Mail and 40/35/25 Mystery weights.

Next: Claude owns Frank's rig after receiving the art pack. Dylan owns the proposed rules and floor decision. The public branch still lacks the private art package; the producer has a ZIP. No production merge.

## 2026-11-05 04:35 UTC (Nov 4, 23:35 Cancún) · Claude → Codex · settled payload, rescues and math
**Tested SHA:** `0224599`. `npm run test:dead-letter-depot` passes 34/34 (resolver 14, engine 14, math 6). Core `npm test` passes 131/131.

**Your questions.**
- **Payload:** `playRound({ mode, rng: seeded(seed) })` returns the whole settled round, and `settle(round, bet, balance)` returns `{ cost, win, balance }` in cents. The schema, the order on screen and the save/reload rule are in [ENGINE.md](../games/dead-letter-depot/ENGINE.md).
- **Rescue allowance per spin:**
  - Base, Priority Mail, Carbon Copy, Night Shift and Double Dispatch: 0.
  - Registered Mail: unlimited (no branch is ever lost).
  - Lost & Found: 1, spent stage by stage, top lane first.
- **Entries:**
  - Base, Priority Mail, Carbon Copy, Registered Mail and Night Shift: middle lane.
  - Double Dispatch: top and bottom lanes.
  - Lost & Found: all three lanes.
- **Carbon Copy's** stage-1 middle cell is a forced Fork, marked `forced: true`.

**Did:**
- **Engine** ([`engine/engine.js`](../games/dead-letter-depot/engine/engine.js)): seeded with mulberry32, with a fixed draw order. Version `dld-engine-1`.
- **Rules** ([`engine/rules.js`](../games/dead-letter-depot/engine/rules.js)) and **settlement** ([`engine/settle.js`](../games/dead-letter-depot/engine/settle.js)): wins are exact cents on a 10-cent bet ladder.
- **Spins:** fresh postage on each bin before the drop. FS seals sit over stamps and never change the route; 3, 4 or 5 sealed stages award Night Shift, Double Dispatch or Lost & Found.
- **Bonuses:** 10 spins with persistent bins. Night Shift raises each delivered bin. Double Dispatch and Lost & Found use shared upgrades: every bin rises per delivery.
- **Cap:** 25,000× across the whole round, settled once; the bonus ends on the capping spin.
- **Exact calculator:** computed over the whole state space using the game's resolver. A fit tool solves every mode to 96% by cost.
- **Cross-check:** a Monte Carlo run of 10M spins and 1M buys through `playRound`. Every mode lands inside its 99.9% interval. Figures are in [MATH.md](../games/dead-letter-depot/MATH.md).
- **Golden replay seeds** are listed in ENGINE.md and pinned by the tests.

**Measured (exact):**
- **Every mode returns 96.00%:** Base 1×, Priority Mail 3×, Carbon Copy 1.5×, Registered Mail 2.5×, Night Shift 100×, Double Dispatch 250×, Mystery Delivery 400×.
- **Base spin:** the letter is delivered on 36.1% of spins, and a round pays something 36.4% of the time. A spin pays 5× or more 2.6% of the time and 10× or more 1.35% of the time.
- **Base bonus odds:** Night Shift 1 in 240, Double Dispatch 1 in 5,619, Lost & Found 1 in 328,214.
- **Priority Mail** enters a bonus 5.00× as often as a base spin.
- **Bonus averages:** Night Shift 96×, Double Dispatch 240×, Lost & Found 1,046×. Lost & Found reaches the cap 1 in 41,285 bonuses; Mystery Delivery 1 in 164,953.

**Next for Codex:** Bind payout and bonus presentation to the payload:
1. Show the postage, then play the route moves.
2. Pay the delivered bins.
3. Reveal the seals.
4. In bonuses, show bins at `LADDER[rungs[lane]]`, then animate them to `after`.
5. Show the capped finish.
6. Debit at start and credit `winOf(total, bet)` once.

Replace the provisional settlement with `settle`. Use the golden seeds for browser QA. Please land `art/frank/` with the rig manifest (pivots, parents, draw order) when ready.

**Next for Claude:** Rig Frank's idle, stamp slam, jam recoil, bonus salute and reduced-motion poses once `art/frank/` lands. Checking hourly.

**Questions for Dylan:**
1. Do you confirm these prototype interpretations?
   - Shared upgrades count per delivery.
   - Lost & Found keeps shared upgrades.
   - Registered Mail rescues everything.
   - Bonuses have no retriggers.
   - Paid spins cost 1.5× (Carbon Copy) and 2.5× (Registered Mail).
   - Mystery Delivery draws 40/35/25.
2. Should Night Shift get a floor? It currently pays nothing 1 in 6,814 bonuses.

**Blocked on:** nothing.

## 2026-11-05 04:27 UTC · Codex → Claude · route playback verified

Verified resolver 1ba1fe9 against 14/14 tests. The playtest screen now consumes stages[].moves, merged and delivered. Fixed-board browser checks: SFS DSU SSS SSS SSS splits and reunites into City once; SFS JSJ SSS SSS SSS with one rescue marks one saved and one jammed copy and delivers Air; SUS FSS SSS SSS SSS loses the upper fork arm and delivers City. All three replays preserved demo credit. 7,000 seeded presentation rounds passed structural checks.

Next owner: Claude. Please provide the settled playRound payload and final rescue allowance for each mode. Codex will bind payout and bonus presentation after that handoff. The private playtest still uses provisional settlement.

## 2026-11-05 04:10 UTC (Nov 4, 23:10 Cancún) · Claude → Codex · route resolver and fixtures
**Did:** Added the authoritative mail-routing resolver as pure modules: [`engine/sorter.js`](../games/dead-letter-depot/engine/sorter.js) (geometry) and [`engine/resolver.js`](../games/dead-letter-depot/engine/resolver.js). There are 14 route fixtures in [`tests/resolver.test.mjs`](../games/dead-letter-depot/tests/resolver.test.mjs) covering straight runs, up/down, edge loss (top, bottom, last stage), forks (including at an edge), merges, jams, exactly-once delivery, all three bins, rescues in route order, unlimited rescues and multiple entries. They also check purity and input validation. `node --test games/dead-letter-depot/tests/*.test.mjs` passes 14/14. The tested SHA is the commit carrying this entry.

**Runtime contract (for the screen):**
- **Board:** `board[stage][lane] = { s, fs?, forced? }`, 5 stages × 3 lanes, with lane 0 at the top. The stamps are `U` up, `S` straight, `D` down, `F` fork (one copy up, one down), and `J` jam.
- **Calling the resolver:** `resolveRoute(board, { entries = [1], rescues = 0 })` returns `{ entries, stages[], delivered, lost: { jam, edge }, rescued, reunited }`. Each `stages[i]` is `{ stage, in, moves, merged, out }`, and each move is `{ from, to | null, kind, stamp, cause? }`. A move's `kind` is `up`, `straight`, `down`, `fork`, `jam`, `edge` or `rescue`.
- **Animating a route:** animate `moves` stage by stage. Show `merged` lanes as copies reuniting. `delivered` lists the bins that receive a letter (ascending, each at most once).
- **Rescues** carry a lost branch straight on in its own lane, spent stage by stage, top lane first, and a fork's upper arm before its lower arm.
- The resolver never draws randomness and never pays. The seeded engine, postage and settlement come next, and are not committed until they are calibrated and measured.

**Next for Codex:** Build the route animation on this contract with fixed boards (the fixture boards make good demo cases). Please don't hard-code outcomes in the screen; it will receive whole settled rounds from `playRound`.
**Next for Claude:** Seeded engine, postage and bonus rules, settlement, exact calculator plus a Monte Carlo cross-check, then calibrate to 96% by cost with the 25,000× round cap, `MATH.md`, and rig Frank once `art/frank/` lands.
**Questions for Dylan:** none yet. Rule interpretations will be listed with the math.
**Blocked on:** nothing.

## 2026-11-05 UTC · Codex → Claude · kickoff
Dylan requested an original game. A night-shift postal pigeon named Frank operates a five-stage mechanical mail sorter. Each spin drops a letter into the middle lane of a three-lane cabinet. Track stamps send it up, straight, or down one lane into the next column. Forks split it, jams kill that branch, and reunited copies count once. Only deliveries that leave the fifth stage score. The suspense is following the envelope and seeing whether the last sorter sends it to the valuable bin.

**Claude can start now.** Own the authoritative seeded resolver, math package, settlement and Spine rig. Codex owns the art, screen setup, demo choreography and rig parts. Implement in separate files in slots/games/dead-letter-depot. Read slots/AGENTS.md and slots/collab/GAME_RELEASE_CHECKLIST.md. Start with route fixtures (edge loss, fork, merge, jam, exactly-once delivery) while Codex lands art/frank. Read the rig manifest before binding bones. Deliver idle, stamp, jam recoil, bonus salute and reduced-motion poses. Record the runtime contract and tested SHA here.

**Requested modes.** Base; Priority Mail (enhanced, target 3× cost and 5× natural bonus entry rate); Carbon Copy (feature spin with an opening fork); Registered Mail (feature spin with a protected route); Night Shift (regular, 10 spins, successful bins gain persistent value); Double Dispatch (super, 10 spins, inject from two lanes, shared bin upgrades); Lost & Found (hidden, 10 spins, three entry lanes plus one automatic rescue per spin). Three/four/five FS on distinct columns award Regular/Super/Hidden. Mystery draws one of all three. Prototype prices Regular 100×, Super 250×, Mystery 400×. Calibrate weights; never claim RTP until measured. Target 96% by cost, 25,000× cap across entire round. Art never decides outcomes.

**Handoff loop.** Pull before working. Commit to this branch or open a PR into it if restricted to a Claude branch. Post meaningful changes, tests, blockers and next owner here newest first, with SHA/PR. Check hourly while open. No blank heartbeat commits. Dylan signs off before release.