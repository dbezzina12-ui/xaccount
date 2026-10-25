import {pose,multiply,slotAttachment} from './approved-rig-renderer.js';

export function attachmentGeometry(art,world,bones,bone){
 if(art.type==='mesh'){
  const xy=[];let o=0;
  for(let i=0;i<art.uvs.length/2;i++){
   const count=art.vertices[o++];let x=0,y=0;
   for(let j=0;j<count;j++){
    const index=art.vertices[o++],vx=art.vertices[o++],vy=art.vertices[o++],weight=art.vertices[o++],m=world[bones[index].name];
    x+=(m[0]*vx+m[2]*vy+m[4])*weight;y+=(m[1]*vx+m[3]*vy+m[5])*weight;
   }
   xy.push(x,y);
  }
  return {xy,uv:art.uvs,indices:art.triangles};
 }
 const a=(art.rotation||0)*Math.PI/180,m=multiply(world[bone],[Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),art.x||0,art.y||0]);
 const xy=[];
 for(const[x,y]of[[-.5,.5],[.5,.5],[.5,-.5],[-.5,-.5]])xy.push(m[0]*x*art.width+m[2]*y*art.height+m[4],m[1]*x*art.width+m[3]*y*art.height+m[5]);
 return {xy,uv:[0,0,1,0,1,1,0,1],indices:[0,1,2,0,2,3]};
}
export function rigBounds(data,clip,time=0){
 if(time===0&&data.presentation?.bounds?.[clip])return data.presentation.bounds[clip];
 const world=pose(data,clip,time),skin=data.skins[0].attachments;
 let left=Infinity,right=-Infinity,bottom=Infinity,top=-Infinity;
 for(const slot of data.slots){
  const name=slotAttachment(data,clip,slot,time),art=skin[slot.name]?.[name];if(!art)continue;
  const {xy}=attachmentGeometry(art,world,data.bones,slot.bone);
  for(let i=0;i<xy.length;i+=2){left=Math.min(left,xy[i]);right=Math.max(right,xy[i]);bottom=Math.min(bottom,xy[i+1]);top=Math.max(top,xy[i+1]);}
 }
 return {left,right,bottom,top,width:right-left,height:top-bottom};
}
export function fitRig(data,clip,width,height,{horizontal=false,time=0,padding=.04}={}){
 const b=rigBounds(data,clip,time),usableH=height*(1-padding*2);
 // One uniform scale. Tall claims are a window onto the character, never a stretch.
 const scale=horizontal?Math.min(width*(1-padding*2)/b.width,usableH/b.height):usableH/b.height;
 return {scale,x:width/2-(b.left+b.right)*scale/2,y:height*(1-padding)+b.bottom*scale,bounds:b};
}
export function stepPlan(rigs,source,target,direction){
 if(direction==='down'){
  const data=rigs.front.data,clip='jump_land',b=rigBounds(data,'idle'),impact=data.animations[clip].events.find(e=>e.name==='impact').time,landing=rigBounds(data,clip,impact);
  const scale=source.height*.9/b.height,centre=r=>({x:r.x+r.width/2-(b.left+b.right)*scale/2,y:r.y+r.height*.96+b.bottom*scale});
  return {view:'front',action:'jump',clip,rest:'idle',contact:impact,scale,rotation:0,start:centre(source),strike:{x:target.x+target.width/2-(b.left+b.right)*scale/2,y:target.y+target.height/2+landing.bottom*scale},end:centre(target)};
 }
 const horizontal=direction==='left'||direction==='right',up=direction==='up';
 const view=up?'rear':'side',data=rigs[view].data,face=horizontal?direction:'right';
 const clip=up?'giant_overhead_back':`crawl_swat_${face}`;
 const rest=up?'idle_back':`crawl_hold_${face}`;
 const move=up?'walk_up':`crawl_${face}`;
 let contact=data.animations[clip].events.find(e=>e.name==='swat_contact').time;
 const b=rigBounds(data,rest,0);
 if(up){
  // Meet the block during the leftward sweep, without moving the body sideways.
  let lo=.62,hi=contact;
  for(let i=0;i<32;i++){const mid=(lo+hi)/2;if(pose(data,clip,mid).contact_r[4]>(b.left+b.right)/2)lo=mid;else hi=mid;}
  contact=(lo+hi)/2;
 }
 const hand=pose(data,clip,contact).contact_r;
 let scale=source.height*.9/b.height;
 if(up)scale=(source.y+source.height-(target.y+target.height*.5))/(hand[5]-b.bottom);
 const end={x:target.x+target.width/2-(b.left+b.right)*scale/2,y:target.y+target.height*.96+b.bottom*scale};
 const start={x:source.x+source.width/2-(b.left+b.right)*scale/2,y:source.y+source.height*(up?1:.96)+b.bottom*scale};
 // Feet stay on the floor line through the swat: lining the hand up with the
 // block's centre dropped the whole body about a sixth of a cell into it.
 const strike=up?{...start}:{x:target.x+target.width/2-hand[4]*scale,y:start.y};
 // A small lean into the lunge, toward the block; none when turning to climb.
 const lean=horizontal?(direction==='left'?-1:1)*LEAN:0;
 return {view,action:up?'turn-swat':'crawl',clip,rest,move,contact,scale,rotation:0,lean,start,strike,end};
}

// Motion timing shared by the animator and its tests (seconds of clip time).
export const APPROACH=.18,RECOVER=.46,LEAN=.055,HIT_STOP=.055;
const smooth=p=>{p=Math.max(0,Math.min(1,p));return p*p*(3-2*p);};
const mix=(a,b,p)=>a+(b-a)*p;
// The body's path for a horizontal or upward step: the lunge to the block
// (leaning in, upright again on contact) and the recovery into its cell.
export function stepPath(plan){
 return {
  approach:t=>{const p=smooth(t/APPROACH);return {x:mix(plan.start.x,plan.strike.x,p),y:mix(plan.start.y,plan.strike.y,p),rotation:(plan.lean||0)*Math.sin(Math.PI*Math.min(1,Math.max(0,t/APPROACH)))};},
  recover:t=>{const p=smooth(t/RECOVER);return {x:mix(plan.strike.x,plan.end.x,p),y:mix(plan.strike.y,plan.end.y,p),rotation:0};},
 };
}
// A hit-stop: the clip holds its pose for `hold` at `at`, then carries on.
// Returns the longer duration, the clip time for each moment, and the events
// with those after the hold moved later.
export function holdAt({duration,events=[]},at,hold){
 return {
  duration:duration+hold,
  time:t=>t<at?t:t<at+hold?at:t-hold,
  events:events.map(e=>e.time>at?{...e,time:e.time+hold}:e),
 };
}
// A jump: still until takeoff, then a ballistic arc that is fastest as it
// lands. `lift` raises the apex above the higher of the two points.
export function jumpArc(start,end,{takeoff,land,lift},time){
 if(time<=takeoff)return {x:start.x,y:start.y};
 const p=Math.min(1,(time-takeoff)/(land-takeoff));
 const top=Math.min(start.y,end.y)-lift,peak=Math.max(.05,Math.min(.95,Math.sqrt(Math.max(0,start.y-top))/(Math.sqrt(Math.max(0,start.y-top))+Math.sqrt(Math.max(0,end.y-top)))));
 // Two gravity parabolas joined at the apex: rising to it, then falling.
 const y=p<peak?top+(start.y-top)*(1-p/peak)**2:top+(end.y-top)*((p-peak)/(1-peak))**2;
 return {x:mix(start.x,end.x,p),y};
}

export function stepEvents(data,plan){
 return data.animations[plan.clip].events.map(e=>e.name==='swat_contact'?{...e,time:plan.contact}:e);
}
export function downwardJumpPose(plan,time){
 const blend=(a,b,p)=>({x:a.x+(b.x-a.x)*p,y:a.y+(b.y-a.y)*p});
 // Still until the authored takeoff, a short arc that lands fast on the block,
 // then drop into its empty cell.
 if(time<=plan.contact)return jumpArc(plan.start,plan.strike,{takeoff:.43,land:plan.contact,lift:plan.scale*24},time);
 return blend(plan.strike,plan.end,smooth((time-plan.contact-.18)/.5));
}
