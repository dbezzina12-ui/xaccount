import {MYSTERY_TIERS,TIERS,FEATURE_SPINS,SUPER_ANTE_MIX} from './config.js?v=ante124';
import {shopOdds} from './shop-odds.js?v=ante124';

const cards=[
 ...Object.entries(FEATURE_SPINS).map(([mode,feature])=>({mode,name:feature.name,feature:true})),
 {mode:'bonus',name:'Showdown'},
 {mode:'super',name:'Last Stand'},
 {mode:'mystery',name:'Mystery Buy'}
];
const number=new Intl.NumberFormat('en-US',{maximumFractionDigits:0});
const percent=value=>new Intl.NumberFormat('en-US',{style:'percent',maximumFractionDigits:1}).format(value);
function frequency(value){
 if(!Number.isFinite(value)||value<=0)return 'Unavailable';
 if(value>=1e6)return '≈1 in '+Number((value/1e6).toFixed(2))+'M';
 return (Math.abs(value-Math.round(value))>.001?'≈':'')+'1 in '+number.format(value);
}
function stats(mode){
 const odds=shopOdds.modes[mode];
 const rows=mode==='mystery'
  ?Object.entries(MYSTERY_TIERS).map(([tier,p])=>[TIERS[tier].name,percent(p)])
  :[['Profit chance',percent(odds.profit)]];
 if(mode==='enhanced')rows.push(['Any bonus',frequency(shopOdds.enhancedBonusOneIn)]);
 if(mode==='superAnte'){
  rows.push(['Last Stand',frequency(1/SUPER_ANTE_MIX.super)],['God Mode',frequency(1/SUPER_ANTE_MIX.hidden)]);
 }
 if(mode==='duel')rows.push(['Crossfire',percent(shopOdds.crossfire)]);
 rows.push(['Max win',frequency(odds.maxWinOneIn)]);
 return rows.map(([label,value])=>`<div><dt>${label}</dt><dd>${value}</dd></div>`).join('');
}
export function shopGroups({selected,activeMode,price,formatMoney,balance}){
 return [['features','Feature Spins'],['bonuses','Bonus Buys']].map(([id,title])=>{
  const group=cards.filter(card=>Boolean(card.feature)===(id==='features')&&(!selected||card.mode===selected));
  if(!group.length)return '';
  const entries=group.map(({mode,name,feature})=>{
   const cost=price(mode),active=activeMode===mode,disabled=cost>balance&&!active;
   const verb=feature?(active?'Disable':'Activate'):(selected?'Confirm buy':'Buy');
   const label=formatMoney(cost).replace(/\.00$/,'');
   return `<article class="contract" data-mode="${mode}">
    ${mode==='superAnte'?`<div class="contract-art super-ante-art" aria-hidden="true"><i></i><i></i><i></i></div>`:`<img class="contract-art" src="./assets/frontier-ink/shop/${mode}.webp" alt="" width="268" height="156">`}
    <div class="contract-paper"><h4>${name}</h4><dl class="contract-stats">${stats(mode)}</dl>
    <div class="contract-price">${label}${feature?' <small>/ spin</small>':''}</div>
    <button type="button" class="contract-action" data-buy="${mode}" aria-label="${verb} ${name} for ${label}${feature?' per spin':''}" ${disabled?'disabled':''}>${disabled?'Low balance':verb}</button></div>
   </article>`;
  }).join('');
  return `<section class="contract-group" data-category="${id}" aria-label="${title}"><h3><span>${selected?'Confirm purchase':title}</span></h3><div class="contract-list">${entries}</div></section>`;
 }).join('');
}
