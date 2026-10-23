import {loadImage} from './asset-cache.js';
import {TITLE_SIGN} from './title-peek-pose.js';

// The sign and its peeking zombie are a single stationary composition.
// Draw once into the existing traced O opening: no animation or idle timers.
const title=document.querySelector('.peek-title');
const canvas=document.getElementById('zombify-title-peek');
async function paintTitle(){
 if(!title||!canvas)return;
 const head=await loadImage('assets/approved-rig/front/images/head.png');
 const ctx=canvas.getContext('2d');if(!ctx)return;
 canvas.width=TITLE_SIGN.width;canvas.height=TITLE_SIGN.height;
 const o=TITLE_SIGN.opening,b=o.bounds;
 ctx.save();ctx.clip(new Path2D(o.path));
 const width=200,height=width*head.naturalHeight/head.naturalWidth;
 ctx.drawImage(head,o.x-width/2,o.y-12-height/2,width,height);
 ctx.globalCompositeOperation='source-atop';
 const shade=ctx.createRadialGradient(o.x,o.y,38,o.x,o.y,83);
 shade.addColorStop(0,'rgba(2,12,20,0)');shade.addColorStop(.72,'rgba(2,12,20,.02)');shade.addColorStop(1,'rgba(2,12,20,.42)');
 ctx.fillStyle=shade;ctx.fillRect(b.x,b.y,b.width,b.height);ctx.restore();
 title.classList.add('peeking');
}
void paintTitle().catch(()=>{/* The painted wordmark remains if the decorative head cannot decode. */});
