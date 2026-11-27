"""Kurogane Fusion: 30 modeli §6.1 run8. Metry glTF, Y-up, przód +Z.

Blender -b --factory-startup --python-exit-code 1 -P ten_plik -- --write-bounds
--only fus_<nazwa> ogranicza eksport; --no-preview pomija studio Cycles.
"""

import argparse
import json
import math
import re
import sys
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from kurogane_residence import ring, fit_dimensions
from kurogane_lab import (
    REPO, ba, bpy, Vector, box, slab, panel, prism, rod,
    beam, form, drum, quad, face, print_on, materials, color, finish_glazing,
    studio, stripe, STEEL, DARK, ALLOY, INK, ENAMEL, GOLD, WHITE, GLASS,
    GREEN, BLUE, AMBER, VIOLET, PAPER, STATUS,
)
from construction_power import surface

TOKAMAK = "mat_screen_fus_tokamak"
GRID = "mat_screen_fus_grid"
TRITIUM = "mat_screen_fus_tritium"
ALERT = "mat_screen_fus_iskra_alert"
CLOTH, PAINT, HAZARD = "mat_fabric", "mat_paint", "mat_hazard"


def tube(r, name, points, radius, mat, sides=8):
    """Transportowana baza przekroju zapobiega skręceniu przy pionowych kolanach."""
    pts = [Vector(p) for p in points]
    vertices = []
    across = None
    for i, point in enumerate(pts):
        tangent = (pts[min(i+1,len(pts)-1)]-pts[max(0,i-1)]).normalized()
        if across is None:
            axis = Vector((1,0,0)) if abs(tangent.x)<.9 else Vector((0,0,1))
            across = (axis-tangent*axis.dot(tangent)).normalized()
        else:
            across = (across-tangent*across.dot(tangent)).normalized()
        up = tangent.cross(across)
        for j in range(sides):
            a=j*math.tau/sides
            vertices.append(tuple(point+radius*(across*math.cos(a)+up*math.sin(a))))
    faces = [tuple(reversed(range(sides))),tuple(range((len(pts)-1)*sides,len(pts)*sides))]
    faces += [(i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j)
              for i in range(len(pts)-1) for j in range(sides)]
    return surface(r,name,vertices,faces,mat)


def palette():
    materials()
    for mat, tint in {
        STEEL: "727d8a", ALLOY: "454f61", ENAMEL: "242d3b",
        GOLD: "d08a1c", PAPER: "c9d2d6", PAINT: "3d5968",
        CLOTH: "4a566e", HAZARD: "d09b32", WHITE: "fff1d6",
    }.items():
        rgb = (*color(tint), 1)
        ba.PALETTE[mat] = (rgb, .8 if mat == WHITE else None)
        shader = ba.material(mat).node_tree.nodes.get("Principled BSDF")
        shader.inputs["Base Color"].default_value = rgb
        if mat == WHITE:
            shader.inputs["Emission Color"].default_value = rgb
            shader.inputs["Emission Strength"].default_value = .8
    ba.material(GLASS).use_backface_culling = False


def hazard(r, x, y, z, w, h, count=8):
    face(r, "warning_band", x, y, z, w, h, HAZARD)
    for i in range(count):
        stripe(r, x + (i-(count-1)/2)*w/count, y, z+.001,
               w/count*.72, h*.95, INK)


def screen(r, x, y, z, w, h, art=TOKAMAK):
    panel(r, "bezel", x, y, z-.025, w, h, .05, .025, DARK)
    face(r, "standby_screen", x, y, z+.001, w*.92, h*.86, INK)
    # Fizyczne wskaźniki zostają pod UV i są czytelne przed dostawą tekstur.
    for i in range(4):
        face(r, "telemetry_bar", x-w*.32+i*w*.19, y-h*.15,
             z+.002, w*.10, h*(.12+i*.06), BLUE if i%2 else AMBER)
    print_on(r, art, x, y, z+.004, w*.91, h*.85)


def gauge(r, x, y, z, radius=.14):
    rod(r, "gauge_rim", (x,y,z-.035), (x,y,z), radius, STEEL, 8)
    rod(r, "gauge_dial", (x,y,z), (x,y,z+.004), radius*.8, PAPER, 8)
    beam(r, "gauge_pointer", (x,y,z+.008),
         (x+radius*.4,y+radius*.45,z+.008), .018, .008, INK)


def valve(r, x, y, z, radius=.23):
    rod(r, "valve_stem", (x,y,z-.12), (x,y,z), .045, STEEL, 6)
    ring(r, "valve_wheel", (x,y,z), radius, radius, .035, GOLD, "z", 10)
    for a in (0, math.tau/3, 2*math.tau/3):
        beam(r, "wheel_spoke", (x,y,z),
             (x+radius*math.cos(a),y+radius*math.sin(a),z), .026,.025,GOLD)


def frame(r, w, h, d, mat=STEEL):
    for x in (-w/2+.07,w/2-.07):
        for z in (-d/2+.07,d/2-.07):
            box(r,"corner_post",x,h/2,z,.14,h,.14,mat)
    for y in (.07,h-.07):
        slab(r,"frame_cap",0,y-.07,0,w,.14,d,.05,mat)


def vents(r, x, y, z, w, h, count=5):
    for i in range(count):
        face(r,"cooling_louver",x,y+(i-(count-1)/2)*h/count,z,w,h/count*.35,INK)


def catwalk_deck(r):
    for z in (-1.88,1.88):
        box(r,"beam_web",0,.19,z,4,.32,.10,STEEL)
        for y in (.035,.34):
            box(r,"beam_flange",0,y,z,4,.07,.24,ENAMEL)
    for x in (-1.88,1.88):
        box(r,"edge_joist",x,.20,0,.24,.40,3.52,STEEL)
    for i in range(13):
        box(r,"open_grate_bar",(i-6)*.285,.35,0,.06,.08,3.5,STEEL)
    for z in (-1.45,-.72,0,.72,1.45):
        box(r,"grate_crossbar",0,.31,z,3.52,.06,.055,ALLOY)
    hazard(r,0,.22,2.001,3.6,.12,12)
    face(r,"underside_led",0,.075,2.002,3.4,.025,WHITE)


def catwalk_railing(r):
    for x in (-1.94,0,1.94):
        beam(r,"raked_stanchion",(x,0,-.035),(x,1.06,.025),.07,.10,STEEL)
        box(r,"anchor_shoe",x,.035,0,.12,.07,.18,DARK)
    panel(r,"toe_kick",0,.11,0,4,.22,.06,.025,GOLD)
    face(r,"lower_glass",0,.46,0,3.83,.48,GLASS)
    box(r,"mid_rail",0,.71,0,4,.055,.07,STEEL)
    panel(r,"handrail",0,1.055,.025,4,.09,.14,.025,ENAMEL)
    face(r,"handrail_led",0,1.055,.096,3.78,.018,AMBER)
    hazard(r,0,.10,.031,3.8,.07,12)


def ceiling_coffer_bay(r):
    for x in (-2.8,2.8):
        box(r,"coffer_side",x,.325,0,.4,.65,6,"mat_concrete")
    for z in (-2.8,2.8):
        box(r,"coffer_end",0,.325,z,5.2,.65,.4,"mat_concrete")
    for x in (-1.28,1.28):
        for z in (-1.28,1.28):
            slab(r,"recessed_light_case",x,.30,z,2.3,.13,2.3,.12,DARK)
            quad(r,"ceiling_diffuser",(x,.295,z),2.08,1.45,"-y",WHITE)
    for x in (-2,-1,0,1,2):
        box(r,"acoustic_fin",x,.18,0,.06,.23,5.2,STEEL)
    box(r,"cross_spine",0,.2,0,5.2,.20,.12,STEEL)
    for z in (-2.59,2.59):
        quad(r,"amber_reveal",(0,.07,z),4.9,.025,"-y",AMBER)


def blast_door_frame(r):
    for s in (-1,1):
        panel(r,"armored_jamb",s*1.79,1.9,0,.42,3.8,.36,.055,STEEL)
        panel(r,"retracted_leaf",s*1.65,1.65,.075,.16,3.3,.16,.035,ENAMEL)
        for y in (.45,1.55,2.65):
            box(r,"locking_dog",s*1.70,y,.17,.22,.17,.02,GOLD)
    panel(r,"pressure_header",0,3.55,0,3.2,.50,.36,.06,ALLOY)
    face(r,"pressure_display",0,3.55,.181,.78,.16,INK)
    for i in range(5):
        face(r,"pressure_segment",(i-2)*.12,3.55,.183,.08,.06,GREEN)
    hazard(r,0,3.34,.181,2.9,.07,12)


def shield_wall_panel(r):
    box(r,"shield_back",0,2.4,-.125,4,4.8,.10,DARK)
    for x in (-1.03,1.03):
        for y in (1.22,3.58):
            panel(r,"lead_steel_cassette",x,y,.025,1.85,2.26,.30,.16,STEEL)
            face(r,"inspection_slot",x,y+.63,.176,1.2,.055,INK)
            face(r,"inspection_led",x,y+.63,.178,.70,.018,AMBER)
    for x in (-1.95,0,1.95):
        box(r,"vertical_cooling_channel",x,2.4,.06,.06,4.7,.14,ALLOY)


def coolant_pipe_arch(r):
    for z in (-2,2):
        slab(r,"pipe_foot",0,0,z,1.6,.16,.8,.09,ENAMEL)
        drum(r,"vacuum_jacket",0,z,.16,3.4,.36,PAPER,8)
        for y in (.50,2.9,3.3):
            drum(r,"clamp",0,z,y,y+.10,.40,STEEL,8)
        drum(r,"cryo_band",0,z,1.75,1.80,.365,BLUE,8)
        gauge(r,.34,1.2,z+.20,.16)
    tube(r,"overhead_coolant_elbow",[(0,3.1,-2),(0,3.6,-2),(0,3.90,-1.85),
         (0,4.05,-1.5),(0,4.05,1.5),(0,3.90,1.85),(0,3.6,2),(0,3.1,2)],.36,STEEL,8)


def wall_pipe_manifold(r):
    for y in (.16,3.44):
        box(r,"mounting_rail",0,y,-.20,4,.22,.15,DARK)
    for x in (-1.35,0,1.35):
        rod(r,"pressure_riser",(x,.05,-.04),(x,3.55,-.04),.13,STEEL,8)
        for y in (.6,2.7):
            drum(r,"pipe_collar",x,-.04,y,y+.08,.17,PAINT,8)
        valve(r,x,1.35,.20,.24)
        face(r,"digital_flow_meter",x,2.1,.15,.24,.16,INK)
        face(r,"flow_value",x,2.1,.152,.17,.04,GREEN)


def wall_power_busbar(r):
    box(r,"insulated_backplate",0,2.1,-.15,4,4.2,.15,ENAMEL)
    for x in (-1.35,0,1.35):
        box(r,"copper_bus",x,2.1,0,.22,4.0,.10,GOLD)
        for y in (.5,2.1,3.7):
            panel(r,"ceramic_insulator",x,y,-.04,.54,.18,.16,.04,PAPER)
        face(r,"polycarbonate_guard",x,2.1,.22,.76,3.94,GLASS)
        face(r,"load_indicator",x,3.15,.10,.06,.62,AMBER if x else VIOLET)
    for y in (.08,4.12):
        box(r,"guard_rail",0,y,.16,4,.16,.12,STEEL)


def overhead_cable_tray(r):
    for z in (-.56,.56):
        box(r,"tray_channel",0,.14,z,6,.28,.08,STEEL)
    for x in (-2.6,-1.3,0,1.3,2.6):
        box(r,"tray_rung",x,.045,0,.08,.09,1.04,STEEL)
    for z in (-.36,-.12,.12,.36):
        rod(r,"superconducting_cable",(-3,.23,z),(3,.23,z),.075,INK,6)
    for x in (-2.5,2.5):
        for z in (-.55,.55):
            box(r,"suspension_rod",x,.54,z,.04,.62,.04,STEEL)
        box(r,"ceiling_attachment",x,.82,0,.18,.06,1.2,ENAMEL)
        face(r,"circuit_tag",x,.16,.601,.28,.075,BLUE)


def highbay_light_strip(r):
    slab(r,"light_housing",0,.12,0,4,.19,.65,.07,ENAMEL)
    quad(r,"large_diffuser",(0,.08,0),3.72,.44,"-y",WHITE)
    for x in (-1.75,-1.25,-.75,-.25,.25,.75,1.25,1.75):
        box(r,"cooling_fin",x,.23,0,.045,.24,.60,STEEL)
    for x in (-1.4,1.4):
        box(r,"mounting_clip",x,.325,0,.18,.05,.64,DARK)
    for z in (-.28,.28):
        box(r,"lens_guard",0,.04,z,3.85,.08,.035,STEEL)


def cryopump_unit(r):
    frame(r,2.8,2.6,1.8)
    for x in (-.68,.68):
        form(r,"cryo_cylinder",x,0,[(.22,.39,.49,0),(.38,.49,.55,0),
             (2.08,.49,.55,0),(2.25,.36,.40,0)],PAPER,10)
        for y in (.45,1.93):
            drum(r,"jacket_band",x,0,y,y+.10,.55,ALLOY,10)
        face(r,"coolant_sight",x,1.25,.553,.09,.72,BLUE)
        tube(r,"pump_outlet",[(x,2.25,0),(x,2.40,0),(x,2.40,-.66)],.08,STEEL,6)
    screen(r,0,.65,.91,.72,.42,STATUS)
    hazard(r,0,.12,.901,2.5,.09)


def capacitor_bank(r):
    frame(r,3.6,2.8,1.6)
    box(r,"shield_back",0,1.4,-.71,3.3,2.5,.06,ENAMEL)
    for x in (-1.28,-.43,.43,1.28):
        drum(r,"dielectric_can",x,0,.24,2.22,.32,ALLOY,8)
        for y in (.33,1.95):
            drum(r,"retaining_band",x,0,y,y+.08,.34,GOLD,8)
        drum(r,"ceramic_bushing",x,0,2.22,2.52,.13,PAPER,6)
        face(r,"charge_window",x,1.22,.323,.045,.85,VIOLET)
    box(r,"top_bus",0,2.54,0,2.7,.065,.08,GOLD)
    hazard(r,0,.13,.801,3.3,.10,12)
    face(r,"charge_status",0,2.69,.801,1.10,.035,AMBER)


def pulse_transformer(r):
    slab(r,"transformer_skid",0,0,0,2.4,.18,2,.10,STEEL)
    panel(r,"oil_tank",0,.91,0,1.7,1.45,1.50,.12,PAINT)
    for x in (-1.02,1.02):
        for z in (-.60,-.36,-.12,.12,.36,.60):
            box(r,"radiator_fin",x,.91,z,.30,1.25,.07,ALLOY)
    for x in (-.55,0,.55):
        drum(r,"hv_bushing",x,0,1.64,2.2,.10,PAPER,6)
        for y in (1.77,1.96):
            drum(r,"bushing_shed",x,0,y,y+.05,.17,PAPER,6)
    hazard(r,0,.80,.751,.95,.28,5)
    face(r,"load_lamp",0,1.35,.752,.48,.03,AMBER)
    gauge(r,.50,1.12,.78,.12)


def console_body(r,w,d):
    for x in (-w*.36,w*.36):
        panel(r,"console_pedestal",x,.39,-d*.12,w*.17,.78,d*.60,.06,ALLOY)
        vents(r,x,.36,d*.181,w*.11,.32,4)
    prism(r,"sloped_instrument_deck",[(-d*.5,.76),(-d*.5,.92),
          (-d*.25,.82),(d*.5,.82),(d*.5,.76)],"x",-w/2,w/2,ENAMEL)
    face(r,"front_edge_light",0,.79,d*.5+.001,w*.88,.018,WHITE)


def diagnostic_console(r):
    console_body(r,2.6,1.1)
    for x in (-.60,.60):
        screen(r,x,1.06,-.16,1.02,.36)
        rod(r,"monitor_stalk",(x,.82,-.19),(x,.91,-.19),.025,STEEL,6)
        for i in range(3):
            quad(r,"backlit_key_row",(x,.823,.37-i*.06),.73,.015,"+y",PAPER)
    ring(r,"cup_holder",(1.13,.824,.32),.10,.10,.022,STEEL,sides=10)
    quad(r,"input_indicator",(-.98,.824,.44),.18,.015,"+y",AMBER)


def junction_box(r):
    panel(r,"armored_case",0,.575,0,1.6,1.15,.85,.10,ALLOY)
    panel(r,"access_door",0,.60,.43,1.39,.87,.025,.05,ENAMEL)
    hazard(r,0,.22,.446,1.25,.12,7)
    for x in (-.64,.64):
        for y in (.38,.91):
            box(r,"door_hinge",x,y,.46,.08,.16,.04,STEEL)
    panel(r,"isolator_backplate",-.30,.68,.45,.35,.36,.035,.03,GOLD)
    beam(r,"emergency_lever",(-.30,.57,.48),(-.30,.83,.53),.07,.055,INK)
    for x,mat in ((.18,GREEN),(.42,AMBER)):
        rod(r,"status_lamp",(x,.80,.45),(x,.80,.48),.055,mat,8)
    vents(r,.31,.52,.448,.30,.18,3)


def control_window_wall(r):
    panel(r,"shielded_sill",0,.525,0,5,1.05,.36,.08,ENAMEL)
    for x in (-2.41,2.41):
        beam(r,"anti_glare_mullion",(x,1.05,.06),(x,4.4,-.06),.18,.22,STEEL)
    box(r,"window_header",0,4.32,-.06,5,.16,.28,STEEL)
    face(r,"lead_glass",0,2.68,0,4.65,3.22,GLASS)
    face(r,"sill_light",0,.89,.181,4.7,.025,AMBER)
    for x in (-1.65,0,1.65):
        panel(r,"sill_cassette",x,.47,.18,1.50,.62,.04,.06,ALLOY)


def main_control_desk(r):
    for x in (-1.58,0,1.58):
        panel(r,"bridge_pedestal",x,.39,-.27,.38,.78,.72,.06,ALLOY)
        vents(r,x,.34,.091,.23,.30,4)
    outline=[(-1.9,-.7),(1.9,-.7),(1.9,.40),(1.42,.55),(1.30,.18),
             (.60,.18),(.40,.55),(-.40,.55),(-.60,.18),(-1.30,.18),(-1.42,.55),(-1.9,.40)]
    prism(r,"curved_operator_worktop",outline,"y",.78,.86,ENAMEL)
    face(r,"bridge_underglow",0,.79,.551,.75,.018,WHITE)
    for i in range(4):
        x=(i-1.5)*.87
        screen(r,x,1.07,-.30,.80,.35,TOKAMAK if i%2 else GRID)
        rod(r,"monitor_stalk",(x,.86,-.33),(x,.97,-.33),.022,STEEL,6)
        quad(r,"keybed",(x,.863,0),.60,.12,"+y",PAPER)
        rod(r,"throttle",(x+.29,.86,.12),(x+.29,.98,.15),.018,STEEL,5)
    for x in (-.95,.95):
        slab(r,"chair_base",x,0,.44,.64,.07,.50,.10,STEEL)
        rod(r,"chair_lift",(x,.07,.44),(x,.48,.44),.055,STEEL,8)
        slab(r,"operator_seat",x,.48,.42,.62,.10,.50,.06,CLOTH)
        panel(r,"operator_back",x,.72,.66,.61,.40,.08,.06,CLOTH)
        box(r,"back_spine",x,.63,.70,.06,.40,.04,STEEL)


def telemetry_screen_wall(r):
    panel(r,"synoptic_frame",0,1.3,0,4.8,2.6,.23,.09,STEEL)
    for i,x in enumerate((-1.56,0,1.56)):
        for j,y in enumerate((.69,1.91)):
            screen(r,x,y,.14,1.48,1.12,
                   ALERT if (i,j)==(2,1) else (TOKAMAK if i%2 else GRID))
    face(r,"upper_status",0,2.56,.118,4.4,.018,BLUE)
    face(r,"lower_status",0,.04,.118,4.4,.018,AMBER)


def neutral_beam_injector(r):
    slab(r,"optical_bench",0,.20,0,4.8,.24,1.6,.12,STEEL)
    for x in (-1.8,1.8):
        for z in (-.57,.57):
            box(r,"bench_foot",x,.1,z,.28,.2,.28,DARK)
    rod(r,"beam_vacuum_tube",(-2.2,1.15,0),(2.2,1.15,0),.48,ALLOY,12)
    for x in (-1.95,-.95,.05,1.05,1.95):
        rod(r,"focusing_coil",(x-.10,1.15,0),(x+.10,1.15,0),.60,GOLD,12)
        box(r,"coil_support",x,.60,0,.18,.35,.65,STEEL)
    for x in (-1.45,-.45,.55,1.5):
        rod(r,"viewport_rim",(x,1.15,.43),(x,1.15,.51),.19,STEEL,8)
        rod(r,"beam_glow",(x,1.15,.515),(x,1.15,.52),.14,VIOLET,8)
        ring(r,"white_aperture",(x,1.15,.522),.12,.12,.022,WHITE,"z",8)
        face(r,"viewport_glass",x,1.15,.525,.29,.29,GLASS)
    tube(r,"vacuum_feed",[(-2,.45,-.60),(-2,1.72,-.60),(2,1.72,-.60),(2,1.4,0)],.07,STEEL,6)


def plasma_test_chamber(r):
    frame(r,2.4,2.3,1.4)
    slab(r,"vacuum_base",0,.14,0,2.15,.38,1.18,.10,ENAMEL)
    for y in (.57,1.94):
        drum(r,"chamber_flange",0,0,y,y+.09,.62,STEEL,12)
    drum(r,"bell_jar",0,0,.66,1.94,.57,GLASS,12)
    for y in (.79,1.67):
        ring(r,"trap_coil",(0,y,0),.46,.46,.07,GOLD,sides=12)
    form(r,"plasma_core",0,0,[(1.03,.015,.015,0),(1.15,.23,.23,0),
         (1.35,.23,.23,0),(1.47,.015,.015,0)],VIOLET,8)
    rod(r,"sample_support",(0,.52,0),(0,1.06,0),.045,STEEL,6)
    ring(r,"core_equator",(0,1.25,0),.26,.26,.03,AMBER,sides=12)
    screen(r,.72,1.1,.71,.48,.54,STATUS)
    gauge(r,-.73,.34,.62,.12)


def whiteboard_equations(r):
    panel(r,"board_frame",0,.875,0,3.2,1.75,.14,.05,STEEL)
    face(r,"writing_surface",0,.875,.071,3.04,1.57,PAPER)
    face(r,"task_light",0,1.69,.072,2.9,.025,WHITE)
    # Prosty alfabet kreskowy: wzory pozostają czytelne bez tekstury i fontów.
    glyphs = {
        "D": [[(0,0),(0,1),(.6,1),(1,.75),(1,.25),(.6,0),(0,0)]],
        "T": [[(0,1),(1,1)],[(.5,1),(.5,0)]],
        "H": [[(0,0),(0,1)],[(1,0),(1,1)],[(0,.5),(1,.5)]],
        "E": [[(1,1),(0,1),(0,0),(1,0)],[(0,.5),(.8,.5)]],
        "N": [[(0,0),(0,1),(1,0),(1,1)]],
        "M": [[(0,0),(0,1),(.5,.45),(1,1),(1,0)]],
        "C": [[(1,1),(0,1),(0,0),(1,0)]],
        "2": [[(0,1),(1,1),(1,.5),(0,.5),(0,0),(1,0)]],
        "+": [[(0,.5),(1,.5)],[(.5,.1),(.5,.9)]],
        "=": [[(0,.35),(1,.35)],[(0,.65),(1,.65)]],
    }
    for row, text in enumerate(("D+T=HE+N","E=MC2")):
        for col, char in enumerate(text):
            for path in glyphs[char]:
                for a,b in zip(path,path[1:]):
                    start=Vector((-1.38+col*.18+a[0]*.12,1.12-row*.40+a[1]*.22,.074))
                    end=Vector((-1.38+col*.18+b[0]*.12,1.12-row*.40+b[1]*.22,.074))
                    normal=Vector((-(end-start).y,(end-start).x,0)).normalized()*.008
                    surface(r,"equation_stroke",[tuple(p) for p in
                            (start-normal,end-normal,end+normal,start+normal)],[(0,1,2,3)],PAINT)
    beam(r,"plot_axis",(.28,.43,.074),(1.30,.43,.074),.012,.008,INK)
    beam(r,"plot_axis",(.28,.43,.074),(.28,1.39,.074),.012,.008,INK)
    points=[(.30+i*.08,.86+.32*math.sin(i*.55),.075) for i in range(13)]
    for a,b in zip(points,points[1:]):
        beam(r,"plasma_stability_curve",a,b,.019,.009,PAINT)
    for x in (-1.15,-.50):
        face(r,"pinned_report",x,.29,.076,.46,.30,HAZARD)
        face(r,"report_clip",x,.43,.078,.08,.025,GREEN)
    box(r,"marker_tray",0,.04,.09,2.7,.05,.18,ALLOY)


def tritium_cask_pallet(r):
    for x in (-.85,.85):
        box(r,"fork_skid",x,.08,0,.30,.16,2.2,STEEL)
    slab(r,"pallet_deck",0,.16,0,2.2,.10,2.2,.06,ALLOY)
    hazard(r,0,.20,1.101,2.0,.08)
    for x in (-.53,.53):
        for z in (-.53,.53):
            form(r,"shielded_cask",x,z,[(.26,.35,.35,0),(.34,.42,.42,0),
                 (1.27,.42,.42,0),(1.36,.34,.34,0)],STEEL,8)
            for y,mat in ((.47,GREEN),(.99,AMBER),(1.32,ENAMEL)):
                drum(r,"cask_ring",x,z,y,y+.055,.435,mat,8)
            box(r,"lid_lifting_bail",x,1.41,z,.40,.08,.09,GOLD)
            for dx in (-.24,.24):
                box(r,"armor_rib",x+dx,.82,z+.35,.035,.70,.04,ALLOY)
            print_on(r,"mat_label_tritium_cask",x,.75,z+.424,.36,.35)


def deuterium_cryo_tank(r):
    for x in (-.80,.80):
        for z in (-.80,.80):
            beam(r,"splayed_tank_leg",(x*1.2,0,z*1.2),(x,.95,z),.16,.16,STEEL)
    form(r,"spherical_cryo_vessel",0,0,[(.60,.35,.35,0),(.88,.87,.87,0),
         (1.40,1.27,1.27,0),(2.1,1.4,1.4,0),(2.73,1.17,1.17,0),
         (3.15,.68,.68,0),(3.29,.24,.24,0)],PAPER,16)
    drum(r,"equatorial_seam",0,0,2.06,2.12,1.405,STEEL,16)
    drum(r,"safety_neck",0,0,3.29,3.51,.14,STEEL,8)
    valve(r,0,3.48,.18,.12)
    for x in (-.23,.23):
        rod(r,"ladder_stile",(x,.10,1.36),(x,2.95,1.36),.028,STEEL,6)
    for i in range(10):
        rod(r,"ladder_rung",(-.23,.2+i*.28,1.36),(.23,.2+i*.28,1.36),.021,STEEL,6)
    face(r,"temperature_window",.70,2.2,1.23,.18,.45,BLUE)


def fuel_gantry_crane(r):
    for z in (-1.2,1.2):
        box(r,"bridge_web",0,1.08,z,14,.50,.15,GOLD)
        for y in (.81,1.35):
            box(r,"bridge_flange",0,y,z,14,.10,.34,GOLD)
        hazard(r,0,1.08,z+.081,13.7,.28,28)
    for x in (-6.6,6.6):
        panel(r,"end_truck",x,1.10,0,.60,.52,3.2,.06,STEEL)
    slab(r,"hoist_carriage",.7,.74,0,1.8,.20,2.7,.08,ALLOY)
    rod(r,"hoist_drum",(.1,.72,0),(1.3,.72,0),.23,STEEL,10)
    for x in (.35,1.05):
        rod(r,"lifting_chain",(x,.25,0),(x,.66,0),.025,INK,6)
    slab(r,"grab_top",.7,.22,0,1.10,.10,1.1,.08,GOLD)
    for x in (.20,1.20):
        for z in (-.48,.48):
            beam(r,"cask_grabber",(x,0,z),(x,.25,z),.065,.065,STEEL)
    for x in (-5,5):
        quad(r,"work_light",(x,.75,0),.65,.45,"-y",WHITE)


def steam_turbine_generator(r):
    slab(r,"turbine_foundation",0,0,0,3.8,.25,7.2,.16,ENAMEL)
    for z in (-2.3,1.9):
        panel(r,"bearing_saddle",0,.72,z,2.3,.95,1.0,.14,STEEL)
    rod(r,"turbine_shell",(0,1.55,-3.2),(0,1.55,.1),1.08,ALLOY,16)
    rod(r,"generator_stator",(0,1.55,.8),(0,1.55,3.1),.84,PAINT,12)
    rod(r,"drive_shaft",(0,1.55,.1),(0,1.55,.8),.20,STEEL,10)
    for z in (-2.9,-2.25,-1.60,-.95,-.30):
        rod(r,"turbine_casing_rib",(0,1.55,z-.055),(0,1.55,z+.055),1.15,STEEL,16)
    for z in (1.15,1.80,2.45):
        rod(r,"stator_cooling_band",(0,1.55,z-.035),(0,1.55,z+.035),.89,STEEL,12)
    for x in (-1.55,1.55):
        slab(r,"maintenance_walkway",x,.38,0,.42,.08,6.3,.035,STEEL)
        tube(r,"steam_bypass",[(x,.65,-2.8),(x,2.20,-2.8),
             (x,2.20,2.7),(x,1.2,2.7)],.11,STEEL,8)
    ring(r,"rotor_inspection_ring",(0,1.55,3.11),.54,.54,.06,AMBER,"z",16)
    ring(r,"inspection_hub",(0,1.55,3.12),.22,.22,.035,WHITE,"z",12)
    hazard(r,0,.14,3.601,3.3,.10,10)


def heat_exchanger_tower(r):
    slab(r,"column_foot",0,0,0,2.4,.20,2.4,.15,STEEL)
    form(r,"pressure_column",0,0,[(.2,.62,.62,0),(.55,.81,.81,0),
         (3.98,.81,.81,0),(4.35,.50,.50,0),(4.48,.20,.20,0)],ALLOY,12)
    for y in (.65,2.25,3.85):
        drum(r,"bolted_flange",0,0,y,y+.12,.92,STEEL,12)
        for i in range(6):
            a=i*math.tau/6
            drum(r,"flange_bolt",.85*math.cos(a),.85*math.sin(a),y+.12,y+.17,.035,GOLD,4)
    for s in (-1,1):
        tube(r,"inlet_manifold",[(s*.6,1,0),(s*1.05,1,0),
             (s*1.05,3.25,0),(s*.6,3.25,0)],.14,STEEL,8)
    face(r,"thermal_sensor_strip",0,2.3,.812,.055,2.5,AMBER)
    drum(r,"relief_valve",0,0,4.48,4.6,.12,GOLD,8)


def quantum_server_rack(r):
    frame(r,2.8,2.4,1.1,ENAMEL)
    box(r,"server_back",0,1.2,-.50,2.6,2.2,.10,ALLOY)
    box(r,"rack_divider",0,1.2,0,.10,2.2,.94,STEEL)
    for x in (-.68,.68):
        for i in range(6):
            y=.35+i*.34
            panel(r,"compute_blade",x,y,.14,1.08,.27,.50,.025,ALLOY)
            face(r,"drive_slot",x-.12,y,.391,.64,.10,INK)
            face(r,"compute_activity",x+.37,y,.393,.04,.12,GREEN)
        tube(r,"cooling_supply",[(x-.49,.2,.41),(x-.49,2.2,.41),
             (x+.49,2.2,.41),(x+.49,.2,.41)],.026,BLUE,6)
        face(r,"glazed_rack_door",x,1.2,.54,1.20,2.12,GLASS)
        box(r,"rack_handle",x+.47,1.2,.56,.035,.38,.04,STEEL)


def decon_shower_arch(r):
    for s in (-1,1):
        for z in (-.72,.72):
            panel(r,"portal_post",s*1.47,1.4,z,.45,2.8,.16,.04,STEEL)
        quad(r,"shower_side",(s*1.47,1.35,0),1.35,2.50,"+x",GLASS)
        for y in (.50,1.25,2):
            rod(r,"spray_nozzle",(s*1.42,y,0),(s*1.27,y,0),.065,ALLOY,6)
        face(r,"dosimeter_scan",s*1.48,1.35,.811,.06,1.75,AMBER)
    for z in (-.72,.72):
        panel(r,"shower_header",0,2.68,z,2.55,.24,.16,.035,ENAMEL)
        face(r,"clean_status_arch",0,2.68,z+.081,2.30,.035,GREEN)
    screen(r,-1.48,1.55,.83,.25,.40,TRITIUM)


def suit_locker_bank(r):
    frame(r,3.2,2.3,.8)
    box(r,"locker_back",0,1.15,-.37,3,2.1,.06,ENAMEL)
    for x in (-1.18,-.39,.39,1.18):
        box(r,"locker_divider",x+.36,1.15,0,.035,2.1,.65,STEEL)
        panel(r,"suit_torso",x,1.22,0,.44,.64,.21,.09,GOLD)
        for s in (-1,1):
            beam(r,"suit_sleeve",(x+s*.20,1.45,0),(x+s*.28,.98,0),.10,.14,GOLD)
            beam(r,"suit_leg",(x+s*.11,.94,0),(x+s*.14,.38,.02),.15,.18,GOLD)
        panel(r,"protective_helmet",x,1.76,.01,.42,.39,.28,.10,GOLD)
        face(r,"helmet_visor",x,1.77,.152,.30,.16,INK)
        face(r,"suit_zip",x,1.22,.106,.025,.44,INK)
        rod(r,"oxygen_cylinder",(x+.24,1.12,-.20),(x+.24,1.64,-.20),.075,STEEL,6)
        face(r,"locker_glazing",x,1.18,.39,.70,2.06,GLASS)
        face(r,"locker_light",x,2.19,.391,.55,.025,WHITE)


def director_desk(r):
    for x in (-1.03,1.03):
        panel(r,"titanium_pedestal",x,.38,-.08,.46,.76,.95,.07,STEEL)
        for y in (.25,.48):
            face(r,"drawer_reveal",x,y,.396,.35,.015,INK)
    slab(r,"executive_worktop",0,.76,0,2.8,.10,1.3,.13,ENAMEL)
    face(r,"desktop_inlay",0,.81,.651,2.52,.018,AMBER)
    for x in (-.68,0,.68):
        screen(r,x,1.0,-.31,.60,.30)
        rod(r,"monitor_stalk",(x,.86,-.36),(x,.99,-.36),.018,STEEL,6)
    for x in (-.52,-.22):
        quad(r,"research_report",(x,.863,.24),.23,.30,"+y",PAPER)
        for i in range(3):
            quad(r,"report_line",(x,.865,.17+i*.05),.17,.008,"+y",PAINT)
    drum(r,"model_projector",.86,.26,.86,.90,.20,STEEL,12)
    ring(r,"field_model",(.86,1.02,.26),.15,.10,.022,VIOLET,"z",12)
    ring(r,"field_model",(.86,1.02,.26),.15,.12,.022,VIOLET,sides=12)
    form(r,"director_mug",-1.10,.24,[(.86,.055,.055,0),(1.01,.065,.065,0),
         (1.01,.05,.05,0),(.88,.045,.045,0)],PAPER,10)
    ring(r,"mug_handle",(-1.18,.95,.24),.04,.04,.012,STEEL,"z",8)
    print_on(r,"mat_label_fusion_director_mug",-1.10,.95,.306,.085,.09)


CATALOG = {
    catwalk_deck: ((4,.4,4),360,(.65,.9,1)),
    catwalk_railing: ((4,1.1,.18),280,(.4,.3,1)),
    ceiling_coffer_bay: ((6,.65,6),420,(.6,-1,1)),
    blast_door_frame: ((4,3.8,.36),480,(.4,.25,1)),
    shield_wall_panel: ((4,4.8,.35),320,(.4,.25,1)),
    coolant_pipe_arch: ((1.6,4.4,4.8),640,(1,.5,.8)),
    wall_pipe_manifold: ((4,3.6,.55),580,(.4,.3,1)),
    wall_power_busbar: ((4,4.2,.45),520,(.4,.3,1)),
    overhead_cable_tray: ((6,.85,1.2),340,(.5,.8,1)),
    highbay_light_strip: ((4,.35,.65),240,(.5,-.8,1)),
    cryopump_unit: ((2.8,2.6,1.8),880,(.6,.4,1)),
    capacitor_bank: ((3.6,2.8,1.6),920,(.6,.4,1)),
    pulse_transformer: ((2.4,2.2,2),740,(.6,.5,1)),
    diagnostic_console: ((2.6,1.25,1.1),620,(.6,.8,1)),
    junction_box: ((1.6,1.15,.85),380,(.6,.4,1)),
    control_window_wall: ((5,4.4,.4),440,(.4,.25,1)),
    main_control_desk: ((3.8,1.25,1.4),960,(.6,.8,1)),
    telemetry_screen_wall: ((4.8,2.6,.28),460,(.25,.2,1)),
    neutral_beam_injector: ((4.8,1.85,1.6),980,(.6,.5,1)),
    plasma_test_chamber: ((2.4,2.3,1.4),860,(.55,.4,1)),
    whiteboard_equations: ((3.2,1.75,.18),340,(.2,.18,1)),
    tritium_cask_pallet: ((2.2,1.45,2.2),840,(.6,.65,1)),
    deuterium_cryo_tank: ((2.8,3.6,2.8),940,(.6,.4,1)),
    fuel_gantry_crane: ((14,1.4,3.2),780,(.4,-.5,1)),
    steam_turbine_generator: ((3.8,2.8,7.2),1180,(.9,.65,1)),
    heat_exchanger_tower: ((2.4,4.6,2.4),760,(.6,.4,1)),
    quantum_server_rack: ((2.8,2.4,1.1),720,(.5,.35,1)),
    decon_shower_arch: ((3.4,2.8,1.6),620,(.6,.4,1)),
    suit_locker_bank: ((3.2,2.3,.8),760,(.4,.3,1)),
    director_desk: ((2.8,1.15,1.3),880,(.55,.75,1)),
}


def export(builder, preview):
    name = "fus_" + builder.__name__
    ba.reset_scene()
    root = ba._port_root(name)
    palette()
    builder(root)
    finish_glazing(root)
    ba._port_merge(root,{})
    size, budget, direction = CATALOG[builder]
    fit_dimensions(root,size)
    meshes = [o for o in root.children if o.type == "MESH"]
    for obj in meshes:
        for polygon in obj.data.polygons:
            polygon.use_smooth = False
    triangles = sum(len(p.vertices)-2 for o in meshes for p in o.data.polygons)
    if triangles > budget:
        raise ValueError(f"{name}: {triangles} > {budget} tri")
    output = REPO / "public/assets/models/city" / (name+".glb")
    ba.export_glb(root,str(output),animations=False)
    used = sorted({m.name for o in meshes for m in o.data.materials})
    print(f"[fusion] {name}: {triangles}/{budget} tri; {size}",flush=True)
    if preview:
        def view(xyz):
            return (-ba._city_point(xyz)).to_track_quat("-Z","Y")
        root.rotation_mode = "QUATERNION"
        root.rotation_quaternion = view((.35,.27,1)) @ view(direction).inverted()
        studio(root,REPO / "artifacts/models/fusion" / (name+".png"))
    return {"model":name,"size":size,"triangles":triangles,
            "budget":budget,"bytes":output.stat().st_size,"materials":used}


def write_bounds(report):
    # Zachowaj dosłownie wszystkie wiersze innych zestawów, także równoległe zmiany.
    path = REPO / "src/data/render/mapModelBounds.json"
    source = path.read_text(encoding="utf8")
    for item in report:
        x,y,z = item["size"]
        entry = {"min":[-x/2,0,-z/2],"max":[x/2,y,z/2],"materials":item["materials"]}
        line = "  " + json.dumps(item["model"]) + ": " + json.dumps(entry,separators=(",",":"))
        pattern = r'^  "' + re.escape(item["model"]) + r'": .*?(,?)$'
        if re.search(pattern,source,re.MULTILINE):
            source = re.sub(pattern,lambda m: line+m[1],source,flags=re.MULTILINE)
        else:
            source = source.rstrip()[:-1].rstrip() + ",\n" + line + "\n}\n"
    json.loads(source)
    path.write_text(source,encoding="utf8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--only",nargs="+",choices=["fus_"+b.__name__ for b in CATALOG])
    parser.add_argument("--no-preview",action="store_true")
    parser.add_argument("--write-bounds",action="store_true")
    opts = parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    report = [export(b,not opts.no_preview) for b in CATALOG
              if not opts.only or "fus_"+b.__name__ in opts.only]
    if opts.write_bounds:
        write_bounds(report)
    if not opts.only:
        target = REPO / "artifacts/models/fusion/manifest.json"
        target.parent.mkdir(parents=True,exist_ok=True)
        target.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
