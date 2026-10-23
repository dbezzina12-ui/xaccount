import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRound,seeded,walkZombies,humanBiteValue,expandedZombies,step,PEOPLE,CARDS,SYMBOLS,CAP} from '../runtime/math.js';
import {lineWins,PAYLINES,PAYTABLE} from '../runtime/paylines.js';
import {createSession,BETS} from '../runtime/session.js';
import {createPlayback} from '../runtime/playback.js';
import {createAutoSpins} from '../runtime/auto-spins.js';
import {BONUS_BUYS} from '../runtime/config.js';
const filled=kind=>Array.from({length:30},(_,i)=>({id:String(i),kind}));
const firstLine=board=>lineWins(board).find(win=>win.line===1);

test('four ranks, five people and 25 distinct valid six-reel paylines',()=>{
 assert.deepEqual(CARDS,['j','q','k','a']);assert.equal(PEOPLE.length,5);assert.equal(SYMBOLS.length,9);
 assert.equal(PAYLINES.length,25);assert.equal(new Set(PAYLINES.map(line=>line.join(','))).size,25);
 assert.ok(PAYLINES.every(line=>line.length===6&&line.every(row=>row>=0&&row<5)));
});
test('three matches pay only from the left edge with no gap, never right to left',()=>{
 const board=filled('vial');[0,1,2].forEach(i=>board[i].kind='j');
 assert.equal(firstLine(board).count,3);assert.equal(firstLine(board).amount,PAYTABLE.j[0]);
 board[0].kind='vial';board[3].kind='j';assert.equal(firstLine(board),undefined);
 board[4].kind='j';board[5].kind='j';assert.equal(firstLine(board),undefined);
 board[0].kind='j';board[1].kind='vial';assert.equal(firstLine(board),undefined);
});
test('longest qualifying prefix and highest result pay once per line',()=>{
 const board=filled('vial');[0,1,2,3].forEach(i=>board[i].kind='nurse');
 assert.equal(firstLine(board).count,4);assert.equal(firstLine(board).base,PAYTABLE.nurse[1]);
 board[4].kind='k';board[5].kind='nurse';assert.equal(firstLine(board).count,4);
 [0,1,2].forEach(i=>board[i].kind='wild');
 const wins=lineWins(board);assert.equal(new Set(wins.map(win=>win.line)).size,wins.length);
 assert.equal(firstLine(board).amount,Math.max(PAYTABLE.wild[0],PAYTABLE.nurse[1]));
});
test('all cardinal directions leave trails without turns or diagonal movement',()=>{
 assert.equal(step(5,'right'),-1);assert.equal(step(6,'left'),-1);assert.equal(step(0,'up'),-1);assert.equal(step(29,'down'),-1);assert.equal(step(12,'diagonal'),-1);
 for(const [start,direction,targets] of [[25,'up',[19,13]],[1,'down',[7,13]],[12,'right',[13,14]],[17,'left',[16,15]]]){
  const board=filled('j');board[start]={id:'z',kind:'zombie',multi:0,direction};targets.forEach(i=>board[i].kind='skater');
  const result=walkZombies(board,seeded(1));assert.deepEqual(result.events.filter(e=>e.type==='walk').map(e=>e.target),targets);
  assert.equal(result.board[targets[1]].multi,2);assert.equal(result.board[start].kind,'wild');assert.equal(result.board.filter(c=>c.kind==='zombie').length,1);
 }
 const board=filled('a');board[25]={id:'z',kind:'zombie',multi:0,direction:'up'};board[19].kind='nurse';board[18].kind='scientist';
 assert.equal(walkZombies(board).bites,1);assert.equal(walkZombies(board).board[18].kind,'scientist');
});
test('vertical art includes the starting position plus each physical step',()=>{
 for(const [kind,expected,multi] of [['single',[19,25],1],['showcase',[13,19,25],2],['triple',[7,13,19,25],3],['down',[4,10,16,22],3]]){
  const round=makeRound({kind,rng:seeded(2)}),event=round.events.find(e=>e.type==='expand');
  assert.deepEqual(event.cells,expected);assert.equal(event.multi,multi);
  assert.equal(expandedZombies(event.board)[0].cells.length,multi+1);
  assert.equal(event.eaten,multi);
  for(const index of expected){assert.equal(event.board[index].stackMulti,multi);assert.equal(event.board[index].stackId,event.headId);}
  const start=kind==='down'?4:25;assert.equal(event.board[start].kind,'wild');assert.equal(event.board[start].stackMulti,multi);
 }
});
test('two carriers add 3x and 5x in two steps, producing one three-tall 8x zombie',()=>{
 const round=makeRound({kind:'carriers',rng:seeded(2)}),walks=round.events.filter(e=>e.type==='walk'),expanded=round.events.find(e=>e.type==='expand');
 assert.deepEqual(walks.map(e=>e.gain),[3,5]);assert.deepEqual(walks.map(e=>e.multi),[3,8]);assert.deepEqual(walks.map(e=>e.eaten),[1,2]);
 assert.deepEqual(expanded.cells,[13,19,25]);assert.equal(expanded.multi,8);assert.equal(expanded.eaten,2);
 assert.equal(round.biteCount,2);assert.equal(round.eaten,2);assert.equal(round.multi,8);
 assert.equal(round.events.at(-1).eaten,2);
 const line=round.events.find(e=>e.type==='lineWin').wins.find(e=>e.line===3);
 assert.equal(line.multi,8);assert.equal(line.amount,line.base*8);
});
test('one boosted bite is still one step, and horizontal carriers leave ordinary trails',()=>{
 for(const [start,direction,target] of [[25,'up',19],[1,'down',7]]){
  const board=filled('j');board[start]={id:'z',kind:'zombie',multi:0,direction};board[target]={id:'carrier',kind:'nurse',biteValue:5};
  const result=walkZombies(board),event=result.events.find(e=>e.type==='expand');
  assert.equal(result.bites,1);assert.equal(event.multi,5);assert.equal(event.eaten,1);assert.equal(event.cells.length,2);
  assert.ok(event.cells.includes(start)&&event.cells.includes(target));
 }
 const board=filled('j');board[12]={id:'z',kind:'zombie',multi:0,direction:'right'};board[13]={id:'carrier3',kind:'skater',biteValue:3};board[14]={id:'carrier5',kind:'cop',biteValue:5};
 const result=walkZombies(board);assert.equal(result.board[14].multi,8);assert.equal(result.bites,2);assert.deepEqual(result.events.find(e=>e.type==='expand').cells,[12,13,14]);
 for(const index of [12,13]){assert.equal(result.board[index].kind,'wild');assert.equal(result.board[index].stackMulti,undefined);assert.equal(result.board[index].multi,undefined);}
});
test('carrier states do not change human line pays or turn non-humans into food',()=>{
 const board=filled('vial');[0,1,2,3].forEach(i=>board[i].kind='nurse');const expected=lineWins(board);
 board[1].biteValue=3;board[2].biteValue=5;assert.deepEqual(lineWins(board),expected);
 assert.equal(humanBiteValue(board[0]),1);assert.equal(humanBiteValue(board[1]),3);assert.equal(humanBiteValue(board[2]),5);
 assert.equal(humanBiteValue({kind:'j',biteValue:5}),0);assert.equal(humanBiteValue({kind:'nurse',biteValue:99}),1);
});
test('full reel is one five-position artwork with one combined 4x owner',()=>{
 const round=makeRound({kind:'reel',rng:seeded(2)}),event=round.events.find(e=>e.type==='expand');
 assert.ok(event.fullReel);assert.equal(event.cells.length,5);assert.equal(event.multi,4);
 assert.equal(event.board.filter(c=>c.kind==='zombie').length,1);
 const win=round.events.find(e=>e.type==='lineWin').wins.find(win=>win.line===3);
 assert.equal(win.count,6);assert.equal(win.multi,4,'line through the middle of the artwork receives 4x, not 4 to the fifth power');
});
test('horizontal zombies span their awarded row without changing trail multipliers',()=>{
 const round=makeRound({kind:'horizontal',rng:seeded(2)});
 const expanded=round.events.find(e=>e.type==='expand');assert.deepEqual(expanded.cells,[12,13,14]);assert.equal(expandedZombies(expanded.board)[0].horizontal,true);assert.deepEqual(lineWins(expanded.before),lineWins(expanded.board));
 const board=round.events.filter(e=>e.type==='walk').at(-1).board;
 assert.equal(board[12].kind,'wild');assert.equal(board[13].kind,'wild');assert.equal(board[14].multi,2);
 assert.ok(board.every(cell=>!cell.stackId));
});
test('line multipliers are local and distinct zombie factors add once',()=>{
 const board=filled('vial');[0,1,2].forEach(i=>board[i].kind='skater');[6,7,8].forEach(i=>board[i].kind='j');
 board[1]={id:'z',kind:'zombie',multi:2};
 assert.equal(firstLine(board).multi,2);assert.equal(lineWins(board).find(win=>win.line===2).multi,1);
 board[2]={id:'other',kind:'zombie',multi:3};assert.equal(firstLine(board).multi,5);
 board[1]={id:'w1',kind:'wild',stackId:'same',stackMulti:3};board[2]={id:'w2',kind:'wild',stackId:'same',stackMulti:3};assert.equal(firstLine(board).multi,3);
});
test('multiple heads consolidate once on a filled vertical reel',()=>{
 const board=filled('j');board[0]={id:'one',kind:'zombie',multi:0,direction:'down'};board[18]={id:'two',kind:'zombie',multi:0,direction:'down'};
 [6,12,24].forEach(i=>board[i].kind='nurse');const result=walkZombies(board),event=result.events.filter(e=>e.type==='expand').at(-1);
 assert.equal(event.multi,3);assert.equal(event.cells.length,5);assert.equal(result.board.filter(c=>c.kind==='zombie').length,1);
});
test('full-reel consolidation adds carrier gains while preserving eaten count',()=>{
 const board=filled('j');board[0]={id:'one',kind:'zombie',multi:0,direction:'down'};board[18]={id:'two',kind:'zombie',multi:0,direction:'down'};
 [6,12,24].forEach((i,n)=>board[i]={id:`human${i}`,kind:'nurse',biteValue:[3,5,1][n]});
 const result=walkZombies(board),event=result.events.filter(e=>e.type==='expand').at(-1);
 assert.equal(event.multi,9);assert.equal(event.eaten,3);assert.equal(event.cells.length,5);assert.equal(result.board.filter(c=>c.kind==='zombie').length,1);
 assert.ok(event.cells.every(i=>result.board[i].stackMulti===9));
});
test('each walker expands before the next starts and its settled cells stay in every later snapshot',()=>{
 const board=filled('j');
 board[0]={id:'first',kind:'zombie',direction:'right',multi:0};board[1].kind='nurse';board[2].kind='skater';
 board[11]={id:'second',kind:'zombie',direction:'down',multi:0};board[17].kind='cop';board[23].kind='builder';
 const result=walkZombies(board);
 assert.deepEqual(result.events.map(e=>[e.type,e.headId]),[
  ['walk','first'],['walk','first'],['expand','first'],['walk','second'],['walk','second'],['expand','second']
 ]);
 for(const event of result.events.slice(3))assert.deepEqual(expandedZombies(event.before).find(z=>z.id==='first').cells,[0,1,2]);
 for(let i=1;i<result.events.length;i++)assert.deepEqual(result.events[i].before,result.events[i-1].board);
});
test('a later full-reel merge replaces the already settled owner without leaving old stack multipliers',()=>{
 const board=filled('j');board[0]={id:'first',kind:'zombie',direction:'down',multi:0};board[18]={id:'second',kind:'zombie',direction:'down',multi:0};
 [6,12,24].forEach(i=>board[i].kind='nurse');
 const result=walkZombies(board),first=result.events.findIndex(e=>e.type==='expand'),next=result.events.findIndex(e=>e.type==='walk'&&e.headId==='second');
 assert.ok(first<next);assert.deepEqual(result.events[first].cells,[0,6,12]);
 assert.equal(result.events[first].multi,2);assert.equal(result.reels,1);
 assert.deepEqual(expandedZombies(result.board).map(s=>[s.id,s.cells,s.multi]),[['second',[0,6,12,18,24],3]]);
 assert.ok(result.board.every(c=>c.stackId!=='first'));
});
test('eight regular bonus spins reset zombie multipliers and resolve at most one line payout per spin',()=>{
 const round=makeRound({kind:'outbreak',rng:seeded(3)}),reveals=round.events.filter(e=>e.type==='reveal');
 assert.equal(reveals.length,9);assert.equal(reveals.filter(e=>e.bonus).length,8);
 for(const event of reveals){assert.equal(event.multi,0);assert.ok(event.board.filter(c=>c.kind==='zombie').every(c=>c.multi===0));assert.ok(event.board.every(c=>!c.stackId));}
 const payouts=round.events.filter(e=>e.type==='lineWin');assert.equal(new Set(payouts.map(e=>e.turn)).size,payouts.length);
 assert.ok(!round.events.some(e=>['drop','clusterWin'].includes(e.type)));
});
test('1000 rounds conserve payouts and IDs, with rare base zombies and ordinary losing spins',()=>{
 let appearances=0,losses=0,caps=0;
 for(let seed=0;seed<1000;seed++){
  const round=makeRound({rng:seeded(seed)});let sum=0,bites=0;
  appearances+=round.events[0].board.some(c=>c.kind==='zombie');losses+=round.total===0;caps+=round.total===CAP;
  for(const event of round.events){
   if(event.board){assert.equal(event.board.length,30);assert.equal(new Set(event.board.map(c=>c.id)).size,30);assert.ok(event.board.every(c=>[...SYMBOLS,'vial','zombie','wild'].includes(c.kind)));}
   if(event.type==='walk'){bites++;assert.ok(PEOPLE.includes(event.before[event.target].kind));assert.equal(event.target,step(event.source,event.direction));assert.equal(event.board[event.target].id,event.headId);assert.equal(event.gain,humanBiteValue(event.before[event.target]));assert.equal(event.multi,(event.before[event.source].multi||0)+event.gain);}
   if(event.type==='expand'){assert.ok(['up','down','left','right'].includes(event.direction));assert.ok(event.cells.every(i=>['up','down'].includes(event.direction)?i%6===event.target%6:Math.floor(i/6)===Math.floor(event.target/6)));}
   if(event.type==='lineWin'){assert.equal(event.win,Math.min(CAP-sum,event.wins.reduce((sum,win)=>sum+win.base*win.multi,0)));sum+=event.win;assert.equal(event.total,sum);}
  }
  assert.equal(sum,round.total);assert.equal(bites,round.biteCount);
 }
 assert.ok(appearances>=50&&appearances<=110);assert.ok(losses>500);assert.equal(caps,0);
});
test('credit accounting settles once, refunds safely and keeps every preview free',()=>{
 const session=createSession(),before=session.read(),round=session.begin('base',seeded(9));assert.equal(session.read().credits,before.credits-before.bet);
 assert.throws(()=>session.begin(),/already playing/);assert.equal(session.changeBet(1),false);assert.throws(()=>session.reset(),/Finish/);
 session.finish(round);assert.equal(session.read().credits,before.credits-before.bet+Math.round(round.result.total*before.bet/100));assert.throws(()=>session.finish(round),/already finished/);
 for(const kind of ['single','showcase','triple','down','carriers','horizontal','reel','outbreak']){const credits=session.read().credits,r=session.begin(kind,seeded(3));session.finish(r);assert.equal(session.read().credits,credits);}
 const credits=session.read().credits,r=session.begin('base',seeded(1));session.cancel(r);session.cancel(r);assert.equal(session.read().credits,credits);
 for(let i=0;i<50;i++)session.changeBet(-1);assert.equal(session.read().bet,BETS[0]);for(let i=0;i<50;i++)session.changeBet(1);assert.equal(session.read().bet,BETS.at(-1));
});

test('Skip ends with this spin and never changes the chosen speed or remaining bonus spins',()=>{
 const playback=createPlayback();assert.equal(playback.skipSpin(),false);
 playback.setSpeed('quick');playback.beginSpin(1);assert.equal(playback.duration(1000),450);
 assert.equal(playback.skipSpin(),true);assert.equal(playback.duration(1000),0);
 playback.endSpin();assert.equal(playback.skipSpin(),false);assert.equal(playback.duration(1000),450);
 playback.beginSpin(2);assert.equal(playback.read().skipping,false);assert.equal(playback.duration(1000),450);
 playback.setSpeed('normal');
 const round=makeRound({kind:'outbreak',rng:seeded(3)});let reveals=0,ends=0;
 for(const event of round.events){
  if(event.type==='reveal'){
   playback.beginSpin(event.turn);reveals++;assert.equal(playback.duration(1000),1000);
   if(event.bonus&&event.left===7){playback.skipSpin();assert.equal(playback.duration(1000),0);}
  }
  if(event.type==='spinEnd'){ends++;playback.endSpin();assert.equal(playback.read().spin,null);}
 }
 assert.equal(reveals,9);assert.equal(ends,9);assert.equal(playback.read().speed,'normal');
});
test('bonus buys charge the full price once, refund that price on failure, and settle in base-bet units',()=>{
 for(const kind of Object.keys(BONUS_BUYS)){
  const session=createSession(),before=session.read(),round=session.begin(kind,seeded(21));
  assert.equal(round.preview,false);assert.equal(round.cost,before.bet*BONUS_BUYS[kind].cost);
  assert.equal(session.read().credits,before.credits-round.cost);
  assert.throws(()=>session.begin(kind),/already playing/);assert.equal(session.changeBet(1),false);
  const after=session.finish(round);assert.equal(after.credits,before.credits-round.cost+Math.round(round.result.total*before.bet/100));
  assert.throws(()=>session.finish(round),/already finished/);
  const retry=session.begin(kind,seeded(2)),credits=after.credits;session.cancel(retry);session.cancel(retry);assert.equal(session.read().credits,credits);
 }
 const session=createSession();for(let i=0;i<10;i++)session.changeBet(1);const before=session.read();
 assert.throws(()=>session.begin('buy_super'),/Not enough/);assert.deepEqual(session.read(),before);
 assert.throws(()=>session.begin('unknown'),/Unknown/);assert.deepEqual(session.read(),before);
 const preview=session.begin('preview_super',seeded(2));assert.equal(preview.preview,true);session.finish(preview);assert.equal(session.read().credits,before.credits);
});
test('bought bonuses use independent random boards and keep one settlement per awarded spin',()=>{
 for(const kind of ['buy_outbreak','buy_super']){
  const a=makeRound({kind,rng:seeded(22)}),b=makeRound({kind,rng:seeded(23)}),reveals=a.events.filter(e=>e.type==='reveal');
  const awarded=kind==='buy_outbreak'?8:10;assert.equal(a.events[0].spins,awarded);assert.ok(reveals.length<=awarded);assert.ok(reveals.length===awarded||a.total===CAP);assert.ok(reveals.every(e=>e.bonus));
  assert.equal(a.events[0].type,'bonusStart');assert.equal(a.events[0].bought,true);
  assert.notDeepEqual(reveals[0].board.map(c=>c.kind),b.events.find(e=>e.type==='reveal').board.map(c=>c.kind));
  assert.equal(a.events.filter(e=>e.type==='spinEnd').length,reveals.length);
  if(kind==='buy_super')for(const event of reveals){
   assert.ok(event.board.filter(c=>PEOPLE.includes(c.kind)).every(c=>c.infected&&[2,3,4,5,10].includes(c.biteValue)));
   assert.ok(event.board.filter(c=>c.kind==='zombie').every(c=>c.multi===0&&c.direction==='up'));
  }
 }
});
test('autoplay stopping during a round waits for settlement and never buys another round',async()=>{
 let release,settled=0,started=0;
 const auto=createAutoSpins({play:async()=>{started++;await new Promise(resolve=>release=resolve);settled++;return true;},wait:async()=>{}});
 const running=auto.start(10);assert.equal(started,1);assert.equal(auto.active,true);
 auto.stop();assert.equal(await auto.start(10),false,'cannot restart while a paid round is unfinished');
 release();await running;assert.equal(settled,1);assert.equal(started,1);assert.equal(auto.running,false);
 let spins=0;const completed=createAutoSpins({play:async()=>{spins++;return true;},wait:async()=>{}});await completed.start(10);assert.equal(spins,10);assert.equal(completed.remaining,0);
 let bonusRounds=0;const bonus=createAutoSpins({play:async()=>{bonusRounds++;bonus.stop('bonus');return true;},wait:async()=>{}});await bonus.start(25);assert.equal(bonusRounds,1);
});

test('horizontal spans cover exactly 2–6 owned cells in both directions',()=>{
 for(const direction of ['left','right'])for(let n=2;n<=6;n++){
  const board=filled('k'),start=direction==='right'?12:17,sign=direction==='right'?1:-1;
  board[start]={id:'side',kind:'zombie',multi:0,direction};
  for(let j=1;j<n;j++)board[start+sign*j]={id:`food${j}`,kind:'nurse'};
  const result=walkZombies(board),event=result.events.find(e=>e.type==='expand');
  assert.equal(event.cells.length,n);assert.equal(expandedZombies(result.board)[0].direction,direction);
  assert.deepEqual(lineWins(event.before),lineWins(event.board));
  assert.equal(result.board.filter(c=>c.kind==='zombie').length,1);
 }
});
