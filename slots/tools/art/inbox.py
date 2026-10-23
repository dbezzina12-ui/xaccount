#!/usr/bin/env python3
"""Sort an unnamed art drop. Dylan uploads ChatGPT's downloads (any file
names) to games/<id>/art/inbox/; Claude looks at the contact sheet, then
places each image under its spec name.

  python3 tools/art/inbox.py games/game-001                  # numbered contact sheet
  python3 tools/art/inbox.py games/game-001 --place 1=symbols/H1.png 2=bg-base.png
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

EXT = {".png", ".jpg", ".jpeg", ".webp"}


def listing(inbox):
    return sorted(p for p in inbox.iterdir() if p.suffix.lower() in EXT and not p.name.startswith("_"))


def sheet(files, out):
    tile = 256
    cols = min(6, max(1, len(files)))
    rows = (len(files) + cols - 1) // cols
    img = Image.new("RGB", (cols * tile, rows * (tile + 22)), (24, 20, 36))
    d = ImageDraw.Draw(img)
    for i, f in enumerate(files):
        with Image.open(f) as im:
            im = im.convert("RGBA")
            im.thumbnail((tile - 8, tile - 8))
            # checkerboard behind so transparency is visible
            bg = Image.new("RGBA", (tile - 8, tile - 8), (60, 60, 70, 255))
            cd = ImageDraw.Draw(bg)
            for y in range(0, tile, 16):
                for x in range(0, tile, 16):
                    if (x // 16 + y // 16) % 2:
                        cd.rectangle((x, y, x + 15, y + 15), fill=(90, 90, 100, 255))
            bg.alpha_composite(im, ((tile - 8 - im.width) // 2, (tile - 8 - im.height) // 2))
            x, y = (i % cols) * tile, (i // cols) * (tile + 22)
            img.paste(bg.convert("RGB"), (x + 4, y + 4))
            d.text((x + 6, y + tile + 4), f"{i + 1}: {f.name[:34]}", fill=(255, 220, 120))
    img.save(out, quality=88)


def place(art, files, pairs):
    for pair in pairs:
        n, target = pair.split("=", 1)
        src = files[int(n) - 1]
        dst = art / target
        dst.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(src) as im:
            im = im.convert("RGBA") if (im.mode in ("RGBA", "LA", "P") or "transparency" in im.info) else im.convert("RGB")
            im.save(dst.with_suffix(".png"))
        src.unlink()
        print(f"{n}: {src.name} → {dst.relative_to(art)}")


def main():
    game = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("games/game-001")
    art = game / "art"
    inbox = art / "inbox"
    inbox.mkdir(parents=True, exist_ok=True)
    files = listing(inbox)
    if "--place" in sys.argv:
        place(art, files, sys.argv[sys.argv.index("--place") + 1 :])
        return
    if not files:
        print(f"inbox empty: {inbox}")
        return
    out = inbox / "_sheet.jpg"
    sheet(files, out)
    for i, f in enumerate(files):
        with Image.open(f) as im:
            print(f"{i + 1:3}: {f.name}  {im.size[0]}×{im.size[1]} {im.mode}")
    print(f"contact sheet → {out}")


if __name__ == "__main__":
    main()
