import {makeRound,seeded,walkSuper,walkZombies} from './math.js';

// Deterministic illustrations resolved by the game. No wallet or paid session.
const indices=[0,1,2,6,7,8,12,13,14];
const blank=()=>Array.from({length:30},(_,i)=>({id:`guide:${i}`,kind:['k','j','q','a'][i%4]}));
const reveal=(board,caption)=>({type:'reveal',board,caption});
const carry=board=>Object.fromEntries(board.filter(c=>c.kind==='zombie').map(c=>[c.id,c.multi]));

export function createGuideScenes(){
 const bites=makeRound({kind:'carriers',rng:seeded(2)});
 const biteOpening=bites.events.find(e=>e.type==='reveal').board;
 const biteEvents=walkZombies(biteOpening,seeded(2)).events.filter(e=>e.type==='walk'||e.type==='expand');
 const hiddenTurn=multi=>{
  const board=blank();
  board[13]={id:'guide:hidden',kind:'zombie',multi,eaten:0,direction:'up',superZombie:true,hiddenBonus:true,startRow:2};
  board[7]={id:'guide:cop',kind:'cop',biteValue:5};board[1]={id:'guide:nurse',kind:'nurse',biteValue:3};
  return {board,result:walkSuper(board)};
 };
 const hiddenFirst=hiddenTurn(4),hiddenSecond=hiddenTurn(carry(hiddenFirst.result.board)['guide:hidden']);
 const heartTurn=(multipliers,heart)=>{
  const board=blank();
  board[12]={id:'guide:left',kind:'zombie',multi:multipliers[0],eaten:0,direction:'up'};
  board[14]={id:'guide:right',kind:'zombie',multi:multipliers[1],eaten:0,direction:'up'};
  board[6]={id:'guide:heart',kind:heart?'heart':'nurse'};
  board[8]={id:'guide:food',kind:'cop',biteValue:heart?5:1};
  return {board,result:walkZombies(board,seeded(2),{hearts:true})};
 };
 const heartFirst=heartTurn([3,0],true),retained=carry(heartFirst.result.board);
 const heartSecond=heartTurn([retained['guide:left'],retained['guide:right']],false);
 return [
  {indices:[12,13,14,18,19,20,24,25,26],initial:biteOpening,events:biteEvents,final:biteEvents.at(-1).board,openingCaption:'WATCH EVERY BITE ADD UP',finalCaption:'3× + 5× = 8× WILD'},
  {indices,initial:hiddenFirst.board,events:[...hiddenFirst.result.events,{type:'hold',caption:'12× SAVED FOR THE NEXT FREE SPIN'},reveal(hiddenSecond.board,'12× RETURNS. KEEP BUILDING.'),...hiddenSecond.result.events],final:hiddenSecond.result.board,openingCaption:'START WITH YOUR SAVED 4×',finalCaption:'4× → 12× → 20× · MULTIPLIERS CARRY'},
  {indices,initial:heartFirst.board,events:[...heartFirst.result.events,{type:'hold',caption:'HEART COLLECTED · +1 RESPIN'},reveal(heartSecond.board,'RESPIN · BOTH MULTIPLIERS RETURN'),...heartSecond.result.events],final:heartSecond.result.board,openingCaption:'TWO ZOMBIES. FIND A HEART.',finalCaption:'KEEP YOUR ZOMBIES. KEEP YOUR MULTIPLIERS.'}
 ];
}
