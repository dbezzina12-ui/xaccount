import { TIERS } from '../engine/rules.js';
export const titles = {...Object.fromEntries(Object.entries(TIERS).map(([id,t])=>[id,t.title])),max:'MAX WIN'};
const insignia = {nice:'letter',big:'parcel',epic:'phone',mythic:'key',max:'key'};
const formatter = new Intl.NumberFormat(undefined,{maximumFractionDigits:2});
export function winShow(tier, cents, preview=false) {
  if(!titles[tier])return Promise.resolve();
  const dialog=document.createElement('dialog');
  dialog.className='win-show';
  dialog.dataset.rank=tier;
  dialog.setAttribute('aria-label',(preview?'Animation preview · ':'')+titles[tier]);
  const art=new URL('../art/night-mail/symbols/'+insignia[tier]+'.webp',import.meta.url);
  dialog.innerHTML='<section><div class="win-rays"></div><div class="win-letter"><small>'+(preview?'ANIMATION PREVIEW':'DEAD LETTER DEPOT')+'</small><img alt=""><h2></h2><strong></strong><button type="button">Continue</button></div></section>';
  dialog.querySelector('img').src=art.href;
  if(['epic','mythic','max'].includes(tier)){
    const count=tier==='max'?10:tier==='mythic'?8:5;
    const burst=document.createElement('div');burst.className='mail-burst';burst.setAttribute('aria-hidden','true');
    for(let i=0;i<count;i++){
      const letter=document.createElement('i'),angle=(i+.5)*Math.PI*2/count;
      letter.style.setProperty('--flight-x',Math.cos(angle)*49+'vmin');
      letter.style.setProperty('--flight-y',Math.sin(angle)*53+'vmin');
      letter.style.setProperty('--tilt',Math.round(Math.cos(angle)*45)+'deg');
      letter.style.setProperty('--delay',(i%3)*55+'ms');burst.append(letter);
    }
    dialog.querySelector('section').prepend(burst);
  }
  dialog.querySelector('h2').textContent=titles[tier];
  const value=dialog.querySelector('strong');
  document.body.append(dialog);
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const length={nice:760,big:930,epic:1150,mythic:1350,max:1550}[tier];
  dialog.showModal();
  const start=performance.now();
  return new Promise(resolve=>{
    let frame, timer;
    function end(){cancelAnimationFrame(frame);clearTimeout(timer);dialog.close();dialog.remove();resolve();}
    function count(now){
      const t=reduce?1:Math.min(1,(now-start)/length);
      value.textContent=formatter.format(Math.round(cents*(1-(1-t)**3))/100);
      if(t<1)frame=requestAnimationFrame(count);
      else if(!preview)timer=setTimeout(end,1000);
    }
    dialog.querySelector('button').onclick=end;
    dialog.oncancel=e=>{e.preventDefault();end()};
    count(start);
  });
}
