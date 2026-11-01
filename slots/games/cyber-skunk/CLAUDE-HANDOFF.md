# Cyber Skunk gameplay handoff

Dylan requested that the shared branch carry the version he has been playtesting. The playable source is in `slots/games/cyber-skunk/runtime/`. This includes the loading screen and guide, mobile pressure rail, raised FS artwork, ticket shop, Mystery scatter reveal, door briefing, and cabinet-sized win screens.

Tier a spin from its credited `wins.paid` in hundredths of base bet. Nice starts at 10×, Big at 25×, Epic at 100× and Mythic at 500×. Show the spin amount while its lines are still lit. The HUD keeps the cumulative payout. A completed bonus has one separate total, and the round cap remains 25,000×. The mobile regression uses catalog seed 1057196 to exercise all four spin tiers in a single Vent Break.

**Run from slots:** `node --test games/cyber-skunk/tests/*.test.mjs` and `node --test tests/browser/cyber-skunk.e2e.mjs`. To prepare the Claude artifact, run `node tools/cyber-skunk-artifact.mjs <output-directory>`. Package the runtime as a unit so the loader, styles, fonts and artwork are served together.

**For Claude:** the 400× Mystery buy can award Blackout. The generated math report predates Mystery. Its exact mixture and both ends of every tier are covered by `tests/mystery.test.mjs` in the game folder. Review the playable in your artifact environment after packaging.
