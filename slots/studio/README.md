# Gamboligy Studio

Visual authoring around the existing Zombify v125 game. Open `studio/index.html` through an HTTP server rooted at `slots/`.

```sh
npm run studio:prepare
npm test
npm run test:studio
npm run serve
# http://localhost:8080/studio/
```

## What works

- Actual imported Zombify runtime in a same-origin iframe; changes apply directly to its layout.
- Independent desktop (1280×800) and mobile (390×844) scene positions, backgrounds and grades.
- Drag, resize, arrow-key nudging, horizontal center snap, visibility, locking and image layers.
- 4×4, 5×4, 6×5, 7×7 presets and custom 3–10 column/row grids; shared symbol scale, frame thickness, dividers, reel color/texture and supports.
- Upload transparent art/backgrounds; replace symbols without changing their game IDs.
- Background brightness, contrast, saturation, hue, blur, zoom, position and tint.
- 60-step undo/redo, IndexedDB autosave, JSON import/export including uploaded images.
- Local quick-edit commands use the same validated command operations as the controls.
- Browser agent tools `read_slot_studio` and `edit_slot_studio` on a supported secure WebMCP browser.

## Mechanics boundary

Zombify is a **6×5 adapter**. Its original math files, outcome catalogs, paylines and feature rules remain unchanged. Actual 6×5 play uses its walking/infection/Outbreak/Second Life code. Other grids are explicitly presentation-only and use Claude's existing `engine/client/reels.js`; they never calculate or display a made-up payout. Supporting another playable grid requires a compatible game adapter and validated math.

Presentation commands cannot change paytables, outcome weights or RTP. Parent/iframe communication checks both same-origin and the expected window. All operations validate before committing, and a batch is atomic. Editing is blocked while a round is in progress.

## AI and storage scope

Quick edit is a local command interpreter, clearly labeled in the product. It is not a Claude/OpenAI model. No provider key or live Claude session was available during implementation. Secure-context browser tools allow a connected ChatGPT browser agent to inspect and change the open project. No API keys are stored in the client.

Projects are saved **in this browser**, not synchronized across accounts/devices. Export transfers the whole authoring project including uploaded image bytes. Built-in game assets are identified by stable paths. This is a studio foundation, not production math certification or a completed AAA art pass.

## Source and reproduction

Imported from Zombify source `ae3ab40fde5106eb0484f0b9fd41fe1af160702e` (v125). `games/zombify/import-manifest.json` pins hashes for large art, animation rigs and generated outcome catalogs. `studio:prepare` fetches missing copies from the original game and refuses mismatches. The published Studio's separate Sites source repository also stores the full runtime snapshot, including binary assets, for recovery if the original site changes. Never regenerate math catalogs as an asset-recovery shortcut.

The new mobile scene removes only the old mascot/streetlight from the separate background. It was edited using the built-in image generation tool, preserving the street, moon, perspective and palette. Asset: `games/zombify/runtime/assets/studio/mobile-street.png`. No background change is made to the original published Zombify site.

## Test notes

The studio-specific mobile background is bundled as exact-byte base64 parts in `games/zombify/bundled-art/`. `npm run studio:prepare` reconstructs the original PNG and verifies its size and SHA-256 before use. This avoids a large single binary upload and does not alter its pixels. Run preparation before starting the editor from a fresh checkout.

Studio tests cover scene independence, import validation, atomic edits, unsafe source rejection, undo/redo, command behavior, grid compatibility and exact reel landing. The imported Zombify feature/game tests exercise the original math and presentation state machine. The purchase-dialog fixture has a no-op `soundEffect` dependency added; the original test omitted that existing dependency. No runtime outcome changes were made to address that fixture.

Existing Game 001 is retained as an engine/math reference and is paused per Dylan's instruction. Do not start its theme pass.
