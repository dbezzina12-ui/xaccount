import { TIERS } from '../reel-engine/rules.js';
import { credits } from './win-ledger.mjs';
export const titles = {...Object.fromEntries(Object.entries(TIERS).map(([id,t])=>[id,t.title])),max:'MAX WIN'};

// The final bonus count-up and tier share one unframed celebration.
export function winShow(tier, cents, preview=false, summary='') {
  if(!titles[tier] && !summary)return Promise.resolve();
  const rank=titles[tier]?tier:'total', title=titles[tier] || 'TOTAL WIN';
  const dialog=document.createElement('dialog');
  dialog.className='win-show';dialog.dataset.rank=rank;
  dialog.dataset.scope=summary?'bonus-total':'spin';
  dialog.setAttribute('aria-label',(preview?'Animation preview · ':'')+title);
  dialog.innerHTML='<section class="win-stage"><div class="win-rays" aria-hidden="true"></div><div class="mail-burst" aria-hidden="true"></div><div class="win-content"><p class="win-context"></p><h2><span></span></h2><strong class="win-amount"></strong><p class="win-caption"></p><button type="button"></button></div></section>';
  dialog.querySelector('.win-context').textContent=summary || (preview?'ANIMATION PREVIEW':'');
  dialog.querySelector('h2 span').textContent=title;
  dialog.querySelector('.win-caption').textContent=summary?'TOTAL BONUS WIN':'';
  const button=dialog.querySelector('button');button.textContent=summary?'Back to reels':'Continue';
  const value=dialog.querySelector('.win-amount');
  value.setAttribute('aria-label',credits(cents));
  const count={total:0,nice:6,big:10,epic:16,mythic:22,max:30}[rank];
  const burst=dialog.querySelector('.mail-burst');
  for(let i=0;i<count;i++){
    const letter=document.createElement('i'),angle=(i+.5)*Math.PI*2/count;
    letter.style.setProperty('--flight-x',Math.cos(angle)*(46+i%3*12)+'vmin');
    letter.style.setProperty('--flight-y',Math.sin(angle)*(44+i%4*8)+'vmin');
    letter.style.setProperty('--tilt',(i%2?1:-1)*(40+i*19)+'deg');
    letter.style.setProperty('--delay',(i%6)*75+'ms');
    letter.style.setProperty('--size',(19+i%4*7)+'px');burst.append(letter);
  }
  document.body.append(dialog);dialog.showModal();
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duration=reduce?0:({total:1100,nice:1100,big:1500,epic:1900,mythic:2300,max:3000}[rank]);
  const start=performance.now();
  return new Promise(resolve=>{
    let frame, deadline, timer, ended=false, complete=false;
    function end(){
      if(ended)return;ended=true;
      cancelAnimationFrame(frame);clearTimeout(timer);clearTimeout(deadline);
      dialog.close();dialog.remove();resolve();
    }
    function finishCount(){
      if(complete || ended)return;complete=true;
      cancelAnimationFrame(frame);clearTimeout(deadline);
      value.textContent=credits(cents);dialog.dataset.counted='';
      if(!preview && !summary)timer=setTimeout(end,1000);
    }
    function countUp(now){
      if(ended || complete)return;
      const t=duration?Math.max(0,Math.min(1,(now-start)/duration)):1;
      value.textContent=credits(Math.round(cents*(1-(1-t)**3)));
      if(t===1)finishCount();else frame=requestAnimationFrame(countUp);
    }
    // Low-refresh embeds must still finish on time.
    deadline=setTimeout(finishCount,duration+30);
    button.onclick=()=>complete?end():finishCount();
    dialog.oncancel=e=>{e.preventDefault();complete?end():finishCount()};
    countUp(start);
  });
}
