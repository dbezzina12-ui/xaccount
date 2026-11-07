import test from 'node:test';
import assert from 'node:assert/strict';
import {sixView} from './six-view.mjs';
import {collectionPlan} from './vault.mjs';
import {seeded} from '../engine/six.js';

test('Perks fixtures support presenter source cells, charges, ring carry and settlement',()=>{
  const cases=[['base',134,1920],['base',1672,19600],['nightshift',7,20660],['nightshift',5,11860],['nightshift',9,27600],['doublepost',1,25920],['doublepost',19,65100],['mystery',89,124940],['mystery',4,100000],['mystery',1,27460],['mystery',1629,2500000]];
  for(const [mode,seed,total] of cases){
    const round=sixView({mode,rng:seeded(seed),variant:'perks'});
    assert.equal(round.total,total);
    const bonus=round.bonus;
    if(!bonus)continue;
    let notches=0,meter=bonus.opening||(bonus.tier==='regular'?2:5);
    let charges=Object.fromEntries(bonus.perks.filter(id=>id!=='build').map(id=>[id,bonus.tier==='super'?2:3]));
    for(const spin of bonus.spins){
      assert.equal(spin.meter.start,meter);
      let grid=spin.board;
      function ring(e,keys,marks){
        assert.equal(e.keys,keys);
        const plan=collectionPlan(notches,keys+marks,e.reveals);
        notches=(notches+plan.length)%5;
        meter=Math.min(1000,meter+e.reveals.reduce((a,b)=>a+b,0));
        assert.equal(e.after,meter);assert.equal(e.notches,notches);
      }
      ring(spin.land,grid.flat().filter(c=>c.s==='KEY').length,0);
      for(let at=0;at<=spin.steps.length;at++){
        for(const f of spin.perks.filter(f=>f.at===at)){
          charges[f.perk]--;
          grid=grid.map(col=>col.slice());
          for(const [x,y,from,to] of f.changes||[]){
            assert.equal(grid[x][y].s,from);grid[x][y]={s:to};
          }
        }
        const step=spin.steps[at];
        if(!step)break;
        for(const w of step.wins)for(const [x,y] of w.cells)assert.equal(grid[x][y].s,w.s);
        ring(step.rack,step.refills.filter(f=>f[2]==='KEY').length,step.wins.filter(w=>bonus.build?.includes(w.s)).length);
        grid=step.after;
      }
      assert.deepEqual(charges,spin.charges);
      assert.equal(meter,spin.multiplier);
    }
  }
});
