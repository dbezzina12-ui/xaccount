import { mountFrankMotion } from './frank-motion.mjs';
import { dwell, dispatchFlights } from './dispatch.mjs';

const stylesheet=document.createElement('link');
stylesheet.rel='stylesheet';
stylesheet.href=new URL('./stage-motion.css',import.meta.url).href;
document.head.append(stylesheet);

// The card occupies the same reserved space as the readout, clear of row five.
const note=document.getElementById('dispatch-note');
const pocket=document.createElement('div');
pocket.className='dispatch-pocket';
note.before(pocket);
pocket.append(document.getElementById('readout'),note);

const frank=document.querySelector('.postmaster');
mountFrankMotion(frank);
const modal=document.getElementById('modal');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');

export function syncShift(tier){
  if(tier)document.body.dataset.shift=tier;
  else delete document.body.dataset.shift;
}

function makeCover(){
  const cover=document.createElement('div');
  cover.className='dispatch-cover';
  cover.setAttribute('aria-hidden','true');
  const seal=new Image();
  seal.src=new URL('../art/night-mail/symbols/stamp.webp',import.meta.url).href;
  seal.alt='';
  cover.append(seal);
  return cover;
}

async function animate(element,frames,duration,easing){
  if(reduced.matches)return;
  const animation=element.animate(frames,{duration,easing,fill:'both'});
  try {await animation.finished;} catch(error){if(error.name!=='AbortError')throw error;}
  finally {animation.cancel();}
}

function label(tag,className,copy){
  const el=document.createElement(tag);
  el.className=className;
  el.textContent=copy;
  return el;
}

export async function enterDispatch({bonus,scatters,trigger,description,spins,show,onReveal}){
  const anchor=document.createComment('Frank stage position');
  frank.before(anchor);
  const cover=makeCover();
  const ticket=document.createElement('section');
  ticket.className='dispatch-ticket';
  const button=label('button','cta','Start '+spins+' free spins');
  button.id='startBonus';button.disabled=true;
  ticket.append(label('small','dispatch-origin',trigger),label('h2','',bonus.title),label('p','',description),button);
  const scene=document.createElement('div');
  scene.className='dispatch-scene';scene.dataset.tier=bonus.tier;
  try {
    scatters.forEach(tile=>tile.classList.add('dispatch-scatter'));
    if(scatters.length)await dwell(reduced.matches?150:280);
    frank.dispatchEvent(new CustomEvent('depot:frank',{bubbles:true,detail:{action:'bonus',tier:bonus.tier}}));
    await Promise.all([
      dwell(930),
      dispatchFlights(scatters,frank)
    ]);
    const box=frank.getBoundingClientRect();
    const x=box.left+box.width*.45-window.innerWidth/2;
    const y=box.top+box.height*.58-window.innerHeight/2;
    document.body.append(cover);
    await animate(cover,[
      {transform:'translate('+x+'px,'+y+'px) rotate(-24deg) scale(.035)',opacity:.8},
      {transform:'translate('+x*.43+'px,'+y*.43+'px) rotate(-10deg) scale(.25)',offset:.4},
      {transform:'rotate(0deg) scale(1)',opacity:1}
    ],460,'cubic-bezier(.4,.05,.56,1)');
    syncShift(bonus.tier);
    show('','dispatch-dialog');
    scene.append(frank,ticket);
    document.getElementById('paper').replaceChildren(scene,cover);
    // The same actor stays alive across the cut, finishing the salute and breathing.
    await animate(cover,[{transform:'translateY(0) rotate(0deg)'},{transform:'translateY(-122%) rotate(-5deg)'}],470,'cubic-bezier(.5,.04,.79,.32)');
    cover.remove();
    button.disabled=false;
    button.focus({preventScroll:true});
    await new Promise(done=>button.addEventListener('click',done,{once:true}));
    button.disabled=true;
    // Retain the modal focus trap during the physical exit. The first free spin
    // starts only after the completed exit, through the normal resume cursor.
    const stage=frank.parentNode;
    onReveal();
    await animate(stage,[{transform:'translateY(0)',opacity:1},{transform:'translateY(-8%)',opacity:0}],500,'cubic-bezier(.4,0,.55,1)');
    anchor.after(frank);
    modal.close();
  } finally {
    anchor.replaceWith(frank);
    cover.remove();
    scatters.forEach(tile=>tile.classList.remove('dispatch-scatter'));
  }
}

export function revealReceipt(cents,format){
  const amount=document.querySelector('.receipt-amount');
  if(!amount)return;
  const start=performance.now(),duration=800;
  function draw(now){
    if(!amount.isConnected || !modal.open)return;
    const t=reduced.matches?1:Math.min(1,(now-start)/duration);
    amount.textContent=format(Math.round(cents*(1-(1-t)**3)));
    if(t<1)requestAnimationFrame(draw);
  }
  draw(start);
}
