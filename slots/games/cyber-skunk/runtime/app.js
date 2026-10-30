// Cyber Skunk: the playable game. The engine settles each round before
// anything moves (playRound returns its total and every event); this file only
// presents those events, so skip, turbo and frame timing never change a result.
import { playRound, seeded, at } from './engine.js';
import { drawRound, CATALOG_VERSION } from './catalog.js';
import { REELS, ROWS, CELLS, LINES, PAYTABLE, NAMES, MODES, BONUSES, CAP, RETRIGGER, MAX_SPINS, MAX_STICKY, MAX_RESERVOIR, triggerRates } from './rules.js';
import { loadArt, symbolHTML, ventHTML, fillerStrip } from './symbols.js';
import { mountController } from './controller/controller.js';
import { GameAudio } from './audio.js';
import { Skunk } from './rig.js';

const $ = (id) => document.getElementById(id);
const app = $('app'), stage = $('stage');
const KEY = 'cyber-skunk-session-v1', START = 1_000_000;
// Base bets in cents. Every one is a multiple of 10, so every 0.1x win is whole cents.
const STAKES = [10, 20, 40, 60, 80, 100, 150, 200, 300, 400, 500, 1000, 2000, 5000, 10000];
const money = (cents) => '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const payOf = (hundredths) => Math.round((state.bet * hundredths) / 100); // engine pays are hundredths of the base bet
const xOf = (hundredths) => `${(hundredths / 100).toLocaleString('en-US', { maximumFractionDigits: 1 })}×`;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

// What each paid mode is, in the buy menu's words. Prices and rates come from rules.js.
const oneIn = (p) => `1 in ${Math.round(1 / p).toLocaleString('en-US')}`;
const BASE_RATES = triggerRates('base'), BOOST_RATES = triggerRates(MODES.enhanced.land);
const COPY = {
  enhanced: { name: 'SIGNAL BOOST', card: 'card-signal-boost', kind: 'feature', text: `FS scatters land more often: Vent Break about ${oneIn(BOOST_RATES.regular)} spins (${oneIn(BASE_RATES.regular)} in base), Overpressure ${oneIn(BOOST_RATES.super)} (${oneIn(BASE_RATES.super)}). Same pays and rules. Stays on until you switch it off.` },
  sprayjob: { name: 'SPRAY JOB', card: 'card-spray-job', kind: 'feature', text: 'Every spin lands a vent on reel 1 and at least 3 vents in all, so Cyber Skunk sprays on every spin. Stays on until you switch it off.' },
  ventbreak: { name: 'VENT BREAK', card: 'card-vent-break', kind: 'buy', text: `${BONUSES.regular.spins} free spins. Every vent that lands stays (up to ${MAX_STICKY}), so the route grows into a maze, and a small Reservoir banks pressure up to ${BONUSES.regular.reservoirMax}.` },
  overpressure: { name: 'OVERPRESSURE', card: 'card-overpressure', kind: 'buy', text: `${BONUSES.super.spins} free spins with sticky vents and the Reservoir: each route banks its pressure gain, and every later route starts higher.` },
};
const TIER = {
  regular: { panel: 'panel-vent-break', text: `${BONUSES.regular.spins} FREE SPINS · STICKY VENTS` },
  super: { panel: 'panel-overpressure', text: `${BONUSES.super.spins} FREE SPINS · STICKY VENTS · RESERVOIR` },
  hidden: { panel: 'panel-blackout', text: `${BONUSES.hidden.spins} FREE SPINS · 4-VENT OPENING · RESERVOIR STARTS AT ${BONUSES.hidden.reservoirStart}` },
};
// Win tiers from the round's actual award, in base bets (STYLE.md).
const WIN_TIERS = [[500, 'MYTHIC WIN'], [100, 'EPIC WIN'], [25, 'BIG WIN'], [10, 'NICE WIN']];

let saved = null;
try { saved = JSON.parse(localStorage.getItem(KEY)); } catch { /* a private window starts fresh */ }
const level = (v, d) => (Number.isFinite(v) && v >= 0 && v <= 100 ? v : d);
const state = {
  balance: Number.isSafeInteger(saved?.balance) && saved.balance >= 0 ? saved.balance : START,
  bet: STAKES.includes(saved?.bet) ? saved.bet : 100,
  feature: null, // 'enhanced' | 'sprayjob' while a persistent mode is on
  speed: ['normal', 'quick', 'turbo'].includes(saved?.speed) ? saved.speed : 'normal',
  muted: !!saved?.muted, music: level(saved?.music, 60), effects: level(saved?.effects, 80), introHidden: !!saved?.introHidden,
  history: Array.isArray(saved?.history) ? saved.history.slice(0, 30) : [],
  busy: false, ready: false, auto: 0, skip: false, win: 0, debit: 0, tier: null,
  pending: null, // the round being shown: already decided, saved so a reload cannot lose its win
};
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify({ balance: state.balance, bet: state.bet, speed: state.speed, muted: state.muted, music: state.music, effects: state.effects, history: state.history, introHidden: state.introHidden, pending: state.pending })); } catch { /* storage is optional */ }
}
// A round the page closed on mid-presentation is paid on the next visit.
const resumed = saved?.pending && Number.isSafeInteger(saved.pending.win) && saved.pending.win >= 0 ? saved.pending : null;
if (resumed) { state.balance += resumed.win; state.history.unshift(resumed); state.history.length = Math.min(state.history.length, 30); persist(); }

const audio = new GameAudio();
audio.setMuted(state.muted); audio.setLevels(state.music / 100, state.effects / 100);
const skunk = new Skunk($('mascot'));

const controller = mountController($('controller'), {
  initial: { balance: money(state.balance), bet: money(state.bet), win: money(0) },
  layoutTargets: { desktop: $('machine'), mobile: app },
  onAction: act,
});
function update() {
  const cost = state.bet * MODES[state.feature || 'base'].cost;
  controller.update({
    ready: state.ready, busy: state.busy, autoActive: state.auto > 0, remaining: state.auto,
    balance: money(state.balance), bet: money(cost), win: money(state.win),
    turbo: state.speed === 'turbo', muted: state.muted, buyActive: !!state.feature,
    featureColor: state.feature === 'sprayjob' ? '#68c8c3' : state.feature === 'enhanced' ? '#eda83c' : null,
    canDecrease: !state.busy && STAKES.indexOf(state.bet) > 0, canIncrease: !state.busy && STAKES.indexOf(state.bet) < STAKES.length - 1,
  });
  app.dataset.feature = state.feature || '';
  if (!state.busy) status(state.feature ? `${COPY[state.feature].name} ON · ${MODES[state.feature].cost}× PER SPIN` : 'PRESSURE IS BUILDING');
}
const status = (text) => { $('status').textContent = text; };
let toastTimer = 0;
function toast(text) { const t = $('toast'); t.textContent = text; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3200); }

// ---- Layout: one design size per layout, scaled as a whole. ----
const MOBILE_MIN_H = 1560; // header 480 + cabinet 892 + the shortest console
function fit() {
  const w = innerWidth, h = innerHeight, layout = h > w * 1.05 ? 'mobile' : 'desktop';
  app.dataset.layout = layout;
  const host = $('controller'), reserve = host.parentElement === app ? host.getBoundingClientRect().height : 0;
  // A phone's stage is 1080 wide and as tall as the room above the controller
  // (at least MOBILE_MIN_H), so the machine reaches down to the controller.
  let [W, H] = layout === 'mobile' ? [1080, MOBILE_MIN_H] : [1920, 1080];
  const s = Math.min(w / W, (h - reserve) / H);
  if (layout === 'mobile') { H = Math.max(MOBILE_MIN_H, Math.round((h - reserve) / s)); stage.style.setProperty('--stage-h', `${H}px`); }
  app.toggleAttribute('data-short', layout === 'mobile' && H < 1640); // no room for the bonus ladder in the console
  const x = (w - W * s) / 2, y = (h - reserve - H * s) / 2;
  stage.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
  state.scale = s;
  if (jet.width !== W || jet.height !== H) { jet.width = W; jet.height = H; }
  skunk.resize(s);
}
addEventListener('resize', () => requestAnimationFrame(fit));
new ResizeObserver(() => fit()).observe($('controller'));

// ---- Reels ----
const reels = [];
let board = [];
const FILL = ['H1', 'H2', 'H3', 'H4', 'A', 'K', 'Q', 'J', 'T', 'A', 'K', 'Q', 'J', 'T', 'W'];
const filler = () => ({ s: FILL[Math.floor(Math.random() * FILL.length)] }); // presentation only, never the result
// The same symbols drawn once into one strip image (see fillerStrip): a spin
// then lays out one element per reel for the blur, not dozens of cells.
const STRIP = [...FILL].sort(() => Math.random() - 0.5);
let stripReady = false;
const fillerHTML = (n) => (stripReady
  ? `<div class="filler" style="height:${n * 200}px;background-position:0 ${-200 * Math.floor(Math.random() * STRIP.length)}px"></div>`
  : Array.from({ length: n }, () => cellHTML(filler())).join(''));
const cellHTML = (c, i = -1) => `<div class="cell${c.sticky ? ' sticky' : ''}"${i >= 0 ? ` data-i="${i}"` : ''}><span class="sym">${symbolHTML(c.s)}</span>${c.vent !== undefined ? ventHTML(c.vent) : ''}</div>`;
function buildReels() {
  for (let reel = 0; reel < REELS; reel++) {
    const el = document.createElement('div'), strip = document.createElement('div');
    el.className = 'reel'; strip.className = 'strip'; el.append(strip); $('reels').append(el);
    reels.push({ el, strip });
  }
}
const column = (cells, reel) => Array.from({ length: ROWS }, (_, row) => cells[at(row, reel)]);
function setBoard(cells) {
  board = cells;
  reels.forEach(({ strip }, reel) => { strip.getAnimations().forEach((a) => a.cancel()); strip.style.transform = ''; strip.innerHTML = column(cells, reel).map((c, row) => cellHTML(c, at(row, reel))).join(''); });
}
const cellEl = (i) => $('reels').querySelector(`.cell[data-i="${i}"]`);
const running = new Set();
const pace = () => (state.skip ? 0 : state.speed === 'turbo' || reduced.matches ? 0.35 : state.speed === 'quick' ? 0.65 : 1);

// Spins every reel to the landed board. Reels stop left to right; with two
// scatters down and a bonus still possible, the remaining reels tease longer.
async function spinTo(cells, { canTrigger }) {
  audio.play('spin');
  const speed = pace(), perCell = 55, scatters = [];
  let seen = 0;
  const stops = reels.map(({ el, strip }, reel) => {
    const tease = canTrigger && seen >= 2 && speed > 0;
    if (column(cells, reel).some((c) => c.s === 'S')) scatters.push(reel), seen++;
    const dur = speed === 0 ? 0 : (520 + reel * 150) * speed + (tease ? 1100 * Math.max(speed, 0.6) : 0);
    const old = column(board.length ? board : cells, reel), next = column(cells, reel);
    const extra = Math.max(3, Math.round(dur / perCell));
    strip.innerHTML = [...next.map((c, row) => cellHTML(c, at(row, reel))), fillerHTML(extra), ...old.map((c) => cellHTML(c))].join('');
    const dist = (ROWS + extra) * 200;
    if (!dur) return { reel, tease, done: Promise.resolve() };
    el.classList.add('spinning'); if (tease) el.classList.add('tease');
    const anim = strip.animate([
      { transform: `translateY(${-dist}px)`, easing: 'cubic-bezier(.35,0,.65,1)' },
      { transform: 'translateY(18px)', offset: 0.93, easing: 'ease-out' },
      { transform: 'translateY(0)' },
    ], { duration: dur, fill: 'forwards' });
    running.add(anim);
    setTimeout(() => el.classList.remove('spinning'), dur * 0.82);
    return { reel, tease, done: anim.finished.catch(() => {}).then(() => running.delete(anim)) };
  });
  let teased = false;
  for (const { reel, tease, done } of stops) {
    if (tease && !teased) { teased = true; audio.play('tease'); skunk.play('anticipate'); status('ONE MORE…'); }
    await done;
    reels[reel].el.classList.remove('spinning', 'tease');
    const sc = column(cells, reel).some((c) => c.s === 'S');
    audio.play(sc ? 'scatter' : 'stop', { index: sc ? scatters.indexOf(reel) : reel });
    if (sc) column(cells, reel).forEach((c, row) => { if (c.s === 'S') cellEl(at(row, reel))?.classList.add('scatter-hit'); });
    if (column(cells, reel).some((c) => c.vent !== undefined && !c.sticky)) audio.play('vent-land');
  }
  if (teased) audio.play(scatters.length >= 3 ? 'tease-hit' : 'tease-miss');
  setBoard(cells);
}

// ---- Effects canvas (the reel window, 1200 x 800) ----
const fxCanvas = $('fx'), fx = fxCanvas.getContext('2d');
const center = (i) => [(i % REELS) * 200 + 100, Math.floor(i / REELS) * 200 + 100];
const effects = { trail: [], head: null, particles: [], lines: [], raf: 0, flash: 0 };
function drawFx() {
  fx.clearRect(0, 0, 1200, 800);
  const { trail, particles, lines } = effects;
  if (lines.length) {
    fx.lineCap = 'round'; fx.lineJoin = 'round';
    for (const l of lines) {
      fx.strokeStyle = '#1b120acc'; fx.lineWidth = 16; stroke(l.points);
      fx.strokeStyle = l.color; fx.lineWidth = 7; fx.shadowColor = l.color; fx.shadowBlur = 18; stroke(l.points); fx.shadowBlur = 0;
    }
  }
  if (trail.length > 1) {
    fx.lineCap = 'round'; fx.lineJoin = 'round';
    fx.strokeStyle = '#68c8c344'; fx.lineWidth = 46; stroke(trail);
    fx.strokeStyle = '#9ff0ea'; fx.lineWidth = 16; fx.shadowColor = '#68c8c3'; fx.shadowBlur = 30; stroke(trail); fx.shadowBlur = 0;
    fx.strokeStyle = '#ffffffcc'; fx.lineWidth = 4; stroke(trail);
  }
  for (const p of particles) {
    p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.life -= 1;
    fx.globalAlpha = Math.max(0, p.life / p.max) * 0.85;
    const size = p.r * (1.6 - p.life / p.max);
    if (p.sprite?.complete) { fx.save(); fx.translate(p.x, p.y); fx.rotate(p.spin + p.life * 0.05); fx.drawImage(p.sprite, -size * 3, -size * 3, size * 6, size * 6); fx.restore(); }
    else { fx.fillStyle = p.color; fx.beginPath(); fx.arc(p.x, p.y, size, 0, Math.PI * 2); fx.fill(); }
  }
  fx.globalAlpha = 1;
  effects.particles = particles.filter((p) => p.life > 0);
  if (effects.flash > 0) { fx.fillStyle = `rgba(104,200,195,${effects.flash})`; fx.fillRect(0, 0, 1200, 800); effects.flash = Math.max(0, effects.flash - 0.04); }
  effects.raf = trail.length || lines.length || effects.particles.length || effects.flash ? requestAnimationFrame(drawFx) : 0;
}
function stroke(points) { fx.beginPath(); points.forEach(([x, y], k) => (k ? fx.lineTo(x, y) : fx.moveTo(x, y))); fx.stroke(); }
const kick = () => { if (!effects.raf) effects.raf = requestAnimationFrame(drawFx); };
function burst(x, y, n = 18, color = '#9ff0ea') {
  if (reduced.matches) n = Math.ceil(n / 3);
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2, v = 1 + Math.random() * 4;
    effects.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, r: 4 + Math.random() * 8, life: 26 + Math.random() * 20, max: 46, color, sprite: color === '#eda83c' ? fxSprites.spark : fxSprites.mist, spin: Math.random() * 6 });
  }
  kick();
}
function clearFx() { effects.trail = []; effects.lines = []; kick(); }

// ---- Delays that respect skip, speed, an open menu and a hidden tab ----
async function wait(ms, { always = false } = {}) {
  let left = ms * (always ? 1 : pace()), last = performance.now();
  while (left > 0) {
    await new Promise((r) => setTimeout(r, Math.min(40, left)));
    const now = performance.now();
    if (!document.hidden && !$('menu').open && !$('rules').open) left -= state.skip && !always ? left : now - last;
    last = now;
  }
}

// ---- The jet: from the skunk's nozzle, over the cabinet, onto the first vent ----
const jet = $('jet'), jg = jet.getContext('2d');
// A point on screen to stage design pixels.
function toStage(cx, cy) { const r = stage.getBoundingClientRect(); return [(cx - r.left) / state.scale, (cy - r.top) / state.scale]; }
async function sprayJet(i) {
  const tip = skunk.nozzle(), box = $('mascot').getBoundingClientRect(), cell = cellEl(i)?.getBoundingClientRect();
  if (!tip || !cell || pace() === 0) return;
  const [x0, y0] = toStage(box.left + tip[0] * box.width, box.top + tip[1] * box.height), [x1, y1] = toStage(cell.left + cell.width / 2, cell.top + cell.height / 2);
  const cx = (x0 + x1) / 2, cy = Math.min(y0, y1) - 220; // an arc over the cabinet's top
  const point = (t) => [(1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x1, (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t * t * y1];
  const grow = 260 * pace(), hold = 420 * pace(), t0 = performance.now(), drops = [];
  await new Promise((resolve) => {
    const frame = () => {
      const t = performance.now() - t0, head = Math.min(1, t / grow), fade = t > grow ? Math.max(0, 1 - (t - grow) / hold) : 1, tail = t > grow ? Math.min(head, (t - grow) / hold) : 0;
      jg.clearRect(0, 0, jet.width, jet.height);
      jg.lineCap = 'round';
      for (const [width, color, blur] of [[34, '#68c8c333', 0], [14, '#9ff0ea', 26], [4, '#ffffffdd', 0]]) {
        jg.beginPath(); for (let k = 0; k <= 32; k++) { const u = tail + (head - tail) * (k / 32), [px, py] = point(u); k ? jg.lineTo(px, py) : jg.moveTo(px, py); }
        jg.strokeStyle = color; jg.lineWidth = width * (0.6 + 0.4 * fade); jg.shadowColor = '#68c8c3'; jg.shadowBlur = blur; jg.stroke();
      }
      jg.shadowBlur = 0;
      if (!reduced.matches && head < 1) for (let k = 0; k < 3; k++) { const [px, py] = point(head * Math.random()); drops.push({ x: px, y: py, vx: (Math.random() - 0.5) * 3, vy: Math.random() * 2, life: 30 }); }
      for (const d of drops) {
        d.x += d.vx; d.y += d.vy; d.vy += 0.12; d.life--; jg.globalAlpha = Math.max(0, d.life / 30) * 0.8;
        if (fxSprites.droplet?.complete) jg.drawImage(fxSprites.droplet, d.x - 9, d.y - 9, 18, 18); else { jg.fillStyle = '#bff7f2'; jg.beginPath(); jg.arc(d.x, d.y, 3, 0, Math.PI * 2); jg.fill(); }
      }
      jg.globalAlpha = 1;
      if (t < grow + hold && !state.skip) requestAnimationFrame(frame); else { jg.clearRect(0, 0, jet.width, jet.height); resolve(); }
      if (head >= 1 && !frame.hit) { frame.hit = true; const [ex, ey] = center(i); burst(ex, ey, 30); effects.flash = 0.18; kick(); }
    };
    requestAnimationFrame(frame);
  });
}

// ---- The spray: route cue, mascot spray, cell-by-cell trail ----
async function showSpray(e) {
  const entry = e.path[0];
  status(e.startPressure > 1 ? `RESERVOIR PRESSURE ${e.startPressure}` : 'VENT ONLINE');
  cellEl(entry.i)?.classList.add('entry');
  audio.play('charge');
  if (pace() > 0) await skunk.spray(); // resolves when the nozzle releases
  audio.play('spray');
  await sprayJet(entry.i);
  effects.trail = [center(entry.i)]; kick();
  const stepMs = 150;
  for (const step of e.path) {
    const [x, y] = center(step.i);
    if (step !== entry) effects.trail.push([x, y]);
    paintCell(step.i, step.vent ? step.pressure : 1, step.vent);
    if (step.vent) { audio.play('vent', { pressure: step.pressure }); burst(x, y, 16, '#eda83c'); status(`PRESSURE ×${step.pressure}`); }
    else audio.play('paint', { k: e.path.indexOf(step) });
    await wait(step.vent ? stepMs * 1.8 : stepMs);
  }
  skunk.play('recoil');
  await wait(260);
  effects.trail = []; kick();
}
// A touched cell turns wild; a vent shows its xN. Scatters stay scatters.
function paintCell(i, multi, vent) {
  const el = cellEl(i);
  if (!el || board[i]?.s === 'S') return;
  el.classList.add('wild');
  el.querySelector('.sym').innerHTML = symbolHTML('W');
  if (vent && multi >= 2) { el.querySelector('.badge')?.remove(); el.insertAdjacentHTML('beforeend', `<span class="badge">×${multi}</span>`); }
}

// ---- Wins ----
async function showWins(e) {
  if (!e.wins.length) return;
  const hit = new Set();
  effects.lines = e.wins.map((w) => {
    const pts = [];
    for (let reel = 0; reel < w.count; reel++) { const i = at(LINES[w.line][reel], reel); hit.add(i); pts.push(center(i)); }
    return { points: [[pts[0][0] - 100, pts[0][1]], ...pts], color: w.multi > 1 ? '#68c8c3' : '#eda83c' };
  });
  kick();
  for (let i = 0; i < CELLS; i++) cellEl(i)?.classList.add(hit.has(i) ? 'win' : 'dim');
  const amount = payOf(e.paid);
  audio.play(e.paid >= 1000 ? 'win-big' : 'win', { size: e.paid });
  if (e.paid >= 500) skunk.play('win');
  const best = e.wins.reduce((a, b) => (b.amount > a.amount ? b : a));
  status(e.wins.length === 1 ? `${best.count} × ${NAMES[best.symbol].toUpperCase()}${best.multi > 1 ? ` ×${best.multi}` : ''} · ${money(amount)}` : `${e.wins.length} LINES · ${money(amount)}`);
  await countTo(state.win + amount, Math.min(1400, 400 + e.paid));
  await wait(e.wins.length > 1 ? 900 : 650);
  for (let i = 0; i < CELLS; i++) cellEl(i)?.classList.remove('win', 'dim');
  effects.lines = []; kick();
}
// Counts the visible win up to a value; skip jumps straight there.
async function countTo(target, ms) {
  const from = state.win, t0 = performance.now(), dur = ms * pace();
  while (dur > 0 && !state.skip) {
    const k = Math.min(1, (performance.now() - t0) / dur);
    state.win = Math.round(from + (target - from) * k); paintWin();
    if (k >= 1) break;
    await new Promise((r) => requestAnimationFrame(r));
  }
  state.win = target; paintWin();
}
const paintWin = () => { controller.update({ win: money(state.win) }); if (state.tier) $('hud-win').textContent = money(state.win); };

// ---- Bonuses ----
function panel({ kicker, title, text, html = null, button = 'CONTINUE', tier }) {
  const el = $('bonus-panel');
  $('bonus-panel-kicker').textContent = kicker; $('bonus-panel-title').textContent = title;
  if (html) $('bonus-panel-text').innerHTML = html; else $('bonus-panel-text').textContent = text;
  $('bonus-panel-go').textContent = button; el.dataset.tier = tier || ''; el.hidden = false;
  $('bonus-panel-go').focus({ preventScroll: true });
  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (done) return; done = true; el.hidden = true; $('bonus-panel-go').onclick = null; panelSkip = null; audio.play('click'); resolve(); };
    $('bonus-panel-go').onclick = finish;
    panelSkip = finish;
    if (state.skip || state.auto) setTimeout(finish, state.skip ? 250 : 2600);
  });
}
let panelSkip = null;
async function bonusStart(e) {
  state.tier = e.tier;
  if (e.natural) { status(`${BONUSES[e.tier].scatters}${e.tier === 'hidden' ? '+' : ''} FS SCATTERS`); await wait(700); }
  audio.play('bonus-in', { tier: e.tier }); audio.music(e.tier === 'hidden' ? 'hidden' : 'bonus');
  skunk.play('bonus');
  await panel({ kicker: e.natural ? 'TRIGGERED' : 'BONUS BUY', title: BONUSES[e.tier].title, text: TIER[e.tier].text, button: 'START', tier: e.tier });
  app.dataset.bonus = e.tier;
  $('bonus-hud').hidden = false; $('hud-tier').textContent = BONUSES[e.tier].title;
  hud(0, e.spins); gauge(e.reservoir);
}
const hud = (spin, of) => { $('hud-spins').textContent = `${spin} / ${of}`; $('hud-win').textContent = money(state.win); };
function gauge(value) { app.style.setProperty('--p', value); $('gauge-value').textContent = value; }
async function blackout(e) {
  app.dataset.blackout = '';
  audio.music('blackout'); audio.play('blackout'); status('BLACKOUT PROTOCOL');
  await wait(900);
  const cells = board.length ? board.map((c) => ({ s: c.s })) : Array.from({ length: CELLS }, filler);
  for (const v of e.vents) cells[v.i] = { ...cells[v.i], vent: v.dir, sticky: true };
  setBoard(cells);
  for (const v of e.vents) {
    const el = cellEl(v.i); el?.classList.add('online');
    audio.play('vent', { pressure: 2 + e.vents.indexOf(v) }); burst(...center(v.i), 14);
    await wait(420);
  }
  delete app.dataset.blackout;
  effects.flash = 0.5; kick();
  audio.play('release'); audio.music('hidden'); skunk.play('release'); steam(); gauge(e.reservoir); status(`RESERVOIR ${e.reservoir}`);
  await wait(600);
}
async function bonusEnd(e) {
  audio.music('base');
  await wait(400);
  const total = money(payOf(e.total)), titleArt = artImg('title-total-win', 'Total win');
  await panel({ kicker: `${e.played} SPINS PLAYED`, title: `${BONUSES[e.tier].title} COMPLETE`, text: `TOTAL WIN ${total}`, html: titleArt ? `${titleArt}<b class="panel-amount">${total}</b>` : null, tier: e.tier });
  delete app.dataset.bonus; $('bonus-hud').hidden = true; state.tier = null; gauge(0);
  setBoard(board.map((c) => ({ s: c.s })));
}

// A banner over the reels (EXTRA SPINS): the art when it exists, the live number under it.
async function banner(text) {
  const el = $('reel-banner');
  el.innerHTML = `${artImg('banner-extra-spins', 'Extra spins') || '<span class="banner-word">EXTRA SPINS</span>'}<b>${text}</b>`;
  el.hidden = false; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  await wait(1300);
  el.hidden = true;
}
// Steam from the gauge's valve when the Reservoir changes.
function steam() {
  const el = document.createElement('i'); el.className = 'steam';
  document.querySelector('.gauge').append(el); setTimeout(() => el.remove(), 1400);
}

// The big-win celebration, from the round's actual award and the cap.
async function celebrate(total, capped) {
  const x = total / 100, tier = capped ? 'MAX WIN' : WIN_TIERS.find(([min]) => x >= min)?.[1];
  if (!tier) return;
  const el = $('bigwin'), amount = payOf(total), key = tier.split(' ')[0].toLowerCase(), level = ['nice', 'big', 'epic', 'mythic', 'max'].indexOf(key);
  $('bigwin-title').innerHTML = artImg(`win-${key}`, tier) || tier;
  el.dataset.tier = key; $('bigwin-amount').textContent = money(0); el.hidden = false;
  audio.duck(true); audio.play(capped ? 'max' : 'bigwin', { tier }); skunk.play('bigwin');
  if (level >= 2 && !reduced.matches) { stage.classList.remove('shake'); void stage.offsetWidth; stage.classList.add('shake'); }
  const stop = fountain(level);
  const dur = (capped ? 5200 : x >= 500 ? 4200 : x >= 100 ? 3200 : x >= 25 ? 2400 : 1600) * pace(), t0 = performance.now();
  while (!state.skip && performance.now() - t0 < dur) {
    const k = (performance.now() - t0) / dur;
    $('bigwin-amount').textContent = money(Math.round(amount * (1 - (1 - k) ** 2)));
    await new Promise((r) => requestAnimationFrame(r));
  }
  $('bigwin-amount').textContent = money(amount);
  await wait(1100);
  stop(); stage.classList.remove('shake');
  el.hidden = true; audio.duck(false);
}
// The big-win fountain: brass nuts, amber sparks and spray droplets thrown up
// from the cabinet, more for each tier. Its own screen-sized canvas sits in the
// big-win overlay, above the darkening and behind the title.
function fountain(level) {
  if (reduced.matches) return () => {};
  const canvas = $('bigwin-fx'), dpr = Math.min(2, devicePixelRatio || 1), W = innerWidth, H = innerHeight;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  const g = canvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const box = $('cabinet').getBoundingClientRect(), cx = box.left + box.width / 2, cy = box.top + box.height * 0.6;
  const u = H / 1080, size = Math.min(1.2, Math.max(0.6, state.scale * 1.4)), rate = [2, 4, 6, 9, 12][level], bits = [];
  let running = true, last = performance.now();
  const spawn = () => {
    for (let k = 0; k < rate; k++) {
      const kind = Math.random(), a = -Math.PI / 2 + (Math.random() - 0.5) * 1.2, v = (17 + Math.random() * 13) * u;
      bits.push({ x: cx + (Math.random() - 0.5) * box.width * 0.4, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: (kind < 0.45 ? 12 + Math.random() * 9 : 4 + Math.random() * 5) * size, spin: Math.random() * 6, vs: (Math.random() - 0.5) * 0.4, type: kind < 0.45 ? 'nut' : kind < 0.8 ? 'spark' : 'drop' });
    }
  };
  const nut = (b) => {
    g.save(); g.translate(b.x, b.y); g.rotate(b.spin);
    g.beginPath(); for (let i = 0; i < 6; i++) { const t = (i / 6) * Math.PI * 2; g.lineTo(Math.cos(t) * b.r, Math.sin(t) * b.r); } g.closePath();
    const grad = g.createLinearGradient(-b.r, -b.r, b.r, b.r); grad.addColorStop(0, '#f3c77a'); grad.addColorStop(0.5, '#ad7840'); grad.addColorStop(1, '#5a3a17');
    g.fillStyle = grad; g.fill(); g.lineWidth = 1.5; g.strokeStyle = '#2b1a0a'; g.stroke();
    g.beginPath(); g.arc(0, 0, b.r * 0.42, 0, Math.PI * 2); g.fillStyle = '#1b120a'; g.fill();
    g.restore();
  };
  const frame = (now) => {
    const dt = Math.min(2, (now - last) / 16.7); last = now;
    g.clearRect(0, 0, W, H);
    if (running) spawn();
    for (const b of bits) {
      b.vy += 0.55 * u * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.spin += b.vs * dt;
      if (b.type === 'nut') nut(b);
      else { g.globalAlpha = b.type === 'spark' ? 0.95 : 0.8; g.fillStyle = b.type === 'spark' ? '#ffd27a' : '#bff7f2'; g.beginPath(); g.arc(b.x, b.y, b.r, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; }
    }
    for (let i = bits.length - 1; i >= 0; i--) if (bits[i].y > H + 60) bits.splice(i, 1);
    if (running || bits.length) requestAnimationFrame(frame); else g.clearRect(0, 0, W, H);
  };
  requestAnimationFrame(frame);
  return () => { running = false; };
}

// ---- A round ----
async function play(mode = state.feature || 'base') {
  if (state.busy || !state.ready) return;
  const cost = state.bet * MODES[mode].cost;
  if (cost > state.balance) { state.auto = 0; update(); toast(`Not enough credits: this play costs ${money(cost)}.`); return; }
  // The round is drawn and replayed before any credits move; a replay that
  // disagrees with the catalog is refused and costs nothing.
  let result;
  try { result = drawRound(mode); } catch (err) { console.error(err); state.auto = 0; update(); toast('That round could not be verified, so it was not played. Nothing was charged.'); return; }
  state.busy = true; state.skip = false; state.win = 0; state.debit = cost;
  state.balance -= cost;
  state.pending = { t: Date.now(), mode, bet: state.bet, cost, win: payOf(result.total), tier: result.tier, seed: result.draw };
  persist();
  update(); app.dataset.busy = '';
  try { await present(result, mode); } catch (err) { console.error(err); }
  finally {
    // Settlement is the engine's total, whatever the presentation did.
    const won = state.pending.win, skipped = state.skip;
    state.balance += won; state.win = won; state.busy = false; state.skip = false;
    delete app.dataset.busy; delete app.dataset.bonus; delete app.dataset.blackout;
    $('bonus-panel').hidden = true; $('bigwin').hidden = true; $('bonus-hud').hidden = true; state.tier = null; gauge(0); clearFx();
    audio.duck(false); audio.music('base');
    state.history.unshift(state.pending); state.pending = null;
    state.history.length = Math.min(state.history.length, 30);
    if (result.natural && state.auto) { state.auto = 0; toast('Autoplay stopped: bonus triggered.'); }
    persist(); update();
    if (skipped) { controller.update({ holding: true }); setTimeout(() => controller.update({ holding: false }), 700); }
    if (won) status(`WIN ${money(won)}`);
    skunk.play('idle');
    // Autoplay: state.auto counts the rounds still to play, this one included.
    if (state.auto > 0 && --state.auto > 0) setTimeout(() => { if (state.auto > 0 && !state.busy) void play(); }, 350);
    update();
  }
}
async function present(result, mode) {
  clearFx();
  for (const e of result.events) {
    if (e.type === 'reveal') {
      if (e.tier) { hud(e.spin, e.of); status(`FREE SPIN ${e.spin} OF ${e.of}`); }
      await spinTo(e.board, { canTrigger: true });
    } else if (e.type === 'spray') await showSpray(e);
    else if (e.type === 'wins') { await showWins(e); state.win = payOf(e.total); paintWin(); if (e.tier) await wait(350); }
    else if (e.type === 'bonusStart') await bonusStart(e);
    else if (e.type === 'blackout') await blackout(e);
    else if (e.type === 'reservoir') { gauge(e.after); steam(); audio.play('gauge'); skunk.play('release'); status(`RESERVOIR ${e.before} → ${e.after}`); await wait(500); }
    else if (e.type === 'retrigger') { audio.play('retrigger'); status(`RETRIGGER +${e.add}`); hud(Number($('hud-spins').textContent.split('/')[0]), e.spins); await banner(`+${e.add}`); }
    else if (e.type === 'bonusEnd') await bonusEnd(e);
    else if (e.type === 'roundEnd') await celebrate(e.total, e.capped);
  }
}

// ---- Controller actions ----
function act(action) {
  void audio.unlock();
  if (action === 'settings') return openMenu();
  if (action === 'sound') { setMuted(!state.muted); return; }
  if (action === 'turbo') { state.speed = state.speed === 'turbo' ? 'normal' : 'turbo'; $('menu-speed').value = state.speed; persist(); update(); return; }
  if (action === 'play') {
    if (state.busy) { state.skip = true; running.forEach((a) => a.finish()); panelSkip?.(); return; }
    audio.play('click'); void play(); return;
  }
  if (action === 'auto') { if (state.auto) { state.auto = 0; update(); toast('Autoplay stops after this round.'); } else if (!state.busy) open('autoplay'); return; }
  if (state.busy) return;
  if (action === 'buy') { audio.play('click'); if (state.feature) { const name = COPY[state.feature].name; state.feature = null; update(); toast(`${name} off · base spins`); } else openBuy(); }
  if (action === 'bet') openBets();
  if (action === 'betMinus') setBet(STAKES[Math.max(0, STAKES.indexOf(state.bet) - 1)]);
  if (action === 'betPlus') setBet(STAKES[Math.min(STAKES.length - 1, STAKES.indexOf(state.bet) + 1)]);
}
function setBet(value) { if (state.busy || state.auto || value === state.bet) return; state.bet = value; persist(); update(); audio.play('tick'); renderBuy(); }
function setMuted(m) { state.muted = m; audio.setMuted(m); $('menu-sound').checked = !m; persist(); update(); }
const open = (id) => { const d = $(id); if (!d.open) d.showModal(); };

// ---- Buy menu and confirmation ----
function card(mode) {
  const c = COPY[mode], m = MODES[mode], total = state.bet * m.cost, active = state.feature === mode;
  const label = c.kind === 'feature' ? (active ? 'ON · SWITCH OFF' : 'ACTIVATE') : 'BUY';
  return `<article class="card${active ? ' active' : ''}" data-mode="${mode}"><div class="card-art" data-card="${c.card}">${VIGNETTE[mode]()}</div><div class="card-body"><h4>${c.name}</h4><p>${c.text}</p>
    <div class="price"><span>${m.cost}× base bet${c.kind === 'feature' ? ' per spin' : ''}</span><b>${money(total)}</b></div>
    <button class="primary" data-pick="${mode}"${!active && total > state.balance ? ' disabled' : ''}>${label}</button></div></article>`;
}
// Card vignettes from the symbols, shown until ChatGPT's card art lands.
const VIGNETTE = {
  enhanced: () => ['S', 'S', 'S'].map((id) => `<i>${symbolHTML(id)}</i>`).join(''),
  sprayjob: () => `<i>${symbolHTML('A')}${ventHTML(0)}</i><i>${symbolHTML('W')}</i><i>${symbolHTML('Q')}${ventHTML(1)}</i>`,
  ventbreak: () => [0, 1, 2].map((d) => `<i>${symbolHTML(['K', 'H3', 'J'][d])}${ventHTML(d)}</i>`).join(''),
  overpressure: () => `<i>${symbolHTML('H1')}${ventHTML(1)}</i><b class="gauge-mini"></b><i>${symbolHTML('H2')}${ventHTML(2)}</i>`,
};
function renderBuy() {
  $('buy-bet').textContent = money(state.bet);
  $('feature-cards').innerHTML = ['enhanced', 'sprayjob'].map(card).join('');
  $('bonus-cards').innerHTML = ['ventbreak', 'overpressure'].map(card).join('');
  applyCardArt();
}
function openBuy() { renderBuy(); open('buy-menu'); }
$('buy-menu').addEventListener('click', async (ev) => {
  const step = ev.target.closest('[data-bet]');
  if (step) { setBet(STAKES[Math.min(STAKES.length - 1, Math.max(0, STAKES.indexOf(state.bet) + Number(step.dataset.bet)))]); return; }
  const pick = ev.target.closest('[data-pick]')?.dataset.pick;
  if (!pick) return;
  if (state.feature === pick) { state.feature = null; update(); renderBuy(); toast(`${COPY[pick].name} off · base spins`); return; }
  $('buy-menu').close();
  if (!(await confirmPlay(pick))) { openBuy(); return; }
  if (COPY[pick].kind === 'feature') { state.feature = pick; update(); audio.play('buy'); toast(`${COPY[pick].name} on · ${money(state.bet * MODES[pick].cost)} per spin`); }
  else { audio.play('buy'); void play(pick); }
});
function confirmPlay(mode) {
  const m = MODES[mode], total = state.bet * m.cost, enough = total <= state.balance;
  $('confirm-title').textContent = COPY[mode].name;
  $('confirm-bet').textContent = money(state.bet);
  $('confirm-cost').textContent = `${m.cost}×${COPY[mode].kind === 'feature' ? ' per spin' : ''}`;
  $('confirm-total').textContent = money(total);
  $('confirm-balance').textContent = enough ? money(state.balance - total) : 'Not enough credits';
  $('confirm-rules').textContent = COPY[mode].text;
  $('confirm-ok').disabled = !enough;
  $('confirm-ok').textContent = COPY[mode].kind === 'feature' ? 'ACTIVATE' : `BUY ${money(total)}`;
  open('confirm');
  return new Promise((resolve) => {
    const done = (yes) => { $('confirm').close(); $('confirm-ok').onclick = $('confirm-cancel').onclick = null; $('confirm').onclose = null; resolve(yes); };
    $('confirm-ok').onclick = () => done(true);
    $('confirm-cancel').onclick = () => done(false);
    $('confirm').onclose = () => resolve(false);
  });
}

// ---- Bets, autoplay, menu, rules, history ----
function openBets() {
  const per = MODES[state.feature || 'base'].cost;
  $('bet-options').innerHTML = STAKES.map((s) => `<button data-stake="${s}" aria-pressed="${s === state.bet}"${s * per > state.balance && s !== state.bet ? ' class="short"' : ''}>${money(s)}${per > 1 ? `<small>${money(s * per)} / spin</small>` : ''}</button>`).join('');
  open('bet-picker');
  $('bet-options').querySelector('[aria-pressed=true]')?.scrollIntoView({ block: 'nearest' });
}
$('bet-options').addEventListener('click', (ev) => { const b = ev.target.closest('[data-stake]'); if (!b) return; setBet(Number(b.dataset.stake)); $('bet-picker').close(); });
const AUTO = [10, 25, 50, 100, 250, 500];
$('auto-options').innerHTML = AUTO.map((n) => `<button data-auto="${n}">${n}</button>`).join('');
$('auto-options').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-auto]'); if (!b || state.busy) return;
  $('autoplay').close(); state.auto = Number(b.dataset.auto); update(); void play();
});
function openMenu() {
  if (state.auto) { state.auto = 0; update(); }
  $('menu-sound').checked = !state.muted; $('menu-music').value = state.music; $('menu-effects').value = state.effects; $('menu-speed').value = state.speed;
  $('menu-reset').disabled = state.busy;
  open('menu');
}
$('menu-sound').addEventListener('change', (ev) => setMuted(!ev.target.checked));
$('menu-music').addEventListener('input', (ev) => { state.music = Number(ev.target.value); audio.setLevels(state.music / 100, state.effects / 100); persist(); });
$('menu-effects').addEventListener('input', (ev) => { state.effects = Number(ev.target.value); audio.setLevels(state.music / 100, state.effects / 100); persist(); });
$('menu-speed').addEventListener('change', (ev) => { state.speed = ev.target.value; persist(); update(); });
$('menu-rules').addEventListener('click', () => { $('menu').close(); renderRules(); open('rules'); });
$('menu-history').addEventListener('click', () => { $('menu').close(); renderHistory(); open('history'); });
$('menu-reset').addEventListener('click', () => { if (state.busy) return; state.balance = START; state.win = 0; persist(); update(); $('menu').close(); toast(`Free-play credits reset to ${money(START)}.`); });
document.addEventListener('click', (ev) => { const id = ev.target.closest('[data-close]')?.dataset.close; if (id) $(id).close(); });

const lineSVG = (line, k) => `<figure><svg viewBox="0 0 60 40" aria-label="Line ${k + 1}">${Array.from({ length: 24 }, (_, i) => `<rect x="${(i % 6) * 10 + 1}" y="${Math.floor(i / 6) * 10 + 1}" width="8" height="8" rx="1.5" fill="${line[i % 6] === Math.floor(i / 6) ? '#eda83c' : '#252d31'}"/>`).join('')}</svg><figcaption>${k + 1}</figcaption></figure>`;
function renderRules() {
  const rows = Object.entries(PAYTABLE).map(([id, pays]) => `<tr><td><span class="mini">${symbolHTML(id)}</span> ${NAMES[id]}</td>${pays.map((p) => `<td>${xOf(p)}</td>`).join('')}</tr>`).join('');
  $('rules-body').innerHTML = `
  <p>Cyber Skunk is played on 6 reels and 4 rows with <b>20 fixed lines</b>. Lines pay left to right from reel 1 for 3, 4, 5 or 6 of a kind, in multiples of the base bet. Each line pays its best win.</p>
  <h3>PAYTABLE</h3><table><thead><tr><th>Symbol</th><th>3</th><th>4</th><th>5</th><th>6</th></tr></thead><tbody>${rows}</tbody></table>
  <p><span class="mini">${symbolHTML('W')}</span> <b>Wild</b> substitutes for every paying symbol. The first real symbol on a line decides the pay; six wilds pay as the Battery. <span class="mini">${symbolHTML('S')}</span> <b>FS scatters</b> pay nothing on lines; they start the bonuses.</p>
  <h3>BACKPRESSURE</h3>
  <p><span class="mini">${ventHTML(0)}</span> Elbow <b>vents</b> sit on top of symbols. When at least one lands, Cyber Skunk sprays the <b>left-most vent</b> (the top one on a tie). The spray follows each vent's outlet, whichever way it came in, and every vent adds <b>+1 pressure</b>, so the first vent shows ×2.</p>
  <p>Every cell the spray touches becomes <b>wild</b> for that spin; each vent becomes a <b>×N wild</b>, N being the pressure there. Scatters are never painted. The route ends at the edge of the reels, at a cell it has already touched, or after 24 steps. A winning line multiplies by the sum of its ×N vents (×2 and ×3 make ×5).</p>
  <h3>BONUSES</h3>
  <p><b>3 FS scatters: VENT BREAK.</b> ${BONUSES.regular.spins} free spins. Vents that land stay until the bonus ends, up to ${MAX_STICKY}, and the <b>Reservoir</b> gauge banks each spray's pressure gain up to ${BONUSES.regular.reservoirMax}: every later spray starts at 1 + the Reservoir.</p>
  <p><b>4 FS scatters: OVERPRESSURE.</b> ${BONUSES.super.spins} free spins with sticky vents and the <b>Reservoir</b> gauge: after each spray, the pressure gained is banked (up to ${MAX_RESERVOIR}), and every later spray starts at 1 + the Reservoir.</p>
  <p><b>5 FS scatters: BLACKOUT PROTOCOL.</b> ${BONUSES.hidden.spins} free spins. The lights go out, 4 vents come online as one route and the Reservoir starts at ${BONUSES.hidden.reservoirStart}; then it plays as Overpressure. It always pays at least 1,000× the base bet. It cannot be bought.</p>
  <p>${RETRIGGER.scatters} or more FS scatters during a bonus add +${RETRIGGER.spins} spins, up to ${MAX_SPINS} in total.</p>
  <h3>WAYS TO PLAY</h3>
  <table><tbody>${['base', 'enhanced', 'sprayjob', 'ventbreak', 'overpressure'].map((m) => `<tr><td>${m === 'base' ? 'BASE SPINS' : COPY[m].name}</td><td>${MODES[m].cost}× base bet${COPY[m]?.kind === 'feature' ? ' per spin' : ''}</td></tr>`).join('')}</tbody></table>
  <p>Maximum win: <b>${(CAP / 100).toLocaleString('en-US')}×</b> the base bet per round, including bonuses. Reaching it ends the round.</p>
  <p>The theoretical return to player is <b>96.00%</b> in every way to play, measured against what that play costs. Every round is drawn from the game's weighted outcome catalogs (${CATALOG_VERSION}, games/cyber-skunk/MATH.md) and replayed in full before it is shown.</p>
  <p class="note">Free play only: credits have no cash value. Malfunction voids all pays and plays.</p>
  <h3>LINES</h3><div class="lines">${LINES.map(lineSVG).join('')}</div>`;
}
function renderHistory() {
  $('history-rows').innerHTML = state.history.length ? state.history.map((h) => `<div class="history-row"><span>${new Date(h.t).toLocaleTimeString()} · ${h.mode === 'base' ? 'Base' : COPY[h.mode]?.name || h.mode}${h.tier ? ` → ${BONUSES[h.tier].title}` : ''}</span><span>−${money(h.cost)}</span><b>${h.win ? '+' + money(h.win) : '0.00'}</b></div>`).join('') : '<p class="note">No rounds yet.</p>';
}

// ---- Keyboard: Space or Enter spins, unless a control or dialog has focus ----
addEventListener('keydown', (ev) => {
  if (ev.code !== 'Space' && ev.code !== 'Enter') return;
  if (document.querySelector('dialog[open]') || !$('bonus-panel').hidden || !$('intro').hidden) return;
  if (ev.composedPath().some((n) => n instanceof HTMLElement && /^(BUTTON|INPUT|SELECT|TEXTAREA|A)$/.test(n.tagName))) return;
  ev.preventDefault(); act('play');
});
document.addEventListener('visibilitychange', () => audio.suspend(document.hidden));

// ---- Art: ChatGPT's files when present, placeholders until then ----
const exists = (url) => new Promise((resolve) => { const img = new Image(); img.onload = () => resolve(true); img.onerror = () => resolve(false); img.src = url; });
const cardArt = new Map(), extraArt = new Map(), fxSprites = {};
// ART_SPEC v3 (§6-§8): each file switches its feature on when it exists; until then the current look stays.
const EXTRA = {
  'win-nice': 'wins', 'win-big': 'wins', 'win-epic': 'wins', 'win-mythic': 'wins', 'win-max': 'wins', 'banner-extra-spins': 'wins', 'title-total-win': 'wins',
  'fx-splat': 'fx', 'badge-pressure': 'fx', 'vent-online': 'fx', 'fx-mist': 'fx', 'fx-droplet': 'fx', 'fx-spark': 'fx', 'fx-steam': 'fx',
  'splash-desktop': 'ui', 'splash-mobile': 'ui', 'intro-route': 'ui', 'intro-bonuses': 'ui', 'controller-texture': 'ui', icon: 'ui',
};
async function loadUI() {
  const ui = {
    cabinet: 'assets/ui/cabinet.webp', 'gauge-face': 'assets/ui/gauge-face.webp', 'gauge-needle': 'assets/ui/gauge-needle.webp', 'pipes-top': 'assets/ui/pipes-top.webp', logo: 'assets/ui/logo.webp',
    'bg-desktop': 'assets/bg/bg-desktop.webp', 'bg-mobile': 'assets/bg/bg-mobile.webp', 'bg-bonus-desktop': 'assets/bg/bg-bonus-desktop.webp', 'bg-bonus-mobile': 'assets/bg/bg-bonus-mobile.webp',
  };
  const found = Object.fromEntries(await Promise.all(Object.entries(ui).map(async ([k, url]) => [k, (await exists(url)) ? url : null])));
  if (found.cabinet) { app.dataset.artCabinet = ''; app.style.setProperty('--cabinet-art', `url(${found.cabinet})`); }
  if (found['gauge-face'] && found['gauge-needle']) { app.dataset.artGauge = ''; app.style.setProperty('--gauge-face', `url(${found['gauge-face']})`); app.style.setProperty('--gauge-needle', `url(${found['gauge-needle']})`); }
  if (found['pipes-top']) { app.dataset.artPipes = ''; app.style.setProperty('--pipes-art', `url(${found['pipes-top']})`); }
  if (found.logo) { app.dataset.artLogo = ''; document.querySelector('.logo').innerHTML = `<img src="${found.logo}" alt="Cyber Skunk">`; }
  for (const k of ['bg-desktop', 'bg-mobile', 'bg-bonus-desktop', 'bg-bonus-mobile']) if (found[k]) { app.dataset.artBg = ''; app.style.setProperty(`--${k}`, `url(${found[k]})`); }
  await Promise.all(Object.values(COPY).map(async ({ card: name }) => { const url = `assets/cards/${name}.webp`; if (await exists(url)) cardArt.set(name, url); }));
  await Promise.all(Object.values(TIER).map(async ({ panel: name }) => { const url = `assets/panels/${name}.webp`; if (await exists(url)) app.style.setProperty(`--${name}`, `url(${url})`); }));
  await Promise.all(Object.entries(EXTRA).map(async ([name, dir]) => { const url = `assets/${dir}/${name}.webp`; if (await exists(url)) extraArt.set(name, url); }));
  for (const name of ['fx-splat', 'badge-pressure', 'vent-online', 'fx-steam', 'splash-desktop', 'splash-mobile']) if (extraArt.has(name)) { app.dataset[`art${name.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase())}`] = ''; app.style.setProperty(`--${name}`, `url(${extraArt.get(name)})`); }
  for (const [name, key] of [['fx-mist', 'mist'], ['fx-droplet', 'droplet'], ['fx-spark', 'spark']]) if (extraArt.has(name)) { const img = new Image(); img.src = extraArt.get(name); fxSprites[key] = img; }
  if (extraArt.has('controller-texture')) $('controller').style.setProperty('--controller-mobile-texture', `url("${new URL(extraArt.get('controller-texture'), location.href).href}")`);
  if (extraArt.has('icon')) document.head.insertAdjacentHTML('beforeend', `<link rel="icon" href="${extraArt.get('icon')}">`);
  for (const name of ['intro-route', 'intro-bonuses']) if (extraArt.has(name)) { const pic = document.querySelector(`[data-art="${name}"] .intro-pic`); pic.style.backgroundImage = `url(${extraArt.get(name)})`; pic.replaceChildren(); }
}
const artImg = (name, alt) => (extraArt.has(name) ? `<img src="${extraArt.get(name)}" alt="${alt}">` : '');
// Card art carries its own painted title: the card shows the art whole and keeps
// its text title for screen readers only.
function applyCardArt() { document.querySelectorAll('[data-card]').forEach((el) => { const url = cardArt.get(el.dataset.card); if (url) { el.style.backgroundImage = `url(${url})`; el.replaceChildren(); el.closest('.card')?.classList.add('has-art'); } }); }

// ---- Boot ----
async function boot() {
  buildReels();
  fit();
  await Promise.all([loadArt('assets/symbols/'), loadUI(), skunk.load('assets/mascot/')]);
  app.dataset.rig = skunk.rig.version ?? 1; // rig v4 (waist up) has its own placement
  const first = playRound({ mode: 'base', rng: seeded(20261030) }).events.find((e) => e.type === 'reveal').board.map((c) => ({ s: c.s }));
  setBoard(first);
  fit();
  state.ready = true; update();
  audio.music('base');
  void fillerStrip(STRIP).then((url) => { if (url) { $('reels').style.setProperty('--filler', `url("${url}")`); stripReady = true; } });
  introRoute();
  if (!saved?.introHidden) showIntro();
  if (resumed) toast(`Your last round finished while you were away: ${resumed.win ? `WIN ${money(resumed.win)}` : 'no win'}.`);
}
// The intro's route diagram from the game's own symbols, until intro-route art exists:
// a vent (x2) sprays right through a wild into a second vent (x3), which turns it up.
function introRoute() {
  const pic = document.querySelector('[data-art="intro-route"] .intro-pic');
  if (!pic.classList.contains('intro-route')) return;
  const grid = [['A', 'Q', 'K', 'J'], ['T', 'K', 'Q', 'A'], ['J', 'H2', 'T', 'Q']];
  const vents = { '1,0': [1, 2], '1,2': [0, 3] }, painted = new Set(['1,0', '1,1', '1,2', '0,2']);
  pic.innerHTML = grid.map((row, r) => row.map((s, c) => {
    const key = `${r},${c}`, v = vents[key];
    return `<i class="mini${painted.has(key) ? ' wild' : ''}">${symbolHTML(painted.has(key) ? 'W' : s)}${v ? ventHTML(v[0]) + `<b>×${v[1]}</b>` : ''}</i>`;
  }).join('')).join('') + '<svg viewBox="0 0 400 300" preserveAspectRatio="none"><polyline points="10,150 250,150 250,0" /></svg>';
}
// The intro: what Backpressure is and the three bonuses, before the first spin.
// Its Play button is also the gesture that lets the browser start the audio.
function showIntro() {
  const el = $('intro'); el.hidden = false; $('intro-go').focus({ preventScroll: true });
  $('intro-go').onclick = () => {
    el.hidden = true; void audio.unlock();
    if ($('intro-hide').checked) { state.introHidden = true; persist(); }
    $('controller').shadowRoot?.querySelector('[data-action=play]')?.focus({ preventScroll: true });
  };
}
boot();
// For browser tests: a read-only view of the session. Nothing here forces outcomes.
window.cyberSkunk = { get state() { return { ...state, history: undefined }; }, version: 1 };
