// One shared attempt, including concurrent Play/Retry calls. Successful tasks
// stay cached; failures remain visible and only failed tasks run again.
export function createLoadingState(tasks){
 const done=new Set(),listeners=new Set();let pending=null,state={status:'idle',loaded:0,total:tasks.length};
 const notify=()=>{for(const fn of listeners)fn({...state});};
 return {
  read:()=>({...state}),
  subscribe(fn){listeners.add(fn);fn({...state});return()=>listeners.delete(fn);},
  ensure(){
   if(state.status==='ready')return Promise.resolve();
   if(pending)return pending;
   state.status='loading';notify();
   pending=(async()=>{
    const results=await Promise.allSettled(tasks.map(async(task,i)=>{if(done.has(i))return;await task();done.add(i);state.loaded=done.size;notify();}));
    const failure=results.find(r=>r.status==='rejected');
    state.status=failure?'error':'ready';notify();
    if(failure)throw failure.reason;
   })().finally(()=>{pending=null;});
   return pending;
  }
 };
}
