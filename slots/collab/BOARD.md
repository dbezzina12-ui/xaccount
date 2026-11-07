# Board

Status: `todo` · `doing` · `review` (waiting on Dylan) · `done` · `blocked` · `paused`. Whoever changes a task's status updates its row.

## Dead Letter Depot

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| DLD-REELS | Return to Sender badge, bonus counters and editable layout | Codex | review | Printed postcard bonus buys and confirmations ready for Dylan; one-sentence bonus entries, parcel retriggers, illustrated wins and cumulative totals retained. Vault 2, Vault, Key Ring, Balanced and Steady integrated and verified; Dylan to compare/select. Vault 2 7/7/5 notch sizes, 60×/120× first vaults and 1,000× inner state checked. Vault base ×2 and all-tier 1,000× ceilings checked. See latest handoff for golden, minimum-award, purchase and reload evidence. Parcel-to-camera entrance preserved. Edit the scene in [Studio](https://gamboligy-studio.djames1.chatgpt.site/dead-letter-depot-studio/index.html?view=phone&scene=base). [Test evidence and next owner](DEAD_LETTER_DEPOT_HANDOFF.md). Five-light vault art/animation kit ready; isolated preview only pending Claude perks payload. See latest handoff. |
| DLD-MATH | Collections, jobs and meter engine (`dld-reels-2`), prototype math at 96%, fixtures | Claude | review | `23afe0f`; [MATH.md](../games/dead-letter-depot/MATH.md), [ENGINE.md](../games/dead-letter-depot/ENGINE.md). Awaiting Dylan on premium targets and meter starts. |

| DLD-BENCH | Fresh Le Bandit 96% family benchmark rounds requested by Dylan | Claude | todo | REQUEST only: verify working demo/logging and 20 Regular +20 Super pilot, then additional 10,000 base /1,000 Regular /1,000 Super if access permits. Existing 10,000/50 is not new data. See latest project handoff for source checks, failed launcher evidence, deduplication and mode/profile requirements. |

## RoboBees

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| RB-20 | Restore multiplier lettering across RoboBees | ChatGPT | done | Shared digits and smaller ×; verified the guide and 32× tumble on desktop. |
| RB-19 | Finish every bonus on a full-screen result | ChatGPT | done | Verified accumulated credits, zero, early cap and reload. Replay with `?preview=bonus-end`. |
| RB-18 | Reset demo credits and fix cold reel symbols | ChatGPT | done | Menu restores $10,000. Symbol loading and Retry were tested on a phone layout. Card ranks use one height. |
| RB-17 | Fly the win swarm beyond the reels | ChatGPT | done | All five tiers use the full viewport. Checked the seven-bee Max formation on portrait, landscape and desktop. |
| RB-16 | Larger win artwork and feature-price celebrations | ChatGPT | done | Large foreground bees, title and amount; Pollen Charge and Hive Overdrive grade paid spins at 2×, 5×, 25× and 50× their price. |
| RB-15 | Put the Wild count and worker flights on the tree hive | ChatGPT | done | Cabinet counter removed; incoming bees count on entry and outgoing bees count on launch. Replay with `?preview=hive`. |
| RB-14 | Win tier celebrations and shared release checklist | ChatGPT | done | Five previews, four naturally qualifying tiers, two-tap skip and a real $435.20 Epic replay. Live Max awaits the cap decision tracked in RB-13. |
| RB-12 | Tumbling wins in all modes and two multiplier feature spins | ChatGPT | done | All-mode replay and settlement tests pass. Prices follow Gnome Mercy. |
| RB-13 | Calibrate tumble and feature-spin math | Claude | review | 2026-11-02. Every mode returns 96% within simulation noise, with a 25,000× round cap and live Max. Feature spins: Signal Boost, Pollen Charge and Hive Overdrive (Scout Run removed at Dylan's request). See `games/robobees/MATH.md`. Pollen Charge and Hive Overdrive now use the Medium big-hit shape (Dylan). Waiting on Dylan's sign-off. |
| RB-11 | Integrate the 3D mascot bonus transition | ChatGPT | done | Merged Claude’s swarm renderer into the honey FS build and retained the sprite fallback. |
| RB-10 | Glass FS with liquid honey | ChatGPT | done | Slosh, surface and bubbles respond on reel travel and landing. Phone Super replay verified. |
| RB-09 | Tighten and animate FS letters | ChatGPT | done | Per-reel landing, synchronized tease and award verified at phone width. Replay with `?preview=scatter`. |
| RB-08 | Larger, bolder FS scatter | ChatGPT | done | Standard and enamel palettes, phone reel stops and Super tease checked. |
| RB-07 | Colour separation for the original symbols | ChatGPT | done | Main game uses the enamel colours. The orange palette is available at `?palette=original`. |
| RB-06 | Illustrated reel cabinet and play-screen cleanup | ChatGPT | done | Checked in base and Super across phone and desktop. |
| RB-05 | Painted woodland, integrated hive and larger reel layout | ChatGPT | done | The board and left wordmark were checked at desktop and phone sizes. |
| RB-03 | Mascot: hive and robo-bee in `#mascot-stage`; bee flies out on bonus transitions; worker bees show banked Wilds | Claude | done | 2026-11-01. Live 3D (`live3d.js`, about 160 KB gzipped, about 70 draw calls) with sprite fallback. Outcomes untouched (seeded browser test, no `Math.random` in the bundle). Tests pass. Merged into the game; real-phone frame rate awaits Dylan’s check. |
| RB-04 | Production math calibration | Claude | review | Merged into RB-13: one `MATH` block in `rules.mjs`, a fit tool, a generated sheet, and a check in `npm test`. |
| RB-02 | Simplify the reel scenery | ChatGPT | done | Responsive apiary silhouette with dusk lighting in bonuses, verified on desktop and phone. |
| RB-01 | Persistent multiplier cell colours | ChatGPT | done | Seven shades from 2× to 128×, anchored to the grid during reel travel. Verified on a phone layout. |

## Cyber Skunk (authorized 2026-10-30; 24-hour target)
Coordination: `games/cyber-skunk/STYLE.md`; deadline target 2026-10-31 08:25 UTC. Base + Regular/Super/Hidden + Enhanced + Feature Spins are required. ChatGPT hourly pickup enabled.

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| CS-01 | Concept, all-mode brief, visual direction and first style frame | ChatGPT | done | b738449, 9d5f8c9; design only, not playable |
| CS-02 | Exact art/pivot contract and articulated rig guide | Claude | done | Rig v4 (compact, waist up): `art/rig/pivots-v4.json`, `guide-v2.jpg`, 17 pieces; ChatGPT painting the pieces |
| CS-03 | Engine, paytable/calibration, all-mode distribution and max odds | Claude | done | cs-2 (Dylan's odds, all met): base max 1 in 1,000,000; bought Vent Break 1 in 200,000 (now with a Reservoir to 5) and Overpressure 1 in 50,000; Blackout 1 in 200 and ≥1,000×; all modes exactly 96% |
| CS-04 | Production symbol/cabinet/background/logo and registered mascot layers | ChatGPT | done | Required art and the optional controller texture/icon are integrated and browser-checked through `a0f501f`; the optional splash pair remains absent by design. Preserve the fitted v4.1 eyelids and do not drop old-v4 mouth candidates into production. |
| CS-05 | Rig, animations, original audio and responsive runtime integration | Claude | done | Rig v4.1, fitted blink, tail nozzle seated on the tail tip (2026-11-01, `art/rig/fitted/nozzle.png`), all clips/audio, full centred symbol-card flip, pipe mount, bonus halls, intro art, controller texture and icon are live and browser-checked through `a0f501f`. |
| CS-06 | UI skin, buy screens, controller and phone visual QA | ChatGPT + Claude | doing | The complete `a0f501f` build passed responsive QA. Claude measured one pre-existing exception: the enabled portrait BET picker was 34px tall. ChatGPT restored the final portrait readout/BET row to STYLE's 44px minimum and bumped the controller/CSS version; Claude must measure 360/390/430, check safe areas/no scroll and republish. |
| CS-07 | Final replay/math/browser tests, playable link, notify Dylan | ChatGPT + Claude | doing | Preview link (private to Dylan, updates in place): https://claude.ai/artifact/Qcrirm5ru2hScWfRqADBQc. The `a0f501f` artifact passed 11 browser, 23 game and 127 core tests; all 141,260 catalogs replayed, every paid mode is 96%, and served files matched. The source-only 44px BET target correction now needs Claude's browser run and republish before the latest source revision is called live. |

## Zombify Studio (current focus, D-004)

Dylan paused new Game 001 development on 2026-10-23. The Game 001 tasks below are kept as history.

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S-01 | Visual studio editor: desktop/mobile scenes, layers, backgrounds and grades, reel grid and size, drag/resize, uploads, undo, save/import/export | ChatGPT (Codex) | done | `be5ba19`; review fixes on `claude/blissful-rubin-xou20i` |
| S-02 | Import Zombify v125 with its walking, infection, Outbreak and Second Life mechanics and outcomes unchanged | ChatGPT (Codex) | done | Large assets and catalogs are hash-pinned and fetched by `npm run studio:prepare` |
| S-03 | Review the adapter boundary, round locking, reel animation, persistence; fix what's broken | Claude | done | See HANDOFF 2026-10-23 “Studio review” |
| S-04 | Measure Zombify's math as it is (simulate through the adapter, no changes) | Claude | done | `games/zombify/MATH.md`: every mode 96.0000% RTP, exact from the catalogs; 234,000 outcomes replayed through the engine, 0 mismatches |
| S-05 | Say where the Zombify source lives | Dylan | done | `games/zombify/runtime/` plus `studio:prepare` |
| S-06 | Verify the review fixes with the real Zombify runtime (checklist in HANDOFF) | ChatGPT + Claude | done | ChatGPT's manual pass (HANDOFF 2026-10-24), and Claude's automated suite `tests/browser/zombify.e2e.mjs`, 8/8, screenshots `studio/shots/s06-*.jpg` |
| S-07 | Give Claude's environment the Zombify assets: allow `zombify.djames1.chatgpt.site` in the environment's network settings, or provide the asset archive another way | Dylan | done | Network opened 2026-10-24; `studio:prepare` verified 278 of 279 files (see S-14) |
| S-08 | Connect a hosted AI provider to Quick edit | Unassigned | paused (D-005) | Quick edit runs local commands only; embedded chat removed from the active editor. Art is created in ChatGPT and imported/integrated. |
| S-09 | Claude in Studio chat: adapter, one shared chat with @mentions, provider-specific cancel, durable handoff jobs | Claude | done, dormant (D-005) | Archived source; chat UI removed under D-005. No keys, server deployment or provider calls. |
| S-10 | Provision `ANTHROPIC_API_KEY` (and `OPENAI_API_KEY`) as Site secrets; publish; bounded live check | Dylan + ChatGPT | cancelled (D-005) | No API keys; don't create or provision any |
| S-11 | Decide on a caller for background handoffs (signed `hooks/dispatch`) | Dylan | cancelled (D-005) | Optional. Without one, handoffs continue only while the studio is open |
| S-12 | Two tabs on one project overwrote each other's saves | Claude | done | Versioned saves; idle tabs follow, a tab with unsaved edits asks before replacing |
| S-13 | Import was hidden at phone widths | Claude | done | Shown at every width; header fits at 320 px |
| S-14 | Provide a stable download for the pinned rig review page | ChatGPT | todo | Low priority: exact 5,067,311-byte copy is preserved and hash-verified in the Studio source/deployment. Claude still receives 5,068,249 B from the upstream redirect. Source URL remains unresolved; game never loads this review page. |

| S-15 | Sounds editor (originally queued as S-12 on Codex) | ChatGPT + Claude | done | ChatGPT built it; Claude verified it in the browser by measuring the game's audio output (`zombify.e2e.mjs` test 9) and fixed event names and the Loop row. Published to the existing private Studio on 2026-10-24; see newest HANDOFF for deployment evidence. |

| S-16 | Studio pass 1: artwork/text editing and held scenes | ChatGPT + Claude | done | Review patch and save-flush hardening applied and published; source synced under S-19. |
| S-17 | Studio pass 2: alignment and reusable presets | ChatGPT + Claude | done | Claude 2026-10-25: browser suite passes on it (drag test now holds Alt, the snap bypass); preset apply, ID remapping and mid-round refusal read correct; no defects |
| S-18 | Studio pass 3: saved versions and game export | ChatGPT | todo | After pass 2. |
| S-19 | Sync pass 1 code and three new images | ChatGPT | done | Active `studio/` matches patched Site. Exact artwork bundled with hash verification; `studio:prepare` restores PNG paths. |

| S-20 | Zombify game presentation and anticipation polish | ChatGPT + Claude | review | Claude 2026-10-25: anticipation regressions on forced catalog outcomes; phone profile and fixes (dropped frames 21-53% → 3-17% emulated); zombie weight; tier-following anticipation audio. Waiting on real-phone numbers (S-24) and a listen on a phone |
| S-24 | Real-phone performance: open the game with `?perf` on an Android phone (Chrome) and an iPhone (Safari), play about 10 spins and a bonus, tap Copy report, paste the reports to Claude | Dylan | todo | Emulation can't measure a phone GPU or Safari; these numbers decide the next performance work |

## Game 001 (paused by D-004)

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| G1-01 | Math model: 5×3, 20 lines, multiplying wild multipliers in free spins, bonus buy | Claude | paused | 96.28% RTP, high volatility, 10,000x max. Dylan to approve: D-002 |
| G1-02 | Engine: reels, anticipation, wins, big wins, free spins, HUD, sound, phone layout | Claude | done | Playable with placeholder art |
| G1-03 | Three theme concepts that fit the mechanic | ChatGPT | paused | Brief in `collab/CHATGPT_KICKOFF.md` |
| G1-04 | Pick the theme | Dylan | paused | Record in `DECISIONS.md` as D-003 |
| G1-05 | Style frame (full-screen mockup in the chosen theme) | ChatGPT | paused | After G1-04 |
| G1-06 | Approve the style frame | Dylan | paused | |
| G1-07 | 11 symbols | ChatGPT | paused | `games/game-001/ART_SPEC.md` |
| G1-08 | 4 backgrounds | ChatGPT | paused | |
| G1-09 | Logo, 5 banners, coin, `theme.json` values | ChatGPT | paused | |
| G1-10 | Integrate art, screenshots, per-asset feedback | Claude | paused | Each time art lands in `art/inbox/` |
| G1-11 | Theme-specific animation pass (wild/scatter specials, glow colors, idle motion) | Claude | paused | After the symbols land |
| G1-12 | Sound pass for the theme | Claude | paused | Synth placeholders now |
| G1-13 | Playtest (feel of base game, bonus frequency, big win pacing) | Dylan | paused | Any time: `?demo=feature` jumps straight to a bonus |
| G1-14 | Ship v1: publish playable link, tag release | Claude | paused | |

## Backlog (ideas, not scheduled)

- Game 002 mechanic. Dylan's call: tumbling/cascades, hold-and-win, sticky wilds, ways-to-win…
- Recorded sound effects instead of synth.
- Promo video renderer: frame-perfect capture of a bonus round for clips.

## Artwork and collaboration — D-005

- [x] Integrate Claude's review and retain its dormant adapter work in the repository.
- [x] Remove embedded chat from the active editor and document the artwork upload workflow.
- [x] Complete the remaining S-06 runtime checklist (ChatGPT's manual pass and Claude's automated real-runtime suite).
- API key provisioning, API-chat publication and automated provider handoffs are cancelled. Use repository handoffs and Dylan's “your turn” relay.

| S-21 | Approved subway mobile scene, live reels and existing controller | ChatGPT | done; Claude review | See latest HANDOFF; mascot animation/desktop art are follow-up |

| S-22 | Subway bonus lab, live jars and atlas effect fixes | ChatGPT | done; Claude review | Scene swaps under existing closed doors; preserve symbol-paint contract |

| S-23 | Desktop subway, aligned counter, infected/FS art, intro and zombie crossing fixes | ChatGPT + Claude | done | Eight collision regressions; current scene in entry/guide; desktop/mobile art. Claude 2026-10-25: merged with S-20, all suites pass; crossings checked on every regular-bonus outcome (0.8% have one, no multiplier ever lost); fixed the landing zombie's head being cut at a crossed cell (`studio/shots/s23-crossing-landing.jpg`) |

| S-25 | Merge S-20, enlarge desktop subway reels, improve head-cell awards and test scene lifecycle | ChatGPT | done; Claude review | 800px cabinet / 880px controller; side jars; outlined head multiplier; six scene lifecycle regressions. Real-device visibility/perf stays S-24 |

| S-26 | Mascot idle, waving intro, clean base/bonus plates | ChatGPT | done | Separate animated puppet; 30fps cap, hidden/reduced-motion cleanup; both layouts. Claude 2026-10-25: fixed the greeting's waving arm (detached at the shoulder for most of the wave) |

| S-27 | Better tease: slow camera push during FS drops, readable spotlight, visible status, FS shock rings | Claude | done | Dylan 2026-10-25: zoom is good. Presentation only; anticipation tests now check the camera (zooms, rests after, Skip/hidden/reduced motion). `studio/shots/s27-tease-phone.jpg` |

| S-29 | Free Super/Hidden previews paid unrealistic wins (Hidden: the 25,000x cap every time) | Claude | review | They replayed one scripted demo round. Now each plays a real catalog bonus (Hidden averaged 816x, caps 1 in 374; since S-30, 2,256x, caps 1 in 86); credits still untouched. Paid math unchanged. See MATH.md "Free previews" |

| S-30 | Zombify rebalance (Dylan 2026-10-28): Second Life starts with 2-4 zombies and later hearts bring more; Hidden pays 1,000x+; Mystery 460x (90% Super / 10% Hidden since 2026-10-29), Enhanced 3.3x | Claude | review | Every mode exactly 96%; Hidden averages 2,256x; Second Life 2/3/4 zombies average 5.1x/15.8x/52.2x. `tools/math/zombify-rebalance.mjs`, MATH.md. Copy polished by ChatGPT; Studio integrated. Payout feel review remains with Dylan |

| S-31 | Zombify on Stake Engine: 0.1x paytable, math files (6 modes, exactly 96%), front end on the RGS, upload build | Claude | review | `npm run stake:zombify` → dist/stake/zombify/{frontend,math}; games/zombify/STAKE.md. Dylan to upload and test on Engine |

## Night Fall (separate project, authorized by Dylan 2026-10-25)

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| N-01 | Import Night Fall (Knightfall v0.5.3 engine, unchanged) with the new reaper/archer art | ChatGPT | done | From Dylan's handoff zip; merged on `claude/blissful-rubin-xou20i`. `engine.js` SHA-256 876e2a6d... |
| N-02 | Rigs: real joints for the reaper and archer, feet planted, arms seated | Claude | review | Second pass: forearms into their sleeves, archer arms on the body's shoulders, bow hand on the grip. Waiting on Dylan's look on a phone. `games/nightfall/shots/arms-before-after.jpg`; `games/nightfall/ANIMATION-HANDOFF.md` "Claude rig pass" |
| N-03 | Unify the Night Fall editor with the Studio inspector | ChatGPT | todo | From ChatGPT's animation handoff |
| N-04 | Redraw both characters to match the layout target, as registered rig layers (rig v2) | ChatGPT | todo | Dylan: match the target, no corners cut. Spec: `games/nightfall/ART_SPEC.md`; guides `games/nightfall/shots/rig-v2/guide-*.jpg`. Deliver to `games/nightfall/art/inbox/rig-v2/` |
| N-05 | Rig v2: import the new layers, rebuild joints, re-key strike and shot, pixel checks | Claude | blocked | Waits on N-04 |

| N-06 | Reaper arm behind the robe: bone arm under the shoulder mantle | ChatGPT + Claude | done | Default reaper since 2026-10-26 (Dylan approved, art in the repo). `?reaper=v1` shows the first rig. Previews: `games/nightfall/shots/reaper-v2/` |
| N-07 | Skeleton mage in place of the archer: Dylan's mantle, staff slam, breathing, flap riding on the arm | Claude | done | Default since 2026-10-26 (`?archer=archer` shows the archer). Previews `games/nightfall/shots/mage/` |
| N-08 | Roaming Wild: the mage zaps one cell (base), one mage wild roams each free spin; multipliers inside the cells; mage copy | Claude (from ChatGPT's brief) | review | In the game. Engine + tests, bolt/spark/sound, copy, centred multipliers. Math moved a lot: `games/nightfall/MATH.md`. Clip `games/nightfall/shots/zap/zap-phone.mp4` |
| N-09 | Retune Night Fall after Roaming Wild | Dylan → Claude | review | **Balanced:** base spin 96.0% (attack chance 18% → 30%), Free Spins 120× → 96.7%, Super 500× → 95.6% (sticky roamers and bursts). **Open:** Reaper Strike spins 101.5% at 4×. **Art:** ChatGPT's soul lantern is in (cd4dc9e). `games/nightfall/MATH.md` |
| N-10 | Spin into Super and Hidden: gold and Hidden tombstones; Hidden's opening strikes | Claude (Dylan's tiers) | review | Super 1 in 2,673 base spins; Hidden 1 in 90,909 (Hacksaw-style 5-scatter odds). Hidden opens with 3-5 mage strikes that raise the tiles (2,415× average). Base 96.0% with the base attack at 19%. **Next:** remove Reaper Strike spins (Dylan). **Art:** gold and Hidden tombstones (ChatGPT). `games/nightfall/MATH.md` |
