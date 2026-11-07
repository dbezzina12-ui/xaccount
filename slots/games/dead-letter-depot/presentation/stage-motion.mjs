import { mountFrankMotion } from './frank-motion.mjs';
import { throwParcelAtCamera, clearParcelCover } from './return-delivery.mjs';
import { dwell } from './dispatch.mjs';
import { buildBonusBrief } from './bonus-brief.mjs';

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

async function animate(element,frames,duration,easing){
  if(reduced.matches)return;
  const animation=element.animate(frames,{duration,easing,fill:'both'});
  try {await animation.finished;} catch(error){if(error.name!=='AbortError')throw error;}
  finally {animation.cancel();}
}

export async function enterDispatch({bonus,scatters,trigger,spins,show,onImpact,onReveal,variant='collections',preview=false}){
  const anchor=document.createComment('Frank stage position');
  frank.before(anchor);
  let cover;
  const {scene,visual,button,ready}=buildBonusBrief({bonus,tier:bonus.tier,title:bonus.title,spins,trigger,variant,preview});
  let restoreParcel=()=>{};
  try {
    scatters.forEach(tile=>tile.classList.add('dispatch-scatter'));
    if(scatters.length)await dwell(reduced.matches?150:280);
    const delivery=await throwParcelAtCamera(frank,onImpact);
    cover=delivery.cover;
    restoreParcel=delivery.restore;
    restoreParcel();
    frank.dispatchEvent(new CustomEvent('depot:frank',{bubbles:true,detail:{action:'bonus',tier:bonus.tier}}));
    syncShift(bonus.tier);
    show('','dispatch-dialog');
    visual.append(frank);
    document.getElementById('paper').replaceChildren(scene,cover);
    modal.setAttribute('aria-labelledby','bonus-title');
    await ready;
    // The same actor stays alive across the cut, finishing the salute and breathing.
    await clearParcelCover(cover);
    cover?.remove();
    button.disabled=false;
    button.focus({preventScroll:true});
    await new Promise(done=>button.addEventListener('click',done,{once:true}));
    button.disabled=true;
    // Retain the modal focus trap during the physical exit. The first free spin
    // starts only after the completed exit, through the normal resume cursor.
    const stage=scene;
    onReveal();
    await animate(stage,[{transform:'translateY(0)',opacity:1},{transform:'translateY(-8%)',opacity:0}],500,'cubic-bezier(.4,0,.55,1)');
    anchor.after(frank);
    modal.close();
  } finally {
    restoreParcel();
    modal.removeAttribute('aria-labelledby');
    anchor.replaceWith(frank);
    cover?.remove();
    scatters.forEach(tile=>tile.classList.remove('dispatch-scatter'));
  }
}
