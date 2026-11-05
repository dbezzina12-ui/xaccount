// Dead Letter Depot: Frank, the night-shift postal pigeon. Presentation only:
// nothing here can change a round, and its randomness (blinks, letter checks)
// is its own, never the engine's.
//
// Two ways to draw him, one set of clips:
//   hero  - the current single illustration, moved as a whole from a feet
//           anchor, so the silhouette is untouched and the feet stay planted
//   parts - a layered kit (manifest: parts with pivot, parent and draw order,
//           plus roles naming which part is the torso, head, eyelids, arms ...)
//
// Clips: idle (breathing, blink, an occasional letter check), stamp (contact,
// squash, recoil, settle; bigger for a bigger meter value), salute (bonus
// entry; longer for Double Post and Lost & Found). Reduced motion is static.
//
// The runtime dispatches a bubbling `depot:frank` CustomEvent from
// `.postmaster` with detail.action 'stamp' (detail.value: the meter value) or
// 'bonus' (detail.tier: 'regular' | 'super' | 'hidden'). attachFrank listens
// on any ancestor and plays the matching clip.

const DEG = Math.PI / 180;
const clamp01 = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k);
const smooth = (k) => { k = clamp01(k); return k * k * (3 - 2 * k); };
const wave = (t, period, phase = 0) => Math.sin((t / period) * Math.PI * 2 + phase);
// A keyed track: [[t, v], ...] sampled with smoothstep between keys.
export function track(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const [t0, v0] = keys[i - 1], [t1, v1] = keys[i]; return v0 + (v1 - v0) * smooth((t - t0) / (t1 - t0)); }
  return keys.at(-1)[1];
}

// The roles a clip can move. A manifest maps each role to one of its parts;
// roles it lacks are skipped (hero mode folds everything into body).
export const ROLES = Object.freeze(['body', 'torso', 'head', 'eyelids', 'wing-near', 'forewing-near', 'hand-near', 'wing-far', 'letter', 'tail']);

export const CLIPS = Object.freeze({
  stamp: (v = 2) => { const k = Math.min(1.6, 0.7 + Math.log10(Math.max(1, v)) * 0.45); return { length: 0.9, intensity: k }; },
  salute: (tier = 'regular') => ({ length: { regular: 1.6, super: 2.0, hidden: 2.6 }[tier] ?? 1.6, intensity: { regular: 1, super: 1.15, hidden: 1.3 }[tier] ?? 1 }),
  letter: () => ({ length: 1.8, intensity: 1 }),
  blink: () => ({ length: 0.16, intensity: 1 }),
});

// Pose at time t (seconds) for the active clips. Pure: the same inputs give
// the same pose, so it is tested in Node and drawn by either renderer.
// Each role gets { r (degrees), x, y, sx, sy }.
export function pose(t, active = [], { reduced = false } = {}) {
  const out = Object.fromEntries(ROLES.map((r) => [r, { r: 0, x: 0, y: 0, sx: 1, sy: 1 }]));
  if (reduced) return out;
  // idle: breathing in the torso (from the hips), a slow head bob, tail drift
  const breath = wave(t, 3.6);
  out.torso.sy = 1 + 0.012 * breath; out.torso.sx = 1 - 0.004 * breath;
  out.body.sy = 1 + 0.006 * breath;
  out.head.r = 1.2 * wave(t, 3.6, 0.9); out.head.y = -2 * breath;
  out.tail.r = 2 * wave(t, 2.9, 0.4);
  for (const { clip, start, opts } of active) {
    const c = CLIPS[clip](opts), u = t - start;
    if (u < 0 || u > c.length) continue;
    const k = c.intensity;
    if (clip === 'blink') out.eyelids.sy = track([[0, 0], [0.06, 1], [0.1, 1], [0.16, 0]], u); // eyelids scale from closed-line 0 to shut 1
    else if (clip === 'letter') {
      // lift the letter into view, tilt the head to read it, lower it
      out['wing-near'].r += -38 * track([[0, 0], [0.35, 1], [1.35, 1], [1.8, 0]], u);
      out['forewing-near'].r += -24 * track([[0, 0], [0.4, 1], [1.3, 1], [1.8, 0]], u);
      out.letter.r += 8 * track([[0.3, 0], [0.6, 1], [1.2, 1], [1.6, 0]], u);
      out.head.r += 6 * track([[0.3, 0], [0.6, 1], [1.3, 1], [1.7, 0]], u);
      out.body.r += 0.8 * track([[0, 0], [0.5, 1], [1.3, 1], [1.8, 0]], u);
    } else if (clip === 'stamp') {
      // wind up, slam (contact at 0.2 s), recoil, settle
      const arm = track([[0, 0], [0.14, -1], [0.2, 1.1], [0.32, 0.8], [0.9, 0]], u);
      out['wing-near'].r += 46 * k * arm;
      out['forewing-near'].r += 30 * k * arm;
      const squash = track([[0, 0], [0.14, -0.4], [0.2, 1], [0.34, -0.35], [0.55, 0.1], [0.9, 0]], u);
      out.body.sy *= 1 - 0.045 * k * squash; out.body.sx *= 1 + 0.03 * k * squash;
      out.body.r += -2.2 * k * track([[0.2, 0], [0.34, 1], [0.6, -0.3], [0.9, 0]], u);
      out.head.r += -5 * k * track([[0.18, 0], [0.24, 1], [0.5, -0.4], [0.9, 0]], u);
      out.tail.r += 9 * k * track([[0.2, 0], [0.3, 1], [0.6, -0.5], [0.9, 0]], u);
    } else if (clip === 'salute') {
      const L = c.length, up = track([[0, 0], [0.28, 1], [L - 0.4, 1], [L, 0]], u);
      out['wing-near'].r += -96 * up; out['forewing-near'].r += -52 * up; out['hand-near'].r += 18 * up;
      out.torso.sy *= 1 + 0.025 * k * up; out.body.sy *= 1 + 0.02 * k * up;
      out.head.r += -3 * up; out.tail.r += 6 * k * up;
    }
  }
  return out;
}

// ---- 2D affine [a, b, c, d, e, f] ----
const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
export const apply = (m, [x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
// About pivot p: rotate r, scale (sx, sy), then translate (x, y).
export function local([px, py], { r = 0, x = 0, y = 0, sx = 1, sy = 1 }) {
  const c = Math.cos(r * DEG), s = Math.sin(r * DEG), a = c * sx, b = s * sx, cc = -s * sy, d = c * sy;
  return [a, b, cc, d, px + x - (a * px + cc * py), py + y - (b * px + d * py)];
}

// Hero mode: one transform for the whole illustration about the feet.
// Arm and head moves fold into a small lean so the silhouette never breaks.
export function heroTransform(p, feet) {
  const lean = p.body.r + 0.008 * p['wing-near'].r + 0.15 * p.head.r;
  return local(feet, { r: lean, sx: p.body.sx * p.torso.sx, sy: p.body.sy * (1 + (p.torso.sy - 1) * 0.5) });
}

// Parts mode: world matrices for every part (parents before children).
// manifest: { width, height, feet: [x, y], parts: [{ id, src, pivot: [x, y], parent, z }], roles: { role: partId } }
export function partMatrices(manifest, p) {
  const byRole = Object.fromEntries(Object.entries(manifest.roles ?? {}).map(([role, id]) => [id, role]));
  const parts = new Map(manifest.parts.map((q) => [q.id, q])), world = new Map();
  const visit = (q) => {
    if (world.has(q.id)) return world.get(q.id);
    const parent = q.parent ? visit(parts.get(q.parent)) : local(manifest.feet, p.body);
    const role = byRole[q.id], m = mul(parent, role && role !== 'body' ? local(q.pivot, p[role]) : [1, 0, 0, 1, 0, 0]);
    world.set(q.id, m);
    return m;
  };
  for (const q of manifest.parts) visit(q);
  return world;
}
export const drawOrder = (manifest) => [...manifest.parts].sort((a, b) => a.z - b.z);

// ---- The live rig (browser) ----
export function createFrank(host, { manifest = null, hero = null, feet = null, reduced = null, now = () => performance.now() / 1000, random = Math.random } = {}) {
  const prefersReduced = () => (reduced ?? (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches));
  let active = [], raf = 0, nextBlink = 0, nextLetter = 0, el = null, canvas = null, images = null;
  const t0 = now();
  if (manifest) {
    canvas = Object.assign(document.createElement('canvas'), { width: manifest.width, height: manifest.height, className: 'frank-rig' });
    canvas.style.width = '100%'; canvas.style.height = '100%'; canvas.style.objectFit = 'contain';
    images = new Map(manifest.parts.map((q) => { const img = new Image(); img.src = q.src; return [q.id, img]; }));
    host.append(canvas);
  } else {
    el = host.querySelector('img') ?? Object.assign(document.createElement('img'), { src: hero, alt: 'Frank, the night-shift postal pigeon' });
    if (!el.isConnected) host.append(el);
    el.style.transformOrigin = feet ? `${feet[0]}px ${feet[1]}px` : '50% 100%';
    el.style.willChange = 'transform';
  }
  const schedule = (t) => { if (t >= nextBlink) { active.push({ clip: 'blink', start: t, opts: {} }); nextBlink = t + 2.8 + random() * 3.4; } if (t >= nextLetter) { if (nextLetter) active.push({ clip: 'letter', start: t, opts: {} }); nextLetter = t + 9 + random() * 7; } };
  function frame() {
    const t = now() - t0;
    if (!prefersReduced()) schedule(t);
    active = active.filter((a) => t - a.start <= CLIPS[a.clip](a.opts).length);
    const p = pose(t, active, { reduced: prefersReduced() });
    if (canvas) {
      const g = canvas.getContext('2d'), world = partMatrices(manifest, p);
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, canvas.width, canvas.height);
      for (const q of drawOrder(manifest)) { const img = images.get(q.id), m = world.get(q.id); if (!img?.complete || !img.naturalWidth) continue; g.setTransform(...m); g.drawImage(img, q.x ?? 0, q.y ?? 0); }
    } else {
      const [a, b, c, d] = heroTransform(p, [0, 0]);
      el.style.transform = prefersReduced() ? 'none' : `matrix(${a}, ${b}, ${c}, ${d}, 0, 0)`;
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  return {
    play(clip, opts = {}) { if (prefersReduced() || !CLIPS[clip]) return false; active = active.filter((a) => a.clip !== clip); active.push({ clip, start: now() - t0, opts }); return true; },
    pose: (t) => pose(t, active, { reduced: prefersReduced() }),
    destroy() { cancelAnimationFrame(raf); canvas?.remove(); },
  };
}

// Listen for the runtime's cues on any ancestor of .postmaster.
export function attachFrank(root, frank) {
  const on = (e) => {
    const d = e.detail ?? {};
    if (d.action === 'stamp') frank.play('stamp', d.value ?? 2);
    else if (d.action === 'bonus') frank.play('salute', d.tier ?? 'regular');
  };
  root.addEventListener('depot:frank', on);
  return () => root.removeEventListener('depot:frank', on);
}
