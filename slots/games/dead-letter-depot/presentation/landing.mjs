// Motion only. The caller owns stops, bonus entry and all game state.
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

async function motion(node, frames, timing, signal) {
  if (signal?.aborted || reduced()) return;
  const animation = node.animate(frames, timing);
  const cancel = () => animation.cancel();
  signal?.addEventListener('abort', cancel, { once: true });
  try { await animation.finished; }
  catch (error) { if (error.name !== 'AbortError') throw error; }
  finally { signal?.removeEventListener('abort', cancel); animation.cancel(); }
}

// Call after draw(..., landing=false). distances uses row-major engine coordinates.
// Omit distances for a new board. Pass them for a tumble so stationary tiles stay put.
export async function liftSymbols(board, hitOnly, signal) {
  const tiles = board.querySelectorAll(hitOnly ? '.tile.hit' : '.tile');
  await Promise.all(Array.from(tiles, tile => motion(tile, [
    {opacity:1, transform:'translateY(0) scale(1)'},
    {opacity:hitOnly ? .9 : .6, transform:hitOnly ? 'scale(1.07)' : 'translateY(16%)', offset:.32},
    {opacity:0, transform:hitOnly ? 'scale(.72)' : 'translateY(104%)'}
  ], {duration:hitOnly ? 205 : 165, easing:'cubic-bezier(.42,0,.77,.52)',fill:'forwards'}, signal)));
}

// Count visible scatters only after their column lands. The same pause plays on
// misses and hits. Tumbles use only the distances recorded by the engine.
export async function dropReels(board, distances, signal, {anticipation=0, onLand}={}) {
  const columns=Array.from(board.children);
  let seen=0, held=false;
  const pending=columns.map((column,x)=>{
    const tiles=Array.from(column.children);
    if(!distances && anticipation && seen>=anticipation) held=true;
    const delay=distances ? x*12 : x*67+(held?410:0);
    const scatters=tiles.filter(tile=>tile.dataset.symbol==='fs');
    seen+=scatters.length;
    const moves=tiles.map((tile,y)=>{
      const count=distances ? distances[y*columns.length+x] : tiles.length;
      if(!count)return;
      return motion(tile, [
        {transform:'translateY(-'+count*100+'%)',easing:'cubic-bezier(.38,.02,.84,.56)'},
        {transform:'translateY(2%)',offset:.89},
        {transform:'translateY(0)'}
      ],{duration:170+Math.min(5,count)*36, delay, fill:'backwards'},signal);
    });
    return Promise.all(moves).then(()=>{
      if(!distances && !signal?.aborted && !reduced())onLand?.(x,scatters);
    });
  });
  await Promise.all(pending);
}

export function paintCollectionRack(rack, entries, symbolUrl) {
  const fragment = document.createDocumentFragment();
  for (const { id, label, count, target } of entries) {
    const cell = document.createElement('div');
    cell.className = 'mail-cubby';
    const icon = new Image();
    icon.src = symbolUrl(id);
    icon.alt = label;
    const score = document.createElement('span');
    score.textContent = count + '/' + target;
    const bar = document.createElement('progress');
    bar.max = target; bar.value = count; bar.setAttribute('aria-label', label + ' collected');
    cell.classList.toggle('ready', count >= target);
    cell.append(icon, score, bar); fragment.append(cell);
  }
  rack.classList.add('mail-rack');
  rack.replaceChildren(fragment);
}

// Invoke exactly once on every confirmed bonus entry (natural, purchased or mystery).
// Pass only the settled triggering scatter elements. Await before opening bonus UI.
export async function mailStinger(scatterTiles, title, signal) {
  const layer = document.createElement('div');
  layer.className = 'mail-stinger'; layer.setAttribute('aria-hidden', 'true');
  const letter = document.createElement('div'); letter.className = 'mail-envelope';
  const imprint = document.createElement('strong'); imprint.textContent = title;
  letter.append(imprint); layer.append(letter); document.body.append(layer);
  try {
    if (reduced() || signal?.aborted) return;
    const centerX = innerWidth / 2, centerY = innerHeight / 2;
    const flights = Array.from(scatterTiles).map((tile, i) => {
      const source = tile.querySelector('img') || tile;
      const rect = source.getBoundingClientRect();
      const clone = source.cloneNode(false); clone.removeAttribute('id');
      clone.className = 'mail-flying';
      Object.assign(clone.style, { left: rect.left+'px', top: rect.top+'px', width:rect.width+'px', height:rect.height+'px' });
      layer.append(clone);
      const dx = centerX-rect.left-rect.width/2, dy = centerY-rect.top-rect.height/2;
      return motion(clone, [{transform:'translate(0,0)'}, {transform:'translate('+dx*.42+'px,'+(dy*.45-45)+'px) rotate(-10deg)'}, {transform:'translate('+dx+'px,'+dy+'px) scale(.16)', opacity:0}],{duration:450, delay:i*48, easing:'ease-in',fill:'backwards'},signal).finally(()=>clone.remove());
    });
    await Promise.all([motion(letter,[{clipPath:'inset(50% 50%)'},{clipPath:'inset(0)'}],{duration:480,easing:'cubic-bezier(.54,.01,.25,1)'},signal),...flights]);
    if(signal?.aborted)return;
    await motion(imprint,[{opacity:0,transform:'scale(2.5) rotate(-12deg)'},{opacity:1,transform:'scale(.95) rotate(-8deg)',offset:.48},{opacity:1,transform:'scale(1) rotate(-8deg)'}],{duration:400},signal);
    imprint.style.opacity='1';
    await motion(letter,[{transform:'scale(1)'},{transform:'scale(1)',offset:.65},{transform:'scale(1.04)'}],{duration:540,easing:'ease-out'},signal);
  } finally { layer.remove(); }
}
