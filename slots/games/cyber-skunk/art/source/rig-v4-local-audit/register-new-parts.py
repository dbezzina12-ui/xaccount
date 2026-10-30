"""Local fitting candidates only. Applies declared landmark registration, no paint edits.
The artist's complete source PNGs remain unchanged; runtime never imports this folder.
"""
from pathlib import Path
from PIL import Image
import json, math, hashlib
HERE=Path(__file__).resolve().parent
OUT=HERE/'fitting-candidates';OUT.mkdir(exist_ok=True)
def register(name,filename,source_anchor,target_anchor,scale,angle):
    im=Image.open(HERE/filename).convert('RGBA');theta=math.radians(angle)
    a=math.cos(theta)*scale;b=math.sin(theta)*scale
    tx=target_anchor[0]-a*source_anchor[0]+b*source_anchor[1]
    ty=target_anchor[1]-b*source_anchor[0]-a*source_anchor[1]
    det=a*a+b*b
    inv=(a/det,b/det,(-a*tx-b*ty)/det,-b/det,a/det,(b*tx-a*ty)/det)
    out=im.transform((1600,2000),Image.Transform.AFFINE,inv,Image.Resampling.BICUBIC)
    dest=OUT/(name+'.png');out.save(dest)
    return {'name':name,'source':filename,'source_anchor':source_anchor,'target_anchor':target_anchor,'scale':scale,'rotation_degrees':angle,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'alpha_bounds':out.getchannel('A').getbbox(),'file':str(dest.relative_to(HERE))}
# Two measured centerline points on tail source; maps both joints exactly.
s0=(300,300);s1=(1650,590);t0=(760,265);t1=(1085,365)
sv=(s1[0]-s0[0],s1[1]-s0[1]);tv=(t1[0]-t0[0],t1[1]-t0[1])
scale=math.hypot(*tv)/math.hypot(*sv);angle=math.degrees(math.atan2(tv[1],tv[0])-math.atan2(sv[1],sv[0]))
rows=[register('tail-4','tail-4-painted-source-v2.png',s0,t0,scale,angle),register('jaw','jaw-painted-source.png',(650,360),(905,742),.22,0)]
def disk(a,point,r=55):
    cx,cy=point;values=[a.getpixel((x,y)) for y in range(cy-r,cy+r+1) for x in range(cx-r,cx+r+1) if (x-cx)**2+(y-cy)**2<=r*r]
    return {'pivot_alpha':a.getpixel(point),'disk_coverage':round(sum(x>=128 for x in values)/len(values),4)}
for row in rows:
    a=Image.open(HERE/row['file']).getchannel('A')
    row['proximal_joint']=disk(a,tuple(row['target_anchor']))
    if row['name']=='tail-4':row['nozzle_joint']=disk(a,t1)
    row['status']='local fitting candidate; seam and extreme-pose review required'
(HERE/'new-parts-registration.json').write_text(json.dumps(rows,indent=2)+'\n')
print(json.dumps(rows,indent=2))
