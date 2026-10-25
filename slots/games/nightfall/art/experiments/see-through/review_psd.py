"""Export See-through PSD layers in place and compare with the submitted image.

No retouching or model inference is performed. Upscaled exports are registration
conveniences, not additional image detail. Normal, opaque pixel layers only.
"""
import argparse
import json
import re
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from psd_tools import PSDImage


def backdrop(size, color=(238, 238, 238, 255)):
    image = Image.new("RGBA", size, color)
    draw = ImageDraw.Draw(image)
    for y in range(0, size[1], 24):
        for x in range(0, size[0], 24):
            if (x // 24 + y // 24) % 2:
                draw.rectangle((x, y, x + 23, y + 23), fill=(208, 208, 208, 255))
    return image


def restore_canvas(image, width, height):
    side = max(width, height)
    square = image.resize((side, side), Image.Resampling.LANCZOS)
    left, top = (side - width) // 2, (side - height) // 2
    return square.crop((left, top, left + width, top + height))


def review(psd_path, source_path, out):
    out.mkdir(parents=True, exist_ok=True)
    (out / "layers-native").mkdir(exist_ok=True)
    (out / "layers-registered").mkdir(exist_ok=True)
    psd = PSDImage.open(psd_path)
    source = Image.open(source_path).convert("RGBA")
    if psd.width != psd.height:
        raise ValueError("Expected square See-through inference canvas; inspect geometry manually.")
    assembled = Image.new("RGBA", psd.size)
    layers, previews = [], []
    for index, layer in enumerate(psd):
        if layer.is_group() or layer.opacity != 255 or layer.blend_mode.value != b"norm":
            raise ValueError(f"Unsupported compositing for {layer.name}: inspect in PSD editor.")
        pixels = layer.topil().convert("RGBA")
        full = Image.new("RGBA", psd.size)
        full.alpha_composite(pixels, (layer.left, layer.top))
        filename = f"{index:02d}-" + re.sub(r"[^a-zA-Z0-9_-]+", "-", layer.name) + ".png"
        full.save(out / "layers-native" / filename)
        restore_canvas(full, *source.size).save(out / "layers-registered" / filename)
        if layer.visible:
            assembled.alpha_composite(full)
        alpha = np.asarray(full.getchannel("A"))
        layers.append({"name": layer.name, "file": filename, "visible": layer.visible,
                       "bbox": list(layer.bbox), "nontransparent_pixels": int((alpha > 0).sum()),
                       "opaque_pixels": int((alpha > 250).sum())})
        previews.append((layer.name, full))
    assembled.save(out / "assembled-native.png")
    registered = restore_canvas(assembled, *source.size)
    registered.save(out / "assembled-registered.png")

    side = max(source.size)
    reference_square = Image.new("RGBA", (side, side), "white")
    reference_square.alpha_composite(source, ((side-source.width)//2, (side-source.height)//2))
    reference = reference_square.resize(psd.size, Image.Resampling.LANCZOS).convert("RGB")
    composite_white = Image.new("RGBA", psd.size, "white")
    composite_white.alpha_composite(assembled)
    delta = np.abs(np.asarray(reference, dtype=np.float32) - np.asarray(composite_white.convert("RGB"), dtype=np.float32))
    mask = np.min(np.asarray(reference), axis=2) < 245
    heat = Image.fromarray(np.uint8(np.clip(delta * 4, 0, 255)))
    heat.save(out / "difference-4x.png")

    tiles = [("Submitted draft", reference), ("See-through assembled", assembled), ("Difference x4", heat)] + previews
    cols, tw, th = 4, 320, 364
    sheet = Image.new("RGB", (cols * tw, ((len(tiles)+cols-1)//cols) * th), "#17202b")
    draw = ImageDraw.Draw(sheet)
    for i, (label, picture) in enumerate(tiles):
        x, y = (i % cols) * tw, (i // cols) * th
        tile = backdrop((tw-16, th-52))
        thumb = picture.convert("RGBA")
        thumb.thumbnail(tile.size, Image.Resampling.LANCZOS)
        tile.alpha_composite(thumb, ((tile.width-thumb.width)//2, (tile.height-thumb.height)//2))
        sheet.paste(tile.convert("RGB"), (x+8, y+36))
        draw.text((x+10, y+10), label[:42], fill="white")
    sheet.save(out / "contact-sheet.jpg", quality=92)
    report = {"status": "EXPERIMENT_ONLY_NOT_RUNTIME_APPROVED", "source_size": list(source.size),
              "inference_size": list(psd.size), "layer_count": len(layers), "layers": layers,
              "mean_rgb_absolute_error": float(delta.mean()),
              "foreground_mean_rgb_absolute_error": float(delta[mask].mean()),
              "foreground_fraction_max_channel_error_over_30": float((delta.max(axis=2)[mask] > 30).mean()),
              "registration": "Inverse square padding and resize only; original detail is not restored.",
              "metrics_note": "Raster comparison uses PIL resampling, while upstream uses OpenCV; minor interpolation differences are included."}
    (out / "review.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({k: v for k,v in report.items() if k != "layers"}, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("psd", type=Path)
    parser.add_argument("source", type=Path)
    parser.add_argument("out", type=Path)
    args = parser.parse_args()
    review(args.psd, args.source, args.out)
