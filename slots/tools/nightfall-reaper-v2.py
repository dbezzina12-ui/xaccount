#!/usr/bin/env python3
"""Night Fall reaper v2 candidate (Claude, animation).

Imports ChatGPT's registered reaper arm package (Reaper-Arm-Pieces-v1:
six 1600 x 1720 layers drawn in place, with measured shoulder, elbow and
wrist pivots) into a candidate rig for nightfall-actors.js. The current
reaper stays the default; the game uses this one with `?reaper=v2`.

Dylan's direction: the bare bone arm, no sleeves, with the shoulder and the
elbow hidden behind the robe. So the robe body, the upper arm, the forearm
and the hand-and-scythe are used; the package's two sleeve layers are not.

    python3 tools/nightfall-reaper-v2.py PATH/TO/Reaper-Arm-Pieces-v1

Writes games/nightfall/runtime/assets/nightfall/reaper-v2/ (git-ignored
until Dylan clears the art for the public repo):
  <layer>.webp         each layer cropped to its pixels (the crop offset is
                       kept, so nothing moves), at 3 px per rig unit
  <layer>-front.webp   the forearm and the hand-and-scythe, less what the
                       robe covers at rest. The strike fades these
                       in over the robe for the slash, so the shaft passes in
                       front of the body and boots instead of vanishing
                       behind them; at rest they change nothing.
  rig.json             boxes, joints and art sample points (rig units: the
                       1600 x 1720 canvas at 4 px per unit, so 400 x 430)
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parents[1] / 'games/nightfall/runtime/assets/nightfall/reaper-v2'
CANVAS = (1600, 1720)
UNIT = 4            # canvas px per rig unit
SCALE = 0.75        # stored px per canvas px (3 px per rig unit)
LAYERS = ['arm-upper', 'arm-fore', 'hand-scythe', 'body']
FRONT = ['arm-fore', 'hand-scythe']


def disc(mask, r):
    out = mask.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx * dx + dy * dy <= r * r:
                out |= np.roll(np.roll(mask, dy, 0), dx, 1)
    return out


def blur(a, r):
    p = np.pad(a, r, mode='edge'); out = np.zeros_like(a)
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            out += p[r + dy:r + dy + a.shape[0], r + dx:r + dx + a.shape[1]]
    return out / (2 * r + 1) ** 2


def sample(mask, n):
    ys, xs = np.nonzero(mask)
    step = max(1, int(np.sqrt(len(xs) / n)))
    keep = (xs % step == 0) & (ys % step == 0)
    return list(zip(xs[keep].tolist(), ys[keep].tolist()))


def main(src):
    src = Path(src)
    meta = json.loads((src / 'rig.json').read_text())
    assert tuple(meta['canvas']) == CANVAS, meta['canvas']
    layers = {}
    for name in LAYERS:
        im = Image.open(src / 'parts' / f'{name}.png').convert('RGBA')
        assert im.size == CANVAS, (name, im.size)
        layers[name] = np.array(im).astype(float)
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob('*.webp'):
        old.unlink()
    (OUT / '.gitignore').write_text('# Candidate art: not for the public repo until Dylan says so.\n*\n')

    # What the robe covers at rest, grown 2 units and feathered over 4.
    body = layers['body'][..., 3] > 128
    keep = blur(1 - disc(body, 2 * UNIT).astype(float), 2 * UNIT)

    parts, crops = {}, {}
    def write(name, arr):
        a = arr[..., 3]
        ys, xs = np.nonzero(a > 2)
        x0, y0 = max(0, xs.min() - 2), max(0, ys.min() - 2)
        x1, y1 = min(CANVAS[0], xs.max() + 3), min(CANVAS[1], ys.max() + 3)
        im = Image.fromarray(np.clip(arr[y0:y1, x0:x1], 0, 255).astype(np.uint8), 'RGBA')
        im = im.resize((round((x1 - x0) * SCALE), round((y1 - y0) * SCALE)), Image.LANCZOS)
        im.save(OUT / f'{name}.webp', 'WEBP', lossless=True, quality=100, method=6)
        parts[name] = {'file': name, 'box': [x0 / UNIT, y0 / UNIT, (x1 - x0) / UNIT, (y1 - y0) / UNIT]}
        crops[name] = (x0, y0, im.size[0] / (x1 - x0))
    for name in LAYERS:
        write(name, layers[name])
    for name in FRONT:
        front = layers[name].copy(); front[..., 3] *= keep
        write(f'{name}-front', front)

    # A canvas point in a stored layer's own pixels (for the browser checks).
    def native(name, pts):
        x0, y0, s = crops[name]
        return [[round((x - x0) * s, 1), round((y - y0) * s, 1)] for x, y in pts]
    # The joints that must stay behind the robe: the whole upper arm (shoulder
    # and elbow ends) and the forearm's elbow knob (within 35 px of the pivot);
    # the check takes the points the robe hides at rest (all but a sliver at
    # the robe's edge, where the forearm comes out).
    yy, xx = np.mgrid[0:CANVAS[1], 0:CANVAS[0]]
    ex, ey = meta['pivots']['elbow']
    joint = {'arm-upper': layers['arm-upper'][..., 3] > 200,
             'arm-fore': (layers['arm-fore'][..., 3] > 200) & ((xx - ex) ** 2 + (yy - ey) ** 2 < 35 ** 2)}
    shows = {n: int((m & ~body).sum()) for n, m in joint.items()}
    # The boots, for the contact shadow: the body's lowest 40 px.
    by, bx = np.nonzero(body[-110:])
    feet = [round((bx.min() + bx.max()) / 2 / UNIT, 2), round((bx.max() - bx.min()) / UNIT, 2)]
    piv = {k: [v[0] / UNIT, v[1] / UNIT] for k, v in meta['pivots'].items()}
    ys, xs = np.nonzero(body)
    top = min(np.nonzero(layers[n][..., 3] > 128)[0].min() for n in LAYERS) / UNIT
    right = max(np.nonzero(layers[n][..., 3] > 128)[1].max() for n in LAYERS) / UNIT
    rig = {
        'name': meta['name'], 'size': [CANVAS[0] / UNIT, CANVAS[1] / UNIT],
        'parts': parts,
        'joints': {
            'shoulder': piv['shoulder'], 'elbow': piv['elbow'], 'wrist': piv['wrist'],
            'sole': round((ys.max() + 1) / UNIT, 2), 'top': round(top, 2), 'right': round(right, 2),
            # The body's centre (the canvas is centred on it); the boots.
            'centre': 0.5, 'feet': feet,
        },
        # Art sample points (each stored layer's own pixels) of the shoulder
        # and elbow, which must stay behind the robe in every frame.
        'checks': {'joints': {n: native(n, sample(m & body, 40)) for n, m in joint.items()}},
    }
    (OUT / 'rig.json').write_text(json.dumps(rig, indent=1) + '\n')
    print(json.dumps(rig['joints']), 'joint pixels outside the robe at rest:', shows)
    assert sum(shows.values()) < 200, 'the shoulder or elbow shows at rest'
    for n, p in parts.items():
        print(f"  {n:20s} box {[round(v, 2) for v in p['box']]}")


if __name__ == '__main__':
    main(sys.argv[1])
