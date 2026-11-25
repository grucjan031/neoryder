"""Przychodnia Helixy. Metry glTF, przód +Z, środek podstawy na Y=0."""
import argparse
import math
import sys
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from warehouse_kurogane import (ba, beam, cbox, panel, previews, quad,
                               rod, tube, STEEL, ALLOY, DARK, RUBBER, LENS)
from construction_power import surface

REPO = Path(__file__).resolve().parents[3]
IVORY = "mat_clinic_laminate"
GLASS = "mat_clinic_glass"
VINYL = "mat_clinic_vinyl"


def reception_counter(r):
    cbox(r, "plinth", (3.80, .12, .75), (0, .06, -.02), RUBBER, .02)
    panel(r, "apron", 0, .52, .38, 3.96, .82, .11, .035, VINYL)
    panel(r, "reveal", 0, .64, .439, 3.87, .10, .012, .012, STEEL)
    panel(r, "inlay", 0, .65, .447, 3.81, .054, .008, .008, IVORY)
    for x in (-1.925, 1.925):
        cbox(r, "end_cheek", (.11, .82, .89), (x, .52, -.01), IVORY, .025)
    cbox(r, "countertop", (4, .075, .44), (0, .935, .255), IVORY, .022)
    for y in (.28, .72):
        cbox(r, "staff_shelf", (3.83, .045, .78), (0, y, -.085), VINYL, .009)
    for x in (-.96, .96):
        cbox(r, "monitor_foot", (.25, .025, .19), (x, .755, -.23), DARK, .009)
        beam(r, "monitor_neck", (x, .76, -.22), (x, .94, -.27), .07, .045, STEEL)
        panel(r, "monitor", x, 1.015, -.27, .49, .27, .035, .012, DARK)
        panel(r, "display", x, 1.015, -.291, .459, .237, .008, .009, "mat_glass")
        for row, width in enumerate((.18, .31, .23)):
            quad(r, "display_trace", (x+.16-width/2, 1.08-row*.035, -.296),
                 width, .008, "-z", LENS)


def waiting_seats(r):
    cbox(r, "spine", (2.8, .095, .115), (0, .35, -.03), STEEL, .018)
    for x in (-.93, .93):
        cbox(r, "foot", (.13, .065, .75), (x, .0325, 0), DARK, .02)
        beam(r, "pedestal", (x, .045, .04), (x, .35, -.03), .09, .12, STEEL)
    # Poprzeczne przekroje jednej skorupy: podwinięty nos, misa i odchylone oparcie.
    stations = [(.345,.48,.32,.025), (.31,.49,.38,.045), (.08,.455,.39,.06),
                (-.16,.44,.37,.065), (-.225,.48,.35,.06), (-.245,.58,.35,.05),
                (-.30,.88,.36,.035), (-.31,.93,.31,.02)]
    for x in (-.93, 0, .93):
        rings = []
        for z, y, w, lip in stations:
            top = [(x+w*t, y+lip*t*t, z) for t in (-1,-.66,0,.66,1)]
            rings.append(top + [(u,v-.035,s-.012) for u,v,s in reversed(top)])
        ba._city_hull(r, "moulded_bucket", rings, IVORY)
        cbox(r, "saddle", (.34,.09,.32), (x,.40,-.035), DARK,.025)
    for x in (-.465,.465):
        tube(r, "arm_support", [(x,.36,-.04),(x,.54,-.09),(x,.63,-.08),(x,.63,.17)], .026, STEEL, 8)
        cbox(r, "armrest", (.083,.052,.32), (x,.648,.055), VINYL,.018)


def entry_scanner(r):
    for s in (-1,1):
        x = 1.7*s
        cbox(r, "boot", (.4,.17,.8), (x,.085,0), DARK,.022)
        cbox(r, "pylon", (.38,2.86,.73), (x,1.58,0), IVORY,.042)
        cbox(r, "sensor_gasket", (.014,2.29,.35), (s*1.511,1.59,0), DARK,.005)
        cbox(r, "sensor", (.006,2.20,.28), (s*1.505,1.59,0), "mat_glass",.002)
        for y in (.73,1.56,2.39):
            cbox(r, "lens_slot", (.004,.026,.16), (s*1.502,y,0), STEEL)
    cbox(r, "lintel", (3.8,.1,.78), (0,3.05,-.01), IVORY,.022)
    panel(r, "light_socket", 0,3.053,.387,3.37,.055,.018,.009,DARK)
    panel(r, "diffuser", -.06,3.053,.398,3.13,.025,.004,.006,LENS)
    panel(r, "ready", 1.60,3.053,.398,.067,.032,.004,.006,"mat_neon_green")


def treatment_screen(r):
    cbox(r, "kick", (2.8,.10,.14), (0,.05,0), RUBBER,.008)
    cbox(r, "partition", (2.78,.75,.125), (0,.475,0), IVORY,.012)
    for x in (-1.375,1.375):
        cbox(r, "stile", (.05,.70,.10), (x,1.20,0), STEEL,.006)
    for y in (.865,1.535):
        cbox(r, "rail", (2.70,.03,.085), (0,y,0), STEEL,.004)
    cbox(r, "glazing", (2.70,.64,.012), (0,1.20,0), GLASS)
    for z in (-.008,.008):
        cbox(r, "privacy_film", (2.70,.15,.002), (0,1.275,z), IVORY)
        cbox(r, "film_rule", (2.70,.011,.002), (0,1.176,z), IVORY)


def treatment_bed(r):
    for x in (-.30,.30):
        cbox(r, "runner", (.10,.09,1.23), (x,.045,0), STEEL,.023)
    cbox(r, "crossfoot", (.60,.09,.155), (0,.06,.01), STEEL,.014)
    cbox(r, "pedestal", (.29,.34,.35), (0,.245,.01), IVORY,.045)
    cbox(r, "piston", (.22,.16,.26), (0,.46,.01), ALLOY,.018)
    cbox(r, "carriage", (.69,.078,1.34), (0,.535,.05), STEEL,.027)
    cbox(r, "seat_pad", (.85,.14,1.17), (0,.628,.232), VINYL,.053)
    back = cbox(r, "backrest", (.82,.14,.71), (0,.786,-.625), VINYL,.055)
    back.rotation_euler.x = math.radians(35)
    for x in (-.28,.28):
        beam(r,"back_link",(x,.51,-.43),(x,.77,-.70),.055,.055,ALLOY)
        beam(r,"paper_fork",(x,.55,.68),(x,.56,.92),.042,.036,STEEL)
    rod(r, "paper_roll", (-.32,.56,.925), (.32,.56,.925), .075, IVORY,20)
    rod(r, "paper_core", (-.33,.56,.925), (.33,.56,.925), .027, DARK,12)
    tube(r, "task_arm", [(.35,.54,-.49),(.38,.68,-.65),(.38,.99,-.91),
                         (.32,1.026,-.96),(.16,1.026,-.96)], .022, STEEL,8)
    cbox(r, "lamp_head", (.18,.057,.083), (.12,1.0215,-.9585), IVORY,.015)
    cbox(r, "lamp_lens", (.14,.008,.060), (.12,.991,-.9585), LENS,.003)


def sample_fridge(r):
    cbox(r,"plinth",(1.12,.12,.89),(0,.06,0),RUBBER,.018)
    cbox(r,"rear_wall",(1.17,1.92,.07),(0,1.05,-.44),STEEL,.015)
    for x in (-.5625,.5625):
        cbox(r,"cabinet_side",(.075,1.93,.89),(x,1.075,-.025),ALLOY,.015)
    for y,h in ((.17,.12),(2.015,.27)):
        cbox(r,"cabinet_cap",(1.2,h,.93),(0,y,-.01),STEEL,.018)
    for x in (-.282,.282):
        for dx in (-.251,.251):
            cbox(r,"door_stile",(.042,1.64,.047),(x+dx,1.054,.407),STEEL,.007)
        for y in (.256,1.852):
            cbox(r,"door_rail",(.52,.044,.05),(x,y,.407),ALLOY,.006)
        cbox(r,"door_glass",(.46,1.552,.012),(x,1.054,.407),GLASS)
        hx = math.copysign(.095,x)
        tube(r,"handle",[(hx,1.15,.424),(hx,1.13,.459),(hx,.91,.459),(hx,.89,.424)],.016,DARK,8)
    for i in range(4):
        y = .36 + i*.39
        cbox(r,"shelf",(1.04,.033,.70),(0,y,-.02),IVORY,.007)
        for z in (-.19,.13):
            for j in range(6):
                x = (j-2.5)*.153
                rod(r,"vial",(x,y+.017,z),(x,y+.153,z),.042,VINYL,10)
                rod(r,"vial_cap",(x,y+.153,z),(x,y+.18,z),.044,IVORY,10)
    panel(r,"intake",0,2.015,.452,.97,.18,.012,.018,DARK)
    for i in range(5):
        cbox(r,"louvre",(.89,.012,.023),(0,1.952+.03*i,.459),ALLOY,.004)
    cbox(r,"indicator",(.028,.039,.010),(.038,1.23,.434),"mat_neon_blue",.004)


def freight_lift_frame(r):
    for s in (-1,1):
        x = s*2.25
        cbox(r,"guide",(.50,3.05,1.0),(x,1.525,0),DARK,.025)
        for i in range(12):
            cbox(r,"rib",(.47,.08,1.10),(x,.125+i*.25,0),STEEL,.016)
        cbox(r,"guide_face",(.08,2.97,.06),(s*2.07,1.515,.49),ALLOY,.012)
    panel(r,"machine_beam",0,3.60,-.08,5,1.20,.89,.085,DARK)
    for s in (-1,1):
        panel(r,"access_cover",s*1.59,3.66,.382,1.51,.73,.069,.077,ALLOY)
        for i in range(4):
            panel(r,"vent",s*1.59,3.50+i*.087,.42,1.17,.027,.016,.008,DARK)
    for z in (.386,.473):
        rod(r,"sheave_flange",(0,3.68,z),(0,3.68,z+.029),.39,STEEL,32)
    rod(r,"sheave_drum",(0,3.68,.41),(0,3.68,.48),.34,RUBBER,32)
    rod(r,"hub",(0,3.68,.50),(0,3.68,.53),.094,ALLOY,12)
    for i in range(6):
        a = i*math.tau/6
        rod(r,"hub_bolt",(.24*math.cos(a),3.68+.24*math.sin(a),.502),
            (.24*math.cos(a),3.68+.24*math.sin(a),.515),.025,DARK,8)
    panel(r,"sheave_guard",0,3.99,.52,.96,.22,.06,.08,ALLOY)
    panel(r,"lamp_housing",0,3.10,.40,1.35,.155,.12,.034,STEEL)
    panel(r,"diffuser",0,3.10,.464,1.16,.085,.012,.02,LENS)
    # Oznakowanie leży w płaszczyźnie posadzki, więc nie skraca światła portalu.
    quad(r,"threshold",(0,0,0),4,.72,"+y",RUBBER)
    for i in range(15):
        x = -1.97+i*.26
        surface(r,"stripe",[(x,.0001,-.34),(x+.12,.0001,-.34),
                            (x+.33,.0001,.34),(x+.21,.0001,.34)],[(3,2,1,0)],"mat_hivis")


BUILDERS = (reception_counter, waiting_seats, entry_scanner, treatment_screen,
            treatment_bed, sample_fridge, freight_lift_frame)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", help="Identyfikatory modeli rozdzielone przecinkami")
    parser.add_argument("--no-preview", action="store_true")
    args = parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    folder = REPO / "tools/blender/previews/bulwar"
    folder.mkdir(parents=True, exist_ok=True)
    for build in BUILDERS:
        name = "bw_" + build.__name__
        if args.only and name not in args.only.split(","):
            continue
        ba.reset_scene()
        root = ba._port_root(name)
        for mat, rgb in ((IVORY,"e6e3d2"),(VINYL,"969ca0"),(GLASS,"a5b5ab")):
            color = tuple(((int(rgb[i:i+2],16)/255+.055)/1.055)**2.4 for i in (0,2,4))
            ba.PALETTE[mat] = ((*color,1),None)
        glass = ba.material(GLASS)
        glass.node_tree.nodes["Principled BSDF"].inputs["Alpha"].default_value = .22
        glass.diffuse_color = (*glass.diffuse_color[:3],.22)
        build(root)
        ba._port_merge(root,{})
        ba.export_glb(root,str(REPO / f"public/assets/models/city/{name}.glb"),animations=False)
        if not args.no_preview:
            previews(root,folder)


if __name__ == "__main__":
    main()
