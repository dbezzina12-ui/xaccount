export const isGodUpgrade=(duel,tier)=>tier==='hidden'&&duel.operation==='double'&&!duel.boss;

// A guaranteed double has no opponent to defeat. The token hits the actual
// multiplier badge after a readable hold; the recorded round supplies its
// capped destination value. Turbo keeps a minimum reading window.
export async function presentGodUpgrade({card,duel,onResolve,onReveal,instant=()=>false,pace=1,motions=new Set()}){
 let resolved=false,token;
 const active=new Set();
 const resolve=async()=>{if(!resolved){resolved=true;await onResolve();}};
 const animate=async(node,frames,duration)=>{
  if(instant())return;
  const motion=node.animate(frames,{duration,easing:'cubic-bezier(.2,.75,.25,1)',fill:'forwards'});
  active.add(motion);motions.add(motion);
  try{await motion.finished;}catch{}finally{active.delete(motion);motions.delete(motion);motion.cancel();}
 };
 try{
  if(instant()||duel.from===duel.to){await resolve();return;}
  if(onReveal)await onReveal();
  if(instant()){await resolve();return;}
  const label=card.querySelector('.wild-multiplier');
  if(!label){await resolve();return;}
  token=card.ownerDocument.createElement('span');token.className='god-double-token';token.innerHTML='<b class="god-double-value">2×</b><small class="god-double-caption">BOOST</small>';token.setAttribute('aria-hidden','true');card.append(token);
  const a=card.getBoundingClientRect(),b=label.getBoundingClientRect();
  const dx=b.left+b.width/2-a.left-a.width/2,dy=b.top+b.height/2-a.top-a.height*.44;
  const at='translate(-50%,-50%)';
  await animate(token,[
   {opacity:0,transform:`${at} scale(.58) rotate(-10deg)`,offset:0},
   {opacity:1,transform:`${at} scale(1.12) rotate(-3deg)`,offset:.12},
   {opacity:1,transform:`${at} scale(1) rotate(-3deg)`,offset:.22},
   {opacity:1,transform:`${at} scale(1) rotate(-3deg)`,offset:.80},
   {opacity:1,transform:`${at} scale(1.04) rotate(0deg)`,offset:.85},
   {opacity:0,transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.32)`,offset:1},
  ],Math.max(900,1400*pace));
  token.remove();
  await Promise.all([resolve(),animate(label,[
   {transform:'scale(1)',filter:'brightness(1)'},
   {transform:'scale(1.13)',filter:'brightness(1.65)',offset:.25},
   {transform:'scale(1)',filter:'brightness(1)'},
  ],Math.max(230,320*pace))]);
 }finally{
  token?.remove();for(const motion of active){motions.delete(motion);motion.cancel();}
  await resolve();
 }
}
