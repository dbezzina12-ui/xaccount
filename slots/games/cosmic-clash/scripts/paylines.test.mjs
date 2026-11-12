import test from 'node:test';
import assert from 'node:assert/strict';
import {LINES} from '../dist/config.js';
import {evaluate,applyWildReels} from '../dist/math.js';
import {linePoints,lineMap,winTraces,lineWinDetails,createWinTraceCycle} from '../dist/payline-view.js';

test('the expanded lines pay the reported screenshot along its three valid L paths',()=>{
 const columns=[['GUN','BLADE','L','HELMET','U'],['CHIP','L','GUN','L','D'],['GUN','GUN','L','HELMET','E'],Array(5).fill('WILD'),Array(5).fill('WILD')];
 const board=applyWildReels(columns.map(c=>c.map(name=>({name}))),[{id:1,reel:3,multiplier:10},{id:2,reel:4,multiplier:25}]);
 const result=evaluate(board);assert.equal(result.payout,2625);assert.deepEqual(result.wins.map(w=>w.line+1),[22,23,50]);assert(result.wins.every(w=>w.symbol==='L'&&w.count===5&&w.multiplier===35&&w.amount===875));
 const details=lineWinDetails(result.wins[0],board);assert.equal(details.basePayout,25);assert.equal(details.payout,875);assert.equal(details.multiplier,35);assert.equal(details.factor,'(10 + 25)');assert.equal(details.title,'LINE 22 · 5 L');
 assert.equal(board[0][2].name,'L');assert.equal(board[1][1].name,'L');assert.equal(board[2][2].name,'L');
 assert(LINES.some(rows=>rows[0]===2&&rows[1]===1&&rows[2]===2));
});
test('all guide diagrams use the same rows as the payout evaluator',()=>{
 assert.equal(LINES.length,50);assert.equal(new Set(LINES.map(rows=>rows.join(','))).size,50);
 assert.equal(linePoints([0,1,2,3,4]),'10,10 30,30 50,50 70,70 90,90');
 LINES.forEach((rows,index)=>{
  const diagram=lineMap(index),points=diagram.match(/<polyline points="([^"]+)"/)[1].split(' ').map(point=>point.split(',').map(Number));
  assert.deepEqual(points.map(([x,y],reel)=>{assert.equal(x,10+reel*20);return(y-10)/20;}),rows);
 });
 assert.throws(()=>lineMap(50),/Unknown payline/);
});
test('winning traces stop at the paid match and include a word booster only when awarded',()=>{
 const wins=[{line:9,positions:[{reel:0,row:2},{reel:1,row:1},{reel:2,row:0}]},{line:2,word:true,positions:[0,1,2,3,4].map(reel=>({reel,row:2}))}];
 assert.deepEqual(winTraces(wins),[{line:10,word:false,points:'10,50 30,30 50,10'},{line:3,word:true,points:'10,50 30,50 50,50 70,50 90,50'}]);
});
test('traces cycle individually and cancel on the next board; reduced motion draws one static path',()=>{
 const draws=[],callbacks=[],cancelled=[],wins=[0,1].map(line=>({line,positions:[{reel:0,row:line},{reel:1,row:line},{reel:2,row:line}]}));
 const cycle=createWinTraceCycle({draw:t=>draws.push(t),schedule:(fn,ms)=>{assert.equal(ms,1200);callbacks.push(fn);return callbacks.length;},cancel:id=>cancelled.push(id)});
 cycle.start(wins);assert.equal(draws.at(-1).line,1);callbacks[0]();assert.equal(draws.at(-1).line,2);
 cycle.clear();assert.equal(draws.at(-1),null);assert.deepEqual(cancelled,[2]);
 const n=draws.length;callbacks[1]();assert.equal(draws.length,n);
 createWinTraceCycle({draw:t=>draws.push(t),instant:()=>true,schedule:()=>assert.fail('Reduced motion must stay static')}).start(wins);
 assert.equal(draws.at(-1).line,1);
});
test('line explanations use only participating wilds and honour the separate word cap',()=>{
 const board=Array.from({length:5},()=>Array.from({length:5},()=>({name:'L'})));
 board[1][0]={name:'WILD',multiplier:5};board[4][0]={name:'WILD',multiplier:1024};
 const short={line:0,symbol:'L',count:3,multiplier:5,amount:20,positions:[0,1,2].map(reel=>({reel,row:0}))};
 assert.deepEqual(lineWinDetails(short,board).multipliers,[5]);assert.equal(lineWinDetails(short,board).basePayout,4);
 const word={line:0,word:true,symbol:'DUEL',count:4,multiplier:5,sourceMultiplier:1024,amount:50000,positions:[0,1,2,3,4].map(reel=>({reel,row:0}))};
 const details=lineWinDetails(word,board);assert.equal(details.basePayout,10000);assert.equal(details.payout,50000);assert.equal(details.factor,'5');assert(details.wordCapped);
});
test('a traced line and its payout explanation advance together',()=>{
 const callbacks=[],wins=[0,1].map(line=>({line,amount:100+line,positions:[{reel:0,row:line}]})),seen=[];
 createWinTraceCycle({draw:(trace,win)=>{if(trace)seen.push([trace.line,win.amount]);},schedule:fn=>{callbacks.push(fn);return callbacks.length;}}).start(wins);
 callbacks[0]();assert.deepEqual(seen,[[1,100],[2,101]]);
});
