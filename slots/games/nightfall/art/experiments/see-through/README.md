# Character layer-tool evaluation for Night Fall

This is an isolated art experiment. It does not change game/runtime assets and
does not certify any generated layers for animation.

## Latest result — read this first

The authorized reaper test returned 15 See-through layers but lost the scythe blade,
changed the skull and invented ears/neck. Reject this output for Night Fall. A local
SAM 2.1 Tiny test preserved the original painted pixels in useful visible-part
selections; it still needs mask cleanup and hidden-joint completion. Qwen Layered
is the next generative comparison. Dylan authorized its upload and both the
8-layer and standard 4-layer trials were submitted. Both failed before output:
`The requested GPU duration (360s) is larger than the maximum allowed`.
This is a hosted GPU-duration restriction; Qwen character quality remains unknown.

The complete PSD/PNG/comparison package was delivered privately to Dylan as
`Reaper-Layer-Tool-Test.zip`. Ask him to relay it; private images, PSDs and
input-specific masks/prompts are not published here. N-04/N-05 remain open.

### Updated tools for Claude

1. https://github.com/facebookresearch/sam2 — tested locally on CPU with SAM 2.1
   Hiera Tiny, upstream `2b90b9f5ceec907a1c18123530e92e794ad901a4`. Prioritize
   editable click/box masks and original-pixel extraction. Our refined trial
   selected skull, both hands, blade and shaft. Outline cleanup and concealed
   geometry are still required. Pixel-identical reconstruction with a remainder
   is only an export check, not validation of cut quality.
2. https://github.com/QwenLM/Qwen-Image-Layered — next generative decomposition
   comparison; supports variable layer count and recursive splitting. Its prompt
   describes the whole image rather than guaranteeing particular body parts on
   particular layers. The authorized private-character tests produced no output
   because of the hosted GPU-duration restriction, even at 4 layers. A functioning
   GPU-backed inference route is needed; do not repeatedly resubmit the same job.
3. https://github.com/rig-c/parts + https://github.com/rig-c/core — evaluate assembly
   and motion checks once parts are valid. Not installed/tested in this experiment.

See-through was selected for its character-specific features, not a verified
best-rating claim. GitHub pages checked on 2026-10-25 showed approximately 20.1k
stars for SAM 2, 4.8k for See-through and 2.1k for Qwen Image Layered. Popularity
is not a comparable accuracy score for this task.

### Local SAM setup

Use a separate Python 3.12 environment. Clone Meta's repository into
`sam2-upstream` (not `sam2`, which can shadow the Python package), check out the
commit above, install CPU `torch==2.7.1` and `torchvision==0.22.1` from the official
PyTorch CPU index, then install `requirements-sam2-cpu.txt`. Install upstream with
`SAM2_BUILD_CUDA=0 python -m pip install --no-build-isolation -e sam2-upstream`.
Use the official `sam2.1_hiera_tiny.pt` checkpoint linked by upstream. Its tested
SHA-256 is `7402e0d864fa82708a20fbd15bc84245c2f26dff0eb43a4b5b93452deb34be69`.
`run_sam2_test.py` accepts an RGBA composite, a prompt JSON and checkpoint path;
`--help` lists options. The private bundle contains the tested prompts and full
commands. Masks select visible original pixels only; this script performs no
inpainting and makes no network requests. Do not import its remainder as a rig.

## Initial tooling shortlist (superseded by the review)

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
PSD review environment is installed. The public upstream sample and subsequently
the explicitly authorized private reaper draft were tested on the official hosted
demo. SAM 2.1 Tiny was also installed and tested locally on CPU.

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
The public sample proved the hosted processing/export route. The later reaper
test is documented in Dylan's private results package; local CUDA inference remains untested.

The initial private-upload block was resolved by Dylan's explicit approval for
See-through, and the reaper test completed. The input is the existing rig-v2 draft
composite, not the approved reference. The reference guide includes UI occlusions
and should not be treated as a clean character image. Qwen's earlier upload block
was also resolved by Dylan's specific retry instruction. Its two authorized
attempts were blocked by the demo's GPU-duration limit, not by permission.

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
