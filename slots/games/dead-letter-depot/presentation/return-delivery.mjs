// Use the painted parcel's coordinates on Frank's artboard, so the throw
// still connects after a Studio move, resize or phone rotation.
const parcelArt=new URL('../art/night-mail/return-parcel.webp',import.meta.url).href;
const emptyTorso=new URL('../art/night-mail/frank-motion/torso-released.webp',import.meta.url).href;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const parcelReady=new Image(),torsoReady=new Image();
parcelReady.src=parcelArt;
torsoReady.src=emptyTorso;
const ready=Promise.all([parcelReady.decode(),torsoReady.decode()]).catch(()=>false);

async function move(node,frames,ms,easing='linear'){
  const motion=node.animate(frames,{duration:ms,easing,fill:'both'});
  try{await motion.finished;}catch(error){if(error.name!=='AbortError')throw error;}
  finally{motion.cancel();}
}

function handPosition(actor) {
  const body=actor.querySelector('[data-joint="torso"]');
  const matrix=body?.getScreenCTM();
  if(matrix){
    const point=new DOMPoint(120,391).matrixTransform(matrix);
    return {x:point.x,y:point.y,width:124*Math.hypot(matrix.a,matrix.b)};
  }
  const rect=actor.getBoundingClientRect();
  return {x:rect.x+rect.width*.3,y:rect.y+rect.height*.57,width:rect.width*.24};
}

function parcelFlight(start,end){
  const dx=end.x-start.x,dy=end.y-start.y;
  const distance=Math.hypot(dx,dy);
  const lift=Math.min(145,Math.max(45,distance*.32));
  const frames=[];
  for(let i=0;i<=18;i++){
    const t=i/18;
    const x=dx*t;
    const y=dy*t-4*lift*t*(1-t);
    const size=1+.45*Math.sin(t*Math.PI)-.1*t;
    frames.push({offset:t,transform:'translate('+x+'px,'+y+'px) rotate('+(-12-210*t)+'deg) scale('+size+')'});
  }
  return frames;
}

export async function knockOffBadge(actor,onImpact){
  const mount=document.querySelector('.floor > .sign');
  const badge=mount.querySelector('h1 img');
  const counter=mount.querySelector('#held');
  if(reduced.matches){onImpact();return ()=>{};}
  await ready;
  const actorArt=actor.querySelector('svg') || actor.querySelector('img');
  const torso=actor.querySelector('[data-joint="torso"] > image');
  const original=torso?.getAttribute('href');
  const restore=()=>{if(original)torso.setAttribute('href',original)};
  const face=badge.getBoundingClientRect();
  const end={x:face.left+face.width*.73,y:face.top+face.height*.31};
  const direction=end.x>handPosition(actor).x?1:-1;
  const tilt=(angle,stretch=1)=>'rotate('+(angle*direction)+'deg) scale(1,'+stretch+')';
  // Wind back on planted feet, then release as the body snaps forwards.
  actorArt.style.transformOrigin='50% 94%';
  actor.dispatchEvent(new CustomEvent('depot:frank',{detail:{action:'throw'}}));
  await move(actorArt,[{transform:tilt(0)},{transform:tilt(-11,.94),offset:.68},{transform:tilt(9,1.03)}],340,'ease-in-out');
  const start=handPosition(actor);
  const parcel=Object.assign(new Image(),{src:parcelArt,alt:'',className:'return-parcel'});
  parcel.style.width=start.width+'px';
  parcel.style.left=(start.x-start.width/2)+'px';
  parcel.style.top=(start.y-start.width*(parcelReady.naturalHeight/Math.max(1,parcelReady.naturalWidth))/2)+'px';
  const signCopy=badge.cloneNode(false);
  signCopy.alt='';signCopy.className='loose-badge';
  try{
    if(torso && torsoReady.naturalWidth)torso.setAttribute('href',emptyTorso);
    document.body.append(parcel);
    await Promise.all([
      move(actorArt,[{transform:tilt(9,1.03)},{transform:tilt(11),offset:.18},{transform:tilt(0)}],360,'ease-out'),
      move(parcel,parcelFlight(start,end),560)
    ]);
    // The cut is on contact: the loose sign carries the art away while
    // the mechanical register is already visible behind it.
    parcel.remove();
    Object.assign(signCopy.style,{left:face.x+'px',top:face.y+'px',width:face.width+'px',height:face.height+'px'});
    document.body.append(signCopy);
    onImpact();
    const distance=Math.min(innerHeight-face.top+face.height,innerHeight*.86);
    await Promise.all([
      move(signCopy,[
        {transform:'rotate(0)',offset:0},
        {transform:'translate(3px,-3px) rotate(-5deg)',offset:.13},
        {transform:'rotate(12deg)',offset:.32},
        {transform:'rotate(8deg)',offset:.46},
        {transform:'translate(4px,12px) rotate(19deg)',offset:.60},
        {transform:'translate(28px,'+distance+'px) rotate(67deg)',opacity:0,offset:1}
      ],690,'linear'),
      move(counter,[{filter:'brightness(1.5)'},{filter:'brightness(1)'}],460,'ease-out'),
    ]);
    return restore;
  }catch(error){restore();throw error}
  finally{parcel.remove();signCopy.remove();actorArt.style.removeProperty('transform-origin');}
}
