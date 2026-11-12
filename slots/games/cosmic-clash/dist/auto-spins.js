// One paid round at a time. A stop never interrupts settlement of that round.
export const AUTO_COUNTS=Object.freeze([10,25,50,100,1000]);
export function createAutoSpins({play,canPlay=()=>true,onChange=()=>{},onError=()=>{},wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}){
 let active=false,running=false,remaining=0;
 const notify=reason=>onChange({active,running,remaining,reason});
 function stop(reason='stopped'){
  if(!active)return;
  active=false;remaining=0;notify(reason);
 }
 async function start(count){
  if(active||running||!AUTO_COUNTS.includes(count)||!canPlay())return false;
  active=true;running=true;remaining=count;notify('started');
  try{
   while(active&&remaining>0){
    if(!canPlay()){stop('unavailable');break;}
    remaining--;notify('spin');
    // play resolves only after the complete round, including free spins and settlement.
    if(await play()!==true){stop('unavailable');break;}
    if(!active)break;
    if(remaining===0){stop('complete');break;}
    await wait(350);
   }
  }catch(error){stop('error');onError(error);}
  finally{active=false;running=false;remaining=0;notify('idle');}
  return true;
 }
 return {start,stop,get active(){return active;},get running(){return running;},get remaining(){return remaining;}};
}
