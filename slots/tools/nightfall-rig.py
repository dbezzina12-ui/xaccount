#!/usr/bin/env python3
"""Night Fall rig parts and joints (Claude, animation).

Derives the extra layers the jointed rig needs from ChatGPT's approved cutouts,
places the arms where they join the body, and measures the joints the rig
pivots on. Re-run after any rig artwork change:

    python3 tools/nightfall-rig.py

Writes, in games/nightfall/runtime/assets/nightfall/:
  archer/bow-bare.webp      the bow without its baked arrow and string
  archer/arrow.webp         the nocked arrow alone (same canvas as the bow)
  archer/draw-upper.webp    the draw arm's upper arm, shoulder ball and elbow knob
  archer/draw-fore.webp     the draw arm's bracer and fist (same canvas as the arm)
  reaper/upper-*-hem.webp   each sleeve again, less what the body covers: drawn
                            over its forearm, so the forearm comes out of it
  reaper/fore-right-fist.webp  the right fist alone, drawn over the scythe shaft
  rig.json                  joints and rest placements, in the 320 x 430 rig
                            space of nightfall-actors.js

The cutouts are separate tubes: every forearm has a socket cap on top meant to
sit inside its sleeve, and every arm has a shoulder ball meant to sit on the
body's. ChatGPT's placement boxes stack them end to end, so the caps show and
the archer's shoulders float beside the body. Each arm therefore gets a rest
placement (a small turn or move of its art inside its bone): the reaper's
forearms slide up into their sleeves, the archer's shoulder balls go onto the
body's. The script checks the result from the pixels: every socket cap pixel is
under an opaque sleeve pixel, and every shoulder ball is centred on its socket.

Joints come from the art: shoulders and sockets are the balls' centres, an
elbow is the centre of the forearm's socket cap (inside the sleeve), the scythe
grip is where the right fist covers the shaft, and the bow's string, nock and
tips are fitted to the string pixels.
"""
import json
import math
from collections import deque
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

# Rest placements (the art's turn and move inside its bone): searched over
# turns and slides for the deepest seat of each socket cap in its sleeve over
# every elbow bend the animation uses (`bend`, degrees from rest; the strike
# swings the scythe arm from -46 to +16), with the scythe fist still on the
# shaft, then checked by eye against art/source/layout-target.png. Both caps
# stay at least 3 rig units inside their sleeves. Degrees, rig units.
REAPER_FIT = {
    'upperRight': {'turn': -8},              # the sleeve swings out a little from the shoulder
    'foreRight': {'turn': -15, 'slide': 16, 'bend': [-50, 20]},  # the fist turns on the shaft and slides up it
    'upperLeft': {'turn': 4},
    'foreLeft': {'turn': 4, 'move': [-3, -33], 'about': [150, 290], 'bend': [-10, 10]},  # about the hand (native px)
}
# The fist is drawn again over the shaft from this row of fore-right.webp down.
FIST_ROW, FIST_FEATHER = 215, 8
# The archer's bow arm rises this much at rest so the hand closes on the riser.
ARMLIFT = 18


# 3 x 3 affine matrices, the same convention as nightfall-actors.js.
def rot(deg, p):
    r = math.radians(deg); c, s = math.cos(r), math.sin(r); x, y = p
    return np.array([[c, -s, x - c * x + s * y], [s, c, y - s * x - c * y], [0, 0, 1.0]])


def move(d):
    return np.array([[1, 0, d[0]], [0, 1, d[1]], [0, 0, 1.0]])


def apply(m, p):
    return (m @ np.array([p[0], p[1], 1.0]))[:2]


def js(m):
    """[a, b, c, d, e, f] for nightfall-actors.js: x' = a x + c y + e, y' = b x + d y + f."""
    return [round(float(v), 6) for v in (m[0, 0], m[1, 0], m[0, 1], m[1, 1], m[0, 2], m[1, 2])]


def rnd(p):
    return [round(float(p[0]), 2), round(float(p[1]), 2)]


def image(kind, file):
    return Image.open(ROOT / kind / f'{file}.webp').convert('RGBA')


def load(kind, part):
    return np.array(image(kind, FILES[part]))


def save(arr, path):
    Image.fromarray(arr.astype(np.uint8), 'RGBA').save(path, 'WEBP', lossless=True, quality=100, method=6)


def to_rig(kind, part, x, y, shape):
    bx, by, bw, bh = BOXES[kind][part]
    return np.array([bx + x * bw / shape[1], by + y * bh / shape[0]])


def placed(kind, part, m=None, alpha=None, size=(430, 320)):
    """A part's alpha (or the given native-size weight) drawn into rig space
    (1 px = 1 rig unit) at its box, then moved by m, as the page draws it."""
    bx, by, bw, bh = BOXES[kind][part]
    im = image(kind, FILES[part])
    a = np.array(im)[..., 3] / 255 if alpha is None else alpha
    n = np.array([[bw / im.width, 0, bx], [0, bh / im.height, by], [0, 0, 1.0]])
    t = (np.eye(3) if m is None else m) @ n
    inv = np.linalg.inv(t)
    out = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).transform(
        (size[1], size[0]), Image.AFFINE, tuple(inv[:2].ravel()), Image.BILINEAR)
    return np.array(out) / 255


def rig_mask(kind, part):
    return placed(kind, part)


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


def disc(mask, r):
    out = mask.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx * dx + dy * dy <= r * r:
                out |= np.roll(np.roll(mask, dy, 0), dx, 1)
    return out


def blur(a, r):
    if r <= 0:
        return a
    p = np.pad(a, r, mode='edge'); out = np.zeros_like(a)
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            out += p[r + dy:r + dy + a.shape[0], r + dx:r + dx + a.shape[1]]
    return out / (2 * r + 1) ** 2


def flood(mask, seed):
    h, w = mask.shape; out = np.zeros_like(mask); q = deque([seed]); out[seed] = True
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            yy, xx = y + dy, x + dx
            if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not out[yy, xx]:
                out[yy, xx] = True; q.append((yy, xx))
    return out


def centroid(mask):
    ys, xs = np.nonzero(mask)
    return np.array([float(xs.mean()), float(ys.mean())])


def sole(kind):
    """Lowest opaque row of the body (the soles), in rig space."""
    m = rig_mask(kind, 'body') > 0.5
    return int(np.nonzero(m.any(axis=1))[0].max()) + 1


def socket_cap(kind, part):
    """The socket cap on top of a forearm: the pale mauve ellipse in the
    topmost rows and its dark outline (native px), down to the cloth."""
    a = load(kind, part).astype(int)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    hi = np.maximum(np.maximum(r, g), b); lo = np.minimum(np.minimum(r, g), b); sat = (hi - lo) / np.maximum(hi, 1)
    pale = (al > 200) & (hi > 80) & (sat < .38)
    ys, xs = np.nonzero(pale[:40]); i = int(np.argmin(ys))
    cap = flood(pale, (int(ys[i]), int(xs[i])))
    cloth = (sat > .38) & (hi > 70)
    return cap, disc(cap, 6) & (al > 20) & ~cloth


def ball(mask, top_rows):
    """Centre and radius of a bone ball at the top of a bone mask: its widest row."""
    m = mask.copy(); m[top_rows:] = False
    widths = m.sum(axis=1); y = int(np.argmax(widths)); xs = np.nonzero(m[y])[0]
    rows = np.nonzero(m.any(axis=1))[0]
    return np.array([float(xs.min() + xs.max()) / 2, float(y)]), float(xs.max() - xs.min() + 1) / 2, rows


def circle(points):
    """Least-squares circle through points: centre and radius."""
    x, y = np.array(points, float).T
    a = np.c_[2 * x, 2 * y, np.ones_like(x)]
    cx, cy, c = np.linalg.lstsq(a, x * x + y * y, rcond=None)[0]
    return np.array([cx, cy]), math.sqrt(c + cx * cx + cy * cy)


def bone_colour(a):
    return (a[..., 3] > 200) & (a[..., 0] > 185) & (a[..., 1] > 160) & (a[..., 2] > 110)


def ring(shape, c, r):
    """The disc of radius r about c (native px)."""
    yy, xx = np.mgrid[0:shape[0], 0:shape[1]]
    return (xx - c[0]) ** 2 + (yy - c[1]) ** 2 <= r * r


def sample_points(mask, n=36):
    """Up to about n points spread over a mask (native px)."""
    ys, xs = np.nonzero(mask)
    step = max(1, int(math.sqrt(len(xs) / n)))
    keep = (xs % step == 0) & (ys % step == 0)
    return [[int(x), int(y)] for x, y in zip(xs[keep], ys[keep])]


def reaper():
    k = 'reaper'
    up_r, fore_r, scythe = rig_mask(k, 'upperRight'), rig_mask(k, 'foreRight'), rig_mask(k, 'scythe')
    up_l = rig_mask(k, 'upperLeft')
    hand_r = fore_r.copy(); hand_r[:300] = 0  # the fist: lower part of the forearm
    shoulder_r, shoulder_l = centroid(up_r[:190] > 0.5), centroid(up_l[:192] > 0.5)
    grip0 = centroid((hand_r > 0.5) & (scythe > 0.5))
    # The scythe shaft's line (x = a y + b), from its narrow rows.
    sm = scythe > 0.5; pts = []
    for y in range(120, 392, 4):
        xs = np.nonzero(sm[y, 230:300])[0] + 230
        if len(xs) and xs.max() - xs.min() < 16:
            pts.append((xs.mean(), y))
    a_, _ = np.polyfit(*np.array(pts)[:, ::-1].T, 1)
    up_shaft = -np.array([a_, 1.0]) / math.hypot(a_, 1.0)

    fit = REAPER_FIT
    rest = {
        'upperRight': rot(fit['upperRight']['turn'], shoulder_r),
        'foreRight': move(up_shaft * fit['foreRight']['slide']) @ rot(fit['foreRight']['turn'], grip0),
        'upperLeft': rot(fit['upperLeft']['turn'], shoulder_l),
    }
    fl = load(k, 'foreLeft')
    about = to_rig(k, 'foreLeft', *fit['foreLeft']['about'], fl.shape)
    rest['foreLeft'] = move(fit['foreLeft']['move']) @ rot(fit['foreLeft']['turn'], about)

    # Hems: each sleeve, less what the body and head cover at rest (grown by
    # 2 units and feathered over 4), so drawn over the forearm it changes
    # nothing but the forearm's top.
    above = (rig_mask(k, 'body') > 0.5) | (rig_mask(k, 'head') > 0.5)
    hems, joints, stubs, check = {}, {}, {}, {}
    for side, upper, fore in (('Right', 'upperRight', 'foreRight'), ('Left', 'upperLeft', 'foreLeft')):
        im = load(k, upper); h, w = im.shape[:2]; bx, by, bw, bh = BOXES[k][upper]
        v, u = np.mgrid[0:h, 0:w]
        rig_xy = np.stack([bx + u * bw / w, by + v * bh / h, np.ones_like(u, float)])
        px = np.tensordot(rest[upper], rig_xy, axes=1)
        X = np.clip(np.round(px[0]).astype(int), 0, 319); Y = np.clip(np.round(px[1]).astype(int), 0, 429)
        cover = disc(above[Y, X], int(round(2 * w / bw)))
        keep = blur(1 - cover.astype(float), int(round(4 * w / bw)))
        hem = im.astype(float); hem[..., 3] *= keep
        hems[upper] = hem
        save(hem, ROOT / k / f'{FILES[upper]}-hem.webp')
        # The elbow: the centre of the forearm's socket cap, seated in the sleeve.
        cap, stub = socket_cap(k, fore)
        fa = load(k, fore)
        joints['elbow' + side] = rnd(apply(rest[fore], to_rig(k, fore, *centroid(cap), fa.shape)))
        stubs[fore] = sample_points(stub)
        # Check from the pixels: every stub pixel under an opaque hem pixel,
        # at rest and at every bend about the elbow.
        hm = placed(k, upper, rest[upper], hem[..., 3] / 255) > 0.5
        lo, hi = fit[fore]['bend']
        check[fore] = max(int((placed(k, fore, rot(b, joints['elbow' + side]) @ rest[fore], stub.astype(float)) > 0.5)[~hm].sum())
                          for b in range(lo, hi + 1, 5))
    for fore, bare in check.items():
        assert bare == 0, f'{fore}: {bare} socket cap pixels outside the sleeve at some bend'
    # The right fist again, over the shaft.
    fr = load(k, 'foreRight').astype(float)
    fr[..., 3] *= np.clip((np.arange(fr.shape[0])[:, None] - FIST_ROW) / FIST_FEATHER, 0, 1)
    save(fr, ROOT / k / 'fore-right-fist.webp')
    joints.update({
        'shoulderRight': rnd(shoulder_r), 'shoulderLeft': rnd(shoulder_l),
        'grip': rnd(apply(rest['foreRight'], grip0)),
        'neck': [178, 214], 'shoulders': [172, 172], 'sole': sole(k),
        'rest': {p: js(m) for p, m in rest.items()},
        # Socket cap sample points (native px of each forearm), for the coverage test.
        'stubs': stubs,
    })
    return joints


def archer():
    k = 'archer'
    bow = load(k, 'bow').astype(float)
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
        kk, c = np.polyfit(ys, xs, 1)  # x = k*y + c
        lines[name] = (kk, c)
    # Nock: where the two string lines meet.
    (k1, c1), (k2, c2) = lines['upper'], lines['lower']
    ny = (c2 - c1) / (k1 - k2)
    nx = k1 * ny + c1
    # Tips: the end of each line where it reaches the limb (last opaque string pixel going outward).
    def tip(kk, c, ys):
        for y in ys:
            x = kk * y + c
            if 0 <= int(round(x)) < w and a[y, int(round(x))] > 60:
                return [x, y]
        return [kk * ys[-1] + c, ys[-1]]
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
    arm = load(k, 'drawArm').astype(float)
    ah, aw = arm.shape[:2]
    yy, xx = np.mgrid[0:ah, 0:aw]
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

    # Shoulders. Each arm's ball goes onto the body's socket ball on its side:
    # the left one is in full view (its widest row); the right one is half
    # under the cape, so a circle is fitted to the arc it shows past the body's
    # outline. Native px, then rig.
    body = load(k, 'body')
    bones = bone_colour(body); ys, xs = np.nonzero(bones[90:170, 100:200]); i = int(np.argmin((xs - 50) ** 2 + (ys - 38) ** 2))
    left_socket, left_r, _ = ball(flood(bones, (int(ys[i]) + 90, int(xs[i]) + 100)), 170)
    edge = [(float(np.nonzero(body[y, :, 3] > 128)[0].max()), float(y)) for y in range(100, 156)]
    right_socket, right_r = circle(edge)
    # An arm's ball is the widest part of its outline above the humerus.
    bow_ball, _, _ = ball(load(k, 'bowArm')[..., 3] > 128, 85)
    draw_ball, _, _ = ball(arm[..., 3] > 128, 85)
    ba = load(k, 'bowArm').shape
    sockets = {'bowArm': to_rig(k, 'body', *left_socket, body.shape), 'drawArm': to_rig(k, 'body', *right_socket, body.shape)}
    balls = {'bowArm': to_rig(k, 'bowArm', *bow_ball, ba), 'drawArm': to_rig(k, 'drawArm', *draw_ball, (ah, aw))}
    t_bow, t_draw = sockets['bowArm'] - balls['bowArm'], sockets['drawArm'] - balls['drawArm']
    rest = {'bowArm': move(t_bow), 'drawUpper': move(t_draw), 'drawFore': move(t_draw)}
    # The bow hand: the arm rises ARMLIFT degrees about its shoulder, and the
    # bow moves so the arrow's rest on the grip sits in the palm.
    palm = to_rig(k, 'bowArm', 75, 330, ba) + t_bow
    grip = to_rig(k, 'bow', 266, 316, (h, w))
    bow_shift = apply(rot(ARMLIFT, sockets['bowArm']), palm) - grip
    # The riser around the arrow's rest: the bow's rows from just above the
    # arrow to a little under it.
    riser = np.zeros((h, w), bool); riser[300:345] = bare[300:345, :, 3] > 128
    hand = placed(k, 'bowArm', rot(ARMLIFT, sockets['bowArm']) @ rest['bowArm']) > 0.5
    held = placed(k, 'bow', move(bow_shift), riser.astype(float)) > 0.5
    assert (held & hand).sum() > .85 * held.sum(), f'the bow hand covers {(held & hand).sum()} of {held.sum()} riser pixels'
    j = {
        'bowShoulder': rnd(sockets['bowArm']),
        'drawShoulder': rnd(sockets['drawArm']),
        'drawElbow': rnd(to_rig(k, 'drawArm', *knob_c, (ah, aw)) + t_draw),
        # The fingers on the string: the front of the fist's top knuckles.
        'fingers': rnd(to_rig(k, 'drawArm', 12, 186, (ah, aw)) + t_draw),
        'palm': rnd(palm),
        'nock': rnd(to_rig(k, 'bow', nx, ny, (h, w))),
        'tipTop': rnd(to_rig(k, 'bow', top[0], top[1], (h, w))),
        'tipBottom': rnd(to_rig(k, 'bow', bottom[0], bottom[1], (h, w))),
        'arrowTip': rnd(to_rig(k, 'bow', *arrow_tip, (h, w))),
        'grip': rnd(grip),
        'armLift': ARMLIFT, 'bowShift': rnd(bow_shift),
        'neck': [190, 222], 'sole': sole(k),
        'rest': {p: js(m) for p, m in rest.items()},
        # For the browser test, in native px: the ball centres; points on the
        # body's own socket balls (each must stay hidden under its arm's ball);
        # and the riser around the arrow's rest (it must stay under the hand).
        'balls': {'bowArm': rnd(bow_ball), 'drawUpper': rnd(draw_ball), 'bodyLeft': rnd(left_socket), 'bodyRight': rnd(right_socket)},
        'sockets': {name: sample_points(ring(body.shape[:2], c, .85 * rad) & (body[..., 3] > 128), 24)
                    for name, c, rad in (('bodyLeft', left_socket, left_r), ('bodyRight', right_socket, right_r))},
        'riser': sample_points(riser, 30),
    }
    return j


if __name__ == '__main__':
    joints = {'size': [320, 430], 'reaper': reaper(), 'archer': archer()}
    (ROOT / 'rig.json').write_text(json.dumps(joints, indent=1) + '\n')
    print(json.dumps({k: {n: v for n, v in j.items() if n not in ('stubs',)} for k, j in joints.items() if k != 'size'}, indent=1))
