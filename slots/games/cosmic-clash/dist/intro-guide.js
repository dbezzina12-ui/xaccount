import {DUEL_FIGHT_HTML,presentDuel} from './duel-presentation.js?v=97';
import {revealDuel} from './duel-reveal.js?v=foundry';
import {presentGodUpgrade} from './god-upgrade.js?v=71';
import {presentMobileCrossfire as presentCrossfire} from './animation/mobile-crossfire.mjs';

export const INTRO_FEATURES=Object.freeze(['duel','super','crossfire']);
export function introLives(count){return Array.from({length:3},(_,i)=>`<i${i>=count?' class="empty"':''}></i>`).join('');}

export function presentIntroDuel({card,symbol,wait,instant,motions,onRevealStart=()=>{},onResolve,present=presentDuel,reveal=revealDuel}){
 return present({node:card.querySelector('.reel-fight'),duel:{regular:true,won:true,from:5,rival:20,to:5,lives:null,operation:'keep'},tier:'regular',wait,instant,
  onReveal:()=>{onRevealStart();return reveal({card,symbol,pace:1.4,instant,motions});},onResolve});
}

// Every demo has its own story. Only visible cards run; leaving the intro
// cancels its timers, doors, media and effects before the first paid spin.
export function mountIntroGuide(root,cell){
 const cards=[...root.querySelectorAll('[data-intro-feature]')],media=matchMedia('(min-width:761px)'),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 let page=0,version=0,stopped=false;const timers=new Map(),motions=new Set();
 const wait=ms=>new Promise(done=>{const id=setTimeout(()=>{timers.delete(id);done();},ms);timers.set(id,done);});
 const cancel=()=>{version++;for(const [id,done] of timers){clearTimeout(id);done();}timers.clear();for(const motion of [...motions]){try{motion.cancel();}catch{}}motions.clear();};
 const symbols=['GUN','D','CHIP','E','HELMET','L','BLADE','U'];
 const animate=async(node,frames,ms,stale)=>{
  if(reduced||stale()||!node.animate)return;
  const a=node.animate(frames,{duration:ms,easing:'ease-out'});motions.add(a);
  try{await a.finished;}catch{}finally{motions.delete(a);a.cancel();}
 };
 function board(stage,turn=0,keep=[]){
  const reels=stage.querySelector('.guide-reels');
  if(!reels.children.length)reels.innerHTML=Array.from({length:5},()=>'<div class="reel"><div class="reel-panel"></div></div>').join('');
  [...reels.children].forEach((reel,r)=>{if(!keep.includes(r))reel.firstElementChild.innerHTML=Array.from({length:5},(_,y)=>cell({name:symbols[(r*3+y+turn*2)%symbols.length]})).join('');});
 }
 function wild(stage,reel,multi,{lives=null,immortal=false}={}){
  const el=root.ownerDocument.createElement('div');el.className=`duel-card${immortal?' immortal':''}`;el.style.gridColumn=reel+1;el.dataset.reel=String(reel);
  el.innerHTML=`<div class="duel-portrait"></div>${DUEL_FIGHT_HTML}<span class="wild-emblem"><img src="./assets/frontier-ink/features/wild.svg" alt="Wild"></span><b class="wild-multiplier">${multi}×</b><div class="duel-lives">${immortal?'<span class="infinity">∞</span>':lives===null?'':introLives(lives)}</div>`;
  stage.querySelector('.guide-wilds').append(el);return el;
 }
 const slot=(stage,reel,row)=>stage.querySelector('.guide-reels').children[reel].firstElementChild.children[row];
 async function run(article,token){
  const stale=()=>stopped||token!==version,stage=article.querySelector('.guide-stage'),status=article.querySelector('.demo-state'),kind=article.dataset.introFeature;
  const say=text=>{if(!stale())status.textContent=text;};
  const pause=async ms=>{if(!reduced&&!stale())await wait(ms);};
  const spin=async(keep,turn)=>{board(stage,turn,keep);await Promise.all([...stage.querySelector('.guide-reels').children].map((r,i)=>keep.includes(i)?Promise.resolve():animate(r.firstElementChild,[{transform:'translateY(-18%)',opacity:.25},{transform:'translateY(0)',opacity:1}],400,stale)));};
  while(!stale()){
   stage.querySelector('.guide-wilds').replaceChildren();stage.querySelector('.guide-reels').replaceChildren();board(stage);stage.classList.remove('guide-crossfire');
   if(kind==='duel'){
    // A visible landed symbol is essential: the same hinge routine used by
    // gameplay opens over the full-reel photo before the prepared take plays.
    for(let r=0;r<5;r++){slot(stage,r,2).outerHTML=cell({name:r===2?'VS':'D'});slot(stage,r,2).classList.add('winning');}
    say('CONNECT THE VS');await pause(950);if(stale())return;
    const symbol=slot(stage,2,2).querySelector('.vs-symbol-art'),el=wild(stage,2,5);el.classList.add('pending-duel','dueling');
    await presentIntroDuel({card:el,symbol,wait,instant:()=>reduced||stale(),motions,
     onRevealStart:()=>say('VS OPENS · DUEL REVEALED'),
     onResolve:()=>{if(!stale()){el.classList.remove('pending-duel');say('WINNER KEEPS 5×');}}});
    if(stale())return;el.classList.remove('dueling','pending-duel');await pause(1400);
   }else if(kind==='super'){
    const lifeCount=article.querySelector('[data-demo-lives]');if(lifeCount)lifeCount.textContent='3';
    const el=wild(stage,2,5,{lives:3});say('START WITH 3 LIVES');await pause(1050);if(stale())return;
    say('WILD REEL STAYS');await spin([2],1);await pause(650);if(stale())return;
    el.classList.add('winner-outlaw');el.querySelector('.wild-multiplier').textContent='20×';el.querySelector('.duel-lives').innerHTML=introLives(2);
    if(lifeCount)lifeCount.textContent='2';
    say('CHALLENGER WINS · 2 LIVES LEFT');
    await animate(el.querySelector('.duel-lives'),[{filter:'brightness(2)',transform:'translateX(-3px)'},{transform:'translateX(3px)',offset:.35},{filter:'brightness(1)',transform:'translateX(0)'}],420,stale);
    await pause(1400);if(stale())return;
    await spin([2],2);say('20× STAYS FOR THE NEXT SPIN');await pause(1600);
   }else{
    const left=wild(stage,0,5,{immortal:true}),right=wild(stage,4,5,{immortal:true});say('GOD MODE · IMMORTAL REELS');await pause(1000);if(stale())return;
    await Promise.all([left,right].map(card=>presentGodUpgrade({card,duel:{from:5,to:10},instant:()=>reduced||stale(),motions,onResolve:()=>{if(!stale())card.querySelector('.wild-multiplier').textContent='10×';}})));
    say('2× BOOST · THEN CROSSFIRE');await pause(650);if(stale())return;
    stage.classList.add('guide-crossfire');
    const placements=[{reel:1,row:2},{reel:2,row:1},{reel:3,row:3}];
    await presentCrossfire({surface:stage,reels:stage,placements,assetUrl:'./assets/spine-v96/mobile-crossfire/images/parts.png',wait,motions,instant:()=>reduced||stale(),canceled:stale,
     getTarget:p=>slot(stage,p.reel,p.row),onPlacement:p=>{if(!stale())slot(stage,p.reel,p.row).outerHTML=cell({name:'WILD',temporary:true});}});
    say('CROSSFIRE · 3 EXTRA WILDS');await pause(1900);
   }
   if(reduced||stale())return;
   await pause(900);
  }
 }
 function show(index=page){
  cancel();page=(index+cards.length)%cards.length;root.dataset.introPage=String(page);
  root.querySelectorAll('[data-intro-page]').forEach((b,i)=>{b.setAttribute('aria-current',i===page?'step':'false');});
  for(const [i,card] of cards.entries()){
   card.hidden=!media.matches&&i!==page;
   if(!card.hidden&&!document.hidden)void run(card,version);
  }
 }
 const click=e=>{const b=e.target.closest('[data-intro-step],[data-intro-page]');if(b)show(b.hasAttribute('data-intro-page')?Number(b.dataset.introPage):page+Number(b.dataset.introStep));};
 const key=e=>{if(!media.matches&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();show(page+(e.key==='ArrowLeft'?-1:1));}};
 const refresh=()=>show();
 root.addEventListener('click',click);root.addEventListener('keydown',key);media.addEventListener('change',refresh);document.addEventListener('visibilitychange',refresh);show();
 return ()=>{stopped=true;cancel();root.removeEventListener('click',click);root.removeEventListener('keydown',key);media.removeEventListener('change',refresh);document.removeEventListener('visibilitychange',refresh);};
}
