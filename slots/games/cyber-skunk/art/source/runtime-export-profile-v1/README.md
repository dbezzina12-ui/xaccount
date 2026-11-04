# Runtime export profile v1

These twelve WebPs preserve the exact current compiled exports from source commit `fca0890c1811d623d77dc4be6dc36b06ddd384a2`. They are **compiled assets, not editable PNG masters or new artwork**. The existing high-resolution masters remain in `art/symbols/`, `art/cabinet/` and `art/logo.png`.

Generic prep previously replaced ten 320×320 symbol exports with 512×512 files, the 1462×1076 cabinet with a 1440×1060 file, and the 1600×344 logo with a 1600×560 file. That would undo the current runtime presentation on the next ordinary art-prep run. This explicit profile preserves the tested exports without reconstructing an undocumented resize/crop recipe.

`manifest.json` binds each compiled file to its selected master path and SHA-256, compiled SHA-256, runtime destination and dimensions. Prep validates **every binding before exporting anything**. A changed master, damaged export or escaped path stops prep instead of silently retaining stale art or overwriting the runtime. Review the changed artwork and update or remove its binding deliberately when delivering a replacement; do not just refresh a hash to hide a mismatch.

Normal use from `slots/`:

```sh
python3 tools/art/cyber-skunk-prep.py --check --mascot games/cyber-skunk/art/source/mascot-compact-v4/registered
python3 tools/art/cyber-skunk-prep.py --mascot games/cyber-skunk/art/source/mascot-compact-v4/registered
```

To inspect default PNG-master exports, use `--without-export-profile --out /tmp/cyber-art-review`; bypassing the profile refuses the production output directory. A non-check prep run also refreshes `art/REPORT.md`, even with a custom output path. The reproducible audit below invokes the canonical functions with temporary output and leaves the report alone.

The other 37 ordinary exports still use the existing canonical encoder. Mascot prep is unchanged: sixteen registered pieces, with fitted eyelids/nozzle, crop manifest and both pivot files. No fit, coordinates, math, audio or runtime image changed in this batch.

[Full temporary rebuild and failure tests](../../../shots/art-export-profile-qa-2026-11-04/README.md).
