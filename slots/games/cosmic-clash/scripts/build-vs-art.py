"""Build runtime textures from the approved generated VS and DUEL artwork."""
from pathlib import Path
import math
import numpy as np
from PIL import Image

OUT=Path(__file__).resolve().parents[1]/'dist/assets/symbols-v67'
SIZE,COUNT,COLUMNS=256,32,8
source=Image.open(OUT/'duel-panel.webp').convert('RGBA').resize((SIZE,SIZE),Image.Resampling.LANCZOS)
pixels=np.asarray(source).astype(np.float32)
yy,xx=np.mgrid[:SIZE,:SIZE].astype(np.float32)
warm=np.clip((pixels[:,:,0]-pixels[:,:,2]-22)/90,0,1)
edge=np.minimum.reduce([xx,yy,SIZE-1-xx,SIZE-1-yy])
warm*=np.clip((edge/SIZE-11/170)/(6/170),0,1)
warm*=np.clip((abs(yy/SIZE-.5)-.275)/.045,0,1)
atlas=Image.new('RGBA',(SIZE*COLUMNS,SIZE*4))
for frame in range(COUNT):
    phase=frame/COUNT*math.tau
    dx=(2.7*np.sin(yy/SIZE*17-phase*2)+1.1*np.sin(yy/SIZE*39.1+phase*3))*warm*SIZE/170
    dy=4.2*np.sin(xx/SIZE*10.2+yy/SIZE*5.95-phase*2)*warm*SIZE/170
    sx=np.clip(xx+dx,0,SIZE-1);sy=np.clip(yy+dy,0,SIZE-1)
    xa=sx.astype(int);ya=sy.astype(int);xb=np.minimum(xa+1,SIZE-1);yb=np.minimum(ya+1,SIZE-1)
    fx=(sx-xa)[:,:,None];fy=(sy-ya)[:,:,None]
    moved=(pixels[ya,xa]*(1-fx)+pixels[ya,xb]*fx)*(1-fy)+(pixels[yb,xa]*(1-fx)+pixels[yb,xb]*fx)*fy
    moved[:,:,:3]*=(1+warm*(.12*np.sin(phase*3+yy/SIZE*11.05)+.06*np.sin(phase*5+xx/SIZE*8.5)))[:,:,None]
    texture=Image.fromarray(np.uint8(np.clip(moved,0,255)))
    atlas.alpha_composite(texture,((frame%COLUMNS)*SIZE,(frame//COLUMNS)*SIZE))
atlas.save(OUT/'duel-fire-atlas.webp',quality=91,method=6)
keys=['@keyframes vsFireFrames{']
for frame in range(COUNT):
    keys.append(f'{frame/COUNT*100:g}%{{background-position:{frame%COLUMNS/(COLUMNS-1)*100:.6f}% {frame//COLUMNS/3*100:.6f}%}}')
keys.append('100%{background-position:0 0}}\n')
(OUT/'fire-motion.css').write_text(''.join(keys))
poster=Image.new('RGBA',(512,512))
core=source.resize((473,473),Image.Resampling.LANCZOS)
poster.alpha_composite(core,(19,21))
front=Image.open(OUT/'vs-window.webp').convert('RGBA').resize((512,495),Image.Resampling.LANCZOS)
poster.alpha_composite(front,(0,8))
poster.save(OUT/'vs-poster.webp',quality=95,method=6)
print('Built 32-frame fire atlas, CSS timing and closed VS poster.')
