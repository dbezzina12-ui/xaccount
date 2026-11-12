import {LINES,PAYTABLE,WORD_RULES,LABELS} from './config.js?v=god-pacing-71';

// The guide and win traces use the exact paths used by the payout evaluator.
export function linePoints(rows){return rows.map((row,reel)=>`${10+reel*20},${10+row*20}`).join(' ');}
export function lineMap(index){
 const rows=LINES[index];if(!rows)throw Error('Unknown payline');
 const dots=Array.from({length:25},(_,i)=>`<circle cx="${10+Math.floor(i/5)*20}" cy="${10+i%5*20}" r="2.2" class="line-dot"/>`).join('');
 return `<svg viewBox="0 0 100 100" aria-hidden="true">${dots}<polyline points="${linePoints(rows)}" class="line-path"/>${rows.map((row,reel)=>`<circle cx="${10+reel*20}" cy="${10+row*20}" r="3.2" class="line-node"/>`).join('')}</svg>`;
}
export function winTraces(wins){
 return wins.map(win=>({line:win.line+1,word:!!win.word,points:win.positions.map(({reel,row})=>`${10+reel*20},${10+row*20}`).join(' ')}));
}
// Use the awarded line and the settled board, never the current bet selector.
export function lineWinDetails(win,board){
 const basePayout=win.word?WORD_RULES.award:PAYTABLE[win.symbol][win.count-3];
 const multipliers=win.word?(win.multiplier>1?[win.multiplier]:[]):win.positions.map(({reel,row})=>board[reel][row]).filter(s=>s.name==='WILD'&&s.multiplier>0).map(s=>s.multiplier);
 const sum=multipliers.join(' + '),factor=multipliers.length>1&&sum.length<=11?`(${sum})`:String(win.multiplier);
 return {title:`LINE ${win.line+1} · ${win.word?'DUEL WORD':`${win.count} ${LABELS[win.symbol]}`}`,symbol:win.word?'D':win.symbol,basePayout,payout:win.amount,multiplier:win.multiplier,factor,multipliers,wordCapped:!!win.word&&win.sourceMultiplier>win.multiplier};
}
export function createWinTraceCycle({draw,instant=()=>false,schedule=(fn,ms)=>setTimeout(fn,ms),cancel=id=>clearTimeout(id)}){
 let timer=null,generation=0;
 function clear(){generation++;if(timer!==null)cancel(timer);timer=null;draw(null);}
 function start(wins){
  clear();const traces=winTraces(wins),active=generation;let index=0;
  function next(){if(active!==generation)return;draw(traces[index],wins[index]);index=(index+1)%traces.length;if(traces.length>1&&!instant())timer=schedule(next,1200);}
  if(traces.length)next();
 }
 return {start,clear};
}
