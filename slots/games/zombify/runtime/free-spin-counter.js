// A presentation-only counter. The engine remains the source of spin counts.
export function createFreeSpinCounter({game,element,value,label,status,lift,animate,onHide=()=>{}}){
  let total=0,remaining=0,tier=null,active=false,complete=false;
  function setRemaining(next){
    const count=Math.min(total,Math.max(0,Math.trunc(next)));
    const changed=count!==remaining;
    remaining=count;value.textContent=String(count);
    label.textContent=complete?'COMPLETE':'FREE SPINS';
    status.textContent=complete?'Free spins complete.':`${count} free ${count===1?'spin':'spins'} remaining.`;
    if(changed&&!element.hidden)void animate(value,[
      {transform:'scale(1)',filter:'brightness(1)'},
      {transform:'scale(1.15)',filter:'brightness(1.45)',offset:.35},
      {transform:'scale(1)',filter:'brightness(1)'}
    ],240);
  }
  return {
    read(){return {active,total,remaining,tier,complete};},
    begin(spins,bonusTier){
      total=Math.max(0,Math.trunc(spins));remaining=total;tier=bonusTier;complete=false;active=true;
      element.dataset.tier=tier;element.classList.remove('counter-complete');
      setRemaining(total);element.hidden=false;game.dataset.freeSpins='active';
      void animate(lift,[
        {transform:'translateY(70%) rotate(-6deg)',opacity:0},
        {transform:'translateY(-3%) rotate(1deg)',opacity:1,offset:.78},
        {transform:'translateY(0) rotate(0deg)',opacity:1}
      ],650,{easing:'cubic-bezier(.2,.75,.25,1)'});
    },
    reveal(left){if(active&&!complete)setRemaining(left+1);},
    settle(left){if(active&&!complete)setRemaining(left);},
    complete(){
      if(!active)return;
      complete=true;element.classList.add('counter-complete');setRemaining(0);
    },
    async hide(withMotion=false){
      if(withMotion&&!element.hidden)await animate(lift,[
        {transform:'translateY(0)',opacity:1},
        {transform:'translateY(70%)',opacity:0}
      ],330,{easing:'ease-in'});
      // Clear tier-specific UI before removing the positioning context.
      onHide();element.hidden=true;delete game.dataset.freeSpins;
      total=0;remaining=0;tier=null;active=false;complete=false;
    }
  };
}
