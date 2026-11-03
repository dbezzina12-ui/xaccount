import assert from 'node:assert/strict';
import {test} from 'node:test';
import {drawPressureTransfer} from '../runtime/pressure-transfer.js';

test('pressure transfers reveal the whole viewport once, including skip, rotation and low frame rate',async t=>{
  const previousStyle=globalThis.getComputedStyle, previousRaf=globalThis.requestAnimationFrame;
  const previousDocument=globalThis.document, previousDpr=globalThis.devicePixelRatio;
  const queue=[],listeners=new Set(),styles=new Map();
  globalThis.getComputedStyle=()=>({getPropertyValue:()=>'#ffc169'});
  globalThis.requestAnimationFrame=fn=>queue.push(fn);
  globalThis.devicePixelRatio=1;
  globalThis.document={hidden:false,addEventListener:(_,fn)=>listeners.add(fn),removeEventListener:(_,fn)=>listeners.delete(fn)};
  t.after(()=>{for(const [name,value] of Object.entries({getComputedStyle:previousStyle,requestAnimationFrame:previousRaf,document:previousDocument,devicePixelRatio:previousDpr})){
    if(value===undefined)delete globalThis[name];else globalThis[name]=value;
  }});
  const box=()=>({left:0,top:0,width:30,height:40});
  const canvas={clientWidth:390,clientHeight:844,getBoundingClientRect:box,getContext:()=>null};
  const cell={getBoundingClientRect:box};
  const dialog={dataset:{tier:'super'},style:{setProperty:(k,v)=>styles.set(k,v)},querySelector:q=>q==='.pressure-transfer'?canvas:cell};
  for(const [duration,stopAt] of [[0,0],[1400,0],[1400,1],[1400,Infinity]]){
    let draws=0,hits=0;const beats=[];
    const done=drawPressureTransfer(dialog,[cell,cell,cell],{duration,skip:()=>draws>=stopAt,onPilot:()=>beats.push('drop'),onHose:()=>beats.push('hose'),onImpact:()=>{hits++;beats.push('reveal');}});
    while(queue.length){
      const frame=queue.shift();if(draws===1){canvas.clientWidth=844;canvas.clientHeight=390;}
      frame(draws*500);draws++;assert.ok(draws<8,'slow frames must not stretch the scene');
    }
    await done;assert.deepEqual(beats,stopAt===Infinity?['drop','hose','reveal']:['reveal']);assert.equal(hits,1);assert.equal(styles.get('--radius'),'160vmax');assert.equal(listeners.size,0);
  }
});

test('fan starts still, accelerates, carries real faces outwards and restores them',async t=>{
  const {shaftAngle,windFront,carryReelFaces}=await import('../runtime/fan-gust.js');
  assert.equal(shaftAngle(.24,2.48,'super'),0);
  assert.ok(shaftAngle(.70,2.48,'super')-shaftAngle(.65,2.48,'super') > shaftAngle(.54,2.48,'super')-shaftAngle(.49,2.48,'super'));
  assert.equal(windFront(.35,820,120),0);assert.ok(windFront(.94,820,120)>820);
  const tiles=[],hidden=new Set(),original=globalThis.document;
  globalThis.document={createElement:()=>({style:{},append(){},remove(){this.removed=true;}})};
  t.after(()=>{if(original===undefined)delete globalThis.document;else globalThis.document=original;});
  const source={getBoundingClientRect:()=>({left:80,top:60,width:50,height:50}),cloneNode:()=>({removeAttribute(){}}),
    classList:{add:t=>hidden.add(t),remove:t=>hidden.delete(t)}};
  const moving=carryReelFaces({append:tile=>tiles.push(tile)},[source]);moving.fit(0,0,610,100,800,420);
  moving.update(200,820);assert.ok(tiles[0].hidden);assert.equal(hidden.size,0);
  moving.update(700,820);assert.ok(hidden.has('gust-lifted'));assert.match(tiles[0].style.transform,/translate3d\(-/);
  moving.clear();assert.ok(tiles[0].removed);assert.equal(hidden.size,0);
});
