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

Status: `todo` · `doing` · `review` (waiting on Dylan) · `done` · `blocked`. Whoever changes a task's status updates its row.

## Game 001

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| G1-01 | Math model: 5×3, 20 lines, multiplying wild multipliers in free spins, bonus buy | Claude | review | 96.28% RTP, high volatility, 10,000x max. Dylan to approve: D-002 |
| G1-02 | Engine: reels, anticipation, wins, big wins, free spins, HUD, sound, phone layout | Claude | done | Playable with placeholder art |
| G1-03 | Three theme concepts that fit the mechanic | ChatGPT | todo | Brief in `collab/CHATGPT_KICKOFF.md` |
| G1-04 | Pick the theme | Dylan | todo | Record in `DECISIONS.md` as D-003 |
| G1-05 | Style frame (full-screen mockup in the chosen theme) | ChatGPT | todo | After G1-04 |
| G1-06 | Approve the style frame | Dylan | todo | |
| G1-07 | 11 symbols | ChatGPT | todo | `games/game-001/ART_SPEC.md` |
| G1-08 | 4 backgrounds | ChatGPT | todo | |
| G1-09 | Logo, 5 banners, coin, `theme.json` values | ChatGPT | todo | |
| G1-10 | Integrate art, screenshots, per-asset feedback | Claude | todo | Each time art lands in `art/inbox/` |
| G1-11 | Theme-specific animation pass (wild/scatter specials, glow colors, idle motion) | Claude | todo | After the symbols land |
| G1-12 | Sound pass for the theme | Claude | todo | Synth placeholders now |
| G1-13 | Playtest (feel of base game, bonus frequency, big win pacing) | Dylan | todo | Any time: `?demo=feature` jumps straight to a bonus |
| G1-14 | Ship v1: publish playable link, tag release | Claude | todo | |

## Backlog (ideas, not scheduled)

- Game 002 mechanic. Dylan's call: tumbling/cascades, hold-and-win, sticky wilds, ways-to-win…
- Recorded sound effects instead of synth.
- Promo video renderer: frame-perfect capture of a bonus round for clips.
