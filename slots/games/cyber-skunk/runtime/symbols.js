// Cyber Skunk symbols. The game uses ChatGPT's art (assets/symbols/<file>.webp,
// ART_SPEC §2) when it is present, and these vector placeholders until then,
// drawn in the style frame's palette.
export const PALETTE = Object.freeze({ midnight: '#101820', graphite: '#252d31', ivory: '#efe5cf', brass: '#ad7840', amber: '#eda83c', cyan: '#68c8c3' });
export const ART = Object.freeze({ H1: 'h1-battery', H2: 'h2-rotor', H3: 'h3-canister', H4: 'h4-key', A: 'a', K: 'k', Q: 'q', J: 'j', T: 'ten', W: 'wild', S: 'scatter-plate' });

const svg = (body) => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;
const plate = (fill = '#1b2329') => `<rect x="9" y="9" width="82" height="82" rx="10" fill="${fill}" stroke="#0b1014" stroke-width="3"/><rect x="13" y="13" width="74" height="74" rx="7" fill="none" stroke="#ad784066" stroke-width="2"/>`;
const letter = (t, size = 56) => svg(`${plate()}<text x="50" y="${50 + size * 0.35}" font-family="Anton, Impact, 'Arial Black', sans-serif" font-size="${size}" text-anchor="middle" fill="#efe5cf" stroke="#0b1014" stroke-width="3" paint-order="stroke">${t}</text>`);
const PLACEHOLDER = {
  H1: svg(`<rect x="30" y="14" width="40" height="8" rx="2" fill="#ad7840"/><rect x="24" y="20" width="52" height="68" rx="8" fill="#3a2a12" stroke="#ad7840" stroke-width="5"/><rect x="31" y="28" width="38" height="52" rx="4" fill="#eda83c"/><g fill="#fff3c4" opacity=".75"><rect x="35" y="33" width="30" height="9" rx="2"/><rect x="35" y="47" width="30" height="9" rx="2"/><rect x="35" y="61" width="30" height="9" rx="2"/></g><path d="M55 30 44 52h8l-5 22 14-28h-9z" fill="#3a2a12"/>`),
  H2: svg(`<circle cx="50" cy="50" r="40" fill="#2a3237" stroke="#ad7840" stroke-width="6"/><circle cx="50" cy="50" r="31" fill="#1a2024"/><g fill="#c9c3b4" stroke="#0b1014" stroke-width="2">${[0, 72, 144, 216, 288].map((a) => `<path d="M50 50 L50 22 Q64 26 62 44 Z" transform="rotate(${a} 50 50)"/>`).join('')}</g><circle cx="50" cy="50" r="8" fill="#eda83c" stroke="#0b1014" stroke-width="2"/>`),
  H3: svg(`<rect x="28" y="10" width="44" height="10" rx="3" fill="#8b8f8f"/><rect x="24" y="18" width="52" height="66" rx="9" fill="#1d2b2c" stroke="#a9b0ae" stroke-width="5"/><rect x="32" y="26" width="36" height="50" rx="6" fill="#68c8c3"/><path d="M52 30 40 52h9l-6 20 15-26h-9z" fill="#e6fffd" opacity=".9"/><rect x="28" y="84" width="44" height="8" rx="3" fill="#8b8f8f"/>`),
  H4: svg(`<circle cx="34" cy="38" r="20" fill="#ad7840" stroke="#5a3a17" stroke-width="4"/><circle cx="34" cy="38" r="9" fill="#68c8c3" stroke="#0b1014" stroke-width="2"/><rect x="48" y="34" width="40" height="9" rx="3" fill="#ad7840" stroke="#5a3a17" stroke-width="3"/><rect x="70" y="42" width="6" height="14" fill="#ad7840" stroke="#5a3a17" stroke-width="2"/><rect x="80" y="42" width="6" height="10" fill="#ad7840" stroke="#5a3a17" stroke-width="2"/>`),
  A: letter('A'), K: letter('K'), Q: letter('Q'), J: letter('J'), T: letter('10', 46),
  W: svg(`<rect x="8" y="14" width="84" height="72" rx="14" fill="#101418" stroke="#efe5cf" stroke-width="4"/><path d="M22 74 C34 48 40 30 50 18 C60 30 66 48 78 74 Z" fill="#efe5cf"/><path d="M38 74 C44 54 46 40 50 30 C54 40 56 54 62 74 Z" fill="#101418"/><text x="50" y="68" font-family="Anton, Impact, 'Arial Black', sans-serif" font-size="24" text-anchor="middle" fill="#eda83c" stroke="#0b1014" stroke-width="3" paint-order="stroke">WILD</text>`),
  S: svg(`<rect x="10" y="12" width="80" height="76" rx="8" fill="#2a2116" stroke="#ad7840" stroke-width="6"/><rect x="18" y="20" width="64" height="60" rx="4" fill="#15110b" stroke="#eda83c55" stroke-width="2"/><text x="50" y="64" font-family="Anton, Impact, 'Arial Black', sans-serif" font-size="40" text-anchor="middle" fill="#efe5cf" stroke="#0b1014" stroke-width="3" paint-order="stroke">FS</text>`),
};
// The vent's spout: a straight nozzle, opening at the top, base at the bottom
// (256 x 320, as vent-spout.webp). ventHTML turns it toward the outlet.
export const SPOUT_SVG = `<svg viewBox="0 0 80 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="17" y="30" width="46" height="62" fill="#8b8f8f" stroke="#0b1014" stroke-width="3"/><rect x="24" y="34" width="8" height="54" fill="#d5d8d6" opacity=".55"/><rect x="11" y="84" width="58" height="14" rx="3" fill="#ad7840" stroke="#0b1014" stroke-width="3"/><rect x="7" y="12" width="66" height="24" rx="5" fill="#ad7840" stroke="#0b1014" stroke-width="3"/><ellipse cx="40" cy="13" rx="29" ry="8" fill="#68c8c3" stroke="#0b1014" stroke-width="3"/></svg>`;

const available = new Map();
// Checks once which art files exist, so placeholders fill only the gaps.
export async function loadArt(base = 'assets/symbols/') {
  await Promise.all(Object.entries(ART).map(async ([id, file]) => {
    const url = `${base}${file}.webp`;
    const ok = await new Promise((resolve) => { const img = new Image(); img.onload = () => resolve(true); img.onerror = () => resolve(false); img.src = url; });
    if (ok) available.set(id, url);
  }));
  const letters = `${base}scatter-letters.webp`;
  if (await new Promise((resolve) => { const img = new Image(); img.onload = () => resolve(true); img.onerror = () => resolve(false); img.src = letters; })) available.set('S-letters', letters);
  const spout = `${base}vent-spout.webp`;
  if (await new Promise((resolve) => { const img = new Image(); img.onload = () => resolve(true); img.onerror = () => resolve(false); img.src = spout; })) available.set('spout', spout);
  return available.size;
}
export function symbolHTML(id) {
  if (!available.has(id)) return PLACEHOLDER[id] || '';
  const img = `<img src="${available.get(id)}" alt="" draggable="false">`;
  // The FS lettering is its own layer over the plate, so it can animate apart.
  return id === 'S' && available.has('S-letters') ? `<span class="scatter-stack">${img}<img class="scatter-letters" src="${available.get('S-letters')}" alt="" draggable="false"></span>` : img;
}
// The spinning filler as one image: the symbols drawn once, top to bottom,
// into a strip of 200 px cells, so a spinning reel moves one element instead
// of dozens of cells. Drawn as the cells look: painted art scaled 1.12 with
// its drop shadow, placeholders with their lettering in the game's font.
// Resolves to an object URL, or null if the browser will not draw it.
export async function fillerStrip(ids, k = 1.5) {
  try {
    await document.fonts.load('56px Anton');
    const c = document.createElement('canvas');
    c.width = 200 * k; c.height = 200 * k * ids.length;
    const g = c.getContext('2d'), art = new Map();
    for (const id of new Set(ids)) art.set(id, await symbolArt(id));
    ids.forEach((id, n) => {
      const { img, texts, painted } = art.get(id);
      g.setTransform(k, 0, 0, k, 0, n * 200 * k);
      if (painted) {
        g.save(); g.shadowColor = '#000c'; g.shadowBlur = 7 * k; g.shadowOffsetY = 7 * k;
        g.drawImage(img, 100 - 98.56, 100 - 98.56, 197.12, 197.12); g.restore();
        return;
      }
      g.drawImage(img, 12, 12, 176, 176);
      for (const t of texts) {
        g.font = `${t.size * 1.76}px Anton, Impact, 'Arial Black', sans-serif`; g.textAlign = 'center';
        g.lineWidth = t.stroke * 1.76; g.strokeStyle = t.strokeColor; g.fillStyle = t.fill;
        g.strokeText(t.text, 12 + t.x * 1.76, 12 + t.y * 1.76); g.fillText(t.text, 12 + t.x * 1.76, 12 + t.y * 1.76);
      }
    });
    const blob = await new Promise((resolve) => c.toBlob(resolve, 'image/webp', 0.9));
    return blob ? URL.createObjectURL(blob) : null;
  } catch { return null; }
}
// One symbol as an image: the painted file, or the placeholder SVG without
// its <text> (an SVG drawn as an image cannot use the page's fonts), with the
// text returned to be drawn on the canvas.
async function symbolArt(id) {
  const painted = available.has(id), texts = [];
  let src = available.get(id);
  if (!painted) {
    const markup = (PLACEHOLDER[id] || svg('')).replace(/<text ([^>]*)>([^<]*)<\/text>/g, (_, attrs, text) => {
      const a = Object.fromEntries([...attrs.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
      texts.push({ text, x: +a.x, y: +a.y, size: +a['font-size'], fill: a.fill, strokeColor: a.stroke, stroke: +a['stroke-width'] || 0 });
      return '';
    });
    src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  }
  const img = new Image();
  img.src = src;
  await img.decode();
  return { img, texts, painted };
}
// A vent on a symbol: the symbol keeps its size and gets an outline
// (styles.css), and the spout stands on the outlet edge, pointing out:
// dir 0 up, 1 right, 2 down, 3 left. In a reel it pops out once the reel lands.
export function ventHTML(dir) {
  const body = available.has('spout') ? `<img src="${available.get('spout')}" alt="" draggable="false">` : SPOUT_SVG;
  return `<span class="vent-art" data-dir="${dir}" style="--turn:${[0, 90, 180, 270][dir]}deg"><span class="spout">${body}</span></span>`;
}
