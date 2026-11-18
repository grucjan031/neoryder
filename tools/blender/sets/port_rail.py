"""Zestaw modeli „port i zajezdnia” (ADR 0011, D7): kontenerowiec z segmentów, suwnica STS, trap,
wagony towarowe, moduły hali oraz zajezdnia maglev (tor, kozioł, wagony, słup sieci, bramownica,
nastawnia, wiata, obrotnica, zaspy).

Uruchomienie (z katalogu repo):
    "D:/Blender/blender.exe" -b --factory-startup --python tools/blender/sets/port_rail.py -- [--only nazwa,nazwa] [--no-preview]

Wynik: public/assets/models/city/<nazwa>.glb oraz tools/blender/previews/city/<nazwa>.png
(arkusz 2 × 2: 3/4 z przodu, 3/4 z tyłu, z daleka, zbliżenie). Konwencje jak w build_assets.py:
metry, glTF Y-up, spód na y = 0, przód +Z, płaskie normalne, jedna siatka na materiał.
Wymiary, punkty odniesienia i powierzchnie chodzenia: docs/assets.md („Port i zajezdnia”).
Wszystkie współrzędne w tym pliku są współrzędnymi glTF (x, y, z), y w górę.
"""

from __future__ import annotations

import math
import os
import sys

sys.dont_write_bytecode = True  # no __pycache__ next to build_assets.py
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import build_assets as ba  # noqa: E402

OUT_DIR = os.path.join(ba.OUT_DIR, "city")
PREVIEW_DIR = os.path.join(ba.PREVIEW_DIR, "city")

# Nowe powierzchnie (mat_<idTekstury>); barwa to tylko podgląd Workbench, gra bierze barwę zastępczą
# z src/data/render/portRailMaterials.json, a teksturę po nazwie (podepnie ją integracja).
SET_MATERIALS = {
    "mat_ship_hull_paint": "2f3a4d",
    "mat_ship_deck_steel": "434d4c",
    "mat_rail_ballast": "57544f",
    "mat_rail_sleeper_concrete": "6b717b",
    "mat_maglev_body_panel": "4b586c",
    "mat_snow": "c8d2e0",
}


def root_for(name):
    root = ba._port_root(name)
    for key, hex_color in SET_MATERIALS.items():
        rgb = [int(hex_color[i:i + 2], 16) / 255 for i in (0, 2, 4)]
        linear = tuple(c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in rgb)
        ba.PALETTE[key] = ((*linear, 1), None)
    return root


# --------------------------------------------------------------------------- geometry helpers (glTF)

def box(root, name, x0, x1, y0, y1, z0, z1, mat="mat_metal", bevel=0.0):
    """Axis-aligned box given by its extents (in any order)."""
    x0, x1 = sorted((x0, x1))
    y0, y1 = sorted((y0, y1))
    z0, z1 = sorted((z0, z1))
    return ba._city_box(root, name, (x1 - x0, y1 - y0, z1 - z0),
                        ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), mat, bevel)


def cbox(root, name, size, center, mat="mat_metal", bevel=0.0, taper=(1.0, 1.0)):
    return ba._city_box(root, name, size, center, mat, bevel, taper)


def rod(root, name, a, b, radius, mat="mat_metal", sides=6, tip_radius=None):
    return ba._city_rod(root, name, a, b, radius, mat, sides, tip_radius)


def beam(root, name, a, b, width, height, mat="mat_metal", up=(0, 1, 0)):
    """Rectangular beam from a to b: `width` across, `height` along the projected `up`."""
    a, b = Vector(a), Vector(b)
    d = (b - a).normalized()
    u = Vector(up)
    u = (u - d * u.dot(d))
    if u.length < 1e-6:
        u = Vector((1, 0, 0)) - d * d.x
    u.normalize()
    s = d.cross(u).normalized()
    rings = []
    for p in (a, b):
        rings.append([tuple(p + s * (sx * width / 2) + u * (sy * height / 2))
                      for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))])
    return ba._city_hull(root, name, rings, mat)


def _object(root, name, bm, mats):
    obj = ba.mesh_object(name, bm, mats[0], parent=root)
    for mat in mats[1:]:
        obj.data.materials.append(ba.material(mat))
    return obj


def _axis_point(axis, u, v, w):
    """Point from in-plane (u, v) and the extrusion coordinate w. Planes: 'z' -> (x, y), 'x' -> (z, y), 'y' -> (x, z)."""
    if axis == "z":
        return (u, v, w)
    if axis == "x":
        return (w, v, u)
    return (u, w, v)


def prism(root, name, profile, axis, w0, w1, mat, edge_mats=None, cap_mat=None):
    """Closed prism: 2D `profile` (convex or concave, counter-clockwise or not) extruded from w0 to w1.

    `edge_mats` maps the index i of profile edge (p[i], p[i+1]) to a material for that side face;
    `cap_mat` overrides the material of both caps. Other faces use `mat`.
    """
    mats = [mat]

    def slot(m):
        if m not in mats:
            mats.append(m)
        return mats.index(m)

    bm = bmesh.new()
    n = len(profile)
    a = [bm.verts.new(ba._city_point(_axis_point(axis, u, v, w0))) for u, v in profile]
    b = [bm.verts.new(ba._city_point(_axis_point(axis, u, v, w1))) for u, v in profile]
    caps = [bm.faces.new(tuple(reversed(a))), bm.faces.new(tuple(b))]
    if cap_mat:
        for face in caps:
            face.material_index = slot(cap_mat)
    for i in range(n):
        j = (i + 1) % n
        face = bm.faces.new((a[i], a[j], b[j], b[i]))
        if edge_mats and i in edge_mats:
            face.material_index = slot(edge_mats[i])
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    return _object(root, name, bm, mats)


def loft(root, name, rings, mat, top_mat=None, bottom_mat=None, close=True, face_mat=None):
    """Rings of equal length (glTF points); faces between consecutive rings, optional end caps.

    The first ring is the bottom cap, the last ring the top cap (materials `bottom_mat` / `top_mat`);
    `face_mat(ring, edge)` may return a material for the side face between ring and ring + 1."""
    mats = [mat]

    def slot(m):
        if m not in mats:
            mats.append(m)
        return mats.index(m)

    bm = bmesh.new()
    rows = [[bm.verts.new(ba._city_point(p)) for p in ring] for ring in rings]
    if close:
        bottom = bm.faces.new(tuple(reversed(rows[0])))
        top = bm.faces.new(tuple(rows[-1]))
        if bottom_mat:
            bottom.material_index = slot(bottom_mat)
        if top_mat:
            top.material_index = slot(top_mat)
    for k, (r0, r1) in enumerate(zip(rows, rows[1:])):
        for i in range(len(r0)):
            j = (i + 1) % len(r0)
            face = bm.faces.new((r0[i], r0[j], r1[j], r1[i]))
            m = face_mat(k, i) if face_mat else None
            if m:
                face.material_index = slot(m)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    return _object(root, name, bm, mats)


def grid_slab(root, name, xs, zs, y0, y1, material_at, base_mat):
    """Closed slab from y0 to y1 whose top is tiled by the grid xs × zs: coplanar cells, one material per cell.

    `material_at(x, z)` gets the cell centre. The top stays one flat plane (walkable, no z-fighting)."""
    mats = [base_mat]

    def slot(m):
        if m not in mats:
            mats.append(m)
        return mats.index(m)

    bm = bmesh.new()
    top = [[bm.verts.new(ba._city_point((x, y1, z))) for z in zs] for x in xs]
    bot = [[bm.verts.new(ba._city_point((x, y0, z))) for z in zs] for x in xs]
    nx, nz = len(xs), len(zs)
    for i in range(nx - 1):
        for j in range(nz - 1):
            face = bm.faces.new((top[i][j], top[i + 1][j], top[i + 1][j + 1], top[i][j + 1]))
            face.material_index = slot(material_at((xs[i] + xs[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2))
    bm.faces.new(tuple(bot[i][0] for i in range(nx)) + tuple(bot[nx - 1][j] for j in range(1, nz))
                 + tuple(bot[i][nz - 1] for i in range(nx - 2, -1, -1))
                 + tuple(bot[0][j] for j in range(nz - 2, 0, -1)))
    for i in range(nx - 1):
        for j in (0, nz - 1):
            bm.faces.new((bot[i][j], bot[i + 1][j], top[i + 1][j], top[i][j]))
    for j in range(nz - 1):
        for i in (0, nx - 1):
            bm.faces.new((bot[i][j], top[i][j], top[i][j + 1], bot[i][j + 1]))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    return _object(root, name, bm, mats)


def quad(root, name, center, w, h, facing, mat):
    """Single flat quad (2 triangles) for windows and lenses; `facing` is '+x', '-x', '+z', '-z', '+y', '-y'."""
    c = Vector(center)
    axes = {
        "+z": ((1, 0, 0), (0, 1, 0)), "-z": ((-1, 0, 0), (0, 1, 0)),
        "+x": ((0, 0, -1), (0, 1, 0)), "-x": ((0, 0, 1), (0, 1, 0)),
        "+y": ((1, 0, 0), (0, 0, -1)), "-y": ((1, 0, 0), (0, 0, 1)),
    }[facing]
    r, u = Vector(axes[0]), Vector(axes[1])
    corners = (c - r * w / 2 - u * h / 2, c + r * w / 2 - u * h / 2, c + r * w / 2 + u * h / 2, c - r * w / 2 + u * h / 2)
    bm = bmesh.new()
    bm.faces.new([bm.verts.new(ba._city_point(p)) for p in corners])
    return ba.mesh_object(name, bm, mat, parent=root)


def wall_strip(root, name, points, thickness, y0, y1, mat, side=1):
    """Wall along a polyline of (x, z) points; the wall grows `thickness` to the left of the travel
    direction (side=1, rotation (dx, dz) -> (-dz, dx)) or to the right (side=-1)."""
    bm = bmesh.new()
    outer, inner = [], []
    n = len(points)
    for i, (x, z) in enumerate(points):
        ax, az = points[max(0, i - 1)]
        bx, bz = points[min(n - 1, i + 1)]
        tx, tz = bx - ax, bz - az
        length = math.hypot(tx, tz) or 1.0
        dx, dz = -tz / length * side, tx / length * side
        outer.append((x, z))
        inner.append((x + dx * thickness, z + dz * thickness))
    rings = []
    for (ox, oz), (ix, iz) in zip(outer, inner):
        rings.append([bm.verts.new(ba._city_point(p)) for p in
                      ((ox, y0, oz), (ox, y1, oz), (ix, y1, iz), (ix, y0, iz))])
    for r0, r1 in zip(rings, rings[1:]):
        for i in range(4):
            j = (i + 1) % 4
            bm.faces.new((r0[i], r0[j], r1[j], r1[i]))
    bm.faces.new(tuple(reversed(rings[0])))
    bm.faces.new(tuple(rings[-1]))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    return ba.mesh_object(name, bm, mat, parent=root)


def stair_flight(root, name, start, y0, w0, w1, risers, rise, tread, direction, mat, axis="x", thick=.15):
    """Solid stair: first riser at `start` (bottom y0) along `axis` ('x' or 'z'), `direction` +1 / -1,
    width w0..w1 on the other horizontal axis.

    Treads lie at y0 + k * rise (k = 1..risers-1), each `tread` long. The flight ends at the inner corner
    of the last tread, start + direction * (risers - 1) * tread: the last riser is the face of the upper
    landing, whose top is y0 + risers * rise. The underside runs parallel to the pitch, `thick` below."""
    pts = [(0.0, 0.0)]
    for k in range(1, risers):
        pts += [((k - 1) * tread, k * rise), (k * tread, k * rise)]
    run = (risers - 1) * tread
    pts += [(run, (risers - 1) * rise - thick), (thick * tread / rise, 0.0)]
    profile = [(start + direction * u, y0 + v) for u, v in pts]
    if direction < 0:
        profile.reverse()
    # Prism planes: extruded along z the profile is (x, y); extruded along x it is (z, y).
    return prism(root, name, profile, "z" if axis == "x" else "x", w0, w1, mat)


def railing_x(root, x0, x1, y, z, height=1.1, posts=2.5, mat="mat_metal", post_mat=None, skip=()):
    """Straight railing along X at height y: top rail, mid rail and posts every ~`posts` m."""
    n = max(1, round((x1 - x0) / posts))
    cbox(root, "top_rail", (x1 - x0, .06, .06), ((x0 + x1) / 2, y + height - .03, z), mat)
    cbox(root, "mid_rail", (x1 - x0, .05, .05), ((x0 + x1) / 2, y + height * .5, z), mat)
    for i in range(n + 1):
        x = x0 + (x1 - x0) * i / n
        if any(a <= x <= b for a, b in skip):
            continue
        x = min(max(x, x0 + .03), x1 - .03)
        cbox(root, "rail_post", (.06, height, .06), (x, y + height / 2, z), post_mat or mat)


def railing_z(root, z0, z1, y, x, height=1.1, posts=2.5, mat="mat_metal", post_mat=None):
    n = max(1, round((z1 - z0) / posts))
    cbox(root, "top_rail", (.06, .06, z1 - z0), (x, y + height - .03, (z0 + z1) / 2), mat)
    cbox(root, "mid_rail", (.05, .05, z1 - z0), (x, y + height * .5, (z0 + z1) / 2), mat)
    for i in range(n + 1):
        z = z0 + (z1 - z0) * i / n
        z = min(max(z, z0 + .03), z1 - .03)
        cbox(root, "rail_post", (.06, height, .06), (x, y + height / 2, z), post_mat or mat)


def sloped_rail(root, a, b, height=1.0, mat="mat_metal", posts=3):
    """Handrail parallel to a stair or ramp edge from a to b (points on the walking line)."""
    a, b = Vector(a), Vector(b)
    up = Vector((0, height, 0))
    rod(root, "handrail", tuple(a + up), tuple(b + up), .03, mat, 4)
    rod(root, "knee_rail", tuple(a + up * .5), tuple(b + up * .5), .025, mat, 4)
    for i in range(posts):
        p = a + (b - a) * (i / (posts - 1))
        rod(root, "rail_post", tuple(p), tuple(p + up), .03, mat, 4)


def merge(root, names):
    ba._port_merge(root, names)


def finish(builder, center=False):
    return ba._port_finish(builder, center=center)


# --------------------------------------------------------------------------- port: container ship

HW = 15.95  # half width of the hull plating; strakes reach 16.0
DECK = 12.0  # main deck (top of the hull at the side walkways)
HATCH = 12.8  # hatch covers and coamings
RAIL_Z = 15.75  # deck edge railing line
SHIP_NODES = {
    "mat_ship_hull_paint": "hull", "mat_ship_deck_steel": "deck", "mat_trim": "trim", "mat_metal": "railing",
    "mat_hazard": "hazard", "mat_machine": "fittings", "mat_light_white": "deck_light",
    "mat_neon_amber": "amber_light", "mat_neon_green": "green_light", "mat_neon_white": "bridge_windows",
    "mat_paint": "hold_lining", "mat_steel_grating": "stairs", "mat_hivis": "lifeboat", "mat_glass": "windows",
    "mat_cable": "dark_fittings", "mat_rubber": "fender", "mat_lacquer": "funnel_band",
}


def _hull_block(root, x0, x1):
    box(root, "hull", x0, x1, 0, DECK - .2, -HW, HW, "mat_ship_hull_paint")
    box(root, "deck_plate", x0, x1, DECK - .2, DECK, -HW, HW, "mat_ship_deck_steel")


def _side_details(root, x0, x1):
    """Boot-top band, plate seams, frame lines and sheer strake on straight hull sides (x0..x1)."""
    for s in (-1, 1):
        box(root, "boot_top", x0, x1, 0, 1.4, s * HW, s * 15.99, "mat_paint")
        box(root, "sheer_strake", x0, x1, 11.35, DECK, s * HW, s * 16.0, "mat_metal")
        for y in (4.4, 8.2):
            box(root, "plate_seam", x0, x1, y, y + .07, s * HW, s * 15.975, "mat_trim")
        x = math.ceil((x0 + .1) / 7.5) * 7.5
        while x < x1 - .1:
            box(root, "frame_seam", x - .035, x + .035, 1.4, 11.35, s * HW, s * 15.97, "mat_trim")
            x += 7.5


def _deck_railing(root, x0, x1, gaps=()):
    """Railing on both deck edges from x0 to x1; `gaps` are (a, b) openings for gangways, marked in hazard."""
    cuts = sorted(gaps)
    for s in (-1, 1):
        start = x0
        for a, b in cuts:
            railing_x(root, start, a, DECK, s * RAIL_Z)
            start = b
        railing_x(root, start, x1, DECK, s * RAIL_Z)
        for a, b in cuts:
            for x in (a, b):
                cbox(root, "gap_post", (.1, 1.25, .1), (x, DECK + .625, s * RAIL_Z), "mat_hazard")
            cbox(root, "gap_lamp", (.16, .12, .16), (a, DECK + 1.31, s * RAIL_Z), "mat_neon_amber")


def _deck_lights(root, xs, y=DECK, z=RAIL_Z, sides=(-1, 1)):
    """Lamp posts on the railing line, lenses facing the deck and down (warm white)."""
    for s in sides:
        for x in xs:
            rod(root, "lamp_post", (x, y + 1.1, s * z), (x, y + 1.62, s * z), .035, "mat_metal", 4)
            box(root, "deck_lamp", x - .2, x + .2, y + 1.6, y + 1.76, s * (z - .3), s * (z + .04), "mat_machine")
            box(root, "deck_light", x - .17, x + .17, y + 1.53, y + 1.6, s * (z - .28), s * (z - .02), "mat_light_white")


def _hatch_cover(root, x0, x1, z0=-13.0, z1=13.0):
    """Flat hatch cover from the deck to HATCH; three panel seams inlaid flush in the top."""
    zs = [z0, -6.55, -6.45, -.05, .05, 6.45, 6.55, z1]
    grid_slab(root, "hatch_cover", [x0, x1], zs, DECK, HATCH,
              lambda x, z: "mat_trim" if min(abs(abs(z) - 6.5), abs(z)) < .06 else "mat_metal",
              "mat_ship_hull_paint")
    n = 6
    for i in range(n):
        x = x0 + .7 + (x1 - x0 - 1.4) * i / (n - 1)
        for z in (z0, z1):
            box(root, "cover_rib", x - .05, x + .05, DECK + .06, HATCH - .06, z, z + math.copysign(.06, z),
                "mat_ship_hull_paint")
    for x in (x0, x1):
        for z in (-9.75, -3.25, 3.25, 9.75):
            box(root, "cover_rib", x, x + math.copysign(.06, x), DECK + .06, HATCH - .06, z - .05, z + .05,
                "mat_ship_hull_paint")


def build_port_ship_mid():
    """Mid segment 30 m (X), joints at x = ±15: two hatch covers at 12.8 m, side walkways at 12 m."""
    root = root_for("port_ship_mid")
    _hull_block(root, -15, 15)
    _side_details(root, -15, 15)
    _hatch_cover(root, -14, -.8)
    _hatch_cover(root, .8, 14)
    _deck_railing(root, -15, 15, gaps=((-1.2, 1.2),))
    _deck_lights(root, (-11.25, -5.6, 5.6, 11.25))
    merge(root, {**SHIP_NODES, "mat_paint": "boot_top", "mat_hivis": "handrails"})
    return root


HOLD_X, HOLD_Z, HOLD_FLOOR = 13.6, 12.6, 3.0
HOLD_STAIR = (-10.0, -4.4, 1.2)  # first risers of the three flights (x), 15 x 0.2 m, tread 0.3 m


def _ladder(root, x, z, y0, y1, toward=-1):
    """Vertical rung ladder standing off a wall in Z (`toward` = direction away from the wall)."""
    for dx in (-.22, .22):
        rod(root, "ladder_rail", (x + dx, y0, z), (x + dx, y1, z), .028, "mat_metal", 4)
    y = y0 + .3
    while y < y1 - .9:
        rod(root, "rung", (x - .22, y, z), (x + .22, y, z), .02, "mat_metal", 3)
        y += .35
    for yb in (y0 + 1.5, (y0 + y1) / 2, y1 - 1.6):
        box(root, "ladder_bracket", x - .26, x + .26, yb - .03, yb + .03, z, z - toward * .2, "mat_metal")


def build_port_ship_mid_hold():
    """Mid segment variant with an open hold: tank top at 3 m, coaming to 12.8 m, stairs and ladders."""
    root = root_for("port_ship_mid_hold")
    hx, hz, floor = HOLD_X, HOLD_Z, HOLD_FLOOR
    box(root, "hull", -15, 15, 0, floor - .2, -HW, HW, "mat_ship_hull_paint")
    grid_slab(root, "tank_top", [-hx, -4.55, -4.45, 4.45, 4.55, hx], [-hz, -.05, .05, hz], floor - .2, floor,
              lambda x, z: "mat_trim" if abs(abs(x) - 4.5) < .06 or abs(z) < .06 else "mat_ship_deck_steel",
              "mat_ship_deck_steel")
    # Double-hull sides and transverse bulkheads; inner faces painted (mat_paint).
    prism(root, "hull", [(hz, floor - .2), (HW, floor - .2), (HW, DECK - .2), (hz, DECK - .2)], "x", -15, 15,
          "mat_ship_hull_paint", edge_mats={3: "mat_paint"})
    prism(root, "hull", [(-HW, floor - .2), (-hz, floor - .2), (-hz, DECK - .2), (-HW, DECK - .2)], "x", -15, 15,
          "mat_ship_hull_paint", edge_mats={1: "mat_paint"})
    prism(root, "hull", [(hx, floor - .2), (15, floor - .2), (15, DECK - .2), (hx, DECK - .2)], "z", -hz, hz,
          "mat_ship_hull_paint", edge_mats={3: "mat_paint"})
    prism(root, "hull", [(-15, floor - .2), (-hx, floor - .2), (-hx, DECK - .2), (-15, DECK - .2)], "z", -hz, hz,
          "mat_ship_hull_paint", edge_mats={1: "mat_paint"})
    for s in (-1, 1):
        box(root, "deck_plate", -15, 15, DECK - .2, DECK, s * hz, s * HW, "mat_ship_deck_steel")
        box(root, "deck_plate", s * hx, s * 15, DECK - .2, DECK, -hz, hz, "mat_ship_deck_steel")
    _side_details(root, -15, 15)
    # Coaming 0.4 m around the opening up to the hatch level; gap on -Z where the stairs arrive.
    top0 = HOLD_STAIR[2] + 14 * .3
    top1 = top0 + 1.4
    prism(root, "coaming", [(hz, DECK), (13, DECK), (13, HATCH), (hz, HATCH)], "x", -14, 14,
          "mat_ship_hull_paint", edge_mats={3: "mat_paint"})
    for a, b in ((-14, top0), (top1, 14)):
        prism(root, "coaming", [(-13, DECK), (-hz, DECK), (-hz, HATCH), (-13, HATCH)], "x", a, b,
              "mat_ship_hull_paint", edge_mats={1: "mat_paint"})
    for x in (top0, top1):
        box(root, "gap_mark", x, x + (.02 if x == top0 else -.02), DECK, HATCH, -13, -hz, "mat_hazard")
    prism(root, "coaming", [(hx, DECK), (14, DECK), (14, HATCH), (hx, HATCH)], "z", -hz, hz,
          "mat_ship_hull_paint", edge_mats={3: "mat_paint"})
    prism(root, "coaming", [(-14, DECK), (-hx, DECK), (-hx, HATCH), (-14, HATCH)], "z", -hz, hz,
          "mat_ship_hull_paint", edge_mats={1: "mat_paint"})
    # Three flights of 15 risers (0.2 m, tread 0.3 m) along the -Z wall, 1.4 m wide, landings 1.4 m.
    w0, w1 = -hz, -hz + 1.4
    for i, start in enumerate(HOLD_STAIR):
        y0 = floor + 3 * i
        stair_flight(root, "stairs", start, y0, w0, w1, 15, .2, .3, 1, "mat_steel_grating")
        end = start + 14 * .3
        box(root, "landing", end, end + 1.4, y0 + 2.8, y0 + 3.0, w0, w1, "mat_steel_grating")
        sloped_rail(root, (start, y0 + .2, w1 - .04), (end, y0 + 3.0, w1 - .04), 1.0, "mat_hivis", 3)
        if i < 2:
            railing_x(root, end, end + 1.4, y0 + 3.0, w1 - .04, 1.0, 1.4, "mat_hivis")
            rod(root, "landing_post", (end + 1.3, floor, w1 - .1), (end + 1.3, y0 + 2.8, w1 - .1), .06,
                "mat_metal", 4)
    rod(root, "landing_post", (top1 - .1, floor, w1 - .1), (top1 - .1, DECK - .2, w1 - .1), .06, "mat_metal", 4)
    # Ladders, web frames and lamps on the +Z wall; container cell guides on the end bulkheads.
    for x in (-6.5, 8.5):
        _ladder(root, x, hz - .18, floor, HATCH + .8)
    for x in (-11.0, -2.0, 3.0, 11.5):
        box(root, "web_frame", x - .12, x + .12, floor, DECK, hz - .3, hz, "mat_paint")
    for s in (-1, 1):
        for k in range(5):
            z = 1.22 + 2.44 * k
            for sz in (-1, 1):
                box(root, "cell_guide", s * (hx - .15), s * hx, floor, DECK, sz * z - .08, sz * z + .08, "mat_metal")
    for x in (-10.0, 0.0, 10.0):
        box(root, "hold_lamp", x - .3, x + .3, 10.9, 11.2, hz - .3, hz, "mat_machine")
        box(root, "hold_light", x - .26, x + .26, 10.85, 10.9, hz - .27, hz - .02, "mat_light_white")
    for s in (-1, 1):
        box(root, "hold_lamp", s * (hx - .3), s * hx, 10.9, 11.2, -.3, .3, "mat_machine")
        box(root, "hold_light", s * (hx - .27), s * (hx - .02), 10.85, 10.9, -.26, .26, "mat_light_white")
    _deck_railing(root, -15, 15, gaps=((-1.2, 1.2),))
    _deck_lights(root, (-11.25, -5.6, 5.6, 11.25))
    merge(root, {**SHIP_NODES, "mat_hivis": "handrails"})
    return root


BOW_STEP_X = -11.0  # forecastle front (main deck 12 m aft of it, forecastle deck 13 m forward)
FOC = 13.0


def _bow_outline(t, n=8):
    """Horizontal hull outline at height fraction t (0 waterline .. 1 forecastle deck): aft edge at
    BOW_STEP_X, straight sides, elliptical stem; returned port side -> tip -> starboard side."""
    x_c, x_tip = -10 + 5 * t, 10 + 4 * t
    q, r = 1.7 + .3 * t, 1.0 - .45 * t  # waterline nearly pointed, deck rounded
    port = [(BOW_STEP_X, -HW)]
    for k in range(n + 1):
        u = math.sin(k * (math.pi / 2) / n)
        port.append((x_c + (x_tip - x_c) * u, -HW * (1 - u ** q) ** r if k < n else 0.0))
    return port + [(x, -z) for x, z in reversed(port[:-1])]


def _bow_anchor(root, s, y=9.8):
    """Anchor in a dark pocket on the hull face between outline vertices 4 and 5 (flared bow)."""
    def hull_point(k):
        lo, hi = _bow_outline(.55)[1 + k], _bow_outline(1.0)[1 + k]
        f = (y - 7.0) / (FOC - 7.0)
        return Vector((lo[0] + (hi[0] - lo[0]) * f, y, s * -(lo[1] + (hi[1] - lo[1]) * f)))

    a, b = hull_point(4), hull_point(5)
    c = (a + b) / 2
    t = (b - a).normalized()
    n = Vector((t.z, 0, -t.x))
    if n.dot(Vector((c.x, 0, c.z))) < 0:
        n = -n
    up = Vector((0, 1, 0))
    beam(root, "anchor_pocket", tuple(c + n * .02 - up * 1.2), tuple(c + n * .02 + up * 1.2), 1.6, .1,
         "mat_cable", tuple(n))
    beam(root, "anchor", tuple(c + n * .1 - up * .9), tuple(c + n * .1 + up * .95), .32, .14, "mat_trim", tuple(n))
    beam(root, "anchor_fluke", tuple(c + n * .13 - up * .9 - t * .6), tuple(c + n * .13 - up * .9 + t * .6),
         .34, .16, "mat_trim", tuple(n))


def build_port_ship_bow():
    """Bow segment 28 m: joint at x = -14 (aft), rounded stem at +14. Main deck strip at 12 m, forecastle 13 m."""
    root = root_for("port_ship_bow")
    _hull_block(root, -14, BOW_STEP_X)
    _side_details(root, -14, BOW_STEP_X)
    levels = ((0.0, 0.0), (.55, 7.0), (1.0, FOC))
    rings = [[(x, y, z) for x, z in _bow_outline(t)] for t, y in levels]
    loft(root, "hull", rings, "mat_ship_hull_paint", top_mat="mat_ship_deck_steel")
    # Straight part of the forecastle sides: sheer strake and boot top continue to the curve.
    for s in (-1, 1):
        box(root, "sheer_strake", BOW_STEP_X, -6.0, 12.35, FOC, s * HW, s * 16.0, "mat_metal")
        box(root, "boot_top", BOW_STEP_X, -12.0, 0, 1.4, s * HW, s * 15.99, "mat_paint")
    # Solid bulwark along the forecastle edge, 1.2 m, with a flat top rail.
    deck = _bow_outline(1.0)
    wall_strip(root, "bulwark", deck, .25, FOC, FOC + 1.2, "mat_ship_hull_paint", side=1)
    # Steps from the main deck to the forecastle at both sides (5 x 0.2 m, tread 0.3 m).
    for s in (-1, 1):
        stair_flight(root, "stairs", BOW_STEP_X - 1.2, DECK, s * 13.6, s * 15.5, 5, .2, .3, 1, "mat_steel_grating")
        sloped_rail(root, (BOW_STEP_X - 1.2, DECK + .2, s * 13.55), (BOW_STEP_X, FOC, s * 13.55), 1.0, "mat_hivis", 2)
    railing_x(root, -14, BOW_STEP_X, DECK, -RAIL_Z)
    railing_x(root, -14, BOW_STEP_X, DECK, RAIL_Z)
    railing_z(root, -13.5, 13.5, FOC, BOW_STEP_X + .1, 1.0, 2.7, "mat_metal")
    # V-shaped breakwater protecting the first container bay, with stiffeners and floodlights.
    for s in (-1, 1):
        wall_strip(root, "breakwater", [(-8.8, s * 12.0), (-7.6, 0.0)], .25, FOC, FOC + 3.0,
                   "mat_ship_hull_paint", side=s)
        for k in range(1, 5):
            f = k / 5
            x, z = -8.8 + 1.2 * f, s * 12.0 * (1 - f)
            box(root, "breakwater_rib", x - .45, x - .25, FOC, FOC + 2.8, z - .06, z + .06, "mat_ship_hull_paint")
    for s in (-1, 1):
        box(root, "flood_lamp", -8.2, -7.9, FOC + 3.0, FOC + 3.3, s * 4.2 - .25, s * 4.2 + .25, "mat_machine")
        box(root, "flood_lens", -8.24, -8.2, FOC + 3.03, FOC + 3.27, s * 4.2 - .22, s * 4.2 + .22, "mat_light_white")
    # Mooring winches, windlasses with chain to the hawse pipes, bollards, fairleads.
    for s in (-1, 1):
        box(root, "winch_base", -6.5, -3.5, FOC, FOC + .3, s * 10.0, s * 12.5, "mat_machine")
        rod(root, "winch_drum", (-6.0, FOC + .9, s * 10.2), (-6.0, FOC + .9, s * 12.3), .55, "mat_machine", 10)
        rod(root, "winch_drum", (-4.1, FOC + .9, s * 10.2), (-4.1, FOC + .9, s * 12.3), .55, "mat_machine", 10)
        box(root, "winch_motor", -5.6, -4.5, FOC + .3, FOC + 1.3, s * 10.4, s * 11.4, "mat_hivis")
        box(root, "windlass", 3.5, 6.0, FOC, FOC + 1.1, s * 3.0, s * 6.0, "mat_machine")
        rod(root, "gypsy", (4.75, FOC + 1.3, s * 3.2), (4.75, FOC + 1.3, s * 5.8), .7, "mat_machine", 10)
        rod(root, "chain_pipe", (6.0, FOC + .25, s * 4.5), (9.4, FOC + .25, s * 7.3), .18, "mat_trim", 6)
        for x, z in ((-2.0, 14.6), (6.5, 12.0)):
            rod(root, "bitt", (x - .35, FOC, s * z), (x - .35, FOC + .7, s * z), .2, "mat_trim", 8)
            rod(root, "bitt", (x + .35, FOC, s * z), (x + .35, FOC + .7, s * z), .2, "mat_trim", 8)
        _bow_anchor(root, s)
    # Foremast with masthead light; side lights (green +Z, amber -Z) on the bulwark.
    rod(root, "foremast", (9.5, FOC, 0), (9.5, FOC + 10.0, 0), .2, "mat_metal", 8, .12)
    rod(root, "mast_yard", (9.5, FOC + 7.5, -1.6), (9.5, FOC + 7.5, 1.6), .06, "mat_metal", 4)
    box(root, "mast_light", 9.3, 9.7, FOC + 9.6, FOC + 9.95, -.2, .2, "mat_light_white")
    box(root, "beacon", 9.38, 9.62, FOC + 10.0, FOC + 10.2, -.12, .12, "mat_neon_amber")
    for z, mat in ((-1.6, "mat_neon_amber"), (1.6, "mat_neon_green")):
        box(root, "yard_light", 9.38, 9.62, FOC + 7.2, FOC + 7.45, z - .12, z + .12, mat)
    for s, mat in ((1, "mat_neon_green"), (-1, "mat_neon_amber")):
        box(root, "side_light", -9.0, -8.4, FOC + 1.25, FOC + 1.55, s * 15.75, s * 15.95, mat)
    _deck_lights(root, (-12.5,))
    merge(root, {**SHIP_NODES, "mat_paint": "boot_top", "mat_hivis": "handrails"})
    return root


STERN_FWD = 15.0  # joint with the mid segments


def _stern_outline(t, n=6):
    """Outline at height fraction t (0 waterline .. 1 deck): joint at +15, straight sides, rounded
    corners into a flat transom at the stern (-X)."""
    x_s, x_t, w_t = -1 - 4 * t, -13 - 2 * t, 7.5 + 4.5 * t
    port = [(STERN_FWD, -HW)]
    for k in range(n + 1):
        th = k * (math.pi / 2) / n
        port.append((x_s - (x_s - x_t) * math.sin(th), -(w_t + (HW - w_t) * math.cos(th))))
    return port + [(x, -z) for x, z in reversed(port)]


ACC = (-5.5, 2.0, 9.0)  # accommodation block: aft x, front x, half width
GAL_W = 1.2  # gallery width
STERN_STAIR_X = (-4.0, -.5)  # stair flights on the +Z side: first riser, last riser (15 x 0.2 m, tread 0.25 m)


def _gallery(root, y, gaps=()):
    """U-shaped gallery around the accommodation front and sides at level y, solid 1 m parapet."""
    ax, fx, hz = ACC
    box(root, "gallery", fx, fx + GAL_W, y - .2, y, -hz - GAL_W, hz + GAL_W, "mat_steel_grating")
    for s in (-1, 1):
        box(root, "gallery", ax, fx, y - .2, y, s * hz, s * (hz + GAL_W), "mat_steel_grating")
    box(root, "parapet", fx + GAL_W - .08, fx + GAL_W, y, y + 1.0, -hz - GAL_W, hz + GAL_W, "mat_metal")
    for s in (-1, 1):
        cuts = sorted(gaps) if s > 0 else []
        start = ax
        for a, b in cuts + [(fx + GAL_W - .08, fx + GAL_W - .08)]:
            if a > start:
                box(root, "parapet", start, a, y, y + 1.0, s * (hz + GAL_W - .08), s * (hz + GAL_W), "mat_metal")
            start = b
        box(root, "gallery_edge", ax, fx + GAL_W, y - .32, y - .2, s * (hz + GAL_W - .12), s * (hz + GAL_W),
            "mat_trim")


def _windows(root, y, lit):
    """One storey of windows (quads) on the accommodation front and sides; `lit` picks lit panes."""
    ax, fx, hz = ACC
    k = 0
    for i in range(6):
        z = -7.5 + i * 3.0
        mat = "mat_light_white" if lit(k) else "mat_glass"
        quad(root, "window", (fx + .01, y + 1.55, z), 1.4, 1.0, "+x", mat)
        k += 1
    for s in (-1, 1):
        for i in range(3):
            x = -4.4 + i * 2.2
            mat = "mat_light_white" if lit(k) else "mat_glass"
            quad(root, "window", (x, y + 1.55, s * (hz + .01)), 1.3, 1.0, "+z" if s > 0 else "-z", mat)
            k += 1
    for s in (-1, 1):
        quad(root, "door", (fx - .8, y + 1.05, s * (hz + .01)), .9, 2.0, "+z" if s > 0 else "-z", "mat_trim")


def build_port_ship_stern():
    """Stern segment 30 m: joint at x = +15, transom at -15. Accommodation with five storeys (12-27 m),
    galleries at 15/18/21 m, bridge wings at 24 m, funnel and freefall lifeboat aft."""
    root = root_for("port_ship_stern")
    levels = ((0.0, 0.0), (.5, 6.0), (1.0, DECK))
    rings = [[(x, y, z) for x, z in _stern_outline(t)] for t, y in levels]
    loft(root, "hull", rings, "mat_ship_hull_paint", top_mat="mat_ship_deck_steel")
    for s in (-1, 1):
        box(root, "sheer_strake", -5.0, STERN_FWD, 11.35, DECK, s * HW, s * 16.0, "mat_metal")
        box(root, "boot_top", -1.0, STERN_FWD, 0, 1.4, s * HW, s * 15.99, "mat_paint")
        box(root, "plate_seam", -3.0, STERN_FWD, 8.2, 8.27, s * HW, s * 15.975, "mat_trim")
    # Bulwark around the rounded stern and the transom; railing along the straight sides.
    deck = _stern_outline(1.0)
    aft = deck[1:-1]
    wall_strip(root, "bulwark", aft, .25, DECK, DECK + 1.2, "mat_ship_hull_paint", side=-1)
    for s in (-1, 1):
        railing_x(root, -5.0, STERN_FWD, DECK, s * RAIL_Z)
    # Forward deck: one hatch cover (12.8 m top).
    _hatch_cover(root, 4.4, 14.0)
    # Accommodation block, storeys every 3 m, windows, galleries and outside stairs (+Z side).
    ax, fx, hz = ACC
    box(root, "accommodation", ax, fx, DECK, 24.0, -hz, hz, "mat_metal")
    lit_sets = ({0, 2, 5, 7, 11}, {1, 3, 4, 8, 10}, {0, 5, 6, 9, 11}, {2, 3, 7, 8})
    for i, y in enumerate((DECK, 15.0, 18.0, 21.0)):
        _windows(root, y, lambda k, lit=lit_sets[i]: k in lit)
    x0, x1 = STERN_STAIR_X
    zs0, zs1 = hz + GAL_W, hz + GAL_W + 1.2
    for y in (15.0, 18.0, 21.0):
        _gallery(root, y, gaps=((x0 - 1.2, x0), (x1, x1 + 1.2)))
    for i, y in enumerate((DECK, 15.0, 18.0, 21.0)):
        stair_flight(root, "stairs", x0, y, zs0, zs1, 15, .2, .25, 1, "mat_steel_grating")
        sloped_rail(root, (x0, y + .2, zs1 - .04), (x1, y + 3.0, zs1 - .04), 1.0, "mat_hivis", 3)
        if i < 3:
            box(root, "landing", x1, x1 + 1.2, y + 2.8, y + 3.0, zs0, zs1, "mat_steel_grating")
            box(root, "landing_parapet", x1, x1 + 1.2, y + 3.0, y + 4.0, zs1 - .08, zs1, "mat_metal")
        if i > 0:
            box(root, "landing", x0 - 1.2, x0, y - .2, y, zs0, zs1, "mat_steel_grating")
            box(root, "landing_parapet", x0 - 1.2, x0, y, y + 1.0, zs1 - .08, zs1, "mat_metal")
    # Wheelhouse (24-27 m) with a lit front window band, wings to the ship sides, roof with radar mast.
    box(root, "wheelhouse", ax + .5, fx + .4, 24.0, 26.9, -10.0, 10.0, "mat_metal")
    box(root, "wheelhouse_roof", ax + .3, fx + .6, 26.9, 27.0, -10.2, 10.2, "mat_trim")
    quad(root, "bridge_window", (fx + .41, 25.65, 0), 19.0, 1.3, "+x", "mat_neon_white")
    for s in (-1, 1):
        quad(root, "bridge_window", (fx - 2.0, 25.65, s * 10.01), 4.2, 1.2, "+z" if s > 0 else "-z", "mat_neon_white")
        box(root, "bridge_wing", x1, fx + .4, 23.8, 24.0, s * 10.0, s * 15.6, "mat_steel_grating")
        box(root, "wing_parapet", x1, fx + .4, 24.0, 25.1, s * 15.52, s * 15.6, "mat_metal")
        box(root, "wing_parapet", fx + .32, fx + .4, 24.0, 25.1, s * 10.0, s * 15.6, "mat_metal")
        box(root, "wing_console", fx - .3, fx + .3, 24.0, 25.2, s * 14.6, s * 15.3, "mat_machine")
        box(root, "wing_bracket", fx - .2, fx + .2, 22.6, 23.8, s * 12.0, s * 15.0, "mat_trim")
        box(root, "flood_lamp", fx + .5, fx + .7, 23.4, 23.7, s * 6.0 - .3, s * 6.0 + .3, "mat_machine")
        box(root, "flood_lens", fx + .7, fx + .72, 23.42, 23.68, s * 6.0 - .27, s * 6.0 + .27, "mat_light_white")
    # Aft edge of the wings: closed on -Z, open on +Z only where the stairs arrive (z 10.2-11.4).
    box(root, "wing_parapet", x1, x1 + .08, 24.0, 25.1, -15.6, -10.0, "mat_metal")
    box(root, "wing_parapet", x1, x1 + .08, 24.0, 25.1, zs1, 15.6, "mat_metal")
    rod(root, "radar_mast", (-3.5, 27.0, 0), (-3.5, 33.4, 0), .2, "mat_metal", 8, .14)
    for y, half in ((30.0, 2.4), (32.4, 1.8)):
        box(root, "radar_bar", -3.75, -3.25, y, y + .22, -half, half, "mat_trim")
    box(root, "mast_light", -3.7, -3.3, 33.4, 33.7, -.2, .2, "mat_light_white")
    box(root, "beacon", -3.62, -3.38, 33.7, 33.9, -.12, .12, "mat_neon_amber")
    # Engine casing and raked funnel with an ochre band and two exhausts.
    box(root, "casing", -9.0, ax, DECK, 26.0, -4.0, 4.0, "mat_metal")
    funnel = [[(x - .14 * (y - 26.0), y, z) for x, z in
               ((-8.8, -3.2), (-6.0, -3.2), (-5.6, -2.6), (-5.6, 2.6), (-6.0, 3.2), (-8.8, 3.2), (-9.2, 2.6),
                (-9.2, -2.6))] for y in (26.0, 33.0)]
    loft(root, "funnel", funnel, "mat_ship_hull_paint")
    band = [[(x - .14 * (y - 26.0), y, z * 1.04) for x, z in
             ((-8.85, -3.25), (-5.95, -3.25), (-5.53, -2.62), (-5.53, 2.62), (-5.95, 3.25), (-8.85, 3.25),
              (-9.27, 2.62), (-9.27, -2.62))] for y in (30.0, 31.4)]
    loft(root, "funnel_band", band, "mat_hivis")
    for z in (-1.2, 1.2):
        rod(root, "exhaust", (-7.9 - .98, 32.6, z), (-8.0 - 1.1, 34.2, z), .38, "mat_trim", 8)
    # Freefall lifeboat on its ramp over the aft mooring deck (keel line from `base`, down towards the stern).
    d = Vector((-5.2, -3.2, 0)).normalized()
    up = Vector((d.y, -d.x, 0))
    base = Vector((-9.25, 18.2, 0))
    for z in (-.9, .9):
        a = base + d * -.2 - up * .3 + Vector((0, 0, z))
        b = base + d * 5.7 - up * .3 + Vector((0, 0, z))
        beam(root, "ramp_rail", tuple(a), tuple(b), .15, .25, "mat_metal")
        for p in (a + d * .4, b - d * .4):
            rod(root, "ramp_post", (p.x, DECK, z), (p.x, p.y - .1, z), .12, "mat_metal", 6)
    sections = []
    for t, half, h in ((0.0, .45, 1.1), (.6, 1.1, 2.2), (3.0, 1.15, 2.4), (4.9, .9, 2.0), (5.5, .4, 1.1)):
        c = base + d * t
        sections.append([tuple(c + up * (h * v) + Vector((0, 0, half * u))) for u, v in
                         ((-1, 0), (1, 0), (1.05, .55), (.7, 1.0), (-.7, 1.0), (-1.05, .55))])
    loft(root, "lifeboat", sections, "mat_hivis")
    # Aft mooring deck: winches, bitts; stern light.
    for s in (-1, 1):
        box(root, "winch_base", -14.0, -11.6, DECK, DECK + .3, s * 4.0, s * 7.0, "mat_machine")
        rod(root, "winch_drum", (-12.8, DECK + .9, s * 4.2), (-12.8, DECK + .9, s * 6.8), .5, "mat_machine", 10)
        for x, z in ((-13.4, 10.2), (-6.5, 14.6)):
            rod(root, "bitt", (x - .35, DECK, s * z), (x - .35, DECK + .7, s * z), .2, "mat_trim", 8)
            rod(root, "bitt", (x + .35, DECK, s * z), (x + .35, DECK + .7, s * z), .2, "mat_trim", 8)
    box(root, "stern_light", -15.0, -14.85, DECK + 1.25, DECK + 1.5, -.2, .2, "mat_light_white")
    _deck_lights(root, (6.0, 12.0))
    merge(root, {**SHIP_NODES, "mat_paint": "boot_top"})
    return root


# --------------------------------------------------------------------------- port: STS crane, gangway

STS_LX, STS_LZ = 15.0, 9.0  # leg lines: waterside x = +15, landside x = -15; legs at z = +-9
STS_TOP = 45.0  # top of the girders and boom
STS_TIE = (17.0, 19.0)  # portal tie beams along X (clear height under them 17 m)
STS_BOOM_X = (15.8, 65.0)  # boom hinge and tip


def _girder(root, name, x0, x1, z0, z1, bottom0, bottom1, top=STS_TOP, mat="mat_crane_paint"):
    rings = [[(x, b, z0), (x, b, z1), (x, top, z1), (x, top, z0)] for x, b in ((x0, bottom0), (x1, bottom1))]
    return ba._city_hull(root, name, rings, mat)


def _boom_bottom(x):
    """Underside of the girders: flat 42.5 m on the backreach, rising to 44 m at the boom tip."""
    h0, h1 = STS_BOOM_X
    return 42.5 + max(0.0, (x - h0) / (h1 - h0)) * 1.5


def build_port_sts_crane():
    """Ship-to-shore crane. Legs on x = +-15 (gauge 30 m) and z = +-9 (18 m), travel along Z; boom over the
    water towards +X (tip at x = 65, outreach 50 m), backreach to x = -31. Origin between the legs at rail level."""
    root = root_for("port_sts_crane")
    lx, lz, top = STS_LX, STS_LZ, STS_TOP
    for sx in (-1, 1):
        for sz in (-1, 1):
            x, z = sx * lx, sz * lz
            box(root, "equalizer", x - .7, x + .7, 1.15, 2.3, z - 3.4, z + 3.4, "mat_crane_paint")
            for zb in (z - 2.0, z + 2.0):
                box(root, "bogie", x - .55, x + .55, .5, 1.15, zb - 1.3, zb + 1.3, "mat_trim")
                for dz in (-.75, .75):
                    rod(root, "wheel", (x - .32, .45, zb + dz), (x + .32, .45, zb + dz), .45, "mat_metal", 8)
            box(root, "leg_foot", x - 1.1, x + 1.1, 2.3, 3.0, z - 1.1, z + 1.1, "mat_crane_paint")
            box(root, "leg", x - .9, x + .9, 3.0, 42.5, z - .9, z + .9, "mat_crane_paint")
            box(root, "leg_band", x - .93, x + .93, 3.2, 5.6, z - .93, z + .93, "mat_hazard")
    # Side frames (an H in side view): tie beams with knee braces and an X brace up to the top beams.
    for sz in (-1, 1):
        z = sz * lz
        box(root, "tie_beam", -lx + .9, lx - .9, STS_TIE[0], STS_TIE[1], z - .7, z + .7, "mat_crane_paint")
        box(root, "top_beam", -lx + .9, lx - .9, 40.0, 42.0, z - .7, z + .7, "mat_crane_paint")
        for sx in (-1, 1):
            beam(root, "knee", (sx * (lx - .9), 13.5, z), (sx * (lx - 5.0), STS_TIE[0] + .2, z), .55, .55,
                 "mat_crane_paint")
        beam(root, "brace", (-lx + .9, STS_TIE[1], z), (lx - .9, 40.0, z), .6, .6, "mat_crane_paint")
        beam(root, "brace", (lx - .9, STS_TIE[1], z), (-lx + .9, 40.0, z), .6, .6, "mat_crane_paint")
    for sx in (-1, 1):
        box(root, "portal_beam", sx * lx - 1.0, sx * lx + 1.0, 40.0, 42.5, -lz - .9, lz + .9, "mat_crane_paint")
    # Twin box girders (backreach and fixed part), hinged boom tapering to the tip, ties and a catwalk.
    h0, h1 = STS_BOOM_X
    for sz in (-1, 1):
        z0, z1 = sz * 2.8, sz * 4.2
        _girder(root, "girder", -31.0, h0, z0, z1, 42.5, 42.5)
        _girder(root, "boom", h0, h1, z0, z1, 42.5, 44.0)
        box(root, "trolley_rail", -30.5, h1 - .5, top, top + .12, sz * 3.4, sz * 3.6, "mat_trim")
    box(root, "girder_end", -31.0, -30.0, 42.5, top, -2.8, 2.8, "mat_crane_paint")
    box(root, "girder_end", h1 - 1.0, h1, _boom_bottom(h1 - 1.0), top, -2.8, 2.8, "mat_crane_paint")
    for x in (-24.0, -12.0, 0.0, 22.0, 34.0, 46.0, 56.0):
        yb = _boom_bottom(x)
        box(root, "girder_tie", x - .25, x + .25, yb, yb + .5, -2.8, 2.8, "mat_crane_paint")
    box(root, "catwalk", -30.0, h1 - 2.0, 42.35, 42.45, 4.2, 5.1, "mat_steel_grating")
    box(root, "catwalk_rail", -30.0, h1 - 2.0, 43.45, 43.5, 5.04, 5.1, "mat_hivis")
    # A-frame apex with forestays to the boom and backstays to the girders.
    apex_x, apex_y = 9.0, 58.0
    for sz in (-1, 1):
        beam(root, "apex_strut", (lx - .4, top, sz * 3.6), (apex_x + .4, apex_y, sz * 2.6), 1.0, 1.0,
             "mat_crane_paint")
        beam(root, "apex_strut", (-lx + .4, top, sz * 3.6), (apex_x - .4, apex_y, sz * 2.6), 1.0, 1.0,
             "mat_crane_paint")
        for xb in (40.0, 62.0):
            rod(root, "forestay", (apex_x + .3, apex_y - .3, sz * 2.6), (xb, top + .1, sz * 3.5), .13, "mat_metal", 4)
        rod(root, "backstay", (apex_x - .3, apex_y - .3, sz * 2.6), (-16.0, top + .1, sz * 3.5), .13, "mat_metal", 4)
    box(root, "apex_head", apex_x - .8, apex_x + .8, apex_y - .2, apex_y + 1.0, -3.3, 3.3, "mat_crane_paint")
    rod(root, "beacon", (apex_x, apex_y + 1.0, 0), (apex_x, apex_y + 1.35, 0), .18, "mat_neon_amber", 6)
    for z in (-3.0, 3.0):
        box(root, "beacon", apex_x - .15, apex_x + .15, apex_y + 1.0, apex_y + 1.25, z - .15, z + .15,
            "mat_neon_amber")
        box(root, "tip_light", h1 - .4, h1, top + .12, top + .42, z - .2, z + .2, "mat_neon_amber")
    # Machinery house on the backreach with louvres, door and amber corner lamps.
    box(root, "machinery_house", -30.5, -17.5, top, top + 5.0, -5.5, 5.5, "mat_machine")
    box(root, "house_roof", -30.7, -17.3, top + 5.0, top + 5.3, -5.7, 5.7, "mat_trim")
    for sz in (-1, 1):
        for i in range(5):
            box(root, "house_louvre", -29.0 + i * 2.2, -27.6 + i * 2.2, top + 1.6, top + 3.6, sz * 5.5,
                sz * 5.56, "mat_trim")
        for x in (-30.4, -17.6):
            box(root, "house_lamp", x - .12, x + .12, top + 5.3, top + 5.55, sz * 5.6 - .12, sz * 5.6 + .12,
                "mat_neon_amber")
    box(root, "house_door", -17.5, -17.44, top + .2, top + 2.4, -.5, .5, "mat_trim")
    # Trolley with an outrigger and the operator cabin hanging on the +Z side; hoist ropes and spreader.
    tx = 31.0
    box(root, "trolley", tx - 3.0, tx + 3.0, top + .12, top + 1.8, -4.6, 4.6, "mat_machine")
    box(root, "trolley_roof", tx - 2.2, tx + 2.2, top + 1.8, top + 2.2, -3.0, 3.0, "mat_trim")
    box(root, "outrigger", tx - 1.6, tx + 1.6, top + .5, top + .9, 4.6, 6.8, "mat_machine")
    for x in (tx - 1.2, tx + 1.2):
        rod(root, "cabin_hanger", (x, top + .5, 6.3), (x, 41.8, 6.3), .08, "mat_metal", 4)
    box(root, "cabin", tx - 1.5, tx + 1.5, 39.2, 41.8, 4.4, 6.9, "mat_lacquer")
    box(root, "cabin_band", tx - 1.53, tx + 1.53, 41.45, 41.6, 4.37, 6.93, "mat_neon_amber")
    quad(root, "cabin_glass", (tx + 1.51, 40.4, 5.65), 2.2, 1.6, "+x", "mat_glass")
    quad(root, "cabin_glass", (tx, 39.19, 5.65), 2.6, 2.1, "-y", "mat_glass")
    quad(root, "cabin_glass", (tx, 40.5, 6.91), 2.6, 1.2, "+z", "mat_glass")
    box(root, "status_lamp", tx + 1.5, tx + 1.58, 41.0, 41.15, 6.5, 6.65, "mat_neon_green")
    for x in (tx - .5, tx + .5):
        for z in (-.6, .6):
            rod(root, "hoist_rope", (x, top, z), (x, 23.4, z), .04, "mat_cable", 4)
    box(root, "headblock", tx - .8, tx + .8, 22.6, 23.4, -.9, .9, "mat_hivis")
    box(root, "spreader", tx - .6, tx + .6, 22.0, 22.5, -6.1, 6.1, "mat_hivis")
    for sz in (-1, 1):
        box(root, "spreader_end", tx - 1.22, tx + 1.22, 21.95, 22.55, sz * 5.85, sz * 6.1, "mat_hivis")
        for x in (tx - 1.07, tx + 1.07):
            box(root, "twistlock", x - .15, x + .15, 21.7, 21.95, sz * 5.88, sz * 6.08, "mat_hazard")
    # Floodlights under the boom and backreach (warm white), facing down.
    for x in (-24.0, -8.0, 20.0, 30.0, 40.0, 50.0, 60.0):
        yb = _boom_bottom(x)
        for sz in (-1, 1):
            box(root, "flood_housing", x - .35, x + .35, yb - .35, yb, sz * 3.15, sz * 3.85, "mat_machine")
            box(root, "flood_lens", x - .3, x + .3, yb - .38, yb - .35, sz * 3.2, sz * 3.8, "mat_light_white")
    # Access: platforms and steep zig-zag ladders on the landside -Z leg.
    x, z = -lx, -lz
    levels = (2.3, 9.0, STS_TIE[1], 29.5, 40.0)
    for i, y in enumerate(levels[1:], 1):
        box(root, "access_platform", x - 2.6, x - .9, y - .12, y, z - 1.2, z + 1.2, "mat_steel_grating")
        box(root, "platform_rail", x - 2.6, x - 2.54, y, y + 1.1, z - 1.2, z + 1.2, "mat_hivis")
        za, zb = (z - 1.0, z + 1.0) if i % 2 else (z + 1.0, z - 1.0)
        beam(root, "access_ladder", (x - 1.75, levels[i - 1], za), (x - 1.75, y, zb), .7, .12, "mat_hivis",
             up=(1, 0, 0))
    merge(root, {"mat_crane_paint": "frame", "mat_machine": "machinery_house", "mat_trim": "running_gear",
                 "mat_metal": "steelwork", "mat_hazard": "hazard", "mat_hivis": "spreader",
                 "mat_lacquer": "cabin", "mat_glass": "cabin_glass", "mat_cable": "hoist_rope",
                 "mat_light_white": "floodlight", "mat_neon_amber": "warning_light", "mat_neon_green": "status_lamp",
                 "mat_steel_grating": "catwalk"})
    return root


GANGWAY_RUN, GANGWAY_RISE = 26.0, 12.0
GANGWAY_X0 = -14.0  # bottom lip of the ramp; the ramp ends at x = 12, landing x 12..14


def build_port_gangway():
    """Shore gangway along X: flat ramp from (x = -14, y = 0) to (x = 12, y = 12), i.e. 26 m run and 12 m rise
    (24.78 deg), then a 2 x 2 m landing at 12 m. Walking surface 2.0 m wide (z -1..1); at the landing the
    +Z side (ship) is open, -Z and the far end have railings."""
    root = root_for("port_gangway")
    run, rise, th = GANGWAY_RUN, GANGWAY_RISE, .25
    x0 = GANGWAY_X0
    x1, x2 = x0 + run, x0 + run + 2.0
    k = run / rise
    profile = [(x0, 0.0), (x1, rise), (x2, rise), (x2, rise - th), (x1 - th * k, rise - th), (x0 + th * k, 0.0)]
    prism(root, "walkway", profile, "z", -1.0, 1.0, "mat_metal",
          edge_mats={0: "mat_steel_grating", 1: "mat_steel_grating"})
    # Side stringers (channels) along the ramp with a 0.1 m curb above the walking surface.
    xa = x0 + .5 * k
    for s in (-1, 1):
        prism(root, "stringer", [(xa, .6), (x1, rise + .1), (x1, rise - .55), (xa, 0.0)], "z",
              s * 1.0, s * 1.08, "mat_hivis")
    box(root, "stringer", x1, x2, rise - .55, rise + .1, -1.08, -1.0, "mat_hivis")
    # Railings: handrail 1.0 m above the ramp, Warren diagonals between the posts.
    bays = 9
    up = Vector((0, 1.0, 0))
    for s in (-1, 1):
        z = s * 1.04
        a = Vector((xa, (xa - x0) / k, z))
        b = Vector((x1, rise, z))
        rod(root, "handrail", tuple(a + up), tuple(b + up), .035, "mat_hivis", 4)
        rod(root, "mid_rail", tuple(a + up * .5), tuple(b + up * .5), .03, "mat_hivis", 4)
        for i in range(bays + 1):
            p = a + (b - a) * (i / bays)
            rod(root, "rail_post", tuple(p), tuple(p + up), .035, "mat_hivis", 4)
            if i < bays:
                q = a + (b - a) * ((i + 1) / bays)
                lo, hi = (p, q + up * .95) if i % 2 == 0 else (p + up * .95, q)
                rod(root, "truss_diagonal", tuple(lo), tuple(hi), .025, "mat_hivis", 4)
    railing_x(root, x1, x2, rise, -1.04, 1.0, 1.0, "mat_hivis")
    railing_z(root, -1.0, 1.0, rise, x2 - .04, 1.0, 1.0, "mat_hivis")
    # Support tower under the landing, an A-frame at mid-span and rollers at the foot.
    for x in (x1 + .25, x2 - .25):
        for z in (-.85, .85):
            box(root, "tower_post", x - .1, x + .1, 0, rise - .55, z - .1, z + .1, "mat_metal")
    for y0, y1 in ((0.4, 4.0), (4.0, 7.6), (7.6, 11.2)):
        for z in (-.85, .85):
            rod(root, "tower_brace", (x1 + .25, y0, z), (x2 - .25, y1, z), .05, "mat_metal", 4)
        for x in (x1 + .25, x2 - .25):
            rod(root, "tower_brace", (x, y0, -.85), (x, y1, .85), .05, "mat_metal", 4)
    box(root, "tower_foot", x1, x2, 0, .2, -1.1, 1.1, "mat_concrete")
    xm = x0 + run * .5
    ym = (xm - x0) / k
    for z in (-.85, .85):
        box(root, "aframe_post", xm - .1, xm + .1, 0, ym - .55, z - .1, z + .1, "mat_metal")
    box(root, "aframe_beam", xm - .15, xm + .15, ym - .7, ym - .45, -1.0, 1.0, "mat_metal")
    rod(root, "aframe_brace", (xm, .3, -.85), (xm, ym - .7, .85), .05, "mat_metal", 4)
    for z in (-1.1, 1.1):
        rod(root, "roller", (x0 + 1.0, .25, z - .05), (x0 + 1.0, .25, z + .05), .25, "mat_rubber", 8)
    rod(root, "roller_axle", (x0 + 1.0, .25, -1.05), (x0 + 1.0, .25, 1.05), .05, "mat_metal", 4)
    for z in (-.97, .97):
        box(root, "landing_lamp", x2 - .12, x2, rise + 1.0, rise + 1.15, z - .08, z + .08, "mat_neon_amber")
    merge(root, {"mat_steel_grating": "walkway", "mat_metal": "frame", "mat_hivis": "railing",
                 "mat_concrete": "tower_foot", "mat_rubber": "roller", "mat_neon_amber": "landing_lamp"})
    return root


# --------------------------------------------------------------------------- port: freight cars

CAR_FLOOR = 1.2  # boxcar floor and flatcar deck (top)
CAR_HALF = 7.0  # half length over the couplers
WHEEL_R = .46
GAUGE_Z = .7175  # standard gauge 1.435 m


def _freight_running_gear(root):
    """Two-axle bogies at x = +-4.6, underframe sills and couplers; wheels stand on y = 0 (rail top)."""
    for xc in (-4.6, 4.6):
        for s in (-1, 1):
            box(root, "side_frame", xc - 1.25, xc + 1.25, .32, .82, s * .84, s * .96, "mat_trim")
            box(root, "spring", xc - .25, xc + .25, .62, .92, s * .82, s * .98, "mat_metal")
            for dx in (-.9, .9):
                rod(root, "wheel", (xc + dx, WHEEL_R, s * (GAUGE_Z - .06)), (xc + dx, WHEEL_R, s * (GAUGE_Z + .07)),
                    WHEEL_R, "mat_metal", 8)
        for dx in (-.9, .9):
            rod(root, "axle", (xc + dx, WHEEL_R, -.66), (xc + dx, WHEEL_R, .66), .08, "mat_trim", 6)
        box(root, "bolster", xc - .3, xc + .3, .66, .95, -1.0, 1.0, "mat_trim")
    box(root, "center_sill", -6.62, 6.62, .9, 1.1, -.32, .32, "mat_trim")
    for s in (-1, 1):
        box(root, "side_sill", -6.62, 6.62, .95, 1.1, s * 1.3, s * 1.42, "mat_trim")
        box(root, "end_sill", s * 6.5, s * 6.62, .9, 1.1, -1.42, 1.42, "mat_trim")
        box(root, "coupler_shank", s * 6.62, s * 6.88, .86, 1.0, -.12, .12, "mat_metal")
        box(root, "coupler_head", s * 6.88, s * CAR_HALF, .82, 1.04, -.24, .24, "mat_metal")
        for x in (-5.0, -1.7, 1.7, 5.0):
            box(root, "reflector", x - .3, x + .3, .98, 1.06, s * 1.42, s * 1.44, "mat_hivis")


def _freight_boxcar(name, open_doors):
    """Boxcar 14 m over couplers, body 13.1 x 3.0 m, floor 1.2 m, flat walkable roof 4.2 m. Sliding doors
    3.2 m wide in the middle of both sides; the open variant slides them to +X and shows the interior."""
    root = root_for(name)
    _freight_running_gear(root)
    hx, wall_in, wall_out = 6.55, 1.32, 1.42
    door0, door1, door_top = -1.5, 1.5, 3.75
    box(root, "floor", -hx, hx, 1.1, CAR_FLOOR, -wall_out, wall_out, "mat_wood")
    for s in (-1, 1):
        box(root, "side_wall", -hx, door0, 1.1, 3.95, s * wall_in, s * wall_out, "mat_rust")
        box(root, "side_wall", door1, hx, 1.1, 3.95, s * wall_in, s * wall_out, "mat_rust")
        box(root, "door_header", door0, door1, door_top, 3.95, s * wall_in, s * wall_out, "mat_rust")
        box(root, "end_wall", s * (hx - .1), s * hx, CAR_FLOOR, 3.95, -wall_in, wall_in, "mat_rust")
        for x in (-5.95, -4.7, -3.45, -2.2, 2.2, 3.45, 4.7, 5.95):
            box(root, "side_post", x - .045, x + .045, 1.12, 3.9, s * wall_out, s * 1.44, "mat_rust")
        for x in (-hx + .02, hx - .02):
            box(root, "corner_post", x - .06, x + .06, 1.1, 3.95, s * wall_out, s * 1.46, "mat_trim")
        # Door on its tracks: closed over the opening or slid to +X.
        d0 = door0 - .1 if not open_doors else door1 + .05
        box(root, "door_track", door0 - .2, door1 + 3.4, 3.8, 3.9, s * wall_out, s * 1.5, "mat_trim")
        box(root, "door_track", door0 - .2, door1 + 3.4, 1.1, 1.16, s * wall_out, s * 1.5, "mat_trim")
        box(root, "door", d0, d0 + 3.2, 1.18, 3.8, s * 1.44, s * 1.47, "mat_rust")
        for x in (d0 + .5, d0 + 2.7):
            box(root, "door_rib", x - .05, x + .05, 1.25, 3.72, s * 1.47, s * 1.485, "mat_trim")
        rod(root, "lock_bar", (d0 + 2.95, 1.3, s * 1.484), (d0 + 2.95, 3.65, s * 1.484), .015, "mat_metal", 4)
        box(root, "door_handle", d0 + 2.85, d0 + 3.05, 2.3, 2.42, s * 1.47, s * 1.5, "mat_hivis")
    box(root, "roof", -6.62, 6.62, 3.95, 4.2, -1.45, 1.45, "mat_metal")
    # Ladders and grab irons on two opposite corners, brake wheel on the +X end.
    for x, s in ((-6.15, 1), (6.15, -1)):
        for dx in (-.2, .2):
            rod(root, "ladder_rail", (x + dx, 1.25, s * 1.48), (x + dx, 4.05, s * 1.48), .02, "mat_hivis", 4)
        for i in range(7):
            y = 1.45 + i * .4
            rod(root, "rung", (x - .2, y, s * 1.48), (x + .2, y, s * 1.48), .016, "mat_hivis", 3)
    rod(root, "brake_wheel", (hx + .02, 3.3, .6), (hx + .08, 3.3, .6), .3, "mat_metal", 8)
    rod(root, "brake_shaft", (hx + .05, 1.2, .6), (hx + .05, 3.3, .6), .025, "mat_metal", 4)
    if open_doors:
        # Interior: a few crates at the +X end, the rest of the floor free; one ceiling lamp.
        box(root, "crate", 4.35, 5.55, CAR_FLOOR, CAR_FLOOR + 1.0, -1.25, -.15, "mat_wood")
        box(root, "crate", 5.6, 6.4, CAR_FLOOR, CAR_FLOOR + .8, -1.2, -.2, "mat_wood")
        box(root, "crate", 4.5, 5.4, CAR_FLOOR + 1.0, CAR_FLOOR + 1.7, -1.1, -.3, "mat_wood")
        box(root, "pallet", 5.0, 6.3, CAR_FLOOR, CAR_FLOOR + .15, .2, 1.2, "mat_wood")
        box(root, "ceiling_lamp", -.4, .4, 3.88, 3.95, -.12, .12, "mat_light_white")
    merge(root, {"mat_rust": "body", "mat_trim": "underframe", "mat_metal": "roof", "mat_wood": "floor",
                 "mat_hivis": "ladder", "mat_light_white": "ceiling_lamp"})
    return root


def build_port_freight_boxcar():
    return _freight_boxcar("port_freight_boxcar", False)


def build_port_freight_boxcar_open():
    return _freight_boxcar("port_freight_boxcar_open", True)


def _container_20(root, xc, y0, paint):
    """Simplified 20 ft container (6.058 x 2.591 x 2.438) along X, doors at +X. The top is one flat plane at
    y0 + 2.591 made of non-overlapping parts (corner posts, rails, roof), so it is walkable without z-fighting."""
    shell = f"mat_container_{paint}"
    hx, hz, h = ba.PORT_CONTAINERS["20"] / 2, ba.PORT_CONTAINER_W / 2, ba.PORT_CONTAINER_H
    c, r = .16, .1  # corner post size, rail depth
    top = y0 + h
    for s in (-1, 1):
        ba._port_sheet(root, "container_side", shell, "x", xc - hx + .12, 2 * hx - .24, y0 + .1, top - .06,
                       s * (hz - .025), s, pitch=.5)
        for sx in (-1, 1):
            box(root, "corner_post", xc + sx * (hx - c), xc + sx * hx, y0, top, s * (hz - c), s * hz, shell)
            box(root, "end_rail", xc + sx * (hx - c), xc + sx * hx, top - .11, top, -(hz - c), hz - c, shell)
        box(root, "top_rail", xc - (hx - c), xc + hx - c, top - .11, top, s * (hz - r), s * hz, shell)
        box(root, "bottom_rail", xc - (hx - c), xc + hx - c, y0, y0 + .15, s * (hz - r), s * hz, shell)
    box(root, "container_roof", xc - (hx - c), xc + hx - c, top - .04, top, -(hz - r), hz - r, shell)
    box(root, "container_end", xc - hx, xc - hx + .05, y0, top - .11, -(hz - c), hz - c, shell)
    box(root, "container_doors", xc + hx - .07, xc + hx - .02, y0, top - .11, -(hz - c), hz - c, shell)
    box(root, "container_floor", xc - hx + .05, xc + hx - .07, y0, y0 + .12, -(hz - r), hz - r, "mat_cable")
    for z in (-.79, -.26, .26, .79):
        rod(root, "locking_bar", (xc + hx - .01, y0 + .2, z), (xc + hx - .01, top - .2, z), .016, "mat_metal", 4)
        box(root, "cam_keeper", xc + hx - .02, xc + hx, y0 + .25, y0 + .33, z - .04, z + .04, "mat_metal")


def build_port_flatcar():
    """Flatcar 14 m over couplers, wooden deck at 1.2 m, two 20 ft containers (navy, ochre) with roofs at 3.791 m."""
    root = root_for("port_flatcar")
    _freight_running_gear(root)
    box(root, "deck", -6.8, 6.8, 1.0, CAR_FLOOR, -1.38, 1.38, "mat_wood")
    for s in (-1, 1):
        box(root, "deck_edge", -6.8, 6.8, .95, CAR_FLOOR, s * 1.38, s * 1.48, "mat_trim")
        for x in (-6.0, -4.0, -2.0, 0.0, 2.0, 4.0, 6.0):
            box(root, "stake_pocket", x - .1, x + .1, .9, 1.15, s * 1.48, s * 1.5, "mat_trim")
        for x in (-6.75, 6.75):
            box(root, "end_post", x - .05, x + .05, CAR_FLOOR, CAR_FLOOR + .5, s * 1.25 - .05, s * 1.25 + .05, "mat_hivis")
    gap = .2
    hx = ba.PORT_CONTAINERS["20"] / 2
    for xc, paint in ((-(hx + gap / 2), "navy"), (hx + gap / 2, "ochre")):
        _container_20(root, xc, CAR_FLOOR, paint)
    merge(root, {"mat_trim": "underframe", "mat_wood": "deck", "mat_metal": "fittings", "mat_hivis": "end_post",
                 "mat_container_navy": "container_navy", "mat_container_ochre": "container_ochre",
                 "mat_cable": "container_floor"})
    return root


# --------------------------------------------------------------------------- port: warehouse modules

def build_port_warehouse_shell_panel():
    """Wall module 6 x 10 m like the city wall props: inside face (columns) at z = 0, outside (+Z) corrugated
    cladding with crests at z = 0.45. Concrete plinth to 1 m, clerestory window band 7.3-9.0 m, liner and
    girts inside; half columns at x = +-3 so neighbouring modules form full columns."""
    root = root_for("port_warehouse_shell_panel")
    out, liner = .45, .35
    box(root, "plinth", -3, 3, 0, 1.0, 0, out, "mat_concrete")
    for y0, y1 in ((1.0, 7.3), (9.0, 9.8)):
        ba._port_sheet(root, "cladding", "mat_corrugated", "x", -3, 6, y0, y1, out, 1, pitch=.3, depth=.05)
        box(root, "liner", -3, 3, y0, y1, liner - .03, liner, "mat_metal")
    box(root, "flashing", -3, 3, 9.8, 10.0, 0, out + .04, "mat_trim")
    box(root, "sill", -3, 3, 7.3, 7.42, liner - .03, out + .06, "mat_trim")
    box(root, "head", -3, 3, 8.88, 9.0, liner - .03, out + .03, "mat_trim")
    for x in (-3, -1, 1, 3):
        box(root, "mullion", max(-3, x - .05), min(3, x + .05), 7.42, 8.88, liner - .03, out + .02, "mat_trim")
    for xc in (-2, 0, 2):
        box(root, "pane", xc - .95, xc + .95, 7.42, 8.88, out - .06, out - .02, "mat_glass")
    for s in (-1, 1):
        box(root, "column", s * 2.85, s * 3.0, 0, 9.8, 0, liner - .03, "mat_paint")
    for y in (3.5, 6.2):
        box(root, "girt", -2.85, 2.85, y - .1, y + .1, liner - .13, liner - .03, "mat_paint")
    # Outside: vertical seam flashings at the module edges and a wall-pack lamp (warm white).
    for s in (-1, 1):
        box(root, "seam_flashing", s * 2.96, s * 3.0, 1.0, 9.8, out, out + .03, "mat_trim")
    box(root, "wall_lamp", -.25, .25, 4.6, 4.9, out, out + .28, "mat_machine")
    box(root, "wall_light", -.21, .21, 4.57, 4.6, out + .03, out + .25, "mat_light_white")
    merge(root, {"mat_corrugated": "cladding", "mat_concrete": "plinth", "mat_metal": "liner", "mat_trim": "trim",
                 "mat_glass": "window", "mat_paint": "column", "mat_machine": "wall_lamp",
                 "mat_light_white": "wall_light"})
    return root


TRUSS_SPAN, TRUSS_DEPTH, TRUSS_SEAT = 30.0, 2.5, .6


def build_port_warehouse_roof_truss():
    """Flat Pratt roof truss, span 30 m (X). Bearing shoes at x = +-15 from y = 0 (wall top); bottom chord
    0.6 m above, top chord 3.1 m, purlins over z = +-3 (one 6 m bay) up to the roof deck at y = 3.3."""
    root = root_for("port_warehouse_roof_truss")
    half = TRUSS_SPAN / 2
    b0, b1 = TRUSS_SEAT, TRUSS_SEAT + .25
    t1 = TRUSS_SEAT + TRUSS_DEPTH
    t0 = t1 - .25
    for s in (-1, 1):
        box(root, "bearing", s * (half - .4), s * half, 0, b0, -.25, .25, "mat_trim")
    box(root, "bottom_chord", -half, half, b0, b1, -.14, .14, "mat_metal")
    box(root, "top_chord", -half, half, t0, t1, -.16, .16, "mat_metal")
    panels = 12
    step = TRUSS_SPAN / panels
    for i in range(panels + 1):
        x = -half + i * step
        x0, x1 = max(-half, x - .09), min(half, x + .09)
        box(root, "vertical", x0, x1, b1, t0, -.08, .08, "mat_metal")
    for i in range(panels):
        xa, xb = -half + i * step, -half + (i + 1) * step
        # Pratt: diagonals slope down towards mid-span.
        if xb <= 0:
            beam(root, "diagonal", (xa + .1, t0, 0), (xb - .1, b1, 0), .12, .16, "mat_metal")
        else:
            beam(root, "diagonal", (xa + .1, b1, 0), (xb - .1, t0, 0), .12, .16, "mat_metal")
    for i in range(panels + 1):
        x = -half + .1 + (TRUSS_SPAN - .2) * i / panels
        box(root, "purlin", x - .08, x + .08, t1, t1 + .2, -3.0, 3.0, "mat_trim")
    box(root, "bracing_strut", -.08, .08, b0, b1, -3.0, 3.0, "mat_trim")
    # Two high-bay lamps hanging from the bottom chord (warm white).
    for x in (-7.5, 7.5):
        rod(root, "lamp_rod", (x, b0, 0), (x, .35, 0), .02, "mat_metal", 4)
        rod(root, "lamp_housing", (x, .35, 0), (x, .12, 0), .22, "mat_machine", 8, .36)
        rod(root, "lamp_lens", (x, .12, 0), (x, .1, 0), .34, "mat_light_white", 8)
    merge(root, {"mat_metal": "truss", "mat_trim": "purlin", "mat_machine": "lamp_housing",
                 "mat_light_white": "lamp_lens"})
    return root


# --------------------------------------------------------------------------- rail: track, buffer, mast

TRACK_LEN = 12.0
BALLAST_TOP = .30
SLEEPER_TOP = .42
WEB_TOP = .80
GUIDE_TOP = 1.0  # wierzch prowadnicy
CAR_ON_TRACK = .65  # y modelu wagonu stojącego na torze


def _ballast(root, x0, x1):
    prism(root, "ballast", [(-2.3, 0), (2.3, 0), (1.7, BALLAST_TOP), (-1.7, BALLAST_TOP)], "x", x0, x1,
          "mat_rail_ballast")


def _sleepers(root, xs):
    for x in xs:
        box(root, "sleeper", x - .15, x + .15, .27, SLEEPER_TOP, -1.3, 1.3, "mat_rail_sleeper_concrete")
        box(root, "base_plate", x - .2, x + .2, SLEEPER_TOP, SLEEPER_TOP + .03, -.42, .42, "mat_trim")


def _guide_beam(root, x0, x1, base=SLEEPER_TOP, lift=0.0):
    """Maglev T-beam: concrete web and flange (top at GUIDE_TOP + lift), steel guide strips on the flange
    sides and stator packs under it."""
    web, top = WEB_TOP + lift, GUIDE_TOP + lift
    box(root, "guide_web", x0, x1, base, web, -.3, .3, "mat_rail_sleeper_concrete")
    box(root, "guide_flange", x0, x1, web, top, -.8, .8, "mat_rail_sleeper_concrete")
    for s in (-1, 1):
        box(root, "guide_strip", x0, x1, web + .03, top - .03, s * .8, s * .83, "mat_metal")
        box(root, "stator", x0, x1, web - .09, web, s * .32, s * .78, "mat_metal")


def build_rail_track_straight():
    root = root_for("rail_track_straight")
    h = TRACK_LEN / 2
    _ballast(root, -h, h)
    _sleepers(root, [-h + .375 + i * .75 for i in range(16)])
    _guide_beam(root, -h, h)
    for s in (-1, 1):
        box(root, "cable_trough", -h, h, BALLAST_TOP - .05, BALLAST_TOP + .12, s * 1.95, s * 2.2,
            "mat_rail_sleeper_concrete")
        box(root, "trough_lid", -h, h, BALLAST_TOP + .12, BALLAST_TOP + .14, s * 1.97, s * 2.18, "mat_trim")
    merge(root, {"mat_rail_ballast": "ballast", "mat_rail_sleeper_concrete": "sleeper",
                 "mat_metal": "guide_strip", "mat_trim": "fastening"})
    return root


def build_rail_track_buffer():
    """Buffer stop module 4 m: track side at -X joins a track end; steel frame and buffers at +X."""
    root = root_for("rail_track_buffer")
    _ballast(root, -2, 2)
    _sleepers(root, [-1.625, -.875, -.125])
    _guide_beam(root, -2, .4)
    box(root, "end_block", .4, 2, BALLAST_TOP, 1.25, -1.6, 1.6, "mat_rail_sleeper_concrete", .03)
    # Steel frame: two raked struts per side carrying the buffer beam at car-end height.
    for s in (-1, 1):
        box(root, "frame_post", .5, .75, 1.25, 2.55, s * 1.25, s * 1.5, "mat_hivis")
        beam(root, "frame_strut", (1.85, 1.25, s * 1.37), (.7, 2.4, s * 1.37), .22, .22, "mat_hivis")
        rod(root, "buffer_body", (.5, 2.0, s * .9), (-.1, 2.0, s * .9), .17, "mat_machine", 8)
        rod(root, "buffer_rod", (-.1, 2.0, s * .9), (-.32, 2.0, s * .9), .09, "mat_metal", 6)
        rod(root, "buffer_pad", (-.32, 2.0, s * .9), (-.4, 2.0, s * .9), .26, "mat_rubber", 8)
    box(root, "buffer_beam", .4, .75, 1.6, 2.4, -1.5, 1.5, "mat_hivis")
    box(root, "beam_hazard", .37, .4, 1.65, 2.35, -1.45, 1.45, "mat_hazard")
    # Warning board on a post with amber lamps; no text.
    box(root, "sign_post", .55, .67, 2.4, 3.0, -.06, .06, "mat_metal")
    box(root, "warning_board", .45, .55, 2.45, 3.0, -.6, .6, "mat_hazard")
    for s in (-1, 1):
        rod(root, "warning_lamp", (.45, 2.72, s * .38), (.37, 2.72, s * .38), .11, "mat_neon_amber", 8)
    merge(root, {"mat_rail_ballast": "ballast", "mat_rail_sleeper_concrete": "end_block",
                 "mat_hivis": "frame", "mat_hazard": "hazard", "mat_machine": "buffer",
                 "mat_rubber": "buffer_pad", "mat_neon_amber": "warning_lamp", "mat_metal": "steelwork",
                 "mat_trim": "fastening"})
    return root


def build_rail_catenary_mast():
    """Light mast (8 m) on the -Z side of a track, cantilever over the track towards +Z. Origin on the mast axis."""
    root = root_for("rail_catenary_mast")
    box(root, "foundation", -.35, .35, 0, .35, -.35, .35, "mat_concrete")
    box(root, "base_plate", -.22, .22, .35, .39, -.22, .22, "mat_trim")
    cbox(root, "mast", (.22, 7.61, .22), (0, .39 + 7.61 / 2, 0), "mat_metal", taper=(.7, .7))
    box(root, "mast_cap", -.1, .1, 8.0 - .04, 8.0, -.1, .1, "mat_trim")
    # Cantilever: tube with diagonal stay, insulators at the root, registration arm and contact wire clamp.
    rod(root, "cantilever", (0, 6.9, .1), (0, 6.6, 3.6), .045, "mat_metal", 4)
    rod(root, "stay", (0, 7.75, .1), (0, 6.68, 2.9), .035, "mat_metal", 4)
    for y, z in ((6.88, .32), (7.67, .3)):
        rod(root, "insulator", (0, y, z - .15), (0, y, z + .15), .075, "mat_trim", 6)
    rod(root, "dropper", (0, 6.62, 3.3), (0, 5.6, 3.3), .02, "mat_metal", 4)
    rod(root, "registration_arm", (0, 5.62, 3.3), (0, 5.5, 3.0), .025, "mat_metal", 4)
    box(root, "wire_clamp", -.06, .06, 5.45, 5.55, 2.94, 3.06, "mat_trim")
    # Yard lamp on the mast: warm white, facing the track.
    box(root, "lamp_arm", -.04, .04, 7.4, 7.48, .1, .62, "mat_metal")
    box(root, "lamp_housing", -.16, .16, 7.32, 7.5, .5, .86, "mat_machine")
    box(root, "lamp_lens", -.13, .13, 7.3, 7.32, .53, .83, "mat_light_white")
    merge(root, {"mat_metal": "mast", "mat_concrete": "foundation", "mat_trim": "insulator",
                 "mat_machine": "lamp_housing", "mat_light_white": "lamp_lens"})
    return root


# --------------------------------------------------------------------------- rail: maglev cars

# Body cross-section (z, y): skids below 0.5 m, flat roof at 4.1 m for |z| <= 1.55.
CAR_PROFILE = [(-1.80, .50), (1.80, .50), (1.94, .90), (1.94, 3.55), (1.82, 3.92), (1.55, 4.10),
               (-1.55, 4.10), (-1.82, 3.92), (-1.94, 3.55), (-1.94, .90)]
CAR_FLOOR_Y, CAR_ROOF_Y, CAR_CEILING_Y = 1.1, 4.1, 3.4
DOOR_W, DOOR_TOP = 1.5, 3.3
MAGLEV_NODES = {"mat_maglev_body_panel": "body", "mat_trim": "underbody", "mat_glass": "windows",
                "mat_neon_blue": "led_stripe", "mat_neon_amber": "door_light", "mat_metal": "skids",
                "mat_rubber": "gangway_bellows", "mat_fabric": "seats", "mat_light_white": "lights",
                "mat_plastic": "interior"}


def _skids(root, centers, length=4.4):
    """Levitation skids wrapping the guide-beam flange: outer plates and lips under the flange (y 0..0.5)."""
    for xc in centers:
        for s in (-1, 1):
            box(root, "skid", xc - length / 2, xc + length / 2, 0, .5, s * .85, s * 1.05, "mat_metal")
            box(root, "skid_lip", xc - length / 2, xc + length / 2, 0, .1, s * .55, s * .85, "mat_metal")
        box(root, "magnet_frame", xc - length / 2 + .2, xc + length / 2 - .2, .42, .5, -1.05, 1.05, "mat_trim")


def _free_spans(x0, x1, doors, margin=.3):
    spans, start = [], x0
    for d0, d1 in sorted(doors):
        spans.append((start, d0 - margin))
        start = d1 + margin
    spans.append((start, x1))
    return [(a, b) for a, b in spans if b - a > .5]


def _maglev_side(root, x0, x1, doors, open_doors=False, stripe_x1=None):
    """Windows, doors, door lights and the blue LED stripe on both sides between x0 and x1."""
    for s in (-1, 1):
        face, zf = ("+z" if s > 0 else "-z"), s * 1.946
        for a, b in _free_spans(x0 + .3, x1 - .3, doors):
            n = max(1, int((b - a + .35) / 2.15))
            w = (b - a - .35 * (n - 1)) / n
            for i in range(n):
                quad(root, "window", (a + w / 2 + i * (w + .35), 2.6, zf), w, 1.05, face, "mat_glass")
        for d0, d1 in doors:
            if open_doors:
                slide = (d1 + .05, d1 + .05 + DOOR_W) if d0 > 0 else (d0 - .05 - DOOR_W, d0 - .05)
                box(root, "door_leaf", slide[0], slide[1], CAR_FLOOR_Y, DOOR_TOP, s * 1.95, s * 2.0, "mat_trim")
            else:
                quad(root, "door_leaf", ((d0 + d1) / 2, (CAR_FLOOR_Y + DOOR_TOP) / 2, s * 1.947), d1 - d0,
                     DOOR_TOP - CAR_FLOOR_Y, face, "mat_trim")
                for dx in (-.36, .36):
                    quad(root, "door_window", ((d0 + d1) / 2 + dx, 2.65, s * 1.949), .5, .9, face, "mat_glass")
            quad(root, "door_light", ((d0 + d1) / 2, DOOR_TOP + .12, s * 1.947), .6, .07, face, "mat_neon_amber")
        for a, b in _free_spans(x0, stripe_x1 if stripe_x1 is not None else x1, doors, 0.0):
            box(root, "led_stripe", a, b, 1.55, 1.62, s * 1.94, s * 2.0, "mat_neon_blue")


def _bellows(root, x_end, outward):
    box(root, "bellows", x_end, x_end + outward * .3, 1.1, 3.7, -.95, .95, "mat_rubber")
    box(root, "bellows_frame", x_end + outward * .26, x_end + outward * .3, 1.0, 3.8, -1.05, 1.05, "mat_trim")


def _maglev_car(name, open_doors):
    """Passenger car 25 m (x -12.5..12.5) x 4.0 m x 4.1 m: skids 0..0.5, body 0.5..4.1, floor 1.1, roof 4.1.
    Doors 1.5 m wide at x = +-6.25 on both sides; the open variant has the leaves slid out and an interior."""
    root = root_for(name)
    hx = 12.2
    doors = ((-7.0, -5.5), (5.5, 7.0))
    trim = {0: "mat_trim", 1: "mat_trim", 9: "mat_trim"}
    if not open_doors:
        prism(root, "body", CAR_PROFILE, "x", -hx, hx, "mat_maglev_body_panel", edge_mats=trim)
    else:
        floor = [(-1.80, .50), (1.80, .50), (1.94, .90), (1.94, CAR_FLOOR_Y), (-1.94, CAR_FLOOR_Y), (-1.94, .90)]
        prism(root, "body", floor, "x", -hx, hx, "mat_maglev_body_panel",
              edge_mats={0: "mat_trim", 1: "mat_trim", 3: "mat_rubber", 5: "mat_trim"})
        roof = [(1.94, CAR_CEILING_Y), (1.94, 3.55), (1.82, 3.92), (1.55, 4.10), (-1.55, 4.10), (-1.82, 3.92),
                (-1.94, 3.55), (-1.94, CAR_CEILING_Y)]
        prism(root, "body", roof, "x", -hx, hx, "mat_maglev_body_panel", edge_mats={7: "mat_plastic"})
        for s in (-1, 1):
            for a, b in _free_spans(-hx, hx, doors, 0.0):
                prism(root, "body", [(s * 1.82, CAR_FLOOR_Y), (s * 1.94, CAR_FLOOR_Y), (s * 1.94, CAR_CEILING_Y),
                                     (s * 1.82, CAR_CEILING_Y)], "x", a, b, "mat_maglev_body_panel",
                      edge_mats={3: "mat_plastic"})
            for d0, d1 in doors:
                box(root, "lintel", d0, d1, DOOR_TOP, CAR_CEILING_Y, s * 1.82, s * 1.94, "mat_maglev_body_panel")
            box(root, "end_wall", s * (hx - .12), s * hx, CAR_FLOOR_Y, CAR_CEILING_Y, -1.82, 1.82, "mat_plastic")
            # Interior: longitudinal seats between the doors, light strips, grab rails, inner window panes.
            for a, b in _free_spans(-hx + .4, hx - .4, doors, .3):
                box(root, "seat", a, b, CAR_FLOOR_Y, CAR_FLOOR_Y + .45, s * 1.35, s * 1.82, "mat_fabric")
                box(root, "seat_back", a, b, CAR_FLOOR_Y + .45, CAR_FLOOR_Y + 1.1, s * 1.72, s * 1.82, "mat_fabric")
                n = max(1, int((b - a + .35) / 2.15))
                w = (b - a - .35 * (n - 1)) / n
                for i in range(n):
                    quad(root, "window", (a + w / 2 + i * (w + .35), 2.75, s * 1.815), w, .9,
                         "-z" if s > 0 else "+z", "mat_glass")
            box(root, "ceiling_light", -11.5, 11.5, CAR_CEILING_Y - .05, CAR_CEILING_Y, s * .75, s * .9,
                "mat_light_white")
            rod(root, "grab_rail", (-11.5, 3.05, s * 1.0), (11.5, 3.05, s * 1.0), .02, "mat_metal", 4)
    for s in (-1, 1):
        _bellows(root, s * hx, s)
    _maglev_side(root, -hx, hx, doors, open_doors)
    _skids(root, (-9.5, -3.5, 3.5, 9.5))
    merge(root, MAGLEV_NODES)
    return root


def build_rail_maglev_car():
    return _maglev_car("rail_maglev_car", False)


def build_rail_maglev_car_open():
    return _maglev_car("rail_maglev_car_open", True)


def build_rail_maglev_head():
    """Head car 27 m (x -13.5..13.5): passenger body to x = 5.5, streamlined nose to +13.5 with windscreen,
    head and marker lights. Same heights as the passenger car (floor 1.1, flat roof 4.1 up to x = 5.5)."""
    root = root_for("rail_maglev_head")
    x_rear, x_nose = -13.2, 5.5
    prism(root, "body", CAR_PROFILE, "x", x_rear, x_nose, "mat_maglev_body_panel",
          edge_mats={0: "mat_trim", 1: "mat_trim", 9: "mat_trim"})
    stations = ((5.5, 1.0, 1.0), (8.0, .98, .93), (10.2, .9, .75), (12.0, .72, .5), (13.1, .45, .27),
                (13.5, .18, .12))
    rings = [[(x, .5 + (y - .5) * sy, z * sz) for z, y in CAR_PROFILE] for x, sz, sy in stations]

    def nose_mat(ring, edge):
        if ring == 1 and 3 <= edge <= 7:
            return "mat_glass"
        if edge in (0, 1, 9):
            return "mat_trim"
        return None

    loft(root, "nose", rings, "mat_maglev_body_panel", face_mat=nose_mat)
    _bellows(root, x_rear, -1)
    doors = ((-7.75, -6.25), (.75, 2.25))
    _maglev_side(root, x_rear, x_nose, doors, False, stripe_x1=9.0)
    for s in (-1, 1):
        box(root, "headlight", 12.85, 13.25, .85, 1.05, s * .35, s * .7, "mat_light_white")
        box(root, "marker_light", 12.7, 13.05, 1.55, 1.68, s * .12, s * .32, "mat_neon_amber")
    _skids(root, (-10.0, -4.0, 2.0, 8.0))
    merge(root, MAGLEV_NODES)
    return root


# --------------------------------------------------------------------------- rail: gantry, tower, canopy, turntable

def build_rail_signal_gantry():
    """Signal gantry over four tracks: span along Z (legs at z = +-11), tracks along X under it at
    z = -7.5 / -2.5 / 2.5 / 7.5; truss 6.2-7.0 m; double-sided signal heads (green / amber / warm white)
    hang 2.5 m to the -Z side of each track, bottoms at 4.95 m."""
    root = root_for("rail_signal_gantry")
    for s in (-1, 1):
        z = s * 11.0
        box(root, "footing", -.7, .7, 0, .4, z - .6, z + .6, "mat_concrete")
        for x in (-.45, .45):
            box(root, "leg_post", x - .11, x + .11, .4, 7.0, z - .11, z + .11, "mat_metal")
        for i in range(4):
            y = .7 + i * 1.35
            xa, xb = (-.45, .45) if i % 2 == 0 else (.45, -.45)
            rod(root, "leg_brace", (xa, y, z), (xb, y + 1.35, z), .04, "mat_metal", 4)
        box(root, "leg_plate", -.6, .6, .4, .5, z - .25, z + .25, "mat_trim")
    for x in (-.45, .45):
        box(root, "chord", x - .08, x + .08, 6.2, 6.36, -11.1, 11.1, "mat_metal")
        box(root, "chord", x - .08, x + .08, 6.84, 7.0, -11.1, 11.1, "mat_metal")
        n = 12
        for i in range(n):
            za, zb = -11.0 + 22.0 * i / n, -11.0 + 22.0 * (i + 1) / n
            ya, yb = (6.36, 6.84) if i % 2 == 0 else (6.84, 6.36)
            rod(root, "truss_diagonal", (x, ya, za), (x, yb, zb), .035, "mat_metal", 4)
    for i in range(7):
        z = -11.0 + i * 22.0 / 6
        box(root, "tie", -.45, .45, 6.84, 7.0, z - .05, z + .05, "mat_trim")
        box(root, "tie", -.45, .45, 6.2, 6.36, z - .05, z + .05, "mat_trim")
    lens_sets = (("mat_neon_green", "mat_cable", "mat_cable"), ("mat_cable", "mat_neon_amber", "mat_cable"),
                 ("mat_light_white", "mat_cable", "mat_neon_amber"), ("mat_neon_green", "mat_cable", "mat_light_white"))
    for (z, lenses) in zip((-10.0, -5.0, 0.0, 5.0), lens_sets):
        rod(root, "head_mount", (0, 6.2, z), (0, 5.95, z), .05, "mat_metal", 4)
        box(root, "signal_head", -.22, .22, 4.95, 5.95, z - .24, z + .24, "mat_trim")
        for sx in (-1, 1):
            for y, mat in zip((5.7, 5.45, 5.2), lenses):
                quad(root, "lens", (sx * .221, y, z), .19, .19, "+x" if sx > 0 else "-x", mat)
                box(root, "hood", sx * .22, sx * .36, y + .1, y + .13, z - .12, z + .12, "mat_trim")
    merge(root, {"mat_metal": "truss", "mat_concrete": "footing", "mat_trim": "signal_head",
                 "mat_neon_green": "lamp_green", "mat_neon_amber": "lamp_amber", "mat_light_white": "lamp_white",
                 "mat_cable": "lens_dark"})
    return root


TOWER_HALF, TOWER_GAL, TOWER_GAL_Y = 3.0, 4.2, 10.0
TOWER_LANES = ((-6.4, -5.3), (-5.3, -4.2))  # stair lanes A (outer) and B (inner) on the -X side
TOWER_FLIGHT_Z = 1.35  # flights between z = -1.35 and 1.35, landings 1.1 m beyond


def build_rail_control_tower():
    """Signal box: concrete shaft 6 x 6 m to 10 m, glazed control cab 10-13.2 m with warm light, roof to 13.6 m.
    Gallery around the cab with its floor at 10.0 m (ring 1.2 m wide, outer edge |x|, |z| = 4.2). Outside
    switchback stairs on the -X side: 5 flights x 10 risers of 0.2 m, tread 0.3 m, width 1.1 m, landings
    1.1 m deep at z = +-(1.35..2.45). Origin on the tower axis."""
    root = root_for("rail_control_tower")
    h, g, gy = TOWER_HALF, TOWER_GAL, TOWER_GAL_Y
    box(root, "shaft", -h, h, 0, gy, -h, h, "mat_concrete")
    box(root, "plinth", -h - .05, h + .05, 0, .4, -h - .05, h + .05, "mat_trim")
    for y in (2.2, 6.2):
        for face, c in (("+z", (0, y, h + .01)), ("-z", (0, y, -h - .01)), ("+x", (h + .01, y, 0))):
            quad(root, "shaft_window", c, 1.2, 1.0, face, "mat_glass")
    quad(root, "door", (1.2, 1.1, h + .01), 1.1, 2.2, "+z", "mat_trim")
    box(root, "door_canopy", .4, 2.0, 2.3, 2.42, h, h + .7, "mat_trim")
    box(root, "door_lamp", 1.05, 1.35, 2.5, 2.62, h, h + .12, "mat_neon_amber")
    box(root, "cable_duct", h, h + .25, .4, gy - .3, -2.2, -1.8, "mat_metal")
    # Gallery ring (top 10.0) on brackets, railing with a gap where the stairs arrive (-X side, z 1.35..2.45).
    box(root, "gallery", -g, g, gy - .25, gy, h, g, "mat_steel_grating")
    box(root, "gallery", -g, g, gy - .25, gy, -g, -h, "mat_steel_grating")
    for s in (-1, 1):
        box(root, "gallery", s * h, s * g, gy - .25, gy, -h, h, "mat_steel_grating")
    for sx in (-1, 1):
        for sz in (-1, 1):
            beam(root, "gallery_bracket", (sx * h, gy - 1.6, sz * h), (sx * (g - .15), gy - .25, sz * (g - .15)),
                 .18, .18, "mat_metal")
    railing_x(root, -g, g, gy, g - .04, 1.1, 1.4, "mat_hivis")
    railing_x(root, -g, g, gy, -g + .04, 1.1, 1.4, "mat_hivis")
    railing_z(root, -g, g, gy, g - .04, 1.1, 1.4, "mat_hivis")
    z0, z1 = TOWER_FLIGHT_Z, TOWER_FLIGHT_Z + 1.1
    railing_z(root, -g, z0, gy, -g + .04, 1.1, 1.4, "mat_hivis")
    railing_z(root, z1, g, gy, -g + .04, 1.1, 1.4, "mat_hivis")
    # Glazed cab with lit panes, corner posts and mullions, concrete bands and a roof with a beacon.
    box(root, "cab_core", -h + .05, h - .05, gy, 12.8, -h + .05, h - .05, "mat_trim")
    box(root, "cab_band", -h, h, gy, gy + .4, -h, h, "mat_concrete")
    box(root, "cab_band", -h, h, 12.8, 13.2, -h, h, "mat_concrete")
    for face, axis in (("+z", "x"), ("-z", "x"), ("+x", "z"), ("-x", "z")):
        sign = 1 if face[0] == "+" else -1
        for u in (-1.95, 0.0, 1.95):
            c = (u, 11.6, sign * (h - .04)) if axis == "x" else (sign * (h - .04), 11.6, u)
            quad(root, "cab_glass", c, 1.8, 2.3, face, "mat_light_white")
    for sx in (-1, 1):
        for sz in (-1, 1):
            box(root, "cab_post", sx * (h - .14), sx * h, gy + .4, 12.8, sz * (h - .14), sz * h, "mat_trim")
        for u in (-.975, .975):
            box(root, "mullion", u - .05, u + .05, gy + .4, 12.8, sx * (h - .06), sx * h, "mat_trim")
            box(root, "mullion", sx * (h - .06), sx * h, gy + .4, 12.8, u - .05, u + .05, "mat_trim")
    box(root, "roof", -3.6, 3.6, 13.2, 13.6, -3.6, 3.6, "mat_trim")
    rod(root, "antenna", (1.8, 13.6, -1.8), (1.8, 13.86, -1.8), .04, "mat_metal", 4)
    box(root, "beacon", 1.7, 1.9, 13.86, 14.0, -1.9, -1.7, "mat_neon_amber")
    # Switchback stairs: flights alternate lanes A (+Z) and B (-Z); landings span both lanes.
    (a0, a1), (b0, b1) = TOWER_LANES
    for k in range(5):
        y0 = 2.0 * k
        lane, direction, start = ((a0, a1), 1, -z0) if k % 2 == 0 else ((b0, b1), -1, z0)
        stair_flight(root, "stairs", start, y0, lane[0], lane[1], 10, .2, .3, direction, "mat_steel_grating",
                     axis="z")
        zl = (z0, z1) if direction > 0 else (-z1, -z0)
        box(root, "landing", a0, b1, y0 + 1.8, y0 + 2.0, zl[0], zl[1], "mat_steel_grating")
        edge = zl[1] - .03 if direction > 0 else zl[0] + .03
        railing_x(root, a0, b1, y0 + 2.0, edge, 1.0, 1.1, "mat_hivis")
        rail_x = a0 + .04 if direction > 0 else b1 - .04
        sloped_rail(root, (rail_x, y0 + .2, start), (rail_x, y0 + 2.0, -start), 1.0, "mat_hivis", 3)
    for x, z, top in ((a0 + .05, -z1 + .05, 9.8), (a0 + .05, z1 - .05, 9.8), (b1 - .05, -z1 + .05, 7.8),
                      (b1 - .05, z1 - .05, 9.8)):
        box(root, "stair_post", x - .05, x + .05, 0, top, z - .05, z + .05, "mat_metal")
    merge(root, {"mat_concrete": "shaft", "mat_trim": "cab_frame", "mat_light_white": "cab_glass",
                 "mat_glass": "shaft_window", "mat_steel_grating": "gallery", "mat_hivis": "railing",
                 "mat_metal": "steelwork", "mat_neon_amber": "beacon"})
    return root


def build_rail_platform_canopy():
    """Platform canopy module 12 m (x -6..6, tiles every 12 m): columns at x = +-3 on the centre line,
    butterfly roof 6 m deep (eaves 3.97 m, gutter 3.55 m), two back-to-back benches and a blank double-sided
    board. Stands on the platform top (y = 0 of the model)."""
    root = root_for("rail_platform_canopy")
    for x in (-3.0, 3.0):
        box(root, "column", x - .14, x + .14, 0, 3.5, -.14, .14, "mat_metal")
        box(root, "base_plate", x - .25, x + .25, 0, .04, -.25, .25, "mat_trim")
        for s in (-1, 1):
            beam(root, "cantilever", (x, 3.42, 0), (x, 3.8, s * 2.95), .2, .24, "mat_metal")
    for s in (-1, 1):
        prof = [(.12, 3.55), (3.0, 3.85), (3.0, 3.97), (.12, 3.67)]
        prism(root, "roof", [(s * z, y) for z, y in prof], "x", -6.0, 6.0, "mat_corrugated")
        box(root, "fascia", -6.0, 6.0, 3.72, 3.99, s * 3.0, s * 3.06, "mat_trim")
        box(root, "led_line", -6.0, 6.0, 3.8, 3.84, s * 3.06, s * 3.08, "mat_neon_blue")
        box(root, "strip_light", -5.6, 5.6, 3.63, 3.68, s * 1.42, s * 1.58, "mat_light_white")
    box(root, "gutter", -6.0, 6.0, 3.45, 3.6, -.12, .12, "mat_trim")
    for s in (-1, 1):
        box(root, "bench_seat", -1.2, 1.2, .42, .48, s * .35, s * .8, "mat_wood")
        box(root, "bench_back", -1.2, 1.2, .5, .95, s * .3, s * .36, "mat_wood")
        for x in (-1.0, 1.0):
            box(root, "bench_leg", x - .03, x + .03, 0, .5, s * .3, s * .75, "mat_metal")
    box(root, "board", -1.1, 1.1, 2.55, 3.15, -.08, .08, "mat_trim")
    for s in (-1, 1):
        face = "+z" if s > 0 else "-z"
        quad(root, "board_screen", (0, 2.9, s * .081), 2.0, .42, face, "mat_glass")
        quad(root, "board_led", (0, 2.63, s * .081), 2.0, .05, face, "mat_neon_amber")
    for x in (-.9, .9):
        rod(root, "board_hanger", (x, 3.15, 0), (x, 3.45, 0), .02, "mat_metal", 4)
    rod(root, "litter_bin", (3.55, 0, .45), (3.55, .85, .45), .22, "mat_metal", 8)
    box(root, "bin_lid", 3.33, 3.77, .85, .9, .23, .67, "mat_trim")
    box(root, "help_point", -3.75, -3.45, 0, 1.4, -.15, .15, "mat_machine")
    quad(root, "help_light", (-3.6, 1.25, .151), .16, .08, "+z", "mat_neon_green")
    merge(root, {"mat_metal": "column", "mat_trim": "trim", "mat_corrugated": "roof", "mat_neon_blue": "led_line",
                 "mat_light_white": "strip_light", "mat_wood": "bench", "mat_glass": "board_screen",
                 "mat_neon_amber": "board_led", "mat_machine": "help_point", "mat_neon_green": "help_light"})
    return root


TT_PIT_R, TT_HALF, TT_RIM_Y = 11.0, 12.0, 1.5  # pit radius, half of the square outline, rim / ground level


def _turntable_rim(root, n=32):
    """Concrete ring between the circular pit (r = 11) and the square outline 24 x 24 m; flat top at 1.5 m
    with a flush hazard band along the pit edge."""
    bm = bmesh.new()
    mats = ["mat_concrete", "mat_hazard"]
    pts = []
    for k in range(n):
        th = k * math.tau / n
        c, s = math.cos(th), math.sin(th)
        r_sq = TT_HALF / max(abs(c), abs(s))
        pts.append([(r * c, r * s) for r in (TT_PIT_R, TT_PIT_R + .35, r_sq)])
    V = ba._city_point
    top = [[bm.verts.new(V((x, TT_RIM_Y, z))) for x, z in p] for p in pts]
    bot = [[bm.verts.new(V((x, 0.0, z))) for x, z in (p[0], p[2])] for p in pts]
    for k in range(n):
        j = (k + 1) % n
        bm.faces.new((top[k][0], top[j][0], top[j][1], top[k][1])).material_index = 1
        bm.faces.new((top[k][1], top[j][1], top[j][2], top[k][2]))
        bm.faces.new((bot[k][0], bot[j][0], top[j][0], top[k][0]))
        bm.faces.new((bot[k][1], top[k][2], top[j][2], bot[j][1]))
        bm.faces.new((bot[k][0], bot[k][1], bot[j][1], bot[j][0]))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    obj = _object(root, "rim", bm, mats)
    floor = bmesh.new()
    face = floor.faces.new([floor.verts.new(V((p[0][0], 0.0, p[0][1]))) for p in pts])
    floor.normal_update()
    if face.normal.z < 0:
        face.normal_flip()
    ba.mesh_object("pit_floor", floor, "mat_concrete", parent=root)
    return obj


def build_rail_turntable():
    """Turntable: square 24 x 24 m block, circular pit r = 11 m (22 m) and 1.5 m deep. Model y = 0 is the
    flat pit floor, the rim and the bridge deck are flat at y = 1.5 (place the model at y = -1.5 so they
    are flush with the ground). The bridge runs along X with a maglev guide beam whose top is 1.0 m above
    the deck (as on rail_track_straight); operator cabin outboard on +Z."""
    root = root_for("rail_turntable")
    _turntable_rim(root)
    ba._city_ring(root, "runway_rail", (0, .1, 0), 10.4, "y", .1, "mat_metal", 32)
    rod(root, "pivot_pier", (0, 0, 0), (0, .3, 0), 1.2, "mat_concrete", 10)
    rod(root, "king_pin", (0, .3, 0), (0, .55, 0), .5, "mat_metal", 8)
    # Bridge: flat deck (top 1.5) with flush hazard edges, fish-belly girders, end carriages on the runway rail.
    half = 10.8
    grid_slab(root, "deck", [-half, half], [-2.25, -2.05, 2.05, 2.25], 1.3, TT_RIM_Y,
              lambda x, z: "mat_hazard" if abs(z) > 2.05 else "mat_steel_grating", "mat_metal")
    for s in (-1, 1):
        prism(root, "girder", [(-half, 1.3), (half, 1.3), (half, .95), (0, .55), (-half, .95)], "z",
              s * 1.4, s * 1.8, "mat_metal")
        box(root, "end_carriage", s * 10.0, s * half, .55, 1.3, -2.1, 2.1, "mat_machine")
        for z in (-1.3, 1.3):
            rod(root, "carriage_wheel", (s * 10.4 - .15, .45, z), (s * 10.4 + .15, .45, z), .25, "mat_metal", 8)
    _guide_beam(root, -half, half, base=TT_RIM_Y, lift=TT_RIM_Y)
    # Operator cabin outboard on +Z with windows and an amber beacon.
    box(root, "cabin_bracket", 6.6, 8.6, 1.1, TT_RIM_Y, 2.25, 4.1, "mat_metal")
    box(root, "cabin", 6.5, 8.7, TT_RIM_Y, 4.0, 2.25, 4.15, "mat_lacquer")
    box(root, "cabin_roof", 6.4, 8.8, 4.0, 4.12, 2.2, 4.25, "mat_trim")
    for face, c, w in (("+x", (8.71, 3.0, 3.2), 1.5), ("-x", (6.49, 3.0, 3.2), 1.5), ("+z", (7.6, 3.0, 4.16), 1.8)):
        quad(root, "cabin_window", c, w, 1.0, face, "mat_glass")
    quad(root, "cabin_door", (7.0, 2.55, 2.249), .8, 2.0, "-z", "mat_trim")
    box(root, "cabin_beacon", 7.5, 7.7, 4.12, 4.32, 3.1, 3.3, "mat_neon_amber")
    # Ladder into the pit on the -X wall and amber lamps on the rim corners.
    for dz in (-.22, .22):
        rod(root, "ladder_rail", (-10.85, 0, dz), (-10.85, TT_RIM_Y + .9, dz), .025, "mat_metal", 4)
    for i in range(4):
        y = .3 + i * .35
        rod(root, "rung", (-10.85, y, -.22), (-10.85, y, .22), .02, "mat_metal", 3)
    for sx in (-1, 1):
        for sz in (-1, 1):
            box(root, "rim_lamp", sx * 11.6 - .12, sx * 11.6 + .12, TT_RIM_Y, TT_RIM_Y + .22, sz * 11.6 - .12,
                sz * 11.6 + .12, "mat_neon_amber")
    merge(root, {"mat_concrete": "rim", "mat_metal": "bridge", "mat_hazard": "hazard", "mat_machine": "carriage",
                 "mat_rail_sleeper_concrete": "guide_beam", "mat_lacquer": "cabin", "mat_trim": "trim",
                 "mat_glass": "cabin_window", "mat_neon_amber": "amber_light", "mat_steel_grating": "deck"})
    return root


# --------------------------------------------------------------------------- rail: snow drifts

def _drift(root, length, width, height, bumps, outline, rows=7, cols=9, skew=0.0):
    """Low faceted heightfield mound; edges taper to y = 0. `outline(u)` scales the half-width along the length."""
    bm = bmesh.new()
    grid = []
    for i in range(cols):
        u = -1 + 2 * i / (cols - 1)
        half = width / 2 * outline(u) * (1 + .1 * math.sin(5.3 * u + 1.7) + .06 * math.sin(11.1 * u + .4))
        row = []
        for j in range(rows):
            v = -1 + 2 * j / (rows - 1)
            x, z = u * length / 2, v * half + skew * u * u
            if i in (0, cols - 1) or j in (0, rows - 1):
                y = 0.0
            else:
                y = 0.0
                for bx, bz, bh, bs in bumps:
                    y += bh * math.exp(-((u - bx) ** 2 + (v - bz) ** 2) / bs)
                y *= 1 + .14 * math.sin(7.0 * u + 3.0 * v + 1.3)
                edge = min(1 - abs(u), 1 - abs(v))
                y *= min(1.0, edge * 2.4)
                y = min(y, height)
            row.append(bm.verts.new(ba._city_point((x, y, z))))
        grid.append(row)
    for i in range(cols - 1):
        for j in range(rows - 1):
            bm.faces.new((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    for face in bm.faces:
        if face.normal.z < 0:
            face.normal_flip()
    obj = ba.mesh_object("snow", bm, "mat_snow", parent=root)
    return obj


def build_rail_snow_drift():
    """Round mound ~3 × 2.4 m, crest 0.45 m."""
    root = root_for("rail_snow_drift")
    _drift(root, 3.0, 2.4, .45, [(-.15, .05, .45, .35), (.35, -.2, .3, .2), (-.5, .35, .18, .12)],
           lambda u: math.sqrt(max(.18, 1 - u * u * .82)))
    return root


def build_rail_snow_drift_long():
    """Wind-blown drift along a wall or track, 8 × 1.6 m, crest 0.35 m on the +Z side."""
    root = root_for("rail_snow_drift_long")
    _drift(root, 8.0, 1.6, .35, [(-.7, .3, .3, .12), (-.3, .15, .22, .08), (.05, .35, .35, .15), (.45, .1, .2, .06),
                                 (.72, .25, .28, .1)],
           lambda u: .55 + .45 * math.cos(u * math.pi / 2) ** .6, rows=6, cols=13, skew=.12)
    return root


def build_rail_snow_drift_patch():
    """Flat irregular patch 2.6 × 1.8 m, 0.18 m high, for corners and under benches."""
    root = root_for("rail_snow_drift_patch")
    _drift(root, 2.6, 1.8, .18, [(-.3, -.2, .16, .35), (.4, .3, .14, .25), (.1, -.5, .1, .15)],
           lambda u: .6 + .4 * math.cos(u * 2.1) * (1 - .3 * u), rows=6, cols=8)
    return root


# --------------------------------------------------------------------------- registry, export, previews

BUILDERS = {
    "port_ship_bow": lambda: finish(build_port_ship_bow),
    "port_ship_mid": lambda: finish(build_port_ship_mid),
    "port_ship_mid_hold": lambda: finish(build_port_ship_mid_hold),
    "port_ship_stern": lambda: finish(build_port_ship_stern),
    "port_sts_crane": lambda: finish(build_port_sts_crane),
    "port_gangway": lambda: finish(build_port_gangway, center=True),
    "port_freight_boxcar": lambda: finish(build_port_freight_boxcar),
    "port_freight_boxcar_open": lambda: finish(build_port_freight_boxcar_open),
    "port_flatcar": lambda: finish(build_port_flatcar),
    "port_warehouse_shell_panel": lambda: finish(build_port_warehouse_shell_panel),
    "port_warehouse_roof_truss": lambda: finish(build_port_warehouse_roof_truss),
    "rail_track_straight": lambda: finish(build_rail_track_straight, center=True),
    "rail_track_buffer": lambda: finish(build_rail_track_buffer, center=True),
    "rail_catenary_mast": lambda: finish(build_rail_catenary_mast),
    "rail_maglev_car": lambda: finish(build_rail_maglev_car),
    "rail_maglev_car_open": lambda: finish(build_rail_maglev_car_open),
    "rail_maglev_head": lambda: finish(build_rail_maglev_head),
    "rail_signal_gantry": lambda: finish(build_rail_signal_gantry),
    "rail_control_tower": lambda: finish(build_rail_control_tower),
    "rail_platform_canopy": lambda: finish(build_rail_platform_canopy),
    "rail_turntable": lambda: finish(build_rail_turntable),
    "rail_snow_drift": lambda: finish(build_rail_snow_drift, center=True),
    "rail_snow_drift_long": lambda: finish(build_rail_snow_drift_long, center=True),
    "rail_snow_drift_patch": lambda: finish(build_rail_snow_drift_patch, center=True),
}

# Preview tiles: (direction from the target in glTF, distance factor, target offset in AABB units or None).
FAR_DISTANCE = {"port_ship_bow": 250, "port_ship_mid": 250, "port_ship_mid_hold": 250, "port_ship_stern": 250,
                "port_sts_crane": 300, "rail_control_tower": 200, "rail_maglev_head": 150}


def _bounds(root):
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c) for o in root.children_recursive if o.type == "MESH" for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def _tile(root, path, direction, distance=None, target=None, background=(.75, .75, .78), lens=50, factor=3.0):
    scene = ba._preview_scene((640, 640), background)
    lo, hi = _bounds(root)
    center = (lo + hi) / 2 if target is None else ba._city_point(target)
    radius = max((hi - lo).length / 2, .05)
    d = ba._city_point(direction)
    cam = ba._preview_camera(scene, center, d, distance or radius * factor, lens)
    cam.data.clip_end = 5000
    cam.data.clip_start = .05
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam, do_unlink=True)


CLOSEUPS = {  # name -> (target glTF, direction glTF, distance); default: from above
    "port_ship_bow": ((0, 14, 0), (-.6, .6, .8), 30),
    "port_ship_stern": ((-1, 20, 8), (1, .4, .9), 30),
    "port_sts_crane": ((31, 40, 4), (.5, .2, 1), 25),
    "port_gangway": ((12, 11, 0), (.8, .4, .9), 9),
    "port_freight_boxcar_open": ((0, 2.3, 1.5), (.25, .2, 1), 8),
    "port_warehouse_shell_panel": ((0, 5, 0), (-.3, .2, -1), 14),
    "rail_maglev_car_open": ((6.25, 2.3, 2.0), (.2, .15, 1), 7),
    "rail_maglev_head": ((11, 2, 0), (1, .3, .6), 10),
    "rail_signal_gantry": ((0, 5.5, 0), (1, .1, .4), 5),
    "rail_platform_canopy": ((0, 2.2, 0), (.4, .05, 1), 10),
    "rail_turntable": ((7.6, 2.5, 3), (.6, .4, 1), 10),
    "rail_track_buffer": ((-.3, 1.8, 0), (-1, .3, .5), 6),
}


def render_sheet(name, root, out):
    tmp = os.path.join(bpy.app.tempdir or os.environ.get("TEMP", "."), "neoryder_port_rail")
    os.makedirs(tmp, exist_ok=True)
    tiles = [os.path.join(tmp, f"{name}_{i}.png") for i in range(4)]
    _tile(root, tiles[0], (.75, .45, 1.0))
    _tile(root, tiles[1], (-.8, .5, -.9))
    lo, hi = _bounds(root)
    far = FAR_DISTANCE.get(name, (hi - lo).length * 2.2)
    _tile(root, tiles[2], (.6, .25, 1.0), distance=far, background=(.06, .07, .1))
    target, direction, distance = CLOSEUPS.get(name, (None, (.3, 1.0, .55), None))
    _tile(root, tiles[3], direction, distance=distance, target=target, factor=2.2)
    ba._stitch(tiles, out, 2)


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    only = set(argv[argv.index("--only") + 1].split(",")) if "--only" in argv else None
    preview = "--no-preview" not in argv
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    for name, fn in BUILDERS.items():
        if only and name not in only:
            continue
        ba.reset_scene()
        root = fn()
        ba.export_glb(root, os.path.join(OUT_DIR, f"{name}.glb"))
        if preview:
            render_sheet(name, root, os.path.join(PREVIEW_DIR, f"{name}.png"))
        tris = sum(len(p.vertices) - 2 for o in [root, *root.children_recursive] if o.type == "MESH"
                   for p in o.data.polygons)
        lo, hi = _bounds(root)
        size = hi - lo
        print(f"[neoryder] built {name} tris={tris} aabb={size.x:.3f} x {size.z:.3f} x {size.y:.3f} "
              f"min=({lo.x:.3f}, {lo.z:.3f}, {-hi.y:.3f}) max=({hi.x:.3f}, {hi.z:.3f}, {-lo.y:.3f})")


if __name__ == "__main__":
    main()
