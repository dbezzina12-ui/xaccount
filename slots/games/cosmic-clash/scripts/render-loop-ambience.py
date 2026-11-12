"""Build the approved long music loops with quiet, circular sci-fi air sweeps.

Usage: python scripts/render-loop-ambience.py ORIGINAL_AUDIO_DIRECTORY OUTPUT_DIRECTORY
The original user-supplied MP3 filenames and edits are recorded below. No
runtime timers: ambience is part of the music and follows its pause/mute/level.
"""
import argparse
import json
import subprocess
from pathlib import Path

import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
SPECS = [
    dict(track='base', source='Outlaw Protocol (1).mp3', start=32.18289583333333,
         end=154.8201875, centers=[0.18, 30.38, 61.18, 91.98], variants=[0, 1, 2, 1]),
    dict(track='bonus', source='Outlaw Protocol - Start at 22 seconds.mp3',
         start=24.659583333333334, end=141.4315,
         centers=[0.18, 38.68, 77.58], variants=[0, 2, 1]),
]


def air_sweep(variant):
    rng = np.random.default_rng(95340 + variant)
    duration = [1.80, 1.95, 1.70][variant]
    t = np.arange(round(duration * SR)) / SR
    # Moving filtered air with a soft low-frequency body; no sharp impact or beep.
    bands = [(140, 360), (320, 720), (650, 1300), (1200, 2400)]
    sweep = np.zeros_like(t)
    position = np.clip(t / duration, 0, 1)
    for i, (lo, hi) in enumerate(bands):
        noise = signal.sosfilt(signal.butter(3, [lo, hi], btype='bandpass',
                                           fs=SR, output='sos'), rng.standard_normal(len(t)))
        noise /= np.sqrt(np.mean(noise ** 2))
        center = [.18, .33, .48, .60][i] + (variant - 1) * .035
        weight = np.exp(-.5 * ((position - center) / .24) ** 2)
        sweep += noise * weight * [0.50, 0.55, 0.37, 0.14][i]
    peak_at = .64
    envelope = np.where(t < peak_at,
                        np.sin(np.minimum(t / peak_at, 1) * np.pi / 2) ** 2,
                        np.cos(np.clip((t - peak_at) / (duration - peak_at), 0, 1) * np.pi / 2) ** 2)
    sweep *= envelope
    pan = (0.18 if variant != 1 else -0.18) * np.sin(np.pi * (position - .5))
    stereo = np.column_stack([sweep * np.sqrt((1 - pan) / 2),
                              sweep * np.sqrt((1 + pan) / 2)])
    return stereo.astype(np.float32), peak_at


def encode(wav, mp3):
    subprocess.run(['ffmpeg', '-hide_banner', '-nostdin', '-y', '-i', str(wav),
                    '-c:a', 'libmp3lame', '-b:a', '192k', str(mp3)], check=True)


def render(source_dir, output_dir):
    output_dir.mkdir(parents=True, exist_ok=True)
    cues = [air_sweep(i) for i in range(3)]
    report = []
    for spec in SPECS:
        raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-nostdin', '-i',
                                       str(source_dir / spec['source']), '-f', 'f32le',
                                       '-ac', '2', '-ar', str(SR), '-'])
        x = np.frombuffer(raw, np.float32).reshape(-1, 2)
        start, end = round(spec['start'] * SR), round(spec['end'] * SR)
        loop = x[start:end].copy()
        count = len(loop)
        fade_count = round(.65 * SR)
        ramp = (.5 - .5 * np.cos(np.linspace(0, np.pi, fade_count)))[:, None]
        loop[:fade_count] = (1 - ramp) * x[end:end + fade_count] + ramp * x[start:start + fade_count]
        bed = np.zeros_like(loop)
        events = []
        for center, variant in zip(spec['centers'], spec['variants']):
            cue, peak_at = cues[variant]
            offset = round((center - peak_at) * SR)
            indexes = (np.arange(len(cue)) + offset) % count
            music_rms = np.sqrt(np.mean(loop[indexes].astype(np.float64) ** 2))
            # At least 20 dB below local music RMS, with a conservative peak cap.
            gain = min(music_rms * .1 / np.sqrt(np.mean(cue ** 2)),
                       .055 / np.max(np.abs(cue)))
            mixed_cue = cue * gain
            bed[indexes] += mixed_cue
            events.append(dict(peak_seconds=center, variant=variant + 1,
                               rms_below_music_db=float(20 * np.log10(
                                   np.sqrt(np.mean(mixed_cue ** 2)) / music_rms)),
                               peak=float(np.max(np.abs(mixed_cue)))))
        result = loop + bed
        scale = min(1, .96 / np.max(np.abs(result)))
        result *= scale
        path = output_dir / ('outlaw-' + spec['track'] + '-ambience.wav')
        wavfile.write(path, SR, (result * 32767).astype(np.int16))
        encode(path, path.with_suffix('.mp3'))
        # The preview includes a full cycle and 25 seconds of the next cycle.
        preview = np.concatenate([result, result[:25 * SR]])
        preview[:480] *= np.linspace(0, 1, 480)[:, None]
        preview[-SR:] *= np.linspace(1, 0, SR)[:, None]
        preview_wav = output_dir / ('Cosmic-Clash-' + spec['track'].title() + '-Ambience-Preview.wav')
        wavfile.write(preview_wav, SR, (preview * 32767).astype(np.int16))
        encode(preview_wav, preview_wav.with_suffix('.mp3'))
        intervals = np.diff(spec['centers'] + [spec['centers'][0] + count / SR])
        assert np.all((intervals >= 30) & (intervals <= 40))
        assert np.isfinite(result).all() and np.max(np.abs(result)) <= .961
        item = dict(track=spec['track'], source=spec['source'], source_start_seconds=start/SR,
                    source_end_seconds=end/SR, loop_seconds=count/SR, crossfade_seconds=.65,
                    interval_seconds=intervals.tolist(), events=events,
                    output_peak=float(np.max(np.abs(result))),
                    seam_sample_delta=float(np.max(np.abs(result[0] - result[-1]))))
        report.append(item)
        print(json.dumps(item), flush=True)
    (output_dir / 'loop-ambience.json').write_text(json.dumps(report, indent=2) + '\n')


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('source_directory', type=Path)
    p.add_argument('output_directory', type=Path)
    args = p.parse_args()
    render(args.source_directory, args.output_directory)
