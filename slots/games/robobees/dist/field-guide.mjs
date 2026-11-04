import {symbolUrl} from './reels.mjs?v=37';

// Instructional 5×4 boards are independent of the wallet and outcome generator.
const board=['A','rotor','hive','K','Q','nectar','J','Q','stinger','10','K','A','beacon','J','rotor','hive','10','K','nectar','A'];
const captions=[['3 FS · Worker Shift','4 FS · Swarm Protocol','5 FS · Queen Override'],['Three matching rotors','Winning cells clear','New symbols tumble in'],['First hit · 2×','Repeat hit · 4×','Repeat hit · 8×']];
function demonstration(card,index,reduced){
  const surface=card.querySelector('.guide-board'),caption=card.querySelector('.demo-caption'),button=card.querySelector('.demo-toggle');
  const cells=board.map(()=>{const cell=document.createElement('i');cell.append(new Image(),document.createElement('b'));return cell});
  surface.replaceChildren(...cells);
  let step=0,paused=reduced;
  function draw(){
    cells.forEach((cell,i)=>{
      let id=board[i],lit=false,charge='';
      if(index===0 && [0,6,12,8,19].slice(0,step+3).includes(i)){id='FS';lit=true}
      if(index===1 && i>=5 && i<=7){id=step===0?'rotor':step===1?null:['A','hive','J'][i-5];lit=step!==2}
      if(index===2 && [5,6,7].includes(i)){charge=[2,4,8][step]+'×';lit=true}
      cell.classList.toggle('lit',lit);cell.classList.toggle('charged',!!charge);
      const img=cell.firstChild;img.alt='';img.hidden=!id||!!charge;if(id && !charge)img.src=symbolUrl(id);
      const label=cell.lastChild;label.hidden=!charge;label.textContent=charge;
    });
    caption.textContent=captions[index][step];button.textContent=paused?'Play':'Pause';
    button.setAttribute('aria-label',button.textContent+' '+card.querySelector('h3').textContent+' demonstration');
  }
  button.onclick=()=>{paused=!paused;draw()};draw();
  return ()=>{if(!paused){step=(step+1)%3;draw()}};
}
export function openFieldGuide(dialog){
  if(dialog.open)return;
  const cards=[...dialog.querySelectorAll('.intro-card')],dots=[...dialog.querySelectorAll('.guide-dots button')];
  const deck=dialog.querySelector('.intro-cards'),enter=dialog.querySelector('[data-enter]');
  const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
  const ticks=cards.map((card,i)=>demonstration(card,i,reduced));
  let current=0,start;
  function select(n){
    current=(n+cards.length)%cards.length;
    cards.forEach((card,i)=>card.toggleAttribute('data-current',i===current));
    dots.forEach((dot,i)=>i===current?dot.setAttribute('aria-current','step'):dot.removeAttribute('aria-current'));
    dialog.querySelector('[data-announce]').textContent=(current+1)+' of '+cards.length+' · '+cards[current].querySelector('h3').textContent;
  }
  dialog.querySelector('[data-prev]').onclick=()=>select(current-1);
  dialog.querySelector('[data-next]').onclick=()=>select(current+1);
  dots.forEach((dot,i)=>dot.onclick=()=>select(i));
  deck.ontouchstart=e=>{start=e.touches[0]};
  deck.ontouchend=e=>{const end=e.changedTouches[0];if(start && end){const dx=end.clientX-start.clientX,dy=end.clientY-start.clientY;if(Math.abs(dx)>36&&Math.abs(dx)>Math.abs(dy))select(current-Math.sign(dx))}start=null};
  dialog.onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();select(current+(e.key==='ArrowRight'?1:-1))}};
  select(0);enter.onclick=()=>dialog.close();
  return new Promise(resolve=>{
    const timer=setInterval(()=>{if(!document.hidden)ticks.forEach(tick=>tick())},1050);
    dialog.addEventListener('close',()=>{clearInterval(timer);resolve()},{once:true});
    dialog.showModal();enter.focus({preventScroll:true});
  });
}
