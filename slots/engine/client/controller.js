// Game flow. Each round's outcome is decided up front by the core
// (engine/core/game.js, the same code the simulator verifies); everything
// here is presentation: reel timing, anticipation, win display, feature
// flow, wallet and controls.

import { playRound } from '../core/game.js';
import { Skipper, Animated, ease, now } from './tween.js';

const DEFAULT_TIERS = [
  { id: 'big', label: 'BIG WIN', minX: 15, art: 'bannerBig' },
  { id: 'mega', label: 'MEGA WIN', minX: 40, art: 'bannerMega' },
  { id: 'epic', label: 'EPIC WIN', minX: 100, art: 'bannerEpic' },
];

export class Controller {
  constructor({ model, theme, stage, hud, sfx, rng, summary, artReport, demo }) {
    Object.assign(this, { m: model, theme, stage, hud, sfx, rng, summary, artReport, demo });
    this.json = model.json;
    this.strings = theme.strings ?? {};
    this.tiers = theme.winTiers ?? DEFAULT_TIERS;
    this.skipper = new Skipper();
    this.busy = false;
    this.hurry = false;
    this.turbo = false;
    this.autoplay = false;
    this.token = 0;
    this.capX = this.json.maxWinX;
    this.wildId = model.WILD >= 0 ? model.symbols[model.WILD] : null;
    this.scatterId = model.symbols[model.SCATTER];
    // Which optional features this game has; copy and UI follow these.
    this.hasMult = model.multValues.some((v) => v > 1);
    this.hasRetrigger = model.retrigger.some((v) => v > 0);
    this.minScatter = model.scatterAward.findIndex((v) => v > 0);
    this.strips = {
      base: this.json.reels.base.map((s) => s.trim().split(/\s+/)),
      free: this.json.reels.free.map((s) => s.trim().split(/\s+/)),
    };
    this.key = `slots.${this.json.id}`;
    this.levels = this.json.bet?.levels ?? [1];
    this.betIndex = Math.max(0, this.levels.indexOf(this.json.bet?.default ?? this.levels[0]));
    this.balance = this.json.bet?.startBalance ?? 1000;
    try {
      const saved = JSON.parse(localStorage.getItem(this.key) ?? 'null');
      if (!demo && saved && Number.isFinite(saved.balance)) {
        this.balance = saved.balance;
        if (saved.betIndex >= 0 && saved.betIndex < this.levels.length) this.betIndex = saved.betIndex;
      }
    } catch {}

    const cur = theme.currency ?? '$';
    this.fmt = (v) => cur + (Math.round(v * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    hud.fmt = this.fmt;

    hud.on = {
      spin: () => this.spinPressed(),
      betUp: () => this.changeBet(1),
      betDown: () => this.changeBet(-1),
      turbo: () => {
        this.turbo = !this.turbo;
        hud.setToggle('turbo', this.turbo);
        sfx.button();
      },
      auto: () => this.toggleAuto(),
      buy: () => this.confirmBuy(),
      info: () => this.showInfo(),
      sound: () => {
        sfx.unlock();
        sfx.setEnabled(!sfx.enabled);
        hud.setToggle('sound', sfx.enabled);
      },
    };
    hud.setToggle('sound', sfx.enabled);
    if (!this.json.bonusBuy) hud.buy.parentElement.style.display = 'none';
    stage.onTap = () => this.tap();
    stage.onFrame = (t) => this.frame(t);
    stage.onTier = (i) => sfx.bigWin(i);
    stage.plaque = this.basePlaque();
    this.refreshHud();
  }

  get bet() {
    return this.levels[this.betIndex];
  }
  get T() {
    return this.turbo ? 0.55 : 1;
  }
  str(key, fallback) {
    return this.strings[key] ?? fallback;
  }

  basePlaque() {
    const max = `WIN UP TO ${this.capX.toLocaleString('en-US')}x`;
    const hook = this.hasMult
      ? 'WILDS MULTIPLY IN FREE SPINS'
      : this.minScatter > 0
        ? `${this.minScatter}+ ${this.str('scatterName', this.scatterId)} = FREE SPINS`
        : null;
    return { left: this.str('plaque', hook ? `${hook} · ${max}` : max) };
  }

  featureLines() {
    const sc = this.str('scatterName', this.scatterId);
    const wm = this.m.multValues.filter((v) => v > 1);
    const lines = [];
    if (this.hasMult) {
      lines.push(this.str('featureLine1', `Every ${this.str('wild', 'WILD')} carries ${wm.map((v) => `x${v}`).join(', ').replace(/, ([^,]*)$/, ' or $1')}`));
      lines.push(this.str('featureLine2', 'Multipliers on the same line multiply'));
    } else if (this.strings.featureLine1) lines.push(this.strings.featureLine1);
    if (this.hasRetrigger && !this.hasMult) lines.push(this.str('featureLine2', `${this.m.retrigger.findIndex((v) => v > 0)}+ ${sc} add more spins`));
    return lines;
  }

  save() {
    if (this.demo) return;
    try {
      localStorage.setItem(this.key, JSON.stringify({ balance: this.balance, betIndex: this.betIndex }));
    } catch {}
  }

  refreshHud() {
    this.hud.setBalance(this.balance);
    this.hud.setBet(this.bet, !this.busy && this.betIndex > 0, !this.busy && this.betIndex < this.levels.length - 1);
    if (this.json.bonusBuy) this.hud.setBuyPrice(`Buy ${this.json.bonusBuy.spins} free spins for ${this.fmt(this.json.bonusBuy.priceX * this.bet)}`);
  }

  changeBet(d) {
    if (this.busy) return;
    this.sfx.unlock();
    this.betIndex = Math.min(this.levels.length - 1, Math.max(0, this.betIndex + d));
    this.sfx.button();
    this.refreshHud();
    this.save();
  }

  frame(t) {
    this.hud.update(t);
    const ov = this.stage.ov;
    if (ov?.type === 'bigwin' && ov.data.amount.busy && t - (this._tick ?? 0) > 65) {
      this._tick = t;
      this.sfx.tick();
    }
  }

  // ---------------- input ----------------

  spinPressed() {
    this.sfx.unlock();
    if (this.busy) return this.tap();
    if (this.autoplay) return this.toggleAuto();
    this.round();
  }

  // Tap / spin-while-busy: hurry whatever is happening.
  tap() {
    if (!this.busy) return;
    this.hurry = true;
    this.skipper.fire();
  }

  sleep(ms) {
    return this.hurry ? Promise.resolve() : this.skipper.sleep(ms * this.T);
  }

  // Wait for a deliberate tap (ignores an earlier hurry), or time out.
  waitTap(ms) {
    this.hurry = false;
    return this.skipper.sleep(ms);
  }

  toggleAuto() {
    this.sfx.unlock();
    this.autoplay = !this.autoplay;
    this.hud.setToggle('auto', this.autoplay);
    if (this.autoplay && !this.busy) this.autoLoop();
  }

  async autoLoop() {
    while (this.autoplay) {
      const ok = await this.round();
      if (!ok) break;
      await new Promise((r) => setTimeout(r, 350 * this.T));
    }
    this.autoplay = false;
    this.hud.setToggle('auto', false);
  }

  confirmBuy() {
    if (this.busy || !this.json.bonusBuy) return;
    this.sfx.unlock();
    const { spins, priceX } = this.json.bonusBuy;
    const price = priceX * this.bet;
    const box = this.hud.modal(`
      <h2>${this.str('buyTitle', 'Buy Free Spins')}</h2>
      <p>${spins} free spins for <b>${this.fmt(price)}</b> (${priceX}x your bet of ${this.fmt(this.bet)}).</p>
      ${this.summary?.rtpBonusBuy ? `<p>Bonus buy RTP ${(this.summary.rtpBonusBuy * 100).toFixed(2)}%.</p>` : ''}
      <div class="row-btns"><button class="btn cancel">Cancel</button><button class="btn primary ok">Buy for ${this.fmt(price)}</button></div>`);
    box.querySelector('.cancel').onclick = () => this.hud.closeModal();
    box.querySelector('.ok').onclick = () => {
      this.hud.closeModal();
      this.round({ buy: true });
    };
  }

  // ---------------- a round ----------------

  async round({ buy = false } = {}) {
    if (this.busy) return false;
    const cost = buy ? this.json.bonusBuy.priceX * this.bet : this.bet;
    if (this.balance + 1e-9 < cost) {
      this.hud.flash(this.str('noFunds', 'Not enough balance. Lower the bet or reset it in ⓘ'));
      return false;
    }
    const st = this.stage;
    const bet = this.bet;
    this.busy = true;
    this.token++;
    this.hurry = false;
    this.hud.setBusy(true);
    this.balance -= cost;
    this.save();
    this.refreshHud();
    this.hud.setWin(0);

    const r = playRound(this.m, this.rng, { buy, detail: true });
    this.last = r;
    let shownX = 0;

    if (!buy) {
      await this.playSpin(r.base, 'base');
      const baseX = Math.min(r.base.winX, this.capX);
      if (baseX > 0) {
        const big = !r.triggered && this.tierFor(baseX) >= 0;
        if (!big) this.hud.rollWin(baseX * bet, this.rollMs(baseX));
        await this.presentWins(r.base, 'base', { winX: baseX, big });
        this.hud.setWin(baseX * bet);
      }
      shownX = baseX;
    }

    if (r.triggered && (buy || r.free.length)) {
      const initial = buy ? this.json.bonusBuy.spins : r.base.award;
      const featX = await this.runFeature(initial, r.free, { trigger: buy ? null : r.base, baseX: shownX });
      shownX += featX;
      const backToBase = () => {
        st.setMode('base', this.strips.base);
        st.plaque = this.basePlaque();
      };
      if (r.capped) {
        backToBase();
      } else if (this.tierFor(featX) >= 0) {
        await this.bigWin(featX, { onShown: backToBase });
      } else {
        st.overlay('feature-end', {
          title: this.str('featureWin', 'FEATURE WIN'),
          amount: this.fmt(featX * bet),
          sub: `${r.freeSpinsPlayed} ${this.str('freeSpinsShort', 'free spins')} · ${featX.toFixed(2)}x`,
        });
        await this.skipper.sleep(320);
        backToBase();
        await this.waitTap(this.autoplay ? 2200 : 4500);
        await st.closeOverlay();
      }
      this.hud.setWin(shownX * bet);
    }

    if (r.capped) {
      this.sfx.bigWin(3);
      st.overlay('maxwin', { amount: this.fmt(this.capX * bet) });
      await this.waitTap(6000);
      await st.closeOverlay();
    }

    const total = r.totalWinX * bet;
    this.balance += total;
    this.hud.setWin(total);
    this.busy = false;
    this.hud.setBusy(false);
    this.save();
    this.refreshHud();
    if (!r.triggered && r.base?.winX > 0) this.idleCycle(r.base, this.token);
    return true;
  }

  tierFor(x) {
    let t = -1;
    this.tiers.forEach((tier, i) => {
      if (x >= tier.minX) t = i;
    });
    return t;
  }

  rollMs(x) {
    return (x < 1 ? 450 : x < 5 ? 900 : x < 15 ? 1500 : 2200) * this.T;
  }

  // ---------------- reels ----------------

  async playSpin(spin, mode) {
    const st = this.stage;
    const R = this.m.reels;
    this.hurry = false;
    st.clearWins();
    st.clearBadges();
    this.sfx.spinStart();
    const t = now();
    const speed = this.turbo ? 30 : 23;
    st.reels.forEach((reel, i) => reel.start(t, { speed, delay: i * (this.turbo ? 22 : 50) }));
    const sc = spin.grid.map((col) => col.filter((s) => s === this.scatterId).length);
    const landings = [];
    let before = 0;
    for (let i = 0; i < R; i++) {
      // Two scatters showing: hold the next reel and build tension.
      const antic = !this.hurry && before >= 2;
      if (antic) {
        await Promise.all(landings);
        if (!this.hurry) {
          st.reels[i].antic = true;
          this.sfx.anticipation(true);
          await this.sleep(1300);
        }
      } else {
        await this.sleep(i === 0 ? 470 : 140);
      }
      const p = st.reels[i]
        .stop(spin.stops[i], { travel: antic && !this.hurry ? 5 : 3, quick: this.hurry })
        .then(() => this.onLand(i, spin, mode, sc));
      landings.push(p);
      if (antic) await p;
      before += sc[i];
    }
    await Promise.all(landings);
    this.sfx.anticipation(false);
  }

  onLand(i, spin, mode, sc) {
    this.sfx.reelStop(i);
    this.stage.landed(i, { multipliers: mode === 'free' ? spin.multipliers : null });
    if (sc[i]) this.sfx.scatterLand(sc.slice(0, i + 1).reduce((a, b) => a + b, 0));
    if (this.wildId && spin.grid[i].includes(this.wildId)) this.sfx.wildLand();
    if (this.stage.reels.every((r) => !r.antic)) this.sfx.anticipation(false);
  }

  // ---------------- wins ----------------

  lineLabel(lw, spin) {
    const money = this.fmt(lw.winX * this.bet);
    const factors = lw.cells.filter(([r, c]) => spin.grid[r][c] === this.wildId && spin.multipliers[r][c] > 1).map(([r, c]) => spin.multipliers[r][c]);
    if (!factors.length) return money;
    const math = factors.map((f) => `x${f}`).join(' × ');
    return `${math}${factors.length > 1 ? ` = x${lw.multiplier}` : ''}  ${money}`;
  }

  async presentWins(spin, mode, { winX, big = false }) {
    const st = this.stage;
    const bet = this.bet;
    const scatterCells = spin.scatter.winX > 0 ? spin.scatter.cells : [];
    st.setWins(spin.lineWins, scatterCells);
    this.sfx.win(winX >= 5 ? 2 : winX >= 1 ? 1 : 0);
    const { x0, y0, innerW, innerH } = st.L;
    if (winX >= 2 && !big) st.fx.coins(x0 + innerW / 2, y0 + innerH, Math.min(26, Math.round(4 + winX)), 1, { spread: 1.2, up: 0.8, size: 0.8 });
    if (big) {
      await this.bigWin(winX);
    } else {
      st.showCenterWin(this.fmt(winX * bet));
      await this.sleep(this.rollMs(winX) / this.T);
    }
    const each = 780;
    for (const lw of spin.lineWins) {
      if (this.hurry) break;
      st.focusLine(lw, this.lineLabel(lw, spin));
      await this.sleep(each);
    }
    if (scatterCells.length && !this.hurry) {
      st.focusCells(scatterCells, `${spin.scatter.count} × ${this.str('scatterName', 'BONUS')}  ${this.fmt(spin.scatter.winX * bet)}`);
      await this.sleep(each);
    }
    if (mode === 'free') st.clearWins();
  }

  async bigWin(winX, { onShown } = {}) {
    const st = this.stage;
    const top = this.tierFor(winX);
    const amount = new Animated(0);
    st.overlay('bigwin', { amount, tiers: this.tiers, format: (x) => this.fmt(x * this.bet) });
    this.hurry = false;
    const done = amount.go(winX, (2600 + 1700 * Math.max(0, top)) * this.T, ease.inOutQuad);
    await new Promise((r) => setTimeout(r, 300));
    onShown?.();
    await Promise.race([done, this.skipper.promise]);
    amount.finish();
    this.hud.setWin(winX * this.bet);
    await this.waitTap((this.autoplay ? 1600 : 2600) * this.T);
    await st.closeOverlay();
  }

  // Loop through a finished spin's winning lines until the next spin.
  async idleCycle(spin, token) {
    const st = this.stage;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    await wait(900);
    while (token === this.token && !this.busy) {
      for (const lw of spin.lineWins) {
        if (token !== this.token || this.busy) return;
        st.focusLine(lw, this.lineLabel(lw, spin));
        await wait(1300);
      }
      if (!spin.lineWins.length) return;
    }
  }

  // ---------------- free spins ----------------

  async runFeature(initial, spins, { trigger, baseX }) {
    const st = this.stage;
    const bet = this.bet;
    if (trigger) {
      st.focusCells(trigger.scatter.cells, `${trigger.scatter.count} × ${this.str('scatterName', 'BONUS')}`);
      st.dim.go(1, 200);
      for (const [r, c] of trigger.scatter.cells) {
        const [x, y] = st.cellCenter(r, c);
        st.fx.ring(x, y, st.L.cell * 0.3, st.L.cell * 1.4, st.pal.accent2, 0.9, 12);
        st.fx.sparkles(x, y, 30, 1, st.pal.accent2, st.L.cell * 0.4);
      }
      st.fx.shake(6, 500, now());
    }
    this.sfx.featureIntro();
    await this.waitTap(trigger ? 1500 : 300);
    st.overlay('feature-intro', {
      spins: initial,
      lines: this.featureLines(),
    });
    await this.skipper.sleep(320);
    st.clearWins();
    st.setMode('free', this.strips.free);
    await this.waitTap(this.autoplay ? 2600 : 9000);
    await st.closeOverlay();

    let total = 0;
    let left = initial;
    let played = 0;
    const freeLabel = this.str('freeSpins', 'FREE SPINS');
    this.hud.setWin(0);
    for (const s of spins) {
      left--;
      played++;
      st.plaque = { left: `${freeLabel} ${played} / ${played + left}`, right: this.fmt(total * bet) };
      await this.playSpin(s, 'free');
      const room = this.capX - baseX - total;
      const winX = Math.min(s.winX, room);
      if (winX > 0) {
        total += winX;
        this.hud.rollWin(total * bet, this.rollMs(winX));
        st.plaque.right = this.fmt(total * bet);
        await this.presentWins(s, 'free', { winX });
      }
      if (s.award > 0 && winX < room) {
        left += s.award;
        this.sfx.retrigger();
        st.plaque.left = `${freeLabel} ${played} / ${played + left}`;
        const { x0, y0, innerW, innerH, cell } = st.L;
        st.fx.float(x0 + innerW / 2, y0 + innerH / 2, `+${s.award} ${freeLabel}`, { size: cell * 0.42, color: st.pal.accent, dur: 1.8, rise: cell * 0.6, font: st.font });
        st.fx.shake(4, 300, now());
        await this.sleep(1500);
      }
      if (baseX + total >= this.capX) break;
      await this.sleep(260);
    }
    st.clearWins();
    return total;
  }

  // ---------------- info panel ----------------

  showInfo() {
    this.sfx.unlock();
    const m = this.m;
    const bet = this.bet;
    const nL = m.nLines;
    const names = this.theme.symbolNames ?? {};
    const img = (id) => this.stage.sprites.sprites[id].base.toDataURL();
    const pays = Object.entries(this.json.pays)
      .map(([id, t]) => {
        const rows = Object.keys(t)
          .sort((a, b) => b - a)
          .map((k) => `<tr><td>${k}×</td><td>${this.fmt((t[k] / nL) * bet)}</td></tr>`)
          .join('');
        return `<div class="pay"><img alt="${names[id] ?? id}" src="${img(id)}"><div><div>${names[id] ?? id}</div><table>${rows}</table></div></div>`;
      })
      .join('');
    const sc = this.json.scatter;
    const fsR = this.json.freeSpins?.retrigger ?? {};
    const wildName = names[this.wildId] ?? 'Wild';
    const scName = names[this.scatterId] ?? 'the scatter';
    const wildReels = (this.json.symbols[this.wildId]?.reels ?? []).join(', ');
    const wildText = this.wildId
      ? `<h3>${wildName}</h3><div class="pay"><img alt="" src="${img(this.wildId)}"><p>${wildReels ? `Lands on reels ${wildReels} and substitutes` : 'Substitutes'} for every symbol except ${scName}.${this.hasMult ? ` In free spins every wild carries ${m.multValues.map((v) => `x${v}`).join(', ')}; multipliers on the same line multiply together.` : ''}</p></div>`
      : '';
    const scatterText = Object.keys(sc.awards ?? {})
      .map((k) => `${k} anywhere pays ${this.fmt((sc.pays?.[k] ?? 0) * bet)}${sc.awards[k] ? ` + ${sc.awards[k]} free spins` : ''}`)
      .join('<br>');
    const retrigText = this.hasRetrigger ? `<br>Retrigger in free spins: ${Object.entries(fsR).map(([k, v]) => `${k} → +${v}`).join(', ')}.` : '';
    const gw = m.reels * 12;
    const gh = m.rows * 12;
    const lines = m.lines
      .map((l, i) => {
        const pts = Array.from(l, (row, reel) => `${reel * 12 + 6},${row * 12 + 6}`).join(' ');
        const cells = Array.from(l, (row, reel) => `<rect x="${reel * 12 + 1}" y="${row * 12 + 1}" width="10" height="10" rx="2" fill="currentColor" opacity="0.9"/>`).join('');
        return `<div><svg viewBox="0 0 ${gw} ${gh}" style="color:${this.stage.lineColors[i]}">${cells}<polyline points="${pts}" fill="none" stroke="#fff" stroke-width="1.5"/></svg>${i + 1}</div>`;
      })
      .join('');
    const s = this.summary;
    const facts = [
      s && ['RTP', `${(s.rtp * 100).toFixed(2)}%`],
      s?.rtpBonusBuy && ['Bonus buy RTP', `${(s.rtpBonusBuy * 100).toFixed(2)}%`],
      s?.volatility && ['Volatility', s.volatility],
      s && ['Hit rate', `${(s.hitRate * 100).toFixed(1)}%`],
      s && ['Free spins', `1 in ${Math.round(s.featureOneIn)}`],
      ['Max win', `${this.capX.toLocaleString('en-US')}x`],
    ]
      .filter(Boolean)
      .map(([k, v]) => `<div class="fact"><span>${k}</span><b>${v}</b></div>`)
      .join('');
    const report = (this.artReport ?? []).map((r) => `<div class="${r.status}">${r.status === 'ok' ? '✓' : r.status === 'missing' ? '·' : '!'} ${r.file}${r.width ? ` (${r.width}×${r.height})` : ''}${r.status === 'no-transparency' ? ' — needs a transparent background' : ''}</div>`).join('');
    const box = this.hud.modal(`
      <h2>${this.theme.title ?? this.json.title}</h2>
      <div class="facts">${facts}</div>
      <h3>Paytable <small>(at bet ${this.fmt(bet)})</small></h3>
      <div class="pays">${pays}</div>
      ${wildText}
      <h3>${names[this.scatterId] ?? 'Scatter'}</h3>
      <div class="pay"><img alt="" src="${img(this.scatterId)}"><p>${scatterText}${retrigText}</p></div>
      <h3>${nL} paylines</h3>
      <p>Wins pay left to right on consecutive reels starting from reel 1. Only the highest win per line is paid; wins on different lines add up. The whole round, including free spins, is capped at ${this.capX.toLocaleString('en-US')}x bet.</p>
      <div class="lines">${lines}</div>
      <h3>Controls</h3>
      <p>Space or the spin button spins; press again (or tap the reels) to stop fast and skip win animations. ⚡ turbo, AUTO autoplay.</p>
      <h3>Art status</h3>
      <div class="art-report">${report}</div>
      <div class="row-btns"><button class="btn reset">Reset balance to ${this.fmt(this.json.bet?.startBalance ?? 1000)}</button></div>
    `);
    box.querySelector('.reset').onclick = () => {
      this.balance = this.json.bet?.startBalance ?? 1000;
      this.save();
      this.refreshHud();
      this.hud.closeModal();
      this.hud.flash('Balance reset');
    };
  }
}
