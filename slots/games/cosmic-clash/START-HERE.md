Start with [Dylan’s math brief](../../collab/COSMIC_CLASH_HANDOFF.md).

From this folder, run `python3 scripts/restore-release.py` to restore missing files from the published game, including the exact weighted outcome catalog. Every downloaded file is checked against the source snapshot; existing edits are preserved. For a fully offline restore including original artwork, run `python3 scripts/restore-release.py --archive /path/to/Cosmic-Clash-Claude-Handoff.zip`.

Run `npm run odds` and `npm test` for a baseline. Change weights in the generator and run `npm run math` before comparing designs. Use `python3 -m http.server 8000 --directory dist` to play locally. This is the shipped starting point. Keep proposed math changes on your own branch until reviewed.
