// The same SVG supplies the shop still and the moving shell. Keep one set of
// gradients and clip paths in the page so every scatter can move independently.
export const honeyStill='assets/fs-honey.svg';
let template;

export function addHoney(tile){
 if(!template||tile.querySelector(':scope > .fs-rig'))return;
 tile.firstElementChild.after(template.cloneNode(true));
}

export async function prepareHoney(){
 try{
  const response=await fetch(honeyStill);
  if(!response.ok)return;
  const svg=new DOMParser().parseFromString(await response.text(),'image/svg+xml').documentElement;
  const defs=svg.querySelector('defs');
  if(!defs||!svg.querySelector('.fs-shell'))return;
  document.querySelector('body > svg > defs').append(...Array.from(defs.children,node=>document.importNode(node,true)));
  defs.remove();
  template=document.importNode(svg,true);
  template.removeAttribute('role');template.removeAttribute('aria-label');
  template.setAttribute('aria-hidden','true');template.setAttribute('focusable','false');template.classList.add('fs-rig');
  document.querySelectorAll('.cell.scatter').forEach(addHoney);
 }catch{/* The regular image already shows the filled glass at rest. */}
}
