# Compact rig v4: staged-source registration audit

Source audit of the initial sixteen-piece set. Publication approved by Dylan on 2026-10-30; runtime integration is still pending.

All 16 input PNGs fully decode as 1600×2000 RGBA and match the staged manifest hashes. Missing required files: **tail-4, jaw**. Extra source: **far-ear**.

The coordinates are v4, not the obsolete full-body guide. “Coverage” is the fraction of the 55px-radius disk with alpha ≥128. An empty pivot alone is not a failure for eyelids/goggles, but limb seams require painted overlap on both parts. This diagnostic cannot certify extreme poses.

| Part | Move to v4 (dx,dy) | Pivot alpha | Own disk | Parent disk |
|---|---:|---:|---:|---:|
| tail-1 | [-90, -240] | 0 | 0.0% | 13.4% |
| tail-2 | [-10, -330] | 253 | 100.0% | 0.0% |
| tail-3 | [45, -60] | 252 | 76.6% | 77.8% |
| tail-4 | MISSING | — | — | 100.0% |
| nozzle | [-115, 5] | 0 | 0.0% | — |
| far-upper-arm | [-70, -30] | 0 | 7.0% | 47.8% |
| far-forearm | [-115, -95] | 0 | 0.0% | 43.0% |
| far-hand | [-162, -100] | 0 | 0.0% | 6.3% |
| torso | [10, -140] | 253 | 100.0% | — |
| jaw | MISSING | — | — | 100.0% |
| head | [-25, -190] | 253 | 100.0% | 0.1% |
| ear | [-32, -5] | 253 | 80.9% | 100.0% |
| eyelids | [40, -140] | 0 | 0.0% | 100.0% |
| goggles | [40, -50] | 253 | 76.4% | 100.0% |
| near-upper-arm | [5, -110] | 0 | 0.0% | 0.0% |
| near-forearm | [40, -190] | 0 | 0.0% | 0.4% |
| near-hand | [-50, -205] | 0 | 0.0% | 0.0% |

## Required corrections, in dependency order

1. Paint `tail-4` separately, with overlap at (760,265) and nozzle joint (1085,365). Existing `tail-3` spans the upper curl and tip; do not stretch or rename it to pretend both bones exist.
2. Paint independent `jaw` under `head` at (905,742), including hidden mouth interior. Remove/occlude the duplicated lower jaw in the head artwork. Keep 55px overlap; a hard crop will expose holes.
3. Re-register complete limb pieces to v4 using their proximal AND distal joint landmarks. The translation column diagnoses the offset; it is not a sufficient fit because scale and orientation also differ.
4. Reconcile `far-ear` into the head composition or obtain an explicit revised contract from Claude. Do not silently introduce an 18th runtime bone.
5. Fit both eyelids to the actual eye shapes on the conformed head. Check fully closed state, half-close and reopen at phone size. Do not infer a passing blink from an open-eye composite.
6. Restore the original reference blob 196a844a9dccb4f6fa910f4b1cdf3b12a81ce125 (restored in this publication). A byte-exact, fully decoding copy is included here as `reference-original.png`.
7. Claude: integrate only after source review, then exercise extreme tail/arm poses, spray endpoint, idle, blink and skip on phone/desktop. Keep game outcomes unchanged.

## Limits

No painted corrections or final registration are claimed by this audit. Source pixels are unchanged. Tail-tip/jaw art, overlap repaint, fitting and browser QA remain open. Separate tail-tip and jaw fitting candidates are now included; see LOCAL-HANDOFF.md for remaining correction work.
