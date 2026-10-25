// Presentation only. Count settled columns, never change the selected outcome.
export function reelTeasePlan(board,bonus=false,speed='normal'){
 const pace={normal:[1656,817],quick:[1242,621],turbo:[920,449]}[speed];
 if(!pace)throw Error('Unknown presentation speed');
 let count=0,trigger=-1;
 return Array.from({length:6},(_,reel)=>{
  const tease=!bonus&&trigger>=0;
  const start=trigger<0?0:1050+trigger*165;
  const ms=tease?start+pace[0]+(reel-trigger-1)*pace[1]:1050+reel*165;
  const result={tease,start,ms,slowUnits:7+2*(reel-trigger-1)};
  count+=board.filter((cell,i)=>i%6===reel&&cell.kind==='vial').length;
  if(!bonus&&count>=2&&trigger<0)trigger=reel;
  return result;
 });
}
export function reelFrames({distance,unit},plan){
 const frame=(y,offset)=>({transform:`translateY(${y}px)`,offset});
 if(!plan.tease)return [frame(-distance,0),frame(-distance+unit*3,.14),frame(-unit*4,.8),frame(unit*.045,.96),frame(0,1)];
 // Full-speed travel first, then readable individual symbols from the moment
 // the second FS lands. Remaining reels stay in this slow phase together.
 const brake=frame(-plan.slowUnits*unit,plan.start/plan.ms);
 // Match the fast travel into a 380 ms braking curve, then creep steadily.
 brake.easing='cubic-bezier(.2,.45,.55,.84)';
 const approach=frame(-unit*.45,(plan.ms-240)/plan.ms);
 approach.easing='cubic-bezier(.2,.6,.5,1)';
 return [frame(-distance,0),brake,frame(-(plan.slowUnits-3.6)*unit,(plan.start+380)/plan.ms),approach,frame(unit*.035,(plan.ms-85)/plan.ms),frame(0,1)];
}
export function mysteryScatterBoard(tier){
 const reels={regular:[0,1,4],super:[0,1,3,5],hidden:[0,1,2,4,5]}[tier];
 if(!reels)throw Error('Unknown mystery bonus');
 const board=Array.from({length:30},(_,i)=>({id:`mystery-${i}`,kind:['j','q','k','a'][i%4]}));
 for(const reel of reels)board[((reel+2)%5)*6+reel].kind='vial';
 return board;
}
