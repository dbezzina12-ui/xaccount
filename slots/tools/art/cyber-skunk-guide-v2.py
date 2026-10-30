#!/usr/bin/env python3
"""Cyber Skunk mascot rig v4 (compact, waist up): writes the joint contract
art/rig/pivots-v4.json and the painter's guide art/rig/guide-v2.jpg, both
drawn on ChatGPT's art/mascot/reference-compact.png (the first, intact
commit 74a4926; the later re-save is a broken PNG).

    python3 tools/art/cyber-skunk-guide-v2.py [REFERENCE.png]
"""
import json
import subprocess
import sys
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

GAME = Path(__file__).resolve().parents[2] / "games" / "cyber-skunk"
RIG = GAME / "art" / "rig"

# Joint centres on the 1600 x 2000 reference (pixels). Read off the reference
# on a 20 px grid: each sits where the two pieces meet, so it turns cleanly.
J = {
    "base": (860, 1110),          # torso pivot: the body rests on the ledge here
    "neck": (875, 790),           # head on the vest collar
    "jaw": (905, 742),            # left corner of the mouth
    "ear": (788, 545),            # base of the near (left) ear
    "goggles": (960, 560),        # middle of the strap
    "eyes": (960, 665),
    "near_shoulder": (700, 850),
    "near_elbow": (560, 955),
    "near_wrist": (640, 1045),
    "far_shoulder": (975, 925),   # behind the chest
    "far_elbow": (1005, 1015),
    "far_wrist": (1118, 1060),
    "tail_root": (650, 930),      # behind the hips
    "tail_1": (470, 700),
    "tail_2": (520, 420),
    "tail_3": (760, 265),
    "tail_tip": (1085, 365),      # where the nozzle fits
}
# name: (joint it turns about, parent, what the piece is, generous extent x0,y0,x1,y1)
PARTS = {
    "tail-1": ("tail_root", "torso", "tail from behind the hips up to the first bend", (330, 640, 720, 1010)),
    "tail-2": ("tail_1", "tail-1", "tail up the left side", (330, 380, 620, 780)),
    "tail-3": ("tail_2", "tail-2", "tail over the top", (420, 190, 850, 520)),
    "tail-4": ("tail_3", "tail-3", "tail tip, curling down to the nozzle", (690, 190, 1110, 470)),
    "nozzle": ("tail_tip", "tail-4", "brass nozzle, pointing right", (1060, 300, 1240, 430)),
    "far-upper-arm": ("far_shoulder", "torso", "far upper arm, painted whole behind the chest", (930, 880, 1060, 1060)),
    "far-forearm": ("far_elbow", "far-upper-arm", "far forearm and brass cuff", (970, 960, 1160, 1130)),
    "far-hand": ("far_wrist", "far-forearm", "far open hand", (1100, 980, 1310, 1130)),
    "torso": ("base", None, "chest, vest and harness, down to the ledge", (630, 760, 1070, 1170)),
    "jaw": ("jaw", "head", "lower jaw and chin, with the mouth's inside painted above it", (880, 720, 1060, 810)),
    "head": ("neck", "torso", "head and cheek fur, the far ear, closed smiling mouth", (660, 400, 1120, 820)),
    "ear": ("ear", "head", "near (left) ear", (740, 420, 815, 560)),
    "eyelids": ("eyes", "head", "both upper eyelids, closed (the blink)", (840, 600, 1075, 725)),
    "goggles": ("goggles", "head", "strap and both lenses", (755, 465, 1130, 635)),
    "near-upper-arm": ("near_shoulder", "torso", "near upper arm and its brass band", (520, 820, 740, 1000)),
    "near-forearm": ("near_elbow", "near-upper-arm", "near forearm and brass cuff", (510, 920, 700, 1090)),
    "near-hand": ("near_wrist", "near-forearm", "near fist", (610, 990, 810, 1160)),
}
ORDER = list(PARTS)  # back to front
OVERLAP = 55  # px of painted overlap around every joint, on both pieces


def contract():
    return {
        "version": 4,
        "canvas": [1600, 2000],
        "waist": 1110,
        "joints": {k: list(v) for k, v in J.items()},
        "parts": {name: {"pivot": list(J[j]), "joint": j, "parent": parent, "order": k + 1, "extent": list(box), "piece": what}
                  for k, (name, (j, parent, what, box)) in enumerate(PARTS.items())},
        "overlap": OVERLAP,
        "tail": ["tail_root", "tail_1", "tail_2", "tail_3", "tail_tip"],
        # The spray: the tail tip lifts to here (every segment within +-35 degrees)
        # and the nozzle stays level; the jet leaves from the nozzle's mouth.
        "sprayTarget": [1180, 200],
        "nozzleMouth": [1232, 362],
        "tuck": [0, 0, 0, 0],
        "notes": "Waist up only, no legs. Every piece is painted whole and in place on the 1600 x 2000 canvas, including what the parts in front hide, with at least `overlap` px of paint past each joint on both pieces.",
    }


def reference(path):
    if path:
        return Image.open(path).convert("RGBA")
    blob = subprocess.run(["git", "show", "74a4926:slots/games/cyber-skunk/art/mascot/reference-compact.png"], cwd=GAME, capture_output=True, check=True).stdout
    return Image.open(BytesIO(blob)).convert("RGBA")


def guide(ref):
    W, H = ref.size
    bg = Image.new("RGBA", (W, H), (58, 66, 72, 255))
    bg.alpha_composite(Image.blend(ref, Image.new("RGBA", ref.size, (0, 0, 0, 0)), 0.25))
    im = bg.convert("RGB")
    d = ImageDraw.Draw(im, "RGBA")
    try:
        font = ImageFont.truetype("DejaVuSans-Bold.ttf", 26)
        small = ImageFont.truetype("DejaVuSans.ttf", 22)
    except OSError:
        font = small = ImageFont.load_default()
    colors = {"tail": (104, 200, 195), "far": (237, 168, 60), "near": (255, 120, 90), "head": (180, 140, 255), "torso": (240, 240, 240)}
    col = lambda name: colors["tail"] if name.startswith(("tail", "nozzle")) else colors["far"] if name.startswith("far") else colors["near"] if name.startswith("near") else colors["torso"] if name == "torso" else colors["head"]
    for k, (name, (j, parent, what, box)) in enumerate(PARTS.items()):
        c = col(name)
        d.rectangle(box, outline=c + (150,), width=2)
        if parent:
            pj = PARTS[parent][0]
            d.line([J[pj], J[j]], fill=c + (200,), width=5)
    for k, (name, (j, parent, what, box)) in enumerate(PARTS.items()):
        x, y = J[j]; c = col(name)
        d.ellipse([x - OVERLAP, y - OVERLAP, x + OVERLAP, y + OVERLAP], outline=c + (220,), width=3)
        d.ellipse([x - 9, y - 9, x + 9, y + 9], fill=c + (255,), outline=(0, 0, 0, 255), width=2)
        d.line([x - 20, y, x + 20, y], fill=(0, 0, 0, 255), width=2); d.line([x, y - 20, x, y + 20], fill=(0, 0, 0, 255), width=2)
        d.text((x + 14, y - 34), f"{k + 1} {name}", fill=c + (255,), font=font, stroke_width=3, stroke_fill=(0, 0, 0))
    # legend
    y = 1230
    d.text((40, y), "CYBER SKUNK RIG v4: 17 pieces, back (1) to front (17). Canvas 1600 x 2000, every piece painted in place.", fill=(255, 255, 255), font=font); y += 44
    d.text((40, y), f"Dot = the joint a piece turns about. Circle = paint both pieces whole inside it ({OVERLAP} px past the joint). Box = rough extent.", fill=(220, 220, 220), font=small); y += 36
    d.text((40, y), "Paint what the front pieces hide (the far arm behind the chest, the tail behind the hips, the jaw under the head). No legs.", fill=(220, 220, 220), font=small); y += 44
    for k, (name, (j, parent, what, box)) in enumerate(PARTS.items()):
        d.text((40, y + k * 36), f"{k + 1:>2}. {name}  [{J[j][0]}, {J[j][1]}]  {what}", fill=col(name) + (255,), font=small)
    return im


if __name__ == "__main__":
    ref = reference(sys.argv[1] if len(sys.argv) > 1 else None)
    assert ref.size == (1600, 2000), ref.size
    RIG.mkdir(parents=True, exist_ok=True)
    (RIG / "pivots-v4.json").write_text(json.dumps(contract(), indent=1) + "\n")
    guide(ref).save(RIG / "guide-v2.jpg", quality=88)
    print(f"wrote {RIG / 'pivots-v4.json'} and {RIG / 'guide-v2.jpg'}")
