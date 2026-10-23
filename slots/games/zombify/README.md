# Zombify adapter

The `runtime/` source is the existing v125 game, with only:

1. A studio entrypoint that bypasses the intro and original responsive fitter.
2. A small `ZombifyStudioRuntime` facade appended to `app.js` for read/start/continue/speed/reset-board operations.
3. The editor's independent mobile background asset.

`studio/bridge.js` owns all presentation overrides. The original game, probability data and outcomes are not retuned. The live Zombify site remains separate.

Run `npm run studio:prepare` from `slots/` after checkout to restore hash-pinned assets and catalogs. Use `npm run test:studio` for the adapter regression suite.
