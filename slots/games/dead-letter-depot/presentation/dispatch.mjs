// Hold text independently of animation so a reduced-motion player can still read it.
export function dwell(ms, signal) {
  if (signal?.aborted) return Promise.resolve();
  return new Promise(resolve => {
    const finish = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', finish);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    signal?.addEventListener('abort', finish, {once: true});
  });
}

const labels = {10:'Tens', J:'Jacks', Q:'Queens', K:'Kings', A:'Aces', ENVELOPE:'Letters', PARCEL:'Parcels', PHONE:'Phones', KEY:'Keys'};
export const symbolName = id => labels[id] || id;

export function collectionText(job) {
  const n = job.changes.length, name = symbolName(job.symbol)?.toLowerCase();
  switch (job.job) {
    case 'sweep': return n ? 'The remaining tens clear. Fresh mail drops in.' : 'All tens have already cleared.';
    case 'convert': return n ? 'Remaining jacks turn into '+name+'.' : 'All jacks have already cleared.';
    case 'copy': return n ? 'Row '+(job.from+1)+' copies onto row '+(job.to+1)+'.' : 'The row copy leaves the board as it is.';
    case 'wild': return n ? 'Reel '+(job.reel+1)+' turns wild for the next match.' : 'Reel '+(job.reel+1)+' has no symbols to turn wild.';
    case 'filter': return job.filtered ? symbolName(job.filtered)+' stay out of refills for this spin.' : 'All three low symbols are already filtered.';
    case 'return': return job.returned ? 'The biggest match pays again.' : 'No earlier match to pay again.';
    case 'unpack': return n ? 'Unwrap '+n+' premium '+(n===1?'symbol':'symbols')+' on the reels.' : 'No space to unpack premiums.';
    case 'deliver': return n ? 'Incoming '+name+' fill '+n+' '+(n===1?'space':'spaces')+'.' : 'No delivery spaces on this board.';
    case 'vault': {
      const moves=[];
      if(job.unpack.changes.length) moves.push(job.unpack.changes.length+' premiums');
      if(job.wild.changes.length) moves.push('wild reel '+(job.wild.reel+1));
      if(job.stamp) moves.push('a +'+job.stamp+'× stamp');
      return moves.length ? 'Vault opens: '+moves.join(' · ')+'.' : 'Vault opened. All spaces are occupied.';
    }
  }
}

async function moveCard(note, frames, options, signal){
  if(signal?.aborted || matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const animation=note.animate(frames,options);
  const cancel=()=>animation.cancel();
  signal?.addEventListener('abort',cancel,{once:true});
  try {await animation.finished;} catch(error){if(error.name!=='AbortError')throw error;}
  finally {signal?.removeEventListener('abort',cancel);animation.cancel();}
}

export async function featureBeat(icon, heading, detail, ms, signal) {
  if (signal?.aborted) return;
  const note=document.querySelector('#dispatch-note');
  note.querySelector('img').src=icon;
  note.querySelector('strong').textContent=heading;
  note.querySelector('span').textContent=detail;
  note.hidden=false;
  try {
    await moveCard(note,[
      {transform:'translateX(105%) rotate(2.2deg)',opacity:.35},
      {transform:'translateX(-1.5%) rotate(-.4deg)',opacity:1,offset:.82},
      {transform:'none',opacity:1}
    ],{duration:240,easing:'cubic-bezier(.18,.75,.25,1)'},signal);
    await dwell(ms,signal);
    await moveCard(note,[
      {transform:'none',opacity:1},
      {transform:'translateX(-22%) rotate(-1.5deg)',opacity:0}
    ],{duration:145,easing:'ease-in'},signal);
  } finally {note.hidden=true;}
}

// Fly copies of the settled scatters into Frank's dispatch. Never move a reel tile.
export async function dispatchFlights(tiles, recipient) {
  if (!tiles.length || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const target = recipient.getBoundingClientRect();
  await Promise.all(tiles.map(async (tile, index) => {
    const rect = tile.getBoundingClientRect();
    const flyer = tile.querySelector('img').cloneNode(false);
    flyer.alt = ''; flyer.className = 'dispatch-flight';
    Object.assign(flyer.style, {left:rect.x+'px',top:rect.y+'px',width:rect.width+'px',height:rect.height+'px'});
    document.body.append(flyer);
    const dx = target.x+target.width*.4-rect.x-rect.width/2;
    const dy = target.y+target.height*.52-rect.y-rect.height/2;
    const animation = flyer.animate([
      {opacity:0,transform:'scale(.9)'},
      {opacity:1,transform:'translateY(-12px) scale(1.08)',offset:.18},
      {opacity:0,transform:'translate('+dx+'px,'+dy+'px) rotate(-14deg) scale(.2)'}
    ], {duration:440,delay:220+index*35,fill:'both',easing:'ease-in-out'});
    try { await animation.finished; } finally { flyer.remove(); }
  }));
}
