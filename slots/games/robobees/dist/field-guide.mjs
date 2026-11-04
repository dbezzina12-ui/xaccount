// The guide is presentation only. The entry click closes the native modal.
export function openFieldGuide(dialog, firstPage='cover'){
  if(dialog.open) return;
  const cover=dialog.querySelector('[data-page=cover]');
  const guide=dialog.querySelector('[data-page=guide]');
  const next=dialog.querySelector('[data-next]');
  const enter=dialog.querySelector('[data-enter]');
  const back=dialog.querySelector('[data-back]');
  function show(page){
    cover.hidden=page!=='cover';guide.hidden=!cover.hidden;
    dialog.setAttribute('aria-labelledby',cover.hidden?'guide-heading':'cover-heading');
    (cover.hidden?enter:next).focus({preventScroll:true});
  }
  return new Promise(resolve=>{
    next.onclick=()=>show('guide');
    back.onclick=()=>show('cover');
    enter.onclick=()=>dialog.close();
    dialog.addEventListener('close',resolve,{once:true});
    dialog.showModal();
    show(firstPage);
  });
}
