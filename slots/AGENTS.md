# Slots studio: how we work

This repo is a three-member studio building slot games. Every AI reads this file first.

| Member | Role | Owns |
|---|---|---|
| **Dylan** | Owner and producer. Picks themes and features, approves looks, playtests, merges. Relays messages and files between the AIs. | `collab/DECISIONS.md` (final say on everything) |
| **ChatGPT** | Art director and image artist: themes, every image, the UI color/font skin, names and copy. | `games/*/art/**`, `games/*/theme.json`, `games/*/STYLE.md` |
| **Claude** (Claude Code) | Math (paytables, reels, RTP, simulation), engine, animation, sound, integration, QA, screenshots. | `engine/**`, `tools/**`, `tests/**`, `games/*/model.json`, `games/*/math/**`, `games/*/MATH.md`, `games/*/ART_SPEC.md` |

Shared files anyone may edit: `collab/BOARD.md` (task board), `collab/HANDOFF.md` (notes log, newest on top).

**Don't edit files another member owns.** Ask in a handoff note instead (`REQUEST for Claude: …`).

## The loop

1. **Pick up.** Read the top entries of `collab/HANDOFF.md` and your rows in `collab/BOARD.md`.
2. **Work.** Do your task. Stay inside the files you own.
3. **Hand off.** Add a note at the top of `collab/HANDOFF.md` (format below) and update your rows in `BOARD.md`.
4. **Relay.** Dylan tells the next member: *"Your turn: read collab/HANDOFF.md."* If that member can't read the repo, Dylan pastes the note.

## Handoff note format

```
### 2026-10-23 · Claude → ChatGPT · Engine ready for art
**Did:** what changed, in plain words
**Files:** paths touched (or, for art, the image list with target names)
**Next for ChatGPT:** 1. … 2. … (specific, in order)
**Questions for Dylan:** decisions only Dylan can make (or "none")
**Blocked on:** what's missing (or "nothing")
```

Keep notes short. Link to files rather than pasting them.

## How art gets in

1. Dylan asks ChatGPT for artwork here, including the intended game, desktop/mobile scene and asset role. Use `games/<id>/ART_SPEC.md` when it applies.
2. Generate and refine the artwork in the ChatGPT conversation. No embedded provider connection is needed.
3. If Dylan asks to put it in Studio, ChatGPT can prepare the asset, update this authorized repository/Site and verify the result. Keep the original symbol IDs and game math unchanged. Hand off engine work to Claude when needed.
4. For a browser-local project, download the image and use **Assets → Upload**, then assign it in the inspector. For a background, Quick edit's **＋** attachment and **change background** command also work locally. Select Desktop or Mobile first.
5. Export the `.slotstudio.json` project when moving browser-local edits between devices or handing the exact composition to an assistant. Publishing new defaults does not replace a saved browser-local project.

## Hard rules

- **Math is Claude's.** `model.json` changes only with a re-run of the simulator and a regenerated `MATH.md`. Art and copy never change odds. If a theme wants a different mechanic, ask Claude in a handoff.
- **Symbol IDs are fixed** per game (`H1…H4`, `L1…L5`, `W`, `S` in game-001). Themes rename them in `theme.json → symbolNames`, never in file names.
- **Original work only.** No real brands, casino names, existing slot titles, or copyrighted characters.
- **Play money.** The games are demos for streaming and fun. No real-money claims anywhere.
- **Every member leaves the repo runnable.** `npm test` passes and `index.html` loads.

## Map

```
index.html                 entry: plays games/<id> (?game=game-001, ?demo=feature)
engine/core/               rules + RNG (shared by the game and the simulator)
engine/client/             renderer, reels, effects, HUD, sound
games/<id>/model.json      the math (reels, pays, features)
games/<id>/MATH.md         the math sheet, generated
games/<id>/ART_SPEC.md     what images to make, exact sizes
games/<id>/theme.json      colors, fonts, names, copy (ChatGPT)
games/<id>/art/            images (art/inbox/ for unsorted drops)
games/<id>/shots/          in-game screenshots for review
collab/                    BOARD, HANDOFF, DECISIONS, ChatGPT kickoff prompt
tools/math/  tools/art/    simulator, exact calculator, art checks
```


## Current task override — 2026-10-23

Dylan directly authorized ChatGPT to implement the Zombify studio editor and adapter on `codex/studio-zombify-editor`. This is a scoped exception to the original art-only split. Game 001 theme creation is paused. Claude should review the editor/adapter and work from the newest handoff; do not independently start a replacement game. Math rules above remain in force.

## No embedded API chat — 2026-10-24 (D-005)

Dylan cancelled API activation. Do not create or configure provider keys or background handoff triggers. The active editor has no chat entry point or provider requests; the published Site is static. The unused adapter/hosting implementation is retained in Git history and source for reference, not loaded by the editor. ChatGPT and Claude continue through repository handoffs, with Dylan relaying “your turn”.
