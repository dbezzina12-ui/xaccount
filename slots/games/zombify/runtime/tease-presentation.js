// A single reusable spotlight follows the next reel. No clock or outcome logic.
export function teaseStage(count){
 return count>=4?{color:'#d9a0ff',particle:0xd9a0ff}:count===3?{color:'#ffce72',particle:0xffce72}:{color:'#c3ff83',particle:0xc3ff83};
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
 const stopped=new Set();let dead=false;
 function settle({reel,count,board:cells,reels}){
  if(dead||shouldSkip())return;
  stopped.add(reel);if(count<2)return;
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
   frame.style.cssText=`left:${(top.left-bounds.left)/sx-3}px;top:${(top.top-bounds.top)/sy-3}px;width:${width}px;height:${height}px`;
   svg.setAttribute('viewBox',`0 0 ${width} ${height}`);rect.setAttribute('width',width-4);rect.setAttribute('height',height-4);
  }
 }
 function clear(){
  if(dead)return;dead=true;layer.remove();host.classList.remove('tease-active');
  if(camera){
   if(shouldSkip())camera.classList.add('tease-camera-snap');
   camera.classList.remove('tease-camera-in');
   if(shouldSkip()){void camera.offsetWidth;camera.classList.remove('tease-camera-snap');}
  }
  for(const tile of board.children)tile.classList.remove('tease-muted','fs-locked');
 }
 return {settle,clear};
}
