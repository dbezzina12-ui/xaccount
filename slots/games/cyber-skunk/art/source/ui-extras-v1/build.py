"""Build Cyber Skunk's optional controller texture and app icon.

The controller tile is mathematically periodic and intentionally low contrast.
The icon composites the approved registered v4.1 head pieces; it does not alter
or replace any production mascot layer.
"""
from pathlib import Path
import hashlib
import json
import math
import random

from PIL import Image, ImageDraw, ImageFilter, ImageStat


SRC = Path(__file__).resolve().parent
ART = SRC.parents[1]
OUT = ART / "ui"
MASCOT = ART / "source" / "mascot-compact-v4" / "registered"
OUT.mkdir(exist_ok=True)

SIZE = 512
GRAPHITE = (31, 42, 48)


def build_controller_texture() -> tuple[Image.Image, dict]:
    """Create a 512px periodic graphite/brass control-surface tile."""
    random.seed(31031)
    # Horizontal brush lines vary by y. Fourier components make the field
    # periodic at the outer edge, while a quiet x component avoids flat bands.
    y_phases = [(random.random() * math.tau, random.uniform(0.7, 2.2)) for _ in range(10)]
    px = Image.new("RGB", (SIZE, SIZE))
    pix = px.load()
    for y in range(SIZE):
        line = sum(a * math.sin(math.tau * (i + 1) * y / SIZE + p)
                   for i, (p, a) in enumerate(y_phases)) / 4.0
        for x in range(SIZE):
            cross = 1.25 * math.sin(math.tau * x / SIZE + .35) + .65 * math.sin(math.tau * 5 * x / SIZE)
            v = max(-6, min(6, line + cross))
            pix[x, y] = tuple(max(0, min(255, int(c + v))) for c in GRAPHITE)

    # Draw one modular rivet field on a 3x3 canvas and retain the centre tile,
    # so rivets crossing an edge wrap with no clipping seam.
    rivets = Image.new("RGBA", (SIZE * 3, SIZE * 3), (0, 0, 0, 0))
    d = ImageDraw.Draw(rivets)
    for gy in range(-1, 4):
        for gx in range(-1, 4):
            cx = SIZE + 64 + gx * 128
            cy = SIZE + 64 + gy * 128
            d.ellipse((cx - 9, cy - 9, cx + 9, cy + 9), fill=(7, 11, 14, 90))
            d.ellipse((cx - 7, cy - 7, cx + 7, cy + 7), fill=(123, 83, 40, 92), outline=(191, 143, 78, 105), width=2)
            d.ellipse((cx - 3, cy - 4, cx + 2, cy + 1), fill=(239, 203, 132, 85))
    centre = rivets.crop((SIZE, SIZE, SIZE * 2, SIZE * 2)).filter(ImageFilter.GaussianBlur(.35))
    out = Image.alpha_composite(px.convert("RGBA"), centre).convert("RGB")

    # Adjacent edge deltas are the relevant seamless-tile check. They remain
    # inside the normal brush variation, rather than forming a visible seam.
    stat = ImageStat.Stat(out)
    extrema = out.getextrema()
    edge_x = max(abs(out.getpixel((0, y))[c] - out.getpixel((SIZE - 1, y))[c])
                 for y in range(SIZE) for c in range(3))
    edge_y = max(abs(out.getpixel((x, 0))[c] - out.getpixel((x, SIZE - 1))[c])
                 for x in range(SIZE) for c in range(3))
    checks = {
        "rgb_opaque": out.mode == "RGB",
        "low_channel_ranges": [b - a for a, b in extrema],
        "max_wrap_delta_x": edge_x,
        "max_wrap_delta_y": edge_y,
        "mean_rgb": [round(v, 2) for v in stat.mean],
        "faint_brass_rivets": True,
    }
    # Rivet highlights are the extrema; the brushed field itself stays within
    # a twelve-level band. Keep the complete tile restrained enough for icons.
    assert max(checks["low_channel_ranges"]) <= 84, checks
    assert edge_x <= 4 and edge_y <= 4
    return out, checks


def build_icon() -> tuple[Image.Image, dict]:
    """Composite the approved four-piece v4.1 head into a compact app icon."""
    registered = Image.new("RGBA", (1600, 2000), (0, 0, 0, 0))
    pieces = ["far-ear", "head", "ear", "goggles"]
    for name in pieces:
        registered.alpha_composite(Image.open(MASCOT / f"{name}.png").convert("RGBA"))

    # Includes both ears, the full goggles and the chin while excluding empty
    # rig canvas. The slight lower crop improves the face at browser-tab size.
    portrait = registered.crop((625, 330, 1245, 1100))
    portrait.thumbnail((420, 438), Image.Resampling.LANCZOS)

    bg = Image.new("RGB", (SIZE, SIZE), "#101820")
    bp = bg.load()
    for y in range(SIZE):
        for x in range(SIZE):
            dist = math.hypot(x - 256, y - 246) / 360
            cyan = max(0, 1 - dist) * 10
            bp[x, y] = (16 + int(cyan * .25), 24 + int(cyan * .65), 32 + int(cyan))

    rings = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    rd = ImageDraw.Draw(rings)
    rd.rounded_rectangle((18, 18, 494, 494), radius=104, fill=(15, 23, 29, 245),
                         outline=(104, 200, 195, 170), width=6)
    rd.rounded_rectangle((29, 29, 483, 483), radius=94, outline=(173, 120, 64, 180), width=5)
    rd.arc((50, 50, 462, 462), 205, 335, fill=(237, 168, 60, 170), width=7)
    icon = Image.alpha_composite(bg.convert("RGBA"), rings)

    # Place the eyes and goggles high enough to remain legible after a 32px
    # reduction. A soft shadow separates the black fur from graphite.
    x = (SIZE - portrait.width) // 2 + 8
    y = 50
    shadow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    shadow.alpha_composite(portrait, (x + 7, y + 10))
    shadow.putalpha(shadow.getchannel("A").filter(ImageFilter.GaussianBlur(13)).point(lambda a: int(a * .48)))
    icon = Image.alpha_composite(icon, shadow)
    icon.alpha_composite(portrait, (x, y))
    out = icon.convert("RGB")

    small = out.resize((32, 32), Image.Resampling.LANCZOS)
    checks = {
        "rgb_opaque": out.mode == "RGB",
        "registered_pieces": pieces,
        "source_canvas": [1600, 2000],
        "readability_review_size": [32, 32],
        "no_reel_symbol_or_runtime_copy": True,
    }
    return out, checks, small


texture, texture_checks = build_controller_texture()
icon, icon_checks, icon_small = build_icon()
texture_path = OUT / "controller-texture.png"
icon_path = OUT / "icon.png"
texture.save(texture_path, optimize=True)
icon.save(icon_path, optimize=True)

# Review source at native scale, one repeated seam crossing and the actual
# browser-tab reduction. This file is evidence only and is not prepped.
review = Image.new("RGB", (1120, 720), "#0b1116")
review.paste(texture, (28, 28))
repeat = Image.new("RGB", (512, 128))
repeat.paste(texture.crop((384, 192, 512, 320)), (0, 0))
repeat.paste(texture.crop((0, 192, 384, 320)), (128, 0))
review.paste(repeat, (28, 570))
review.paste(icon, (580, 28))
review.paste(icon_small.resize((128, 128), Image.Resampling.NEAREST), (772, 570))
d = ImageDraw.Draw(review)
d.text((28, 548), "controller tile / wrapped seam", fill="#efe5cf")
d.text((580, 548), "icon / 32px nearest-neighbour review", fill="#efe5cf")
review.save(SRC / "review.jpg", quality=91)

manifest = {
    "files": {
        "ui/controller-texture.png": {
            "size": [SIZE, SIZE], "mode": texture.mode,
            "sha256": hashlib.sha256(texture_path.read_bytes()).hexdigest(),
            "checks": texture_checks,
        },
        "ui/icon.png": {
            "size": [SIZE, SIZE], "mode": icon.mode,
            "sha256": hashlib.sha256(icon_path.read_bytes()).hexdigest(),
            "checks": icon_checks,
        },
    },
    "method": "Original deterministic Pillow composition from approved registered v4.1 art; no generated image.",
}
(SRC / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
print(json.dumps(manifest, indent=2))
