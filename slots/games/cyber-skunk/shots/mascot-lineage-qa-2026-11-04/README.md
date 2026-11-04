# Compact mascot source-to-export audit

Source `193e0449de0f3e21f11ae1bac503baa7234eaf9f`. The current compact v4.1 art pipeline reproduces **all 19 runtime mascot files byte-for-byte**: sixteen WebP layers, `layers.json`, `pivots-v4.json` and `pivots.json`. Here “runtime/shipped” means files in this checkout, not a claim about the hosted artifact.

All sixteen registered originals are separate 1600×2000 images. The effective production inputs are **fourteen registered pieces plus the fitted eyelids and nozzle**. `report.json` maps every part to its registered/effective source hashes, fitted-override flag, crop registration, pivot and export dimensions. It also records generated/runtime hashes for every export. No jaw or extra seventeenth layer is present. The schema version is 4; the fitted v4.1 contract at the top of ART_SPEC governs its geometry. No obsolete reference contract or fit tool was used.

| Group | Effective source |
|---|---|
| Tail 1–3; far arm upper/forearm/hand; torso, head, far ear, ear, goggles; near arm upper/forearm/hand | `art/source/mascot-compact-v4/registered/` |
| Eyelids | `art/rig/fitted/eyelids.png` |
| Nozzle | `art/rig/fitted/nozzle.png` |

The reproducible probe imports the existing prep module with a temporary output directory and calls its canonical `prep_mascot()` function. It does not duplicate the crop algorithm, run the fit tool, or write production images, pivots or the art report. Temporary image outputs are removed after comparison; only the JSON audit is retained. Pillow **13.0.0**, libwebp **1.6.0** are recorded because exact encoding depends on them.

The separate read-only inventory check finds **49/49 art inputs and 16/16 mascot pieces, no problems**. All **140 tracked inputs/outputs** checked after validation match Git: the 119 runtime files, sixteen registered images, two fitted images, source pivot contract, prep tool and art report. Core: **139 passed, three existing skips**; game: **29/29**, including its existing rig tests. No production source changed.

From `slots/`:

```sh
python3 games/cyber-skunk/shots/mascot-lineage-qa-2026-11-04/probe.py /tmp/mascot-lineage-proof
python3 tools/art/cyber-skunk-prep.py --check --mascot games/cyber-skunk/art/source/mascot-compact-v4/registered
npm test
npm run test:cyber-skunk
```

This establishes the current registered/fitted source-to-export identity and registration metadata. It does not approve every animation pose, hidden-joint overlap, physical-device appearance or hosted file parity. Preserve the fitted overrides when reviewing future repaint requests; this batch adds no jaw or other new art.

The previous 58-case combined browser pass and eight-case autoplay pass remain separate evidence; no browser suite was repeated here. Preview fidelity, hosted/current-entry/lobby/device checks and producer/math-owner sign-off remain open. Claude still needs to repair weighted shipping previews, freeze/rerun the nine browser files after runtime changes and republish/verify the existing private artifact before completion.
