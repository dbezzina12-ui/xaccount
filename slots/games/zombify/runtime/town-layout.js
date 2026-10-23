const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
// Phone routes use exposed screen space, rather than the cropped desktop art.
// They never reserve layout space or cross the cabinet/controller.
export function mobileTownLayout({width,height,topbarBottom,machineTop,machineBottom,consoleTop}){
 const skyTop=topbarBottom+3,skyBottom=Math.max(skyTop,machineTop-5),skyHeight=skyBottom-skyTop;
 const batHeight=Math.min(19,skyHeight),batWidth=batHeight*2.5;
 const streetTop=machineBottom+5,streetBottom=Math.min(height,consoleTop)-5;
 const room=Math.max(0,streetBottom-streetTop),walkerHeight=Math.min(96,room*.74),walkerWidth=walkerHeight*.44;
 return {
  bats:Array.from({length:3},(_,i)=>({x:-batWidth,y:clamp(skyTop+i*skyHeight*.3,skyTop,Math.max(skyTop,skyBottom-batHeight)),width:batWidth,height:batHeight,distance:width+2*batWidth,hidden:batHeight<8})),
  walkers:[0,1].map(i=>({x:i===0?-walkerWidth:width,y:streetTop+(i===0?0:Math.min(9,room-walkerHeight)),width:walkerWidth,height:walkerHeight,distance:(i===0?1:-1)*(width+walkerWidth*2),hidden:walkerHeight<24}))
 };
}
