#!/usr/bin/env python3
"""Cyber Skunk rig v4.1: the compact-rig contract fitted to ChatGPT's painted
pieces (art/source/mascot-compact-v4/registered/, 16 pieces registered on one
1600 x 2000 canvas). Each joint sits where the child piece overlaps its parent,
at the point with paint on both; the tool measures that overlap (55 px disk,
alpha >= 128) and writes the contract, a fit report and a guide:

    art/rig/pivots-v4.json   (version 4, revision 4.1)
    art/rig/fit-v4.1.md
    art/rig/guide-v3.jpg

    python3 tools/art/cyber-skunk-fit-v4.py
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

GAME = Path(__file__).resolve().parents[2] / "games" / "cyber-skunk"
SRC = GAME / "art" / "source" / "mascot-compact-v4"
RIG = GAME / "art" / "rig"

# Joint centres on ChatGPT's assembly, from each child/parent overlap (see the report).
J = {
    "base": (850, 1250), "neck": (900, 955), "ear": (825, 545), "far_ear": (1092, 530), "goggles": (940, 600), "eyes": (920, 800),
    "near_shoulder": (705, 975), "near_elbow": (550, 1150), "near_wrist": (695, 1263),
    "far_shoulder": (1040, 1005), "far_elbow": (1153, 1110), "far_wrist": (1340, 1139),
    "tail_root": (738, 1160), "tail_1": (480, 955), "tail_2": (600, 415), "tail_tip": (1190, 443),
}
JOINT_OF = {
    "tail-1": "tail_root", "tail-2": "tail_1", "tail-3": "tail_2", "nozzle": "tail_tip",
    "far-upper-arm": "far_shoulder", "far-forearm": "far_elbow", "far-hand": "far_wrist", "torso": "base", "head": "neck",
    "far-ear": "far_ear", "ear": "ear", "goggles": "goggles", "eyelids": "eyes",
    "near-upper-arm": "near_shoulder", "near-forearm": "near_elbow", "near-hand": "near_wrist",
}
OVERLAP = 55
# Pieces painted off their mark, moved onto it (sources untouched; the fitted
# copies go to art/rig/fitted/, which cyber-skunk-prep.py prefers). Eyelids:
# each lid shape is moved onto its eye; as delivered both sat on the cheek.
# (lid centre in the source, where it goes: the eye opening's centre)
LID_FIT = [((933, 802), (955, 749)), ((1095, 835), (1128, 789))]
# Nozzle (Dylan, 2026-11-01: "looks like it's floating there, copy pasted"): as
# delivered its axis sat 26 px above the tail's centre line and its back stub was
# painted over the fur. The fitted nozzle drops the stub (everything behind the
# collar's rear rim), moves onto the centre line so the collar closes round the
# tail's tip like a cuff, and shades the fur where it goes in. The tail_tip
# joint is the rim's centre; the jet leaves from the mouth's opening.
NOZZLE_FIT = (-8, 26)
NOZZLE_MOUTH = (1339, 427)  # the opening's centre, as delivered
# Far arm (Dylan, 2026-11-03: "the arm isn't connected properly on desktop"): as
# delivered the far forearm sat below the upper arm's elbow cuff and was drawn over
# it, so its rounded end stuck out past the elbow toward the body and the forearm
# read as a separate tube. The fitted forearm and hand move 25 px in and 35 px up,
# so the forearm's end sits under the cuff (far_wrist moves with them), and the
# forearm is drawn behind the upper arm, so the cuff closes over the joint in every
# pose. Transforms still run parents first; only the draw order changes.
ARM_FIT = (25, -35)
ORDER_FIT = {"far-forearm": 5, "far-upper-arm": 6}


def fit_nozzle():
    """The nozzle seated on the tail tip: stub off, on the centre line, fur shaded."""
    src = np.array(Image.open(SRC / "registered" / "nozzle.png").convert("RGBA")).astype(np.float32)
    tail = np.array(Image.open(SRC / "registered" / "tail-3.png").convert("RGBA"))[:, :, 3].astype(np.float32) / 255
    h, w = src.shape[:2]
    a = src[:, :, 3]
    # The collar's rear rim: its left edge on the rows clear of the stub, an ellipse arc through them.
    rows = [y for y in range(h) if (a[y] >= 128).any()]
    left = {y: int(np.nonzero(a[y] >= 128)[0][0]) for y in rows}
    stub = [y for y in rows if left[y] < 1190]
    mid = (min(stub) + max(stub)) / 2
    pts = np.array([(y, left[y]) for y in rows if left[y] >= 1190 and abs(y - mid) < 70], float)
    best = None
    for cy in np.arange(mid - 10, mid + 10, 0.5):
        for ry in np.arange(60, 110, 1.0):
            u = 1 - ((pts[:, 0] - cy) / ry) ** 2
            if (u <= 0).any():
                continue
            m = np.stack([np.ones(len(u)), -np.sqrt(u)], 1)
            (cx, rx), *_ = np.linalg.lstsq(m, pts[:, 1], rcond=None)
            err = float(((m @ [cx, rx] - pts[:, 1]) ** 2).mean())
            if best is None or err < best[0]:
                best = (err, cy, ry, cx, rx)
    _, cy, ry, cx, rx = best
    rim = lambda y: cx - rx * np.sqrt(np.clip(1 - ((y - cy) / ry) ** 2, 0, 1))
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    # Stub off: everything behind the rim on the stub's rows (1 px feather).
    band = (yy >= min(stub) - 2) & (yy <= max(stub) + 2)
    src[:, :, 3] = np.where(band, a * np.clip(xx - rim(yy) + 1, 0, 1), a)
    # Onto the centre line.
    dx, dy = NOZZLE_FIT
    out = np.zeros_like(src)
    out[max(0, dy):h + min(0, dy), max(0, dx):w + min(0, dx)] = src[max(0, -dy):h - max(0, dy), max(0, -dx):w - max(0, dx)]
    # The fur darkens where it goes into the collar: a soft band behind the rim,
    # on the fur only, over the middle of the rim (the ends stay clear so a turn
    # of the nozzle never shows it off the tail).
    rim_at = rim(yy - dy) + dx
    near = np.clip(1 - (rim_at - xx) / 12, 0, 1) * (xx < rim_at) * np.sqrt(np.clip(1 - np.abs(yy - (cy + dy)) / 52, 0, 1))
    solid = np.array(Image.fromarray((tail * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2)), np.float32) / 255 > 0.98
    shade = np.array(Image.fromarray((near * solid * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2)), np.float32) / 255 * 0.32
    na = out[:, :, 3] / 255
    shade *= 1 - na
    total = shade + na * (1 - shade)
    rgb = np.where(total[:, :, None] > 0, out[:, :, :3] * (na * (1 - shade) / np.maximum(total, 1e-6))[:, :, None], 0)
    out = np.dstack([rgb, total * 255])
    (RIG / "fitted").mkdir(exist_ok=True)
    Image.fromarray(np.clip(out + 0.5, 0, 255).astype(np.uint8)).save(RIG / "fitted" / "nozzle.png")
    return (round(rim(cy) + dx + 5), round(cy + dy))


def fit_arm():
    """The far forearm and hand moved together, the forearm's end under the elbow cuff."""
    dx, dy = ARM_FIT
    for name in ("far-forearm", "far-hand"):
        src = np.array(Image.open(SRC / "registered" / f"{name}.png").convert("RGBA"))
        h, w = src.shape[:2]
        out = np.zeros_like(src)
        out[max(0, dy):h + min(0, dy), max(0, dx):w + min(0, dx)] = src[max(0, -dy):h - max(0, dy), max(0, -dx):w - max(0, dx)]
        (RIG / "fitted").mkdir(exist_ok=True)
        Image.fromarray(out).save(RIG / "fitted" / f"{name}.png")


def fit_eyelids():
    """Each lid blob moved by its own offset onto its eye."""
    src = np.array(Image.open(SRC / "registered" / "eyelids.png").convert("RGBA"))
    solid = src[:, :, 3] >= 8
    out = np.zeros_like(src)
    h, w = solid.shape
    for (cx, cy), (tx, ty) in LID_FIT:
        # the blob: every lid pixel nearer this lid's centre than the other's
        others = [c for c, _ in LID_FIT if c != (cx, cy)]
        yy, xx = np.mgrid[0:h, 0:w]
        mine = solid & ((xx - cx) ** 2 + (yy - cy) ** 2 < min((xx - ox) ** 2 + (yy - oy) ** 2 for ox, oy in others))
        dx, dy = tx - cx, ty - cy
        ys, xs = np.nonzero(mine)
        out[ys + dy, xs + dx] = src[ys, xs]
    (RIG / "fitted").mkdir(exist_ok=True)
    Image.fromarray(out).save(RIG / "fitted" / "eyelids.png")


def main():
    fit_eyelids()
    fit_arm()
    seat = fit_nozzle()
    assert seat == J["tail_tip"], f"the nozzle's rim centre is {seat}, J says {J['tail_tip']}"
    proposal = json.loads((SRC / "assembly-proposal.json").read_text())
    for q in proposal["parts"]:
        q["order"] = ORDER_FIT.get(q["name"], q["order"])
    parts = sorted(proposal["parts"], key=lambda q: q["order"])
    # A fitted piece (art/rig/fitted/) stands in for its source everywhere below.
    source = lambda q: RIG / "fitted" / f"{q['name']}.png" if (RIG / "fitted" / f"{q['name']}.png").exists() else SRC / q["file"]
    alpha = {q["name"]: np.array(Image.open(source(q)).convert("RGBA"))[:, :, 3] >= 128 for q in parts}
    yy, xx = np.mgrid[-OVERLAP:OVERLAP + 1:2, -OVERLAP:OVERLAP + 1:2]
    disk = (xx * xx + yy * yy) <= OVERLAP * OVERLAP
    cover = lambda name, x, y: float(alpha[name][(y + yy)[disk], (x + xx)[disk]].mean())
    contract = {
        "version": 4, "revision": "4.1", "canvas": [1600, 2000], "waist": 1330,
        "source": "art/source/mascot-compact-v4/registered (ChatGPT, 2026-10-30)",
        "joints": {k: list(v) for k, v in J.items()},
        "parts": {}, "overlap": OVERLAP,
        "tail": ["tail_root", "tail_1", "tail_2", "tail_tip"],
        # The spray: the nozzle joint lifts to here (every tail segment within +-35 degrees),
        # the nozzle stays level and the jet leaves from its mouth.
        "sprayTarget": [1250, 260], "nozzleMouth": [NOZZLE_MOUTH[0] + NOZZLE_FIT[0], NOZZLE_MOUTH[1] + NOZZLE_FIT[1]], "tuck": [0, 0, 0],
        # Wins pump the near arm: the far one would rise behind the head.
        "cheer": {"near-upper-arm": 100, "near-forearm": -75, "near-hand": -20, "far-upper-arm": -25, "far-forearm": -15},
        "notes": "Fitted to ChatGPT's 16 painted pieces as delivered: 3 tail segments, a separate far ear, no jaw yet (the grin is painted on the head).",
    }
    rows = []
    for q in parts:
        name, j = q["name"], JOINT_OF[q["name"]]
        x, y = J[j]
        b = q["alphaBounds"] if source(q) == SRC / q["file"] else list(Image.open(source(q)).getchannel("A").point(lambda v: 255 if v >= 8 else 0).getbbox())
        contract["parts"][name] = {"pivot": [x, y], "joint": j, "parent": q["parent"], "order": q["order"], "extent": b, "file": f"{name}.png"}
        own, par = cover(name, x, y), (cover(q["parent"], x, y) if q["parent"] else None)
        rows.append((name, j, (x, y), own, par))
    (RIG / "pivots-v4.json").write_text(json.dumps(contract, indent=1) + "\n")
    lines = ["# Rig v4.1 fit (generated by tools/art/cyber-skunk-fit-v4.py)", "",
             "ChatGPT's 16 pieces as delivered, with each joint where the piece overlaps its parent. Coverage is the share of the 55 px disk at the joint painted (alpha >= 128) on each piece. Eyelids and goggles ride on the head and need no overlap.", "",
             "| Piece | Joint | At | Own paint | Parent paint |", "| --- | --- | --- | --- | --- |"]
    for name, j, (x, y), own, par in rows:
        lines.append(f"| {name} | {j} | {x}, {y} | {own:.0%} | {'—' if par is None else f'{par:.0%}'} |")
    (RIG / "fit-v4.1.md").write_text("\n".join(lines) + "\n")
    # The guide, on the assembled pieces.
    im = Image.new("RGBA", (1600, 2000), (58, 66, 72, 255))
    for q in parts:
        im.alpha_composite(Image.open(source(q)).convert("RGBA"))
    im = im.convert("RGB"); d = ImageDraw.Draw(im, "RGBA")
    try:
        font = ImageFont.truetype("DejaVuSans-Bold.ttf", 24)
    except OSError:
        font = ImageFont.load_default()
    for name, j, (x, y), own, par in rows:
        q = contract["parts"][name]
        if q["parent"]:
            px, py = contract["parts"][q["parent"]]["pivot"]
            d.line([(px, py), (x, y)], fill=(237, 168, 60, 200), width=5)
        d.ellipse([x - OVERLAP, y - OVERLAP, x + OVERLAP, y + OVERLAP], outline=(104, 200, 195, 220), width=3)
        d.ellipse([x - 9, y - 9, x + 9, y + 9], fill=(237, 168, 60, 255), outline=(0, 0, 0, 255), width=2)
        d.text((x + 14, y - 30), f"{q['order']} {name}", fill=(255, 255, 255), font=font, stroke_width=3, stroke_fill=(0, 0, 0))
    im.save(RIG / "guide-v3.jpg", quality=88)
    print("\n".join(lines[6:]))


if __name__ == "__main__":
    main()
