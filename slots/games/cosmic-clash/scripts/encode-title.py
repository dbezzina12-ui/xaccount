"""Make transparent responsive WebP loops from the approved green-screen take."""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

source, destination = Path(sys.argv[1]), Path(sys.argv[2])
destination.mkdir(parents=True, exist_ok=True)
probe = json.loads(subprocess.check_output([
    'ffprobe', '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height', '-of', 'json', str(source)
]))['streams'][0]
crop_width = int(probe['width'] * .98) // 8 * 8
crop_height = crop_width * 2 // 5
crop_x = (probe['width'] - crop_width) // 2
crop_y = 0  # Preserve headroom for the star glint above the resting silhouette.
if crop_height > probe['height']:
    raise ValueError('Expected a wide logo take')

width, height, fps = 1080, 432, 20
decoder = subprocess.Popen([
    'ffmpeg', '-v', 'error', '-i', str(source), '-t', '6',
    '-vf', f'crop={crop_width}:{crop_height}:{crop_x}:{crop_y},'
           f'scale={width}:{height}:flags=lanczos,fps={fps}',
    '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'
], stdout=subprocess.PIPE)
frames = []
while True:
    data = decoder.stdout.read(width * height * 3)
    if not data:
        break
    if len(data) != width * height * 3:
        raise RuntimeError('Incomplete decoded frame')
    rgb = np.frombuffer(data, dtype=np.uint8).reshape(height, width, 3).astype(np.float32) / 255
    border = np.concatenate((rgb[:2].reshape(-1, 3), rgb[-2:].reshape(-1, 3)))
    key = np.median(border, axis=0)
    key_excess = key[1] - max(key[0], key[2])
    if key_excess < .5:
        raise ValueError('The take no longer has a clean green background')
    excess = rgb[:, :, 1] - np.maximum(rgb[:, :, 0], rgb[:, :, 2])
    screen = np.clip((excess - .015) / (key_excess - .015), 0, 1)
    alpha = 1 - screen
    alpha[alpha < .06] = 0
    alpha[alpha > .98] = 1
    # The approved take has clear margin here; discard compression noise in it.
    alpha[:2] = alpha[-2:] = 0
    alpha[:, :2] = alpha[:, -2:] = 0
    # Remove only the keyed background's contribution at translucent edges.
    color = (rgb - (1 - alpha[:, :, None]) * key) / np.maximum(alpha[:, :, None], .001)
    rgba = np.concatenate((np.clip(color, 0, 1), alpha[:, :, None]), axis=2)
    rgba[alpha == 0] = 0
    frames.append(Image.fromarray(np.rint(rgba * 255).astype(np.uint8)))
if decoder.wait() != 0 or len(frames) < 120:
    raise RuntimeError('The title take could not be fully decoded')

# Finish at the exact starting pose instead of snapping across a video boundary.
for i in range(8):
    frames[-8 + i] = Image.blend(frames[-8 + i], frames[0], (i + 1) / 8)
for i in range(1, 6):
    frames[i] = frames[0].copy()
durations = [round((i + 1) * 1000 / fps) - round(i * 1000 / fps) for i in range(len(frames))]
frames[0].save(destination / 'title-poster.png', optimize=True)
print(f'Decoded {len(frames)} frames; crop {(crop_x, crop_y, crop_width, crop_height)}', flush=True)
for name, size, quality in [('desktop', (1080, 432), 80), ('mobile', (720, 288), 82)]:
    images = frames if size == frames[0].size else [frame.resize(size, Image.Resampling.LANCZOS) for frame in frames]
    path = destination / f'title-{name}.webp'
    images[0].save(path, save_all=True, append_images=images[1:], duration=durations,
                   loop=0, quality=quality, method=3, minimize_size=True)
    print(f'{path.name}: {size}, {path.stat().st_size:,} bytes', flush=True)
print('Encoding complete.', flush=True)
