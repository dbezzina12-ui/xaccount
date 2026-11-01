export const AUTOPLAY_AMOUNTS=[10,25,50,100,1000];

// Own the pending next-spin timer so stopping during the gap cannot start
// another paid round. The running round remains owned by the game/session.
export class Autoplay{
 constructor({schedule=setTimeout,cancel=clearTimeout}={}){this.remaining=0;this.revision=0;this.timer=null;this.schedule=schedule;this.cancel=cancel;}
 get active(){return this.remaining>0;}
 start(amount){if(!AUTOPLAY_AMOUNTS.includes(amount))throw Error('Choose an autoplay amount');this.stop();this.remaining=amount;}
 stop(){this.remaining=0;this.revision++;if(this.timer!==null)this.cancel(this.timer);this.timer=null;}
 finishRound(next,delay=450){
  if(!this.active)return;
  this.remaining--;
  if(!this.active)return;
  const revision=this.revision;
  this.timer=this.schedule(()=>{if(revision!==this.revision||!this.active)return;this.timer=null;next();},delay);
 }
}
