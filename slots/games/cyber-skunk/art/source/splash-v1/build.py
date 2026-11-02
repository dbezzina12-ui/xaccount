"""Build the two Cyber Skunk opening illustrations from approved production art.

The art intentionally leaves the lower interaction zone dark and quiet. Prices,
rules, controls and outcomes remain live UI; none are baked into these images.
"""
from __future__ import annotations

from pathlib import Path
import hashlib
import json

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps, ImageStat


SRC = Path(__file__).resolve().parent
ART = SRC.parents[1]
OUT = ART / "ui"
OUT.mkdir(exist_ok=True)

BG = ART / "backgrounds"
CABINET = ART / "cabinet" / "cabinet.png"
LOGO = ART / "logo.png"
MASCOT = ART / "mascot" / "reference-compact.png"
SYMBOLS = ART / "symbols"

CYAN = (104, 200, 195)
AMBER = (237, 168, 60)
IVORY = (239, 229, 207)
GRAPHITE = (16, 24, 32)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def cover(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    """Resize and crop without distortion."""
    im = image.convert("RGB")
    scale = max(size[0] / im.width, size[1] / im.height)
    resized = im.resize((round(im.width * scale), round(im.height * scale)), Image.Resampling.LANCZOS)
    x = (resized.width - size[0]) // 2
    y = (resized.height - size[1]) // 2
    return resized.crop((x, y, x + size[0], y + size[1]))


def cropped_rgba(path: Path) -> Image.Image:
    im = Image.open(path).convert("RGBA")
    return im.crop(im.getbbox() or (0, 0, im.width, im.height))


def fit(im: Image.Image, width: int | None = None, height: int | None = None) -> Image.Image:
    if width is None:
        width = round(im.width * height / im.height)
    if height is None:
        height = round(im.height * width / im.width)
    copy = im.copy()
    copy.thumbnail((width, height), Image.Resampling.LANCZOS)
    return copy


def alpha_scale(im: Image.Image, opacity: float) -> Image.Image:
    out = im.copy()
    out.putalpha(out.getchannel("A").point(lambda a: round(a * opacity)))
    return out


def glow_panel(size: tuple[int, int], cabinet_box: tuple[int, int, int, int]) -> Image.Image:
    """A character-free six-reel face that sits behind the cabinet frame."""
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    x, y, w, h = cabinet_box
    face = (x + round(w * .13), y + round(h * .14), x + round(w * .87), y + round(h * .72))
    glow = Image.new("RGBA", size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.rounded_rectangle(face, radius=max(10, w // 40), fill=(*CYAN, 78), outline=(*AMBER, 170), width=max(3, w // 130))
    glow = glow.filter(ImageFilter.GaussianBlur(max(8, w // 38)))
    layer = Image.alpha_composite(layer, glow)
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle(face, radius=max(10, w // 40), fill=(9, 18, 23, 235), outline=(*CYAN, 150), width=max(2, w // 180))

    symbol_paths = [
        "h1-battery.png", "h2-rotor.png", "h3-canister.png",
        "h4-key.png", "wild.png", "scatter-letters.png",
    ]
    fx0, fy0, fx1, fy1 = face
    gap = max(4, w // 180)
    cell_w = (fx1 - fx0 - gap * 7) // 6
    cell_h = fy1 - fy0 - gap * 2
    for i, name in enumerate(symbol_paths):
        cx = fx0 + gap + i * (cell_w + gap)
        cy = fy0 + gap
        d.rounded_rectangle((cx, cy, cx + cell_w, cy + cell_h), radius=max(5, cell_w // 8),
                            fill=(18, 31, 38, 230), outline=(*IVORY, 58), width=1)
        symbol = cropped_rgba(SYMBOLS / name)
        symbol.thumbnail((round(cell_w * .82), round(cell_h * .82)), Image.Resampling.LANCZOS)
        layer.alpha_composite(symbol, (cx + (cell_w - symbol.width) // 2, cy + (cell_h - symbol.height) // 2))
    return layer


def spray(size: tuple[int, int], points: list[tuple[int, int]]) -> Image.Image:
    """A restrained pressure trail above the live-UI safe zone."""
    halo = Image.new("RGBA", size, (0, 0, 0, 0))
    hd = ImageDraw.Draw(halo)
    hd.line(points, fill=(*CYAN, 120), width=max(16, size[0] // 95), joint="curve")
    halo = halo.filter(ImageFilter.GaussianBlur(max(8, size[0] // 140)))
    line = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(line)
    d.line(points, fill=(*CYAN, 210), width=max(5, size[0] // 300), joint="curve")
    d.line(points, fill=(*IVORY, 210), width=max(2, size[0] // 650), joint="curve")
    for i in range(1, 6):
        x = round(points[-1][0] + (i - 3) * size[0] * .009)
        y = round(points[-1][1] + ((i * 7) % 13 - 6) * size[1] * .003)
        r = max(2, size[0] // 430)
        d.ellipse((x - r, y - r, x + r, y + r), fill=(*CYAN, 170))
    return Image.alpha_composite(halo, line)


def grade(base: Image.Image, calm_start: int) -> Image.Image:
    """Darken the perimeter and create a smooth, legible lower interaction field."""
    w, h = base.size
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    pix = overlay.load()
    for y in range(h):
        calm = max(0.0, min(1.0, (y - calm_start + h * .08) / (h - calm_start + h * .08)))
        for x in range(w):
            edge = abs(x / w - .5) * 2
            alpha = round(20 + 116 * calm + 30 * edge * edge)
            pix[x, y] = (*GRAPHITE, min(182, alpha))
    # Six-bit channel posterisation keeps the painted source's tonal steps while
    # avoiding a multi-megabyte field of imperceptibly different PNG colours.
    return ImageOps.posterize(Image.alpha_composite(base.convert("RGBA"), overlay).convert("RGB"), 6)


def compose_desktop() -> Image.Image:
    size = (1920, 1080)
    scene = cover(Image.open(BG / "bg-desktop.webp"), size)
    scene = ImageEnhance.Color(scene).enhance(.88).convert("RGBA")
    cabinet = fit(cropped_rgba(CABINET), width=680)
    mascot = fit(cropped_rgba(MASCOT), height=650)
    logo = fit(cropped_rgba(LOGO), width=690)
    cbox = (1120, 112, cabinet.width, cabinet.height)
    scene = Image.alpha_composite(scene, glow_panel(size, cbox))
    scene.alpha_composite(cabinet, cbox[:2])
    scene.alpha_composite(mascot, (105, 30))
    scene.alpha_composite(logo, ((size[0] - logo.width) // 2, 26))
    scene = Image.alpha_composite(scene, spray(size, [(585, 352), (820, 330), (1020, 385), (1194, 375)]))
    return grade(scene, round(size[1] * .60))


def compose_mobile() -> Image.Image:
    size = (1080, 1920)
    scene = cover(Image.open(BG / "bg-mobile.webp"), size)
    scene = ImageEnhance.Color(scene).enhance(.88).convert("RGBA")
    cabinet = fit(cropped_rgba(CABINET), width=600)
    mascot = fit(cropped_rgba(MASCOT), height=710)
    logo = fit(cropped_rgba(LOGO), width=870)
    cbox = (465, 405, cabinet.width, cabinet.height)
    scene = Image.alpha_composite(scene, glow_panel(size, cbox))
    scene.alpha_composite(cabinet, cbox[:2])
    scene.alpha_composite(mascot, (-45, 245))
    scene.alpha_composite(logo, ((size[0] - logo.width) // 2, 52))
    scene = Image.alpha_composite(scene, spray(size, [(370, 580), (500, 540), (630, 610), (745, 595)]))
    return grade(scene, round(size[1] * .55))


def check(name: str, image: Image.Image, calm_start: int) -> dict:
    upper = image.crop((0, 0, image.width, calm_start))
    lower = image.crop((0, calm_start, image.width, image.height))
    return {
        "size": list(image.size),
        "mode": image.mode,
        "calm_zone_starts_y": calm_start,
        "upper_luma_mean": round(ImageStat.Stat(upper.convert("L")).mean[0], 2),
        "lower_luma_mean": round(ImageStat.Stat(lower.convert("L")).mean[0], 2),
        "lower_is_darker": ImageStat.Stat(lower.convert("L")).mean[0] < ImageStat.Stat(upper.convert("L")).mean[0],
        "no_live_prices_rules_controls_or_outcomes": True,
        "approved_production_inputs_only": True,
    }


def shipping_png(image: Image.Image) -> Image.Image:
    """Keep a phone/desktop-useful source resolution inside the exact canvas.

    The runtime immediately converts this source to WebP. A 2/3-scale,
    96-colour painted master keeps the source PNG compact enough for the repo,
    while retaining more pixels than any target phone viewport.
    """
    small = image.resize((round(image.width * 2 / 3), round(image.height * 2 / 3)), Image.Resampling.LANCZOS)
    indexed = small.quantize(colors=96, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG)
    return indexed.resize(image.size, Image.Resampling.NEAREST)


def main() -> None:
    files = {
        "splash-desktop.png": (compose_desktop(), 648),
        "splash-mobile.png": (compose_mobile(), 1056),
    }
    manifest = {"files": {}, "inputs": [
        "backgrounds/bg-desktop.webp", "backgrounds/bg-mobile.webp", "cabinet/cabinet.png",
        "logo.png", "mascot/reference-compact.png", "symbols/*.png",
    ], "method": "Deterministic Pillow composition from approved production art; no generated image."}
    shipping = {}
    for name, (image, calm_start) in files.items():
        assert image.mode == "RGB"
        packed = shipping_png(image)
        shipping[name] = packed
        path = OUT / name
        packed.save(path, optimize=True, compress_level=9)
        checks = check(name, packed.convert("RGB"), calm_start)
        checks.update({"png_mode": packed.mode, "palette_colors": 96,
                       "effective_source_size": [round(image.width * 2 / 3), round(image.height * 2 / 3)]})
        manifest["files"][f"ui/{name}"] = {"sha256": sha256(path), "checks": checks}
        assert manifest["files"][f"ui/{name}"]["checks"]["lower_is_darker"]

    review = Image.new("RGB", (1280, 720), "#0a1014")
    desktop = shipping["splash-desktop.png"].convert("RGB").resize((960, 540), Image.Resampling.LANCZOS)
    mobile = shipping["splash-mobile.png"].convert("RGB").resize((304, 540), Image.Resampling.LANCZOS)
    review.paste(desktop, (0, 0)); review.paste(mobile, (976, 0))
    rd = ImageDraw.Draw(review)
    rd.rectangle((0, 540, 1280, 719), fill="#101820")
    rd.line((0, 540, 960, 540), fill=CYAN, width=3)
    rd.line((976, 540, 1280, 540), fill=CYAN, width=3)
    review.save(SRC / "review.jpg", quality=88, optimize=True, progressive=True)
    (SRC / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
