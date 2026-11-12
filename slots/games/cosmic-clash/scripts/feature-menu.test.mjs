import {strict as assert} from 'node:assert';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {quote} from '../dist/config.js';
import {shopGroups} from '../dist/feature-menu.js';
import {shopOdds} from '../dist/shop-odds.js';

test('menu odds identify the shipped catalog and use strict profit by paid mode',async()=>{
 const bytes=await readFile(new URL('../dist/outcomes.json',import.meta.url));
 const audit=JSON.parse(await readFile(new URL('../math/odds.json',import.meta.url)));
 assert.equal(shopOdds.outcomesSha256,createHash('sha256').update(bytes).digest('hex'));
 assert.equal(shopOdds.modelVersion,JSON.parse(bytes).version);
 for(const [mode,key] of Object.entries({enhanced:'enhanced',superAnte:'superAnte',duel:'duel',bonus:'showdown',super:'lastStand',mystery:'mystery'})){
  assert.equal(shopOdds.modes[mode].profit,audit.modes[key].distribution.profit);
  assert.equal(shopOdds.modes[mode].maxWinOneIn,audit.modes[key].maxWinOneIn);
 }
 assert.equal(shopOdds.enhancedBonusOneIn,audit.enhancedBonusOneIn);
 assert.equal(shopOdds.crossfire,audit.duelFeatures.crossfireRoundProbability);
});
test('feature and purchase actions use actual prices, confirmation and available credits',()=>{
 const state={activeMode:'base',balance:150e6,price:mode=>quote(1e6,mode).cost,formatMoney:n=>'$'+n/1e6};
 const menu=shopGroups(state);
 assert.equal((menu.match(/data-buy=/g)||[]).length,6);
 assert.match(menu,/Activate Super Ante for \$6 per spin/);
 assert.match(menu,/Activate Duel Spins for \$50 per spin/);
 assert.match(menu,/Buy Last Stand for \$250" disabled/);
 const confirm=shopGroups({...state,selected:'bonus'});
 assert.match(confirm,/Confirm buy Showdown for \$100/);
 assert.equal((confirm.match(/data-buy=/g)||[]).length,1);
});
