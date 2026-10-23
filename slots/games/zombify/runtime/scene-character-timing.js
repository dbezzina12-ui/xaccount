// No animation loop runs between blinks. Every fourth idle cycle gets a
// second quick blink; timers are cancelled as soon as the scene is inactive.
export function createSceneBlink({draw,schedule=setTimeout,cancel=clearTimeout,random=Math.random}){
 const frames=[[0,0],[22,.28],[22,.65],[22,1],[65,1],[25,.7],[28,.3],[30,0]];
 let active=false,timer=null,cycle=0,epoch=0;
 const later=(fn,delay)=>{const token=epoch;timer=schedule(()=>{timer=null;if(active&&token===epoch)fn();},delay);};
 function blink(double=false,index=0){
  draw(frames[index][1]);
  if(index<frames.length-1){later(()=>blink(double,index+1),frames[index+1][0]);return;}
  if(double){later(()=>blink(false),175);return;}
  later(()=>blink(++cycle%4===0),3800+Math.max(0,Math.min(1,random()))*3400);
 }
 return {setActive(next){
  if(active===next)return;
  active=next;epoch++;if(timer!==null)cancel(timer);timer=null;draw(0);
  if(active)later(()=>blink(++cycle%4===0),2800+Math.max(0,Math.min(1,random()))*2200);
 },stop(){this.setActive(false);}};
}
