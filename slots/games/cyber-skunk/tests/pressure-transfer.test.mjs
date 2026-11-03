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
    let draws=0,hits=0;
    const done=drawPressureTransfer(dialog,[cell,cell,cell],{duration,skip:()=>draws>=stopAt,onImpact:()=>hits++});
    while(queue.length){
      const frame=queue.shift();if(draws===1){canvas.clientWidth=844;canvas.clientHeight=390;}
      frame(draws*500);draws++;assert.ok(draws<8,'slow frames must not stretch the scene');
    }
    await done;assert.equal(hits,1);assert.equal(styles.get('--radius'),'160vmax');assert.equal(listeners.size,0);
  }
});
