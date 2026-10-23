// A bounded decorative field: no extra renderer, ticker, or gameplay state.
export function createInfectionField(horizontal=false){
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
 svg.classList.add('infection-field');svg.setAttribute('viewBox','0 0 100 100');
 svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');
 const paths=[
  'M50 100 Q34 78 23 64 T16 28 L8 0 M23 64 L6 53 M16 28 L34 12',
  'M50 100 Q64 74 81 56 T85 20 L96 0 M81 56 L98 44 M85 20 L68 5',
  'M50 100 Q42 67 48 48 T43 0 M48 48 L32 35 M47 24 L62 10'
 ];
 paths.forEach((d,i)=>{
  for(const pulse of [false,true]){
   const path=document.createElementNS(ns,'path');path.setAttribute('d',d);
   if(horizontal)path.setAttribute('transform','rotate(90 50 50)');
   path.setAttribute('pathLength','100');path.setAttribute('vector-effect','non-scaling-stroke');
   path.classList.add(pulse?'infection-pulse':'infection-vein');
   path.style.setProperty('--pulse-delay',`${-i*1.3}s`);svg.append(path);
  }
 });
 const ring=document.createElementNS(ns,'ellipse');ring.setAttribute('cx','50');ring.setAttribute('cy','55');
 ring.setAttribute('rx','38');ring.setAttribute('ry','38');ring.classList.add('infection-ripple');svg.append(ring);
 return svg;
}
