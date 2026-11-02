# RoboBees

Playable 5×4 studio playtest. The game is static and loads ES modules over HTTP. From this folder run:

```sh
python3 -m http.server 8000 --directory dist
```

Open http://localhost:8000/ for the game or http://localhost:8000/?preview=stinger for the isolated Super bonus replay. Run `node tests/bonus-rules.mjs` to exercise the bonus rules.

The entry point is `dist/index.html`. Art and sound are under `dist/assets/`. Claude's animated hive and bee are mounted in `#mascot-stage`; the drone sprites in the transition also fly between the Wild Bank hive port and individual reel cells. The HUD and hive flights work independently of the mascot. Production math calibration is still pending.

## How the game plays

A 5×4 grid on 20 fixed paylines. Three or more matching symbols from reel one pay; **W** (Wild) stands in for any paying symbol.

- **Charged cells:** a winning cell becomes 2× on the next spin, and doubles on each repeat hit up to 128×. A winning line adds up the values of its cells. In base play a charge lasts one spin; in free spins it lasts until the bonus ends.
- **FS scatters** award ten free spins: 3 FS start **Worker Shift** (Regular), 4 start **Swarm Protocol** (Super), 5 start **Queen Override** (Hidden).
- **Super and Hidden** start every cell at 2×. Each Wild that lands is **banked**. On the last spin, one bee per banked Wild flies out and places a Wild on the reels before the spin is scored. Hidden also lands a Wild every spin and sends scout bees to double up to three cells.
- **Feature spins:** Signal Boost (3× bet) raises the FS chance per reel from 7.5% to 11.5%. Scout Run (10× bet) guarantees a Wild on every paid spin. Bonus buys start Regular (100×), Super (250×) or Mystery (400×: 50% Regular, 40% Super, 10% Hidden).

The rules live in `dist/rules.mjs`; `game.mjs` decides each spin there before anything animates. The tuned production math is still pending.

## Mascot

The robo-bee and its hive stand at the top of the game in `#mascot-stage`: beside the cabinet on wide screens, next to the logo on narrow ones.

- **Idle:** the bee hovers beside the hive.
- **Into a bonus:** when FS award a bonus (landed or bought), the bee dives into the hive and bursts out of the door. A swarm of the same robo-bees follows it out of the FS cells, and the lead bee flies into the camera to cover the cut to the award. When the bonus starts, a smaller swarm plays it out and the bee flies back to its hover. The swarm is drawn by the live 3D mascot (`mascot.swarm()` → `drone-stinger.mjs`); with the sprite fallback it is the painted drones.
- **Banked Wilds:** in Super and Hidden, one worker bee lands on the hive for each banked Wild, up to ten; beyond ten a `+N` counter shows. On the last spin the workers leave as their Wilds are placed.

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
