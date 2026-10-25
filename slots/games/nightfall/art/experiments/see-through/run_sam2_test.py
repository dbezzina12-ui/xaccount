"""CPU SAM 2.1 Tiny extraction test: selected original pixels, no generative fill."""
import argparse
import hashlib
import json
import time
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageDraw
from sam2.build_sam import build_sam2
from sam2.sam2_image_predictor import SAM2ImagePredictor

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('input', type=Path, help='Original RGBA composite, with real alpha')
p.add_argument('--prompts', type=Path, default=Path('sam2-prompts.json'))
p.add_argument('--checkpoint', type=Path, default=Path('sam2/checkpoints/sam2.1_hiera_tiny.pt'))
p.add_argument('--out', type=Path, default=Path('sam2-review'))
a = p.parse_args()
a.out.mkdir(parents=True, exist_ok=True)
for sub in ['raw-masks', 'layers']:
    (a.out / sub).mkdir(exist_ok=True)
spec = json.loads(a.prompts.read_text())
source = Image.open(a.input).convert('RGBA')
assert list(source.size) == spec['canvas'], 'Prompts require their original canvas.'
src = np.asarray(source)
white = Image.alpha_composite(Image.new('RGBA', source.size, 'white'), source).convert('RGB')
torch.set_num_threads(4)
t0 = time.monotonic()
model = build_sam2('configs/sam2.1/sam2.1_hiera_t.yaml', str(a.checkpoint), device='cpu', apply_postprocessing=False)
predictor = SAM2ImagePredictor(model, max_hole_area=0, max_sprinkle_area=0)
used = np.zeros(src.shape[:2], dtype=bool)
report = {'model':'SAM 2.1 Hiera Tiny', 'device':'cpu', 'source_sha256':hashlib.sha256(a.input.read_bytes()).hexdigest(),
          'checkpoint_sha256':hashlib.sha256(a.checkpoint.read_bytes()).hexdigest(),
          'canvas':list(source.size), 'generative_fill':False, 'parts':[]}
layers = []
with torch.inference_mode():
    predictor.set_image(white)
    print('Image encoded', round(time.monotonic()-t0, 2), flush=True)
    for part in spec['parts']:
        points = np.array(part['positive']+part['negative'], dtype=np.float32)
        labels = np.array([1]*len(part['positive'])+[0]*len(part['negative']), dtype=np.int32)
        masks, scores, _ = predictor.predict(point_coords=points, point_labels=labels, box=np.array(part['box'], dtype=np.float32), multimask_output=False)
        raw_mask = masks[0].astype(bool)
        Image.fromarray(raw_mask.astype('uint8')*255).save(a.out/'raw-masks'/f"{part['name']}.png")
        selected = raw_mask & ~used & (src[:,:,3]>0)
        used |= selected
        rgba = src.copy()
        rgba[~selected] = 0
        im = Image.fromarray(rgba)
        im.save(a.out/'layers'/f"{part['name']}.png")
        layers.append((part['name'],im))
        report['parts'].append({'name':part['name'], 'model_score':float(scores[0]), 'selected_pixels':int(selected.sum()), 'bbox':im.getbbox()})
        print(part['name'],report['parts'][-1],flush=True)
remaining = src.copy()
remaining[used | (src[:,:,3] == 0)] = 0
im = Image.fromarray(remaining)
im.save(a.out/'layers'/'remainder.png')
layers.append(('remainder — unseparated', im))
assembled = Image.new('RGBA', source.size)
for _, im in layers:
    assembled = Image.alpha_composite(assembled, im)
assembled.save(a.out/'assembled.png')
assembled_array = np.asarray(assembled)
visible = src[:,:,3]>0
report['max_visible_rgb_difference'] = int(np.abs(assembled_array[:,:,:3].astype(int)-src[:,:,:3].astype(int))[visible].max())
report['max_alpha_difference'] = int(np.abs(assembled_array[:,:,3].astype(int)-src[:,:,3].astype(int)).max())
report['elapsed_seconds'] = round(time.monotonic()-t0, 2)
report['caution'] = 'Exact recomposition only verifies pixel ownership and export, NOT correct semantic cuts. Hidden surfaces and joint overlaps have not been generated. Remainder is not a rig part.'
(a.out/'review.json').write_text(json.dumps(report,indent=2)+'\n')
(a.out/'prompts.json').write_text(json.dumps(spec,indent=2)+'\n')
items = [('Original',source)]+layers
sheet = Image.new('RGB',(1200,((len(items)+2)//3)*420),(233,235,240))
d = ImageDraw.Draw(sheet)
for idx,(name,im) in enumerate(items):
    im=im.copy();im.thumbnail((392,380));x=(idx%3)*400;y=(idx//3)*420
    sheet.paste(im,(x+(400-im.width)//2,y+32),im)
    d.text((x+10,y+9),name,fill=(20,20,25))
sheet.save(a.out/'contact-sheet.jpg',quality=92)
print('Complete',report['elapsed_seconds'],flush=True)
