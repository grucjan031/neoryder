"""Centrala Kurogane. Metry glTF, Y w górę, front +Z. Budowa w docs/assets.md."""

import argparse
import math
import sys
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from kurogane_lab import (
    REPO,
    ba,
    bpy,
    Vector,
    box,
    slab,
    panel,
    pane,
    prism,
    rod,
    tube,
    beam,
    form,
    drum,
    quad,
    face,
    print_on,
    lettering,
    stencil,
    materials,
    color,
    finish_glazing,
    studio,
    STEEL,
    DARK,
    ALLOY,
    INK,
    ENAMEL,
    GOLD,
    WHITE,
    GLASS,
    GREEN,
    BLUE,
    AMBER,
    RUBBER,
    GRATE,
    STATUS,
    MAP,
)
from construction_power import surface

WOOD, FELT, CERAMIC = "mat_wood", "mat_fabric", "mat_snow"
PLASTIC, LEAF = "mat_plastic", "mat_paint"
ANALYTICS = "mat_screen_office_analytics"


def arrow(r, x, y, z, width, up):
    h = width * (0.68 if up else -0.68)
    prism(
        r,
        "direction_key",
        [(x - width / 2, y - h / 2), (x + width / 2, y - h / 2), (x, y + h / 2)],
        "z",
        z - 0.004,
        z,
        GREEN if up else AMBER,
    )


def controls(r, x, y, z, w):
    panel(r, "control_face", x, y, z, w, w * 2.25, 0.028, 0.025, DARK)
    print_on(r, STATUS, x, y + w * 0.73, z + 0.015, w * 0.76, w * 0.46)
    for sign in (-1, 1):
        cy = y - w * 0.28 + sign * w * 0.38
        panel(r, "button_rim", x, cy, z + 0.018, w * 0.61, w * 0.56, 0.012, w * 0.08, WHITE)
        face(r, "button_cap", x, cy, z + 0.025, w * 0.54, w * 0.46, INK)
        arrow(r, x, cy, z + 0.032, w * 0.37, sign > 0)


def facade_mullion(r):
    for x in (-1.94, 1.94):
        box(r, "pressure_plate", x, 2.4, -0.025, 0.12, 4.8, 0.25, STEEL)
        box(r, "thermal_break", x, 2.4, 0.12, 0.064, 4.8, 0.04, DARK)
        for y in (0.36, 2.38, 4.27):
            rod(r, "pressure_cap", (x, y, 0.140), (x, y, 0.144), 0.017, ALLOY, 6)
    for x in (-0.96, 0.96):
        face(r, "curtain_glass", x, 2.31, -0.07, 1.91, 4.32, GLASS)
    box(r, "central_gasket", 0, 2.3, -0.065, 0.03, 4.45, 0.05, DARK)
    for y in (0.21, 4.41):
        box(r, "transom", 0, y, -0.02, 4, 0.09, 0.25, STEEL)
    box(r, "blind_pelmet", 0, 4.60, 0.015, 4, 0.40, 0.29, ALLOY)
    for y in (4.48, 4.53):
        face(r, "blind_slot", 0, y, 0.161, 3.85, 0.021, DARK)
    box(r, "convector", 0, 0.11, 0.022, 4, 0.22, 0.344, GRATE)
    face(r, "inlet", 0, 0.12, 0.199, 3.86, 0.126, INK)
    for y in (0.082, 0.12, 0.158):
        box(r, "louvre", 0, y, 0.195, 3.85, 0.014, 0.010, ALLOY)
    box(r, "floor_light", 0, 0.036, 0.196, 3.86, 0.013, 0.008, WHITE)


def glass_partition_wall(r):
    for y, h in ((0.09, 0.18), (3.54, 0.12)):
        box(r, "channel", 0, y, -0.001, 4, h, 0.178, DARK)
        face(r, "cap", 0, y, 0.09, 3.98, h * 0.42, STEEL)
    for x in (-1.975, -0.667, 0.667, 1.975):
        box(r, "mullion", x, 1.8, 0, 0.05, 3.6, 0.095, STEEL)
    for x in (-1.33, 0, 1.33):
        face(r, "pane", x, 1.8, 0, 1.32, 3.4, GLASS)
        for y, h in ((1.18, 0.045), (1.41, 0.072)):
            box(r, "frit_band", x, y, 0, 1.27, h, 0.005, WHITE)


def glass_partition_door(r):
    box(r, "head_track", 0, 3.4, -0.001, 4, 0.4, 0.238, DARK)
    face(r, "track_bead", 0, 3.28, 0.12, 3.92, 0.026, STEEL)
    face(r, "available", 0, 3.42, 0.12, 0.40, 0.042, GREEN)
    for s in (-1, 1):
        x = s * 1.60
        box(r, "shoe", x, 0.045, 0, 0.8, 0.09, 0.19, STEEL)
        for edge in (-0.36, 0.36):
            box(r, "stile", x + edge, 1.6, -0.013, 0.064, 3.2, 0.095, STEEL)
        face(r, "sliding_glass", x, 1.63, 0, 0.72, 3.14, GLASS)
        for y in (1.18, 1.41):
            box(r, "frit_band", x, y, 0, 0.70, 0.042, 0.006, WHITE)
        px = s * 1.34
        tube(r, "pull", [(px, 0.86, 0.01), (px, 0.86, 0.10), (px, 1.69, 0.10), (px, 1.69, 0.01)], 0.018, STEEL, 8)


def elevator_cab(r):
    for y, h, mat in ((0, 0.10, DARK), (0.10, 0.045, ENAMEL), (3.02, 0.18, ALLOY)):
        slab(r, "deck", 0, y, 0, 3.2, h, 3.2, 0.095, mat)
    for s in (-1, 1):
        x = s * 1.53
        for z in (-1.50, 1.50):
            box(r, "corner_pier", x, 1.58, z, 0.14, 2.9, 0.18, STEEL)
            box(r, "inner_column", x - s * 0.055, 1.58, z, 0.09, 2.9, 0.13, DARK)
        quad(r, "panoramic_glass", (x, 1.59, 0), 2.91, 2.88, "+x", GLASS)
        tube(
            r,
            "handrail",
            [(x, 1.01, -1.27), (s * 1.41, 1.01, -1.27), (s * 1.41, 1.01, 1.27), (x, 1.01, 1.27)],
            0.028,
            STEEL,
            8,
        )
        box(r, "kick_guard", x, 0.25, 0, 0.11, 0.23, 3, DARK)
        box(r, "door_threshold", 0, 0.147, s * 1.54, 2.94, 0.004, 0.08, ALLOY)
        box(r, "threshold_inlay", 0, 0.150, s * 1.54, 2.80, 0.002, 0.016, AMBER)
        box(r, "lintel", 0, 2.93, s * 1.49, 3.13, 0.19, 0.16, DARK)
    for x in (-0.70, 0.70):
        for z in (-0.70, 0.70):
            slab(r, "ceiling_diffuser", x, 3.005, z, 1.24, 0.018, 1.24, 0.10, WHITE)
    # The operating face looks west, at the same corner and key heights as ElevatorCabin.
    before = set(r.children)
    w = 0.39 / 0.76
    box(r, "control_spine", 0, 1.58, -0.075, w + 0.02, 2.88, 0.15, ALLOY)
    controls(r, 0, 1.355 + w * 0.28, 0.015, w)
    for i in range(3):
        stencil(r, str(60 + i), -0.19 + i * 0.14, 1.99, 0.034, 0.075, WHITE)
    from mathutils import Matrix

    corner = Matrix.Translation(ba._city_point((1.36, 0, -1.26))) @ Matrix.Rotation(-math.pi / 2, 4, "Z")
    bpy.context.view_layer.update()
    for obj in set(r.children) - before:
        obj.matrix_world = corner @ obj.matrix_world


def elevator_shaft_door(r):
    for side in (-1, 1):
        x = side * 1.45
        panel(r, "stone_jamb", x, 1.70, 0, 0.70, 3.40, 0.35, 0.06, DARK)
        box(r, "jamb_liner", side * 1.13, 1.40, 0.025, 0.06, 2.80, 0.21, STEEL)
        face(r, "jamb_flute", x, 1.62, 0.175, 0.023, 2.86, ALLOY)
        face(r, "jamb_inlay", side * 1.28, 1.62, 0.175, 0.012, 2.86, GOLD)
    panel(r, "header", 0, 3.10, -0.013, 2.50, 0.60, 0.324, 0.045, STEEL)
    panel(r, "floor_indicator", 0, 3.11, 0.160, 0.83, 0.33, 0.025, 0.045, INK)
    stencil(r, "60", -0.15, 3.01, 0.174, 0.18, AMBER)
    arrow(r, -0.28, 3.12, 0.175, 0.10, True)
    arrow(r, 0.27, 3.12, 0.175, 0.10, False)
    for side, name in ((-1, "door_left"), (1, "door_right")):
        leaf = ba.empty(name)
        x = 0
        for y in (0.075, 2.723):
            box(leaf, "rail", x, y, 0, 1.1, 0.15, 0.105, STEEL)
        for edge in (-0.515, 0.515):
            box(leaf, "stile", x + edge, 1.4, 0, 0.070, 2.8, 0.105, STEEL)
        face(leaf, "laminated_glass", x, 1.4, 0, 1.032, 2.55, GLASS)
        box(leaf, "frit", x, 1.25, 0, 1.03, 0.044, 0.007, WHITE)
        finish_glazing(leaf)
        ba._port_merge(leaf, {})
        leaf.parent = r
        leaf.location.x = side * 0.55


def elevator_call_panel(r):
    slab(r, "shoe", 0, 0, 0, 0.45, 0.072, 0.22, 0.035, DARK)
    prism(
        r,
        "raked_pylon",
        [(-0.10, 0.072), (0.10, 0.072), (0.075, 1.40), (0.038, 1.45), (-0.080, 1.45)],
        "x",
        -0.193,
        0.193,
        STEEL,
    )
    controls(r, 0, 0.992, 0.078, 0.32)
    panel(r, "floor_window", 0, 1.386, 0.074, 0.23, 0.125, 0.025, 0.014, INK)
    stencil(r, "60", -0.066, 1.346, 0.088, 0.095, AMBER)
    face(r, "inlay", 0, 0.34, 0.091, 0.028, 0.40, GOLD)


def atrium_glass_rail(r):
    box(r, "channel", 0, 0.08, -0.001, 4, 0.16, 0.138, STEEL)
    face(r, "guide_light", 0, 0.064, 0.070, 3.91, 0.018, WHITE)
    for x in (-1.94, 0, 1.94):
        box(r, "post", x, 0.57, 0, 0.055, 0.94, 0.085, STEEL)
    for x in (-0.97, 0.97):
        face(r, "balustrade", x, 0.595, 0, 1.90, 0.90, GLASS)
    box(r, "cap_channel", 0, 1.026, 0, 4, 0.056, 0.083, DARK)
    rod(r, "walnut_handrail", (-2, 1.058, 0), (2, 1.058, 0), 0.042, WOOD, 8)


def reception_desk(r):
    slab(r, "socle", 0, 0, 0, 4.64, 0.105, 1.44, 0.17, DARK)
    slab(r, "worktop", 0, 0.725, -0.07, 4.80, 0.075, 1.46, 0.18, WOOD)
    profile = [
        (-2.4, 0.52),
        (-2.15, 0.80),
        (2.15, 0.80),
        (2.4, 0.52),
        (2.4, -0.29),
        (2.24, -0.29),
        (2.24, 0.42),
        (2.06, 0.63),
        (-2.06, 0.63),
        (-2.24, 0.42),
        (-2.24, -0.29),
        (-2.4, -0.29),
    ]
    prism(r, "carved_apron", [(x, min(z, 0.779)) for x, z in profile], "y", 0.09, 1.16, ENAMEL)
    prism(r, "stone_counterlip", profile, "y", 1.16, 1.182, ALLOY)
    for side in (-1, 1):
        for i in range(7):
            box(r, "walnut_flute", side * (1.15 + i * 0.145), 0.62, 0.786, 0.083, 1.01, 0.028, WOOD)
    panel(r, "sign_recess", 0, 0.63, 0.790, 2.09, 0.53, 0.017, 0.065, INK)
    for x in (-0.85, -0.76):
        pane(
            r,
            "emblem",
            [(x - 0.058, 0.56, 0.8), (x, 0.56, 0.8), (x + 0.085, 0.72, 0.8), (x + 0.025, 0.72, 0.8)],
            AMBER,
        )
    lettering(r, "KUROGANE ARMS", 0.15, 0.575, 0.800, 0.202, WHITE)
    for x in (-1.46, 0, 1.46):
        box(r, "monitor_stand", x, 0.885, -0.01, 0.058, 0.18, 0.06, STEEL)
        box(r, "monitor", x, 1.036, -0.02, 0.52, 0.28, 0.041, DARK)
        print_on(r, STATUS, x, 1.036, -0.042, 0.485, 0.245, "-z")
        box(r, "telephone", x + 0.38, 0.826, -0.29, 0.18, 0.052, 0.17, INK)
        tube(
            r,
            "handset",
            [
                (x + 0.31, 0.862, -0.353),
                (x + 0.32, 0.882, -0.34),
                (x + 0.32, 0.882, -0.255),
                (x + 0.31, 0.862, -0.239),
            ],
            0.017,
            DARK,
            5,
        )
        quad(r, "dial_pad", (x + 0.409, 0.853, -0.30), 0.063, 0.080, "+y", PLASTIC)
    box(r, "card_reader", 1.78, 1.19, 0.71, 0.19, 0.018, 0.13, DARK)
    quad(r, "validated", (1.78, 1.2, 0.71), 0.095, 0.016, "+y", GREEN)


def security_turnstile(r):
    for side in (-1, 1):
        x = side * 1.37
        slab(r, "anchor", x, 0, 0, 0.46, 0.09, 1.40, 0.12, DARK)
        slab(r, "pedestal", x, 0.09, 0, 0.39, 0.90, 1.34, 0.16, STEEL)
        slab(r, "reader_crown", x, 0.99, 0, 0.46, 0.153, 1.4, 0.18, ENAMEL)
        box(r, "reader", x, 1.145, 0.39, 0.23, 0.007, 0.32, INK)
        pane(r, "entry_arrow", [(x - 0.075, 1.15, 0.41), (x + 0.075, 1.15, 0.41), (x, 1.15, 0.30)], GREEN)
        quad(r, "parked_wing", (side * 1.107, 0.64, -0.16), 0.77, 0.53, "+x", GLASS)
        box(r, "wing_edge", side * 1.107, 0.892, -0.16, 0.010, 0.026, 0.77, ALLOY)
        for z in (-0.41, 0.09):
            box(r, "hinge", side * 1.13, 0.65, z, 0.06, 0.24, 0.05, ALLOY)
        face(r, "telltale", x, 0.92, 0.67, 0.13, 0.028, GREEN)


def ceiling_light_panel(r):
    slab(r, "housing", 0, 0.03, 0, 2.40, 0.10, 1.20, 0.065, DARK)
    slab(r, "diffuser", 0, 0.003, 0, 2.29, 0.037, 1.095, 0.042, WHITE)
    for x in (-0.77, -0.38, 0, 0.38, 0.77):
        box(r, "louvre", x, 0.018, 0, 0.025, 0.036, 1.1, STEEL)
    box(r, "spine", 0, 0.018, 0, 2.30, 0.036, 0.026, STEEL)
    for x in (-0.86, 0.86):
        box(r, "hanger", x, 0.215, 0, 0.086, 0.17, 0.12, ALLOY)


def linear_baffle_light(r):
    for i in range(8):
        z = (i - 3.5) * 0.108
        slab(r, "walnut_fin", 0, 0, z, 3.60, 0.17, 0.042, 0.015, WOOD)
    for z in (-0.216, 0, 0.216):
        box(r, "linear_diffuser", 0, 0.043, z, 3.48, 0.068, 0.047, WHITE)
    for x in (-1.27, 1.27):
        box(r, "crossbar", x, 0.18, 0, 0.065, 0.048, 0.8, DARK)
        box(r, "ceiling_stud", x, 0.273, 0, 0.08, 0.154, 0.12, STEEL)
    # Inlay on the outer walnut fin, between the two transverse mounting bars.
    face(r, "marker", 0, 0.076, 0.400, 2.42, 0.018, AMBER)


def acoustic_wall_panel(r):
    panel(r, "backing", 0, 1.2, 0.034, 2.4, 2.4, 0.068, 0.055, DARK)
    for i in range(9):
        x = -1.10 + i * 0.255
        end = 0.99 + 0.46 * x
        box(r, "walnut_batten", x, end / 2 + 0.05, 0.102, 0.114, end, 0.076, WOOD)
    for row in range(3):
        for col in range(5):
            x = -0.94 + col * 0.46 + (row % 2) * 0.12
            y = 1.11 + row * 0.47
            if y < 1.28 + 0.46 * x:
                continue
            points = [
                (x + 0.236 * math.cos(i * math.tau / 6), y + 0.218 * math.sin(i * math.tau / 6)) for i in range(6)
            ]
            prism(r, "felt_tile", points, "z", 0.066, 0.125, FELT)
    pane(
        r,
        "diagonal_inlay",
        [(-1.14, 0.54, 0.133), (1.14, 1.59, 0.133), (1.14, 1.62, 0.133), (-1.14, 0.57, 0.133)],
        AMBER,
    )


def keyboard(r, x, y, z, w=0.43):
    box(r, "keyboard", x, y + 0.012, z, w, 0.024, w * 0.37, INK)
    for i in range(4):
        quad(r, "key_row", (x, y + 0.0245, z + (i - 1.5) * w * 0.075), w * 0.91, w * 0.043, "+y", PLASTIC)


def mug(r, x, y, z):
    drum(r, "ceramic_cup", x, z, y, y + 0.107, 0.045, CERAMIC, 8, 0.056)
    print_on(r, "mat_label_office_mug", x, y + 0.063, z + 0.054, 0.043, 0.048)
    pane(
        r,
        "coffee",
        [
            (x + 0.046 * math.cos(-i * math.tau / 8), y + 0.1075, z + 0.046 * math.sin(-i * math.tau / 8))
            for i in range(8)
        ],
        INK,
    )
    tube(
        r,
        "ear",
        [(x + 0.047, y + 0.084, z), (x + 0.08, y + 0.085, z), (x + 0.081, y + 0.034, z), (x + 0.047, y + 0.028, z)],
        0.007,
        CERAMIC,
        4,
    )


def task_light(r, x, y, z, s):
    box(r, "desk_lamp_foot", x, y + 0.014, z, 0.17, 0.028, 0.11, STEEL)
    tube(r, "cantilever", [(x, y + 0.02, z), (x, y + 0.24, z), (x + 0.10 * s, y + 0.32, z)], 0.012, STEEL, 4)
    box(r, "reading_light", x + 0.13 * s, y + 0.315, z, 0.18, 0.033, 0.075, DARK)
    quad(r, "lens", (x + 0.13 * s, y + 0.298, z), 0.16, 0.058, "-y", WHITE)


def desk_pod(r):
    for x in (-1.57, 1.57):
        for z in (-0.66, 0.66):
            beam(r, "splayed_leg", (x, 0.025, z), (x * 0.94, 0.71, z * 0.88), 0.076, 0.064, STEEL)
            box(r, "foot", x, 0.014, z, 0.11, 0.028, 0.12, RUBBER)
        box(r, "end_frame", x * 0.94, 0.67, 0, 0.078, 0.10, 1.43, DARK)
    box(r, "power_trough", 0, 0.62, 0, 3.12, 0.17, 0.24, DARK)
    box(r, "acoustic_divider", 0, 1.05, 0, 3.42, 0.58, 0.065, FELT)
    box(r, "divider_cap", 0, 1.337, 0, 3.43, 0.026, 0.074, WHITE)
    for x in (-0.90, 0.90):
        for side in (-1, 1):
            z = side * 0.455
            slab(r, "work_surface", x, 0.705, z, 1.8, 0.055, 0.89, 0.045, WOOD)
            box(r, "monitor_mast", x, 0.937, side * 0.22, 0.040, 0.35, 0.045, STEEL)
            box(r, "vesa_arm", x, 1.08, side * 0.22, 0.71, 0.035, 0.04, STEEL)
            for index, dx in enumerate((-0.353, 0.353)):
                box(r, "display", x + dx, 1.12, side * 0.266, 0.688, 0.34, 0.036, DARK)
                if not index:
                    print_on(r, MAP, x + dx, 1.12, side * 0.2845, 0.655, 0.31, "+z" if side > 0 else "-z")
                print_on(
                    r,
                    STATUS if index else ANALYTICS,
                    x + dx,
                    1.12,
                    side * 0.285,
                    0.655,
                    0.31,
                    "+z" if side > 0 else "-z",
                )
            tube(
                r,
                "loom",
                [
                    (x + 0.20, 1.08, side * 0.237),
                    (x + 0.14, 0.91, side * 0.15),
                    (x, 0.80, side * 0.15),
                    (x, 0.612, side * 0.11),
                ],
                0.012,
                INK,
                4,
            )
            keyboard(r, x, 0.76, side * 0.62)
            box(r, "dock", x - 0.45, 0.787, side * 0.48, 0.17, 0.054, 0.096, PLASTIC)
            mug(r, x + 0.61, 0.76, side * 0.64)
            task_light(r, x - 0.65, 0.76, side * 0.34, 1)


def executive_desk(r):
    slab(r, "shadow_plinth", 0, 0, 0.10, 2.36, 0.09, 0.84, 0.11, DARK)
    apron = [
        (-1.20, 0.32),
        (-0.92, 0.54),
        (0.93, 0.54),
        (1.2, 0.32),
        (1.2, -0.35),
        (0.85, -0.35),
        (0.82, 0.21),
        (-0.86, 0.21),
        (-0.86, -0.35),
        (-1.2, -0.35),
    ]
    prism(r, "walnut_shell", apron, "y", 0.09, 0.72, WOOD)
    slab(r, "floating_edge", 0, 0.72, 0, 2.55, 0.025, 1.15, 0.13, AMBER)
    slab(r, "lacquer_top", 0, 0.745, 0, 2.60, 0.061, 1.20, 0.13, ENAMEL)
    for x in (-0.73, -0.49, -0.25, 0, 0.25, 0.49, 0.73):
        face(r, "front_flute", x, 0.42, 0.541, 0.014, 0.49, DARK)
    box(r, "monitor_arm", 0, 0.91, 0.25, 0.055, 0.21, 0.055, STEEL)
    # Four joined chords carry consecutive quarters of a single ultrawide UV image.
    edges = [(-0.62, 0.154), (-0.31, 0.219), (0, 0.240), (0.31, 0.219), (0.62, 0.154)]
    for i, ((a, za), (b, zb)) in enumerate(zip(edges, edges[1:])):
        prism(r, "curved_housing", [(a, za), (b, zb), (b, zb + 0.036), (a, za + 0.036)], "y", 0.868, 1.15, DARK)
        obj = pane(
            r,
            "display_chord",
            [(b, 0.888, zb - 0.002), (a, 0.888, za - 0.002), (a, 1.132, za - 0.002), (b, 1.132, zb - 0.002)],
            ANALYTICS,
        )
        uv = obj.data.uv_layers.new(name="UVMap")
        for loop in obj.data.loops:
            u = 1 - (i + (loop.vertex_index in (0, 3))) / 4
            uv.data[loop.index].uv = (u, int(loop.vertex_index >= 2))
        underlay = obj.copy()
        underlay.data = obj.data.copy()
        bpy.context.scene.collection.objects.link(underlay)
        underlay.data.materials[0] = ba.material(MAP)
        underlay.location.y -= 0.001
    tube(
        r,
        "signal_cable",
        [(0, 0.98, 0.268), (0.09, 0.89, 0.28), (0.16, 0.83, 0.27), (0.22, 0.81, 0.33)],
        0.011,
        INK,
        5,
    )
    keyboard(r, 0, 0.806, -0.21, 0.50)
    task_light(r, -0.91, 0.806, 0.23, 1)
    slab(r, "brief", 0.81, 0.806, -0.17, 0.52, 0.036, 0.39, 0.026, WOOD)
    box(r, "documents", 0.82, 0.847, -0.17, 0.44, 0.045, 0.33, CERAMIC)
    box(r, "folio_cover", 0.81, 0.88, -0.17, 0.52, 0.021, 0.39, ENAMEL)
    box(r, "comms_foot", -0.84, 0.83, -0.19, 0.29, 0.045, 0.18, INK)
    box(r, "comms_terminal", -0.84, 0.916, -0.14, 0.29, 0.16, 0.045, DARK)
    print_on(r, "mat_screen_comms", -0.84, 0.916, -0.164, 0.25, 0.13, "-z")


def cushion(r, name, x, y, z, w, h, d, mat, lean=0):
    from port_rail import loft

    rings = []
    for t, scale in ((0, 0.88), (0.53, 1), (1, 0.86)):
        a, b = w * scale / 2, d * scale / 2
        c = min(a, b) * 0.34
        profile = [
            (-a + c, -b),
            (a - c, -b),
            (a, -b + c),
            (a, b - c),
            (a - c, b),
            (-a + c, b),
            (-a, b - c),
            (-a, -b + c),
        ]
        rings.append([(x + dx, y + h * t, z + dz + lean * t) for dx, dz in profile])
    return loft(r, name, rings, mat)


def office_chair(r):
    for i in range(5):
        a = i * math.tau / 5
        dx, dz = math.sin(a), math.cos(a)
        px, pz = 0.277 * dx, 0.277 * dz
        beam(r, "star_spoke", (0, 0.172, 0), (px, 0.077, pz), 0.048, 0.038, STEEL)
        rod(
            r,
            "caster",
            (px - 0.032 * dz, 0.055, pz + 0.032 * dx),
            (px + 0.032 * dz, 0.055, pz - 0.032 * dx),
            0.055,
            RUBBER,
            8,
        )
    drum(r, "gas_lift", 0, 0, 0.116, 0.345, 0.044, STEEL, 8)
    drum(r, "tilt_housing", 0, 0, 0.30, 0.395, 0.083, DARK, 8)
    cushion(r, "waterfall_seat", 0, 0.375, 0.044, 0.60, 0.113, 0.612, FELT)
    beam(r, "lumbar_spine", (0, 0.39, -0.17), (0, 0.85, -0.315), 0.088, 0.044, STEEL)
    cushion(r, "lumbar", 0, 0.449, -0.228, 0.55, 0.405, 0.14, FELT, -0.044)
    cushion(r, "headrest", 0, 0.872, -0.293, 0.31, 0.178, 0.114, FELT)
    box(r, "neck", 0, 0.852, -0.285, 0.058, 0.115, 0.048, STEEL)
    for x in (-0.321, 0.321):
        tube(r, "arm_support", [(x * 0.77, 0.413, -0.07), (x, 0.50, -0.09), (x, 0.625, -0.045)], 0.018, STEEL, 5)
        slab(r, "arm_pad", x, 0.624, -0.015, 0.058, 0.03, 0.28, 0.023, ENAMEL)


def conference_table(r):
    for x in (-1.40, 1.4):
        slab(r, "pedestal_foot", x, 0, 0, 1.40, 0.09, 1.08, 0.19, DARK)
        slab(r, "pedestal", x, 0.09, 0, 1.20, 0.57, 0.81, 0.17, ALLOY)
        for s in (-1, 1):
            quad(r, "access_seam", (x, 0.37, s * 0.406), 0.71, 0.022, "+z" if s > 0 else "-z", STEEL)
    slab(r, "underside", 0, 0.66, 0, 5.40, 0.077, 1.87, 0.33, DARK)
    slab(r, "boat_top", 0, 0.737, 0, 5.60, 0.072, 2, 0.35, WOOD)
    slab(r, "projection_rim", 0, 0.809, 0, 3.30, 0.010, 0.62, 0.15, AMBER)
    slab(r, "projection_glass", 0, 0.819, 0, 3.27, 0.005, 0.59, 0.145, ENAMEL)
    box(r, "inset_glass", 0, 0.820, 0, 2.99, 0.015, 0.55, ENAMEL)
    print_on(r, MAP, 0, 0.828, 0, 2.95, 0.495, "+y")
    for x in (-1.64, 0, 1.64):
        for side in (-1, 1):
            z = side * 0.61
            box(r, "mic_base", x, 0.826, z, 0.13, 0.034, 0.094, DARK)
            tube(
                r,
                "gooseneck",
                [(x, 0.84, z), (x, 0.947, z - side * 0.025), (x, 0.977, z + side * 0.045)],
                0.009,
                STEEL,
                5,
            )
            rod(r, "capsule", (x, 0.977, z + side * 0.036), (x, 0.982, z + side * 0.085), 0.016, INK, 6)
    for x, side in ((-0.82, -1), (0.82, 1)):
        z = side * 0.61
        box(r, "notebook_base", x, 0.819, z, 0.52, 0.020, 0.32, ALLOY)
        keyboard(r, x, 0.83, z, 0.36)
        box(r, "notebook_lid", x, 0.939, z - side * 0.14, 0.51, 0.222, 0.022, DARK)
        print_on(r, STATUS, x, 0.939, z - side * 0.128, 0.47, 0.189, "+z" if side > 0 else "-z")
    for x in (-2.22, 2.22):
        form(
            r,
            "water_carafe",
            x,
            0.12,
            [
                (0.81, 0.085, 0.085, 0),
                (0.845, 0.098, 0.098, 0),
                (0.98, 0.073, 0.073, 0),
                (1.025, 0.044, 0.044, 0),
                (1.05, 0.053, 0.053, 0),
            ],
            GLASS,
            8,
        )
        drum(r, "tumbler", x, -0.14, 0.809, 0.91, 0.048, STEEL, 7, 0.053)


def conf_screen_wall(r):
    panel(r, "wall_mount", 0, 1.20, 0.048, 3.98, 2.18, 0.096, 0.10, DARK)
    panel(r, "halo", 0, 1.20, 0.097, 4.14, 2.34, 0.026, 0.054, WHITE)
    panel(r, "aluminium_frame", 0, 1.2, 0.134, 4.2, 2.4, 0.052, 0.064, STEEL)
    panel(r, "bezel", 0, 1.22, 0.167, 4.10, 2.26, 0.026, 0.036, INK)
    print_on(r, MAP, 0, 1.23, 0.181, 2.87, 2.09)
    print_on(r, ANALYTICS, 0, 1.23, 0.183, 2.87, 2.09)
    for x in (-1.74, 1.74):
        print_on(r, STATUS, x, 1.23, 0.182, 0.50, 2.09)
    box(r, "stylus_shelf", 0, 0.075, 0.155, 2.68, 0.055, 0.13, ALLOY)
    rod(r, "pointer", (-0.50, 0.123, 0.185), (-0.13, 0.123, 0.185), 0.019, ENAMEL, 8)
    face(r, "input_indicator", 1.88, 0.12, 0.181, 0.045, 0.016, GREEN)


def whiteboard_wall(r):
    panel(r, "aluminium_frame", 0, 0.75, 0.035, 2.40, 1.50, 0.070, 0.038, STEEL)
    panel(r, "writing_glass", 0, 0.765, 0.075, 2.32, 1.392, 0.025, 0.030, WHITE)
    # Organisation chart with connected cards, a burn-up chart and a kanban strip.
    for x, y, w in ((-0.51, 1.14, 0.23), (-0.83, 0.81, 0.23), (-0.5, 0.81, 0.20), (-0.16, 0.81, 0.24)):
        face(r, "chart_card", x, y, 0.089, w, 0.106, PLASTIC)
        face(r, "ink", x, y, 0.090, w * 0.63, 0.015, CERAMIC)
    for x, y, w, h in (
        (-0.50, 1.01, 0.012, 0.15),
        (-0.50, 0.94, 0.68, 0.012),
        (-0.83, 0.90, 0.012, 0.08),
        (-0.50, 0.90, 0.012, 0.08),
        (-0.16, 0.90, 0.012, 0.08),
    ):
        face(r, "chart_link", x, y, 0.089, w, h, DARK)
    for i in range(9):
        h = 0.07 + (i % 3) * 0.026 + i * 0.023
        face(r, "chart_bar", -0.91 + i * 0.112, 0.225 + h / 2, 0.089, 0.063, h, PLASTIC if i < 6 else GOLD)
    for col in range(3):
        x = 0.29 + col * 0.267
        face(r, "column_heading", x, 1.19, 0.089, 0.20, 0.029, DARK)
        for row in range(3 - col % 2):
            y = 1.025 - row * 0.22
            face(r, "sticky", x, y, 0.090, 0.187, 0.161, (GOLD, GREEN, BLUE)[col])
            face(r, "pencil", x - 0.013, y + 0.018, 0.091, 0.103, 0.013, INK)
    box(r, "pen_tray", 0, 0.068, 0.087, 2.19, 0.04, 0.106, ALLOY)
    for i, mat in enumerate((BLUE, GREEN, GOLD)):
        x = -0.71 + i * 0.23
        rod(r, "marker", (x, 0.102, 0.108), (x + 0.18, 0.102, 0.108), 0.014, mat, 6)
    box(r, "eraser", 0.79, 0.109, 0.105, 0.22, 0.045, 0.06, DARK)


def filing_cabinet(r):
    slab(r, "plinth", 0, 0, 0, 1.72, 0.09, 0.69, 0.04, DARK)
    box(r, "rear", 0, 1.04, -0.341, 1.76, 1.96, 0.068, ENAMEL)
    for x in (-0.858, 0, 0.858):
        box(r, "carcass", x, 1.04, 0, 0.084, 1.96, 0.74, DARK)
    for y in (0.85, 1.44, 2.06):
        box(r, "shelf", 0, y, 0, 1.80 if y > 2 else 1.75, 0.08, 0.75, WOOD)
    for x in (-0.435, 0.435):
        for y in (0.265, 0.625):
            box(r, "file_drawer", x, y, 0.31, 0.81, 0.345, 0.073, ENAMEL)
            box(r, "file_pull", x, y + 0.07, 0.355, 0.22, 0.034, 0.035, STEEL)
            face(r, "cardholder", x, y - 0.018, 0.348, 0.12, 0.05, CERAMIC)
        face(r, "display_door", x, 1.465, 0.331, 0.81, 1.15, GLASS)
        box(r, "glass_pull", x * 0.26, 1.08, 0.35, 0.028, 0.15, 0.041, STEEL)
        for row in range(2):
            for i in range(4):
                bx = x - 0.266 + i * 0.163
                h = 0.405 + 0.026 * ((i + row) % 3)
                y = 0.893 + row * 0.588
                box(
                    r,
                    "binder",
                    bx,
                    y + h / 2,
                    0.016,
                    0.104,
                    h,
                    0.39,
                    (DARK, PLASTIC, GOLD, PLASTIC, DARK)[(i + row) % 5],
                )
                face(r, "spine_label", bx, y + h * 0.68, 0.212, 0.074, 0.079, CERAMIC)
                face(r, "finger_hole", bx, y + h * 0.22, 0.212, 0.032, 0.028, INK)


def kitchenette_counter(r):
    slab(r, "kickboard", 0, 0, 0, 3.47, 0.11, 0.76, 0.045, DARK)
    box(r, "cabinet_run", 0, 0.50, -0.055, 3.55, 0.79, 0.763, ENAMEL)
    for x, w in ((-1.36, 0.83), (-0.48, 0.86), (0.40, 0.84)):
        box(r, "walnut_front", x, 0.51, 0.353, w, 0.745, 0.048, WOOD)
        box(r, "pull", x, 0.798, 0.391, w * 0.55, 0.025, 0.033, STEEL)
    box(r, "bottle_chiller", 1.32, 0.51, 0.35, 0.865, 0.745, 0.05, DARK)
    face(r, "chiller_interior", 1.32, 0.51, 0.376, 0.73, 0.61, INK)
    for y in (0.32, 0.57):
        box(r, "chiller_shelf", 1.32, y, 0.382, 0.69, 0.018, 0.02, ALLOY)
        for i in range(3):
            face(r, "bottle", 1.09 + i * 0.205, y + 0.098, 0.395, 0.096, 0.168, PLASTIC)
    face(r, "chiller_door", 1.32, 0.51, 0.408, 0.74, 0.62, GLASS)
    face(r, "cold_indicator", 1.57, 0.79, 0.411, 0.095, 0.019, BLUE)
    # Four sections of stone surround a recessed basin.
    sink_x, sink_w = -0.47, 0.73
    for a, b in ((-1.8, sink_x - sink_w / 2), (sink_x + sink_w / 2, 1.8)):
        box(r, "countertop", (a + b) / 2, 0.937, 0, b - a, 0.09, 0.90, ALLOY)
    for z in (-0.349, 0.349):
        box(r, "sink_rim", sink_x, 0.937, z, sink_w, 0.09, 0.202, ALLOY)
    box(r, "sink_bowl", sink_x, 0.901, 0, sink_w, 0.024, 0.51, STEEL)
    quad(r, "drain", (sink_x, 0.914, 0), 0.075, 0.075, "+y", INK)
    tube(
        r,
        "mixer_tap",
        [
            (sink_x, 0.982, -0.30),
            (sink_x, 1.26, -0.30),
            (sink_x, 1.30, -0.25),
            (sink_x, 1.30, -0.02),
            (sink_x, 1.23, -0.02),
        ],
        0.023,
        STEEL,
        8,
    )
    box(r, "backsplash", 0, 1.52, -0.426, 3.59, 1.30, 0.048, DARK)
    for x in (-1.2, 0, 1.2):
        slab(r, "wall_unit", x, 1.64, -0.20, 1.19, 0.56, 0.5, 0.017, WOOD)
        panel(r, "wall_door", x, 1.925, 0.060, 1.15, 0.51, 0.026, 0.018, ENAMEL)
        box(r, "undercabinet_light", x, 1.637, -0.04, 1.06, 0.015, 0.066, WHITE)
    panel(r, "microwave", 1.20, 1.20, -0.05, 0.88, 0.435, 0.39, 0.04, ALLOY)
    panel(r, "oven_window", 1.10, 1.20, 0.155, 0.59, 0.31, 0.024, 0.025, INK)
    face(r, "oven_display", 1.52, 1.26, 0.147, 0.11, 0.07, GREEN)
    box(r, "cup_rail", -1.32, 1.41, -0.35, 0.64, 0.032, 0.07, STEEL)
    for x in (-1.52, -1.32, -1.12):
        rod(r, "cup_hook", (x, 1.31, -0.33), (x, 1.42, -0.33), 0.012, STEEL, 5)
        drum(r, "hanging_cup", x, -0.32, 1.19, 1.32, 0.057, CERAMIC, 7, 0.067)


def coffee_machine(r):
    slab(r, "toe_kick", 0, 0, 0, 1.31, 0.09, 0.76, 0.06, DARK)
    slab(r, "bar_cabinet", 0, 0.09, 0, 1.37, 0.70, 0.81, 0.07, WOOD)
    panel(r, "bin_hatch", 0.28, 0.45, 0.403, 0.55, 0.58, 0.027, 0.028, ENAMEL)
    face(r, "bin_slot", 0.28, 0.58, 0.419, 0.38, 0.087, INK)
    for x in (-0.50, -0.30):
        face(r, "cup_dispenser", x, 0.50, 0.406, 0.13, 0.34, DARK)
        for i in range(5):
            face(r, "cup_lip", x, 0.39 + i * 0.047, 0.408, 0.118, 0.014, CERAMIC)
    slab(r, "stone_top", 0, 0.79, 0, 1.40, 0.062, 0.85, 0.075, ENAMEL)
    slab(r, "drip_tray", -0.15, 0.853, 0.04, 0.89, 0.054, 0.61, 0.055, STEEL)
    for i in range(7):
        box(r, "drain_slot", -0.15, 0.9075, 0.044 + (i - 3) * 0.055, 0.76, 0.002, 0.012, INK)
    for x in (-0.539, 0.238):
        prism(
            r,
            "machine_cheek",
            [
                (-0.28, 0.90),
                (0.16, 0.90),
                (0.11, 1.00),
                (-0.13, 1.04),
                (-0.10, 1.23),
                (0.14, 1.29),
                (0.19, 1.46),
                (-0.28, 1.46),
            ],
            "x",
            x - 0.043,
            x + 0.043,
            ALLOY,
        )
    box(r, "boiler_back", -0.15, 1.11, -0.216, 0.81, 0.44, 0.14, DARK)
    slab(r, "group_head", -0.15, 1.245, -0.03, 0.91, 0.225, 0.52, 0.047, STEEL)
    print_on(r, "mat_screen_menu", -0.15, 1.365, 0.232, 0.39, 0.133)
    for x in (-0.34, 0.04):
        drum(r, "brew_socket", x, 0.089, 1.16, 1.246, 0.073, DARK, 8)
        drum(r, "lit_spout", x, 0.089, 1.119, 1.16, 0.03, AMBER, 7)
        rod(r, "portafilter", (x + 0.037, 1.19, 0.115), (x + 0.134, 1.17, 0.207), 0.016, INK, 6)
        drum(r, "demitasse", x, 0.095, 0.908, 1.017, 0.048, CERAMIC, 8, 0.069)
        print_on(r, "mat_label_office_mug", x, 0.977, 0.162, 0.056, 0.051)
    form(r, "hopper", -0.35, -0.095, [(1.47, 0.115, 0.09, 0), (1.53, 0.18, 0.13, 0), (1.55, 0.18, 0.13, 0)], INK, 8)
    drum(r, "water_tower", 0.47, -0.17, 0.852, 1.44, 0.118, STEEL, 10)
    tube(r, "water_spout", [(0.47, 1.39, -0.15), (0.47, 1.39, 0.04), (0.47, 1.32, 0.07)], 0.023, STEEL, 6)
    box(r, "filter_status", 0.47, 1.19, -0.052, 0.042, 0.15, 0.009, BLUE)


def lounge_sofa(r):
    for x in (-1.08, 1.08):
        for z in (-0.35, 0.35):
            beam(r, "splayed_foot", (x, 0.02, z), (x * 0.95, 0.19, z * 0.84), 0.079, 0.070, STEEL)
            box(r, "glide", x, 0.011, z, 0.086, 0.022, 0.079, RUBBER)
    slab(r, "walnut_rail", 0, 0.16, 0, 2.60, 0.103, 1.05, 0.12, WOOD)
    cushion(r, "seat_deck", 0, 0.254, 0.01, 2.54, 0.15, 0.97, ENAMEL)
    for x in (-0.735, 0, 0.735):
        cushion(r, "seat_pillow", x, 0.37, 0.105, 0.726, 0.18, 0.78, FELT)
        cushion(r, "quilted_back", x, 0.47, -0.304, 0.73, 0.48, 0.22, FELT, -0.087)
        # Recessed horizontal stitch follows the rake of the cushion.
        for y in (0.62, 0.77):
            z = -0.304 - 0.087 * (y - 0.47) / 0.48 + 0.112
            face(r, "welt", x, y, z, 0.54, 0.012, DARK)
    for x in (-1.18, 1.18):
        cushion(r, "bolster", x, 0.35, 0, 0.24, 0.33, 1.01, FELT)


def office_planter(r):
    slab(r, "recessed_foot", 0, 0, 0, 2.29, 0.095, 0.78, 0.083, DARK)
    slab(r, "base_lantern", 0, 0.095, 0, 2.33, 0.022, 0.81, 0.087, WHITE)
    slab(r, "trough", 0, 0.117, 0, 2.4, 0.70, 0.864, 0.105, ENAMEL)
    for side in (-1, 1):
        for y in (0.26, 0.43, 0.60):
            box(r, "walnut_course", 0, y, side * 0.435, 2.18, 0.135, 0.022, WOOD)
    slab(r, "rim", 0, 0.817, 0, 2.4, 0.033, 0.90, 0.105, STEEL)
    slab(r, "soil", 0, 0.844, 0, 2.27, 0.011, 0.77, 0.080, INK)
    for i in range(9):
        a = i * 2.39996
        x = -1.01 + (i % 6) * 0.385
        form(
            r,
            "river_stone",
            x,
            0.24 * math.cos(a),
            [(0.854, 0.095, 0.067, 0), (0.895, 0.041, 0.031, 0.013)],
            CERAMIC,
            5,
        )
    for i in range(7):
        x = (i - 3) * 0.285
        z = 0.105 * math.sin(i * 2)
        height = (0.49, 0.36, 0.56, 0.595, 0.47, 0.52, 0.38)[i]
        rod(r, "cane", (x, 0.855, z), (x, 0.855 + height, z), 0.014, LEAF, 5)
        for j in range(7):
            a = j * 2.39996 + i
            y = 0.90 + height * j / 10
            length = 0.27 + 0.05 * math.cos(i + j)
            dx, dz = math.cos(a) * length, math.sin(a) * length
            mid = Vector((x + 0.52 * dx, y + 0.134, z + 0.52 * dz))
            half = Vector((-0.235 * dz, 0, 0.235 * dx))
            tip = (x + dx, y + 0.052, z + dz)
            surface(
                r,
                "folded_leaf",
                [(x, y, z), tuple(mid + half), tuple(mid + Vector((0, 0.046, 0))), tuple(mid - half), tip],
                [(0, 1, 2), (0, 2, 3), (1, 4, 2), (2, 4, 3)],
                LEAF,
            )


def office_printer(r):
    slab(r, "plinth", -0.21, 0, 0, 1.09, 0.10, 0.78, 0.07, DARK)
    slab(r, "chassis", -0.21, 0.10, -0.013, 1.18, 0.71, 0.824, 0.045, PLASTIC)
    for i in range(4):
        y = 0.19 + i * 0.153
        panel(r, "paper_cassette", -0.21, y, 0.414, 1.08, 0.143, 0.018, 0.018, ALLOY)
        face(r, "finger_pull", -0.21, y + 0.030, 0.424, 0.29, 0.034, INK)
        face(r, "paper_level", 0.19, y, 0.425, 0.058, 0.032, CERAMIC)
    slab(r, "output_bay", -0.22, 0.81, -0.15, 1.04, 0.177, 0.50, 0.05, INK)
    box(r, "bay_support", -0.70, 0.908, 0.077, 0.16, 0.193, 0.49, DARK)
    slab(r, "scanner_bed", -0.21, 0.992, 0, 1.15, 0.107, 0.80, 0.06, ALLOY)
    box(r, "scanner_slit", -0.20, 1.094, 0.387, 0.88, 0.018, 0.009, GREEN)
    slab(r, "adf_cover", -0.20, 1.10, -0.075, 0.96, 0.14, 0.60, 0.075, ENAMEL)
    prism(r, "input_ramp", [(-0.30, 1.236), (0.19, 1.236), (0.19, 1.255), (-0.30, 1.30)], "x", -0.58, 0.17, PLASTIC)
    box(r, "touch_bezel", 0.23, 1.155, 0.332, 0.244, 0.119, 0.080, DARK)
    print_on(r, STATUS, 0.23, 1.155, 0.374, 0.207, 0.090)
    box(r, "finisher", 0.50, 0.46, -0.095, 0.49, 0.72, 0.58, ALLOY)
    for y in (0.22, 0.52, 0.77):
        prism(
            r,
            "sort_tray",
            [(0.37, y), (0.80, y + 0.065), (0.80, y + 0.086), (0.37, y + 0.026)],
            "z",
            -0.31,
            0.25,
            DARK,
        )
    prism(r, "copies", [(0.44, 0.81), (0.775, 0.852), (0.775, 0.884), (0.44, 0.846)], "z", -0.24, 0.18, WHITE)


def office_server_rack(r):
    for y in (0, 2.20):
        slab(r, "end_caps", 0, y, 0, 1.20, 0.10, 1, 0.068, DARK)
    for s in (-1, 1):
        x = s * 0.558
        box(r, "sound_liner", x, 1.15, 0, 0.084, 2.12, 0.92, ENAMEL)
        box(r, "rack_rail", x * 0.87, 1.15, 0.348, 0.041, 2.12, 0.045, ALLOY)
        for j in range(8):
            quad(r, "side_louvre", (s * 0.600, 1.38 + j * 0.069, -0.05), 0.57, 0.021, "+x" if s > 0 else "-x", DARK)
    box(r, "rear_panel", 0, 1.15, -0.438, 1.07, 2.12, 0.085, DARK)
    for i in range(9):
        y = 0.25 + i * 0.195
        box(r, "switch", 0, y, 0.087, 0.93, 0.154, 0.50, STEEL)
        for j in range(8):
            x = -0.36 + j * 0.103
            face(r, "network_socket", x, y, 0.339, 0.073, 0.067, INK)
            face(r, "link", x + 0.018, y + 0.047, 0.339, 0.018, 0.012, BLUE if (i + j) % 3 else GREEN)
    for x in (-0.414, 0.414):
        tube(
            r,
            "wire_bundle",
            [(x, 0.13, 0.34), (x * 1.10, 0.23, 0.38), (x * 1.10, 1.83, 0.38), (x * 0.79, 1.98, 0.35)],
            0.021,
            INK,
            5,
        )
    panel(r, "diagnostics", 0, 2.02, 0.324, 0.71, 0.25, 0.08, 0.025, INK)
    print_on(r, STATUS, 0, 2.02, 0.366, 0.62, 0.19)
    face(r, "door_glass", 0, 1.15, 0.448, 1.015, 2.10, GLASS)
    for x in (-0.53, 0.53):
        box(r, "door_stile", x, 1.15, 0.437, 0.041, 2.12, 0.040, STEEL)
    box(r, "rack_handle", 0.50, 1.10, 0.470, 0.042, 0.28, 0.058, DARK)


# Budżety według §4.1. Kierunek ujęcia podano we współrzędnych gry.
CATALOG = {
    facade_mullion: (420, (0.50, 0.17, 1)),
    glass_partition_wall: (320, (0.42, 0.16, 1)),
    glass_partition_door: (460, (0.36, 0.15, 1)),
    elevator_cab: (920, (-0.38, 0.21, 1)),
    elevator_shaft_door: (540, (0.32, 0.13, 1)),
    elevator_call_panel: (340, (0.42, 0.14, 1)),
    atrium_glass_rail: (260, (0.48, 0.24, 1)),
    reception_desk: (880, (0.56, 0.45, 1)),
    security_turnstile: (580, (0.58, 0.58, 1)),
    ceiling_light_panel: (240, (0.48, -0.84, 1)),
    linear_baffle_light: (360, (0.57, -0.60, 1)),
    acoustic_wall_panel: (420, (0.32, 0.12, 1)),
    desk_pod: (1180, (0.67, 0.64, 1)),
    executive_desk: (760, (0.60, 0.52, -1)),
    office_chair: (520, (0.70, 0.34, 1)),
    conference_table: (960, (0.60, 0.55, 1)),
    conf_screen_wall: (380, (0.30, 0.12, 1)),
    whiteboard_wall: (440, (0.27, 0.14, 1)),
    filing_cabinet: (580, (0.40, 0.23, 1)),
    kitchenette_counter: (860, (0.47, 0.42, 1)),
    coffee_machine: (680, (0.42, 0.36, 1)),
    lounge_sofa: (540, (0.56, 0.38, 1)),
    office_planter: (680, (0.52, 0.45, 1)),
    office_printer: (640, (0.55, 0.39, 1)),
    office_server_rack: (740, (0.48, 0.20, 1)),
}


def export(builder, preview):
    name = "off_" + builder.__name__
    ba.reset_scene()
    root = ba._port_root(name)
    materials()
    ba.PALETTE[WHITE] = ((*color("fff1d6"), 1), 0.8)
    ba.PALETTE[FELT] = ((*color("3b3554"), 1), None)
    for mat, tint in ((WOOD, "594532"), (ENAMEL, "272b37")):
        shader = ba.material(mat).node_tree.nodes.get("Principled BSDF")
        shader.inputs["Base Color"].default_value = (*color(tint), 1)
    ba.material(GLASS).use_backface_culling = False
    builder(root)
    groups = [o for o in root.children if o.type == "EMPTY"]
    for group in groups:
        group.parent = None
    finish_glazing(root)
    ba._port_merge(root, {})
    for group in groups:
        group.parent = root
    triangles = sum(
        len(p.vertices) - 2 for obj in root.children_recursive if obj.type == "MESH" for p in obj.data.polygons
    )
    limit, direction = CATALOG[builder]
    if triangles > limit:
        raise ValueError(f"{name}: {triangles} > {limit} tri")
    ba.export_glb(root, str(REPO / "public/assets/models/city" / (name + ".glb")), animations=False)
    print(f"[office] {name}: {triangles} tri", flush=True)
    if preview:
        # Studio run3 kadruje dzieci głównego węzła. Spłaszczamy tylko scenę zdjęciową.
        bpy.context.view_layer.update()
        for group in groups:
            for child in list(group.children):
                world = child.matrix_world.copy()
                child.parent = root
                child.matrix_world = world
            bpy.data.objects.remove(group, do_unlink=True)

        def view(xyz):
            return (-ba._city_point(xyz)).to_track_quat("-Z", "Y")

        root.rotation_mode = "QUATERNION"
        root.rotation_quaternion = view((0.35, 0.27, 1)) @ view(direction).inverted()
        studio(root, REPO / "artifacts/models/office" / (name + ".png"))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", nargs="+", choices=["off_" + builder.__name__ for builder in CATALOG])
    parser.add_argument("--no-preview", action="store_true")
    opts = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else [])
    for builder in CATALOG:
        if not opts.only or "off_" + builder.__name__ in opts.only:
            export(builder, not opts.no_preview)
