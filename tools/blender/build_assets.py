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

import json
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT_DIR = os.path.join(ROOT, "public", "assets", "models")
PREVIEW_DIR = os.path.join(ROOT, "tools", "blender", "previews")
HAND_POSES = os.path.join(ROOT, "src", "data", "hands", "handPoses.json")
# Zmiana bazy glTF -> Blender; także dla lokalnych układów przegubów.
HAND_BASIS = Matrix.Rotation(math.pi / 2, 4, "X")

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


# --------------------------------------------------------------------------- wrogowie: manekin CC0

ENEMY_CLIPS = {
    "trooper": ("Idle_Loop", "Sword_Idle", "Sword_Attack"),
    "gunner": ("Pistol_Idle_Loop", "Pistol_Aim_Neutral", "Pistol_Shoot"),
    "sniper": ("Pistol_Idle_Loop", "Pistol_Aim_Neutral", "Pistol_Shoot"),
    "shielder": ("Idle_Loop", "Punch_Enter", "Punch_Cross"),
    "executor": ("Idle_Loop", "Sword_Idle", "Sword_Attack"),
}


def _enemy_bone_child(obj, rig, bone, world):
    """Sztywne wyposażenie; kość niesie je w każdym klipie."""
    obj.parent = rig
    obj.parent_type = "BONE"
    obj.parent_bone = bone
    joint = rig.data.bones[bone]
    parent = rig.matrix_world @ rig.pose.bones[bone].matrix @ Matrix.Translation((0, joint.length, 0))
    obj.matrix_parent_inverse = parent.inverted()
    obj.matrix_basis = world
    return obj


def build_enemy_cc0(archetype):
    source = os.path.join(ROOT, "tools", "blender", "sources", "ual", "AnimationLibrary_Godot_Standard.glb")
    bpy.ops.import_scene.gltf(filepath=source)
    rig = bpy.data.objects["Rig"]
    body = bpy.data.objects["Mannequin"]
    rig.animation_data_clear()
    for obj in list(bpy.context.scene.objects):
        if obj not in (rig, body):
            bpy.data.objects.remove(obj, do_unlink=True)
    keep = {*ENEMY_CLIPS[archetype], "Walk_Loop", "Jog_Fwd_Loop", "Hit_Chest", "Hit_Head"}
    body.name = "armored_body"
    body.data.materials.clear()
    body.data.materials.append(material("mat_enemy"))
    before = sum(len(p.vertices) - 2 for p in body.data.polygons)
    bpy.context.view_layer.objects.active = body
    body.select_set(True)
    decimate = body.modifiers.new("enemy_budget", "DECIMATE")
    decimate.ratio = 4000 / before
    decimate.use_collapse_triangulate = True
    bpy.ops.object.modifier_move_up(modifier=decimate.name)
    bpy.ops.object.modifier_apply(modifier=decimate.name)
    for polygon in body.data.polygons:
        polygon.use_smooth = False
    after = sum(len(p.vertices) - 2 for p in body.data.polygons)
    # T-pose source already faces Blender -Y (+Z glTF), right hand at -X.
    lo = min(v.co.z for v in body.data.vertices)
    hi = max(v.co.z for v in body.data.vertices)
    root = empty("enemy_" + archetype)
    rig.parent = root
    body.parent = rig
    # 1.84 m including helmet; executor geometry is 1.2 times this base size.
    scale = (1.84 / (hi - lo)) * (1.2 if archetype == "executor" else 1)
    root.scale = (scale,) * 3
    rig.location.z = -lo
    bpy.context.view_layer.update()

    def at(bone, offset=(0, 0, 0)):
        return rig.data.bones[bone].head_local + Vector(offset)

    def plate(name, bone, size, offset=(0, 0, 0), glow=False, bevel=.015, position=None):
        pos = at(bone, offset) if position is None else Vector(position)
        obj = mesh_object(name, bm_box(*size, bevel=bevel), "mat_enemy_glow" if glow else "mat_enemy")
        return _enemy_bone_child(obj, rig, bone, rig.matrix_world @ Matrix.Translation(pos))

    heavy = archetype in ("shielder", "executor")
    head = "DEF-head"
    chest = "DEF-spine.003"
    # Rounded, close-fitting helmet leaves the mannequin's anatomical silhouette legible.
    helmet = mesh_object("helmet" if archetype != "sniper" else "hood", bm_ico(1, subdiv=2, scale=(.125, .125, .155)), "mat_enemy")
    _enemy_bone_child(helmet, rig, head, rig.matrix_world @ Matrix.Translation(at(head, (0, .005, .10))))
    plate("visor", head, (.205, .028, .035), (0, -.122, .105), True, .008)
    if archetype == "gunner":
        for sign in (-1, 1):
            plate("goggle_" + str(sign), head, (.073, .045, .052), (sign*.055, -.117, .105), True, .012)
    if archetype == "sniper":
        hood = bm_ico(1, subdiv=3, scale=(.155, .16, .18))
        # Curved shell with an open face and hanging rear edge.
        opening = [f for f in hood.faces if f.calc_center_median().y < -.035 and f.calc_center_median().z < .09]
        bmesh.ops.delete(hood, geom=opening, context="FACES")
        obj = mesh_object("hood_shell", hood, "mat_enemy")
        _enemy_bone_child(obj, rig, head, rig.matrix_world @ Matrix.Translation(at(head, (0, .015, .09))))
    plate("chest_plate", chest, (.39 if heavy else .33, .10, .32), (0, -.103, -.035), bevel=.025)
    plate("back_plate", chest, (.32, .085, .30), (0, .12, -.035), bevel=.02)
    plate("abdomen_plate", "DEF-spine.001", (.27, .08, .15), (0, -.12, .04))
    if archetype in ("gunner", "trooper"):
        for i in range(3):
            plate("pouch_"+str(i), chest, (.075, .06, .115), ((i-1)*.095, -.175, -.13), bevel=.009)
    if archetype == "executor":
        plate("chest_core", chest, (.10, .03, .13), (0, -.168, .02), True, .015)
        plate("exo_spine", chest, (.08, .07, .43), (0, .17, -.08))
    for side, sign in (("L", 1), ("R", -1)):
        upper = "DEF-upper_arm."+side
        forearm = "DEF-forearm."+side
        thigh = "DEF-thigh."+side
        shin = "DEF-shin."+side
        plate("shoulder_pad_"+side, upper, (.22 if heavy else .18, .23, .15), (sign*.07, 0, .045), bevel=.025)
        if heavy:
            plate("forearm_plate_"+side, forearm, (.24, .15, .14), (sign*.13, -.025, 0), bevel=.02)
            plate("thigh_plate_"+side, thigh, (.19, .10, .29), (0, -.09, -.17), bevel=.02)
            plate("shin_plate_"+side, shin, (.16, .09, .29), (0, -.065, -.17), bevel=.018)
        plate("knee_pad_"+side, shin, (.15, .085, .13), (0, -.08, -.01), bevel=.02)
        if archetype == "sniper":
            for label, offset, size in (
                ("back", (0, .14, -.24), (.20, .035, .52)),
                ("side", (sign*.105, .025, -.22), (.035, .25, .48)),
            ):
                plate("coat_"+label+"_"+side, thigh, size, offset, bevel=.008)
    if archetype == "shielder":
        rig.animation_data_create()
        idle = bpy.data.actions["Idle_Loop"]
        rig.animation_data.action = idle
        rig.animation_data.action_slot = idle.slots[0]
        bpy.context.scene.frame_set(0)
        bpy.context.view_layer.update()
        shield = plate("shield", chest, (.80, .12, 1.20), position=(.30, -.60, .97), bevel=.035)
        shield.matrix_basis = shield.matrix_basis @ Matrix.Rotation(math.radians(12), 4, "Z")
    # Calibrate held equipment in its actual aiming / sword-ready pose, not the T-pose.
    calibration = "Pistol_Aim_Neutral" if archetype in ("gunner", "sniper") else "Sword_Idle"
    rig.animation_data_create()
    rig.animation_data.action = bpy.data.actions[calibration]
    rig.animation_data.action_slot = bpy.data.actions[calibration].slots[0]
    bpy.context.scene.frame_set(0)
    bpy.context.view_layer.update()
    grip = rig.matrix_world @ rig.pose.bones["DEF-hand.R"].matrix @ Vector((0, .075, 0))
    hand = empty("hand_R")
    # Rifle aims forward; sword / baton rises above the hand in the ready pose.
    hand_rotation = Matrix.Identity(4) if archetype in ("gunner", "sniper") else Matrix.Rotation(-math.pi/2, 4, "X")
    hand_world = Matrix.Translation(grip) @ hand_rotation @ Matrix.Scale(scale, 4)
    _enemy_bone_child(hand, rig, "DEF-hand.R", hand_world)
    if archetype in ("gunner", "sniper"):
        # Calibrate a pistol clip's grip: gun bore follows the hand's local aim axis.
        weapon = empty("rifle", parent=hand)
        weapon.matrix_parent_inverse = Matrix.Identity(4)
        weapon.matrix_basis = Matrix.Identity(4)
        mesh = mesh_object("rifle_body", _rifle_parts(archetype == "sniper"), "mat_enemy")
        mesh.parent = weapon
        muzzle = empty("muzzle")
        muzzle.parent = weapon
        muzzle.location = (0, -.71, .05)
        if archetype == "sniper":
            lens = mesh_object("eye", bm_prism(.015, .031, .031, sides=8, axis="Y", top_at_origin=False), "mat_enemy_glow")
            lens.parent = weapon
            lens.location = (0, -.24, .11)
    else:
        baton = empty("baton" if archetype != "executor" else "blade_hilt")
        baton.parent = hand
        shaft = mesh_object("baton_shaft", bm_box(.045, .55, .045, center=(0, -.17, 0), bevel=.008), "mat_enemy")
        shaft.parent = baton
        tip = mesh_object("baton_tip", bm_box(.055, .12, .055, bevel=.01), "mat_enemy_glow")
        tip.parent = baton
        tip.location.y = -.48
        hit = empty("baton_hit")
        hit.parent = baton
        hit.location.y = -.54
        if archetype == "executor":
            # Only the hilt is baked; EnemyView supplies the glowing blade from data.
            shaft.scale.y = .4
            tip.location.y = -.14
    for action in list(bpy.data.actions):
        if action.name not in keep:
            bpy.data.actions.remove(action)
    # Only retained actions exist, so the standard ACTIONS export cannot leak other clips.
    rig.animation_data_create()
    idle = "Pistol_Idle_Loop" if archetype in ("gunner", "sniper") else "Idle_Loop"
    rig.animation_data.action = bpy.data.actions[idle]
    rig.animation_data.action_slot = bpy.data.actions[idle].slots[0]
    rig.data.pose_position = "POSE"
    bpy.context.scene.frame_set(0)
    bpy.context.view_layer.update()
    print(f"[neoryder] {archetype} body tris={before}->{after} scale={scale:.6f}")
    return root


def build_enemy_trooper():
    return build_enemy_cc0("trooper")


def build_enemy_gunner():
    return build_enemy_cc0("gunner")


def build_enemy_sniper():
    return build_enemy_cc0("sniper")


def build_enemy_shielder():
    return build_enemy_cc0("shielder")


def build_enemy_executor():
    return build_enemy_cc0("executor")


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


# --------------------------------------------------------------------------- bronie F2 (modele FPP)
# Układ: lufa = +Y Blendera (-Z glTF), początek w punkcie chwytu, góra = +Z. Bryła mat_interactive
# (węzeł `frame`), cyjanowe węzły `heat_vents` / `heat_cell` kolorowane ciepłem przez kod, `muzzle` = wylot.

def tube(y0, y1, r0, r1, sides=8, x=0.0, z=0.0):
    """Walec/stożek ścięty wzdłuż Y od y0 (promień r0) do y1 (promień r1)."""
    return bm_prism(y1 - y0, r1, r0, sides=sides, axis="Y", top_at_origin=False,
                    offset=(x, (y0 + y1) / 2, z))


def block(x0, x1, y0, y1, z0, z1, taper_top=(1.0, 1.0), bevel=0.0):
    return bm_box(x1 - x0, y1 - y0, z1 - z0, center=((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2),
                  taper_top=taper_top, bevel=bevel)


def weapon_root(name, frame, vents, cell, muzzle_pos, extra=()):
    root = empty(name, size=0.1)
    mesh_object("frame", frame, "mat_interactive", parent=root)
    if vents is not None:
        mesh_object("heat_vents", vents, "mat_player_cyan", parent=root)
    if cell is not None:
        mesh_object("heat_cell", cell, "mat_player_cyan", parent=root)
    for ename, bm in extra:
        mesh_object(ename, bm, "mat_player_cyan", parent=root)
    empty("muzzle", parent=root, location=muzzle_pos, size=0.03)
    support_positions = {
        "pistol": (0, -0.02, -0.105), "blaster": (0, -0.02, -0.125),
        "rifle": (0, 0.28, 0.012), "scatter": (0, 0.28, -0.008),
        "sniper_rifle": (0, 0.30, 0.017), "beam": (0, 0.22, 0.018),
        "emp_launcher": (0, 0.20, 0.014),
    }
    empty("support", parent=root, location=support_positions[name], size=0.025)
    return root


def build_blaster():
    """Blaster gracza z przegrzaniem: średni pistolet energetyczny z kołpakiem lufy."""
    frame = bm_merge(
        block(-0.025, 0.025, -0.07, 0.19, 0.03, 0.1, taper_top=(0.9, 0.95), bevel=0.008),  # zamek
        block(-0.021, 0.021, -0.05, 0.01, -0.1, 0.03, taper_top=(1.0, 1.15), bevel=0.006),  # chwyt
        block(-0.015, 0.015, 0.01, 0.06, 0.0, 0.012),  # kabłąk
        block(-0.012, 0.012, 0.06, 0.07, -0.03, 0.012),
        tube(0.19, 0.31, 0.02, 0.016, sides=8, z=0.07),  # lufa
        tube(0.285, 0.325, 0.026, 0.026, sides=8, z=0.07),  # kołpak lufy
        block(-0.006, 0.006, -0.06, -0.03, 0.1, 0.12),  # szczerbinka
        block(-0.004, 0.004, 0.16, 0.18, 0.1, 0.118),  # muszka
    )
    vents = bm_merge(*[block(-0.027, 0.027, 0.0 + i * 0.035, 0.018 + i * 0.035, 0.045, 0.085) for i in range(4)])
    cell = block(-0.023, 0.023, -0.045, 0.005, -0.12, -0.092)
    return weapon_root("blaster", frame, vents, cell, (0, 0.33, 0.07))


def build_pistol():
    """Pistolet: zwarty, krótki zamek, pochylony chwyt, trzy cyjanowe nacięcia."""
    frame = bm_merge(
        block(-0.02, 0.02, -0.04, 0.12, 0.02, 0.075, taper_top=(0.85, 1.0), bevel=0.005),  # zamek
        block(-0.018, 0.018, -0.04, 0.0, -0.09, 0.02, taper_top=(1.0, 1.2), bevel=0.005),  # chwyt
        tube(0.12, 0.15, 0.012, 0.012, sides=6, z=0.052),  # wylot
        block(-0.012, 0.012, 0.0, 0.05, 0.0, 0.012),  # kabłąk
        block(-0.005, 0.005, -0.035, -0.015, 0.075, 0.09),  # szczerbinka
    )
    vents = bm_merge(*[block(-0.0215, 0.0215, 0.02 + i * 0.03, 0.036 + i * 0.03, 0.035, 0.065) for i in range(3)])
    cell = block(-0.02, 0.02, -0.04, 0.0, -0.1, -0.09)
    return weapon_root("pistol", frame, vents, cell, (0, 0.155, 0.052))


def build_rifle():
    """Karabin: długi, kolba, rączka, ogniwo ciepła jak magazynek pod komorą."""
    frame = bm_merge(
        block(-0.025, 0.025, -0.08, 0.2, 0.0, 0.1, taper_top=(0.9, 1.0), bevel=0.006),  # komora
        block(-0.022, 0.022, 0.2, 0.42, 0.015, 0.085, bevel=0.005),  # łoże
        tube(0.42, 0.6, 0.014, 0.012, sides=8, z=0.05),  # lufa
        tube(0.57, 0.62, 0.02, 0.02, sides=6, z=0.05),  # tłumik
        block(-0.02, 0.02, -0.22, -0.08, -0.035, 0.085, taper_top=(0.9, 0.7)),  # kolba
        block(-0.018, 0.018, -0.07, -0.02, -0.11, 0.0, taper_top=(1.0, 1.2)),  # chwyt
        block(-0.008, 0.008, 0.0, 0.24, 0.1, 0.118),  # szyna z celownikiem
    )
    vents = bm_merge(*[block(-0.0235, 0.0235, 0.24 + i * 0.045, 0.262 + i * 0.045, 0.03, 0.07) for i in range(4)])
    cell = block(-0.02, 0.02, 0.07, 0.14, -0.1, 0.0)
    return weapon_root("rifle", frame, vents, cell, (0, 0.625, 0.05))


def build_scatter():
    """Rozpraszacz: szeroki, dwie grube lufy w jednej osłonie, pompa, krótka kolba."""
    frame = bm_merge(
        block(-0.05, 0.05, 0.0, 0.2, 0.0, 0.1, taper_top=(0.9, 1.0), bevel=0.008),  # szeroka komora
        tube(0.2, 0.42, 0.028, 0.028, sides=6, x=-0.03, z=0.07),
        tube(0.2, 0.42, 0.028, 0.028, sides=6, x=0.03, z=0.07),
        block(-0.06, 0.06, 0.2, 0.3, 0.035, 0.105, bevel=0.006),  # osłona
        block(-0.034, 0.034, 0.22, 0.34, -0.005, 0.03, bevel=0.005),  # pompa
        block(-0.026, 0.026, -0.14, 0.0, -0.03, 0.09, taper_top=(0.9, 0.8)),  # kolba
        block(-0.02, 0.02, -0.06, 0.02, -0.13, 0.0, taper_top=(1.0, 1.2)),  # chwyt
    )
    vents = bm_merge(*[block(-0.052, 0.052, 0.02 + i * 0.045, 0.038 + i * 0.045, 0.045, 0.095) for i in range(4)])
    cell = block(-0.025, 0.025, -0.01, 0.06, -0.15, -0.115)
    return weapon_root("scatter", frame, vents, cell, (0, 0.43, 0.07))


def build_sniper_rifle():
    """Snajperka: bardzo długa, smukła lufa, duża luneta z cyjanową soczewką."""
    frame = bm_merge(
        block(-0.02, 0.02, -0.08, 0.2, 0.0, 0.085, bevel=0.005),  # komora
        block(-0.017, 0.017, 0.2, 0.55, 0.02, 0.07),  # łoże
        tube(0.55, 0.86, 0.011, 0.01, sides=8, z=0.045),  # lufa
        block(-0.02, 0.02, 0.86, 0.92, 0.025, 0.068),  # hamulec wylotowy
        block(-0.022, 0.022, -0.24, -0.08, -0.04, 0.085, taper_top=(0.9, 0.6)),  # kolba
        block(-0.016, 0.016, -0.065, -0.02, -0.11, 0.0, taper_top=(1.0, 1.2)),  # chwyt
        tube(0.0, 0.34, 0.03, 0.03, sides=8, z=0.145),  # luneta
        tube(0.34, 0.4, 0.036, 0.036, sides=8, z=0.145),  # osłona obiektywu
        tube(-0.06, 0.0, 0.026, 0.03, sides=8, z=0.145),
        block(-0.006, 0.006, 0.05, 0.08, 0.085, 0.12),  # mocowania lunety
        block(-0.006, 0.006, 0.24, 0.27, 0.085, 0.12),
    )
    vents = bm_merge(*[block(-0.0195, 0.0195, 0.3 + i * 0.055, 0.32 + i * 0.055, 0.03, 0.062) for i in range(4)])
    cell = block(-0.017, 0.017, -0.16, -0.1, 0.09, 0.115)
    lens = tube(0.395, 0.405, 0.03, 0.03, sides=8, z=0.145)
    return weapon_root("sniper_rifle", frame, vents, cell, (0, 0.93, 0.045), extra=[("scope_lens", lens)])


def build_beam():
    """Laser: gruby emiter z soczewką na froncie, cewki dookoła rury, chwyt pistoletowy."""
    frame = bm_merge(
        tube(0.0, 0.3, 0.036, 0.042, sides=8, z=0.07),  # rura emitera
        block(-0.03, 0.03, -0.1, 0.02, 0.03, 0.09, bevel=0.006),  # moduł zasilania z tyłu
        block(-0.02, 0.02, -0.04, 0.03, -0.1, 0.03, taper_top=(1.0, 1.15)),  # chwyt
        block(-0.014, 0.014, 0.03, 0.09, 0.0, 0.012),  # kabłąk
        tube(0.3, 0.34, 0.052, 0.058, sides=8, z=0.07),  # kołnierz lufy
        block(-0.006, 0.006, 0.05, 0.16, 0.108, 0.128),  # grzebień
    )
    coils = bm_merge(*[tube(0.04 + i * 0.065, 0.062 + i * 0.065, 0.052, 0.052, sides=8, z=0.07) for i in range(4)])
    lens = tube(0.34, 0.352, 0.044, 0.01, sides=8, z=0.07)
    cell = block(-0.026, 0.026, -0.095, -0.03, 0.04, 0.08)
    return weapon_root("beam", frame, coils, cell, (0, 0.36, 0.07), extra=[("lens", lens)])


def build_emp_launcher():
    """Granatnik EMP: gruba tuba, bęben, rozszerzony wylot i kondensator."""
    frame = bm_merge(
        tube(0.04, 0.38, 0.05, 0.05, sides=8, z=0.07),  # tuba
        tube(0.38, 0.45, 0.05, 0.07, sides=8, z=0.07),  # rozszerzony wylot
        tube(-0.02, 0.1, 0.074, 0.074, sides=8, z=0.07),  # bęben
        block(-0.026, 0.026, -0.14, -0.02, -0.01, 0.09, taper_top=(0.9, 0.8)),  # kolba
        block(-0.02, 0.02, 0.0, 0.07, -0.12, 0.0, taper_top=(1.0, 1.2)),  # chwyt
        block(-0.014, 0.014, 0.1, 0.16, -0.02, 0.01),  # chwyt przedni
        block(-0.007, 0.007, 0.2, 0.3, 0.125, 0.145),  # szyna
    )
    rings = bm_merge(*[tube(0.14 + i * 0.07, 0.16 + i * 0.07, 0.054, 0.054, sides=8, z=0.07) for i in range(3)])
    cell = block(-0.018, 0.018, 0.0, 0.08, 0.142, 0.162)
    return weapon_root("emp_launcher", frame, rings, cell, (0, 0.46, 0.07))


def build_blade_twin():
    """Rękojeść wariantu bliźniaczego: krótsza, z poprzeczną osłoną. Węzły jak plasma_blade."""
    root = empty("blade_twin", size=0.1)
    hilt = bm_merge(
        bm_prism(0.17, 0.024, 0.024, sides=8, axis="Y", top_at_origin=False, offset=(0, 0.0, 0)),
        bm_prism(0.03, 0.032, 0.032, sides=8, axis="Y", top_at_origin=False, offset=(0, 0.075, 0)),  # gardło
        bm_prism(0.025, 0.03, 0.03, sides=8, axis="Y", top_at_origin=False, offset=(0, -0.09, 0)),  # głowica
        bm_box(0.1, 0.012, 0.016, center=(0, 0.056, 0)),  # poprzeczna osłona
        bm_box(0.012, 0.05, 0.02, center=(0.026, 0.02, 0)),
    )
    mesh_object("hilt", hilt, "mat_interactive", parent=root)
    ring = bm_prism(0.012, 0.034, 0.034, sides=8, axis="Y", top_at_origin=False, offset=(0, 0.1, 0))
    mesh_object("emitter_ring", ring, "mat_player_cyan", parent=root)
    pivot = empty("blade", parent=root, location=(0, 0.106, 0), size=0.05)
    core = bm_prism(1.0, 0.012, 0.018, sides=6, axis="Y", top_at_origin=False, offset=(0, 0.5, 0))
    mesh_object("blade_core", core, "mat_player_cyan", parent=pivot, location=(0, 0.106, 0))
    empty("blade_tip", parent=pivot, location=(0, 1.106, 0), size=0.05)
    return root


def build_blade_staff():
    """Kij: długa rękojeść (0,8 m) z emiterami na obu końcach; chwyt w środku."""
    root = empty("blade_staff", size=0.1)
    hilt = bm_merge(
        bm_prism(0.8, 0.02, 0.02, sides=8, axis="Y", top_at_origin=False, offset=(0, 0.0, 0)),
        bm_prism(0.1, 0.027, 0.027, sides=8, axis="Y", top_at_origin=False, offset=(0, 0.0, 0)),  # uchwyt
        bm_prism(0.03, 0.03, 0.03, sides=8, axis="Y", top_at_origin=False, offset=(0, 0.385, 0)),
        bm_prism(0.03, 0.03, 0.03, sides=8, axis="Y", top_at_origin=False, offset=(0, -0.385, 0)),
        bm_box(0.012, 0.08, 0.02, center=(0.024, 0.0, 0)),
    )
    mesh_object("hilt", hilt, "mat_interactive", parent=root)
    ring_f = bm_prism(0.012, 0.032, 0.032, sides=8, axis="Y", top_at_origin=False, offset=(0, 0.406, 0))
    ring_b = bm_prism(0.012, 0.032, 0.032, sides=8, axis="Y", top_at_origin=False, offset=(0, -0.406, 0))
    mesh_object("emitter_ring", bm_merge(ring_f, ring_b), "mat_player_cyan", parent=root)
    front = empty("blade", parent=root, location=(0, 0.412, 0), size=0.05)
    core = bm_prism(1.0, 0.012, 0.018, sides=6, axis="Y", top_at_origin=False, offset=(0, 0.5, 0))
    mesh_object("blade_core", core, "mat_player_cyan", parent=front, location=(0, 0.412, 0))
    empty("blade_tip", parent=front, location=(0, 1.412, 0), size=0.05)
    back = empty("blade_back", parent=root, location=(0, -0.412, 0), size=0.05)
    core_b = bm_prism(1.0, 0.018, 0.012, sides=6, axis="Y", top_at_origin=False, offset=(0, -0.5, 0))
    mesh_object("blade_back_core", core_b, "mat_player_cyan", parent=back, location=(0, -0.412, 0))
    empty("blade_back_tip", parent=back, location=(0, -1.412, 0), size=0.05)
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


def _hand_surface(name, vertices, faces, mat, parent):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent
    mesh.materials.append(material(mat))
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(mesh)
    bm.free()
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    return obj


def _hand_subdivide(obj, levels=1):
    bpy.context.view_layer.objects.active = obj
    modifier = obj.modifiers.new("Tailored quad surface", "SUBSURF")
    modifier.levels = levels
    bpy.ops.object.modifier_move_up(modifier=modifier.name)
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def _hand_bone_child(obj, rig, bone, world):
    obj.parent = rig
    obj.parent_type = "BONE"
    obj.parent_bone = bone
    obj.matrix_parent_inverse = Matrix.Identity(4)
    bpy.context.view_layer.update()
    obj.matrix_world = world
    obj.scale = (1, 1, 1)
    bpy.context.view_layer.update()


def _hand_tube(name, centers, radii, mat, root, closed=False, sides=8):
    vertices, faces = [], []
    for i, center in enumerate(centers):
        before = (i - 1) % len(centers) if closed else max(0, i - 1)
        after = (i + 1) % len(centers) if closed else min(len(centers) - 1, i + 1)
        tangent = Vector(centers[after]) - Vector(centers[before])
        if tangent.length < 1e-6:
            tangent = Vector((0, 0, 1))
        tangent.normalize()
        cross = tangent.cross(Vector((0, 1, 0)))
        if cross.length < 0.1:
            cross = tangent.cross(Vector((1, 0, 0)))
        cross.normalize()
        other = tangent.cross(cross).normalized()
        for j in range(sides):
            angle = 2 * math.pi * j / sides
            vertices.append(Vector(center) + radii[i] * (cross * math.cos(angle) + other * math.sin(angle)))
    for i in range(len(centers) if closed else len(centers) - 1):
        for j in range(sides):
            faces.append((i * sides + j, i * sides + (j + 1) % sides,
                          ((i + 1) % len(centers)) * sides + (j + 1) % sides,
                          ((i + 1) % len(centers)) * sides + j))
    if not closed:
        faces.extend((tuple(reversed(range(sides))), tuple((len(centers) - 1) * sides + j for j in range(sides))))
    return _hand_surface(name, vertices, faces, mat, root)


def _hand_dorsal_points(glove, basis):
    from mathutils.bvhtree import BVHTree

    surface = BVHTree.FromPolygons([v.co for v in glove.data.vertices],
                                   [p.vertices for p in glove.data.polygons])
    inverse = basis.inverted()
    points = []
    for z in (-.020, -.029, -.044, -.060, -.071):
        origin = basis @ Vector((.020, -.080, z))
        direction = basis.to_3x3() @ Vector((0, 1, 0))
        position, normal, _, _ = surface.ray_cast(origin, direction)
        if position is None:
            raise RuntimeError("Dorsal piping must stay on the glove surface")
        points.append(inverse @ (position + normal * .0003))
    return points


def build_player_arm(side: str):
    """Continuous tailored glove: quad palm/webs, joint loops and baked subdivision.

    Construction coordinates are glTF metres. Bone Y follows each finger; bone X
    is the flexion hinge and bone Z faces the palm. Positive X curls both hands.
    Reflection is baked into vertices and proper rest frames, never object scale.
    """
    root = empty(f"player_arm_{side}", size=0.05)
    reflection = Matrix.Diagonal((-1, 1, 1, 1)) if side == "L" else Matrix.Identity(4)
    basis = HAND_BASIS @ reflection
    forward_frame = Matrix.Rotation(-math.pi / 2, 4, "X")
    fingers = (
        ("pinky", -0.032, -0.083, (0.032, 0.020, 0.018), 0.0087, 0.105),
        ("ring", -0.013, -0.093, (0.040, 0.025, 0.020), 0.0103, 0.035),
        ("middle", 0.009, -0.096, (0.043, 0.027, 0.021), 0.0110, -0.012),
        ("index", 0.031, -0.090, (0.039, 0.024, 0.020), 0.0105, -0.065),
    )
    # Distal edge: four dorsal vertices and four palmar vertices per finger.
    angles = [math.pi + (j + 0.5) * math.pi / 4 for j in range(8)]
    frames, lengths_by_name = {}, {}
    for name, x, z, lengths, radius, spread in fingers:
        frames[name] = Matrix.Translation((x, 0, z)) @ Matrix.Rotation(spread, 4, "Y")
        lengths_by_name[name] = lengths
    # The metacarpal emerges from the thenar mound, diagonally forward, not sideways.
    frames["thumb"] = (Matrix.Translation((0.034, 0.006, -0.034))
                       @ Matrix.Rotation(-0.10, 4, "X")
                       @ Matrix.Rotation(-0.60, 4, "Y")
                       @ Matrix.Rotation(0.62, 4, "Z"))
    lengths_by_name["thumb"] = (0.028, 0.025, 0.021)
    vertices, faces, weights = [], [], []

    def vertex(point, influence):
        vertices.append(basis @ Vector(point))
        weights.append(influence)
        return len(vertices) - 1

    def bridge(a, b):
        for j in range(len(a)):
            faces.append((a[j], a[(j + 1) % len(a)], b[(j + 1) % len(b)], b[j]))

    distal = []
    for name, x, z, lengths, radius, spread in fingers:
        distal.append([frames[name] @ Vector((radius * math.cos(a), radius * 0.89 * math.sin(a), 0)) for a in angles])
    # Cross sections run from jacket opening to knuckle line. A distal scallop
    # blends the four knuckle cushions into the back instead of adding armour boxes.
    sections = (
        (0.340, .048, .036), (.335, .049, .037), (.310, .048, .036),
        (.275, .046, .034), (.235, .043, .032), (.190, .041, .030),
        (.145, .037, .027), (.100, .033, .025), (.066, .031, .024),
        (.047, .031, .024), (.043, .029, .023), (.038, .029, .023),
        (.033, .027, .021), (.018, .025, .019), (.002, .025, .017),
        (-.017, .029, .017), (-.036, .036, .020), (-.055, .040, .020),
        (-.072, .041, .018), (-.083, .041, .016), (None, None, None),
    )
    rings = []
    for row, (z, width, depth) in enumerate(sections):
        dorsal, palmar = [], []
        for f, (name, *_) in enumerate(fingers):
            for j in range(8):
                endpoint = distal[f][j]
                if z is None:
                    point = endpoint
                    influence = {"palm": .55, f"{name}_1": .45}
                else:
                    u = endpoint.x / .041
                    y = (-1 if j < 4 else 1) * depth * math.sqrt(max(.10, 1 - .82 * u * u))
                    # Palm pads and restrained dorsal tendon ridges.
                    if z < -.015:
                        if j >= 4:
                            y += .0025 * math.exp(-((endpoint.x - .023) / .018) ** 2)
                        else:
                            y -= .0014 * math.exp(-((j - 1.5) / .9) ** 2)
                    if z > .047:
                        y += .0013 * math.cos(u * 4.5 + row * 1.7) * math.exp(-((z - .105) / .095) ** 2)
                    center_x = .006 * max(0, z) / .34
                    point = Vector((u * width + center_x, y, z))
                    blend = max(0, min(1, (-z - .058) / .032))
                    point = point.lerp(endpoint, blend * .65)
                    if z > .040:
                        influence = {"forearm": 1}
                    elif z > .005:
                        t = (z - .005) / .035
                        influence = {"forearm": t, "wrist": 1 - t}
                    else:
                        t = max(0, min(1, (-z + .002) / .025))
                        influence = {"wrist": 1 - t, "palm": t}
                index = vertex(point, influence)
                (dorsal if j < 4 else palmar).append(index)
        # Around the perimeter: dorsal left->right, palmar right->left.
        ring = dorsal + [v for f in reversed(range(4)) for v in palmar[f * 4:f * 4 + 4]]
        rings.append(ring)
        if row:
            # Thumb opening on the radial side over three palm rows (8-edge boundary).
            previous = rings[row - 1]
            for j in range(32):
                if j == 15 and row in (16, 17, 18):
                    continue
                faces.append((previous[j], previous[(j + 1) % 32], ring[(j + 1) % 32], ring[j]))
    faces.append(tuple(reversed(rings[0])))
    last = rings[-1]
    for f in range(3):
        # Real webbing between adjoining fingers, continuous with both palm surfaces.
        faces.append((last[f * 4 + 3], last[(f + 1) * 4], last[31 - (f + 1) * 4], last[28 - f * 4]))

    finger_specs = list(fingers) + [("thumb", 0, 0, lengths_by_name["thumb"], .0113, 0)]
    for f, (name, x, z, lengths, radius, spread) in enumerate(finger_specs):
        frame = frames[name]
        if name == "thumb":
            previous = [rings[r][15] for r in (15, 16, 17, 18)] + [rings[r][16] for r in (18, 17, 16, 15)]
            base_points = [frame @ Vector((radius * 1.25 * math.cos(a), radius * math.sin(a), -.016)) for a in angles]
            # Match perimeter order geometrically: no crossed quads in the thumb web.
            candidates = []
            for order in (previous, list(reversed(previous))):
                for shift in range(8):
                    candidate = order[shift:] + order[:shift]
                    cost = sum((basis.inverted() @ vertices[v] - point).length_squared
                               for v, point in zip(candidate, base_points))
                    candidates.append((cost, candidate))
            previous = min(candidates, key=lambda entry: entry[0])[1]
            transition, base = [], []
            for index, point in zip(previous, base_points):
                boundary = basis.inverted() @ vertices[index]
                weights[index] = {"palm": .88, "thumb_1": .12}
                transition.append(vertex(boundary.lerp(point, .48), {"palm": .78, "thumb_1": .22}))
                base.append(vertex(point, {"palm": .25, "thumb_1": .75}))
            bridge(previous, transition)
            bridge(transition, base)
            previous = base
        else:
            previous = [last[f * 4 + j] for j in range(4)] + [last[28 - f * 4 + j] for j in range(4)]
        total = sum(lengths)
        joints = (0, lengths[0], lengths[0] + lengths[1])
        distances = sorted(set((.004, lengths[0] * .52, lengths[0] - .004, lengths[0],
                                lengths[0] + .004, joints[2] - .004, joints[2], joints[2] + .004,
                                total - .009, total - .004, total - .001)))
        for distance in distances:
            if name == "thumb" and distance <= .016:
                continue
            t = distance / total
            taper = 1 - .26 * t
            tip = min(1, max(.22, (total - distance) / .007)) ** .5
            bulge = 1 + .10 * sum(math.exp(-((distance - joint) / .004) ** 2) for joint in joints[1:])
            influence = {f"{name}_{min(3, 1 + sum(distance > joint for joint in joints[1:]))}": 1}
            for joint_index, joint in enumerate(joints[1:], 1):
                if abs(distance - joint) <= .006:
                    t_joint = max(0, min(1, .5 + (distance - joint) / .012))
                    influence = {f"{name}_{joint_index}": 1 - t_joint, f"{name}_{joint_index + 1}": t_joint}
            root_blend = .016 if name == "thumb" else .009
            if distance < root_blend:
                t_root = distance / root_blend
                influence = {"palm": .45 * (1 - t_root), f"{name}_1": .55 + .45 * t_root}
            ring = []
            for a in angles:
                # Oval pad, slightly full on the palm side; integrated knuckle cushion.
                xx = radius * taper * tip * math.cos(a)
                yy = radius * .88 * taper * tip * math.sin(a) * bulge
                if math.sin(a) > 0:
                    yy *= 1.06
                ring.append(vertex(frame @ Vector((xx, yy, -distance)), influence))
            bridge(previous, ring)
            previous = ring
        faces.append(tuple(previous))

    glove = _hand_surface("tactical_glove", vertices, faces, "mat_interactive", root)
    # All vertices above are already in Blender world coordinates, with identity transforms.
    armature = bpy.data.armatures.new(f"hand_skeleton_{side}")
    rig = bpy.data.objects.new(f"hand_skeleton_{side}", armature)
    bpy.context.scene.collection.objects.link(rig)
    rig.parent = root
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")

    def bone(name, joint_frame, length, parent=None):
        edit = armature.edit_bones.new(name)
        rotation = reflection @ joint_frame @ reflection
        rotation.translation = reflection @ joint_frame.translation
        edit.length = length
        edit.matrix = HAND_BASIS @ rotation @ forward_frame
        if parent:
            edit.parent = armature.edit_bones[parent]
        return edit

    bone("forearm", Matrix.Translation((0, 0, .30)), .28)
    bone("wrist", Matrix.Identity(4), .009, "forearm")
    bone("palm", Matrix.Identity(4), .075, "wrist")
    for name, _, _, lengths, _, _ in finger_specs:
        distance, parent = 0, "palm"
        for j, length in enumerate(lengths):
            joint_name = f"{name}_{j + 1}"
            bone(joint_name, frames[name] @ Matrix.Translation((0, 0, -distance)), length, parent)
            distance += length
            parent = joint_name
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="DESELECT")
    glove.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")
    # Heat weights seed the skin; topology-specific corrections isolate adjacent digits,
    # keep the jacket stable, and spread each joint over three supporting loops.
    for group in glove.vertex_groups:
        group.remove(range(len(vertices)))
    for name in (b.name for b in armature.bones):
        if not glove.vertex_groups.get(name):
            glove.vertex_groups.new(name=name)
    for index, influence in enumerate(weights):
        for name, weight in influence.items():
            if weight > 0:
                glove.vertex_groups[name].add([index], weight, "REPLACE")
    _hand_subdivide(glove)
    arm_modifier = next(m for m in glove.modifiers if m.type == "ARMATURE")
    # Subdivision is baked before linear skinning, including interpolated vertex weights.
    arm_modifier.use_deform_preserve_volume = False

    def palm_detail(obj, position=(0, 0, 0)):
        obj.data.transform(basis)
        if side == "L":
            bm = bmesh.new()
            bm.from_mesh(obj.data)
            bmesh.ops.reverse_faces(bm, faces=list(bm.faces))
            bm.to_mesh(obj.data)
            bm.free()
        _hand_bone_child(obj, rig, "palm", Matrix.Translation(basis @ Vector(position)))
        return obj

    # Thin light piping, seated in the glove surface rather than raised armour.
    trace = _hand_tube("dorsal_trace", _hand_dorsal_points(glove, basis),
                       [.0009] * 5, "mat_player_cyan", root)
    palm_detail(trace)
    cuff_centers = []
    for index in rings[11]:
        point = basis.inverted() @ vertices[index]
        outward = Vector((point.x, point.y, 0)).normalized()
        cuff_centers.append(point + outward * .0008)
    cuff = _hand_tube("wrist_light", cuff_centers, [.0011] * 32, "mat_player_cyan", root, closed=True)
    cuff.data.transform(basis)
    if side == "L":
        bm = bmesh.new()
        bm.from_mesh(cuff.data)
        bmesh.ops.reverse_faces(bm, faces=list(bm.faces))
        bm.to_mesh(cuff.data)
        bm.free()
    _hand_bone_child(cuff, rig, "forearm", Matrix.Identity(4))
    for name, size, position, mat in (
        ("resonance_mount", (.014, .004, .019), (0, -.020, -.047), "mat_interactive"),
        ("resonance_core", (.0105, .0032, .0145), (0, -.023, -.047), "mat_power_magenta"),
    ):
        obj = mesh_object(name, bm_ico(1, subdiv=3, scale=size), mat)
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
        palm_detail(obj, position)
    gun_rotation = (Matrix(((0, 1, 0), (-1, 0, 0), (0, 0, 1))).to_4x4()
                    @ Matrix.Rotation(-.05, 4, "X"))
    blade_rotation = Matrix(((0, 0, -1), (0, 1, 0), (1, 0, 0))).to_4x4() @ Matrix.Rotation(math.pi / 2, 4, "Z")
    for name, loc, rotation in (
        ("palm_center", (0, .018, -.049), Matrix.Rotation(math.pi / 2, 4, "X")),
        ("socket_gun", (.06158, .04108, -.11575), gun_rotation),
        ("socket_blade", (0, .0422, -.08544), blade_rotation),
        ("socket_support", (.00420, .03100, -.10321), Matrix.Rotation(math.radians(55), 4, "Y")),
    ):
        obj = empty(name, size=.012)
        world = HAND_BASIS @ reflection @ Matrix.Translation(loc) @ rotation @ reflection @ HAND_BASIS.inverted()
        _hand_bone_child(obj, rig, "palm", world)
    bpy.context.view_layer.update()
    return root


def hand_pose(root, name):
    with open(HAND_POSES, encoding="utf-8") as source:
        angles = json.load(source)["poses"][name]
    rig = next(o for o in root.children_recursive if o.type == "ARMATURE")
    for joint in rig.pose.bones:
        rotation = Matrix.Identity(4)
        # Bone X is the same hinge in Blender and glTF; XYZ order matches Three.js.
        for axis, angle in zip("XYZ", angles.get(joint.name, (0, 0, 0))):
            rotation = rotation @ Matrix.Rotation(angle, 4, axis)
        joint.rotation_mode = "QUATERNION"
        joint.rotation_quaternion = rotation.to_quaternion()
    bpy.context.view_layer.update()


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


def hand_preview(path, target=(0, 0, 0), direction=(0.9, -0.85, -0.6), span=0.55, fpp=False):
    """Kamera opisana w glTF; Workbench zachowuje materiały docelowej palety."""
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    shading = scene.display.shading
    shading.light = "STUDIO"
    shading.studiolight_rotate_z = 0.35
    shading.color_type = "MATERIAL"
    shading.show_shadows = True
    shading.show_cavity = True
    shading.cavity_type = "BOTH"
    shading.curvature_ridge_factor = 1.6
    shading.curvature_valley_factor = 1.2
    shading.show_object_outline = True
    shading.background_type = "WORLD"
    scene.world = bpy.data.worlds.new("hand_preview_world")
    scene.world.color = (0.15, 0.18, 0.21)
    scene.render.resolution_x = 1440 if fpp else 1200
    scene.render.resolution_y = 810 if fpp else 1000
    scene.render.resolution_percentage = 100
    scene.display.render_aa = "32"
    camera_data = bpy.data.cameras.new("hand_camera")
    camera = bpy.data.objects.new("hand_camera", camera_data)
    scene.collection.objects.link(camera)
    camera_data.clip_start = 0.005
    if fpp:
        camera_data.type = "PERSP"
        camera_data.sensor_fit = "VERTICAL"
        camera_data.sensor_height = 24
        camera_data.lens = 12 / math.tan(math.radians(70) / 2)
        camera.matrix_world = HAND_BASIS.copy()
    else:
        camera_data.type = "ORTHO"
        camera_data.ortho_scale = span
        aim = HAND_BASIS @ Vector(target)
        camera.location = aim + HAND_BASIS.to_3x3() @ Vector(direction).normalized() * 2
        camera.rotation_euler = (aim - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = camera
    scene.render.filepath = os.path.join(PREVIEW_DIR, path)
    bpy.ops.render.render(write_still=True)


def hand_object(root, name):
    return next(o for o in root.children_recursive if o.name.split(".")[0] == name)


def attach_hand_item(hand, item, socket_name):
    socket = hand_object(hand, socket_name)
    item.parent = socket
    item.matrix_parent_inverse = Matrix.Identity(4)
    item.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()


def render_hand_previews():
    for side in ("R", "L"):
        reset_scene()
        hand = build_player_arm(side)
        hand_pose(hand, "relaxed")
        hand_preview(f"player_arm_{side}.png", target=(0, 0, .065), span=.61)
        if side == "R":
            hand_preview("hand_relaxed_detail.png", target=(.008, 0, -.060),
                         direction=(.25, -1, -.4), span=.29)
    for pose in ("open", "fist"):
        reset_scene()
        right = build_player_arm("R")
        left = build_player_arm("L")
        hand_pose(right, pose)
        hand_pose(left, pose)
        right.location.x = -0.105
        left.location.x = 0.105
        hand_preview(f"hand_pose_{pose}.png", target=(0, 0, 0.04),
                     direction=(0.05, -1, -0.55), span=0.75)
        if pose == "fist":
            hand_preview("hand_fist_inner.png", target=(0, .02, -.06),
                         direction=(.10, 1, -.4), span=.42)
    for name, builder, pose, socket in (
        ("blade", build_plasma_blade, "gripBlade", "socket_blade"),
        ("pistol", build_pistol, "gripGun", "socket_gun"),
        ("pistol_fire", build_pistol, "gripGunFire", "socket_gun"),
        ("blaster", build_blaster, "gripGun", "socket_gun"),
        ("rifle", build_rifle, "gripGun", "socket_gun"),
    ):
        reset_scene()
        right = build_player_arm("R")
        hand_pose(right, pose)
        item = builder()
        attach_hand_item(right, item, socket)
        if name == "rifle":
            left = build_player_arm("L")
            hand_pose(left, "support")
            support = hand_object(item, "support")
            socket_left = hand_object(left, "socket_support")
            left.matrix_world = support.matrix_world @ socket_left.matrix_world.inverted()
            bpy.context.view_layer.update()
        hand_preview(f"hand_grip_{name}.png", target=(0.01, 0.01, -0.18 if name == "rifle" else 0.035),
                     direction=(0.9, -0.75, -0.5), span=0.65 if name != "rifle" else 1.22)
        if name == "blade":
            hand_preview("hand_grip_blade_inner.png", target=(0, 0.03, -0.1),
                         direction=(-0.4, 1, -0.35), span=0.32)
        if name == "rifle":
            target = HAND_BASIS.inverted() @ support.matrix_world.translation
            hand_preview("hand_support_rifle.png", target=target,
                         direction=(-0.6, 0.9, -0.3), span=0.34)
        if name == "pistol":
            hand_preview("hand_grip_pistol_inner.png", target=(0.01, 0.025, -0.08),
                         direction=(-0.6, 1, -0.5), span=0.30)
            socket = hand_object(right, "socket_gun")
            right.matrix_world = (Matrix.Translation(HAND_BASIS @ Vector((0.22, -0.24, -0.45)))
                                  @ socket.matrix_world.to_quaternion().inverted().to_matrix().to_4x4())
            bpy.context.view_layer.update()
            hand_preview("hand_fpp_view.png", fpp=True)


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
        "pistol": build_pistol,
        "rifle": build_rifle,
        "scatter": build_scatter,
        "sniper_rifle": build_sniper_rifle,
        "beam": build_beam,
        "emp_launcher": build_emp_launcher,
        "blade_twin": build_blade_twin,
        "blade_staff": build_blade_staff,
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
            if name.startswith("player_arm_"):
                hand_pose(root, "relaxed")
                hand_preview(f"{name}.png", target=(0, 0, 0.065), span=0.61)
            else:
                render_preview(root, os.path.join(PREVIEW_DIR, f"{name}.png"))
        tris = sum(len(p.vertices) - 2 for o in [root, *root.children_recursive] if o.type == "MESH"
                   for p in o.data.polygons)
        print(f"[neoryder] built {name} tris={tris}")
    if preview and (only is None or "hand_previews" in only):
        render_hand_previews()


if __name__ == "__main__":
    main()
