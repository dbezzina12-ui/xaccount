const css=document.createElement('link');
css.rel='stylesheet';css.href=new URL('./bonus-brief.css',import.meta.url).href;
document.head.append(css);

const looks={
  regular:{label:'Regular bonus',tag:'The night shift starts here',alt:'Teal mailbag, airmail and a glowing brass lantern'},
  super:{label:'Super bonus',tag:'Express delivery. Extra power.',alt:'Twin golden express parcels with brass wings'},
  hidden:{label:'Hidden bonus',tag:'The secret sorting room is open',alt:'A violet postal vault and glowing master key'}
};
const art=Object.fromEntries(Object.keys(looks).map(tier=>[tier,new URL('../art/night-mail/bonus-briefs/'+tier+'.webp',import.meta.url).href]));
const icon=id=>new URL('../art/night-mail/symbols/'+id+'.webp',import.meta.url).href;
const make=(tag,cls,text)=>{const el=document.createElement(tag);el.className=cls;if(text)el.textContent=text;return el};

function facts(tier,variant){
  if(variant==='collections')return {
    regular:[['letter','Keep collecting','Your symbol counts carry between free spins.'],['parcel','Unlock their jobs','Complete a collection to trigger its feature.'],['stamp','Activate the multi','A collection or stamp activates it for that spin.']],
    super:[['stamp','Start at 10×','Your global multiplier begins at 10×.'],['letter','Always active','The multiplier applies on every winning spin.'],['parcel','Keep building','Collections and stamps grow it through the bonus.']],
    hidden:[['key','Half-size collections','Complete each collection in half the usual hits.'],['parcel','Double the whole meter','Each completed collection doubles it, up to 64×.'],['stamp','Always active','The multiplier applies on every winning spin.']]
  }[tier];
  const building=variant==='ladder'?'Each symbol’s next addition doubles after it pays.':'Listed basics add +1; listed premiums add +3.';
  return {
    regular:[['letter','Six symbols on your rack','Match 8+ of a listed symbol to grow the multiplier.'],['parcel',variant==='ladder'?'Bigger with every match':'Build your multiplier',building],['@×','Match to activate','A rack match activates the multiplier for that spin.']],
    super:[['@10×','Start at 10×','Your global multiplier begins at 10×.'],['@×','Always active','The multiplier applies on every winning spin.'],['parcel',variant==='ladder'?'Growing deliveries':'Keep building',building]],
    hidden:[['key','Keys are guaranteed','Keys always appear on your six-symbol rack.'],['key',variant==='ladder'?'×2 first. Then ×4.':'Double the whole meter',variant==='ladder'?'Key matches multiply the entire global multiplier.':'Match 8+ Keys to double your global multiplier.'],['@×','Always active','Your growing multiplier applies on every winning spin.']]
  }[tier];
}

export function buildBonusBrief({tier,title,spins,trigger,variant='collections',preview=false}){
  const look=looks[tier];
  const scene=make('div','dispatch-scene bonus-explainer');scene.dataset.tier=tier;
  const visual=make('div','bonus-visual');
  const hero=Object.assign(new Image(),{src:art[tier],alt:look.alt,className:'bonus-hero',width:1536,height:1024});
  visual.append(hero);
  const ticket=make('section','dispatch-ticket');
  const eyebrow=make('small','bonus-eyebrow',look.label);
  const heading=make('h2','bonus-heading',title);heading.id='bonus-title';
  const tagline=make('p','bonus-tagline',look.tag);
  const award=make('div','bonus-spins');
  award.append(make('strong','',String(spins)),make('span','','FREE SPINS'));
  const list=make('div','bonus-facts');
  for(const [symbol,heading,body] of facts(tier,variant)){
    const row=make('div','bonus-fact'),copy=make('div','');
    copy.append(make('strong','',heading),make('p','',body));
    const symbolArt=symbol.startsWith('@')?make('span','bonus-fact-mark',symbol.slice(1)):Object.assign(new Image(),{src:icon(symbol),alt:'',width:48,height:48});
    symbolArt.setAttribute('aria-hidden','true');row.append(symbolArt,copy);list.append(row);
  }
  const button=make('button','cta',preview?'Back to previews':'Start '+spins+' free spins');
  button.id='startBonus';button.disabled=true;
  ticket.append(eyebrow,heading,tagline,award,list,button,make('small','dispatch-origin',trigger));
  scene.append(visual,ticket);
  // Warm/decode during the throw; the screen still has a readable title on failure.
  const ready=hero.decode().catch(()=>{hero.hidden=true});
  return {scene,visual,button,ready};
}
