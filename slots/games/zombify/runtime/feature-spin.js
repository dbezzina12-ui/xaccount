import {CARDS,PEOPLE,CAP,WIDTH,HEIGHT,step,walkZombies} from './math.js';
import {lineWins} from './paylines.js';
import {FEATURE_SPIN} from './config.js';

const directions=['up','down','left','right'];
const clone=board=>board.map(cell=>({...cell}));
const pick=(items,rng)=>items[Math.floor(rng()*items.length)];
const ray=(source,direction)=>{
 const cells=[];
 for(let index=step(source,direction);index>=0;index=step(index,direction))cells.push(index);
 return cells;
};

// Resolve both opening paths together. One zombie must never eat the other's
// guaranteed first target before it gets a turn. Later path crossings still
// stop normally at a head or wild trail. Distinct reels always permit a pair
// of independent vertical paths, so this selection is bounded, not a retry.
export function featureDirections(anchors,preferred,rng=Math.random){
 const safe=pair=>{
  const paths=anchors.map((source,i)=>ray(source,pair[i]));
  return paths.every((path,i)=>path.length&&!anchors.includes(path[0])&&paths.every((other,j)=>i===j||!other.includes(path[0])));
 };
 if(safe(preferred))return preferred;
 const choices=anchors.map(index=>directions.filter(d=>step(index,d)>=0&&!anchors.includes(step(index,d))));
 const pairs=choices[0].flatMap(a=>choices[1].map(b=>[a,b])).filter(safe);
 if(!pairs.length)throw Error('Feature zombies have no independent opening paths.');
 const changes=pair=>pair.reduce((n,d,i)=>n+(d!==preferred[i]),0),minimum=Math.min(...pairs.map(changes));
 return pick(pairs.filter(pair=>changes(pair)===minimum),rng);
}

// Each round is resolved before playback. Respins carry each ORIGINAL zombie's
// own collected multiplier, never a merged reel value counted a second time.
export function makeFeatureRound({rng=Math.random}={}){
 const anchors=[];
 while(anchors.length<FEATURE_SPIN.zombies){
  const index=Math.floor(rng()*WIDTH*HEIGHT);
  if(!anchors.some(a=>a%WIDTH===index%WIDTH))anchors.push(index);
  // Constant test RNGs must not trap anchor selection in a retry loop.
  else anchors.push((anchors[0]+1)%(WIDTH*HEIGHT));
 }
 const ids=anchors.map((_,i)=>`second-life:${i}`),carried=Object.fromEntries(ids.map(id=>[id,0]));
 const events=[];let serial=0,total=0,turn=0,left=1,hearts=0,biteCount=0,reelCount=0,multi=0,eaten=0;
 const cell=(kind,extra={})=>({id:`life:${++serial}`,kind,...extra});
 events.push({type:'featureSpinStart',featureSpin:true,zombies:FEATURE_SPIN.zombies,left:1,total:0});
 while(left>0&&total<CAP){
  // A corrupt/non-random source cannot hang or silently alter a round.
  if(++turn>256)throw Error('Feature round exceeded the supported replay length.');
  left--;
  let board=Array.from({length:WIDTH*HEIGHT},()=>{
   const person=rng()<.7,kind=pick(person?PEOPLE:CARDS,rng);
   const carrier=person?rng():1;
   return cell(kind,carrier<.02?{biteValue:5}:carrier<.08?{biteValue:3}:{});
  });
  const openings=anchors.map(index=>{
   const available=directions.filter(d=>step(index,d)>=0&&!anchors.includes(step(index,d)));
   return {direction:pick(available,rng),human:pick(PEOPLE,rng)};
  });
  const paths=featureDirections(anchors,openings.map(o=>o.direction),rng);
  for(let i=0;i<anchors.length;i++){
   const index=anchors[i],direction=paths[i];
   board[index]=cell('zombie',{id:ids[i],multi:carried[ids[i]],eaten:0,direction});
   // Guaranteed zombies get at least one reachable symbol, without forcing a
   // win or a heart. All later blocks obey the normal straight-line rule.
   board[step(index,direction)]=cell(openings[i].human);
  }
  if(rng()<.68){
   const available=board.flatMap((c,i)=>c.kind==='zombie'?[]:[i]);
   board[pick(available,rng)]=cell('heart');
  }
  events.push({type:'reveal',board:clone(board),bonus:false,featureSpin:true,left,turn,total,multi:0,eaten:0,carried:{...carried},anchors:[...anchors]});
  const result=walkZombies(board,rng,{hearts:true});board=result.board;
  for(const event of result.events){
   if(event.type==='walk')biteCount++;
   if(event.type==='walk'||event.type==='heart'){
    carried[event.headId]=event.multi;multi=event.multi;eaten=event.eaten;
   }
   if(event.type==='heart'){left++;hearts++;}
   if(event.type==='reelComplete')reelCount++;
   events.push({...event,bonus:false,featureSpin:true,turn,left,hearts,biteCount,reelCount});
  }
  const wins=lineWins(board);
  if(wins.length){
   const uncapped=wins.reduce((sum,w)=>sum+w.amount,0),win=Math.min(CAP-total,uncapped);total+=win;
   events.push({type:'lineWin',board:clone(board),wins,uncapped,win,total,bonus:false,featureSpin:true,turn});
  }
  events.push({type:'spinEnd',board:clone(board),total,multi,eaten,biteCount,reelCount,bonus:false,featureSpin:true,turn,left,hearts,carried:{...carried}});
  if(left&&total<CAP)events.push({type:'heartRespin',featureSpin:true,left,hearts,total,turn,carried:{...carried}});
 }
 events.push({type:'roundEnd',total,multi,eaten,biteCount,reelCount,bonus:false,featureSpin:true,hearts,turn,capped:total>=CAP});
 return {events,total,multi,eaten,biteCount,reelCount,bonus:false,featureSpin:true,hearts,spins:turn};
}
