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
| S-14 | Verify the pinned rig review page | ChatGPT | done | This session fetched the original 5,067,311-byte file at the existing SHA-256; all 279 manifest files verified. No re-pin or catalog transfer required. |

| S-15 | Sounds editor (originally queued as S-12 on Codex) | ChatGPT | blocked | Implementation and unit tests ready; browser validation blocked by Chromium socket permission in this environment. Claude can run tests/browser/sounds.e2e.mjs before deployment. Includes uploads, event assignment, loops, gain/fades and persistence. |

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
