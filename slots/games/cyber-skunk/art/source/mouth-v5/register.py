"""Register painted head/jaw source pair and render private pose QA. No rig-code edits."""
from pathlib import Path
from PIL import Image,ImageDraw
import json,hashlib,math
ROOT=Path(__file__).resolve().parent
OUT=ROOT/'registered';OUT.mkdir(exist_ok=True)
# Head: align measured eye midpoint to v4 eyes. Jaw: use the center of enlarged hidden disc.
specs={'head':{'scale':.5,'source_anchor':[727,777],'target_anchor':[960,665]},'jaw':{'scale':.18,'source_anchor':[600,430],'target_anchor':[905,742]}}
rows=[]
for name,s in specs.items():
 im=Image.open(ROOT/'originals'/f'{name}.png').convert('RGBA');q=s['scale'];sx,sy=s['source_anchor'];tx,ty=s['target_anchor']
 out=im.transform((1600,2000),Image.Transform.AFFINE,(1/q,0,sx-tx/q,0,1/q,sy-ty/q),Image.Resampling.BICUBIC)
 path=OUT/f'{name}.png';out.save(path)
 a=out.getchannel('A');pivot=(875,790) if name=='head' else (905,742)
 vals=[a.getpixel((x,y)) for y in range(pivot[1]-55,pivot[1]+56) for x in range(pivot[0]-55,pivot[0]+56) if (x-pivot[0])**2+(y-pivot[1])**2<=55**2]
 rows.append({'name':name,**s,'file':str(path.relative_to(ROOT)),'canvas':[1600,2000],'bounds':a.getbbox(),'v4_pivot':pivot,'pivot_alpha':a.getpixel(pivot),'joint_disk_coverage':round(sum(v>=128 for v in vals)/len(vals),5),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
head=Image.open(OUT/'head.png').convert('RGBA');jaw=Image.open(OUT/'jaw.png').convert('RGBA')
# The shipping v4 draw order is jaw, then head. Rotation around jaw pivot only.
angles=[0,8,16,-8];sheet=Image.new('RGB',(1400,500),'#35434b');draw=ImageDraw.Draw(sheet);mouth_samples=[]
for i,angle in enumerate(angles):
 moved=jaw.rotate(-angle,resample=Image.Resampling.BICUBIC,center=(905,742))
 comp=Image.alpha_composite(moved,head);crop=comp.crop((640,370,1140,870)).resize((330,330),Image.Resampling.LANCZOS)
 samples=[{'point':list(p),'alpha':comp.getpixel(p)[3]} for p in [(1020,745),(1020,755),(1030,750),(1040,760)]]
 mouth_samples.append({'angle':angle,'samples':samples})
 assert all(p['alpha']>=240 for p in samples), 'Background exposed at mouth QA sample'
 sheet.paste(crop,(i*350+10,45),crop);draw.text((i*350+20,390),f'jaw {angle:+d} degrees | jaw behind head',fill='white')
 # Smaller render shows whether pair reads at phone scale; not a browser screenshot.
 small=crop.resize((80,80),Image.Resampling.LANCZOS);sheet.paste(small,(i*350+140,410),small)
sheet.save(ROOT/'pose-review.jpg',quality=93)
assert rows[1]['joint_disk_coverage']==1.0, 'Jaw backing no longer covers hinge disk'
(ROOT/'registration.json').write_text(json.dumps({'parts':rows,'review_angles_degrees':angles,'mouth_alpha_samples':mouth_samples,'status':'source pair for Claude fitting; not active runtime art'},indent=2)+'\n')
print(json.dumps(rows,indent=2))
