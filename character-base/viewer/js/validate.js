// In-page validation of a character GLB loaded in a fresh viewer instance.
// Injected by scripts/validate.mjs; operates only on what the GLB (+ its JSON) contains.
import * as THREE from 'three';
import { DRIVERS, PART_ORDER } from './character.js';

const bl2gl = (v) => new THREE.Vector3(v[0], v[2], -v[1]);

function coincidentGroups(ch) {
  // vertices (any part) sharing the same rest position: part boundaries + UV-seam splits
  const map = new Map();
  for (const [name, m] of Object.entries(ch.parts)) {
    const p = m.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const k = `${p.getX(i).toFixed(5)},${p.getY(i).toFixed(5)},${p.getZ(i).toFixed(5)}`;
      if (!map.has(k)) map.set(k, []);
      map.get(k).push([name, i]);
    }
  }
  const groups = [...map.values()].filter((g) => g.length > 1);
  const cross = groups.filter((g) => new Set(g.map((x) => x[0])).size > 1);
  return { groups, cross };
}

function frameTimes(clip, step = 3) {
  const n = Math.round(clip.duration * 30);
  const out = [];
  for (let f = 0; f <= n; f += step) out.push(f / 30);
  return out;
}

function maxGap(ch, groups) {
  let worst = 0, where = null;
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  for (const g of groups) {
    ch.skinnedPosition(g[0][0], g[0][1], a);
    for (let k = 1; k < g.length; k++) {
      ch.skinnedPosition(g[k][0], g[k][1], b);
      const d = a.distanceTo(b);
      if (!(d <= worst)) { worst = d; where = `${g[0][0]}#${g[0][1]} vs ${g[k][0]}#${g[k][1]}`; }
    }
  }
  return { worst, where };
}

function basisAngle(ch, name) {
  const q = ch.basis(name);
  return 2 * Math.acos(Math.min(1, Math.abs(q.w)));
}

export async function validate(opts = {}) {
  const v = window.viewer;
  const ch = v.character;
  const cfg = v.state.cfg;
  const R = { checks: [], info: {} };
  const check = (id, ok, detail) => R.checks.push({ id, ok: !!ok, detail });

  // ---------------- structure ----------------
  const partNames = Object.keys(ch.parts);
  check('parts.present', PART_ORDER.every((n) => ch.parts[n]) && partNames.length === 16, `found ${partNames.length}: ${partNames.join(', ')}`);
  const skels = new Set(Object.values(ch.parts).map((m) => m.skeleton));
  const boneSets = new Set(Object.values(ch.parts).map((m) => m.skeleton.bones.map((b) => b.name).join('|')));
  check('skeleton.single', boneSets.size === 1, `${skels.size} Skeleton objects, ${boneSets.size} distinct joint lists, ${ch.skeleton.bones.length} joints`);
  const expectBones = cfg ? cfg.skeleton.bones.map((b) => b.name) : null;
  if (expectBones) check('skeleton.matchesConfig', expectBones.every((b) => ch.bones[b]), `${expectBones.length} bones in config`);
  const sockParents = { socket_hand_L_prop: 'hand_L', socket_hand_R_prop: 'hand_R', socket_head_accessory: 'head', socket_back_accessory: 'chest' };
  check('sockets.parented', Object.entries(sockParents).every(([s, p]) => ch.sockets[s] && ch.sockets[s].parent && ch.sockets[s].parent.name === p),
    Object.entries(sockParents).map(([s, p]) => `${s}->${ch.sockets[s] && ch.sockets[s].parent ? ch.sockets[s].parent.name : 'MISSING'}`).join(', '));
  const clipNames = ch.clips.map((c) => c.name);
  check('clips.named', ['idle', 'reach_grip_handle', 'press_button'].every((n) => clipNames.includes(n)), clipNames.join(', '));
  let uvOk = true, uvCount = 0;
  for (const m of Object.values(ch.parts)) {
    const uv = m.geometry.attributes.uv;
    if (!uv) { uvOk = false; continue; }
    for (let i = 0; i < uv.count; i++) { const x = uv.getX(i), y = uv.getY(i); uvCount++; if (!(x >= 0 && x <= 1 && y >= 0 && y <= 1)) uvOk = false; }
  }
  check('uv.inRange', uvOk, `${uvCount} UVs in [0,1]`);
  let maxInf = 0, wsumErr = 0;
  for (const m of Object.values(ch.parts)) {
    const w = m.geometry.attributes.skinWeight;
    for (let i = 0; i < w.count; i++) {
      const s = w.getX(i) + w.getY(i) + w.getZ(i) + w.getW(i);
      wsumErr = Math.max(wsumErr, Math.abs(1 - s));
      maxInf = Math.max(maxInf, [w.getX(i), w.getY(i), w.getZ(i), w.getW(i)].filter((x) => x > 0).length);
    }
  }
  check('weights.normalized', wsumErr < 2e-3, `max |1-sum| = ${wsumErr.toExponential(2)}, max influences ${maxInf}`);
  const mat = Object.values(ch.parts)[0].material;
  R.info.material = { type: mat.type, hasMap: !!mat.map, mapSize: mat.map && mat.map.image ? [mat.map.image.width, mat.map.image.height] : null };
  if (cfg && cfg.material.mode === 'texture') check('material.texture', !!mat.map && mat.map.image.width >= 1024, JSON.stringify(R.info.material));

  // ---------------- rest-pose seams ----------------
  ch.resetPose();
  const { groups, cross } = coincidentGroups(ch);
  R.info.coincidentGroups = groups.length;
  R.info.crossPartGroups = cross.length;
  const perBoundary = {};
  for (const g of cross) { const k = [...new Set(g.map((x) => x[0]))].sort().join('+'); perBoundary[k] = (perBoundary[k] || 0) + 1; }
  R.info.boundaries = perBoundary;
  check('seams.boundaryLoops', Object.keys(perBoundary).length >= 15, `${cross.length} shared boundary vertices across ${Object.keys(perBoundary).length} part pairs`);
  // normals equal at boundaries (rest)
  let nWorst = 1;
  const na = new THREE.Vector3(), nb = new THREE.Vector3();
  for (const g of cross) {
    const [p0, i0] = g[0];
    na.fromBufferAttribute(ch.parts[p0].geometry.attributes.normal, i0);
    for (let k = 1; k < g.length; k++) { nb.fromBufferAttribute(ch.parts[g[k][0]].geometry.attributes.normal, g[k][1]); nWorst = Math.min(nWorst, na.dot(nb)); }
  }
  check('seams.normalsMatch', nWorst > 0.9999, `min dot of boundary normals ${nWorst.toFixed(6)}`);

  // ---------------- animated checks ----------------
  const chainPairs = [['upperarm_L', 'forearm_L'], ['forearm_L', 'hand_L'], ['upperarm_R', 'forearm_R'], ['forearm_R', 'hand_R'],
    ['thigh_L', 'shin_L'], ['shin_L', 'foot_L'], ['thigh_R', 'shin_R'], ['shin_R', 'foot_R'], ['index_02_L', 'index_03_L'], ['neck', 'head']];
  const restLen = {};
  ch.resetPose();
  for (const [a, b] of chainPairs) restLen[a] = ch.worldPos(ch.bones[a]).distanceTo(ch.worldPos(ch.bones[b]));
  const sockRel = {};
  const relOf = (s, p) => new THREE.Matrix4().copy(ch.bones[p].matrixWorld).invert().multiply(ch.sockets[s].matrixWorld);
  for (const [s, p] of Object.entries(sockParents)) sockRel[s] = relOf(s, p);
  let gapWorst = 0, gapWhere = null, lenWorst = 0, lenWhere = null, sockWorst = 0, drvWorst = 0, drvWhere = null, frames = 0, nan = false;
  const clipReport = {};
  for (const clip of ch.clips) {
    let cg = 0;
    for (const t of frameTimes(clip, opts.step || 3)) {
      ch.poseAtClip(clip.name, t);
      frames++;
      const g = maxGap(ch, groups);
      if (!Number.isFinite(g.worst)) nan = true;
      cg = Math.max(cg, g.worst);
      if (g.worst > gapWorst) { gapWorst = g.worst; gapWhere = `${clip.name}@${t.toFixed(2)}s ${g.where}`; }
      for (const [a, b] of chainPairs) {
        const d = Math.abs(ch.worldPos(ch.bones[a]).distanceTo(ch.worldPos(ch.bones[b])) - restLen[a]);
        if (d > lenWorst) { lenWorst = d; lenWhere = `${a}->${b} ${clip.name}@${t.toFixed(2)}`; }
      }
      for (const [s, p] of Object.entries(sockParents)) {
        const r = relOf(s, p).elements, r0 = sockRel[s].elements;
        for (let i = 0; i < 16; i++) sockWorst = Math.max(sockWorst, Math.abs(r[i] - r0[i]));
      }
      for (const [h, [src, mode]] of Object.entries(DRIVERS)) {
        const a = basisAngle(ch, h), full = mode === 'half' ? basisAngle(ch, src) : null;
        if (mode === 'half') { const e = Math.abs(a - full / 2); if (e > drvWorst) { drvWorst = e; drvWhere = `${h} ${clip.name}@${t.toFixed(2)}`; } }
      }
    }
    clipReport[clip.name] = { maxSeamGap: cg };
  }
  R.info.framesChecked = frames;
  R.info.clipSeamGaps = clipReport;
  check('seams.noCracksInClips', gapWorst < 1e-5 && !nan, `max gap ${gapWorst.toExponential(2)} m over ${frames} frames (${gapWhere})`);
  check('bones.lengthsConstant', lenWorst < 1e-5, `max length drift ${lenWorst.toExponential(2)} m (${lenWhere}) – forearms/shins never shorten`);
  check('sockets.followBones', sockWorst < 1e-5, `max change of socket-in-bone matrix ${sockWorst.toExponential(2)}`);
  check('helpers.halfRotation', drvWorst < THREE.MathUtils.degToRad(0.6), `max |helper - source/2| = ${THREE.MathUtils.radToDeg(drvWorst).toFixed(3)} deg (${drvWhere})`);

  // ---------------- hands: palm / thumb orientation (rest) ----------------
  ch.resetPose();
  const hands = {};
  for (const s of ['L', 'R']) {
    const hand = ch.bones[`hand_${s}`];
    const palm = new THREE.Vector3(0, 0, 1).applyQuaternion(ch.worldRot(hand));
    const thumbTip = ch.worldPos(ch.bones[`thumb_03_${s}`]);
    const idx = ch.worldPos(ch.bones[`index_01_${s}`]);
    const pinky = ch.worldPos(ch.bones[`pinky_01_${s}`]);
    const sx = s === 'L' ? 1 : -1;
    hands[s] = { palmNormal: palm.toArray().map((x) => +x.toFixed(3)), thumbForwardOfIndex: +(thumbTip.z - idx.z).toFixed(4), indexForwardOfPinky: +(idx.z - pinky.z).toFixed(4) };
    check(`hand_${s}.palmFacesBody`, palm.x * sx < -0.3 && palm.y < 0, `palm normal ${hands[s].palmNormal.join(',')} (expected toward the body and down)`);
    check(`hand_${s}.thumbRadialSide`, thumbTip.z > idx.z && idx.z > pinky.z, `thumb ${hands[s].thumbForwardOfIndex} m in front of index knuckle; index ${hands[s].indexForwardOfPinky} m in front of pinky (A-pose, palms in)`);
  }

  // ---------------- props: grip and button ----------------
  if (cfg && cfg.testProps) {
    const h = cfg.testProps.handle;
    const c = bl2gl(h.center), ax = bl2gl(h.axis).normalize(), rad = h.radius, len = h.length;
    const meta = cfg.animations.find((a) => a.name === 'reach_grip_handle');
    const holdT = (meta.markers.gripClosed + meta.markers.release) / 2 / 30;
    ch.poseAtClip('reach_grip_handle', holdT);
    const p = new THREE.Vector3();
    let inside = 0, deepest = 0, near = Infinity, contactVerts = 0;
    const hm = ch.parts.Hand_R;
    for (let i = 0; i < hm.geometry.attributes.position.count; i++) {
      ch.skinnedPosition('Hand_R', i, p);
      const rel = p.clone().sub(c); const along = rel.dot(ax);
      if (Math.abs(along) > len / 2) continue;
      const dist = rel.sub(ax.clone().multiplyScalar(along)).length() - rad;
      near = Math.min(near, dist);
      if (dist < -0.001) { inside++; deepest = Math.min(deepest, dist); }
      if (dist < 0.004) contactVerts++;
    }
    const sock = ch.sockets.socket_hand_R_prop.getWorldPosition(new THREE.Vector3());
    const sockErr = sock.clone().sub(c).sub(ax.clone().multiplyScalar(sock.clone().sub(c).dot(ax))).length();
    R.info.grip = { holdTime: holdT, verticesInsideHandle: inside, deepest_mm: +(deepest * 1000).toFixed(2), contactVertices: contactVerts, socketToAxis_mm: +(sockErr * 1000).toFixed(3) };
    check('grip.noPenetration', inside === 0 || deepest > -0.0025, `${inside} hand vertices >1 mm inside the handle (deepest ${(deepest * 1000).toFixed(2)} mm)`);
    check('grip.contact', contactVerts >= 30 && sockErr < 0.001, `${contactVerts} vertices within 4 mm of the handle surface; socket ${(sockErr * 1000).toFixed(3)} mm from the handle axis`);
    const b = cfg.testProps.button, top = bl2gl(b.top);
    const pm = cfg.animations.find((a) => a.name === 'press_button');
    const tipMin = (t) => {
      ch.poseAtClip('press_button', t);
      let best = Infinity, bestP = null;
      const m = ch.parts.Hand_L;
      for (let i = 0; i < m.geometry.attributes.position.count; i++) {
        ch.skinnedPosition('Hand_L', i, p);
        if (Math.hypot(p.x - top.x, p.z - top.z) < b.radius && p.y < best) { best = p.y; bestP = p.clone(); }
      }
      return best - top.y;
    };
    const atContact = tipMin(pm.markers.contact / 30), atPress = tipMin(pm.markers.pressed / 30);
    R.info.press = { fingertipAboveButtonAtContact_mm: +(atContact * 1000).toFixed(2), pressDepth_mm: +(-atPress * 1000).toFixed(2), travel_mm: b.travel * 1000 };
    check('press.contact', Math.abs(atContact) < 0.004, `fingertip ${(atContact * 1000).toFixed(2)} mm from button top at contact frame; pressed ${(-atPress * 1000).toFixed(2)} mm (button travel ${(b.travel * 1000).toFixed(1)} mm)`);
  }
  // ---------------- extended clip set: locomotion, float, weapons ----------------
  const metaOf = (n) => (cfg && cfg.animations ? cfg.animations.find((a) => a.name === n) : null);
  const EXTENDED = ['walk_in_place', 'run_in_place', 'jump_in_place', 'float_idle', 'float_monk', 'float_monk_loop',
    'sword_2h_idle', 'sword_2h_slash', 'staff_idle', 'staff_strike', 'pistol_aim', 'pistol_fire', 'rifle_aim', 'rifle_fire', 'wave', 'cheer'];
  if (clipNames.includes('walk_in_place')) {
    check('clips.extendedSet', EXTENDED.every((n) => clipNames.includes(n)), EXTENDED.filter((n) => !clipNames.includes(n)).join(', ') || `${EXTENDED.length} clips present`);
    const p = new THREE.Vector3();
    const footMin = () => {
      let m = Infinity;
      for (const part of ['Foot_L', 'Foot_R']) {
        const n = ch.parts[part].geometry.attributes.position.count;
        for (let i = 0; i < n; i += 2) { ch.skinnedPosition(part, i, p); if (p.y < m) m = p.y; }
      }
      return m;
    };
    ch.resetPose();
    const ground = footMin();
    let sinkWorst = 0, sinkWhere = null;
    const hover = {}, drift = {}, sink = {};
    for (const clip of ch.clips) {
      let lo = Infinity;
      const pel = [];
      for (const t of frameTimes(clip, opts.step || 3)) {
        ch.poseAtClip(clip.name, t);
        const m = footMin();
        lo = Math.min(lo, m);
        if (!clip.name.startsWith('_') && ground - m > sinkWorst) { sinkWorst = ground - m; sinkWhere = `${clip.name}@${t.toFixed(2)}s`; }
        pel.push(ch.worldPos(ch.bones.pelvis));
      }
      sink[clip.name] = +Math.max(0, (ground - lo) * 1000).toFixed(1);
      if (clip.name.startsWith('float')) hover[clip.name] = +(lo - ground).toFixed(3);
      if (clip.name.endsWith('_in_place')) {
        const span = (k) => Math.max(...pel.map((v) => v[k])) - Math.min(...pel.map((v) => v[k]));
        drift[clip.name] = +Math.max(span('x'), span('z')).toFixed(3);
      }
    }
    // float_monk starts standing and ends hovering: check its last frame
    const fm = ch.clip('float_monk');
    ch.poseAtClip('float_monk', fm.duration);
    hover['float_monk(end)'] = +(footMin() - ground).toFixed(3);
    delete hover.float_monk;
    R.info.extended = { groundY: +ground.toFixed(4), feetBelowGround_mm: sink, feetHover_m: hover, inPlaceDrift_m: drift };
    check('feet.aboveGround', sinkWorst < 0.005, `feet at most ${(sinkWorst * 1000).toFixed(1)} mm below the rest ground plane in game clips${sinkWhere ? ` (${sinkWhere})` : ''}; _qa_ stress poses excluded`);
    check('float.hovers', Object.values(hover).every((h) => h > 0.1), Object.entries(hover).map(([k, h]) => `${k} ${h} m`).join(', '));
    check('locomotion.inPlace', Object.values(drift).every((d) => d < 0.08), Object.entries(drift).map(([k, d]) => `${k} pelvis drift ${d} m`).join(', '));

    // weapons: support hand stays on the prop's grip_L marker; hands wrap the grips without sinking in
    let weapons = null;
    try { const r = await fetch(`${window.__CB_BASE ?? '../'}props/weapons.json`); if (r.ok) weapons = await r.json(); } catch (e) { /* optional */ }
    if (weapons) {
      const sockM = (s) => { const o = ch.sockets[s]; o.updateWorldMatrix(true, false); return o.matrixWorld.clone(); };
      const mat4 = (rows) => new THREE.Matrix4().set(...rows.flat());
      let supWorst = 0, supWhere = null, penWorst = 0, penWhere = null;
      const contact = {};
      for (const clip of ch.clips) {
        const meta = metaOf(clip.name);
        if (!meta || !meta.prop || !weapons.props[meta.prop]) continue;
        const wp = weapons.props[meta.prop];
        const sides = meta.support ? ['R', 'L'] : ['R'];
        const times = frameTimes(clip, opts.step || 3);
        for (const t of times) {
          ch.poseAtClip(clip.name, t);
          const MR = sockM('socket_hand_R_prop');
          if (meta.support) {
            const want = new THREE.Vector3().setFromMatrixPosition(MR.clone().multiply(mat4(wp.markers[meta.support.marker])));
            const d = want.distanceTo(new THREE.Vector3().setFromMatrixPosition(sockM('socket_hand_L_prop')));
            if (d > supWorst) { supWorst = d; supWhere = `${clip.name}@${t.toFixed(2)}s`; }
          }
          if (t !== times[0]) continue;     // penetration/contact on the settled hold frame
          for (const s of sides) {
            const M = sockM(`socket_hand_${s}_prop`);
            const c = new THREE.Vector3().setFromMatrixPosition(M);
            const ax = new THREE.Vector3().setFromMatrixColumn(M, 1).normalize();
            let near = 0, deep = 0;
            const n = ch.parts[`Hand_${s}`].geometry.attributes.position.count;
            for (let i = 0; i < n; i++) {
              ch.skinnedPosition(`Hand_${s}`, i, p);
              const rel = p.clone().sub(c); const along = rel.dot(ax);
              if (Math.abs(along) > 0.045) continue;
              const dist = rel.sub(ax.clone().multiplyScalar(along)).length() - wp.gripRadius;
              if (dist < 0.004) near++;
              deep = Math.min(deep, dist);
            }
            contact[`${clip.name}.${s}`] = near;
            if (-deep > penWorst) { penWorst = -deep; penWhere = `${clip.name} hand ${s}`; }
          }
        }
      }
      R.info.weapons = { supportHandMaxError_mm: +(supWorst * 1000).toFixed(3), deepestGripPenetration_mm: +(penWorst * 1000).toFixed(2), contactVertices: contact };
      check('weapons.twoHandGrip', supWorst < 0.002, `support hand within ${(supWorst * 1000).toFixed(3)} mm of the prop's grip_L marker on every frame${supWhere ? ` (worst ${supWhere})` : ''}`);
      check('weapons.gripNoPenetration', penWorst < 0.0035, `deepest hand vertex ${(penWorst * 1000).toFixed(2)} mm inside a grip${penWhere ? ` (${penWhere})` : ''}`);
      check('weapons.gripContact', Object.values(contact).every((k) => k >= 20), `min ${Math.min(...Object.values(contact))} hand vertices within 4 mm of each grip`);
    }
  }
  ch.resetPose();
  R.ok = R.checks.every((c) => c.ok);
  return R;
}

window.V = { validate };
