// Ground contact is registered to the road in the bottom-aligned cover artwork.
// The mascot may sit behind the transparent controller, but never in the sky.
export function foregroundMascotLayout({width,height,cabinetLeft,cabinetWidth,cabinetBottom}){
 const portrait=width<=height;
 const art=portrait?{width:941,height:1672,ground:1510}:{width:1672,height:941,ground:854};
 const scale=Math.max(width/art.width,height/art.height);
 const ground=height-(art.height-art.ground)*scale;
 const aspect=779/1730;
 const available=Math.max(0,ground-cabinetBottom-8);
 const mascotWidth=Math.min(cabinetWidth,available/aspect);
 const mascotHeight=mascotWidth*aspect;
 return {left:cabinetLeft+(cabinetWidth-mascotWidth)/2,top:ground-mascotHeight,width:mascotWidth,height:mascotHeight,ground};
}
