// Presentation only. Awards and newly-landed key sources come from the engine.
// Never sample an award here; never collect surviving keys a second time.
export const VAULT_CAPACITY = 5;
export const vaultTreatment = value => value >= 1000 ? 'top' : value >= 25 ? 'large' : 'small';
export function collectionPlan(from, keyCount, awards) {
  if (!Number.isInteger(from) || from < 0 || from >= VAULT_CAPACITY || !Number.isInteger(keyCount) || keyCount < 0) throw new Error('Invalid key collection');
  const fills = Math.floor((from + keyCount) / VAULT_CAPACITY);
  if (!Array.isArray(awards) || awards.length !== fills || awards.some(n => !Number.isFinite(n) || n <= 0)) throw new Error('One authoritative positive award required per full vault');
  let n = from, index = 0;
  return Array.from({length:keyCount}, (_, source) => {
    n++;
    const item = {source, lights:n, award:n === VAULT_CAPACITY ? awards[index++] : null};
    if (n === VAULT_CAPACITY) n = 0;
    return item;
  });
}

const atlas = new URL('../art/night-mail/vault/vault-atlas.png', import.meta.url).href;
const keyArt = new URL('../art/night-mail/symbols/key.webp', import.meta.url).href;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms, signal) => new Promise(resolve => {
  if (signal?.aborted) return resolve();
  const done = () => {clearTimeout(timer);signal?.removeEventListener('abort',done);resolve();};
  const timer = setTimeout(done,ms);signal?.addEventListener('abort',done,{once:true});
});
async function animate(el, frames, duration, signal, easing='cubic-bezier(.2,.7,.2,1)') {
  if (signal?.aborted || reduced()) return;
  const a = el.animate(frames,{duration,easing,fill:'both'});
  const abort = () => a.finish();
  signal?.addEventListener('abort',abort,{once:true});
  try {await a.finished;} catch(e) {if(e.name !== 'AbortError')throw e;}
  finally {signal?.removeEventListener('abort',abort);a.cancel();}
}
function machine() {
  const el = document.createElement('div');
  el.className = 'postal-vault';el.style.setProperty('--vault-atlas',`url("${atlas}")`);
  el.innerHTML = '<div class="vault-aura"></div><div class="vault-housing"></div><div class="vault-prize" aria-hidden="true"><span></span></div><div class="vault-door"></div><div class="vault-lamps" aria-hidden="true">'+Array.from({length:5},(_,i)=>'<i style="--lamp:'+i+'"></i>').join('')+'</div><div class="vault-lock-target"></div>';
  return el;
}
function lights(el, count) {
  [...el.querySelectorAll('.vault-lamps i')].forEach((lamp,i)=>lamp.classList.toggle('is-lit',i<count));
}
export function mountVault(host, {onReveal=()=>{},largeAt=25,revealCaption=()=>'ADDED TO YOUR MULTIPLIER'}={}) {
  const ready=Promise.all([atlas,keyArt].map(src=>{const image=new Image();image.src=src;return image.decode();}));
  const dock = machine();host.append(dock);
  const status = document.createElement('span');status.className='vault-status';status.setAttribute('role','status');host.append(status);
  let running = false, destroyed = false;
  const lifecycle = new AbortController();
  function setNotches(count) {
    if(!Number.isInteger(count)||count<0||count>5)throw new Error('Invalid vault lights');
    lights(dock,count);status.textContent=count+' / 5 lights';
    dock.setAttribute('role','img');dock.setAttribute('aria-label','Vault: '+count+' of 5 lights filled');
  }
  setNotches(0);
  async function flight(source, signal) {
    const rect=source.getBoundingClientRect(), target=dock.querySelector('.vault-lock-target').getBoundingClientRect();
    const key=new Image();key.src=source.flightArt||keyArt;key.alt='';key.className='vault-flying-key';
    const size=Math.max(34,Math.min(64,rect.width));
    const x=rect.left+rect.width/2,y=rect.top+rect.height/2,dx=target.left+target.width/2-x,dy=target.top+target.height/2-y;
    key.style.cssText=`left:${x-size/2}px;top:${y-size/2}px;width:${size}px;height:${size}px`;
    document.body.append(key);source.classList.add('key-collected');
    try {
      await animate(key,[{transform:'translate(0,0) scale(1.1) rotate(-15deg)',opacity:1},{transform:`translate(${dx*.42}px,${dy*.55-36}px) scale(1.16) rotate(-35deg)`,offset:.5,opacity:1},{transform:`translate(${dx}px,${dy}px) scale(.32) rotate(75deg)`,opacity:.15}],420,signal);
      dock.classList.add('key-arrival');await wait(reduced()?0:70,signal);dock.classList.remove('key-arrival');
    }finally {key.remove();source.classList.remove('key-collected');}
  }
  async function reveal(value,{signal,starting=false,quick=false}={}) {
    if(!Number.isFinite(value)||value<=0)throw new Error('Authoritative award required');
    const veil=document.createElement('div');veil.className='vault-reveal-veil';veil.setAttribute('aria-hidden','true');
    const hero=machine();hero.classList.add('vault-reveal-hero');lights(hero,5);
    const caption=document.createElement('div');caption.className='vault-reveal-caption';caption.textContent='';
    const root=document.createElement('div');root.className='vault-reveal-stage';root.append(veil,hero,caption);document.body.append(root);
    const rect=dock.getBoundingClientRect(), hr=hero.getBoundingClientRect();
    const dx=rect.left+rect.width/2-hr.left-hr.width/2,dy=rect.top+rect.height/2-hr.top-hr.height/2,scale=rect.width/hr.width;
    const time=quick ? 0.55 : 1;
    try {
      // Identical staging for every amount: no tier class or value exists yet.
      await animate(hero,[{transform:`translate(${dx}px,${dy}px) scale(${scale})`},{transform:'translate(0,0) scale(1)'}],240*time,signal);
      hero.classList.add('vault-charged');
      await animate(hero.querySelector('.vault-door'),[{transform:'scale(.86) rotate(0deg)'},{transform:'scale(.86) rotate(-2deg)',offset:.35},{transform:'scale(.86) rotate(2deg)',offset:.65},{transform:'scale(.86) rotate(0deg)'}],200*time,signal);
      hero.classList.add('vault-is-open');
      await animate(hero.querySelector('.vault-door'),[{transform:'scale(.86) perspective(700px) rotateY(0deg)',opacity:1},{transform:'scale(.86) perspective(700px) rotateY(-108deg)',opacity:.5}],280*time,signal);
      // The award becomes visible only after the door has opened.
      hero.querySelector('.vault-prize span').textContent=(starting?'':'+')+value.toLocaleString('en-US')+'×';
      hero.classList.add('vault-value-shown','award-'+(value>=largeAt && value<1000?'large':vaultTreatment(value)));
      caption.textContent=starting?'STARTING MULTIPLIER':revealCaption(value);
      status.textContent=(starting?'Starting multiplier ':'Vault adds ')+value+' times';
      await onReveal(value,{starting});
      await wait((reduced()?650:560)*time,signal);
      await animate(root,[{opacity:1},{opacity:0}],180*time,signal);
    }finally {root.remove();}
  }
  async function run(task, externalSignal) {
    if(running||destroyed)throw new Error('Vault unavailable');
    running=true;
    const controller=new AbortController(), abort=()=>controller.abort();
    externalSignal?.addEventListener('abort',abort,{once:true});lifecycle.signal.addEventListener('abort',abort,{once:true});
    if(externalSignal?.aborted||lifecycle.signal.aborted)abort();
    try{await ready;return await task(controller.signal);}finally{running=false;externalSignal?.removeEventListener('abort',abort);lifecycle.signal.removeEventListener('abort',abort);}
  }
  return {
    ready,
    setNotches,
    // sources must be newly landed key cells in engine order, never every key on the board.
    collect({sources,fromNotches,awards,signal,quick=false}) {
      const plan=collectionPlan(fromNotches,sources.length,awards);
      return run(async internal=>{
        setNotches(fromNotches);
        for(let start=0;start<plan.length;) {
          let end=plan.findIndex((p,i)=>i>=start&&p.award!==null);end=end<0?plan.length:end+1;
          const batch=plan.slice(start,end);
          await Promise.all(batch.map(async (p,i)=>{
            await wait(quick?i*25:i*85,internal);
            await flight(sources[p.source],internal);
            lights(dock,p.lights);
          }));
          const last=batch.at(-1);setNotches(last.lights);
          if(last.award!==null){await reveal(last.award,{signal:internal,quick});setNotches(0);}
          start=end;
        }
        return {notches:(fromNotches+sources.length)%5};
      },signal);
    },
    revealStarting(value,options={}) {return run(signal=>reveal(value,{...options,signal,starting:true}),options.signal);},
    destroy(){destroyed=true;lifecycle.abort();dock.remove();status.remove();}
  };
}
