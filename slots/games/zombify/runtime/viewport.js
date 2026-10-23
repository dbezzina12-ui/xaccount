// Size the reel cells from the space actually available, including
// browser chrome, safe areas, portrait trackers and changing preview captions.
const game=document.getElementById('game'),area=game.querySelector('.play-area');
const machine=game.querySelector('.machine'),board=game.querySelector('.board-wrap');
const brand=game.querySelector('.brand');
let scheduled=false;
function fit(){
 scheduled=false;
 const mobileControls=game.querySelector('#mobile-controller');
 if(mobileControls&&getComputedStyle(mobileControls).display!=='none'){
  const reserve=`${Math.ceil(mobileControls.getBoundingClientRect().height)}px`;
  if(game.style.getPropertyValue('--mobile-controller-height')!==reserve)game.style.setProperty('--mobile-controller-height',reserve);
 }
 // Fill portrait width unconditionally. The live opening and painting share
 // horizontal and vertical coordinates, while a separate paving band fills
 // the controller area. Never shrink the whole scene to fit its height.
 if(game.clientWidth<=game.clientHeight){
  const width=game.clientWidth,height=game.clientHeight;
  const controlsTop=mobileControls.getBoundingClientRect().top-game.getBoundingClientRect().top;
  const groundSeam=Math.max(1,controlsTop-10);
  const scaleX=(width-12)/794,scaleY=groundSeam/1460;
  const sceneWidth=853*scaleX,sceneLeft=(width-sceneWidth)/2;
  const values={
   '--mobile-scene-width':sceneWidth,'--mobile-scene-height':height,
   '--mobile-scene-image-height':1844*scaleY,
   '--mobile-ground-seam':groundSeam,
   '--mobile-footer-image-height':(height-groundSeam)*1844/(1844-1460),
   '--mobile-scene-origin':726*scaleY,
   '--mobile-board-left':sceneLeft+86*scaleX,'--mobile-cabinet-top':367*scaleY,
   '--mobile-board-height':718*scaleY,'--mobile-foot-gap':170*scaleY,
   '--mobile-title-left':sceneLeft+40*scaleX,'--mobile-title-width':570*scaleX,
   '--mobile-title-height':205*scaleY,'--mobile-title-top':48*scaleY,
   '--cabinet-width':687*scaleX
  };
  for(const [name,value] of Object.entries(values)){
   const next=`${value.toFixed(2)}px`;
   if(game.style.getPropertyValue(name)!==next)game.style.setProperty(name,next);
  }
  const next=`${(687*scaleX).toFixed(2)}px`;
  if(machine.style.width!==next)machine.style.width=next;
  if(area.style.getPropertyValue('--cabinet-width')!==next)area.style.setProperty('--cabinet-width',next);
  return;
 }
 const sideTitle=getComputedStyle(game).getPropertyValue('--side-title').trim()==='1';
 const titleHeight=sideTitle?0:brand.getBoundingClientRect().height;
 const areaStyle=getComputedStyle(area);
 const gap=parseFloat(areaStyle.rowGap)||0;
 const stagePadding=(parseFloat(areaStyle.paddingTop)||0)+(parseFloat(areaStyle.paddingBottom)||0);
 const machineRect=machine.getBoundingClientRect(),boardRect=board.getBoundingClientRect();
 const chrome=machineRect.height-boardRect.height;
 const cellAspect=parseFloat(getComputedStyle(game).getPropertyValue('--reel-cell-aspect'))||1;
 const boardRatio=5/(6*cellAspect);
 const boardTrim=boardRect.height-machineRect.width*boardRatio;
 const innerWidth=area.clientWidth-(parseFloat(areaStyle.paddingLeft)||0)-(parseFloat(areaStyle.paddingRight)||0);
 // Equal side clearance keeps the cabinet centered in the viewport while
 // leaving room for the left title and the scene's mascot.
 const availableWidth=sideTitle?innerWidth-2*(brand.getBoundingClientRect().width+24):innerWidth;
 let availableHeight=area.clientHeight-stagePadding-titleHeight-gap;
 const width=Math.floor(Math.min(1040,availableWidth,(availableHeight-chrome-boardTrim-4)/boardRatio));
 const next=`${Math.max(1,width)}px`;
 if(machine.style.width!==next)machine.style.width=next;
 // The title's mounting plate belongs to this cabinet, including when it shrinks.
 if(area.style.getPropertyValue('--cabinet-width')!==next)area.style.setProperty('--cabinet-width',next);


}
function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(fit);}}
const observer=new ResizeObserver(schedule);
for(const node of [game,area,machine,game.querySelector('.brand'),game.querySelector('.console'),game.querySelector('#mobile-controller')])if(node)observer.observe(node);
window.addEventListener('resize',schedule,{passive:true});
window.visualViewport?.addEventListener('resize',schedule,{passive:true});
document.fonts?.ready.then(schedule);
document.addEventListener('visibilitychange',()=>{document.documentElement.dataset.backgroundPaused=String(document.hidden);});
schedule();
