// Cosmetic landing cue. The settled tile remains the authoritative game cell.
// A body-level copy can briefly leave the cabinet without clipping neighboring
// reels or changing their geometry, hit tests, or expansion targets.
export async function playZombieLanding(tile,{animate,shouldSkip=()=>false}={}){
  if(shouldSkip()||!tile||tile.dataset.kind!=='zombie'||tile.classList.contains('stack-covered')||tile.classList.contains('claimed'))return;
  const source=tile.querySelector('.symbol');
  if(!source)return;
  const doc=tile.ownerDocument,rect=source.getBoundingClientRect();
  if(!rect.width||!rect.height)return;
  const ghost=doc.createElement('div');
  ghost.className='expander-landing-pop';ghost.setAttribute('aria-hidden','true');
  Object.assign(ghost.style,{left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`});
  const copy=source.cloneNode(false);
  copy.className='expander-landing-art';
  copy.style.backgroundImage=doc.defaultView.getComputedStyle(source).backgroundImage;
  ghost.append(copy);
  const previousVisibility=source.style.visibility;
  doc.body.append(ghost);source.style.visibility='hidden';
  try{
    await animate(ghost,[
      {transform:'translateY(0) scale(1)',offset:0},
      {transform:'translateY(5%) scale(1.06,.91)',offset:.16},
      {transform:'translateY(-27%) scale(1.24)',offset:.48},
      {transform:'translateY(2%) scale(1.08,.96)',offset:.82},
      {transform:'translateY(0) scale(1)',offset:1}
    ],420,{easing:'cubic-bezier(.22,.65,.32,1)'});
  }catch{
    // Cancelling a decorative animation must never interrupt a round.
  }finally{
    ghost.remove();source.style.visibility=previousVisibility;
  }
}
