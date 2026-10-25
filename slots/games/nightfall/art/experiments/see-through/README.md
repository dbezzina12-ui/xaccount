# See-through evaluation for Night Fall

This is an isolated art experiment. It does not change game/runtime assets and
does not certify any generated layers for animation.

## Tools Claude should get

1. https://github.com/shitagaki-lab/see-through — decomposition and concealed-area
   reconstruction. Upstream checkout inspected: `df019de5129d6c4b406587a14c3501669441a783`.
2. https://github.com/rig-c/parts and https://github.com/rig-c/core — evaluate
   measured assembly, meshes, bones and validation after decomposition works.
   The easy documented input pose has separated limbs and open hands; retain our
   approved pose and add explicit handling for weapon grips.
3. Optional: https://github.com/jaisurya-dev-art/rigby2d — early-alpha visual
   editor and MCP tools for Claude. Do not make it a prerequisite for the art test.

## Current environment

ChatGPT's workspace has no GPU. See-through's source was downloaded and inspected;
the full CUDA inference environment was not installed here. The small client and
PSD review environment is installed. A hosted test uses the project's own public
`common/assets/test_image.png`, never private game artwork.

## Observed public-sample result — 2026-10-25

The official hosted backend completed the public sample at resolution 768,
seed 42, with left/right splitting enabled. The returned PSD contains 22 normal
transparent pixel layers. Its native canvas is 768 x 768; input was 928 x 1232.
Visual inspection confirms separate front/back hair, left/right arms, shirt,
shorts, legs, shoes, face, glasses and small facial parts. The legs remain together
and each arm is one piece: this is not yet an elbow/knee animation rig.

Recomposed foreground mean absolute RGB difference is 12.99/255; 14.04% of
foreground pixels differ by more than 30/255 in at least one channel. These are
diagnostics, not a pass score. The model redraws some visible content, and tiny
facial layers are low resolution. See `sample-review.json` for the full measurements.
The successful public sample proves the hosted processing/export route; Night
Fall skeleton/weapon quality and local CUDA inference remain untested.

An attempted private reaper upload was stopped by automatic approval review before
submission. Explicit approval is required before sending that image to the external
Hugging Face demo. The local prepared input is the existing rig-v2 draft composite,
not the approved reference. The reference guide includes UI occlusions and should
not be treated as a clean character image.

## Reproduce the hosted sample test

Use Python 3.12. In this folder:

```bash
git clone https://github.com/shitagaki-lab/see-through.git see-through
git -C see-through checkout df019de5129d6c4b406587a14c3501669441a783
python -m venv .venv
.venv/bin/python -m pip install -r requirements-client.txt
.venv/bin/python run_hosted_test.py see-through/common/assets/test_image.png --out sample-output --allow-external-upload
```

Windows: substitute `.venv\Scripts\python.exe` for `.venv/bin/python`.
This command sends only the public upstream sample to
`https://24yearsold-see-through-demo.hf.space`. Hosted availability and GPU quota
are outside this repository's control. No paid provider key is configured.

The client records `run.json`, including errors and downloaded output paths.
Do not repeat a submitted job just because it is taking time. It has a bounded wait.
Once a PSD is returned:

```bash
.venv/bin/python review_psd.py PATH_TO_RETURNED.psd see-through/common/assets/test_image.png sample-review
```

The reviewer exports full-canvas transparent layers, a contact sheet, the assembled
image, a difference image and numerical comparison. It checks normal compositing
and refuses unsupported layer/group/blend configurations. A two-layer synthetic
fixture verified layer order, offsets, transparency and rectangular restoration.

## What the review numbers mean

See-through pads the input to a square and changes its resolution. The test is at
768 pixels to fit the hosted demo. Registered exports inverse that padding and
resize to the input canvas; this does not restore missing detail. Comparison is
against the submitted image, not an unrelated approved reference. The review
resamples with PIL while upstream uses OpenCV, so small interpolation differences
are included. Numbers do not replace visual inspection or joint tests.

## GPU installation route

Follow the pinned upstream README in a separate Python 3.12 environment. It
specifies PyTorch 2.8.0/CUDA 12.8 and its requirements.txt. The default inference
path uses CUDA and bfloat16; the quantized path reduces memory but also contains
bfloat16 operations. Verify the actual GPU's compatibility rather than assuming
that an 8 GB memory figure makes every 8 GB card supported. Local GPU inference
has not been validated in this workspace.

## Acceptance before any integration

- Inspect every semantic layer, including hallucinated or empty categories.
- Compare recomposition to the submitted original and then to the approved pose.
- Produce actual animation parts: shoulders, upper arms, forearms and grip fingers
  are not necessarily separated by the model's semantic categories.
- Keep weapon shafts complete behind fists and use hand-back/object/fingers order.
- Preserve the 1600 x 1720 target canvas, body x=800 and soles y=1656, recording all
  transforms. Do not distort individual parts to force a match.
- Check hidden joint overlaps over the exact ranges in ../../../ART_SPEC.md.
- Keep current runtime assets until art and motion review pass.
