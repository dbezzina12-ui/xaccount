# Release candidate QA: `831f270`, artifact version 27

**Tested source:** `831f270d5514f31a056e7c138ac8e06beef6aeda` on `claude/blissful-rubin-xou20i`.
- The runtime is byte-identical to `de024cf`, the free-preview fix. Later commits change handoff text only.
- It keeps the neon ident, the explainer logo from `0f83c69`, the fitted v4.1 eyelids and nozzle, and the art export bindings.

**Published:** the existing private playable artifact, version 27 (`1793803286-5037`). Its URL is in the private handoff, not in this public repository.

**Rollback point:** artifact version 26 (`1793759555-3c8c`), runtime `f490a17`.

## Results

| Check | Result | File |
|---|---|---|
| All 11 Cyber Skunk browser files in one run (the ten existing files plus `cyber-skunk-preview.e2e.mjs`) | **72/72**, 0 fail, 0 skip | `browser-tests.txt` |
| Core (`npm test`) | **142/142**, 0 skip | `core-tests.txt` |
| Game (`node --test games/cyber-skunk/tests/*.test.mjs`) | **33/33** | `game-tests.txt` |
| Catalog replay (`tools/math/cyber-skunk-verify.mjs`) | all 149,276 entries, plus 630,000 drawn rounds, replay exactly | `math-verify.txt` |
| Math report (`tools/math/cyber-skunk-report.mjs`) | regenerated `MATH.md` and `math/summary.json` with **zero diff** | `math-report.txt` |
| Served build vs tested source | 115/115 runtime sizes match; 7/7 read-back files hash-match; the served page contains the tested page verbatim | `served-v27.json` |
| Play-through on the served build (desktop, two phone emulations) | spray and full bonus settle exactly, reload restores them, no page errors, no failed requests | `playthrough-*.json`, `playthrough-*.jpg` |

**Hash-checked files:** `app.js`, `catalog.js`, `catalog-data.js`, `launch.js`, `styles.css` and both splash WebPs. These are the files changed since version 26, plus the catalog.

## Math against shipping data

RTP is measured against the mode's actual cost.

| Mode | Cost | RTP | Max win (25,000×) |
|---|---|---|---|
| Base Spins | 1× | 96.000000% | 1 in 999,997 |
| Signal Boost | 3× | 96.000000% | 1 in 185,628 |
| Spray Job | 10× | 96.000000% | 1 in 999,993 |
| Vent Break (buy) | 100× | 96.000000% | 1 in 199,840 |
| Overpressure (buy) | 250× | 96.000000% | 1 in 49,998 |
| Mystery Buy | 500× | 96.000000% | 1 in 1,962 |

**Natural bonus rates per spin:**

| Mode | Vent Break | Overpressure | Blackout |
|---|---|---|---|
| Base and Spray Job | 1 in 223 | 1 in 4,272 | 1 in 151,860 |
| Signal Boost | 1 in 50 | 1 in 528 | 1 in 10,206 |

Blackout always pays at least 1,000×, and reaches the cap 1 in 200.

## Credits and debits

Each case below passed in the 72-case run:

| What | Cases |
|---|---|
| Buys | `base, Spray Job, Vent Break and Overpressure settle exactly` (desktop and phone); `Mystery purchase … credits the exact win`; `stake settlement` and `stake balance boundary` (6 cases); `artifact shipping outcomes and settlement` (2) |
| Stop | `one Stop only skips the active … free spin` (4) |
| Auto | `autoplay … count / cancel / funds / bonus` (8) |
| Bonus settlement | `rare path, blackout / cap / retrigger … settles exactly` (3) |
| Reload | `a reload mid-bonus loses nothing`; `ordinary entry: … resumes credits` (2); the reload cases in the free-preview file |

## Free previews

`catalog.js` documents which shipping pools each preview draws (`drawPreview`, above `PREVIEWS`).

- **Unit tests** (`games/cyber-skunk/tests/preview.test.mjs`): the pool mapping, boundary replays, the weighted distribution, the Blackout floor, and Spray Job's spray and natural bonuses.
- **Browser** (`tests/browser/cyber-skunk-preview.e2e.mjs`): catalog tickets are drawn; an injected ticket shows exactly its catalog row; complete, Stop and reload leave the session unchanged; a charged round afterwards settles exactly.

## Emulation versus hardware

**Everything here is emulation in headless Chromium. No physical iPhone or Android device was used.**

| Run | Viewport | Emulation |
|---|---|---|
| Desktop | 1920×1080 | — |
| "iphone" | 390×844 at 3× | iPhone user agent, touch, mobile viewport |
| "android" | 412×915 at 2.625× | Pixel user agent, touch, mobile viewport |

The phone runs use Chromium's engine, not Safari's WebKit.

The play-through served the exact served page (`index.html`, read back from the service) with the tested runtime files beside it. The hosted page itself needs the owner's claude.ai sign-in, so it was not opened from here. For the same reason, neither the gallery tile ("lobby") nor its thumbnail was seen.

The first frame at load is the dim, unlit neon sign (`playthrough-*.jpg`, frame 01). A thumbnail captured at load would look dark.

## Reproduce

From `slots/`:

```sh
node --test --test-concurrency=1 tests/browser/cyber-skunk*.e2e.mjs
npm test
node --test games/cyber-skunk/tests/*.test.mjs
node tools/math/cyber-skunk-verify.mjs
node tools/math/cyber-skunk-report.mjs && git diff --exit-code games/cyber-skunk/MATH.md games/cyber-skunk/math/summary.json
# play-through: serve a folder holding the package (tools/cyber-skunk-artifact.mjs) and a page, then
node games/cyber-skunk/shots/rc-qa-2026-11-04/playthrough.cjs http://127.0.0.1:PORT/ OUT_DIR desktop|iphone|android
```
