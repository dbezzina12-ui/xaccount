// Invisible gutter anchors preserve the existing responsive reel layout.
// A fixed 2:3 sprite frame keeps original artwork and its contour matte aligned.
export function mountStandingFigures(game){
 const pairs=['hunter','outlaw'].map(name=>({
  figure:game.querySelector(`.fighter-${name}`),
  anchor:game.querySelector(`[data-figure-space="${name}"]`)
 }));
 let frame=0;
 const update=()=>{
  frame=0;const origin=game.getBoundingClientRect();
  for(const {figure,anchor} of pairs){
   const rect=anchor.getBoundingClientRect();
   const height=Math.min(rect.height,rect.width*1.18*1.5),width=height/1.5;
   figure.style.setProperty('--figure-left',`${rect.left-origin.left+(rect.width-width)/2}px`);
   figure.style.setProperty('--figure-top',`${rect.bottom-origin.top-height}px`);
   figure.style.setProperty('--figure-width',`${width}px`);
   figure.style.setProperty('--figure-height',`${height}px`);
  }
 };
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
 const observer=new ResizeObserver(schedule);
 observer.observe(game);for(const {anchor} of pairs)observer.observe(anchor);
 update();
 return ()=>{observer.disconnect();if(frame)cancelAnimationFrame(frame);};
}
