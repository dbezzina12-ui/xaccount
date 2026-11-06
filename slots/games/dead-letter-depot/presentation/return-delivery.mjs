// Use the painted parcel's coordinates on Frank's artboard, so the throw
// still connects after a Studio move, resize or phone rotation.
const parcelArt=new URL('../art/night-mail/return-parcel.webp',import.meta.url).href;
const assets = Object.fromEntries(['torso-bare','wing-held','wing-open'].map(name =>
  [name, new URL('../art/night-mail/frank-motion/'+name+'.webp',import.meta.url).href]));
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const parcelReady=new Image();
parcelReady.src=parcelArt;
const ready=Promise.all([parcelReady.decode(), ...Object.values(assets).map(url => {
  const image=new Image();image.src=url;return image.decode();
})]).then(()=>true,()=>false);

async function move(node,frames,ms,easing='linear'){
  const motion=node.animate(frames,{duration:ms,easing,fill:'both'});
  try{await motion.finished;}catch(error){if(error.name!=='AbortError')throw error;}
  finally{motion.cancel();}
}

// Throw-only art is registered to the same painting as Frank’s everyday pose.
// The body under this wing is painted separately so the tucked wing can open.
function mountThrowWing(actor) {
  const body=actor.querySelector('[data-joint="torso"] > image');
  if(!body)return null;
  const original=body.getAttribute('href');
  const ns=body.namespaceURI;
  const pivot=document.createElementNS(ns,'g');
  pivot.setAttribute('transform','translate(118 300)');
  const wing=document.createElementNS(ns,'g');
  wing.dataset.throwWing='';
  const artboard=document.createElementNS(ns,'g');
  artboard.setAttribute('transform','translate(-118 -300)');
  const painting=document.createElementNS(ns,'image');
  for(const [k,v] of Object.entries({x:0,y:265,width:194,height:258,href:assets['wing-held']}))
    painting.setAttribute(k,v);
  artboard.append(painting);wing.append(artboard);pivot.append(wing);
  body.setAttribute('href',assets['torso-bare']);
  body.after(pivot);
  actor.classList.add('throwing-parcel');
  return {wing,artboard,release(){painting.setAttribute('href',assets['wing-open'])},
    restore(){body.setAttribute('href',original);pivot.remove();actor.classList.remove('throwing-parcel')}};
}

function handPosition(artboard) {
  const matrix=artboard.getScreenCTM();
  const point=new DOMPoint(120,389).matrixTransform(matrix);
  return {x:point.x,y:point.y,width:124*Math.hypot(matrix.a,matrix.b),
    angle:Math.atan2(matrix.b,matrix.a)*180/Math.PI};
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
    frames.push({offset:t,transform:'translate('+x+'px,'+y+'px) rotate('+(start.angle-210*t)+'deg) scale('+size+')'});
  }
  return frames;
}

export async function knockOffBadge(actor,onImpact){
  const mount=document.querySelector('.floor > .sign');
  const badge=mount.querySelector('h1 img');
  const counter=mount.querySelector('#held');
  if(reduced.matches){onImpact();return ()=>{};}
  const rig=await ready && mountThrowWing(actor);
  if(!rig){onImpact();return ()=>{};}
  const face=badge.getBoundingClientRect();
  const end={x:face.left+face.width*.73,y:face.top+face.height*.31};
  // Hold the final pose while measuring the grip and swapping out the parcel.
  const releasePose='rotate(100deg)';
  rig.wing.style.transform=releasePose;
  await move(rig.wing,[{transform:'rotate(0)'},{transform:'rotate(-17deg)',offset:.52},
    {transform:'rotate(-14deg)',offset:.65},{transform:releasePose}],470,'cubic-bezier(.4,0,.55,1)');
  const start=handPosition(rig.artboard);
  const parcel=Object.assign(new Image(),{src:parcelArt,alt:'',className:'return-parcel'});
  parcel.style.width=start.width+'px';
  parcel.style.left=(start.x-start.width/2)+'px';
  parcel.style.top=(start.y-start.width*(parcelReady.naturalHeight/Math.max(1,parcelReady.naturalWidth))/2)+'px';
  const signCopy=badge.cloneNode(false);
  signCopy.alt='';signCopy.className='loose-badge';
  try{
    rig.release();
    rig.wing.style.transform='rotate(12deg)';
    document.body.append(parcel);
    await Promise.all([
      move(rig.wing,[{transform:releasePose},{transform:'rotate(124deg)',offset:.20},
        {transform:'rotate(8deg)',offset:.82},{transform:'rotate(12deg)'}],480,'ease-out'),
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
    return rig.restore;
  }catch(error){rig.restore();throw error}
  finally{parcel.remove();signCopy.remove();}
}
