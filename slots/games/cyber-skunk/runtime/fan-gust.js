// Paint the wake in the same coordinates as the extractor, water and real reel faces.
const clamp = x => Math.min(1, Math.max(0, x));
const smooth = x => {const p=clamp(x);return p*p*(3-2*p);};

export function windFront(t, reach, fanRadius) {
  return fanRadius*smooth((t-.47)/.16) + (reach*1.23-fanRadius)*smooth((t-.60)/.32);
}

export function shaftAngle(t, seconds, tier) {
  const peak = tier==='hidden'?1440:tier==='super'?1190:970;
  const cruise = tier==='hidden'?164:tier==='super'?120:75;
  const rise=clamp((t-.49)/.19), coast=clamp((t-.80)/.20);
  return -8*Math.sin(Math.PI*clamp((t-.42)/.09))+
    seconds*(peak*(.095*rise*rise+Math.max(0,t-.68))-(peak-cruise)*.10*coast*coast);
}

export function carryReelFaces(layer, faces) {
  const tiles=faces.map((source,i)=>{
    const copy=source.cloneNode(true), tile=document.createElement('span');
    copy.removeAttribute('id');tile.className='gust-glyph';tile.hidden=true;
    tile.append(copy);layer.append(tile);
    return {source,tile,i};
  });
  return {
    fit(ox,oy,cx,cy,w,h) {
      for(const p of tiles){
        const r=p.source.getBoundingClientRect();
        p.x=r.left-ox+r.width/2;p.y=r.top-oy+r.height/2;
        const dx=p.x-cx,dy=p.y-cy;
        p.distance=Math.hypot(dx,dy);
        // The outlet points into the room. A small axial flow keeps a face
        // directly in front of the hub moving even if its radial offset is zero.
        const vx=dx+(w>h?-w*.13:0),vy=dy+(w<=h?h*.15:0);
        const len=Math.hypot(vx,vy)||1;p.vx=vx/len;p.vy=vy/len;
        Object.assign(p.tile.style,{left:r.left-ox+'px',top:r.top-oy+'px',width:r.width+'px',height:r.height+'px'});
      }
    },
    update(front,reach) {
      for(const p of tiles){
        const push=front-p.distance;
        if(push<=0)continue;
        if(p.tile.hidden){p.source.classList.add('gust-lifted');p.tile.hidden=false;}
        const travel=push*(1.38+push/reach*.9), lean=Math.min(1,push/(reach*.26));
        const wobble=Math.sin((p.i+1)*3.5+push/reach*5)*lean*Math.min(24,reach*.03);
        const turn=(p.i%2?1:-1)*(22+(p.i%5)*8)*push/(reach*.26);
        p.tile.style.transform='translate3d('+(p.vx*travel-p.vy*wobble)+'px,'+
          (p.vy*travel+p.vx*wobble)+'px,0) rotate('+turn+'deg) scale('+(1+.29*lean)+')';
      }
    },
    clear(){for(const p of tiles){p.source.classList.remove('gust-lifted');p.tile.remove();}}
  };
}

export function paintGust(ctx,cx,cy,front,size,t){
  if(t<.52||t>.97||front<2)return;
  const power=smooth((t-.52)/.15)*(1-smooth((t-.86)/.11));
  ctx.save();ctx.lineCap='round';
  for(let j=0;j<26;j++){
    const a=j*2.39996+.10*Math.sin(j),phase=(t*2.9+j*.27)%1;
    const r=front*(.36+.66*phase),tip=r+size*(.055+.12*phase);
    ctx.save();ctx.translate(cx,cy);ctx.rotate(a);
    ctx.beginPath();ctx.moveTo(r,-size*.025);ctx.quadraticCurveTo((r+tip)/2,-size*.03,tip,0);
    ctx.strokeStyle=j%3?'#d8f5f4':'#95dcec';ctx.globalAlpha=power*.53*(1-phase*.5);
    ctx.lineWidth=(j%4===0?3:1.4);ctx.stroke();ctx.restore();
  }
  ctx.restore();
}
