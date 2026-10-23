// Boots a game: loads its model, theme, math summary and art, then wires
// stage + HUD + controller together.
//
// URL options:
//   ?game=game-001      which folder under games/ to load
//   ?demo=feature       start on a real outcome that triggers free spins
//         win | bigwin | epic | retrigger   (seeded, labelled DEMO in the HUD;
//         #feature etc. works too)
//   ?seed=1234          deterministic RNG stream (for testing)

import { compileModel } from '../core/model.js';
import { CryptoRng, SeededRng } from '../core/rng.js';
import { playRound } from '../core/game.js';
import { loadArt } from './assets.js';
import { Stage } from './stage.js';
import { Hud } from './hud.js';
import { Sfx } from './audio.js';
import { Controller } from './controller.js';

async function getJSON(url, fallback) {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${res.status}`);
    return await res.json();
  } catch (e) {
    if (fallback !== undefined) return fallback;
    throw new Error(`could not load ${url}: ${e.message}`);
  }
}

const DEMOS = {
  win: (r) => !r.triggered && r.totalWinX >= 3 && r.totalWinX < 15,
  feature: (r) => r.triggered,
  bigwin: (r) => !r.triggered && r.totalWinX >= 15,
  epic: (r) => r.triggered && r.totalWinX >= 100,
  retrigger: (r) => r.triggered && r.freeSpinsAwarded > r.freeSpinsInitial,
};

// Finds a seed whose FIRST round is a genuine outcome of the requested kind.
function demoSeed(model, kind) {
  const cond = DEMOS[kind];
  if (!cond) return null;
  for (let seed = 1; seed < 3e6; seed++) {
    if (cond(playRound(model, new SeededRng(seed)))) return seed;
  }
  return null;
}

function applyTheme(theme) {
  const p = theme.palette ?? {};
  const css = document.documentElement.style;
  for (const [k, v] of Object.entries({ bg: p.bg, accent: p.accent, accent2: p.accent2, text: p.text, muted: p.muted })) if (v) css.setProperty(`--${k}`, v);
  if (theme.fonts?.display) css.setProperty('--display', theme.fonts.display);
  if (theme.fonts?.ui) css.setProperty('--ui', theme.fonts.ui);
  if (theme.googleFonts?.length) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?${theme.googleFonts.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}`).join('&')}&display=swap`;
    document.head.append(link);
  }
}

export async function boot({ game = 'game-001', root = document.body, gamesBase = 'games/' } = {}) {
  const params = new URLSearchParams(location.search);
  game = params.get('game') ?? game;
  const base = `${gamesBase}${game}/`;
  const loading = Object.assign(document.createElement('div'), { className: 'loading', textContent: 'Loading…' });
  root.append(loading);
  try {
    const [modelJson, theme, summary] = await Promise.all([getJSON(base + 'model.json'), getJSON(base + 'theme.json', {}), getJSON(base + 'math/summary.json', null)]);
    const model = compileModel(modelJson);
    applyTheme(theme);
    document.title = theme.title ?? modelJson.title ?? game;
    if (theme.fonts?.display && document.fonts?.load) {
      await Promise.race([document.fonts.load(`40px ${theme.fonts.display}`), new Promise((r) => setTimeout(r, 2500))]).catch(() => {});
    }
    const art = await loadArt(base + 'art/', model);

    let rng = new CryptoRng();
    let demo = null;
    // ?demo=feature, or #feature where only the hash survives (embedded viewers)
    const hash = location.hash.slice(1);
    const kind = params.get('demo') ?? (DEMOS[hash] ? hash : null);
    const seedParam = params.get('seed');
    if (kind) {
      const seed = demoSeed(model, kind);
      if (seed) {
        rng = new SeededRng(seed);
        demo = `${kind} #${seed}`;
      }
    } else if (seedParam) {
      rng = new SeededRng(Number(seedParam));
      demo = `seed ${seedParam}`;
    }

    loading.remove();
    const stage = new Stage(root, { model, theme, art });
    const hud = new Hud(root, { fmt: (v) => v.toFixed(2), theme, demo });
    const fitHud = () => {
      stage.hudHeight = hud.height();
      stage.layout();
    };
    fitHud();
    window.addEventListener('resize', fitHud);
    const sfx = new Sfx();
    const ctrl = new Controller({ model, theme, stage, hud, sfx, rng, summary, artReport: art.report, demo });
    // Hooks for automated screenshots and tests.
    window.__slot = { ctrl, stage, hud, model, art, ready: true };
    return window.__slot;
  } catch (e) {
    loading.textContent = `Could not start the game: ${e.message}`;
    console.error(e);
    throw e;
  }
}
