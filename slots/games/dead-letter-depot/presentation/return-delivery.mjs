import { finishEntryBeat } from './entry-timing.mjs';

// Use the painted parcel's coordinates on Frank's artboard, so the throw
// still connects after a Studio move, resize or phone rotation.
const parcelArt=new URL('../art/night-mail/camera-parcel.webp',import.meta.url).href;
const paperArt=new URL('../art/night-mail/parcel-paper.webp',import.meta.url).href;
const assets = Object.fromEntries(['torso-bare','wing-held','wing-open'].map(name =>
  [name, new URL('../art/night-mail/frank-motion/'+name+'.webp',import.meta.url).href]));
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const parcelReady=new Image();
parcelReady.src=parcelArt;
const ready=Promise.all([parcelReady.decode(), ...[paperArt,...Object.values(assets)].map(url => {
  const image=new Image();image.src=url;return image.decode();
})]).then(()=>true,()=>false);

async function move(node,frames,ms,easing='linear'){
  const motion=node.animate(frames,{duration:ms,easing,fill:'both'});
  try{await finishEntryBeat([motion]);}catch(error){if(error.name!=='AbortError')throw error;}
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

function cameraFlight(start, size) {
  const dx = innerWidth / 2 - start.x;
  const dy = innerHeight / 2 - start.y;
  const scale = size / start.width;
  const frames = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const travel = 1 - (1 - t) ** 2;
    const x = dx * travel;
    const y = dy * travel - 65 * Math.sin(t * Math.PI);
    const zoom = 1 + (scale - 1) * t ** 3.2;
    const angle = start.angle * (1 - t) ** 2 - 10 * Math.sin(t * Math.PI);
    frames.push({
      offset: t,
      transform: 'translate(-50%, -50%) translate(' + x + 'px,' + y +
        'px) rotate(' + angle + 'deg) scale(' + zoom + ')'
    });
  }
  return frames;
}

export async function throwParcelAtCamera(actor, onImpact) {
  const cover = document.createElement('div');
  cover.className = 'parcel-cover';
  cover.setAttribute('aria-hidden', 'true');
  const rig = !reduced.matches && await ready && mountThrowWing(actor);
  if (!rig) {
    onImpact();
    return { cover, restore() {} };
  }
  try {
    const releasePose = 'rotate(100deg)';
    rig.wing.style.transform = releasePose;
    await move(rig.wing, [
      { transform: 'rotate(0)' },
      { transform: 'rotate(-17deg)', offset: .52 },
      { transform: 'rotate(-14deg)', offset: .65 },
      { transform: releasePose }
    ], 280, 'cubic-bezier(.4,0,.55,1)');

    const start = handPosition(rig.artboard);
    const ratio = parcelReady.naturalHeight / parcelReady.naturalWidth;
    // The central 60% of the parcel face is opaque, including on tall phones.
    const size = Math.max(innerWidth, innerHeight / ratio) / .6;
    const nearSize = Math.min(innerWidth * .84, innerHeight * .7);
    const parcel = Object.assign(new Image(), {
      src: parcelArt, alt: '', className: 'camera-parcel'
    });
    Object.assign(parcel.style, {
      width: start.width + 'px',
      left: start.x + 'px',
      top: start.y + 'px'
    });
    const flight = cameraFlight(start, nearSize);
    parcel.style.transform = flight.at(-1).transform;
    cover.append(parcel);
    document.body.append(cover);
    rig.release();
    rig.wing.style.transform = 'rotate(12deg)';
    await Promise.all([
      move(parcel, flight, 340),
      move(rig.wing, [
        { transform: releasePose },
        { transform: 'rotate(124deg)', offset: .20 },
        { transform: 'rotate(8deg)', offset: .82 },
        { transform: 'rotate(12deg)' }
      ], 300, 'ease-out')
    ]);
    Object.assign(parcel.style, {
      width: nearSize + 'px', left: '50%', top: '50%',
      transform: 'translate(-50%, -50%)'
    });

    const paper = document.createElement('div');
    paper.className = 'parcel-paper';
    paper.style.width = nearSize + 'px';
    paper.style.aspectRatio = String(1 / ratio);
    for (const side of ['top', 'right', 'bottom', 'left']) {
      const flap = Object.assign(new Image(), {
        src: paperArt, alt: '', className: 'parcel-flap'
      });
      flap.dataset.side = side;
      paper.append(flap);
    }
    cover.prepend(paper);
    const seal = ['left', 'right'].map(side => {
      const half = document.createElement('div');
      half.className = 'parcel-seal-half';
      half.dataset.side = side;
      half.style.width = nearSize + 'px';
      half.style.aspectRatio = String(1 / ratio);
      const face = Object.assign(new Image(), { src: parcelArt, alt: '' });
      half.append(face);
      cover.append(half);
      return half;
    });
    const center = 'translate(-50%, -50%)';
    const expanded = center + ' scale(' + size / nearSize + ')';
    paper.style.transform = expanded;
    parcel.style.opacity = '0';
    await Promise.all([
      move(parcel, [{ opacity: 1 }, { opacity: 0 }], 65),
      move(paper, [{ transform: center }, { transform: expanded }], 245,
        'cubic-bezier(.45,.03,.75,.55)'),
      ...seal.map((half, index) => {
        const direction = index === 0 ? -1 : 1;
        half.style.opacity = '0';
        return move(half, [
          { transform: center, opacity: 1 },
          { transform: center + ' translate(' + direction * 5 + 'px,0) rotate(' +
            direction * 5 + 'deg)', opacity: 1, offset: .22 },
          { transform: center + ' translate(' + direction * nearSize * .4 +
            'px,' + nearSize * .12 + 'px) rotate(' + direction * 34 +
            'deg)', opacity: 0 }
        ], 180, 'ease-in');
      })
    ]);
    parcel.remove();
    for (const half of seal) half.remove();
    Object.assign(paper.style, {
      width: size + 'px', transform: center
    });
    onImpact();
    return { cover, restore: rig.restore };
  } catch (error) {
    rig.restore();
    cover.remove();
    throw error;
  }
}

export async function clearParcelCover(cover) {
  const paper = cover.querySelector('.parcel-paper');
  if (!paper || reduced.matches) return;
  const rect = paper.getBoundingClientRect();
  const x = innerWidth / 2 + rect.width * .65;
  const y = innerHeight / 2 + rect.height * .65;
  const exits = {
    top: 'translateY(' + -y + 'px) rotate(-9deg)',
    right: 'translateX(' + x + 'px) rotate(12deg)',
    bottom: 'translateY(' + y + 'px) rotate(9deg)',
    left: 'translateX(' + -x + 'px) rotate(-12deg)'
  };
  await Promise.all(Array.from(paper.children, flap => move(flap, [
    { transform: 'none' },
    { transform: exits[flap.dataset.side] }
  ], 235, 'cubic-bezier(.3,.04,.62,.62)')));
}
