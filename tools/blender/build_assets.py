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
        "arm_spread_deg": 8.0, "mat": "mat_enemy",
    }
    b.update(build)
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
        au.rotation_euler = (0, spread, 0)
        bpy.context.view_layer.update()
        elbow = au.matrix_world @ Vector((0, 0, -b["arm_upper"]))
        al = mesh_object(f"arm_lower_{side}", bm_prism(b["arm_lower"], b["arm_r"] * 0.85, b["wrist_r"]), m,
                         parent=au, location=elbow)
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


def build_enemy_trooper():
    """Szturmowiec: masywny, naramienniki, pałka elektryczna w prawej ręce."""
    root = humanoid("enemy_trooper", {
        "chest_w": 0.54, "waist_w": 0.34, "torso_d": 0.28, "shoulder_x": 0.29,
        "arm_r": 0.065, "wrist_r": 0.045, "thigh_r": 0.095, "head_r": 0.115, "arm_spread_deg": 12,
    })
    objs = {o.name: o for o in bpy.data.objects}
    torso, head = objs["torso"], objs["head"]
    for side, sx in (("L", 1), ("R", -1)):
        pad = bm_box(0.18, 0.24, 0.1, center=(0, 0, 0), taper_top=(0.75, 0.8), bevel=0.02)
        p = mesh_object(f"shoulder_pad_{side}", pad, "mat_enemy", parent=torso,
                        location=(sx * 0.31, 0, 1.47))
        p.rotation_euler = (0, math.radians(-18 * sx), 0)
    # hełm z wizjerem
    helmet = bm_box(0.27, 0.29, 0.27, center=(0, 0, 0.185), taper_top=(0.82, 0.85), bevel=0.025)
    mesh_object("helmet", helmet, "mat_enemy", parent=head, location=wpos(head))
    visor = bm_box(0.2, 0.02, 0.04, center=(0, FWD * 0.148, 0.2))
    mesh_object("visor", visor, "mat_enemy_glow", parent=head, location=wpos(head))
    # pałka elektryczna
    hand = objs["hand_R"]
    bpy.context.view_layer.update()
    grip = hand.matrix_world @ Vector((0, 0, -0.05))
    baton = empty("baton", parent=hand, location=grip, size=0.05)
    shaft = bm_prism(0.62, 0.022, 0.026, sides=6, axis="Y", top_at_origin=False, offset=(0, FWD * 0.22, 0))
    mesh_object("baton_shaft", shaft, "mat_enemy", parent=baton, location=grip)
    tip = bm_prism(0.16, 0.034, 0.034, sides=6, axis="Y", top_at_origin=False, offset=(0, FWD * 0.58, 0))
    mesh_object("baton_tip", tip, "mat_enemy_glow", parent=baton, location=grip)
    empty("baton_hit", parent=baton, location=grip + Vector((0, FWD * 0.6, 0)), size=0.05)
    return root


def build_enemy_gunner():
    """Strzelec: smuklejszy, długi hełm z wizjerem, karabin trzymany oburącz."""
    root = humanoid("enemy_gunner", {"chest_w": 0.44, "head_r": 0.118, "arm_spread_deg": 6})
    objs = {o.name: o for o in bpy.data.objects}
    head, torso = objs["head"], objs["torso"]
    helmet = bm_merge(
        bm_box(0.24, 0.28, 0.26, center=(0, 0, 0.18), taper_top=(0.8, 0.9), bevel=0.025),
        bm_box(0.2, 0.12, 0.06, center=(0, -FWD * 0.15, 0.1), bevel=0.01),  # osłona karku
    )
    mesh_object("helmet", helmet, "mat_enemy", parent=head, location=wpos(head))
    visor = bm_box(0.06, 0.02, 0.06, center=(0, FWD * 0.142, 0.19))
    mesh_object("visor", visor, "mat_enemy_glow", parent=head, location=wpos(head))
    pack = bm_box(0.3, 0.12, 0.3, center=(0, -FWD * 0.17, 0.27), bevel=0.02)
    mesh_object("backpack", pack, "mat_enemy", parent=torso, location=wpos(torso))
    # karabin: uchwyt w prawej dłoni, lufa do przodu
    hand = objs["hand_R"]
    bpy.context.view_layer.update()
    grip = hand.matrix_world @ Vector((0, 0, -0.05))
    rifle = empty("rifle", parent=hand, location=grip, size=0.05)
    body = bm_merge(
        bm_box(0.06, 0.5, 0.1, center=(0, FWD * 0.12, 0.03), bevel=0.01),
        bm_box(0.05, 0.22, 0.08, center=(0, -FWD * 0.22, 0.0), taper_top=(1.0, 0.8)),  # kolba
        bm_box(0.04, 0.05, 0.12, center=(0, FWD * 0.02, -0.06)),  # chwyt
        bm_prism(0.34, 0.018, 0.018, sides=6, axis="Y", top_at_origin=False, offset=(0, FWD * 0.53, 0.05)),
    )
    mesh_object("rifle_body", body, "mat_enemy", parent=rifle, location=grip)
    empty("muzzle", parent=rifle, location=grip + Vector((0, FWD * 0.71, 0.05)), size=0.05)
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
        print(f"[neoryder] built {name}")


if __name__ == "__main__":
    main()
