import {createTeaseCamera} from './tease-camera.js';
// A single reusable spotlight follows the next reel. No clock or outcome logic.
export function teaseStage(count){
 return count>=4?{color:'#d9a0ff',particle:0xd9a0ff}:count===3?{color:'#ffce72',particle:0xffce72}:{color:'#c3ff83',particle:0xc3ff83};
}
export function teaseMessage(count){
 if(count>=5)return {title:'HIDDEN OUTBREAK SECURED',detail:'5+ scatters landed'};
 if(count===4)return {title:'SUPER OUTBREAK SECURED',detail:'One more scatter upgrades to Hidden'};
 if(count===3)return {title:'OUTBREAK SECURED',detail:'One more scatter upgrades to Super'};
 return {title:'OUTBREAK SIGNAL',detail:'2 scatters landed · one more to trigger'};
}
export function createTeasePresentation({host,board,shouldSkip=()=>false,speed='normal'}){
 const camera=host.parentElement;
 // The scene camera (S-27): a slow push from the second FS, a punch per drop.
 const scene=createTeaseCamera({game:host.closest?.('#game'),speed,shouldSkip,reduced:()=>!!host.ownerDocument.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches});
 const doc=host.ownerDocument,layer=doc.createElement('div');layer.className='tease-stage';layer.hidden=true;layer.setAttribute('aria-hidden','true');
 const frame=doc.createElement('div');frame.className='tease-focus';
 const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('preserveAspectRatio','none');
 const rect=doc.createElementNS(svg.namespaceURI,'rect');
 for(const [key,value] of Object.entries({x:'2',y:'2',rx:'9',pathLength:'100'}))rect.setAttribute(key,value);
 svg.append(rect);
 const sweep=doc.createElement('span');sweep.className='tease-sweep';
 const feet=doc.createElement('span');feet.className='tease-footlight';frame.append(svg,sweep,feet);
 layer.append(frame);host.append(layer);
 const status=doc.createElement('div');status.className='tease-status';status.hidden=true;status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const title=doc.createElement('strong'),detail=doc.createElement('span'),ladder=doc.createElement('div');ladder.className='tease-ladder';
 const badges=['3 · OUTBREAK','4 · SUPER','5 · HIDDEN'].map(label=>{const el=doc.createElement('i');el.textContent=label;ladder.append(el);return el;});
 status.append(title,detail,ladder);(camera||host).append(status);
 const stopped=new Set(),animations=new Set();let dead=false,lastCount=0,focusPlaced=false,teaseLanded=-1,released=null;
 function settle({reel,count,board:cells,reels}){
  if(dead)return;
  if(shouldSkip()){scene.snap();return;}
  stopped.add(reel);if(count<2)return;
  const dropped=count>lastCount;teaseLanded++;
  layer.style.setProperty('--tease-level',String(Math.min(5,count)-1));
  const message=teaseMessage(count);title.textContent=message.title;detail.textContent=message.detail;
  status.hidden=false;status.style.setProperty('--tease-color',teaseStage(count).color);
  if(!status.classList.contains('on-sign'))coverSign();
  badges.forEach((badge,i)=>badge.classList.toggle('secured',count>=i+3));
  if(count>lastCount&&status.animate){
   // A pop, not a fade: the status covers the title sign, which must not show through.
   const animation=status.animate([{scale:'.92',translate:'0 4px'},{scale:'1.04',offset:.6},{scale:'1',translate:'0 0'}],{duration:300,easing:'cubic-bezier(.2,.8,.2,1)'});
   animations.add(animation);animation.finished.catch(()=>{}).finally(()=>animations.delete(animation));
  }lastCount=count;
  layer.hidden=false;host.classList.add('tease-active');layer.style.setProperty('--tease-color',teaseStage(count).color);
  for(let i=0;i<cells.length;i++){
   const landed=stopped.has(i%6),fs=cells[i].kind==='vial';
   board.children[i].classList.toggle('tease-muted',landed&&!fs);
   board.children[i].classList.toggle('fs-locked',landed&&fs);
  }
  const next=reels.findIndex((r,i)=>i>reel&&r.window.isConnected);
  for(let i=0;i<reels.length;i++)reels[i].window.classList.toggle('tease-waiting',i>next&&next>=0);
  frame.hidden=next<0;
  if(dropped)burst(cells,reel,count);
  // The camera keeps creeping while a reel is still teasing; it lets go as
  // the last one lands, alongside that reel's landing.
  if(next>=0)scene.push({count,landed:teaseLanded,drop:dropped,focus:next});
  else released=scene.release({secured:count>=3});
  if(next>=0){
   camera?.classList.add('tease-camera-in');
   const top=board.children[next].getBoundingClientRect(),bottom=board.children[24+next].getBoundingClientRect(),bounds=layer.getBoundingClientRect();
   const sx=layer.clientWidth?bounds.width/layer.clientWidth:1,sy=layer.clientHeight?bounds.height/layer.clientHeight:1;
   const width=top.width/sx+6,height=(bottom.bottom-top.top)/sy+6;
   frame.style.cssText=`left:0;top:0;transform:translate(${(top.left-bounds.left)/sx-3}px,${(top.top-bounds.top)/sy-3}px);width:${width}px;height:${height}px;${focusPlaced?'':'transition:none;'}`;
   focusPlaced=true;
   svg.setAttribute('viewBox',`0 0 ${width} ${height}`);rect.setAttribute('width',width-4);rect.setAttribute('height',height-4);
  }
 }
 // Where the scene has a title sign above the reels (Studio/Play), the status
 // takes the sign's exact box: it covers the sign at any layout size instead
 // of leaving its edges showing. Measured before the camera moves; both then
 // scale together inside the same layer.
 function coverSign(){
  const sign=host.closest?.('#game')?.querySelector(':scope > .play-area .brand'),parent=status.offsetParent;
  if(!sign||!parent)return;
  const r=sign.getBoundingClientRect(),p=parent.getBoundingClientRect();
  if(!r.width||!r.height||doc.defaultView.getComputedStyle(sign).visibility==='hidden')return;
  const sx=parent.clientWidth?p.width/parent.clientWidth:1,sy=parent.clientHeight?p.height/parent.clientHeight:1;
  Object.assign(status.style,{left:`${(r.left-p.left)/sx}px`,top:`${(r.top-p.top)/sy}px`,width:`${r.width/sx}px`,height:`${r.height/sy}px`,bottom:'auto',transform:'none',minWidth:'0',maxWidth:'none'});
  status.classList.add('on-sign');
 }
 // A shock ring from each FS that lands during the tease, in the tier colour.
 function burst(cells,reel,count){
  const bounds=layer.getBoundingClientRect(),sx=layer.clientWidth?bounds.width/layer.clientWidth:1,sy=layer.clientHeight?bounds.height/layer.clientHeight:1;
  for(let i=reel;i<cells.length;i+=6){
   if(cells[i].kind!=='vial')continue;
   const r=board.children[i].getBoundingClientRect(),ring=doc.createElement('span');ring.className='tease-ring';
   ring.style.cssText=`left:${(r.left-bounds.left)/sx}px;top:${(r.top-bounds.top)/sy}px;width:${r.width/sx}px;height:${r.height/sy}px;--tease-color:${teaseStage(count).color}`;
   layer.append(ring);
   if(!ring.animate){ring.remove();continue;}
   const animation=ring.animate([{transform:'scale(.55)',opacity:1},{transform:'scale(1.75)',opacity:0}],{duration:560,easing:'cubic-bezier(.2,.7,.3,1)'});
   animations.add(animation);animation.finished.catch(()=>{}).finally(()=>{animations.delete(animation);ring.remove();});
  }
 }
 // Returns once the camera is back at scale 1, so nothing after the reels
 // measures a zoomed board.
 function clear(){
  if(dead)return released||Promise.resolve();dead=true;
  if(shouldSkip())scene.snap();
  const camera3=released||scene.release({secured:lastCount>=3});for(const a of animations)a.cancel();animations.clear();layer.remove();status.remove();host.classList.remove('tease-active');
  for(const reel of host.querySelectorAll('.tease-waiting'))reel.classList.remove('tease-waiting');
  if(camera){
   if(shouldSkip())camera.classList.add('tease-camera-snap');
   camera.classList.remove('tease-camera-in');
   if(shouldSkip()){void camera.offsetWidth;camera.classList.remove('tease-camera-snap');}
  }
  for(const tile of board.children)tile.classList.remove('tease-muted','fs-locked');
  return camera3;
 }
 return {settle,clear};
}
