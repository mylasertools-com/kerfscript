# Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

# How the parts of each example go together. A part is drawn in its program's
# x/y (mm) and is its sheet thickness deep in z, from 0 up. A recipe returns,
# for each part, the matrix that puts it in the assembled model (z up), or
# None to leave it out. Models without a recipe are laid out flat.

import math
from mathutils import Matrix

MM = 0.001


def T(x=0, y=0, z=0):
    return Matrix.Translation((x * MM, y * MM, z * MM))


def R(axis, deg):
    return Matrix.Rotation(math.radians(deg), 4, axis)


def box_of(p):
    pts = [q for ring in p["cut"] for q in ring]
    xs, ys = [q[0] for q in pts], [q[1] for q in pts]
    return min(xs), min(ys), max(xs), max(ys)


def named(parts, name, copy=1):
    return next(p for p in parts if p["name"] == name and p["copy"] == copy)


# Stand a part up: its x stays x, its y becomes height, its thickness
# points towards -y. Then turn it about z by deg.
def upright(deg=0):
    return R("Z", deg) @ R("X", 90)


_flat = {}


def flat(p, parts):
    """Lay the parts out in rows, like they come off the sheet."""
    key = id(parts)
    if key not in _flat:
        boxes = [box_of(q) for q in parts]
        total = sum((b[2] - b[0] + 8) * (b[3] - b[1] + 8) for b in boxes)
        width = max(max(b[2] - b[0] for b in boxes), math.sqrt(total) * 1.3)
        x = y = row = 0
        spots = {}
        for q, b in sorted(zip(parts, boxes), key=lambda qb: -(qb[1][3] - qb[1][1])):
            w, h = b[2] - b[0], b[3] - b[1]
            if x > 0 and x + w > width:
                x, y, row = 0, y - row - 8, 0
            spots[(q["name"], q["copy"])] = T(x - b[0], y - h - b[1], 0)
            x += w + 8
            row = max(row, h)
        _flat[key] = spots
    return _flat[key][(p["name"], p["copy"])]


def box_parts(w, d, h, t, lid_lift=0):
    def place(p, parts):
        n = p["name"]
        if n == "bottom":
            return T()
        if n == "lid":
            return T(0, 0, h - t + lid_lift)
        if n == "front":
            return T(0, t, 0) @ R("X", 90)
        if n == "back":
            return T(0, d, 0) @ R("X", 90)
        if n == "left":
            return R("Z", 90) @ R("X", 90)
        if n == "right":
            return T(w - t, 0, 0) @ R("Z", 90) @ R("X", 90)
        return None
    return place


# Stand a part up across the x axis: its x runs along y, its y becomes
# height and its thickness points towards +x.
SIDEWAYS = R("Z", 90) @ R("X", 90)


def phone_stand(p, parts):
    t, span, brace_x = 4, 64, 57.2
    if p["name"] == "side":
        return T(0, 12 + t + (p["copy"] - 1) * (span + t), 0) @ R("X", 90)
    return T(brace_x - t / 2, 0, 0) @ SIDEWAYS


def solstice(p, parts):
    t, height = 3, 170
    n = p["name"]
    if n == "Base":
        return T()
    if n == "Crown":
        return T(0, 0, t + height)
    if n in ("Sun wall", "Moon wall"):
        a = (0 if n == "Sun wall" else 90) + (p["copy"] - 1) * 180
        return R("Z", a) @ T(0, -50 + t / 2, t) @ R("X", 90)
    return None


def hadal(p, parts):
    t = 3
    xs = [35, 55, 75, 95, 115, 135, 155, 175, 195]
    zs = [75, 79, 83, 85, 86, 85, 82, 78, 73]
    n = p["name"]
    if n == "Plinth":
        return T(0, 0, -t)
    if n == "Spine":
        return T(0, t / 2, 0) @ R("X", 90)
    if n.startswith("Cradle"):
        return T((65 if n.endswith("A") else 165) - t / 2, 0, 0) @ SIDEWAYS
    if n.startswith("Rib "):
        i = int(n.split()[1]) - 1
        return T(xs[i] - t / 2, 0, zs[i]) @ SIDEWAYS
    return None


def xenospora(p, parts):
    t, height, r = 3, 220, 30
    n = p["name"]
    if n == "Root":
        return T(0, 0, -t)
    if n == "Crown":
        return T(0, 0, height)
    if n == "Core A":
        return T(0, t / 2, 0) @ R("X", 90)
    if n == "Core B":
        return T(-t / 2, 0, 0) @ SIDEWAYS
    if n.startswith("Fin "):
        i = int(n.split()[1]) - 1
        return R("Z", i * 30) @ T(r - t / 2, 0, 0) @ SIDEWAYS
    return None


def stack(order):
    """Parts glued flat on top of each other, in this order."""
    def place(p, parts):
        z = 0
        for q in sorted(parts, key=lambda q: (order(q), q["copy"])):
            if q is p:
                return T(0, 0, z)
            z += q["thickness"]
        return None
    return place


def tilt_maze_order(q):
    return {"Base": 0, "Maze layer": 1, "Cover": 2}[q["name"]]


def topo_order(q):
    return 0 if q["name"] == "Base" else int(q["name"].split()[1])


def drawer_organizer(w=240, d=160, h=50, t=3, cols=4, rows=2):
    panels = box_parts(w, d, h, t)
    inner = (w - 2 * t, d - 2 * t)

    def place(p, parts):
        n = p["name"]
        if n == "Long divider":
            y = t + inner[1] * p["copy"] / rows
            return T(t + 0.5, y + t / 2, t) @ R("X", 90)
        if n == "Cross divider":
            x = t + inner[0] * p["copy"] / cols
            return T(x - t / 2, t + 0.5, t) @ SIDEWAYS
        return panels(p, parts)
    return place


def gears(p, parts):
    if p["name"] == "large gear":
        return T()
    return T(3 * (32 + 14) / 2, 0, 0) @ R("Z", 180 / 14)


def umbra(p, parts):
    t = 3
    depths = [245, 275, 185, 155, 125, 215]
    yaws = [9, 15, -3, -9, -15, 3]
    n = p["name"]
    if n == "Base":
        return T(0, 0, -t)
    if n == "Stone":
        return T(0, 300 + t / 2, 0) @ R("X", 90)
    if n == "Light holder":
        return R("X", 90)
    if n.startswith("Fin "):
        i = int(n.split()[1]) - 1
        return T(0, depths[i], 0) @ R("Z", yaws[i]) @ T(0, t / 2, 0) @ R("X", 90)
    return None


def wave_cathedral(p, parts):
    t = 3
    n = p["name"]
    if n == "Base":
        return T(0, 0, -t)
    if n.startswith("Rail "):
        return T((-100 if n.endswith("L") else 100) - t / 2, 0, 0) @ SIDEWAYS
    if n.startswith("Rib "):
        i = int(n.split()[1]) - 1
        return T(0, 16 + 18 * i + t / 2, 0) @ R("X", 90)
    return None


ASSEMBLIES = {
    "box": {"place": box_parts(120, 80, 50, 3)},
    "phone-stand": {"place": phone_stand},
    "solstice": {"place": solstice},
    "hadal": {"place": hadal, "view": {"azimuth": -50, "elevation": 24}},
    "xenospora": {"place": xenospora, "view": {"azimuth": -20, "elevation": 18}},
    "tilt-maze": {
        "place": stack(tilt_maze_order),
        "balls": [(14.25, 14.25, 3 + 3, 6)],
        "view": {"elevation": 48},
    },
    "topo-island": {"place": stack(topo_order), "view": {"azimuth": -25, "elevation": 38}},
    "drawer-organizer": {"place": drawer_organizer(), "view": {"elevation": 45}},
    "gears": {"place": gears, "view": {"elevation": 50}},
    "wave-cathedral": {"place": wave_cathedral, "view": {"azimuth": -40, "elevation": 26}},
    # The picture shows what Umbra is for: the dragon's shadow on a wall
    # 900 mm away, from a point light at the pinhole. Only the parts go
    # into the GLB.
    "umbra": {
        "place": umbra,
        "wall": {"y": 900, "x": (-330, 230), "z": (-3, 520)},
        "point": (0, 1, 25, 18),
        "view": {"azimuth": -28, "elevation": 14, "lights": False, "world": 0.2, "fill": 0.92},
    },
}
