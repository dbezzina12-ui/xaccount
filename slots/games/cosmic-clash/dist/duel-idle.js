// Derive only the existing luminous details from the original artwork once.
// The resulting runtime layers use the portrait's exact crop and size in CSS.
// No new character art, per-frame pixel processing, or additional media files.
const REGIONS = {
  portraits: [
    {box:[298,248,370,341],color:'orange'}, // Hunter respirator
    {box:[573,388,708,453],color:'orange'}, // Hunter weapon strip
    {box:[1138,208,1300,312],color:'cyan'}, // Outlaw visor
    {box:[819,393,980,486],color:'cyan'}, // Outlaw weapon strip
    {box:[1174,684,1387,829],color:'cyan'}, // Outlaw forearm light
  ],
  boss: [{box:[230,166,598,294],color:'red'}],
};
const clamp=x=>Math.max(0,Math.min(1,x));

export function emissivePixels(source,width,height,kind){
  const pixels=new Uint8ClampedArray(source.length);
  for(const {box:[left,top,right,bottom],color} of REGIONS[kind]){
    for(let y=top;y<Math.min(bottom,height);y++)for(let x=left;x<Math.min(right,width);x++){
      const i=(y*width+x)*4,r=source[i],g=source[i+1],b=source[i+2];
      const strength=color==='cyan'?Math.min((g-r-36)/95,(b-r-48)/100,(b-132)/105):
        color==='red'?Math.min((r-g-55)/100,(r-b-55)/100,(r-128)/105):
        Math.min((r-g-35)/80,(g-b-36)/85,(r-165)/70);
      // Feather region limits; contours still come from the painted light pixels.
      const edge=clamp(Math.min(x-left,right-1-x,y-top,bottom-1-y)/6);
      const alpha=clamp(strength)*edge*source[i+3];
      if(alpha<=pixels[i+3])continue;
      const tint=color==='cyan'?[99,232,255]:color==='red'?[255,57,32]:[255,165,56];
      pixels[i]=tint[0];pixels[i+1]=tint[1];pixels[i+2]=tint[2];pixels[i+3]=alpha;
    }
  }
  return pixels;
}

export async function mountDuelIdleLights(root){
  return Promise.all([
    ['portraits','./assets/comic-v64/portraits.webp','--winner-portrait-lights'],
    ['boss','./assets/boss-fighter.png','--winner-boss-lights'],
  ].map(async([kind,src,property])=>{
    try{
      const image=new Image();image.src=src;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
      const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
      const source=ctx.getImageData(0,0,canvas.width,canvas.height);
      source.data.set(emissivePixels(source.data,canvas.width,canvas.height,kind));ctx.putImageData(source,0,0);
      root.style.setProperty(property,`url("${canvas.toDataURL('image/png')}")`);
      return true;
    }catch{return false;} // Optional lighting can never block starting a round.
  }));
}
