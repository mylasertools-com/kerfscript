# Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

# Builds the assembled 3D model of a KerfScript example in Blender, from the
# parts that export.mjs wrote, then renders a picture and exports a GLB:
#   blender -b -P 3d/build.py -- slug [slug ...]
# Writes public/3d/<slug>.glb and public/3d/<slug>.webp. SAMPLES sets the
# render quality, NOGLB=1 / NORENDER=1 skip one of the two.

import bpy, bmesh, json, math, os, sys, random
from mathutils import Matrix, Vector
from bpy_extras.object_utils import world_to_camera_view

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from assemblies import ASSEMBLIES, flat  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, ".build")
PUBLIC = os.path.join(HERE, "..", "public", "3d")
MM = 0.001


def srgb_lin(c):
    return ((c + 0.055) / 1.055) ** 2.4 if c > 0.04045 else c / 12.92


def hex_lin(h):
    h = h.lstrip("#")
    return tuple(srgb_lin(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4)) + (1.0,)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for dev in ("OPTIX", "CUDA"):
        try:
            prefs.compute_device_type = dev
            prefs.get_devices()
            if [d for d in prefs.devices if d.type == dev]:
                for d in prefs.devices:
                    d.use = d.type == dev
                break
        except Exception:
            pass
    sc.cycles.device = "GPU"
    sc.cycles.samples = int(os.environ.get("SAMPLES", "128"))
    sc.cycles.use_denoising = True
    sc.view_settings.view_transform = "Khronos PBR Neutral"
    sc.render.film_transparent = True
    sc.render.resolution_x = 1200
    sc.render.resolution_y = 900
    sc.render.image_settings.file_format = "WEBP"
    sc.render.image_settings.color_mode = "RGBA"
    sc.render.image_settings.quality = 82
    return sc


# Materials: plain Principled BSDF with one image, so the GLB looks the same
# as the render.

_mats = {}


def mat_wood():
    if "wood" in _mats:
        return _mats["wood"]
    m = bpy.data.materials.new("wood")
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    im = nt.nodes.new("ShaderNodeTexImage")
    im.image = bpy.data.images.load(os.path.join(HERE, "textures", "wood.jpg"), check_existing=True)
    nt.links.new(im.outputs["Color"], p.inputs["Base Color"])
    p.inputs["Roughness"].default_value = 0.72
    _mats["wood"] = m
    return m


def mat_plain(name, color, rough=0.85):
    if name in _mats:
        return _mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = hex_lin(color)
    p.inputs["Roughness"].default_value = rough
    _mats[name] = m
    return m


def mat_metal(name, color, rough):
    m = mat_plain(name, color, rough)
    m.node_tree.nodes["Principled BSDF"].inputs["Metallic"].default_value = 1.0
    return m


# Hardware a recipe can ask for by name
HARDWARE = {
    "steel": lambda: mat_metal("steel", "#c9ccd1", 0.18),
    "brass": lambda: mat_metal("brass", "#c9a45c", 0.3),
    "dowel": lambda: mat_plain("dowel", "#d8b483", 0.7),
    "pencil": lambda: mat_plain("pencil", "#e2b23a", 0.6),
}


def mat_acrylic():
    if "acrylic" in _mats:
        return _mats["acrylic"]
    m = bpy.data.materials.new("acrylic")
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (0.95, 0.97, 0.98, 1)
    p.inputs["Roughness"].default_value = 0.02
    p.inputs["Transmission Weight"].default_value = 1.0
    p.inputs["IOR"].default_value = 1.49
    try:
        m.surface_render_method = "BLENDED"
    except AttributeError:
        m.blend_method = "BLEND"
    _mats["acrylic"] = m
    return m


# Geometry

def clean(ring, eps=0.005):
    """The ring without repeated points or spikes that go out and straight
    back (contours traced from a sampled field have both). Blender's curve
    fill leaves large holes when it meets them."""
    near = lambda a, b: abs(a[0] - b[0]) <= eps and abs(a[1] - b[1]) <= eps
    pts = []
    for q in ring:
        if not pts or not near(q, pts[-1]):
            pts.append(q)
    while len(pts) > 1 and near(pts[0], pts[-1]):
        pts.pop()
    changed = True
    while changed and len(pts) > 3:
        changed = False
        keep = [True] * len(pts)
        for i in range(len(pts)):
            if keep[i - 1] and near(pts[i - 1], pts[(i + 1) % len(pts)]):
                keep[i] = keep[(i + 1) % len(pts)] = False
                changed = True
        pts = [q for q, k in zip(pts, keep) if k]
    return pts


def fill_mesh(name, rings, z0, z1):
    """An extruded even-odd fill of the rings, from z0 to z1 (mm)."""
    rings = [clean(r) for r in rings]
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "2D"
    cu.fill_mode = "BOTH"
    cu.extrude = (z1 - z0) / 2 * MM
    for ring in rings:
        if len(ring) < 3:
            continue
        sp = cu.splines.new("POLY")
        sp.points.add(len(ring) - 1)
        for i, (x, y) in enumerate(ring):
            sp.points[i].co = (x * MM, y * MM, 0, 1)
        sp.use_cyclic_u = True
    ob = bpy.data.objects.new(name + "_c", cu)
    bpy.context.scene.collection.objects.link(ob)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bpy.data.objects.remove(ob)
    me.transform(Matrix.Translation((0, 0, (z0 + z1) / 2 * MM)))
    return me


def line_mesh(name, lines, z, radius):
    """Thin tubes along the lines, centred at height z (mm)."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = radius * MM
    cu.bevel_resolution = 1
    for line in lines:
        if len(line) < 2:
            continue
        sp = cu.splines.new("POLY")
        sp.points.add(len(line) - 1)
        for i, (x, y) in enumerate(line):
            sp.points[i].co = (x * MM, y * MM, z * MM, 1)
    ob = bpy.data.objects.new(name + "_c", cu)
    bpy.context.scene.collection.objects.link(ob)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bpy.data.objects.remove(ob)
    return me


def planar_uv(me, angle, offset, size=180.0):
    bm = bmesh.new()
    bm.from_mesh(me)
    uv = bm.loops.layers.uv.verify()
    c, s = math.cos(angle), math.sin(angle)
    for f in bm.faces:
        for lp in f.loops:
            x, y = lp.vert.co.x / MM, lp.vert.co.y / MM
            lp[uv].uv = ((c * x - s * y) / size + offset[0], (s * x + c * y) / size + offset[1])
    bm.to_mesh(me)
    bm.free()


def add(name, me, mats, parent):
    for m in mats:
        me.materials.append(m)
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    o.parent = parent
    return o


def build_part(p, k, rng):
    t = p["thickness"]
    root = bpy.data.objects.new(f"{p['name']}#{p['copy']}", None)
    bpy.context.scene.collection.objects.link(root)
    clear = "acrylic" in p["material"]
    body = fill_mesh(f"body{k}", p["cut"], 0, t)
    if clear:
        add(f"body{k}", body, [mat_acrylic()], root)
    else:
        planar_uv(body, p.get("grain", 0) + rng.uniform(-0.04, 0.04), (rng.random(), rng.random()))
        body.materials.append(mat_wood())
        body.materials.append(mat_plain("edge", "#5b3a20", 0.9))
        for poly in body.polygons:
            poly.material_index = 0 if abs(poly.normal.z) > 0.9 else 1
        o = bpy.data.objects.new(f"body{k}", body)
        bpy.context.scene.collection.objects.link(o)
        o.parent = root
    if p["engrave"]:
        add(f"engrave{k}", fill_mesh(f"engrave{k}", p["engrave"], t, t + 0.06), [mat_plain("engrave", "#4a2a14", 0.95)], root)
    lines = p["score"]
    if lines:
        add(f"score{k}", line_mesh(f"score{k}", lines, t, 0.14), [mat_plain("score", "#6a4527", 0.9)], root)
    if p["cutLines"]:
        add(f"cutline{k}", line_mesh(f"cutline{k}", p["cutLines"], t, 0.2), [mat_plain("cutline", "#2c1a0c", 0.9)], root)
    return root


# Scene

def world(strength=None):
    w = bpy.data.worlds.new("W")
    bpy.context.scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    bg = nt.nodes["Background"]
    hdr = os.environ.get("HDRI")
    if hdr and os.path.exists(hdr):
        env = nt.nodes.new("ShaderNodeTexEnvironment")
        env.image = bpy.data.images.load(hdr)
        nt.links.new(env.outputs["Color"], bg.inputs["Color"])
        bg.inputs["Strength"].default_value = 0.55
    else:
        bg.inputs["Color"].default_value = hex_lin("#f4efe6")
        bg.inputs["Strength"].default_value = 0.45 if strength is None else strength


def area_light(loc, target, size, power):
    ld = bpy.data.lights.new("L", "AREA")
    ld.shape = "DISK"
    ld.size = size
    ld.energy = power
    lo = bpy.data.objects.new("L", ld)
    bpy.context.scene.collection.objects.link(lo)
    lo.location = Vector(loc)
    lo.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()


def bounds(objs):
    pts = []
    dg = bpy.context.evaluated_depsgraph_get()
    for o in objs:
        if o.type != "MESH":
            continue
        for c in o.bound_box:
            pts.append(o.matrix_world @ Vector(c))
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def model_points(meshes, limit=4000):
    pts = []
    for o in meshes:
        mw = o.matrix_world
        vs = o.data.vertices
        step = max(1, len(vs) // max(1, limit // len(meshes)))
        pts.extend(mw @ vs[i].co for i in range(0, len(vs), step))
    return pts


def stage(view):
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    lo, hi = bounds(meshes)
    centre = (lo + hi) / 2
    size = (hi - lo).length
    # Shadow catcher under everything
    bpy.ops.mesh.primitive_plane_add(size=size * 8, location=(centre.x, centre.y, lo.z))
    floor = bpy.context.active_object
    floor.is_shadow_catcher = True
    floor.name = "floor"
    az, el, lens = math.radians(view.get("azimuth", -35)), math.radians(view.get("elevation", 32)), 70
    d = Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))
    cd = bpy.data.cameras.new("Cam")
    cd.lens = lens
    cd.clip_start = 0.001
    cam = bpy.data.objects.new("Cam", cd)
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    target = centre.copy()
    dist = size * 2.5
    # Frame the model: project its points, then move the camera until they
    # fill the picture and sit in the middle of it.
    pts = model_points(meshes)
    fill = view.get("fill", 0.84)
    for _ in range(6):
        cam.location = target + d * dist
        cam.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
        bpy.context.view_layer.update()
        ndc = [world_to_camera_view(bpy.context.scene, cam, q) for q in pts]
        x0, x1 = min(v.x for v in ndc), max(v.x for v in ndc)
        y0, y1 = min(v.y for v in ndc), max(v.y for v in ndc)
        right = cam.matrix_world.to_3x3() @ Vector((1, 0, 0))
        up = cam.matrix_world.to_3x3() @ Vector((0, 1, 0))
        width = 2 * dist * math.tan(math.atan(18 / lens))
        target += right * ((x0 + x1) / 2 - 0.5) * width + up * ((y0 + y1) / 2 - 0.5) * width * 0.75
        dist *= max(x1 - x0, (y1 - y0)) / fill
    cam.location = target + d * dist
    cam.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    r = size
    if view.get("lights", True) is False:
        return floor
    area_light(target + Vector((-r * 1.2, -r * 1.4, r * 1.8)), target, r * 1.2, 70 * r * r)
    area_light(target + Vector((r * 1.6, -r * 0.4, r * 1.0)), target, r * 1.5, 22 * r * r)
    area_light(target + Vector((0, r * 1.8, r * 1.2)), target, r * 1.5, 25 * r * r)
    return floor


def export_glb(slug, floor):
    os.makedirs(PUBLIC, exist_ok=True)
    floor.hide_set(True)
    bpy.ops.object.select_all(action="DESELECT")
    for o in bpy.context.scene.objects:
        if o.type == "MESH" and o is not floor and not o.name.startswith("scene_"):
            o.select_set(True)
    kw = dict(
        filepath=os.path.join(PUBLIC, f"{slug}.glb"),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
    )
    bpy.ops.export_scene.gltf(**kw)
    floor.hide_set(False)


def build(slug):
    reset()
    _mats.clear()
    with open(os.path.join(BUILD, f"{slug}.json")) as f:
        data = json.load(f)
    rng = random.Random(slug)
    recipe = ASSEMBLIES.get(slug, flat)
    view = recipe.get("view", {}) if isinstance(recipe, dict) else {}
    place = recipe["place"] if isinstance(recipe, dict) else recipe
    roots = []
    for k, p in enumerate(data["parts"]):
        m = place(p, data["parts"])
        if m is None:
            continue
        root = build_part(p, k, rng)
        root.matrix_world = m
        roots.append(root)
    for k, (x, y, z, d) in enumerate(recipe.get("balls", []) if isinstance(recipe, dict) else []):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=d / 2 * MM, location=(x * MM, y * MM, z * MM), segments=48, ring_count=24)
        ball = bpy.context.active_object
        ball.name = f"ball{k}"
        bpy.ops.object.shade_smooth()
        ball.data.materials.append(HARDWARE["steel"]())
    for k, (x, y, z0, z1, d) in enumerate(recipe.get("rods", []) if isinstance(recipe, dict) else []):
        bpy.ops.mesh.primitive_cylinder_add(radius=d / 2 * MM, depth=(z1 - z0) * MM, location=(x * MM, y * MM, (z0 + z1) / 2 * MM), vertices=32)
        rod = bpy.context.active_object
        rod.name = f"rod{k}"
        bpy.ops.object.shade_smooth()
        rod.data.materials.append(HARDWARE["dowel"]())
    # Pins: bolts, bushes, shafts and nuts, as prisms from a to b (mm) with
    # d across the corners. 4 sides makes a square bar d across the flats.
    for k, (a, b, d, kind, sides) in enumerate(recipe.get("pins", []) if isinstance(recipe, dict) else []):
        a, b = Vector(a), Vector(b)
        r = d / 2 * (math.sqrt(2) if sides == 4 else 1)
        bpy.ops.mesh.primitive_cylinder_add(radius=r * MM, depth=(b - a).length * MM, location=(a + b) / 2 * MM, vertices=sides)
        pin = bpy.context.active_object
        pin.name = f"pin{k}"
        twist = Matrix.Rotation(math.radians(45 if sides == 4 else 0), 4, "Z")
        pin.matrix_world = Matrix.Translation((a + b) / 2 * MM) @ Vector((0, 0, 1)).rotation_difference(b - a).to_matrix().to_4x4() @ twist
        if sides > 8:
            bpy.ops.object.shade_smooth()
        pin.data.materials.append(HARDWARE[kind]())
    # Flats: a thin sheet (paper) with lines drawn on it
    for k, f in enumerate(recipe.get("flats", []) if isinstance(recipe, dict) else []):
        o = add(f"flat{k}", fill_mesh(f"flat{k}", f["rings"], f["z"], f["z"] + f.get("depth", 0.1)), [mat_plain(f"flat{k}", f["color"], 0.9)], None)
        if f.get("lines"):
            add(f"flatline{k}", line_mesh(f"flatline{k}", f["lines"], f["z"] + f.get("depth", 0.1), f.get("line_width", 0.25) / 2), [mat_plain(f"flatline{k}", f["line_color"], 0.8)], None)
    wall =recipe.get("wall") if isinstance(recipe, dict) else None
    if wall:
        (x0, x1), (z0, z1) = wall["x"], wall["z"]
        bpy.ops.mesh.primitive_plane_add(size=1)
        w = bpy.context.active_object
        w.name = "scene_wall"
        w.scale = ((x1 - x0) * MM, (z1 - z0) * MM, 1)
        w.rotation_euler = (math.radians(90), 0, 0)
        w.location = ((x0 + x1) / 2 * MM, wall["y"] * MM, (z0 + z1) / 2 * MM)
        w.data.materials.append(mat_plain("wall", "#efe7da", 0.95))
    point = recipe.get("point") if isinstance(recipe, dict) else None
    if point:
        ld = bpy.data.lights.new("pinhole", "POINT")
        ld.energy = point[3]
        ld.shadow_soft_size = 0.0005
        lo = bpy.data.objects.new("scene_pinhole", ld)
        bpy.context.scene.collection.objects.link(lo)
        lo.location = (point[0] * MM, point[1] * MM, point[2] * MM)
    bpy.context.view_layer.update()
    world(view.get("world"))
    floor = stage(view)
    if point:
        # The pinhole lights the parts and the wall, not the floor, so it
        # throws no hard shadows across the table
        lit = bpy.data.collections.new("lit")
        for o in bpy.context.scene.objects:
            if o.type == "MESH" and o is not floor:
                lit.objects.link(o)
        bpy.data.objects["scene_pinhole"].light_linking.receiver_collection = lit
    if not os.environ.get("NOGLB"):
        export_glb(slug, floor)
    if not os.environ.get("NORENDER"):
        bpy.context.scene.render.filepath = os.path.join(PUBLIC, f"{slug}.webp")
        bpy.ops.render.render(write_still=True)
    print("built", slug)


for s in sys.argv[sys.argv.index("--") + 1:]:
    build(s)
