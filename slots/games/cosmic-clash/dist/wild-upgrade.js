// Roll the number inside its existing wild; the multiplication sign stays still.
export async function rollWildMultiplier(cell,from,to,{reduced=false,duration=520}={}){
 const label=cell?.querySelector('.wild-multiplier');if(!label)return;
 cell.setAttribute('aria-label',`Multiplier wild ${to} times`);
 if(reduced||from===to){label.textContent=`${to}×`;return;}
 const doc=cell.ownerDocument,window=doc.createElement('span'),strip=doc.createElement('span');
 window.className='multiplier-window';strip.className='multiplier-strip';window.style.width=`${Math.max(String(from).length,String(to).length)}ch`;
 for(const value of [from,to]){const number=doc.createElement('span');number.textContent=String(value);strip.append(number);}
 window.append(strip);label.replaceChildren(window,doc.createTextNode('×'));cell.classList.add('wild-upgraded');
 let motion;
 try{motion=strip.animate([{transform:'translateY(0)'},{transform:'translateY(-50%)'}],{duration,easing:'cubic-bezier(.22,.75,.2,1)',fill:'forwards'});await motion.finished;}
 catch{/* A cancelled animation must still leave the authoritative value visible. */}
 finally{label.textContent=`${to}×`;motion?.cancel();cell.classList.remove('wild-upgraded');}
}
