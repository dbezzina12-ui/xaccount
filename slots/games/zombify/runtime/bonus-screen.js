// Presentation only: cover the scene before changing modes, and resume the
// existing round only after one deliberate Continue and the opening stinger.
export function createBonusScreen({dialog,content,doors,button,reduced=false,onWaiting=()=>{},
 wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}){
 let phase='idle',active=null,resume=null,revision=0;
 const animations=new Set();
 const setPhase=value=>{phase=value;dialog.dataset.phase=value;};
 const valid=ticket=>ticket===revision;
 async function motion(node,frames,duration){
  if(reduced||!node.animate)return;
  let animation;
  try{animation=node.animate(frames,{duration,easing:'cubic-bezier(.22,.76,.24,1)',fill:'both'});animations.add(animation);await animation.finished;}
  catch{/* A cancelled visual must never interrupt the round. */}
  finally{if(animation){animations.delete(animation);animation.cancel();}}
 }
 function reset(){
  onWaiting(false);button.disabled=true;content.hidden=true;
  setPhase('idle');if(dialog.open)dialog.close();
 }
 async function cover(ticket){
  content.hidden=true;button.disabled=true;setPhase('closing');
  doors.forEach((door,i)=>{door.style.transform=`translateX(${i?101:-101}%)`;});
  if(!dialog.open)dialog.showModal();
  await Promise.all(doors.map(async(door,i)=>{
   await motion(door,[{transform:`translateX(${i?101:-101}%)`},{transform:'translateX(0)'}],460);
   if(valid(ticket))door.style.transform='translateX(0)';
  }));
  if(valid(ticket))setPhase('covered');
 }
 async function uncover(ticket){
  setPhase('opening');
  await Promise.all(doors.map(async(door,i)=>{
   await motion(door,[{transform:'translateX(0)'},{transform:`translateX(${i?101:-101}%)`}],520);
   if(valid(ticket))door.style.transform=`translateX(${i?101:-101}%)`;
  }));
 }
 function run(flow){
  if(active)return active;
  const ticket=++revision;
  active=Promise.resolve().then(()=>flow(ticket)).finally(()=>{
   if(valid(ticket)){resume=null;active=null;reset();}
  });
  return active;
 }
 return {
  read:()=>({phase,active:!!active}),
  show({onCovered=()=>{},onContinue=()=>{}}={}){
   return run(async ticket=>{
    await cover(ticket);if(!valid(ticket))return;
    await onCovered();if(!valid(ticket))return;
    content.hidden=false;setPhase('revealing');
    await motion(content,[{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],300);
    if(!valid(ticket))return;
    const accepted=new Promise(resolve=>{resume=resolve;});
    setPhase('ready');button.disabled=false;onWaiting(true);button.focus({preventScroll:true});
    await accepted;if(!valid(ticket))return;
    await motion(content,[{opacity:1},{opacity:0}],150);if(!valid(ticket))return;content.hidden=true;
    await onContinue();if(!valid(ticket))return;
    if(!reduced)await wait(100);if(!valid(ticket))return;
    await uncover(ticket);
   });
  },
  continue(){
   if(phase!=='ready'||!resume)return false;
   setPhase('leaving');button.disabled=true;onWaiting(false);
   const resolve=resume;resume=null;resolve();return true;
  },
  cross(onCovered=()=>{}){
   return run(async ticket=>{
    await cover(ticket);if(!valid(ticket))return;
    await onCovered();if(!valid(ticket))return;
    if(!reduced)await wait(140);if(!valid(ticket))return;
    await uncover(ticket);
   });
  },
  cancel(){
   ++revision;for(const animation of animations)animation.cancel();animations.clear();
   const resolve=resume;resume=null;active=null;reset();resolve?.();
  }
 };
}
