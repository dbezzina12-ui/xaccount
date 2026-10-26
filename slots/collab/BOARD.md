# Board

Status: `todo` · `doing` · `review` (waiting on Dylan) · `done` · `blocked` · `paused`. Whoever changes a task's status updates its row.

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

| S-29 | Free Super/Hidden previews paid unrealistic wins (Hidden: the 25,000x cap every time) | Claude | review | They replayed one scripted demo round. Now each plays a real catalog bonus (Hidden averages 816x, caps 1 in 374); credits still untouched. Paid math unchanged. See MATH.md "Free previews" |

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
| N-09 | Retune Night Fall after Roaming Wild | Dylan → Claude | review | **Balanced:** base spin 96.0% (attack chance 18% → 30%), Free Spins 120× → 96.7%, Super 500× → 95.6% (sticky roamers and bursts). **Open:** Reaper Strike spins 101.5% at 4×. **Art:** a roaming-wild tile (ChatGPT). `games/nightfall/MATH.md` |
| N-10 | Spin into Super: gold Super tombstones; 3 gold start Hidden Free Spins | Claude (Dylan's tiers) | review | Super 1 in 2,646 base spins; Hidden about 1 in 3.5 million (the enhanced spin will be the way to it); base 95.4% with the base attack at 20%. **Open:** Reaper Strike spins at 108.9% (about 4.55×?). **Art:** a gold Super tombstone (ChatGPT). `games/nightfall/MATH.md` |
