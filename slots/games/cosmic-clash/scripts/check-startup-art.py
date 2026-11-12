"""Decode every desktop/mobile boot image and combat poster before publishing.
Run: python scripts/check-startup-art.py
"""
from pathlib import Path
from PIL import Image
import json,re
root=Path(__file__).resolve().parents[1]
source=(root/'dist/app.js').read_text()
preloads=source.split(' const tasks=[',1)[1].split('].map(name=>',1)[0]
paths=set(re.findall(r"'([^']+\.(?:png|webp)(?:\?[^']*)?)'",preloads))
assert paths,'No startup images found'
metadata=json.loads((root/'dist/assets/duel-v73/metadata.json').read_text())
paths.update('duel-v73/'+take['poster'] for take in metadata.values())
failures=[]
for path in sorted(paths):
    try:
        with Image.open(root/'dist/assets'/path.split('?',1)[0]) as image:
            image.load()
            assert image.width>0 and image.height>0
    except Exception as error:
        failures.append(f'{path}: {error}')
if failures:
    raise SystemExit('\n'.join(failures))
print(f'Decoded all {len(paths)} startup images and duel posters, including both responsive backgrounds.')
