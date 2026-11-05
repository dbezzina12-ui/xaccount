// Animated presentation cut from the approved painted key pose. Register both
// paintings to the same artboard before clipping the shoulder, elbow and cheek.
const NS='http://www.w3.org/2000/svg';
const bounds={"torso": [0, 133, 525, 558], "head": [109, 0, 289, 294], "lid": [206, 149, 69, 39], "shoulder": [322, 235, 137, 126], "elbow": [265, 123, 262, 199]};
const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)};
const lerp=(a,b,t)=>a+(b-a)*t;
function sample(keys,t){for(let i=1;i<keys.length;i++){if(t<=keys[i][0])return lerp(keys[i-1][1],keys[i][1],ease((t-keys[i-1][0])/(keys[i][0]-keys[i-1][0])))}return keys.at(-1)[1]}

export function mountFrankMotion(host,{entrance=false}={}){
 const layer=(name)=>{
   const [x,y,width,height]=bounds[name];
   const href=new URL('../art/night-mail/frank-motion/'+name+'.webp',import.meta.url).href;
   return '<image href="'+href+'" x="'+x+'" y="'+y+'" width="'+width+'" height="'+height+'"/>';
 };
 const svg=document.createElementNS(NS,'svg');
 svg.setAttribute('viewBox','-7 -8 564 711');svg.setAttribute('preserveAspectRatio','xMidYMax meet');
 svg.setAttribute('role','img');svg.setAttribute('aria-label','Frank the pigeon postmaster');
 Object.assign(svg.style,{display:'block',width:'100%',height:'100%',overflow:'visible',pointerEvents:'none'});
 svg.innerHTML='<g data-joint="torso">'+layer('torso')+'<g data-joint="head">'+layer('head')+'<g data-joint="lid">'+layer('lid')+'</g></g><g data-joint="shoulder">'+layer('shoulder')+'<g data-joint="elbow">'+layer('elbow')+'</g></g></g>';
 const joint=name=>svg.querySelector('[data-joint="'+name+'"]');
 const torso=joint('torso'),face=joint('head'),wing=joint('shoulder'),fore=joint('elbow'),lid=joint('lid');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const fallback=host.querySelector('img');
 let frame=0,from=performance.now(),start=entrance?from:-Infinity,strike=-Infinity,delivery=-Infinity,disposed=false,ready=false;
 const set=(node,t)=>node.setAttribute('transform',t);
 function paint(now){
  if(disposed)return;
  const t=(now-from)/1000, age=(now-start)/1000, hit=(now-strike)/1000, calm=reduced.matches;
  const cycle=t%5.6,breath=calm?0:Math.sin(t*2.3);
  const lift=calm?(entrance || age<1.66 ? 1 : 0):sample([[0,0],[.15,-.035],[.59,.91],[.74,1],[1.66,1],[2.26,0],[2.41,-.018],[2.59,0]],age);
  // Between rounds, Frank glances down and presses the parcel with his wing.
  // Suppress the idle action while either gameplay cue is in flight.
  const check=calm || age<2.6 || hit<.75 ? 0 : sample([[0,0],[.55,0],[1.02,1],[1.42,.86],[1.7,1],[2.15,0],[6.8,0]],t%6.8);
  const pulse=calm?0:sample([[0,0],[.16,-.18],[.28,1],[.42,-.2],[.73,0]],hit);
  const throwTime=(now-delivery)/1000;
  const reach=calm?0:sample([[0,0],[.20,-.22],[.34,1],[.48,1.05],[.83,.13],[1.04,0]],throwTime);
  const shoulder=lerp(54+breath*1.9,0,lift)+pulse*7-check*9-reach*49;
  const elbow=lerp(-128-breath*3,0,lift)-pulse*10+check*14+reach*92;
  set(torso,'translate(255 641) scale('+(1-breath*.003)+' '+(1+breath*.009)+') translate(-255 -641)');
  set(face,'translate('+(calm?0:Math.sin(t*1.14)*1.5)+' '+(-breath*2)+') rotate('+(-breath*1.8-lift*2+pulse*3-check*5.5-reach*6)+' 235 270)');
  set(wing,'rotate('+shoulder+' 329 277)');set(fore,'rotate('+elbow+' 438 284)');
  const blink=calm?0:sample([[0,0],[2.23,0],[2.31,1],[2.36,1],[2.48,0],[4.87,0],[4.95,1],[5.04,0],[5.6,0]],cycle);
  set(lid,'translate(0 154) scale(1 '+Math.max(.001,blink)+') translate(0 -154)');lid.setAttribute('opacity',blink>.04?'1':'0');
  if(!calm && !document.hidden)frame=requestAnimationFrame(paint);
 }
 function refresh(){cancelAnimationFrame(frame);if(ready)paint(performance.now())}
 function salute(){start=performance.now();refresh()}
 function stamp(){strike=performance.now();refresh()}
 function visibility(){refresh()}
 const cue=e=>{if(e.detail?.action==='bonus')salute();if(e.detail?.action==='stamp')stamp();if(e.detail?.action==='throw'){delivery=performance.now();refresh()}};
 // Preserve the fallback until both paintings decode. Start the gesture clock only once visible.
 const art=Object.keys(bounds).map(name=>{const image=new Image();image.src=new URL('../art/night-mail/frank-motion/'+name+'.webp',import.meta.url).href;return image.decode()});
 Promise.all(art).then(()=>{if(disposed)return;ready=true;from=performance.now();if(start!==-Infinity)start=from;host.append(svg);if(fallback){fallback.hidden=true;fallback.style.display='none'};refresh()}).catch(()=>{});
 host.addEventListener('depot:frank',cue);document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',refresh);
 return {salute,stamp,destroy(){disposed=true;cancelAnimationFrame(frame);host.removeEventListener('depot:frank',cue);document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',refresh);svg.remove();if(fallback){fallback.hidden=false;fallback.style.removeProperty('display')}}};
}
