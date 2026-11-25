"""Magazyn Kurogane. Metry, współrzędne glTF, przód +Z. Uruchomienie w docs/assets.md."""

import argparse
import math
import sys
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from port_rail import ba, beam, bpy, cbox, prism, quad, rod, Vector
from construction_power import surface

REPO = Path(__file__).resolve().parents[3]
STEEL = "mat_metal"
ALLOY = "mat_machine"
DARK = "mat_trim"
AMBER = "mat_hivis"
ENAMEL = "mat_crane_paint"
GRAPHITE = "mat_container_graphite"
NAVY = "mat_container_navy"
GRATE = "mat_steel_grating"
RUBBER = "mat_rubber"
LENS = "mat_light_white"
label = ba._city_print
tube = ba._city_tube


def panel(root, name, x, y, z, width, height, depth, cut, mat):
    """Front plate with clipped corners; profile also works on narrow instrument bezels."""
    w, h = width / 2, height / 2
    corners = [(-w + cut, -h), (w - cut, -h), (w, -h + cut), (w, h - cut),
               (w - cut, h), (-w + cut, h), (-w, h - cut), (-w, -h + cut)]
    prism(root, name, [(x + u, y + v) for u, v in corners], "z",
          z - depth / 2, z + depth / 2, mat)


def stencil(root, digits, x, y, z, h, mat):
    """Segmented inventory numerals cut from flat vinyl, or lit segments on a display."""
    segments = {"0": "abcdef", "1": "bc", "2": "abdeg", "3": "abcdg", "4": "bcfg",
                "5": "acdfg", "6": "acdefg", "7": "abc", "8": "abcdefg", "9": "abcdfg"}
    positions = dict(a=(.25, 1), b=(.5, .75), c=(.5, .25), d=(.25, 0),
                     e=(0, .25), f=(0, .75), g=(.25, .5))
    for i, digit in enumerate(digits):
        for seg in segments[digit]:
            dx, dy = positions[seg]
            horizontal = seg in "adg"
            quad(root, "digit", (x + (i * .72 + dx) * h, y + dy * h, z),
                 (.40 if horizontal else .09) * h, (.09 if horizontal else .39) * h, "+z", mat)


def pallet(root, x, y, z, w, d, mat):
    for u in (-.40, 0, .40):
        cbox(root, "skid", (.1 * w, .09, d), (x + u * w, y + .045, z), mat)
    for i in range(6):
        cbox(root, "cross_plank", (w, .05, .14 * d), (x, y + .115, z + (i - 2.5) * d / 6), mat)


def transit_case(root, x, y, z, w, h, d, mat, detail=True):
    """Moulded shell, rebated closure seam and captive latches; y is the support surface."""
    panel(root, "flight_shell", x, y + (h - .027) / 2, z, w, h - .027, d * .95, min(.07, h / 5), mat)
    cbox(root, "closure_band", (w, .035, d), (x, y + .74 * h, z), STEEL)
    for side in (-1, 1):
        cx = x + side * w * .36
        cbox(root, "lid_runner", (.07, .036, d * .89), (cx, y + h - .018, z), ALLOY)
        cbox(root, "draw_latch", (.084, .12, .026), (cx, y + h * .69, z + d * .481), AMBER)
    label(root, "inventory", "mat_label_barcode", (.22, .074), (x, y + h * .45, z + d * .475 + .001))
    if detail:
        for i in (-1, 0, 1):
            cbox(root, "stacking_rib", (.047, .027, d * .65), (x + i * .14, y + h - .017, z), mat)
        for side in (-1, 1):
            cbox(root, "corner_shoe", (.12, .09, d), (x + side * (w / 2 - .06), y + .048, z), DARK)
            cbox(root, "lock_bail", (.053, .044, .012),
                 (x + side * w * .36, y + h * .69, z + d * .481 + .014), STEEL)
        tube(root, "recess_handle", [(x - .15, y + h * .5, z - d * .475),
             (x - .12, y + h * .35, z - d * .5), (x + .12, y + h * .35, z - d * .5),
             (x + .15, y + h * .5, z - d * .475)], .018, STEEL, 5)


def pallet_rack(r):
    for x in (-1.92, 0, 1.92):
        for z in (-.52, .52):
            cbox(r, "anchor_foot", (.16, .055, .16), (x, .0275, z), DARK)
            cbox(r, "upright", (.09, 6, .10), (x, 3, z), STEEL)
            cbox(r, "impact_guard", (.14, .47, .13), (x, .25, z), ENAMEL, .015)
        for i in range(5):
            z = (-1) ** i * .52
            beam(r, "end_lacing", (x, .34 + 1.08 * i, z), (x, 1.42 + 1.08 * i, -z), .045, .06)
    for tier, y in enumerate((1.8, 3.8, 5.8)):
        for z in (-.52, .52):
            cbox(r, "load_beam", (3.9, .15, .1), (0, y - .075, z), AMBER)
            for x in (-1.92, 0, 1.92):
                cbox(r, "bolted_cleat", (.14, .22, .13), (x, y - .10, z), ENAMEL)
                if z > 0:
                    rod(r, "pin", (x, y - .08, .583), (x, y - .08, .595), .03, ALLOY)
        for i in range(12):
            cbox(r, "deck_channel", (.065, .05, 1.02), ((i - 5.5) * .32, y - .025, 0), STEEL)
        if tier < 2:
            for x in (-.96, .96):
                if tier == 1 and x > 0:
                    continue
                pallet(r, x, y, 0, 1.56, .94, "mat_wood")
                transit_case(r, x, y + .14, 0, 1.48, .54, .84, NAVY if x < 0 else GRAPHITE, False)
                if x < 0 and tier == 0:
                    transit_case(r, x, y + .68, 0, 1.39, .4, .79, GRAPHITE, False)
    pallet(r, .96, 0, 0, 1.6, .98, "mat_wood")
    transit_case(r, .96, .14, 0, 1.49, .78, .88, GRAPHITE, False)
    for i, x in enumerate((-.96, .96)):
        panel(r, "bay_plate", x, 5.72, .58, .46, .24, .018, .025, DARK)
        stencil(r, f"0{i + 1}", x - .12, 5.64, .591, .16, AMBER)


def forklift(r):
    # The drive axle sits behind the mast. The cast tail wraps over the steering axle.
    panel(r, "chassis", -.425, .375, 0, 1.75, .34, .76, .09, NAVY)
    body = [(-1.4, .49), (-1.33, .40), (-.78, .40), (-.66, .54),
            (-.64, .79), (-.78, .95), (-1.22, .95), (-1.37, .85)]
    prism(r, "counterweight", body, "z", -.495, .495, ENAMEL)
    inscription(r, "K-7", -1.26, .70, .496, .084, DARK)
    for z in (-.27, -.135, 0, .135, .27):
        quad(r, "cooling_slot", (-1.02, .951, z), .28, .038, "+y", DARK)
    cbox(r, "step_well", (.95, .08, .99), (-.24, .47, 0), STEEL)
    panel(r, "seat_plinth", -.59, .66, 0, .58, .37, .82, .065, ENAMEL)
    cbox(r, "seat_pan", (.44, .10, .48), (-.55, .88, 0), RUBBER, .026)
    prism(r, "seat_back", [(-.79, .90), (-.72, .90), (-.77, 1.23),
          (-.84, 1.28), (-.87, 1.23)], "z", -.224, .224, RUBBER)
    for side in (-1, 1):
        z = side * .476
        cbox(r, "entry_step", (.47, .05, .115), (-.30, .34, z), DARK)
        for x in (-.45, -.35, -.25, -.15):
            cbox(r, "step_tread", (.028, .013, .09), (x, .368, z), ALLOY)
        prism(r, "drive_fender", [(-.16, .49), (-.10, .64), (.02, .72),
              (.31, .72), (.43, .62), (.43, .55), (.28, .65), (.04, .65),
              (-.06, .58), (-.09, .49)], "z", min(z, side * .575), max(z, side * .575), ENAMEL)
    # A slight turn on the smaller rear wheels exposes the separate steering knuckles.
    for x, radius, half_width, steer in ((.15, .31, .098, 0), (-1.07, .215, .072, .12)):
        axis = Vector((math.sin(steer), 0, math.cos(steer)))
        radial = Vector((math.cos(steer), 0, -math.sin(steer)))
        for side in (-1, 1):
            wheel = Vector((x, radius, side * (.50 if steer == 0 else .47)))
            outer = wheel + side * axis * half_width
            rod(r, "tyre", wheel - axis * half_width, wheel + axis * half_width, radius, RUBBER, 16)
            for name, scale, offset, count, mat in (("disc", .64, .001, 12, ALLOY),
                                                    ("hub", .29, .002, 6, DARK)):
                center = outer + side * offset * axis
                angles = [side * i * math.tau / count for i in range(count)]
                rim = [center + radius * scale * (math.cos(a) * radial + Vector((0, math.sin(a), 0)))
                       for a in angles]
                surface(r, name, rim, [range(count)], mat)
    rod(r, "steering_axle", (-1.07, .215, -.43), (-1.07, .215, .43), .067, STEEL, 8)
    # Open overhead guard. The forward pillars follow the slope of the dashboard.
    for side in (-1, 1):
        z = side * .445
        beam(r, "rear_pillar", (-.85, .85, z), (-.91, 1.92, z), .056, .065, DARK)
        beam(r, "front_pillar", (.18, .59, z), (.07, 1.92, z), .058, .070, DARK)
        cbox(r, "canopy_rail", (1.11, .078, .075), (-.42, 1.925, z), ENAMEL)
    for x in (-.94, -.69, -.42, -.15, .095):
        cbox(r, "roof_guard", (.078, .059, .89), (x, 1.925, 0), ENAMEL)
    rod(r, "beacon_plinth", (-.88, 1.96, -.42), (-.88, 2.00, -.42), .067, DARK, 10)
    rod(r, "beacon", (-.88, 2.00, -.42), (-.88, 2.10, -.42), .052, "mat_neon_amber", 10, .043)
    for z in (-.42, .42):
        cbox(r, "lamp_housing", (.105, .09, .12), (.085, 1.85, z), STEEL)
        cbox(r, "headlamp", (.012, .058, .089), (.141, 1.85, z), LENS)
    prism(r, "dashboard", [(-.048, .53), (.18, .53), (.17, 1.02), (.10, 1.09),
          (-.075, 1.01)], "z", -.34, .34, STEEL)
    rod(r, "steering_column", (.01, .98, 0), (-.13, 1.16, 0), .035, DARK)
    ba._city_ring(r, "wheel_rim", (-.13, 1.16, 0), .13, "y", .014, RUBBER, 10)
    rod(r, "steering_spoke", (-.13, 1.16, -.123), (-.13, 1.16, .123), .014, STEEL)
    # Two independent tines hook over the carriage. Their toes taper toward +X.
    for z in (-.30, .30):
        cbox(r, "mast_channel", (.14, 1.74, .085), (.41, 1.04, z), DARK)
        cbox(r, "mast_runner", (.072, 1.50, .047), (.49, 1.05, z), ALLOY)
        prism(r, "tine", [(.544, .10), (1.4, .10), (1.4, .116), (1.23, .147),
              (.624, .165), (.615, .20), (.615, .586), (.544, .586)],
              "z", z - .050, z + .050, STEEL)
        for y in (.28, .55):
            cbox(r, "carriage_hook", (.14, .055, .112), (.55, y, z), STEEL)
    for y in (.20, 1.865):
        cbox(r, "mast_bridge", (.13, .095, .67), (.41, y, 0), STEEL)
    for y in (.26, .53):
        cbox(r, "carriage", (.085, .085, .82), (.518, y, 0), DARK)
    for z in (-.38, -.14, .14, .38):
        cbox(r, "backrest_bar", (.044, .48, .036), (.525, .75, z), STEEL)
    cbox(r, "backrest_rail", (.051, .049, .80), (.525, .977, 0), STEEL)
    rod(r, "lift_ram", (.412, .23, 0), (.412, 1.18, 0), .058, ENAMEL, 10)
    rod(r, "piston", (.412, 1.18, 0), (.412, 1.85, 0), .026, ALLOY, 8)
    tube(r, "hydraulic_line", [(.21, .58, -.26), (.315, .72, -.24), (.33, 1.60, -.24),
         (.37, 1.71, -.24), (.46, 1.71, -.24), (.503, 1.58, -.24), (.503, .53, -.24)],
         .014, RUBBER, 5)


def overhead_crane(r):
    for z in (-1.02, 1.02):
        # Haunched box girders with flange lips and bolted diaphragm stiffeners.
        prism(r, "girder", [(-7.82, .90), (-6.4, .60), (6.4, .60), (7.82, .90),
              (7.82, 1.51), (-7.82, 1.51)], "z", z - .17, z + .17, ENAMEL)
        cbox(r, "flange", (15.7, .075, .43), (0, 1.54, z), AMBER)
        cbox(r, "trolley_track", (15.1, .075, .08), (0, 1.615, z), ALLOY)
        for i in range(-6, 7, 2):
            cbox(r, "web_stiffener", (.075, .80, .39), (i, 1.08, z), ENAMEL)
    for x in (-7.68, 7.68):
        panel(r, "end_truck", x, .75, 0, .64, .52, 3.2, .08, DARK)
        for z in (-1.26, 1.26):
            rod(r, "travel_wheel", (x - .17, .57, z), (x + .17, .57, z), .23, ALLOY, 12)
            cbox(r, "buffer", (.52, .19, .16), (x, .72, math.copysign(1.52, z)), "mat_hazard")
    for x in (-5.8, -2.2, 2.2, 5.8):
        beam(r, "diagonal", (x - .95, 1.03, -.92), (x + .95, 1.03, .92), .11, .12, STEEL)
    for x in (-.77, .77):
        cbox(r, "trolley_axle", (.24, .19, 2.37), (x, 1.78, 0), STEEL)
        for z in (-1.02, 1.02):
            rod(r, "trolley_wheel", (x - .145, 1.78, z), (x + .145, 1.78, z), .13, RUBBER, 10)
    panel(r, "trolley_chassis", 0, 1.91, 0, 1.98, .22, 2.34, .07, NAVY)
    rod(r, "winch", (-.54, 2.18, 0), (.54, 2.18, 0), .19, STEEL, 12)
    for x in (-.52, -.30, -.10, .10, .30, .52):
        rod(r, "drum_flange", (x - .025, 2.18, 0), (x + .025, 2.18, 0), .22, ALLOY, 12)
    panel(r, "drive", .73, 2.13, 0, .38, .32, .46, .06, ENAMEL)
    for x in (-.39, .39):
        rod(r, "reeving", (x, 1.89, .22), (x * .48, .41, .08), .034, DARK, 6)
        rod(r, "reeving", (x, 1.89, -.22), (x * .48, .41, -.08), .034, DARK, 6)
    panel(r, "hook_block", 0, .40, 0, .57, .34, .25, .09, "mat_hazard")
    prism(r, "cargo_hook", [(-.07, .25), (-.07, .14), (-.15, .10), (-.14, .045),
          (-.06, 0), (.08, 0), (.17, .085), (.15, .17), (.08, .085),
          (-.01, .08), (.035, .17), (.035, .25)], "z", -.045, .045, ALLOY)
    # Festoon cables feed the hoist from the end truck.
    for i in range(6):
        x = -7.26 + i * 1.07
        tube(r, "festoon", [(x, 1.27, .80), (x + .20, .76, .77),
             (x + .53, .55, .76), (x + .85, .73, .77), (x + 1.07, 1.27, .80)], .031, DARK, 5)
    for x in (-5.85, 5.85):
        cbox(r, "flood_housing", (.52, .18, .34), (x, .60, 1.02), DARK)
        cbox(r, "flood_lens", (.42, .04, .26), (x, .50, 1.02), LENS)
        cbox(r, "warning_lens", (.14, .11, .035), (x, .91, 1.205), "mat_neon_amber")
    stencil(r, "06", -.45, .80, 1.192, .48, DARK)
    inscription(r, "KUROGANE", -5.47, .89, 1.192, .32, DARK)
    cbox(r, "service_platform", (2.35, .09, .77), (-6.23, 1.48, -.44), GRATE)
    for x in (-7.34, -6.22, -5.12):
        cbox(r, "maintenance_post", (.055, .80, .055), (x, 1.92, -.09), STEEL)
    for y in (1.91, 2.32):
        rod(r, "service_rail", (-7.37, y, -.09), (-5.09, y, -.09), .035, AMBER)
    rod(r, "travel_motor", (-7.25, 1.22, -.01), (-6.67, 1.22, -.01), .21, ALLOY, 10)
    for x in (-7.17, -7.04, -6.91, -6.78):
        rod(r, "motor_fin", (x, 1.22, -.01), (x + .035, 1.22, -.01), .237, STEEL, 10)


def inscription(r, text, left, baseline, z, height, mat):
    """Small planar lettering, baked to triangles before material batching."""
    curve = bpy.data.curves.new("legend", "FONT")
    curve.body, curve.size, curve.resolution_u = text, height, 2
    letters = bpy.data.objects.new("legend", curve)
    bpy.context.scene.collection.objects.link(letters)
    letters.parent = r
    letters.location = ba._city_point((left, baseline, z))
    letters.rotation_euler.x = math.pi / 2
    curve.materials.append(ba.material(mat))
    bpy.context.view_layer.update()
    mesh = bpy.data.meshes.new_from_object(letters.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    baked = bpy.data.objects.new("legend", mesh)
    bpy.context.scene.collection.objects.link(baked)
    baked.parent = r
    baked.matrix_basis = letters.matrix_basis.copy()
    bpy.data.objects.remove(letters, do_unlink=True)


def server_rack(r):
    cbox(r, "plinth", (1.16, .12, .96), (0, .06, 0), DARK, .02)
    panel(r, "enclosure", 0, 1.228, -.04, 1.198, 2.296, .918, .045, STEEL)
    for x in (-.292, .292):
        panel(r, "door_frame", x, 1.28, .441, .545, 2.15, .052, .035, DARK)
        panel(r, "smoked_window", x, 1.38, .465, .49, 1.81, .023, .038, "mat_glass")
        for i in range(9):
            y = .59 + i * .15
            panel(r, "blade_tray", x, y, .478, .43, .112, .013, .014,
                  NAVY if i % 3 else ALLOY)
            for j in range(3):
                quad(r, "intake", (x - .138 + j * .077, y + .002, .486), .057, .030, "+z", DARK)
            quad(r, "drive_status", (x + .16, y, .486), .034, .017, "+z",
                 "mat_neon_violet" if i == 2 else "mat_neon_blue")
        for i in range(4):
            quad(r, "vent_louvre", (x, .255 + i * .045, .468), .40, .018, "+z", ALLOY)
        cbox(r, "door_latch", (.025, .17, .028), (x + .24, 1.39, .486), ALLOY)
        for i in range(7):
            quad(r, "rear_intake", (x, .56 + i * .18, -.50), .44, .068, "-z", DARK)
        label(r, "status", "mat_screen_status", (.34, .16), (x, 2.04, .478))
        stencil(r, "01" if x < 0 else "02", x - .06, 2.291, .469, .054, AMBER)
    for side in (-1, 1):
        for i in range(6):
            quad(r, "side_louvre", (side * .600, 1.95 + i * .048, -.05), .61, .019,
                 "+x" if side > 0 else "-x", DARK)
        cbox(r, "duct_frame", (.42, .014, .61), (side * .29, 2.383, -.025), DARK)
        for i in range(6):
            cbox(r, "roof_louvre", (.34, .018, .033), (side * .29, 2.391, -.25 + i * .09), STEEL)


def workbench_weapons(r):
    cbox(r, "countertop", (2.4, .085, .9), (0, .9025, 0), STEEL, .023)
    cbox(r, "work_mat", (1.12, .014, .47), (.10, .952, .07), RUBBER)
    for x in (-1.08, 1.08):
        for z in (-.36, .36):
            cbox(r, "foot", (.14, .045, .14), (x, .0225, z), DARK)
            cbox(r, "leg", (.078, .84, .078), (x, .45, z), STEEL)
        cbox(r, "end_tie", (.07, .065, .74), (x, .23, 0), ALLOY)
    cbox(r, "lower_shelf", (1.16, .045, .57), (.48, .24, -.05), GRATE)
    for z in (-.32, .22):
        cbox(r, "shelf_rail", (2.16, .054, .045), (0, .197, z), STEEL)
    cbox(r, "drawer_pedestal", (.68, .65, .68), (-.73, .535, -.018), DARK)
    for i in range(3):
        y = .346 + i * .195
        panel(r, "drawer", -.73, y, .33, .64, .172, .038, .024, NAVY)
        cbox(r, "pull", (.35, .024, .039), (-.73, y + .035, .362), ALLOY)
    for x in (-1.04, .48):
        cbox(r, "backsplash_post", (.045, .54, .05), (x, 1.20, -.39), DARK)
    panel(r, "tool_board", -.28, 1.25, -.386, 1.59, .40, .038, .04, ALLOY)
    for x in (-.91, -.75, -.59, -.43):
        rod(r, "tool_shank", (x, 1.15, -.349), (x + .015, 1.34, -.349), .012, STEEL)
        cbox(r, "tool_grip", (.055, .074, .04), (x, 1.15, -.344), AMBER, .008)
    for i in range(6):
        quad(r, "peg_slot", (-.18 + i * .088, 1.33, -.366), .023, .038, "+z", DARK)
    cbox(r, "lamp_visor", (1.60, .051, .18), (-.28, 1.4745, -.33), DARK)
    cbox(r, "task_light", (1.39, .023, .062), (-.28, 1.44, -.265), LENS)
    # Ball-jointed measuring arm and the carriage vise at the receiving end.
    rod(r, "arm_base", (.88, .945, -.19), (.88, 1.014, -.19), .125, ENAMEL, 10)
    joints = [(.88, 1.025, -.19), (.69, 1.37, -.12), (.35, 1.20, .05)]
    for a, b in zip(joints, joints[1:]):
        beam(r, "articulated_arm", a, b, .065, .078, ENAMEL)
    for x, y, z in joints:
        rod(r, "pivot", (x, y, z - .056), (x, y, z + .056), .059, DARK, 10)
    cbox(r, "optics", (.16, .108, .12), (.35, 1.16, .05), ALLOY, .014)
    rod(r, "objective_lens", (.35, 1.11, .05), (.35, 1.08, .05), .032, "mat_glass", 8)
    cbox(r, "vise_slide", (.46, .062, .16), (-.54, .981, .16), DARK)
    for x in (-.69, -.44):
        cbox(r, "vise_jaw", (.083, .124, .19), (x, 1.045, .16), ALLOY, .013)
    rod(r, "vise_screw", (-.87, 1.006, .16), (-.48, 1.006, .16), .027)
    rod(r, "tommy_bar", (-.86, .968, .085), (-.86, 1.044, .235), .011)
    label(r, "bench_no", "mat_label_barcode", (.23, .05), (-.74, .846, .402))
    cbox(r, "bench_tag_plate", (.28, .064, .79), (-.74, .849, .006), DARK)
    inscription(r, "K-04", .07, 1.141, -.364, .089, DARK)


def weapon_case_stack(r):
    pallet(r, 0, 0, 0, 1.6, 1.2, "mat_wood")
    for z in (-.285, .285):
        transit_case(r, 0, .14, z, 1.54, .32, .55, GRAPHITE)
        transit_case(r, -.02, .46, z, 1.49, .31, .54, NAVY)
    transit_case(r, .03, .77, -.07, 1.39, .33, .61, GRAPHITE)
    label(r, "hazard_class", "mat_label_warning", (.13, .09), (.34, .90, .221))
    stencil(r, "09", -.47, .23, .548, .11, AMBER)


def conveyor_scanner(r):
    for x in (-1.52, 0, 1.52):
        for s in (-1, 1):
            z = s * .47
            cbox(r, "foot", (.19, .04, .16), (x, .02, z), DARK)
            beam(r, "trestle", (x, .045, z), (x, .81, z * .86), .068, .085, STEEL)
        cbox(r, "tie", (.064, .063, .93), (x, .26, 0), ALLOY)
    for z in (-.50, .50):
        panel(r, "roller_channel", 0, .83, z, 3.6, .20, .093, .047, STEEL)
    for i in range(22):
        x = (i - 10.5) * .162
        rod(r, "roller", (x, .86, -.468), (x, .86, .468), .070, ALLOY, 8)
    # A continuous chamfered tunnel section, open along X for cartons.
    portal = [(-.699, .65), (-.699, 1.94), (-.47, 2.20), (.47, 2.20),
              (.676, 1.94), (.676, .65), (.52, .65), (.52, 1.84),
              (.39, 2.0), (-.39, 2.0), (-.52, 1.84), (-.52, .65)]
    prism(r, "scanner_arch", portal, "x", -.54, .16, STEEL)
    for x in (-.563, .139):
        prism(r, "portal_rim", portal, "x", x, x + .035, ENAMEL)
    for i in range(8):
        z = (i - 3.5) * .11
        cbox(r, "split_curtain", (.028, .33, .101), (-.47, 1.855, z), RUBBER)
    for z in (-.514, .514):
        cbox(r, "scanner_diode", (.041, .67, .012), (.075, 1.51, z), "mat_neon_green")
    panel(r, "reader_face", -.18, 1.55, .682, .53, .38, .034, .055, DARK)
    label(r, "screen", "mat_screen_status", (.34, .16), (-.18, 1.58, .700))
    quad(r, "ready", (-.31, 1.444, .700), .11, .022, "+z", "mat_neon_green")
    stencil(r, "03", -.32, 1.79, .677, .13, AMBER)
    for i in range(5):
        quad(r, "service_vent", (-.39 + i * .09, 1.03, -.700), .046, .35, "-z", DARK)
    for x in (-1.45, 1.44):
        cbox(r, "pinch_guard", (.42, .072, .014), (x, .84, .553), "mat_hazard")
    label(r, "warning", "mat_label_warning", (.14, .11), (-.17, 1.18, .677))


def ceiling_lamp(r):
    # Press-braked reflector, open underside; two protected tubes and saddles above.
    prism(r, "reflector", [(-.30, .13), (-.20, .26), (.20, .26), (.30, .13),
          (.29, .11), (.18, .225), (-.18, .225), (-.29, .11)], "x", -.90, .90, ALLOY)
    cbox(r, "driver", (1.48, .065, .235), (0, .2825, 0), DARK, .016)
    for x in (-.59, .59):
        prism(r, "saddle", [(-.12, .305), (-.12, .45), (.12, .45), (.12, .305),
              (.095, .305), (.095, .423), (-.095, .423), (-.095, .305)], "x", x - .045, x + .045, STEEL)
    for z in (-.116, .116):
        rod(r, "fluorescent", (-.79, .128, z), (.79, .128, z), .045, LENS, 12)
        for x in (-.814, .814):
            panel(r, "end_socket", x, .165, z, .074, .16, .105, .023, DARK)
    for x in (-.82, -.42, 0, .42, .82):
        tube(r, "wire_guard", [(x, .16, -.27), (x, .031, -.211), (x, .012, -.16),
             (x, .012, .16), (x, .031, .211), (x, .16, .27)], .012, STEEL, 6)
    for z in (-.18, .18):
        rod(r, "guard_spine", (-.83, .012, z), (.83, .012, z), .012, STEEL, 8)


def hall_column(r):
    # Axis of the rolled section is offset so the bracket and the base share a centred AABB.
    cx = -.23
    cbox(r, "base_plate", (.94, .10, .83), (cx, .05, 0), ALLOY, .018)
    for z in (-.25, .25):
        cbox(r, "flange", (.52, 9.86, .057), (cx, 5.03, z), STEEL)
    cbox(r, "web", (.042, 9.86, .46), (cx, 5.03, 0), ALLOY)
    cbox(r, "roof_seat", (.69, .05, .68), (cx, 9.975, 0), STEEL)
    for s in (-1, 1):
        for z in (-.33, .33):
            x = cx + s * .37
            rod(r, "hold_down_nut", (x, .10, z), (x, .161, z), .054, DARK, 6)
            rod(r, "stud", (x, .161, z), (x, .191, z), .023, ALLOY)
        for z in (-.18, .18):
            prism(r, "base_gusset", [(cx, .10), (cx + s * .39, .10),
                  (cx + s * .17, .40), (cx, .53)], "z", z - .02, z + .02, STEEL)
    for z in (-.208, .208):
        prism(r, "corbel", [(cx, 7.28), (.66, 8.04), (.66, 8.15), (cx, 8.15)],
              "z", z - .028, z + .028, STEEL)
    cbox(r, "rail_seat", (.88, .085, .63), (.26, 8.1575, 0), ALLOY)
    for y in (2.20, 5.0, 7.32, 8.10, 9.65):
        cbox(r, "web_stiffeners", (.48, .040, .46), (cx, y, 0), STEEL)
    panel(r, "column_marker", cx, 1.58, .29, .47, .56, .023, .04, ENAMEL)
    stencil(r, "04", cx - .15, 1.45, .304, .245, DARK)
    for z in (-.285, .285):
        cbox(r, "splice_cover", (.39, .23, .028), (cx, 6.285, z), DARK)
        for y in (6.22, 6.35):
            for x in (cx - .135, cx + .135):
                rod(r, "splice_bolt", (x, y, z), (x, y, z * 1.09), .027, ALLOY)


def crane_rail(r):
    # Running direction Z, continuous head and square ends butt at 6 m intervals.
    cbox(r, "lower_flange", (.44, .045, 6), (0, .0225, 0), STEEL)
    cbox(r, "girder_web", (.037, .42, 6), (0, .255, 0), ALLOY)
    cbox(r, "upper_flange", (.44, .055, 6), (0, .4925, 0), STEEL)
    cbox(r, "rail_foot", (.18, .024, 6), (0, .532, 0), DARK)
    cbox(r, "rail_neck", (.051, .055, 6), (0, .5715, 0), ALLOY)
    cbox(r, "running_head", (.104, .041, 6), (0, .6195, 0), ALLOY)
    for z in (-2.77, -1.4, 0, 1.4, 2.77):
        for s in (-1, 1):
            prism(r, "web_rib", [(s * .018, .045), (s * .146, .045), (s * .146, .10),
                  (s * .085, .417), (s * .085, .465), (s * .018, .465)],
                  "z", z - .016, z + .016, STEEL)
            cbox(r, "rail_clip", (.085, .035, .14), (s * .111, .538, z), ENAMEL)
            rod(r, "clamp_nut", (s * .126, .55, z), (s * .126, .575, z), .026, DARK)
    for z in (-2.79, 2.79):
        for s in (-1, 1):
            cbox(r, "splice", (.017, .24, .40), (s * .027, .25, z), DARK)
            for dz in (-.12, .12):
                for y in (.19, .31):
                    rod(r, "fishbolt", (s * .034, y, z + dz), (s * .056, y, z + dz), .027, ALLOY)


def wall_terminal(r):
    cbox(r, "wall_bracket", (.82, .61, .056), (0, .47, .028), DARK)
    panel(r, "back_shell", 0, .465, .098, 1.42, .93, .095, .092, STEEL)
    panel(r, "display_bezel", -.155, .49, .156, 1.005, .76, .034, .041, DARK)
    panel(r, "manifest_glass", -.155, .49, .177, .947, .701, .016, .018, "mat_glass")
    # Manifest information is geometry so the same content is readable in the GLB and game.
    inscription(r, "DOK", -.57, .727, .188, .103, "mat_neon_white")
    stencil(r, "09", .12, .703, .188, .096, "mat_neon_amber")
    inscription(r, "LIST", -.57, .60, .188, .059, "mat_neon_blue")
    for i, destination in enumerate(("41", "62", "73")):
        y = .48 - i * .123
        quad(r, "row_rule", (-.156, y + .066, .188), .83, .005, "+z", STEEL)
        stencil(r, destination, -.55, y - .012, .188, .047, "mat_neon_white")
        for j, length in enumerate((.20 + i * .034, .10 - i * .013)):
            quad(r, "manifest_field", (-.28 + j * .26, y + .010, .188), length, .013, "+z", ALLOY)
        quad(r, "cleared", (.194, y + .009, .188), .055, .018, "+z", "mat_neon_green")
    panel(r, "scanner_bezel", .504, .44, .165, .228, .56, .053, .034, NAVY)
    label(r, "reader", "mat_screen_status", (.15, .098), (.504, .61, .193))
    for i in range(3):
        for j in range(3):
            cbox(r, "key", (.038, .035, .013), (.452 + .052 * j, .51 - i * .058, .196), ALLOY)
    cbox(r, "card_slot", (.166, .026, .025), (.504, .256, .198), DARK)
    for x in (-.59, .58):
        for y in (.064, .862):
            rod(r, "tamper_bolt", (x, y, .143), (x, y, .155), .019, ALLOY)
    label(r, "asset_tag", "mat_label_barcode", (.27, .049), (-.39, .062, .147))


def catwalk(r):
    # All grating elements terminate at or below y=.20. 'deck' is measured independently of the rails.
    for z in (-.705, .705):
        cbox(r, "stringer", (4, .16, .082), (0, .080, z), STEEL)
        cbox(r, "kick_plate", (4, .105, .029), (0, .245, z), ENAMEL)
        for x in (-1.84, 0, 1.84):
            cbox(r, "post_socket", (.109, .16, .09), (x, .24, z), ALLOY)
            cbox(r, "stanchion", (.052, .88, .052), (x, .745, z), STEEL)
        for y, radius, mat in ((.65, .022, STEEL), (1.17, .03, AMBER)):
            rod(r, "handrail", (-2, y, z), (2, y, z), radius, mat, 8)
    for x in (-1.96, -.98, 0, .98, 1.96):
        cbox(r, "joist", (.073, .133, 1.40), (x, .0865, 0), STEEL)
    for i in range(42):
        cbox(r, "bearing_bar", (.024, .047, 1.50), ((i - 20.5) * .095, .1765, 0), GRATE)
    for i in range(9):
        cbox(r, "cross_bar", (4, .018, .017), (0, .185, (i - 4) * .165), GRATE)


BUILDERS = (pallet_rack, forklift, overhead_crane, server_rack, workbench_weapons,
            weapon_case_stack, conveyor_scanner, ceiling_lamp, hall_column, crane_rail,
            wall_terminal, catwalk)


def previews(root, folder):
    scene = ba._preview_scene((840, 840), (.16, .18, .22))
    scene.display.shading.show_object_outline = False
    scene.display.shading.cavity_type = "WORLD"
    scene.display.shading.background_type = "WORLD"
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.exposure = .85
    bpy.context.view_layer.update()
    points = [obj.matrix_world @ vertex.co for obj in root.children for vertex in obj.data.vertices]
    # Each view fits its projected vertices, including very thin/tall profiles.
    views = {"front": (.24, .16, 1), "side": (1, .24, -.32), "top": (0, 1, .0001)}
    if root.name == "wh_ceiling_lamp":
        views["front"] = (.27, -.56, 1)
    elif root.name == "wh_forklift":
        views["front"] = (1, .49, .85)
        views["side"] = (.045, .15, 1)
    for view, direction in views.items():
        cam = ba._preview_camera(scene, (0, 0, 0), ba._city_point(direction), 40)
        rot = cam.rotation_euler.to_quaternion()
        flat = [rot.inverted() @ p for p in points]
        lo = Vector([min(p[i] for p in flat) for i in range(3)])
        hi = Vector([max(p[i] for p in flat) for i in range(3)])
        cam.location += rot @ ((hi + lo) / 2)
        cam.data.type = "ORTHO"
        cam.data.ortho_scale = max(hi.x - lo.x, hi.y - lo.y) * 1.13
        scene.render.filepath = str(folder / f"{root.name}-{view}.png")
        bpy.ops.render.render(write_still=True)
        bpy.data.objects.remove(cam, do_unlink=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", help="Id modeli rozdzielone przecinkami")
    parser.add_argument("--no-preview", action="store_true")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    out = REPO / "public/assets/models/city"
    folder = REPO / "artifacts/models/wh"
    folder.mkdir(parents=True, exist_ok=True)
    for build in BUILDERS:
        name = "wh_" + build.__name__
        if args.only and name not in args.only.split(","):
            continue
        ba.reset_scene()
        root = ba._port_root(name)
        build(root)
        ba._port_merge(root, {GRATE: "deck"} if build == catwalk else {})
        ba.export_glb(root, str(out / f"{name}.glb"), animations=False)
        triangles = sum(len(p.vertices) - 2 for obj in root.children for p in obj.data.polygons)
        print(f"[warehouse] {name} {triangles} tri", flush=True)
        if not args.no_preview:
            previews(root, folder)


if __name__ == "__main__":
    main()
