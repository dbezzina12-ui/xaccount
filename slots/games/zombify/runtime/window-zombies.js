import {mountApprovedRig} from './approved-rig.js';
import {mobileTownLayout} from './town-layout.js';
import {visibleTownStreet} from './living-town-layout.js';
// Desktop activity follows the 1672 x 941 illustration; portrait uses clear UI gaps.
const scene=document.querySelector('.city-scene'),game=document.getElementById('game');
const phoneLayer=document.createElement('div');phoneLayer.className='mobile-town-activity';phoneLayer.setAttribute('aria-hidden','true');scene.parentElement.append(phoneLayer);
const phone=matchMedia('(max-aspect-ratio:1/1)'),patrols=[],bats=[];
const crowd=document.createElement('div');crowd.className='window-crowd';crowd.setAttribute('aria-hidden','true');scene.append(crowd);
// One small walker and one bat keep the town alive without competing with the reels.
for(const route of [
 {x:1220,y:735,w:46,h:92,face:'right',distance:235,duration:30,phase:0,delay:-5}
]){
 const path=document.createElement('div');path.className='street-patrol';
 Object.assign(path.style,{left:route.x+'px',top:route.y+'px',width:route.w+'px',height:route.h+'px','--patrol-distance':route.distance+'px','--patrol-duration':route.duration+'s','--patrol-delay':route.delay+'s'});
 patrols.push({node:path,desktopStyle:path.style.cssText});
 const actor=document.createElement('div');actor.className='street-zombie';path.append(actor);crowd.append(path);
 void mountApprovedRig(actor,{walking:true,direction:route.face,ambient:true,rate:.8,phase:route.phase});
}
for(let i=0;i<1;i++){
 const bat=document.createElement('div');bat.className='town-bat';
 Object.assign(bat.style,{left:'470px',top:'200px','--bat-delay':'-3s','--bat-duration':'24s'});
 bat.innerHTML='<svg viewBox="0 0 80 32" aria-hidden="true"><g class="bat-wing bat-wing-left"><path d="M40 18Q20-8 2 3L8 21Q17 12 22 26Q30 17 40 24Z"/></g><g class="bat-wing bat-wing-right"><path d="M40 18Q60-8 78 3L72 21Q63 12 58 26Q50 17 40 24Z"/></g><path d="M35 13L35 6L40 11L45 6L45 13Q50 25 40 30Q30 25 35 13Z"/></svg>';
 crowd.append(bat);bats.push({node:bat,desktopStyle:bat.style.cssText});
}
function fitActivity(){
 const scale=Math.max(scene.clientWidth/1672,scene.clientHeight/941),position=getComputedStyle(scene).backgroundPosition.split(' ');
 const fraction=value=>value==='center'?.5:value==='left'||value==='top'?0:value==='right'||value==='bottom'?1:parseFloat(value)/100;
 crowd.style.transform=`translate(${(scene.clientWidth-1672*scale)*(fraction(position[0])||0)}px,${(scene.clientHeight-941*scale)*(fraction(position[1]||'50%')||0)}px) scale(${scale})`;

 const frame=game.getBoundingClientRect(),cabinet=game.querySelector('.machine').getBoundingClientRect();
 const desktop=game.querySelector('.console'),mobile=game.querySelector('#mobile-controller'),tracker=game.querySelector('#infection-tracker');
 const street=visibleTownStreet({machineBottom:cabinet.bottom-frame.top,trackerBottom:tracker.getBoundingClientRect().bottom-frame.top,
  desktopTop:desktop.getBoundingClientRect().top-frame.top,desktopVisible:getComputedStyle(desktop).display!=='none',
  mobileTop:mobile.getBoundingClientRect().top-frame.top,mobileVisible:getComputedStyle(mobile).display!=='none',height:frame.height});
 const layout=mobileTownLayout({width:frame.width,height:frame.height,topbarBottom:game.querySelector('.topbar').getBoundingClientRect().bottom-frame.top,machineTop:cabinet.top-frame.top,...street});
 for(const [items,positions,type]of [[patrols,layout.walkers,'patrol'],[bats,layout.bats,'bat']])items.forEach((item,i)=>{
  const parent=phone.matches?phoneLayer:crowd;if(item.node.parentElement!==parent)parent.append(item.node);
  if(!phone.matches){item.node.style.cssText=item.desktopStyle;item.node.hidden=false;return;}
  const p=positions[i];item.node.hidden=!p||p.hidden;if(!p)return;
  Object.assign(item.node.style,{left:p.x+'px',top:p.y+'px',width:p.width+'px',height:p.height+'px',[`--${type}-distance`]:p.distance+'px'});
  item.node.style.setProperty(`--${type}-duration`,(type==='bat'?24:30)+'s');
 });
}
let fitFrame=null;
function scheduleFit(){if(fitFrame===null)fitFrame=requestAnimationFrame(()=>{fitFrame=null;fitActivity();});}
const observer=new ResizeObserver(scheduleFit);
for(const element of [scene,game.querySelector('.machine'),game.querySelector('.console'),game.querySelector('#mobile-controller'),game.querySelector('#infection-tracker'),game.querySelector('.brand')])observer.observe(element);
phone.addEventListener('change',scheduleFit);
new MutationObserver(scheduleFit).observe(game,{attributes:true,attributeFilter:['data-free-spins','data-bonus-tier']});
window.addEventListener('pageshow',scheduleFit);fitActivity();

