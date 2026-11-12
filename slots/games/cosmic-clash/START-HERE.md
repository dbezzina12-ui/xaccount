# Start here: Cosmic Clash math redesign

[Dylan’s math brief](../../collab/COSMIC_CLASH_HANDOFF.md) is the source of truth for the requested changes. The engine and menu in this directory describe the shipped baseline.

- Run `npm run odds` to measure the weighted outcomes. If `dist/outcomes.json` is absent, `npm run math` rebuilds it from the checked-in generator. The shipped catalog's Git object ID is `c20f72b298852df519c0f629e578edb5a5907c0a`.
- To reproduce the full offline baseline, including all art, sound, animation and original media, obtain **Cosmic-Clash-Claude-Handoff.zip** from Dylan. From this directory, run `python3 scripts/restore-release.py --archive /path/to/Cosmic-Clash-Claude-Handoff.zip`. It verifies the original bytes and preserves edits. The hosted Site may require access; the archive works without it.
- With the full game in place, run `npm test` (131 passing tests on the shipped handoff). To play locally use `python3 -m http.server 8000 --directory dist`.
- Start the redesign on a new branch. Compare against the baseline before changing the displayed odds or deploying gameplay changes.
