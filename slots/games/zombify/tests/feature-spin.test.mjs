import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {walkZombies,makeRound,seeded,CAP,step} from '../runtime/math.js';
import {makeFeatureRound,featureDirections} from '../runtime/feature-spin.js';
import {makePaidRound,CATALOG_PREVIEWS} from '../runtime/outcome-model.js';
import {FEATURE_SPIN,BONUS_BUYS,roundCostMultiplier} from '../runtime/config.js';
import {createSession} from '../runtime/session.js';
import {lineWins} from '../runtime/paylines.js';
import {IMAGE_ASSETS} from '../runtime/preload-manifest.js';
import data from '../runtime/feature-outcomes.js';
import {createPlayback} from '../runtime/playback.js';
const blank=()=>Array.from({length:30},(_,i)=>({id:`card:${i}`,kind:'k'}));

test('a reached heart awards once in every direction and is not a multiplier bite',()=>{
 for(const [direction,source] of [['up',25],['down',1],['left',17],['right',12]]){
  const board=blank(),target=step(source,direction),human=step(target,direction);
  board[source]={id:'walker',kind:'zombie',direction,multi:7};board[target]={id:'heart',kind:'heart'};board[human]={id:'person',kind:'nurse'};
  const r=walkZombies(board,seeded(2),{hearts:true});
  assert.equal(r.hearts,1);assert.equal(r.bites,1);
  const event=r.events.find(e=>e.type==='heart');
  assert.equal(event.target,target);assert.equal(event.gain,0);assert.equal(event.multi,7);assert.equal(event.eaten,0);
  assert.equal(r.board[human].multi,8);assert.equal(r.board[human].eaten,1);assert.ok(!r.board.some(c=>c.kind==='heart'));
  assert.equal(board[target].kind,'heart','resolver must not mutate its input');
  assert.equal(walkZombies(board,seeded(2)).events.length,0,'ordinary modes cannot collect hearts');
 }
});

test('blocked, off-path, and already-collected hearts cannot grant a respin',()=>{
 const board=blank();board[12]={id:'one',kind:'zombie',direction:'right',multi:0};board[14]={id:'heart',kind:'heart'};
 assert.equal(walkZombies(board,seeded(2),{hearts:true}).hearts,0,'card blocks heart');
 board[14]={id:'card',kind:'k'};board[18]={id:'heart',kind:'heart'};
 assert.equal(walkZombies(board,seeded(2),{hearts:true}).hearts,0,'heart outside chosen direction');
 board[18]={id:'card2',kind:'k'};board[13]={id:'heart',kind:'heart'};board[14]={id:'two',kind:'zombie',direction:'left',multi:0};
 const r=walkZombies(board,seeded(2),{hearts:true});assert.equal(r.hearts,1);assert.equal(r.events.filter(e=>e.type==='heart').length,1);
});

test('all published feature outcomes replay: 2-4 starting zombies, one more per heart after the first, retained identities/multipliers, real line awards',()=>{
 const directions=new Set(),startTickets={},heartMix=[0,0,0];let previousWeight=0,weighted=0n,joined=0;
 for(const [seed,end,payout,hearts,spins] of data.pool.entries){
  assert.ok(Number.isSafeInteger(end)&&end>previousWeight);
  const weight=end-previousWeight;previousWeight=end;weighted+=BigInt(payout)*BigInt(weight);heartMix[Math.min(2,hearts)]+=weight;
  const r=makeFeatureRound({rng:seeded(seed)});
  assert.equal(r.total,payout);assert.equal(r.hearts,hearts);assert.equal(r.spins,spins);assert.ok(r.total<=CAP);
  if(r.total<CAP)assert.equal(spins,hearts+1);
  const start=r.events[0].zombies;startTickets[start]=(startTickets[start]||0)+weight;
  let carried=null,anchors=null,ids=null,sum=0,moved=new Set(),collected=0,joining=0;
  for(const event of r.events){
   if(event.type==='heartRespin'){assert.equal(event.joins,joining);joining=0;}
   if(event.type==='reveal'){
    moved=new Set();
    const zombies=event.board.filter(c=>c.kind==='zombie'),current=zombies.map(c=>c.id).sort();
    assert.equal(event.zombies,zombies.length);assert.equal(new Set(event.anchors.map(a=>a%6)).size,event.anchors.length,'one zombie per reel');
    // Earlier zombies keep their identity and anchor; joiners are added after them.
    if(ids){assert.ok(ids.every(id=>current.includes(id)));assert.deepEqual(event.anchors.slice(0,anchors.length),anchors);assert.equal(zombies.length,ids.length+event.anchors.length-anchors.length);}
    else assert.equal(zombies.length,start);
    if(ids&&zombies.length>ids.length)joined++;
    ids=current;anchors=event.anchors;assert.ok(zombies.length>=2&&zombies.length<=FEATURE_SPIN.maxZombies);
    for(const z of zombies){directions.add(z.direction);assert.equal(z.multi,carried?.[z.id]||0);}
    assert.ok(event.board.filter(c=>c.kind==='heart').length<=1);
    assert.equal(event.board.filter(c=>c.kind==='vial').length,0);
   }
   if(event.type==='walk'||event.type==='heart')moved.add(event.headId);
   // Every heart after the first brings another zombie, while a reel is free.
   if(event.type==='heart'&&++collected>1&&ids.length+joining<FEATURE_SPIN.maxZombies)joining++;
   if(event.type==='spinEnd'){
    assert.deepEqual([...moved].sort(),ids,`seed ${seed}, spin ${event.turn}: every zombie on the board must move`);
    carried=event.carried;
   }
   if(event.type==='lineWin'){
    assert.deepEqual(event.wins,lineWins(event.board));assert.equal(event.uncapped,event.wins.reduce((s,w)=>s+w.amount,0));
    assert.equal(event.win,Math.min(CAP-sum,event.uncapped));sum+=event.win;assert.equal(event.total,sum);
   }
  }
  assert.equal(sum,r.total);assert.equal(r.zombies,ids.length);
 }
 assert.deepEqual([...directions].sort(),['down','left','right','up']);
 assert.ok(joined>0,'some published rounds bring in a zombie');
 assert.equal(previousWeight,data.pool.total);
 assert.equal(weighted,BigInt(data.pool.total)*BigInt(FEATURE_SPIN.cost*96));
 // The starting zombies and the respins are held exactly: 2/3/4 at 75/20/5%; no heart 78%, one 20%, two or more 2%.
 assert.deepEqual(startTickets,Object.fromEntries(FEATURE_SPIN.startZombies.map(([z,share])=>[z,share*data.pool.total])));
 assert.deepEqual(heartMix.map(t=>t/data.pool.total),[.78,.2,.02]);
 const hash=createHash('sha256');for(const f of ['math.js','config.js','paylines.js','feature-spin.js'])hash.update(readFileSync(new URL('../runtime/'+f,import.meta.url)));
 assert.equal(data.sourceHash,hash.digest('hex'));
});

test('joint directions protect both first steps for every distinct-reel anchor and preferred direction pair',()=>{
 const directions=['up','down','left','right'];let checked=0;
 for(let a=0;a<30;a++)for(let b=0;b<30;b++){
  if(a%6===b%6)continue;
  for(const da of directions)for(const db of directions){
   const anchors=[a,b],pair=featureDirections(anchors,[da,db],()=>.5);
   const paths=anchors.map((source,i)=>{const result=[];for(let at=step(source,pair[i]);at>=0;at=step(at,pair[i]))result.push(at);return result;});
   for(let i=0;i<2;i++){
    assert.ok(paths[i].length);assert.ok(!anchors.includes(paths[i][0]));assert.ok(!paths[1-i].includes(paths[i][0]));
   }
   checked++;
  }
 }
 assert.equal(checked,12000);
});

test('joint directions protect every first step for three to six zombies on distinct reels',()=>{
 const directions=['up','down','left','right'],rng=seeded(7);let checked=0;
 for(let n=3;n<=6;n++)for(let k=0;k<400;k++){
  const reels=[0,1,2,3,4,5].sort(()=>rng()-.5).slice(0,n),anchors=reels.map(r=>r+6*Math.floor(rng()*5));
  const pick=anchors.map(()=>directions[Math.floor(rng()*4)]),chosen=featureDirections(anchors,pick,rng);
  assert.equal(chosen.length,n);
  const paths=anchors.map((source,i)=>{const result=[];for(let at=step(source,chosen[i]);at>=0;at=step(at,chosen[i]))result.push(at);return result;});
  for(let i=0;i<n;i++){
   assert.ok(paths[i].length,`${n} zombies: zombie ${i} has a first step`);assert.ok(!anchors.includes(paths[i][0]));
   for(let j=0;j<n;j++)if(j!==i)assert.ok(!paths[j].includes(paths[i][0]),`${n} zombies: ${anchors} ${chosen}`);
  }
  checked++;
 }
 assert.equal(checked,1600);
});

test('starting zombies follow the configured 2/3/4 odds and joins stop at one zombie per reel',()=>{
 assert.deepEqual(FEATURE_SPIN.startZombies.map(([z])=>z),[2,3,4]);
 assert.equal(FEATURE_SPIN.startZombies.reduce((a,[,p])=>a+p,0),1);
 const counts={2:0,3:0,4:0};let most=0;
 for(let seed=1;seed<=4000;seed++){const r=makeFeatureRound({rng:seeded(seed)});counts[r.events[0].zombies]++;most=Math.max(most,r.zombies);assert.ok(r.zombies<=FEATURE_SPIN.maxZombies);}
 for(const [z,p] of FEATURE_SPIN.startZombies)assert.ok(Math.abs(counts[z]/4000-p)<.025,`${z} zombies: ${counts[z]}`);
 assert.ok(most>4,'later hearts can bring more zombies than the start');
});

test('formerly stranded walkers receive a step before normal path blocking applies',()=>{
 for(const seed of [38,58,73,78,108]){
  const events=makeFeatureRound({rng:seeded(seed)}).events;
  const end=events.findIndex(e=>e.type==='spinEnd'),first=events.slice(0,end);
  const ids=first.find(e=>e.type==='reveal').board.filter(c=>c.kind==='zombie').map(c=>c.id).sort();
  assert.deepEqual([...new Set(first.filter(e=>e.type==='walk'||e.type==='heart').map(e=>e.headId))].sort(),ids);
 }
});

test('preview is reproducible and free; purchased respins charge once, settle once, and refund once',()=>{
 const demo=makeRound({kind:'preview_feature',rng:seeded(3013)});
 assert.equal(demo.hearts,2);assert.equal(demo.spins,3);assert.deepEqual(demo,makeFeatureRound({rng:seeded(3013)}));
 const s=createSession(),before=s.read(),preview=s.begin('preview_feature',seeded(3013));
 assert.equal(preview.cost,0);assert.equal(preview.preview,true);s.finish(preview);assert.equal(s.read().credits,before.credits);
 const index=data.pool.entries.findIndex(e=>e[3]>0),roll=((index?data.pool.entries[index-1][1]:0)+.5)/data.pool.total;
 const purchased=s.begin('buy_feature',()=>roll);assert.equal(purchased.cost,before.bet*10);assert.ok(purchased.result.spins>1);assert.equal(purchased.preview,false);
 assert.equal(s.read().credits,before.credits-purchased.cost);
 s.finish(purchased);assert.equal(s.read().credits,before.credits-purchased.cost+purchased.result.total*purchased.bet/100);
 assert.throws(()=>s.finish(purchased),/already finished/);
 const current=s.read().credits,next=s.begin('buy_feature',()=>roll);s.cancel(next);s.cancel(next);assert.equal(s.read().credits,current);
 assert.equal(roundCostMultiplier('buy_feature'),10);assert.equal(roundCostMultiplier('preview_feature'),0);
});

test('feature catalogue corruption fails before charging and heart art is in the readiness manifest',()=>{
 const s=createSession(),before=s.read(),old=data.pool.entries[0][2];
 try{data.pool.entries[0][2]++;assert.throws(()=>s.begin('buy_feature',()=>0),/Outcome validation/);assert.deepEqual(s.read(),before);}
 finally{data.pool.entries[0][2]=old;}
 assert.equal(makePaidRound({kind:'buy_feature',rng:()=>0}).total,old);
 assert.ok(IMAGE_ASSETS.includes('assets/second-life-v103/heart.png'));
});

test('bonus purchase dialog keeps bonus confirmations and rejects the persistent Second Life mode',()=>{
 const source=readFileSync(new URL('../runtime/app.js',import.meta.url),'utf8');
 const nodes=new Map(),classes=()=>{const set=new Set();return {toggle(k,v){v?set.add(k):set.delete(k);},contains:k=>set.has(k)};};
 const get=id=>{if(!nodes.has(id))nodes.set(id,{dataset:{},textContent:'',classList:classes(),children:[],replaceChildren(...children){this.children=children;},showModal(){this.open=true;},close(){this.open=false;}});return nodes.get(id);};
 const session=createSession(),ctx=vm.createContext({FEATURE_SPIN,BONUS_BUYS,session,busy:false,stake:null,allowed:{buy:true},auto:{active:false},pending:null,$:get,money:n=>(n/100).toFixed(2),toast(){throw Error('Unexpected toast');},syncControls(){},soundEffect(){},document:{createElement:()=>({})},scatterArt(node,count){node.replaceChildren(...Array.from({length:count},()=>({className:'symbol art-vial'})));}});
 const start=source.indexOf('function selectBuy('),end=source.indexOf('function showBetPicker(',start);
 const select=vm.runInContext(source.slice(start,end)+';selectBuy',ctx);
 select('buy_feature');assert.equal(ctx.pending,null);assert.equal(get('confirm').open,undefined);
 select('buy_outbreak');assert.equal(ctx.pending.cost,10000);assert.equal(get('confirm').dataset.mode,'regular');assert.equal(get('confirm-scatters').children.length,3);
 ctx.pending=null;select('buy_mystery');assert.equal(get('confirm').dataset.mode,'mystery');assert.ok(get('confirm-scatters').classList.contains('mystery-symbols'));
 ctx.pending=null;ctx.busy=true;select('buy_feature');assert.equal(ctx.pending,null,'cannot start purchase during playback');
});

test('actual play loop handles heart events and respins in normal, turbo, and skipped presentation',async()=>{
 const source=readFileSync(new URL('../runtime/app.js',import.meta.url),'utf8');
 const start=source.indexOf('async function play(kind='),end=source.indexOf('function openDialog(',start);
 for(const mode of ['normal','turbo','skip']){
  const session=createSession(),playback=createPlayback(),before=session.read().credits,seen=[],notices=[],nodes=new Map();
  if(mode==='turbo')playback.setSpeed('turbo');
  const get=id=>{if(!nodes.has(id))nodes.set(id,{dataset:{},style:{},textContent:'',classList:{remove(){},add(){}},replaceChildren(){}});return nodes.get(id);};
  const ctx=vm.createContext({session,playback,seeded,PREVIEW_MODES:['preview_feature'],CATALOG_PREVIEWS,BONUS_FEATURES:{},busy:false,currentMode:'base',currentBites:0,currentBoard:[],pending:null,runningAnimations:new Set(),roundHistory:[],console,
   $:get,gameReady:{read:()=>({status:'ready'})},audioDirector:{prepare:async()=>{},stopEffects(){}},effects:{warm:async()=>{},clear(){}},winCelebration:{skip:()=>false,read:()=>({active:false}),cancel(){}},bonusScreen:{cancel(){}},freeSpins:{hide:async()=>{}},auto:{stop(){}},syncControls(){},displayWin(){},horde(){},clearLines(){},soundEffect(){},celebrationFor:()=>null,pause:async()=>{},money:n=>(n/100).toFixed(2),toast:m=>{throw Error(m);},render(board){ctx.currentBoard=board;},
   spinReels:async board=>{ctx.currentBoard=board;seen.push('reveal');if(mode==='skip')playback.skipSpin();},walking:async e=>seen.push(e.type),claimReel:async()=>{},expandZombie:async()=>{},showLine(){},banner:(...a)=>notices.push(a),LABELS:{j:'Jack',q:'Queen',k:'King',a:'Ace',skater:'Skater',nurse:'Medic',builder:'Builder',cop:'Officer',scientist:'Scientist',wild:'Wild'}
  });
  const play=vm.runInContext(source.slice(start,end)+';play',ctx);
  assert.equal(await play('preview_feature'),true,mode);assert.equal(seen.filter(e=>e==='reveal').length,3);assert.equal(seen.filter(e=>e==='heart').length,2);
  assert.equal(notices.filter(n=>n[0]==='SECOND LIFE').length,2);assert.equal(session.read().credits,before);assert.equal(ctx.busy,false);assert.equal(get('game').dataset.featureSpin,undefined);assert.equal(playback.read().spin,null);
 }
});
