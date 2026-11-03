import {serve,chromium} from '../../../../tools/lib/browser.mjs';
import {writeFileSync} from 'node:fs';
const srv=await serve(),b=await chromium();
const rows=[];
try {for(const [width,height] of [[360,800],[390,844],[430,932],[844,390],[768,1024],[1366,768]]) {
 const p=await b.newPage({viewport:{width,height},hasTouch:true,reducedMotion:'reduce'});
 await p.goto(srv.url+'games/cyber-skunk/runtime/index.html');await p.locator('#intro-go').click();await p.locator('[data-action=buy]').first().click();
 const measure=()=>p.evaluate(()=>[...document.querySelectorAll('dialog[open] button')].filter(e=>e.getClientRects().length).map(e=>({id:e.id||e.dataset.pick||e.dataset.view||e.getAttribute('aria-label'),...e.getBoundingClientRect().toJSON()})));
 const initialBet=await p.evaluate(()=>window.cyberSkunk.state.bet);
 await p.locator('[data-bet="1"]').click();await p.locator('[data-bet="-1"]').click();
 if(await p.evaluate(()=>window.cyberSkunk.state.bet)!==initialBet)throw Error('Bet not restored');
 const heading=await p.locator('.shop-head h2').boundingBox(),betBox=await p.locator('.buy-bet').boundingBox();
 if(heading.x+heading.width>betBox.x)throw Error('Shop heading overlaps bet controls');
 const shop=await measure();if(width===360)await p.screenshot({path:'/tmp/shop-phone.jpg'});
 await p.locator('[data-pick=mystery]').click();await p.locator('#confirm-cancel').waitFor({state:'visible'});const receipt=await measure();
 const receiptTitle=await p.locator('#confirm-title').boundingBox();
 if(receiptTitle.y<0||receiptTitle.y+receiptTitle.height>height)throw Error('Receipt title off screen');
 if(receipt.filter(x=>x.id.startsWith('confirm-')).some(x=>x.y<0||x.bottom>height))throw Error('Receipt action off screen');
 if(width===844)await p.screenshot({path:'/tmp/shop-landscape-receipt.jpg'});
 await p.keyboard.press('Escape');await p.locator('#confirm').waitFor({state:'hidden'});const focus=await p.evaluate(()=>document.activeElement.dataset.pick);
 if(focus!=='mystery')throw Error('Focus not restored');
 if([...shop,...receipt].some(x=>x.width<44||x.height<44))throw Error('Small touch target');
 rows.push({width,height,shop,receipt,receiptTitle,restoredFocus:focus,betRestored:true,headingClear:true,balance:await p.evaluate(()=>window.cyberSkunk.state.balance)});await p.close();
}writeFileSync('/tmp/shop-qa.json',JSON.stringify(rows,null,2));console.log(JSON.stringify(rows));}finally{await b.close();srv.close();}
