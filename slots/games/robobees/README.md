# RoboBees

Playable 5×4 studio playtest. The game is static and loads ES modules over HTTP. From this folder run:

```sh
python3 -m http.server 8000 --directory dist
```

Open http://localhost:8000/ for the game or http://localhost:8000/?preview=stinger for the isolated Super bonus replay. Run `node tests/bonus-rules.mjs` to exercise the bonus rules.

The entry point is `dist/index.html`. Art and sound are under `dist/assets/`. Claude's mascot belongs in `#mascot-stage`; the drone sprites in the transition also fly between the Wild Bank hive port and individual reel cells. The HUD and hive flights work independently of the mascot. Production math calibration is still pending.
