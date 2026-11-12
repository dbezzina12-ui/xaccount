// Fit against the arena's measured content box, including the real controller
// height. Phone/browser chrome and rotation must never push a reel offscreen.
export function cabinetSize({width,height,controls=0,mobile=false,compact=false}){
 const railRatio=mobile?93/906:.04,sillRatio=mobile?40/906:.026;
 const ratio=mobile?(compact?1.12:1):1.12,capRatio=(223/906)*(mobile?1:.72);
 const top=mobile?(compact?25:32):20;
 // No status row: all space below the reels belongs to the metal sill.
 const byHeight=Math.max(0,(height-controls-top-8)/(capRatio+sillRatio+(1-2*railRatio)/ratio));
 const size=Math.max(0,Math.min(width,mobile&&!compact?570:1160,byHeight));
 const cap=Math.floor(size)*capRatio;
 const deck=Math.min(width,Math.floor(size)*1.38);
 return {width:Math.floor(size),deck,cap,inset:Math.floor(size)*railRatio,top,sill:Math.floor(size)*sillRatio,ratio};
}
export function mountCabinetFit(game){
 const arena=game.querySelector('.arena'),machine=game.querySelector('.machine'),controller=game.querySelector('#controller');
 let frame=0;
 const update=()=>{
  frame=0;
  const style=getComputedStyle(arena),mobile=controller.dataset.layout==='mobile';
  const width=arena.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
  const height=arena.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom);
  const compact=innerHeight<=540&&innerWidth>innerHeight;
  const fit=cabinetSize({width,height,controls:mobile?0:controller.offsetHeight,mobile,compact});
  for(const [key,value] of Object.entries(fit))machine.style.setProperty(`--cabinet-${key}`,key==='ratio'?String(value):`${value}px`);
 };
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
 const observer=new ResizeObserver(schedule);
 observer.observe(arena);observer.observe(controller);
 window.addEventListener('resize',schedule);window.visualViewport?.addEventListener('resize',schedule);
 update();
 return ()=>{observer.disconnect();window.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('resize',schedule);if(frame)cancelAnimationFrame(frame);};
}
