# Compact mascot: painted split sources

Sixteen separate painted RGBA PNGs on matching 1600 × 2000 canvases, with a provisional rest-pose registration. These are fitting sources, not an activated or animation-validated rig. `assembly-proposal.json` gives draw order, parent, proposed pivots, alpha bounds and SHA-256 hashes. `assembled-review.png` exists in the authoring workspace only; the registered pieces are the deliverable.

## Reconcile with Claude's v4 guide

The refreshed branch now contains `art/rig/pivots-v4.json` and `guide-v2.jpg`. That contract has 17 parts; these independently prepared sources have 16. They are deliberately under `art/source/`, not the auto-importing `art/mascot/` directory.

- Three tail sections here versus four in v4: the broad upper curl needs a separate tip and enough hidden paint at the new seam.
- Closed grin is painted into the head; no independent jaw is delivered. A jaw layer and head occlusion must be finished before jaw animation can ship.
- Far ear is a separate optional piece here; v4 includes it in the head.
- Registration and pivots differ from v4. Do not copy these into the runtime under matching names and assume they fit. Claude should fit the joint map, identify exact repaint regions and hand those back to ChatGPT. ChatGPT owns repainting and the remaining pieces.
- Eyelids exist but their fit over both eyes is unverified. Never call the blink checked based only on the open-eye rest pose.

## Checked

All sixteen files fully decode, are RGBA 1600 × 2000, have transparent margins and nonempty alpha, and match the manifest hashes. The composed open-eye rest pose was visually inspected and the arm positions adjusted. No claim of 55 px overlap compliance, extreme-pose testing, browser QA, or complete mascot delivery.

## Next handoff

Claude: load these in the fitting workspace; return the precise joint/occlusion corrections relative to v4. Test tail bends and both arms, then blink/head motion. ChatGPT: conform the sources to the v4 guide and paint the separate tail tip/jaw and any seam corrections. Only after fitting and source QA should the final registered PNGs go in `art/mascot/` for Claude's integration and phone/desktop checks. Keep the mascot outside the reels and compact behind the cabinet. No skunks on any symbol, including WILD.

The hourly GitHub pickup must remain enabled unless Dylan explicitly asks to pause it. Deadline target remains 2026-10-31 08:25 UTC; the rig is still on the critical path.

Publication update: Dylan explicitly approved public GitHub delivery on 2026-10-30. Separate tail-tip and jaw fitting candidates, original painted sources, registration scripts and measured joint audit are in ../rig-v4-local-audit/. These candidates still require the corrections listed there; their existence does not make this set runtime-ready.
