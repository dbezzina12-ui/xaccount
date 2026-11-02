# RoboBees

Playable 5×4 studio playtest. The game is static and loads ES modules over HTTP. From this folder run:

```sh
python3 -m http.server 8000 --directory dist
```

Open http://localhost:8000/ for the game or http://localhost:8000/?preview=stinger for the isolated Super bonus replay. Run `node tests/bonus-rules.mjs` to exercise the bonus rules.

The entry point is `dist/index.html`. Art and sound are under `dist/assets/`. Claude's animated hive and bee are mounted in `#mascot-stage`; the Wild count is mounted in the model’s upper grille. Workers fly through the tree hive’s doorway to collect and deploy Wilds. Open `?preview=hive` to collect two bees and release them on the final spin.

## Win animations and release status

Open `?preview=wins` to try all five celebrations. A settled spin or bonus total earns Nice at 10×, Big at 25×, Epic at 100× and Mythic at 500× base bet. Max plays when a round reaches the 25,000× cap. The original four short audio cues come from the studio’s Night Fall assets. Mythic adds a new RoboBees fanfare. Run `node tests/win-show.mjs` and [see the release status](RELEASE_STATUS.md).

## How the game plays

RoboBees pays left to right on 20 fixed lines across five reels and four rows. Three or more matching symbols from reel one pay, and Wilds substitute. After each win, clear the union of winning positions, drop survivors straight down in order, refill from above and score again. Multipliers stay in their cells. A fresh hit charges the cell to 2×, and repeat hits double it to 128×. Only one upgrade is applied per winning cell per board, even on intersecting lines.

- **Paid and Regular.** Ordinary paid hits carry one spin forward. Regular keeps charges for all ten spins. FS survive refills, at most one per reel. The settled base board awards Regular, Super or Hidden for three, four or five FS.
- **Super and Hidden.** Both start at 2× everywhere. Every newly landed Wild on spins 1–9 joins the bank, including refills. A survivor moving down a column is counted only on arrival. Spin ten deploys one bee per banked Wild. If the grid fills, the remaining bees return after the next refill. Hidden also guarantees an opening Wild and sends scouts to upgrade up to three eligible cells per spin.
- **Feature spins (three).** Signal Boost (enhanced spins) costs 3× the base bet and increases FS chances. Pollen Charge costs 20× and starts 6–12 distinct cells at 2×–32×. Hive Overdrive costs 250× and starts all 20 cells at 32×. Both seeded modes reset every paid spin, reveal their multipliers before the reel roll and pay from the base bet.
- **Bonus buys.** Regular costs 100×, Super 250× and Mystery 400× (50% Regular, 40% Super and 10% Hidden).

Play `?preview=tumble` for an isolated three-win Hive Overdrive replay. The outcome and the final save checkpoint are calculated before the presentation begins. Stop settles only the current spin. A safety limit of 100 scored boards bounds pathological chains.

The rules are in `dist/rules.mjs`. This is a play-money build.

## Math

Every mode returns 96% of what it costs: base spins, the three feature spins and the three bonus buys. A round pays at most 25,000× the base bet, counting the trigger spin and its free spins together. Reaching the cap ends the round and plays Max. [MATH.md](MATH.md) has the figures, generated from the game's own rules.

- **The numbers:** all of them are in the `MATH` block at the top of `dist/rules.mjs`. The game, the tests and the math tools read the same block.
- **Fit:** `node ../../tools/math/robobees-fit.mjs --write` re-solves every knob for 96% (about 16 minutes on four cores). `--refine super,random --write` re-solves just those knobs, on larger samples, from the shipped values.
- **Report:** `node ../../tools/math/robobees-report.mjs` plays fresh seeds and rewrites `MATH.md` and `math/summary.json` (about 5 minutes).
- **Bonus averages:** Regular 96× (100× buy), Super 240× (250× buy), Hidden 2,400×. Mystery's 50/40/10 mix returns 96% of 400×.

## Mascot

The robo-bee and its hive stand at the top of the game in `#mascot-stage`: beside the cabinet on wide screens, next to the logo on narrow ones.

- **Idle:** the bee hovers beside the hive.
- **Into a bonus:** when FS award a bonus (landed or bought), the bee dives into the hive and bursts out of the door. A swarm of the same robo-bees follows it out of the FS cells, and the lead bee flies into the camera to cover the cut to the award. When the bonus starts, a smaller swarm plays it out and the bee flies back to its hover. The swarm is drawn by the live 3D mascot (`mascot.swarm()` → `drone-stinger.mjs`); with the sprite fallback it is the painted drones.
- **Banked Wilds:** in Super and Hidden, the hive adds one when a collected bee reaches its entrance. On the final spin it subtracts one as each worker leaves, and the destination cell turns Wild on arrival. Hidden scout flights use the same doorway without spending the bank.

**Live 3D, with sprites as the fallback.** `dist/mascot/mascot.mjs` picks:

- **Live 3D:** `live3d.js` draws the bee and hive in real time with three.js, and the bonus transition's swarm (a full-detail lead bee, the rest instances of one bee at six wing-beat phases, built while the page is idle). It's about 160 KB gzipped (606 KB raw) and loads after the game starts. On screen it's about 70 draw calls and 70,000 triangles, plus about 11,000 per banked-Wild worker. The ten workers are drawn as instances of one bee.
  - If frames run slow, it first drops its pixel ratio, then its shadows.
- **Sprites:** `sprites.mjs` plays frames pre-rendered from the same models (about 430 KB of WebP). They're only downloaded if needed. The sprites take over when:
  - WebGL is missing or software-only;
  - the live mascot stays slow at its lowest quality tier;
  - the WebGL context is lost.
- **Choosing by hand:** add `?mascot=3d` or `?mascot=sprites` to the URL. `#mascot-stage` shows which is running (`data-mascot`) and, after a fallback, why (`data-mascot-fallback`).

It's presentation only. It reads the game's state and never decides or changes an outcome, and turbo, Stop and skip never wait on it. Neither version calls `Math.random`, the outcome stream; the 3D bundle swaps three.js's own calls for a private generator. Reduced motion holds still poses.

**Tests:** `tests/browser/robobees-mascot.e2e.mjs` checks that:

- both versions draw on desktop and phone;
- the 3D version stays within its draw-call and triangle budget;
- the sprites take over without WebGL;
- the bundle has no `Math.random`;
- seeded bonus spins land the same with the 3D mascot as with a stand-in that does nothing.

**Source:** everything is built from the 3D bee and hive in `dbezzina12-ui/Olaf-goes-golfing`, `mascots/robo-bee/`:

- `robobees-live/live3d.js`, bundled by `tools/build-live.mjs`;
- the sprites from `mascot-film/`, exported by `tools/export-sprites.mjs`;
- the choreography both share, in `mascot-shared/flight.js`.
