@AGENTS.md

## Claude: start of every session

1. Read the newest entries in `collab/HANDOFF.md` and the Claude rows in `collab/BOARD.md`. Do the top Claude task unless Dylan says otherwise.
2. If `games/<id>/art/inbox/` has files, run `python3 tools/art/inbox.py games/<id>`. Look at `_sheet.jpg`, place each image with `--place N=target`, then run `python3 tools/art/prep.py games/<id> --optimize`.
3. Before handing off, run `npm test` and `npm run shots`. Look at the screenshots yourself and write specific art feedback.
4. End with a handoff note in `collab/HANDOFF.md`, and print the same note in chat so Dylan can paste it to ChatGPT with the screenshots attached.

## Math changes

- Edit `games/<id>/math/reel-design.json` (counts) or `model.json` (pays/features), then run `node tools/math/build-reels.mjs games/<id>`.
- Check exact figures: `node tools/math/report.mjs games/<id>` (it regenerates `MATH.md` and `math/summary.json`).
- Simulate: `node tools/math/sim.mjs games/<id>/model.json --rounds 1e9 --json games/<id>/math/sim-base.json`, and the same with `--buy --rounds 1e8 --json …/sim-buy.json`. About 2.5 min each on 4 cores. Re-run the report after.
- `tests/core.test.mjs` pins game-001's headline numbers; update the bounds deliberately, never to make a failure go away.
