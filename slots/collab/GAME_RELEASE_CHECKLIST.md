# Studio game release checklist

Copy this checklist into each game as `RELEASE_STATUS.md` before its first playable build. Keep it with the game through release. A checked box means the named build passed the check. Add a replay, screenshot, simulation report, test result or signed review beside it. Record who verified it and when. For a mechanic the game does not offer, write **N/A** and the reason.

| Game | Branch / commit | Playable link | Build / audience | Producer | Art | Math / engineering | QA |
|---|---|---|---|---|---|---|---|
| Fill in | | | | | | | |

**Gate order** — approve the game brief, play one complete round, freeze the presentation, sign off the math, verify the packaged build, then approve its audience. A deployed private playtest may still have open release gates.

## 1. Brief and rules

- [ ] The producer approves the theme, mascot, grid, symbol count, win direction and how a round ends. Include one illustrated example.
- [ ] Define the paytable, qualifying matches, substitution rules, scatters, retriggers, overlapping wins and tie resolution. Examples must agree with the rules used by the client.
- [ ] Specify every feature and bonus. Record trigger count, price, selection odds, starting state, spin count, guarantees, persistence, finale, and exactly when charges reset.
- [ ] Define the payout unit, tier thresholds, feature-spin comparison basis, maximum win and cap scope. Document any floor, remaining-budget calculation and early feature end.

## 2. Art and layout

- [ ] Test every symbol together at reel size on a phone. Values, silhouettes and colours distinguish lows, premiums, Wilds and FS. Check consistent scale, crop, transparency and contrast on lit cells.
- [ ] Approve title treatment, mascot rig, hive or prop placement, backgrounds, cabinet, illumination and foreground layering in a real screenshot. Check large and small screens.
- [ ] Verify mascot idle, trigger, departure, return and per-feature actions. Record the low-performance fallback. Keep animation randomness separate from outcome randomness.
- [ ] Export artwork, sprite atlases, fonts and audio at the required resolutions. Check attribution, usage rights, missing files and loading transitions.
- [ ] Approve the actual lobby thumbnail, game title and entry route. A clean launch must open the game with the approved palette and framing.

## 3. Spin and feature flow

- [ ] Exercise idle → spin → stop → result → next spin in normal, quick/turbo and autoplay. Stop affects only the active spin. Autoplay stops at its selected count or a bonus.
- [ ] Check reel timing, landing order, missed teases and successful teases. Watch two near misses and a natural trigger at normal speed.
- [ ] For tumbling games, show the win, clear shared cells once, drop survivors in order and continue until settled. Multipliers stay attached to the correct cells and become active at the specified step.
- [ ] Reveal seeded multipliers and guarantees before they matter. A surviving Wild must not be collected twice. Test empty/full banks, capped cells and more earned targets than available positions.
- [ ] Walk through natural and purchased Regular, Super and Hidden entries. Check the full-screen transition, concise rules, starting board, free-spins counter, Wild counter, final spin, total and return to base.

## 4. Controller and purchases

- [ ] Match the studio desktop and mobile controller. Verify Play/Stop, +/−, bet picker, circular Auto, Turbo, sound, settings and full-screen entry/exit where supported.
- [ ] Check minimum/maximum bets, base bet versus charged cost, balance and exact win formatting. Verify insufficient funds, double taps and in-flight controls.
- [ ] Separate bonus buys from feature spins. Verify every card’s price, feature description, confirmation, active indicator and disable path. Test cancellation, bet changes and purchases at two stakes.
- [ ] Ensure menus scroll on short phones. Keyboard focus is visible, dialogs trap and restore focus, buttons have meaningful names, and reduced-motion settings have a readable alternative.

## 5. Wins, sound and pacing

For each row record the threshold or exact trigger, boundary tests just below/at it, a working replay, audible cue, phone proof and desktop proof. Mark absent tiers N/A only with producer approval.

| Tier | Threshold / event | Replay + exact amount | Motion + cue | Phone / desktop |
|---|---|---|---|---|
| Nice | | | | |
| Big | | | | |
| Epic | | | | |
| Mythic | | | | |
| Max | Settled cap event | | | |

- [ ] Qualifying base, feature and free-spin results use the agreed bet basis. Trigger once after all contributing wins. Label a free-spins total separately from a spin win. The displayed amount matches credited cents.
- [ ] Check a double tap, default auto-dismiss, skip to total, continue, turbo, reduced motion, pressing Space/Escape and switching tabs. Overlays must release input and must never debit or credit the balance.
- [ ] Test base and bonus music across a full loop. Check click, reel-stop, tease, Wild, scatter, multiplier step, feature flight, win tiers and max cues. Listen for clipping, abrupt cuts and overlapping tracks.
- [ ] Mute before a win, mute during a win, unmute, skip and replay. A cue must not leak into the next spin. Check audio unlock on a real phone.

## 6. Math, settlement and recovery

- [ ] Run deterministic fixtures against the same resolver the game uses. Cover no win, intersections, multi-step wins, all bonus tiers, final-spin guarantees and cap boundaries.
- [ ] Simulate normal, enhanced, each paid feature, each direct buy and Mystery. Record sample size, seed, cost, expected return, uncertainty, hit rate, trigger rate, distributions and worst observed exposure.
- [ ] Confirm the max is reachable, its ceiling holds, and a capped round settles once. Verify total rounding at minimum and maximum stakes and any already-paid portion of a bonus.
- [ ] Save and reload during spinning, tumbling, a purchase, bonus entry, a bank release and a celebration. Check background/foreground, storage failure and older saves. The same outcome, remaining spins and exact balance must survive.
- [ ] Math owner approves the versioned report. The field manual and any displayed odds match that revision.

## 7. Device QA and release

- [ ] Test desktop landscape, short and tall portrait phones, rotation, safe areas, browser zoom and full-screen exit. Physically test at least one supported iOS and Android device.
- [ ] Measure cold start, frame pacing on the busiest moment, memory over a long autoplay run and the fallback path. Check slow/missing assets, muted startup, hidden tabs and console errors.
- [ ] Run the rules suite and browser flow tests. Archive representative phone/desktop captures, sound-on recordings and reproducible seeds on the release commit.
- [ ] Verify the ordinary URL, lobby entry, optional replays and fresh/resumed sessions on the packaged build. Remove QA fixtures. Confirm GitHub branch/commit, published version, access audience and rollback point.
- [ ] Producer and math owner sign off. Record open issues, owner and next action in the handoff. A private mechanics build stays marked as a playtest until the release blockers close.
