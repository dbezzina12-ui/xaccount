import {createFXModel} from './fx-model.js';

export function createZombieEffects({host,board,shouldSkip=()=>false,
  loadSurface=()=>import('./vendor/pixi-effects.js'),env=globalThis}) {
  const doc=host.ownerDocument,motion=env.matchMedia('(prefers-reduced-motion: reduce)');
  const layer=doc.createElement('div');layer.className='zombie-fx';layer.setAttribute('aria-hidden','true');host.append(layer);
  const model=createFXModel({limit:128});
  let surface=null,loading=null,failed=false,disposed=false,raf=null;
  const blocked=()=>disposed||motion.matches||doc.hidden||shouldSkip();
  function disable(){failed=true;model.clear();if(raf!==null)env.cancelAnimationFrame(raf);raf=null;try{surface?.destroy();}catch{}surface=null;}
  function paint(now){
    raf=null;if(blocked()){clear();return;}
    try{surface?.render(model.update(now));}catch{disable();return;}
    if(model.count)raf=env.requestAnimationFrame(paint);
  }
  async function warm(){
    if(disposed||failed||motion.matches||doc.hidden)return false;
    if(surface)return true;
    if(!loading)loading=(async()=>{
      try {
        const {createSurface}=await loadSurface();
        if(disposed)return false;
        const next=await createSurface(layer);
        if(disposed){next.destroy();return false;}
        surface=next;return true;
      }catch{disable();return false;}
    })();
    return loading;
  }
  function emit(fn){
    if(blocked()||failed)return;
    if(!surface){void warm();return;} // Do not replay a stale impact after loading.
    try{fn(env.performance.now());if(raf===null)raf=env.requestAnimationFrame(paint);}catch{disable();}
  }
  function cell(index){
    const tile=board.children[index];if(!tile)return null;
    const r=tile.getBoundingClientRect(),b=layer.getBoundingClientRect();
    const sx=b.width&&layer.clientWidth?b.width/layer.clientWidth:1,sy=b.height&&layer.clientHeight?b.height/layer.clientHeight:1;
    return {x:(r.left-b.left+r.width/2)/sx,y:(r.top-b.top+r.height/2)/sy,width:r.width/sx,height:r.height/sy};
  }
  function clear(tag){
    model.clear(tag);
    if(!model.count&&raf!==null){env.cancelAnimationFrame(raf);raf=null;}
    try{surface?.render(model.update(env.performance.now()));}catch{disable();}
  }
  const onVisibility=()=>{if(doc.hidden)clear();},onMotion=()=>{if(motion.matches)clear();},onResize=()=>clear();
  const onPageHide=event=>{if(event.persisted)clear();else destroy();};
  doc.addEventListener('visibilitychange',onVisibility);motion.addEventListener('change',onMotion);
  env.addEventListener('resize',onResize);env.addEventListener('pagehide',onPageHide);
  function destroy(){
    if(disposed)return;disposed=true;clear();surface?.destroy();surface=null;layer.remove();
    doc.removeEventListener('visibilitychange',onVisibility);motion.removeEventListener('change',onMotion);
    env.removeEventListener('resize',onResize);env.removeEventListener('pagehide',onPageHide);
  }
  return {
    warm,clear,destroy,
    reelStop(reel,scatter=false){emit(now=>{
      const p=cell(24+reel);if(!p)return;
      model.burst({x:p.x,y:p.y+p.height*.34,scale:p.width,count:scatter?12:6,color:scatter?0xffd17a:0x93a99b,angle:-Math.PI/2,spread:Math.PI*.75,power:.5,tag:'reel',now});
    });},
    scatter(index,color=0xc3ff83,count=1){emit(now=>{
      const p=cell(index);if(!p)return;
      model.burst({x:p.x,y:p.y,scale:p.width,count:count>=3?22:12,color,angle:-Math.PI/2,spread:Math.PI*1.6,power:.8,tag:'scatter',now});
      model.ring({x:p.x,y:p.y,scale:p.width*1.25,color,tag:'scatter',now});
    });},
    bite(index,direction,gain){emit(now=>{
      const p=cell(index);if(!p)return;
      const angle={left:Math.PI,right:0,up:-Math.PI/2,down:Math.PI/2}[direction]??0;
      model.burst({x:p.x,y:p.y,scale:p.width,count:gain>1?19:12,color:gain>1?0xe3f993:0xa8d74c,angle,spread:Math.PI*1.2,now});
      model.ring({x:p.x,y:p.y,scale:p.width*.85,now});
    });},
    claim(indices){emit(now=>{
      const ps=indices.map(cell).filter(Boolean);if(!ps.length)return;
      const bottom=Math.max(...ps.map(p=>p.y+p.height/2)),x=ps.reduce((sum,p)=>sum+p.x,0)/ps.length;
      model.burst({x,y:bottom-5,scale:ps[0].width,count:24,angle:-Math.PI/2,spread:Math.PI*.85,power:1.1,now});
      model.ring({x,y:bottom-ps[0].height*.22,scale:ps[0].width*1.2,now});
    });},
    line(indices){emit(now=>{
      model.clear('line');const points=indices.map(cell).filter(Boolean);
      if(points.length)model.trace({points,scale:points[0].width,now});
    });},
    win(){emit(now=>{
      const width=layer.clientWidth,height=layer.clientHeight,scale=Math.min(width/6,100);
      for(const x of [width*.13,width*.87])model.burst({x,y:height*.64,scale,count:22,color:0xf4cd77,angle:-Math.PI/2,spread:Math.PI*.7,power:1.5,tag:'win',now});
    });},
  };
}
