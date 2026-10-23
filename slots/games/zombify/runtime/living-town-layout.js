import {TOWN_ART} from './scene-character-art.js';
// All art-space features follow the same bottom-aligned cover crop as the town.
export function townArtFrame(width,height){
 const portrait=width<=height;
 const art=TOWN_ART[portrait?'portrait':'desktop'];
 const scale=Math.max(width/art.width,height/art.height);
 return {...art,portrait,scale,x:(width-art.width*scale)/2,y:height-art.height*scale};
}

export function visibleTownStreet({machineBottom,trackerBottom=0,desktopTop,desktopVisible,mobileTop,mobileVisible,height}){
 return {machineBottom:Math.max(machineBottom,trackerBottom),consoleTop:mobileVisible?mobileTop:desktopVisible?desktopTop:height};
}
