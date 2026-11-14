"""Proceduralne modele NEORYDER (low-poly, fasetowane).

Uruchomienie (z katalogu repo):
    "D:/Blender/blender.exe" -b --factory-startup --python tools/blender/build_assets.py -- [--only nazwa,nazwa] [--no-preview]

Wynik: public/assets/models/<nazwa>.glb oraz tools/blender/previews/<nazwa>.png.
Konwencje (opisane w docs/assets.md):
- jednostki: metry; glTF Y-up;
- wrogowie i rekwizyty patrzą w +Z glTF (zgodnie z Object3D.lookAt), stopy / spód na y = 0;
- bronie gracza celują w -Z glTF (kierunek kamery), początek układu w miejscu chwytu;
- materiały rozpoznawane po nazwie (mat_world, mat_interactive, mat_enemy, mat_enemy_glow,
  mat_player_cyan, mat_power_magenta) — shader gry może je podmienić.
"""

from __future__ import annotations

import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT_DIR = os.path.join(ROOT, "public", "assets", "models")
PREVIEW_DIR = os.path.join(ROOT, "tools", "blender", "previews")

# Blender: przód postaci = -Y (po eksporcie +Z glTF). Bronie: lufa = +Y (po eksporcie -Z glTF).
FWD = -1.0  # znak osi Y "do przodu" dla postaci

PALETTE = {
    "mat_world": ((0.92, 0.92, 0.92, 1), None),
    "mat_interactive": ((0.03, 0.03, 0.03, 1), None),
    "mat_enemy": ((0.878, 0.149, 0.169, 1), None),  # #e0262b
    "mat_enemy_glow": ((1.0, 0.25, 0.2, 1), 4.0),
    "mat_player_cyan": ((0.0, 0.898, 1.0, 1), 6.0),  # #00e5ff
    "mat_power_magenta": ((1.0, 0.169, 0.839, 1), 5.0),  # #ff2bd6
}


# --------------------------------------------------------------------------- utils

def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def material(name: str) -> bpy.types.Material:
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    color, emission = PALETTE[name]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = 0.85
    bsdf.inputs["Metallic"].default_value = 0.0
    if emission:
        bsdf.inputs["Emission Color"].default_value = color
        bsdf.inputs["Emission Strength"].default_value = emission
    mat.diffuse_color = color  # kolor w Workbench (podgląd)
    return mat


def mesh_object(name: str, bm: bmesh.types.BMesh, mat: str, parent=None, location=(0, 0, 0)):
    me = bpy.data.meshes.new(name)
    for f in bm.faces:
        f.smooth = False
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(material(mat))
    obj.location = location
    if parent is not None:
        set_parent(obj, parent)
    return obj


def set_parent(child, parent) -> None:
    """Parentowanie z zachowaniem położenia w świecie, ale z czystym lokalnym transformem."""
    bpy.context.view_layer.update()
    world = child.matrix_world.copy()
    child.parent = parent
    child.matrix_parent_inverse = Matrix.Identity(4)
    child.matrix_world = world


def empty(name: str, parent=None, location=(0, 0, 0), size=0.1):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = size
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    if parent is not None:
        set_parent(obj, parent)
    return obj


def wpos(obj) -> Vector:
    bpy.context.view_layer.update()
    return obj.matrix_world.translation.copy()


def bm_box(sx, sy, sz, center=(0, 0, 0), taper_top=(1.0, 1.0), bevel=0.0):
    """Prostopadłościan sx*sy*sz; taper_top skaluje górną ścianę (x, y)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        x, y, z = v.co
        if z > 0:
            x *= taper_top[0]
            y *= taper_top[1]
        v.co = Vector((x * sx + center[0], y * sy + center[1], z * sz + center[2]))
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=1, affect="EDGES", profile=0.5)
    return bm


def bm_prism(length, r_top, r_bottom, sides=6, axis="Z", top_at_origin=True, offset=(0, 0, 0), rot_deg=0.0):
    """Graniastosłup/stożek ścięty. Domyślnie wierzchołek górny w początku układu, bryła w dół (-Z)."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=sides,
                          radius1=r_bottom, radius2=r_top, depth=length)
    shift = -length / 2 if top_at_origin else 0.0
    rot = Matrix.Rotation(math.radians(rot_deg), 4, "Z")
    bmesh.ops.transform(bm, matrix=rot, verts=bm.verts)
    for v in bm.verts:
        v.co.z += shift
    if axis == "Y":
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(-90), 3, "X"))
    elif axis == "X":
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(90), 3, "Y"))
    for v in bm.verts:
        v.co += Vector(offset)
    return bm


def bm_ico(radius, center=(0, 0, 0), subdiv=1, scale=(1, 1, 1)):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=radius)
    for v in bm.verts:
        v.co = Vector((v.co.x * scale[0] + center[0], v.co.y * scale[1] + center[1], v.co.z * scale[2] + center[2]))
    return bm


def bm_merge(*parts: bmesh.types.BMesh) -> bmesh.types.BMesh:
    out = bmesh.new()
    for p in parts:
        me = bpy.data.meshes.new("_tmp")
        p.to_mesh(me)
        p.free()
        out.from_mesh(me)
        bpy.data.meshes.remove(me)
    return out


# --------------------------------------------------------------------------- humanoid

LAST_BUILD: dict = {}  # parametry ostatniego humanoid() — dla dekoracji w builderach wrogów

def humanoid(name: str, build: dict):
    """Manekin ze sztywnych części. Pivoty w stawach, hierarchia jak szkielet.

    Węzły: <name> > pelvis > torso > head, arm_upper_L/R > arm_lower_L/R > hand_L/R;
           pelvis > leg_upper_L/R > leg_lower_L/R > foot_L/R.
    Wszystkie części używają mat_enemy (chyba że build mówi inaczej).
    """
    b = {
        "hip_z": 0.95, "hip_x": 0.1, "leg_upper": 0.45, "leg_lower": 0.44,
        "thigh_r": 0.105, "knee_r": 0.078, "ankle_r": 0.056,
        "waist_z": 1.03, "torso_h": 0.45, "waist_w": 0.30, "chest_w": 0.46, "torso_d": 0.24,
        "shoulder_x": 0.25, "shoulder_z": 1.44, "arm_upper": 0.29, "arm_lower": 0.27,
        "arm_r": 0.064, "wrist_r": 0.045, "neck_z": 1.52, "head_r": 0.12,
        "arm_spread_deg": 8.0, "mat": "mat_enemy", "arm_pose": {},
    }
    b.update(build)
    LAST_BUILD.clear()
    LAST_BUILD.update(b)
    m = b["mat"]

    root = empty(name, size=0.3)

    pelvis = mesh_object("pelvis", bm_box(0.36, 0.22, 0.18, center=(0, 0, 0), bevel=0.02), m,
                         parent=root, location=(0, 0, b["hip_z"] + 0.03))

    torso_bm = bm_box(b["waist_w"], b["torso_d"], b["torso_h"], center=(0, 0, b["torso_h"] / 2),
                      taper_top=(b["chest_w"] / b["waist_w"], 1.08), bevel=0.025)
    torso = mesh_object("torso", torso_bm, m, parent=pelvis, location=(0, 0, b["waist_z"]))

    head_bm = bm_merge(
        bm_ico(b["head_r"], center=(0, 0, b["head_r"] + 0.05), subdiv=1, scale=(0.9, 1.0, 1.15)),
        bm_prism(0.07, 0.045, 0.05, sides=6, top_at_origin=False, offset=(0, 0, 0.025)),
    )
    head = mesh_object("head", head_bm, m, parent=torso, location=(0, 0, b["neck_z"]))

    for side, sx in (("L", 1), ("R", -1)):
        # ramię: pivot w barku, ręka zwisa w dół, lekko odchylona od tułowia
        spread = math.radians(b["arm_spread_deg"]) * sx
        au = mesh_object(f"arm_upper_{side}", bm_prism(b["arm_upper"], b["arm_r"], b["arm_r"] * 0.85), m,
                         parent=torso, location=(sx * b["shoulder_x"], 0, b["shoulder_z"]))
        pose = b["arm_pose"].get(side)  # (pochylenie ramienia, pochylenie przedramienia) w stopniach, - = do przodu
        au.rotation_euler = (math.radians(pose[0]) if pose else 0, spread, 0)
        bpy.context.view_layer.update()
        elbow = au.matrix_world @ Vector((0, 0, -b["arm_upper"]))
        al = mesh_object(f"arm_lower_{side}", bm_prism(b["arm_lower"], b["arm_r"] * 0.85, b["wrist_r"]), m,
                         parent=au, location=elbow)
        if pose:
            al.matrix_world = Matrix.Translation(elbow) @ Matrix.Rotation(math.radians(pose[1]), 4, "X")
        bpy.context.view_layer.update()
        wrist = al.matrix_world @ Vector((0, 0, -b["arm_lower"]))
        hand_bm = bm_box(0.07, 0.09, 0.1, center=(0, 0, -0.05), bevel=0.012)
        hand = mesh_object(f"hand_{side}", hand_bm, m, parent=al, location=wrist)

        lu = mesh_object(f"leg_upper_{side}", bm_prism(b["leg_upper"], b["thigh_r"], b["knee_r"]), m,
                         parent=pelvis, location=(sx * b["hip_x"], 0, b["hip_z"]))
        knee_z = b["hip_z"] - b["leg_upper"]
        ll = mesh_object(f"leg_lower_{side}", bm_prism(b["leg_lower"], b["knee_r"], b["ankle_r"]), m,
                         parent=lu, location=(sx * b["hip_x"], 0, knee_z))
        ankle_z = knee_z - b["leg_lower"]
        foot_bm = bm_box(0.11, 0.26, ankle_z, center=(0, FWD * 0.06, -ankle_z / 2),
                         taper_top=(0.9, 0.6), bevel=0.012)
        mesh_object(f"foot_{side}", foot_bm, m, parent=ll, location=(sx * b["hip_x"], 0, ankle_z))

    return root


# --------------------------------------------------------------------------- wrogowie: wspólne elementy

RED, GLOW = "mat_enemy", "mat_enemy_glow"


def part(name, bm, mat, parent, loc=(0, 0, 0), rot=(0, 0, 0)):
    """Część-dziecko z lokalnym transformem (bm w układzie rodzica, bez kompensacji świata)."""
    obj = mesh_object(name, bm, mat)
    obj.parent = parent
    obj.matrix_parent_inverse = Matrix.Identity(4)
    obj.location = loc
    obj.rotation_euler = tuple(math.radians(a) for a in rot)
    return obj


def node(name, parent, loc=(0, 0, 0), size=0.05):
    obj = empty(name, size=size)
    obj.parent = parent
    obj.matrix_parent_inverse = Matrix.Identity(4)
    obj.location = loc
    return obj


def objs_by_name() -> dict:
    return {o.name: o for o in bpy.data.objects}


def dress_limbs(o: dict, b: dict, knee=0.11, elbow=0.09, bracer=True, thigh=True, shin=True) -> None:
    """Nakolanniki, nałokietniki, nagolenniki, płyty na udach, opaski przedramion i nakładki na buty."""
    for side in ("L", "R"):
        ll, lu, al, foot = (o[f"leg_lower_{side}"], o[f"leg_upper_{side}"], o[f"arm_lower_{side}"], o[f"foot_{side}"])
        kr = b["knee_r"]
        part(f"knee_pad_{side}", bm_box(knee, 0.07, knee * 0.9, center=(0, FWD * (kr + 0.025), 0.0),
                                        taper_top=(0.8, 0.8), bevel=0.012), RED, ll)
        if shin:
            part(f"shin_guard_{side}", bm_box(knee * 0.85, 0.035, 0.28, center=(0, FWD * (kr * 0.85 + 0.012), -0.2),
                                              taper_top=(1.15, 1.0)), RED, ll)
        if thigh:
            part(f"thigh_plate_{side}", bm_box(0.15, 0.04, 0.24, center=(0, FWD * (b["thigh_r"] + 0.012), -0.2),
                                               taper_top=(1.1, 1.0)), RED, lu)
        ar = b["arm_r"] * 0.85
        part(f"elbow_pad_{side}", bm_box(elbow, 0.07, elbow, center=(0, -FWD * (ar + 0.02), 0.0),
                                         taper_top=(0.8, 0.7), bevel=0.01), RED, al)
        if bracer:
            part(f"bracer_{side}", bm_prism(0.13, ar * 1.12, ar * 1.0, sides=6, offset=(0, 0, -0.08)), RED, al)
        az = b["hip_z"] - b["leg_upper"] - b["leg_lower"]
        part(f"toe_cap_{side}", bm_box(0.125, 0.09, 0.06, center=(0, FWD * 0.2, -az + 0.032), taper_top=(0.9, 0.7)),
             RED, foot)
        part(f"heel_{side}", bm_box(0.1, 0.07, 0.05, center=(0, -FWD * 0.04, -az + 0.025)), RED, foot)
        part(f"ankle_cuff_{side}", bm_prism(0.06, 0.068, 0.07, sides=6), RED, foot)


def dress_torso(o: dict, b: dict, pouches=3, collar=True, back_plate=True, chest_plate=True) -> None:
    torso, pelvis = o["torso"], o["pelvis"]
    d, h, w = b["torso_d"], b["torso_h"], b["chest_w"]
    if chest_plate:
        part("chest_plate", bm_box(w * 0.74, 0.05, h * 0.52, center=(0, FWD * (d * 0.54 + 0.018), h * 0.66),
                                   taper_top=(1.12, 1.0), bevel=0.012), RED, torso)
        part("abdomen_plate", bm_box(w * 0.5, 0.04, h * 0.22, center=(0, FWD * (d * 0.5 + 0.01), h * 0.25),
                                     taper_top=(1.1, 1.0)), RED, torso)
    if back_plate:
        part("back_plate", bm_box(w * 0.78, 0.045, h * 0.7, center=(0, -FWD * (d * 0.54 + 0.015), h * 0.55),
                                  taper_top=(1.1, 1.0)), RED, torso)
    xs = {0: [], 2: [-0.1, 0.1], 3: [-0.13, 0.0, 0.13]}[pouches]
    for i, x in enumerate(xs):
        part(f"pouch_{i}", bm_box(0.075, 0.05, 0.09, center=(x, FWD * (d * 0.5 + 0.022), 0.06)), RED, torso)
    if collar:
        part("collar", bm_prism(0.07, w * 0.2, w * 0.24, sides=6, offset=(0, 0, h + 0.02)), RED, torso)
    part("belt", bm_box(b["waist_w"] + 0.07, 0.26, 0.05, center=(0, 0, 0.075)), RED, pelvis)
    part("belt_buckle", bm_box(0.06, 0.03, 0.05, center=(0, FWD * 0.13, 0.075)), GLOW, pelvis)


def torso_local_z(b: dict, world_z: float) -> float:
    return world_z - b["waist_z"]


# --------------------------------------------------------------------------- wrogowie: Szturmowiec

def build_enemy_trooper():
    """Szturmowiec: masywny, fazowane naramienniki, kamizelka, pałka elektryczna w prawej ręce."""
    root = humanoid("enemy_trooper", {
        "chest_w": 0.54, "waist_w": 0.34, "torso_d": 0.28, "shoulder_x": 0.29,
        "arm_r": 0.065, "wrist_r": 0.045, "thigh_r": 0.095, "head_r": 0.115, "arm_spread_deg": 12,
    })
    b = dict(LAST_BUILD)
    o = objs_by_name()
    torso, head = o["torso"], o["head"]
    dress_torso(o, b, pouches=3)
    dress_limbs(o, b)
    sz = torso_local_z(b, b["shoulder_z"]) + 0.03
    for side, sx in (("L", 1), ("R", -1)):
        pad = bm_merge(
            bm_box(0.2, 0.26, 0.09, taper_top=(0.7, 0.8), bevel=0.02),
            bm_box(0.17, 0.22, 0.04, center=(0, 0, 0.065), taper_top=(0.7, 0.75)),
            bm_box(0.2, 0.05, 0.06, center=(0, FWD * 0.14, -0.02)),
        )
        part(f"shoulder_pad_{side}", pad, RED, torso, loc=(sx * 0.31, 0, sz), rot=(0, -18 * sx, 0))
    # hełm: kopuła, daszek, policzki, grzbiet, szczęka i szeroki świecący pasek wizjera
    helmet = bm_merge(
        bm_box(0.27, 0.29, 0.27, center=(0, 0, 0.185), taper_top=(0.82, 0.85), bevel=0.025),
        bm_box(0.29, 0.05, 0.05, center=(0, FWD * 0.15, 0.265)),
        bm_box(0.045, 0.12, 0.1, center=(0.14, 0, 0.12)),
        bm_box(0.045, 0.12, 0.1, center=(-0.14, 0, 0.12)),
        bm_box(0.04, 0.22, 0.04, center=(0, 0, 0.33)),
        bm_box(0.17, 0.06, 0.06, center=(0, FWD * 0.12, 0.05), taper_top=(0.8, 1.0)),
    )
    part("helmet", helmet, RED, head)
    part("visor", bm_box(0.21, 0.025, 0.045), GLOW, head, loc=(0, FWD * 0.153, 0.195))
    # plecak z anteną
    part("backpack", bm_merge(
        bm_box(0.26, 0.1, 0.22, center=(0, 0, 0.0), bevel=0.012),
        bm_box(0.06, 0.06, 0.06, center=(0.07, -FWD * 0.06, 0.14)),
        bm_prism(0.46, 0.008, 0.012, sides=4, offset=(0.1, 0, 0.27)),
    ), RED, torso, loc=(0, -FWD * (b["torso_d"] / 2 + 0.05), 0.28))
    part("antenna_tip", bm_box(0.025, 0.025, 0.025), GLOW, torso,
         loc=(0.1, -FWD * (b["torso_d"] / 2 + 0.05), 0.55))
    # pałka elektryczna
    baton = node("baton", o["hand_R"], (0, 0, -0.05))
    part("baton_shaft", bm_merge(
        bm_prism(0.62, 0.022, 0.026, sides=6, axis="Y", top_at_origin=False, offset=(0, FWD * 0.22, 0)),
        bm_prism(0.12, 0.03, 0.03, sides=6, axis="Y", top_at_origin=False, offset=(0, -FWD * 0.07, 0)),  # chwyt
        bm_box(0.09, 0.03, 0.05, center=(0, 0, 0.0)),  # jelec
    ), RED, baton)
    part("baton_tip", bm_prism(0.16, 0.034, 0.034, sides=6, axis="Y", top_at_origin=False),
         GLOW, baton, loc=(0, FWD * 0.58, 0))
    node("baton_hit", baton, (0, FWD * 0.6, 0))
    return root


# --------------------------------------------------------------------------- wrogowie: Strzelec

def _rifle_parts(long: bool):
    """Bryła karabinu w układzie węzła rifle (początek w chwycie, lufa do przodu = FWD)."""
    if not long:
        return bm_merge(
            bm_box(0.06, 0.5, 0.1, center=(0, FWD * 0.12, 0.03), bevel=0.01),
            bm_box(0.05, 0.22, 0.08, center=(0, -FWD * 0.22, 0.0), taper_top=(1.0, 0.8)),
            bm_box(0.04, 0.05, 0.12, center=(0, FWD * 0.02, -0.06)),
            bm_prism(0.34, 0.018, 0.018, sides=6, axis="Y", top_at_origin=False, offset=(0, FWD * 0.53, 0.05)),
            bm_box(0.045, 0.07, 0.15, center=(0, FWD * 0.16, -0.08), taper_top=(1.0, 0.8)),  # magazynek
            bm_box(0.04, 0.2, 0.03, center=(0, FWD * 0.32, 0.075)),  # szyna
            bm_box(0.03, 0.03, 0.05, center=(0, FWD * 0.38, 0.1)),  # muszka
            bm_box(0.04, 0.04, 0.04, center=(0, FWD * 0.69, 0.05)),  # kompensator
        )
    return bm_merge(
        bm_box(0.06, 0.46, 0.1, center=(0, 0, 0.03), bevel=0.01),
        bm_box(0.055, 0.3, 0.09, center=(0, -FWD * 0.3, 0.0), taper_top=(1.0, 0.7)),  # kolba
        bm_box(0.04, 0.07, 0.07, center=(0, -FWD * 0.35, 0.07)),  # policzek
        bm_box(0.04, 0.05, 0.12, center=(0, 0, -0.06)),
        bm_prism(0.5, 0.017, 0.017, sides=6, axis="Y", top_at_origin=False, offset=(0, FWD * 0.45, 0.05)),
        bm_box(0.045, 0.08, 0.045, center=(0, FWD * 0.67, 0.05)),  # hamulec wylotowy
        bm_box(0.045, 0.07, 0.13, center=(0, FWD * 0.08, -0.07), taper_top=(1.0, 0.8)),  # magazynek
        bm_prism(0.3, 0.028, 0.028, sides=8, axis="Y", top_at_origin=False, offset=(0, FWD * 0.04, 0.11)),  # luneta
        bm_prism(0.07, 0.037, 0.034, sides=8, axis="Y", top_at_origin=False, offset=(0, FWD * 0.2, 0.11)),
        bm_prism(0.05, 0.03, 0.036, sides=8, axis="Y", top_at_origin=False, offset=(0, -FWD * 0.2, 0.11)),
        bm_box(0.03, 0.03, 0.04, center=(0, FWD * 0.1, 0.07)),
        bm_box(0.03, 0.03, 0.04, center=(0, -FWD * 0.04, 0.07)),
    )


def build_enemy_gunner():
    """Strzelec: smuklejszy, hełm z osłoną karku, kamizelka z magazynkami, plecak z anteną, karabin."""
    root = humanoid("enemy_gunner", {"chest_w": 0.44, "head_r": 0.118, "arm_spread_deg": 6})
    b = dict(LAST_BUILD)
    o = objs_by_name()
    head, torso = o["head"], o["torso"]
    dress_torso(o, b, pouches=3)
    dress_limbs(o, b, knee=0.1, elbow=0.08, thigh=False)
    sz = torso_local_z(b, b["shoulder_z"]) + 0.03
    for side, sx in (("L", 1), ("R", -1)):
        part(f"shoulder_pad_{side}", bm_merge(
            bm_box(0.13, 0.17, 0.06, taper_top=(0.75, 0.8), bevel=0.015),
            bm_box(0.12, 0.03, 0.05, center=(0, FWD * 0.09, -0.01)),
        ), RED, torso, loc=(sx * 0.255, 0, sz), rot=(0, -14 * sx, 0))
    helmet = bm_merge(
        bm_box(0.24, 0.28, 0.26, center=(0, 0, 0.18), taper_top=(0.8, 0.9), bevel=0.025),
        bm_box(0.2, 0.12, 0.06, center=(0, -FWD * 0.15, 0.1), bevel=0.01),  # osłona karku
        bm_box(0.26, 0.04, 0.04, center=(0, FWD * 0.14, 0.27)),  # daszek
        bm_box(0.04, 0.1, 0.09, center=(0.125, 0, 0.12)),
        bm_box(0.04, 0.1, 0.09, center=(-0.125, 0, 0.12)),
        bm_box(0.035, 0.2, 0.035, center=(0, -FWD * 0.02, 0.315)),
    )
    part("helmet", helmet, RED, head)
    part("visor", bm_box(0.19, 0.025, 0.04), GLOW, head, loc=(0, FWD * 0.143, 0.19))
    part("backpack", bm_merge(
        bm_box(0.3, 0.12, 0.3, center=(0, 0, 0.0), bevel=0.02),
        bm_box(0.1, 0.05, 0.12, center=(0, -FWD * 0.08, -0.03)),
        bm_box(0.04, 0.05, 0.05, center=(-0.11, -FWD * 0.03, 0.17)),
        bm_prism(0.5, 0.008, 0.012, sides=4, offset=(-0.11, 0, 0.35)),
    ), RED, torso, loc=(0, -FWD * (b["torso_d"] / 2 + 0.06), 0.27))
    part("antenna_tip", bm_box(0.025, 0.025, 0.025), GLOW, torso,
         loc=(-0.11, -FWD * (b["torso_d"] / 2 + 0.06), 0.6))
    rifle = node("rifle", o["hand_R"], (0, 0, -0.05))
    part("rifle_body", _rifle_parts(False), RED, rifle)
    node("muzzle", rifle, (0, FWD * 0.71, 0.05))
    return root


# --------------------------------------------------------------------------- wrogowie: Snajper

def build_enemy_sniper():
    """Snajper: wysoki i smukły, płaszcz z paneli, kaptur z jedną soczewką, długi karabin z lunetą."""
    root = humanoid("enemy_sniper", {
        "hip_z": 1.0, "leg_upper": 0.47, "leg_lower": 0.47, "waist_z": 1.08, "torso_h": 0.45,
        "waist_w": 0.26, "chest_w": 0.36, "torso_d": 0.2, "shoulder_x": 0.22, "shoulder_z": 1.5,
        "arm_upper": 0.3, "arm_lower": 0.29, "arm_r": 0.052, "wrist_r": 0.038, "neck_z": 1.56,
        "head_r": 0.105, "thigh_r": 0.085, "knee_r": 0.065, "ankle_r": 0.048, "hip_x": 0.085,
        "arm_spread_deg": 4,
    })
    b = dict(LAST_BUILD)
    o = objs_by_name()
    head, torso = o["head"], o["torso"]
    dress_torso(o, b, pouches=2, back_plate=False)
    dress_limbs(o, b, knee=0.09, elbow=0.075, thigh=False, shin=True)
    sz = torso_local_z(b, b["shoulder_z"]) + 0.02
    for side, sx in (("L", 1), ("R", -1)):
        part(f"shoulder_pad_{side}", bm_box(0.12, 0.16, 0.05, taper_top=(0.7, 0.8), bevel=0.012), RED, torso,
             loc=(sx * 0.225, 0, sz), rot=(0, -12 * sx, 0))
        lu = o[f"leg_upper_{side}"]
        # poły płaszcza: panele zwisające z talii, wachlarzem na boki, podążają za nogami
        part(f"coat_front_{side}", bm_box(0.15, 0.018, 0.6, center=(0, FWD * 0.115, -0.3), taper_top=(0.8, 1.0)),
             RED, lu, rot=(0, 5 * sx, 0))
        part(f"coat_side_{side}", bm_box(0.018, 0.22, 0.66, center=(sx * 0.07, 0, -0.33), taper_top=(1.0, 0.75)),
             RED, lu, rot=(0, 7 * sx, 0))
        part(f"coat_back_{side}", bm_box(0.15, 0.018, 0.78, center=(0, -FWD * 0.115, -0.39), taper_top=(0.85, 1.0)),
             RED, lu, rot=(0, 4 * sx, 0))
    part("cape", bm_box(0.4, 0.26, 0.05, taper_top=(0.7, 0.8)), RED, torso,
         loc=(0, 0, torso_local_z(b, b["shoulder_z"]) + 0.01))
    helmet = bm_merge(
        bm_box(0.23, 0.27, 0.25, center=(0, 0, 0.17), taper_top=(0.85, 0.9), bevel=0.02),
        bm_box(0.25, 0.04, 0.05, center=(0, FWD * 0.14, 0.255)),
        bm_box(0.16, 0.1, 0.12, center=(0, -FWD * 0.12, 0.08), taper_top=(0.9, 1.0)),  # osłona karku
        bm_prism(0.05, 0.062, 0.062, sides=8, axis="Y", top_at_origin=False, offset=(0, FWD * 0.135, 0.19)),  # obejma
        bm_prism(0.3, 0.007, 0.01, sides=4, offset=(0.1, 0, 0.45)),  # antena
    )
    part("helmet", helmet, RED, head)
    part("visor", bm_prism(0.03, 0.043, 0.043, sides=10, axis="Y", top_at_origin=False), GLOW, head,
         loc=(0, FWD * 0.165, 0.19))
    rifle = node("rifle", o["hand_R"], (0, 0, -0.05))
    part("rifle_body", _rifle_parts(True), RED, rifle)
    part("scope_lens", bm_prism(0.012, 0.03, 0.03, sides=8, axis="Y", top_at_origin=False), GLOW, rifle,
         loc=(0, FWD * 0.24, 0.11))
    node("muzzle", rifle, (0, FWD * 0.71, 0.05))
    return root


# --------------------------------------------------------------------------- wrogowie: Tarczownik

def build_enemy_shielder():
    """Tarczownik: krępy, ciężkie pancerze, duża tarcza (węzeł shield) przed lewym bokiem, krótka pałka."""
    root = humanoid("enemy_shielder", {
        "hip_z": 0.9, "leg_upper": 0.43, "leg_lower": 0.42, "waist_z": 0.97, "torso_h": 0.46,
        "waist_w": 0.42, "chest_w": 0.58, "torso_d": 0.3, "shoulder_x": 0.33, "shoulder_z": 1.4,
        "arm_upper": 0.28, "arm_lower": 0.26, "arm_r": 0.078, "wrist_r": 0.055, "neck_z": 1.45,
        "head_r": 0.125, "thigh_r": 0.115, "knee_r": 0.09, "ankle_r": 0.066, "hip_x": 0.12,
        "arm_spread_deg": 6, "arm_pose": {"L": (-45, -75)},
    })
    b = dict(LAST_BUILD)
    o = objs_by_name()
    head, torso, pelvis = o["head"], o["torso"], o["pelvis"]
    dress_torso(o, b, pouches=2)
    dress_limbs(o, b, knee=0.13, elbow=0.1)
    sz = torso_local_z(b, b["shoulder_z"]) + 0.03
    for side, sx in (("L", 1), ("R", -1)):
        big = side == "R"
        part(f"shoulder_pad_{side}", bm_merge(
            bm_box(0.22 if big else 0.18, 0.28, 0.1, taper_top=(0.7, 0.8), bevel=0.02),
            bm_box(0.2 if big else 0.16, 0.24, 0.05, center=(0, 0, 0.075), taper_top=(0.7, 0.75)),
        ), RED, torso, loc=(sx * 0.35, 0, sz), rot=(0, -18 * sx, 0))
    helmet = bm_merge(
        bm_box(0.3, 0.31, 0.27, center=(0, 0, 0.19), taper_top=(0.85, 0.88), bevel=0.025),
        bm_box(0.32, 0.05, 0.06, center=(0, FWD * 0.16, 0.27)),
        bm_box(0.05, 0.14, 0.11, center=(0.16, 0, 0.12)),
        bm_box(0.05, 0.14, 0.11, center=(-0.16, 0, 0.12)),
        bm_box(0.18, 0.07, 0.07, center=(0, FWD * 0.13, 0.05), taper_top=(0.85, 1.0)),
        bm_box(0.05, 0.2, 0.04, center=(0, 0, 0.34)),
    )
    part("helmet", helmet, RED, head)
    part("visor", bm_box(0.24, 0.025, 0.04), GLOW, head, loc=(0, FWD * 0.164, 0.2))
    part("backpack", bm_box(0.3, 0.1, 0.24, bevel=0.015), RED, torso,
         loc=(0, -FWD * (b["torso_d"] / 2 + 0.05), 0.25))
    # krótka pałka do uderzenia tarczą
    baton = node("baton", o["hand_R"], (0, 0, -0.05))
    part("baton_shaft", bm_merge(
        bm_prism(0.36, 0.028, 0.034, sides=6, axis="Y", top_at_origin=False, offset=(0, FWD * 0.12, 0)),
        bm_prism(0.12, 0.034, 0.034, sides=6, axis="Y", top_at_origin=False, offset=(0, -FWD * 0.06, 0)),
    ), RED, baton)
    part("baton_tip", bm_prism(0.12, 0.042, 0.042, sides=6, axis="Y", top_at_origin=False), GLOW, baton,
         loc=(0, FWD * 0.36, 0))
    node("baton_hit", baton, (0, FWD * 0.42, 0))
    # tarcza 0,8 x 1,2 x 0,12 m (shieldSizeM), przed lewym bokiem; dziecko pelvis, żeby podążała za przechyłem
    sy = FWD * 0.52
    pw = wpos(pelvis)
    shield = node("shield", pelvis, (0.3 - pw.x, sy - pw.y, 1.05 - pw.z), size=0.2)
    part("shield_plate", bm_merge(
        bm_box(0.8, 0.07, 1.2, taper_top=(0.9, 1.0)),
        bm_box(0.84, 0.12, 0.07, center=(0, 0, 0.6), taper_top=(0.92, 1.0)),
        bm_box(0.7, 0.12, 0.07, center=(0, 0, -0.6)),
        bm_box(0.07, 0.12, 1.1, center=(0.375, 0, 0.0)),
        bm_box(0.07, 0.12, 1.1, center=(-0.375, 0, 0.0)),
        bm_box(0.12, 0.12, 0.9),  # żebro środkowe
        bm_box(0.05, 0.06, 0.3, center=(0.0, -FWD * 0.08, 0.0)),  # uchwyt od strony ręki
    ), RED, shield)
    part("shield_slit", bm_box(0.52, 0.03, 0.07), GLOW, shield, loc=(0, FWD * 0.065, 0.36))
    part("shield_trim", bm_box(0.5, 0.025, 0.035), GLOW, shield, loc=(0, FWD * 0.065, -0.45))
    return root


# --------------------------------------------------------------------------- wrogowie: Egzekutor

def build_enemy_executor():
    """Egzekutor: największy, ciężki pancerz, rogi na hełmie, kolczaste naramienniki, rękojeść ostrza w prawej dłoni."""
    root = humanoid("enemy_executor", {
        "hip_z": 1.02, "leg_upper": 0.49, "leg_lower": 0.47, "waist_z": 1.1, "torso_h": 0.5,
        "waist_w": 0.4, "chest_w": 0.66, "torso_d": 0.32, "shoulder_x": 0.37, "shoulder_z": 1.55,
        "arm_upper": 0.31, "arm_lower": 0.29, "arm_r": 0.08, "wrist_r": 0.055, "neck_z": 1.64,
        "head_r": 0.13, "thigh_r": 0.12, "knee_r": 0.09, "ankle_r": 0.066, "hip_x": 0.13,
        "arm_spread_deg": 10,
    })
    b = dict(LAST_BUILD)
    o = objs_by_name()
    head, torso = o["head"], o["torso"]
    dress_torso(o, b, pouches=0)
    dress_limbs(o, b, knee=0.14, elbow=0.11)
    d = b["torso_d"]
    part("chest_ridge", bm_box(0.06, 0.06, 0.4, center=(0, FWD * (d * 0.5 + 0.06), 0.32)), RED, torso)
    part("chest_core", bm_box(0.09, 0.03, 0.09), GLOW, torso, loc=(0, FWD * (d * 0.5 + 0.1), 0.34))
    part("chest_flanks", bm_merge(
        bm_box(0.18, 0.06, 0.3, center=(0.19, FWD * (d * 0.5 + 0.03), 0.3)),
        bm_box(0.18, 0.06, 0.3, center=(-0.19, FWD * (d * 0.5 + 0.03), 0.3)),
    ), RED, torso)
    sz = torso_local_z(b, b["shoulder_z"]) + 0.03
    for side, sx in (("L", 1), ("R", -1)):
        lu = o[f"leg_upper_{side}"]
        part(f"tasset_{side}", bm_box(0.2, 0.05, 0.3, center=(0, FWD * 0.13, -0.18), taper_top=(1.15, 1.0)), RED, lu)
        pad = bm_merge(
            bm_box(0.26, 0.32, 0.11, taper_top=(0.7, 0.8), bevel=0.02),
            bm_box(0.22, 0.28, 0.06, center=(0, 0, 0.085), taper_top=(0.7, 0.75)),
            bm_prism(0.2, 0.0, 0.05, sides=4, top_at_origin=False, offset=(sx * 0.07, 0, 0.19)),
            bm_prism(0.14, 0.0, 0.04, sides=4, top_at_origin=False, offset=(sx * 0.07, FWD * 0.09, 0.15)),
            bm_prism(0.14, 0.0, 0.04, sides=4, top_at_origin=False, offset=(sx * 0.07, -FWD * 0.09, 0.15)),
        )
        part(f"shoulder_pad_{side}", pad, RED, torso, loc=(sx * 0.4, 0, sz), rot=(0, -20 * sx, 0))
    helmet = bm_merge(
        bm_box(0.3, 0.32, 0.29, center=(0, 0, 0.2), taper_top=(0.82, 0.85), bevel=0.025),
        bm_box(0.32, 0.06, 0.06, center=(0, FWD * 0.165, 0.29)),
        bm_box(0.05, 0.15, 0.12, center=(0.16, 0, 0.12)),
        bm_box(0.05, 0.15, 0.12, center=(-0.16, 0, 0.12)),
        bm_box(0.2, 0.08, 0.08, center=(0, FWD * 0.14, 0.05), taper_top=(0.8, 1.0)),
        bm_box(0.06, 0.34, 0.07, center=(0, -FWD * 0.02, 0.36)),  # grzebień
        bm_box(0.2, 0.08, 0.06, center=(0, -FWD * 0.17, 0.08)),
        bm_prism(0.3, 0.0, 0.05, sides=4, top_at_origin=False, offset=(0.15, -FWD * 0.03, 0.42)),  # rogi
        bm_prism(0.3, 0.0, 0.05, sides=4, top_at_origin=False, offset=(-0.15, -FWD * 0.03, 0.42)),
    )
    part("helmet", helmet, RED, head)
    part("visor", bm_merge(bm_box(0.24, 0.025, 0.04), bm_box(0.04, 0.025, 0.1, center=(0, 0, -0.02))), GLOW, head,
         loc=(0, FWD * 0.172, 0.215))
    part("backpack", bm_merge(
        bm_box(0.4, 0.14, 0.34, bevel=0.02),
        bm_box(0.08, 0.1, 0.16, center=(0.13, -FWD * 0.09, 0.05)),
        bm_box(0.08, 0.1, 0.16, center=(-0.13, -FWD * 0.09, 0.05)),
    ), RED, torso, loc=(0, -FWD * (d / 2 + 0.08), 0.3))
    part("backpack_glow", bm_box(0.2, 0.02, 0.05), GLOW, torso, loc=(0, -FWD * (d / 2 + 0.16), 0.4))
    # rękojeść ostrza plazmowego: samo ostrze dodaje kod (bladeSizeM) w węźle hand_R
    hilt = node("blade_hilt", o["hand_R"], (0, 0, -0.05))
    part("hilt_body", bm_merge(
        bm_prism(0.26, 0.032, 0.032, sides=6, axis="Y", top_at_origin=False, offset=(0, -FWD * 0.06, 0.0)),
        bm_box(0.2, 0.035, 0.07, center=(0, FWD * 0.065, 0.0)),  # jelec
        bm_box(0.04, 0.05, 0.04, center=(0.09, FWD * 0.08, 0.0)),
        bm_box(0.04, 0.05, 0.04, center=(-0.09, FWD * 0.08, 0.0)),
        bm_prism(0.1, 0.055, 0.05, sides=6, axis="Y", top_at_origin=False, offset=(0, FWD * 0.12, 0.0)),  # emiter
        bm_box(0.06, 0.05, 0.06, center=(0, -FWD * 0.2, 0.0)),  # głowica
    ), RED, hilt)
    return root


# --------------------------------------------------------------------------- wrogowie: Dron

def build_enemy_drone():
    """Dron: początek w środku kadłuba, oko z przodu (+Z glTF), cztery wirniki (węzły rotor_*) obracane w kodzie."""
    root = empty("enemy_drone", size=0.3)
    hull = mesh_object("hull", bm_merge(
        bm_ico(0.2, subdiv=1, scale=(1.0, 1.15, 0.62)),
        bm_box(0.2, 0.26, 0.05, center=(0, 0, 0.13), taper_top=(0.7, 0.8)),  # kopuła czujnika
        bm_box(0.06, 0.16, 0.05, center=(0, -FWD * 0.2, 0.0)),  # tylny statecznik
        bm_box(0.012, 0.012, 0.18, center=(0, -FWD * 0.24, 0.1)),  # antena
        bm_box(0.14, 0.12, 0.05, center=(0, FWD * 0.02, -0.14), taper_top=(0.7, 0.7)),  # brzuch
        bm_prism(0.2, 0.012, 0.018, sides=6, axis="Y", top_at_origin=False, offset=(0, FWD * 0.24, -0.11)),  # lufa
    ), RED, parent=root)
    for sx in (-1, 1):
        for sy in (-1, 1):
            tag = f"{'L' if sx > 0 else 'R'}{'F' if sy < 0 else 'B'}"
            cx, cy, cz = sx * 0.28, sy * 0.28, 0.06
            ang = math.degrees(math.atan2(cy, cx))
            part(f"arm_{tag}", bm_box(0.4, 0.04, 0.035), RED, hull, loc=(cx / 2, cy / 2, cz - 0.01), rot=(0, 0, ang))
            part(f"motor_{tag}", bm_prism(0.07, 0.05, 0.055, sides=8, top_at_origin=False), RED, hull,
                 loc=(cx, cy, cz))
            ring = None  # osłona wirnika: pierścień z 8 odcinków
            segs = 8
            for i in range(segs):
                a = 2 * math.pi * i / segs
                seg = bm_box(0.125, 0.024, 0.03)
                bmesh.ops.rotate(seg, verts=seg.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(a + math.pi / 2, 3, "Z"))
                for v in seg.verts:
                    v.co += Vector((math.cos(a) * 0.165, math.sin(a) * 0.165, 0))
                ring = seg if ring is None else bm_merge(ring, seg)
            part(f"guard_{tag}", ring, RED, hull, loc=(cx, cy, cz + 0.02))
            rotor = bm_merge(
                bm_box(0.3, 0.035, 0.008),
                bm_box(0.035, 0.3, 0.008),
                bm_prism(0.025, 0.03, 0.03, sides=6, top_at_origin=False, offset=(0, 0, 0.012)),
            )
            part(f"rotor_{tag}", rotor, RED, root, loc=(cx, cy, cz + 0.07))
    part("eye_ring", bm_prism(0.04, 0.095, 0.1, sides=10, axis="Y", top_at_origin=False), RED, root,
         loc=(0, FWD * 0.2, 0.01))
    part("eye", bm_ico(0.075, subdiv=1), GLOW, root, loc=(0, FWD * 0.235, 0.01))
    node("muzzle", root, (0, FWD * 0.34, -0.11))
    return root


# --------------------------------------------------------------------------- player weapons

def build_plasma_blade():
    """Ostrze plazmowe. Początek w środku chwytu, ostrze wzdłuż +Y Blendera (-Z glTF)."""
    root = empty("plasma_blade", size=0.1)
    hilt = bm_merge(
        bm_prism(0.26, 0.022, 0.022, sides=8, axis="Y", top_at_origin=False, offset=(0, 0.0, 0)),
        bm_prism(0.03, 0.03, 0.03, sides=8, axis="Y", top_at_origin=False, offset=(0, 0.12, 0)),  # gardło
        bm_prism(0.025, 0.027, 0.027, sides=8, axis="Y", top_at_origin=False, offset=(0, -0.13, 0)),  # głowica
        bm_box(0.012, 0.06, 0.02, center=(0.024, 0.03, 0)),  # przycisk/listwa
    )
    mesh_object("hilt", hilt, "mat_interactive", parent=root)
    ring = bm_prism(0.012, 0.031, 0.031, sides=8, axis="Y", top_at_origin=False, offset=(0, 0.105, 0))
    mesh_object("emitter_ring", ring, "mat_player_cyan", parent=root)
    # ostrze jako osobny węzeł: skalowanie po Z lokalnym = wysuwanie (pivot u emitera)
    blade_pivot = empty("blade", parent=root, location=(0, 0.135, 0), size=0.05)
    core = bm_prism(1.0, 0.012, 0.018, sides=6, axis="Y", top_at_origin=False, offset=(0, 0.5, 0))
    mesh_object("blade_core", core, "mat_player_cyan", parent=blade_pivot, location=(0, 0.135, 0))
    empty("blade_tip", parent=blade_pivot, location=(0, 1.135, 0), size=0.05)
    return root


def build_blaster():
    """Blaster gracza z przegrzaniem. Początek w chwycie, lufa wzdłuż +Y (-Z glTF)."""
    root = empty("blaster", size=0.1)
    body = bm_merge(
        bm_box(0.05, 0.26, 0.075, center=(0, 0.06, 0.06), taper_top=(0.9, 0.95), bevel=0.008),  # zamek
        bm_box(0.042, 0.06, 0.14, center=(0, -0.02, -0.03), taper_top=(1.0, 1.15), bevel=0.006),  # chwyt
        bm_box(0.03, 0.05, 0.012, center=(0, 0.035, -0.005)),  # kabłąk
        bm_prism(0.12, 0.016, 0.02, sides=8, axis="Y", top_at_origin=False, offset=(0, 0.25, 0.07)),  # lufa
        bm_box(0.012, 0.03, 0.02, center=(0, -0.05, 0.105)),  # szczerbinka
    )
    mesh_object("frame", body, "mat_interactive", parent=root)
    vents = bm_merge(*[
        bm_box(0.054, 0.018, 0.04, center=(0, 0.02 + i * 0.035, 0.065)) for i in range(4)
    ])
    mesh_object("heat_vents", vents, "mat_player_cyan", parent=root)
    cell = bm_box(0.046, 0.05, 0.03, center=(0, -0.02, -0.105))
    mesh_object("heat_cell", cell, "mat_player_cyan", parent=root)
    empty("muzzle", parent=root, location=(0, 0.315, 0.07), size=0.03)
    return root


# --------------------------------------------------------------------------- props

def build_prop(name: str, bm: bmesh.types.BMesh, mat: str):
    root = empty(name, size=0.2)
    mesh_object(f"{name}_mesh", bm, mat, parent=root)
    return root


def build_props():
    return {
        "crate": lambda: build_prop("crate", _crate(1.0), "mat_interactive"),
        "crate_small": lambda: build_prop("crate_small", _crate(0.5), "mat_interactive"),
        "pillar": lambda: build_prop("pillar", bm_merge(
            bm_box(0.8, 0.8, 4.0, center=(0, 0, 2.0), bevel=0.03),
            bm_box(1.0, 1.0, 0.2, center=(0, 0, 0.1), bevel=0.02),
            bm_box(1.0, 1.0, 0.2, center=(0, 0, 3.9), bevel=0.02),
        ), "mat_world"),
        "wall_segment": lambda: build_prop("wall_segment", bm_box(4.0, 0.4, 3.0, center=(0, 0, 1.5), bevel=0.02),
                                           "mat_world"),
        "cover_low": lambda: build_prop("cover_low", bm_box(2.0, 0.6, 1.0, center=(0, 0, 0.5),
                                                            taper_top=(0.95, 0.7), bevel=0.03), "mat_world"),
        "enemy_projectile": lambda: build_prop("enemy_projectile", _projectile(), "mat_enemy_glow"),
    }


def _crate(size: float):
    """Skrzynia: korpus + dwie obręcze i wzmocnione narożniki (czytelna sylwetka przy płaskim cieniowaniu)."""
    k = size
    parts = [bm_box(0.96 * k, 0.96 * k, 0.96 * k, center=(0, 0, 0.5 * k), bevel=0.03 * k)]
    for z in (0.18, 0.82):
        parts.append(bm_box(1.0 * k, 1.0 * k, 0.07 * k, center=(0, 0, z * k), bevel=0.01 * k))
    for x in (-1, 1):
        for y in (-1, 1):
            parts.append(bm_box(0.09 * k, 0.09 * k, 1.0 * k, center=(x * 0.46 * k, y * 0.46 * k, 0.5 * k),
                                bevel=0.01 * k))
    return bm_merge(*parts)


def build_player_arm(side: str):
    """Przedramię i dłoń gracza do widoku FPP. Początek = punkt chwytu broni (węzeł grip),
    przedramię biegnie do kamery (+Z glTF). Lewa ręka to lustro prawej."""
    sx = 1 if side == "R" else -1
    root = empty(f"player_arm_{side}", size=0.05)
    fist = bm_merge(
        bm_box(0.075, 0.09, 0.085, center=(sx * 0.005, -0.005, 0.0), bevel=0.012),
        bm_box(0.03, 0.05, 0.03, center=(sx * -0.035, 0.015, 0.03), bevel=0.006),  # kciuk
    )
    mesh_object("hand", fist, "mat_interactive", parent=root)
    fore = bm_prism(0.36, 0.034, 0.045, sides=6, axis="Y", top_at_origin=False, offset=(0, 0, 0))
    bmesh.ops.rotate(fore, verts=fore.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(-12), 3, "X"))
    for v in fore.verts:
        v.co += Vector((sx * 0.005, -0.205, -0.01))
    mesh_object("forearm", fore, "mat_interactive", parent=root)
    cuff = bm_prism(0.03, 0.039, 0.039, sides=6, axis="Y", top_at_origin=False, offset=(sx * 0.005, -0.07, -0.005))
    mesh_object("cuff", cuff, "mat_player_cyan", parent=root)
    empty("grip", parent=root, location=(0, 0, 0), size=0.03)
    return root


def _projectile():
    # wydłużony romb wzdłuż osi lotu (Blender -Y = glTF +Z, czyli przód rekwizytu)
    bm = bm_ico(0.07, subdiv=0, scale=(1, 3.0, 1))
    return bm


# --------------------------------------------------------------------------- export / preview

def export_glb(root, path: str) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for o in [root, *root.children_recursive]:
        o.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_selection=True, export_apply=True,
        export_yup=True, export_extras=False, export_cameras=False, export_lights=False,
        export_materials="EXPORT",
    )


def render_preview(root, path: str) -> None:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    shading = scene.display.shading
    shading.light = "STUDIO"
    shading.color_type = "MATERIAL"
    shading.show_cavity = True
    shading.show_object_outline = True
    scene.render.resolution_x = 640
    scene.render.resolution_y = 640
    scene.render.film_transparent = False
    world = bpy.data.worlds.new("w")
    world.color = (0.75, 0.75, 0.78)
    scene.world = world

    bpy.context.view_layer.update()
    pts = []
    for o in [root, *root.children_recursive]:
        if o.type == "MESH":
            pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    center = (lo + hi) / 2
    radius = max((hi - lo).length / 2, 0.05)

    cam_data = bpy.data.cameras.new("preview_cam")
    cam_data.lens = 50
    cam = bpy.data.objects.new("preview_cam", cam_data)
    scene.collection.objects.link(cam)
    # widok 3/4 od przodu (przód postaci = -Y)
    direction = Vector((0.75, -1.0, 0.45)).normalized()
    cam.location = center + direction * radius * 3.2
    cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam_data.clip_end = 1000
    scene.camera = cam
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    only = None
    if "--only" in argv:
        only = set(argv[argv.index("--only") + 1].split(","))
    preview = "--no-preview" not in argv

    builders = {
        "enemy_trooper": build_enemy_trooper,
        "enemy_gunner": build_enemy_gunner,
        "enemy_sniper": build_enemy_sniper,
        "enemy_shielder": build_enemy_shielder,
        "enemy_executor": build_enemy_executor,
        "enemy_drone": build_enemy_drone,
        "plasma_blade": build_plasma_blade,
        "blaster": build_blaster,
        "player_arm_R": lambda: build_player_arm("R"),
        "player_arm_L": lambda: build_player_arm("L"),
        **build_props(),
    }
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    for name, fn in builders.items():
        if only and name not in only:
            continue
        reset_scene()
        root = fn()
        export_glb(root, os.path.join(OUT_DIR, f"{name}.glb"))
        if preview:
            render_preview(root, os.path.join(PREVIEW_DIR, f"{name}.png"))
        tris = sum(len(p.vertices) - 2 for ob in bpy.data.objects if ob.type == "MESH" for p in ob.data.polygons)
        print(f"[neoryder] built {name} ({tris} tri)")


if __name__ == "__main__":
    main()
