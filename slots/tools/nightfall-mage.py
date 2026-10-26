#!/usr/bin/env python3
"""Night Fall skeleton mage (Claude, animation).

Builds the mage, the archer's replacement, from ChatGPT's registered mage
layers (games/nightfall/art/source/mage-v1/: 1600 x 1720 PNGs drawn in
place, with measured shoulder, elbow, wrist and head pivots) and the
shoulder mantle Dylan sent (mantle.png, in place of ChatGPT's robe cover:
no sleeve, a long flap over the staff arm). The game shows the mage with
`?archer=mage`.

    python3 tools/nightfall-mage.py

Back to front, the rig draws: body (robe, ribs, free arm, legs, boots);
upper arm and forearm, under the mantle; the back of the fist, the staff
and the fingers, one rigid grip; the head (blink.webp is its blink); and
the mantle, over the shoulder, the elbow and the neck.

Writes games/nightfall/runtime/assets/nightfall/mage/: each layer as webp,
cropped to its pixels with its canvas offset kept, at 3 px per rig unit,
and rig.json (boxes, joints and art sample points; rig units are the
canvas at 4 px per unit, so 400 x 430).
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image

GAME = Path(__file__).resolve().parents[1] / 'games/nightfall'
SOURCE = GAME / 'art/source/mage-v1'
OUT = GAME / 'runtime/assets/nightfall/mage'
CANVAS = (1600, 1720)
UNIT = 4            # canvas px per rig unit
SCALE = 0.75        # stored px per canvas px (3 px per rig unit)
LAYERS = {'body': 'body', 'arm-upper': 'arm-upper', 'arm-fore': 'arm-fore', 'hand-back': 'hand-back',
          'staff': 'staff', 'fingers': 'fingers', 'head': 'head', 'blink': 'head-blink', 'mantle': 'mantle'}


def sample(mask, n):
    ys, xs = np.nonzero(mask)
    step = max(1, int(np.sqrt(len(xs) / n)))
    keep = (xs % step == 0) & (ys % step == 0)
    return list(zip(xs[keep].tolist(), ys[keep].tolist()))


def main():
    meta = json.loads((SOURCE / 'rig.json').read_text())
    assert tuple(meta['canvas']) == CANVAS, meta['canvas']
    layers = {}
    for name, file in LAYERS.items():
        im = Image.open(SOURCE / f'{file}.png').convert('RGBA')
        assert im.size == CANVAS, (name, im.size)
        layers[name] = np.array(im).astype(float)
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
        parts[name] = {'file': name, 'box': [round(float(v) / UNIT, 3) for v in (x0, y0, x1 - x0, y1 - y0)]}
        crops[name] = (x0, y0, im.size[0] / (x1 - x0))

    def native(name, pts):
        x0, y0, s = crops[name]
        return [[round((x - x0) * s, 1), round((y - y0) * s, 1)] for x, y in pts]
    yy, xx = np.mgrid[0:CANVAS[1], 0:CANVAS[0]]
    piv = meta['pivots']
    ex, ey = piv['elbow']
    # The joints that must stay hidden: the whole upper arm (shoulder and
    # elbow ends) and the forearm's elbow end (within 45 px of the pivot).
    joint = {'arm-upper': layers['arm-upper'][..., 3] > 200,
             'arm-fore': (layers['arm-fore'][..., 3] > 200) & ((xx - ex) ** 2 + (yy - ey) ** 2 < 45 ** 2)}
    cover = np.any([layers[n][..., 3] > 128 for n in ('hand-back', 'staff', 'fingers', 'head', 'mantle')], axis=0)
    shows = {n: int((m & ~cover).sum()) for n, m in joint.items()}
    assert not any(shows.values()), f'the shoulder or elbow shows at rest: {shows}'
    # The grip: finger pixels over the shaft (both opaque).
    grip = (layers['fingers'][..., 3] > 200) & (layers['staff'][..., 3] > 200)
    assert grip.sum() > 500, 'the fingers do not close on the shaft'
    body = layers['body'][..., 3] > 128
    ys, xs = np.nonzero(body)
    by, bx = np.nonzero(body[-110:])
    staff = layers['staff'][..., 3] > 128
    sy, sx = np.nonzero(staff)
    top, foot = sy.min(), sy.max()
    rig = {
        'name': 'Skeleton mage v1 + mantle', 'size': [CANVAS[0] / UNIT, CANVAS[1] / UNIT],
        'parts': parts,
        'joints': {
            **{k: [v[0] / UNIT, v[1] / UNIT] for k, v in piv.items()},
            'sole': round((ys.max() + 1) / UNIT, 2),
            'centre': round(meta['bodyCenterX'] / CANVAS[0], 4),
            'feet': [round((bx.min() + bx.max()) / 2 / UNIT, 2), round((bx.max() - bx.min()) / UNIT, 2)],
            # The staff's crystal tip and its foot (rig units), for effects.
            'crystal': [round(float(sx[sy == top].mean()) / UNIT, 2), round(float(top) / UNIT, 2)],
            'foot': [round(float(sx[sy == foot].mean()) / UNIT, 2), round(float(foot) / UNIT, 2)],
            # How far the grip rises in the slam (ChatGPT's proof), rig units.
            'lift': meta['liftPixels'] / UNIT,
            'ikBranch': meta['ikBranch'],
        },
        # Art sample points, in each stored layer's own pixels: the shoulder
        # and elbow (they must stay hidden in every frame) and the grip
        # (fingers over the shaft).
        'checks': {
            'joints': {n: native(n, sample(m, 40)) for n, m in joint.items()},
            'grip': native('fingers', sample(grip, 30)),
        },
    }
    (OUT / 'rig.json').write_text(json.dumps(rig, indent=1) + '\n')
    print(json.dumps(rig['joints']))
    for n, p in parts.items():
        print(f"  {n:9s} box {p['box']}")


if __name__ == '__main__':
    main()
