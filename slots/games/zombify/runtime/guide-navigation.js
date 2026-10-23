// Run only visible demonstrations: one on mobile, all three on desktop.
export function createGuideNavigation({cards,dots,previous,next,counter,mobile,onDemoChange,onVisibilityChange}){
 let index=0,open=false,demoActive=false;
 function update(){
  cards.forEach((card,n)=>{card.hidden=mobile.matches&&n!==index;});
  dots.forEach((dot,n)=>{if(n===index)dot.setAttribute('aria-current','step');else dot.removeAttribute('aria-current');});
  previous.disabled=index===0;next.disabled=index===cards.length-1;
  counter.textContent=`${index+1} of ${cards.length}`;
  const active=open&&(!mobile.matches||index===1);
  if(active!==demoActive){demoActive=active;onDemoChange?.(active);}
  onVisibilityChange?.(open?cards.flatMap((_,n)=>!mobile.matches||n===index?[n]:[]):[]);
 }
 function select(value){index=Math.max(0,Math.min(cards.length-1,value));update();}
 previous.addEventListener('click',()=>select(index-1));next.addEventListener('click',()=>select(index+1));
 dots.forEach((dot,n)=>dot.addEventListener('click',()=>select(n)));
 mobile.addEventListener('change',update);
 update();
 return {open(){open=true;select(0);},close(){open=false;update();},select};
}
