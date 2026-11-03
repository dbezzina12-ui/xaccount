import {serve,chromium} from '../../../../tools/lib/browser.mjs';
import {writeFileSync} from 'node:fs';
const s=await serve(),b=await chromium(),rows=[];
try {const p=await b.newPage({viewport:{width:1366,height:768},hasTouch:true});
await p.goto(s.url+'games/cyber-skunk/runtime/index.html?studioLayout=viewport');await p.locator('#intro-go').click();
await p.evaluate(()=>window.originalPlay=document.querySelector('#controller').shadowRoot.querySelector('[data-action=play]'));
const measure=()=>p.evaluate(()=>{const h=document.querySelector('#controller'),r=h.getBoundingClientRect();return{stage:document.querySelector('#app').dataset.layout,controller:h.dataset.layout,parent:h.parentElement.id,width:r.width,bottom:r.bottom,samePlay:originalPlay===h.shadowRoot.querySelector('[data-action=play]'),balance:cyberSkunk.state.balance}});
for(let cycle=0;cycle<8;cycle++)for(const [width,height,layout] of [[1366,768,'desktop'],[390,844,'mobile'],[1366,768,'desktop']]){
await p.setViewportSize({width,height});await p.waitForFunction(l=>document.querySelector('#controller').dataset.layout===l,layout);
const immediate=await measure();
await p.waitForFunction(({layout,height})=>{const h=document.querySelector('#controller'),r=h.getBoundingClientRect();return document.querySelector('#app').dataset.layout===layout&&(layout==='mobile'?h.parentElement.id==='app':h.parentElement.id==='controller-dock'&&r.width>1050&&r.width<=1101&&r.bottom<=height-4)},{layout,height});
rows.push({cycle,width,height,layout,immediate,settled:await measure()});}
writeFileSync('/tmp/cyber-layout-probe.json',JSON.stringify(rows,null,2)+'\n');console.log(JSON.stringify({cases:rows.length,transient:rows.filter(r=>r.layout==='desktop'&&(r.immediate.width<=1050||r.immediate.bottom>r.height-4)).length,allSettled:true}));
}finally{await b.close();s.close();}
