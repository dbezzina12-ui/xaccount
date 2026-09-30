"""Proportion parameters.

`height` is the absolute crown height in metres. Every other parameter is a relative
multiplier (1.0 = master blank). Proportions are applied first, then the whole
character (skeleton + mesh) is uniformly rescaled so the crown lands at `height`.
Changing a parameter is a *character-creation* operation: it regenerates rest
skeleton, cage, mesh and weights together. It is never an animation effect.
"""

DEFAULTS = {
    "height": 1.75,
    "headSize": 1.0,
    "shoulderWidth": 1.0,
    "torsoWidth": 1.0,
    "torsoDepth": 1.0,
    "bellySize": 1.0,
    "armLength": 1.0,
    "legLength": 1.0,
    "handSize": 1.0,
    "footSize": 1.0,
}

RANGES = {
    "height": (1.2, 2.3),
    "headSize": (0.8, 1.35),
    "shoulderWidth": (0.8, 1.3),
    "torsoWidth": (0.8, 1.4),
    "torsoDepth": (0.8, 1.4),
    "bellySize": (0.6, 2.2),
    "armLength": (0.85, 1.15),
    "legLength": (0.8, 1.2),
    "handSize": (0.85, 1.3),
    "footSize": (0.85, 1.3),
}

DESCRIPTIONS = {
    "height": "Absolute crown height in metres (whole character is rescaled to hit it).",
    "headSize": "Head scale relative to the body (cartoon head exaggeration).",
    "shoulderWidth": "Clavicle length / acromion spread; moves shoulder joints.",
    "torsoWidth": "Chest, waist and hip width; also drives derived limb girth.",
    "torsoDepth": "Chest and back depth; also drives derived limb girth.",
    "bellySize": "Lower-front torso volume (1 = neutral, <1 flatter, >1 rounder).",
    "armLength": "Upper arm + forearm bone lengths.",
    "legLength": "Thigh + shin bone lengths.",
    "handSize": "Palm and finger dimensions (bones and mesh).",
    "footSize": "Foot length/width (bones and mesh).",
}


def resolve(p=None):
    out = dict(DEFAULTS)
    for k, v in (p or {}).items():
        if k not in DEFAULTS:
            raise ValueError(f"unknown proportion parameter: {k}")
        lo, hi = RANGES[k]
        v = float(v)
        if not (lo <= v <= hi):
            raise ValueError(f"{k}={v} outside supported range [{lo}, {hi}]")
        out[k] = v
    return out


def girth(p):
    """Derived limb girth factor (not a free parameter): follows torso bulk mildly."""
    return (p["torsoWidth"] * p["torsoDepth"]) ** 0.35
