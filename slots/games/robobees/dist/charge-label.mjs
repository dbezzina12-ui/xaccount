// The board, manual and starting grid all render the same cell charge.
export function chargeLabel(label,value){
 const key=String(value||0);
 if(label.dataset.value===key)return;
 label.dataset.value=key;label.classList.add('charge-label');
 label.replaceChildren();label.hidden=!value;
 label.toggleAttribute('data-long',value>=100);
 if(value){
  const cross=document.createElement('small');cross.textContent='×';
  label.append(String(value),cross);
 }
}
