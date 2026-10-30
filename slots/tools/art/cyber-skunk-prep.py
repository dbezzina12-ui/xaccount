#!/usr/bin/env python3
"""Cyber Skunk art prep: ChatGPT's files (ART_SPEC.md names) into the game.

  python3 tools/art/cyber-skunk-prep.py            # convert what is there, report the rest
  python3 tools/art/cyber-skunk-prep.py --check    # report only, write nothing
  (--art DIR / --out DIR read and write elsewhere, for tests)

Finds each ART_SPEC file by name anywhere under games/cyber-skunk/art/
(inbox/, symbols/, mascot/, ...; .png, .webp or .jpg), checks its size and
transparency, and writes WebP into games/cyber-skunk/runtime/assets/:

  symbols/  ui/  bg/  panels/  cards/   the file as specified, resized if larger
  mascot/   each layer trimmed to its pixels (plus a margin) at half scale, and
            layers.json: where each trimmed layer sits on the 1600 x 2000 canvas,
            so the rig draws small images instead of 25 full canvases

Writes games/cyber-skunk/art/REPORT.md. Needs Pillow.
"""
import json
import sys
from pathlib import Path

from PIL import Image

GAME = Path(__file__).resolve().parents[2] / "games" / "cyber-skunk"
def _arg(flag, default):
    return Path(sys.argv[sys.argv.index(flag) + 1]).resolve() if flag in sys.argv else default
ART, OUT = _arg("--art", GAME / "art"), _arg("--out", GAME / "runtime" / "assets")
PIVOTS = json.loads((GAME / "art" / "rig" / "pivots.json").read_text())

# name: (folder, (width, height), needs transparency, webp quality)
SPEC = {}
for n in ["h1-battery", "h2-rotor", "h3-canister", "h4-key", "a", "k", "q", "j", "ten", "wild", "scatter-plate", "scatter-letters", "vent"]:
    SPEC[n] = ("symbols", (512, 512), True, 90)
SPEC.update({
    "cabinet": ("ui", (1440, 1060), True, 90),
    "gauge-face": ("ui", (400, 400), True, 90),
    "gauge-needle": ("ui", (400, 400), True, 92),
    "pipes-top": ("ui", (1440, 300), True, 88),
    "logo": ("ui", (1600, 560), True, 90),
    "bg-desktop": ("bg", (2560, 1440), False, 80),
    "bg-mobile": ("bg", (1440, 2560), False, 80),
    "bg-bonus-desktop": ("bg", (2560, 1440), False, 80),
    "bg-bonus-mobile": ("bg", (1440, 2560), False, 80),
    "panel-vent-break": ("panels", (1600, 900), True, 88),
    "panel-overpressure": ("panels", (1600, 900), True, 88),
    "panel-blackout": ("panels", (1600, 900), True, 88),
    "card-signal-boost": ("cards", (720, 480), False, 85),
    "card-spray-job": ("cards", (720, 480), False, 85),
    "card-vent-break": ("cards", (720, 480), False, 85),
    "card-overpressure": ("cards", (720, 480), False, 85),
    # v3: win titles, effects, intro, controller texture, icon
    "win-nice": ("wins", (1600, 560), True, 90),
    "win-big": ("wins", (1600, 560), True, 90),
    "win-epic": ("wins", (1600, 560), True, 90),
    "win-mythic": ("wins", (1600, 560), True, 90),
    "win-max": ("wins", (1600, 560), True, 90),
    "banner-extra-spins": ("wins", (1200, 360), True, 90),
    "title-total-win": ("wins", (1200, 360), True, 90),
    "fx-splat": ("fx", (512, 512), True, 88),
    "badge-pressure": ("fx", (256, 160), True, 92),
    "vent-online": ("fx", (512, 512), True, 88),
    "fx-mist": ("fx", (256, 256), True, 85),
    "fx-droplet": ("fx", (64, 64), True, 92),
    "fx-spark": ("fx", (128, 128), True, 90),
    "fx-steam": ("fx", (512, 512), True, 85),
    "splash-desktop": ("ui", (1920, 1080), False, 82),
    "splash-mobile": ("ui", (1080, 1920), False, 82),
    "intro-route": ("ui", (900, 600), False, 88),
    "intro-bonuses": ("ui", (900, 600), False, 88),
    "controller-texture": ("ui", (512, 512), False, 85),
    "icon": ("ui", (512, 512), False, 92),
})
LAYERS = list(PIVOTS["parts"].keys())
CANVAS = tuple(PIVOTS["canvas"])
MASCOT_SCALE, MARGIN = 0.5, 6


def find(name):
    """The newest file called <name>.png/.webp/.jpg under art/ (not rig/ or source/)."""
    hits = [p for ext in ("png", "webp", "jpg", "jpeg") for p in ART.rglob(f"{name}.{ext}")
            if "rig" not in p.relative_to(ART).parts[:1] and "source" not in p.relative_to(ART).parts[:1]]
    return max(hits, key=lambda p: p.stat().st_mtime) if hits else None


def rel(p):
    try:
        return p.relative_to(GAME)
    except ValueError:
        return p


def has_alpha(im):
    if im.mode not in ("RGBA", "LA", "PA"):
        return False
    lo, _ = im.getchannel("A").getextrema()
    return lo < 255


def prep_asset(name, check, notes):
    folder, size, alpha, quality = SPEC[name]
    src = find(name)
    if not src:
        return "missing"
    im = Image.open(src)
    im.load()
    problems = []
    if im.size != size:
        ratio = (im.size[0] / im.size[1]) / (size[0] / size[1])
        problems.append(f"{im.size[0]}x{im.size[1]}, spec {size[0]}x{size[1]}" + ("" if abs(ratio - 1) < 0.01 else " (different shape: fitted, not stretched)"))
    if alpha and not has_alpha(im):
        problems.append("no transparency (spec: transparent)")
    if not check:
        im = im.convert("RGBA" if alpha else "RGB")
        if im.size != size:
            # Fit inside the spec size, centred: never stretch.
            fitted = Image.new(im.mode, size, (0, 0, 0, 0) if alpha else (16, 24, 32))
            scale = min(size[0] / im.size[0], size[1] / im.size[1])
            scaled = im.resize((max(1, round(im.size[0] * scale)), max(1, round(im.size[1] * scale))), Image.LANCZOS)
            fitted.paste(scaled, ((size[0] - scaled.size[0]) // 2, (size[1] - scaled.size[1]) // 2))
            im = fitted
        dest = OUT / folder / f"{name}.webp"
        dest.parent.mkdir(parents=True, exist_ok=True)
        im.save(dest, "WEBP", quality=quality, method=6)
    notes.append((name, rel(src), problems))
    return "warn" if problems else "ok"


def prep_mascot(check, notes):
    found = {n: find(n) for n in LAYERS}
    boxes, status = {}, {}
    for name, src in found.items():
        if not src:
            status[name] = "missing"
            continue
        im = Image.open(src).convert("RGBA")
        problems = []
        if im.size != CANVAS:
            problems.append(f"{im.size[0]}x{im.size[1]}, every layer must be {CANVAS[0]}x{CANVAS[1]}, drawn in place")
        bbox = im.getchannel("A").getbbox()
        if not bbox:
            problems.append("empty layer")
            status[name] = "warn"
            notes.append((name, rel(src), problems))
            continue
        x0, y0, x1, y1 = bbox
        x0, y0, x1, y1 = max(0, x0 - MARGIN), max(0, y0 - MARGIN), min(im.size[0], x1 + MARGIN), min(im.size[1], y1 + MARGIN)
        # The part must cover its own pivot (the joint it turns about), except the occluders and lids.
        px, py = PIVOTS["parts"][name]["pivot"]
        if name not in ("eyelids", "goggles", "near-cuff", "near-pauldron") and im.size == CANVAS:
            a = im.getchannel("A").getpixel((min(px, im.size[0] - 1), min(py, im.size[1] - 1)))
            if a < 128:
                problems.append(f"transparent at its pivot ({px}, {py}): the joint would show a gap")
        if not check and im.size == CANVAS:
            crop = im.crop((x0, y0, x1, y1))
            w, h = max(1, round(crop.size[0] * MASCOT_SCALE)), max(1, round(crop.size[1] * MASCOT_SCALE))
            dest = OUT / "mascot" / f"{name}.webp"
            dest.parent.mkdir(parents=True, exist_ok=True)
            crop.resize((w, h), Image.LANCZOS).save(dest, "WEBP", quality=90, method=6)
            boxes[name] = {"x": x0, "y": y0, "w": x1 - x0, "h": y1 - y0, "file": f"{name}.webp"}
        status[name] = "warn" if problems else "ok"
        notes.append((name, rel(src), problems))
    if not check:
        (OUT / "mascot").mkdir(parents=True, exist_ok=True)
        # The game uses painted layers only when all 25 are in; until then the vector rig plays.
        (OUT / "mascot" / "layers.json").write_text(json.dumps(boxes, indent=1) + "\n")
    return status


def main():
    check = "--check" in sys.argv
    notes = []
    status = {name: prep_asset(name, check, notes) for name in SPEC}
    mascot = prep_mascot(check, notes)
    lines = ["# Cyber Skunk art report (generated by tools/art/cyber-skunk-prep.py)", ""]
    for title, group in [("Mascot layers (1600 x 2000, drawn in place)", mascot), ("Symbols, cabinet, backgrounds, panels, cards", status)]:
        done = [n for n, s in group.items() if s != "missing"]
        lines += [f"## {title}: {len(done)} of {len(group)} in", ""]
        lines += [f"- missing: {', '.join(n for n, s in group.items() if s == 'missing') or 'none'}", ""]
    issues = [(n, src, p) for n, src, p in notes if p]
    lines += ["## Problems", ""] + ([f"- `{src}`: {'; '.join(p)}" for n, src, p in issues] or ["- none"]) + [""]
    if not check:
        (ART / "REPORT.md").write_text("\n".join(lines))
    print("\n".join(lines))


if __name__ == "__main__":
    main()
