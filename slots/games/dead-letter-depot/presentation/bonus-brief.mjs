import {perkCard} from './perk-view.mjs';
const css=document.createElement('link');
css.rel='stylesheet';css.href=new URL('./bonus-brief.css',import.meta.url).href;
document.head.append(css);

const looks={
  regular:{alt:'Teal mailbag, airmail and a glowing brass lantern'},
  super:{alt:'Twin golden express parcels with brass wings'},
  hidden:{alt:'A violet postal vault and glowing master key'}
};
const art=Object.fromEntries(Object.keys(looks).map(tier=>[tier,new URL('../art/night-mail/bonus-briefs/'+tier+'.webp',import.meta.url).href]));
const make=(tag,cls,text)=>{const el=document.createElement(tag);el.className=cls;if(text)el.textContent=text;return el};

function feature(tier,variant){
  if(variant==='perks')return tier==='hidden'?'Open your starting vault, then fill five lights for each new reveal.':'Fill five vault lights to grow your multiplier.';
  if(variant==='vault2' && tier!=='hidden')return tier==='regular'?'Listed basics switch your multi on. Key matches unlock 60×, then the 1,000× inner vault.':'Start at 5×, active every spin. Key matches unlock 120×, then the 1,000× inner vault.';
  if(variant==='vault2')variant='vault';
  if(variant==='vault')return tier==='regular'?'Start at 2×. Listed basics switch your multi on; match 8+ Keys to unlock the 1,000× vault.':tier==='super'?'Start at 5×, active every spin. Match 8+ Keys to unlock the 1,000× vault.':'Start at 30×. Five landed Keys add +20; match 8+ Keys to unlock the 1,000× vault.';
  if(variant==='keyring')return tier==='regular'?'Every five landed Keys boosts your multiplier; match 8+ Keys to open the vault.':tier==='super'?'Start at 15×; five landed Keys add +6, and an 8+ Key match opens the vault.':'Start at 40×; five landed Keys add +25, and an 8+ Key match opens the vault.';
  if(tier==='super')return 'Start at '+(variant==='steady'?15:10)+'× with your global multiplier active on every winning spin.';
  if(variant==='collections')return tier==='hidden'
    ? 'Half-size collections double your entire multiplier, up to 64×.'
    : 'Complete a collection or land a stamp to activate your growing multiplier.';
  if(tier==='regular')return 'Match 8+ of a listed symbol to build and activate your global multiplier.';
  return ['ladder','balanced','steady'].includes(variant)
    ? 'Key matches multiply your entire global multiplier: ×2 first, then ×4.'
    : 'Match 8+ listed Keys to double your entire global multiplier.';
}

export function buildBonusBrief({tier,title,spins,bonus,variant='collections',preview=false}){
  const look=looks[tier];
  const scene=make('div','dispatch-scene bonus-explainer');scene.dataset.tier=tier;
  const visual=make('div','bonus-visual');
  const hero=Object.assign(new Image(),{src:art[tier],alt:look.alt,className:'bonus-hero',width:1536,height:1024});
  visual.append(hero);
  const ticket=make('section','dispatch-ticket');
  const heading=make('h2','bonus-heading',title);heading.id='bonus-title';
  const award=make('div','bonus-spins');
  award.append(make('strong','',String(spins)),make('span','','FREE SPINS'));
  const rule=make('p','bonus-feature',feature(tier,variant));
  const button=make('button','cta',preview?'Back to previews':'Continue');
  button.id='startBonus';button.disabled=true;
  ticket.append(heading,award,rule);
  if(variant==='perks'&&bonus?.perks){
    const cards=make('div','perk-cards'),capacity=tier==='super'?2:3;
    for(const id of bonus.perks)cards.append(perkCard(id,bonus.build,capacity,capacity));
    ticket.append(cards);
  }
  ticket.append(button);
  scene.append(visual,ticket);
  // Warm/decode during the throw; the screen still has a readable title on failure.
  const ready=hero.decode().catch(()=>{hero.hidden=true});
  return {scene,visual,button,ready};
}
