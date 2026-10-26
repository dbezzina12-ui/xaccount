#!/usr/bin/env python3
"""Night Fall reaper v2 candidate (Claude, animation).

Builds the game's reaper from ChatGPT's registered reaper arm package
(Reaper-Arm-Pieces-v1: 1600 x 1720 layers drawn in place, with measured
shoulder, elbow and wrist pivots) and the shoulder mantle Dylan sent, both
in games/nightfall/art/source/reaper-v2/. It is the default reaper; the
first rig is still there with `?reaper=v1`.

Dylan's direction: the bare bone arm, no sleeves, with the shoulder and the
elbow hidden behind the robe, under the mantle, whose skull replaces the
robe's chest clasp. So the robe body, the upper arm, the forearm, the
hand-and-scythe and the mantle are used; the package's sleeve layers are not.

    python3 tools/nightfall-reaper-v2.py [PACKAGE_DIR MANTLE_PNG]

Back to front, the rig draws:
  body        the robe, hood, cape, left arm and legs
  arm-upper   the upper arm (shoulder to elbow), under the mantle
  arm-fore    the forearm (elbow to wrist), under the mantle
  hand        the hand and scythe, whole: its wrist stub tucks under the mantle
  mantle      Dylan's shoulder mantle, pinned at the chest clasp, over the
              shoulder and elbow
  hand-front  the fist and scythe without the wrist stub, so the fist and the
              shaft pass in front of the mantle, the robe and the boots
  head        the hood and skull again, faded in while the blade swings
              behind the head (the wind-up) and out before it comes over

Writes games/nightfall/runtime/assets/nightfall/reaper-v2/: each layer as webp, cropped
to its pixels with its canvas offset kept, at 3 px per rig unit, and
rig.json (boxes, joints and art sample points; rig units are the canvas at
4 px per unit, so 400 x 430).
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

GAME = Path(__file__).resolve().parents[1] / 'games/nightfall'
OUT = GAME / 'runtime/assets/nightfall/reaper-v2'
SOURCE = GAME / 'art/source/reaper-v2'
CANVAS = (1600, 1720)
UNIT = 4            # canvas px per rig unit
SCALE = 0.75        # stored px per canvas px (3 px per rig unit)
# The mantle: its skull on the robe's chest clasp (canvas px), scaled so the
# two skulls are the same size (the clasp is ~80 px wide, the mantle's ~100).
CLASP, MANTLE_SCALE, MANTLE_TURN = (915, 888), 0.8, 0
# The hand layer's wrist stub: left of the shaft, below the fist (canvas px).
STUB_ROW, STUB_FEATHER, SHAFT_LEFT = 752, 8, 1196
# The hood and skull outline on the canvas (with a 3 px soft edge).
HOOD = [(588, 325), (800, 280), (1112, 395), (1145, 520), (1115, 690), (1000, 745), (860, 725), (700, 625), (645, 500)]


def sample(mask, n):
    ys, xs = np.nonzero(mask)
    step = max(1, int(np.sqrt(len(xs) / n)))
    keep = (xs % step == 0) & (ys % step == 0)
    return list(zip(xs[keep].tolist(), ys[keep].tolist()))


def skull_centre(rgba, region):
    r, g, b, a = (rgba[..., i].astype(int) for i in range(4))
    m = (a > 200) & (r > 180) & (g > 140) & (b < 150) & (r - b > 60) & region
    ys, xs = np.nonzero(m)
    return float(xs.mean()), float(ys.mean())


def place_mantle(path):
    im = Image.open(path).convert('RGBA')
    a = np.array(im)
    yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    # The mantle's skull: its one bone-coloured blob, in the art's middle.
    cx, cy = skull_centre(a, (xx > a.shape[1] * .35) & (xx < a.shape[1] * .6) & (yy > a.shape[0] * .45) & (yy < a.shape[0] * .65))
    c, s = math.cos(math.radians(MANTLE_TURN)), math.sin(math.radians(MANTLE_TURN))
    k = MANTLE_SCALE
    m = np.array([[k * c, -k * s, 0], [k * s, k * c, 0], [0, 0, 1]]) @ np.array([[1, 0, -cx], [0, 1, -cy], [0, 0, 1]])
    m[0, 2] += CLASP[0]; m[1, 2] += CLASP[1]
    inv = np.linalg.inv(m)
    return np.array(im.transform(CANVAS, Image.AFFINE, tuple(inv[:2].ravel()), Image.BICUBIC)).astype(float)


def main(src, mantle):
    src = Path(src)
    meta = json.loads((src / 'rig.json').read_text())
    assert tuple(meta['canvas']) == CANVAS, meta['canvas']
    layers = {}
    for name, file in (('body', 'body'), ('arm-upper', 'arm-upper'), ('arm-fore', 'arm-fore'), ('hand', 'hand-scythe')):
        im = Image.open(src / 'parts' / f'{file}.png').convert('RGBA')
        assert im.size == CANVAS, (name, im.size)
        layers[name] = np.array(im).astype(float)
    layers['mantle'] = place_mantle(mantle)
    yy, xx = np.mgrid[0:CANVAS[1], 0:CANVAS[0]]
    stub = np.clip((yy - STUB_ROW) / STUB_FEATHER, 0, 1) * (xx < SHAFT_LEFT)
    layers['hand-front'] = layers['hand'].copy(); layers['hand-front'][..., 3] *= 1 - stub
    hood = Image.new('L', CANVAS, 0); ImageDraw.Draw(hood).polygon(HOOD, fill=255)
    layers['head'] = layers['body'].copy(); layers['head'][..., 3] *= np.array(hood.filter(ImageFilter.GaussianBlur(3))) / 255

    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob('*.webp'):
        old.unlink()
    parts, crops = {}, {}
    for name, arr in layers.items():
        a = arr[..., 3]
        ys, xs = np.nonzero(a > 2)
        x0, y0 = max(0, xs.min() - 2), max(0, ys.min() - 2)
        x1, y1 = min(CANVAS[0], xs.max() + 3), min(CANVAS[1], ys.max() + 3)
        im = Image.fromarray(np.clip(arr[y0:y1, x0:x1], 0, 255).astype(np.uint8), 'RGBA')
        im = im.resize((round((x1 - x0) * SCALE), round((y1 - y0) * SCALE)), Image.LANCZOS)
        im.save(OUT / f'{name}.webp', 'WEBP', lossless=True, quality=100, method=6)
        parts[name] = {'file': name, 'box': [round(v / UNIT, 3) for v in (x0, y0, x1 - x0, y1 - y0)]}
        crops[name] = (x0, y0, im.size[0] / (x1 - x0))

    def native(name, pts):
        x0, y0, s = crops[name]
        return [[round((x - x0) * s, 1), round((y - y0) * s, 1)] for x, y in pts]
    # The joints that must stay hidden: the whole upper arm (shoulder and
    # elbow ends) and the forearm's elbow knob (within 45 px of the pivot).
    ex, ey = meta['pivots']['elbow']
    joint = {'arm-upper': layers['arm-upper'][..., 3] > 200,
             'arm-fore': (layers['arm-fore'][..., 3] > 200) & ((xx - ex) ** 2 + (yy - ey) ** 2 < 45 ** 2)}
    cover = (layers['mantle'][..., 3] > 128) | (layers['hand'][..., 3] > 128)
    shows = {n: int((m & ~cover).sum()) for n, m in joint.items()}
    assert not any(shows.values()), f'the shoulder or elbow shows at rest: {shows}'
    body = layers['body'][..., 3] > 128
    by, bx = np.nonzero(body[-110:])
    ys, xs = np.nonzero(body)
    opaque = [layers[n][..., 3] > 128 for n in ('body', 'hand', 'mantle')]
    rig = {
        'name': meta['name'] + ' + mantle', 'size': [CANVAS[0] / UNIT, CANVAS[1] / UNIT],
        'parts': parts,
        'joints': {
            **{k: [v[0] / UNIT, v[1] / UNIT] for k, v in meta['pivots'].items()},
            'sole': round((ys.max() + 1) / UNIT, 2),
            'top': round(min(np.nonzero(m)[0].min() for m in opaque) / UNIT, 2),
            'right': round(max(np.nonzero(m)[1].max() for m in opaque) / UNIT, 2),
            # The body's centre line (through the chest clasp), as a share of
            # the width; the boots [centre x, width].
            'centre': round(CLASP[0] / CANVAS[0], 4), 'feet': [round((bx.min() + bx.max()) / 2 / UNIT, 2), round((bx.max() - bx.min()) / UNIT, 2)],
            # The blade's middle, for effects (rig units).
            'blade': [175, 45],
        },
        # Art sample points, in each stored layer's own pixels: the shoulder
        # and elbow (they must stay hidden in every frame), and the blade (it
        # must be clear of the hood whenever the hood layer fades).
        'checks': {
            'joints': {n: native(n, sample(m, 40)) for n, m in joint.items()},
            'blade': native('hand-front', sample((layers['hand-front'][..., 3] > 200) & (yy < 420), 60)),
        },
    }
    (OUT / 'rig.json').write_text(json.dumps(rig, indent=1) + '\n')
    print(json.dumps(rig['joints']))
    for n, p in parts.items():
        print(f"  {n:11s} box {p['box']}")


if __name__ == '__main__':
    main(*(sys.argv[1:3] or (SOURCE, SOURCE / 'shoulder-mantle.png')))
