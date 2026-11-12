// Reel and symbol rectangles share screen coordinates. The fight stays at its
// final size while the reveal window grows from the landed VS to both reel ends.
export function vsReelGeometry({reel,symbol,sourceSize=1254}){
 for(const rect of [reel,symbol]){
  if(!rect||!['left','top','width','height'].every(k=>Number.isFinite(rect[k]))||rect.width<=0||rect.height<=0)throw Error('Invalid VS rectangle.');
 }
 if(!Number.isFinite(sourceSize)||sourceSize<=0)throw Error('Invalid VS source size.');
 const size=Math.min(symbol.width,symbol.height,reel.width),scale=size/sourceSize;
 const center={x:symbol.left+symbol.width/2,y:symbol.top+symbol.height/2};
 if(center.x-size/2<reel.left-.001||center.x+size/2>reel.left+reel.width+.001||center.y-size/2<reel.top-.001||center.y+size/2>reel.top+reel.height+.001)throw Error('VS must be inside its reel.');
 return {reel:{...reel},center,size,scale,upperTravel:(center.y-reel.top)/scale,lowerTravel:(reel.top+reel.height-center.y)/scale};
}

export function vsRevealWindow(geometry,progress){
 const p=Math.max(0,Math.min(1,progress)),{reel,center,scale,upperTravel,lowerTravel}=geometry;
 const top=center.y-upperTravel*scale*p,bottom=center.y+lowerTravel*scale*p;
 return {left:reel.left,top,width:reel.width,height:bottom-top};
}

// A native Spine control bone owns the expansion timing. The same pose drives
// the video mask, luminous frame and travelling multiplier plates.
export function createVsReelModifier({skeleton,geometry,progressSourcePixels=1000}){
 if(!Number.isFinite(progressSourcePixels)||progressSourcePixels<=0)throw Error('Invalid VS progress range.');
 const control=skeleton.findBone('reveal_progress');
 if(!control)throw Error('Expected VS reveal control bone.');
 let progress=0;
 return {
  afterApply(){
   progress=Math.max(0,Math.min(1,(control.pose.x-control.data.setupPose.x)/progressSourcePixels));
  },
  get progress(){return progress;},
  window(){return vsRevealWindow(geometry,progress);}
 };
}

export function vsPlateMotion({height,windowTop,windowHeight,plateHeight,progress}){
 // Keep both plates separate even during the first thin sliver of the reveal.
 const scale=Math.min(1,Math.max(.25,windowHeight/(plateHeight*2+12)));
 return {top:windowTop,bottom:windowTop+windowHeight-height,scale,alpha:Math.max(0,Math.min(1,(progress-.08)/.25))};
}

// Sample the two ends of the SAME decoded video frame. Each half translates
// with its moving edge at the final object-fit:cover scale. At full height the
// samples join exactly into the untouched video; no character is stretched.
export function drawVsFight(ctx,source,reel,window,{flipped=false}={}){
 const sw=source.videoWidth||source.width,sh=source.videoHeight||source.height;
 if(!sw||!sh||window.height<=0)return;
 const scale=Math.max(reel.width/sw,reel.height/sh),width=sw*scale,height=sh*scale;
 const x=reel.left+(reel.width-width)/2,y=reel.top+(reel.height-height)/2;
 for(let half=0;half<2;half++){
  const shift=half?window.top+window.height-reel.top-reel.height:window.top-reel.top;
  ctx.save();ctx.beginPath();ctx.rect(window.left,window.top+half*window.height/2,window.width,window.height/2);ctx.clip();
  if(flipped){ctx.translate(reel.left+reel.width/2,reel.top+reel.height/2+shift);ctx.rotate(Math.PI);ctx.drawImage(source,-width/2,-height/2,width,height);}
  else ctx.drawImage(source,x,y+shift,width,height);
  ctx.restore();
 }
}

// Abstract energy effect, shared by the actual game and the offline review.
export function drawVsSweep(ctx,{x,y,size,time}){
 const p=(time-.055)/.33;if(p<=0||p>=1)return;
 const alpha=Math.sin(p*Math.PI),angle=-2.6+p*5.4;
 ctx.save();ctx.translate(x,y);ctx.scale(1,.44);ctx.rotate(-.35);
 ctx.lineCap='round';ctx.globalCompositeOperation='lighter';
 for(let i=0;i<14;i++){
  const a=angle-i*.085;ctx.globalAlpha=alpha*(1-i/14);
  ctx.lineWidth=Math.max(.7,size*.022*(1-i/16));ctx.strokeStyle=i<3?'#fffce0':'#ffb846';
  ctx.shadowColor='#ff6e2e';ctx.shadowBlur=size*.025;
  ctx.beginPath();ctx.arc(0,0,size*.59,a-.10,a+.035);ctx.stroke();
 }
 ctx.restore();
}

export function drawVsFrame(ctx,{left,top,width,height},time){
 if(height<.5)return;
 const pulse=Math.max(0,1-Math.abs(time-.30)/.15)+Math.max(0,1-Math.abs(time-.50)/.10)*.55;
 ctx.save();ctx.lineJoin='miter';ctx.strokeStyle='#ffdfa0';ctx.lineWidth=1.5;
 ctx.shadowColor='#ff9e3b';ctx.shadowBlur=3+pulse*9;
 ctx.strokeRect(left+1.25,top+1.25,width-2.5,Math.max(0,height-2.5));
 ctx.shadowBlur=0;ctx.strokeStyle='#8c3d1e';ctx.lineWidth=1;
 if(height>6)ctx.strokeRect(left+3,top+3,width-6,height-6);
 // A short bright edge pulse marks the expansion and its final landing.
 if(pulse>0){ctx.globalAlpha=pulse;ctx.fillStyle='#fff7d8';ctx.fillRect(left+2,top+1,width-4,2);ctx.fillRect(left+2,top+height-3,width-4,2);}
 ctx.restore();
}
