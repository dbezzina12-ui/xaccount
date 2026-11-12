import {clientToRig} from './aim.mjs';
// Presentation only: preserve the caller's recorded order and results.
export function createCrossfireBridge({actors,getCell,onPlacement,onShot=()=>{},mobilePresenter,onError=()=>{}}){
 return async function present({placements,sources=[],mobile=false,instant=()=>false,signal,speed=1}){
  if(mobile){
   if(typeof mobilePresenter!=='function')throw Error('Provide the existing mobile pistol presenter.');
   return mobilePresenter({placements,instant,signal,speed,onPlacement,onShot});
  }
  const applied=new Set();
  const place=(placement,index)=>{if(!applied.has(index)){applied.add(index);onPlacement(placement,index);}};
  const fighter=index=>sources[index%sources.length]?.fighter==='outlaw'?'outlaw':'hunter';
  const resolve=index=>{
   const actor=actors[fighter(index)],cell=getCell(placements[index]),actorRect=actor?.element?.getBoundingClientRect();
   if(!cell||!actor?.driver||!actorRect?.width||!actorRect?.height)return null;
   const rect=cell.getBoundingClientRect();
   return {actor,point:clientToRig({x:rect.left+rect.width/2,y:rect.top+rect.height/2},actorRect,actor.driver.manifest)};
  };
  for(let index=0;index<placements.length;){
   if(signal?.aborted)return {canceled:true};
   const first=instant()?null:resolve(index);
   if(!first){place(placements[index],index);index++;continue;}
   const start=index,run=[first];
   if(first.actor.driver.shootSequence){
    while(start+run.length<placements.length&&fighter(start+run.length)===fighter(start)){
     const next=resolve(start+run.length);if(!next)break;run.push(next);
    }
   }
   const shot=detail=>{
    const shotIndex=start+(detail.index??0);
    if(signal?.aborted||instant())return;
    onShot({...detail,placement:placements[shotIndex],index:shotIndex});place(placements[shotIndex],shotIndex);
   };
   const options={signal,speed,onShot:shot};
   const result=first.actor.driver.shootSequence
    ?await first.actor.driver.shootSequence(run.map(r=>r.point),options)
    :await first.actor.driver.shootAt(first.point,options);
   if(result.canceled||signal?.aborted)return {canceled:true};
   if(result.error)onError(result.error);
   // A media failure must not lose or duplicate the already selected results.
   for(let offset=0;offset<run.length;offset++)place(placements[start+offset],start+offset);
   index+=run.length;
  }
  return {canceled:false};
 };
}
