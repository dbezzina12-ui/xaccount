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
export function createTeasePresentation({host,board,shouldSkip=()=>false}){
 const camera=host.parentElement;
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
 const stopped=new Set(),animations=new Set();let dead=false,lastCount=0,focusPlaced=false;
 function settle({reel,count,board:cells,reels}){
  if(dead||shouldSkip())return;
  stopped.add(reel);if(count<2)return;
  const message=teaseMessage(count);title.textContent=message.title;detail.textContent=message.detail;
  status.hidden=false;status.style.setProperty('--tease-color',teaseStage(count).color);
  badges.forEach((badge,i)=>badge.classList.toggle('secured',count>=i+3));
  if(count>lastCount&&status.animate){
   const animation=status.animate([{opacity:.45,translate:'0 5px'},{opacity:1,translate:'0 0'}],{duration:260,easing:'cubic-bezier(.2,.8,.2,1)'});
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
 function clear(){
  if(dead)return;dead=true;for(const a of animations)a.cancel();animations.clear();layer.remove();status.remove();host.classList.remove('tease-active');
  for(const reel of host.querySelectorAll('.tease-waiting'))reel.classList.remove('tease-waiting');
  if(camera){
   if(shouldSkip())camera.classList.add('tease-camera-snap');
   camera.classList.remove('tease-camera-in');
   if(shouldSkip()){void camera.offsetWidth;camera.classList.remove('tease-camera-snap');}
  }
  for(const tile of board.children)tile.classList.remove('tease-muted','fs-locked');
 }
 return {settle,clear};
}
