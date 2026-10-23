import {Tween,Group,Easing} from './vendor/motion-tools.js';

// One presentation clock, advanced by the existing celebration controller.
// No timers, animation frames, or award/balance ownership here.
export function createWinMotion(dialog,{tier,reduced=false}={}){
 const group=new Group(),values={entrance:reduced?1:0,number:1,impact:0};
 let clock=0,finished=false,dead=false,last=0;
 const peaks={nice:[.22],big:[.53,.84],epic:[.2,.4,.6,.8],max:[.27,.65]};
 const strength={nice:.35,big:.65,epic:.5,max:1}[tier]??.35;
 const seen=new Set();
 const set=(name,value)=>dialog.style.setProperty('--win-'+name,String(value));
 const tween=(object,to,duration,easing)=>new Tween(object,group).to(to,duration).easing(easing).start(clock);
 if(!reduced)tween(values,{entrance:1},560,Easing.Back.Out);
 function render(progress){
  set('entrance',values.entrance);set('number-pop',values.number);set('impact',values.impact);
  set('progress',progress);
  const jump=tier==='big'?Math.max(0,Math.sin(Math.PI*Math.min(1,Math.max(0,(progress-.14)/.39)))):0;
  set('shadow-scale',1-jump*.25);set('shadow-opacity',.6-jump*.24);
 }
 render(0);
 return {
  update(progress,seconds,{completed=false,skipped=false}={}){
   if(dead)return;
   progress=Math.max(last,Math.min(1,Number(progress)||0));last=progress;
   clock+=Math.max(0,Math.min(.2,Number(seconds)||0))*1000;
   group.update(clock);
   if(!reduced&&!skipped&&!completed){
    // Fire only the latest crossed beat on a delayed frame.
    let hit=false;
    for(const peak of peaks[tier]??[])if(progress>=peak&&!seen.has(peak)){seen.add(peak);hit=true;}
    if(hit){values.impact=strength;tween(values,{impact:0},340,Easing.Quadratic.Out);}
   }
   if(completed&&!finished){
    finished=true;group.removeAll();values.entrance=1;values.impact=0;
    if(!reduced&&!skipped){values.number=1.075;tween(values,{number:1},420,Easing.Cubic.Out);}
    else values.number=1;
   }
   if(reduced){values.entrance=1;values.number=1;values.impact=0;}
   render(progress);
  },
  destroy(){dead=true;group.removeAll();for(const key of ['entrance','number-pop','impact','progress','shadow-scale','shadow-opacity'])dialog.style.removeProperty?.('--win-'+key);},
 };
}
