const NS='http://www.w3.org/2000/svg';
const make=(name,attrs={})=>{const node=document.createElementNS(NS,name);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,value);return node;};
// The mage's zap: one violet bolt with an ivory core from the staff's crystal
// straight to the engine's chosen cell, then a compact spark inside that cell.
// The bolt stays on the crystal (`source`) as the staff bounces after its
// impact. The wild is revealed (`onHit`) when the bolt lands. The bolt's kinks
// are a fixed function of the cell, so nothing here is random.
export const BOLT={travel:150,spark:210,turboTravel:90,turboSpark:140};
export class MageBolt {
 constructor(host){this.host=host;this.finish=null;this.last=null;window.addEventListener('resize',()=>this.finish?.());}
 clear(){this.finish?.();this.host.replaceChildren();}
 play({origin,source=()=>origin,index,element,onHit,turbo=false,skip=()=>false,paused=()=>document.hidden}){
  this.clear();
  const r=element.getBoundingClientRect(),target={x:r.left+r.width/2,y:r.top+r.height/2},half=Math.min(r.width,r.height)/2;
  this.last={index,origin:{...origin},target};
  if(skip()||matchMedia('(prefers-reduced-motion: reduce)').matches){onHit();return Promise.resolve();}
  // Eight kinks, widest mid-way, none at either end.
  const path=from=>{
   const dx=target.x-from.x,dy=target.y-from.y,distance=Math.max(1,Math.hypot(dx,dy)),nx=-dy/distance,ny=dx/distance,amp=Math.min(16,distance*.05),points=[[from.x,from.y]];
   for(let k=1;k<8;k++){const t=k/8,off=amp*Math.sin(Math.PI*t)*Math.sin((index+1)*1.7+k*2.3);points.push([from.x+dx*t+nx*off,from.y+dy*t+ny*off]);}
   points.push([target.x,target.y]);
   return 'M'+points.map(([x,y])=>`${x.toFixed(1)} ${y.toFixed(1)}`).join('L');
  };
  const d=path(origin);
  const svg=make('svg',{viewBox:`0 0 ${innerWidth} ${innerHeight}`,width:innerWidth,height:innerHeight,class:'mage-bolt','data-cell':index});
  const width=Math.max(3,half*.13),layers=[['bolt-glow',width*3.2],['bolt-arc',width*1.6],['bolt-core',width*.7]].map(([cls,w])=>make('path',{d,class:cls,'stroke-width':w.toFixed(2)}));
  const spark=make('g',{class:'bolt-spark',transform:`translate(${target.x} ${target.y})`,opacity:0});
  // The spark stays inside the cell: glow, ring and rays end within 92% of its half-width.
  const glow=make('circle',{r:0,class:'spark-glow'}),ring=make('circle',{r:0,class:'spark-ring','stroke-width':Math.max(2,half*.1)});spark.append(glow,ring);
  const rays=[...Array(6)].map((_,k)=>{const a=k*Math.PI/3+.4,ray=make('path',{class:'spark-ray','stroke-width':Math.max(2,half*.09),d:''});ray.angle=a;spark.append(ray);return ray;});
  svg.append(...layers,spark);this.host.append(svg);
  const draw=(d,p)=>{for(const layer of layers)layer.setAttribute('d',d);const length=layers[0].getTotalLength();for(const layer of layers){layer.style.strokeDasharray=`${length} ${length}`;layer.style.strokeDashoffset=length*(1-p);}};
  draw(d,0);
  const travel=turbo?BOLT.turboTravel:BOLT.travel,sparkTime=turbo?BOLT.turboSpark:BOLT.spark;
  return new Promise(resolve=>{let elapsed=0,prev=performance.now(),frame,hit=false,done=false;
   const land=()=>{if(!hit){hit=true;onHit();}};
   const finish=()=>{if(done)return;done=true;cancelAnimationFrame(frame);land();this.host.replaceChildren();this.finish=null;resolve();};this.finish=finish;
   const tick=now=>{
    if(!paused())elapsed+=Math.min(60,now-prev);prev=now;if(skip()){finish();return;}
    const from=source(),p=Math.min(1,elapsed/travel);this.last.origin={...from};draw(path(from),p);
    if(p>=1){
     land();const s=Math.min(1,(elapsed-travel)/sparkTime),grow=1-(1-s)**2,fade=1-s*s;
     for(const layer of layers)layer.style.opacity=Math.max(0,1-s*2.2);
     spark.setAttribute('opacity',fade.toFixed(3));ring.setAttribute('r',(half*.86*grow).toFixed(2));glow.setAttribute('r',(half*(.45+.3*grow)).toFixed(2));
     for(const ray of rays){const a=half*.35*grow,b=half*.92*grow;ray.setAttribute('d',`M${(Math.cos(ray.angle)*a).toFixed(1)} ${(Math.sin(ray.angle)*a).toFixed(1)}L${(Math.cos(ray.angle)*b).toFixed(1)} ${(Math.sin(ray.angle)*b).toFixed(1)}`);}
     if(s>=1){finish();return;}
    }
    frame=requestAnimationFrame(tick);
   };frame=requestAnimationFrame(tick);
  });
 }
}
