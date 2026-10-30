// Cyber Skunk mascot rig (ART_SPEC §1). A real bone hierarchy, not a moving
// picture: 25 parts, each turning about its pivot from pivots.json, children
// inheriting their parent's transform, drawn back to front in one canvas.
// - Legs are two-bone IK: whatever the torso does, both boots stay planted.
// - Clips (STYLE.md): idle with breathing, blinks and tail follow-through;
//   anticipate; spray (brace, swing over the shoulder, hold, recoil, recover);
//   recoil; release (Reservoir); win; bigwin; bonus. Clips blend into each other.
// - Art: ChatGPT's layers (assets/mascot/<part>.webp, trimmed by the prep tool
//   into layers.json) replace the vector placeholders below part by part.
const W = 1600, H = 2000, DEG = Math.PI / 180;
const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
const lerp = (a, b, k) => a + (b - a) * k;
const wave = (t, period, phase = 0) => Math.sin((t / period) * Math.PI * 2 + phase);

// ---- 2D affine matrices [a, b, c, d, e, f] (canvas order) ----
const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
const apply = (m, [x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const ID = [1, 0, 0, 1, 0, 0];
// About pivot p: translate by (x, y), rotate by r degrees, scale by (sx, sy).
function local([px, py], { r = 0, x = 0, y = 0, sx = 1, sy = 1 }) {
  const c = Math.cos(r * DEG), s = Math.sin(r * DEG);
  const a = c * sx, b = s * sx, cc = -s * sy, d = c * sy;
  return [a, b, cc, d, px + x - (a * px + cc * py), py + y - (b * px + d * py)];
}
const angle = ([x1, y1], [x2, y2]) => Math.atan2(y2 - y1, x2 - x1);
const dist = ([x1, y1], [x2, y2]) => Math.hypot(x2 - x1, y2 - y1);

// The tail's spray pose: CCD inverse kinematics on the 4 segments, each within
// the ±35° ART_SPEC allows, bringing the nozzle above the goggles; the nozzle
// itself then levels out to aim right, at the reels.
const TAIL = ['tail-1', 'tail-2', 'tail-3', 'tail-4'];
// At rest the tail is held a little closer behind the back (the tip behind the head).
const TUCK = [20, 0, 0, 0];
export function solveTail(joints, target, limit = 35) {
  const J = ['tail_root', 'tail_1', 'tail_2', 'tail_3', 'tail_tip'].map((k) => joints[k]);
  const seg = J.slice(1).map((p, k) => [p[0] - J[k][0], p[1] - J[k][1]]);
  const fk = (a) => { const p = [J[0]]; let w = 0; for (let k = 0; k < 4; k++) { w += a[k]; const c = Math.cos(w), s = Math.sin(w), [x, y] = seg[k]; p.push([p[k][0] + x * c - y * s, p[k][1] + x * s + y * c]); } return p; };
  const a = [0, 0, 0, 0], L = limit * DEG;
  for (let it = 0; it < 200; it++) for (let k = 3; k >= 0; k--) {
    const p = fk(a), d = angle(p[k], target) - angle(p[k], p[4]);
    a[k] = Math.max(-L, Math.min(L, a[k] + Math.atan2(Math.sin(d), Math.cos(d))));
  }
  const p = fk(a), sum = a.reduce((x, y) => x + y, 0);
  return { angles: a.map((x) => x / DEG), nozzle: -sum / DEG, tip: p[4], error: dist(p[4], target) };
}

// ---- Placeholder parts, drawn in place on the 1600 x 2000 canvas ----
const C = { ink: '#0a0c0e', fur: '#17191c', furHi: '#30353a', white: '#ece6d8', whiteSh: '#b5ad9d', jacket: '#2a3034', jacketHi: '#48525a', top: '#d8d0bf', pants: '#24292c', pantsHi: '#363d42', boot: '#131517', bootHi: '#2d3236', brass: '#a8733a', brassHi: '#e3b56b', amber: '#f2a53a', glove: '#1a1c1f', pink: '#b9777a' };
function poly(g, pts, fill, line = C.ink, width = 7) {
  g.beginPath(); pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
  g.fillStyle = fill; g.fill(); if (line) { g.lineJoin = 'round'; g.strokeStyle = line; g.lineWidth = width; g.stroke(); }
}
// A tapered limb from p1 to p2 with round caps (so joints overlap their parent).
function limb(g, p1, p2, r1, r2, fill, { jag = 0, line = C.ink, shade = null } = {}) {
  const a = angle(p1, p2), n = [-Math.sin(a), Math.cos(a)], pts = [], steps = jag ? 16 : 2;
  for (let k = 0; k <= steps; k++) { const t = k / steps, r = lerp(r1, r2, t) * (jag && k % 2 ? 1 + jag : 1); pts.push([lerp(p1[0], p2[0], t) + n[0] * r, lerp(p1[1], p2[1], t) + n[1] * r]); }
  for (let k = 0; k <= 10; k++) { const t = a - Math.PI / 2 + (k / 10) * Math.PI, r = r2 * (jag && k % 2 ? 1 + jag : 1); pts.push([p2[0] + Math.cos(t) * r, p2[1] + Math.sin(t) * r]); }
  for (let k = steps; k >= 0; k--) { const t = k / steps, r = lerp(r1, r2, t) * (jag && k % 2 ? 1 + jag : 1); pts.push([lerp(p1[0], p2[0], t) - n[0] * r, lerp(p1[1], p2[1], t) - n[1] * r]); }
  for (let k = 0; k <= 10; k++) { const t = a + Math.PI / 2 + (k / 10) * Math.PI, r = r1 * (jag && k % 2 ? 1 + jag : 1); pts.push([p1[0] + Math.cos(t) * r, p1[1] + Math.sin(t) * r]); }
  let paint = fill;
  if (shade) { const gr = g.createLinearGradient(p1[0] + n[0] * r1, p1[1] + n[1] * r1, p1[0] - n[0] * r1, p1[1] - n[1] * r1); gr.addColorStop(0, shade); gr.addColorStop(0.55, fill); gr.addColorStop(1, fill); paint = gr; }
  poly(g, pts, paint, line);
}
function ellipse(g, x, y, rx, ry, fill, rot = 0, line = C.ink, width = 7) {
  g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); g.fillStyle = fill; g.fill();
  if (line) { g.strokeStyle = line; g.lineWidth = width; g.stroke(); }
}
function tailSegment(g, p1, p2, r1, r2, stripe = true) {
  limb(g, p1, p2, r1, r2, C.fur, { jag: 0.08, shade: C.furHi });
  if (stripe) limb(g, p1, p2, r1 * 0.42, r2 * 0.42, C.white, { jag: 0.1, line: null, shade: C.whiteSh });
}
const PLACEHOLDER = {
  'tail-1': (g, j) => tailSegment(g, j.tail_root, j.tail_1, 120, 170),
  'tail-2': (g, j) => tailSegment(g, j.tail_1, j.tail_2, 172, 185),
  'tail-3': (g, j) => tailSegment(g, j.tail_2, j.tail_3, 182, 150),
  'tail-4': (g, j) => { tailSegment(g, j.tail_3, j.tail_tip, 150, 70); ellipse(g, j.tail_tip[0] - 40, j.tail_tip[1] + 4, 70, 58, C.white, 0, null); },
  nozzle: (g, j) => {
    const [x, y] = j.tail_tip;
    poly(g, [[x - 20, y - 34], [x + 90, y - 26], [x + 90, y + 26], [x - 20, y + 34]], C.brass);
    poly(g, [[x + 86, y - 36], [x + 118, y - 36], [x + 118, y + 36], [x + 86, y + 36]], C.brassHi);
    ellipse(g, x + 120, y, 10, 26, '#68c8c3', 0, C.ink, 5);
  },
  'far-upper-arm': (g, j) => limb(g, j.far_shoulder, j.far_elbow, 58, 46, C.jacket, { shade: C.jacketHi }),
  'far-forearm': (g, j) => limb(g, j.far_elbow, j.far_wrist, 46, 36, C.jacket, { shade: C.jacketHi }),
  'far-hand': (g, j) => {
    const [x, y] = j.far_wrist;
    ellipse(g, x + 18, y + 36, 46, 52, C.glove, 0.4);
    for (let k = 0; k < 4; k++) limb(g, [x + 30 + k * 8, y + 52 + k * 6], [x + 84 + k * 4, y + 66 + k * 18], 14, 12, C.glove);
    limb(g, [x - 6, y + 44], [x + 6, y + 92], 14, 12, C.glove);
  },
  'far-thigh': (g, j) => limb(g, j.far_hip, j.far_knee, 92, 68, C.pants, { shade: C.pantsHi }),
  'far-shin': (g, j) => limb(g, j.far_knee, j.far_ankle, 70, 58, C.pants, { shade: C.pantsHi }),
  'far-boot': (g, j) => boot(g, j.far_ankle, 0.95),
  torso: (g, j) => {
    const [px, py] = j.pelvis, ns = j.near_shoulder, fs = j.far_shoulder, nk = j.neck;
    // Pelvis and belt, then the white top, then the cropped jacket over it.
    poly(g, [[px - 150, py - 110], [px + 130, py - 120], [px + 140, py + 70], [px + 40, py + 120], [px - 120, py + 100], [px - 160, py + 40]], C.pants);
    poly(g, [[ns[0] + 30, ns[1] + 40], [fs[0] - 20, fs[1] + 40], [px + 90, py - 150], [px - 110, py - 140]], C.top);
    poly(g, [[px - 160, py - 160], [px + 135, py - 170], [px + 140, py - 110], [px - 160, py - 100]], '#3a2c1d');
    poly(g, [[px - 20, py - 172], [px + 40, py - 174], [px + 40, py - 100], [px - 20, py - 98]], C.brass);
    poly(g, [[nk[0] - 70, nk[1] - 10], [ns[0] - 50, ns[1] - 10], [ns[0] - 70, ns[1] + 120], [px - 140, py - 240], [px - 40, py - 250], [px - 30, ns[1] + 80], [nk[0] - 20, nk[1] + 40]], C.jacket);
    poly(g, [[nk[0] + 40, nk[1] - 10], [fs[0] + 40, fs[1] - 10], [fs[0] + 70, fs[1] + 110], [px + 120, py - 250], [px + 40, py - 255], [px + 30, fs[1] + 80], [nk[0] + 20, nk[1] + 40]], C.jacket);
    poly(g, [[nk[0] - 70, nk[1] - 10], [nk[0] - 110, nk[1] - 70], [nk[0] - 20, nk[1] + 30]], C.jacketHi); // collar
    poly(g, [[nk[0] + 40, nk[1] - 10], [nk[0] + 90, nk[1] - 74], [nk[0] + 30, nk[1] + 34]], C.jacketHi);
    for (const [dx, dy] of [[-120, -60], [100, -50]]) poly(g, [[px + dx - 40, py + dy], [px + dx + 40, py + dy], [px + dx + 40, py + dy + 80], [px + dx - 40, py + dy + 80]], '#3d3020'); // pouches
  },
  'near-thigh': (g, j) => limb(g, j.near_hip, j.near_knee, 100, 72, C.pants, { shade: C.pantsHi }),
  'near-shin': (g, j) => { limb(g, j.near_knee, j.near_ankle, 74, 62, C.pants, { shade: C.pantsHi }); ellipse(g, j.near_knee[0] + 4, j.near_knee[1], 56, 44, C.pantsHi, 0.3); },
  'near-boot': (g, j) => boot(g, j.near_ankle, 1.05),
  head: (g, j) => {
    const [nx, ny] = j.neck;
    limb(g, [nx - 10, ny + 40], [nx + 30, ny - 110], 70, 74, C.fur); // neck, capped under the collar
    poly(g, [[1110, 160], [1172, 70], [1186, 196]], C.fur); // far ear
    ellipse(g, 1060, 320, 160, 150, C.fur);
    poly(g, [[1150, 260], [1240, 330], [1262, 372], [1236, 400], [1150, 410], [1080, 380]], C.white, C.ink, 7); // snout
    ellipse(g, 1250, 368, 22, 18, C.ink, 0, null);
    poly(g, [[960, 140], [1040, 130], [1180, 300], [1150, 340], [1080, 300]], C.white, null); // the white stripe
    for (let k = 0; k < 7; k++) poly(g, [[930 + k * 24, 170 - k * 6], [960 + k * 26, 60 - k * 4], [990 + k * 22, 172 - k * 6]], k % 2 ? C.white : '#d9d2c3', null); // crest
    ellipse(g, 1128, 318, 26, 20, C.amber, 0.2, C.ink, 5); ellipse(g, 1132, 318, 8, 14, C.ink, 0, null); // eye
  },
  ear: (g, j) => { const [x, y] = j.ear; poly(g, [[x - 40, y + 70], [x - 30, y - 70], [x + 60, y + 60]], C.fur); poly(g, [[x - 20, y + 50], [x - 18, y - 30], [x + 34, y + 46]], C.pink, null); },
  jaw: (g, j) => { const [x, y] = j.jaw; poly(g, [[x - 20, y - 20], [x + 170, y - 46], [x + 190, y - 20], [x + 110, y + 18], [x + 10, y + 26]], C.white); g.strokeStyle = C.ink; g.lineWidth = 6; g.beginPath(); g.moveTo(x + 90, y - 36); g.quadraticCurveTo(x + 140, y - 20, x + 186, y - 42); g.stroke(); },
  eyelids: (g) => { poly(g, [[1098, 300], [1158, 304], [1160, 330], [1100, 330]], C.fur, C.ink, 5); },
  goggles: (g) => {
    limb(g, [930, 230], [1180, 226], 18, 18, '#3a2c1d');
    for (const [x, y, r] of [[1060, 214, 52], [1168, 222, 44]]) { ellipse(g, x, y, r + 12, r + 10, C.brass); ellipse(g, x, y, r, r - 4, C.amber, 0, C.ink, 5); ellipse(g, x - r * 0.3, y - r * 0.3, r * 0.25, r * 0.18, '#ffe2a6', -0.5, null); }
  },
  'near-upper-arm': (g, j) => limb(g, j.near_shoulder, j.near_elbow, 66, 54, C.jacket, { shade: C.jacketHi }),
  'near-forearm': (g, j) => {
    limb(g, j.near_elbow, j.near_wrist, 58, 50, C.brass, { shade: C.brassHi });
    const m = [lerp(j.near_elbow[0], j.near_wrist[0], 0.45), lerp(j.near_elbow[1], j.near_wrist[1], 0.45)];
    ellipse(g, m[0], m[1], 46, 24, C.amber, angle(j.near_elbow, j.near_wrist), C.ink, 5);
  },
  'near-hand': (g, j) => { const [x, y] = j.near_wrist; ellipse(g, x + 30, y + 40, 52, 58, C.glove, -0.3); limb(g, [x + 40, y + 60], [x + 90, y + 110], 18, 14, C.glove); },
  'near-cuff': (g, j) => { const a = angle(j.near_elbow, j.near_wrist), [x, y] = j.near_wrist; ellipse(g, x - Math.cos(a) * 34, y - Math.sin(a) * 34, 26, 62, C.brassHi, a, C.ink, 6); },
  'near-pauldron': (g, j) => { const [x, y] = j.near_shoulder; ellipse(g, x - 10, y + 6, 96, 82, C.brass, -0.4); ellipse(g, x - 18, y - 6, 64, 50, C.brassHi, -0.4, null); ellipse(g, x - 30, y + 10, 18, 18, C.amber, 0, C.ink, 4); },
};
function boot(g, [x, y], s) {
  poly(g, [[x - 70 * s, y - 50], [x + 60 * s, y - 60], [x + 80 * s, 1790], [x + 200 * s, 1820], [x + 214 * s, 1880], [x - 90 * s, 1880], [x - 96 * s, 1800]], C.boot);
  poly(g, [[x - 92 * s, 1850], [x + 214 * s, 1850], [x + 214 * s, 1880], [x - 92 * s, 1880]], '#08090a', null);
  for (const dy of [0, 70]) poly(g, [[x - 74 * s, y + dy], [x + 66 * s, y + dy - 6], [x + 70 * s, y + dy + 22], [x - 76 * s, y + dy + 28]], C.brass, C.ink, 5);
}

// ---- Clips: each fills a pose { part: { r, x, y, sx, sy, alpha } } at time t (s) ----
function idle(t, P, amp = 1) {
  const br = wave(t, 3.4) * amp;
  P.torso = { y: -4 * br, r: 0.5 * br };
  P.head = { r: 1.4 * wave(t, 5.3, 0.6) * amp + 0.6 * br };
  P.ear = { r: 3 * wave(t, 2.6, 1) * amp + (t % 7.3 < 0.25 ? 14 * Math.sin((t % 7.3) / 0.25 * Math.PI) : 0) };
  P.jaw = { r: 0 };
  // Tail follow-through: the same sway reaches each segment a little later.
  TAIL.forEach((k, n) => { P[k] = { r: TUCK[n] + [1.5, 2.5, 3.5, 5][n] * wave(t, 3.9, -n * 0.7) * amp }; });
  P.nozzle = { r: 4 * wave(t, 3.9, -2.8) * amp };
  P['far-upper-arm'] = { r: 1.6 * br }; P['far-forearm'] = { r: 2.5 * wave(t, 4.4, 0.8) * amp }; P['far-hand'] = { r: 3 * wave(t, 4.4, 0.2) * amp };
  P['near-upper-arm'] = { r: -0.6 * br }; P['near-forearm'] = { r: 0.6 * br };
  const b = t % 4.6, double = Math.floor(t / 4.6) % 3 === 2;
  P.eyelids = { alpha: b < 0.13 || (double && b > 0.26 && b < 0.38) ? 1 : 0 };
}
const CLIPS = {
  idle: { loop: true, fn: (t, P) => idle(t, P) },
  anticipate: { loop: true, fn(t, P) {
    idle(t, P, 0.5);
    const k = ease(t / 0.35);
    P.torso = { r: 3 * k + 0.6 * wave(t, 0.5), y: 8 * k };
    P.head = { r: -4 * k };
    TAIL.forEach((p, n) => { P[p].r += [-6, 8, 10, 12][n] * k + 2 * wave(t, 0.22, n) * k; });
    P['far-upper-arm'] = { r: -12 * k }; P['far-forearm'] = { r: -20 * k }; P['far-hand'] = { r: -14 * k };
    P.eyelids = { alpha: 0 };
  } },
  spray: { length: 1.9, release: 0.55, fn(t, P, rig) {
    idle(t, P, 0.4);
    const brace = ease(t / 0.25) * (1 - ease((t - 1.35) / 0.5)), swing = ease((t - 0.18) / 0.37) * (1 - ease((t - 1.3) / 0.6));
    const shake = t > 0.55 && t < 1.3 ? wave(t, 0.06) : 0;
    P.torso = { r: -3 * brace + 1.2 * shake * swing, y: 14 * brace };
    P.head = { r: -6 * swing + 2 * brace };
    TAIL.forEach((p, n) => { P[p] = { r: lerp(P[p].r, rig.sprayPose.angles[n] + (n === 2 ? 2 * shake : 0), swing) }; });
    P.nozzle = { r: lerp(P.nozzle.r, rig.sprayPose.nozzle + 4 * shake, swing) };
    P['far-upper-arm'] = { r: -28 * swing }; P['far-forearm'] = { r: -36 * swing }; P['far-hand'] = { r: -20 * swing };
    P.jaw = { r: 6 * swing };
    P.ear = { r: -10 * swing };
  } },
  recoil: { length: 0.6, fn(t, P) { idle(t, P); const k = Math.sin(Math.min(1, t / 0.6) * Math.PI); P.torso = { r: -4 * k, y: 6 * k }; P.head.r -= 5 * k; P['tail-4'].r -= 10 * k; P.nozzle.r -= 14 * k; } },
  release: { length: 0.9, fn(t, P) { idle(t, P); const k = Math.sin(Math.min(1, t / 0.9) * Math.PI); P.head.r -= 6 * k; P.ear.r -= 18 * k; P.jaw = { r: 8 * k }; TAIL.forEach((p, n) => { P[p].r += [3, -6, -8, -10][n] * k; }); } },
  win: { length: 1.5, fn(t, P) {
    idle(t, P);
    const up = ease(t / 0.3) * (1 - ease((t - 1.1) / 0.4)), pump = up * wave(t, 0.36);
    P['far-upper-arm'] = { r: -95 * up + 8 * pump }; P['far-forearm'] = { r: -50 * up - 10 * pump }; P['far-hand'] = { r: -30 * up };
    P.head = { r: -5 * up + 3 * pump }; P.jaw = { r: 7 * up };
    P.torso = { r: -1.5 * up, y: -4 * up + 4 * pump };
  } },
  bigwin: { length: 2.8, fn(t, P) {
    idle(t, P);
    const up = ease(t / 0.35) * (1 - ease((t - 2.3) / 0.5)), pump = up * wave(t, 0.42);
    P['far-upper-arm'] = { r: -120 * up + 10 * pump }; P['far-forearm'] = { r: -30 * up - 18 * pump }; P['far-hand'] = { r: -20 * up };
    P['near-upper-arm'] = { r: 8 * up * wave(t, 0.42, 1) };
    P.head = { r: -10 * up + 4 * pump }; P.jaw = { r: 11 * up }; P.ear = { r: -12 * up };
    TAIL.forEach((p, n) => { P[p].r += [-4, 8, 12, 16][n] * up * wave(t, 0.7, -n * 0.8); });
    P.torso = { r: -2 * up + pump, y: -6 * up + 6 * pump };
  } },
  bonus: { length: 2.2, fn(t, P, rig) {
    idle(t, P);
    const k = ease(t / 0.5) * (1 - ease((t - 1.6) / 0.6));
    TAIL.forEach((p, n) => { P[p] = { r: lerp(P[p].r, rig.sprayPose.angles[n] * 0.85, k) }; });
    P.nozzle = { r: lerp(P.nozzle.r, rig.sprayPose.nozzle, k) };
    P['far-upper-arm'] = { r: -100 * k }; P['far-forearm'] = { r: -60 * k + 10 * k * wave(t, 0.3) }; P['far-hand'] = { r: -25 * k };
    P.head = { r: -6 * k }; P.jaw = { r: 9 * k }; P.torso = { r: -2 * k, y: -6 * k };
  } },
};
export const CLIP_NAMES = Object.keys(CLIPS);

// Everything the rig derives from pivots.json: draw order, parents-first
// order, the solved spray pose and the two IK legs.
export function prepare(rig) {
  const order = Object.entries(rig.parts).sort((a, b) => a[1].order - b[1].order).map(([k]) => k);
  const topo = [], seen = new Set();
  const visit = (k) => { if (seen.has(k)) return; const p = rig.parts[k].parent; if (p) visit(p); seen.add(k); topo.push(k); };
  Object.keys(rig.parts).forEach(visit);
  const legs = ['near', 'far'].map((side) => {
    const hip = rig.joints[`${side}_hip`], knee = rig.joints[`${side}_knee`], ankle = rig.joints[`${side}_ankle`];
    const cross = (knee[0] - hip[0]) * (ankle[1] - hip[1]) - (knee[1] - hip[1]) * (ankle[0] - hip[0]);
    return { side, hip, knee, ankle, l1: dist(hip, knee), l2: dist(knee, ankle), bend: Math.sign(cross) || 1 };
  });
  return { rig, joints: rig.joints, order, topo, legs, sprayPose: solveTail(rig.joints, SPRAY_TARGET) };
}
export const SPRAY_TARGET = [1240, 170]; // above the goggles; the nozzle then levels to aim at the reels
export { apply, CLIPS, PLACEHOLDER };

export class Skunk {
  constructor(host) {
    this.host = host; this.canvas = document.createElement('canvas'); this.canvas.className = 'mascot-canvas';
    host.append(this.canvas); this.g = this.canvas.getContext('2d');
    this.images = new Map(); this.layers = {}; this.clip = 'idle'; this.t0 = performance.now(); this.from = null; this.blend = 1;
    this.manual = null; this.showJoints = false; this.scale = 1; this.ready = false; this.time = 0;
    this.reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  }
  // Painted layers replace the vector parts only once all of them are in
  // (requireAll), so the game never shows a half-painted skunk; the rig
  // preview passes requireAll: false to review a partial drop.
  async load(base = 'assets/mascot/', { requireAll = true } = {}) {
    this.base = base;
    const rig = await fetch(`${base}pivots.json`).then((r) => r.json());
    Object.assign(this, prepare(rig));
    try {
      let layers = await fetch(`${base}layers.json`).then((r) => (r.ok ? r.json() : {}));
      if (requireAll && !Object.keys(this.rig.parts).every((k) => layers[k])) layers = {};
      await Promise.all(Object.entries(layers).map(([k, box]) => new Promise((resolve) => {
        const img = new Image(); img.onload = () => { this.images.set(k, img); this.layers[k] = box; resolve(); }; img.onerror = resolve; img.src = `${base}${box.file || k + '.webp'}`;
      })));
    } catch { /* placeholders only */ }
    this.ready = true; this.resize(this.scale);
    this.#frame();
    return this.images.size;
  }
  get usesArt() { return this.images.size; }
  resize(stageScale = 1) {
    this.scale = stageScale;
    const r = this.host.getBoundingClientRect(), dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(Math.min(1600, r.width * dpr))), h = Math.round((w * H) / W);
    if (this.canvas.width !== w) { this.canvas.width = w; this.canvas.height = h; }
  }
  play(name) {
    if (!CLIPS[name] || (name === this.clip && CLIPS[name].loop)) return;
    this.from = { clip: this.clip, t: this.#t() }; this.blend = 0; this.clip = name; this.t0 = performance.now();
  }
  // Starts the spray; resolves when the nozzle releases (the jet starts).
  spray() { this.play('spray'); return new Promise((r) => setTimeout(r, CLIPS.spray.release * 1000)); }
  #t() { return (performance.now() - this.t0) / 1000; }
  pose(clip = this.clip, t = this.#t()) {
    const P = {};
    CLIPS[clip].fn(t, P, this);
    return P;
  }
  // The pose to draw now: the clip, blended from the last one over 0.25 s.
  current() {
    if (this.manual) return this.manual;
    let t = this.#t(), clip = CLIPS[this.clip];
    if (clip.length && t >= clip.length) { this.from = { clip: this.clip, t }; this.blend = 0; this.clip = 'idle'; this.t0 = performance.now(); t = 0; clip = CLIPS.idle; }
    const P = this.pose(this.clip, t);
    if (this.from && this.blend < 1) {
      this.blend = Math.min(1, this.blend + 1 / 15);
      const k = ease(this.blend), F = this.pose(this.from.clip, this.from.t);
      for (const part of new Set([...Object.keys(P), ...Object.keys(F)])) {
        const a = F[part] || {}, b = P[part] || {};
        P[part] = { r: lerp(a.r || 0, b.r || 0, k), x: lerp(a.x || 0, b.x || 0, k), y: lerp(a.y || 0, b.y || 0, k), sx: lerp(a.sx ?? 1, b.sx ?? 1, k), sy: lerp(a.sy ?? 1, b.sy ?? 1, k), alpha: b.alpha ?? a.alpha };
      }
    }
    return P;
  }
  // World transforms, with the legs solved so the ankles stay where they stand.
  world(P) {
    const parts = this.rig.parts, M = {}, rot = {};
    // The hips never rise beyond what the legs reach: the torso drops just enough.
    const T = P.torso || {}, Mt = local(parts.torso.pivot, T);
    let drop = 0;
    for (const leg of this.legs) {
      const [hx, hy] = apply(Mt, leg.hip), reach = leg.l1 + leg.l2 - 2, dx = hx - leg.ankle[0];
      if (Math.hypot(dx, hy - leg.ankle[1]) > reach) drop = Math.max(drop, leg.ankle[1] - Math.sqrt(Math.max(0, reach ** 2 - dx ** 2)) - hy);
    }
    if (drop > 0) P = { ...P, torso: { ...T, y: (T.y || 0) + drop } };
    for (const k of this.topo) {
      const p = parts[k], parent = p.parent ? M[p.parent] : ID;
      M[k] = mul(parent, local(p.pivot, P[k] || {}));
      rot[k] = (p.parent ? rot[p.parent] : 0) + (P[k]?.r || 0);
    }
    for (const leg of this.legs) {
      const hipW = apply(M.torso, leg.hip), d = Math.max(Math.abs(leg.l1 - leg.l2) + 1, Math.min(leg.l1 + leg.l2 - 1, dist(hipW, leg.ankle)));
      const alpha = Math.acos(Math.max(-1, Math.min(1, (leg.l1 ** 2 + d ** 2 - leg.l2 ** 2) / (2 * leg.l1 * d))));
      const thighDir = angle(hipW, leg.ankle) - leg.bend * alpha;
      const knee = [hipW[0] + Math.cos(thighDir) * leg.l1, hipW[1] + Math.sin(thighDir) * leg.l1];
      const dThigh = (thighDir - angle(leg.hip, leg.knee)) / DEG, dShin = (angle(knee, leg.ankle) - angle(leg.knee, leg.ankle)) / DEG;
      const thigh = `${leg.side}-thigh`, shin = `${leg.side}-shin`, bootK = `${leg.side}-boot`;
      M[thigh] = mul(M.torso, local(parts[thigh].pivot, { r: dThigh - rot.torso }));
      M[shin] = mul(M[thigh], local(parts[shin].pivot, { r: dShin - dThigh }));
      M[bootK] = mul(M[shin], local(parts[bootK].pivot, { r: -dShin }));
    }
    return M;
  }
  // Where the nozzle's mouth is right now, as a fraction of the mascot box (0..1).
  nozzle() {
    const M = this.lastWorld; if (!M) return null;
    const [x, y] = apply(M.nozzle, [this.joints.tail_tip[0] + 120, this.joints.tail_tip[1]]);
    return [x / W, y / H];
  }
  // The vector placeholders, drawn once per canvas size into bitmaps trimmed to
  // their pixels, so a frame is 25 image draws (as with painted layers) rather
  // than every path, gradient and fur edge again.
  bake() {
    const s = this.canvas.width / W;
    if (this.bakedScale === s) return;
    this.bakedScale = s; this.baked = new Map();
    const full = document.createElement('canvas'); full.width = Math.ceil(W * s); full.height = Math.ceil(H * s);
    const g = full.getContext('2d', { willReadFrequently: true }), pad = 2;
    for (const k of this.order) {
      if (this.images.has(k) || !PLACEHOLDER[k]) continue;
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, full.width, full.height);
      g.setTransform(s, 0, 0, s, 0, 0); PLACEHOLDER[k](g, this.joints);
      const { data, width, height } = g.getImageData(0, 0, full.width, full.height);
      let x0 = width, y0 = height, x1 = -1, y1 = -1;
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 < 0) continue;
      x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(width - 1, x1 + pad); y1 = Math.min(height - 1, y1 + pad);
      const crop = document.createElement('canvas'); crop.width = x1 - x0 + 1; crop.height = y1 - y0 + 1;
      crop.getContext('2d').drawImage(full, x0, y0, crop.width, crop.height, 0, 0, crop.width, crop.height);
      this.baked.set(k, { img: crop, x: x0 / s, y: y0 / s, w: crop.width / s, h: crop.height / s });
    }
  }
  draw(P = this.current()) {
    const g = this.g, s = this.canvas.width / W, M = this.world(P);
    this.lastWorld = M;
    this.bake();
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    // Contact shadow under the planted boots (not part of any layer).
    g.setTransform(s, 0, 0, s, 0, 0);
    const sh = g.createRadialGradient(860, 1880, 20, 860, 1880, 420); sh.addColorStop(0, '#000a'); sh.addColorStop(1, '#0000');
    g.fillStyle = sh; g.beginPath(); g.ellipse(860, 1880, 420, 70, 0, 0, Math.PI * 2); g.fill();
    for (const k of this.order) {
      const alpha = P[k]?.alpha ?? (k === 'eyelids' ? 0 : 1);
      if (alpha <= 0) continue;
      const m = M[k]; g.setTransform(m[0] * s, m[1] * s, m[2] * s, m[3] * s, m[4] * s, m[5] * s); g.globalAlpha = alpha;
      const img = this.images.get(k), box = this.layers[k], baked = this.baked.get(k);
      if (img) g.drawImage(img, box.x, box.y, box.w, box.h);
      else if (baked) g.drawImage(baked.img, baked.x, baked.y, baked.w, baked.h);
      else PLACEHOLDER[k]?.(g, this.joints);
    }
    g.globalAlpha = 1;
    if (this.showJoints) this.#joints(M, s);
    return M;
  }
  #joints(M, s) {
    const g = this.g; g.setTransform(s, 0, 0, s, 0, 0);
    for (const [k, p] of Object.entries(this.rig.parts)) {
      const [x, y] = apply(M[k], p.pivot), parent = p.parent ? apply(M[p.parent], this.rig.parts[p.parent].pivot) : null;
      if (parent) { g.strokeStyle = '#eda83c'; g.lineWidth = 6; g.beginPath(); g.moveTo(...parent); g.lineTo(x, y); g.stroke(); }
      g.fillStyle = '#eda83c'; g.beginPath(); g.arc(x, y, 14, 0, Math.PI * 2); g.fill();
    }
  }
  #frame() {
    if (!document.hidden) this.draw();
    requestAnimationFrame(() => this.#frame());
  }
}
