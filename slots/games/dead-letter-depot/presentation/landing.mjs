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
export async function dropReels(board, distances, signal) {
  const columns = Array.from(board.children);
  const drops = columns.flatMap((col, x) => Array.from(col.children).map((tile, y) => {
    const cells = distances ? distances[y * columns.length + x] : col.children.length;
    if (!(cells > 0)) return;
    return motion(tile, [
      { transform: 'translateY(-' + cells * 100 + '%)', easing: 'cubic-bezier(.38,.02,.84,.56)' },
      { transform: 'translateY(1.8%)', offset: .91 },
      { transform: 'translateY(0)' }
    ], { duration: 165 + Math.min(cells, 5) * 38, delay: x * (distances ? 12 : 48), fill: 'backwards' }, signal);
  }));
  await Promise.all(drops);
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
    await Promise.all([motion(letter,[{opacity:0,transform:'scale(.12) rotate(-12deg)'},{opacity:1,transform:'scale(1)'}],{duration:360},signal),...flights]);
    if(signal?.aborted)return;
    await motion(imprint,[{opacity:0,transform:'scale(2.5) rotate(-12deg)'},{opacity:1,transform:'scale(.95) rotate(-8deg)',offset:.48},{opacity:1,transform:'scale(1) rotate(-8deg)'}],{duration:400},signal);
    imprint.style.opacity='1';
    await motion(letter,[{transform:'scale(1)'},{transform:'scale(9) translateY(-42%)',opacity:0}],{duration:430,easing:'ease-in'},signal);
  } finally { layer.remove(); }
}
