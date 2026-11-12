// Present the already-selected starting wild as a landing on bonus spin one.
// The authoritative board, fight, multiplier progression and award stay intact.
export function bonusEntryEvent(event){
 if(event.tier!=='hidden')return event;
 if(event.type==='bonusStart')return {...event,states:[]};
 if(event.type!=='spin'||event.turn!==1||event.before.length!==1)return event;
 const initial=event.before[0],row=Math.floor(event.raw[initial.reel].length/2);
 const raw=event.raw.map((column,reel)=>reel===initial.reel?column.map((symbol,index)=>index===row?{name:'VS'}:symbol):column);
 return {...event,raw,before:[],landings:[{...initial,row},...event.landings]};
}
