// Canvas overlay, independent of Spine rendering. Coordinates are screen pixels.
// Spawn from the driver's onShot callback AFTER its world-transform update.
export function createShotEffects(){
 let shots=[];
 return {
  spawn({muzzle,target,color='#ffce69',followMuzzle}){
   if(![muzzle.x,muzzle.y,muzzle.angle,target.x,target.y].every(Number.isFinite))throw Error('Invalid shot effect coordinates.');
   shots.push({muzzle:{...muzzle},target:{...target},color,followMuzzle,age:0});
  },
  update(dt){for(const s of shots)s.age+=Math.max(0,dt);shots=shots.filter(s=>s.age<.62);},
  clear(){shots=[];},
  get count(){return shots.length;},
  draw(ctx){for(const s of shots){
   const t=s.age,m=s.muzzle;
   if(t<.075){
    const flash=s.followMuzzle?.()||m;const fade=1-t/.075;ctx.save();ctx.translate(flash.x,flash.y);ctx.rotate(flash.angle);ctx.globalAlpha=fade;ctx.globalCompositeOperation='lighter';
    const g=ctx.createRadialGradient(9,0,1,9,0,31);g.addColorStop(0,'#fffce4');g.addColorStop(.25,s.color);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(-23,-33,70,66);
    ctx.fillStyle='#fff6cf';ctx.beginPath();ctx.moveTo(-2,-4);ctx.lineTo(17,-6);ctx.lineTo(42,0);ctx.lineTo(18,5);ctx.lineTo(-2,4);ctx.closePath();ctx.fill();ctx.restore();
   }
   // Brief drifting smoke stays at the fired muzzle position, not attached to recoil.
   if(t>.035){ctx.save();ctx.globalAlpha=.22*Math.max(0,1-t/.62);ctx.fillStyle='#aab7c4';for(let i=0;i<3;i++){const d=t*(18+i*9);ctx.beginPath();ctx.ellipse(m.x+Math.cos(m.angle)*d+i*3,m.y+Math.sin(m.angle)*d-t*28-i*3,3+t*(10+i*3),2+t*(9+i*2),0,0,Math.PI*2);ctx.fill();}ctx.restore();}
   const hit=t-.025;
   if(hit>=0&&hit<.34){ctx.save();ctx.translate(s.target.x,s.target.y);ctx.globalCompositeOperation='lighter';ctx.globalAlpha=1-hit/.34;ctx.strokeStyle=s.color;ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(0,0,5+hit*65,0,Math.PI*2);ctx.stroke();for(let i=0;i<7;i++){const a=i*Math.PI*2/7+.17,r=8+hit*85;ctx.beginPath();ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r);ctx.lineTo(Math.cos(a)*(r+7),Math.sin(a)*(r+7));ctx.stroke();}ctx.restore();}
  }}
 };
}

export function rigShotToCanvas({muzzle,target},actorRect,manifest,overlayRect={left:0,top:0}){
 const [width,height]=manifest.canvas||[1024,1536],scaleX=actorRect.width/width,scaleY=actorRect.height/height;
 if(!(scaleX>0&&scaleY>0))throw Error('Character viewport is hidden.');
 const point=p=>({x:actorRect.left-overlayRect.left+(p.x+manifest.origin[0])*scaleX,y:actorRect.top-overlayRect.top+(manifest.origin[1]-p.y)*scaleY});
 return {muzzle:{...point(muzzle),angle:Math.atan2(-Math.sin(muzzle.angle)*scaleY,Math.cos(muzzle.angle)*scaleX)},target:point(target)};
}
