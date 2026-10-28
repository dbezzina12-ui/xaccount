# Decisions

Dylan has the final say. The AIs propose here (status `proposed`) and Dylan confirms (`decided`). Once decided, nobody reopens a decision without asking Dylan.

| ID | Date | Decision | Status | By |
|---|---|---|---|---|
| D-001 | 2026-10-23 | Studio setup: one repo, roles in `AGENTS.md`, notes in `collab/HANDOFF.md`. ChatGPT does graphics; Claude does math, engine and animation; Dylan routes and decides. | decided | Dylan (request) |
| D-002 | 2026-10-23 | Game 001 mechanic: 5×3, 20 lines, wilds on reels 2–4; 3/4/5 scatters → 10/15/20 free spins; in free spins every wild carries x2/x3/x5 and multipliers on a line **multiply**; bonus buy 100x; max win 10,000x; RTP 96.28%; high volatility. | paused (see D-004) | Claude |
| D-003 | | Game 001 theme | paused (see D-004) | Dylan, from ChatGPT's concepts |
| D-004 | 2026-10-23 | **Zombify first; build the visual studio.** Pause the new Game 001/theme pass. Import the existing Zombify game (v125) and extend the engine with a real visual editor: backgrounds, independent mobile/desktop scenes, drag/resize, reel grids, symbol scale, grading, persistence and an agent editing boundary. Dylan explicitly authorized ChatGPT to implement this engine/editor work, a scoped exception to the art-only ownership split. Preserve existing outcome math (Zombify's walking/infection/Second Life mechanics and Game 001's model stay as they are); non-6×5 layouts remain presentation tests until a compatible game adapter is validated. | decided | Dylan |
| D-005 | 2026-10-24 | **No API keys; the assistants collaborate through GitHub.** Dylan won't pay for separate OpenAI or Anthropic API usage (it isn't covered by his ChatGPT or Claude plans). ChatGPT and Claude keep working on their plans and hand off through `collab/HANDOFF.md` and `collab/BOARD.md`, with Dylan relaying "your turn". The chat implementation stays in the repo for reference but is removed from the active editor and static publication. No provider keys or API calls are needed for the artwork upload workflow. Revisit only if Dylan asks. | decided | Dylan |

| D-006 | 2026-10-28 | S-30 supersedes D-004’s frozen Zombify v125 math. Claude maintains Zombify math. Imported source ff2ab39f51092be78dbde41d9ce605485bb9bf11: Second Life costs 10×, starts 2/3/4 zombies at 75/20/5%, and every heart after the first adds a zombie up to 6. Hidden minimum 1,000×; Mystery 400×; Enhanced 3.3×. Claude reports 96% catalog RTP in every mode. | decided scope; payout feel pending Dylan review | Dylan request relayed in S-30 |

S-30 balance review remains open: two-zombie starts average 5.10× base bet against the 10× cost; 46.74% of rounds pay nothing. Recording the authorized mechanics does not approve this payout distribution on Dylan’s behalf.
