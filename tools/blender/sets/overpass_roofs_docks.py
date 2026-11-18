"""Zestaw modeli „estakada, dachy, doki” (ADR 0011, D7): areny arenaOverpass, arenaRooftops
i arenaFloodedDocks. Proceduralne, low-poly, płaskie normalne, bez tekstur w GLB.

Uruchomienie (z katalogu repo):
    "D:/Blender/blender.exe" -b --factory-startup --python tools/blender/sets/overpass_roofs_docks.py
        -- [--only hw_gas_canopy,dock_barge] [--no-preview]

Wynik: public/assets/models/city/<nazwa>.glb i podgląd tools/blender/previews/city/<nazwa>.png
(arkusz 2×2: przód 3/4, tył 3/4, widok z poziomu oczu, sylwetka nocą z daleka).
Konwencje jak w build_assets.py: metry, glTF Y-up, spód na y = 0, przód +Z, jedna siatka
na materiał. Punkty odniesienia, AABB i powierzchnie chodzenia: docs/assets.md.
Płaskie powierzchnie chodzenia są zamkniętymi płytami `walk_slab` (wierzch to jedna płaszczyzna,
pola materiałów wierzchu nie zachodzą na siebie).
"""

from __future__ import annotations

import math
import os
import sys
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

import build_assets as ba  # noqa: E402

# Nowe materiały (nazwy = planowane tekstury powierzchni). Kolor to podgląd sRGB i zarazem
# ciemna barwa zastępcza w grze (src/data/render/arenaMaterials.json, "flat": true).
NEW_MATERIALS = {
    "mat_gas_station_tiles": "5a606b",
    "mat_highway_asphalt_worn": "33363d",
    "mat_flood_brick_algae": "4a3f3a",
    "mat_boardwalk_planks": "4a3d31",
    "mat_canal_stone_wall": "3d434c",
}
# Istniejące materiały aren (już zarejestrowane w grze); tu tylko barwa podglądu.
ARENA_MATERIALS = {
    "mat_overpass_concrete": "4a5466",
    "mat_smog_soot_wall": "3a3f48",
    "mat_roof_tar": "303847",
    "mat_roof_hvac_metal": "465266",
    "mat_market_tarp": "4c4664",
}

P = ba._city_point


def _linear(hex_color):
    rgb = [int(hex_color[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in rgb)


def root(name):
    obj = ba._port_root(name)
    for key, hex_color in {**NEW_MATERIALS, **ARENA_MATERIALS}.items():
        ba.PALETTE[key] = ((*_linear(hex_color), 1), None)
    return obj


# --------------------------------------------------------------------------- primitives (glTF coordinates)

def B(r, name, size, center, mat="mat_metal", bevel=0, taper=(1.0, 1.0), spin=0.0):
    return ba._city_box(r, name, size, center, mat, bevel, taper, spin)


def bx(r, name, xs, ys, zs, mat="mat_metal", bevel=0):
    """Box from (min, max) ranges on each glTF axis."""
    x0, x1 = sorted(xs)
    y0, y1 = sorted(ys)
    z0, z1 = sorted(zs)
    return ba._city_box(r, name, (x1 - x0, y1 - y0, z1 - z0), ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2),
                        mat, bevel)


def PB(r, name, size, center, mat="mat_metal", yaw=0.0, pitch=0.0, local=(0, 0, 0)):
    return ba._port_box(r, name, size, center, mat, yaw, pitch, local)


def R(r, name, a, b, radius=.03, mat="mat_metal", sides=6, tip=None):
    return ba._city_rod(r, name, a, b, radius, mat, sides, tip)


def T(r, name, points, radius=.02, mat="mat_cable", sides=4, closed=False):
    return ba._city_tube(r, name, points, radius, mat, sides, closed)


def H(r, name, rings, mat):
    return ba._city_hull(r, name, rings, mat)


def ring(r, name, center, radius, axis="y", thickness=.02, mat="mat_metal", segments=10):
    return ba._city_ring(r, name, center, radius, axis, thickness, mat, segments)


def poly(r, name, verts, faces, mat):
    """Mesh from glTF vertices and faces (index tuples); normals are made consistent."""
    bm = bmesh.new()
    vs = [bm.verts.new(P(v)) for v in verts]
    for face in faces:
        bm.faces.new(tuple(vs[i] for i in face))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    return ba.mesh_object(name, bm, mat, parent=r)


def oriented_box(r, name, size, center, axes, mat):
    """Box with local axes `axes` = (u, v, w) given as glTF unit vectors."""
    c = Vector(center)
    u, v, w = (Vector(a).normalized() for a in axes)
    corners = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            for sz in (-1, 1):
                corners.append(tuple(c + u * sx * size[0] / 2 + v * sy * size[1] / 2 + w * sz * size[2] / 2))
    faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    return poly(r, name, corners, faces, mat)


def extrude(r, name, outline, y0, y1, mat):
    """Vertical prism from an XZ outline (list of (x, z))."""
    n = len(outline)
    verts = [(x, y0, z) for x, z in outline] + [(x, y1, z) for x, z in outline]
    faces = [tuple(range(n)), tuple(range(2 * n - 1, n - 1, -1))]
    faces += [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    return poly(r, name, verts, faces, mat)


def extrude_x(r, name, outline, x0, x1, mat):
    """Prism along X from a (z, y) outline (gables, arches)."""
    n = len(outline)
    verts = [(x0, y, z) for z, y in outline] + [(x1, y, z) for z, y in outline]
    faces = [tuple(range(n)), tuple(range(2 * n - 1, n - 1, -1))]
    faces += [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    return poly(r, name, verts, faces, mat)


def extrude_z(r, name, outline, z0, z1, mat):
    """Prism along Z from an (x, y) outline."""
    n = len(outline)
    verts = [(x, y, z0) for x, y in outline] + [(x, y, z1) for x, y in outline]
    faces = [tuple(range(n)), tuple(range(2 * n - 1, n - 1, -1))]
    faces += [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    return poly(r, name, verts, faces, mat)


def shell(r, name, rings, pick, cap="mat_metal"):
    """Hull through rings of equal size with a material per ring segment `pick(j)` and per end cap."""
    bm = bmesh.new()
    rows = [[bm.verts.new(P(p)) for p in ring_] for ring_ in rings]
    mats = [cap]

    def index(mat):
        if mat not in mats:
            mats.append(mat)
        return mats.index(mat)

    bm.faces.new(tuple(reversed(rows[0])))
    bm.faces.new(tuple(rows[-1]))
    count = len(rows[0])
    for a, b in zip(rows, rows[1:]):
        for j in range(count):
            k = (j + 1) % count
            face = bm.faces.new((a[j], a[k], b[k], b[j]))
            face.material_index = index(pick(j))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    obj = ba.mesh_object(name, bm, mats[0], parent=r)
    for mat in mats[1:]:
        obj.data.materials.append(ba.material(mat))
    return obj


def slab(r, name, xs, zs, y0, y1, top, side="mat_concrete"):
    """Closed slab on a grid; the top is one plane tiled into cells with `top(x, z)` materials."""
    bm = bmesh.new()
    upper = [[bm.verts.new(P((x, y1, z))) for z in zs] for x in xs]
    lower = [[bm.verts.new(P((x, y0, z))) for z in zs] for x in xs]
    mats = [side]

    def index(mat):
        if mat not in mats:
            mats.append(mat)
        return mats.index(mat)

    nx, nz = len(xs) - 1, len(zs) - 1
    for i in range(nx):
        for j in range(nz):
            face = bm.faces.new((upper[i][j], upper[i + 1][j], upper[i + 1][j + 1], upper[i][j + 1]))
            face.material_index = index(top((xs[i] + xs[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2))
            bm.faces.new((lower[i][j], lower[i][j + 1], lower[i + 1][j + 1], lower[i + 1][j]))
        for j in (0, nz):
            bm.faces.new((lower[i][j], lower[i + 1][j], upper[i + 1][j], upper[i][j]))
    for j in range(nz):
        for i in (0, nx):
            bm.faces.new((lower[i][j], upper[i][j], upper[i][j + 1], lower[i][j + 1]))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    obj = ba.mesh_object(name, bm, mats[0], parent=r)
    for mat in mats[1:]:
        obj.data.materials.append(ba.material(mat))
    return obj


def face_frame(face):
    """(tangent, normal) of a vertical face of a square tower: '+z', '-z', '+x', '-x'."""
    return {"+z": (Vector((1, 0, 0)), Vector((0, 0, 1))), "-z": (Vector((-1, 0, 0)), Vector((0, 0, -1))),
            "+x": (Vector((0, 0, -1)), Vector((1, 0, 0))), "-x": (Vector((0, 0, 1)), Vector((-1, 0, 0)))}[face]


def on_face(face, half, u, y, depth=0.0):
    """Point on the face plane at distance `half` from the axis, offset `u` along it."""
    t, n = face_frame(face)
    return tuple(t * u + n * (half + depth) + Vector((0, y, 0)))


def face_box(r, name, face, half, u, y, size, mat, depth=0.0):
    """Box lying on a tower face: size = (along face, height, thickness out of the face)."""
    t, n = face_frame(face)
    center = on_face(face, half, u, y, depth + size[2] / 2)
    return oriented_box(r, name, size, center, (t, (0, 1, 0), n), mat)


def merge(r, names, keep=("walk_slab",)):
    """One mesh per material (draw calls); `names` maps material -> node name. `keep` stays separate."""
    groups = {}
    for obj in sorted(r.children, key=lambda o: o.name):
        if obj.type != "MESH" or obj.name.split(".")[0] in keep or len(obj.data.materials) != 1:
            continue
        groups.setdefault(obj.data.materials[0].name, []).append(obj)
    for mat, objs in groups.items():
        if len(objs) > 1:
            bpy.ops.object.select_all(action="DESELECT")
            for obj in objs:
                obj.select_set(True)
            bpy.context.view_layer.objects.active = objs[0]
            bpy.ops.object.join()
        node = names.get(mat, mat.removeprefix("mat_"))
        objs[0].name = node
        objs[0].data.name = node


def transform_all(r, matrix):
    """Apply a Blender-space matrix to every mesh under the root (baked into the vertices)."""
    bpy.context.view_layer.update()
    for obj in [o for o in r.children_recursive if o.type == "MESH"]:
        obj.data.transform(matrix @ Matrix.Translation(obj.location))
        obj.location = (0, 0, 0)


def bounds(r):
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ v.co for o in r.children_recursive if o.type == "MESH" for v in o.data.vertices]
    lo = Vector(tuple(min(p[i] for p in pts) for i in range(3)))
    hi = Vector(tuple(max(p[i] for p in pts) for i in range(3)))
    return lo, hi


def finish(builder, center):
    """Bottom on y = 0; with `center` the AABB centre also goes to x = z = 0 (else the builder's origin)."""
    r = builder()
    lo, hi = bounds(r)
    offset = Vector((-(hi.x + lo.x) / 2 if center else 0, -(hi.y + lo.y) / 2 if center else 0, -lo.z))
    if offset.length > 1e-6:
        # Exact models (walk heights) must not move: report it, the test will catch the change.
        print(f"[neoryder] {r.name}: shift x={offset.x:.4f} y={offset.z:.4f} z={-offset.y:.4f}")
        for obj in [o for o in r.children if o.type == "MESH"]:
            obj.location += offset
    return r


# --------------------------------------------------------------------------- shared helpers for models

def patch(r, name, grid, mat, outward_from):
    """Open surface from rows of glTF points; faces turned away from `outward_from`."""
    bm = bmesh.new()
    rows = [[bm.verts.new(P(p)) for p in row] for row in grid]
    for a, b in zip(rows, rows[1:]):
        for j in range(len(a) - 1):
            bm.faces.new((a[j], a[j + 1], b[j + 1], b[j]))
    bm.normal_update()
    bm.faces.ensure_lookup_table()
    face = bm.faces[len(bm.faces) // 2]
    if face.normal.dot(face.calc_center_median() - P(outward_from)) < 0:
        bmesh.ops.reverse_faces(bm, faces=list(bm.faces))
    return ba.mesh_object(name, bm, mat, parent=r)


def corrugated_roof(r, name, x0, x1, front, back, mat, pitch=.3, depth=.04, thick=.015):
    """Sloped corrugated plate spanning X; `front`/`back` = (z, y) of the crest line ends."""
    n = max(1, round((x1 - x0) / pitch))
    step = (x1 - x0) / n
    profile = []
    for k in range(n):
        u = x0 + k * step
        profile += [(u, 0.0), (u + .3 * step, 0.0), (u + .45 * step, -depth), (u + .85 * step, -depth)]
    profile.append((x1, 0.0))
    rings = []
    for z, y in (front, back):
        top = [(u, y + off, z) for u, off in profile]
        bottom = [(u, y + off - thick, z) for u, off in reversed(profile)]
        rings.append(top + bottom)
    return H(r, name, rings, mat)


def jitter(i, salt=0):
    """Deterministic pseudo-random value in [0, 1) (no RNG state in the build)."""
    return (math.sin(i * 12.9898 + salt * 78.233) * 43758.5453) % 1.0


# --------------------------------------------------------------------------- estakada (hw_)

def build_hw_gas_canopy():
    """Forecourt canopy 24 × 12 m on six columns; soffit (lowest point) at y = 5.5, flat roof without access."""
    r = root("hw_gas_canopy")
    for x in (-9, 0, 9):
        for z in (-3, 3):
            bx(r, "column_base", (x - .45, x + .45), (0, .25), (z - .45, z + .45), "mat_concrete", .04)
            bx(r, "column_tiles", (x - .36, x + .36), (.25, 1.65), (z - .36, z + .36), "mat_gas_station_tiles", .02)
            bx(r, "column_collar", (x - .3, x + .3), (1.65, 1.75), (z - .3, z + .3), "mat_trim")
            bx(r, "column", (x - .24, x + .24), (1.75, 5.56), (z - .24, z + .24), "mat_lacquer", .03)
            bx(r, "column_head", (x - .4, x + .4), (5.5, 5.56), (z - .4, z + .4), "mat_trim")
            for s in (-1, 1):
                bx(r, "column_reflector", (x - .2, x + .2), (.6, .75), (z + s * .36, z + s * .375), "mat_hivis")
    # Deck between the fascia boards; the soffit is recessed 6 cm above the light panels.
    bx(r, "canopy_body", (-11.77, 11.77), (5.56, 6.5), (-5.77, 5.77), "mat_metal")
    bx(r, "roof_membrane", (-11.77, 11.77), (6.5, 6.52), (-5.77, 5.77), "mat_roof_tar")
    for s in (-1, 1):
        bx(r, "fascia", (-11.97, 11.97), (5.5, 6.7), (s * 5.77, s * 5.97), "mat_lacquer")
        bx(r, "fascia", (s * 11.77, s * 11.97), (5.5, 6.7), (-5.77, 5.77), "mat_lacquer")
        # Amber band around the fascia, broken by a blank royal blue panel (no logo, no text) front and back.
        for a, b in ((-11.97, -2.75), (2.75, 11.97)):
            bx(r, "fascia_glow", (a, b), (6.02, 6.16), (s * 5.97, s * 6.0), "mat_neon_amber")
        bx(r, "fascia_glow", (s * 11.97, s * 12.0), (6.02, 6.16), (-6.0, 6.0), "mat_neon_amber")
        bx(r, "sign_frame", (-2.75, 2.75), (5.62, 6.62), (s * 5.97, s * 5.99), "mat_trim")
        bx(r, "sign_panel", (-2.6, 2.6), (5.7, 6.54), (s * 5.97, s * 6.0), "mat_neon_blue")
        bx(r, "fascia_trim", (-11.97, 11.97), (5.5, 5.58), (s * 5.97, s * 5.99), "mat_trim")
        bx(r, "fascia_trim", (s * 11.97, s * 11.99), (5.5, 5.58), (-5.97, 5.97), "mat_trim")
        for x in (-8.4, -5.6, 5.6, 8.4):
            bx(r, "fascia_seam", (x - .02, x + .02), (5.58, 6.7), (s * 5.97, s * 5.985), "mat_trim")
    # Warm white soffit: three long strips and square panels between the columns.
    for z in (-4.6, 0, 4.6):
        bx(r, "soffit_light", (-11.2, 11.2), (5.5, 5.56), (z - .25, z + .25), "mat_light_white")
    for x in (-4.5, 4.5):
        for z in (-3, 3):
            bx(r, "soffit_light", (x - .8, x + .8), (5.5, 5.56), (z - .8, z + .8), "mat_light_white")
    # Rainwater downpipes on two columns, roof drains, hatch and conduit (all under the fascia lip).
    for x, z in ((-9, -3), (9, 3)):
        T(r, "downpipe", [(x + .3, 5.5, z + .3), (x + .3, 1.9, z + .3), (x + .5, 1.7, z + .5), (x + .5, .27, z + .5)],
          .06, "mat_metal", 6)
    for x in (-6, 6):
        R(r, "roof_drain", (x, 6.52, 0), (x, 6.58, 0), .18, "mat_trim", 8)
    bx(r, "roof_hatch", (2.6, 3.6), (6.52, 6.66), (-1.4, -.4), "mat_trim")
    for z in (-1.9, 1.9):
        R(r, "roof_conduit", (-11.5, 6.58, z), (11.5, 6.58, z), .05, "mat_metal", 4)
    merge(r, {"mat_lacquer": "fascia", "mat_light_white": "soffit_light", "mat_neon_amber": "fascia_glow",
              "mat_neon_blue": "sign_panel", "mat_metal": "canopy_body", "mat_gas_station_tiles": "column_tiles",
              "mat_concrete": "column_base", "mat_trim": "trim", "mat_hivis": "reflector", "mat_roof_tar": "roof"})
    return r


def build_hw_gas_pump():
    """Dispenser 1.2 × 2 × 0.6 m: blank amber displays on both faces (±Z), nozzles and hoses on ±X."""
    r = root("hw_gas_pump")
    bx(r, "plinth", (-.52, .52), (0, .16), (-.27, .27), "mat_concrete", .02)
    bx(r, "kick_plate", (-.5, .5), (.16, .3), (-.255, .255), "mat_trim")
    bx(r, "body", (-.48, .48), (.3, 1.62), (-.25, .25), "mat_lacquer", .025)
    bx(r, "head", (-.6, .6), (1.66, 2.0), (-.29, .29), "mat_lacquer", .03)
    bx(r, "head_band", (-.6, .6), (1.62, 1.66), (-.3, .3), "mat_trim")
    bx(r, "top_light", (-.56, .56), (1.97, 2.0), (-.2, .2), "mat_light_white")
    for s in (-1, 1):
        z = s * .29
        bx(r, "display_bezel", (-.42, .42), (1.7, 1.92), (z, z + s * .008), "mat_trim")
        for a, b in ((-.39, -.02), (.02, .39)):
            bx(r, "display", (a, b), (1.73, 1.89), (z, z + s * .012), "mat_neon_amber")
        bx(r, "service_panel", (-.4, .4), (.4, 1.18), (s * .25, s * .262), "mat_machine")
        for y in (.6, .9):
            bx(r, "panel_seam", (-.38, .38), (y - .01, y + .01), (s * .262, s * .266), "mat_trim")
        bx(r, "terminal", (-.38, -.06), (1.24, 1.56), (s * .25, s * .285), "mat_trim")
        bx(r, "keypad", (-.34, -.1), (1.27, 1.4), (s * .285, s * .292), "mat_machine")
        bx(r, "status", (-.32, -.26), (1.47, 1.52), (s * .285, s * .292), "mat_neon_green")
        bx(r, "grade_strip", (.0, .38), (1.3, 1.5), (s * .25, s * .27), "mat_plastic")
        x = s * .52
        bx(r, "holster", (s * .48, s * .56), (1.02, 1.38), (-.1, .1), "mat_trim")
        R(r, "nozzle", (x, 1.32, .02), (x, 1.12, .14), .03, "mat_metal", 6)
        bx(r, "nozzle_grip", (x - .03, x + .03), (1.24, 1.4), (-.06, .04), "mat_rubber")
        T(r, "hose", [(s * .55, 1.86, -.04), (s * .57, 1.45, -.13), (s * .57, .85, -.15), (s * .56, .6, -.06),
                      (s * .555, .8, .07), (s * .55, 1.12, .12)], .026, "mat_rubber", 5)
    merge(r, {"mat_lacquer": "body", "mat_neon_amber": "display", "mat_trim": "trim", "mat_rubber": "hose",
              "mat_metal": "nozzle", "mat_machine": "panel", "mat_concrete": "plinth", "mat_light_white": "top_light",
              "mat_neon_green": "status", "mat_plastic": "grade_strip"})
    return r


def build_hw_toll_booth():
    """Toll booth on a 9 m concrete island along Z; the barrier arm spans the +X lane.
    Origin: island axis (x = z = 0), island bottom on y = 0."""
    r = root("hw_toll_booth")
    bx(r, "island", (-1.4, 1.4), (0, .2), (-3.6, 3.6), "mat_concrete")
    for s in (-1, 1):
        extrude(r, "island_nose", [(-1.4, s * 3.6), (1.4, s * 3.6), (.9, s * 4.5), (-.9, s * 4.5)], 0, .2, "mat_hazard")
        R(r, "nose_bollard", (0, .2, s * 4.05), (0, 1.15, s * 4.05), .11, "mat_hazard", 8)
        R(r, "bollard_cap", (0, 1.15, s * 4.05), (0, 1.22, s * 4.05), .11, "mat_neon_amber", 8)
        bx(r, "kerb_reflector", (-1.42, -1.4), (.06, .14), (s * 1.0, s * 1.4), "mat_hivis")
        bx(r, "kerb_reflector", (1.4, 1.42), (.06, .14), (s * 1.0, s * 1.4), "mat_hivis")
    # Booth: steel lower walls, glazed upper band, graphite frame and a door at -Z.
    bx(r, "booth_base", (-1.1, 1.1), (.2, 1.0), (-1.7, 1.7), "mat_metal")
    bx(r, "booth_glass", (-1.05, 1.05), (1.0, 2.5), (-1.65, 1.65), "mat_glass")
    for sx in (-1, 1):
        for sz in (-1, 1):
            bx(r, "booth_post", (sx * .98, sx * 1.1), (1.0, 2.5), (sz * 1.58, sz * 1.7), "mat_trim")
    bx(r, "booth_header", (-1.1, 1.1), (2.5, 2.6), (-1.7, 1.7), "mat_trim")
    bx(r, "sill", (-1.12, 1.12), (.98, 1.04), (-1.72, 1.72), "mat_trim")
    for z in (-.55, .55):
        bx(r, "mullion", (1.05, 1.08), (1.04, 2.5), (z - .03, z + .03), "mat_trim")
        bx(r, "mullion", (-1.08, -1.05), (1.04, 2.5), (z - .03, z + .03), "mat_trim")
    bx(r, "door", (-.45, .45), (.2, 2.45), (-1.72, -1.7), "mat_trim")
    bx(r, "door_handle", (.3, .38), (1.1, 1.14), (-1.75, -1.72), "mat_metal")
    bx(r, "counter", (1.1, 1.32), (1.0, 1.05), (-.6, .6), "mat_metal")
    bx(r, "card_reader", (1.1, 1.24), (1.12, 1.4), (.75, .95), "mat_machine")
    bx(r, "reader_status", (1.24, 1.25), (1.32, 1.37), (.8, .9), "mat_neon_green")
    # Canopy (daszek) over the booth with an amber edge and warm white light over the +X window.
    bx(r, "fascia", (-1.2, 1.2), (2.6, 2.75), (-1.95, 1.95), "mat_trim")
    bx(r, "canopy", (-1.4, 1.4), (2.75, 3.0), (-2.0, 2.0), "mat_trim", .02)
    for s in (-1, 1):
        bx(r, "canopy_glow", (-1.4, 1.4), (2.8, 2.88), (s * 2.0, s * 2.02), "mat_neon_amber")
        bx(r, "canopy_glow", (s * 1.4, s * 1.42), (2.8, 2.88), (-2.0, 2.0), "mat_neon_amber")
    bx(r, "window_light", (1.22, 1.38), (2.71, 2.75), (-1.5, 1.5), "mat_light_white")
    # Barrier cabinet and the arm (amber / graphite segments) across the +X lane at y = 1.0.
    bx(r, "barrier_cabinet", (.95, 1.35), (.2, 1.22), (2.45, 2.85), "mat_trim", .02)
    bx(r, "cabinet_lamp", (1.05, 1.25), (1.22, 1.3), (2.55, 2.75), "mat_neon_amber")
    R(r, "arm_hub", (1.35, 1.0, 2.65), (1.47, 1.0, 2.65), .11, "mat_metal", 8)
    for i in range(6):
        x0 = 1.47 + i * .6
        bx(r, "arm", (x0, x0 + .6), (.95, 1.05), (2.6, 2.7), "mat_hivis" if i % 2 == 0 else "mat_trim")
    bx(r, "arm_tip", (5.07, 5.11), (.94, 1.06), (2.59, 2.71), "mat_neon_amber")
    # Lane signal (green over amber; no red) on a post at the +Z nose.
    R(r, "signal_post", (1.05, .2, 3.4), (1.05, 2.0, 3.4), .05, "mat_metal", 6)
    bx(r, "signal_head", (.9, 1.2), (1.9, 2.42), (3.28, 3.5), "mat_trim", .02)
    bx(r, "signal_go", (.97, 1.13), (2.2, 2.36), (3.5, 3.52), "mat_neon_green")
    bx(r, "signal_wait", (.97, 1.13), (1.96, 2.12), (3.5, 3.52), "mat_neon_amber")
    merge(r, {"mat_concrete": "island", "mat_hazard": "island_nose", "mat_metal": "booth_base",
              "mat_glass": "booth_glass", "mat_trim": "frame", "mat_hivis": "arm", "mat_neon_amber": "amber_light",
              "mat_light_white": "window_light", "mat_neon_green": "signal_go", "mat_machine": "machine"})
    return r


def build_hw_broken_deck_end():
    """Torn overpass end, 14 × 12 m like city_overpass_deck (bottom y = 0, road y = 1.6, z = -6…6):
    flat road for z = -6…4, then a jagged edge with rebar and cables (all inside z <= 6, y >= 0)."""
    r = root("hw_broken_deck_end")

    def surface(x, z):
        if abs(x) > 6.4:
            return "mat_concrete"
        if -5.96 < z < -5.84:
            return "mat_rubber"
        if abs(x) < .06 and (abs(z) < .9 or 3.1 < abs(z) < 4.9):
            return "mat_hivis"
        return "mat_asphalt"

    slab(r, "walk_slab", [-7, -6.4, -.06, .06, 6.4, 7],
         [-6, -5.96, -5.84, -4.9, -3.1, -.9, .9, 3.1, 4.0], 0, 1.6, surface)
    # Sawtooth outline: deep bites next to long spikes, tilted slabs between them.
    xs = [-7, -6.4, -5.9, -5.1, -4.6, -4.0, -3.3, -2.8, -2.3, -1.6, -.9, -.35, .35, .9, 1.5, 2.2, 2.7, 3.4,
          4.0, 4.6, 5.3, 5.8, 6.4, 7]
    edge = [5.1, 5.65, 4.7, 5.2, 4.5, 5.55, 4.85, 5.95, 5.4, 4.6, 5.25, 4.5, 4.5, 5.1, 5.8, 4.75, 5.5, 4.4,
            5.2, 4.65, 5.9, 5.0, 5.45, 4.9]
    ytop = [1.42, 1.15, 1.5, 1.3, 1.52, 1.05, 1.45, .95, 1.2, 1.5, 1.25, 1.55, 1.55, 1.3, 1.0, 1.45, 1.15, 1.55,
            1.3, 1.5, .9, 1.35, 1.2, 1.4]
    ybot = [.45, .25, .65, .4, .7, .3, .55, .2, .35, .6, .45, .75, .75, .5, .25, .6, .4, .75, .5, .65, .2, .45,
            .35, .5]
    rings = []
    for x, e, yt, yb in zip(xs, edge, ytop, ybot):
        zm = 4.0 + (e - 4.0) * .55
        rings.append([(x, 0, 4.0), (x, yb * .35, zm), (x, yb, e), (x, yt, e),
                      (x, 1.6 - (1.6 - yt) * .4, zm), (x, 1.6, 4.0)])
    shell(r, "torn_end", rings, lambda j: "mat_highway_asphalt_worn" if j in (3, 4) else "mat_concrete",
          "mat_concrete")

    def at(x, values):
        for i in range(len(xs) - 1):
            if xs[i] <= x <= xs[i + 1]:
                t = (x - xs[i]) / (xs[i + 1] - xs[i])
                return values[i] + (values[i + 1] - values[i]) * t
        return values[-1]

    # Rebar: an upper and a lower mat sticking out of the torn face, some bars bent down.
    k = 0
    for i in range(15):
        x = -6.5 + i * .93
        e, yt, yb = at(x, edge), at(x, ytop), at(x, ybot)
        for y in (yt - .14, yb + .1):
            length = .3 + .55 * jitter(k, 1)
            end = min(e + length, 5.97)
            drop = .5 * jitter(k, 2) if jitter(k, 3) > .45 else .04
            dx = .12 * (jitter(k, 4) - .5)
            T(r, "rebar", [(x, y, e - .12), (x, y, e + (end - e) * .55), (x + dx, max(.03, y - drop), end)],
              .016, "mat_rust", 3)
            k += 1
    T(r, "rebar", [(-2.8, .9, 5.7), (-2.8, .9, 5.85), (-2.8, .9, 6.0)], .016, "mat_rust", 3)
    # Transverse bars left hanging across the deepest bites, and loose chunks on the torn surface.
    for x0, x1 in ((-5.0, -4.2), (-.6, .6), (3.0, 3.8), (4.3, 5.0)):
        e = min(at(x0, edge), at(x1, edge), at((x0 + x1) / 2, edge))
        y = at((x0 + x1) / 2, ytop) - .16
        T(r, "rebar", [(x0, y, e + .1), ((x0 + x1) / 2, y - .22, e + .16), (x1, y, e + .1)], .016, "mat_rust", 3)
    for x, z, size, turn in ((-3.6, 4.55, (.7, .32, .55), 18), (1.9, 4.6, (.55, .28, .5), -24),
                             (5.0, 4.4, (.6, .3, .45), 9)):
        tilt = math.radians(turn)
        oriented_box(r, "debris", size, (x, at(x, ytop) + .05, z),
                     ((math.cos(tilt), math.sin(tilt) * .5, 0), (-math.sin(tilt) * .5, 1, .25), (0, -.25, 1)),
                     "mat_concrete")
    # Cables pulled out of a conduit, drooping down the face.
    for x, y in ((-4.6, .95), (-4.35, .85), (.1, 1.0), (4.0, 1.05)):
        e = at(x, edge)
        T(r, "hanging_cable", [(x, y, e - .3), (x, y - .05, e + .12), (x + .08, y - .45, e + .32),
                               (x + .12, .25, e + .36), (x + .2, .04, e + .25)], .035, "mat_cable", 4)
    R(r, "conduit_stub", (-4.5, .9, 4.6), (-4.5, .9, at(-4.5, edge) + .15), .13, "mat_metal", 6)
    # Chunk of slab hanging on its rebar in the deepest bite.
    oriented_box(r, "hanging_chunk", (1.1, .45, .85), (0, .52, 5.0),
                 ((1, 0, 0), (0, math.cos(.7), math.sin(.7)), (0, -math.sin(.7), math.cos(.7))), "mat_concrete")
    for x in (-.4, .1, .45):
        T(r, "rebar", [(x, 1.25, 4.4), (x, 1.0, 4.75), (x, .75, 5.0)], .016, "mat_rust", 3)
    # Side barriers like the deck (x = ±6.6), broken off before the edge, with a stub and a snapped lamp post.
    ba._city_jersey(r, "side_barrier", 9.7, -6.6, 1.6, -1.15, along_z=True)
    ba._city_jersey(r, "side_barrier", 7.4, 6.6, 1.6, -2.3, along_z=True)
    ba._city_jersey(r, "side_barrier", .8, 6.6, 1.6, 2.6, along_z=True)
    for x in (-6.6, 6.6):
        for z in (-4.5, 0):
            face = x - math.copysign(.205, x)
            bx(r, "reflector", (face, face - math.copysign(.015, x)), (2.12, 2.28), (z - .175, z + .175), "mat_hivis")
    for z, x, d in ((3.7, -6.6, 1), (1.4, 6.6, 1), (2.2, 6.6, -1), (3.0, 6.6, 1)):
        for dx in (-.15, .15):
            T(r, "rebar", [(x + dx, 2.2, z - d * .05), (x + dx, 2.25, z + d * .15), (x + dx * 1.5, 2.05, z + d * .3)],
              .014, "mat_rust", 3)
    T(r, "lamp_post", [(6.75, 1.6, 3.5), (6.75, 2.45, 3.5), (6.68, 2.5, 3.85), (6.55, 2.15, 4.6),
                       (6.42, 1.35, 5.35), (6.35, .55, 5.75)], .08, "mat_metal", 6)
    bx(r, "lamp_base", (6.55, 6.95), (1.6, 1.68), (3.3, 3.7), "mat_trim")
    oriented_box(r, "lamp_head", (.32, .7, .22), (6.33, .35, 5.78), ((1, 0, 0), (0, 1, 0), (0, 0, 1)), "mat_trim")
    oriented_box(r, "lamp_lens", (.24, .5, .02), (6.33, .3, 5.9), ((1, 0, 0), (0, 1, 0), (0, 0, 1)), "mat_glass")
    merge(r, {"mat_concrete": "concrete", "mat_rust": "rebar", "mat_cable": "hanging_cable",
              "mat_metal": "steelwork", "mat_hivis": "reflector", "mat_trim": "trim", "mat_glass": "lamp_lens"},
          keep=("walk_slab", "torn_end"))
    return r


def build_hw_vent_tower():
    """Tunnel ventilation tower: 8 × 8 m base, about 25 m tall, louvres and green technical lamps."""
    r = root("hw_vent_tower")
    C = "mat_overpass_concrete"
    bx(r, "plinth", (-4, 4), (0, .3), (-4, 4), "mat_concrete", .05)
    bx(r, "shaft", (-3.5, 3.5), (.3, 19.0), (-3.5, 3.5), C)
    for sx in (-1, 1):
        for sz in (-1, 1):
            bx(r, "pilaster", (sx * 3.1, sx * 3.75), (.3, 19.0), (sz * 3.1, sz * 3.75), "mat_concrete", .04)
            for y in (5.0, 10.5, 16.0):
                bx(r, "green_lamp", (sx * 3.25, sx * 3.6), (y, y + .22), (sz * 3.75, sz * 3.8), "mat_neon_green")
    for y in (6.6, 13.2):
        bx(r, "band", (-3.62, 3.62), (y, y + .3), (-3.62, 3.62), "mat_concrete")
    tilt = math.radians(38)
    for face in ("+z", "-z", "+x", "-x"):
        t, n = face_frame(face)
        up = Vector((0, 1, 0))
        slat_v = up * math.cos(tilt) - n * math.sin(tilt)
        slat_w = n * math.cos(tilt) + up * math.sin(tilt)
        for u in (-1.45, 1.45):
            face_box(r, "louvre_frame", face, 3.5, u, 10.0, (2.3, 5.4, .06), "mat_trim")
            face_box(r, "louvre_recess", face, 3.5, u, 10.0, (2.0, 5.0, .08), "mat_cable")
            for i in range(7):
                y = 7.9 + i * .7
                oriented_box(r, "louvre_slat", (1.96, .06, .34), on_face(face, 3.5, u, y, .2), (t, slat_v, slat_w),
                             "mat_metal")
        # Crown louvres between the corner posts.
        for i in range(6):
            y = 19.8 + i * .5
            oriented_box(r, "crown_slat", (6.78, .06, .4), on_face(face, 3.4, 0, y, .28), (t, slat_v, slat_w),
                         "mat_metal")
    face_box(r, "door_frame", "+z", 3.5, 0, 1.6, (1.6, 2.6, .04), "mat_trim")
    face_box(r, "door", "+z", 3.5, 0, 1.5, (1.3, 2.3, .07), "mat_machine")
    face_box(r, "door_lamp", "+z", 3.5, 0, 3.15, (.5, .14, .12), "mat_neon_green")
    bx(r, "crown_floor", (-4, 4), (19.0, 19.4), (-4, 4), "mat_concrete", .05)
    bx(r, "crown_core", (-3.3, 3.3), (19.4, 22.8), (-3.3, 3.3), "mat_cable")
    for sx in (-1, 1):
        for sz in (-1, 1):
            bx(r, "crown_post", (sx * 3.4, sx * 4.0), (19.4, 22.8), (sz * 3.4, sz * 4.0), "mat_concrete")
            R(r, "green_lamp", (sx * 3.7, 23.3, sz * 3.7), (sx * 3.7, 23.52, sz * 3.7), .13, "mat_neon_green", 6)
    bx(r, "crown_roof", (-4, 4), (22.8, 23.3), (-4, 4), "mat_concrete", .05)
    for x in (-1.75, 1.75):
        R(r, "stack", (x, 23.3, 0), (x, 24.93, 0), 1.15, "mat_metal", 12)
        R(r, "stack_throat", (x, 24.93, 0), (x, 24.95, 0), 1.0, "mat_cable", 12)
        ring(r, "stack_rim", (x, 24.95, 0), 1.17, "y", .05, "mat_trim", 12)
        for dz in (-.5, 0, .5):
            span = math.sqrt(1.0 - dz * dz)
            R(r, "stack_grille", (x - span, 24.96, dz), (x + span, 24.96, dz), .03, "mat_trim", 4)
        for y in (23.9, 24.5):
            ring(r, "stack_band", (x, y, 0), 1.16, "y", .03, "mat_trim", 12)
    # Service ladder on the -X face, between the louvre panels.
    for z in (-.22, .22):
        R(r, "ladder_rail", (-3.72, .3, z), (-3.72, 18.95, z), .03, "mat_metal", 4)
    for i in range(31):
        y = .7 + i * .6
        R(r, "rung", (-3.72, y, -.22), (-3.72, y, .22), .018, "mat_metal", 3)
    for y in (2.0, 6.0, 10.0, 14.0, 18.0):
        bx(r, "ladder_bracket", (-3.74, -3.5), (y, y + .06), (-.28, .28), "mat_metal")
    merge(r, {C: "shaft", "mat_concrete": "structure", "mat_metal": "louvres", "mat_trim": "trim",
              "mat_cable": "recess", "mat_neon_green": "green_lamp", "mat_machine": "door"})
    return r


def _dome_point(a, c, h, phi, theta, scale=1.0):
    sag = 1 - .06 * (1 - abs(math.cos(2 * (theta - math.pi / 4)))) * math.cos(phi)
    k = scale * sag
    return (a * math.cos(phi) * math.cos(theta) * k, h * math.sin(phi) * scale,
            c * math.cos(phi) * math.sin(theta) * k)


def build_hw_camp_tent_dome():
    """Dome tent (about 2.4 × 1.25 × 2.1 m) with crossed poles, door on +Z, guy lines and camp kit."""
    r = root("hw_camp_tent_dome")
    a, c, h, seg = 1.2, 1.05, 1.25, 16
    phis = [math.radians(v) for v in (0, 16, 32, 48, 63, 77, 88)]
    thetas = [k * math.tau / seg for k in range(seg)]
    H(r, "fly", [[_dome_point(a, c, h, p, t) for t in thetas] for p in phis], "mat_market_tarp")
    for start in (math.pi / 4, 3 * math.pi / 4):
        pts = [_dome_point(a, c, h, math.radians(v), start, 1.015) for v in range(2, 90, 10)]
        pts += [_dome_point(a, c, h, math.radians(v), start + math.pi, 1.015) for v in range(90, 1, -10)]
        T(r, "pole", pts, .014, "mat_trim", 3)
    door = [[_dome_point(a, c, h, math.radians(p), math.radians(t), 1.012) for t in range(64, 117, 13)]
            for p in (0, 14, 28, 42, 52)]
    patch(r, "door", door, "mat_cable", (0, .4, 0))
    T(r, "door_roll", [_dome_point(a, c, h, math.radians(54), math.radians(t), 1.04) for t in range(62, 119, 14)],
      .05, "mat_market_tarp", 5)
    for theta in (0, math.pi / 2 + .9, math.pi, 3 * math.pi / 2):
        top = _dome_point(a, c, h, math.radians(38), theta, 1.0)
        peg = (math.cos(theta) * 1.62, 0, math.sin(theta) * 1.45)
        T(r, "guy_line", [top, (peg[0], .07, peg[2])], .006, "mat_hivis", 3)
        R(r, "peg", (peg[0], 0, peg[2]), (peg[0], .08, peg[2]), .02, "mat_metal", 4)
    bx(r, "crate", (.95, 1.45), (0, .38), (.95, 1.35), "mat_wood", .02)
    R(r, "jerrycan", (-1.25, 0, 1.0), (-1.25, .42, 1.0), .14, "mat_paint", 6)
    R(r, "sleeping_roll", (-.55, .1, 1.25), (.15, .1, 1.3), .1, "mat_fabric", 8)
    merge(r, {"mat_market_tarp": "fly", "mat_trim": "pole", "mat_cable": "door", "mat_hivis": "guy_line",
              "mat_metal": "peg", "mat_wood": "crate", "mat_paint": "jerrycan", "mat_fabric": "sleeping_roll"})
    return r


def build_hw_camp_tent_ridge():
    """A-frame tarp tent: ridge along Z (2.8 m), open end on +Z, closed back, guy ropes on the ridge axis."""
    r = root("hw_camp_tent_ridge")
    stations = (-1.4, -.7, 0, .7, 1.4)
    rings = []
    for i, z in enumerate(stations):
        sag = 0 if i in (0, len(stations) - 1) else .07
        outer = [(-1.1, .02), (-.76, .55 - sag), (-.4, 1.1 - sag * .6), (0, 1.6), (.4, 1.1 - sag * .6),
                 (.76, .55 - sag), (1.1, .02)]
        inner = [(x * .985, y - .02) for x, y in reversed(outer)]
        rings.append([(x, y, z) for x, y in outer + inner])
    H(r, "tarp", rings, "mat_lacquer")
    extrude_z(r, "back_panel", [(-1.08, .02), (1.08, .02), (0, 1.57)], -1.42, -1.4, "mat_market_tarp")
    for z in (-1.48, 1.48):
        for s in (-1, 1):
            R(r, "a_frame", (s * .95, .04, z), (-s * .1, 1.72, z), .035, "mat_wood", 5)
    R(r, "ridge_pole", (0, 1.63, -1.6), (0, 1.63, 1.6), .035, "mat_wood", 5)
    for s in (-1, 1):
        T(r, "guy_rope", [(0, 1.63, s * 1.6), (0, .08, s * 1.95)], .008, "mat_hivis", 3)
        R(r, "peg", (0, 0, s * 1.95), (0, .1, s * 1.95), .025, "mat_metal", 4)
    T(r, "tied_flap", [(-1.05, .1, 1.45), (-.85, .5, 1.5), (-.55, .95, 1.5), (-.3, 1.3, 1.46)], .07,
      "mat_lacquer", 5)
    bx(r, "ground_sheet", (-1.0, 1.0), (0, .02), (-1.35, 1.35), "mat_rubber")
    bx(r, "sleeping_bag", (-.85, -.1), (.02, .2), (-1.25, .6), "mat_fabric", .06)
    bx(r, "crate", (.3, .8), (.02, .42), (-1.3, -.85), "mat_wood", .02)
    T(r, "lamp_wire", [(0, 1.6, -.4), (0, 1.32, -.4)], .006, "mat_cable", 3)
    bx(r, "lamp", (-.05, .05), (1.2, 1.32), (-.45, -.35), "mat_neon_amber")
    merge(r, {"mat_lacquer": "tarp", "mat_wood": "frame", "mat_market_tarp": "back_panel", "mat_hivis": "guy_rope",
              "mat_metal": "peg", "mat_rubber": "ground_sheet", "mat_fabric": "sleeping_bag",
              "mat_neon_amber": "lamp", "mat_cable": "lamp_wire"})
    return r


def build_hw_camp_shack():
    """Lean-to shack of corrugated sheet and pallets (about 3.1 × 2.4 × 2.6 m), open doorway in +Z."""
    r = root("hw_camp_shack")
    for x in (-1.42, 1.42):
        for z, h in ((-1.12, 2.06), (1.12, 2.35)):
            bx(r, "post", (x - .05, x + .05), (0, h), (z - .05, z + .05), "mat_wood")
    # Back wall: plywood lining with a corrugated skin outside (-Z).
    bx(r, "lining", (-1.45, 1.45), (0, 2.02), (-1.17, -1.14), "mat_wood")
    ba._port_sheet(r, "back_sheet", "mat_corrugated", "x", -1.47, 2.94, 0, 1.98, -1.2, -1, pitch=.3, depth=.035)
    ba._port_sheet(r, "back_patch", "mat_rust", "x", -.4, 1.1, .6, 1.5, -1.26, -1, pitch=.3, depth=.035)
    # Left wall (-X): four pallets on edge, boards outside.
    for z0 in (-1.12, 0):
        for y0 in (0, 1.04):
            bx(r, "pallet_back", (-1.45, -1.42), (y0, y0 + 1.0), (z0 + .02, z0 + 1.1), "mat_wood")
            for k in range(5):
                zb = z0 + .1 + k * .22
                bx(r, "pallet_board", (-1.5, -1.45), (y0 + .02, y0 + .98), (zb - .045, zb + .045), "mat_wood")
            for yy in (y0 + .1, y0 + .9):
                bx(r, "pallet_block", (-1.47, -1.45), (yy - .05, yy + .05), (z0 + .05, z0 + 1.08), "mat_trim")
    extrude_x(r, "gap_tarp", [(-1.12, 2.04), (1.12, 2.04), (1.12, 2.3), (-1.12, 2.06)], -1.5, -1.47,
              "mat_market_tarp")
    # Right wall (+X): lining, corrugated skin and a tarp over the top gap.
    extrude_x(r, "lining", [(-1.15, 0), (1.15, 0), (1.15, 2.3), (-1.15, 2.02)], 1.4, 1.43, "mat_wood")
    ba._port_sheet(r, "side_sheet", "mat_corrugated", "z", -1.15, 2.3, 0, 1.92, 1.47, 1, pitch=.3, depth=.035)
    extrude_x(r, "side_tarp", [(-1.15, 1.9), (1.15, 1.9), (1.15, 2.3), (-1.15, 2.03)], 1.47, 1.5,
              "mat_market_tarp")
    # Front (+Z): corrugated left panel, plywood right panel, plank header over a 1.05 m doorway.
    bx(r, "lining", (-1.45, -.5), (0, 2.0), (1.12, 1.15), "mat_wood")
    ba._port_sheet(r, "front_sheet", "mat_corrugated", "x", -1.47, .97, 0, 1.98, 1.2, 1, pitch=.3, depth=.035)
    bx(r, "plywood", (.55, 1.45), (0, 2.0), (1.12, 1.18), "mat_wood")
    bx(r, "header", (-1.47, 1.47), (2.0, 2.33), (1.12, 1.18), "mat_wood")
    T(r, "curtain", [(.5, 2.0, 1.22), (.46, 1.6, 1.25), (.5, 1.0, 1.24), (.47, .45, 1.24)], .07, "mat_fabric", 5)
    corrugated_roof(r, "roof", -1.55, 1.55, (1.3, 2.4), (-1.3, 2.05), "mat_corrugated")
    for x in (-.8, .55):
        ring(r, "tyre", (x, 2.2, -.7), .27, "y", .075, "mat_rubber", 10)
    bx(r, "cinder_block", (-.1, .3), (2.18, 2.38), (-.3, -.1), "mat_concrete")
    # Stove pipe through the roof and a small stove inside; mattress and crate; amber lamp at the door.
    R(r, "stovepipe", (1.05, .62, -.75), (1.05, 2.33, -.75), .065, "mat_metal", 8)
    R(r, "pipe_cap", (1.05, 2.33, -.75), (1.05, 2.4, -.75), .14, "mat_metal", 8, .03)
    bx(r, "stove", (.8, 1.3), (0, .62), (-1.05, -.45), "mat_rust", .02)
    bx(r, "mattress", (-1.35, -.4), (0, .18), (-1.08, .55), "mat_fabric", .05)
    bx(r, "crate", (.62, 1.1), (0, .4), (.2, .7), "mat_wood", .02)
    T(r, "lamp_wire", [(.1, 2.18, .9), (.1, 2.0, .9)], .006, "mat_cable", 3)
    bx(r, "lamp", (.04, .16), (1.88, 2.0), (.84, .96), "mat_neon_amber")
    merge(r, {"mat_wood": "timber", "mat_corrugated": "sheet", "mat_rust": "rust_patch",
              "mat_market_tarp": "tarp", "mat_fabric": "fabric", "mat_rubber": "tyre", "mat_trim": "pallet_block",
              "mat_neon_amber": "lamp", "mat_metal": "stovepipe", "mat_concrete": "cinder_block",
              "mat_cable": "lamp_wire"})
    return r


def build_hw_fire_barrel():
    """Oil drum with a fire: amber embers through punched holes, amber and warm white flames (no red)."""
    r = root("hw_fire_barrel")
    for a in (0, 2.1, 4.2):
        bx(r, "brick", (.2 * math.cos(a) - .1, .2 * math.cos(a) + .1), (0, .07),
           (.2 * math.sin(a) - .06, .2 * math.sin(a) + .06), "mat_concrete")
    R(r, "drum", (0, .07, 0), (0, .95, 0), .29, "mat_rust", 14)
    R(r, "drum_inside", (0, .82, 0), (0, .956, 0), .26, "mat_cable", 14)
    for y in (.36, .66):
        ring(r, "hoop", (0, y, 0), .295, "y", .016, "mat_rust", 14)
    ring(r, "rim", (0, .95, 0), .285, "y", .018, "mat_metal", 14)
    for i in range(8):
        a = i * math.tau / 8 + .2
        y = .26 if i % 2 else .5
        PB(r, "ember_hole", (.07, .09, .02), (.288 * math.sin(a), y, .288 * math.cos(a)), "mat_neon_amber",
           math.degrees(a))
    R(r, "embers", (0, .9, 0), (0, .962, 0), .24, "mat_neon_amber", 10)
    for k, (dx, dz, h, rad, mat) in enumerate(((0, 0, 1.42, .17, "mat_neon_amber"), (.1, .06, 1.25, .12, "mat_neon_amber"),
                                               (-.11, .04, 1.2, .11, "mat_neon_amber"), (.02, -.1, 1.3, .12, "mat_neon_amber"),
                                               (0, .02, 1.18, .09, "mat_neon_white"), (.06, -.04, 1.08, .06, "mat_neon_white"))):
        R(r, "flame", (dx, .94, dz), (dx * 1.6 + .03 * math.sin(k), h, dz * 1.6), rad, mat, 5, .01)
    for a, length in ((.4, .5), (2.6, .42), (4.4, .46)):
        R(r, "stick", (.12 * math.cos(a), .8, .12 * math.sin(a)),
          (.3 * math.cos(a), .8 + length * .7, .3 * math.sin(a)), .03, "mat_wood", 5)
    merge(r, {"mat_rust": "drum", "mat_neon_amber": "fire", "mat_neon_white": "fire_core", "mat_wood": "stick",
              "mat_cable": "soot", "mat_metal": "rim", "mat_concrete": "brick"})
    return r


def build_hw_storm_culvert():
    """Storm drain outlet: walk-through box culvert, clear 6 m wide × 4 m high × 6 m deep (z = -6…0),
    flat floor slab top at y = 0.2 continued by an apron to z = 1.5; portal face at z = 0, open at the back."""
    r = root("hw_storm_culvert")
    C = "mat_overpass_concrete"
    slab(r, "walk_slab", [-3, -.25, .25, 3], [-6, 1.5], 0, .2,
         lambda x, z: "mat_trim" if abs(x) < .25 else "mat_concrete")
    for s in (-1, 1):
        bx(r, "tunnel_wall", (s * 3.0, s * 3.5), (0, 4.2), (-6, -.5), C)
        bx(r, "pier", (s * 3.0, s * 4.6), (0, 5.6), (-.5, 0), C)
        H(r, "wing_wall", [[(s * 3.0, 0, 0), (s * 3.45, 0, 0), (s * 3.45, 5.6, 0), (s * 3.0, 5.6, 0)],
                           [(s * 4.4, 0, 2.0), (s * 4.85, 0, 2.0), (s * 4.85, 1.2, 2.0), (s * 4.4, 1.2, 2.0)]], C)
        extrude(r, "apron", [(s * 3.0, 0), (s * 3.0, 1.5), (s * 4.05, 1.5)], 0, .2, "mat_concrete")
        for z in (-5.0, -3.0, -1.5):
            bx(r, "stain", (s * 2.99, s * 3.0), (.2, 3.6), (z - .2, z + .2), "mat_cable")
    bx(r, "roof_slab", (-3.5, 3.5), (4.2, 4.8), (-6, -.5), C)
    bx(r, "lintel", (-3.0, 3.0), (4.2, 5.6), (-.5, 0), C)
    bx(r, "coping", (-4.75, 4.75), (5.6, 5.8), (-.65, .15), "mat_concrete", .02)
    for x, h in ((-2.2, 1.1), (-.6, .7), (1.4, 1.3), (3.6, .9)):
        bx(r, "stain", (x - .15, x + .15), (5.6 - h, 5.6), (0, .012), "mat_cable")
    # Grate: frame, intact bars on the left, bent bars hanging on the right, a torn panel leaning on the wing.
    bx(r, "grate_frame", (-3.0, 3.0), (4.05, 4.2), (0, .12), "mat_rust")
    bx(r, "grate_frame", (-3.0, -2.88), (.2, 4.05), (0, .12), "mat_rust")
    for i in range(9):
        x = -2.7 + i * .3
        R(r, "grate_bar", (x, .2, .06), (x, 4.05, .06), .028, "mat_rust", 4)
    for y in (1.3, 2.7):
        bx(r, "grate_rail", (-2.95, -.35), (y - .04, y + .04), (.02, .1), "mat_rust")
    for k, x in enumerate((.15, .6, 1.2, 1.7)):
        drop = 1.0 + .15 * k
        T(r, "bent_bar", [(x, 4.05, .06), (x + .04, 4.05 - drop * .5, .3), (x + .12, 4.05 - drop * .85, .75),
                          (x + .2, 4.05 - drop, 1.05)], .028, "mat_rust", 4)
    for x in (2.75, 2.92):
        T(r, "bent_bar", [(x, .2, .06), (x + .02, .45, .25), (x + .05, .55, .55)], .028, "mat_rust", 4)
    T(r, "bent_bar", [(2.92, 4.05, .06), (2.92, 3.2, .1), (2.95, 2.85, .4)], .028, "mat_rust", 4)
    d = Vector((1.4, 0, 2.0)).normalized()
    nrm = Vector((-d.z, 0, d.x))
    b0 = Vector((3.0, .2, 0)) + d * .55 + nrm * .32
    b1 = Vector((3.0, .2, 0)) + d * 1.95 + nrm * .32
    t0 = Vector((3.0, 2.0, 0)) + d * .55 + nrm * .06
    t1 = Vector((3.0, 2.0, 0)) + d * 1.95 + nrm * .06
    for p, q in ((b0, b1), (t0, t1), (b0, t0), (b1, t1)):
        R(r, "torn_panel", tuple(p), tuple(q), .035, "mat_rust", 4)
    for k in range(1, 5):
        f = k / 5
        R(r, "torn_panel", tuple(b0 + (b1 - b0) * f), tuple(t0 + (t1 - t0) * f), .025, "mat_rust", 4)
    # Caged warm white lamp over the portal and a small outfall pipe in the headwall.
    bx(r, "lamp_mount", (-.3, .3), (4.95, 5.25), (0, .12), "mat_trim")
    bx(r, "lamp", (-.22, .22), (4.85, 4.95), (.04, .3), "mat_light_white")
    for x in (-.24, .24):
        R(r, "lamp_cage", (x, 4.83, .32), (x, 5.0, .32), .012, "mat_trim", 3)
    R(r, "outfall", (-3.8, 2.2, -.3), (-3.8, 2.2, .25), .3, "mat_metal", 10)
    R(r, "outfall_throat", (-3.8, 2.2, .25), (-3.8, 2.2, .26), .24, "mat_cable", 10)
    merge(r, {C: "culvert", "mat_concrete": "apron", "mat_rust": "grate", "mat_cable": "stain",
              "mat_trim": "trim", "mat_light_white": "lamp", "mat_metal": "outfall"})
    return r


# --------------------------------------------------------------------------- dachy (roof_)

def _dial(r, face, half, y, radius):
    t, n = face_frame(face)
    c = Vector(on_face(face, half, 0, y))
    up = Vector((0, 1, 0))
    R(r, "dial_plate", tuple(c - n * .02), tuple(c + n * .08), radius + .22, "mat_trim", 16)
    R(r, "dial", tuple(c + n * .08), tuple(c + n * .12), radius, "mat_neon_white", 16)
    for k in range(12):
        a = k * math.tau / 12
        d = t * math.sin(a) + up * math.cos(a)
        e = t * math.cos(a) - up * math.sin(a)
        major = k % 3 == 0
        length = .62 if major else .36
        center = c + d * (radius - .12 - length / 2) + n * .135
        oriented_box(r, "tick", (.16 if major else .09, length, .03), tuple(center), (e, d, n), "mat_trim")
    for angle, length, width, depth in ((-60, 1.3, .2, .16), (60, 1.9, .13, .19)):
        a = math.radians(angle)
        d = t * math.sin(a) + up * math.cos(a)
        e = t * math.cos(a) - up * math.sin(a)
        oriented_box(r, "hand", (width, length, .03), tuple(c + d * (length / 2 - .2) + n * depth), (e, d, n),
                     "mat_trim")
    R(r, "hub", tuple(c + n * .12), tuple(c + n * .22), .14, "mat_metal", 8)


def build_roof_clock_tower():
    """Clock tower on an 8 × 8 m base, 35 m tall: four warm-lit dials with tick marks (no numerals),
    open belfry and a patina helmet. Origin: tower axis."""
    r = root("roof_clock_tower")
    # Plinth split around the door portal (no coplanar faces).
    bx(r, "plinth", (-4, 4), (0, 1.2), (-4, 3.5), "mat_concrete", .03)
    for s in (-1, 1):
        bx(r, "plinth", (s * 1.0, s * 4.0), (0, 1.2), (3.5, 4.0), "mat_concrete", .03)
    bx(r, "door_portal", (-1.0, 1.0), (0, 3.1), (3.5, 3.97), "mat_concrete")
    bx(r, "door", (-.7, .7), (0, 2.6), (3.97, 4.0), "mat_lacquer")
    bx(r, "door_lamp", (-.18, .18), (2.75, 2.9), (3.97, 4.0), "mat_neon_amber")
    bx(r, "shaft", (-3.5, 3.5), (1.2, 20.0), (-3.5, 3.5), "mat_plaster")
    for sx in (-1, 1):
        for sz in (-1, 1):
            bx(r, "pilaster", (sx * 3.05, sx * 3.7), (1.2, 20.0), (sz * 3.05, sz * 3.7), "mat_concrete")
            bx(r, "stage_pilaster", (sx * 3.15, sx * 3.75), (20.5, 26.2), (sz * 3.15, sz * 3.75), "mat_concrete")
    for y in (7.5, 13.5):
        bx(r, "string_course", (-3.8, 3.8), (y, y + .3), (-3.8, 3.8), "mat_concrete")
    bx(r, "cornice", (-3.95, 3.95), (20.0, 20.5), (-3.95, 3.95), "mat_concrete", .04)
    bx(r, "clock_stage", (-3.6, 3.6), (20.5, 26.2), (-3.6, 3.6), "mat_plaster")
    bx(r, "stage_cornice", (-3.9, 3.9), (26.2, 26.5), (-3.9, 3.9), "mat_concrete", .03)
    for face in ("+z", "-z", "+x", "-x"):
        for u, y0, y1 in ((-1.3, 9.0, 12.4), (1.3, 9.0, 12.4), (0, 15.0, 18.6)):
            lit = face == "+z" and u == 0 or face == "-x" and u < 0
            face_box(r, "window_surround", face, 3.5, u, (y0 + y1) / 2, (1.05, y1 - y0 + .3, .04), "mat_concrete")
            face_box(r, "window", face, 3.5, u, (y0 + y1) / 2, (.75, y1 - y0, .07),
                     "mat_neon_amber" if lit else "mat_glass")
            face_box(r, "sill", face, 3.5, u, y0 - .2, (1.15, .14, .14), "mat_concrete")
        _dial(r, face, 3.6, 23.35, 2.3)
    # Open belfry: corner piers, a bell on a timber headstock, balustrade slab.
    bx(r, "belfry_floor", (-3.7, 3.7), (26.5, 26.7), (-3.7, 3.7), "mat_concrete")
    for sx in (-1, 1):
        for sz in (-1, 1):
            bx(r, "belfry_pier", (sx * 2.3, sx * 3.5), (26.7, 29.2), (sz * 2.3, sz * 3.5), "mat_plaster")
    for face in ("+z", "-z", "+x", "-x"):
        face_box(r, "belfry_rail", face, 3.3, 0, 27.55, (4.6, .12, .14), "mat_metal")
        for u in (-1.15, 0, 1.15):
            face_box(r, "baluster", face, 3.3, u, 27.1, (.08, .8, .08), "mat_metal")
    bx(r, "belfry_lintel", (-3.6, 3.6), (29.2, 29.6), (-3.6, 3.6), "mat_concrete", .03)
    bx(r, "headstock", (-2.4, 2.4), (28.75, 28.98), (-.14, .14), "mat_wood")
    H(r, "bell", [[(rad * math.cos(k * math.tau / 10), y, rad * math.sin(k * math.tau / 10)) for k in range(10)]
                  for rad, y in ((1.02, 26.95), (.92, 27.05), (.74, 27.6), (.62, 28.2), (.5, 28.55), (.3, 28.72))],
      "mat_hivis")
    # Octagonal helmet in patina green, finial and an amber beacon at the very top (y = 35).
    octagon = [k * math.tau / 8 + math.pi / 8 for k in range(8)]
    H(r, "helmet", [[(rad * math.cos(a), y, rad * math.sin(a)) for a in octagon]
                    for rad, y in ((3.7, 29.6), (3.55, 29.85), (3.1, 30.7), (2.35, 31.8), (1.4, 32.9),
                                   (.62, 33.8), (.2, 34.35))], "mat_paint")
    for a in octagon:
        T(r, "helmet_rib", [(3.72 * math.cos(a), 29.62, 3.72 * math.sin(a)), (3.12 * math.cos(a), 30.72, 3.12 * math.sin(a)),
                            (2.37 * math.cos(a), 31.82, 2.37 * math.sin(a)), (1.42 * math.cos(a), 32.92, 1.42 * math.sin(a)),
                            (.63 * math.cos(a), 33.82, .63 * math.sin(a)), (.2 * math.cos(a), 34.36, .2 * math.sin(a))],
          .045, "mat_metal", 3)
    R(r, "finial", (0, 34.3, 0), (0, 34.9, 0), .05, "mat_metal", 6)
    R(r, "finial_orb", (0, 34.48, 0), (0, 34.7, 0), .15, "mat_metal", 8)
    R(r, "beacon", (0, 34.9, 0), (0, 35.0, 0), .09, "mat_neon_amber", 6)
    merge(r, {"mat_plaster": "tower", "mat_concrete": "stonework", "mat_trim": "dial_marks",
              "mat_neon_white": "dial", "mat_paint": "helmet", "mat_glass": "window", "mat_neon_amber": "lit_window",
              "mat_metal": "metalwork", "mat_hivis": "bell", "mat_wood": "headstock", "mat_lacquer": "door"})
    return r


def build_roof_giant_sign():
    """Rooftop sign frame 20 × 8 m on scaffolding: blank violet and amber emissive panels facing +Z."""
    r = root("roof_giant_sign")
    xs = (-9.7, -4.85, 0, 4.85, 9.7)
    for x in xs:
        for z in (0, -2.4):
            bx(r, "pad", (x - .3, x + .3), (0, .08), (z - .3, z + .3), "mat_concrete")
            R(r, "post", (x, .08, z), (x, 4.2, z), .07, "mat_metal", 4)
        for y in (2.1, 4.12):
            R(r, "tie", (x, y, 0), (x, y, -2.4), .045, "mat_metal", 4)
        R(r, "side_brace", (x, .2, 0), (x, 4.0, -2.4), .04, "mat_metal", 4)
        bx(r, "pad", (x - .3, x + .3), (0, .08), (-3.9, -3.3), "mat_concrete")
        R(r, "raker", (x, .08, -3.6), (x, 10.2, -.22), .07, "mat_metal", 4)
        R(r, "outrigger", (x, 3.25, 0), (x, 4.0, 1.38), .04, "mat_metal", 4)
    for z in (0, -2.4):
        for y in (2.1, 4.12):
            R(r, "tie", (-9.7, y, z), (9.7, y, z), .045, "mat_metal", 4)
        for i, (a, b) in enumerate(zip(xs, xs[1:])):
            ya, yb = (.2, 4.0) if i % 2 == 0 else (4.0, .2)
            R(r, "brace", (a, ya, z), (b, yb, z), .04, "mat_metal", 4)
    # Sign housing with stiffeners on the back, two blank panels and amber edges on the front face.
    bx(r, "housing", (-10, 10), (4.2, 12.2), (-.2, .55), "mat_trim")
    for y in (6.0, 8.2, 10.4):
        bx(r, "stiffener", (-9.8, 9.8), (y, y + .2), (-.32, -.2), "mat_metal")
    bx(r, "panel_violet", (-9.5, 9.5), (7.1, 11.7), (.55, .6), "mat_neon_violet")
    bx(r, "panel_amber", (-9.5, 9.5), (4.65, 6.7), (.55, .6), "mat_neon_amber")
    for x in (-3.2, 3.2):
        bx(r, "mullion", (x - .08, x + .08), (7.1, 11.7), (.55, .63), "mat_trim")
    for y0, y1 in ((11.7, 12.2), (6.7, 7.1), (4.2, 4.65)):
        bx(r, "frame_rail", (-10, 10), (y0, y1), (.55, .65), "mat_metal")
    for s in (-1, 1):
        bx(r, "frame_rail", (s * 9.5, s * 10), (4.2, 12.2), (.55, .65), "mat_metal")
    # Catwalk with railing and a ladder; floodlights on arms over the top edge.
    bx(r, "catwalk", (-10, 10), (4.0, 4.1), (.65, 1.45), "mat_steel_grating")
    for x in (-10, -7.5, -5, -2.5, 0, 2.5, 5, 7.5):
        R(r, "rail_post", (x + .05, 4.1, 1.4), (x + .05, 5.15, 1.4), .025, "mat_metal", 4)
    for y in (4.62, 5.15):
        R(r, "rail", (-9.95, y, 1.4), (8.75, y, 1.4), .025, "mat_metal", 4)
    for x in (9.05, 9.45):
        R(r, "ladder_rail", (x, 0, 1.52), (x, 5.15, 1.52), .025, "mat_metal", 4)
    for i in range(12):
        y = .35 + i * .38
        R(r, "rung", (9.05, y, 1.52), (9.45, y, 1.52), .016, "mat_metal", 3)
    for x in (-8, -4, 0, 4, 8):
        R(r, "lamp_arm", (x, 12.1, .3), (x, 12.5, 1.35), .04, "mat_trim", 4)
        PB(r, "lamp_head", (.5, .22, .32), (x, 12.5, 1.42), "mat_trim", 0, -25)
        PB(r, "lamp_lens", (.42, .02, .24), (x, 12.38, 1.46), "mat_light_white", 0, -25)
    bx(r, "junction_box", (-9.3, -8.8), (.4, 1.1), (-2.55, -2.25), "mat_machine")
    T(r, "feed_cable", [(-9.05, 1.0, -2.25), (-9.05, 3.9, -2.2), (-9.05, 4.3, -.25)], .03, "mat_cable", 4)
    merge(r, {"mat_metal": "scaffold", "mat_trim": "housing", "mat_neon_violet": "panel_violet",
              "mat_neon_amber": "panel_amber", "mat_steel_grating": "catwalk", "mat_light_white": "lamp_lens",
              "mat_concrete": "pad", "mat_machine": "junction_box", "mat_cable": "feed_cable"})
    return r


def build_roof_stairwell_hut():
    """Roof exit of a stairwell, 3.2 × 3 × 4.5 m: open doorway 1.2 × 2.2 m in +Z under a small canopy.
    Inside: free floor (the roof) x ±1.35, z -2.0…1.4."""
    r = root("roof_stairwell_hut")
    walls = [((-1.6, 1.6), (-2.25, -2.0)), ((-1.6, -1.35), (-2.0, 1.4)), ((1.35, 1.6), (-2.0, 1.4)),
             ((-1.6, -.68), (1.4, 1.65)), ((.68, 1.6), (1.4, 1.65))]
    for xs, zs in walls:
        bx(r, "base_course", xs, (0, .3), zs, "mat_concrete")
        bx(r, "wall", xs, (.3, 2.8), zs, "mat_plaster")
    bx(r, "lintel", (-.68, .68), (2.28, 2.8), (1.4, 1.65), "mat_plaster")
    bx(r, "roof_slab", (-1.6, 1.6), (2.8, 2.92), (-2.25, 1.65), "mat_concrete")
    bx(r, "roof_membrane", (-1.5, 1.5), (2.92, 3.0), (-2.15, 1.55), "mat_roof_tar")
    # Steel door frame inside the reveal (clear 1.2 × 2.2 m) and the leaf swung inwards to the left.
    for s in (-1, 1):
        bx(r, "door_frame", (s * .6, s * .68), (0, 2.28), (1.38, 1.67), "mat_metal")
    bx(r, "door_frame", (-.68, .68), (2.2, 2.28), (1.38, 1.67), "mat_metal")
    PB(r, "door_leaf", (.05, 2.16, 1.15), (-.68, 1.1, .8), "mat_lacquer", -3)
    bx(r, "keypad", (.8, .98), (1.15, 1.45), (1.65, 1.68), "mat_machine")
    bx(r, "keypad_status", (.85, .93), (1.38, 1.42), (1.68, 1.69), "mat_neon_amber")
    # Canopy over the door on two brackets, warm white lamp beneath it; interior ceiling light.
    bx(r, "canopy", (-1.1, 1.1), (2.55, 2.68), (1.65, 2.25), "mat_metal")
    bx(r, "canopy_edge", (-1.1, 1.1), (2.5, 2.55), (2.2, 2.25), "mat_trim")
    for s in (-1, 1):
        R(r, "canopy_bracket", (s * 1.0, 2.05, 1.66), (s * 1.0, 2.55, 2.15), .03, "mat_trim", 4)
    bx(r, "wall_lamp", (-.18, .18), (2.36, 2.48), (1.65, 1.77), "mat_trim")
    bx(r, "wall_lamp_lens", (-.14, .14), (2.33, 2.36), (1.67, 1.75), "mat_light_white")
    bx(r, "ceiling_light", (-.25, .25), (2.74, 2.8), (-.6, -.1), "mat_light_white")
    bx(r, "parapet_stub", (-1.6, 1.6), (2.92, 3.0), (-2.25, -2.15), "mat_concrete")
    merge(r, {"mat_plaster": "wall", "mat_concrete": "base_course", "mat_metal": "door_frame",
              "mat_lacquer": "door_leaf", "mat_roof_tar": "roof", "mat_trim": "trim",
              "mat_light_white": "lamp", "mat_machine": "keypad", "mat_neon_amber": "status"})
    return r


def build_roof_skylight():
    """Flat skylight curb 3 × 0.8 × 2 m: frame and glass flush on one top plane (y = 0.8)."""
    r = root("roof_skylight")
    xs = [-1.5, -1.4, -.52, -.44, .44, .52, 1.4, 1.5]
    zs = [-1.0, -.9, -.04, .04, .9, 1.0]
    panes_x = ((-1.4, -.52), (-.44, .44), (.52, 1.4))
    panes_z = ((-.9, -.04), (.04, .9))

    def top(x, z):
        inside = any(a < x < b for a, b in panes_x) and any(a < z < b for a, b in panes_z)
        return "mat_glass" if inside else "mat_metal"

    slab(r, "walk_slab", xs, zs, 0, .8, top, "mat_roof_hvac_metal")
    merge(r, {})
    return r


def build_roof_chimney_stack():
    """Brick chimney stack 2 × 3 × 1 m with four pots, a cowl and an old antenna strapped to it."""
    r = root("roof_chimney_stack")
    B_ = "mat_flood_brick_algae"
    bx(r, "flashing", (-.94, .94), (0, .14), (-.44, .44), "mat_roof_tar")
    bx(r, "stack", (-.9, .9), (0, 2.3), (-.4, .4), B_)
    bx(r, "band", (-.93, .93), (1.55, 1.65), (-.43, .43), B_)
    bx(r, "corbel", (-1.0, 1.0), (2.3, 2.45), (-.5, .5), B_)
    bx(r, "cap", (-.95, .95), (2.45, 2.53), (-.45, .45), "mat_concrete")
    for k, x in enumerate((-.66, -.22, .22, .66)):
        height = (.4, .32, .44, .36)[k]
        R(r, "pot", (x, 2.53, 0), (x, 2.53 + height, 0), .13, "mat_rust", 8, .115)
        R(r, "pot_rim", (x, 2.53 + height - .06, 0), (x, 2.53 + height, 0), .145, "mat_rust", 8)
        R(r, "pot_throat", (x, 2.53 + height, 0), (x, 2.537 + height, 0), .1, "mat_cable", 8)
    R(r, "cowl_stem", (-.22, 2.85, 0), (-.22, 2.92, 0), .04, "mat_metal", 6)
    R(r, "cowl", (-.22, 2.92, 0), (-.22, 3.0, 0), .2, "mat_metal", 8, .04)
    R(r, "antenna_mast", (.96, 1.2, 0), (.96, 2.98, 0), .025, "mat_metal", 4)
    for y in (2.6, 2.82):
        R(r, "antenna_element", (.96, y, -.36), (.96, y, .36), .012, "mat_metal", 3)
    for y in (1.35, 2.0):
        bx(r, "strap", (.9, .99), (y - .03, y + .03), (-.06, .06), "mat_trim")
    T(r, "coax", [(.96, 1.25, .02), (.92, 1.0, .1), (.9, .5, .12), (.9, .15, .1)], .012, "mat_cable", 3)
    merge(r, {B_: "stack", "mat_concrete": "cap", "mat_rust": "pot", "mat_cable": "pot_throat", "mat_metal": "cowl",
              "mat_roof_tar": "flashing", "mat_trim": "strap"})
    return r


# --------------------------------------------------------------------------- doki (dock_)

def build_dock_pontoon():
    """Floating pontoon 6 × 2.4 m, flat deck top at y = 0.5 on drum floats; cleats on the edges."""
    r = root("dock_pontoon")

    def top(x, z):
        if abs(x) > 2.92 or abs(z) > 1.12:
            return "mat_metal"
        if abs(z) > 1.0:
            return "mat_hivis"
        return "mat_boardwalk_planks"

    slab(r, "walk_slab", [-3, -2.92, 2.92, 3], [-1.2, -1.12, -1.0, 1.0, 1.12, 1.2], .3, .5, top, "mat_metal")
    for s in (-1, 1):
        bx(r, "stringer", (-2.95, 2.95), (.24, .3), (s * .95, s * 1.15), "mat_metal")
        bx(r, "fender", (-2.8, 2.8), (.16, .3), (s * 1.1, s * 1.2), "mat_rubber_fender")
        for x in (-2.2, -.73, .73, 2.2):
            bx(r, "float", (x - .66, x + .66), (0, .26), (s * .12, s * 1.06), "mat_rubber", .05)
    for x in (-2.65, 2.65):
        for z in (-1.0, 1.0):
            bx(r, "cleat_base", (x - .12, x + .12), (.5, .53), (z - .09, z + .09), "mat_trim")
            R(r, "cleat", (x, .53, z), (x, .74, z), .07, "mat_metal", 8)
            lamp = x < 0 and z > 0
            R(r, "marker_lamp" if lamp else "cleat_head", (x, .74, z), (x, .8, z), .08 if lamp else .1,
              "mat_neon_amber" if lamp else "mat_metal", 8)
            R(r, "cleat_horn", (x - .17, .7, z), (x + .17, .7, z), .035, "mat_metal", 6)
    merge(r, {"mat_metal": "frame", "mat_rubber": "float", "mat_rubber_fender": "fender", "mat_trim": "cleat_base",
              "mat_neon_amber": "marker_lamp"})
    return r


def build_dock_skiff():
    """Open skiff about 6.2 × 2 m, length along X with the bow at +X (no walking collision)."""
    r = root("dock_skiff")
    stations = ((-2.7, .82, .88, .12), (-2.0, .93, .88, .03), (-.9, .98, .9, 0), (.4, .95, .94, 0),
                (1.5, .8, 1.0, .06), (2.4, .48, 1.1, .26), (2.95, .06, 1.2, .72))
    rings = []
    for x, b, sheer, keel in stations:
        chine = keel + .22
        t = min(.05, b * .4)
        outer = [(-b, sheer), (-b * .9, chine), (0, keel), (b * .9, chine), (b, sheer)]
        inner = [(b - t, sheer), (b * .9 - t, chine + t), (0, keel + t + .08), (-(b * .9 - t), chine + t),
                 (-(b - t), sheer)]
        rings.append([(x, y, z) for z, y in outer + inner])
    shell(r, "hull", rings, lambda j: "mat_paint" if j < 4 else ("mat_wood" if j in (5, 6, 7, 8) else "mat_rubber"),
          "mat_paint")
    for s in (-1, 1):
        T(r, "rub_rail", [(x, sheer - .04, s * (b + .01)) for x, b, sheer, _ in stations[:-1]], .03, "mat_rubber", 4)
        T(r, "waterline", [(x, keel + .3, s * (b * .93)) for x, b, sheer, keel in stations[1:-2]], .015,
          "mat_trim", 3)
    for x, b in ((-1.3, .95), (.6, .93)):
        bx(r, "thwart", (x - .13, x + .13), (.56, .62), (-b + .08, b - .08), "mat_wood")
    bx(r, "transom_pad", (-2.76, -2.68), (.5, .86), (-.3, .3), "mat_wood")
    bx(r, "motor_bracket", (-2.88, -2.74), (.55, .86), (-.12, .12), "mat_trim")
    bx(r, "motor_cowl", (-3.25, -2.82), (.78, 1.18), (-.2, .2), "mat_machine", .05)
    R(r, "motor_shaft", (-3.0, .8, 0), (-3.0, .12, 0), .05, "mat_metal", 6)
    bx(r, "motor_skeg", (-3.1, -2.92), (0, .2), (-.04, .04), "mat_metal")
    R(r, "tiller", (-2.9, 1.0, 0), (-2.2, 1.05, .15), .025, "mat_trim", 4)
    R(r, "stern_pole", (-2.55, .8, .62), (-2.55, 1.62, .62), .025, "mat_metal", 4)
    R(r, "stern_light", (-2.55, 1.62, .62), (-2.55, 1.72, .62), .045, "mat_neon_amber", 6)
    R(r, "bow_light", (2.78, 1.14, 0), (2.78, 1.22, 0), .04, "mat_light_white", 6)
    for z in (-.25, .25):
        R(r, "oar", (-1.9, .66, z), (1.6, .7, z * .6), .025, "mat_wood", 4)
        bx(r, "oar_blade", (1.45, 1.95), (.66, .7), (z * .6 - .07, z * .6 + .07), "mat_wood")
    bx(r, "tarp_bundle", (1.7, 2.3), (.36, .62), (-.35, .3), "mat_market_tarp", .08)
    R(r, "fuel_can", (-2.3, .2, -.45), (-2.3, .5, -.45), .13, "mat_hivis", 6)
    merge(r, {"mat_rubber": "rub_rail", "mat_wood": "thwart", "mat_trim": "trim", "mat_machine": "motor",
              "mat_metal": "motor_shaft", "mat_neon_amber": "stern_light", "mat_light_white": "bow_light",
              "mat_market_tarp": "tarp", "mat_hivis": "fuel_can"}, keep=("walk_slab", "hull"))
    return r


def _arch_window(r, x, z_face, s, y0, y1, half, lit):
    """Tall window with a segmental head on a wall face z = z_face, outward sign s (±1)."""
    bx(r, "window", (x - half, x + half), (y0, y1), (z_face, z_face + s * .05), "mat_glass")
    bx(r, "glazing_bar", (x - .03, x + .03), (y0, y1), (z_face, z_face + s * .07), "mat_trim")
    for y in (y0 + (y1 - y0) * .5,):
        bx(r, "glazing_bar", (x - half, x + half), (y - .03, y + .03), (z_face, z_face + s * .07), "mat_trim")
    head = [(x + half * math.cos(a), y1 + half * .55 * math.sin(a)) for a in [k * math.pi / 4 for k in range(5)]]
    extrude_z(r, "fanlight", [(x + half, y1)] + head[1:-1] + [(x - half, y1)], z_face, z_face + s * .05,
              "mat_neon_amber" if lit else "mat_glass")
    arch = [(x + (half + .22) * math.cos(a), y1 + (half * .55 + .22) * math.sin(a))
            for a in [k * math.pi / 4 for k in range(5)]]
    inner = list(reversed(head))
    extrude_z(r, "arch", arch + inner, z_face, z_face + s * .08, "mat_canal_stone_wall")
    bx(r, "sill", (x - half - .12, x + half + .12), (y0 - .14, y0), (z_face, z_face + s * .14), "mat_canal_stone_wall")


def build_dock_pump_house():
    """Brick pump house 16 × 10 m (gable roof, ridge along X), walk-through hall with 3 × 3 m doors on both
    gable ends, flat floor top at y = 0.1; two 1.8 m pipes leave the +Z wall and run down to outlets
    at the canal edge (z = 11). Origin: centre of the building footprint."""
    r = root("dock_pump_house")
    BR, ST = "mat_flood_brick_algae", "mat_canal_stone_wall"
    slab(r, "walk_slab", [-7.9, 7.9], [-4.3, 4.3], 0, .1, lambda x, z: "mat_concrete", "mat_concrete")
    for s in (-1, 1):
        zs = (s * 4.3, s * 4.8)
        bx(r, "base_course", (-7.9, 7.9), (0, 1.0), zs, ST)
        bx(r, "wall", (-7.9, 7.9), (1.0, 8.4), zs, BR)
        bx(r, "eaves_course", (-7.9, 7.9), (8.15, 8.4), (s * 4.8, s * 4.86), ST)
        xs = (s * 7.4, s * 7.9)
        for z0, z1 in ((-4.3, -3.0), (0, 4.3)):
            bx(r, "base_course", xs, (.1, 1.0), (z0, z1), ST)
            bx(r, "wall", xs, (1.0, 8.4), (z0, z1), BR)
        bx(r, "wall", xs, (3.1, 8.4), (-3.0, 0), BR)
        extrude_x(r, "gable", [(-4.8, 8.4), (4.8, 8.4), (4.8, 8.92), (0, 11.32), (-4.8, 8.92)], s * 7.4, s * 7.9, BR)
        for zs_, pitch in ((2.4, 26.565), (-2.4, -26.565)):
            PB(r, "gable_coping", (.62, .14, 5.42), (s * 7.65, 10.17, zs_), ST, 0, pitch)
        # Door surround: stone quoins, steel lintel, rolled-up shutter box and an amber lamp.
        xo = s * 7.9
        for z0, z1 in ((-3.25, -3.0), (0, .25)):
            bx(r, "quoin", (xo, xo + s * .06), (.1, 3.1), (z0, z1), ST)
        bx(r, "door_lintel", (xo, xo + s * .08), (3.1, 3.4), (-3.3, .3), "mat_metal")
        bx(r, "shutter_box", (xo, xo + s * .1), (3.4, 3.7), (-3.15, .15), "mat_trim")
        bx(r, "door_lamp", (xo, xo + s * .1), (3.9, 4.1), (.5, .75), "mat_neon_amber")
        bx(r, "oculus", (xo, xo + s * .05), (9.0, 9.9), (-.45, .45), "mat_neon_amber")
        bx(r, "oculus_frame", (xo, xo + s * .04), (8.85, 10.05), (-.6, .6), ST)
    # Roof planes between the gable parapets, clerestory monitor on the ridge, chimney.
    H(r, "roof", [[(x, y, z) for z, y in ((-5.0, 8.5), (0, 11.0), (5.0, 8.5), (5.0, 8.32), (0, 10.82), (-5.0, 8.32))]
                  for x in (-7.4, 7.4)], "mat_trim")
    R(r, "ridge_cap", (-7.4, 11.0, 0), (7.4, 11.0, 0), .12, "mat_metal", 4)
    bx(r, "monitor", (-4.0, 4.0), (10.2, 11.7), (-.95, .95), "mat_trim")
    H(r, "monitor_roof", [[(x, y, z) for z, y in ((-1.25, 11.6), (0, 12.15), (1.25, 11.6), (1.25, 11.5), (0, 12.05), (-1.25, 11.5))]
                          for x in (-4.2, 4.2)], "mat_metal")
    for s in (-1, 1):
        for i in range(6):
            x = -3.3 + i * 1.32
            bx(r, "monitor_light", (x - .5, x + .5), (10.95, 11.4), (s * .95, s * .98), "mat_neon_amber")
    bx(r, "chimney", (-6.7, -5.7), (9.0, 12.2), (-3.0, -2.2), BR)
    bx(r, "chimney_cap", (-6.8, -5.6), (12.2, 12.4), (-3.1, -2.1), ST)
    # Windows: five bays on -Z, three on +Z (between the pipes); amber fanlights.
    for x in (-5.6, -2.8, 0, 2.8, 5.6):
        _arch_window(r, x, -4.8, -1, 2.0, 6.4, .7, True)
    for x in (-5.8, 0, 5.8):
        _arch_window(r, x, 4.8, 1, 2.0, 6.4, .7, True)
    # Pumps inside along +Z, risers and the two big pipes out to the canal edge.
    for x in (-3.0, 3.0):
        bx(r, "pump_plinth", (x - 1.4, x + 1.4), (.1, .5), (1.4, 3.8), "mat_concrete")
        R(r, "pump_casing", (x - .9, 1.6, 2.6), (x + .9, 1.6, 2.6), 1.1, "mat_paint", 12)
        bx(r, "motor", (x + .9, x + 1.35), (1.0, 2.2), (2.0, 3.2), "mat_machine", .04)
        pipe = [(x, 2.5, 2.6), (x, 4.2, 2.6), (x, 4.85, 2.9), (x, 5.0, 3.6), (x, 5.0, 5.5), (x, 4.8, 6.25),
                (x, 4.15, 6.85), (x, 2.2, 8.3), (x, 1.45, 9.0), (x, 1.2, 9.7), (x, 1.2, 11.0)]
        T(r, "pipe", pipe, .9, "mat_rust", 12)
        for a, b in (((x, 4.98, 5.0), (x, 4.98, 5.2)), ((x, 1.2, 10.05), (x, 1.2, 10.25)),
                     ((x, 1.2, 10.85), (x, 1.2, 11.0)), ((x, 3.4, 7.4), (x, 3.25, 7.53))):
            R(r, "flange", a, b, 1.0, "mat_metal", 12)
        hinge, ang = Vector((x, 2.15, 11.02)), math.radians(18)
        down = Vector((0, -math.cos(ang), math.sin(ang)))
        normal = Vector((0, math.sin(ang), math.cos(ang)))
        c = hinge + down * .95
        R(r, "flap_valve", tuple(c), tuple(c + normal * .08), .95, "mat_trim", 12)
        R(r, "flap_hinge", (x - .3, 2.15, 11.02), (x + .3, 2.15, 11.02), .07, "mat_metal", 6)
        for z in (9.9, 10.6):
            bx(r, "saddle", (x - .75, x + .75), (0, .5), (z - .22, z + .22), "mat_concrete")
        for dx in (-1.0, 1.0):
            R(r, "trestle", (x + dx, .12, 7.55), (x + dx * .25, 2.75, 7.55), .09, "mat_metal", 6)
        R(r, "trestle_tie", (x - .75, .9, 7.55), (x + .75, .9, 7.55), .06, "mat_metal", 4)
        bx(r, "trestle_foot", (x - 1.2, x + 1.2), (0, .15), (7.35, 7.75), "mat_concrete")
        bx(r, "pipe_lamp", (x - .2, x + .2), (6.6, 6.8), (4.8, 4.95), "mat_neon_amber")
    # Travelling crane beams inside (seen through the doors).
    for z in (-2.0, 2.0):
        bx(r, "crane_beam", (-7.4, 7.4), (7.0, 7.45), (z - .2, z + .2), "mat_crane_paint")
    bx(r, "crane_bridge", (-.25, .25), (7.45, 7.9), (-2.2, 2.2), "mat_crane_paint")
    R(r, "crane_hook", (0, 7.45, 0), (0, 5.6, 0), .03, "mat_cable", 4)
    bx(r, "hook_block", (-.18, .18), (5.3, 5.6), (-.12, .12), "mat_hivis")
    merge(r, {BR: "brick", ST: "stonework", "mat_trim": "roof", "mat_metal": "steelwork", "mat_rust": "pipe",
              "mat_neon_amber": "amber_light", "mat_glass": "window", "mat_paint": "pump", "mat_machine": "motor",
              "mat_concrete": "concrete", "mat_crane_paint": "crane", "mat_cable": "crane_rope",
              "mat_hivis": "hook_block"})
    return r


def build_dock_lock_gate():
    """Pair of lock gate leaves across a 10 m canal (x = -5…5), 6 m high, between stone abutments
    (x = ±5…6); flat walkway 1.4 m wide (z = ±0.7) with its top at y = 6.0, railings on both sides."""
    r = root("dock_lock_gate")
    ST = "mat_canal_stone_wall"
    for s in (-1, 1):
        bx(r, "abutment", (s * 5.0, s * 6.0), (0, 5.75), (-1.2, 1.2), ST)
        bx(r, "coping", (s * 5.0, s * 6.0), (5.75, 6.0), (-1.2, 1.2), "mat_concrete")
        bx(r, "gauge_board", (s * 4.96, s * 5.0), (.4, 5.4), (.9, 1.12), "mat_trim")
        for k in range(10):
            y = .6 + k * .5
            bx(r, "gauge_mark", (s * 4.94, s * 4.96), (y, y + .06), (.92, 1.1 if k % 2 == 0 else 1.0), "mat_hivis")
        R(r, "signal_post", (s * 5.6, 6.0, -1.0), (s * 5.6, 7.3, -1.0), .05, "mat_metal", 6)
        bx(r, "signal_head", (s * 5.45, s * 5.75), (7.0, 7.45), (-1.12, -.92), "mat_trim")
        bx(r, "signal_go", (s * 5.52, s * 5.68), (7.24, 7.38), (-.92, -.9), "mat_neon_green")
        bx(r, "signal_wait", (s * 5.52, s * 5.68), (7.06, 7.2), (-.92, -.9), "mat_neon_amber")
        # Leaf: skin plate upstream (-Z), girders and stiffeners downstream (+Z), heel and mitre posts.
        x0, x1 = s * .03, s * 4.95
        bx(r, "skin_plate", (x0, x1), (0, 5.75), (-.45, -.38), "mat_lacquer")
        for y in (.3, 1.4, 2.5, 3.6, 4.7):
            bx(r, "girder", (x0, x1), (y, y + .38), (-.38, .45), "mat_lacquer")
        for x in (s * 1.65, s * 3.25):
            bx(r, "stiffener", (x - .1, x + .1), (0, 5.75), (-.38, .42), "mat_lacquer")
        bx(r, "mitre_post", (x0, s * .33), (0, 5.75), (-.45, .45), "mat_lacquer")
        R(r, "heel_post", (s * 4.72, 0, 0), (s * 4.72, 5.75, 0), .3, "mat_lacquer", 10)
        for x, h in ((s * 1.0, 1.4), (s * 2.4, 2.1), (s * 4.0, 1.1)):
            bx(r, "rust_streak", (x - .08, x + .08), (4.7 - h, 4.7), (.45, .46), "mat_rust")
        bx(r, "algae_line", (x0, x1), (1.6, 1.9), (-.46, -.45), "mat_paint")
        # Paddle gear outside the downstream railing, hydraulic ram below the walkway.
        xg = s * 2.4
        bx(r, "gear_bracket", (xg - .15, xg + .15), (5.4, 5.75), (.45, 1.15), "mat_lacquer")
        bx(r, "rack_post", (xg - .1, xg + .1), (5.75, 6.95), (.95, 1.12), "mat_metal")
        bx(r, "gearbox", (xg - .24, xg + .24), (6.35, 6.7), (.88, 1.15), "mat_hivis")
        R(r, "crank", (xg + s * .24, 6.52, 1.0), (xg + s * .5, 6.52, 1.0), .025, "mat_metal", 4)
        R(r, "ram", (s * 5.0, 5.2, 1.0), (s * 3.9, 5.2, .7), .12, "mat_metal", 8)
        R(r, "ram_rod", (s * 3.9, 5.2, .7), (s * 2.9, 5.2, .47), .05, "mat_trim", 6)
    slab(r, "walk_slab", [-5.0, 5.0], [-.7, .7], 5.75, 6.0, lambda x, z: "mat_boardwalk_planks", "mat_metal")
    posts = (-4.9, -3.3, -1.7, -.12, .12, 1.7, 3.3, 4.9)
    for z in (-.76, .76):
        for x in posts:
            bx(r, "rail_bracket", (x - .04, x + .04), (5.8, 5.95), (min(z, z * .92), max(z, z * .92)), "mat_metal")
            R(r, "rail_post", (x, 5.8, z), (x, 7.05, z), .03, "mat_metal", 4)
        for a, b in ((-4.9, -.12), (.12, 4.9)):
            for y in (6.55, 7.05):
                R(r, "rail", (a, y, z), (b, y, z), .03, "mat_metal", 4)
        for x in (-.12, .12):
            R(r, "rail_lamp", (x, 7.05, z), (x, 7.15, z), .045, "mat_neon_amber", 6)
    merge(r, {ST: "abutment", "mat_concrete": "coping", "mat_lacquer": "leaf", "mat_metal": "steelwork",
              "mat_trim": "trim", "mat_hivis": "gauge_mark", "mat_neon_amber": "amber_light",
              "mat_neon_green": "signal_go", "mat_rust": "rust_streak", "mat_paint": "algae_line"})
    return r


def build_dock_barge():
    """Market barge 30 × 8 m (length along X): keel y = 0, design waterline y = 1.0, flat deck top y = 2.6
    (1.6 m above the water); wheelhouse at +X, open deck for stalls, gangway gaps mid-ships.
    The deck overhangs the hull sides (z = ±3.75) by 0.25 m; old tyres hang under it as fenders."""
    r = root("dock_barge")

    def section(x, end):
        ys = (2.3, 2.0, 1.9, 1.75) if end else (2.3, 1.2, 1.0, .35)
        bottom = 1.6 if end else 0.0
        half = [(-3.75, ys[0]), (-3.75, ys[1]), (-3.75, ys[2]), (-3.7 if end else -3.75, ys[3]), (-3.4, bottom)]
        mirrored = [(-z, y) for z, y in reversed(half)]
        return [(x, y, z) for z, y in half + mirrored]

    rings = [section(-15, True), section(-13, False), section(13, False), section(15, True)]
    bands = ["mat_lacquer", "mat_rust", "mat_trim", "mat_trim", "mat_trim", "mat_trim", "mat_trim", "mat_rust",
             "mat_lacquer", "mat_lacquer"]
    shell(r, "hull", rings, lambda j: bands[j] if j < len(bands) else "mat_lacquer", "mat_lacquer")

    def deck(x, z):
        return "mat_boardwalk_planks" if abs(x) < 14.7 and abs(z) < 3.7 else "mat_metal"

    slab(r, "walk_slab", [-15, -14.7, 14.7, 15], [-4, -3.7, 3.7, 4], 2.3, 2.6, deck, "mat_lacquer")
    for s in (-1, 1):
        bx(r, "fender", (-14.5, 14.5), (2.08, 2.3), (s * 3.75, s * 3.95), "mat_rubber_fender")
        for x in (-11.5, -6.5, 4.0, 8.5):
            ring(r, "tyre", (x, 1.5, s * 3.86), .32, "z", .09, "mat_rubber", 8)
            T(r, "tyre_rope", [(x, 1.82, s * 3.86), (x, 2.3, s * 3.86)], .02, "mat_hivis", 3)
        for a, b in ((-14.0, -1.6), (1.6, 11.0)):
            bx(r, "bulwark", (a, b), (2.6, 3.0), (s * 3.86, s * 3.96), "mat_lacquer")
            bx(r, "bulwark_cap", (a, b), (3.0, 3.05), (s * 3.84, s * 3.98), "mat_metal")
        for x in (-12.0, -6.0, 6.0):
            bx(r, "deck_lamp", (x - .15, x + .15), (3.05, 3.15), (s * 3.86, s * 3.96), "mat_neon_amber")
        for x in (-14.3, 14.3):
            bx(r, "bitt_plate", (x - .35, x + .35), (2.6, 2.65), (s * 3.3 - .2, s * 3.3 + .2), "mat_metal")
            for dx in (-.2, .2):
                R(r, "bitt", (x + dx, 2.65, s * 3.3), (x + dx, 3.05, s * 3.3), .11, "mat_metal", 8)
        for x in (-10.0, 0.0, 10.0):
            bx(r, "draft_mark", (x - .3, x + .3), (1.02, 1.08), (s * 3.75, s * 3.76), "mat_hivis")
        for x in (-14.2, 14.2):
            ring(r, "rope_coil", (x, 2.64, s * 2.65), .26, "y", .035, "mat_hivis", 10)
    # Wheelhouse at +X, floodlight over the deck, bow mast and winch at -X (anchors for lantern strings).
    bx(r, "wheelhouse", (11.4, 14.2), (2.6, 4.8), (-1.6, 1.6), "mat_lacquer", .03)
    for s in (-1, 1):
        bx(r, "wheelhouse_glass", (11.6, 14.0), (3.9, 4.5), (s * 1.6, s * 1.63), "mat_glass")
    bx(r, "wheelhouse_glass", (14.2, 14.23), (3.9, 4.5), (-1.3, 1.3), "mat_glass")
    bx(r, "wheelhouse_glow", (11.37, 11.4), (3.9, 4.5), (-1.3, -.2), "mat_neon_amber")
    bx(r, "wheelhouse_door", (11.37, 11.4), (2.6, 4.4), (.2, 1.1), "mat_trim")
    bx(r, "wheelhouse_roof", (11.2, 14.4), (4.8, 5.0), (-1.8, 1.8), "mat_trim")
    bx(r, "floodlight", (11.25, 11.4), (4.55, 4.75), (-.3, .3), "mat_light_white")
    R(r, "radio_mast", (13.6, 5.0, 0), (13.6, 6.6, 0), .04, "mat_metal", 4)
    R(r, "mast_light", (13.6, 6.6, 0), (13.6, 6.72, 0), .06, "mat_neon_amber", 6)
    R(r, "bow_mast", (-14.55, 2.6, 0), (-14.55, 6.2, 0), .07, "mat_metal", 6)
    R(r, "bow_lamp", (-14.55, 6.2, 0), (-14.55, 6.35, 0), .1, "mat_neon_amber", 6)
    bx(r, "winch", (-14.85, -14.25), (2.6, 3.1), (-1.0, -.4), "mat_machine", .03)
    R(r, "winch_drum", (-14.55, 2.95, -.35), (-14.55, 2.95, .35), .16, "mat_metal", 8)
    merge(r, {"mat_lacquer": "hull_paint", "mat_metal": "deck_fittings", "mat_rubber_fender": "fender",
              "mat_glass": "wheelhouse_glass", "mat_neon_amber": "amber_light", "mat_trim": "trim",
              "mat_light_white": "floodlight", "mat_machine": "winch", "mat_hivis": "rope",
              "mat_rubber": "tyre"}, keep=("walk_slab", "hull"))
    return r


def build_dock_mooring_post():
    """Mooring dolphin: three timber piles bound with steel bands, rope and an amber marker lamp.
    Origin: cluster axis on the canal bed (y = 0)."""
    r = root("dock_mooring_post")
    piles = ((-.21, -.12, 4.0), (.22, -.1, 3.6), (0, .25, 3.3))
    for x, z, h in piles:
        R(r, "pile", (x, 0, z), (x, h - .12, z), .2, "mat_wood", 8)
        R(r, "pile_top", (x, h - .12, z), (x, h, z), .2, "mat_wood", 8, .13)
        R(r, "pile_cap", (x, h - .14, z), (x, h - .1, z), .21, "mat_metal", 8)
        R(r, "algae", (x, .9, z), (x, 1.45, z), .205, "mat_paint", 8)
    for y in (1.6, 2.9):
        ring(r, "band", (0, y, 0), .45, "y", .04, "mat_rust", 12)
    ring(r, "rope", (0, 2.2, 0), .47, "y", .035, "mat_hivis", 12)
    T(r, "rope_tail", [(.43, 2.2, .18), (.5, 1.9, .35), (.48, 1.5, .45), (.4, 1.2, .5)], .035, "mat_hivis", 4)
    R(r, "lamp_stem", (-.21, 4.0, -.12), (-.21, 4.08, -.12), .03, "mat_metal", 4)
    R(r, "marker_lamp", (-.21, 4.08, -.12), (-.21, 4.2, -.12), .07, "mat_neon_amber", 6)
    merge(r, {"mat_wood": "pile", "mat_metal": "cap", "mat_rust": "band", "mat_hivis": "rope",
              "mat_paint": "algae", "mat_neon_amber": "marker_lamp"})
    return r


def build_dock_half_sunken_car():
    """Compact car nose-down in the water (pitched 21°, rolled 11°); lowest point y = 0.
    Front +Z; no red: tail lamps are dull amber plastic."""
    r = root("dock_half_sunken_car")
    H(r, "body", [[(-w, lo, z), (w, lo, z), (w * .97, hi, z), (-w * .97, hi, z)]
                  for z, w, lo, hi in ((-2.1, .8, .32, .95), (-1.65, .88, .27, 1.0), (1.35, .88, .27, .93),
                                       (1.85, .82, .3, .75), (2.12, .74, .36, .62))], "mat_lacquer")
    H(r, "cabin", [[(-w, .96, z), (w, .96, z), (wt, top, z), (-wt, top, z)]
                   for z, w, wt, top in ((-1.55, .84, .66, 1.05), (-1.05, .84, .66, 1.42), (.3, .84, .66, 1.44),
                                         (.95, .84, .72, .99))], "mat_glass")
    bx(r, "roof_panel", (-.67, .67), (1.42, 1.47), (-1.02, .3), "mat_lacquer")
    for s in (-1, 1):
        for z in (-1.3, 1.3):
            R(r, "wheel", (s * .72, .33, z), (s * .92, .33, z), .33, "mat_rubber", 10)
            R(r, "hub", (s * .92, .33, z), (s * .94, .33, z), .18, "mat_metal", 8)
        bx(r, "rust_patch", (s * .885, s * .9), (.35, .7), (-.8, .1), "mat_rust")
        bx(r, "door_seam", (s * .88, s * .9), (.32, .95), (-.12, -.1), "mat_trim")
        bx(r, "headlight", (s * .38, s * .68), (.6, .72), (2.1, 2.14), "mat_plastic")
        bx(r, "tail_lamp", (s * .4, s * .72), (.72, .82), (-2.12, -2.09), "mat_hivis")
        bx(r, "mirror", (s * .88, s * 1.0), (.98, 1.08), (.75, .9), "mat_trim")
    bx(r, "bumper", (-.82, .82), (.3, .42), (2.1, 2.2), "mat_trim")
    bx(r, "rear_bumper", (-.82, .82), (.32, .44), (-2.2, -2.1), "mat_trim")
    bx(r, "grille", (-.32, .32), (.45, .58), (2.11, 2.13), "mat_cable")
    T(r, "weed", [(.5, .42, 2.2), (.55, .3, 2.3), (.5, .15, 2.36)], .025, "mat_paint", 3)
    T(r, "weed", [(-.3, .4, 2.2), (-.33, .25, 2.28)], .02, "mat_paint", 3)
    pitch, roll = math.radians(21), math.radians(11)
    transform_all(r, Matrix.Rotation(roll, 4, Vector((0, -1, 0))) @ Matrix.Rotation(pitch, 4, "X"))
    merge(r, {"mat_lacquer": "body", "mat_glass": "cabin_glass", "mat_rubber": "wheel", "mat_metal": "hub",
              "mat_rust": "rust", "mat_trim": "trim", "mat_plastic": "headlight", "mat_hivis": "tail_lamp",
              "mat_cable": "grille", "mat_paint": "weed"})
    return r


# --------------------------------------------------------------------------- export / preview

# name -> (builder, center the AABB in XZ)
BUILDERS = {
    "hw_gas_canopy": (build_hw_gas_canopy, True),
    "hw_gas_pump": (build_hw_gas_pump, True),
    "hw_toll_booth": (build_hw_toll_booth, False),
    "hw_broken_deck_end": (build_hw_broken_deck_end, False),
    "hw_vent_tower": (build_hw_vent_tower, True),
    "hw_camp_tent_dome": (build_hw_camp_tent_dome, True),
    "hw_camp_tent_ridge": (build_hw_camp_tent_ridge, True),
    "hw_camp_shack": (build_hw_camp_shack, True),
    "hw_fire_barrel": (build_hw_fire_barrel, True),
    "hw_storm_culvert": (build_hw_storm_culvert, False),
    "roof_clock_tower": (build_roof_clock_tower, False),
    "roof_giant_sign": (build_roof_giant_sign, True),
    "roof_stairwell_hut": (build_roof_stairwell_hut, True),
    "roof_skylight": (build_roof_skylight, True),
    "roof_chimney_stack": (build_roof_chimney_stack, True),
    "dock_pontoon": (build_dock_pontoon, True),
    "dock_skiff": (build_dock_skiff, True),
    "dock_pump_house": (build_dock_pump_house, False),
    "dock_lock_gate": (build_dock_lock_gate, True),
    "dock_barge": (build_dock_barge, True),
    "dock_mooring_post": (build_dock_mooring_post, False),
    "dock_half_sunken_car": (build_dock_half_sunken_car, True),
}


def _render_tile(scene, cam, eye, target, path, background, light="STUDIO"):
    scene.world.color = background
    scene.display.shading.light = light
    cam.location = Vector(eye)
    cam.rotation_euler = (Vector(target) - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def render_sheet(r, path):
    """2×2 Workbench sheet: front 3/4, rear 3/4, eye level (1.7 m) from the front-left,
    night silhouette from farther away (flat colours on a dark sky: emissive accents read as in the game)."""
    scene = ba._preview_scene((480, 480), (0.75, 0.75, 0.78))
    scene.display.render_aa = "8"
    lo, hi = bounds(r)
    center = (lo + hi) / 2
    radius = max((hi - lo).length / 2, .05)
    data = bpy.data.cameras.new("sheet_cam")
    data.lens = 50
    data.clip_start = .05
    data.clip_end = 5000
    cam = bpy.data.objects.new("sheet_cam", data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    fov = 2 * math.atan(18 / data.lens)
    fit = radius / math.sin(fov / 2)

    def around(direction, distance):
        return center + Vector(direction).normalized() * distance

    # Blender directions: glTF +Z (front) is Blender -Y.
    eye_dir = Vector((-.55, -1.0, 0)).normalized()
    eye = center + eye_dir * fit * .8
    eye.z = lo.z + 1.7
    views = [
        (around((.75, -1.0, .45), fit * 1.05), center, (0.75, 0.75, 0.78), "STUDIO"),
        (around((-.8, 1.0, .5), fit * 1.05), center, (0.75, 0.75, 0.78), "STUDIO"),
        (eye, center, (0.62, 0.64, 0.7), "STUDIO"),
        (around((.5, -1.0, .15), fit * 2.2), center, (0.003, 0.004, 0.01), "FLAT"),
    ]
    tiles = []
    base = os.path.splitext(path)[0]
    for i, (eye_pos, target, background, light) in enumerate(views):
        tile = f"{base}__tile{i}.png"
        _render_tile(scene, cam, eye_pos, target, tile, background, light)
        tiles.append(tile)
    ba._stitch(tiles, path, 2)
    for tile in tiles:
        os.remove(tile)


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    only = set(argv[argv.index("--only") + 1].split(",")) if "--only" in argv else None
    preview = "--no-preview" not in argv
    unknown = (only or set()) - set(BUILDERS)
    if unknown:
        raise SystemExit(f"Nieznane modele: {sorted(unknown)}")
    asset_dir = os.path.join(ba.OUT_DIR, "city")
    preview_dir = os.path.join(ba.PREVIEW_DIR, "city")
    os.makedirs(asset_dir, exist_ok=True)
    os.makedirs(preview_dir, exist_ok=True)
    for name, (builder, center) in BUILDERS.items():
        if only and name not in only:
            continue
        ba.reset_scene()
        r = finish(builder, center)
        ba.export_glb(r, os.path.join(asset_dir, f"{name}.glb"), animations=False)
        lo, hi = bounds(r)
        size = hi - lo
        tris = sum(len(p.vertices) - 2 for o in r.children_recursive if o.type == "MESH" for p in o.data.polygons)
        mats = sorted({m.name for o in r.children_recursive if o.type == "MESH" for m in o.data.materials})
        # Blender (x, y, z) -> glTF (x, z, -y)
        print(f"[neoryder] built {name} tris={tris} aabb={size.x:.3f} x {size.z:.3f} x {size.y:.3f} "
              f"x[{lo.x:.3f},{hi.x:.3f}] y[{lo.z:.3f},{hi.z:.3f}] z[{-hi.y:.3f},{-lo.y:.3f}] mats={','.join(mats)}")
        if preview:
            render_sheet(r, os.path.join(preview_dir, f"{name}.png"))


if __name__ == "__main__":
    main()
