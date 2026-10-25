#!/usr/bin/env python3
"""Night Fall rig parts and joints (Claude, animation).

Derives the extra layers the jointed rig needs from ChatGPT's approved cutouts,
and measures the joints the rig pivots on. Re-run after any rig artwork change:

    python3 tools/nightfall-rig.py

Writes, in games/nightfall/runtime/assets/nightfall/:
  archer/bow-bare.webp    the bow without its baked arrow and string
  archer/arrow.webp       the nocked arrow alone (same canvas as the bow)
  archer/draw-upper.webp  the draw arm's upper arm, shoulder ball and elbow knob
  archer/draw-fore.webp   the draw arm's bracer and fist (same canvas as the arm)
  rig.json                joints in the 320 x 430 rig space of nightfall-actors.js

Joints come from the art itself: an elbow is the centroid of where the upper
sleeve and the forearm overlap at rest, the scythe grip is where the right fist
covers the shaft, and the bow's string, nock and tips are fitted to the string
pixels. The bow image keeps the wood where the arrow crossed the grip by
filling those rows from the wood above and below.
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'games/nightfall/runtime/assets/nightfall'
# Placement boxes [x, y, w, h] in rig space, as in nightfall-actors.js (from ChatGPT).
BOXES = {
    'reaper': {'cape': [36, 151, 205, 245], 'body': [66, 149, 212, 267], 'head': [55, 48, 193, 177],
               'upperLeft': [64, 172, 62, 106], 'foreLeft': [69, 257, 58, 98],
               'upperRight': [225, 170, 60, 100], 'foreRight': [244, 246, 58, 98], 'scythe': [103, 5, 185, 390]},
    'archer': {'body': [87, 147, 174, 264], 'head': [65, 36, 190, 194], 'bowArm': [41, 183, 90, 137],
               'drawArm': [146, 210, 128, 99], 'bow': [4, 155, 156, 221]},
}
FILES = {'cape': 'cape', 'body': 'body', 'head': 'head', 'upperLeft': 'upper-left', 'foreLeft': 'fore-left',
         'upperRight': 'upper-right', 'foreRight': 'fore-right', 'scythe': 'scythe', 'bowArm': 'bow-arm',
         'drawArm': 'draw-arm', 'bow': 'bow'}


def load(kind, part):
    return np.array(Image.open(ROOT / kind / f'{FILES[part]}.webp').convert('RGBA'))


def save(arr, path):
    Image.fromarray(arr.astype(np.uint8), 'RGBA').save(path, 'WEBP', lossless=True, quality=100, method=6)


def to_rig(kind, part, x, y, shape):
    bx, by, bw, bh = BOXES[kind][part]
    return [round(bx + x * bw / shape[1], 2), round(by + y * bh / shape[0], 2)]


def rig_mask(kind, part, size=(430, 320)):
    """The part's alpha drawn into rig space (1 px = 1 rig unit), as the page draws it."""
    bx, by, bw, bh = BOXES[kind][part]
    im = Image.open(ROOT / kind / f'{FILES[part]}.webp').convert('RGBA').resize((bw, bh), Image.LANCZOS)
    out = np.zeros(size)
    a = np.array(im)[..., 3] / 255
    out[by:by + bh, bx:bx + bw] = a[: size[0] - by, : size[1] - bx]
    return out


def erode(mask, r):
    out = mask.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            out &= np.roll(np.roll(mask, dy, 0), dx, 1)
    return out


def dilate(mask, r):
    out = mask.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            out |= np.roll(np.roll(mask, dy, 0), dx, 1)
    return out


def centroid(mask):
    ys, xs = np.nonzero(mask)
    return [round(float(xs.mean()), 2), round(float(ys.mean()), 2)]


def sole(kind):
    """Lowest opaque row of the body (the soles), in rig space."""
    m = rig_mask(kind, 'body') > 0.5
    return int(np.nonzero(m.any(axis=1))[0].max()) + 1


def reaper():
    up_r, fore_r, scythe = rig_mask('reaper', 'upperRight'), rig_mask('reaper', 'foreRight'), rig_mask('reaper', 'scythe')
    up_l, fore_l = rig_mask('reaper', 'upperLeft'), rig_mask('reaper', 'foreLeft')
    hand_r = fore_r.copy(); hand_r[:300] = 0  # the fist: lower part of the forearm
    j = {
        # Shoulders: the socket ball at the top of each sleeve.
        'shoulderRight': centroid(up_r[:190] > 0.5), 'shoulderLeft': centroid(up_l[:192] > 0.5),
        'elbowRight': centroid((up_r > 0.5) & (fore_r > 0.5)), 'elbowLeft': centroid((up_l > 0.5) & (fore_l > 0.5)),
        'grip': centroid((hand_r > 0.5) & (scythe > 0.5)),
        'neck': [178, 214], 'shoulders': [172, 172], 'sole': sole('reaper'),
    }
    return j


def archer():
    bow = load('archer', 'bow').astype(float)
    a = bow[..., 3]
    h, w = a.shape
    # The string: two thin dark lines from the limb tips to the nock. Fit each
    # to its pixels in a band clear of the limb, the arrow and the fletching.
    lum = bow[..., :3].mean(axis=2)
    lines = {}
    for name, rows in (('upper', range(60, 270)), ('lower', range(360, 560))):
        pts = []
        for y in rows:
            xs = [x for x in range(305, w) if a[y, x] > 60 and lum[y, x] < 120]
            if xs:
                pts.append((float(np.mean(xs)), y))
        xs, ys = np.array(pts).T
        k, c = np.polyfit(ys, xs, 1)  # x = k*y + c
        lines[name] = (k, c)
    # Nock: where the two string lines meet.
    (k1, c1), (k2, c2) = lines['upper'], lines['lower']
    ny = (c2 - c1) / (k1 - k2)
    nx = k1 * ny + c1
    # Tips: the end of each line where it reaches the limb (last opaque string pixel going outward).
    def tip(k, c, ys):
        for y in ys:
            x = k * y + c
            if 0 <= int(round(x)) < w and a[y, int(round(x))] > 60:
                return [x, y]
        return [k * ys[-1] + c, ys[-1]]
    top = tip(k1, c1, range(0, 60))
    bottom = tip(k2, c2, range(h - 1, 560, -1))
    # The arrow: the head and shaft over empty canvas, and the fletching and
    # nock right of the limb. Across the grip the shaft is rebuilt from a clean
    # column of it, so the arrow carries none of the grip's outline.
    shaft = (306, 327)
    arrow_mask = np.zeros_like(a, bool)
    arrow_mask[288:346, 0:240] = True
    arrow_mask[276:356, 305:w] = True
    arrow_mask &= a > 8
    arrow = bow.copy(); arrow[~arrow_mask] = 0
    arrow[shaft[0]:shaft[1], 240:305] = bow[shaft[0]:shaft[1], 200:201]
    # The string is the only thin structure in the bow image: whatever an
    # opening (erode, then dilate) by 4 px removes is string, or the arrow.
    thick = dilate(erode(a > 40, 4), 4)
    string = (a > 8) & ~dilate(thick, 1) & ~arrow_mask
    bare = bow.copy()
    bare[arrow_mask | string] = 0
    bare[shaft[0]:shaft[1], 240:305] = 0
    # The wood behind the shaft: copy the wrap just above it (same height), so
    # the grip keeps its texture once the arrow is loosed.
    rows = shaft[1] - shaft[0]
    for x in range(240, 305):
        if bow[shaft[0] - 1, x, 3] > 8 and bow[shaft[1], x, 3] > 8:
            bare[shaft[0]:shaft[1], x] = bow[shaft[0] - rows:shaft[0], x]
    # Stray specks the cuts leave (arrow edges outside its box): keep only the wood.
    keep = dilate(erode(bare[..., 3] > 40, 3), 3) | (dilate(thick, 2) & (bare[..., 3] > 0))
    bare[~keep] = 0
    save(bare, ROOT / 'archer/bow-bare.webp')
    save(arrow, ROOT / 'archer/arrow.webp')
    ys, xs = np.nonzero(arrow[..., 3] > 40)
    arrow_tip = [float(xs.min()), float(ys[xs == xs.min()].mean())]

    # Split the draw arm at the elbow. The upper arm keeps the shoulder ball,
    # the humerus and its round end; the forearm (bracer, fist and the two bone
    # ends below the humerus) is everything under a line along the joint, and
    # is drawn over the upper arm, as in the art. The pivot is the joint
    # between the humerus end and the forearm's bone ends.
    arm = load('archer', 'drawArm').astype(float)
    ah, aw = arm.shape[:2]
    yy, xx = np.mgrid[0:ah, 0:aw]
    bone = (arm[..., 3] > 200) & (arm[..., 0] > 190) & (arm[..., 1] > 170) & (arm[..., 2] > 120)
    ball_c = centroid(bone & (yy < 70))
    knob_c = [300.0, 183.0]
    # Around the joint the two halves overlap by a few pixels (the forearm on
    # top), so bending never opens a gap; at rest they draw the original art.
    line = lambda shift: (yy > 176 + shift + (xx - 262) * 14 / 78)
    fore_mask = (arm[..., 3] > 0) & (((xx < 270) & (yy > 140)) | ((xx >= 270) & line(-6)))
    upper_mask = (arm[..., 3] > 0) & ~((xx < 266) & (yy > 140)) & ~((xx >= 266) & line(6))
    fore, upper = arm.copy(), arm.copy()
    fore[~fore_mask] = 0; upper[~upper_mask] = 0
    save(upper, ROOT / 'archer/draw-upper.webp')
    save(fore, ROOT / 'archer/draw-fore.webp')
    j = {
        'bowShoulder': to_rig('archer', 'bowArm', 224, 39, (443, 294)),
        'drawShoulder': to_rig('archer', 'drawArm', *ball_c, (ah, aw)),
        'drawElbow': to_rig('archer', 'drawArm', *knob_c, (ah, aw)),
        # The fingers' pinch on the string: the top-left knuckles of the fist.
        'pinch': to_rig('archer', 'drawArm', 30, 182, (ah, aw)),
        'palm': to_rig('archer', 'bowArm', 75, 330, (443, 294)),
        'nock': to_rig('archer', 'bow', nx, ny, (h, w)),
        'tipTop': to_rig('archer', 'bow', top[0], top[1], (h, w)),
        'tipBottom': to_rig('archer', 'bow', bottom[0], bottom[1], (h, w)),
        'arrowTip': to_rig('archer', 'bow', *arrow_tip, (h, w)),
        'grip': to_rig('archer', 'bow', 266, 316, (h, w)),
        'neck': [190, 222], 'sole': sole('archer'),
    }
    return j


if __name__ == '__main__':
    joints = {'size': [320, 430], 'reaper': reaper(), 'archer': archer()}
    (ROOT / 'rig.json').write_text(json.dumps(joints, indent=1) + '\n')
    print(json.dumps(joints, indent=1))
