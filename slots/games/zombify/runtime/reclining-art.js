import {loadImage} from './asset-cache.js';
// Dedicated compact and outstretched art. Uniform scaling only, no body slices.
const POSES={compact:{url:'assets/rework/zombie-crawl-compact-v73.png',width:1902,height:827,box:'42 8 1844 785'},wide:{url:'assets/rework/zombie-crawl-wide-v73.png',width:2172,height:724,box:'16 115 2144 491'}};
export const RECLINING_ZOMBIE=POSES.wide.url;
let ready;
export function createRecliningArt(direction='right',span=4){
 const art=document.createElement('div');art.className='resolved-reclining-zombie';
 art.setAttribute('aria-hidden','true');art.dataset.face=direction==='left'?'left':'right';
 const pose=span<=3?POSES.compact:POSES.wide,ns='http://www.w3.org/2000/svg';
 const svg=document.createElementNS(ns,'svg'),image=document.createElementNS(ns,'image');
 svg.setAttribute('viewBox',pose.box);svg.setAttribute('preserveAspectRatio','xMidYMax meet');
 image.setAttribute('href',pose.url);image.setAttribute('width',pose.width);image.setAttribute('height',pose.height);
 svg.append(image);art.append(svg);return art;
}
export function recliningArtReady(){
 if(!ready)ready=Promise.all(Object.values(POSES).map(pose=>loadImage(pose.url))).catch(error=>{ready=null;throw error;});
 return ready;
}
