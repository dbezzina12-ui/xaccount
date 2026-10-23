# Current priority: Zombify Studio

Dylan paused new Game 001 development on 2026-10-23. The earlier theme tasks below are retained as history.

| Task | Owner | Status |
| --- | --- | --- |
| Import existing Zombify v125 without changing its outcomes | ChatGPT | Implemented |
| Visual scene editor, independent mobile/desktop layouts | ChatGPT | Implemented |
| Drag/resize, grid presets, background grades, uploads, undo, save/export | ChatGPT | Implemented |
| Preserve 6×5 gameplay; use Claude reel component for other-grid layout tests | ChatGPT | Implemented |
| Review studio adapter and subsequent mechanics extensions | Claude | Ready for review |
| Connect a real hosted AI provider to the command box | Unassigned | Needs provider connection; local commands and browser agent tools are present |
| New Game 001 theme concepts | ChatGPT | Paused by Dylan |

---

# Board

Status: `todo` · `doing` · `review` (waiting on Dylan) · `done` · `blocked` · `paused`. Whoever changes a task's status updates its row.

## Studio engine around Zombify (current focus, D-004)

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S-01 | Visual studio editor: separate desktop/mobile scenes, layers and backgrounds, reel grid and size, color grading, drag/resize, undo/save/export | ChatGPT (Codex) | doing | Branch `codex/studio-zombify-editor` |
| S-02 | Load Zombify v125 into the studio with its walking, infection and Second Life mechanics intact | ChatGPT (Codex) | doing | Same branch |
| S-03 | Review the mechanics adapter boundary and reel animation integration | Claude | blocked | Waiting for S-01/S-02 to land on the branch |
| S-04 | Measure Zombify's math as it is (simulate through the adapter, no changes) | Claude | blocked | Needs the Zombify source in the repo |
| S-05 | Say where the Zombify source lives, or have it committed to the editor branch | Dylan | todo | Not reachable from Claude's session |

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
