"""Atrium Nova. Współrzędne glTF w metrach, Y w górę, przód +Z. Budowa: docs/assets.md."""

import argparse
import json
import math
import sys
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from warehouse_kurogane import REPO, ba, bpy, Vector, cbox, beam, quad, rod, prism, panel, stencil, surface
from port_rail import loft

STEEL, DARK, ALLOY = "mat_metal", "mat_trim", "mat_machine"
BRASS, BLUE, CLOTH, WOOD = "mat_hivis", "mat_lacquer", "mat_fabric", "mat_wood"
IVORY, LEAF, RUBBER = "mat_snow", "mat_paint", "mat_rubber"
GLASS, STONE, DECK = "mat_glass_clear", "mat_mall_terrazzo_inlay", "mat_tread_plate"
WHITE, AMBER, ROYAL, GREEN = "mat_light_white", "mat_neon_amber", "mat_neon_blue", "mat_neon_green"
tube, label = ba._city_tube, ba._city_print
TAU = math.tau


def color(hex_code):
    rgb = [int(hex_code[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c < 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb)


def materials():
    specs = json.loads((REPO / "src/data/render/arenaMaterials.json").read_text(encoding="utf8"))
    for name in (GLASS, STONE, DECK):
        spec = specs[name[4:]]
        rgb = color(spec["tint"].lstrip("#"))
        ba.PALETTE[name] = ((*rgb, 1), None)
        mat = ba.material(name)
        shader = mat.node_tree.nodes.get("Principled BSDF")
        shader.inputs["Roughness"].default_value = spec["roughness"]
        shader.inputs["Metallic"].default_value = spec["metalness"]
        if "opacity" in spec:
            shader.inputs["Alpha"].default_value = spec["opacity"]
            mat.surface_render_method = "BLENDED"
            mat.use_backface_culling = True
    ba.PALETTE[IVORY] = ((*color("c8d2e0"), 1), None)
    for name, rough, metal in (
        (STEEL, 0.32, 0.62),
        (ALLOY, 0.36, 0.48),
        (BRASS, 0.42, 0.28),
        (BLUE, 0.34, 0.25),
        (DARK, 0.44, 0.38),
    ):
        shader = ba.material(name).node_tree.nodes.get("Principled BSDF")
        shader.inputs["Roughness"].default_value = rough
        shader.inputs["Metallic"].default_value = metal


def slab(r, name, x, y, z, w, h, d, cut, mat):
    """Horizontal extrusion with mitred corners; y is the bottom."""
    a, b = w / 2, d / 2
    outline = [
        (-a + cut, -b),
        (a - cut, -b),
        (a, -b + cut),
        (a, b - cut),
        (a - cut, b),
        (-a + cut, b),
        (-a, b - cut),
        (-a, -b + cut),
    ]
    return prism(r, name, [(x + u, z + v) for u, v in outline], "y", y, y + h, mat)


def pane(r, name, corners, mat=GLASS):
    return surface(r, name, corners, [tuple(range(len(corners)))], mat)


def form(r, name, x, z, levels, mat, sides=8):
    """Tailored oval cross sections. Each level gives elevation, radii and forward offset."""
    rings = [
        [(x + rx * math.cos(TAU * i / sides), y, z + dz + rz * math.sin(TAU * i / sides)) for i in range(sides)]
        for y, rx, rz, dz in levels
    ]
    return loft(r, name, rings, mat)


def lettering(r, words, x, y, z, size, mat):
    font = bpy.data.curves.new("type", "FONT")
    font.body, font.size, font.align_x, font.resolution_u = words, size, "CENTER", 1
    obj = bpy.data.objects.new("lettering", font)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = r
    obj.location = ba._city_point((x, y, z))
    obj.rotation_euler.x = math.pi / 2
    font.materials.append(ba.material(mat))
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target="MESH")
    return obj


def price(r, x, y, z, w=0.16):
    quad(r, "ticket", (x, y, z), w, w * 0.42, "+z", IVORY)
    label(r, "barcode", "mat_label_barcode", (w * 0.78, w * 0.23), (x, y, z + 0.001))


def shutter_grille(r):
    for x in (-1.95, 1.95):
        cbox(r, "guide", (0.1, 3.6, 0.16), (x, 1.8, 0), DARK)
        quad(r, "guide_lip", (x, 1.74, 0.081), 0.022, 3.1, "+z", STEEL)
    cbox(r, "roller_housing", (4, 0.30, 0.178), (0, 3.45, -0.001), DARK)
    cbox(r, "cover_seam", (3.86, 0.018, 0.014), (0, 3.39, 0.081), ALLOY)
    cbox(r, "locking_slat", (3.84, 0.18, 0.095), (0, 0.09, 0), STEEL)
    panel(r, "lock", 0, 0.09, 0.056, 0.16, 0.105, 0.028, 0.014, BRASS)
    quad(r, "key_slot", (0, 0.09, 0.071), 0.012, 0.048, "+z", DARK)
    for i in range(18):
        rod(r, "roller_bar", (-1.91, 0.26 + i * 0.17, 0), (1.91, 0.26 + i * 0.17, 0), 0.011, STEEL, 4)
    for i in range(8):
        x = (i - 3.5) * 0.50
        # Folded steel ties run behind and in front of alternating groups of rods.
        tube(
            r,
            "woven_tie",
            [
                (x + (0.023 if j % 2 else -0.023), 0.16 + j * 0.631, 0.015 if j % 2 else -0.015)
                for j in range(6)
            ],
            0.009,
            STEEL,
            3,
        )
    for x in (-1.79, 1.79):
        rod(r, "cover_fastener", (x, 3.47, 0.088), (x, 3.47, 0.09), 0.020, ALLOY, 6)


def storefront(r):
    for side in (-1, 1):
        x = side * 2.5
        for edge in (-0.40, 0.40):
            cbox(r, "jamb", (0.20, 3.6, 0.49), (x + edge, 1.8, 0.245), BLUE)
        quad(r, "sidelight", (x, 1.8, 0.28), 0.62, 3.50, "+z", GLASS)
        for y in (0.09, 1.08, 3.51):
            cbox(r, "glazing_bar", (0.62, 0.065, 0.075), (x, y, 0.28), STEEL)
        for edge in (-0.41, 0.41):
            cbox(r, "light_reveal", (0.038, 3.34, 0.012), (x + edge, 1.8, 0.491), DARK)
            quad(r, "jamb_led", (x + edge, 1.8, 0.499), 0.012, 3.29, "+z", WHITE)
    cbox(r, "fascia", (6, 1, 0.48), (0, 4.1, 0.24), ALLOY)
    panel(r, "sign_face", 0, 4.1, 0.484, 5.83, 0.83, 0.012, 0.095, DARK)
    for x in (-2.82, 2.82):
        for y in (3.8, 4.4):
            rod(r, "stud", (x, y, 0.49), (x, y, 0.50), 0.019, BRASS, 6)
    cbox(r, "drip_edge", (6, 0.04, 0.5), (0, 4.57, 0.25), STEEL)
    for x in (-2.66, 2.66):
        for j in range(3):
            quad(r, "fascia_flute", (x + j * 0.042 - 0.042, 4.1, 0.492), 0.014, 0.36, "+z", ALLOY)


def escalator(r):
    # The 26 horizontal treads land on the 0..5.2 m slope; lower comb is flush at y=0.
    for i in range(26):
        z, y = 5.2 - (i + 0.5) * 0.4, (i + 1) * 0.2
        cbox(r, "step", (1.90, 0.2, 0.4), (0, y - 0.1, z), DECK)
        quad(r, "safety_nosing", (0, y + 0.0005, z + 0.174), 1.88, 0.043, "+y", BRASS)
        for x in (-0.88, 0.88):
            quad(r, "edge_mark", (x, y + 0.0005, z - 0.015), 0.027, 0.33, "+y", BRASS)
    for s in (-1, 1):
        z, y = s * 5.5, 0 if s == 1 else 5.2
        quad(r, "comb", (0, y + 0.001, z), 1.92, 0.60, "+y", DECK)
        for j in range(15):
            quad(r, "comb_tooth", ((j - 7) * 0.116, y + 0.002, z - s * 0.22), 0.016, 0.135, "+y", BRASS)
    for x in (-1.075, 1.075):
        profile = [
            (5.8, 0),
            (5.8, 0.17),
            (5.20, 0.17),
            (-5.20, 5.37),
            (-5.8, 5.37),
            (-5.8, 4.64),
            (-5.18, 4.64),
            (4.1, 0),
        ]
        prism(r, "skirt", profile, "x", x - 0.125, x + 0.125, ALLOY)
        edge = [
            (5.77, 0.15),
            (5.77, 0.67),
            (5.66, 0.92),
            (5.47, 1.02),
            (5.2, 1.02),
            (-5.2, 6.22),
            (-5.53, 6.22),
            (-5.69, 6.12),
            (-5.77, 5.91),
            (-5.77, 5.32),
        ]
        pane(r, "balustrade", [(x, h, z) for z, h in edge])
        # Horizontal end caps keep the nominal upper rail exactly at 6.25 m.
        for a, b in zip(edge[1:8], edge[2:9]):
            beam(r, "handrail", (x, a[1], a[0]), (x, b[1], b[0]), 0.115, 0.06, RUBBER)
        beam(r, "skirt_light", (x, 0.17, 5.2), (x, 5.37, -5.2), 0.042, 0.023, WHITE)
        for i in range(8):
            z = 4.8 - i * 1.33
            y = (5.2 - z) * 0.5 + 0.16
            beam(r, "glass_joint", (x, y, z), (x, y + 0.86, z), 0.032, 0.028, STEEL)
        panel(r, "stop_notice", x, 0.63, 5.73, 0.243, 0.19, 0.025, 0.014, BRASS)
        quad(r, "stop_symbol", (x, 0.658, 5.744), 0.10, 0.019, "+z", DARK)
        lettering(r, "NIECZYNNE", x, 0.578, 5.744, 0.033, DARK)
    for i in range(8):
        z = 4 - i * 1.18
        y = (5.2 - z) * 0.5 - 0.41
        beam(r, "cross_tie", (-1.05, y, z), (1.05, y, z), 0.09, 0.12, DARK)
        beam(r, "underbrace", (-1.04, y, z), (1.04, y + 0.59, z - 1.18), 0.09, 0.10, STEEL)


def glass_rail(r):
    cbox(r, "clamp", (4, 0.14, 0.14), (0, 0.07, 0), STEEL)
    for x in (-1, 1):
        quad(r, "glass", (x, 0.585, 0), 1.988, 0.88, "+z", GLASS)
    for x in (-1.33, 1.33):
        cbox(r, "stanchion", (0.045, 0.92, 0.055), (x, 0.59, 0), DARK)
        for y in (0.22, 0.92):
            rod(r, "patch_clamp", (x, y, -0.032), (x, y, 0.038), 0.032, ALLOY, 6)
    rod(r, "handrail", (-2, 1.07, 0), (2, 1.07, 0), 0.03, STEEL, 8)
    cbox(r, "led", (3.95, 0.015, 0.016), (0, 1.039, 0.005), WHITE)


def elevator(r):
    for x in (-1.70, 1.70):
        for z in (-1.70, 1.70):
            cbox(r, "box_column", (0.2, 15.8, 0.2), (x, 7.9, z), STEEL)
            quad(r, "column_flange", (x, 7.9, z * 0.938), 0.12, 15.8, "+z" if z < 0 else "-z", DARK)
        quad(r, "side_glass", (x, 7.88, 0), 3.36, 15.72, "+x" if x > 0 else "-x", GLASS)
    for i in range(7):
        y = 0.1 + i * 2.6
        for s in (-1, 1):
            cbox(r, "side_transom", (0.13, 0.12, 3.5), (s * 1.7, y, 0), ALLOY)
            cbox(r, "front_transom", (3.5, 0.12, 0.13), (0, y, s * 1.7), ALLOY)
    for s in (-1, 1):
        z = s * 1.70
        for i in range(3):
            y = i * 5.2
            for x in (-1.32, 1.32):
                quad(r, "side_lite", (x, y + 2.6, z), 0.65, 5.12, "+z", GLASS)
            quad(r, "clerestory", (0, y + 3.91, z), 1.97, 2.52, "+z", GLASS)
            for x in (-1, 1):
                cbox(r, "door_jamb", (0.10, 2.65, 0.18), (x, y + 1.325, z), DARK)
            for x in (-0.47, 0.47):
                quad(r, "sliding_leaf", (x, y + 1.29, z), 0.92, 2.5, "+z", GLASS)
                cbox(r, "lower_kick", (0.92, 0.19, 0.08), (x, y + 0.13, z), STEEL)
            quad(r, "meeting_stile", (0, y + 1.30, z + s * 0.045), 0.050, 2.52, "+z" if s > 0 else "-z", STEEL)
            cbox(r, "door_header", (2.12, 0.25, 0.18), (0, y + 2.60, z), DARK)
            if s == 1:
                stencil(r, str(i), -0.04, y + 2.52, 1.792, 0.14, AMBER)
            else:
                quad(r, "floor_lamp", (0, y + 2.6, -1.792), 0.19, 0.044, "-z", AMBER)
    for y, mat in ((5.2, DARK), (8.03, STEEL)):
        slab(r, "car_shell", 0, y, 0, 2.92, 0.17, 2.88, 0.48, mat)
    for side in (-1, 1):
        quad(r, "car_glass", (side * 1.42, 6.70, 0), 1.96, 2.66, "+x", GLASS)
        for z in (-0.94, 0.94):
            cbox(r, "car_pillar", (0.08, 2.67, 0.08), (side * 1.41, 6.7, z), ALLOY)
        quad(r, "car_apron", (0, 5.70, side * 1.33), 2.02, 0.67, "+z" if side > 0 else "-z", BLUE)
        quad(r, "car_side_apron", (side * 1.425, 5.70, 0), 1.95, 0.67, "+x" if side > 0 else "-x", BLUE)
        cbox(r, "car_lamp", (2.01, 0.05, 0.06), (0, 7.98, side * 1.17), WHITE)
        cbox(r, "car_sill", (2.02, 0.042, 0.08), (0, 5.41, side * 1.22), ROYAL)
        for x in (-0.34, 0.34):
            rod(r, "suspension", (x, 8.2, side * 0.39), (x, 15.78, side * 0.39), 0.03, "mat_cable", 4)


def skylight(r):
    def h(t):
        return 1.56 - t * 0.115

    for s in (-1, 1):
        for i in range(4):
            a, b = i * 3, (i + 1) * 3
            pane(
                r,
                "roof_glass",
                [
                    (s * a, h(a), -2.97),
                    (s * (b - 0.002), h(b), -2.97),
                    (s * (b - 0.002), h(b), 2.97),
                    (s * a, h(a), 2.97),
                ],
            )
            for z in (-2.94, 2.94):
                beam(
                    r, "chord", (s * a, h(a) - 0.055, z), (s * (b - 0.010), h(b) - 0.055, z), 0.12, 0.11, STEEL
                )
                beam(
                    r,
                    "diagonal",
                    (s * a, h(a) - 0.36, z),
                    (s * (b - 0.012), h(b) - 0.06, z),
                    0.058,
                    0.056,
                    ALLOY,
                )
            cbox(r, "mullion", (0.075, 0.075, 6), (s * (b - 0.04), h(b) - 0.01, 0), DARK)
        for z in (-2.94, 2.94):
            beam(r, "bottom_chord", (0, 1.18, z), (s * 11.88, 0.064, z), 0.10, 0.10, STEEL)
            cbox(r, "bearing", (0.36, 0.14, 0.12), (s * 11.82, 0.07, z), ALLOY)
            cbox(r, "node_lamp", (0.55, 0.045, 0.09), (s * 6, 0.66, z), ROYAL)
    cbox(r, "ridge_cap", (0.17, 0.08, 6), (0, 1.56, 0), STEEL)


def coffee_machine(r, x, y, z):
    cbox(r, "drip_tray", (0.54, 0.045, 0.33), (x, y + 0.0225, z), DARK)
    cbox(r, "boiler", (0.53, 0.34, 0.16), (x, y + 0.2, z - 0.081), ALLOY)
    panel(r, "group_head", x, y + 0.34, z + 0.012, 0.58, 0.145, 0.28, 0.038, STEEL)
    for dx in (-0.14, 0.14):
        rod(r, "brew_head", (x + dx, y + 0.21, z + 0.076), (x + dx, y + 0.28, z + 0.076), 0.047, DARK, 6)
        rod(r, "cup", (x + dx, y + 0.045, z + 0.076), (x + dx, y + 0.15, z + 0.076), 0.042, IVORY, 6, 0.055)
    quad(r, "thermostat", (x, y + 0.35, z + 0.154), 0.14, 0.04, "+z", AMBER)


def kiosk(r):
    slab(r, "toe_kick", 0, 0, 0, 3.32, 0.12, 2.30, 0.26, DARK)
    slab(r, "joinery", 0, 0.12, 0, 3.46, 0.71, 2.42, 0.29, WOOD)
    slab(r, "worktop", 0, 0.83, 0, 3.6, 0.10, 2.6, 0.28, STONE)
    for s in (-1, 1):
        for i in range(9):
            quad(
                r,
                "tambour_joint",
                ((i - 4) * 0.32, 0.475, s * 1.211),
                0.018,
                0.65,
                "+z" if s > 0 else "-z",
                DARK,
            )
        cbox(r, "case_sill", (1.38, 0.07, 0.60), (-0.66, 0.965, s * 0.74), STEEL)
        quad(r, "case_glass", (-0.66, 1.17, s * 1.02), 1.36, 0.36, "+z", GLASS)
        quad(r, "glass_lid", (-0.66, 1.36, s * 0.74), 1.36, 0.59, "+y", GLASS)
        for x in (-1.32, 0.0):
            cbox(r, "case_corner", (0.037, 0.40, 0.035), (x, 1.17, s * 1.02), ALLOY)
        for i in range(3):
            rod(
                r,
                "pastry",
                (-1.1 + i * 0.42, 1.0, s * 0.74),
                (-1.1 + i * 0.42, 1.09, s * 0.74),
                0.11,
                BRASS,
                6,
                0.08,
            )
        cbox(r, "canopy_stanchion", (0.13, 1.36, 0.13), (s * 1.49, 1.56, 0), STEEL)
        for i in range(5):
            cbox(r, "night_blind", (2.84, 0.026, 0.042), (0, 2.17 - i * 0.098, s * 1.06), ALLOY)
        for x in (-1.36, 0, 1.36):
            cbox(r, "guide_wire", (0.015, 0.42, 0.015), (x, 1.98, s * 1.06), DARK)
    coffee_machine(r, 0.63, 0.93, 0.58)
    slab(r, "canopy", 0, 2.20, 0, 3.6, 0.20, 2.596, 0.30, BLUE)
    for s in (-1, 1):
        quad(r, "light_ribbon", (0, 2.26, s * 1.300), 2.94, 0.025, "+z" if s > 0 else "-z", AMBER)
    panel(r, "menu_box", 0.75, 1.97, 1.09, 0.71, 0.39, 0.07, 0.03, DARK)
    label(r, "menu", "mat_screen_menu", (0.65, 0.33), (0.75, 1.97, 1.127))


def planter(r):
    slab(r, "shadow_plinth", 0, 0, 0, 2.96, 0.15, 1.17, 0.16, DARK)
    slab(r, "underglow", 0, 0.125, 0, 2.98, 0.021, 1.19, 0.16, WHITE)
    slab(r, "cast_trough", 0, 0.15, 0, 3.2, 0.67, 1.4, 0.19, "mat_concrete")
    slab(r, "rim", 0, 0.815, 0, 3.2, 0.035, 1.4, 0.19, STEEL)
    slab(r, "soil", 0, 0.847, 0, 3.06, 0.009, 1.26, 0.18, DARK)
    for i, (x, z) in enumerate(
        ((-1.13, -0.08), (-0.71, 0.18), (-0.29, -0.22), (0.15, 0.11), (0.62, -0.13), (1.08, 0.19))
    ):
        for j in range(11):
            angle = TAU * j / 11 + 0.47 * i
            dx, dz = math.cos(angle), math.sin(angle)
            length = 0.22 + 0.15 * ((j % 3) / 2)
            height = 0.26 + 0.23 * ((j + 2 * i) % 5) / 4
            base = (x, 0.86, z)
            tip = (x + dx * length, 0.86 + height, z + dz * length)
            mid = (x + dx * length * 0.45, 0.86 + height * 0.71, z + dz * length * 0.45)
            width = 0.049 if j % 2 else 0.066
            verts = [
                base,
                (mid[0] - dz * width, mid[1] - 0.046, mid[2] + dx * width),
                mid,
                (mid[0] + dz * width, mid[1] - 0.046, mid[2] - dx * width),
                tip,
            ]
            surface(
                r,
                "folded_leaf",
                verts,
                [(0, 1, 2), (0, 2, 3), (1, 4, 2), (2, 4, 3)],
                LEAF if j % 4 else "mat_container_olive",
            )


def bench(r):
    for x in (-0.88, 0.88):
        prism(
            r,
            "cast_foot",
            [
                (-0.40, 0),
                (0.40, 0),
                (0.36, 0.075),
                (0.17, 0.13),
                (0.29, 0.37),
                (0.4, 0.39),
                (0.4, 0.42),
                (-0.4, 0.42),
                (-0.4, 0.39),
                (-0.29, 0.37),
                (-0.17, 0.13),
                (-0.36, 0.075),
            ],
            "x",
            x - 0.073,
            x + 0.073,
            STEEL,
        )
        cbox(r, "backrest_spine", (0.08, 0.41, 0.074), (x, 0.615, 0), STEEL)
        for s in (-1, 1):
            tube(
                r,
                "armrest",
                [(x, 0.42, s * 0.38), (x, 0.62, s * 0.36), (x, 0.65, s * 0.30), (x, 0.65, s * 0.055)],
                0.024,
                DARK,
                4,
            )
    for i in range(6):
        cbox(r, "seat_batten", (2.60, 0.043, 0.136), (0, 0.4385, (i - 2.5) * 0.1528), WOOD)
    panel(r, "backrest", 0, 0.725, 0, 2.42, 0.25, 0.089, 0.045, DARK)
    for s in (-1, 1):
        quad(r, "backrest_inlay", (0, 0.76, s * 0.045), 2.24, 0.075, "+z" if s > 0 else "-z", WOOD)


def fountain(r):
    def octagon(radius, y):
        edge = radius * (math.sqrt(2) - 1)
        return [
            (x, y, z)
            for x, z in (
                (radius, edge),
                (edge, radius),
                (-edge, radius),
                (-radius, edge),
                (-radius, -edge),
                (-edge, -radius),
                (edge, -radius),
                (radius, -edge),
            )
        ]

    loft(
        r,
        "basin",
        [
            octagon(2.98, 0),
            octagon(3.2, 0.18),
            octagon(3.2, 0.79),
            octagon(3.14, 0.95),
            octagon(2.78, 0.95),
            octagon(2.75, 0.55),
        ],
        STONE,
    )
    prism(r, "water", [(x, z) for x, _, z in octagon(2.77, 0)], "y", 0.73, 0.74, BLUE)
    for radius, mat in ((2.42, ROYAL), (1.91, WHITE)):
        tube(r, "submerged_light", octagon(radius, 0.75), 0.018, mat, 4, True)
    slab(r, "sculpture_foot", 0, 0.74, 0, 1.9, 0.34, 1.9, 0.46, STEEL)
    for i, angle in enumerate((0.13, 1.12, 2.20)):
        # Lenticular, interlocking ribbons share a concealed hub inside the stone foot.
        points = []
        for j in range(24):
            a = TAU * j / 24
            u, v = math.cos(a), math.sin(a)
            radius = 1.15 * u
            lean = (i - 1) * 0.71 * v
            points.append(
                (
                    radius * math.cos(angle) + lean * math.sin(angle),
                    2.37 + 1.36 * v,
                    radius * math.sin(angle) - lean * math.cos(angle),
                )
            )
        tube(r, "orbital_ribbon", points, 0.070 if i == 0 else 0.056, (STEEL, GLASS, ALLOY)[i], 5, True)
        if i == 2:
            tube(r, "edge_lamp", [(x * 1.045, y, z * 1.045) for x, y, z in points], 0.015, AMBER, 4, True)
    rod(r, "axial_pin", (-0.092, 3.68, 0.704), (-0.092, 3.8, 0.704), 0.065, BRASS, 8)


def directory(r):
    slab(r, "foot", 0, 0, 0, 1.20, 0.09, 0.45, 0.06, DARK)
    panel(r, "pylon", 0, 1.215, 0, 1.08, 2.37, 0.22, 0.086, ALLOY)
    for s in (-1, 1):
        face = "+z" if s > 0 else "-z"
        panel(r, "display_surround", 0, 1.31, s * 0.119, 0.98, 1.99, 0.042, 0.052, DARK)
        label(r, "floor_map", "mat_screen_map", (0.87, 1.37), (0, 1.39, s * 0.142), face)
        text_obj = lettering(r, "INFO", 0, 2.12, s * 0.145, 0.166, ROYAL)
        if s < 0:
            text_obj.rotation_euler.z = math.pi
        quad(r, "reader", (0.23, 0.52, s * 0.142), 0.16, 0.12, face, STEEL)
        quad(r, "scan_light", (0.23, 0.55, s * 0.143), 0.095, 0.012, face, WHITE)
        for i in range(3):
            quad(
                r, "floor_key", (-0.38 + i * 0.093, 0.53, s * 0.142), 0.068, 0.04, face, (BRASS, LEAF, BLUE)[i]
            )


def ceiling_panel(r):
    cbox(r, "acoustic_tray", (2.4, 0.11, 1.2), (0, 0.067, 0), DARK)
    for x in (-0.96, 0.96):
        for z in (-0.43, 0.43):
            rod(r, "suspension", (x, 0.12, z), (x, 0.45, z), 0.025, STEEL, 5)
    for z in (-0.40, 0.40):
        cbox(r, "diffuser", (2.23, 0.028, 0.089), (0, 0.014, z), WHITE)
    for i in range(12):
        cbox(r, "acoustic_baffle", (0.133, 0.018, 0.62), ((i - 5.5) * 0.188, 0.020, 0), "mat_plaster")


def security_fixture(r):
    cbox(r, "backplate", (0.90, 1.30, 0.04), (0, 0.65, 0.02), STEEL)
    panel(r, "cabinet", -0.09, 0.46, 0.147, 0.65, 0.83, 0.214, 0.042, DARK)
    panel(r, "recess", -0.09, 0.46, 0.26, 0.57, 0.73, 0.015, 0.036, ALLOY)
    # Shallow cavity behind a window; the bottle, hose and valve remain visible.
    rod(r, "bottle", (-0.15, 0.16, 0.269), (-0.15, 0.53, 0.269), 0.077, BRASS, 8)
    rod(r, "bottle_neck", (-0.15, 0.53, 0.269), (-0.15, 0.60, 0.278), 0.055, BRASS, 8, 0.024)
    cbox(r, "valve", (0.15, 0.03, 0.04), (-0.13, 0.62, 0.28), DARK)
    tube(
        r,
        "hose",
        [(-0.12, 0.60, 0.28), (-0.01, 0.59, 0.28), (0.02, 0.52, 0.28), (0.01, 0.29, 0.28)],
        0.012,
        RUBBER,
        4,
    )
    quad(r, "safety_window", (-0.07, 0.46, 0.348), 0.52, 0.64, "+z", GLASS)
    for x in (-0.36, 0.22):
        cbox(r, "frame", (0.036, 0.72, 0.08), (x, 0.46, 0.31), STEEL)
    label(r, "inspection", "mat_label_warning", (0.18, 0.09), (-0.08, 0.75, 0.349))
    panel(r, "alarm", 0.333, 0.72, 0.067, 0.16, 0.23, 0.056, 0.022, BRASS)
    quad(r, "alarm_button", (0.333, 0.74, 0.096), 0.085, 0.08, "+z", AMBER)
    cbox(r, "camera_arm", (0.13, 0.06, 0.20), (0.16, 1.18, 0.12), ALLOY)
    form(
        r,
        "camera_dome",
        0.16,
        0.211,
        [(0.96, 0.048, 0.048, 0), (1.0, 0.109, 0.109, 0), (1.078, 0.139, 0.139, 0), (1.12, 0.133, 0.133, 0)],
        DARK,
        10,
    )
    rod(r, "camera_fascia", (0.16, 1.12, 0.211), (0.16, 1.19, 0.211), 0.139, IVORY, 10)
    rod(r, "lens", (0.16, 1.046, 0.324), (0.16, 1.046, 0.344), 0.034, RUBBER, 8)
    rod(r, "lens_glint", (0.16, 1.046, 0.344), (0.16, 1.046, 0.346), 0.020, BLUE, 8)
    quad(r, "status", (0.163, 1.15, 0.349), 0.031, 0.013, "+z", GREEN)


def preview(root, folder):
    # A studio render preserves glass opacity. Load the existing print artwork only after export.
    for mat in bpy.data.materials:
        if not mat.name.startswith(("mat_screen_", "mat_label_")):
            continue
        screen = mat.name.startswith("mat_screen_")
        path = REPO / "public/assets/textures" / ("screens" if screen else "labels") / (mat.name[4:] + ".webp")
        tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
        tex.image = bpy.data.images.load(str(path))
        shader = mat.node_tree.nodes.get("Principled BSDF")
        mat.node_tree.links.new(tex.outputs["Color"], shader.inputs["Base Color"])
        if screen:
            mat.node_tree.links.new(tex.outputs["Color"], shader.inputs["Emission Color"])
            shader.inputs["Emission Strength"].default_value = 0.60

    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 16
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 720, 720
    scene.render.resolution_percentage = 100
    scene.world = bpy.data.worlds.new("studio")
    scene.world.use_nodes = True
    nodes = scene.world.node_tree.nodes
    background = nodes.get("Background")
    # Give the dark palette a soft sky reflection while keeping the camera backdrop charcoal.
    mix = nodes.new("ShaderNodeMixRGB")
    mix.inputs[1].default_value = (0.29, 0.35, 0.46, 1)
    mix.inputs[2].default_value = (0.035, 0.048, 0.071, 1)
    scene.world.node_tree.links.new(nodes.new("ShaderNodeLightPath").outputs["Is Camera Ray"], mix.inputs[0])
    scene.world.node_tree.links.new(mix.outputs[0], background.inputs["Color"])
    directions = {
        "mall_escalator": (1.25, 0.72, 1),
        "mall_elevator": (0.61, 0.19, 1),
        "mall_skylight": (0.45, -0.44, 1),
        "mall_ceiling_panel": (0.49, -0.65, 1),
        "mall_storefront": (0.26, 0.16, 1),
        "mall_shutter_grille": (0.23, 0.13, 1),
        "mall_cafe_set": (0.36, 0.59, 1),
        "mall_clothes_rack": (0.50, 0.24, 1),
        "mall_clothes_rack_amber": (0.50, 0.24, 1),
    }
    direction = directions.get(root.name, (0.38, 0.29, 1))
    cam = ba._preview_camera(scene, (0, 0, 0), ba._city_point(direction), 40)
    bpy.context.view_layer.update()
    points = [o.matrix_world @ v.co for o in root.children for v in o.data.vertices]
    rot = cam.rotation_euler.to_quaternion()
    local = [rot.inverted() @ p for p in points]
    lo, hi = [Vector([fn(p[i] for p in local) for i in range(3)]) for fn in (min, max)]
    cam.location += rot @ ((lo + hi) / 2)
    cam.data.type = "ORTHO"
    span = max(hi.x - lo.x, hi.y - lo.y)
    cam.data.ortho_scale = span * 1.13
    center = rot @ ((lo + hi) / 2)
    for direction, energy, size, tint in (
        ((-2, 3, 3), 135, 2, (1, 0.91, 0.79)),
        ((2, 1, -2), 100, 1.5, (0.67, 0.79, 1)),
        ((1, 0, 2), 45, 1.4, (0.89, 0.92, 1)),
    ):
        light = bpy.data.lights.new("softbox", "AREA")
        light.energy, light.shape, light.size, light.color = energy * span**2, "DISK", size * span, tint
        obj = bpy.data.objects.new("softbox", light)
        scene.collection.objects.link(obj)
        obj.location = center + ba._city_point(direction) * span * 0.6
        obj.rotation_euler = (center - obj.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = str(folder / (root.name + ".png"))
    bpy.ops.render.render(write_still=True)


def finish_glazing(root):
    # applyStyle replaces imported materials with front-sided city materials. Give each
    # architectural pane a physical front and rear surface so it reads from both floors.
    for obj in root.children:
        if obj.data.materials[0].name == GLASS and len(obj.data.polygons) == 1:
            skin = obj.modifiers.new("glass thickness", "SOLIDIFY")
            skin.thickness = 0.001
            skin.offset = 0
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.modifier_apply(modifier=skin.name)


def export(build, make_preview):
    name = "mall_" + build.__name__
    ba.reset_scene()
    root = ba._port_root(name)
    materials()
    build(root)
    finish_glazing(root)
    ba._port_merge(root, {})
    ba.export_glb(root, str(REPO / "public/assets/models/city" / (name + ".glb")), animations=False)
    triangles = sum(len(p.vertices) - 2 for obj in root.children for p in obj.data.polygons)
    print(f"[mall] {name}: {triangles} tri", flush=True)
    if make_preview:
        folder = REPO / "artifacts/models/mall"
        folder.mkdir(parents=True, exist_ok=True)
        preview(root, folder)


def mannequin(r):
    slab(r, "runway", 0, 0, 0, 1.8, 0.17, 0.90, 0.13, DARK)
    slab(r, "light_reveal", 0, 0.17, 0, 1.76, 0.016, 0.86, 0.12, WHITE)
    slab(r, "plinth_top", 0, 0.186, 0, 1.77, 0.014, 0.87, 0.12, STEEL)
    for side in (-1, 1):
        x, z = side * 0.418, side * 0.067
        coat = CLOTH if side < 0 else BLUE
        hem = 0.84 if side < 0 else 1.13
        for leg in (-1, 1):
            lx = x + leg * 0.113
            dz = z + leg * 0.061 * side
            form(
                r,
                "ankle_boot",
                lx,
                dz,
                [(0.20, 0.080, 0.129, 0.038), (0.25, 0.082, 0.132, 0.045), (0.34, 0.063, 0.066, 0)],
                DARK,
                5,
            )
            rod(r, "trouser", (lx, 0.30, dz), (x + leg * 0.085, 1.09, z), 0.053, ALLOY, 5, 0.091)
        form(
            r,
            "coat",
            x,
            z,
            [
                (hem, 0.253, 0.171, 0),
                (1.25, 0.168, 0.125, 0),
                (1.65, 0.237, 0.153, 0.007),
                (1.76, 0.224, 0.123, 0),
                (1.80, 0.114, 0.103, 0),
            ],
            coat,
            6,
        )
        for arm in (-1, 1):
            elbow = (x + arm * 0.284, 1.37, z + 0.025)
            wrist = (x + arm * (0.26 if side == arm else 0.315), 1.15, z + 0.105)
            rod(r, "sleeve", (x + arm * 0.172, 1.718, z), elbow, 0.105, coat, 5, 0.081)
            rod(r, "forearm", (elbow[0], elbow[1] + 0.021, elbow[2]), wrist, 0.081, coat, 5, 0.062)
            rod(r, "hand", wrist, (wrist[0], 1.045, wrist[2] + 0.014), 0.049, IVORY, 4, 0.033)
        form(r, "high_collar", x, z, [(1.735, 0.134, 0.108, 0), (1.879, 0.111, 0.103, -0.011)], DARK, 6)
        form(
            r,
            "head",
            x,
            z,
            [
                (1.856, 0.050, 0.066, 0.033),
                (1.94, 0.096, 0.110, 0.023),
                (2.077, 0.099, 0.120, 0),
                (2.15, 0.058, 0.070, -0.008),
            ],
            IVORY,
            7,
        )
        for a in (-1, 1):
            pane(
                r,
                "lapel",
                [
                    (x + a * 0.088, 1.78, z + 0.10),
                    (x + a * 0.16, 1.67, z + 0.143),
                    (x + 0.018, 1.43, z + 0.156),
                ],
                BRASS if side < 0 else STEEL,
            )
        beam(
            r, "closure", (x + 0.018, 1.43, z + 0.156), (x - 0.041, hem + 0.042, z + 0.166), 0.014, 0.013, DARK
        )
        quad(r, "pocket", (x + 0.109, 1.22, z + 0.112), 0.096, 0.025, "+z", BRASS)


def shoe_wall(r):
    cbox(r, "backboard", (3.4, 2.6, 0.064), (0, 1.30, 0.032), DARK)
    for i in range(6):
        quad(r, "display_slats", (-1.44 + i * 0.45, 1.30, 0.065), 0.38, 2.51, "+z", ALLOY)
    panel(r, "mirror_frame", 1.32, 1.46, 0.097, 0.64, 2.04, 0.077, 0.077, STEEL)
    quad(r, "mirror", (1.32, 1.46, 0.137), 0.53, 1.91, "+z", "mat_glass")
    for i in range(5):
        y = 0.38 + i * 0.446
        ba._port_box(r, "angled_shelf", (2.54, 0.044, 0.45), (-0.35, y, 0.318), WOOD, pitch=3)
        cbox(r, "shelf_light", (2.43, 0.02, 0.018), (-0.35, y - 0.026, 0.533), WHITE)
        for j in range(3):
            x = -1.22 + j * 0.83
            bottom = y + 0.020
            upper = (IVORY, BRASS, BLUE, CLOTH)[(i + j) % 4]
            # Narrow heel, padded collar and broad forefoot. The last rises at the toe.
            sections = [
                (-0.168, 0.046, 0.11, 0.012),
                (-0.070, 0.069, 0.13 + 0.015 * (i % 2), 0),
                (0.068, 0.078, 0.078, 0),
                (0.176, 0.046, 0.049, 0.019),
            ]
            rings = [
                [
                    (x + u, bottom + sole, 0.32 - w),
                    (x + u, bottom + sole, 0.32 + w),
                    (x + u, bottom + h, 0.32 + w * 0.69),
                    (x + u, bottom + h, 0.32 - w * 0.69),
                ]
                for u, w, h, sole in sections
            ]
            loft(r, "trainer", rings, upper, face_mat=lambda k, e: IVORY if e == 0 else upper)
            pane(
                r,
                "collar_opening",
                [
                    (x - 0.144, bottom + 0.118, 0.293),
                    (x - 0.084, bottom + 0.139, 0.29),
                    (x - 0.080, bottom + 0.139, 0.35),
                    (x - 0.145, bottom + 0.118, 0.345),
                ],
                DARK,
            )
            outsole = IVORY if upper != IVORY else DARK
            lip = [(x + u, bottom + v, 0.32 + w + 0.001) for u, w, h, v in sections]
            for a, b in zip(lip, lip[1:]):
                pane(
                    r,
                    "outsole_edge",
                    [a, b, (b[0], b[1] + 0.026, b[2] - 0.004), (a[0], a[1] + 0.026, a[2] - 0.004)],
                    outsole,
                )
            pane(
                r,
                "quarter_stripe",
                [
                    (x - 0.085, bottom + 0.040, 0.384),
                    (x - 0.029, bottom + 0.047, 0.388),
                    (x + 0.025, bottom + 0.086, 0.378),
                    (x - 0.016, bottom + 0.099, 0.376),
                ],
                IVORY if upper != IVORY else BRASS,
            )
        price(r, 0.83, y - 0.003, 0.548, 0.12)
    cbox(r, "ottoman_foot", (0.52, 0.10, 0.44), (1.32, 0.05, 0.32), DARK)
    slab(r, "ottoman", 1.32, 0.10, 0.32, 0.62, 0.27, 0.46, 0.09, CLOTH)


def electronics_shelf(r):
    cbox(r, "spine", (3.4, 2.5, 0.07), (0, 1.25, -0.39), ALLOY)
    for x in (-1.64, 1.64):
        cbox(r, "upright", (0.12, 2.5, 0.72), (x, 1.25, -0.02), STEEL)
    for y in (0.12, 0.70, 1.23):
        cbox(r, "deck", (3.4, 0.092, 0.845), (0, y, -0.0025), DARK)
        quad(r, "shelf_led", (0, y, 0.423), 3.23, 0.011, "+z", WHITE)
    for i in range(6):
        x = (i % 3 - 1) * 1.06
        y = 1.58 + (i // 3) * 0.585
        panel(r, "monitor", x, y, -0.25, 1.015, 0.553, 0.07, 0.021, DARK)
        label(r, "broadcast", "mat_screen_ad" if i % 3 else "mat_screen_news", (0.965, 0.494), (x, y, -0.213))
        quad(r, "standby", (x + 0.40, y - 0.261, -0.213), 0.040, 0.009, "+z", ROYAL)
    for i in range(4):
        x = -1.14 + i * 0.47
        cbox(
            r,
            "stock_carton",
            (0.40, 0.31 + (i % 2) * 0.045, 0.47),
            (x, 0.32 + (i % 2) * 0.0225, -0.02),
            IVORY if i % 2 else BLUE,
        )
        label(r, "inventory", "mat_label_barcode", (0.21, 0.073), (x, 0.30, 0.216))
        cbox(r, "carton_seal", (0.052, 0.013, 0.47), (x, 0.481 + (i % 2) * 0.045, -0.02), BRASS)
    for x in (0.76, 1.25):
        cbox(r, "speaker", (0.33, 0.46, 0.31), (x, 0.399, 0.051), BLUE)
        for y, rad in ((0.32, 0.12), (0.52, 0.049)):
            rod(r, "cone", (x, y, 0.206), (x, y, 0.222), rad, RUBBER, 10, rad * 0.76)
    for x in (-0.97, 0.03, 1.02):
        cbox(r, "visor_perch", (0.055, 0.17, 0.053), (x, 0.826, 0), STEEL)
        panel(r, "visor", x, 0.974, 0.04, 0.46, 0.198, 0.19, 0.054, DARK)
        panel(r, "curved_lens", x, 0.974, 0.14, 0.418, 0.142, 0.03, 0.042, BLUE)
        for s in (-1, 1):
            beam(r, "temple", (x + s * 0.203, 0.99, 0.058), (x + s * 0.151, 0.951, -0.19), 0.032, 0.033, ALLOY)
        price(r, x, 0.73, 0.424)


def cafe_set(r):
    cbox(r, "bar", (3.20, 0.80, 0.48), (0, 0.40, -0.86), WOOD)
    cbox(r, "countertop", (3.2, 0.07, 0.56), (0, 0.835, -0.82), STONE)
    for x in (-1.1, 0, 1.1):
        quad(r, "cabinet_seam", (x, 0.40, -0.619), 0.019, 0.72, "+z", DARK)
    coffee_machine(r, -0.87, 0.87, -0.82)
    cbox(r, "pastry_tray", (0.98, 0.06, 0.43), (0.68, 0.90, -0.79), STEEL)
    quad(r, "pastry_lid", (0.68, 1.19, -0.79), 0.97, 0.42, "+y", GLASS)
    quad(r, "pastry_front", (0.68, 1.06, -0.58), 0.97, 0.26, "+z", GLASS)
    for x in (0.22, 1.14):
        cbox(r, "case_stile", (0.023, 0.28, 0.025), (x, 1.05, -0.58), STEEL)
    for x in (0.41, 0.69, 0.97):
        rod(r, "bake", (x, 0.93, -0.78), (x, 1.045, -0.78), 0.098, BRASS, 6, 0.076)
    cbox(r, "menu_post", (0.05, 0.71, 0.06), (-0.11, 1.19, -1.04), STEEL)
    panel(r, "menu_board", -0.11, 1.52, -1.04, 0.98, 0.46, 0.074, 0.033, DARK)
    label(r, "menu", "mat_screen_menu", (0.89, 0.38), (-0.11, 1.52, -1.00))
    for x in (-0.85, 0.85):
        rod(r, "pedestal_foot", (x, 0, 0.54), (x, 0.044, 0.54), 0.29, DARK, 8)
        rod(r, "pedestal", (x, 0.043, 0.54), (x, 0.745, 0.54), 0.051, STEEL, 6)
        rod(r, "tabletop", (x, 0.745, 0.54), (x, 0.79, 0.54), 0.56, WOOD, 12)
        for s in (-1, 1):
            cx = x + s * 0.272
            # Opposite backs hook over the circular edge. All four legs point upwards.
            cbox(r, "upturned_seat", (0.40, 0.055, 0.35), (cx, 0.8175, 0.54), BLUE)
            for dx in (-0.145, 0.145):
                for dz in (-0.13, 0.13):
                    beam(
                        r,
                        "chair_leg",
                        (cx + dx, 0.839, 0.54 + dz),
                        (cx + 1.35 * dx, 1.29, 0.54 + 1.35 * dz),
                        0.032,
                        0.035,
                        BRASS,
                    )
            for dz in (-0.14, 0.14):
                tube(
                    r,
                    "back_support",
                    [
                        (cx + s * 0.15, 0.81, 0.54 + dz),
                        (cx + s * 0.31, 0.81, 0.54 + dz),
                        (cx + s * 0.33, 0.55, 0.54 + dz),
                    ],
                    0.019,
                    ALLOY,
                    3,
                )
            cbox(r, "bentwood_back", (0.042, 0.149, 0.34), (cx + s * 0.319, 0.574, 0.54), BLUE)


def pharmacy_counter(r):
    cbox(r, "medicine_wall", (3.4, 2.50, 0.08), (0, 1.25, -0.51), IVORY)
    for i in range(3):
        y = 0.96 + i * 0.51
        cbox(r, "medicine_shelf", (3.25, 0.05, 0.3), (0, y, -0.32), ALLOY)
        for j in range(8):
            x = (j - 3.5) * 0.396
            if i == 2 and j in (3, 4):
                continue
            h = 0.24 if (i + j) % 3 else 0.31
            mat = (LEAF, BLUE, IVORY)[(j + i) % 3]
            cbox(r, "dispensing_pack", (0.25, h, 0.19), (x, y + 0.025 + h / 2, -0.313), mat)
            quad(r, "pack_band", (x, y + 0.096, -0.217), 0.25, 0.055, "+z", IVORY if mat != IVORY else LEAF)
    cbox(r, "cross_vertical", (0.14, 0.46, 0.065), (0, 2.24, -0.392), GREEN)
    for x in (-0.144, 0.144):
        cbox(r, "cross_arm", (0.15, 0.14, 0.065), (x, 2.24, -0.392), GREEN)
    slab(r, "cash_wrap", 0, 0, 0.25, 3.4, 0.77, 0.596, 0.09, IVORY)
    cbox(r, "counter_rail", (3.23, 0.040, 0.59), (0, 0.79, 0.25), STEEL)
    for s in (-1, 1):
        cbox(r, "glass_post", (0.034, 0.41, 0.041), (s * 1.52, 1.009, 0.46), ALLOY)
    quad(r, "guard", (0, 1.04, 0.46), 3.07, 0.36, "+z", GLASS)
    quad(r, "task_light", (0, 0.72, 0.550), 3.09, 0.017, "+z", WHITE)
    for x in (-0.76, 0.79):
        terminal(r, x, 0.81, 0.02, 0.72)


def kurogane_display(r):
    for s in (-1, 1):
        x = s * 0.86
        slab(r, "armoured_plinth", x, 0, 0, 1.68, 0.39, 0.95, 0.09, "mat_container_graphite")
        panel(r, "mount_panel", x, 1.37, -0.384, 1.64, 2.23, 0.15, 0.08, DARK)
        for dx in (-0.78, 0.78):
            cbox(r, "steel_stile", (0.062, 1.95, 0.065), (x + dx, 1.35, 0.41), ALLOY)
        cbox(r, "cornice", (1.68, 0.20, 0.944), (x, 2.4, -0.002), BLUE)
        quad(r, "armoured_lite", (x, 1.35, 0.413), 1.50, 1.94, "+z", GLASS)
        quad(r, "case_lamp", (x, 2.296, 0.06), 1.39, 0.065, "-y", WHITE)
        quad(r, "mark", (x, 2.40, 0.471), 0.59, 0.03, "+z", BRASS)
        for j in range(4):
            quad(r, "mount_slot", (x, 0.73 + j * 0.39, -0.307), 1.40, 0.02, "+z", ALLOY)
    # Suspended vest on a headless bust; the companion case holds inert exhibit silhouettes.
    x = 0.86
    form(
        r,
        "bust",
        x,
        -0.09,
        [
            (0.96, 0.22, 0.12, 0),
            (1.42, 0.25, 0.19, 0),
            (1.78, 0.39, 0.19, 0),
            (1.93, 0.21, 0.12, 0),
            (2.07, 0.10, 0.09, 0),
        ],
        STEEL,
        8,
    )
    for i, w in enumerate((0.49, 0.56, 0.62)):
        panel(r, "ceramic_plate", x, 1.14 + i * 0.21, 0.093, w, 0.22, 0.11, 0.066, BLUE)
    for dx in (-0.29, 0.29):
        beam(r, "shoulder_strap", (x + dx, 1.64, 0.10), (x + dx * 0.63, 1.91, -0.04), 0.122, 0.068, BRASS)
    for i in range(2):
        x, y = -0.90, 1.11 + i * 0.68
        profile = [
            (-0.58, 0.02),
            (-0.57, 0.16),
            (-0.32, 0.13),
            (-0.24, 0.20),
            (0.31, 0.17),
            (0.35, 0.12),
            (0.60, 0.12),
            (0.60, 0.065),
            (0.16, 0.055),
            (0.08, -0.07),
            (-0.02, -0.04),
            (-0.05, 0.05),
            (-0.19, 0.04),
            (-0.27, -0.10),
            (-0.35, -0.075),
            (-0.32, 0.07),
        ]
        prism(r, "display_cast", [(x + u, y + v) for u, v in profile], "z", -0.12, 0.005, ALLOY)
        panel(r, "inlay", x, y + 0.12, 0.010, 0.40, 0.060, 0.012, 0.017, BRASS)
        for dx in (-0.34, 0.36):
            cbox(r, "exhibit_hook", (0.035, 0.14, 0.22), (x + dx, y + 0.015, -0.12), BRASS)
    for x in (0.46, 1.25):
        cbox(r, "watch_pad", (0.31, 0.22, 0.23), (x, 0.53, 0.12), BLUE)
        quad(r, "watch_strap", (x, 0.54, 0.238), 0.049, 0.185, "+z", BRASS)
        rod(r, "watch_face", (x, 0.55, 0.237), (x, 0.55, 0.25), 0.057, STEEL, 8)
    lettering(r, "K", -0.86, 2.334, 0.472, 0.178, IVORY)


def garment_rack(r, swatches):
    for x in (-0.94, 0.94):
        slab(r, "sled", x, 0, 0, 0.18, 0.095, 0.78, 0.046, DARK)
        cbox(r, "standard", (0.057, 1.69, 0.057), (x, 0.925, 0), STEEL)
        cbox(r, "rod_socket", (0.097, 0.075, 0.085), (x, 1.75, 0), BRASS)
    rod(r, "clothes_rail", (-1.06, 1.77, 0), (1.06, 1.77, 0), 0.030, STEEL, 8)
    for i in range(6):
        x = (i - 2.5) * 0.283
        z = (i % 2 - 0.5) * 0.032
        bottom = 0.47 + 0.09 * (i % 3)
        # Garments hang across the rail. A small yaw fans the sleeves toward the aisle.
        angle = math.radians(57 + 3 * (i % 3))

        def place(u, y, v):
            return (
                x + math.cos(angle) * u + math.sin(angle) * v,
                y,
                z - math.sin(angle) * u + math.cos(angle) * v,
            )

        hook = [place(0, y, v) for y, v in ((1.61, 0), (1.72, 0.01), (1.79, 0.036), (1.81, 0), (1.785, -0.034))]
        tube(r, "hanger_hook", hook, 0.009, STEEL, 4)
        tube(r, "hanger", [place(u, y, 0) for u, y in ((-0.21, 1.48), (0, 1.62), (0.21, 1.48))], 0.014, WOOD, 4)
        outline = [
            (-0.13, 1.56),
            (-0.23, 1.53),
            (-0.335, 1.26),
            (-0.243, 1.22),
            (-0.182, 1.32),
            (-0.197, bottom),
            (0.21, bottom + 0.016),
            (0.19, 1.32),
            (0.25, 1.225),
            (0.337, 1.27),
            (0.234, 1.53),
            (0.115, 1.56),
            (0, 1.49),
        ]
        loft(
            r,
            "draped_jacket",
            [[place(u, y, v) for u, y in outline] for v in (-0.046, 0.050)],
            swatches[i % len(swatches)],
        )
        pane(
            r,
            "lapel",
            [place(u, y, 0.051) for u, y in ((-0.12, 1.55), (-0.19, 1.49), (-0.019, 1.31), (0.012, 1.49))],
            DARK if i % 2 else IVORY,
        )
        pane(
            r,
            "pocket_welt",
            [place(u, y, 0.0515) for u, y in ((0.068, 1.17), (0.159, 1.19), (0.16, 1.168), (0.07, 1.146))],
            DARK,
        )
        if i % 2 == 0:
            pane(
                r,
                "hang_tag",
                [place(u, y, 0.054) for u, y in ((-0.047, 1.44), (0.013, 1.44), (0.013, 1.35), (-0.047, 1.35))],
                BRASS,
            )


def clothes_rack(r):
    garment_rack(r, (CLOTH, BLUE, IVORY, BLUE))


def clothes_rack_amber(r):
    garment_rack(r, (BRASS, LEAF, IVORY, BRASS))


def terminal(r, x, y, z, scale=1):
    cbox(r, "pos_foot", (0.32 * scale, 0.034 * scale, 0.25 * scale), (x, y + 0.017 * scale, z), DARK)
    beam(
        r,
        "pos_arm",
        (x, y + 0.025 * scale, z),
        (x, y + 0.23 * scale, z - 0.05 * scale),
        0.077 * scale,
        0.07 * scale,
        ALLOY,
    )
    panel(
        r, "pos_bezel", x, y + 0.32 * scale, z, 0.50 * scale, 0.31 * scale, 0.054 * scale, 0.025 * scale, DARK
    )
    label(
        r,
        "register",
        "mat_screen_status",
        (0.446 * scale, 0.254 * scale),
        (x, y + 0.32 * scale, z + 0.028 * scale),
    )


def checkout_counter(r):
    slab(r, "toe_kick", 0, 0, 0, 2.40, 0.12, 0.78, 0.09, DARK)
    slab(r, "joinery", 0, 0.12, 0, 2.53, 0.80, 0.87, 0.11, BLUE)
    slab(r, "stone_top", 0, 0.92, 0, 2.60, 0.08, 0.95, 0.11, STONE)
    for i in range(12):
        x = -1.03 + i * 0.097
        quad(r, "oak_flute", (x, 0.53, 0.436), 0.066, 0.68, "+z", WOOD)
    panel(r, "service_plate", 0.71, 0.56, 0.442, 0.82, 0.27, 0.012, 0.031, DARK)
    lettering(r, "KASA", 0.71, 0.496, 0.45, 0.171, IVORY)
    quad(r, "service_light", (0.71, 0.39, 0.438), 0.70, 0.014, "+z", AMBER)
    terminal(r, 0.44, 1.0, 0.01)
    panel(r, "reader", 0.94, 1.055, 0.24, 0.20, 0.11, 0.12, 0.014, DARK)
    quad(r, "contactless", (0.94, 1.081, 0.301), 0.086, 0.021, "+z", GREEN)
    cbox(r, "scanner", (0.47, 0.016, 0.32), (-0.65, 1.008, 0.041), STEEL)
    quad(r, "scanner_glass", (-0.65, 1.017, 0.041), 0.35, 0.22, "+y", "mat_glass")
    for x in (-0.71, -0.68, -0.64, -0.59):
        quad(r, "optical_reader", (x, 1.018, 0.041), 0.008, 0.17, "+y", AMBER)


def security_gates(r):
    for s in (-1, 1):
        x = s * 0.70
        slab(r, "shoe", x, 0, 0, 0.24, 0.13, 0.61, 0.052, DARK)
        # Continuous hoop around an open aperture; the antenna traces sit in a clear insert.
        outline = [
            (-0.21, 0.12),
            (-0.21, 1.36),
            (-0.16, 1.47),
            (-0.09, 1.50),
            (0.13, 1.50),
            (0.20, 1.43),
            (0.20, 0.12),
        ]
        for side in (-1, 1):
            tube(r, "reader_hoop", [(x + side * 0.042, y, z) for z, y in outline], 0.031, ALLOY, 6)
        pane(r, "antenna_insert", [(x, y, z) for z, y in outline])
        for inset in (0, 0.036):
            trace = [
                (-0.13 + inset, 0.31 + inset),
                (-0.13 + inset, 1.30 - inset),
                (-0.088, 1.36 - inset),
                (0.091, 1.36 - inset),
                (0.135 - inset, 1.30 - inset),
                (0.135 - inset, 0.31 + inset),
            ]
            tube(r, "antenna", [(x + 0.014, y, z) for z, y in trace], 0.007, BRASS, 4, True)
        cbox(r, "electronics_pod", (0.12, 0.36, 0.32), (x, 0.32, -0.014), BLUE)
        quad(r, "sensor_lamp", (x, 0.41, 0.147), 0.072, 0.018, "+z", GREEN)


def display_table(r):
    for x in (-0.91, 0.91):
        prism(
            r,
            "trestle",
            [
                (-0.43, 0),
                (0.43, 0),
                (0.43, 0.06),
                (0.25, 0.14),
                (0.27, 0.68),
                (-0.27, 0.68),
                (-0.25, 0.14),
                (-0.43, 0.06),
            ],
            "x",
            x - 0.056,
            x + 0.056,
            DARK,
        )
    cbox(r, "stretcher", (1.85, 0.062, 0.079), (0, 0.24, 0), STEEL)
    slab(r, "tabletop", 0, 0.67, -0.001, 2.12, 0.075, 1.038, 0.080, WOOD)
    for i, (x, z) in enumerate(((-0.65, -0.20), (-0.62, 0.21), (0, -0.14), (0.57, 0.06))):
        for j in range(2 + i % 2):
            y = 0.746 + j * 0.054
            mat = (CLOTH, BLUE, BRASS, IVORY)[(i + j) % 4]
            slab(r, "folded_knit", x + 0.012 * j, y, z, 0.45, 0.052, 0.32, 0.040, mat)
            quad(
                r, "paper_band", (x - 0.073, y + 0.053, z), 0.065, 0.316, "+y", IVORY if mat != IVORY else DARK
            )
    price(r, 0, 0.704, 0.519, 0.20)


def promo_stand(r):
    # The printed board follows the leaning A-frame, including its typeset vinyl lettering.
    for s in (-1, 1):
        for x in (-0.353, 0.353):
            beam(r, "folding_leg", (x, 0.027, s * 0.36), (x, 1.32, s * 0.034), 0.053, 0.055, STEEL)
            cbox(r, "rubber_foot", (0.082, 0.058, 0.080), (x, 0.029, s * 0.36), RUBBER)
        for x in (-0.347, 0.347):
            beam(r, "folding_stay", (x, 0.43, 0), (x, 0.43, s * 0.266), 0.023, 0.025, BRASS)
        profile = [(s * 0.316, 0.19), (s * 0.041, 1.30), (s * 0.010, 1.29), (s * 0.285, 0.185)]
        prism(r, "poster_board", profile, "x", -0.337, 0.337, BLUE)

        def front(y):
            return s * (0.316 - (y - 0.19) * (0.275 / 1.11) + 0.004)

        for words, y, size, mat in (
            ("NOVA", 1.12, 0.12, IVORY),
            ("–30%", 0.71, 0.222, BRASS),
            ("KOLEKCJA", 0.57, 0.084, IVORY),
            ("09:00", 0.31, 0.101, IVORY),
        ):
            obj = lettering(r, words, 0, y, front(y), size, mat)
            obj.rotation_euler.x = math.pi / 2 + math.atan(0.275 / 1.11)
            if s < 0:
                obj.rotation_euler.z = math.pi
        for i in range(3):
            y = 0.95 + i * 0.025
            pane(
                r,
                "poster_rule",
                [(x, h, front(h)) for x, h in ((-0.24, y), (0.24, y), (0.24, y + 0.008), (-0.24, y + 0.008))],
                BRASS,
            )
    rod(r, "pivot", (-0.40, 1.315, 0), (0.40, 1.315, 0), 0.039, BRASS, 8)


def trash_bin(r):
    slab(r, "plinth", 0, 0, 0, 1.28, 0.09, 0.51, 0.07, DARK)
    slab(r, "steel_shell", 0, 0.09, 0, 1.34, 0.75, 0.56, 0.064, STEEL)
    slab(r, "lid", 0, 0.84, 0, 1.36, 0.10, 0.606, 0.07, DARK)
    for i, (name, mat) in enumerate((("PAPIER", BLUE), ("SZKŁO", LEAF), ("METAL", BRASS))):
        x = (i - 1) * 0.42
        panel(r, "bin_door", x, 0.495, 0.283, 0.385, 0.65, 0.009, 0.020, DARK)
        panel(r, "deposit_rim", x, 0.695, 0.292, 0.32, 0.17, 0.011, 0.048, mat)
        panel(r, "deposit_slot", x, 0.695, 0.299, 0.267, 0.114, 0.008, 0.037, RUBBER)
        lettering(r, name, x, 0.455, 0.291, 0.067, IVORY)
        quad(r, "hinge", (x, 0.232, 0.29), 0.19, 0.018, "+z", ALLOY)


def entrance_doors(r):
    cbox(r, "header", (4.8, 0.30, 0.316), (0, 2.85, -0.002), DARK)
    cbox(r, "bottom_track", (4.8, 0.030, 0.32), (0, 0.015, 0), STEEL)
    for i in range(4):
        x = (i - 1.5) * 1.18
        z = -0.045 if i in (0, 3) else 0.065
        quad(r, "tempered_leaf", (x, 1.37, z), 1.15, 2.64, "+z", GLASS)
        for dx in (-0.576, 0.576):
            cbox(r, "aluminium_stile", (0.038, 2.71, 0.073), (x + dx, 1.375, z), STEEL)
        for y, h in ((0.13, 0.19), (2.64, 0.12)):
            cbox(r, "door_rail", (1.18, h, 0.078), (x, y, z), ALLOY)
        for j in range(5):
            quad(r, "visibility_mark", (x + (j - 2) * 0.206, 1.25, z + 0.002), 0.126, 0.043, "+z", IVORY)
    panel(r, "presence_sensor", 0, 2.82, 0.138, 0.38, 0.097, 0.042, 0.027, ALLOY)
    quad(r, "infrared_window", (0, 2.82, 0.16), 0.25, 0.044, "+z", "mat_glass")
    for x in (-2.32, 2.32):
        quad(r, "entry_lamp", (x, 2.85, 0.159), 0.078, 0.14, "+z", AMBER)
    lettering(r, "WEJŚCIE", -0.96, 2.80, 0.159, 0.15, IVORY)


BUILDERS = (
    shutter_grille,
    storefront,
    escalator,
    glass_rail,
    elevator,
    skylight,
    kiosk,
    planter,
    bench,
    fountain,
    directory,
    ceiling_panel,
    security_fixture,
    mannequin,
    shoe_wall,
    electronics_shelf,
    cafe_set,
    pharmacy_counter,
    kurogane_display,
    clothes_rack,
    clothes_rack_amber,
    checkout_counter,
    security_gates,
    display_table,
    promo_stand,
    trash_bin,
    entrance_doors,
)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", help="Identyfikatory mall_* oddzielone przecinkami")
    parser.add_argument("--no-preview", action="store_true")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else [])
    models = {"mall_" + fn.__name__: fn for fn in BUILDERS}
    for name in args.only.split(",") if args.only else models:
        if name not in models:
            parser.error(f"Nieznany model {name}")
        export(models[name], not args.no_preview)


if __name__ == "__main__":
    main()
