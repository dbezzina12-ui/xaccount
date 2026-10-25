from PIL import Image
from pathlib import Path
from scipy import ndimage
import numpy as np, json, shutil
root=Path(__file__).resolve().parents[1]
out=root/'games/nightfall/runtime/assets/nightfall';out.mkdir(parents=True,exist_ok=True)
sources=root/'games/nightfall/art/source';sources.mkdir(parents=True,exist_ok=True)
gen=Path('/workspace/scratch/016b1883075f/generated_images')
items={
'symbols':('exec-05dab1fa-f3d0-4271-a2d2-3264a19b2210.png',[(41,59,420,435),(467,83,789,433),(835,73,1225,433),(39,483,420,860),(476,460,785,848),(880,470,1193,847),(43,885,423,1211),(421,857,829,1226),(862,897,1207,1212)],['ruby','sapphire','emerald','amethyst','amber','shield','crown','fs','wild']),
'reaper':('exec-d70000b9-0f72-4dea-a7e9-9e066d6751fa.png',[(41,81,409,418),(448,13,803,426),(851,16,1229,424),(73,464,308,812),(553,464,793,805),(963,465,1164,809),(91,869,292,1199),(434,805,788,1249),(870,900,1238,1236)],['head','body','cape','upper-left','upper-right','fore-left','fore-right','scythe','blink']),
'archer':('exec-6c7be854-3d10-4460-ae3a-069b82c4d8d7.png',[(52,42,499,648),(507,92,937,529),(950,142,1238,579),(33,764,370,1025),(399,636,821,1232),(854,767,1249,1182)],['body','head','bow-arm','draw-arm','bow','blink'])}
manifest={}
for category,(file,boxes,names) in items.items():
 im=Image.open(sources/(category+'-atlas.png')).convert('RGBA')
 a=np.array(im);labels,n=ndimage.label(a[:,:,3]>40)
 for box,name in zip(boxes,names):
  x0,y0,x1,y1=box; region=labels[y0:y1,x0:x1]; counts=np.bincount(region.ravel());counts[0]=0; label=counts.argmax()
  # Crop registered connected components, keeping soft alpha at their edges.
  pad=3; x0=max(0,x0-pad);y0=max(0,y0-pad);x1=min(im.width,x1+pad);y1=min(im.height,y1+pad)
  p=im.crop((x0,y0,x1,y1)); data=np.array(p); mask=ndimage.binary_dilation(labels[y0:y1,x0:x1]==label,iterations=3);data[:,:,3]*=mask.astype('uint8');p=Image.fromarray(data)
  target=out/category;target.mkdir(exist_ok=True)
  if category=='symbols':
   p.thumbnail((280,280),Image.Resampling.LANCZOS);canvas=Image.new('RGBA',(300,300));canvas.alpha_composite(p,((300-p.width)//2,(300-p.height)//2));p=canvas
  p.save(target/(name+'.webp'),quality=93)
  manifest[category+'/'+name]={'sourceBox':box,'size':list(p.size)}
# Separate production background and title.
for name,file in [('background','exec-2dbc3c2e-0294-43e5-ac84-e2ec3121124f.png'),('title','exec-09da8b06-dd39-4080-8565-147566324ffd.png')]:
 im=Image.open(sources/(name+'.png')).convert('RGBA')
 if name=='title':im=im.crop((65,85,1472,945));im.thumbnail((900,560),Image.Resampling.LANCZOS)
 im.save(out/(name+'.webp'),quality=92)

(out/'atlas-manifest.json').write_text(json.dumps(manifest,indent=2))
print('Prepared',len(manifest),'transparent parts and symbols.')
