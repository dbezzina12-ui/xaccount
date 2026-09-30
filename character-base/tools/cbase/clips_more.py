"""Game-ready clip library: locomotion in place, floating, two-handed weapons, guns with
recoil and gestures. Same rules as clips.py: every frame is solved on the character's own
rig (IK + FK + driven helpers) and baked to rotation keys; only `pelvis` translates.

Weapon clips follow the usual game setup: the weapon is parented to socket_hand_R_prop
(identity), the right hand is solved to the weapon origin and the left hand to the
weapon's `grip_L` marker (props/weapons.json), so a game can attach the same prop and
play the clip with no extra alignment.
"""
import numpy as np

from .clips import FPS, apply_grip, ease, fit_grip, hand_for_socket
from .library import SIDES, hand_frame, raise_arm, rotate_world
from .poses import (Pose, curl_fingers, matrix_from_quat, quat_from_matrix, rx, ry, rz, slerp,
                    swing_twist_y, two_bone_ik)
from .props import mat, rot_y, weapon_specs
from .skeleton import _n, _perp, rot_axis


def smooth(t):
    return ease(t)


def frame_from(y, n):
    y = _n(y)
    n = _n(np.asarray(n, float) - np.dot(n, y) * y)
    return np.stack([y, n, np.cross(y, n)], 1)


def lerp_frames(keys, f):
    """keys: [(frame, 4x4)] -> eased interpolation (position lerp, rotation slerp)."""
    if f <= keys[0][0]:
        return keys[0][1].copy()
    for (f0, A), (f1, B) in zip(keys[:-1], keys[1:]):
        if f <= f1:
            t = smooth((f - f0) / max(f1 - f0, 1e-9))
            M = np.eye(4)
            M[:3, 3] = A[:3, 3] + (B[:3, 3] - A[:3, 3]) * t
            M[:3, :3] = matrix_from_quat(slerp(quat_from_matrix(A[:3, :3]), quat_from_matrix(B[:3, :3]), t))
            return M
    return keys[-1][1].copy()


def lerp_vals(keys, f):
    if f <= keys[0][0]:
        return np.asarray(keys[0][1], float)
    for (f0, a), (f1, b) in zip(keys[:-1], keys[1:]):
        if f <= f1:
            t = smooth((f - f0) / max(f1 - f0, 1e-9))
            return np.asarray(a, float) + (np.asarray(b, float) - np.asarray(a, float)) * t
    return np.asarray(keys[-1][1], float)


def pelvis_world_offset(rig, d):
    return rig.rest["pelvis"][:3, :3].T @ np.asarray(d, float)


def arms_down(rig, p, amount=38.0):
    for sd, _ in SIDES:
        raise_arm(rig, p, sd, -amount, clavicle_share=0.0)


def foot_pitch(deg):
    """World rotation raising the toes by `deg` (negative lowers them)."""
    return rot_axis(np.array([1.0, 0, 0]), np.radians(-deg))


# ============================================================ locomotion ===========
def _gait(rig, name, n, stride, duty, lift, bob, arm_amp, run=False):
    sk = rig.sk
    s = sk.scale
    rest = rig.fk(Pose())
    frames = []
    for f in range(n + 1):
        ph = f / n
        p = Pose()
        # pelvis: bob (two cycles per stride), lateral sway, yaw/roll
        if run:
            z = -0.035 * s - bob * s * np.cos(4 * np.pi * (ph - duty / 2))
        else:
            z = -0.022 * s + bob * s * np.cos(4 * np.pi * (ph - duty / 2))
        x = (0.012 if not run else 0.006) * s * np.cos(2 * np.pi * (ph - duty / 2))
        p.loc["pelvis"] = pelvis_world_offset(rig, [x, 0, z])
        yaw = (6.0 if not run else 9.0) * -np.cos(2 * np.pi * ph)
        p.rot["pelvis"] = ry(yaw) @ rz(2.5 * np.cos(2 * np.pi * (ph - duty / 2))) @ rx(3.0 if not run else 8.0)
        p.rot["spine_01"] = ry(-0.45 * yaw) @ rx(2.0 if not run else 5.0)
        p.rot["spine_02"] = ry(-0.35 * yaw)
        p.rot["chest"] = ry(-0.35 * yaw)
        p.rot["neck"] = rx(-2.0 if not run else -6.0)
        p.rot["head"] = rx(-2.0 if not run else -5.0) @ ry(0.2 * yaw)
        # legs: treadmill foot paths
        for sd, sx in SIDES:
            u = (ph + (0.0 if sd == "L" else 0.5)) % 1.0
            A = rest[f"foot_{sd}"][:3, 3]
            Rf = rest[f"foot_{sd}"][:3, :3]
            ball = rest[f"toe_{sd}"][:3, 3]
            heel = np.array([A[0], A[1] + 0.058 * s, 0.0])
            toe_up = 0.0
            if u < duty:                                        # stance: foot slides back on the ground
                v = u / duty
                dy = -stride / 2 + stride * v
                if v < 0.15:                                    # heel strike: toes come down
                    toe_up = 14.0 * (1 - v / 0.15)
                    Rp = foot_pitch(toe_up)
                    piv = heel + np.array([0, dy, 0])
                    ank = piv + Rp @ (A - heel)
                elif v > 0.72:                                  # toe-off: heel rises around the ball
                    th = (28.0 if not run else 34.0) * smooth((v - 0.72) / 0.28)
                    Rp = foot_pitch(-th)
                    piv = ball + np.array([0, dy, 0])
                    ank = piv + Rp @ (A - ball)
                    toe_up = th
                    p.rot[f"toe_{sd}"] = rx(th)
                else:
                    Rp = np.eye(3)
                    ank = A + np.array([0, dy, 0])
            else:                                               # swing: lift and bring forward
                w = (u - duty) / (1 - duty)
                dy = stride / 2 - stride * smooth(w)
                th0 = 28.0 if not run else 34.0
                roll = 1 - smooth(min(w * 2.2, 1))
                pitch = -th0 * roll + 14.0 * smooth(max(0, (w - 0.55) / 0.45))
                Rp = foot_pitch(pitch)
                h = lift * s * np.sin(np.pi * w) ** 0.8
                # rotate about the ball while the toes point down (continues the toe-off) and about the
                # heel while they point up (leads into heel strike), so no part of the foot dips below the floor
                piv = ball if pitch < 0 else heel
                ank = piv + np.array([0, dy, h]) + Rp @ (A - piv)
                p.rot[f"toe_{sd}"] = rx(th0 * roll)
                if run:
                    ank[1] += 0.10 * s * np.sin(np.pi * w)     # heel kick-up behind
                    ank[2] += 0.10 * s * np.sin(np.pi * min(w * 1.6, 1))
            two_bone_ik(rig, p, f"thigh_{sd}", f"shin_{sd}", ank, np.array([0.1 * sx, -1.0, 0.0]))
            rig.set_world_rotation(p, f"foot_{sd}", Rp @ Rf)
        # arms: counter-swing
        arms_down(rig, p, 36.0 if not run else 30.0)
        for sd, sx in SIDES:
            flex = arm_amp * (-np.cos(2 * np.pi * ph)) * (1 if sd == "L" else -1)
            rotate_world(rig, p, f"upperarm_{sd}", np.array([-1.0, 0, 0]), flex)
            if run:
                p.rot[f"forearm_{sd}"] = rx(88 + 12 * np.sin(2 * np.pi * ph + (0 if sd == "L" else np.pi)))
                curl_fingers(p, sd, 0.75, thumb=0.6)
            else:
                p.rot[f"forearm_{sd}"] = rx(14 + 10 * max(0.0, flex) / arm_amp)
                curl_fingers(p, sd, 0.22, thumb=0.2)
        frames.append(p)
    return frames, {"loop": True, "inPlace": True, "stride_m": round(float(stride), 4),
                    "cycle_s": round(n / FPS, 4), "speed_mps": round(float(stride / (n / FPS * duty)), 3),
                    "note": "treadmill cycle: planted feet slide backward at the locomotion speed; drive root motion "
                            "in the game at speed_mps"}


def clip_walk(rig):
    s = rig.sk.scale
    return _gait(rig, "walk", 34, 0.58 * s, 0.62, 0.07, 0.014, 18.0)


def clip_run(rig):
    s = rig.sk.scale
    return _gait(rig, "run", 22, 1.05 * s, 0.40, 0.16, 0.030, 38.0, run=True)


def clip_jump(rig):
    """Jump in place: anticipation crouch, take-off, air, landing, recover."""
    s = rig.sk.scale
    rest = rig.fk(Pose())
    #        frame  pelvis dz  foot lift  arm flex  knee tuck(extra lift)
    keys_p = [(0, 0.0), (9, -0.13), (13, 0.02), (19, 0.26), (25, 0.02), (28, -0.10), (42, 0.0)]
    keys_f = [(0, 0.0), (9, 0.0), (13, 0.0), (15, 0.05), (19, 0.16), (23, 0.05), (25, 0.0), (42, 0.0)]
    keys_a = [(0, 0.0), (9, -35.0), (13, 60.0), (19, 75.0), (25, 20.0), (28, 10.0), (42, 0.0)]
    keys_l = [(0, 0.0), (9, 12.0), (13, 0.0), (19, -4.0), (28, 10.0), (42, 0.0)]
    frames = []
    n = 42
    for f in range(n + 1):
        p = Pose()
        dz = lerp_vals(keys_p, f) * s
        lift = lerp_vals(keys_f, f) * s
        lean = lerp_vals(keys_l, f)
        p.loc["pelvis"] = pelvis_world_offset(rig, [0, 0.02 * s * lean / 12.0, dz])
        p.rot["pelvis"] = rx(lean)
        p.rot["spine_01"] = rx(lean * 0.5)
        p.rot["neck"] = rx(-lean * 0.6)
        for sd, sx in SIDES:
            A = rest[f"foot_{sd}"][:3, 3]
            ank = A + np.array([0, 0, lift])
            two_bone_ik(rig, p, f"thigh_{sd}", f"shin_{sd}", ank, np.array([0.12 * sx, -1.0, 0.0]))
            pt = 30.0 * min(lift / (0.12 * s), 1.0)
            rig.set_world_rotation(p, f"foot_{sd}", foot_pitch(-pt) @ rest[f"foot_{sd}"][:3, :3])
        arms_down(rig, p, 34.0)
        a = lerp_vals(keys_a, f)
        for sd, _ in SIDES:
            rotate_world(rig, p, f"upperarm_{sd}", np.array([-1.0, 0, 0]), a)
            p.rot[f"forearm_{sd}"] = rx(20 + 0.25 * max(a, 0))
            curl_fingers(p, sd, 0.3)
        frames.append(p)
    return frames, {"loop": False, "inPlace": True, "markers": {"takeoff": 13, "apex": 19, "land": 25, "end": n},
                    "airborne_frames": [14, 24]}


# ============================================================ floating ==============
def _float_body(rig, p, lift, t, legs_blend=1.0):
    s = rig.sk.scale
    p.loc["pelvis"] = pelvis_world_offset(rig, [0.004 * s * np.sin(t * 0.7), 0, lift])
    for sd, sx in SIDES:
        k = 1.0 if sd == "L" else 0.8
        p.rot[f"thigh_{sd}"] = rx(legs_blend * (10 * k + 3 * np.sin(t + (0 if sd == "L" else 1.3))))
        p.rot[f"shin_{sd}"] = rx(legs_blend * (26 * k + 5 * np.sin(t + 0.6 + (0 if sd == "L" else 1.3))))
        p.rot[f"foot_{sd}"] = rx(-legs_blend * 38)
        p.rot[f"toe_{sd}"] = rx(-legs_blend * 10)


def clip_float(rig):
    s = rig.sk.scale
    n = 90
    frames = []
    for f in range(n + 1):
        t = 2 * np.pi * f / n
        p = Pose()
        _float_body(rig, p, 0.26 * s + 0.028 * s * np.sin(t), t)
        p.rot["spine_02"] = rx(1.5 * np.sin(t)) @ rz(1.0 * np.sin(t + 1))
        p.rot["head"] = rx(-2 * np.sin(t + 0.5))
        for sd, sx in SIDES:
            raise_arm(rig, p, sd, -10 + 6 * np.sin(t + (0 if sd == "L" else 0.8)), clavicle_share=0.1)
            p.rot[f"forearm_{sd}"] = rx(22 + 8 * np.sin(t + 1.1))
            p.rot[f"hand_{sd}"] = rx(-10 * np.sin(t + 1.6))
            curl_fingers(p, sd, 0.15 + 0.05 * np.sin(t + 2.0), thumb=0.15)
        frames.append(p)
    return frames, {"loop": True, "inPlace": True, "pelvisLift_m": round(0.26 * s, 3)}


def _monk_targets(rig, p):
    """Cross-legged (tailor) seat: each foot under the opposite knee, hands resting on the knees."""
    s = rig.sk.scale
    W = rig.fk(p)
    H = 0.5 * (W["thigh_L"][:3, 3] + W["thigh_R"][:3, 3])
    ank = {"L": H + np.array([-0.075, -0.33, -0.13]) * s, "R": H + np.array([0.075, -0.25, -0.19]) * s}
    poles = {"L": np.array([1.0, -0.5, 0.6]), "R": np.array([-1.0, -0.5, 0.6])}
    return ank, poles


def monk_pose(rig, lift):
    s = rig.sk.scale
    p = Pose()
    p.loc["pelvis"] = pelvis_world_offset(rig, [0, 0.02 * s, lift])
    p.rot["pelvis"] = rx(-6)
    p.rot["spine_01"] = rx(3)
    p.rot["spine_02"] = rx(2)
    p.rot["head"] = rx(4)
    ank, poles = _monk_targets(rig, p)
    for sd, sx in SIDES:
        two_bone_ik(rig, p, f"thigh_{sd}", f"shin_{sd}", ank[sd], poles[sd])
        # sole turned up/in, toes pointing across
        Rf = hand_frame(sd, rig, palm_dir=np.array([0, -1.0, -0.5]), finger_dir=np.array([-sx * 1.0, -0.35, -0.15]))
        rig.set_world_rotation(p, f"foot_{sd}", Rf)
        p.rot[f"toe_{sd}"] = rx(-8)
    W = rig.fk(p)
    for sd, sx in SIDES:
        knee = W[f"shin_{sd}"][:3, 3]
        wrist = knee + np.array([-sx * 0.05, 0.07, 0.07]) * s
        two_bone_ik(rig, p, f"upperarm_{sd}", f"forearm_{sd}", wrist, np.array([sx * 1.0, 0.6, -0.3]))
        rig.set_world_rotation(p, f"hand_{sd}", hand_frame(sd, rig, palm_dir=np.array([0, 0, 1.0]),
                                                          finger_dir=np.array([sx * 0.55, -1.0, -0.25])))
        # jnana mudra: thumb and index meet, other fingers relaxed
        curl_fingers(p, sd, {"index": 0.55, "middle": 0.12, "ring": 0.16, "pinky": 0.2})
        p.rot[f"thumb_01_{sd}"] = rx(18)
        p.rot[f"thumb_02_{sd}"] = rx(28)
        p.rot[f"thumb_03_{sd}"] = rx(25)
    return p


def clip_float_monk(rig):
    """Stand -> rise -> fold into a cross-legged float with hands on the knees (then hold)."""
    from .library import plant_legs
    s = rig.sk.scale
    n = 84
    lift_end = 0.50 * s - 0.45 * s   # pelvis ends ~0.05 m above rest height, feet well off the ground
    target = monk_pose(rig, lift_end)
    frames = []
    for f in range(n + 1):
        p = Pose()
        if f <= 12:                                  # anticipation: small dip, arms float out
            k = smooth(f / 12)
            p.loc["pelvis"] = pelvis_world_offset(rig, [0, 0, -0.03 * s * k])
            for sd, _ in SIDES:
                raise_arm(rig, p, sd, 6 * k)
            plant_legs(rig, p)
            frames.append(p)
            continue
        k = smooth((f - 12) / 56.0)                  # 12..68 fold + rise, then hold
        rise = smooth(min(1.0, (f - 12) / 30.0))
        mid = Pose()
        mid.loc["pelvis"] = pelvis_world_offset(rig, [0, 0, 0.30 * s * rise * (1 - k) + (-0.03 * s) * (1 - rise)])
        for sd, _ in SIDES:
            raise_arm(rig, mid, sd, 6 + 20 * np.sin(np.pi * k))
        mid.rot["head"] = rx(-6 * np.sin(np.pi * k))
        plant_legs(rig, mid)                         # feet stay on the floor until the legs can no longer reach it
        blended = Pose.blend(mid, target, k)
        if f > 68:
            t = (f - 68) / 16.0
            blended.loc["pelvis"] = target.loc["pelvis"] + pelvis_world_offset(rig, [0, 0, 0.012 * s * np.sin(np.pi * t)])
        frames.append(blended)
    return frames, {"loop": False, "markers": {"liftOff": 18, "seated": 68, "end": n},
                    "followWith": "float_monk_loop"}


def clip_float_monk_loop(rig):
    s = rig.sk.scale
    base = monk_pose(rig, 0.05 * s)
    n = 120
    frames = []
    for f in range(n + 1):
        t = 2 * np.pi * f / n
        p = base.copy()
        p.loc["pelvis"] = base.loc["pelvis"] + pelvis_world_offset(rig, [0, 0, 0.03 * s * np.sin(t)])
        p.rot["spine_02"] = base.rot.get("spine_02", np.eye(3)) @ rx(1.2 * np.sin(2 * t)) @ rz(1.2 * np.sin(t))
        p.rot["chest"] = rx(1.0 * np.sin(2 * t + 0.4))
        p.rot["head"] = base.rot.get("head", np.eye(3)) @ ry(1.5 * np.sin(t + 1.0))
        frames.append(p)
    return frames, {"loop": True, "inPlace": True}


# ============================================================ weapons ===============
def _wrist_strain(rig, p, side):
    q = quat_from_matrix(p.rot.get(f"hand_{side}", np.eye(3)))
    return 2 * np.arccos(min(1.0, abs(q[0])))


def solve_weapon(rig, p, P, weapon, socks, poles, reach=0.97, return_P=False):
    """Right hand onto the weapon origin, left hand (if any) onto its grip_L marker.
    If either wrist target is out of reach, the whole weapon slides toward that shoulder
    until both hands can hold it (the relative grip never changes, so the hands never slip)."""
    P = np.array(P, float)
    sides = ("R", "L") if weapon["support"] else ("R",)
    W = rig.fk(p)
    for _ in range(8):
        moved = False
        for side in sides:
            S = P if side == "R" else P @ weapon["markers"]["grip_L"]
            wrist = hand_for_socket(rig, side, S, socks)[:3, 3]
            sh = W[f"upperarm_{side}"][:3, 3]
            lim = reach * (rig.sk[f"upperarm_{side}"].length + rig.sk[f"forearm_{side}"].length)
            d = wrist - sh
            ex = np.linalg.norm(d) - lim
            if ex > 1e-5:
                P[:3, 3] -= d / np.linalg.norm(d) * (ex + 1e-4)
                moved = True
        if not moved:
            break
    HR = hand_for_socket(rig, "R", P, socks)
    two_bone_ik(rig, p, "upperarm_R", "forearm_R", HR[:3, 3], poles["R"])
    rig.set_world_rotation(p, "hand_R", HR[:3, :3])
    if weapon["support"]:
        HL = hand_for_socket(rig, "L", P @ weapon["markers"]["grip_L"], socks)
        two_bone_ik(rig, p, "upperarm_L", "forearm_L", HL[:3, 3], poles["L"])
        rig.set_world_rotation(p, "hand_L", HL[:3, :3])
    return (p, P) if return_P else p


def fit_support_marker(rig, weapon, P_ref, socks, poles, axis_local=None, base=None):
    """Choose the support-hand marker orientation (roll about its grip axis and which way the
    thumb points) that gives the most neutral left wrist in the reference hold."""
    t = weapon["markers"]["grip_L"][:3, 3]
    a = np.array([0, 1.0, 0]) if axis_local is None else _n(axis_local)
    z0 = _perp(np.array([0, 0, 1.0]) if abs(a[2]) < 0.9 else np.array([1.0, 0, 0]), a)
    x0 = np.cross(a, z0)
    best = None
    for B in (np.stack([x0, a, z0], 1), np.stack([-x0, -a, z0], 1)):     # thumb toward +axis / -axis
        for roll in range(0, 360, 15):
            R = B @ rot_y(roll)
            weapon["markers"]["grip_L"] = mat(R, t)
            p = solve_weapon(rig, base.copy() if base is not None else Pose(), P_ref, weapon, socks, poles)
            cost = _wrist_strain(rig, p, "L") + 0.3 * abs(swing_twist_y(p.rot.get("hand_L", np.eye(3))))
            if best is None or cost < best[0]:
                best = (cost, mat(R, t))
    weapon["markers"]["grip_L"] = best[1]
    return best[1]


def gun_frame(weapon, origin, forward, up=np.array([0, 0, 1.0])):
    b = np.asarray(weapon["barrel"])
    Bl = frame_from(b, np.array([0, 1.0, 0]))
    Bw = frame_from(forward, up)
    return mat(Bw @ Bl.T, origin)


def blade_frame(origin, axis, roll_ref):
    y = _n(axis)
    z = _perp(roll_ref, y)
    return mat(np.stack([np.cross(y, z), y, z], 1), origin)


def torso_pose(rig, rots, stance=0.035):
    """Weapon stance: pelvis dropped slightly, extra torso rotations, feet planted."""
    from .library import plant_legs
    p = Pose()
    p.loc["pelvis"] = pelvis_world_offset(rig, [0, 0.01 * rig.sk.scale, -stance * rig.sk.scale])
    for b, R in rots.items():
        p.rot[b] = R
    plant_legs(rig, p)
    return p


def _weapon_clip(rig, socks, weapon, keys, n, poles, stance=0.035, torso=None, fingers=None, meta=None):
    """keys: [(frame, P 4x4)]; torso: f -> dict of extra bone rotations."""
    p0, P0 = solve_weapon(rig, torso_pose(rig, torso(0) if torso else {}, stance), keys[0][1], weapon, socks,
                          poles, return_P=True)
    gR = fit_grip(rig, p0, "R", P0[:3, 3], P0[:3, 1], weapon["grip_radius"])
    gL = None
    if weapon["support"]:
        M = P0 @ weapon["markers"]["grip_L"]
        gL = fit_grip(rig, p0, "L", M[:3, 3], M[:3, 1], weapon["grip_radius"])
    frames = []
    for f in range(n + 1):
        p = torso_pose(rig, torso(f) if torso else {}, stance)
        P = lerp_frames(keys, f)
        solve_weapon(rig, p, P, weapon, socks, poles)
        apply_grip(p, "R", gR)
        if gL:
            apply_grip(p, "L", gL)
        if fingers:
            fingers(p, f)
        frames.append(p)
    m = {"loop": False, "prop": weapon["name"], "attach": "socket_hand_R_prop",
         "support": {"hand": "L", "marker": "grip_L"} if weapon["support"] else None,
         "grip": {"R": {k: (v if not isinstance(v, tuple) else list(v)) for k, v in gR.items()}}}
    if meta:
        m.update(meta)
    return frames, m


def weapon_clips(rig, socks, fixed_markers=None):
    """fixed_markers: {prop: {marker: 4x4}} from props/weapons.json. When given, the support-hand
    markers are NOT refitted, so every character uses exactly the markers baked into weapons.glb."""
    sk = rig.sk
    s = sk.scale
    L = sk.landmarks
    specs = weapon_specs(sk)
    for k, v in specs.items():
        v["name"] = k
        if fixed_markers and k in fixed_markers:
            v["markers"] = {mk: np.asarray(M, float) for mk, M in fixed_markers[k].items()}
    fit = (lambda *a, **kw: None) if fixed_markers else fit_support_marker
    shR = L["shoulder_R"]
    hipz = L["hip_z"]
    fwd = np.array([0, -1.0, 0])
    up = np.array([0, 0, 1.0])
    out = {}
    poles2 = {"R": np.array([-0.8, 0.3, -1.0]), "L": np.array([0.8, 0.3, -1.0])}

    # ---------------- two-handed sword ----------------
    sw = specs["Sword2H"]
    guard = blade_frame(np.array([-0.02 * s, -0.36 * s, hipz + 0.20 * s]), [0.05, -0.75, 0.66], np.array([0.3, -1.0, 0.0]))
    fit(rig, sw, guard, socks, poles2, base=torso_pose(rig, {}))

    def breathe(amp=1.0):
        return lambda f: {"spine_02": rx(amp * 1.2 * np.sin(2 * np.pi * f / 60)), "chest": rx(amp * np.sin(2 * np.pi * f / 60 + 0.5))}
    n = 60
    keys = [(0, guard), (30, mat(guard[:3, :3], guard[:3, 3] + np.array([0, 0, 0.012 * s]))), (60, guard)]
    out["sword_2h_idle"] = _weapon_clip(rig, socks, sw, keys, n, poles2, torso=breathe(), meta={"loop": True})
    wind = blade_frame(np.array([-0.16 * s, -0.12 * s, hipz + 0.52 * s]), [0.35, 0.55, 0.76], np.array([0.6, -1.0, 0.2]))
    strike = blade_frame(np.array([0.10 * s, -0.40 * s, hipz + 0.06 * s]), [0.55, -0.60, -0.58], np.array([0.4, -0.2, 1.0]))
    follow = blade_frame(np.array([0.16 * s, -0.30 * s, hipz + 0.00 * s]), [0.75, -0.25, -0.62], np.array([0.4, -0.2, 1.0]))
    keys = [(0, guard), (12, wind), (18, wind), (24, strike), (30, follow), (44, follow), (60, guard)]

    def slash_torso(f):
        yaw = float(lerp_vals([(0, 0), (12, -28), (18, -30), (24, 22), (30, 30), (44, 26), (60, 0)], f))
        return {"spine_01": ry(0.3 * yaw), "spine_02": ry(0.35 * yaw) @ rx(4), "chest": ry(0.35 * yaw),
                "head": ry(-0.5 * yaw)}
    out["sword_2h_slash"] = _weapon_clip(rig, socks, sw, keys, 60, poles2, torso=slash_torso,
                                         meta={"markers": {"windup": 12, "impact": 24, "recover": 44, "end": 60}})

    # ---------------- staff ----------------
    st = specs["Staff"]
    sguard = blade_frame(np.array([-0.12 * s, -0.28 * s, hipz + 0.10 * s]), [0.62, -0.40, 0.68], np.array([0.2, -1.0, 0.1]))
    fit(rig, st, sguard, socks, poles2, base=torso_pose(rig, {}))
    keys = [(0, sguard), (30, mat(sguard[:3, :3], sguard[:3, 3] + np.array([0, 0, 0.012 * s]))), (60, sguard)]
    out["staff_idle"] = _weapon_clip(rig, socks, st, keys, 60, poles2, torso=breathe(), meta={"loop": True})
    back = blade_frame(np.array([-0.16 * s, -0.10 * s, hipz + 0.14 * s]), [0.55, -0.55, 0.62], np.array([0.2, -1.0, 0.1]))
    thrust = blade_frame(np.array([-0.08 * s, -0.30 * s, hipz + 0.24 * s]), [0.40, -0.72, 0.46], np.array([0.2, -1.0, 0.3]))
    keys = [(0, sguard), (10, back), (17, thrust), (26, thrust), (44, sguard)]

    def staff_torso(f):
        yaw = float(lerp_vals([(0, 0), (10, -15), (17, 14), (26, 12), (44, 0)], f))
        lean = float(lerp_vals([(0, 0), (10, -2), (17, 7), (26, 6), (44, 0)], f))
        return {"spine_01": ry(0.35 * yaw) @ rx(lean * 0.5), "spine_02": ry(0.35 * yaw) @ rx(lean), "chest": ry(0.3 * yaw)}
    out["staff_strike"] = _weapon_clip(rig, socks, st, keys, 44, poles2, torso=staff_torso,
                                       meta={"markers": {"windup": 10, "impact": 17, "end": 44}})

    # ---------------- pistol (one-handed aim) + recoil ----------------
    pi = specs["Pistol"]
    aim_o = shR + np.array([0.06, -0.55, 0.05]) * s
    Paim = gun_frame(pi, aim_o, fwd)
    poleR1 = {"R": np.array([-0.6, 0.2, -1.0]), "L": poles2["L"]}

    def pistol_idle_torso(f):
        d = {"spine_02": ry(-10) @ rx(1.0 * np.sin(2 * np.pi * f / 60)), "chest": ry(-8), "head": ry(10) @ rz(-4)}
        return d

    def pistol_fingers(trigger):
        def fn(p, f):
            p.rot["index_01_R"] = rx(12)
            p.rot["index_02_R"] = rx(35 + 25 * trigger(f))
            p.rot["index_03_R"] = rx(20 + 15 * trigger(f))
            arms_left_relaxed(rig, p)
        return fn

    def arms_left_relaxed(rig_, p):
        raise_arm(rig_, p, "L", -34, clavicle_share=0.0)
        p.rot["forearm_L"] = rx(18)
        curl_fingers(p, "L", 0.25, thumb=0.2)
    keys = [(0, Paim), (30, mat(Paim[:3, :3], Paim[:3, 3] + np.array([0, 0, 0.004 * s]))), (60, Paim)]
    out["pistol_aim"] = _weapon_clip(rig, socks, pi, keys, 60, poleR1, torso=pistol_idle_torso,
                                     fingers=pistol_fingers(lambda f: 0.0), meta={"loop": True})

    def recoil_keys(Pa, shots, kick_back, kick_deg, n):
        """Impulse per shot: muzzle climbs and the gun kicks back, then recovers."""
        b = Pa[:3, :3] @ np.asarray(pi["barrel"])
        lat = _n(np.cross(b, up))
        ks = []
        for f in range(n + 1):
            r = 0.0
            for sf in shots:
                if f >= sf:
                    t = (f - sf)
                    r += (min(t / 1.5, 1.0)) * np.exp(-max(t - 1.5, 0) / 3.2)
            M = mat(rot_axis(lat, np.radians(kick_deg * r)) @ Pa[:3, :3], Pa[:3, 3] - b * kick_back * r + up * 0.25 * kick_back * r)
            ks.append((f, M))
        return ks
    shots = [8]
    rk = recoil_keys(Paim, shots, 0.035 * s, 11.0, 36)
    trig = lambda f: 1.0 if any(sf - 2 <= f <= sf + 2 for sf in shots) else 0.0  # noqa: E731
    out["pistol_fire"] = _weapon_clip(rig, socks, pi, rk, 36, poleR1, torso=lambda f: {**pistol_idle_torso(f), "chest": ry(-8) @ rx(-4 * float(np.exp(-abs(f - 9) / 4.0)))},
                                      fingers=pistol_fingers(trig),
                                      meta={"markers": {"shot": shots, "end": 36}, "muzzleMarker": "muzzle"})

    # ---------------- rifle (shouldered) + burst ----------------
    rf = specs["Rifle"]

    def rifle_torso(f):
        # bladed stance: left shoulder forward so the support hand reaches the handguard,
        # neck/head counter-rotate so the face (and the sights) point down range
        return {"spine_01": ry(-9), "spine_02": ry(-13) @ rx(2 + 0.8 * np.sin(2 * np.pi * f / 60)), "chest": ry(-13),
                "neck": ry(17) @ rz(-6) @ rx(6), "head": ry(17) @ rz(-10) @ rx(4)}
    tp = torso_pose(rig, rifle_torso(0))
    Wt = rig.fk(tp)
    Rc = Wt["chest"][:3, :3] @ rig.rest["chest"][:3, :3].T
    pocket = Wt["upperarm_R"][:3, 3] + Rc @ (np.array([0.06, -0.06, -0.02]) * s)
    Rr = gun_frame(rf, np.zeros(3), fwd + np.array([0, 0, -0.04]))
    butt_local = rf["markers"]["butt"][:3, 3]
    Paim_r = mat(Rr[:3, :3], pocket - Rr[:3, :3] @ butt_local)
    poles_r = {"R": np.array([-1.0, 0.2, -0.5]), "L": np.array([0.3, 0.1, -1.0])}
    fit(rig, rf, Paim_r, socks, poles_r, axis_local=rf["support_axis"], base=tp)

    rifle_trigger = lambda f: 0.0  # noqa: E731

    def rifle_fingers(trigger):
        def fn(p, f):
            p.rot["index_01_R"] = rx(12)
            p.rot["index_02_R"] = rx(35 + 25 * trigger(f))
            p.rot["index_03_R"] = rx(20 + 15 * trigger(f))
        return fn
    keys = [(0, Paim_r), (30, mat(Paim_r[:3, :3], Paim_r[:3, 3] + np.array([0, 0, 0.003 * s]))), (60, Paim_r)]
    out["rifle_aim"] = _weapon_clip(rig, socks, rf, keys, 60, poles_r, torso=rifle_torso,
                                    fingers=rifle_fingers(rifle_trigger), meta={"loop": True})
    shots = [6, 12, 18]
    rk = recoil_keys(Paim_r, shots, 0.018 * s, 3.5, 40)
    trig = lambda f: 1.0 if any(sf - 1 <= f <= sf + 1 for sf in shots) else 0.0  # noqa: E731
    out["rifle_fire"] = _weapon_clip(rig, socks, rf, rk, 40, poles_r,
                                     torso=lambda f: {**rifle_torso(f), "spine_02": ry(-6) @ rx(2 - 2.5 * float(sum(np.exp(-abs(f - sf - 1) / 3.0) for sf in shots)))},
                                     fingers=rifle_fingers(trig),
                                     meta={"markers": {"shots": shots, "end": 40}, "muzzleMarker": "muzzle"})
    return out, specs


# ============================================================ gestures ==============
def clip_wave(rig):
    n = 60
    frames = []
    for f in range(n + 1):
        t = f / n
        k = smooth(min(1.0, f / 12)) * smooth(min(1.0, (n - f) / 12))
        p = Pose()
        raise_arm(rig, p, "L", -30 * k, clavicle_share=0.0)
        raise_arm(rig, p, "R", 95 * k, fwd_deg=15 * k)
        p.rot["upperarm_R"] = p.rot["upperarm_R"] @ ry(-22 * k * np.sin(2 * np.pi * 2 * t))
        p.rot["forearm_R"] = rx(80 * k)
        p.rot["hand_R"] = rx(-12 * k)
        curl_fingers(p, "R", 0.05, spread=6 * k)
        curl_fingers(p, "L", 0.2)
        p.rot["head"] = ry(-8 * k) @ rz(-5 * k)
        p.rot["spine_02"] = rz(-3 * k)
        frames.append(p)
    return frames, {"loop": False, "markers": {"end": n}}


def clip_cheer(rig):
    """Big-win celebration: fists up in a V, two pumps, little hop."""
    s = rig.sk.scale
    from .library import plant_legs
    n = 66
    frames = []
    keys_up = [(0, 0), (10, 1), (56, 1), (66, 0)]
    for f in range(n + 1):
        k = float(lerp_vals(keys_up, f))
        pump = np.sin(np.clip((f - 12) / 40, 0, 1) * 4 * np.pi) if 12 <= f <= 52 else 0.0
        hop = max(0.0, np.sin(np.clip((f - 20) / 22, 0, 1) * np.pi)) if 20 <= f <= 42 else 0.0
        rise = 0.07 * s * hop - 0.02 * s * k
        p = Pose()
        p.loc["pelvis"] = pelvis_world_offset(rig, [0, 0, rise])
        p.rot["spine_02"] = rx(-6 * k)
        p.rot["chest"] = rx(-4 * k)
        p.rot["head"] = rx(-12 * k)
        plant_legs(rig, p)
        if rise > 0:                                 # airborne: feet trail the pelvis, toes point down but clear the floor
            rest = rig.fk(Pose())
            lift = 0.85 * rise
            pitch = min(25 * hop, np.degrees(np.arcsin(min(1.0, lift / (0.16 * s)))))
            for sd, sx in SIDES:
                A = rest[f"foot_{sd}"][:3, 3] + np.array([0, 0, lift])
                two_bone_ik(rig, p, f"thigh_{sd}", f"shin_{sd}", A, np.array([0.1 * sx, -1.0, 0.0]))
                rig.set_world_rotation(p, f"foot_{sd}", foot_pitch(-pitch) @ rest[f"foot_{sd}"][:3, :3])
        for sd, _ in SIDES:
            raise_arm(rig, p, sd, k * (118 + 10 * pump), fwd_deg=k * 12)
            p.rot[f"forearm_{sd}"] = rx(k * (35 + 30 * max(0.0, -pump)))
            curl_fingers(p, sd, 0.95 * k + 0.1, thumb=0.9 * k)
        frames.append(p)
    return frames, {"loop": False, "markers": {"armsUp": 10, "end": n}}


def more_clips(rig, socks, fixed_markers=None):
    out = {
        "walk_in_place": clip_walk(rig),
        "run_in_place": clip_run(rig),
        "jump_in_place": clip_jump(rig),
        "float_idle": clip_float(rig),
        "float_monk": clip_float_monk(rig),
        "float_monk_loop": clip_float_monk_loop(rig),
        "wave": clip_wave(rig),
        "cheer": clip_cheer(rig),
    }
    wc, specs = weapon_clips(rig, socks, fixed_markers)
    out.update(wc)
    return out, specs
