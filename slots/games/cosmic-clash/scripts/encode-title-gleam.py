"""Transfer the supplied clip's brief glint onto the fixed approved logo.

Usage: python3 scripts/encode-title-gleam.py INPUT_VIDEO OUTPUT_DIRECTORY
Only the recorded light changes are composited; the logo's alpha and pose stay
fixed. The resulting transparent responsive loops last exactly ten seconds.
"""
import subprocess,sys
from pathlib import Path
import numpy as np
from PIL import Image,ImageFilter

video=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
root=Path(__file__).resolve().parents[1]
poster=Image.open(root/'dist/assets/title-v63/title-poster.png').convert('RGBA')
width,height=poster.size
def decode(start,length):
    raw=subprocess.check_output(['ffmpeg','-v','error','-ss',str(start),'-i',str(video),'-t',str(length),
        '-vf',f'crop=1248:498:16:0,scale={width}:{height}:flags=lanczos,fps=30',
        '-f','rawvideo','-pix_fmt','rgb24','-'])
    return np.frombuffer(raw,dtype=np.uint8).reshape(-1,height,width,3).astype(np.float32)/255
def keyed(rgb):
    border=np.concatenate((rgb[:2].reshape(-1,3),rgb[-2:].reshape(-1,3)))
    key=np.median(border,axis=0)
    excess=rgb[:,:,1]-np.maximum(rgb[:,:,0],rgb[:,:,2])
    alpha=1-np.clip((excess-.015)/(key[1]-max(key[0],key[2])-.015),0,1)
    alpha[alpha<.06]=0;alpha[alpha>.98]=1
    alpha[:3]=alpha[-3:]=0;alpha[:,:3]=alpha[:,-3:]=0
    color=np.clip(rgb-(1-alpha[:,:,None])*key,0,1)
    color[alpha==0]=0
    return color

reference=keyed(decode(9.1,.04)[0])
source=decode(9.5,.74)
fixed=np.asarray(poster).astype(np.float32)/255
frames=[poster]
for rgb in source:
    difference=keyed(rgb)-reference
    luminance=difference@np.array([.2126,.7152,.0722],dtype=np.float32)
    strength=np.clip((luminance-.018)/.065,0,1)
    strength=np.asarray(Image.fromarray(np.uint8(strength*255)).filter(ImageFilter.GaussianBlur(.5))).astype(np.float32)/255
    light=np.maximum(difference,0)*strength[:,:,None]
    rgba=fixed.copy()
    rgba[:,:,:3]=np.clip(fixed[:,:,:3]+light,0,1)
    rgba[fixed[:,:,3]==0]=0
    frames.append(Image.fromarray(np.uint8(np.rint(rgba*255))))
# Let the final recorded glint die away before returning to the quiet hold.
last=frames[-1]
for i in range(1,6):frames.append(Image.blend(last,poster,i/5))
durations=[10000-round((len(frames)-1)*1000/30)]
durations.extend(round((i+1)*1000/30)-round(i*1000/30) for i in range(len(frames)-1))
assert sum(durations)==10000 and durations[0]>9000
for name,size in [('desktop',(1080,432)),('mobile',(720,288))]:
    images=frames if size==poster.size else [im.resize(size,Image.Resampling.LANCZOS) for im in frames]
    path=out/f'title-{name}.webp'
    images[0].save(path,save_all=True,append_images=images[1:],duration=durations,loop=0,quality=88,method=5,minimize_size=True)
    print(name,path.stat().st_size,'bytes',flush=True)
    check=Image.open(path);total=0;first=None
    for i in range(check.n_frames):
        check.seek(i);check.load();total+=check.info['duration'];alpha=np.asarray(check.getchannel('A'))
        if first is None:first=alpha.copy()
        # WebP delta-frame blending can round an isolated antialiased pixel.
        # Require an identical visible silhouette and bound that rounding.
        assert np.array_equal(first>127,alpha>127),'The logo silhouette must remain fixed'
        assert np.count_nonzero(first!=alpha)<10,'Unexpected alpha changes outside the recorded light'
    assert total==10000
print('Verified: fixed silhouette and one brief gleam per 10-second loop.',flush=True)
