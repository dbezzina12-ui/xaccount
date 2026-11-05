// Animated presentation cut from the approved painted key pose. Register both
// paintings to the same artboard before clipping the shoulder, elbow and cheek.
const NS='http://www.w3.org/2000/svg';
const SALUTE=new URL('../art/night-mail/frank-salute.webp',import.meta.url).href;
const REST=new URL('../art/night-mail/frank.webp',import.meta.url).href;
let serial=0;
const feather='M265 123 Q313 134 343 140 L349 140 350 137 Q438 151 521 207 L543 293 508 321 456 322 Q438 318 431 311 Q396 292 399 240 L398 237 Q388 232 384 222 Q362 223 349 205 L345 198 Q320 190 312 178 Q297 173 289 160 Q280 153 275 145 L283 147 Q272 141 267 133 L286 139 Q271 132 265 125Z';
const sleeve='M327 252 Q342 246 360 247 L392 229 404 223 467 250 472 314 438 336 363 358 351 361 Q346 347 344 331 Q337 312 332 289 L322 289 Q329 277 327 252Z';
const head='M0 0H550V123L351 134 Q342 149 345 168 Q349 196 326 235 L312 249 Q304 269 275 276 Q244 300 196 292 L184 282 153 281 159 272 144 273 149 259 137 263 146 238 111 235 0 215Z';
const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)};
const lerp=(a,b,t)=>a+(b-a)*t;
function sample(keys,t){for(let i=1;i<keys.length;i++){if(t<=keys[i][0])return lerp(keys[i-1][1],keys[i][1],ease((t-keys[i-1][0])/(keys[i][0]-keys[i-1][0])))}return keys.at(-1)[1]}

export function mountFrankMotion(host,{entrance=false}={}){
 const prefix='frank-art-'+(++serial)+'-';
 const use=id=>'<use href="#'+prefix+id+'"/>';
 const clip=id=>'clip-path="url(#'+prefix+id+')"';
 const mask=id=>'mask="url(#'+prefix+id+')"';
 const path=(id,d)=>'<clipPath id="'+prefix+id+'"><path d="'+d+'"/></clipPath>';
 const without=(id,paths)=>'<mask id="'+prefix+id+'" maskUnits="userSpaceOnUse" x="-50" y="-50" width="670" height="820"><rect x="-50" y="-50" width="670" height="820" fill="white"/>'+paths.map(d=>'<path d="'+d+'" fill="black"/>').join('')+'</mask>';
 const svg=document.createElementNS(NS,'svg');
 svg.setAttribute('viewBox','-7 -8 564 711');svg.setAttribute('preserveAspectRatio','xMidYMax meet');
 svg.setAttribute('role','img');svg.setAttribute('aria-label','Frank the pigeon postmaster');
 Object.assign(svg.style,{display:'block',width:'100%',height:'100%',overflow:'visible',pointerEvents:'none'});
 svg.innerHTML='<defs><image id="'+prefix+'art" href="'+SALUTE+'" width="550" height="695" preserveAspectRatio="none"/><image id="'+prefix+'rest" href="'+REST+'" width="550" height="695" preserveAspectRatio="none"/>'+path('feather',feather)+path('sleeve',sleeve)+path('head',head)+path('cheek','M253 114L336 112 351 134 Q342 147 345 164 Q343 198 327 218 L283 212Z')+path('shoulder','M318 252 Q345 242 361 255 Q374 270 369 301 L357 344 347 361 323 354Z')+path('cuff','M371 258 Q389 238 413 242 Q441 243 451 265 Q465 290 448 306 Q432 316 412 317 L386 309Z')+path('fringe','M158 255 Q244 270 318 239 L300 279 233 314 163 287Z')+without('noArm',[feather,sleeve])+without('noFore',[feather])+without('noHead',[head])+'<g id="'+prefix+'body"><g '+clip('shoulder')+'><g transform="translate(42 0)">'+use('art')+'</g></g><g '+clip('cheek')+'>'+use('rest')+'</g><g '+mask('noArm')+'>'+use('art')+'</g></g></defs><g data-joint="torso"><g '+clip('fringe')+'><g transform="translate(0 -6)">'+use('body')+'</g></g><g '+mask('noHead')+'>'+use('body')+'</g><g data-joint="head"><g '+clip('head')+'>'+use('body')+'</g><g data-joint="lid"><path d="M208 159Q239 155 274 151Q274 180 252 186Q224 192 208 159Z" fill="#48546e" stroke="#282536" stroke-width="2"/><path d="M214 168Q240 186 269 165" fill="none" stroke="#222232" stroke-width="3"/></g></g><g data-joint="shoulder"><g '+clip('cuff')+'><g transform="translate(41 -19)">'+use('art')+'</g></g><g '+clip('sleeve')+'><g '+mask('noFore')+'>'+use('art')+'</g></g><g data-joint="elbow"><g '+clip('feather')+'>'+use('art')+'</g></g></g></g>';
 const joint=name=>svg.querySelector('[data-joint="'+name+'"]');
 const torso=joint('torso'),face=joint('head'),wing=joint('shoulder'),fore=joint('elbow'),lid=joint('lid');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const fallback=host.querySelector('img');
 let frame=0,from=performance.now(),start=entrance?from:-Infinity,strike=-Infinity,disposed=false,ready=false;
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
  const shoulder=lerp(54+breath*1.9,0,lift)+pulse*7-check*9;
  const elbow=lerp(-128-breath*3,0,lift)-pulse*10+check*14;
  set(torso,'translate(255 641) scale('+(1-breath*.003)+' '+(1+breath*.009)+') translate(-255 -641)');
  set(face,'translate('+(calm?0:Math.sin(t*1.14)*1.5)+' '+(-breath*2)+') rotate('+(-breath*1.8-lift*2+pulse*3-check*5.5)+' 235 270)');
  set(wing,'rotate('+shoulder+' 329 277)');set(fore,'rotate('+elbow+' 438 284)');
  const blink=calm?0:sample([[0,0],[2.23,0],[2.31,1],[2.36,1],[2.48,0],[4.87,0],[4.95,1],[5.04,0],[5.6,0]],cycle);
  set(lid,'translate(0 154) scale(1 '+Math.max(.001,blink)+') translate(0 -154)');lid.setAttribute('opacity',blink>.04?'1':'0');
  if(!calm && !document.hidden)frame=requestAnimationFrame(paint);
 }
 function refresh(){cancelAnimationFrame(frame);if(ready)paint(performance.now())}
 function salute(){start=performance.now();refresh()}
 function stamp(){strike=performance.now();refresh()}
 function visibility(){refresh()}
 const cue=e=>{if(e.detail?.action==='bonus')salute();if(e.detail?.action==='stamp')stamp()};
 // Preserve the fallback until both paintings decode. Start the gesture clock only once visible.
 const art=[SALUTE,REST].map(src=>{const image=new Image();image.src=src;return image.decode()});
 Promise.all(art).then(()=>{if(disposed)return;ready=true;from=performance.now();if(start!==-Infinity)start=from;host.append(svg);if(fallback){fallback.hidden=true;fallback.style.display='none'};refresh()}).catch(()=>{});
 host.addEventListener('depot:frank',cue);document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',refresh);
 return {salute,stamp,destroy(){disposed=true;cancelAnimationFrame(frame);host.removeEventListener('depot:frank',cue);document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',refresh);svg.remove();if(fallback){fallback.hidden=false;fallback.style.removeProperty('display')}}};
}
