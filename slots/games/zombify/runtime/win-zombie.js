import {loadApprovedRig} from './approved-rig.js';
import {paintRig} from './rig-gpu.js';
import {WIN_TIERS} from './win-tiers.js';

const clamp=p=>Math.max(0,Math.min(1,p)),smooth=p=>{p=clamp(p);return p*p*(3-2*p);};
// Monotone cubic Hermite interpolation keeps velocity continuous through
// passing keys, eases at turning points, and never overshoots authored bounds.
function curve(p,keys){
 if(p<=keys[0][0])return keys[0][1];
 const slope=i=>{
  if(i===0||i===keys.length-1)return 0;
  const a=(keys[i][1]-keys[i-1][1])/(keys[i][0]-keys[i-1][0]);
  const b=(keys[i+1][1]-keys[i][1])/(keys[i+1][0]-keys[i][0]);
  return a*b<=0?0:2*a*b/(a+b);
 };
 for(let n=1;n<keys.length;n++)if(p<=keys[n][0]){
  const [a,x]=keys[n-1],[b,y]=keys[n],h=b-a,t=(p-a)/h,t2=t*t,t3=t2*t;
  return (2*t3-3*t2+1)*x+(t3-2*t2+t)*h*slope(n-1)+(-2*t3+3*t2)*y+(t3-t2)*h*slope(n);
 }
 return keys.at(-1)[1];
}
export function zombieWinPose(tier,p){
 p=clamp(p);const r={},t={};
 if(tier==='nice'){
  const wave=curve(p,[[0,0],[.19,1],[.69,1],[.94,0]]);
  r.arm_l=-130*wave;r.forearm_l=-42*wave;r.hand_l=Math.sin(p*Math.PI*6)*10*wave;
  r.head=Math.sin(p*Math.PI*4)*5*Math.sin(Math.PI*p)**2;r.torso=-3*wave;
 }else if(tier==='big'){
  const lift=curve(p,[[0,0],[.12,.1],[.3,1],[.75,1],[1,0]]);
  r.arm_l=-165*lift;r.arm_r=165*lift;r.forearm_l=-14*lift;r.forearm_r=14*lift;
  const jump=curve(p,[[0,0],[.14,-10],[.3,72],[.4,80],[.53,-10],[.62,0],[.73,18],[.84,0],[1,0]]);
  t.body={y:jump};r.head=-6*Math.sin(Math.PI*p);r.thigh_l=-5*lift;r.thigh_r=5*lift;
  r.shin_l=7*lift;r.shin_r=-7*lift;r.boot_l=-2*lift;r.boot_r=2*lift;
 }else if(tier==='epic'){
  const envelope=curve(p,[[0,0],[.12,1],[.82,1],[1,0]]),beat=Math.sin(p*Math.PI*6);
  r.arm_l=-(88+55*beat)*envelope;r.arm_r=(88-55*beat)*envelope;
  r.forearm_l=-30*envelope;r.forearm_r=30*envelope;r.hand_l=beat*14*envelope;r.hand_r=-beat*14*envelope;
  r.torso=beat*6*envelope;r.head=-beat*9*envelope;
  t.body={x:beat*15*envelope,y:beat*beat*7*envelope};
  r.thigh_l=-beat*9*envelope;r.thigh_r=-beat*9*envelope;
  r.shin_l=Math.max(0,beat)**2*16*envelope;r.shin_r=-(Math.max(0,-beat)**2)*16*envelope;
  r.boot_l=-r.thigh_l-r.shin_l;r.boot_r=-r.thigh_r-r.shin_r;
 }else if(tier==='max'){
  const arms=curve(p,[[0,0],[.15,.88],[.26,1],[.37,.4],[.53,.7],[.67,1],[.83,1],[1,0]]);
  r.arm_l=-150*arms;r.arm_r=150*arms;r.forearm_l=-27*arms;r.forearm_r=27*arms;
  const air=clamp((p-.25)/.4),height=Math.sin(air*Math.PI)**2*145;
  t.head={x:Math.sin(air*Math.PI*2)*Math.sin(air*Math.PI)**2*15,y:height};r.head=360*smooth(air);
  t.body={y:curve(p,[[0,0],[.16,-12],[.27,8],[.36,0],[.64,-13],[.74,0],[1,0]])};
 }
 return {rotate:r,translate:t};
}
export function createWinRig(data){
 const animations={};
 for(const [tier,config]of Object.entries(WIN_TIERS)){
  const bones={},steps=Math.ceil(config.duration*60);
  for(let i=0;i<=steps;i++){
   const p=i/steps,time=p*config.duration,values=zombieWinPose(tier,p);
   for(const [bone,angle]of Object.entries(values.rotate))((bones[bone]??={}).rotate??=[]).push({time,angle});
   for(const [bone,xy]of Object.entries(values.translate))((bones[bone]??={}).translate??=[]).push({time,x:xy.x||0,y:xy.y||0});
  }
  for(const channels of Object.values(bones))for(const frames of Object.values(channels))frames.sampleStep=config.duration/steps;
  animations['win_'+tier]={bones};
 }
 // Shared textures/geometry remain immutable; only this presentation owns clips.
 return {...data,animations:{...data.animations,...animations}};
}
let prepared;
function load(){return prepared??=(loadApprovedRig('front').then(rig=>({data:createWinRig(rig.data),images:rig.images})).catch(error=>{prepared=null;throw error;}));}
export const warmWinZombie=({strict=false}={})=>strict?load():load().catch(()=>null);
export function createWinZombie(canvas,fallback,{reduced=false}={}){
 let model=null,dead=false,loading=false;
 const ctx=canvas.getContext('2d');
 function prepare(){if(loading||model||dead)return;loading=true;void load().then(rig=>{if(!dead)model=rig;}).catch(()=>{}).finally(()=>{loading=false;});}
 prepare();
 return {
  draw(tier,progress){
   if(dead||!ctx)return;
   if(!model){prepare();return;}
   const width=canvas.clientWidth,height=canvas.clientHeight;if(!width||!height)return;
   const dpr=Math.min(globalThis.devicePixelRatio||1,2),w=Math.round(width*dpr),h=Math.round(height*dpr);
   if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
   ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,w,h);ctx.setTransform(dpr,0,0,dpr,0,0);
   const top=tier==='max'?720:tier==='big'?670:600,pad=12,scale=Math.min((width-pad*2)/560,(height-pad*2)/top);
   const p=reduced?WIN_TIERS[tier].pose:progress;
   paintRig(ctx,model,'win_'+tier,p*WIN_TIERS[tier].duration,{scale,x:width/2,y:height-pad},width,height,dpr);
   fallback.hidden=true;
  },
  destroy(){dead=true;model=null;ctx?.clearRect(0,0,canvas.width,canvas.height);fallback.hidden=false;}
 };
}
