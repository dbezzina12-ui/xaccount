// A slow camera push while the reels tease (S-27). Presentation only: it reads
// the landed scatter count and moves nothing but the individual `scale`
// property of whole scene layers, so every board frame is the selected outcome.
// - From the second FS the scene creeps in about the board's centre; each FS
//   drop punches in a little and steps the push further, as does each reel
//   that lands while the tease continues.
// - The background and mascot move less than the reels and title (depth).
// - It eases back as the last reel lands; Skip, a hidden tab and reduced
//   motion snap it back. The controls are outside the camera and never move.

// Strength of the full push (Hidden tier): the share of the scene's scale.
// Phone reels fill the width: at the full push only the outer steel frame and
// a few pixels of the outer columns leave the screen, briefly.
export const PUSH={phone:.06,desktop:.08,far:.45};
// The creep after each step, by playback speed (ms).
export const CREEP={normal:2990,quick:2300,turbo:1610};
export const RELEASE_MS=380;
// How far the push leans toward the reel still teasing (share of the distance
// from the board centre to that reel), so the reel that matters stays clear of
// the screen edge instead of being pushed off it.
export const LEAN=.35;

// Near-layer scale for `count` landed FS with `landed` reels settled since the
// tease began. 2 FS start at 40% of the push; each tier adds 15%, each landed
// reel 8%; never past the full push.
export function teaseZoom(count,landed,strength){
 if(count<2)return 1;
 const share=Math.min(1,.4+.15*(Math.min(5,count)-2)+.08*Math.max(0,landed));
 return 1+strength*share;
}
// The quick extra push of an FS drop, before the creep resumes.
export const punch=strength=>strength*.22;

export function createTeaseCamera({game,speed='normal',reduced=()=>false,shouldSkip=()=>false}){
 const doc=game?.ownerDocument,view=doc?.defaultView;
 // Only the Studio/Play scene has separable layers; the standalone room keeps
 // its own reel-stage zoom.
 const background=game?.querySelector(':scope > .studio-background'),near=game?.querySelector(':scope > .play-area');
 if(!background||!near||typeof near.animate!=='function')return {push(){},release(){return Promise.resolve();},snap(){},active:()=>false};
 const far=[background,...game.querySelectorAll(':scope > .scene-mascot')];
 const strength=view.innerWidth<view.innerHeight?PUSH.phone:PUSH.desktop;
 const creep=CREEP[speed]??CREEP.normal;
 let layers=null,running=[],level=1,lean=0,releasing=null,centre=0,columns=[];
 // Each layer animates its own `scale` and `translate`; read them back so a
 // new step always starts exactly where the last one got to.
 const read=el=>{const c=view.getComputedStyle(el),sc=parseFloat(c.scale),tx=parseFloat(c.translate);return {scale:Number.isFinite(sc)?sc:1,x:Number.isFinite(tx)?tx:0};};
 // Fix every layer's origin on the board centre, measured once at scale 1.
 function mount(){
  if(layers)return layers;
  const board=game.querySelector('.board-wrap'),cells=game.querySelector('#board')?.children,b=board?.getBoundingClientRect();
  if(!b)return null;
  centre=b.left+b.width/2;const cy=b.top+b.height/2;
  columns=Array.from({length:6},(_,i)=>{const r=cells?.[i]?.getBoundingClientRect();return r?r.left+r.width/2:centre;});
  layers=[...far.map(el=>({el,depth:PUSH.far})),{el:near,depth:1}].map(layer=>{
   const r=layer.el.getBoundingClientRect(),origin=layer.el.style.transformOrigin;
   layer.el.style.transformOrigin=`${centre-r.left}px ${cy-r.top}px`;
   return {...layer,origin};
  });
  return layers;
 }
 // A layer's frame for a scene zoom and lean: scaling about the board centre,
 // shifted so the scene scales about a point `lean` px toward the teasing reel.
 const frame=({depth},zoom,shift,extra={})=>{const z=(zoom-1)*depth;return {scale:String(1+z),translate:`${-shift*z}px 0px`,...extra};};
 function cancel(){for(const a of running)a.cancel();running=[];}
 function snap(){
  releasing=null;cancel();level=1;lean=0;
  if(layers)for(const {el,origin} of layers)el.style.transformOrigin=origin;
  layers=null;
 }
 // Play `stops` (scene zoom, lean, offset, easing) from where each layer is.
 function play(stops,duration){
  const from=layers.map(({el})=>read(el));
  cancel();
  running=layers.map((layer,i)=>layer.el.animate([{scale:String(from[i].scale),translate:`${from[i].x}px 0px`,easing:stops[0].easing},...stops.map(({zoom,shift,offset,easing})=>frame(layer,zoom,shift,{...(offset!==undefined?{offset}:{}),...(easing?{easing}:{})}))],{duration,easing:'linear',fill:'forwards'}));
 }
 // Step to the zoom for the landed count, leaning toward reel `focus`; an FS
 // `drop` punches in first.
 function push({count,landed=0,drop=false,focus}){
  if(reduced()||shouldSkip()||doc.hidden){snap();return;}
  if(releasing||!mount())return;
  const target=teaseZoom(count,landed,strength);
  if(target<=1)return;
  // Keep creeping in past the next landing, so the push never stalls while a
  // reel is still teasing; the next settle starts from wherever it got to.
  const ahead=teaseZoom(count,landed+3,strength),zoom=read(near).scale;
  lean=focus>=0&&focus<6?LEAN*(columns[focus]-centre):lean;
  const base=Math.max(target,zoom),kick=base+punch(strength);
  level=Math.max(ahead,drop?base+punch(strength)*.25:zoom);
  play(drop
   ?[{zoom:kick,shift:lean,offset:.09,easing:'cubic-bezier(.2,.9,.3,1)'},{zoom:base+punch(strength)*.25,shift:lean,offset:.3,easing:'cubic-bezier(.3,0,.4,1)'},{zoom:level,shift:lean}]
   :[{zoom:level,shift:lean,easing:'cubic-bezier(.25,.1,.25,1)'}],creep);
 }
 // Ease back to scale 1 and no lean. A secured Outbreak gives one last small
 // push first. Resolves when every layer is back, the origins restored.
 function release({secured=false}={}){
  if(releasing)return releasing;
  if(!layers||level<=1||reduced()||shouldSkip()||doc.hidden){snap();return Promise.resolve();}
  const zoom=read(near).scale;
  play(secured
   ?[{zoom:Math.max(level,zoom)+punch(strength)*.6,shift:lean,offset:.3,easing:'cubic-bezier(.4,0,.2,1)'},{zoom:1,shift:0}]
   :[{zoom:1,shift:0,easing:'cubic-bezier(.4,0,.2,1)'}],secured?RELEASE_MS+120:RELEASE_MS);
  const done=Promise.all(running.map(a=>a.finished.catch(()=>{})));
  // Bounded: a throttled or hidden tab must never hold up the round.
  const settled=Promise.race([done,new Promise(r=>setTimeout(r,RELEASE_MS+600))]).then(()=>{if(releasing===settled)snap();});
  releasing=settled;
  return settled;
 }
 return {push,release,snap,active:()=>!!layers};
}
