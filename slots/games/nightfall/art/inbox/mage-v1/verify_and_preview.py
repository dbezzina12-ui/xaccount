"""Standalone art proof. Python 3 + Pillow + numpy. No game files modified."""
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw
import numpy as np, math, json, hashlib
HERE=Path(__file__).parent
R=json.loads((HERE/'rig.json').read_text());SIZE=tuple(R['canvas']);PAD=R['proofTopPadding'];ORDER=R['drawOrder']
L={n:Image.open(HERE/f'{n}.png').convert('RGBA') for n in ORDER+['head-blink']}
P={k:np.array(v,float) for k,v in R['pivots'].items()};S,E,W=[P[n] for n in ['shoulder','elbow','wrist']]
A=np.linalg.norm(E-S);B=np.linalg.norm(W-E)
def elbow(w):
 d=np.linalg.norm(w-S);assert abs(A-B)<d<A+B
 u=(w-S)/d;x=(A*A-B*B+d*d)/(2*d)
 return S+x*u+R['ikBranch']*math.sqrt(A*A-x*x)*np.array([-u[1],u[0]])
def rigid(im,a,b,theta=0):
 if abs(theta)<1e-12:
  result=Image.new('RGBA',(SIZE[0],SIZE[1]+PAD));delta=b-a+[0,PAD]
  result.alpha_composite(im,tuple(np.rint(delta).astype(int)));return result
 c=math.cos(theta);s=math.sin(theta);rot=np.array([[c,-s],[s,c]]);inv=rot.T
 offset=a-inv@(b+np.array([0,PAD]))
 return im.transform((SIZE[0],SIZE[1]+PAD),Image.Transform.AFFINE,(inv[0,0],inv[0,1],offset[0],inv[1,0],inv[1,1],offset[1]),Image.Resampling.BICUBIC)
def angle(a,b):return math.atan2(b[1],b[0])-math.atan2(a[1],a[0])
STATIC={n:rigid(im,np.zeros(2),np.zeros(2)) for n,im in L.items()}
def pose(lift,blink=False):
 w=W-[0,lift];e=elbow(w)
 result=STATIC.copy()
 result['arm-upper']=rigid(L['arm-upper'],S,S,angle(E-S,e-S))
 result['arm-fore']=rigid(L['arm-fore'],E,e,angle(W-E,w-e))
 for n in R['rigidGripGroup']:result[n]=rigid(L[n],W,w)
 if blink:result['head']=result['head-blink']
 full=Image.new('RGBA',(SIZE[0],SIZE[1]+PAD))
 for n in ORDER:full.alpha_composite(result[n])
 return full,result,e,w
def height(t):
 T=R['timingSeconds'];H=R['liftPixels']
 if t<T['idleEnd']:return 0
 if t<T['liftEnd']:
  u=(t-T['idleEnd'])/(T['liftEnd']-T['idleEnd']);return H*(3*u*u-2*u*u*u)
 if t<T['holdEnd']:return H
 if t<T['impact']:
  u=(t-T['holdEnd'])/(T['impact']-T['holdEnd']);return H*(1-u*u)
 if t<T['reboundEnd']:return 13*math.sin((t-T['impact'])/(T['reboundEnd']-T['impact'])*math.pi/2)
 if t<T['settleEnd']:return 13*(1-(t-T['reboundEnd'])/(T['settleEnd']-T['reboundEnd']))**2
 return 0
def disk_coverage(alpha,p,r=26):
 x,y=np.rint(p+[0,PAD]).astype(int);yy,xx=np.ogrid[-r:r+1,-r:r+1];mask=xx*xx+yy*yy<=r*r
 return float(np.mean(alpha[y-r:y+r+1,x-r:x+r+1][mask]>=250))
def verify():
 assert all(im.size==SIZE for im in L.values())
 stacked=Image.new('RGBA',SIZE)
 for n in ORDER:stacked.alpha_composite(L[n])
 assert np.array_equal(np.array(stacked),np.array(Image.open(HERE/'full.png')))
 cover=np.array(rigid(L['robe-cover'],np.zeros(2),np.zeros(2)).getchannel('A'))
 coverage=[];grip=[];feet=[];connect=[]
 for lift in np.linspace(0,R['liftPixels'],49):
  f,parts,e,w=pose(float(lift));coverage.extend([disk_coverage(cover,S),disk_coverage(cover,e)])
  # A finger mask intersects the shaft throughout the stroke, and their relative
  # transforms are exactly identical. Require genuine opaque pixel intersection.
  af=np.array(parts['fingers'].getchannel('A'))>200;ast=np.array(parts['staff'].getchannel('A'))>200
  grip.append(int(np.sum(af&ast)))
  # Forearm connects into the back of the fist/cuff through opaque overlap.
  aa=np.array(parts['arm-fore'].getchannel('A'))>128;ah=np.array(parts['hand-back'].getchannel('A'))>128
  connect.append(int(np.sum(aa&ah)))
  feet.append(ImageChops.difference(parts['body'],STATIC['body']).getbbox() is None)
 assert min(coverage)==1.0,('joint coverage',min(coverage))
 assert min(grip)>500,('grip',min(grip))
 assert min(connect)>100,('wrist overlap',min(connect))
 assert all(feet)
 assert disk_coverage(np.zeros_like(cover),S)==0 # negative control
 report={'status':'PASS','sampledStrokePoses':49,'minimumJointDiskCoverage':min(coverage),'jointDiskRadiusPixels':26,'minimumFingerShaftOpaqueOverlapPixels':min(grip),'minimumForearmCuffOverlapPixels':min(connect),'bodyAndFeetFixed':all(feet),'fullEqualsStack':True,'missingCoverNegativeControl':'detected','scope':'standalone art proof only; not engine or browser tests','sha256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in HERE.glob('*.png')}}
 (HERE/'validation.json').write_text(json.dumps(report,indent=2)+'\n');return report
def preview():
 frames=[]
 for i in range(60):
  t=i/25;im,_,_,_=pose(height(t),2.04<=t<=2.12)
  bg=Image.new('RGBA',im.size,'#24323f');bg.alpha_composite(im);bg.thumbnail((480,570));frames.append(bg.convert('RGB'))
 frames[0].save(HERE/'staff-slam.gif',save_all=True,append_images=frames[1:],duration=40,loop=0,optimize=True)
 sheet=Image.new('RGB',(1200,570),'#24323f')
 for i,(name,lift) in enumerate([('REST',0),('LIFT',156),('IMPACT',0)]):
  im,_,_,_=pose(lift);bg=Image.new('RGBA',im.size,'#24323f');bg.alpha_composite(im);bg.thumbnail((400,550));sheet.paste(bg.convert('RGB'),(i*400,20));ImageDraw.Draw(sheet).text((i*400+20,5),name,fill='white')
 sheet.save(HERE/'pose-check.jpg',quality=92)
if __name__=='__main__':
 print(json.dumps(verify(),indent=2));preview()
