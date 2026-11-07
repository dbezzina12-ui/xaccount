import {mountVault} from './vault.mjs';
import {dropReels,liftSymbols} from './landing.mjs';
import {dwell} from './dispatch.mjs';

const pictures={return:'letter',unpack:'parcel',deliver:'phone'};
const rules={build:'Marked wins light the vault',return:'3 letters · pays twice',unpack:'5 parcels · unpack premiums',deliver:'2 phones · complete a group'};
export function perkCard(id,marks,remaining,capacity,compact=false){
  const card=document.createElement('div');
  card.className='perk-card perk-'+id;
  const face=document.createElement('div');
  face.className='perk-face';
  const symbols=id==='build'?marks.map(s=>s.toLowerCase()):[pictures[id]];
  for(const s of symbols){
    const image=new Image();
    image.src='art/night-mail/symbols/'+s+'.webp';
    image.alt=s;
    face.append(image);
  }
  const name=document.createElement('b');
  name.textContent=id;
  card.append(face,name);
  if(!compact){const rule=document.createElement('small');rule.textContent=rules[id];card.append(rule);}
  if(id!=='build'){
    const pips=document.createElement('span');
    pips.className='perk-pips';
    pips.setAttribute('aria-label',remaining+' of '+capacity+' charges');
    for(let i=0;i<capacity;i++){
      const pip=document.createElement('i');
      pip.classList.toggle('lit',i<remaining);
      pips.append(pip);
    }
    card.append(pips);
  }
  card.title=rules[id];return card;
}
export function perkHUD(host,bonus,spinIndex,meter){
  const spin=bonus.spins[spinIndex];
  const capacity=bonus.tier==='super'?2:3;
  const charges={...spin.charges};
  for(const fire of spin.perks)charges[fire.perk]++;
  host.className='perk-rack';
  delete host.dataset.lineup;
  const dock=document.createElement('div');
  dock.className='perk-dock';
  const badges=document.createElement('div');
  badges.className='perk-badges';
  function paint(){
    badges.replaceChildren(...bonus.perks.map(id=>perkCard(id,bonus.build,charges[id],capacity,true)));
  }
  paint();host.replaceChildren(dock,badges);
  let value=spin.meter.start;
  let notches=spinIndex?bonus.spins[spinIndex-1].meter.notches:0;
  const vault=mountVault(dock,{largeAt:10,revealCaption:n=>value+n>=1000?'MULTIPLIER AT 1,000× LIMIT':'ADDED TO YOUR MULTIPLIER',onReveal(n,{starting}){
    value=starting?n:Math.min(1000,value+n);
    meter(value,true);
  }});
  vault.setNotches(notches);
  return {vault,spend(id){charges[id]--;paint();},async collect(event,sources,signal,quick){
    if(sources.length){
      await vault.collect({sources,fromNotches:notches,awards:event.reveals,signal,quick});
    }
    value=event.after;notches=event.notches;
    meter(value,true);
  }};
}
export async function presentPerkSpin({spin,bonus,index,host,board,draw,meter,readout,signal,quick}){
  const hud=perkHUD(host,bonus,index,meter);
  const tile=(x,y)=>board.children[x].children[y];
  let grid=spin.board;
  const paint=(hits=[])=>{
    draw(grid,hits);
    for(const id of bonus.build||[]){
      for(const cell of board.querySelectorAll('[data-symbol="'+id.toLowerCase()+'"]'))cell.classList.add('perk-mark');
    }
  };
  try{
    meter(spin.meter.start,true);
    if(!quick)await liftSymbols(board,false,signal);
    paint();
    if(!quick)await dropReels(board,null,signal);
    await hud.collect(spin.land,[...board.querySelectorAll('[data-symbol="key"]')],signal,quick);
    for(let at=0;at<=spin.steps.length;at++){
      for(const fire of spin.perks.filter(f=>f.at===at&&f.perk!=='return')){
        hud.spend(fire.perk);
        grid=grid.map(col=>col.slice());
        for(const [x,y,,s] of fire.changes)grid[x][y]={s};
        paint();
        for(const [x,y] of fire.changes)tile(x,y).classList.add('perk-'+fire.perk+'-arrival');
        if(fire.changes.length){
          readout(fire.perk==='unpack'?'Unpack · premium delivery':'Deliver · group completed');
          await dwell(quick?180:550,signal);
        }
      }
      const step=spin.steps[at];
      if(!step)break;
      paint(step.cleared);
      readout(step.wins.map(w=>w.count+' '+w.s).join(' + '));
      const marks=step.rack.hits.map(id=>{
        const [x,y]=step.wins.find(w=>w.s===id).cells[0];
        const cell=tile(x,y),rect=cell.getBoundingClientRect();
        return {getBoundingClientRect:()=>rect,classList:cell.classList,flightArt:cell.querySelector('img').src};
      });
      await dwell(quick?50:320,signal);
      if(!quick)await liftSymbols(board,true,signal);
      grid=step.after;paint();
      const distances=Array(30).fill(0),heights=Array(6).fill(0);
      for(const [x,from,to] of step.drops)distances[to*6+x]=to-from;
      for(const [x] of step.refills)heights[x]++;
      for(const [x,y] of step.refills)distances[y*6+x]=heights[x];
      if(!quick)await dropReels(board,distances,signal);
      const keys=step.refills.filter(f=>f[2]==='KEY').map(([x,y])=>tile(x,y));
      await hud.collect(step.rack,[...keys,...marks],signal,quick);
    }
    const returned=spin.perks.find(f=>f.perk==='return');
    if(returned)hud.spend('return');
    if(returned?.returned>0){
      readout('RETURN · PAYS TWICE');
      board.classList.add('return-stamped');
      await dwell(quick?240:800,signal);
    }
  }finally{
    // Keep the completed HUD visible between spins. Its host is replaced on the next spin.
    board.classList.remove('return-stamped');
  }
}
