import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRound,placeSuperZombies,walkSuper,seeded,CAP,PEOPLE,HUMAN_MULTIS} from '../runtime/math.js';
import {bonusTierForScatters,BONUS_BUYS} from '../runtime/config.js';
import {createSession} from '../runtime/session.js';
import {lineWins} from '../runtime/paylines.js';

const cards=()=>Array.from({length:30},(_,i)=>({id:`card:${i}`,kind:'j'}));
// A real base spin, with only the initial scatter count fixed. The bonus that
// follows uses ordinary random boards, landing opportunities and payouts.
function scatterRng(count,seed){
  let calls=0;const random=seeded(seed);
  return()=>{
    const i=calls++;
    if(i<60)return i%2?.37:.1;
    if(i===60)return .99;
    if(i<91)return i-61<count?0:.99;
    return random();
  };
}

test('3, 4 and 5+ natural scatters start their respective 8/10/10-spin tiers',()=>{
  assert.equal(bonusTierForScatters(2),null);
  for(const [count,tier] of [[3,'regular'],[4,'super'],[5,'hidden'],[6,'hidden']]){
    const round=makeRound({rng:scatterRng(count,13)});
    const entry=round.events.find(e=>e.type==='bonusStart');
    assert.equal(entry.tier,tier);assert.equal(entry.spins,tier==='regular'?8:10);assert.equal(entry.scatters,count);assert.equal(entry.bought,false);
    const spins=round.events.filter(e=>e.type==='reveal'&&e.bonus);
    assert.ok(spins.length===(tier==='regular'?8:10)||round.total===CAP);assert.ok(spins.every(e=>e.tier===tier));
  }
  assert.deepEqual(Object.keys(BONUS_BUYS),['buy_outbreak','buy_super','buy_mystery']);
  assert.ok(!Object.hasOwn(BONUS_BUYS,'buy_hidden'),'Hidden has no direct purchase');
});

test('Hidden adds fresh bites to the same reel and retains its value through a lower-row upgrade',()=>{
  const starts=[2,null,null,null,null,null],carry=[12,0,0,0,0,0];
  const board=cards();board[6].kind='cop';
  const placed=placeSuperZombies(board,starts,seeded(1),{landings:[24,13],multipliers:carry});
  assert.equal(placed.board[24].multi,12);assert.equal(placed.board[13].multi,0);
  assert.deepEqual(carry,[12,0,0,0,0,0]);assert.equal(placed.starts[0],4);
  const resolved=walkSuper(placed.board);
  assert.equal(resolved.board[0].multi,17);assert.equal(resolved.board[0].eaten,1);
  assert.equal(resolved.board[1].multi,0);
  const next=placeSuperZombies(cards(),placed.starts,seeded(1),{landings:[],multipliers:[17,0,0,0,0,0]});
  assert.equal(next.board[24].multi,17);assert.equal(next.board[24].eaten,0);
  assert.equal(walkSuper(next.board).board[0].multi,17,'cards neither reset nor add to the carried value');
  const superBoard=placeSuperZombies(cards(),placed.starts,seeded(1),{landings:[]}).board;
  assert.equal(superBoard[24].multi,0,'ordinary Super retains its reset behavior');
});

test('100 Hidden rounds conserve per-reel carry, unique line factors and capped payouts',()=>{
  let returns=0,upgrades=0;
  for(let seed=0;seed<100;seed++){
    const round=makeRound({rng:scatterRng(5,seed)});
    let carry=Array(6).fill(0),gains=Array(6).fill(0),sum=0,rows=Array(6).fill(null);
    for(const event of round.events){
      if(event.board)assert.equal(new Set(event.board.map(c=>c.id)).size,30);
      if(event.type==='reveal'&&event.bonus){
        assert.deepEqual(event.carriedMultipliers,carry);gains=Array(6).fill(0);
        assert.ok(event.board.every(c=>!c.stackId&&!c.spanCells&&c.kind!=='wild'));
        assert.ok(event.board.filter(c=>PEOPLE.includes(c.kind)).every(c=>c.infected&&c.biteValue===HUMAN_MULTIS[c.kind]));
        for(let reel=0;reel<6;reel++){
          const row=event.superStarts[reel];
          if(row===null)continue;
          assert.equal(event.board[row*6+reel].multi,carry[reel]);
          assert.equal(event.board[row*6+reel].eaten,0);
          if(rows[reel]!==null){returns++;assert.ok(row>=rows[reel]);upgrades+=row>rows[reel];}
        }
        rows=[...event.superStarts];
      }
      if(event.type==='walk'&&event.bonus){gains[event.target%6]+=event.gain;assert.equal(event.multi,event.before[event.source].multi+event.gain);}
      if(event.type==='spinEnd'&&event.bonus){
        carry=carry.map((value,reel)=>value+gains[reel]);
        assert.deepEqual(event.carriedMultipliers,carry);
        for(const head of event.board.filter(c=>c.kind==='zombie')){
          assert.equal(head.multi,carry[head.spanCells[0]%6]);
          assert.ok(head.spanCells.every(index=>event.board[index].stackMulti===head.multi));
        }
      }
      if(event.type==='lineWin'){
        assert.deepEqual(event.wins,lineWins(event.board));
        const win=event.wins.reduce((n,w)=>n+w.amount,0);
        assert.equal(event.win,Math.min(CAP-sum,win));sum+=event.win;assert.equal(event.total,sum);
      }
    }
    assert.equal(round.total,sum);assert.ok(sum<=CAP);
  }
  assert.ok(returns>100);assert.ok(upgrades>10);
});

test('Hidden preview carries visibly, leaves credits unchanged and never leaks into another round',()=>{
  // The scripted demonstration (math.js) carries a multiplier into spin 2.
  const demo=makeRound({kind:'preview_hidden',rng:seeded(2)}).events.filter(e=>e.type==='reveal');
  assert.ok(demo[0].board.filter(c=>c.kind==='zombie').every(c=>c.multi===0));
  assert.ok(demo[1].board.some(c=>c.kind==='zombie'&&c.multi>0));
  // The game's free preview is a real Hidden bonus from the catalogs (S-28),
  // and pays nothing into credits.
  const session=createSession(),balance=session.read().credits;
  const preview=session.begin('preview_hidden',seeded(2));
  assert.equal(preview.preview,true);
  assert.equal(preview.result.events.find(e=>e.type==='bonusStart').tier,'hidden');
  assert.ok(preview.result.total<=CAP);
  session.finish(preview);assert.equal(session.read().credits,balance);
  for(const kind of ['preview_hidden','preview_super','buy_super','base']){
    const next=makeRound({kind,rng:seeded(2)}).events.find(e=>e.type==='reveal');
    assert.ok(next.board.filter(c=>c.kind==='zombie').every(c=>c.multi===0));
  }
});
