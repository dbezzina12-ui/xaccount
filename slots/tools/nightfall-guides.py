#!/usr/bin/env python3
"""Night Fall rig v2 tracing guides (Claude, animation).

Writes games/nightfall/shots/rig-v2/guide-reaper.jpg and guide-archer.jpg:
each character cut from art/source/layout-target.png, scaled 4.5x, on the
exact canvas the rig v2 layers must use (1600 x 1720 px, soles on y = 1656,
body centred on x = 800). ChatGPT traces over these, so every layer lands in
place and the assembled character matches the target pose. See
games/nightfall/ART_SPEC.md.

    python3 tools/nightfall-guides.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

GAME = Path(__file__).resolve().parents[1] / 'games/nightfall'
W, H, SOLE, CENTRE, K = 1600, 1720, 1656, 800, 4.5
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'

# [crop box in layout-target.png, the soles' row there, the body's centre x
# there (the belt buckle / spine), mirrored?, notes]
CHARACTERS = {
    'reaper': ((0, 1060, 300, 1430), 1413, 163, False, [
        'REAPER: trace this pose exactly.',
        'Complete everything the Buy Bonus button and the screen edge hide (cape, robe, boot).',
    ]),
    'archer': ((590, 1060, 864, 1430), 1420, 720, True, [
        'ARCHER: the target MIRRORED, so he holds the bow toward the reels and the arrow points at them.',
        'One exception: the head looks LEFT, toward the reels (in this mirror it looks right).',
    ]),
}


def guide(name, box, sole, centre_x, mirror, notes):
    target = Image.open(GAME / 'art/source/layout-target.png').convert('RGB')
    crop = target.crop(box)
    if mirror:
        crop = crop.transpose(Image.FLIP_LEFT_RIGHT)
    crop = crop.resize((round(crop.width * K), round(crop.height * K)), Image.LANCZOS)
    cx = (box[2] - centre_x if mirror else centre_x - box[0]) * K
    out = Image.new('RGB', (W, H), (24, 26, 32))
    out.paste(crop, (round(CENTRE - cx), round(SOLE - (sole - box[1]) * K)))
    d = ImageDraw.Draw(out)
    big, small = ImageFont.truetype(FONT, 30), ImageFont.truetype(FONT, 24)
    d.rectangle([0, 0, W - 1, H - 1], outline=(255, 255, 255), width=4)
    d.line([(0, SOLE), (W, SOLE)], fill=(0, 230, 255), width=4)
    d.text((16, SOLE + 10), f'SOLES ON THIS LINE (y = {SOLE})', font=big, fill=(0, 230, 255))
    d.line([(CENTRE, 0), (CENTRE, SOLE)], fill=(255, 0, 200), width=2)
    d.text((CENTRE + 8, 60), f'x = {CENTRE}: body centre', font=small, fill=(255, 0, 200))
    d.rectangle([0, 0, W, 50], fill=(0, 0, 0))
    d.text((16, 10), f'Canvas {W} x {H} px, transparent. Every layer on this same canvas, drawn in place. 1 px of layout-target.png = {K} px.',
           font=small, fill='white')
    y = H - 30 * len(notes) - 6
    d.rectangle([0, y - 6, W, H], fill=(0, 0, 0))
    for n in notes:
        d.text((16, y), n, font=small, fill=(255, 230, 120)); y += 30
    path = GAME / f'shots/rig-v2/guide-{name}.jpg'
    path.parent.mkdir(parents=True, exist_ok=True)
    out.save(path, quality=90)
    print(path.relative_to(GAME.parents[1]))


if __name__ == '__main__':
    for name, args in CHARACTERS.items():
        guide(name, *args)
