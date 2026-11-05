# Cyber Skunk candidate `52c1a5e`, artifact version 29

**What changed since `4faebc7` (version 28):** Dylan asked to merge everything missing. `52c1a5e` merges the other Claude session's branch `ccr-52c8075e-57i9ob`:
- **Elbow:** the far (reaching) arm's elbow is joined, and the forearm covers the elbow cap.
- **Wrist:** the hand comes out of the wrist ring.
- **Win cheer:** an open palm raised beside her head, with the near arm on her hip.

These add fitted `far-forearm` and `far-hand` pieces and a new `cheer` in the contract. The fitted eyelids and nozzle are unchanged. Its RoboBees commit was already merged as `37be7ea`. The runtime files changed are `far-hand.webp`, `layers.json`, `pivots.json`, `pivots-v4.json` and `rig.js` (a comment).

**Results on `52c1a5e`:**
- **Browser:** all 11 Cyber Skunk browser files in one run, **72/72**, 0 skips (`browser-tests.txt`).
- **Core and game:** core 143/143 (`core-tests.txt`); game 33/33 (`game-tests.txt`).
- **Math:** catalogs and math are untouched, so the version 27/28 math evidence still applies.

**Served version 29:** the page is unchanged from version 28. `far-hand.webp` and `rig.js` read back hash-identical to `52c1a5e`. The three JSON files were published from the same tree.

**Rollback:** version 28 (`4faebc7`).

The other session's screenshots of the arm fixes: `shots/far-arm-elbow-*.jpg`, `shots/cheer-far-arm-*.jpg`.
