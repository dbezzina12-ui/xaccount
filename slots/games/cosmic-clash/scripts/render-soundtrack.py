"""Original Bounty Breakers chiptune / dubstep score, rendered offline.

Requires Python + NumPy + SciPy and ffmpeg. All instruments are synthesized;
there are no samples, external recordings, vocals, or borrowed melodies.
The browser plays the finished tracks rather than running this synthesizer.
"""
from pathlib import Path
import hashlib
import json
import math
import subprocess
import tempfile

import numpy as np
from scipy import signal
from scipy.io import wavfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'dist/assets/audio'
SR = 44100
BPM = 140
BEAT = 60 / BPM
BARS = 32
FRAMES = round(BARS * 4 * BEAT * SR)
RNG = np.random.default_rng(9021026)


def freq(note):
    return 440 * 2 ** ((note - 69) / 12)


def timebase(seconds):
    return np.arange(max(1, round(seconds * SR))) / SR


def envelope(t, attack=.004, release=.03, decay=None):
    length = len(t) / SR
    env = np.minimum(1, t / attack) * np.minimum(1, np.maximum(0, length - t) / release)
    if decay:
        env *= np.exp(-t / decay)
    return env


def filtered_noise(t, low, high):
    noise = RNG.standard_normal(len(t))
    sos = signal.butter(2, [low, high], btype='bandpass', fs=SR, output='sos')
    return signal.sosfilt(sos, noise)


def pulse(t, frequency, duty=.25):
    # A finite Fourier series keeps the chip timbre without aliasing.
    result = np.zeros(len(t))
    for harmonic in range(1, min(24, int(14000 / frequency)) + 1):
        amplitude = 2 * math.sin(math.pi * harmonic * duty) / (math.pi * harmonic)
        result += amplitude * np.cos(2 * math.pi * harmonic * frequency * t - math.pi * harmonic * duty)
    return result


def chip(note, beats, bright=False):
    t = timebase(beats * BEAT)
    f = freq(note)
    x = pulse(t + .0008 * np.sin(2 * np.pi * 5.5 * t), f, .25 if bright else .375)
    # Small amplitude steps provide the 8-bit texture; the mix stays high fidelity.
    x = np.round(x * 63) / 63
    return x * envelope(t, .003, .032, max(.14, beats * BEAT * .7))


def kick():
    t = timebase(.48)
    phase = 2 * np.pi * (49 * t + 110 * .028 * (1 - np.exp(-t / .028)))
    body = np.sin(phase) * np.exp(-t / .12)
    click = filtered_noise(t, 1400, 6500) * np.exp(-t / .007) * .19
    return np.tanh((body + click) * 1.45) * envelope(t, .001, .03)


def snare():
    t = timebase(.34)
    noise = filtered_noise(t, 1100, 10000)
    clap = sum(np.exp(-np.maximum(0, t - delay) / .035) * (t >= delay)
               for delay in [0, .012, .024])
    body = (.30 * np.sin(2 * np.pi * 185 * t) + .12 * np.sin(2 * np.pi * 330 * t)) * np.exp(-t / .07)
    snap = noise * (.40 * np.exp(-t / .085) + .16 * clap)
    return np.tanh((body + snap) * 1.2) * envelope(t, .001, .025)


def hat(opened=False):
    t = timebase(.27 if opened else .09)
    metallic = sum(np.sin(2 * np.pi * f * t) for f in [6301, 7919, 8873, 10331]) / 5
    x = filtered_noise(t, 5500, 15000) * .75 + metallic * .1
    return x * envelope(t, .001, .015, .095 if opened else .018)


def bass(note, beats, rate, intensity):
    t = timebase(beats * BEAT)
    f = freq(note)
    wobble = (.5 - .5 * np.cos(2 * np.pi * rate * t / BEAT)) ** .75
    cutoff = 180 + (950 + 1400 * intensity) * wobble
    x = np.zeros(len(t))
    for h in range(1, 30):
        rolloff = 1 / np.sqrt(1 + (h * f / cutoff) ** 6)
        vowel = 1 + .8 * np.exp(-.5 * ((h * f - (450 + wobble * 500)) / 180) ** 2)
        amplitude = (1 if h % 2 else .45) / h
        x += amplitude * rolloff * vowel * np.sin(2 * np.pi * h * f * t + .025 * h * np.sin(2 * np.pi * .7 * t))
    x = np.tanh(x * (1.15 + intensity * .5))
    x = signal.sosfilt(signal.butter(2, 85, btype='highpass', fs=SR, output='sos'), x)
    return x * envelope(t, .008, .045) * (.38 + .62 * wobble)


def sub(note, beats):
    t = timebase(beats * BEAT)
    f = freq(note - 12)
    if f < 35:
        f *= 2
    x = np.sin(2 * np.pi * f * t) + .15 * np.sin(2 * np.pi * f * 2 * t)
    return x * envelope(t, .013, .055)


def pad(chord, beats):
    t = timebase(beats * BEAT + .22)
    x = np.zeros(len(t))
    for note in chord:
        f = freq(note)
        for detune in [-.0015, .0015]:
            for harmonic, gain in [(1, 1), (2, .16), (3, .10)]:
                x += gain * np.sin(2 * np.pi * f * (1 + detune) * harmonic * t) / 6
    return x * envelope(t, .10, .27)


def add(bus, sample, beat, gain, pan=0):
    start = round(beat * BEAT * SR) % FRAMES
    x = sample[:, None] * gain * np.array([math.cos((pan + 1) * math.pi / 4), math.sin((pan + 1) * math.pi / 4)])
    size = min(len(x), FRAMES)
    first = min(size, FRAMES - start)
    bus[start:start + first] += x[:first]
    if first < size:
        bus[:size - first] += x[first:size]


def pingpong(bus, gain=.23):
    result = bus.copy()
    for echo in range(1, 4):
        delayed = np.roll(bus, round(BEAT * .75 * SR * echo), axis=0)
        if echo % 2:
            delayed = delayed[:, ::-1]
        result += delayed * gain ** echo
    return result


def render(scene, level):
    drums = np.zeros((FRAMES, 2), dtype=np.float32)
    low = np.zeros_like(drums)
    mid = np.zeros_like(drums)
    lead = np.zeros_like(drums)
    bed = np.zeros_like(drums)
    k, sn, hh, oh = kick(), snare(), hat(), hat(True)
    duck = np.ones(FRAMES, dtype=np.float32)
    # D minor / B-flat / F / C. Eight-bar harmony shared across all four stems.
    harmony = [(38, [62, 65, 69]), (34, [58, 62, 65]), (41, [60, 65, 69]), (36, [60, 64, 67])]
    hooks = [
        [(0, 74, .38), (.75, 77, .25), (1.25, 81, .4), (2.5, 79, .25), (3.0, 77, .35)],
        [(.25, 74, .3), (1, 72, .38), (2.5, 69, .35), (3.25, 72, .3)],
        [(0, 77, .4), (1, 81, .4), (2.25, 84, .27), (3, 81, .4)],
        [(.25, 79, .3), (1, 76, .35), (2, 72, .45), (3.25, 76, .3)],
    ]
    for bar in range(BARS):
        beat = bar * 4
        root, chord = harmony[(bar // 2) % 4]
        arrangement = (bar + [0, 8, 24, 24][level]) % 32
        breakbeat = 16 <= arrangement < 20
        building = 20 <= arrangement < 24
        drop = 8 <= arrangement < 16 or arrangement >= 24
        intensity = min(1, .18 + level * .19 + (.23 if drop else 0))
        section_gain = .6 if breakbeat else 1

        kicks = [0, 2.75] if bar % 2 == 0 else [0, 1.5, 3.5]
        if breakbeat:
            kicks = [0]
        elif level >= 2 and bar % 4 == 3:
            kicks += [3.0]
        for position in kicks:
            add(drums, k, beat + position, .77)
            start = round((beat + position) * BEAT * SR)
            t = timebase(.21)
            curve = .22 + .78 * (1 - np.exp(-t / .05))
            idx = (np.arange(len(t)) + start) % FRAMES
            duck[idx] = np.minimum(duck[idx], curve)
        if not breakbeat or bar % 2 == 0:
            add(drums, sn, beat + 2, .62, .02)
        if bar % 4 == 3 and not breakbeat:
            for position, volume in [(3.25, .13), (3.75, .23)]:
                add(drums, sn, beat + position, volume, -.12)
        if building:
            for position in [2.5, 3, 3.5, 3.75]:
                add(drums, sn, beat + position, .11 + .035 * (bar % 4), .15)

        for tick in range(8):
            if breakbeat and tick % 2:
                continue
            add(drums, hh, beat + tick * .5 + (.028 if tick % 2 else 0), .18 if tick % 2 else .11, -.26 if tick % 2 else .26)
        if not breakbeat:
            add(drums, oh, beat + 1.5, .12, .3)
            if level >= 1:
                add(drums, oh, beat + 3.5, .09, -.3)
            if bar % 2 and (drop or level >= 2):
                for tick in [3.125, 3.375, 3.625, 3.875]:
                    add(drums, hh, beat + tick, .075, (tick - 3.5) * 1.2)

        phrases = [(0, 1.6, 1), (2.45, .65, 2), (3.25, .65, 3)]
        if bar % 2:
            phrases = [(.15, 1.10, 2), (1.5, .40, 4), (2.45, .8, 1.5), (3.5, .4, 4)]
        if level >= 2 and drop:
            phrases = [(0, .8, 2), (1, .7, 3), (2.5, .4, 4), (3, .4, 4), (3.5, .42, 6)]
        if breakbeat:
            phrases = [(0, 3.7, .5)]
        for position, length, rate in phrases:
            note = root + (12 if level == 3 and position >= 3 else 0)
            add(mid, bass(note, length, rate, intensity), beat + position, (.22 + .025 * level) * section_gain)
            add(low, sub(root, length), beat + position, .24 * section_gain)

        if bar % 2 == 0:
            add(bed, pad(chord, 8), beat, .09 if breakbeat else .048, -.12)
        if level >= 1 or bar % 4 in [2, 3] or breakbeat:
            arp_notes = [chord[0], chord[1], chord[2], chord[1], chord[0] + 12, chord[2], chord[1], chord[2]]
            for step, note in enumerate(arp_notes):
                add(lead, chip(note + 12, .22, level >= 2), beat + step * .5, .025 + .004 * level, -.42 if step % 2 else .42)
        # Hook phrases alternate with bass responses rather than filling every beat.
        melody_active = bar % 2 == 0 or level >= 2 or breakbeat
        if melody_active:
            phrase = hooks[(bar // 2) % 4]
            for position, note, length in phrase:
                add(lead, chip(note, length, level >= 1), beat + position, .12 + .009 * level, .06)
                if level == 3 and drop:
                    add(lead, chip(note - 12, length * .7, True), beat + position + .25, .037, -.25)
        if bar % 8 == 7:
            # A short arcade fill turns the phrase into the next bar.
            for n, note in enumerate([74, 77, 81, 84]):
                add(lead, chip(note, .10, True), beat + 3.5 + n * .125, .06, -.3 + n * .2)

    mix = drums + (low + mid + bed + pingpong(lead)) * duck[:, None]
    mix = np.tanh(mix * 1.05)
    # A two-millisecond edge ramp prevents a codec seam click without a long fade.
    edge = round(SR * .002)
    mix[:edge] *= np.linspace(0, 1, edge)[:, None]
    mix[-edge:] *= np.linspace(1, 0, edge)[:, None]
    with tempfile.TemporaryDirectory(prefix='bounty-score-') as folder:
        raw = Path(folder) / 'mix.wav'
        mastered = Path(folder) / 'master.wav'
        wavfile.write(raw, SR, mix.astype(np.float32))
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(raw), '-af',
                        'highpass=f=28,lowpass=f=14500,loudnorm=I=-18:TP=-2:LRA=7',
                        '-ar', str(SR), '-c:a', 'pcm_s16le', str(mastered)], check=True)
        rate, pcm = wavfile.read(mastered)
        samples = pcm.astype(np.float64) / 32768
        destination = OUT / f'{scene}-theme.mp3'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(mastered), '-map_metadata', '-1',
                        '-ar', str(SR), '-c:a', 'libmp3lame', '-b:a', '192k',
                        '-metadata', 'artist=Gamboligy Games', '-metadata', f'title={TITLES[scene]}',
                        str(destination)], check=True)
        stats = {'durationSeconds': len(samples) / rate, 'peak': float(np.max(np.abs(samples))),
                 'rms': float(np.sqrt(np.mean(samples ** 2))),
                 'minimumOneSecondRms': min(float(np.sqrt(np.mean(samples[s:s + SR] ** 2))) for s in range(0, len(samples) - SR, SR)),
                 'sha256': hashlib.sha256(destination.read_bytes()).hexdigest()}
        if stats['peak'] >= .99 or stats['rms'] < .06 or stats['minimumOneSecondRms'] < .015:
            raise RuntimeError(f'{scene}: audio level verification failed: {stats}')
        print(scene, json.dumps(stats), flush=True)
        return stats


TITLES = {'base': 'Neon Bounty', 'regular': 'VS Protocol', 'super': 'Last Life', 'hidden': 'God Mode: Overclock'}
if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    credits = []
    for level, scene in enumerate(TITLES):
        stats = render(scene, level)
        credits.append({'scene': scene, 'title': TITLES[scene], 'artist': 'Gamboligy Games',
                        'style': '8-bit chiptune / halftime dubstep', 'bpm': BPM, 'bars': BARS,
                        'key': 'D minor', 'source': 'Original synthesis and arrangement in scripts/render-soundtrack.py',
                        'externalSamples': False, **stats})
    (OUT / 'credits.json').write_text(json.dumps(credits, indent=2) + '\n')
    (OUT / 'NOTICE.txt').write_text('BOUNTY BREAKERS — ORIGINAL GAME SOUNDTRACK\n\n'
        'Created for Gamboligy Games, September 2026.\n'
        'Four original 140 BPM, D-minor chiptune / dubstep arrangements:\n'
        'Neon Bounty / VS Protocol / Last Life / God Mode: Overclock.\n\n'
        'All drum, bass, pad and chip-lead sounds were synthesized from oscillators and noise.\n'
        'No third-party recordings, samples, vocals or melodies are included.\n'
        'Compositions, arrangements and the reproducible renderer were created for this project.\n'
        'Rendered as stereo 44.1 kHz, 192 kbps MP3 loops.\n')
