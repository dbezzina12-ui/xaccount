// Optional artwork must never block a resolved spin or its Skip control.
export function loadAtlas(metadataURL) {
  const atlas={data:null};
  atlas.ready=(async()=>{
    try {
      const url=new URL(metadataURL,import.meta.url);
      const response=await fetch(url);
      if(!response.ok)return null;
      const metadata=await response.json();
      for(const key of ['frameWidth','frameHeight','columns','rows','frameCount','durationMs']){
        if(!Number.isInteger(metadata[key])||metadata[key]<=0)throw Error('Invalid sprite metadata');
      }
      if(metadata.frameCount>metadata.columns*metadata.rows)throw Error('Invalid sprite grid');
      const image=new Image();
      image.src=new URL(metadata.image,url).href;
      await image.decode();
      if(image.naturalWidth!==metadata.frameWidth*metadata.columns||image.naturalHeight!==metadata.frameHeight*metadata.rows)throw Error('Sprite dimensions do not match');
      atlas.data={image,metadata};return atlas.data;
    } catch {return null;}
  })();
  return atlas;
}

export function playAtlas(canvas,data,{durationMs=data?.metadata.durationMs,activeAnimations,shouldStop=()=>false,heightRatio=1,frameOffsets,renderScale=1}={}) {
  if(!data||!canvas)return Promise.resolve();
  const ctx=canvas.getContext('2d');
  if(!ctx)return Promise.resolve();
  const {image,metadata:m}=data;
  const responsive=m.fit==='contain'||m.fit==='height';
  canvas.width=m.frameWidth;canvas.height=Math.max(1,Math.round(m.frameHeight*heightRatio));
  let last=-1;
  const draw=frame=>{
    let resized=false;
    if(responsive){
      // Match the backing canvas to its displayed rectangle. Stretching a
      // narrow source canvas with CSS would distort the face a second time.
      const bounds=canvas.getBoundingClientRect();
      const density=Math.min(2,globalThis.devicePixelRatio||1);
      const width=Math.max(1,Math.round(bounds.width*density));
      const height=Math.max(1,Math.round(bounds.height*density));
      if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;resized=true;}
    }
    if(frame===last&&!resized)return;
    last=frame;ctx.clearRect(0,0,canvas.width,canvas.height);
    // Height fit deliberately draws beyond the sides of the canvas. The reel
    // window hides that overflow instead of squeezing or shrinking the zombie.
    const scale=m.fit==='height'?canvas.height/m.frameHeight:m.fit==='contain'?Math.min(canvas.width/m.frameWidth,canvas.height/m.frameHeight):renderScale;
    const width=m.frameWidth*scale,height=m.frameHeight*scale;
    const x=(canvas.width-width)/2;
    const y=responsive?(canvas.height-height)*(m.verticalAlignments?.[frame]??1):(frameOffsets?.[frame]||0);
    ctx.drawImage(image,frame%m.columns*m.frameWidth,Math.floor(frame/m.columns)*m.frameHeight,m.frameWidth,m.frameHeight,x,y,width,height);
  };
  return new Promise(resolve=>{
    let done=false,raf=null,timer=null;
    const start=performance.now();
    const controller={finish:()=>{
      if(done)return;
      done=true;cancelAnimationFrame(raf);clearTimeout(timer);
      activeAnimations?.delete(controller);
      try {draw(m.frameCount-1);} catch { /* A lost drawing context cannot stall a spin. */ }
      resolve();
    }};
    const tick=now=>{
      if(done)return;
      if(shouldStop()||now-start>=durationMs){controller.finish();return;}
      try {draw(Math.min(m.frameCount-1,Math.floor((now-start)/durationMs*m.frameCount)));}
      catch {controller.finish();return;}
      raf=requestAnimationFrame(tick);
    };
    activeAnimations?.add(controller);
    // requestAnimationFrame can stop in a hidden tab. The clock still settles
    // this Promise, while finish() supports the game's existing Skip action.
    timer=setTimeout(controller.finish,Math.max(0,durationMs));
    if(durationMs<=0||shouldStop()){controller.finish();return;}
    tick(start);
  });
}
