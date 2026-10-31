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


def ascent(t=3, theta=0):
    """The guide's stack, seen from the front with the shaft at the origin
    and the base underside at z 0: rear cheek, shroud rings round the wheel,
    front cheek with the gate, the chute floor between the cheek walls and
    the catch box on its pedestals. Behind the rear collar: hub rings, the
    crank and its grip. theta turns the crank clockwise, seen from the
    front; the marble rolls down the chute from the pocket that has just
    let it go."""
    radius, D = 110, 16
    layers = math.ceil((D + 2) / t)
    gap = (layers + 1) * t
    centre = t + radius + 110
    # Wheel, crank and grip turn together; at 0 a pocket points 45 degrees
    # down to the right, into the release opening
    turn = -15 - theta
    slope = math.degrees(math.atan2(158.25 - 110, 258 - 65))
    floor_top = centre - 158.25
    crank_z = -40

    def depth(z0, x=0, y=0):
        """A part drawn in the front view, its back face at guide depth z0
        (the front is +z, towards -y in the model), moved to x, y."""
        return T(x, -z0, centre + y) @ upright()

    def place(p, parts):
        n, c = p["name"], p["copy"]
        if n == "Base":
            return T()
        if n == "Rear cheek":
            return depth(-gap / 2 - t)
        if n == "Front cheek":
            return depth(gap / 2)
        if n == "Shroud":
            return depth(-gap / 2 + (c - 1) * t)
        if n == "Wheel":
            return depth(-layers * t / 2 + (c - 1) * t) @ R("Z", turn)
        if n == "Loading gate":
            return depth(gap / 2 + t, 0, -(radius + 2 - D / 2))
        if n == "Gusset":
            # Two in front of the stand and two behind, at x = -50 and 50
            x = -50 if c % 2 else 50
            if c <= 2:
                return T(x + t / 2, -gap / 2 - t, t) @ R("Z", 180) @ SIDEWAYS
            return T(x - t / 2, gap / 2 + t, t) @ SIDEWAYS
        if n == "Chute floor":
            # Its top face on the floor line, from (65, -110) to (258, -158.25)
            return T((65 + 258) / 2, 0, centre - (110 + 158.25) / 2) @ R("Y", slope) @ T(0, 0, -t)
        if n == "Catch floor":
            return T(283, 0, floor_top - t)
        if n == "Catch lid":
            return T(283, 0, floor_top + 22)
        if n == "Catch side wall":
            return T(283, 25 if c == 1 else 3 - 25, floor_top + 11) @ upright()
        if n == "Catch end wall":
            return T(308 - t, 0, floor_top + 11) @ SIDEWAYS
        if n == "Catch pedestal":
            return T(283, 20 if c == 1 else t - 20, t + (floor_top - 2 * t) / 2) @ upright()
        if n == "Hub ring":
            z0 = crank_z - 3 * t + (c - 1) * t if c <= 2 else crank_z + t + (c - 3) * t
            return depth(z0) @ R("Z", turn)
        if n == "Crank":
            return depth(crank_z - t + (c - 1) * t) @ R("Z", turn)
        if n == "Grip":
            return depth(crank_z - t - 0.8 - c * t) @ R("Z", turn) @ T(35, 0)
        return None

    def axial(x, y, z0, z1, d, kind, sides=32):
        """Hardware along the shaft direction at (x, y) in the front view,
        from guide depth z0 to z1."""
        return ((x, -z0, centre + y), (x, -z1, centre + y), d, kind, sides)

    face = gap / 2 + t
    pins = [axial(0, 0, -52, 28, 6, "steel"),
            axial(0, 0, gap / 2, face, 8, "brass"), axial(0, 0, -face, -gap / 2, 8, "brass"),
            axial(0, 0, face + 0.3, face + 7.3, 12, "steel"), axial(0, 0, -face - 7.3, -face - 0.3, 12, "steel")]
    # Six M4 x 40 bolts through cheeks and shroud, heads behind, nuts in front
    for a in (0, 60, 120, 180, 240, 285):
        x, y = polar(radius + 13, a)
        pins += [axial(x, y, -face - 0.8, -face - 0.8 + 40, 4, "steel", 24),
                 axial(x, y, -face - 0.8, -face, 9, "steel"), axial(x, y, -face - 3.6, -face - 0.8, 7.9, "brass", 6),
                 axial(x, y, face, face + 0.8, 9, "steel"), axial(x, y, face + 0.8, face + 4, 7.9, "brass", 6)]
    # The gate's pivot: a countersunk M4 bolt from inside, washer and wingnut
    gx, gy = D / 2 + 13, -(radius + 2 - D / 2)
    out = face + t
    pins += [axial(gx, gy, gap / 2, out + 6, 4, "steel", 24), axial(gx, gy, out, out + 0.8, 9, "steel"),
             axial(gx, gy, out + 0.8, out + 4.5, 8, "brass", 6),
             ((gx - 9, -out - 3, centre + gy), (gx + 9, -out - 3, centre + gy), 2.5, "brass", 4)]
    # The grip: M4 x 30 bolt through the crank and the sleeve, nyloc behind
    hx, hy = polar(35, turn)
    back = crank_z - t - 0.8 - 4 * t
    pins += [axial(hx, hy, crank_z + t, crank_z + t - 30, 4, "steel", 24),
             axial(hx, hy, crank_z + t, crank_z + t + 2.8, 7, "steel", 6),
             axial(hx, hy, crank_z - t - 0.8, crank_z - t, 9, "steel"),
             axial(hx, hy, back - 0.8, back, 9, "steel"), axial(hx, hy, back - 4.8, back - 0.8, 7.9, "brass", 6)]
    # The marble, rolling down the chute 150 mm out from the shaft
    s, c = math.sin(math.radians(slope)), math.cos(math.radians(slope))
    bx, by = 150, -110 - (150 - 65) * s / c
    balls = [(bx + D / 2 * s, 0, centre + by + D / 2 * c, D)]
    return place, pins, balls


def expanse(t=3, theta=25):
    """The guide's stack, base underside at z 0: feet under the base, the
    rails standing in it, the disc (t + 2), the followers (t + 10) between
    the rails, the deck on its corner standoffs (t + 20) with the well walls,
    and the trays on their moving posts (2t + 40). theta turns the disc, from
    74 (closed) to 15 (open); the trays slide out with it."""
    W, D, crank, closed = 100, 140, 70, 74
    base_w, base_d, rail_y, well = 330.64, 190, 81.7, 45
    x = W / 2 + 2 + crank * (math.cos(math.radians(theta)) - math.cos(math.radians(closed)))
    corners = [(sx * (base_w / 2 - 8), sy * (base_d / 2 - 8)) for sx in (-1, 1) for sy in (-1, 1)]
    posts = [(s * x + px, py) for s in (1, -1) for px in (-W / 2 + 8, W / 2 - 8) for py in (-D / 2 + 8, D / 2 - 8)]
    floor = 2 * t + 40

    def place(p, parts):
        n, c = p["name"], p["copy"]
        side = 1 if c <= 2 else -1
        if n == "Base":
            return T()
        if n == "Foot":
            j, k = divmod(c - 1, 3)
            return T(*corners[j], -3 * t + k * t)
        if n == "Guide rail":
            return T(0, (1 if c == 1 else -1) * rail_y + t / 2, t) @ upright()
        if n == "Drive disc":
            return T(0, 0, t + 2) @ R("Z", theta)
        if n == "Right follower":
            return T(x, 0, t + 10)
        if n == "Left follower":
            return T(-x, 0, t + 10)
        if n == "Deck":
            return T(0, 0, t + 20)
        if n == "Well side wall":
            return T((1 if c == 1 else -1) * well - t / 2, 0, 2 * t + 20) @ SIDEWAYS
        if n == "Well end wall":
            return T(0, (1 if c == 1 else -1) * well + t / 2, 2 * t + 20) @ upright()
        if n == "Tray floor":
            return T((1 if c == 1 else -1) * x, 0, floor)
        if n == "Tray end wall":
            y = (1 if c % 2 else -1) * (D / 2 - t / 2)
            return T(side * x, y + t / 2, floor + t) @ upright()
        if n == "Tray side wall":
            dx = (1 if c % 2 else -1) * (W / 2 - t / 2)
            return T(side * x + dx - t / 2, 0, floor + t) @ SIDEWAYS
        return None

    def bolt(bx, by, top):
        """An M4 bolt up through the base, its head underneath, above the foot bottoms."""
        return [((bx, by, -2.8), (bx, by, 0), 7, "steel", 32), ((bx, by, 0), (bx, by, top), 4, "steel", 24)]

    def screws(sx, sy, under, over):
        """Screw heads under and on top of a standoff."""
        return [((sx, sy, under - 2.5), (sx, sy, under), 7, "steel", 32), ((sx, sy, over), (sx, sy, over + 2.5), 7, "steel", 32)]

    # Centre axle on the 2 mm thrust shim, and the two stop pins, each with
    # a sleeve, washer and nut
    pins = [((0, 0, t), (0, 0, t + 2), 10, "steel", 32)]
    for bx, by in [(0, 0), polar(35, 100), polar(35, 280)]:
        pins += bolt(bx, by, 2 * t + 6.2)
        pins += [((bx, by, t), (bx, by, t + 5.2), 6, "steel", 32),
                 ((bx, by, t + 5.2), (bx, by, t + 6), 9, "steel", 32), nut(bx, by, t + 6)]
    # Countersunk drive bolts in the disc, with their sleeves in the followers' slots
    for a in (theta, theta + 180):
        bx, by = polar(crank, a)
        pins += [((bx, by, t + 2), (bx, by, 2 * t + 14.2), 4, "steel", 24),
                 ((bx, by, 2 * t + 2), (bx, by, 2 * t + 10.2), 6, "steel", 32),
                 ((bx, by, 2 * t + 10.2), (bx, by, 2 * t + 11), 8, "steel", 32), nut(bx, by, 2 * t + 11)]
    # Fixed guide bolts: a 10 mm spacer under the follower, a sleeve in its slot
    for bx, by in [(sx * 86, sy * (D / 2 - 18)) for sx in (-1, 1) for sy in (-1, 1)]:
        pins += bolt(bx, by, 2 * t + 14.2)
        pins += [((bx, by, t), (bx, by, t + 10), 9, "brass", 32), ((bx, by, t), (bx, by, 2 * t + 10.2), 6, "steel", 32),
                 ((bx, by, 2 * t + 10.2), (bx, by, 2 * t + 11), 10, "steel", 32), nut(bx, by, 2 * t + 11)]
    # 20 mm deck standoffs at the corners, 30 mm tray posts on the followers
    for sx, sy in corners:
        pins += [((sx, sy, t), (sx, sy, t + 20), 8.1, "brass", 6)] + screws(sx, sy, 0, 2 * t + 20)
    for sx, sy in posts:
        pins += [((sx, sy, 2 * t + 10), (sx, sy, floor), 8.1, "brass", 6)] + screws(sx, sy, t + 10, floor + t)
    return place, pins


def celestial(t=3, theta=432):
    """The guide's stack, base underside at z 0: base on four feet, a
    pedestal and shim under each journal, the orbit gears on the left journal
    and the drive gears and crank on the right one at z 15, 35, 55 and 75,
    planets on the orbit gears and the sun on its rod at z 85. theta turns
    the crank; the orbit gears follow at -1/2, -1 and -2 times it."""
    m, w = 3, 1
    axle = 45 * m
    corners = [(x, y) for x in (-27 * m, axle + 27 * m) for y in (-27 * m, 27 * m)]
    levels = {"Lower": (60, 15), "Middle": (45, 35), "Upper": (30, 55)}
    turn = {zc: -theta * (90 - zc) / zc for zc, _ in levels.values()}

    def place(p, parts):
        n, c = p["name"], p["copy"]
        if n == "Base":
            return T(0, 0, (c - 1) * t)
        if n == "Foot":
            j, k = divmod(c - 1, 3)
            return T(*corners[j], -3 * t + k * t)
        if n == "Journal pedestal":
            j, k = divmod(c - 1, 2)
            return T(j * axle, 0, 2 * t + k * t)
        if n.endswith(" orbit gear"):
            zc, z = levels[n.split()[0]]
            return T(0, 0, z + (c - 1) * t) @ R("Z", turn[zc])
        if n.endswith(" drive gear"):
            zc, z = levels[n.split()[0]]
            return T(axle, 0, z + (c - 1) * t) @ R("Z", theta)
        if n == "Planet":
            j, k = divmod(c - 1, 3)
            zc, z = list(levels.values())[j]
            return R("Z", turn[zc]) @ T(zc * m / 2 - 12, 0, z + 2 * t + k * t)
        if n == "Sun":
            return T(0, 0, 85 + (c - 1) * t)
        if n == "Crank":
            return T(axle, 0, 75 + (c - 1) * t) @ R("Z", theta)
        if n == "Handle":
            return T(axle, 0, 82 + (c - 1) * t) @ R("Z", theta) @ T(0, 40)
        return None

    # Both journals: an M6 rod from under the base, the 8 mm tube clamped on
    # it, the shim and washer on the pedestal, and a retaining washer and nut
    # on the tube end
    pins = []
    for x, top, rod in ((0, 62.25, 99), (axle, 82.25, 92)):
        pins += [nut(x, 0, 0, -1, 11.5, 4), ((x, 0, -4), (x, 0, rod), 6, "steel", 32),
                 ((x, 0, 2 * t), (x, 0, top), 8, "steel", 32), ((x, 0, 4 * t), (x, 0, 14), 16, "steel", 32),
                 ((x, 0, 14), (x, 0, 15), 12, "steel", 32), ((x, 0, top), (x, 0, top + w), 14, "steel", 32),
                 nut(x, 0, top + w, 1, 11.5, 5)]
    # Orbit journal: a thrust washer on each side of every gear, floating
    # sleeves between them, then a spacer on the rod up to the sun
    for z in (15, 35, 55):
        pins += [((0, 0, z + 2 * t), (0, 0, z + 2 * t + w), 12, "steel", 32)]
        if z > 15:
            pins += [((0, 0, z - w), (0, 0, z), 12, "steel", 32)]
        if z < 55:
            pins += [((0, 0, z + 2 * t + w), (0, 0, z + 20 - w), 12, "brass", 32)]
    pins += [((0, 0, 62.25 + w + 5), (0, 0, 85), 10, "brass", 32),
             ((0, 0, 85 + 2 * t), (0, 0, 85 + 2 * t + w), 12, "steel", 32), nut(0, 0, 85 + 2 * t + w, 1, 11.5, 5)]
    # Drive compound: two M3 rods at +-12 mm turning with it, 14 mm spacers
    # between the gears and the crank, nuts under the lowest gear and on top
    pins += [((axle, 0, 75 + 2 * t), (axle, 0, 75 + 2 * t + w), 12, "steel", 32)]
    for s in (-12, 12):
        x, y = polar(s, theta)
        x += axle
        pins += [((x, y, 10), (x, y, 87), 3, "steel", 16), nut(x, y, 15, -1, 6.4, 3),
                 nut(x, y, 75 + 2 * t, 1, 6.4, 3)]
        pins += [((x, y, z + 2 * t), (x, y, z + 20), 6, "brass", 24) for z in (15, 35, 55)]
    # Handle: an M4 bolt up through the crank, a thrust washer each side of
    # the handle and a nut on top
    hx, hy = polar(40, 90 + theta)
    hx += axle
    pins += [nut(hx, hy, 75, -1), ((hx, hy, 71.8), (hx, hy, 102), 4, "steel", 24),
             ((hx, hy, 81), (hx, hy, 82), 10, "steel", 32), ((hx, hy, 97), (hx, hy, 98), 10, "steel", 32),
             nut(hx, hy, 98)]
    # Hold-down bolts through the base and feet
    for x, y in corners:
        pins += [nut(x, y, 2 * t), ((x, y, -6), (x, y, 2 * t), 4, "steel", 24), nut(x, y, 0, -1)]
    return place, pins


def flight(t=3, theta=0):
    """The board stands in two halved feet; the fixed root and guide posts
    stand off its front on glued rings, and the moving layers sit at the
    guide's depths: crank disc, drive rod, slider, left link, right link,
    wings. theta turns the crank from 240 degrees, where the wings are near
    the top of their beat."""
    crank_r, link, arm = 12, 50, 25
    O, guides, roots = (0, 85), ((0, 165), (0, 185)), ((-35, 180), (35, 180))
    crank = 240 + theta

    def meet(p, r1, q, r2, sgn):
        vx, vy = q[0] - p[0], q[1] - p[1]
        d = math.hypot(vx, vy)
        a = (r1 * r1 - r2 * r2 + d * d) / (2 * d)
        h = math.sqrt(max(0, r1 * r1 - a * a))
        return (p[0] + vx * a / d - vy * h / d * sgn, p[1] + vy * a / d + vx * h / d * sgn)

    cx, cy = polar(crank_r, crank)
    C = (O[0] + cx, O[1] + cy)
    S = (0, C[1] + math.sqrt(link * link - C[0] ** 2))
    # The outward branch: the link pin inboard of the root, the wing level
    # at crank angle 0 rather than hanging down
    BR = meet(S, link, roots[1], arm, 1)
    BL = (-BR[0], BR[1])
    wing = math.degrees(math.atan2(roots[1][1] - BR[1], roots[1][0] - BR[0]))
    at = {"O": O, "C": C, "S": S, "L": BL, "R": BR}
    depth = {"crank": t + 1, "rod": 5 * t + 1, "slider": 7 * t + 1, "left": 11 * t + 1,
             "right": 13 * t + 1, "wing": 16 * t + 4}
    # Spacer rings: joint and rear face, crank pin, slider pivot, left and
    # right link pins; the last four are spares
    rings = ([("C", depth["crank"] + k * t) for k in (1, 2, 3)]
             + [("S", d) for d in (6 * t + 1, 8 * t + 1, 9 * t + 1, 10 * t + 1, 12 * t + 1)]
             + [("L", depth["left"] + k * t) for k in (1, 2, 3, 4)]
             + [("R", depth["right"] + k * t) for k in (1, 2)])

    def front(x, z, d):
        """A flat part with its back face d mm in front of the board."""
        return T(x, -d, z) @ R("X", 90)

    def towards(a, b):
        """A rod drawn up its y axis, turned to run from joint a to joint b."""
        return R("Z", math.degrees(math.atan2(at[b][1] - at[a][1], at[b][0] - at[a][0])) - 90)

    def place(p, parts):
        n, c = p["name"], p["copy"]
        if n == "Backboard":
            return T(0, c * t, 0) @ R("X", 90)
        if n == "Stand foot":
            j, k = divmod(c - 1, 2)
            return T((-45, 45)[j] - t + k * t, 1.5 * t, 0) @ SIDEWAYS
        if n == "Right wing":
            return front(*roots[1], depth["wing"]) @ R("Z", wing)
        if n == "Left wing":
            return front(*roots[0], depth["wing"]) @ R("Z", -wing)
        if n == "Crank disc":
            return front(*O, depth["crank"]) @ R("Z", crank - 90)
        if n == "Rear crank":
            return front(*O, -3 * t - 4 - c * t) @ R("Z", crank - 90)
        if n == "Handle grip":
            return front(*O, -6 * t - 4 - c * t) @ R("Z", crank - 90) @ T(0, 30)
        if n == "Drive rod":
            return front(*C, depth["rod"]) @ towards("C", "S")
        if n == "Wing link":
            side = "left" if c == 1 else "right"
            return front(*S, depth[side]) @ towards("S", side[0].upper())
        if n == "Slider":
            return front(*S, depth["slider"])
        if n == "Root standoff":
            j, k = divmod(c - 1, 16)
            return front(*roots[j], k * t)
        if n == "Guide standoff":
            j, k = divmod(c - 1, 7)
            return front(*guides[j], k * t)
        if n == "Spacer ring":
            if c > len(rings):
                return None
            joint, d = rings[c - 1]
            return front(*at[joint], d)
        return None

    def bar(p, d0, d1, d, kind, sides=32):
        """Hardware along the depth axis at p, from depth d0 to d1."""
        return ((p[0], -d0, p[1]), (p[0], -d1, p[1]), d, kind, sides)

    def pivot(p, d0, d1, shim=None, head=None):
        """A 6 mm brass sleeve from d0 to d1 on an M4 bolt: head and washer
        behind (at d0 unless given), washer and nut in front, and a metal shim
        pack (from, to)."""
        h = d0 if head is None else head
        out = [bar(p, h - 3.3, d1 + 4.5, 4, "steel", 24), bar(p, d0, d1, 6, "brass"),
               bar(p, h, h - 0.5, 8, "steel"), bar(p, h - 0.5, h - 3.3, 7.9, "steel", 6),
               bar(p, d1, d1 + 0.5, 8, "steel"), bar(p, d1 + 0.5, d1 + 3.7, 7.9, "brass", 6)]
        if shim:
            out.append(bar(p, shim[0], shim[1], 12, "steel"))
        return out

    top = 17 * t + 4.2
    G = (O[0] + polar(30, crank)[0], O[1] + polar(30, crank)[1])
    pins = []
    # Fixed posts: the bolt head is behind the board and the sleeve bears on
    # its front
    for p in roots:
        pins += pivot(p, 0, top, (16 * t, 16 * t + 4), -3 * t)
    for p in guides:
        pins += pivot(p, 0, 8 * t + 1.2, (7 * t, 7 * t + 1), -3 * t)
    # Moving pivots
    pins += pivot(C, t + 1, 6 * t + 1.2)
    pins += pivot(S, 5 * t + 1, 14 * t + 1.2)
    pins += pivot(BL, 11 * t + 1, top, (16 * t + 1, 16 * t + 4))
    pins += pivot(BR, 13 * t + 1, top, (16 * t + 1, 16 * t + 4))
    # The spindle in its journal, clamped to both cranks by a full nut inside
    # and two jam nuts outside each one
    pins += [bar(O, -6 * t - 8.9, 2 * t + 5.9, 4, "steel", 24), bar(O, -3 * t - 0.1, t - 2.9, 6, "brass"),
             bar(O, t - 2.7, t + 0.5, 7.9, "brass", 6), bar(O, t + 0.5, t + 1, 8, "steel"),
             bar(O, 2 * t + 1, 2 * t + 1.5, 8, "steel"), bar(O, 2 * t + 1.5, 2 * t + 5.9, 7.9, "brass", 6),
             bar(O, -3 * t - 0.3, -3 * t - 3.5, 7.9, "brass", 6), bar(O, -3 * t - 3.5, -3 * t - 4, 8, "steel"),
             bar(O, -6 * t - 4, -6 * t - 4.5, 8, "steel"), bar(O, -6 * t - 4.5, -6 * t - 8.9, 7.9, "brass", 6)]
    # The handle grip turns on its sleeve, bolted to the rear crank
    pins += [bar(G, -3 * t - 1.2, -11 * t - 8.2, 4, "steel", 24), bar(G, -3 * t - 1.2, -3 * t - 4, 7.9, "steel", 6),
             bar(G, -6 * t - 4, -11 * t - 4.2, 6, "brass"), bar(G, -11 * t - 4.2, -11 * t - 4.7, 8, "steel"),
             bar(G, -11 * t - 4.7, -11 * t - 7.9, 7.9, "brass", 6)]
    return place, pins


def bloom(t=3, ring=35):
    """The guide's stack, z 0 at the top of the base: base laminates, feet
    below, hub and drive ring, retainer, grip, then on each ring pin a spacer
    and the coupler, and each petal on its two sleeves through its slot.
    ring is the drive ring's angle, 55 closed to 15 open."""
    n, pivot, link, spacing = 6, 60, 70, 30

    def guide(k):
        return 360 * k / n

    # The slider-crank: ring pin k is ring degrees past guide k, and the
    # coupler holds the petal's inner pin this far out
    a = math.radians(ring)
    out = pivot * math.cos(a) + math.sqrt(link * link - (pivot * math.sin(a)) ** 2)

    def ring_pin(k):
        return polar(pivot, guide(k) + ring)

    def place(p, parts):
        nm, c = p["name"], p["copy"]
        if nm == "Base":
            return T(0, 0, -2 * t + (c - 1) * t)
        if nm == "Foot cap":
            return T(*polar(65, guide(c - 0.5)), -3 * t)
        if nm == "Foot ring":
            j, k = divmod(c - 1, 5)
            return T(*polar(65, guide(j + 0.5)), -4 * t - k * t)
        if nm == "Hub":
            return T(0, 0, 0.4)
        if nm == "Drive ring":
            return T(0, 0, 0.2) @ R("Z", ring)
        if nm == "Retainer":
            return T(0, 0, t + 0.4)
        if nm == "Grip ring":
            return T(*polar(43, 90 + ring), t + 0.4 + (c - 1) * t)
        if nm == "Ring pivot spacer":
            return T(*ring_pin(c - 1), t + 0.2)
        if nm == "Coupler":
            (px, py), (sx, sy) = ring_pin(c - 1), polar(out, guide(c - 1))
            return T(px, py, 2 * t + 1) @ R("Z", math.degrees(math.atan2(sy - py, sx - px)))
        if nm == "Inner pin spacer":
            j, k = divmod(c - 1, 2)
            return T(*polar(out, guide(j)), k * t)
        if nm == "Outer pin spacer":
            j, k = divmod(c - 1, 3)
            return T(*polar(out + spacing, guide(j)), k * t)
        if nm == "Petal":
            return T(*polar(out, guide(c - 1)), 3 * t + 1.5) @ R("Z", guide(c - 1))
        return None

    def bolt(x, y, z0, z1):
        return ((x, y, z0), (x, y, z1), 4, "steel", 24)

    def sleeve(x, y, z0, z1):
        return ((x, y, z0), (x, y, z1), 6, "brass", 32)

    def shim(x, y, z0, z1):
        return ((x, y, z0), (x, y, z1), 11, "steel", 32)

    bottom = -2 * t
    # Centre bolt through base, hub and retainer
    pins = [bolt(0, 0, bottom - 2, 2 * t + 5), nut(0, 0, 2 * t + 0.4)]
    # Stop sleeves through the arc slots, washer and nut on the sleeve end
    for ang in (0, 180):
        x, y = polar(42, ang)
        pins += [sleeve(x, y, 0, t + 0.4), shim(x, y, t + 0.4, t + 1.2), bolt(x, y, bottom - 2, t + 5.5),
                 nut(x, y, t + 1.2)]
    # Feet: countersunk flush in the base, nut in the recess under the cap
    for k in range(n):
        x, y = polar(65, guide(k + 0.5))
        pins += [bolt(x, y, -3 * t - 4, 0), nut(x, y, -3 * t, -1)]
    # Grip: countersunk up through the ring, sleeve standing on the ring
    x, y = polar(43, 90 + ring)
    pins += [sleeve(x, y, t + 0.2, 6 * t + 0.6), bolt(x, y, 0.2, 6 * t + 5), nut(x, y, 6 * t + 0.6)]
    for k in range(n):
        # Ring pin: sleeve on the ring, spacer and 0.8 mm of shims under the coupler
        x, y = ring_pin(k)
        pins += [sleeve(x, y, t + 0.2, 3 * t + 1.2), shim(x, y, 2 * t + 0.2, 2 * t + 1), bolt(x, y, 0.2, 3 * t + 6),
                 shim(x, y, 3 * t + 1.2, 3 * t + 2), nut(x, y, 3 * t + 2)]
        # Petal pins: bolts down from above, sleeves through the slot, shims
        # on the spacer packs, washer and nut under the base
        for r, z in ((out, 2 * t), (out + spacing, 3 * t)):
            x, y = polar(r, guide(k))
            pins += [sleeve(x, y, bottom - 0.3, 3 * t + 1.5), shim(x, y, z, z + (1 if r == out else 1.5)),
                     bolt(x, y, bottom - 5, 4 * t + 1.5), nut(x, y, 4 * t + 1.5, h=2.8),
                     shim(x, y, bottom - 1.1, bottom - 0.3), nut(x, y, bottom - 1.1, -1)]
    return place, pins


def index_sequencer(t=3, n=4, c=90, theta=-18):
    """The guide's stack, base underside at z 0: feet below, the driver
    (arm, then locking disc) on A at the origin, the wheel block (wheel,
    hubs, dial) on its pedestal at B = (c, 0), the pointer on spacers above
    it and the grip on its sleeve. theta turns the driver from the pin
    pointing at B; the wheel follows the pin while it is in a slot and
    waits, locked, for the rest of the turn."""
    alpha = 180 / n
    r = c * math.sin(math.radians(alpha))
    rim = math.hypot(c * math.cos(math.radians(alpha)), 3)
    grip = 0.48 * r
    th = (theta + 180) % 360 - 180
    if abs(th) <= 90 - alpha:
        # The slot points from B at the pin
        px, py = polar(r, th)
        wheel = math.degrees(math.atan2(py, px - c)) % 360 - 180
    else:
        wheel = -alpha
    feet = [(x, y) for x in (-r - 8, c + rim + 8) for y in (-rim - 8, rim + 8)]

    def driver(z):
        return T(0, 0, z) @ R("Z", theta)

    def output(z):
        return T(c, 0, z) @ R("Z", wheel)

    def place(p, parts):
        name, k = p["name"], p["copy"]
        if name == "Base":
            return T(0, 0, (k - 1) * t)
        if name == "Foot ring":
            j, i = divmod(k - 1, 3)
            return T(*feet[j], -3 * t + i * t)
        if name == "Foot cap":
            return T(*feet[k - 1], -4 * t)
        if name == "Output pedestal":
            return T(c, 0, 2 * t + (k - 1) * t)
        if name == "Driver arm":
            return driver(2 * t + 0.5 + (k - 1) * t)
        if name == "Locking disc":
            return driver(4 * t + 0.5 + (k - 1) * t)
        if name == "Grip ring":
            return driver(6 * t + 1.5 + (k - 1) * t) @ T(-grip)
        if name == "Geneva wheel":
            return output(4 * t + 1 + (k - 1) * t)
        if name == "Output hub":
            return output(6 * t + 1 + (k - 1) * t)
        if name == "Station dial":
            return output(10 * t + 1)
        if name == "Pointer spacer":
            return T(c, 0, 11 * t + 2.5 + (k - 1) * t)
        if name == "Pointer":
            return T(c, 0, 13 * t + 2.5)
        return None

    def disc(x, y, z0, z1, d=10):
        return ((x, y, z0), (x, y, z1), d, "steel", 32)

    pin, grip_at = polar(r, theta), polar(grip, theta + 180)
    dowel_in, dowel_out = polar(10, theta + 180), polar(10, wheel + 180)
    # Driver: sleeve 4t + 1.2 from the base, shims under the arm and over the disc
    top_a = 6 * t + 1.2
    pins = [((0, 0, -3), (0, 0, top_a + 6), 4, "steel", 24), nut(0, 0, 0, -1),
            ((0, 0, 2 * t), (0, 0, top_a), 6, "brass", 32),
            disc(0, 0, 2 * t, 2 * t + 0.5), disc(0, 0, 6 * t + 0.5, 6 * t + 1),
            disc(0, 0, top_a, top_a + 0.8, 11), nut(0, 0, top_a + 0.8),
            ((*dowel_in, 2 * t + 0.5), (*dowel_in, 6 * t + 0.5), 2, "dowel", 16)]
    # Wheel: sleeve 7t + 1.7 from the pedestal, then the pointer's stack
    top_b = 11 * t + 1.7
    pins += [((c, 0, -3), (c, 0, 14 * t + 7.5), 4, "steel", 24), nut(c, 0, 0, -1),
             ((c, 0, 4 * t), (c, 0, top_b), 6, "brass", 32),
             disc(c, 0, 4 * t, 4 * t + 1), disc(c, 0, 11 * t + 1, 11 * t + 1.5),
             disc(c, 0, top_b, top_b + 0.8, 11), nut(c, 0, 14 * t + 2.5),
             ((c + dowel_out[0], dowel_out[1], 4 * t + 1), (c + dowel_out[0], dowel_out[1], 11 * t + 1), 2, "dowel", 16)]
    # Drive pin: a 2t + 0.8 sleeve on a flush flat-head bolt, small washer and nut clear of the wheel
    top_p = 6 * t + 1.3
    pins += [((*pin, 2 * t + 0.5), (*pin, top_p + 5.2), 4, "steel", 24),
             ((*pin, 4 * t + 0.5), (*pin, top_p), 6, "brass", 32),
             disc(*pin, top_p, top_p + 0.5, 9), nut(*pin, top_p + 0.5)]
    # Grip: a 5t + 1.7 sleeve on the locking disc, shims at both ends of the rings
    top_g = 11 * t + 2.2
    pins += [((*grip_at, 2 * t + 0.5), (*grip_at, top_g + 6), 4, "steel", 24),
             ((*grip_at, 6 * t + 0.5), (*grip_at, top_g), 6, "brass", 32),
             disc(*grip_at, 6 * t + 0.5, 6 * t + 1.5), disc(*grip_at, 11 * t + 1.5, 11 * t + 2),
             disc(*grip_at, top_g, top_g + 0.8, 11), nut(*grip_at, top_g + 0.8)]
    return place, pins


def vault(t=3, h=90, codes=(3, 1, 7), lid_lift=45, lid_back=0, slide=10):
    """The box on its base, front at y 0: doubled front and rear walls, side
    walls, corner and floor cleats, lid ledges. Everything else hangs from
    the lid and is lifted with it by lid_lift (and moved back by lid_back):
    bearing pads, rotors (gate wheel, three hub discs, dial) turned to the
    code, the fence on its spacers and keepers, slid back by slide with the
    knob, and the rear tongues on their spacers."""
    w, d = 260, 180
    dial_x, guide_x, tongue_x = (70, 130, 190), (35, 225), (45, 195)
    lid = T(0, lid_back, lid_lift)
    turn = [36 * k for k in codes]

    def wall(y):
        """A front or rear wall standing on the base, its back face at y."""
        return T(0, y, t) @ R("X", 90)

    def place(p, parts):
        n, c = p["name"], p["copy"]
        if n == "Base":
            return T()
        if n == "Front wall":
            return wall(t)
        if n == "Front inner wall":
            return wall(2 * t)
        if n == "Rear inner wall":
            return wall(d - t)
        if n == "Rear wall":
            return wall(d)
        if n == "Side wall":
            return T(0 if c == 1 else w - t, 2 * t, t) @ SIDEWAYS
        if n == "Corner cleat":
            # Pairs of strips in the four corners, against the inner walls
            j, k = divmod(c - 1, 2)
            x = t if j % 2 == 0 else w - t - 12
            y = 3 * t + k * t if j < 2 else d - 2 * t - k * t
            return T(x, y, t) @ R("X", 90)
        if n == "Floor cleat":
            if c <= 2:
                return T(t + 12 if c == 1 else w - t, 40, t) @ R("Z", 90)
            return T(80, 2 * t if c == 3 else d - 2 * t - 12, t)
        if n == "Lid ledge":
            j, k = divmod(c - 1, 2)
            return T(t + 12 if j == 0 else w - t, 50, h - 2 * t + k * t) @ R("Z", 90)
        if n == "Lid":
            return lid @ T(0, 0, h)
        if n == "Bearing pad":
            j, k = divmod(c - 1, 2)
            return lid @ T(dial_x[j], 75, h - 2 * t + k * t)
        if n == "Rear tongue":
            return lid @ T(tongue_x[c - 1], d - t - 22.5, h - 3 * t)
        if n == "Tongue spacer":
            j, k = divmod(c - 1, 2)
            return lid @ T(tongue_x[j], d - t - 22.5, h - 2 * t + k * t)
        if n.startswith("Gate wheel "):
            j = int(n.split()[2].rstrip(",")) - 1
            return lid @ T(dial_x[j], 75, h - 3 * t - 0.5) @ R("Z", turn[j])
        if n == "Hub disc":
            j, k = divmod(c - 1, 3)
            return lid @ T(dial_x[j], 75, h - 2 * t - 0.5 + k * t) @ R("Z", turn[j])
        if n == "Dial":
            return lid @ T(dial_x[c - 1], 75, h + t) @ R("Z", turn[c - 1])
        if n == "Fence":
            return lid @ T(0, slide, h - 3 * t)
        if n == "Fence spacer":
            j, k = divmod(c - 1, 2)
            return lid @ T(guide_x[j], 29, h - 2 * t + k * t)
        if n == "Fence keeper":
            return lid @ T(guide_x[c - 1], 29, h - 4 * t - 0.4)
        if n == "Knob stem":
            return lid @ T(130, 20 + slide, h - 2 * t + 1 + (c - 1) * t)
        if n == "Knob":
            return lid @ T(130, 20 + slide, h + t + 1)
        return None

    def lifted(x, y, z):
        return x, y + lid_back, z + lid_lift

    def rod(x, y, z0, z1, dia, kind="steel", sides=24):
        return (lifted(x, y, z0), lifted(x, y, z1), dia, kind, sides)

    def bolt(x, y, top, bottom, dia, washer, nut_d, nut_h):
        """A bolt with its head and a washer on top, a washer and nut below."""
        return [rod(x, y, bottom - 0.8 - nut_h - 1, top + 0.8 + nut_h, dia),
                rod(x, y, top, top + 0.8, washer, sides=32), nut(*lifted(x, y, top + 0.8), d=nut_d, h=nut_h),
                rod(x, y, bottom - 0.8, bottom, washer, sides=32), nut(*lifted(x, y, bottom - 0.8), up=-1, d=nut_d, h=nut_h)]

    pins = []
    for x, a in zip(dial_x, turn):
        # M4 rotor bolt, the 0.5 mm shim under the dial, two 2 mm pins
        pins += bolt(x, 75, h + 2 * t, h - 3 * t - 0.5, 4, 9, 7.9, 3.2)
        pins.append(rod(x, 75, h + t - 0.5, h + t, 9, sides=32))
        for px, py in ((6, 0), (0, 6)):
            ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
            pins.append(rod(x + px * ca - py * sa, 75 + px * sa + py * ca, h - 3 * t - 0.5, h + 2 * t, 2, sides=12))
    for x in guide_x:
        # M3 guide bolt through the lid, a brass sleeve 3t + 0.4 long and the keeper
        pins += bolt(x, 29, h + t, h - 4 * t - 0.4, 3, 7, 6.4, 2.4)
        pins.append(rod(x, 29, h - 3 * t - 0.4, h, 6, "brass", 32))
    # Knob bolt, with the 1 mm packing washer between the fence and the stem
    pins += bolt(130, 20 + slide, h + 2 * t + 1, h - 3 * t, 4, 9, 7.9, 3.2)
    pins.append(rod(130, 20 + slide, h - 2 * t, h - 2 * t + 1, 9, sides=32))
    return place, pins


_fracture_place, _fracture_pins = relief([polar(192, a) for a in (30, 150, 270)])
_morphogen_place, _morphogen_pins = relief([polar(172, a) for a in (20, 142, 268)])
_orbit_place, _orbit_pins = orbit()
_trace_place, _trace_pins, _trace_flats = trace()
_stride_place, _stride_pins = stride()
_tidal_place, _tidal_pins = tidal()
_ascent_place, _ascent_pins, _ascent_balls = ascent()
_expanse_place, _expanse_pins = expanse()
_celestial_place, _celestial_pins = celestial()
_flight_place, _flight_pins = flight()
_bloom_place, _bloom_pins = bloom()
_index_place, _index_pins = index_sequencer()
_vault_place, _vault_pins = vault()

ASSEMBLIES = {
    "fracture": {"place": _fracture_place, "pins": _fracture_pins(5), "view": {"azimuth": -20, "elevation": 40}},
    "morphogen": {"place": _morphogen_place, "pins": _morphogen_pins(4), "view": {"azimuth": -20, "elevation": 40}},
    "orbit": {"place": _orbit_place, "pins": _orbit_pins, "view": {"azimuth": -25, "elevation": 38}},
    "trace": {"place": _trace_place, "pins": _trace_pins, "flats": _trace_flats, "view": {"azimuth": -25, "elevation": 38}},
    "stride": {"place": _stride_place, "pins": _stride_pins, "view": {"azimuth": -32, "elevation": 14}},
    "tidal": {"place": _tidal_place, "pins": _tidal_pins, "view": {"azimuth": -38, "elevation": 22}},
    "ascent": {"place": _ascent_place, "pins": _ascent_pins, "balls": _ascent_balls, "view": {"azimuth": 30, "elevation": 28}},
    "expanse": {"place": _expanse_place, "pins": _expanse_pins, "view": {"azimuth": -24, "elevation": 48}},
    "celestial": {"place": _celestial_place, "pins": _celestial_pins, "view": {"azimuth": -30, "elevation": 38}},
    "flight": {"place": _flight_place, "pins": _flight_pins, "view": {"azimuth": -30, "elevation": 16}},
    "bloom": {"place": _bloom_place, "pins": _bloom_pins, "view": {"azimuth": -25, "elevation": 40}},
    "index-sequencer": {"place": _index_place, "pins": _index_pins, "view": {"azimuth": -25, "elevation": 38}},
    "vault": {"place": _vault_place, "pins": _vault_pins, "view": {"azimuth": -28, "elevation": 30}},
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
