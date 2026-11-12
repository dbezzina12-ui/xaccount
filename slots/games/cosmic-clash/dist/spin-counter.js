// The round event supplies the count; this counter cannot add or consume spins.
export function createSpinCounter({game, element, value, label, status, lift, animate = () => {}}) {
  let active = false, total = 0, remaining = 0, complete = false, kind = 'FREE SPINS';
  const clean = next => Number.isFinite(Number(next)) ? Math.max(0, Math.trunc(Number(next))) : 0;
  function update(next) {
    const count = Math.min(total, clean(next)), changed = count !== remaining;
    remaining = count; value.textContent = String(count); element.dataset.complete = String(complete);
    element.style?.setProperty('--spins-progress', String(total ? count / total : 0));
    label.textContent = complete ? 'COMPLETE' : kind;
    status.textContent = complete ? `${kind === 'RESPINS' ? 'Respins' : 'Free spins'} complete.` : `${count} ${kind.toLowerCase()} remaining.`;
    if (changed && !element.hidden && !complete) animate(value, [
      {transform:'translateY(0)',opacity:1}, {transform:'translateY(-15%)',opacity:.5,offset:.45}, {transform:'translateY(0)',opacity:1}
    ], 190);
  }
  return {
    read: () => ({active, total, remaining, complete, kind}),
    begin(spins, tier, display = 'FREE SPINS') {
      total = clean(spins); remaining = total; active = true; complete = false; kind = display;
      element.dataset.tier = tier || 'regular'; element.hidden = false; game.dataset.spinCounter = 'active';
      update(total);
      animate(lift, [
        {transform:'translateY(96%)',opacity:0},
        {transform:'translateY(12%)',opacity:1,offset:.65},
        {transform:'translateY(0)',opacity:1}
      ], 380);
    },
    reveal(left) { if (active && !complete) update(clean(left) + 1); },
    settle(left) { if (active && !complete) update(left); },
    complete() { if (active) { complete = true; update(0); } },
    hide() { element.hidden = true; delete game.dataset.spinCounter; active = false; total = 0; remaining = 0; complete = false; }
  };
}
