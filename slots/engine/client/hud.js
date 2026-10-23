// DOM controls: balance, bet, win, spin, turbo, autoplay, bonus buy,
// paytable/info, sound. Emits intents through `on`; holds no game state.

import { Animated, ease } from './tween.js';

const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};

const ICONS = {
  spin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4a8 8 0 1 1-7.4 5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M3 4v6h6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg>',
  turbo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="currentColor"/></svg>',
  info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 10.5v6M12 7.2v.1" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  mute: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="m16 9 5 6m0-6-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
};

export class Hud {
  constructor(root, { fmt, theme, demo }) {
    this.fmt = fmt;
    this.theme = theme;
    this.on = {};
    this.win = new Animated(0);
    this._lastWinText = '';

    const hud = el('div', 'hud');
    const meter = (cls, label) => {
      const m = el('div', `meter ${cls}`);
      m.append(el('label', '', label));
      const v = el('output', '');
      m.append(v);
      return [m, v];
    };
    const [mBal, vBal] = meter('balance', theme.strings?.balance ?? 'Balance');
    const [mWin, vWin] = meter('win', theme.strings?.win ?? 'Win');
    const mBet = el('div', 'meter bet');
    mBet.append(el('label', '', theme.strings?.bet ?? 'Bet'));
    const betCtl = el('div', 'bet-ctl');
    const betDown = el('button', 'step', '−');
    const vBet = el('output', '');
    const betUp = el('button', 'step', '+');
    betDown.setAttribute('aria-label', 'Lower bet');
    betUp.setAttribute('aria-label', 'Raise bet');
    betCtl.append(betDown, vBet, betUp);
    mBet.append(betCtl);

    const spin = el('button', 'spin', ICONS.spin);
    spin.setAttribute('aria-label', 'Spin');
    const turbo = el('button', 'round turbo', ICONS.turbo);
    turbo.setAttribute('aria-label', 'Turbo');
    const auto = el('button', 'round auto', 'AUTO');
    const buy = el('button', 'buy', `<span>${theme.strings?.buyBonus ?? 'BUY<br>BONUS'}</span>`);
    const info = el('button', 'round info', ICONS.info);
    info.setAttribute('aria-label', 'Paytable and rules');
    const sound = el('button', 'round sound', ICONS.sound);
    sound.setAttribute('aria-label', 'Sound');

    hud.append(
      el('div', 'grp left'),
      mBal,
      mBet,
      mWin,
      el('div', 'grp right'),
    );
    hud.querySelector('.left').append(info, sound);
    hud.querySelector('.right').append(turbo, auto);
    const spinWrap = el('div', 'spin-wrap');
    spinWrap.append(spin);
    const buyWrap = el('div', 'buy-wrap');
    buyWrap.append(buy);
    hud.append(buyWrap, spinWrap);
    if (demo) hud.append(el('div', 'demo-tag', `DEMO · ${demo}`));
    root.append(hud);

    this.toast = el('div', 'toast');
    root.append(this.toast);

    Object.assign(this, { root, hud, vBal, vWin, vBet, spin, turbo, auto, buy, info, sound, betUp, betDown });
    const fire = (name) => (e) => {
      e.preventDefault();
      this.on[name]?.();
    };
    spin.addEventListener('click', fire('spin'));
    betUp.addEventListener('click', fire('betUp'));
    betDown.addEventListener('click', fire('betDown'));
    turbo.addEventListener('click', fire('turbo'));
    auto.addEventListener('click', fire('auto'));
    buy.addEventListener('click', fire('buy'));
    info.addEventListener('click', fire('info'));
    sound.addEventListener('click', fire('sound'));
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !e.repeat && !this.modalOpen) {
        e.preventDefault();
        this.on.spin?.();
      }
      if (e.code === 'Escape') this.closeModal();
    });
  }

  height() {
    return this.hud.getBoundingClientRect().height + 8;
  }

  setBalance(v) {
    this.vBal.textContent = this.fmt(v);
  }
  setBet(v, canDown, canUp) {
    this.vBet.textContent = this.fmt(v);
    this.betDown.disabled = !canDown;
    this.betUp.disabled = !canUp;
  }
  setBuyPrice(text) {
    this.buy.title = text;
  }
  rollWin(to, ms) {
    return this.win.go(to, ms, ease.outQuad);
  }
  setWin(v) {
    this.win.set(v);
  }
  update(t) {
    const v = this.win.update(t);
    const text = v > 0 ? this.fmt(v) : '';
    if (text !== this._lastWinText) {
      this.vWin.textContent = text;
      this._lastWinText = text;
    }
  }
  setBusy(busy) {
    this.spin.innerHTML = busy ? ICONS.stop : ICONS.spin;
    this.spin.classList.toggle('busy', busy);
    if (busy) this.betUp.disabled = this.betDown.disabled = true;
    this.buy.disabled = busy;
  }
  setToggle(name, on) {
    this[name].classList.toggle('on', on);
    if (name === 'sound') this.sound.innerHTML = on ? ICONS.sound : ICONS.mute;
  }
  flash(text, ms = 1800) {
    this.toast.textContent = text;
    this.toast.classList.add('show');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => this.toast.classList.remove('show'), ms);
  }

  modal(html, { onClose } = {}) {
    this.closeModal();
    const back = el('div', 'modal-back');
    const box = el('div', 'modal', html);
    const close = el('button', 'close', '×');
    close.setAttribute('aria-label', 'Close');
    box.prepend(close);
    back.append(box);
    this.root.append(back);
    this.modalOpen = back;
    const done = () => {
      this.closeModal();
      onClose?.();
    };
    close.addEventListener('click', done);
    back.addEventListener('click', (e) => e.target === back && done());
    return box;
  }
  closeModal() {
    this.modalOpen?.remove();
    this.modalOpen = null;
  }
}
