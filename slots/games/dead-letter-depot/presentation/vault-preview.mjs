import {mountVault} from './vault.mjs';
const $=id=>document.getElementById(id);
let multi=5,notches=0,controller,release;
const caption=$('preview-caption'),readout=$('preview-multi');
const vault=mountVault($('vault-dock'),{async onReveal(value,{starting}){
  multi=starting?value:multi+value;readout.textContent=multi.toLocaleString('en-US')+'×';
  readout.classList.remove('multi-bump');void readout.offsetWidth;readout.classList.add('multi-bump');
  caption.textContent=starting?'Starting multiplier: '+value+'×':'Vault delivered +'+value.toLocaleString('en-US')+'×';
  if($('hold').checked&&!controller.signal.aborted){
    $('skip').textContent='Continue';$('skip').classList.add('is-continue');
    await new Promise(resolve=>{release=resolve;});
    release=null;$('skip').textContent='Skip animation';$('skip').classList.remove('is-continue');
  }
}});
const symbols=['j','phone','key','parcel','q','letter','key','a','k','10','key','phone','parcel','q','key','j','letter','key','a','k','parcel','phone','10','q'];
for(const s of symbols){const cell=document.createElement('div');cell.className='preview-cell';cell.dataset.symbol=s;const img=new Image();img.src=new URL('../art/night-mail/symbols/'+s+'.webp',import.meta.url).href;img.alt=s;cell.append(img);$('preview-board').append(cell);}
const keys=[...document.querySelectorAll('[data-symbol=key]')];
const lock=busy=>{for(const id of ['collect','single','starting','award'])$(id).disabled=busy;$('skip').disabled=!busy;};
async function run(kind){
  if(controller)return;
  controller=new AbortController();lock(true);
  try{
    // Explicit art fixtures, isolated from the game and its session storage.
    const award=Number($('award').value);
    if(kind==='starting'){await vault.revealStarting(award,{signal:controller.signal});}
    else{
      const sources=kind==='single'?[keys[notches%keys.length]]:keys.slice(0,5-notches);
      const fills=Math.floor((notches+sources.length)/5);
      caption.textContent='Collecting keys…';
      const result=await vault.collect({sources,fromNotches:notches,awards:Array(fills).fill(award),signal:controller.signal});
      notches=result.notches;
      if(!fills)caption.textContent=notches+' of 5 keys collected — progress carries over.';
    }
  }finally{controller=null;lock(false);}
}
const skip=()=>{release?.();controller?.abort();};
$('collect').onclick=()=>run('all');$('single').onclick=()=>run('single');$('starting').onclick=()=>run('starting');$('skip').onclick=skip;
document.addEventListener('keydown',e=>{if(e.key==='Escape')skip();});
