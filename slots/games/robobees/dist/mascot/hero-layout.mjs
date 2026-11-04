// Stage-local CSS pixels. Both renderers share the same mobile hover mark.
export function heroLayout(stage, canvas) {
  const phone = matchMedia('(max-width:600px) and (orientation:portrait)');
  const wordmark = stage.closest('.top').querySelector('.brand h1 img');
  let lastKey, placement;
  return function measure() {
    const w = stage.clientWidth, h = stage.clientHeight;
    const box = phone.matches && stage.getBoundingClientRect();
    const title = phone.matches && wordmark.getBoundingClientRect();
    const key = [w, h, innerWidth, innerHeight, phone.matches, box.left, box.top, title.left, title.top, title.width].join(',');
    if (key === lastKey) return placement;
    lastKey = key;
    placement = { perched: false, pad: 0, above: 0, dx: 0, dy: 0, scale: 1 };
    canvas.style.left = '-50%';
    canvas.style.width = '200%';
    canvas.style.top = '-70%';
    canvas.style.height = '240%';
    if (!phone.matches || !w || !h) return placement;

    const zoom = box.width / w;
    const k = Math.min(w * 1.25 / 512, h / 356);
    // Project the hover joint using the same registration as the rendered clips.
    const anchorX = Math.max(0, (w - 512 * k) / 2) + (482.12 - 50) * k;
    const anchorY = h + (211.29 - 378) * k;
    // The first painted row of the title is 9 units into its 530-wide SVG.
    const seat = title.top + title.width * 9 / 530;
    const scale = Math.min(2.5, Math.max(1, seat - 8) / (150 * k * zoom));
    const targetX = (title.left + title.width * .55 - box.left) / zoom;
    const seatY = (seat - box.top) / zoom;
    const targetY = seatY - 52 * k * scale;
    // Include the entire visible header in the render target. Overscan on both
    // axes accommodates antennae and wingtips during turns and takeoff.
    const pad = Math.ceil(Math.max(0, box.left / zoom + 12 - w / 2));
    const above = Math.ceil(Math.max(0, box.top / zoom + 12 - h * .7));
    canvas.style.left = 'calc(-50% - ' + pad + 'px)';
    canvas.style.width = 'calc(200% + ' + pad + 'px)';
    canvas.style.top = 'calc(-70% - ' + above + 'px)';
    canvas.style.height = 'calc(240% + ' + above + 'px)';
    placement = { perched: true, pad, above, dx: targetX - anchorX,
      dy: targetY - anchorY, scale, seatInClip: 211.29 + (seatY - anchorY) / k };
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
