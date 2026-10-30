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


def morph(t=3, spacers=2):
    """Bottom cover, then layer 1, the spacers, layer 2 and so on."""
    pitch = (1 + spacers) * t

    def place(p, parts):
        n = p["name"]
        if n == "Bottom cover":
            return T()
        if n.startswith("Layer "):
            return T(0, 0, t + (int(n.split()[1]) - 1) * pitch)
        if n == "Spacer":
            g, j = divmod(p["copy"] - 1, spacers)
            return T(0, 0, t + g * pitch + t + j * t)
        return None
    return place


def morph_rods(layers=28, spacers=2, t=3):
    top = t + (layers + (layers - 1) * spacers) * t
    return [(24 * math.cos(math.radians(a)), 24 * math.sin(math.radians(a)), t, top, 6) for a in (0, 120, 235)]


def slot_desk_sign(t=3):
    """Four signs on a desk, two in front and two behind: each panel stands
    in its base's slot. One (x, y, turn) per sign."""
    spots = [(-95, 0, 8), (95, 10, -6), (-190, 150, 12), (45, 170, -4)]

    def place(p, parts):
        x, y, a = spots[p["variant"]]
        at = T(x, y, 0) @ R("Z", a)
        if p["name"] == "Base":
            return at
        if p["name"] == "Panel":
            return at @ T(0, t / 2, t) @ R("X", 90)
        return None
    return place


def polar(r, a):
    return r * math.cos(math.radians(a)), r * math.sin(math.radians(a))


def nut(x, y, z, up=1, d=7.9, h=3.2):
    """A brass M4 nut sitting on z, facing up (1) or down (-1)."""
    return ((x, y, z), (x, y, z + up * h), d, "brass", 6)


def relief(holes, t=3):
    """Fracture and Morphogen: the backer, then the layers from the deepest
    up to layer 0 at the front, held by three bolts with brass heads."""
    def order(q):
        return -1 if q["name"] == "Backer" else 100 - int(q["name"].split()[1])

    def pins(layers):
        top = (layers + 1) * t
        out = []
        for x, y in holes:
            out.append(((x, y, 0), (x, y, top), 4, "steel", 24))
            out.append(((x, y, top), (x, y, top + 0.8), 9, "brass", 32))
            out.append(((x, y, top + 0.8), (x, y, top + 3.6), 7, "brass", 32))
        return out
    return stack(order), pins


def orbit(t=3, np_=24, theta=0):
    """The guide's stack, base underside at z 0: base, ring on standoffs,
    hub sleeves around the sun, planets, carrier, spacer and crank. theta
    turns the crank; the carrier follows at a quarter of it."""
    orbit_r, mounting = 72, 121
    crank_turn = -125 + theta
    carrier = theta * 24 / (24 + 24 + 2 * np_)

    def place(p, parts):
        n, c = p["name"], p["copy"]
        if n == "Base":
            return T(0, 0, (c - 1) * t)
        if n == "Spindle pedestal":
            return T(0, 0, -c * t)
        if n == "Foot":
            j, k = divmod(c - 1, 7)
            return T(*polar(mounting, 30 + 120 * j), -7 * t + k * t)
        if n == "Ring standoff":
            j, k = divmod(c - 1, 4)
            return T(*polar(mounting, 30 + 120 * j), 2 * t + k * t)
        if n == "Ring gear":
            return T(0, 0, 6 * t + 0.5 + (c - 1) * t)
        if n == "Hub sleeve":
            return T(0, 0, (2 * t + 0.5 if c <= 4 else 4 * t + 0.5) + (c - 1) * t)
        if n == "Sun gear":
            return T(0, 0, 6 * t + 0.5 + (c - 1) * t) @ R("Z", theta)
        if n == "Planet gear":
            j, k = divmod(c - 1, 2)
            beta = carrier + 120 * j
            spin = (1 + 24 / np_) * beta - 24 / np_ * theta + 180 - 180 / np_
            return T(*polar(orbit_r, beta), 6 * t + 0.5 + k * t) @ R("Z", spin)
        if n == "Carrier":
            return T(0, 0, 8 * t + 1.2 + (c - 1) * t) @ R("Z", carrier)
        if n == "Carrier spacer":
            return T(0, 0, 10 * t + 1.2)
        if n == "Crank":
            return T(0, 0, 12 * t + 0.5 + (c - 1) * t) @ R("Z", crank_turn)
        if n == "Handle":
            return T(0, 0, 14 * t + 1 + (c - 1) * t) @ R("Z", crank_turn) @ T(0, 44)
        return None

    hx, hy = polar(44, 90 + crank_turn)
    top = 14 * t + 1 + 6 * t
    pins = [((0, 0, -14), (0, 0, 56), 6, "steel", 32), ((0, 0, 14 * t + 1), (0, 0, 14 * t + 8), 14, "steel", 32),
            ((hx, hy, 14 * t + 0.5), (hx, hy, top + 3), 4, "steel", 24), nut(hx, hy, top)]
    for j in range(3):
        x, y = polar(orbit_r, carrier + 120 * j)
        pins += [((x, y, 6 * t), (x, y, 10 * t + 5), 4, "steel", 24), nut(x, y, 10 * t + 1.2)]
        x, y = polar(mounting, 30 + 120 * j)
        pins.append(nut(x, y, 9 * t + 0.5))
    return place, pins


def trace(t=3, teeth=80, offset=22, theta=0):
    """Base, paper, ring on standoffs, pedestal, rolling gear with its pencil
    sleeve, then the carrier with the planet spacer and handle. theta turns
    the carrier."""
    big, small = 1.5 * teeth, 36
    a, mount = big - small, big + 12
    spin = (1 - teeth / 24) * theta
    gx, gy = polar(a, theta)
    px, py = gx + polar(offset, spin)[0], gy + polar(offset, spin)[1]
    hx, hy = polar(35, 180 + theta)

    def place(p, parts):
        n, c = p["name"], p["copy"]
        if n == "Base":
            return T(0, 0, (c - 1) * t)
        if n == "Foot":
            j, k = divmod(c - 1, 5)
            return T(*polar(mount, 30 + 120 * j), -5 * t + k * t)
        if n == "Ring standoff":
            j, k = divmod(c - 1, 4)
            return T(*polar(mount, 30 + 120 * j), 2 * t + k * t)
        if n == "Ring gear":
            return T(0, 0, 6 * t + (c - 1) * t)
        if n == "Pedestal":
            return T(0, 0, 2 * t + (c - 1) * t)
        if n == "Rolling gear":
            return T(gx, gy, 6 * t + 0.15 + (c - 1) * t) @ R("Z", spin)
        if n == "Pencil sleeve":
            return T(px, py, 3 * t + 0.15 + (c - 1) * t)
        if n == "Planet spacer":
            return T(gx, gy, 8 * t + 0.35 + (c - 1) * t)
        if n == "Carrier":
            return T(0, 0, 11 * t + 0.35 + (c - 1) * t) @ R("Z", theta)
        if n == "Handle":
            return T(hx, hy, 13 * t + 0.85 + (c - 1) * t)
        return None

    # The drawing: a hypotrochoid that closes after three carrier turns
    curve = []
    for i in range(0, 3 * 720 + 1):
        th = math.radians(i / 2)
        k = 1 - teeth / 24
        curve.append((a * math.cos(th) + offset * math.cos(k * th), a * math.sin(th) + offset * math.sin(k * th)))
    disc = lambda r, n=180: [polar(r, 360 * i / n) for i in range(n)]
    flats = [{"rings": [disc(big - 6), disc(13)], "z": 2 * t, "depth": 0.15, "color": "#f7f4ee",
              "lines": [curve], "line_color": "#3d6f7d", "line_width": 0.5}]
    top = 13 * t + 0.35
    pins = [((0, 0, -10), (0, 0, top + 8), 6, "steel", 32), ((0, 0, top + 0.5), (0, 0, top + 7.5), 14, "steel", 32),
            ((px, py, 2 * t + 0.15), (px, py, 2 * t + 21), 7, "pencil", 6),
            ((gx, gy, 6 * t - 3.6), (gx, gy, top + 4.5), 4, "steel", 24), nut(gx, gy, top),
            ((hx, hy, top), (hx, hy, top + 5 * t + 4.5), 4, "steel", 24), nut(hx, hy, top + 0.5 + 5 * t)]
    for j in range(3):
        pins.append(nut(*polar(mount, 30 + 120 * j), 8 * t))
    return place, pins, flats


def stride_joints(s=2, crank=15, theta=0):
    """Jansen's linkage at crank angle theta: O, Y, Z, X, W, V, U, T, as in
    the program."""
    def meet(p, r1, q, r2, sgn):
        vx, vy = q[0] - p[0], q[1] - p[1]
        d = math.hypot(vx, vy)
        a = (r1 * r1 - r2 * r2 + d * d) / (2 * d)
        h = math.sqrt(max(0, r1 * r1 - a * a))
        return (p[0] + vx * a / d - vy * h / d * sgn, p[1] + vy * a / d + vx * h / d * sgn)
    O, Y, Z = (0, 0), (-38, -7.8), polar(crank, theta)
    X = meet(Z, 50, Y, 41.5, -1)
    W = meet(Z, 61.9, Y, 39.3, 1)
    V = meet(Y, 40.1, X, 55.8, 1)
    U = meet(V, 39.4, W, 36.7, -1)
    Tj = meet(W, 49, U, 65.7, 1)
    return {k: (p[0] * s, p[1] * s) for k, p in zip("OYZXWVUT", (O, Y, Z, X, W, V, U, Tj))}


def stride(t=3, s=2, theta=0):
    """The board stands on two halved feet; the links hang in front of it at
    the guide's depths, C nearest the board and F at the front. theta turns
    the crank; the rocker and foot are drawn where they sit at angle 0."""
    J = stride_joints(s, theta=theta)
    J0 = stride_joints(s)
    ox, oz = 125 * s, 133 * s
    at = {k: (ox + x, oz + y) for k, (x, y) in J.items()}
    depth = {n: 10 + i * (t + 5) for i, n in enumerate("CARDBEF")}
    rods = {"A upper link": ("A", "Z", "X"), "B lower link": ("B", "Z", "W"),
            "D anchor link": ("D", "Y", "W"), "E coupler": ("E", "V", "U")}
    # Spacer stacks: joint, and the layer whose front face they start from
    spacers = {"Z, C to A": ("Z", "C"), "Z, A to B": ("Z", "A"), "X, A to R": ("X", "A"),
               "W, D to B": ("W", "D"), "W, B to F": ("W", "B"), "U, E to F": ("U", "E"),
               "V, R to E": ("V", "R"), "Y, R to D": ("Y", "R"), "Y, board to R": ("Y", None)}
    turn = -70 + theta

    def front(x, z, d):
        """A flat part with its back face d mm in front of the board."""
        return T(x, -d, z) @ R("X", 90)

    def place(p, parts):
        n, c = p["name"], p["copy"]
        if n == "Backboard":
            return T(0, c * t, 0) @ R("X", 90)
        if n == "Stand foot":
            j, k = divmod(c - 1, 2)
            return T((25 if j == 0 else 155) * s - t + k * t, 1.5 * t - 65, 0) @ SIDEWAYS
        if n == "C crank":
            return front(ox, oz, depth["C"]) @ R("Z", theta)
        if n in ("R rocker", "F foot"):
            # Turn the part as drawn about its first joint, Y or W
            a, b = ("Y", "X") if n[0] == "R" else ("W", "U")
            was = math.atan2(J0[b][1] - J0[a][1], J0[b][0] - J0[a][0])
            now = math.atan2(J[b][1] - J[a][1], J[b][0] - J[a][0])
            return (front(*at[a], depth[n[0]]) @ R("Z", math.degrees(now - was))
                    @ T(-J0[a][0], -J0[a][1]))
        if n in rods:
            layer, a, b = rods[n]
            ang = math.degrees(math.atan2(at[b][1] - at[a][1], at[b][0] - at[a][0]))
            return front(*at[a], depth[layer]) @ R("Z", ang)
        if n.startswith("Spacer "):
            joint, behind = spacers[n[7:]]
            return front(*at[joint], (depth[behind] + t if behind else 0) + (c - 1) * t)
        if n == "Hex socket":
            if c == 1:
                return front(ox, oz, depth["C"] + t) @ R("Z", theta)
            return front(ox, oz, -3 * t - 1 - 3 * t) @ R("Z", turn)
        if n == "Rear crank":
            return front(ox, oz, -3 * t - 1 - c * t) @ R("Z", turn)
        if n == "Handle grip":
            return front(ox, oz, -6 * t - 1 - c * t) @ R("Z", turn) @ T(40, 0)
        return None

    def span(k, d0, d1, d=6):
        x, z = at[k]
        return ((x, -d0, z), (x, -d1, z), d, "brass", 32)

    def cap(k, d):
        x, z = at[k]
        return ((x, -d, z), (x, -d - 3.2, z), 7.9, "brass", 6)

    last = depth["F"] + t
    pins = [span("Z", depth["C"], depth["B"] + t), cap("Z", depth["B"] + t),
            span("X", depth["A"], depth["R"] + t), cap("X", depth["R"] + t),
            span("W", depth["D"], last), cap("W", last),
            span("V", depth["R"], depth["E"] + t), cap("V", depth["E"] + t),
            span("U", depth["E"], last), cap("U", last),
            span("Y", 0, depth["D"] + t), cap("Y", depth["D"] + t),
            span("O", -3 * t, depth["C"]), span("O", depth["C"], depth["C"] + 2 * t, 4)]
    return place, pins


def tidal(t=3, fins=7, lift=8, phase=45, pitch_layers=9, theta=0):
    """Base and end walls, the rotor on its square shaft (journal, rings,
    cams, rings, journal), followers on the cams through the two guides,
    washers, crank and collars outside the walls."""
    pitch, cam_t, margin = pitch_layers * t, 3 * t, 8 * t
    inner = 2 * margin + cam_t + (fins - 1) * pitch + 0.8
    overall = inner + 6 * t
    shaft, mid, crank_turn = 45, 55, 160 + theta

    def station(i):
        return 3 * t + margin + cam_t / 2 + i * pitch

    def on_shaft(x):
        return T(x, mid, shaft) @ SIDEWAYS

    # Where each spacer ring sits along the shaft
    rings = [3 * t + k * t for k in range(8)]
    for i in range(fins - 1):
        rings += [station(i) + cam_t / 2 + k * t for k in range(pitch_layers - 3)]
    rings += [station(fins - 1) + cam_t / 2 + k * t for k in range(8)]

    def place(p, parts):
        n, c = p["name"], p["copy"]
        side = lambda k: (k - 1) * t if k <= 3 else overall - 3 * t + (k - 4) * t
        if n == "Base":
            return T(0, 0, (c - 1) * t)
        if n == "End wall":
            return T(side(c), mid, 0) @ SIDEWAYS
        if n == "Journal":
            return on_shaft(side(c)) @ R("Z", theta)
        if n == "Guide half":
            z = (90, 126)[(c - 1) // 2]
            if c % 2:
                return T(3 * t, mid - 45, z)
            return T(3 * t, mid + 45, z + t) @ R("X", 180)
        if n == "Thrust washer":
            return on_shaft(-c * t if c <= 2 else overall + (c - 3) * t)
        if n.startswith("Cam "):
            i = int(n.split()[1]) - 1
            return on_shaft(station(i) - cam_t / 2 + (c - 1) * t) @ R("Z", i * phase + theta)
        if n.startswith("Fin "):
            i = int(n.split()[1]) - 1
            lift_z = shaft + 22 + lift * math.sin(math.radians(i * phase + theta))
            return T(station(i) - t + (c - 1) * t, mid, lift_z) @ SIDEWAYS
        if n == "Spacer ring":
            return on_shaft(rings[c - 1]) if c <= len(rings) else None
        if n == "Crank":
            return on_shaft(-5 * t + (c - 1) * t) @ R("Z", crank_turn)
        if n == "Handle":
            return on_shaft(-5 * t - c * t) @ R("Z", crank_turn) @ T(0, 30)
        return None

    hy, hz = polar(30, 90 + crank_turn)
    pins = [((-5 * t - 9, mid, shaft), (overall + 2 * t + 9, mid, shaft), 6, "steel", 4),
            ((-5 * t - 8, mid, shaft), (-5 * t, mid, shaft), 22, "steel", 32),
            ((overall + 2 * t, mid, shaft), (overall + 2 * t + 8, mid, shaft), 22, "steel", 32),
            ((-2 * t, mid + hy, shaft + hz), (-11 * t - 5, mid + hy, shaft + hz), 4, "steel", 24),
            ((-11 * t - 1, mid + hy, shaft + hz), (-11 * t - 4.2, mid + hy, shaft + hz), 7.9, "brass", 6)]
    return place, pins


_fracture_place, _fracture_pins = relief([polar(192, a) for a in (30, 150, 270)])
_morphogen_place, _morphogen_pins = relief([polar(172, a) for a in (20, 142, 268)])
_orbit_place, _orbit_pins = orbit()
_trace_place, _trace_pins, _trace_flats = trace()
_stride_place, _stride_pins = stride()
_tidal_place, _tidal_pins = tidal()

ASSEMBLIES = {
    "fracture": {"place": _fracture_place, "pins": _fracture_pins(5), "view": {"azimuth": -20, "elevation": 40}},
    "morphogen": {"place": _morphogen_place, "pins": _morphogen_pins(4), "view": {"azimuth": -20, "elevation": 40}},
    "orbit": {"place": _orbit_place, "pins": _orbit_pins, "view": {"azimuth": -25, "elevation": 38}},
    "trace": {"place": _trace_place, "pins": _trace_pins, "flats": _trace_flats, "view": {"azimuth": -25, "elevation": 38}},
    "stride": {"place": _stride_place, "pins": _stride_pins, "view": {"azimuth": -32, "elevation": 14}},
    "tidal": {"place": _tidal_place, "pins": _tidal_pins, "view": {"azimuth": -38, "elevation": 22}},
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
    "slot-desk-sign": {"place": slot_desk_sign(), "view": {"azimuth": -14, "elevation": 20}},
    "morph": {"place": morph(), "rods": morph_rods(), "view": {"azimuth": -30, "elevation": 22}},
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
