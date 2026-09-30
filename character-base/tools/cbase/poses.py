"""Pose representation, FK, two-bone IK, hand/finger helpers and linear-blend skinning.

A pose stores, per bone, the *basis* transform exactly as Blender's
pose_bone.matrix_basis does: a rotation (3x3) and an optional translation, both in the
bone's own rest frame. FK therefore matches Blender (and the exported glTF) exactly:

    M_b = M_parent @ inv(Rest_parent) @ Rest_b @ Basis_b          (armature space)

IK and "aim" helpers only ever produce rotations, so bone lengths can never change
(forearms cannot shorten); translations are allowed on `root` and `pelvis` only.
"""
import numpy as np

from .skeleton import DRIVERS, FINGERS, _n, _perp, rot_axis

TRANSLATABLE = ("root", "pelvis")


def mat4(R=None, t=None):
    M = np.eye(4)
    if R is not None:
        M[:3, :3] = R
    if t is not None:
        M[:3, 3] = t
    return M


def rx(deg):
    return rot_axis(np.array([1.0, 0, 0]), np.radians(deg))


def ry(deg):
    return rot_axis(np.array([0, 1.0, 0]), np.radians(deg))


def rz(deg):
    return rot_axis(np.array([0, 0, 1.0]), np.radians(deg))


def quat_from_matrix(R):
    """(w, x, y, z)"""
    m = R
    tr = m[0, 0] + m[1, 1] + m[2, 2]
    if tr > 0:
        S = np.sqrt(tr + 1.0) * 2
        w = 0.25 * S
        x = (m[2, 1] - m[1, 2]) / S
        y = (m[0, 2] - m[2, 0]) / S
        z = (m[1, 0] - m[0, 1]) / S
    elif m[0, 0] > m[1, 1] and m[0, 0] > m[2, 2]:
        S = np.sqrt(1.0 + m[0, 0] - m[1, 1] - m[2, 2]) * 2
        w = (m[2, 1] - m[1, 2]) / S
        x = 0.25 * S
        y = (m[0, 1] + m[1, 0]) / S
        z = (m[0, 2] + m[2, 0]) / S
    elif m[1, 1] > m[2, 2]:
        S = np.sqrt(1.0 + m[1, 1] - m[0, 0] - m[2, 2]) * 2
        w = (m[0, 2] - m[2, 0]) / S
        x = (m[0, 1] + m[1, 0]) / S
        y = 0.25 * S
        z = (m[1, 2] + m[2, 1]) / S
    else:
        S = np.sqrt(1.0 + m[2, 2] - m[0, 0] - m[1, 1]) * 2
        w = (m[1, 0] - m[0, 1]) / S
        x = (m[0, 2] + m[2, 0]) / S
        y = (m[1, 2] + m[2, 1]) / S
        z = 0.25 * S
    q = np.array([w, x, y, z])
    q /= np.linalg.norm(q)
    return q if q[0] >= 0 else -q


def matrix_from_quat(q):
    w, x, y, z = q / np.linalg.norm(q)
    return np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ])


def slerp(q0, q1, t):
    q0, q1 = np.asarray(q0, float), np.asarray(q1, float)
    d = np.dot(q0, q1)
    if d < 0:
        q1, d = -q1, -d
    if d > 0.9995:
        q = q0 + t * (q1 - q0)
        return q / np.linalg.norm(q)
    th = np.arccos(d)
    return (np.sin((1 - t) * th) * q0 + np.sin(t * th) * q1) / np.sin(th)


class Rig:
    def __init__(self, sk):
        self.sk = sk
        self.order = list(sk.order)
        self.parent = {b: sk[b].parent for b in self.order}
        self.rest = {b: sk[b].matrix() for b in self.order}
        self.rest_inv = {b: np.linalg.inv(m) for b, m in self.rest.items()}
        self.local_rest = {}
        for b in self.order:
            p = self.parent[b]
            self.local_rest[b] = self.rest[b] if p is None else self.rest_inv[p] @ self.rest[b]

    def driven_rotation(self, pose, b):
        src, mode = DRIVERS[b]
        R = pose.rot.get(src, np.eye(3))
        if mode == "half":
            return matrix_from_quat(slerp(np.array([1.0, 0, 0, 0]), quat_from_matrix(R), 0.5))
        if mode == "twist_half":
            return ry(np.degrees(swing_twist_y(R) * 0.5))
        raise ValueError(mode)

    def basis(self, pose, b):
        if b in DRIVERS:
            return mat4(self.driven_rotation(pose, b))
        return pose.basis(b)

    def fk(self, pose, upto=None):
        W = {}
        for b in self.order:
            Bm = self.basis(pose, b)
            p = self.parent[b]
            W[b] = (self.local_rest[b] if p is None else W[p] @ self.local_rest[b]) @ Bm
            if upto is not None and b == upto:
                break
        return W

    def skin_matrices(self, W, names):
        return np.stack([W[b] @ self.rest_inv[b] for b in names])

    def deform(self, V, weights, names, pose):
        W = self.fk(pose)
        S = self.skin_matrices(W, names)
        Vh = np.concatenate([V, np.ones((len(V), 1))], 1)
        out = np.zeros((len(V), 3))
        nz = weights > 0
        for j in range(len(names)):
            sel = nz[:, j]
            if sel.any():
                out[sel] += weights[sel, j:j + 1] * (Vh[sel] @ S[j].T)[:, :3]
        return out

    # ---------------- authoring helpers (all rotation-only) ----------------
    def parent_frame(self, pose, b):
        """World matrix the bone would have with an identity basis (given current pose)."""
        p = self.parent[b]
        if p is None:
            return self.local_rest[b].copy()
        W = self.fk(pose, upto=p)
        return W[p] @ self.local_rest[b]

    def set_world_rotation(self, pose, b, Rw):
        F = self.parent_frame(pose, b)
        pose.rot[b] = F[:3, :3].T @ Rw

    def world(self, pose, b):
        return self.fk(pose, upto=b)[b]


class Pose:
    def __init__(self):
        self.rot = {}
        self.loc = {}

    def copy(self):
        p = Pose()
        p.rot = {k: v.copy() for k, v in self.rot.items()}
        p.loc = {k: v.copy() for k, v in self.loc.items()}
        return p

    def basis(self, b):
        return mat4(self.rot.get(b), self.loc.get(b))

    def rotate(self, b, R):
        """Post-multiply a local rotation (bone frame)."""
        self.rot[b] = self.rot.get(b, np.eye(3)) @ R
        return self

    def euler(self, b, x=0.0, y=0.0, z=0.0):
        return self.rotate(b, rx(x) @ ry(y) @ rz(z))

    @staticmethod
    def blend(a, b, t):
        out = Pose()
        for k in set(a.rot) | set(b.rot):
            qa = quat_from_matrix(a.rot.get(k, np.eye(3)))
            qb = quat_from_matrix(b.rot.get(k, np.eye(3)))
            out.rot[k] = matrix_from_quat(slerp(qa, qb, t))
        for k in set(a.loc) | set(b.loc):
            out.loc[k] = (1 - t) * a.loc.get(k, np.zeros(3)) + t * b.loc.get(k, np.zeros(3))
        return out


# ---------------------------------------------------------------------------------
def _frame_from(y, n):
    y = _n(y)
    n = _n(n - np.dot(n, y) * y)
    return np.stack([y, n, np.cross(y, n)], 1)


def two_bone_ik(rig, pose, upper, lower, target, pole_dir):
    """Rotate `upper` and `lower` so the tail of `lower` reaches `target` (clamped to reach).
    The bend plane contains `pole_dir` (the elbow/knee points toward it). Each bone keeps its
    roll relative to the bend plane it had in the rest pose, so no hidden 180-degree twists.
    Returns the unreachable distance (0 when the target is reachable)."""
    Fu = rig.parent_frame(pose, upper)
    Fl = Fu @ rig.local_rest[lower]
    S = Fu[:3, 3]
    a = rig.sk[upper].length
    b = rig.sk[lower].length
    D = target - S
    dist = np.linalg.norm(D)
    u = D / dist
    d = np.clip(dist, abs(a - b) + 1e-4, a + b - 1e-4)
    p = _perp(pole_dir, u)
    ca = np.clip((a * a + d * d - b * b) / (2 * a * d), -1, 1)
    E = S + a * (ca * u + np.sqrt(1 - ca * ca) * p)
    T = S + d * u
    y1, y2 = _n(E - S), _n(T - E)
    nb = np.cross(y1, y2)
    nb = _n(nb) if np.linalg.norm(nb) > 1e-6 else _n(np.cross(p, u))
    Yu0, Yl0 = Fu[:3, 1], Fl[:3, 1]
    nb0 = _n(np.cross(Yu0, Yl0))
    Ru = _frame_from(y1, nb) @ _frame_from(Yu0, nb0).T
    Rl = _frame_from(y2, nb) @ _frame_from(Yl0, nb0).T
    rig.set_world_rotation(pose, upper, Ru @ Fu[:3, :3])
    rig.set_world_rotation(pose, lower, Rl @ Fl[:3, :3])
    return float(dist - d)


def swing_twist_y(R):
    """Twist angle (radians) of rotation R about local +Y."""
    q = quat_from_matrix(R)
    w, y = q[0], q[2]
    return 2 * np.arctan2(y, w)


def set_hand(rig, pose, side, Rw, twist_share=0.5):
    """Orient the hand in world space and hand `twist_share` of its twist to the twist bone."""
    rig.set_world_rotation(pose, f"hand_{side}", Rw)      # twist bone follows via DRIVERS


def curl_fingers(pose, side, amount, spread=0.0, fingers=FINGERS, thumb=None):
    """amount in [0,1]: 0 = rest, 1 = full fist. Curl is +X about each finger bone."""
    for f in fingers:
        a = amount if not isinstance(amount, dict) else amount.get(f, 0.0)
        pose.rot[f"{f}_01_{side}"] = rx(78 * a) @ rz(spread)
        pose.rot[f"{f}_02_{side}"] = rx(95 * a)
        pose.rot[f"{f}_03_{side}"] = rx(62 * a)
    if thumb is not None:
        pose.rot[f"thumb_01_{side}"] = rx(20 * thumb)
        pose.rot[f"thumb_02_{side}"] = rx(35 * thumb)
        pose.rot[f"thumb_03_{side}"] = rx(45 * thumb)
