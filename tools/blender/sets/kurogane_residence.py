"""Willa Kuroyama: 38 modeli §4.1 run6. Metry glTF, Y-up, front +Z.

Budowa i kontrola budżetów: Blender -b --factory-startup -P ten_plik -- --no-preview.
Bez --no-preview powstają również studyjne PNG, jak w zestawach run3/run4.
"""

import argparse
import json
import math
import sys
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from kurogane_lab import (
    REPO, ba, bpy, Vector, box, slab, panel, pane, prism, rod, tube, beam,
    form, drum, quad, face, print_on, lettering, materials, color, finish_glazing, studio,
    STEEL, DARK, ALLOY, INK, ENAMEL, GOLD, WHITE, GLASS, GREEN, BLUE,
    AMBER, RUBBER, STATUS, MAP, VIOLET, PAPER,
)
from kurogane_office import controls
from construction_power import surface
from mathutils import Matrix

WOOD, FELT, LEAF, STONE = "mat_wood", "mat_fabric", "mat_paint", "mat_concrete"
RADAR, AUDIO = "mat_screen_res_radar", "mat_screen_res_audio_wave"


def ring(r, name, center, rx, ry, width, mat, axis="y", sides=12):
    x, y, z = center
    points = []
    for radius in (1, 1 - width / min(rx, ry)):
        for i in range(sides):
            a = math.tau * i / sides
            u, v = rx * radius * math.cos(a), ry * radius * math.sin(a)
            points.append((x + u, y, z + v) if axis == "y" else (x + u, y + v, z))
    return surface(r, name, points, [(i, (i+1) % sides, (i+1) % sides+sides, i+sides) for i in range(sides)], mat)


def feet(r, w, d, h, x=0, z=0):
    for sx in (-1, 1):
        for sz in (-1, 1):
            beam(r, "splayed_foot", (x+sx*w*.47, 0, z+sz*d*.47),
                 (x+sx*w*.40, h, z+sz*d*.40), .045, .055, STEEL)


def cushion(r, x, y, z, w, h, d):
    # Cztery przekroje tworzą wypukłą tapicerkę zamiast twardej płyty siedziska.
    cut = min(w, d)*.12
    outline = [(-w/2+cut,-d/2),(w/2-cut,-d/2),(w/2,-d/2+cut),
               (w/2,d/2-cut),(w/2-cut,d/2),(-w/2+cut,d/2),
               (-w/2,d/2-cut),(-w/2,-d/2+cut)]
    vertices = [(x+u*scale,y+height*h,z+v*scale)
                for height,scale in ((0,.94),(.25,1),(.65,1),(1,.88)) for u,v in outline]
    faces = [tuple(reversed(range(8))),tuple(range(24,32))]
    faces += [(row*8+i,row*8+(i+1)%8,(row+1)*8+(i+1)%8,(row+1)*8+i)
              for row in range(3) for i in range(8)]
    surface(r, "piped_cushion", vertices, faces, FELT)
    for s in (-1, 1):
        quad(r, "stitched_welt", (x, y+h+.001, z+s*d*.37), w*.75, .006, "+y", ALLOY)


def book(r, x, y, z, w, h, d, upright=False, mat=WOOD):
    box(r, "book_binding", x, y+h/2, z, w, h, d, mat)
    if upright:
        for dy in (.08, h-.06):
            face(r, "spine_gilding", x, y+dy, z+d/2+.001, w*.72, .012, GOLD)
    else:
        face(r, "page_edges", x, y+h*.5, z+d/2+.001, w*.94, h*.58, PAPER)


def screen(r, x, y, z, w, h, art=STATUS):
    panel(r, "screen_bezel", x, y, z-.02, w, h, .04, .025, DARK)
    face(r, "standby_glass", x, y, z+.001, w*.92, h*.86, INK)
    # UV druk pozostaje oddzielny: etap C dostarcza obrazy bez zmiany geometrii.
    print_on(r, art, x, y, z+.003, w*.91, h*.85)
    for i in range(4):
        face(r, "status_meter", x-w*.37+i*w*.15, y-h*.29, z+.002, w*.10, .012, GREEN if i<3 else AMBER)


def cabinet_frame(r, w, h, d, back=True):
    for x in (-w/2+.055, w/2-.055):
        box(r, "walnut_stile", x, h/2, 0, .11, h, d, WOOD)
    for y in (.07, h-.07):
        slab(r, "cabinet_cap", 0, y-.07, 0, w, .14, d, .035, ENAMEL)
    if back:
        box(r, "recessed_back", 0, h/2, -d/2+.025, w-.20, h-.20, .05, DARK)


def forest_glass_facade(r):
    for x in (-1.95, 1.95):
        box(r, "anodized_mullion", x, 2.4, 0, .10, 4.8, .28, STEEL)
        face(r, "pressure_bead", x, 2.4, .141, .025, 4.6, ENAMEL)
    box(r, "header", 0, 4.68, 0, 4, .24, .36, DARK)
    face(r, "concealed_header_led", 0, 4.58, .181, 3.8, .018, AMBER)
    face(r, "panoramic_glazing", 0, 2.40, 0, 3.90, 4.35, GLASS)
    box(r, "convector_trough", 0, .12, 0, 4, .24, .36, INK)
    for i in range(13):
        box(r, "walnut_convector_grille", (i-6)*.30, .245, 0, .065, .025, .34, WOOD)
    face(r, "floor_led", 0, .07, .181, 3.88, .014, WHITE)


def interior_door_frame(r):
    for s in (-1, 1):
        panel(r, "pocket_jamb", s*1.75, 1.8, 0, .5, 3.6, .28, .035, WOOD)
        box(r, "black_reveal", s*1.53, 1.6, .01, .06, 3.2, .24, DARK)
        face(r, "retracted_glass_leaf", s*1.67, 1.6, .142, .20, 3.1, GLASS)
        box(r, "flush_handle", s*1.59, 1.1, .13, .025, .38, .02, STEEL)
    box(r, "head_track", 0, 3.42, 0, 3.10, .36, .28, ENAMEL)
    face(r, "zone_indicator", 0, 3.45, .141, .8, .025, WHITE)


def glass_balustrade(r):
    slab(r, "base_channel", 0, 0, 0, 4, .15, .16, .02, ENAMEL)
    face(r, "recessed_led", 0, .07, .081, 3.88, .018, WHITE)
    for x in (-1, 1):
        face(r, "glass_panel", x, .61, 0, 1.98, .94, GLASS)
        for dx in (-.7, .7):
            box(r, "glass_clamp", x+dx, .18, 0, .07, .13, .08, STEEL)
    rod(r, "walnut_handrail", (-2, 1.06, 0), (2, 1.06, 0), .04, WOOD, 8)


def elevator_cab(r):
    for y, h in ((0, .12), (2.88, .12)):
        slab(r, "marble_deck", 0, y, 0, 2.6, h, 2.6, .06, ENAMEL)
    for s in (-1, 1):
        for z in (-1.23, 1.23):
            box(r, "brass_pier", s*1.23, 1.5, z, .14, 2.76, .14, GOLD)
        quad(r, "panoramic_side", (s*1.23, 1.5, 0), 2.4, 2.6, "+x", GLASS)
        box(r, "walnut_dado", s*1.22, .42, 0, .13, .52, 2.35, WOOD)
        rod(r, "handrail", (s*1.12, 1.0, -1.08), (s*1.12, 1.0, 1.08), .025, STEEL, 6)
        box(r, "door_lintel", 0, 2.8, s*1.23, 2.45, .14, .14, DARK)
        box(r, "threshold", 0, .125, s*1.23, 2.32, .01, .10, GOLD)
    quad(r, "ceiling_diffuser", (0, 2.875, 0), 2.2, 2.2, "-y", WHITE)
    before = set(r.children)
    controls(r, 0, 1.36, 0, .28)
    bpy.context.view_layer.update()
    transform = Matrix.Translation(ba._city_point((1.12, 0, -.9))) @ Matrix.Rotation(-math.pi/2, 4, "Z")
    for obj in set(r.children)-before:
        obj.matrix_world = transform @ obj.matrix_world


def elevator_shaft_door(r):
    for s in (-1, 1):
        panel(r, "concrete_jamb", s*1.35, 1.6, 0, .5, 3.2, .34, .04, STONE)
        box(r, "brass_reveal", s*1.12, 1.4, .1, .04, 2.8, .05, GOLD)
        leaf = ba.empty("door_left" if s<0 else "door_right")
        for x in (-.515, .515):
            box(leaf, "stile", x, 1.4, 0, .07, 2.8, .10, STEEL)
        for y in (.07, 2.73):
            box(leaf, "rail", 0, y, 0, 1.1, .14, .10, STEEL)
        face(leaf, "laminated_glass", 0, 1.4, 0, 1.03, 2.55, GLASS)
        face(leaf, "safety_band", 0, 1.2, .006, 1.03, .03, WHITE)
        finish_glazing(leaf)
        ba._port_merge(leaf, {})
        leaf.parent = r
        leaf.location.x = s*.55
    box(r, "header", 0, 3, 0, 2.2, .4, .34, ENAMEL)
    face(r, "floor_display", 0, 3, .171, .65, .20, INK)
    # Segmentowe B1: stan początkowy przystanku piwnicznego.
    lettering(r,"B1",0,2.93,.172,.18,AMBER)


def elevator_call_panel(r):
    slab(r, "foot", 0, 0, 0, .42, .07, .20, .03, ENAMEL)
    prism(r, "inclined_pylon", [(-.09,.07),(.09,.07),(.07,1.36),(.02,1.4),(-.08,1.4)], "x", -.19, .19, GOLD)
    controls(r, 0, 1.01, .074, .28)
    face(r, "vertical_inlay", 0, .35, .095, .018, .45, WOOD)


def fireplace_column(r):
    slab(r, "hearth", 0, 0, 0, 2.8, .55, 1.8, .12, ENAMEL)
    slab(r, "chimney", 0, 1.72, 0, 2.8, 7.88, 1.8, .12, STONE)
    for i in range(14):
        box(r, "fluted_chimney", (i-6.5)*.19, 5.68, .895, .035, 7.8, .01, DARK)
    box(r, "firebox_back", 0, 1.15, -.77, 2.55, 1.2, .10, DARK)
    face(r, "firebox_glass", 0, 1.14, .79, 2.50, 1.12, GLASS)
    for s in (-1, 1):
        quad(r, "side_glass", (s*1.27, 1.14, 0), 1.55, 1.12, "+x", GLASS)
    for i in range(6):
        x = (i-2.5)*.36
        rod(r, "charred_log", (x-.2,.64,-.25), (x+.2,.70,.27), .085, WOOD, 5)
        prism(r, "amber_flame", [(x-.09,.71),(x+.10,.73),(x+.06,1.0+i%3*.13),(x-.03,.94)], "z", -.06, .05, AMBER)
    face(r, "hearth_inlay", 0, .18, .901, 2.4, .025, GOLD)


def chandelier_linear(r):
    box(r, "ceiling_rose", 0, .425, 0, 2.8, .05, .18, DARK)
    for x in (-1.2, 1.2):
        rod(r, "suspension", (x,.12,0), (x,.4,0), .009, STEEL, 4)
    box(r, "brass_spine", 0, .10, 0, 3.6, .08, .07, GOLD)
    for x, rz in ((-1.15,.31),(0,.45),(1.15,.31)):
        ring(r, "metal_ellipse", (x,.04,0), .6, rz, .045, DARK)
        ring(r, "opal_diffuser", (x,.035,0), .57, rz-.025, .025, WHITE)
        ring(r, "amber_edge", (x,.045,0), .60, rz, .009, AMBER)


def recessed_led_strip(r):
    slab(r, "recess_housing", 0, .07, 0, 3, .18, .4, .045, DARK)
    box(r, "recess", 0, .05, 0, 2.88, .04, .31, INK)
    quad(r, "opal_diffuser", (0,0,0), 2.78, .24, "-y", WHITE)
    for x in (-1.35, 1.35):
        box(r, "retention_clip", x, .18, 0, .12, .14, .4, STEEL)


def indoor_pool_basin(r):
    for s in (-1, 1):
        slab(r, "marble_coping", s*2.8, 0, 0, .4, .45, 14, .06, ENAMEL)
        slab(r, "end_coping", 0, 0, s*6.8, 5.2, .45, .4, .06, ENAMEL)
        box(r, "blue_underwater_strip", s*2.58, .20, 0, .025, .03, 13.4, BLUE)
    box(r, "pool_floor", 0, .025, 0, 5.2, .05, 13.2, DARK)
    for x in (-1.3, 0, 1.3):
        quad(r, "lane_marking", (x,.055,0), .055, 11, "+y", WHITE)
    for i in range(3):
        box(r, "entry_step", 0, .10+i*.09, 5.15+i*.48, 4.9, .18, .48, STEEL)
    quad(r, "water_surface", (0,.32,0), 5.18, 13.18, "+y", GLASS)
    for i in range(8):
        quad(r, "water_ripple", ((i%3-1)*1.3,.321,-4+i*1.1), .9, .012, "+y", BLUE)


def pool_lounger(r):
    for x in (-.33, .33):
        prism(r, "bent_teak_runner", [(-1.05,.08),(-.96,.02),(-.67,.22),(.78,.22),(1.05,.08),(.98,.20),(.7,.34),(-.63,.34)], "x", x-.035, x+.035, WOOD)
    cushion(r, -.06, .34, .31, .74, .12, 1.42)
    prism(r, "reclined_back", [(-1.0,.74),(-.89,.82),(-.35,.49),(-.40,.38)], "x", -.43, .31, FELT)
    slab(r, "headrest", -.06, .75, -.88, .59, .10, .22, .05, FELT)
    slab(r, "towel_shelf", .37, .32, .1, .21, .04, .5, .025, WOOD)
    box(r, "folded_towel", .37, .38, .1, .18, .08, .35, PAPER)


def winter_garden_planter(r):
    slab(r, "marble_planter", 0, .05, 0, 2.6, .80, 1, .15, ENAMEL)
    box(r, "recessed_toe", 0, .04, 0, 2.3, .08, .76, DARK)
    quad(r, "soil", (0,.853,0), 2.35, .75, "+y", INK)
    face(r, "planter_led", 0, .17, .501, 2.28, .018, WHITE)
    for i in range(7):
        x, z = (i-3)*.33, .16 if i%2 else -.14
        top = 1.65-(i%3)*.09
        rod(r, "bamboo_stem", (x,.85,z), (x+.07,top,z), .017, WOOD, 5)
        for j in range(3):
            y = 1.0+j*.19
            side = (-1)**(i+j)
            pane(r, "lance_leaf", [(x,y,z),(x+side*.27,y+.14,z-.10),(x+side*.32,y+.12,z+.05),(x+.025,y+.02,z+.035)], LEAF)
        form(r, "pale_pebble", x, -z, [(.85,.10,.08,0),(.91,.07,.05,0)], PAPER, 5)


def biometric_arch(r):
    for s in (-1, 1):
        panel(r, "marble_scanner_pylon", s*1.475, 1.35, 0, .45, 2.7, 1.2, .10, ENAMEL)
        face(r, "brass_inlay", s*1.475, 1.35, .601, .028, 2.35, GOLD)
        screen(r, s*1.475, 1.55, .606, .30, .45)
        for y in (.6, 2.25):
            face(r, "scanner_window", s*1.475, y, .608, .22, .06, GREEN)
    slab(r, "scanner_bridge", 0, 2.43, 0, 2.6, .27, .84, .10, DARK)
    face(r, "scan_state", 0, 2.55, .425, .55, .035, AMBER)


def bonsai_pedestal(r):
    slab(r, "walnut_plinth", 0, 0, 0, 1.2, .90, 1.2, .15, WOOD)
    slab(r, "amber_reveal", 0, .90, 0, 1.25, .025, 1.25, .13, AMBER)
    slab(r, "bonsai_tray", 0, .925, 0, 1.6, .075, 1.6, .2, ENAMEL)
    for x in (-.42,-.21,0,.21,.42):
        face(r,"walnut_reeding",x,.46,.601,.009,.77,DARK)
    quad(r, "moss", (0,1.002,0), 1.35, 1.35, "+y", LEAF)
    tube(r, "twisted_trunk", [(0,1,0),(-.18,1.15,0),(-.05,1.35,.05),(.19,1.48,0),(.09,1.65,0)], .065, WOOD, 6)
    for x,z,y in ((-.5,.1,1.38),(.48,-.08,1.5),(-.12,-.4,1.58),(.1,.35,1.67)):
        rod(r, "bonsai_branch", (0,1.30,0), (x,y,z), .025, WOOD, 5)
        form(r, "cloud_pruned_foliage", x, z, [(y-.07,.25,.21,0),(y,.36,.28,0),(y+.08,.18,.17,0)], LEAF, 7)


def luxury_sofa_l(r):
    slab(r, "long_walnut_base", 0, .12, -.63, 3.8, .16, 1.14, .10, WOOD)
    slab(r, "chaise_base", -1.26, .12, .55, 1.28, .16, 1.3, .10, WOOD)
    for x,z in ((-1.65,-.95),(1.65,-.95),(1.65,-.15),(-1.65,.95),(-.8,.95)):
        box(r, "recessed_foot", x,.06,z,.07,.12,.07,STEEL)
    for x in (-1.25,0,1.25):
        cushion(r,x,.28,-.53,1.18,.23,.94)
        panel(r,"back_cushion",x,.72,-1.06,1.18,.46,.28,.075,FELT)
        face(r,"back_seam",x,.72,-.919,.012,.30,ALLOY)
    cushion(r,-1.26,.28,.60,1.18,.23,1.16)
    for x in (-1.77,1.77):
        slab(r,"padded_arm",x,.49,-.52,.26,.25,1.13,.075,FELT)
    for x in (-.68,.67):
        panel(r,"scatter_pillow",x,.66,-.78,.43,.39,.14,.09,FELT)
    face(r,"base_light",.1,.17,-.054,3.3,.018,WHITE)
    slab(r,"integrated_side_shelf",1.25,.55,-1.04,1.12,.035,.26,.04,WOOD)


def coffee_table_marble(r):
    slab(r,"recessed_plinth",0,0,0,1.8,.10,.85,.12,DARK)
    slab(r,"marble_base",0,.1,0,2.2,.18,1.2,.18,ENAMEL)
    slab(r,"amber_shadow_gap",0,.28,0,2.07,.018,1.07,.14,AMBER)
    slab(r,"floating_top",0,.298,0,2.2,.11,1.2,.18,ENAMEL)
    for points in (((-.9,.409,-.48),(-.63,.409,-.25),(-.51,.409,.15),(-.12,.409,.52)),
                   ((.02,.409,-.52),(.22,.409,-.31),(.16,.409,-.08),(.38,.409,.34))):
        for a,b in zip(points,points[1:]):
            beam(r,"marble_vein",a,b,.006,.002,ALLOY)
    book(r,-.55,.408,-.08,.55,.045,.40)
    book(r,-.48,.453,-.06,.50,.035,.36,mat=DARK)
    slab(r,"brass_tray",.55,.41,0,.60,.025,.47,.07,GOLD)
    form(r,"decanter",.55,0,[(.435,.10,.08,0),(.51,.09,.07,0),(.53,.035,.035,0),(.55,.035,.035,0)],GLASS,8)


def grand_piano_holo(r):
    outline=[(-1,-.90),(-.90,-1.12),(-.54,-1.3),(.20,-1.3),(.65,-1.08),(.96,-.7),(1.10,-.24),(1.1,.52),(-1,.52)]
    prism(r,"curved_concert_case",outline,"y",.68,.94,ENAMEL)
    prism(r,"brass_rim",[(x*.97,z*.97) for x,z in outline],"y",.942,.96,GOLD)
    prism(r,"soundboard",[(x*.91,z*.91) for x,z in outline],"y",.961,.969,WOOD)
    for i in range(13):
        x=-.70+i*.115
        quad(r,"lit_string",(x,.971,-.25),.008,1.2-abs(x)*.35,"+y",AMBER)
    for x,z in ((-.78,.22),(.88,.15),(-.10,-1.0)):
        beam(r,"tapered_piano_leg",(x*.92,0,z*.92),(x,.70,z),.08,.10,STEEL)
    box(r,"keybed",0,.78,.68,2.06,.12,.40,ENAMEL)
    for i in range(24):
        x=(i-11.5)*.078
        quad(r,"ivory_key",(x,.846,.68),.073,.33,"+y",PAPER)
        if i%7 not in (2,6):
            box(r,"black_key",x+.036,.866,.57,.035,.04,.13,INK)
    pane(r,"raised_glass_lid",[(x,.99+(x+1)*.22,z) for x,z in outline],GLASS)
    rod(r,"lid_prop",(.75,.97,-.25),(.75,1.38,-.25),.018,GOLD,5)
    face(r,"holographic_score",0,1.15,.27,.70,.28,GLASS)
    for i in range(5):
        face(r,"score_staff",0,1.08+i*.035,.275,.6,.005,AMBER)
    slab(r,"pianist_bench",0,.36,1.05,1.10,.12,.50,.06,FELT)
    feet(r,1,.42,.36,z=1.05)


def wall_art_triptych(r):
    for i in range(3):
        x=(i-1)*1.24
        panel(r,"black_frame",x,.9,0,1.12,1.8,.16,.025,STEEL)
        face(r,"canvas",x,.9,.081,1.0,1.66,INK)
        face(r,"backlit_upper_edge",x,1.75,.082,1.02,.018,WHITE)
        for j in range(5):
            px=x+(j-2)*.17
            h=.55+((j+i)%3)*.30
            pane(r,"abstract_conifer",[(px-.12,.30,.084),(px+.12,.30,.084),(px, .30+h,.084)],BLUE if (i+j)%3 else GOLD)
        if i==1:
            pane(r,"corporate_tower",[(x-.12,.27,.085),(x+.14,.27,.085),(x+.07,1.56,.085),(x-.04,1.45,.085)],ALLOY)
        ring(r,"moon",(x+.22,1.43,.086),.16,.16,.035,AMBER,"z",10)


def dining_table_long(r):
    for z in (-1.5,1.5):
        slab(r,"pedestal",0,0,z,.72,.74,.65,.12,ENAMEL)
        face(r,"brass_pedestal_inlay",0,.37,z+.326,.06,.57,GOLD)
    slab(r,"banquet_top",0,.74,0,1.45,.10,5.2,.16,WOOD)
    quad(r,"marble_runner",(0,.841,0),.42,4.95,"+y",ENAMEL)
    quad(r,"runner_led",(0,.842,0),.015,4.8,"+y",WHITE)
    for s in (-1,1):
        for i in range(5):
            z=(i-2)*.94
            box(r,"chair_seat",s*.79,.47,z,.42,.10,.52,FELT)
            box(r,"chair_back",s*.95,.79,z,.10,.52,.50,WOOD)
            for dz in (-.19,.19):
                box(r,"chair_sled",s*.79,.22,z+dz,.035,.44,.035,STEEL)
            ring(r,"dinner_plate",(s*.45,.845,z),.16,.16,.04,PAPER,sides=8)
            quad(r,"cutlery",(s*.45,.847,z+.23),.17,.018,"+y",GOLD)


def kitchen_island(r):
    slab(r,"island_toe",0,0,-.24,3.45,.13,.95,.08,DARK)
    slab(r,"marble_carcass",0,.13,-.24,3.65,.72,1.08,.06,ENAMEL)
    slab(r,"waterfall_worktop",0,.85,-.20,3.8,.10,1.2,.08,ENAMEL)
    for x in (-1.23,0,1.23):
        face(r,"drawer_gap",x,.51,.302,.018,.57,INK)
        box(r,"drawer_pull",x,.76,.32,.55,.025,.04,STEEL)
    quad(r,"induction_glass",(-.95,.952,-.2),1.2,.80,"+y",INK)
    for z in (-.4,.02):
        ring(r,"induction_zone",(-.95,.954,z),.21,.15,.012,AMBER,sides=10)
    slab(r,"sink_rim",.73,.95,-.2,.86,.015,.60,.08,STEEL)
    quad(r,"sink_well",(.73,.967,-.2),.72,.46,"+y",INK)
    tube(r,"mixer_tap",[(.73,.96,-.51),(.73,1.12,-.51),(.73,1.13,-.28),(.73,1.05,-.28)],.017,STEEL,5)
    box(r,"knife_block",1.47,1.0,-.25,.18,.1,.26,WOOD)
    for x in (1.43,1.50):
        box(r,"chef_handle",x,1.10,-.25,.035,.10,.035,DARK)
    for x in (-1.22,0,1.22):
        drum(r,"barstool_base",x,.53,0,.04,.22,STEEL,8)
        rod(r,"barstool_pedestal",(x,.04,.53),(x,.59,.53),.035,STEEL,6)
        slab(r,"barstool_seat",x,.59,.53,.47,.10,.54,.07,FELT)


def smart_fridge(r):
    cabinet_frame(r,1.6,2.2,.95)
    panel(r,"steel_door",.37,1.13,.43,.75,2.06,.09,.04,STEEL)
    face(r,"wine_glass",-.39,1.18,.46,.64,1.88,GLASS)
    for y in (.3,.65,1.0,1.35,1.70):
        box(r,"wine_shelf",-.39,y,0,.62,.04,.82,WOOD)
        for x in (-.56,-.23):
            rod(r,"wine_bottle",(x,y+.10,-.22),(x,y+.10,.22),.06,LEAF,5)
    face(r,"wine_led",-.72,1.18,.44,.018,1.85,AMBER)
    screen(r,.38,1.65,.482,.40,.58,"mat_screen_menu")
    panel(r,"ice_recess",.38,.87,.483,.40,.44,.012,.04,INK)
    face(r,"ice_indicator",.38,.98,.492,.20,.025,BLUE)
    box(r,"drip_tray",.38,.67,.49,.37,.025,.05,ALLOY)
    for x in (-.06,.06):
        box(r,"long_pull",x,1.2,.50,.025,.73,.035,GOLD)


def armored_limo(r):
    profile=[(-2.7,.38),(-2.7,.72),(-2.26,.96),(-1.22,1.02),(-.65,1.61),(.92,1.65),(1.65,1.05),(2.55,.91),(2.7,.65),(2.5,.35)]
    prism(r,"faceted_armored_body",profile,"z",-.98,.98,ENAMEL)
    for s in (-1,1):
        z=s*.985
        pane(r,"armored_side_window",[(-1.08,1.03,z),(-.59,1.53,z),(.82,1.55,z),(1.44,1.05,z)],GLASS)
        box(r,"window_pillar",.16,1.30,z,.09,.5,.03,STEEL)
        box(r,"rocker_armor",0,.47,s*1.01,4.7,.12,.12,STEEL)
        for x in (-.45,.95):
            box(r,"flush_door_handle",x,.91,s*1.025,.20,.025,.025,GOLD)
        for x in (-1.72,1.78):
            rod(r,"armored_tyre",(x,.43,s*.86),(x,.43,s*1.15),.43,RUBBER,12)
            rod(r,"aero_wheel_hub",(x,.43,s*1.151),(x,.43,s*1.154),.26,STEEL,10)
            for i in range(5):
                a=i*math.tau/5
                beam(r,"wheel_spoke",(x,.43,s*1.156),(x+.21*math.cos(a),.43+.21*math.sin(a),s*1.156),.035,.025,GOLD)
    pane(r,"windshield",[(.92,1.64,-.87),(.92,1.64,.87),(1.65,1.06,.88),(1.65,1.06,-.88)],GLASS)
    pane(r,"rear_window",[(-.66,1.59,-.87),(-.66,1.59,.87),(-1.22,1.03,.87),(-1.22,1.03,-.87)],GLASS)
    for s,mat in ((-1,AMBER),(1,WHITE)):
        quad(r,"light_signature",(s*2.665,.68,0),1.60,.045,"+x",mat)
        box(r,"bumper",s*2.61,.42,0,.09,.12,1.75,DARK)
    for i in range(5):
        quad(r,"front_intake",(2.702,.50+i*.028,0),1.0,.012,"+x",STEEL)


def garage_tool_wall(r):
    cabinet_frame(r,3.4,2.2,.45)
    slab(r,"diagnostic_bench",0,.90,0,3.4,.08,.45,.025,STEEL)
    for x in (-1.1,0,1.1):
        panel(r,"drawer_front",x,.49,.21,1.04,.68,.035,.03,ALLOY)
        box(r,"drawer_handle",x,.71,.24,.46,.025,.025,DARK)
    for i in range(12):
        for j in range(3):
            face(r,"peg_hole",(i-5.5)*.25,1.15+j*.28,-.194,.022,.022,INK)
    for i in range(6):
        x=-1.3+i*.27
        box(r,"spanner",x,1.52,-.14,.035,.36,.028,STEEL)
        for s in (-1,1):
            box(r,"spanner_jaw",x+s*.045,1.72,-.14,.025,.09,.028,GOLD)
    screen(r,.95,1.6,-.10,.91,.64)
    box(r,"charge_socket",1.35,.95,.06,.30,.10,.28,DARK)
    tube(r,"coiled_charge_lead",[(1.4,.95,.15),(1.55,.74,.18),(1.36,.35,.17),(1.06,.4,.17),(.98,.7,.17)],.019,INK,5)


def investigation_board_iskra(r):
    panel(r,"walnut_frame",0,.9,0,3.2,1.8,.22,.045,WOOD)
    face(r,"evidence_backing",0,.9,.111,3.03,1.63,DARK)
    box(r,"task_light",0,1.76,.10,2.9,.03,.03,WHITE)
    print_on(r,MAP,-.20,.91,.115,1.05,.88)
    print_on(r,"mat_screen_iskra_board",-.20,.91,.117,1.05,.88)
    positions=[(-1.14,1.28),(-1.10,.48),(.92,1.29),(1.11,.50),(.17,.32)]
    for i,(x,y) in enumerate(positions):
        face(r,"evidence_card",x,y,.12,.43,.49,PAPER)
        face(r,"portrait_background",x,y+.06,.122,.34,.29,INK)
        # Fizyczne portrety-sylwetki pozostają czytelne przed etapem tekstur.
        form_obj = [(x-.10,y-.04,.124),(x+.10,y-.04,.124),(x+.07,y+.06,.124),(x-.07,y+.06,.124)]
        pane(r,"portrait_shoulders",form_obj,ALLOY)
        ring(r,"portrait_head",(x,y+.13,.125),.055,.065,.052,ALLOY,"z",8)
        lettering(r,("WOLAN","MIRA","KURIER","SZRON","BAJT")[i],x,y-.21,.128,.058,INK)
        rod(r,"brass_pin",(x,y+.22,.12),(x,y+.22,.15),.018,GOLD,5)
        target=(-.2+(i%2)*.25,.9,.15)
        rod(r,"evidence_thread",(x,y+.22,.15),target,.006,(AMBER,WHITE,GREEN)[i%3],4)
    lettering(r,"ISKRA",-.20,1.52,.128,.12,WHITE)


def colonel_desk(r):
    slab(r,"cantilever_foot",-.85,0,0,.86,.12,1.20,.10,ENAMEL)
    prism(r,"angled_monolithic_support",[(-1.17,.12),(-.62,.12),(-.3,.72),(-.86,.72)],"z",-.50,.50,STONE)
    slab(r,"walnut_desktop",0,.72,0,3,.12,1.35,.14,WOOD)
    face(r,"amber_desk_seam",0,.77,.676,2.65,.016,AMBER)
    box(r,"brass_return_leg",1.20,.36,-.32,.06,.72,.52,GOLD)
    for i in (-1,0,1):
        x=i*.64
        box(r,"monitor_stalk",x,.88,-.36,.045,.12,.045,STEEL)
        screen(r,x,1.0,-.36+abs(i)*.10,.60,.30,RADAR)
    book(r,-1.06,.84,.2,.47,.035,.35,mat=DARK)
    book(r,-1.01,.875,.2,.43,.025,.32,mat=WOOD)
    drum(r,"colonel_mug",1.05,.35,.84,1.03,.075,STEEL,8)
    ring(r,"mug_handle",(1.15,.94,.35),.055,.06,.018,GOLD,"z",8)
    print_on(r,"mat_label_residence_mug",1.05,.93,.426,.09,.10)
    slab(r,"dagger_display",.65,.84,.1,.38,.04,.20,.03,ENAMEL)
    prism(r,"ceremonial_dagger",[(.50,.91),(.73,.91),(.88,.94),(.73,.96),(.5,.96)],"z",.07,.09,STEEL)
    box(r,"dagger_grip",.44,.935,.08,.12,.045,.045,WOOD)


def bookshelf_wall(r):
    cabinet_frame(r,3.2,2.8,.75,False)
    for y in (.35,1.13,1.91,2.65):
        box(r,"shelf",0,y,0,3,.06,.69,WOOD)
        face(r,"shelf_led",0,y-.032,.28,2.84,.014,WHITE)
    for x in (-.55,.55):
        box(r,"vertical_divider",x,1.5,0,.045,2.3,.67,DARK)
    for row in range(3):
        for i in range(9):
            if (row==1 and i in (3,4)) or (row==2 and i==7):
                continue
            x=(i-4)*.32
            book(r,x,.39+row*.78,0,.20,.46+(i%3)*.07,.48,True,(WOOD,FELT,DARK)[(i+row)%3])
    form(r,"library_artifact",-.15,0,[(1.17,.12,.12,0),(1.35,.20,.15,0),(1.58,.07,.07,0)],GOLD,6)


def holo_globe_stand(r):
    form(r,"octagonal_pedestal",0,0,[(0,.55,.55,0),(.12,.7,.7,0),(.48,.45,.45,0),(.60,.54,.54,0)],ENAMEL,8)
    ring(r,"projector_ring",(0,.61,0),.49,.49,.035,GOLD,sides=12)
    for y,rad in ((.78,.35),(1.1,.50),(1.42,.35)):
        ring(r,"latitude",(0,y,0),rad,rad,.012,AMBER,sides=16)
    for i in range(4):
        obj=ring(r,"meridian",(0,1.1,0),.50,.50,.012,BLUE,"z",16)
        obj.rotation_euler.z=i*math.pi/4
    for i in range(8):
        a=i*math.tau/8
        box(r,"city_sector",.39*math.cos(a),1.1,.39*math.sin(a),.045,.12+(i%3)*.035,.045,AMBER)


def trophy_case_tall(r):
    cabinet_frame(r,2.4,2.4,.85)
    for y in (.36,1.05,1.72):
        box(r,"velvet_shelf",0,y,0,2.17,.06,.70,FELT)
        face(r,"museum_light",0,y-.033,.34,2.08,.012,VIOLET)
    face(r,"glass_front",0,1.37,.40,2.16,1.90,GLASS)
    for x in (-1.07,1.07):
        box(r,"brass_glazing_bead",x,1.4,.41,.025,1.92,.02,GOLD)
    # Historyczna broń jako nieruchomy eksponat z oddzielnym stojakiem.
    box(r,"rifle_receiver",-.12,1.30,.10,.63,.14,.12,ALLOY)
    rod(r,"rifle_barrel",(.19,1.32,.10),(.85,1.32,.10),.025,STEEL,6)
    prism(r,"rifle_stock",[(-.85,1.25),(-.85,1.43),(-.43,1.36),(-.43,1.27)],"z",.04,.16,WOOD)
    box(r,"rifle_grip",0,1.17,.10,.10,.18,.10,DARK)
    prism(r,"rifle_magazine",[(.12,1.26),(.26,1.26),(.29,1.08),(.18,1.04)],"z",.07,.14,DARK)
    rod(r,"rifle_scope",(-.26,1.43,.1),(.12,1.43,.1),.035,STEEL,6)
    for x in (-.55,.55):
        rod(r,"display_support",(x,1.08,.10),(x,1.25,.10),.02,GOLD,5)
    form(r,"historic_helmet",-.45,0,[(1.75,.22,.20,0),(2.04,.24,.21,0),(2.15,.12,.12,0)],ALLOY,8)
    panel(r,"helmet_brow",-.45,1.97,.207,.35,.055,.018,.012,DARK)
    panel(r,"helmet_face_guard",-.45,1.84,.205,.22,.13,.025,.035,ENAMEL)
    for i in range(3):
        x=.2+i*.24
        pane(r,"medal_ribbon",[(x-.05,2.08,.1),(x+.05,2.08,.1),(x,1.91,.1)],FELT)
        ring(r,"medal",(x,1.87,.11),.065,.065,.055,GOLD,"z",6)
    slab(r,"blade_pedestal",0,.40,0,1.1,.08,.42,.06,ENAMEL)
    rod(r,"plasmaBlade_hilt",(-.30,.56,0),(.28,.56,0),.047,STEEL,8)


def armor_display_stand(r):
    slab(r,"display_plinth",0,0,0,1.6,.15,1.2,.16,ENAMEL)
    face(r,"plinth_amber",0,.09,.601,1.25,.025,AMBER)
    rod(r,"mannequin_spine",(0,.15,0),(0,2.1,0),.04,STEEL,6)
    for s in (-1,1):
        form(r,"parade_boot",s*.22,.05,[(.15,.14,.24,0),(.38,.13,.17,-.04)],DARK,6)
        form(r,"shin_guard",s*.22,0,[(.40,.12,.12,0),(.84,.16,.14,0)],ALLOY,6)
        form(r,"thigh_plate",s*.22,0,[(.90,.16,.14,0),(1.20,.18,.17,0)],ENAMEL,6)
        form(r,"pauldron",s*.47,0,[(1.55,.18,.20,0),(1.78,.24,.22,0),(1.87,.14,.16,0)],GOLD,6)
        form(r,"vambrace",s*.55,0,[(1.12,.11,.12,0),(1.55,.13,.16,0)],ALLOY,6)
    form(r,"faceted_breastplate",0,0,[(1.18,.22,.18,0),(1.62,.38,.23,0),(1.85,.28,.19,0)],ENAMEL,8)
    pane(r,"chest_chevron",[(-.25,1.68,.205),(0,1.53,.245),(.25,1.68,.205),(0,1.61,.245)],GOLD)
    form(r,"visored_parade_helmet",0,0,[(1.92,.20,.19,0),(2.22,.22,.22,0),(2.35,.11,.12,0)],STEEL,8)
    face(r,"sealed_faceplate",0,2.10,.222,.29,.17,ENAMEL)
    face(r,"gold_brow",0,2.22,.222,.30,.025,GOLD)


def master_bed_king(r):
    slab(r,"hidden_foot",0,0,0,1.9,.18,1.9,.10,DARK)
    slab(r,"floating_walnut_frame",0,.18,0,2.8,.14,2.6,.12,WOOD)
    face(r,"underbed_led",0,.22,1.301,2.55,.020,WHITE)
    cushion(r,0,.32,.13,2.16,.26,2.14)
    panel(r,"walnut_headboard",0,.75,-1.17,2.8,1.0,.26,.09,WOOD)
    for x in (-.70,0,.70):
        panel(r,"tufted_headboard_panel",x,.90,-1.01,.65,.58,.08,.055,FELT)
        face(r,"headboard_seam",x,.90,-.969,.009,.43,ALLOY)
    for x in (-.55,.55):
        cushion(r,x,.58,-.56,.89,.14,.52)
    slab(r,"folded_duvet",0,.58,.50,2.12,.065,1.14,.05,FELT)
    for x in (-.65,0,.65):
        quad(r,"duvet_stitch",(x,.646,.50),.009,1.02,"+y",ALLOY)
    for x in (-1.22,1.22):
        slab(r,"bedside_drawer",x,.38,-.82,.35,.15,.54,.04,ENAMEL)
        face(r,"drawer_pull",x,.47,-.549,.14,.012,GOLD)
        rod(r,"reading_stem",(x,.54,-.92),(x,.87,-.92),.015,STEEL,5)
        form(r,"reading_shade",x,-.92,[(.86,.10,.10,0),(.96,.06,.06,0)],AMBER,6)


def wardrobe_glass(r):
    cabinet_frame(r,3.2,2.4,.85)
    box(r,"shelf_divider",.60,1.2,0,.08,2.14,.70,WOOD)
    rod(r,"clothing_rail",(-1.42,2.10,0),(.48,2.10,0),.025,GOLD,6)
    for i in range(5):
        x=-1.22+i*.35
        pane(r,"coat_hanger",[(x-.15,1.98,0),(x,2.08,0),(x+.15,1.98,0)],GOLD)
        prism(r,"tailored_uniform",[(x-.14,1.98),(x+.14,1.98),(x+.18,1.75),(x+.13,.60),(x-.13,.60),(x-.18,1.75)],"z",-.06,.10,FELT if i%2 else ENAMEL)
        face(r,"uniform_lapel",x,1.75,.101,.028,.35,GOLD)
    for y in (.38,.98,1.58):
        box(r,"accessory_shelf",1.05,y,0,.9,.05,.7,WOOD)
        face(r,"shelf_led",1.05,y+.04,-.30,.83,.015,WHITE)
        for x in (.83,1.22):
            slab(r,"shoe_or_watch_box",x,y+.03,.02,.23,.11,.40,.05,DARK)
    for x in (-.8,.8):
        face(r,"glass_door",x,1.2,.402,1.52,2.15,GLASS)
    for x in (-.045,.045):
        box(r,"door_pull",x,1.2,.421,.018,.5,.025,GOLD)


def sauna_cabin(r):
    cabinet_frame(r,2.8,2.4,2.2)
    for i in range(14):
        box(r,"cedar_back_batten",(i-6.5)*.19,1.2,-1.04,.17,2.15,.04,WOOD)
    for y,z,d in ((.35,.40,.52),(.75,-.30,.72)):
        for j in range(5):
            box(r,"cedar_bench_slat",0,y,z+(j-2)*d/5,2.25,.06,d/5-.012,WOOD)
        box(r,"bench_apron",0,y-.13,z-d*.42,2.25,.20,.05,DARK)
        face(r,"bench_underglow",0,y-.09,z+d*.48,2.12,.015,AMBER)
    face(r,"sauna_glazing",0,1.2,1.07,2.55,2.15,GLASS)
    box(r,"glass_door_stile",.50,1.2,1.08,.025,2.15,.03,GOLD)
    box(r,"cedar_door_pull",.63,1.15,1.10,.04,.43,.04,WOOD)
    form(r,"sauna_heater",-.88,.71,[(.14,.24,.24,0),(.64,.23,.23,0)],DARK,6)
    for i in range(4):
        form(r,"basalt_stone",-.88+(i%2-.5)*.17,.71+(i//2-.5)*.17,[(.64,.11,.10,0),(.75,.08,.07,0)],ALLOY,5)


def interrogation_chair(r):
    slab(r,"bolted_base",0,0,0,1.25,.12,1.35,.12,ALLOY)
    for x in (-.49,.49):
        for z in (-.54,.54):
            drum(r,"anchor_bolt",x,z,.12,.15,.035,STEEL,6)
    prism(r,"raked_support",[(-.35,.12),(.20,.12),(.35,.55),(-.25,.60)],"x",-.19,.19,STEEL)
    cushion(r,0,.53,.12,.64,.12,.65)
    prism(r,"reclined_leather_back",[(-.45,.62),(-.64,1.24),(-.52,1.28),(-.30,.67)],"x",-.33,.33,RUBBER)
    panel(r,"padded_headrest",0,1.34,-.57,.40,.22,.14,.05,RUBBER)
    for s in (-1,1):
        box(r,"arm_support",s*.44,.60,.03,.045,.50,.045,STEEL)
        slab(r,"arm_pad",s*.44,.83,.08,.20,.06,.65,.04,RUBBER)
        box(r,"wrist_band",s*.44,.89,.25,.20,.035,.12,WOOD)
        box(r,"brass_buckle",s*.49,.913,.25,.055,.012,.09,GOLD)
        box(r,"ankle_band",s*.20,.23,.50,.18,.04,.11,WOOD)
        rod(r,"head_sensor_arm",(s*.32,1.2,-.55),(s*.30,1.43,-.40),.018,STEEL,5)
        box(r,"temple_pad",s*.27,1.40,-.4,.07,.08,.08,RUBBER)
    screen(r,.45,1.04,-.32,.34,.24)
    tube(r,"neural_lead",[(.30,1.4,-.42),(.52,1.18,-.50),(.54,.4,-.44),(.2,.2,-.22)],.013,INK,5)


def instrument_trolley(r):
    for x in (-.58,.58):
        for z in (-.26,.26):
            rod(r,"castor",(x-.035,.075,z),(x+.035,.075,z),.075,RUBBER,8)
            box(r,"trolley_post",x,.43,z,.035,.72,.035,STEEL)
    for y in (.24,.77):
        slab(r,"rolled_tray",0,y,0,1.28,.035,.70,.06,STEEL)
        for z in (-.33,.33):
            box(r,"tray_raised_lip",0,y+.04,z,1.20,.05,.02,ALLOY)
    book(r,-.3,.81,-.04,.40,.045,.35,mat=WOOD)
    box(r,"folded_towel",-.22,.29,0,.55,.10,.40,PAPER)
    for i in range(3):
        x=.05+i*.16
        rod(r,"diagnostic_probe",(x,.82,-.17),(x,.82,.14),.012,STEEL,5)
    for x in (.45,.51):
        box(r,"tuning_fork_prong",x,.83,.07,.012,.018,.20,GOLD)
    box(r,"tuning_fork_stem",.48,.83,-.09,.018,.018,.16,GOLD)
    tube(r,"lamp_arm",[(.62,.4,-.28),(.68,.96,-.28),(.37,1.03,-.14)],.016,STEEL,5)
    slab(r,"task_lamp",.28,1.01,-.12,.32,.04,.22,.05,DARK)
    quad(r,"task_diffuser",(.28,1.008,-.12),.27,.17,"-y",WHITE)
    rod(r,"sealed_sample",(.12,.83,.25),(.36,.83,.25),.023,GREEN,6)


def holding_cage_bars(r):
    # Skrzydło otwarte o 180° leży na kracie; przejście 1,25 m mieści się w AABB.
    for x in (-1.95,.6,1.95):
        box(r,"cell_frame",x,1.7,0,.10,3.4,.22,ALLOY)
    for y in (.07,3.33):
        box(r,"frame_rail",0,y,0,4,.14,.22,STEEL)
    for i in range(14):
        x=-1.82+i*.18
        box(r,"vertical_bar",x,1.70,-.025,.032,3.13,.035,STEEL)
    for y in (.17,3.18):
        box(r,"open_leaf_rail",-.025,y,.065,1.25,.07,.06,DARK)
    for x in (-.65,.60):
        box(r,"open_leaf_stile",x,1.675,.065,.045,3.08,.06,DARK)
    for i in range(6):
        box(r,"open_leaf_bar",-.52+i*.18,1.675,.065,.025,2.98,.025,STEEL)
    for y in (.4,2.95):
        rod(r,"cell_hinge",(.60,y-.08,.065),(.60,y+.08,.065),.04,GOLD,6)
    panel(r,"magnetic_lock",.51,1.42,.08,.15,.30,.05,.02,DARK)
    face(r,"lock_state",.51,1.45,.108,.06,.07,AMBER)


def recording_console(r):
    feet(r,2.2,.75,.72)
    slab(r,"recording_worktop",0,.72,0,2.4,.10,.90,.08,ALLOY)
    panel(r,"recorder_chassis",-.68,1.03,-.13,.90,.44,.30,.035,ENAMEL)
    for x in (-.92,-.45):
        rod(r,"reel_disc",(x,1.07,.03),(x,1.07,.055),.16,STEEL,10)
        ring(r,"tape_reel",(x,1.07,.056),.13,.13,.04,WOOD,"z",10)
        for i in range(3):
            a=i*math.tau/3
            face(r,"reel_hole",x+.085*math.cos(a),1.07+.085*math.sin(a),.057,.035,.035,INK)
    face(r,"magnetic_tape",-.68,.98,.059,.43,.009,INK)
    screen(r,.32,1.03,-.10,.72,.43,AUDIO)
    for i in range(5):
        box(r,"mixing_fader",-.2+i*.17,.838,.27,.03,.022,.14,STEEL)
    tube(r,"gooseneck_mic",[(.97,.82,.12),(.97,1.04,.12),(.8,1.18,.12)],.018,STEEL,5)
    rod(r,"microphone_capsule",(.80,1.18,.12),(.70,1.2,.12),.035,INK,8)
    for i in range(3):
        book(r,.9,.82+i*.045,-.25,.33,.04,.23,mat=DARK)


def wine_rack_wall(r):
    cabinet_frame(r,3.2,2.8,.65)
    for y in (.82,1.16,1.50,1.84,2.18,2.52):
        box(r,"bottle_shelf",0,y,0,2.98,.035,.58,WOOD)
        face(r,"cellar_led",0,y-.02,-.28,2.87,.012,AMBER)
    # 126 pełnych sylwetek denek: schowane korpusy w gęstym regale nie potrzebują ścian.
    for row in range(6):
        for col in range(21):
            x,y=(col-10)*.138,.94+row*.34
            pane(r,"recessed_bottle_base",[(x+.055*math.cos(i*math.tau/6),y+.065*math.sin(i*math.tau/6),.305) for i in range(6)],LEAF)
    for x in (-.83,.83):
        # Poziome beczki, każda z wielobocznym klepkowym profilem.
        rod(r,"oak_barrel",(x,.40,-.23),(x,.40,.23),.32,WOOD,8)
        ring(r,"barrel_hoop",(x,.40,.235),.30,.30,.03,STEEL,"z",8)
        for dx in (-.12,0,.12):
            face(r,"barrel_end_stave",x+dx,.40,.236,.009,.48,INK)


def cctv_monitor_wall(r):
    box(r,"video_wall_mount",0,1.2,-.06,4,2.4,.13,STEEL)
    for row in range(3):
        for col in range(3):
            screen(r,(col-1)*1.31,.42+row*.78,.08,1.24,.70,RADAR if (col+row)%2 else STATUS)


# Wymiary i budżety są dosłownym kontraktem §4.1, nie zależą od kamery podglądu.
CATALOG = {
    forest_glass_facade: ((4,4.8,.36),380,(.45,.3,1)),
    interior_door_frame: ((4,3.6,.28),420,(.45,.3,1)),
    glass_balustrade: ((4,1.1,.16),260,(.4,.3,1)),
    elevator_cab: ((2.6,3,2.6),860,(.6,.28,1)),
    elevator_shaft_door: ((3.2,3.2,.34),480,(.35,.2,1)),
    elevator_call_panel: ((.42,1.4,.2),320,(.5,.3,1)),
    fireplace_column: ((2.8,9.6,1.8),940,(.65,.23,1)),
    chandelier_linear: ((3.6,.45,.9),380,(.4,-.8,1)),
    recessed_led_strip: ((3,.25,.4),180,(.4,-.8,1)),
    indoor_pool_basin: ((6,.45,14),680,(.7,1,1)),
    pool_lounger: ((.95,.85,2.1),420,(.85,.65,1)),
    winter_garden_planter: ((2.6,1.65,1),760,(.6,.4,1)),
    biometric_arch: ((3.4,2.7,1.2),520,(.6,.3,1)),
    bonsai_pedestal: ((1.6,1.75,1.6),820,(.6,.4,1)),
    luxury_sofa_l: ((3.8,.95,2.4),780,(.65,.75,1)),
    coffee_table_marble: ((2.2,.55,1.2),360,(.55,.7,1)),
    grand_piano_holo: ((2.2,1.45,2.6),980,(.75,.7,1)),
    wall_art_triptych: ((3.6,1.8,.16),340,(.20,.15,1)),
    dining_table_long: ((2,1.05,5.2),1120,(.7,.8,1)),
    kitchen_island: ((3.8,1.15,1.6),860,(.7,.7,1)),
    smart_fridge: ((1.6,2.2,.95),620,(.6,.35,1)),
    armored_limo: ((5.4,1.65,2.3),1240,(1,.6,1)),
    garage_tool_wall: ((3.4,2.2,.45),680,(.4,.25,1)),
    investigation_board_iskra: ((3.2,1.8,.22),740,(.15,.12,1)),
    colonel_desk: ((3,1.15,1.35),880,(.55,.65,1)),
    bookshelf_wall: ((3.2,2.8,.75),760,(.5,.3,1)),
    holo_globe_stand: ((1.4,1.6,1.4),640,(.5,.4,1)),
    trophy_case_tall: ((2.4,2.4,.85),840,(.4,.25,1)),
    armor_display_stand: ((1.6,2.35,1.2),960,(.5,.3,1)),
    master_bed_king: ((2.8,1.25,2.6),680,(.65,.70,1)),
    wardrobe_glass: ((3.2,2.4,.85),740,(.4,.25,1)),
    sauna_cabin: ((2.8,2.4,2.2),820,(.55,.4,1)),
    interrogation_chair: ((1.25,1.45,1.35),960,(.6,.4,1)),
    instrument_trolley: ((1.4,1.05,.75),720,(.6,.6,1)),
    holding_cage_bars: ((4,3.4,.22),540,(.4,.2,1)),
    recording_console: ((2.4,1.25,.9),780,(.5,.45,1)),
    wine_rack_wall: ((3.2,2.8,.65),880,(.4,.25,1)),
    cctv_monitor_wall: ((4,2.4,.25),440,(.25,.18,1)),
}


def fit_dimensions(root, size):
    """Zastosuj końcowe metry do geometrii; root i grupy drzwi zachowują skalę 1."""
    bpy.context.view_layer.update()
    meshes = [o for o in root.children_recursive if o.type == "MESH"]
    points = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
    lo = Vector(tuple(min(p[i] for p in points) for i in range(3)))
    hi = Vector(tuple(max(p[i] for p in points) for i in range(3)))
    span = hi-lo
    target = Vector((size[0],size[2],size[1]))
    origin = Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
    for obj in meshes:
        inv = obj.matrix_world.inverted()
        for vertex in obj.data.vertices:
            p = obj.matrix_world @ vertex.co-origin
            vertex.co = inv @ Vector(tuple(p[i]*target[i]/span[i] for i in range(3)))


def export(builder, preview):
    name = "res_"+builder.__name__
    ba.reset_scene()
    root = ba._port_root(name)
    materials()
    palette = {WOOD:"594532",FELT:"323c50",LEAF:"385846",ENAMEL:"20252e",GOLD:"b19458",STONE:"56606b",WHITE:"fff1d6"}
    for mat,tint in palette.items():
        ba.PALETTE[mat] = ((*color(tint),1), .8 if mat==WHITE else None)
        shader = ba.material(mat).node_tree.nodes.get("Principled BSDF")
        shader.inputs["Base Color"].default_value = (*color(tint),1)
        if mat==WHITE:
            shader.inputs["Emission Color"].default_value = (*color(tint),1)
            shader.inputs["Emission Strength"].default_value = .8
    ba.material(GLASS).use_backface_culling = False
    builder(root)
    size,limit,direction = CATALOG[builder]
    groups = [o for o in root.children if o.type=="EMPTY"]
    for group in groups:
        group.parent = None
    finish_glazing(root)
    ba._port_merge(root,{})
    for group in groups:
        group.parent = root
    fit_dimensions(root,size)
    triangles = sum(len(p.vertices)-2 for o in root.children_recursive if o.type=="MESH" for p in o.data.polygons)
    if triangles>limit:
        raise ValueError(f"{name}: {triangles} > {limit} tri")
    output = REPO/"public/assets/models/city"/(name+".glb")
    ba.export_glb(root,str(output),animations=False)
    print(f"[residence] {name}: {triangles} tri, {output.stat().st_size} bytes",flush=True)
    if preview:
        bpy.context.view_layer.update()
        for group in groups:
            for child in list(group.children):
                world = child.matrix_world.copy()
                child.parent = root
                child.matrix_world = world
            bpy.data.objects.remove(group,do_unlink=True)
        def view(xyz):
            return (-ba._city_point(xyz)).to_track_quat("-Z","Y")
        root.rotation_mode = "QUATERNION"
        root.rotation_quaternion = view((.35,.27,1)) @ view(direction).inverted()
        studio(root,REPO/"artifacts/models/residence"/(name+".png"))
    return {"model":name,"triangles":triangles,"bytes":output.stat().st_size,"size":size,"budget":limit}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--only",nargs="+",choices=["res_"+b.__name__ for b in CATALOG])
    parser.add_argument("--no-preview",action="store_true")
    opts = parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    report = []
    for builder in CATALOG:
        if not opts.only or "res_"+builder.__name__ in opts.only:
            report.append(export(builder,not opts.no_preview))
    if not opts.only:
        target = REPO/"artifacts/models/residence/manifest.json"
        target.parent.mkdir(parents=True,exist_ok=True)
        target.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
