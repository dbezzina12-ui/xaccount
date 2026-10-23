# Handoff log

Newest on top. Format is in `AGENTS.md`.

---

### 2026-10-23 · Claude → ChatGPT + Dylan · Studio review: 11 bugs fixed, browser tests added

**Branch:** `claude/blissful-rubin-xou20i`, based on `codex/studio-zombify-editor` @ `be5ba19` (merged, no rebase). Zombify's math, outcome catalogs, paylines and `play()` are untouched.

**Did:** Fixed the bugs below. Each has a regression test that fails on `be5ba19` and passes now.
1. **Edits unlocked mid-round.** The editor trusted a 900 ms state poll. A reply sent before a spin, or during Zombify's pre-round audio decode, unlocked editing while the round started. Now the bridge marks the round before any async work, reports `started`/`finished` by request id, and pushes state on every change, including rounds started from the game's own controls, autoplay and Outbreak waits.
2. **An edit refused mid-round unlocked the editor and desynced it from the game.** Edits that arrive during a round are now held and applied when it ends.
3. **A preview that stops answering locked the editor forever.** A heartbeat now shows a banner with Reload.
4. **A checkout without assets showed an endless loader**, and spins failed with a JS error. It now shows "Zombify isn't installed… run `npm run studio:prepare`". Art-load failures offer Retry; Test spin waits for art and shows progress.
5. **A layout-test spin broke 6×5.** It left `display:flex !important` on Zombify's `#board`. Layout tests now draw into their own preview board, and `#board` is never touched.
6. **Preview reels recreated every `<img>` on every frame** and ignored the reel's landing splice, so symbols jumped on landing. Tiles are now reused, follow the splice, and get light motion blur.
7. **Image layers always sat above the reels.** Send backward/Bring forward now really reorder them.
8. **Uploads made editing crawl.** With a 5 MB upload in use, a 40-move drag took ~280 ms per move (editor 45 + iframe 90 long tasks). It now takes ~35 ms with 0 long tasks. The fixes: blob: URLs to the iframe and thumbnails, history snapshots that share frozen asset objects, change detection that skips image bytes, and one apply per frame.
9. **Edits made in the last 450 ms before closing the tab were lost.** A synchronous journal now restores them on the next open.
10. **The Continue bonus button stayed visible after the bonus ended.**
11. **Validation didn't type-check names, visible/locked/texture/supports flags, asset kinds or layer order.**

Also changed:
- Clearer messages for non-JSON imports and for `studio:prepare` failures.
- Export links stay valid for large files.
- Test spin becomes **Skip** during a round.
- On phone-width screens the editor opens on the Mobile scene.

**Files:**
- `studio/bridge.js`: protocol documented in its header.
- `studio/editor.js`, `studio/project.js`, `studio/storage.js`, `studio/index.html`, `studio/studio.css`, `studio/README.md`.
- `games/zombify/runtime/app.js`: facade only; adds `status`, `loading`, `retryLoading` and `skip`.
- `tools/studio/prepare.mjs`.
- New: `tests/browser/` and `npm run test:studio-browser`; `tools/studio/shots.mjs`, writing to `studio/shots/`.

**Test results here:**

| Suite | Result | Notes |
|---|---|---|
| `npm test` | 22/22 | |
| `npm run test:studio-browser` | 12/12 | Real editor and bridge in Chromium, with a runtime stand-in that implements the facade contract |
| `npm run test:studio` | 25/28 | The 3 failures (`game`, `feature-spin`, `hidden`) need the outcome catalogs |

`npm run studio:prepare` could not run here: this environment's network policy returns 403 for `zombify.djames1.chatgpt.site`. So **real Zombify rounds were not run in my session.** Screenshots of the running editor (real checkout, without game assets) are in `studio/shots/`.

**Remaining issues (not fixed):**
- Two browser tabs on the same project overwrite each other's saves; the last save wins.
- Uploads up to 8192×8192 are accepted as-is. Consider downscaling to about 2048 px on import.
- Asset recovery depends on the live site plus the Sites source archive; neither is in git.
- Import is hidden on phone widths (existing CSS choice).
- The WebMCP agent tools are only exercised through a test polyfill; no WebMCP browser was available.
- Quick edit runs local commands only. It is not connected to Claude or OpenAI.

**Next for ChatGPT (S-06): verify the review fixes with the real runtime.** On a machine where `npm run studio:prepare` works, run `npm run test:studio` and `npm run test:studio-browser`, then `npm run serve` → `/studio/`, and check:
1. **Base spin.** Undo/redo, the inspector and dragging stay locked from the click until the reels settle, including the first spin of the session (audio decode).
2. **Outbreak.** The editor stays locked while the bonus waits; **Continue bonus** resumes it; the button disappears when the bonus ends.
3. **Second Life and Super/Hidden Outbreak previews** finish and unlock.
4. **Skip** during a long round fast-forwards it.
5. **Play mode.** Spin from the game's own button, then start autoplay. The editor locks within a moment and unlocks when they stop.
6. **Layout switching.** Choose 7×7, Test spin, choose 6×5. Zombify's board is intact, then a base spin works.
7. **Uploads.** Upload a large PNG, assign it to WILD and the background, then drag the reels: smooth.
8. **Close and reopen.** Close the tab right after an edit, reopen: "Restored your latest edits."

Record pass/fail per item, with screenshots, in a HANDOFF note. If a facade call misbehaves, fix it in the facade at the end of `app.js`, not in `play()` or the math.

**Questions for Dylan:** Can you allow `zombify.djames1.chatgpt.site` in this Claude environment's network settings (S-07)? Then I can run the real rounds and measure Zombify's math as it is (S-04).

**Blocked on:** the Zombify assets, for real-runtime testing and S-04.

---

### 2026-10-23 · ChatGPT → Claude + Dylan · Zombify studio implementation ready for review

**Did:** Recovered the interrupted session and completed the visual editor on `codex/studio-zombify-editor`. It includes independent desktop/mobile scenes, drag/resize, image and symbol replacement, background grading, undo/redo, browser-local save/reload, JSON import/export, local quick-edit commands and WebMCP editing tools. The 6×5 preview runs the imported Zombify v125 game; other grids use the reusable reel renderer for presentation tests only.

**Files:** `studio/` (editor, project schema, storage and iframe bridge), `games/zombify/` (runtime snapshot, tests and asset manifest), `tools/studio/prepare.mjs`, `tests/studio.test.mjs`, and scoped workflow updates. See `studio/README.md` for setup and boundaries.

**Verified:** `npm test` passes 18 tests; `npm run test:studio` passes 57 tests (68 distinct tests because seven studio tests run in both commands). Desktop/mobile previews load with their correct scene art. Existing walking, infection, Outbreak, Second Life, payout and accounting tests pass. No math retune.

**Next for Claude:**
1. Review the actual implementation on this branch, especially `studio/bridge.js` and the small `ZombifyStudioRuntime` facade in `games/zombify/runtime/app.js`. Keep the original game outcomes and asset hashes intact.
2. Audit reel animation lifecycle, edit-versus-round locks, bonus continuation, preset switching and mobile/desktop layout isolation. Add focused regression coverage for any concrete bugs found.
3. Report findings and proposed fixes in this log. Do not resume Game 001 themes or substitute its math for Zombify. A different playable grid requires a compatible adapter and separately validated math.

**Limits:** Quick edit is a local interpreter, not a connected Claude/OpenAI chat. Browser tools are present, but no hosted model provider is connected. Saves are local to the browser; export/import transfers projects. This is a working studio foundation, not a completed AAA polish pass.

**Published:** https://gamboligy-studio.djames1.chatgpt.site — owner-private; sign in with Dylan’s ChatGPT account. Sites source `3e89d2b6662f760526a9ca0a39b7e28a032d3469`; deployment `appgdep_6adbcc731ce481919532409c70787e6f` succeeded. The complete source/art snapshot was uploaded in eight batches and its final tree was verified identical to the tested source. All 279 imported assets passed hash verification. Desktop/mobile visual QA and the walking-zombie preview passed. The original live Zombify is unchanged.

**Questions for Dylan:** none.
**Authorization:** Dylan explicitly approved pushing the studio code, assets and handoff to `dbezzina12-ui/xaccount`, branch `codex/studio-zombify-editor`, on 2026-10-23. The earlier upload approval blocker is resolved.

**Next:** Claude review and focused implementation fixes. The latest implementation is on this review branch; the older theme kickoff remains paused. A handoff file does not itself start a Claude session.

---

### 2026-10-23 · Claude → ChatGPT + Dylan · Got it: Game 001 paused, standing by for the Zombify studio

**Did:** Recorded the new direction as D-004, marked Game 001 paused on the board, and added a studio track (S-01 to S-05). Game 001's math is frozen. Earlier today I also made the engine game-agnostic: any lines/wild/scatter game now runs from its folder with no code changes (tested with a second 5×4 fixture game).

**For the adapter, so I can review and verify it (S-03, S-04):**
1. **Outcome first, animation second.** One call decides the whole round (every grid state plus events: walks, infections, Second Life respins, wins, totals) before anything moves. The editor and renderer only replay it.
2. **One copy of the rules, no DOM.** The function the game calls must also run in Node, so `tools/math/sim.mjs` can measure Zombify's RTP exactly as it plays.
3. **Injectable RNG.** Accept an `rng` with `int(n)` (see `engine/core/rng.js`), so tests, screenshots and demos are repeatable.
4. **Reels.** Give the renderer the reel strips and stop positions, or, if Zombify has no strips, the final symbols per reel. `engine/client/reels.js` can splice either into a natural stop.
5. **The editor changes presentation only.** Positions, sizes, colors and layers are layout. Anything that changes reels, rows or symbols marks the math unvalidated until it's re-measured (agreed with your note).

**Next for ChatGPT:** Land S-01/S-02 on `codex/studio-zombify-editor` and tell Dylan when it's ready for review.

**Questions for Dylan:** Where does the Zombify v125 source live? It isn't in any repo my session can see (S-05).

**Blocked on:** the editor branch landing, and the Zombify source.

---

### 2026-10-23 · ChatGPT → Claude + Dylan · PAUSE GAME 001 — build the studio around Zombify

**Dylan's current direction (supersedes the theme kickoff):** "Let's not do that, let's load zombify and make our studio engine." He authorized ChatGPT to implement the editor and coordinate engine work. Do not start a new game or theme concept pass.

**Doing:** Visual studio on branch `codex/studio-zombify-editor`: separate desktop/mobile scenes, editable backgrounds/layers, reel grid/size controls, color grading, drag/resize, undo/save/export, real Zombify integration. Preserve existing Zombify walking/infection/Second Life mechanics; do not relabel Game 001's math as Zombify.

**Next for Claude:** Review the adapter boundary and reel animation integration once the editor branch lands. Keep Game 001 math untouched. A new grid is a presentation experiment until a compatible mechanics adapter and validated math exist. Do not rewrite Zombify's math to fit Game 001.

**Ownership for this task:** Dylan's direct instruction authorizes ChatGPT's scoped studio/editor/adapter changes. Keep unrelated xaccount work untouched. No math retune in this task.

**Source:** Zombify v125, existing Sites source commit `ae3ab40fde5106eb0484f0b9fd41fe1af160702e`. Live Zombify remains separate.

---


### 2026-10-23 · Claude → ChatGPT + Dylan · Game 001 is playable; needs a theme and art

**Did:**
- Built the studio repo and the rules for how we work (`AGENTS.md`).
- Designed and verified Game 001's math: exact calculation plus 1 billion simulated spins. RTP 96.28%, hit rate 28.3%, free spins 1 in 268, bonus buy 96.43%, high volatility, 10,000x max (`games/game-001/MATH.md`).
- Built the engine with placeholder gems and card ranks:
  - motion-blurred reels with overshoot landing, and scatter anticipation;
  - paylines, win pulses and light sweeps;
  - BIG/MEGA/EPIC win count-ups with coin rain;
  - the free-spins intro, multiplier badges on wilds, and retriggers;
  - bonus buy, turbo, autoplay, synth sound, and a phone layout.

**Files:** `games/game-001/ART_SPEC.md` (exactly what to make), `games/game-001/shots/*.jpg` (how it looks now), `games/game-001/theme.json` (skin values).

**Play it:** https://claude.ai/artifact/5BxfZPrsxZdrChBEfVeBbG (private to Dylan). Add `#feature` to the link to start on a real bonus trigger, or `#bigwin` / `#epic`.

**Next for ChatGPT:**
1. Propose **three original theme concepts** for Game 001. Each needs: name, one-line hook, mood, 6-color palette (hex), one Google Font, a symbol list (H1–H4 premium, L1–L5 lows, W wild, S scatter) with a one-line visual for each, and a base vs free-spins background idea. Make the multiplier-wild mechanic part of the fantasy: wilds that charge up and stack.
2. After Dylan picks, make one **style frame** (1536×1024 full-screen mockup).
3. Then symbols, then backgrounds, then logo, banners and coin, all to `ART_SPEC.md`.

**Questions for Dylan:**
- Approve the mechanic (D-002), or tell me what to change: max win, bonus frequency, volatility, buy price.
- Pick a theme once ChatGPT proposes.

**Blocked on:** nothing.
