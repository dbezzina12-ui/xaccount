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
// The vent overlay: inlet on the left, outlet pointing up (rotated per outlet).
export const VENT_SVG = svg(`<path d="M6 60 H38 Q58 60 58 40 V6" fill="none" stroke="#0b1014" stroke-width="30" stroke-linecap="butt"/><path d="M6 60 H38 Q58 60 58 40 V6" fill="none" stroke="#8d6638" stroke-width="22"/><path d="M6 56 H38 Q54 56 54 40 V6" fill="none" stroke="#d9a35d" stroke-width="5" opacity=".7"/><rect x="40" y="2" width="36" height="10" rx="3" fill="#ad7840" stroke="#0b1014" stroke-width="3"/><rect x="2" y="44" width="10" height="32" rx="3" fill="#ad7840" stroke="#0b1014" stroke-width="3"/><ellipse cx="58" cy="7" rx="12" ry="3.5" fill="#68c8c3"/>`);

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
  const vent = `${base}vent.webp`;
  if (await new Promise((resolve) => { const img = new Image(); img.onload = () => resolve(true); img.onerror = () => resolve(false); img.src = vent; })) available.set('vent', vent);
  return available.size;
}
export function symbolHTML(id) {
  if (!available.has(id)) return PLACEHOLDER[id] || '';
  const img = `<img src="${available.get(id)}" alt="" draggable="false">`;
  // The FS lettering is its own layer over the plate, so it can animate apart.
  return id === 'S' && available.has('S-letters') ? `<span class="scatter-stack">${img}<img class="scatter-letters" src="${available.get('S-letters')}" alt="" draggable="false"></span>` : img;
}
export function ventHTML(dir) {
  const rotate = [0, 90, 180, 270][dir];
  const body = available.has('vent') ? `<img src="${available.get('vent')}" alt="" draggable="false">` : VENT_SVG;
  return `<span class="vent-art" style="--turn:${rotate}deg">${body}</span>`;
}
