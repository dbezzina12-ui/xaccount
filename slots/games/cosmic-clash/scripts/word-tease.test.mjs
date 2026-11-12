import test from 'node:test';
import assert from 'node:assert/strict';
import {wordWin,evaluate,applyWildReels,makeRound} from '../dist/math.js';
import {LINES,PAYTABLE,WORD_RULES,cashWin,RULES} from '../dist/config.js';
import {reelPlan,createScatterAnticipation} from '../dist/reel-motion.js';

const blank=()=>Array.from({length:5},()=>Array.from({length:5},()=>({name:'SCATTER'})));
function spell(board=blank(),line=LINES[2]){WORD_RULES.letters.forEach((name,reel)=>{board[reel][line[reel]]={name};});return board;}

test('literal DUEL pays 100x, or at most 500x beside a Duel wild',()=>{
 const board=spell();assert.equal(evaluate(board).payout,10000);
 for(const [source,expected] of [[1,10000],[2,20000],[5,50000],[25,50000],[256,50000],[1024,50000]]){
  const result=evaluate(applyWildReels(board,[{id:7,reel:4,multiplier:source}]));
  assert.equal(result.payout,expected);assert.equal(result.wins.length,1);
  assert.equal(result.wins[0].sourceMultiplier,source);assert.equal(result.wins[0].positions.length,5);
  assert.equal(cashWin(2e6,result.payout),expected*20000);
 }
 for(const symbol of [{name:'WILD'},{name:'WILD',temporary:true},{name:'WILD',multiplier:1024},{name:'VS'}]){
  const ordinary=spell();ordinary[4][2]=symbol;assert.equal(wordWin(ordinary).amount,10000);
 }
});

test('word requires exact letters, leftmost reels and an active payline; no wild substitution',()=>{
 for(const line of LINES){assert.equal(wordWin(spell(blank(),line)).amount,10000);}
 for(const names of [['L','E','U','D'],['D','U','L','E'],['D','U','WILD','L'],['D','U','E','SCATTER']]){
  const board=blank();names.forEach((name,reel)=>{board[reel][2]={name};});assert.equal(wordWin(board),null);
 }
 const shifted=blank();WORD_RULES.letters.forEach((name,i)=>{shifted[i+1][2]={name};});assert.equal(wordWin(shifted),null);
 const offLine=spell(blank(),[0,4,0,4,0]);assert.equal(wordWin(offLine),null);
});

test('multiple words award only the highest once, while ordinary wins retain full multipliers',()=>{
 const board=blank();spell(board,LINES[0]);spell(board,LINES[1]);
 board[4][0]={name:'WILD',duelId:1,multiplier:2};board[4][1]={name:'WILD',duelId:2,multiplier:25};
 assert.equal(evaluate(board).wins.filter(w=>w.word).length,1);assert.equal(wordWin(board).amount,50000);assert.equal(wordWin(board).line,1);
 for(let reel=0;reel<4;reel++)board[reel][4]={name:'HELMET'};
 board[4][4]={name:'WILD',duelId:3,multiplier:256};
 const result=evaluate(board),ordinary=result.wins.find(w=>!w.word&&w.line===4);
 assert.equal(ordinary.multiplier,256);assert.equal(ordinary.amount,125*256);
 assert.equal(result.payout,result.wins.reduce((sum,w)=>sum+w.amount,0));
 assert.equal(result.wins.filter(w=>w.word).length,1);assert.equal(RULES.maxWin,2500000);
});

test('a real Showdown book qualifies the fifth-reel badge through the word alone',()=>{
 const spin=makeRound(91,{tier:'regular'}).events.find(e=>e.type==='spin'&&e.turn===8);
 assert.equal(spin.wins.length,1);assert(spin.wins[0].word);assert.equal(spin.win,50000);
 assert.equal(spin.duels.length,1);assert.equal(spin.duels[0].reel,4);
 assert(spin.landings.some(s=>s.reel===4));assert.equal(spin.wins[0].sourceMultiplier,spin.duels[0].to);
 const plain=makeRound(34,{tier:'regular'}).events.find(e=>e.type==='spin'&&e.turn===10);
 assert.equal(plain.wins.find(w=>w.word).amount,10000);
});

test('tease begins only after two settled scatters, slows pending reels once, and follows each landing',()=>{
 const slows=[],changes=[],controller=createScatterAnticipation({slow:(...args)=>slows.push(args),change:state=>changes.push(state)});
 controller.landed(0,1);assert.deepEqual(slows,[]);assert.deepEqual(changes,[]);
 controller.landed(0,1);assert.deepEqual(slows,[]); // Duplicate stop callback cannot add a scatter.
 controller.landed(1,0);controller.landed(2,1);
 assert.deepEqual(slows,[[3,.18],[4,.18]]);assert.deepEqual(changes.at(-1),{active:true,pending:[3,4],next:3,scatters:2});
 controller.landed(3,1);assert.equal(slows.length,2);assert.deepEqual(changes.at(-1),{active:true,pending:[4],next:4,scatters:3});
 controller.landed(4,1);assert.equal(changes.at(-1).active,false);assert.deepEqual(changes.at(-1).pending,[]);
 controller.finish();const length=changes.length;controller.finish();controller.landed(4,1);assert.equal(changes.length,length);
});

test('two-scatter miss clears, turbo teases faster, and skip/reduced motion suppress new slowdowns',()=>{
 const slows=[],changes=[];let instant=false;
 const controller=createScatterAnticipation({turbo:true,instant:()=>instant,slow:(...args)=>slows.push(args),change:s=>changes.push(s)});
 controller.landed(0,1);controller.landed(1,1);assert.deepEqual(slows,[[2,.38],[3,.38],[4,.38]]);
 instant=true;controller.landed(2,0);controller.landed(3,0);controller.landed(4,0);controller.finish();
 assert.equal(slows.length,3);assert.deepEqual(changes.at(-1),{active:false,pending:[],next:null,scatters:2});
 const skipped=createScatterAnticipation({instant:()=>true,slow:()=>assert.fail('Skipped/reduced spin must not slow'),change:s=>assert.equal(s.active,false)});
 for(let reel=0;reel<5;reel++)skipped.landed(reel,1);skipped.finish();
});

test('reel strips use valid new symbols, keep the exact selected board, and never invent filler scatters',()=>{
 const previous=blank()[0],selected=spell()[0],before=structuredClone({previous,selected});
 for(const turbo of [false,true])for(let index=0;index<5;index++){
  const plan=reelPlan(previous,selected,index,{turbo,turn:18});
  assert.strictEqual(plan.panels[0],selected);assert.strictEqual(plan.panels.at(-1),previous);
  assert(plan.panels.slice(1,-1).flat().every(s=>Object.hasOwn(PAYTABLE,s.name)));
  assert.equal(plan.frames.at(-1).transform,'translate3d(0, 0%, 0)');
 }
 assert.deepEqual({previous,selected},before);
});
