"""Sektor X-51. Metry glTF, Y w górę, przód +Z. Polecenie budowy w docs/assets.md."""

import argparse
import math
import sys
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from mall_atrium import (
    REPO,
    ba,
    bpy,
    Vector,
    cbox,
    rod,
    tube,
    beam,
    form,
    pane,
    quad,
    prism,
    slab,
    panel,
    label,
    lettering,
    finish_glazing,
    materials,
    color,
)
from warehouse_kurogane import stencil, transit_case

STEEL, DARK, ALLOY = "mat_metal", "mat_trim", "mat_machine"
INK, ENAMEL, GOLD = "mat_cable", "mat_lacquer", "mat_hivis"
PAPER, WHITE, GLASS = "mat_plaster", "mat_light_panel", "mat_glass_clear"
GREEN, BLUE, VIOLET, AMBER = ["mat_neon_" + c for c in ("green", "blue", "violet", "amber")]
RUBBER, HAZARD = "mat_rubber", "mat_hazard"
GRAPHITE, GRATE = "mat_container_graphite", "mat_steel_grating"
STATUS, MAP = "mat_screen_status", "mat_screen_map"


def box(r, name, x, y, z, w, h, d, mat, bevel=0):
    return cbox(r, name, (w, h, d), (x, y, z), mat, bevel)


def drum(r, name, x, z, bottom, top, radius, mat, sides=12, end_radius=None):
    return form(
        r,
        name,
        x,
        z,
        [
            (bottom, radius, radius, 0),
            (
                top,
                end_radius if end_radius is not None else radius,
                end_radius if end_radius is not None else radius,
                0,
            ),
        ],
        mat,
        sides,
    )


def face(r, name, x, y, z, w, h, mat):
    return quad(r, name, (x, y, z), w, h, "+z", mat)


def print_on(r, mat, x, y, z, w, h, facing="+z"):
    return label(r, "print", mat, (w, h), (x, y, z), facing)


def stripe(r, x, y, z, w, h, mat=GOLD):
    pane(
        r,
        "slash",
        [
            (x - w / 2, y - h / 2, z),
            (x + w * 0.12, y - h / 2, z),
            (x + w / 2, y + h / 2, z),
            (x - w * 0.12, y + h / 2, z),
        ],
        mat,
    )


def screen(r, x, y, z, w, h, art=STATUS):
    panel(r, "instrument_bezel", x, y, z - 0.015, w, h, 0.03, h * 0.10, DARK)
    print_on(r, art, x, y, z + 0.001, w * 0.88, h * 0.76)


def specimen(r, cryo=False, scale=1, offset=(0, 0, 0)):
    """Wspólna, zawieszona figura; wariant inkubatora skaluje całą anatomię."""
    before = set(r.children)
    sides = 5 if scale < 1 else 8
    wire_sides = 3 if scale < 1 else 5
    skin, glow = "mat_snow", BLUE if cryo else GREEN
    form(r, "cranium", 0, 0.14, [
        (2.87, .055, .064, .055), (2.94, .123, .113, .052),
        (3.08, .158, .143, .018), (3.24, .130, .134, -.024),
        (3.31, .065, .076, -.040)], skin, sides+2)
    rod(r, "neck", (0, 2.73, .035), (0, 2.97, .12), .072, skin, sides, .059)
    form(r, "ribcage", 0, 0, [
        (2.14, .14, .105, -.05), (2.28, .117, .10, -.03),
        (2.48, .205, .145, .005), (2.66, .25, .14, .025),
        (2.75, .19, .11, .04), (2.80, .075, .07, .05)], skin, sides+2)
    form(r, "pelvis", 0, -.05, [(2.05,.12,.10,0), (2.14,.174,.13,0),
                              (2.25,.126,.10,0)], skin, sides)
    for side in (-1, 1):
        panel(r, "eye_socket", side*.071, 3.071, .274, .093, .049, .012, .018, DARK)
        rod(r, "brow", (side*.025,3.115,.265), (side*.128,3.102,.247), .020, skin, 5)
        rod(r, "cheekbone", (side*.12,3.04,.258), (side*.075,2.995,.277), .024, skin, 5)
        for i in range(3 if scale < 1 else 4):
            y = 2.40+i*.069
            tube(r, "rib_contour", [(side*.025,y,.136), (side*.13,y+.024,.145),
                                    (side*(.17+i*.013),y+.056,.075)], .014, skin, 4)
        rod(r, "clavicle", (side*.025,2.70,.141), (side*.205,2.689,.11), .021, skin, 5)
        knee = (side*.212, 1.93+side*.13, .36+side*.08)
        ankle = (side*.19, 1.35+side*.035, .09)
        elbow = (side*.33, 2.39+side*.09, .13)
        wrist = (side*.255, 2.14+side*.09, .30)
        shoulder = (side*.218,2.67,.055)
        for name, start, end, radius, tip in (
            ("upper_arm",shoulder,elbow,.083,.059),
            ("forearm",elbow,wrist,.066,.041),
            ("thigh",(side*.105,2.14,-.05),knee,.113,.071),
            ("calf",knee,ankle,.078,.042)):
            mid = tuple(a*.58+b*.42 for a,b in zip(start,end))
            rod(r,name,start,mid,radius,skin,sides,radius*1.06)
            rod(r,name+"_taper",mid,end,radius*1.06,skin,sides,tip)
        rod(r,"palm",wrist,(wrist[0],wrist[1]-.095,.325),.049,skin,sides,.037)
        for finger in range(4):
            x = wrist[0]+(finger-1.5)*.023
            y = wrist[1]-.075
            length = .10-abs(finger-1.5)*.012
            tube(r,"finger",[(x,y,.326),(x,y-length*.6,.35),
                              (x,y-length,.379),(x,y-length*.9,.403)],.012,skin,3)
        tube(r,"thumb",[(wrist[0]-side*.038,wrist[1]-.02,.32),
                         (wrist[0]-side*.069,wrist[1]-.06,.35),
                         (wrist[0]-side*.06,wrist[1]-.09,.38)],.017,skin,3)
        rod(r,"foot",ankle,(side*.19,1.255+side*.035,.255),.058,skin,sides,.044)
        for start, end, radius in (
            (shoulder,elbow,.091), (ankle,knee,.054)):
            a, b = Vector(start), Vector(end)
            axis = (b-a).normalized()
            rod(r,"restraint_collar",a+axis*.055,a+axis*.10,radius,STEEL,sides)
            tube(r,"restraint_tether",[tuple(a+axis*.075),
                  (side*.48,a.y+.08,-.10),(side*.67,a.y+.30,-.34)],.016,INK,4)
        tube(r,"arm_vein",[(side*.22,2.67,.132), (side*.314,elbow[1],.189),
                            (wrist[0]+side*.02,wrist[1]+.035,.34)],.009,glow,3)
        tube(r,"leg_vein",[(side*.11,2.10,.07),(knee[0],knee[1],knee[2]+.075),
                            (ankle[0],ankle[1]+.05,ankle[2]+.045)],.009,glow,3)
        tube(r,"temple_vein",[(side*.10,3.24,.212),(side*.133,3.17,.235),
                               (side*.118,3.13,.255)],.007,glow,3)
    for i in range(7):
        box(r,"vertebra",0,2.22+i*.078,-.135,.055,.046,.045,skin)
    for y in ((2.34,2.82) if scale < 1 else (2.34,2.60,2.82)):
        rod(r,"spinal_port",(0,y,-.12),(0,y,-.20),.040,ENAMEL,6)
        tube(r,"spinal_feed",[(0,y,-.19),(-.20,y-.12,-.29),
                              (-.51,y+.12,-.34),(-.60,3.55,-.34),(-.38,3.77,-.30)],.026,INK,wire_sides)
    panel(r,"respirator",0,2.969,.289,.16,.094,.047,.024,DARK)
    for side in (-1,1):
        rod(r,"mask_filter",(side*.065,2.972,.31),(side*.118,2.972,.31),.039,STEEL,6)
    tube(r,"breathing_hose",[(.10,2.97,.31),(.22,2.86,.34),(.37,2.90,.20),
                              (.47,3.20,-.12),(.40,3.77,-.24)],.025,INK,wire_sides)
    tube(r,"sternal_vein",[(0,2.69,.146),(.025,2.54,.158),(0,2.39,.13),
                           (.04,2.25,.087)],.009,glow,3)
    # Keep the same authored mesh in the small culture vessel.
    for obj in set(r.children)-before:
        obj.location = obj.location*scale + ba._city_point(offset)
        obj.scale *= scale


def culture_fluid(r, bottom, top, radius):
    # Rear-only translucent bands build optical density towards the sump,
    # leaving the front silhouette clear with the runtime glass material.
    for layer in range(3):
        for i in range(8):
            a, b = [math.pi + math.pi*j/8 for j in (i,i+1)]
            y = bottom + (top-bottom)*(1-layer*.23)
            pane(r,"fluid_gradient",[(radius*math.cos(t),h,radius*math.sin(t))
                 for t,h in ((a,bottom),(b,bottom),(b,y),(a,y))],GLASS)
    for i in range(7):
        y = bottom+(top-bottom)*(.12+i*.115)
        rad = radius*(.022+(i%3)*.012)
        x = (-1 if i%2 else 1)*radius*(.52+(i%3)*.10)
        form(r,"bubble",x,.10*radius,[(y-rad,.004,.004,0),
             (y,rad,rad,0),(y+rad,.004,.004,0)],GLASS,4 if radius < .5 else 6)


def cocoon(r, cryo=False, breached=False):
    radius = 1.20 if breached else 1.10
    glow = BLUE if cryo else GREEN
    for name, y, h, rad, tip, mat in (
        ("foot", 0, 0.15, radius, radius, DARK),
        ("sump", 0.15, 0.32, radius, radius * 0.90, ALLOY),
        ("warning_band", 0.47, 0.08, radius * 0.90, radius * 0.94, HAZARD),
        ("skirt", 0.55, 0.15, radius * 0.96, radius * 0.91, STEEL),
        ("seal", 0.7, 0.05, 0.91, 0.92, glow if not breached else AMBER),
        ("head_gasket", 3.75, 0.08, 0.92, 0.96, WHITE),
        ("crown", 3.83, 0.25, 1.02, 0.99, ALLOY),
        ("insulator", 4.08, 0.10, 0.84, 0.74, DARK),
        ("pipe_socket", 4.18, 0.22, 0.54, 0.48, STEEL),
    ):
        drum(r, name, 0, 0, y, y + h, rad, mat, 8, tip)
    panel(r, "terminal_mount", 0, 0.36, radius - 0.083, 0.60, 0.31, 0.16, 0.058, DARK)
    screen(r, 0, 0.36, radius - 0.001, 0.49, 0.235)
    stencil(r, "04" if breached else ("09" if cryo else "07"), -0.112, 3.89, 1.018, 0.112, GOLD)
    for s in (-1, 1):
        tube(
            r,
            "return_line",
            [(s * 0.70, 0.14, 0.57), (s * 0.81, 0.28, 0.54), (s * 0.83, 0.73, 0.42), (s * 0.78, 0.92, 0.36)],
            0.069,
            INK,
            6,
        )
        drum(r, "valve", s * 0.71, -0.12, 4.02, 4.22, 0.14, GOLD, 8)
        tube(
            r,
            "crown_hose",
            [
                (s * 0.77, 3.80, -0.16),
                (s * 0.81, 4.13, -0.16),
                (s * 0.68, 4.31, -0.18),
                (s * 0.36, 4.31, -0.16),
            ],
            0.074,
            INK,
            6,
        )
        rod(r, "spine", (s * 0.72, 0.71, -0.38), (s * 0.72, 3.78, -0.38), 0.071, STEEL, 6)
    for s in (-1, 1):
        for j in range(3):
            a = s * (0.53 + j * 0.105)
            # Service indices follow the angled side of the octagonal sump.
            z = radius * 0.95 - abs(a) * 0.414
            pane(
                r,
                "service_index",
                [
                    (a - 0.020, 0.32, z + 0.015),
                    (a + 0.016, 0.32, z + 0.001),
                    (a + 0.039, 0.40, z - 0.009),
                    (a + 0.004, 0.40, z + 0.006),
                ],
                GOLD,
            )
    if breached:
        # Irregular tooth heights leave a person-sized opening on the operator side.
        for i in range(16):
            a, b = [math.tau * k / 16 for k in (i, i + 1)]

            def pt(angle, y):
                return (0.89 * math.sin(angle), y, 0.89 * math.cos(angle))

            if math.cos((a + b) / 2) < -0.35:
                pane(r, "intact_glass", [pt(a, 0.75), pt(b, 0.75), pt(b, 3.75), pt(a, 3.75)], GLASS)
            else:
                peak = 0.94 + (i * 7 % 8) * 0.18
                pane(r, "broken_glass", [pt(a, 0.75), pt(b, 0.75), pt(a + 0.11, peak)], GLASS)
                if i % 2 == 0:
                    rod(r, "fracture_edge", pt(a + 0.11, peak), pt(b, 0.75), 0.011, STEEL, 3)
                pane(
                    r,
                    "hanging_shard",
                    [pt(a, 3.75), pt(b, 3.75), pt(b - 0.07, 3.61 - (i * 3 % 5) * 0.15)],
                    GLASS,
                )
        for i in range(3):
            tube(
                r,
                "severed_hose",
                [
                    (0.19 * i - 0.30, 3.85, 0.03),
                    (0.2 * i - 0.36, 3.18, 0.15),
                    (0.24 * i - 0.42, 2.90 - 0.24 * i, 0.51),
                    (0.32 * i - 0.50, 2.64 - 0.27 * i, 0.73),
                ],
                0.044,
                INK,
                5,
            )
        tube(
            r,
            "ruptured_return",
            [
                (0.79, 0.82, 0.19),
                (0.85, 0.73, 0.56),
                (0.93, 0.48, 0.74),
                (0.84, 0.25, 0.96),
                (0.65, 0.18, 1.09),
                (0.53, 0.15, 1.12),
            ],
            0.064,
            INK,
            6,
        )
        rod(r, "loose_coupling", (0.54, 0.151, 1.118), (0.48, 0.137, 1.113), 0.070, GOLD, 7)
        for s in (-1, 1):
            face(r, "alert", s * 0.19, 0.642, 1.079, 0.085, 0.035, AMBER)
        print_on(r, "mat_label_warning", -0.02, 1.09, -0.79, 0.36, 0.23)
    else:
        drum(r, "pressure_glass", 0, 0, 0.75, 3.75, 0.89, GLASS, 20)
        drum(r, "nutrient_core", 0, -0.53, 0.75, 3.75, 0.095, glow, 8)
        # Backlighting silhouettes the figure without enclosing it in opaque emissive geometry.
        for s in (-1, 1):
            rod(r, "fluid_indicator", (s * 0.57, 0.77, -0.49), (s * 0.57, 3.73, -0.49), 0.022, glow, 5)
        for i in range(16):
            a, b = [math.tau * k / 16 for k in (i, i + 1)]
            pane(
                r,
                "meniscus",
                [
                    (0.875 * math.cos(t), y, 0.875 * math.sin(t))
                    for t, y in ((a, 3.53), (a, 3.546), (b, 3.546), (b, 3.53))
                ],
                VIOLET if cryo else glow,
            )
        specimen(r, cryo)
        culture_fluid(r, .77, 3.53, .86)
        for s in (-1, 1):
            y = 1.50 + s * 0.28
            form(
                r,
                "entrained_bubble",
                s * 0.42,
                -0.09,
                [(y, 0.019, 0.019, 0), (y + 0.025, 0.033, 0.033, 0), (y + 0.062, 0.012, 0.012, 0)],
                GLASS,
                4,
            )
            # Feed ports and the cryo coil collars are visible from the gallery above.
            drum(r, "inlet", s * 0.34, 0, 4.37, 4.394, 0.105, DARK, 6)
            face(r, "mask_filter", s * 0.102, 2.978, 0.281, 0.048, 0.051, STEEL)


def cocoon_tall(r):
    cocoon(r)


def cocoon_tall_cryo(r):
    cocoon(r, cryo=True)


def cocoon_breached(r):
    cocoon(r, breached=True)


def cocoon_incubator(r):
    for x in (-0.35, 0.35):
        for z in (-0.29, 0.29):
            rod(r, "castor", (x - 0.045, 0.085, z), (x + 0.045, 0.085, z), 0.085, RUBBER, 8)
            box(r, "fork", x, 0.158, z, 0.105, 0.11, 0.08, STEEL)
    slab(r, "cart", 0, 0.19, -0.015, 1.1, 0.49, 1.07, 0.18, ALLOY)
    panel(r, "terminal", 0, 0.48, 0.528, 0.50, 0.30, 0.034, 0.035, DARK)
    drum(r, "gasket", 0, 0, 0.68, 0.85, 0.50, DARK)
    screen(r, 0, 0.50, 0.549, 0.39, 0.19)
    for i in range(5):
        face(r, "keys", (i - 2) * 0.068, 0.332, 0.546, 0.049, 0.025, GOLD)
    drum(r, "culture_glass", 0, 0, 0.85, 1.85, 0.445, GLASS, 20)
    specimen(r, scale=.43, offset=(0, .30, 0))
    culture_fluid(r, .86, 1.81, .42)
    drum(r, "cap", 0, 0, 1.85, 1.99, 0.48, STEEL, 12, 0.43)
    drum(r, "flange", 0, 0, 1.99, 2.026, 0.34, WHITE)
    drum(r, "filter", 0, 0, 2.026, 2.10, 0.24, DARK, 8)
    for s in (-1, 1):
        for j in range(4):
            face(r, "filter_vent", s * 0.304, 0.32 + j * 0.062, 0.522, 0.085, 0.023, INK)
    tube(
        r,
        "feed",
        [(0.36, 0.70, -0.20), (0.43, 0.84, -0.22), (0.43, 1.82, -0.22), (0.29, 1.93, -0.22)],
        0.04,
        INK,
        6,
    )


def ceiling_manifold(r):
    for x in (-2.5, 2.5):
        for z in (-2.25, 2.25):
            slab(r, "ceiling_shoe", x, 4.99, z, 1, 0.21, 1, 0.14, DARK)
            drum(r, "header", x, z, 4.62, 5, 0.35, ALLOY, 8)
            drum(r, "union", x, z, 0, 0.18, 0.37, STEEL, 8)
            for dx, dz, radius, mat in [
                (-0.13, 0, 0.14, STEEL),
                (0.15, 0.01, 0.081, INK),
                (0.11, -0.18, 0.058, INK),
            ]:
                rod(r, "drop", (x + dx, 0.14, z + dz), (x + dx, 4.70, z + dz), radius, mat, 5)
            for y in (0.48, 4.38):
                drum(r, "pipe_clamp", x, z, y, y + 0.10, 0.26, GOLD, 6)
            drum(r, "sight_glass", x - 0.13, z, 3.45, 3.79, 0.144, GREEN if x < 0 else BLUE, 8)
        box(r, "side_header", x, 4.73, 0, 0.26, 0.25, 4.5, ALLOY)
    for z in (-2.25, 2.25):
        box(r, "chord", 0, 4.82, z, 5, 0.28, 0.22, STEEL)
        box(r, "chord", 0, 4.30, z, 5, 0.12, 0.14, DARK)
        for i in range(5):
            y0, y1 = (4.32, 4.74) if i % 2 else (4.74, 4.32)
            beam(r, "web", (-2.5 + i, y0, z), (-1.5 + i, y1, z), 0.075, 0.07, GOLD)
        panel(r, "junction", 0, 4.61, z, 0.85, 0.61, 0.38, 0.09, DARK)
        face(r, "flow_indicator", 0, 4.61, z + 0.192, 0.55, 0.085, GREEN if z > 0 else BLUE)


def freight_elevator(r):
    for s in (-1, 1):
        x = s * 2.24
        for z in (-1.84, 1.84):
            box(r, "upright", x, 5.8, z, 0.23, 11.6, 0.23, STEEL)
            for y in (0.16, 5.2, 11.44):
                box(r, "splice_plate", x, y, z, 0.32, 0.32, 0.32, ALLOY)
            box(r, "lift_rail", x - s * 0.14, 5.76, z, 0.075, 11.5, 0.12, DARK)
            rod(r, "wire_rope", (x - s * 0.29, 2.72, z * 0.73), (x - s * 0.29, 11.39, z * 0.73), 0.047, INK, 6)
        for i in range(5):
            z = 1.8 * (-1) ** i
            beam(r, "shaft_brace", (x, 0.32 + i * 2.19, z), (x, 2.51 + i * 2.19, -z), 0.11, 0.13, ALLOY)
        box(r, "car_guard", s * 1.96, 3.58, 0, 0.09, 0.11, 3.42, HAZARD)
        box(r, "car_rail", s * 1.96, 3.21, 0, 0.06, 0.07, 3.42, STEEL)
        for z in (-1.65, 0, 1.65):
            box(r, "guard_post", s * 1.96, 3.20, z, 0.07, 0.80, 0.07, DARK)
    for y in (0.17, 5.20, 11.44):
        for z in (-1.84, 1.84):
            box(r, "crosshead", 0, y, z, 4.42, 0.30, 0.27, DARK)
            for i in range(7):
                stripe(r, (i - 3) * 0.27, y, z + 0.136, 0.23, 0.23, HAZARD)
    slab(r, "car_deck", 0, 2.54, 0, 4.16, 0.26, 3.62, 0.12, STEEL)
    transit_case(r, -0.40, 2.8, -0.15, 1.88, 1.05, 1.27, GRAPHITE)
    for x in (-1.92, 1.92):
        drum(r, "signal_beacon", x, 1.82, 5.37, 5.63, 0.103, AMBER, 8)
    for x in (-1.5, 1.5):
        rod(r, "hoist_drum", (x - 0.29, 11.14, 0), (x + 0.29, 11.14, 0), 0.31, STEEL, 12)
        tube(
            r,
            "hoist_line",
            [(x, 11.13, -1.38), (x, 11.45, -0.16), (x, 11.45, 0.16), (x, 11.13, 1.38)],
            0.06,
            INK,
            6,
        )


def bio_scanner_gate(r):
    for s in (-1, 1):
        x = s * 1.35
        slab(r, "foot", x, 0, 0, 0.5, 0.14, 1.4, 0.09, DARK)
        slab(r, "detector", x, 0.14, 0, 0.48, 2.17, 1.29, 0.10, ALLOY)
        panel(r, "sensor_inset", x, 1.27, 0.639, 0.29, 1.63, 0.045, 0.072, DARK)
        for j in range(6):
            face(r, "readout", x, 0.72 + j * 0.203, 0.663, 0.17, 0.032, GREEN if j > 3 else GOLD)
        for z in (-0.4, 0.4):
            box(r, "scan_guide", s * 1.113, 1.22, z, 0.024, 2.14, 0.075, AMBER)
        quad(r, "screened_side", (s * 1.592, 1.20, 0), 0.74, 1.59, "+x" if s > 0 else "-x", GLASS)
        print_on(r, "mat_label_warning", x, 0.30, 0.648, 0.23, 0.11)
    slab(r, "arch", 0, 2.30, -0.019, 3.2, 0.30, 1.362, 0.13, DARK)
    screen(r, 0, 2.453, 0.699, 0.82, 0.23)
    for s in (-1, 1):
        face(r, "scan_state", s * 0.91, 2.45, 0.664, 0.52, 0.04, GREEN)


def blast_door_frame(r):
    for s in (-1, 1):
        x = s * 2.20
        slab(r, "jamb", x, 0, -0.040, 0.40, 3.48, 0.52, 0.07, STEEL)
        for j in range(5):
            panel(r, "sliding_dog", x, 0.41 + j * 0.61, 0.24, 0.32, 0.49, 0.11, 0.073, DARK)
            stripe(r, x, 0.4 + j * 0.61, 0.296, 0.18, 0.23, HAZARD)
        box(r, "pressure_seal", s * 2.025, 1.69, 0.04, 0.05, 3.38, 0.20, INK)
    panel(r, "armored_lintel", 0, 3.60, -0.020, 4.80, 0.40, 0.56, 0.085, ALLOY)
    panel(r, "latch_housing", 0, 3.60, 0.267, 1.32, 0.28, 0.064, 0.08, DARK)
    face(r, "unlocked", -0.39, 3.60, 0.300, 0.21, 0.067, GREEN)
    print_on(r, "mat_label_stencil", 0.19, 3.60, 0.300, 0.52, 0.13)


def observation_window(r):
    for y in (0.10, 2.50):
        box(r, "frame", 0, y, 0, 8, 0.20, 0.37, ALLOY, 0.025)
    for x in (-3.91, -1.32, 1.32, 3.91):
        box(r, "mullion", x, 1.30, 0, 0.17, 2.43, 0.29, DARK)
        for y in (0.28, 2.32):
            rod(r, "clamp_bolt", (x, y, 0.141), (x, y, 0.166), 0.043, STEEL, 6)
    for x in (-2.62, 0, 2.62):
        quad(r, "ballistic_glass", (x, 1.30, 0), 2.54, 2.30, "+z", GLASS)
        for j in (-1, 0, 1):
            face(r, "safety_frit", x + j * 0.23, 1.13, 0.003, 0.13, 0.022, PAPER)
    box(r, "sill", 0, 0.23, -0.001, 8, 0.09, 0.448, DARK)
    face(r, "sill_light", 0, 0.231, 0.225, 7.69, 0.030, WHITE)
    panel(r, "intercom", 2.38, 0.45, 0.13, 0.60, 0.37, 0.16, 0.06, STEEL)
    for j in range(4):
        face(r, "mic_slot", 2.31, 0.39 + j * 0.041, 0.212, 0.26, 0.015, INK)
    face(r, "talk_key", 2.54, 0.45, 0.212, 0.095, 0.14, GREEN)
    for s in (-1, 1):
        for j in range(4):
            stripe(r, s * 3.65 + (j - 1.5) * 0.093, 0.37, 0.003, 0.085, 0.17)
        print_on(r, "mat_label_stencil", s * 3.63, 2.21, 0.003, 0.38, 0.16)
    stencil(r, "51", -0.16, 2.44, 0.186, 0.125, GOLD)


def security_desk(r):
    slab(r, "plinth", 0, 0, 0, 3.06, 0.13, 1.15, 0.12, DARK)
    prism(
        r,
        "ballistic_apron",
        [(-0.59, 0.12), (0.51, 0.12), (0.68, 0.85), (0.57, 0.93), (-0.59, 0.93)],
        "x",
        -1.62,
        1.62,
        STEEL,
    )
    slab(r, "countertop", 0, 0.86, 0, 3.40, 0.09, 1.40, 0.17, DARK)
    for x in (-1.02, 0, 1.02):
        panel(r, "armor_panel", x, 0.53, 0.622, 0.92, 0.51, 0.058, 0.08, ENAMEL)
        if x == 0:
            lettering(r, "OCHRONA", 0, 0.49, 0.652, 0.139, WHITE)
            face(r, "ident_band", 0, 0.463, 0.652, 0.75, 0.018, GOLD)
        else:
            for j in range(3):
                stripe(r, x + (j - 1) * 0.142, 0.54, 0.652, 0.133, 0.153)
            print_on(r, "mat_label_barcode", x, 0.382, 0.653, 0.21, 0.062)
    for x in (-0.55, 0, 0.55):
        box(r, "monitor_foot", x, 0.975, -0.22, 0.17, 0.05, 0.17, STEEL)
        screen(r, x, 1.111, -0.18, 0.48, 0.246)
    for x in (-1.47, 1.47):
        box(r, "shield_clamp", x, 1.10, 0.39, 0.10, 0.30, 0.11, ALLOY)
    quad(r, "ballistic_screen", (0, 1.125, 0.39), 2.87, 0.25, "+z", GLASS)
    box(r, "card_reader", -1.12, 0.98, 0.47, 0.27, 0.06, 0.26, DARK)
    quad(r, "reader_led", (-1.12, 1.012, 0.46), 0.15, 0.027, "+y", GREEN)
    tube(
        r,
        "gooseneck",
        [(1, 0.95, -0.13), (1, 1.12, -0.13), (0.95, 1.19, -0.07), (0.91, 1.20, 0.02)],
        0.018,
        INK,
        6,
    )


def catwalk_rail(r):
    box(r, "kickplate", 0, 0.075, 0, 4, 0.15, 0.14, HAZARD)
    for i in range(16):
        stripe(r, (i - 7.5) * 0.245, 0.075, 0.0703, 0.20, 0.14, DARK)
    for x in (-1.93, 0, 1.93):
        box(r, "post", x, 0.55, 0, 0.07, 1, 0.085, STEEL)
    box(r, "knee_rail", 0, 0.57, 0, 4, 0.05, 0.07, DARK)
    rod(r, "handrail", (-2, 1.05, 0), (2, 1.05, 0), 0.05, GOLD, 8)
    box(r, "underside_led", 0, 1.011, 0.019, 3.95, 0.018, 0.027, WHITE)
    # Expanded safety mesh made from ribbons rather than opaque rectangular infill.
    for i in range(14):
        x = -1.91 + i * 0.278
        for s in (-1, 1):
            a, b = (0.18, 0.53) if s > 0 else (0.53, 0.18)
            pane(r, "mesh_ribbon", [(x, a, 0), (x + 0.018, a, 0), (x + 0.27, b, 0), (x + 0.252, b, 0)], STEEL)


def ceiling_strip(r):
    slab(r, "washdown_case", 0, 0.08, 0, 2.4, 0.12, 0.60, 0.075, STEEL)
    for z in (-0.15, 0.15):
        slab(r, "lens_gasket", 0, 0.032, z, 2.25, 0.051, 0.246, 0.042, DARK)
        slab(r, "opal_lens", 0, 0, z, 2.16, 0.048, 0.19, 0.040, WHITE)
    for x in (-0.81, 0.81):
        box(r, "suspension", x, 0.263, 0, 0.11, 0.126, 0.16, ALLOY)
        box(r, "mount", x, 0.333, 0, 0.23, 0.034, 0.24, DARK)


def locker_bank(r):
    box(r, "back", 0, 1.05, -0.28, 2.4, 2.1, 0.09, DARK)
    for y in (0.065, 2.035):
        box(r, "cap", 0, y, -0.065, 2.4, 0.13, 0.52, STEEL)
    for i in range(7):
        box(r, "partition", (i - 3) * 0.393, 0.997, -0.065, 0.031, 1.90, 0.52, STEEL)
    for i in range(6):
        x = (i - 2.5) * 0.393
        # Fifth door pivots to expose a note on the back wall of locker 13.
        ajar = i == 4
        w = 0.285 if ajar else 0.375
        cx = x - 0.042 if ajar else x
        obj = box(r, "locker_door", cx, 1.05, 0.201 if not ajar else 0.252, w, 1.83, 0.033, ENAMEL)
        angle = 0.38 if ajar else 0
        obj.rotation_euler.z = angle

        def door_z(dx):
            return (0.202 if not ajar else 0.252) + 0.019 - dx * math.tan(angle)

        for j in range(4):
            y = 1.69 - j * 0.055
            dx = w * 0.28
            pane(
                r,
                "pressed_vent",
                [
                    (cx - dx, y - 0.01, door_z(-dx)),
                    (cx + dx, y - 0.01, door_z(dx)),
                    (cx + dx, y + 0.01, door_z(dx)),
                    (cx - dx, y + 0.01, door_z(-dx)),
                ],
                INK,
            )
        print_on(r, "mat_label_barcode", cx, 1.32, door_z(0) + 0.006, 0.17, 0.074)
        box(r, "pull", cx - w * 0.29, 1.06, door_z(-w * 0.29) + 0.008, 0.026, 0.15, 0.022, STEEL)
        if ajar:
            stencil(r, "13", cx - 0.064, 1.47, door_z(0) + 0.027, 0.114, GOLD)
            box(r, "shelf", x, 1.23, 0.02, 0.32, 0.026, 0.29, DARK)
            face(r, "intern_note", x + 0.140, 1.46, 0.169, 0.088, 0.19, WHITE)
            for j in range(3):
                face(r, "handwriting", x + 0.140, 1.49 - j * 0.027, 0.170, 0.062 - j * 0.009, 0.008, INK)
    box(r, "toe_lip", 0, 0.064, 0.299, 2.4, 0.085, 0.052, DARK)


def locker_bench(r):
    for x in (-0.86, 0.86):
        for z in (-0.29, 0.29):
            box(r, "foot", x, 0.032, z, 0.14, 0.064, 0.15, RUBBER)
            box(r, "leg", x, 0.246, z, 0.072, 0.423, 0.072, DARK)
        box(r, "seat_support", x, 0.425, 0, 0.104, 0.065, 0.76, STEEL)
    for z in (-0.305, -0.102, 0.102, 0.305):
        box(r, "seat_slat", 0, 0.4765, z, 2.20, 0.047, 0.19, "mat_wood")
    for z in (-0.24, 0, 0.24):
        box(r, "shoe_shelf", 0, 0.17, z, 1.81, 0.035, 0.039, STEEL)


def decon_shower(r):
    slab(r, "drain_pan", 0, 0, 0, 1.8, 0.13, 1.60, 0.065, STEEL)
    box(r, "grated_drain", 0, 0.134, 0, 1.52, 0.008, 1.34, GRATE)
    for i in range(12):
        quad(r, "drain_slot", (0, 0.139, (i - 5.5) * 0.097), 1.34, 0.025, "+y", DARK)
    for s in (-1, 1):
        x = s * 0.84
        for z in (-0.73, 0.73):
            box(r, "channel", x, 1.23, z, 0.10, 2.22, 0.10, STEEL)
        quad(r, "splash_guard", (x, 1.25, 0), 1.4, 2.16, "+x" if s > 0 else "-x", GLASS)
        box(r, "warning_rail", x, 1.01, 0, 0.11, 0.09, 1.5, HAZARD)
        for i in range(6):
            quad(
                r,
                "band_mark",
                (x + s * 0.056, 1.01, (i - 2.5) * 0.23),
                0.10,
                0.09,
                "+x" if s > 0 else "-x",
                DARK,
            )
        for y in (0.57, 1.31, 1.90):
            rod(r, "spray_nozzle", (x, y, -0.57), (s * 0.70, y, -0.57), 0.065, ALLOY, 8, 0.038)
    slab(r, "header", 0, 2.21, -0.013, 1.8, 0.19, 1.574, 0.08, DARK)
    drum(r, "rain_head", 0, 0, 2.13, 2.23, 0.26, STEEL)
    face(r, "ready", 0, 2.31, 0.800, 0.53, 0.045, GREEN)


def hazmat_suit_rack(r):
    for x in (-1.045, 1.045):
        slab(r, "foot", x, 0, 0, 0.11, 0.055, 0.75, 0.025, DARK)
        box(r, "stand", x, 1.067, -0.14, 0.081, 2.025, 0.08, STEEL)
    box(r, "hanger_rail", 0, 2.06, -0.14, 2.20, 0.08, 0.09, ALLOY)
    slab(r, "tank_shelf", 0, 0.14, -0.08, 2.10, 0.065, 0.55, 0.05, DARK)
    for index, x in enumerate((-0.69, 0, 0.69)):
        before = set(r.children)
        z = 0.014 if index % 2 else -0.01
        tube(r, "hook", [(x, 1.85, z), (x, 1.97, z), (x, 2.035, -0.09), (x, 2.035, -0.145)], 0.017, STEEL, 4)
        form(
            r,
            "sealed_suit",
            x,
            z,
            [
                (0.77, 0.150, 0.115, 0),
                (0.96, 0.136, 0.101, 0),
                (1.34, 0.216, 0.130, 0),
                (1.47, 0.19, 0.109, -0.007),
                (1.53, 0.098, 0.095, 0),
            ],
            GOLD,
            5,
        )
        form(
            r,
            "hood",
            x,
            z,
            [
                (1.45, 0.130, 0.095, 0),
                (1.54, 0.160, 0.127, 0.014),
                (1.73, 0.139, 0.134, 0.014),
                (1.81, 0.089, 0.087, 0),
            ],
            GOLD,
            6,
        )
        # Recessed helmet cavity, separate gasket and proud curved glazing.
        panel(r, "helmet_interior", x, 1.655, z + .139, .217, .137, .013, .028, INK)
        face(r, "inner_headband", x, 1.681, z+.149, .139, .019, STEEL)
        face(r, "inner_mask", x, 1.620, z+.150, .076, .030, DARK)
        outline = [(-.081,-.065),(.081,-.065),(.111,-.035),(.111,.035),
                   (.081,.065),(-.081,.065),(-.111,.035),(-.111,-.035)]
        tube(r,"visor_gasket",[(x+u,1.655+v,z+.173) for u,v in outline],.012,RUBBER,4,closed=True)
        for a,b in ((-.102,-.035),(-.035,.035),(.035,.102)):
            pane(r,"visor",[(x+u,1.655+v,z+.179+(.017 if abs(u)<.04 else 0))
                 for u,v in ((a,-.051),(b,-.051),(b,.051),(a,.051))],GLASS)
        for side in (-1,1):
            rod(r,"respirator_filter",(x+side*.112,1.577,z+.13),
                (x+side*.167,1.577,z+.13),.043,DARK,6)
            rod(r,"filter_cap",(x+side*.167,1.577,z+.13),
                (x+side*.178,1.577,z+.13),.034,STEEL,6)
        tube(r,"hood_seam",[(x-.125,1.48,z+.065),(x-.154,1.60,z+.064),
             (x-.12,1.754,z+.071),(x,1.812,z+.07),(x+.12,1.754,z+.071),
             (x+.154,1.60,z+.064),(x+.125,1.48,z+.065)],.008,DARK,3)
        tube(r,"hanger",[(x-.20,1.46,z-.06),(x,1.85,z-.06),
                          (x+.20,1.46,z-.06)],.016,STEEL,4)
        face(r, "sewn_pocket", x + 0.083, 1.31, z + 0.109, 0.088, 0.088, DARK)
        face(r, "id_patch", x + 0.083, 1.332, z + 0.110, 0.063, 0.021, WHITE)
        tube(r,"sealed_zipper",[(x,.84,z+.121),(x,1.03,z+.118),
             (x,1.28,z+.144),(x,1.47,z+.122)],.014,DARK,4)
        for y in (.94,1.04,1.14,1.24,1.34):
            face(r,"zipper_stitch",x,y,z+.154,.023,.009,STEEL)
        box(r,"zipper_pull",x,1.36,z+.16,.025,.040,.012,STEEL)
        for side in (-1,1):
            tube(r,"shoulder_tape",[(x+side*.09,1.48,z+.11),
                 (x+side*.17,1.39,z+.127),(x+side*.16,1.30,z+.13)],.011,DARK,3)
        # Three open lobes and central ring form a geometry-only biohazard badge.
        face(r,"hazard_patch",x-.085,1.28,z+.142,.106,.105,DARK)
        for lobe in range(3):
            angle=math.tau*lobe/3
            cx=x-.085+math.sin(angle)*.020
            cy=1.28+math.cos(angle)*.020
            points=[]
            for j in range(7):
                a=angle+.55+j*(math.tau-1.1)/6
                points.append((cx+math.sin(a)*.026,cy+math.cos(a)*.026,z+.147))
            tube(r,"biohazard_lobe",points,.0035,GOLD,3)
        ba._city_ring(r,"biohazard_center",(x-.085,1.28,z+.149),.011,
                      thickness=.003,mat=GOLD,segments=6)
        for s in (-1, 1):
            elbow = (x + s * 0.242, 1.19, z + 0.012)
            cuff = (x + s * 0.224, 1.00, z + 0.081)
            rod(r, "sleeve", (x + s * 0.148, 1.41, z), elbow, 0.080, GOLD, 5, 0.064)
            rod(r, "lower_sleeve", elbow, cuff, 0.068, GOLD, 5, 0.049)
            rod(r,"sealed_cuff",cuff,(cuff[0],.963,cuff[2]),.058,DARK,6)
            rod(r,"glove",(cuff[0],.963,cuff[2]),(x+s*.209,.907,z+.081),.048,RUBBER,6,.034)
            for finger in range(4):
                fx=x+s*.209+(finger-1.5)*.018
                tube(r,"glove_finger",[(fx,.919,z+.088),(fx,.865,z+.10),
                     (fx,.855,z+.121)],.010,RUBBER,3)
            tube(r,"glove_thumb",[(cuff[0]-s*.036,.946,z+.08),
                 (cuff[0]-s*.064,.913,z+.10),(cuff[0]-s*.05,.894,z+.12)],.015,RUBBER,4)
            for i in range(3):
                a=Vector(elbow).lerp(Vector(cuff),.05+i*.16)
                axis=(Vector(cuff)-Vector(elbow)).normalized()
                rod(r,"elbow_fold",a,a+axis*.014,.073-i*.004,GOLD,5)
                y=.52+i*.039
                drum(r,"knee_fold",x+s*.103,z-.014,y,y+.016,.084,GOLD,5)
            tube(r,"sleeve_seam",[(x+s*.18,1.40,z+.065),
                 (elbow[0],elbow[1],elbow[2]+.067),(cuff[0],1.02,cuff[2]+.05)],.006,DARK,3)
            rod(
                r,
                "trouser",
                (x + s * 0.084, 0.853, z),
                (x + s * 0.111, 0.376, z - 0.021),
                0.095,
                GOLD,
                4,
                0.066,
            )
            form(
                r,
                "boot",
                x + s * 0.11,
                z,
                [(0.244, 0.070, 0.104, 0.028), (0.32, 0.078, 0.107, 0.03), (0.42, 0.065, 0.063, -0.018)],
                RUBBER,
                4,
            )
            slab(r,"boot_sole",x+s*.11,.224,z+.028,.153,.034,.229,.024,DARK)
            for y in (.30,.35):
                face(r,"boot_rib",x+s*.11,y,z+.136,.105,.012,STEEL)
        drum(r,"back_air_bottle",x,-.19,.92,1.42,.085,STEEL,8,.068)
        drum(r,"pressure_tap",x,-.19,1.42,1.48,.036,DARK,6)
        for y in (1.02,1.30):
            drum(r,"tank_strap",x,-.19,y,y+.036,.090,DARK,8)
        tube(r,"air_supply",[(x,1.46,-.19),(x+.18,1.48,-.22),
             (x+.245,1.36,-.12),(x+.23,1.29,.02),(x+.17,1.44,.15),
             (x+.14,1.57,z+.13)],.018,INK,5)
        if index == 1:
            from mathutils import Matrix
            bpy.context.view_layer.update()
            pivot=ba._city_point((x,0,z))
            transform=Matrix.Translation(pivot) @ Matrix.Rotation(math.radians(-12),4,"Z") @ Matrix.Translation(-pivot)
            for obj in set(r.children)-before:
                obj.matrix_basis=transform @ obj.matrix_basis


def corkboard_evidence(r):
    panel(r, "frame", 0, 0.8, 0.055, 2.80, 1.60, 0.11, 0.035, STEEL)
    panel(r, "cork", 0, 0.80, 0.113, 2.70, 1.48, 0.014, 0.018, "mat_wood")
    box(r, "lamp_hood", 0, 1.546, 0.142, 2.61, 0.071, 0.074, DARK)
    face(r, "reading_light", 0, 1.531, 0.18, 2.46, 0.023, WHITE)
    # Each item has a separate pin position and a hand-placed angle.
    cards = [
        (-1.10, 1.17, 0.30, 0.32, -9),
        (-0.69, 1.26, 0.32, 0.27, 5),
        (-0.23, 1.16, 0.36, 0.39, -3),
        (0.24, 1.28, 0.26, 0.24, 7),
        (0.65, 1.14, 0.39, 0.32, -7),
        (1.09, 1.25, 0.29, 0.30, 3),
        (-0.99, 0.72, 0.36, 0.28, 4),
        (-0.50, 0.69, 0.27, 0.38, -5),
        (0.02, 0.74, 0.42, 0.31, 3),
        (0.49, 0.65, 0.32, 0.29, -9),
        (1.01, 0.73, 0.38, 0.34, 5),
        (-0.85, 0.29, 0.31, 0.24, -4),
        (-0.18, 0.26, 0.36, 0.25, 6),
        (0.72, 0.27, 0.39, 0.26, -6),
    ]
    pins = []
    for i, (x, y, w, h, angle) in enumerate(cards):
        a = math.radians(angle)

        def point(u, v, z):
            return (x + u * math.cos(a) - v * math.sin(a), y + u * math.sin(a) + v * math.cos(a), z)

        def card_piece(u, v, width, height, z, mat):
            pane(
                r,
                "dossier",
                [
                    point(u + sx * width / 2, v + sy * height / 2, z)
                    for sx, sy in [(-1, -1), (1, -1), (1, 1), (-1, 1)]
                ],
                mat,
            )

        card_piece(0, 0, w, h, 0.125, PAPER if i % 5 == 2 else "mat_snow")
        if i % 3 == 0:
            card_piece(0, 0.018, w * 0.85, h * 0.68, 0.130, DARK)
            # Contact prints of the capsule silhouette.
            card_piece(0, 0.02, w * 0.32, h * 0.46, 0.132, STEEL)
            card_piece(0, 0.024, w * 0.17, h * 0.29, 0.134, INK)
            card_piece(0, -h * 0.40, w * 0.52, 0.011, 0.132, DARK)
        elif i in (4, 8):
            print_on(r, MAP if i == 8 else "mat_label_warning", x, y, 0.131, w * 0.81, h * 0.77)
        else:
            for j in range(4):
                card_piece(
                    -0.015 + j % 2 * 0.020,
                    h * (0.28 - j * 0.17),
                    w * (0.60 if j % 2 else 0.76),
                    0.018 if j != 2 else 0.039,
                    0.132,
                    INK,
                )
        px, py, _ = point(0, h * 0.38, 0.145)
        pins.append((px, py))
        rod(r, "pushpin", (px, py, 0.141), (px, py, 0.164), 0.022, GOLD if i % 3 else GREEN, 6)
    for i, j, mat in [
        (0, 7, AMBER),
        (1, 2, GREEN),
        (2, 8, AMBER),
        (2, 4, AMBER),
        (3, 8, GREEN),
        (4, 10, GREEN),
        (5, 9, AMBER),
        (6, 2, GREEN),
        (7, 12, AMBER),
        (8, 11, GREEN),
        (9, 13, GREEN),
        (10, 12, AMBER),
        (12, 13, AMBER),
    ]:
        x, y = pins[i]
        tx, ty = pins[j]
        # Flat 1 cm thread stands out against the documents at gameplay distance.
        dx, dy = tx - x, ty - y
        n = math.hypot(dx, dy)
        u, v = -dy * 0.006 / n, dx * 0.006 / n
        pane(
            r,
            "evidence_thread",
            [(x - u, y - v, 0.15), (tx - u, ty - v, 0.15), (tx + u, ty + v, 0.15), (x + u, y + v, 0.15)],
            mat,
        )


def classified_cabinet(r):
    slab(r, "safe", 0, 0, -0.159, 1.60, 1.94, 0.532, 0.057, GRAPHITE)
    for col in range(2):
        x = (col - 0.5) * 0.76
        for row in range(5):
            open_drawer = col == 1 and row == 2
            y = 0.225 + row * 0.371
            z = 0.3845 if open_drawer else 0.1345
            if open_drawer:
                box(r, "drawer_bin", x, y - 0.105, 0.248, 0.69, 0.10, 0.29, DARK)
                for i in range(4):
                    box(
                        r,
                        "file_folder",
                        x,
                        y + 0.065 + i % 2 * 0.04,
                        0.212 + i * 0.045,
                        0.60,
                        0.24,
                        0.010,
                        PAPER if i % 2 else GOLD,
                    )
            box(r, "drawer", x, y, z, 0.72, 0.335, 0.056, STEEL)
            face(r, "label_holder", x, y + 0.064, z + 0.029, 0.28, 0.083, "mat_snow")
            face(r, "file_id", x, y + 0.064, z + 0.030, 0.17, 0.016, DARK)
            box(r, "pull", x, y - 0.047, z + 0.031, 0.28, 0.033, 0.019, DARK)
            face(r, "lock", x + 0.257, y - 0.045, z + 0.03, 0.035, 0.05, GOLD)
    for i in range(3):
        box(r, "binder", -0.42, 1.969 + i * 0.059, -0.08, 0.62, 0.056, 0.39, ENAMEL if i % 2 else DARK)
    box(r, "archive_carton", 0.385, 2.05, -0.09, 0.59, 0.22, 0.45, "mat_wood")
    box(r, "lid", 0.385, 2.18, -0.09, 0.63, 0.04, 0.49, GOLD)


def briefing_holotable(r):
    slab(r, "foot", 0, 0, 0, 2.73, 0.13, 1.57, 0.28, DARK)
    for s in (-1, 1):
        slab(r, "pedestal", s * 0.90, 0.13, 0, 0.62, 0.56, 1.28, 0.14, ALLOY)
        for i in range(4):
            face(r, "pedestal_vent", s * 0.90, 0.27 + i * 0.068, 0.641, 0.35, 0.027, INK)
    slab(r, "table_rim", 0, 0.68, 0, 3.2, 0.15, 2, 0.21, DARK)
    slab(r, "table_fascia", 0, 0.83, 0, 3.12, 0.045, 1.93, 0.20, STEEL)
    box(r, "map_bezel", 0, 0.884, 0.01, 2.16, 0.018, 1.36, AMBER)
    print_on(r, MAP, 0, 0.895, 0.01, 2.12, 1.32, "+y")
    for i, (x, z, w, d, h) in enumerate(
        [
            (-0.51, -0.22, 0.51, 0.32, 0.09),
            (0.11, -0.21, 0.47, 0.33, 0.10),
            (0.58, -0.20, 0.24, 0.32, 0.16),
            (-0.52, 0.20, 0.45, 0.32, 0.12),
            (0.04, 0.23, 0.39, 0.29, 0.105),
        ]
    ):
        slab(r, "site_massing", x, 0.899, z, w, h, d, 0.028, ALLOY)
        quad(r, "roof_index", (x, 0.900 + h, z), w * 0.72, 0.015, "+y", GOLD)
    for i in range(3):
        box(
            r,
            "folder",
            -1.245,
            0.884 + i * 0.015,
            0.25 - i * 0.024,
            0.37,
            0.014,
            0.46,
            "mat_snow" if i else GOLD,
        )
    box(r, "field_laptop", 1.21, 0.898, 0.17, 0.46, 0.046, 0.38, ENAMEL)
    screen(r, 1.21, 1.005, 0.019, 0.455, 0.19)
    for j in range(3):
        quad(r, "keyboard", (1.21, 0.923, 0.115 + j * 0.071), 0.34, 0.019, "+y", PAPER)


def chem_fume_hood(r):
    slab(r, "plinth", 0, 0, 0, 2.25, 0.12, 1, 0.08, DARK)
    slab(r, "cabinet", 0, 0.12, 0, 2.4, 0.79, 1.02, 0.08, ALLOY)
    for x in (-0.57, 0.57):
        panel(r, "access_door", x, 0.51, 0.517, 1.055, 0.62, 0.028, 0.047, STEEL)
        box(r, "latch", x + 0.34, 0.68, 0.537, 0.13, 0.03, 0.026, DARK)
    print_on(r, "mat_label_warning", -0.66, 0.50, 0.534, 0.33, 0.19)
    box(r, "work_surface", 0, 0.944, 0, 2.4, 0.068, 1.10, DARK)
    for x in (-1.135, 1.135):
        box(r, "pillar", x, 1.552, 0, 0.13, 1.15, 1.06, STEEL)
        face(r, "sash_scale", x, 1.50, 0.532, 0.033, 0.84, GOLD)
    box(r, "splashback", 0, 1.55, -0.51, 2.19, 1.15, 0.07, ALLOY)
    quad(r, "sash", (0, 1.552, 0.35), 2.17, 1.13, "+z", GLASS)
    for x in (-0.47, 0.47):
        rod(r, "port_flange", (x, 1.52, 0.338), (x, 1.52, 0.40), 0.175, STEEL, 12)
        rod(r, "glove_seal", (x, 1.52, 0.395), (x, 1.52, 0.419), 0.136, RUBBER, 10)
        tube(
            r,
            "gauntlet",
            [(x, 1.52, 0.37), (x, 1.42, 0.23), (x * 0.91, 1.36, 0.08), (x * 0.82, 1.30, 0.02)],
            0.076,
            RUBBER,
            6,
        )
    for i, x in enumerate((-0.76, -0.33, 0.17, 0.72)):
        h = 1.20 + i % 2 * 0.12
        form(
            r,
            "flask",
            x,
            -0.105,
            [
                (0.978, 0.106, 0.106, 0),
                (1.10, 0.133, 0.133, 0),
                (h, 0.049, 0.049, 0),
                (h + 0.12, 0.042, 0.042, 0),
            ],
            GLASS,
            6,
        )
        drum(r, "reagent", x, -0.105, 0.986, 1.096, 0.102, GREEN, 6, 0.112)
    for x, mat in ((-0.83, GOLD), (0.80, BLUE)):
        rod(r, "gas_valve", (x, 0.689, 0.523), (x, 0.689, 0.549), 0.071, mat, 7)
        face(r, "valve_index", x, 0.689, 0.550, 0.069, 0.016, INK)
    for i in range(5):
        face(r, "baffle_slot", 0, 1.85 + i * 0.038, -0.472, 1.51, 0.014, DARK)
    box(r, "diffuser", 0, 2.105, 0, 2.22, 0.04, 0.98, WHITE)
    slab(r, "extractor", 0, 2.124, 0, 2.4, 0.156, 1.10, 0.10, ALLOY)
    drum(r, "duct", 0, -0.08, 2.28, 2.4, 0.23, DARK, 12)


def centrifuge_bench(r):
    for x in (-1.39, 1.39):
        slab(r, "plinth", x, 0, 0, 0.34, 0.085, 0.96, 0.05, DARK)
        box(r, "end_support", x, 0.468, 0, 0.24, 0.77, 0.89, ALLOY)
    box(r, "service_spine", 0, 0.45, -0.22, 2.75, 0.35, 0.21, STEEL)
    slab(r, "epoxy_worktop", 0, 0.817, 0, 3.20, 0.103, 1.10, 0.085, ENAMEL)
    for x in (-1.42, 1.42):
        box(r, "shelf_stay", x, 1.16, -0.43, 0.066, 0.48, 0.08, STEEL)
    box(r, "service_bridge", 0, 1.411, -0.43, 2.99, 0.078, 0.17, ALLOY)
    box(r, "bench_light", 0, 1.364, -0.43, 2.67, 0.018, 0.11, WHITE)
    for x in (-0.99, -0.32):
        drum(r, "centrifuge", x, 0.06, 0.921, 1.11, 0.278, ALLOY, 12, 0.251)
        drum(r, "rotor", x, 0.06, 1.11, 1.14, 0.208, INK, 10)
        for i in range(6):
            a = math.tau * i / 6
            drum(
                r, "tube_cap", x + 0.134 * math.cos(a), 0.06 + 0.134 * math.sin(a), 1.14, 1.158, 0.029, GOLD, 5
            )
        drum(r, "rotor_lid", x, 0.06, 1.16, 1.203, 0.245, GLASS, 12, 0.18)
    box(r, "sample_holder", 0.34, 1.011, 0.16, 0.42, 0.036, 0.27, STEEL)
    for i in range(6):
        drum(
            r,
            "sample_tube",
            0.20 + (i % 3) * 0.14,
            0.095 + (i // 3) * 0.13,
            0.923,
            1.12 + i % 2 * 0.055,
            0.032,
            BLUE if i % 2 else GREEN,
            6,
        )
    box(r, "scope_base", 0.88, 0.971, 0.04, 0.39, 0.10, 0.34, DARK)
    tube(
        r,
        "microscope_arm",
        [(0.84, 1, 0.0), (0.81, 1.19, -0.06), (0.88, 1.29, -0.06), (1.008, 1.28, 0.033)],
        0.041,
        ALLOY,
        6,
    )
    rod(r, "objective", (1, 1.15, 0.09), (1.07, 1.38, 0.01), 0.045, DARK, 7)
    box(r, "stage", 0.97, 1.077, 0.078, 0.20, 0.025, 0.15, STEEL)
    screen(r, 1.20, 1.22, -0.33, 0.37, 0.22)


def prototype_weapon_rack(r):
    slab(r, "case_plinth", 0, 0, 0, 2.40, 0.24, 0.80, 0.095, DARK)
    slab(r, "lighting_canopy", 0, 2.00, 0, 2.4, 0.20, 0.8, 0.095, STEEL)
    box(r, "fixture_board", 0, 1.13, -0.337, 2.26, 1.82, 0.09, GRAPHITE)
    for x in (-1.12, 1.12):
        box(r, "stile", x, 1.11, 0, 0.13, 1.83, 0.67, ALLOY)
        box(r, "backlight", x * 0.9, 1.13, -0.259, 0.033, 1.70, 0.039, VIOLET)
    for i in range(11):
        for j in range(7):
            face(r, "peg_slot", (i - 5) * 0.166, 0.45 + j * 0.21, -0.29, 0.021, 0.04, DARK)
    for i in range(2):
        x = 0.15 * (-1) ** i
        y = 1.53 - i * 0.57
        for dx in (-0.45, 0.32):
            box(r, "saddle", x + dx, y - 0.09, -0.13, 0.052, 0.17, 0.26, GOLD)
        profile = [
            (-0.76, 0.07),
            (-0.52, 0.10),
            (-0.40, 0.04),
            (-0.24, 0.13),
            (0.28, 0.13),
            (0.42, 0.07),
            (0.55, 0.07),
            (0.55, -0.02),
            (0.13, -0.04),
            (0.065, -0.17),
            (-0.055, -0.16),
            (-0.04, -0.043),
            (-0.31, -0.043),
            (-0.49, 0.0),
            (-0.76, -0.11),
        ]
        prism(
            r,
            "inert_test_body",
            [(x + dx, y + dy) for dx, dy in profile],
            "z",
            -0.13,
            0.028,
            ENAMEL if i else STEEL,
        )
        rod(r, "emitter_core", (x + 0.26, y + 0.044, -0.05), (x + 0.81, y + 0.044, -0.05), 0.054, DARK, 8)
        for j in range(4):
            start = x + 0.38 + j * 0.095
            rod(
                r,
                "field_coil",
                (start, y + 0.044, -0.05),
                (start + 0.043, y + 0.044, -0.05),
                0.084,
                GOLD if i else VIOLET,
                8,
            )
        tube(
            r,
            "probe_lead",
            [
                (x - 0.14, y + 0.03, 0.035),
                (x - 0.17, y - 0.17, 0.083),
                (x - 0.34, y - 0.20, 0.09),
                (x - 0.40, y - 0.15, -0.28),
            ],
            0.020,
            INK,
            4,
        )
    for x, z in ((-0.55, 0.27), (0.55, 0.304)):
        quad(r, "slider", (x, 1.12, z), 1.10, 1.75, "+z", GLASS)
        box(r, "recess_pull", x * 0.22, 1.12, z + 0.014, 0.032, 0.24, 0.029, STEEL)
    box(r, "inspection_light", 0, 2.006, 0.22, 1.91, 0.025, 0.084, WHITE)


def anomaly_containment_pod(r):
    for name, y, h, rad, end, mat in [
        ("octagonal_base", 0, 0.25, 1.40, 1.40, DARK),
        ("lower_yoke", 0.25, 0.19, 1.38, 1.19, ALLOY),
        ("striped_collar", 0.44, 0.07, 1.18, 1.14, HAZARD),
        ("pole_piece", 0.51, 0.40, 0.58, 0.19, STEEL),
        ("top_yoke", 2.83, 0.23, 1.29, 1.40, ALLOY),
        ("cap", 3.06, 0.14, 1.40, 1.38, DARK),
        ("upper_pole", 2.46, 0.37, 0.18, 0.56, STEEL),
    ]:
        drum(r, name, 0, 0, y, y + h, rad, mat, 8, end)
    for i in range(4):
        a = math.tau * (i + 0.50) / 4

        def path(rad, y):
            return (rad * math.cos(a), y, rad * math.sin(a))

        tube(
            r,
            "field_arm",
            [
                path(0.93, 0.36),
                path(1.16, 0.64),
                path(1.28, 1.11),
                path(1.28, 2.17),
                path(1.15, 2.63),
                path(0.99, 2.88),
            ],
            0.105,
            STEEL,
            6,
        )
        for j in range(5):
            rod(
                r,
                "ceramic_winding",
                path(1.28, 1.17 + j * 0.18),
                path(1.28, 1.225 + j * 0.18),
                0.15,
                GOLD if j % 2 else DARK,
                6,
            )
    drum(r, "magnetic_shield", 0, 0, 0.5, 2.84, 1.02, GLASS, 12)
    form(
        r,
        "anomaly",
        0,
        0,
        [
            (1.10, 0.025, 0.025, 0.03),
            (1.51, 0.32, 0.26, -0.04),
            (1.78, 0.25, 0.22, 0.04),
            (2.14, 0.04, 0.035, 0.13),
        ],
        VIOLET,
        5,
    )
    for i in range(3):
        a = i * math.tau / 3
        x, z = 0.39 * math.cos(a), 0.39 * math.sin(a)
        form(
            r,
            "orbiting_shard",
            x,
            z,
            [(1.52, 0.012, 0.012, 0), (1.68, 0.074, 0.064, 0), (1.83, 0.018, 0.012, 0.04)],
            AMBER,
            4,
        )
    for y in (0.91, 2.43):
        drum(r, "electrode_lens", 0, 0, y, y + 0.035, 0.16, VIOLET, 8)


def cryo_server_rack(r):
    for y, h in ((0.09, 0.18), (2.19, 0.13)):
        slab(r, "rack_end", 0, y - h / 2, 0, 1.4, h, 1, 0.075, DARK)
    box(r, "back", 0, 1.13, -0.438, 1.32, 2.14, 0.105, ENAMEL)
    for s in (-1, 1):
        x = s * 0.658
        box(r, "side_panel", x, 1.15, 0, 0.071, 2.04, 0.91, DARK)
        box(r, "front_rail", x * 0.95, 1.16, 0.446, 0.058, 2.02, 0.065, STEEL)
        for j in range(7):
            quad(
                r,
                "side_louvre",
                (x + s * 0.036, 1.39 + j * 0.075, -0.025),
                0.59,
                0.030,
                "+x" if s > 0 else "-x",
                ALLOY,
            )
    for i in range(9):
        y = 0.31 + i * 0.207
        box(r, "processor_tray", 0, y, 0.081, 1.16, 0.176, 0.38, STEEL if i % 3 else ENAMEL)
        face(r, "air_intake", -0.055, y, 0.272, 0.61, 0.077, INK)
        for j in range(3):
            face(r, "activity", 0.30 + j * 0.077, y, 0.273, 0.043, 0.030, VIOLET if j != 1 else PAPER)
    for x in (-0.50, -0.39, 0.41, 0.52):
        tube(r, "coolant", [(x, 0.21, 0.20), (x, 0.28, 0.34), (x, 2.06, 0.34), (x, 2.16, 0.22)], 0.033, BLUE, 6)
        for y in (0.35, 2.02):
            drum(r, "compression_nut", x, 0.34, y, y + 0.056, 0.052, STEEL, 5)
    quad(r, "door_glass", (0, 1.15, 0.435), 1.19, 1.95, "+z", GLASS)
    box(r, "latch", 0.57, 1.11, 0.459, 0.041, 0.29, 0.052, ALLOY)
    box(r, "manifold_clip", 0, 2.326, -0.11, 0.99, 0.148, 0.091, DARK)
    for x in (-0.39, 0.39):
        tube(
            r,
            "roof_manifold",
            [(x, 2.24, -0.30), (x, 2.348, -0.25), (x, 2.348, 0.16), (x, 2.24, 0.23)],
            0.052,
            STEEL,
            8,
        )


def mainframe_console(r):
    # Faceted crescent: operator-facing bays follow the curved apron.
    outline = [
        (-1.50, -0.40),
        (-1.20, -0.70),
        (1.20, -0.70),
        (1.50, -0.40),
        (1.50, 0.51),
        (1.30, 0.70),
        (0.66, 0.52),
        (0, 0.46),
        (-0.66, 0.52),
        (-1.30, 0.70),
        (-1.50, 0.51),
    ]
    prism(r, "desktop", outline, "y", 0.79, 0.91, ALLOY)
    prism(r, "kick_panel", [(x * 0.91, z * 0.90) for x, z in outline], "y", 0.06, 0.79, DARK)
    prism(r, "plinth", [(x * 0.95, z * 0.94) for x, z in outline], "y", 0, 0.095, STEEL)
    for s in (-1, 1):
        panel(r, "service_hatch", s * 0.71, 0.45, 0.493, 0.49, 0.43, 0.026, 0.043, STEEL)
        for j in range(4):
            face(r, "cooling_slot", s * 0.71, 0.36 + j * 0.055, 0.507, 0.34, 0.024, INK)
        print_on(r, "mat_label_barcode", s * 0.71, 0.590, 0.507, 0.15, 0.055)
    for i, x in enumerate((-0.91, 0, 0.91)):
        z = -0.11 if i == 1 else -0.023
        box(r, "display_stand", x, 1.015, z - 0.10, 0.12, 0.21, 0.10, DARK)
        # The faceplate and print share the pivot at the foot of each tilted display.
        pitch = math.atan2(0.078, 0.344)
        profile = [(z, 1.006), (z - 0.078, 1.35), (z - 0.134, 1.335), (z - 0.058, 1.007)]
        prism(r, "display", profile, "x", x - 0.397, x + 0.397, ENAMEL)
        display = print_on(r, "mat_screen_lab_biomonitor" if i == 1 else STATUS, 0, 0, 0, 0.725, 0.291)
        display.rotation_euler.x = -pitch
        display.location = ba._city_point((x, 1.179, z - 0.036))
        if i == 1:
            standby = print_on(r, STATUS, 0, 0, 0, 0.725, 0.291)
            standby.rotation_euler.x = -pitch
            standby.location = ba._city_point((x, 1.179, z - 0.037))
        box(r, "keybed", x, 0.929, 0.25, 0.67, 0.038, 0.24, DARK)
        for row in range(3):
            for column in range(8):
                quad(
                    r,
                    "key",
                    (x + (column - 3.5) * 0.077, 0.949, 0.171 + row * 0.074),
                    0.061,
                    0.044,
                    "+y",
                    BLUE if column == 7 else (WHITE if row == 2 else ALLOY),
                )
    drum(r, "stop_collar", -1.33, 0.21, 0.913, 0.953, 0.096, GOLD, 10)
    drum(r, "stop_button", -1.33, 0.21, 0.953, 1.007, 0.063, AMBER, 10, 0.074)
    drum(r, "thermal_mug", 1.32, 0.26, 0.911, 1.19, 0.082, STEEL, 12, 0.087)
    drum(r, "lid", 1.32, 0.26, 1.19, 1.213, 0.09, DARK, 12)
    print_on(r, "mat_label_lab_mug", 1.32, 1.055, 0.344, 0.109, 0.11)
    tube(
        r,
        "mug_handle",
        [(1.385, 1.14, 0.26), (1.454, 1.14, 0.26), (1.454, 1.01, 0.26), (1.386, 1.001, 0.26)],
        0.015,
        DARK,
        5,
    )


def studio(root, output):
    for mat in bpy.data.materials:
        if not mat.name.startswith(("mat_screen_", "mat_label_")):
            continue
        is_screen = mat.name.startswith("mat_screen_")
        path = (
            REPO / "public/assets/textures" / ("screens" if is_screen else "labels") / (mat.name[4:] + ".webp")
        )
        if not path.is_file():
            # Match propPrints: the finished UV artwork will be loaded in stage C.
            shader = mat.node_tree.nodes.get("Principled BSDF")
            shader.inputs["Alpha"].default_value = 0
            continue
        nodes = mat.node_tree.nodes
        image = nodes.new("ShaderNodeTexImage")
        image.image = bpy.data.images.load(str(path))
        shader = nodes.get("Principled BSDF")
        mat.node_tree.links.new(image.outputs["Color"], shader.inputs["Base Color"])
        if is_screen:
            mat.node_tree.links.new(image.outputs["Color"], shader.inputs["Emission Color"])
            shader.inputs["Emission Strength"].default_value = 0.45
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x = scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.world = bpy.data.worlds.new("Studio")
    scene.world.use_nodes = True
    nodes = scene.world.node_tree.nodes
    mix = nodes.new("ShaderNodeMixRGB")
    mix.inputs[1].default_value = (0.23, 0.27, 0.37, 1)
    mix.inputs[2].default_value = (0.031, 0.045, 0.074, 1)
    scene.world.node_tree.links.new(nodes.new("ShaderNodeLightPath").outputs["Is Camera Ray"], mix.inputs[0])
    scene.world.node_tree.links.new(mix.outputs[0], nodes.get("Background").inputs["Color"])
    direction = {
        "lab_ceiling_strip": (0.45, -0.67, 1),
        "lab_ceiling_manifold": (0.78, -0.47, 1),
        "lab_briefing_holotable": (0.54, 0.77, 1),
        "lab_locker_bench": (0.45, 0.55, 1),
        "lab_corkboard_evidence": (0.13, 0.08, 1),
        "lab_catwalk_rail": (0.34, 0.27, 1),
        "lab_cocoon_tall": (0.21, 0.15, 1),
        "lab_cocoon_tall_cryo": (0.21, 0.15, 1),
        "lab_freight_elevator": (0.61, 0.19, 1),
    }.get(root.name, (0.35, 0.27, 1))
    camera = ba._preview_camera(scene, (0, 0, 0), ba._city_point(direction), 40)
    bpy.context.view_layer.update()
    rotation = camera.rotation_euler.to_quaternion()
    vertices = [
        rotation.inverted() @ (obj.matrix_world @ v.co) for obj in root.children for v in obj.data.vertices
    ]
    lo, hi = [Vector([func(p[i] for p in vertices) for i in range(3)]) for func in (min, max)]
    center = rotation @ ((lo + hi) / 2)
    span = max(hi.x - lo.x, hi.y - lo.y)
    camera.location += center
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = span * 1.15
    for xyz, power, scale, tint in [
        ((-1.7, 2.2, 2.6), 145, 1.9, (1, 0.92, 0.82)),
        ((1.9, 1.1, -1.5), 105, 1.3, (0.65, 0.79, 1)),
        ((1, 0.1, 2), 48, 1.5, (0.83, 0.89, 1)),
    ]:
        lamp = bpy.data.lights.new("softbox", "AREA")
        lamp.energy, lamp.shape, lamp.size, lamp.color = power * span**2, "DISK", scale * span, tint
        obj = bpy.data.objects.new("softbox", lamp)
        scene.collection.objects.link(obj)
        obj.location = center + ba._city_point(xyz) * span * 0.60
        obj.rotation_euler = (center - obj.location).to_track_quat("-Z", "Y").to_euler()
    output.parent.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)


DETAIL_BUDGETS = {
    "lab_cocoon_tall": 4500,
    "lab_cocoon_tall_cryo": 4500,
    "lab_cocoon_incubator": 2500,
    "lab_cocoon_breached": 3000,
    "lab_hazmat_suit_rack": 4500,
}


def export(builder, preview):
    name = "lab_" + builder.__name__
    ba.reset_scene()
    root = ba._port_root(name)
    materials()
    ba.PALETTE[WHITE] = ((*color("fff1d6"), 1), 0.8)
    ba.material(GLASS).use_backface_culling = False
    builder(root)
    finish_glazing(root)
    ba._port_merge(root, {})
    triangles = sum(len(p.vertices) - 2 for obj in root.children for p in obj.data.polygons)
    if name in DETAIL_BUDGETS and triangles > DETAIL_BUDGETS[name]:
        raise ValueError(f"{name}: {triangles} > {DETAIL_BUDGETS[name]} triangles")
    ba.export_glb(root, str(REPO / "public/assets/models/city" / (name + ".glb")), animations=False)
    print(f"[lab] {name}: {triangles} tri", flush=True)
    if preview:
        studio(root, REPO / "artifacts/models/lab" / (name + ".png"))
        if name in DETAIL_BUDGETS:
            scene = bpy.context.scene
            target, span = {
                "lab_cocoon_tall": ((0,2.35,.12),2.55),
                "lab_cocoon_tall_cryo": ((0,2.35,.12),2.55),
                "lab_cocoon_incubator": ((0,1.31,.05),1.12),
                "lab_cocoon_breached": ((0,2.35,0),3.4),
                "lab_hazmat_suit_rack": ((0,1.05,.04),1.84),
            }[name]
            camera = scene.camera
            direction = ba._city_point((.12,.06,1)).normalized()
            camera.location = ba._city_point(target) + direction*12
            camera.rotation_euler = (-direction).to_track_quat("-Z","Y").to_euler()
            camera.data.ortho_scale = span
            if name == "lab_hazmat_suit_rack":
                scene.render.resolution_x, scene.render.resolution_y = 512, 1280
            scene.render.filepath = str(REPO / "artifacts/models/lab" / (name + "_closeup.png"))
            bpy.ops.render.render(write_still=True)


BUILDERS = [
    cocoon_tall,
    cocoon_tall_cryo,
    cocoon_breached,
    cocoon_incubator,
    ceiling_manifold,
    freight_elevator,
    bio_scanner_gate,
    blast_door_frame,
    observation_window,
    security_desk,
    catwalk_rail,
    ceiling_strip,
    locker_bank,
    locker_bench,
    decon_shower,
    hazmat_suit_rack,
    corkboard_evidence,
    classified_cabinet,
    briefing_holotable,
    chem_fume_hood,
    centrifuge_bench,
    prototype_weapon_rack,
    anomaly_containment_pod,
    cryo_server_rack,
    mainframe_console,
]

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", nargs="+", choices=["lab_" + fn.__name__ for fn in BUILDERS])
    parser.add_argument("--no-preview", action="store_true")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else [])
    for builder in BUILDERS:
        if not args.only or "lab_" + builder.__name__ in args.only:
            export(builder, not args.no_preview)
