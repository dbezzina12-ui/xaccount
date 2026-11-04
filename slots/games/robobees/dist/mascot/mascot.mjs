// RoboBees' mascot: the hive and the robo-bee in #mascot-stage. Presentation only: it follows the game's state and
// never decides or changes an outcome, and turbo, Stop and skips never wait on it.
// The live 3D mascot (live3d.js: three.js, about 160 KB gzipped, loaded after the game starts) runs where the device
// renders it smoothly; it hands over to the pre-rendered sprites (sprites.mjs) where WebGL is missing or software-only,
// too slow, or lost. ?mascot=3d or ?mascot=sprites forces one. Neither draws on Math.random, the outcome stream.
const pick=new URLSearchParams(location.search).get('mascot');
export function mountMascot(stage){
 let impl=null,bank=0,turbo=false;
 function use(m,mode){impl=m;stage.dataset.mascot=mode;impl.setTurbo(turbo);impl.setBank(bank,{animate:false})}
 async function sprites(){
  impl?.dispose();impl=null;
  const m=await import('./sprites.mjs?v=3');use(m.mountMascot(stage),'sprites');
 }
 async function live(){
  const m=await import('./live3d.js?v=4');
  use(m.mountMascot(stage,{force:pick==='3d',onFail:reason=>{stage.dataset.mascotFallback=reason;sprites()}}),'3d');
 }
 (pick==='sprites'?sprites():live().catch(e=>{stage.dataset.mascotFallback=e?.message||'no 3D';return sprites()}));
 return {
  depart:()=>impl?impl.depart():Promise.resolve(),
  arrive:()=>impl?.arrive(),
  setBank(n,o){bank=n;impl?.setBank(n,o)},
  setTurbo(on){turbo=on;impl?.setTurbo(on)},
  // the bonus transition's flying bees, as the mascot; null keeps the painted drones
  swarm:()=>impl?.swarm?.()??null,
 };
}
