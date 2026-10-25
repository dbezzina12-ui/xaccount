const NS='http://www.w3.org/2000/svg';
const make=(name,attrs={})=>{const node=document.createElementNS(NS,name);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,value);return node;};
export class ArrowTrail {
 constructor(host){this.host=host;this.finish=null;window.addEventListener('resize',()=>this.finish?.());}
 clear(){this.finish?.();this.host.replaceChildren();}
 play({origin,cells,onHit,turbo=false,skip=()=>false,paused=()=>document.hidden}){
  this.clear();if(!cells.length)return Promise.resolve();
  const fromLeft=origin.x<innerWidth/2,ordered=[...cells].sort((a,b)=>fromLeft?a.index-b.index:b.index-a.index);
  const targets=ordered.map(({element,index})=>{const r=element.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2,index};});
  if(skip()||matchMedia('(prefers-reduced-motion: reduce)').matches){for(const p of targets)onHit(p.index);return Promise.resolve();}
  const last=targets.at(-1),dx=last.x-origin.x,dy=last.y-origin.y,distance=Math.max(1,Math.hypot(dx,dy)),ux=dx/distance,uy=dy/distance,angle=Math.atan2(dy,dx)*180/Math.PI;
  const size=Math.max(86,Math.min(270,cells[0].element.getBoundingClientRect().width*2.6)),travel=distance+size*1.25,duration=turbo?430:900;
  // One ray from the bow through the far target. No entry curve or mid-flight turn.
  for(const p of targets)p.at=Math.max(0,(p.x-origin.x)*ux+(p.y-origin.y)*uy);
  const svg=make('svg',{viewBox:`0 0 ${innerWidth} ${innerHeight}`,width:innerWidth,height:innerHeight});
  const trail=make('path',{d:`M${origin.x} ${origin.y}L${origin.x} ${origin.y}`,class:'arrow-wake','stroke-width':Math.max(4,size*.035)});svg.append(trail);
  const arrow=make('g',{class:'arrow-projectile'});
  arrow.innerHTML='<path d="M-61 -3 L-17 -3 L-17 3 L-61 3Z" fill="#b77b38" stroke="#192b29" stroke-width="2"/><path d="M0 0 L-20 -9 L-15 0 L-20 9Z" fill="#e8fff5" stroke="#143e32" stroke-width="2"/><path d="M-57 -2 L-70 -11 L-82 -11 L-69 -1 L-81 10 L-68 10 L-56 2Z" fill="#47dc9d" stroke="#123d31" stroke-width="2"/><path d="M-65 0 L-19 0" stroke="#ffe8ae" stroke-width="1.5"/>';
  arrow.setAttribute('transform',`translate(${origin.x} ${origin.y}) rotate(${angle}) scale(${size/82})`);
  svg.append(arrow);this.host.append(svg);
  return new Promise(resolve=>{let elapsed=0,prev=performance.now(),frame,hit=0,done=false;
   const finish=()=>{if(done)return;done=true;cancelAnimationFrame(frame);while(hit<targets.length)onHit(targets[hit++].index);this.host.replaceChildren();this.finish=null;resolve();};this.finish=finish;
   const tick=now=>{
    if(!paused())elapsed+=Math.min(60,now-prev);prev=now;if(skip()){finish();return;}
    const p=Math.min(1,elapsed/duration),head=travel*p,tail=Math.max(0,head-size*1.4),x=origin.x+ux*head,y=origin.y+uy*head;
    trail.setAttribute('d',`M${origin.x+ux*tail} ${origin.y+uy*tail}L${x} ${y}`);
    arrow.setAttribute('transform',`translate(${x} ${y}) rotate(${angle}) scale(${size/82})`);
    svg.style.opacity=Math.min(1,(1-p)/.16);
    while(hit<targets.length&&head>=targets[hit].at)onHit(targets[hit++].index);
    if(p>=1){finish();return;}frame=requestAnimationFrame(tick);
   };frame=requestAnimationFrame(tick);
  });
 }
}
