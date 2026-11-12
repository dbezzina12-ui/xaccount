// Native exported timelines + production reveal geometry/effects; no browser substitute.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {createRequire} from 'node:module';
import {Spine,instance,drawRig} from '../dist/animation/renderer.mjs?v=97';
import {vsReelGeometry,createVsReelModifier,vsPlateMotion,drawVsFight,drawVsSweep,drawVsFrame} from '../dist/animation/vs-reel-opening.mjs';
const require=createRequire(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'../package.json'));
const {createCanvas,loadImage,GlobalFonts}=require('@napi-rs/canvas');
const fonts='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';if(fs.existsSync(fonts))GlobalFonts.registerFromPath(fonts,'sans-serif');
const root=new URL('../dist/',import.meta.url),base=new URL('assets/spine-v97/vs-symbol/',root);
const json=JSON.parse(fs.readFileSync(new URL('vs-symbol.json',base))),atlas=new Spine.TextureAtlas(fs.readFileSync(new URL('parts.atlas',base),'utf8'));
const textures=new Map();for(const p of atlas.pages)textures.set(p.name,await loadImage(new URL(p.name,base)));
const asset={data:new Spine.SkeletonJson(new Spine.AtlasAttachmentLoader(atlas)).readSkeletonData(json),textures};
const out=path.resolve(process.argv[2]||'../vs-burst-review');fs.mkdirSync(out,{recursive:true});
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'cosmic-burst-'));
const art={};for(const [key,file] of [['letters','cel-duel-letter-atlas.png'],['premiums','cel-premium-atlas.png']])art[key]=await loadImage(new URL('assets/'+file,root));
const decode=spawnSync('ffmpeg',['-y','-loglevel','error','-i',new URL('assets/duel-v73/hunter-loses.mp4',root).pathname,'-t','2.5','-vf','fps=24',path.join(temp,'%03d.png')],{encoding:'utf8'});if(decode.status)throw Error(decode.stderr);
const frames=await Promise.all(fs.readdirSync(temp).sort().map(n=>loadImage(path.join(temp,n))));
const reels=[0,4,2,6,1,5,2,7,0,3,3,1,4,6,0,4,7,2,5,1,2,0,5,3,6];
const canvas=createCanvas(1152,736),ctx=canvas.getContext('2d');
const sides=[0,1].map(i=>{const rig=instance(asset),reel={left:240+i*576,top:132,width:96,height:480},symbol={left:reel.left+3,top:reel.top+2*96+3,width:90,height:90};const g=vsReelGeometry({reel,symbol});return {rig,g,modifier:createVsReelModifier({skeleton:rig.skeleton,geometry:g})};});
function plate(ctx,x,y,w,h,value,accent,scale,alpha,originBottom=false){
 ctx.save();ctx.globalAlpha=alpha;ctx.translate(x+w/2,y+(originBottom?h:0));ctx.scale(scale,scale);ctx.translate(-w/2,originBottom?-h:0);
 ctx.beginPath();ctx.moveTo(6,0);ctx.lineTo(w-6,0);ctx.lineTo(w,6);ctx.lineTo(w,h-6);ctx.lineTo(w-6,h);ctx.lineTo(6,h);ctx.lineTo(0,h-6);ctx.lineTo(0,6);ctx.closePath();
 ctx.fillStyle='#142936';ctx.fill();ctx.lineWidth=2;ctx.strokeStyle=accent;ctx.stroke();ctx.fillStyle='#fff5df';ctx.textAlign='center';ctx.font='800 34px sans-serif';ctx.shadowColor='#000';ctx.shadowBlur=2;ctx.fillText(value,w/2,h-8);ctx.restore();
}
function draw(t){
 ctx.fillStyle='#09141e';ctx.fillRect(0,0,1152,736);
 ctx.textAlign='left';ctx.fillStyle='#f6ead2';ctx.font='bold 27px sans-serif';ctx.fillText('COSMIC CLASH  /  VS OPENING',38,44);
 for(let i=0;i<2;i++){
  const {rig,g,modifier}=sides[i],phase=Math.max(0,(t-.55)*(i?.5:1)),elapsed=Math.min(.66,phase),x0=48+i*576;
  rig.skeleton.setupPose();rig.state.clearTracks();rig.state.setAnimation(0,'open',false);rig.state.update(elapsed);rig.state.apply(rig.skeleton);modifier.afterApply();rig.skeleton.updateWorldTransform(Spine.Physics.none);
  ctx.fillStyle='#aac0ce';ctx.font='18px sans-serif';ctx.fillText(i?'HALF SPEED':'NORMAL SPEED',x0,96);
  ctx.fillStyle='#9a7550';ctx.fillRect(x0-4,128,488,488);
  for(let j=0;j<25;j++){
   const x=x0+j%5*96,y=132+Math.floor(j/5)*96,index=reels[j],tex=index<4?art.letters:art.premiums,cell=index%4;
   ctx.fillStyle='#08131b';ctx.fillRect(x+1,y+1,94,94);if(j===12)continue;
   ctx.drawImage(tex,cell%2*tex.width/2,Math.floor(cell/2)*tex.height/2,tex.width/2,tex.height/2,x+8,y+8,80,80);
  }
  const w=modifier.window(),frame=frames[Math.min(frames.length-1,Math.floor(Math.max(0,phase-.60)*1.4*24))];
  ctx.save();ctx.beginPath();ctx.rect(g.reel.left,g.reel.top,g.reel.width,g.reel.height);ctx.clip();
  ctx.save();ctx.beginPath();ctx.rect(w.left,w.top,w.width,w.height);ctx.clip();
  drawVsFight(ctx,frame,g.reel,w);
  const h=44,move=vsPlateMotion({height:g.reel.height,windowTop:w.top-g.reel.top,windowHeight:w.height,plateHeight:h,progress:modifier.progress});
  plate(ctx,g.reel.left+4,g.reel.top+3.6+move.top,88,h,'5×','#ffc275',move.scale,move.alpha);
  plate(ctx,g.reel.left+4,g.reel.top+g.reel.height-3.6-h+move.bottom,88,h,'3×','#70e5fa',move.scale,move.alpha,true);
  ctx.restore();
  ctx.save();ctx.beginPath();ctx.rect(g.reel.left,g.reel.top,g.reel.width,g.reel.height);if(w.height>0)ctx.rect(w.left,w.top,w.width,w.height);ctx.clip('evenodd');drawRig(ctx,rig,{x:g.center.x,y:g.center.y,scale:g.scale});ctx.restore();
  drawVsSweep(ctx,{x:g.center.x,y:g.center.y,size:g.size,time:elapsed});drawVsFrame(ctx,w,elapsed);ctx.restore();
 }
 ctx.fillStyle='#9caebc';ctx.font='17px sans-serif';ctx.fillText('Native Spine export + game reveal effects · Existing fight footage',38,674);
 ctx.fillStyle='#ffdb9d';ctx.fillText('Punch → sweep → expanding frame',38,704);
}
try{
 const fps=60,total=4.2,mp4=path.join(out,'Cosmic-Clash-VS-Opening.mp4');
 const ff=spawn('ffmpeg',['-y','-loglevel','error','-f','rawvideo','-pixel_format','rgba','-video_size','1152x736','-framerate',String(fps),'-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',mp4],{stdio:['pipe','inherit','inherit']});
 const done=once(ff,'exit');
 for(let n=0;n<fps*total;n++){draw(n/fps);if(!ff.stdin.write(canvas.data()))await once(ff.stdin,'drain');}
 ff.stdin.end();const [code]=await done;if(code)throw Error('Video encode failed');
 for(const t of [.55,.69,.81,.89,1.05]){draw(t);fs.writeFileSync(path.join(out,`frame-${Math.round(t*100)}.png`),canvas.toBuffer('image/png'));}
 console.log(mp4);
}finally{fs.rmSync(temp,{recursive:true,force:true});}
