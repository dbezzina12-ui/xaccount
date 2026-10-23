import {townArtFrame} from './living-town-layout.js';
import './scene-character.js';

const game=document.getElementById('game'),backdrop=game.querySelector('.city-backdrop'),scene=game.querySelector('.city-scene');
const root=document.documentElement,motion=matchMedia('(prefers-reduced-motion: reduce)'),pointer=matchMedia('(hover:hover) and (pointer:fine)');
const make=(className,parent=backdrop)=>{const node=document.createElement('div');node.className=className;parent.append(node);return node;};
// Atmospheric layers move at independent depths. No video download or new GPU context.
const lightPlane=make('town-light-plane',scene),moon=make('town-moon-glow',lightPlane),lights=[];
for(let i=0;i<4;i++){const light=make('town-window-light',lightPlane);light.style.setProperty('--light-delay',`${-i*2.8}s`);lights.push(light);}
const sky=make('town-sky');
const cloudShape='<svg viewBox="0 0 900 180" aria-hidden="true"><path d="M5 137Q44 107 98 112Q71 81 156 80Q165 34 260 51Q317 8 393 56Q466 28 524 79Q624 60 664 101Q750 81 895 143Q602 113 485 151Q287 178 5 137Z"/></svg>';
for(const depth of ['far','near'])make(`town-cloud town-cloud-${depth}`,sky).innerHTML=cloudShape;
const mist=make('town-street-mist');
make('town-mist town-mist-far',mist);make('town-mist town-mist-middle',mist);
const foreground=make('town-foreground');
make('town-mist town-mist-front',foreground);
// Inked grass silhouettes are code-native scenery, animated about their roots.
const grass='<svg viewBox="0 0 340 210" aria-hidden="true"><path d="M0 210V93L26 158L30 61L54 135L72 21L78 143L119 74L108 162L148 123L129 184L181 145L172 191L227 165L215 201L279 175L265 210Z"/><path d="M0 195Q71 175 143 189Q207 176 340 210H0Z"/></svg>';
make('town-grass town-grass-left',foreground).innerHTML=grass;
make('town-grass town-grass-right',foreground).innerHTML=grass;
for(let i=0;i<7;i++){
 const mote=make('town-drifter',foreground);mote.style.cssText=`--drifter:${i};--drifter-delay:${-i*1.7}s`;
}

let frame=null,disposed=false;
function fit(){
 frame=null;if(disposed)return;
 const art=townArtFrame(scene.clientWidth,scene.clientHeight);
 lightPlane.style.cssText=`width:${art.width}px;height:${art.height}px;transform:translate(${art.x}px,${art.y}px) scale(${art.scale})`;
 const [mx,my,mr]=art.moon;moon.style.cssText=`left:${mx-mr*1.5}px;top:${my-mr*1.5}px;width:${mr*3}px;height:${mr*3}px`;
 const windows=art.portrait?[[61,1226,142,155],[841,1038,114,155],[852,1231,89,141],[585,1306,50,60]]:[[90,612,154,176],[1536,383,137,165],[1496,645,101,144],[398,678,68,66]];
 windows.forEach(([x,y,w,h],i)=>lights[i].style.cssText=`--light-delay:${-i*2.8}s;left:${x-w/2}px;top:${y-h/2}px;width:${w}px;height:${h}px`);
}
function schedule(){if(frame===null&&!disposed)frame=requestAnimationFrame(fit);}
const observer=new ResizeObserver(schedule);[game,scene,game.querySelector('.machine'),game.querySelector('#mobile-controller')].forEach(node=>observer.observe(node));
new MutationObserver(schedule).observe(root,{attributes:true,attributeFilter:['data-entry']});
new MutationObserver(schedule).observe(game,{attributes:true,attributeFilter:['data-free-spins','data-bonus-tier']});
new MutationObserver(schedule).observe(game.querySelector('.free-spins-counter'),{attributes:true,attributeFilter:['hidden']});
motion.addEventListener('change',()=>{backdrop.style.removeProperty('--scene-x');backdrop.style.removeProperty('--scene-y');schedule();});
document.addEventListener('visibilitychange',()=>{root.dataset.backgroundPaused=String(document.hidden);schedule();});
// Event-driven parallax; continuous atmosphere on touch screens needs no sensors.
let pointerFrame=null,nextX=0,nextY=0;
function move(x,y){nextX=x;nextY=y;if(pointerFrame!==null)return;pointerFrame=requestAnimationFrame(()=>{pointerFrame=null;backdrop.style.setProperty('--scene-x',`${nextX.toFixed(2)}px`);backdrop.style.setProperty('--scene-y',`${nextY.toFixed(2)}px`);});}
game.addEventListener('pointermove',event=>{if(!pointer.matches||motion.matches)return;const rect=game.getBoundingClientRect();move((event.clientX-rect.left-rect.width/2)/rect.width*14,(event.clientY-rect.top-rect.height/2)/rect.height*8);},{passive:true});
game.addEventListener('pointerleave',()=>move(0,0),{passive:true});
window.addEventListener('pagehide',()=>{disposed=true;if(frame!==null)cancelAnimationFrame(frame);if(pointerFrame!==null)cancelAnimationFrame(pointerFrame);frame=null;pointerFrame=null;});
window.addEventListener('pageshow',()=>{disposed=false;schedule();});
schedule();
