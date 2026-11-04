# Art export preservation — 2026-11-04

Picked up source `fca0890c1811d623d77dc4be6dc36b06ddd384a2`; no newer Claude handoff. This batch fixes ordinary art-prep repeatability. Runtime images, editable PNG masters, fitted mascot inputs, coordinates, math, selection, payouts and audio are unchanged.

## Problem and change

A temporary canonical rebuild found 12 of 49 ordinary exports differed from the current runtime: ten symbols would become 512×512 instead of 320×320, the cabinet 1440×1060 instead of 1462×1076, and the logo 1600×560 instead of 1600×344. The other 37 already reproduced exactly. This was a future prep regression risk; it does not establish that either size looks better.

The [explicit export profile](../../art/source/runtime-export-profile-v1/README.md) stores those twelve current compiled WebPs and binds them to master/export hashes, destination and dimensions. Prep validates all bindings before any export. Changed masters and damaged/missing exports refuse the run; they cannot silently select stale art. An explicit default-master review requires a separate output directory. High-resolution PNGs remain the editable masters. These snapshots are not new painted art or newly derived resize/crop recipes.

## Validation

- [Temporary rebuild report](report.json): **49 ordinary + 19 mascot outputs = 68/68 byte-identical** to runtime. It also regenerates the twelve unprofiled defaults into temporary storage and confirms all twelve differ. The mascot path still selects 14 registered pieces plus the fitted eyelids/nozzle; all sixteen registered originals are retained.
- [Rebuild result](rebuild.txt): **202 fingerprints unchanged** during the final run; **119 runtime files match Git**. The first exploratory run caught the prep file changing while a final guard was being added: exports already matched 68/68, but the stability assertion failed. The recorded final run uses the frozen completed script.
- [Six focused Python tests](profile-tests.txt): exact-byte preservation; changed master, corrupt export and escaped path all refuse before any output/report write; explicit review bypass uses generic master dimensions; bypass refuses production output.
- [Inventory](inventory.txt): **49/49 ordinary masters, 16/16 mascot layers, twelve bindings, no problems**. `art/REPORT.md` was deliberately refreshed from this check.
- [Core](core.txt): **139 passed, three existing skips**. [Game](game.txt): **29/29 passed**.

Python 3.12.14, Pillow 13.0.0, libwebp 1.6.0. The report records every temporary output hash/dimension and all input fingerprints. Its base commit identifies the pickup; the modified prep script and new profile are identified by their own fingerprints.

## Reproduce from `slots/`

```sh
python3 tests/cyber-skunk-art-export.test.py
python3 games/cyber-skunk/shots/art-export-profile-qa-2026-11-04/probe.py
python3 tools/art/cyber-skunk-prep.py --check --mascot games/cyber-skunk/art/source/mascot-compact-v4/registered
npm test
npm run test:cyber-skunk
```

The probe calls the canonical ordinary/mascot functions with temporary output and never calls the fit tool or writes production images. Ordinary prep still refreshes `art/REPORT.md` on non-check runs, including custom-output runs.

## Exact next work for Claude

1. Preserve this profile when prepping the current art. For changed PNG masters, review/update or remove the corresponding binding deliberately; do not hide a mismatch by refreshing hashes alone. Preserve the sixteen-piece v4.1 fit and both fitted overrides.
2. Replace the fixed-seed free-preview path with the agreed weighted shipping selection. Document buy/natural conditioning, retain Spray Job's natural bonus possibilities, verify positive tickets/replay provenance, Hidden floors, diversity/distribution and unchanged saved state.
3. After runtime edits, refresh package hashes and run all nine browser files together (currently 66 cases), plus core/game checks. This batch changes no runtime bytes, so the unchanged browser suite was not repeated. Prior 58 together plus eight autoplay separately remain separate evidence.
4. Republish the existing private artifact and verify actual served assets/current entry, rendered phone/desktop, lobby/thumbnail, physical devices and producer/math-owner approval. This source/export check does not clear those release gates. CS-06/CS-07 remain open; continuation stays enabled.
