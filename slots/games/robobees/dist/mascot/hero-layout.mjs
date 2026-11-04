// Stage-local CSS pixels. Both renderers share the same mobile hover mark.
export function heroLayout(stage, canvas) {
  const phone = matchMedia('(max-width:600px) and (orientation:portrait)');
  let lastKey, placement;
  return function measure() {
    const w = stage.clientWidth, h = stage.clientHeight;
    const key = [w, h, innerWidth, innerHeight, phone.matches, document.body.dataset.scene].join(',');
    if (key === lastKey) return placement;
    lastKey = key;
    placement = { pad: 0, dx: 0, dy: 0, scale: 1 };
    canvas.style.left = '-50%';
    canvas.style.width = '200%';
    if (!phone.matches || !w || !h) return placement;

    const box = stage.getBoundingClientRect();
    const title = stage.closest('.top').querySelector('.brand').getBoundingClientRect();
    const zoom = box.width / w;
    const k = Math.min(w * 1.25 / 512, h / 356);
    // Project the hover joint using the same registration as the rendered clips.
    const anchorX = Math.max(0, (w - 512 * k) / 2) + (482.12 - 50) * k;
    const anchorY = h + (211.29 - 378) * k;
    const space = Math.max(1, (title.top - 12) / zoom);
    const scale = Math.min(2.5, space / (150 * k));
    const targetX = (title.left + title.width * .55 - box.left) / zoom;
    const targetY = (title.top - box.top - 8) / zoom - 66 * k * scale;
    // Expand only the left side of the canvas to include the entire hero.
    const pad = Math.ceil(Math.max(0, -targetX + 85 * k * scale - w / 2));
    canvas.style.left = 'calc(-50% - ' + pad + 'px)';
    canvas.style.width = 'calc(200% + ' + pad + 'px)';
    placement = { pad, dx: targetX - anchorX, dy: targetY - anchorY, scale };
    return placement;
  };
}

export function hoverWeight(state, now) {
  if (state.mode === 'hover') return 1;
  if (state.mode !== 'dive' && state.mode !== 'arrive') return 0;
  const progress = (now - state.at) / state.dur;
  const t = Math.max(0, Math.min(1, state.mode === 'dive' ? 1 - progress / .7 : progress));
  return t * t * (3 - 2 * t);
}
