// This reading pause is deliberately outside the skippable animation timers.
export const SKIPPED_RESULT_HOLD=700;
export function createSpinResultGate({wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 let skipped=false,holding=false;
 return {
  get holding(){return holding;},
  begin({reduced=false}={}){skipped=reduced;},
  markSkipped(){if(holding)return false;skipped=true;return true;},
  async show(render){
   if(!skipped)return;
   holding=true;
   try{render();await wait(SKIPPED_RESULT_HOLD);}finally{holding=false;skipped=false;}
  },
 };
}
