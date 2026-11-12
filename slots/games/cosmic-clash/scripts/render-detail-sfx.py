"""Render original Cosmic Clash detail effects. No third-party samples.

Run from the repository root. Requires NumPy, SciPy and ffmpeg.
The approved shooting, VS landing and music files are never opened for writing.
"""
from pathlib import Path
import hashlib
import json
import subprocess
import tempfile

import numpy as np
from scipy import signal
from scipy.io import wavfile

RATE = 48000
OUT = Path(__file__).resolve().parents[1] / "dist/assets/audio/sfx/detail-v103"
OUT.mkdir(parents=True, exist_ok=True)
reports = []


def clock(seconds):
    return np.arange(round(seconds * RATE)) / RATE


def envelope(t, decay, attack=.0015):
    return (1 - np.exp(-t / attack)) * np.exp(-t / decay)


def noise(t, rng, low=250, high=6000):
    sos = signal.butter(2, [low, high], fs=RATE, btype="bandpass", output="sos")
    x = signal.sosfilt(sos, rng.normal(size=len(t)))
    return x / max(.1, np.std(x))


def sweep(t, start, end, seconds):
    # Exponential pitch fall; short enough to read as weight, not a melody.
    k = np.log(end / start) / seconds
    return np.sin(2 * np.pi * start * np.expm1(k * t) / k)


def metal(t, rng, fundamental=410, decay=.07):
    # Inharmonic resonances, excited by a soft contact transient.
    result = np.zeros_like(t)
    for i, ratio in enumerate([1, 1.51, 2.17, 3.63, 5.04]):
        result += (.48 / (1 + i)) * np.sin(2 * np.pi * fundamental * ratio * t) * envelope(t, decay / (1 + i * .4))
    return result + .17 * noise(t, rng, 900, 6500) * envelope(t, .009, .0005)


def place(target, source, seconds, gain=1):
    start = round(seconds * RATE)
    length = min(len(source), len(target) - start)
    if length > 0:
        target[start:start + length] += source[:length] * gain


def export(name, mono, description, width=.1):
    # Restrained early reflections are printed into these effects; runtime sends
    # them dry, avoiding the older long shared reverb on frequent interface cues.
    mono = signal.sosfilt(signal.butter(2, 40, btype="highpass", fs=RATE, output="sos"), mono)
    stereo = np.column_stack([mono, mono])
    for channel, taps in enumerate([[(.017, width), (.043, width * .4)], [(.023, width), (.051, width * .4)]]):
        for delay, gain in taps:
            place(stereo[:, channel], mono, delay, gain)
    stereo = np.tanh(stereo * 1.15)
    stereo *= .72 / max(.001, np.max(np.abs(stereo)))
    # Explicit click-free endpoints. Leave headroom for MP3 reconstruction.
    fade = min(round(.025 * RATE), len(stereo) // 4)
    stereo[-fade:] *= np.linspace(1, 0, fade)[:, None]
    stereo[:48] *= np.linspace(0, 1, 48)[:, None]
    with tempfile.TemporaryDirectory() as temp:
        wav = Path(temp) / "effect.wav"
        wavfile.write(wav, RATE, stereo.astype(np.float32))
        path = OUT / f"{name}.mp3"
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(wav), "-c:a", "libmp3lame", "-b:a", "192k", "-map_metadata", "-1", str(path)], check=True)
        decoded = np.frombuffer(subprocess.check_output(["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "2", "-"]), dtype="<f4")
    peak = float(np.max(np.abs(decoded)))
    if not np.all(np.isfinite(decoded)) or peak >= .95:
        raise ValueError(f"Invalid or overloaded render: {name}")
    reports.append(dict(name=name, description=description, seconds=round(len(mono) / RATE, 3), peakDB=round(float(20 * np.log10(peak)), 2), rmsDB=round(float(20 * np.log10(np.sqrt(np.mean(decoded ** 2)))), 2), sha256=hashlib.sha256(path.read_bytes()).hexdigest()))


for variant in range(3):
    rng = np.random.default_rng(410 + variant)
    t = clock(.34)
    x = .44 * sweep(t, 155 + variant * 5, 63, .16) * envelope(t, .038)
    x += .24 * metal(t, rng, 465 + variant * 21, .047)
    x += .11 * noise(t, rng, 300, 3400) * envelope(t, .021)
    place(x, metal(t, rng, 670 + variant * 27, .022), .027, .09)
    export(f"reel-stop-{variant + 1}", x, "Short weighted reel latch, three alternating mechanical takes", width=.055)

rng = np.random.default_rng(500)
t = clock(.59)
x = .34 * sweep(t, 132, 54, .19) * envelope(t, .055)
x += .21 * metal(t, rng, 330, .06)
x += .12 * noise(t, rng, 420, 3600) * np.sin(np.pi * np.minimum(t / .48, 1)) ** 2 * np.exp(-t / .3)
for delay in [.029, .062, .105]:
    place(x, metal(t, rng, 620, .025), delay, .07)
export("spin-engage", x, "Mechanical engagement, low body and brief filtered servo movement")

rng = np.random.default_rng(600)
t = clock(.15)
x = .26 * metal(t, rng, 720, .017)
x += .24 * np.sin(2 * np.pi * 175 * t) * envelope(t, .011, .0007)
export("ui-confirm", x, "Restrained dry control detent", width=.025)

rng = np.random.default_rng(700)
t = clock(.94)
x = .36 * sweep(t, 125, 47, .33) * envelope(t, .095)
x += .2 * metal(t, rng, 420, .13)
x += .08 * noise(t, rng, 900, 6400) * envelope(t, .08, .008)
for i, frequency in enumerate([587.33, 880, 1174.66]):
    tone = np.sin(2 * np.pi * frequency * t + .5 * np.sin(2 * np.pi * frequency * 1.41 * t) * np.exp(-t / .04))
    place(x, tone * envelope(t, .14, .003), i * .048, .11 - i * .015)
place(x, metal(t, rng, 850, .055), .15, .09)
export("god-boost", x, "God Mode multiplier impact, rising energy partials and short crystal decay", width=.18)

rng = np.random.default_rng(800)
t = clock(1.04)
x = .46 * sweep(t, 116, 43, .4) * envelope(t, .13, .003)
x += .25 * metal(t, rng, 285, .11)
x += .1 * noise(t, rng, 700, 4700) * envelope(t, .1)
place(x, metal(t, rng, 420, .08), .105, .2)
place(x, noise(t, rng, 500, 3000) * envelope(t, .1, .025), .17, .06)
export("crossfire-arm", x, "Crossfire title impact, two metallic arming latches and a short pneumatic release", width=.17)

# The same struck-coin timbre travels in opposite pitch directions. These are
# separate forward-playing phrases, not a reversed waveform with soft attacks.
for direction, pitches in [("up", [739.99, 987.77, 1174.66, 1479.98]), ("down", [1479.98, 1174.66, 987.77, 739.99])]:
    rng = np.random.default_rng(900)
    t = clock(.67)
    x = np.zeros_like(t)
    for i, frequency in enumerate(pitches):
        coin = np.zeros_like(t)
        for ratio, level, decay in [(1, .34, .09), (2.68, .075, .033), (4.17, .022, .014)]:
            coin += level * np.sin(2 * np.pi * frequency * ratio * t) * envelope(t, decay, .0006)
        coin += .022 * noise(t, rng, 2400, 8500) * envelope(t, .004, .0003)
        place(x, coin, [0, .065, .137, .215][i], .83 + i * .055)
    export(f"coin-{direction}", x, f"Four crisp metallic coin strikes stepping {direction} for the winning duel value", width=.085)

(OUT / "credits.json").write_text(json.dumps({"source": "Original deterministic synthesis; scripts/render-detail-sfx.py", "externalSamples": False, "sampleRate": RATE, "files": reports}, indent=2) + "\n")
print(json.dumps(reports, indent=2))
