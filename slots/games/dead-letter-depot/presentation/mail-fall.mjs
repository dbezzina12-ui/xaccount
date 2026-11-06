import { finishEntryBeat } from './entry-timing.mjs';

// A staggered pile spans the viewport at rest. Swap the scene while all the
// letters are resting, then let the bottom of the pile spill away first.
const art = new Image();
art.src = new URL('../art/night-mail/falling-airmail.webp', import.meta.url).href;
let textured = false;
art.decode().then(() => { textured = true; }, () => {});
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

export function mailCover() {
  const cover = document.createElement('div');
  cover.className = 'mail-cover';
  cover.setAttribute('aria-hidden', 'true');
  return cover;
}

export async function fallMail(cover, leaving = false) {
  if (reduced.matches) return;
  if (!leaving) {
    const columns = innerWidth > innerHeight ? 5 : 3;
    const rows = Math.max(2, Math.ceil(innerHeight / (innerWidth / columns * .55)));
    for (let row = 0; row < rows; row++) {
      for (let col = -1; col <= columns; col++) {
        const i = row * (columns + 2) + col + 1;
        const phase = Math.sin(i * 7.13);
        const letter = document.createElement('i');
        letter.className = textured ? 'falling-letter' : 'falling-letter paper-fold';
        if (textured) letter.style.backgroundImage = 'url("' + art.src + '")';
        letter.style.left = ((col + .5 + .36 * (row % 2) + .09 * phase) / columns * 100) + '%';
        letter.style.top = ((row + .5 + .10 * phase) / rows * 100) + '%';
        letter.style.width = (151 / columns) + '%';
        letter.style.setProperty('--tilt', (phase * 13) + 'deg');
        letter.style.zIndex = String((rows - row) * 2 + (i % 3));
        letter.style.filter = 'brightness(' + (.84 + .16 * ((i * 7 % 11) / 10)) + ')';
        letter.dataset.row = String(row / Math.max(1, rows - 1));
        cover.append(letter);
      }
    }
  }
  const motions = Array.from(cover.children, (letter, i) => {
    const phase = Math.cos(i * 4.72);
    const row = Number(letter.dataset.row);
    const tilt = letter.style.getPropertyValue('--tilt');
    const rest = 'translate(-50%, -50%) rotate(' + tilt + ')';
    const fly = (x,y,angle) => 'translate(-50%, -50%) translate(' + x + 'vw,' + y + 'vh) rotate(' + angle + 'deg)';
    // Each incoming envelope starts at the top edge, regardless of its landing row.
    const width = innerWidth * parseFloat(letter.style.width) / 100;
    const entryY = -parseFloat(letter.style.top) - 35 * width / innerHeight;
    const motion = letter.animate(leaving ? [
      {transform:rest}, {transform:fly(phase * 8, 138, phase * 46)}
    ] : [
      {transform:fly(phase * 12, entryY, phase * 22)},
      {transform:rest}
    ], {
      duration: leaving ? 215 : 355, delay:(1 - row) * 75 + ((i * 29) % 43),
      easing:leaving ? 'cubic-bezier(.4,.12,.75,.68)' : 'cubic-bezier(.3,.48,.38,1)',
      fill:'both'
    });
    return motion;
  });
  try { await finishEntryBeat(motions); }
  finally {
    if (leaving) cover.hidden = true;
    for (const m of motions) m.cancel();
  }
}
