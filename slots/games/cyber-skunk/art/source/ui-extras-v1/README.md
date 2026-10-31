# Cyber Skunk UI extras v1

This source batch builds two optional ART_SPEC §8 inputs:

- `art/ui/controller-texture.png`: a 512×512 opaque, mathematically periodic graphite brushed-steel tile with faint brass rivets. Its contrast is deliberately quiet so phone controller icons stay readable.
- `art/ui/icon.png`: a 512×512 opaque app/tab icon made from the approved registered v4.1 `far-ear`, `head`, `ear` and `goggles` pieces. It does not change or replace any rig source.

`build.py` is deterministic, writes exact production PNGs, checks dimensions and tile-edge deltas, produces a 32px icon review, and records hashes in `manifest.json`. Run it from any directory with:

`python slots/games/cyber-skunk/art/source/ui-extras-v1/build.py`

The icon contains the mascot because the icon contract explicitly calls for the skunk head. It is separate from the reel symbol set, which remains character-free. Claude owns prep, runtime integration and phone/desktop browser QA.
