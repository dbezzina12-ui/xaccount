// Decorative video never participates in reel state or outcomes.
export function mountBackgroundWind(game){
 const host=game.querySelector('.jacket-wind'),video=host.querySelector('video');
 const desktop=matchMedia('(min-width:761px) and (hover:hover) and (pointer:fine)'),reduce=matchMedia('(prefers-reduced-motion:reduce)');
 let request=0;
 const sync=()=>{
  const token=++request;
  if(!desktop.matches||reduce.matches||document.hidden){video.pause();if(!desktop.matches||reduce.matches)game.classList.remove('wind-ready');return;}
  if(!video.getAttribute('src')){video.src='./assets/background-wind/jackets.mp4';video.load();}
  video.muted=true;
  video.play().then(()=>{if(token===request)game.classList.add('wind-ready');}).catch(()=>{game.classList.remove('wind-ready');});
 };
 video.addEventListener('error',()=>game.classList.remove('wind-ready'));
 desktop.addEventListener('change',sync);reduce.addEventListener('change',sync);document.addEventListener('visibilitychange',sync);document.addEventListener('pointerdown',sync,{once:true});sync();
}
