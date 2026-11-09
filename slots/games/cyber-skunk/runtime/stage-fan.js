// The extractor on the wall behind the operator. It idles slowly, spins up
// when a bonus is bought or triggered, then lifts into the bonus transition
// (pressure-transfer.js carries it from here into the gust position).
// Speeds are degrees per second; the angle is shared so the hand-off is seamless.
export const FAN_SPEED = Object.freeze({ idle: 36, bonus: 110, rev: 620 });

export function stageFan(el, { reduced }) {
  let angle = 0, speed = FAN_SPEED.idle, target = FAN_SPEED.idle, ease = 1, raf = 0, last = 0;
  const paint = () => el.style.setProperty('--shaft-angle', angle.toFixed(2) + 'deg');
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    speed += (target - speed) * (1 - Math.exp(-dt / ease));
    angle = (angle + speed * dt) % 360;
    paint();
    raf = requestAnimationFrame(tick);
  }
  function run() {
    cancelAnimationFrame(raf); raf = 0;
    if (reduced.matches) { speed = 0; return; }
    last = performance.now(); raf = requestAnimationFrame(tick);
  }
  reduced.addEventListener?.('change', run);
  run();
  return {
    el,
    // Ease toward a new speed over about `seconds`.
    to(next, seconds = 1) { target = next; ease = Math.max(0.05, seconds / 3); },
    get angle() { return angle; },
    get speed() { return reduced.matches ? 0 : speed; },
    // Centre and diameter in viewport pixels.
    // The stage is scaled; the size is the untransformed diameter on screen.
    rect() {
      const r = el.getBoundingClientRect(), stage = el.offsetParent, scale = stage ? stage.getBoundingClientRect().width / stage.offsetWidth : 1;
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, size: el.offsetWidth * scale };
    },
    // While the transition carries the fan, the wall mount is empty.
    away(on) { el.toggleAttribute('data-away', !!on); },
  };
}
