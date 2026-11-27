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


WHITE, BLUE, GREEN, VIOLET = "mat_light_panel", "mat_neon_blue", "mat_neon_green", "mat_neon_violet"


def turned(r, name, x, z, profile, mat, sides=32):
    """Profil tokarski (wysokość, promień)."""
    return ba._city_hull(r, name, [
        [(x+radius*math.cos(i*math.tau/sides), y, z+radius*math.sin(i*math.tau/sides))
         for i in range(sides)] for y, radius in profile], mat)


def hoop(r, name, center, radius, thickness, mat, axis="y"):
    return ba._city_ring(r, name, center, radius, axis, thickness, mat, 40)


def readout(r, x, y, z, w, h):
    panel(r,"bezel",x,y,z,w,h,.036,.12*h,DARK)
    panel(r,"instrument_glass",x,y,z+.020,w*.91,h*.78,.008,.08*h,"mat_glass")
    for i, length in enumerate((.44,.62,.30)):
        quad(r,"readout",(x-w*.36+w*length/2,y+h*(.2-.18*i),z+.025),
             w*length,h*.036,"+z",BLUE)


def door_portal(r):
    for s in (-1,1):
        x = s*2.15
        cbox(r,"jamb_spine",(.065,3.4,.6),(s*2.2675,1.7,0),IVORY,.021)
        cbox(r,"jamb_core",(.30,3.4,.34),(x,1.7,0),IVORY,.025)
        for z in (-.25,.25):
            panel(r,"pocket",x,1.7,z*.79,.28,3.36,.065,.022,VINYL)
            panel(r,"parked_leaf",x,1.7,z*1.10,.25,3.27,.025,.02,GLASS)
            panel(r,"privacy_band",x,1.37,z*1.16,.245,.17,.009,.004,VINYL)
    cbox(r,"header",(4.6,.30,.59),(0,3.55,0),IVORY,.028)
    quad(r,"downlight",(0,3.3999,0),3.86,.045,"-y",WHITE)
    for z in (-.297,.297):
        panel(r,"sign_blank",0,3.55,z,1.6,.30,.006,.025,STEEL)
    quad(r,"sill",(0,0,0),4,.55,"+y",STEEL)


def curtain_wall_frame(r):
    for x in (-1.95,1.95):
        cbox(r,"mullion",(.1,5,.26),(x,2.5,0),DARK,.008)
        for s in (-1,1):
            cbox(r,"pressure_cap",(.084,5,.025),(x,2.5,s*.1375),STEEL,.004)
    for y,h in ((.025,.05),(2.5,.10),(4.975,.05)):
        cbox(r,"transom",(3.8,h,.22),(0,y,0),STEEL,.006)
        cbox(r,"inner_bead",(3.8,h*.5,.024),(0,y,.12),ALLOY,.003)


def glass_balustrade(r):
    cbox(r,"laminated_pane",(3.98,1,.022),(0,.55,0),GLASS,.004)
    rod(r,"handrail",(-2,1.06,0),(2,1.06,0),.04,STEEL,24)
    cbox(r,"lower_channel",(4,.045,.05),(0,.084,0),ALLOY,.006)
    for x in (-1.72,-.58,.58,1.72):
        cbox(r,"shoe",(.16,.065,.12),(x,.0325,0),STEEL,.009)
        cbox(r,"clamp",(.105,.12,.074),(x,.10,0),ALLOY,.012)
        rod(r,"clamp_pin",(x,.12,-.04),(x,.12,.04),.015,DARK,12)


def ceiling_panel(r):
    cbox(r,"housing",(2.4,.12,1.2),(0,.074,0),IVORY,.042)
    cbox(r,"seal",(2.29,.022,1.09),(0,.017,0),DARK,.009)
    for x in (-.56,.56):
        cbox(r,"diffuser",(1.09,.015,1.04),(x,.0075,0),WHITE,.007)
    for x in (-.92,.92):
        for z in (-.38,.38):
            turned(r,"suspension",x,z,[(.13,.053),(.16,.053),(.17,.028),(.28,.028),(.28,.06),(.30,.06)],STEEL,16)
            hoop(r,"grommet",(x,.135,z),.058,.009,DARK)


def casters(r, x, z, radius):
    for px in (-x,x):
        for pz in (-z,z):
            rod(r,"wheel",(px-radius*.4,radius,pz),(px+radius*.4,radius,pz),radius,RUBBER,20)
            cbox(r,"fork",(radius*.32,radius*1.5,radius*.68),
                 (px+radius*.48,radius*1.55,pz),STEEL,.006)


def operating_table(r):
    casters(r,.27,.64,.08)
    cbox(r,"rolling_base",(.68,.14,1.55),(0,.21,0),IVORY,.055)
    turned(r,"lift",0,0,[(.27,.23),(.53,.23),(.54,.17),(.68,.17),(.69,.14),(.77,.14)],STEEL)
    cbox(r,"chassis",(.63,.10,1.91),(0,.78,0),ALLOY,.034)
    for name,z,d,y,angle in (("head",-.89,.41,.918,5),("thorax",-.31,.72,.9,0),
                             ("pelvis",.26,.40,.90,0),("calf",.785,.63,.885,-3)):
        pad=cbox(r,name,(.73,.135,d),(0,y,z),VINYL,.042)
        pad.rotation_euler.x=math.radians(angle)
    for s in (-1,1):
        rod(r,"side_rail",(s*.432,.81,-.82),(s*.432,.81,.86),.018,STEEL,16)
        for z in (-.71,.64):
            beam(r,"rail_standoff",(s*.30,.79,z),(s*.43,.81,z),.035,.04,DARK)
    beam(r,"arm_bracket",(.29,.81,-.49),(.402,.91,-.35),.045,.038,STEEL)
    beam(r,"arm_pad",(.384,.935,-.48),(.415,.935,-.14),.065,.055,VINYL)


def surgical_robot(r):
    turned(r,"ballast",0,-.32,[(0,.48),(.11,.48),(.20,.43),(.26,.28)],ALLOY)
    turned(r,"tower",0,-.32,[(.24,.27),(.4,.34),(2.51,.29),(2.68,.24),(2.72,.17)],IVORY)
    cbox(r,"status_spine",(.031,1.75,.02),(0,1.46,-.01),BLUE,.006)
    for i,(s,y,elbow_y,reach) in enumerate(((-1,1.98,2.14,.58),(1,2.28,2.42,.44),
                                           (-1,1.32,1.57,.39),(1,1.62,1.81,.60))):
        shoulder=(s*.23,y,-.30)
        elbow=(s*(1.11 if i<2 else .87),elbow_y,-.12+i*.045)
        wrist=(s*(.62 if i<2 else .48),elbow_y-.18,reach)
        tip=(s*(.24+.03*i),1.15+.06*i,.78)
        for a,b,radius in ((shoulder,elbow,.105),(elbow,wrist,.083),(wrist,tip,.044)):
            rod(r,"arm_fairing",a,b,radius,IVORY,16,radius*.72)
            x,h,z=a
            rod(r,"pivot",(x-.09,h,z),(x+.09,h,z),radius*1.20,DARK,20)
            rod(r,"bearing_cap",(x+s*.085,h,z),(x+s*.090,h,z),radius*.76,STEEL,20)
        # Oś wrzeciona celuje w pole zabiegowe przed podstawą.
        mount=tuple(t+.18*(t-g) for t,g in zip(tip,(0,1,1.2)))
        rod(r,"chuck",mount,tip,.043,ALLOY,16,.023)
        rod(r,"instrument",tip,tuple(t+.035*(g-t) for t,g in zip(tip,(0,1,1.2))),.014,STEEL,12,.005)
    tube(r,"lamp_boom",[(0,2.67,-.32),(0,2.84,-.32),(0,2.84,.40),(0,2.67,.40)],.06,STEEL,12)
    turned(r,"theatre_lamp",0,.4,[(2.55,.35),(2.59,.35),(2.66,.24),(2.69,.06)],IVORY)
    rod(r,"lamp_face",(0,2.544,.4),(0,2.552,.4),.316,WHITE,40)


def resonance_scanner(r):
    # Profil zamknięty wzdłuż osi Z; otwór pozostaje drożny z obu stron.
    profile=[(.55,-1.27),(.61,-1.44),(1.03,-1.44),(1.17,-1.33),
             (1.20,-1.18),(1.20,-.69),(1.13,-.54),(1.02,-.47),(.64,-.47),(.55,-.57)]
    n=48
    vertices=[(rad*math.cos(i*math.tau/n),1.30+rad*math.sin(i*math.tau/n),z)
              for rad,z in profile for i in range(n)]
    faces=[(k*n+i,k*n+(i+1)%n,((k+1)%len(profile))*n+(i+1)%n,((k+1)%len(profile))*n+i)
           for k in range(len(profile)) for i in range(n)]
    surface(r,"gantry",vertices,faces,IVORY)
    hoop(r,"bore_light",(0,1.30,-.57),.56,.015,BLUE,"z")
    hoop(r,"front_seam",(0,1.30,-.472),.92,.013,ALLOY,"z")
    cbox(r,"gantry_base",(2.8,.22,1.36),(0,.11,-1.02),ALLOY,.06)
    for s in (-1,1):
        beam(r,"cradle",(s*.77,.16,-1),(s*.95,.64,-1),.31,.61,IVORY)
        for i in range(10):
            angle=.24+.063*i
            x=s*.83*math.cos(angle)
            y=1.30-.83*math.sin(angle)
            panel(r,"radial_vent",x,y,-.463,.095,.021,.014,.009,DARK)
    cbox(r,"track",(.65,.14,2.78),(0,.12,.30),DARK,.043)
    for z in (.23,1.24):
        turned(r,"lift",0,z,[(.17,.20),(.52,.18),(.54,.12),(.83,.12)],ALLOY,20)
    cbox(r,"couch",(.70,.10,2.56),(0,.85,.42),IVORY,.037)
    cbox(r,"patient_pad",(.61,.075,2.40),(0,.932,.43),VINYL,.03)
    for z in (.25,1.25):
        for s in (-1,1):
            cbox(r,"track_shoe",(.08,.09,.25),(s*.26,.18,z),STEEL,.014)
    readout(r,1.01,1.35,-.48,.32,.27)
    for x in (.88,.98,1.08):
        panel(r,"key",x,1.16,-.466,.057,.027,.014,.006,ALLOY)


def open_straps(r, half_width, y, z):
    for s in (-1,1):
        pts=[(s*half_width,y,z),(s*(half_width+.032),y-.06,z+.07),
             (s*(half_width-.016),y-.17,z+.12)]
        beam(r,"webbing",pts[0],pts[1],.06,.018,RUBBER)
        beam(r,"loose_end",pts[1],pts[2],.06,.018,RUBBER)
        cbox(r,"buckle",(.069,.036,.024),pts[2],STEEL,.005)


def regeneration_chamber(r, opened):
    turned(r,"sump",0,0,[(0,.57),(.05,.64),(.12,.65),(.17,.61),(.42,.62),(.50,.56)],IVORY)
    turned(r,"crown",0,0,[(2.10,.57),(2.15,.62),(2.26,.60),(2.38,.50),(2.47,.31),(2.50,.18)],IVORY)
    for y in (.50,2.10):
        hoop(r,"seal",(0,y,0),.55,.035,DARK)
        hoop(r,"light_guide",(0,y,0),.586,.011,DARK if opened else GREEN)
    for s in (-1,1):
        rod(r,"guide",(s*.42,.45,-.30),(s*.42,2.18,-.30),.039,STEEL,16)
    # Druga połówka jedzie po łuku na tył i odsuwa się od nieruchomej szyby.
    for sliding in (False,True):
        shift=-.385 if opened and sliding else 0
        offset=math.pi if not sliding or opened else 0
        rings=[[(.548*math.cos(offset+i*math.pi/24),y,shift+.548*math.sin(offset+i*math.pi/24))
                for i in range(25)] for y in (.51,2.09)]
        surface(r,"sliding_glass" if sliding else "fixed_glass",rings[0]+rings[1],
                [(i,i+1,i+26,i+25) for i in range(24)],GLASS)
        for row in rings:
            tube(r,"glass_rim",row,.017,STEEL,8)
    panel(r,"upright_pad",0,1.29,-.23,.51,1.40,.13,.095,VINYL)
    panel(r,"head_pad",0,1.93,-.15,.32,.23,.09,.047,VINYL)
    cbox(r,"heel_rest",(.48,.07,.32),(0,.535,-.12),VINYL,.022)
    for y in (.98,1.48):
        if opened:
            open_straps(r,.21,y,-.16)
        else:
            cbox(r,"belt",(.50,.066,.023),(0,y,-.157),RUBBER,.008)
    for i in range(3):
        x=(i-1)*.105
        end_y=.63+i*.13 if opened else .38
        tube(r,"return_hose",[(x,2.20,-.48),(x,1.98,-.58),(x+.03,1.17,-.57),
                              (x,end_y,-.52)],.025,RUBBER,8)
        rod(r,"coupling",(x,end_y-.03,-.52),(x,end_y+.03,-.52),.034,STEEL,12)
    readout(r,0,.29,.603,.32,.17)


def regen_pod(r):
    regeneration_chamber(r,False)


def regen_pod_open(r):
    regeneration_chamber(r,True)


def calibration_chair(r):
    turned(r,"turntable",0,0,[(0,.47),(.07,.50),(.14,.44),(.17,.27),(.49,.20),(.56,.27)],ALLOY)
    cbox(r,"seat",(.73,.17,.64),(0,.63,.02),VINYL,.065)
    beam(r,"back_shell",(0,.59,-.20),(0,1.56,-.72),.72,.14,IVORY)
    beam(r,"back_pad",(0,.70,-.17),(0,1.53,-.60),.62,.16,VINYL)
    cbox(r,"headrest",(.41,.25,.16),(0,1.61,-.65),VINYL,.058)
    beam(r,"calf_pad",(0,.64,.29),(0,.33,.82),.62,.12,VINYL)
    cbox(r,"footplate",(.68,.07,.24),(0,.30,.88),IVORY,.029)
    for s in (-1,1):
        beam(r,"arm_support",(s*.32,.57,-.08),(s*.46,.93,.03),.08,.07,STEEL)
        cbox(r,"wrist_pad",(.18,.078,.50),(s*.46,.95,.14),VINYL,.026)
        arc=[(s*.46+.082*math.cos(i*math.pi/12),1.036+.082*math.sin(i*math.pi/12),.27)
             for i in range(4,22)]
        tube(r,"wrist_cuff",arc,.014,STEEL,8)
        tube(r,"cable",[(s*.18,1.5,-.73),(s*.24,1.03,-.88),(s*.23,.18,-.96),
                         (s*.17,.023,-.97),(s*.14,.023,-.38)],.023,RUBBER,8)
    tube(r,"halo_boom",[(0,1.41,-.65),(0,1.64,-.83),(0,2.14,-.80),(0,2.14,-.52)],.04,STEEL,12)
    hoop(r,"halo",(0,1.94,-.51),.24,.020,IVORY,"z")
    hoop(r,"calibration_coil",(0,1.94,-.493),.232,.008,VIOLET,"z")


def kamerton_cradle(r):
    turned(r,"dais",0,0,[(0,1.24),(.055,1.30),(.15,1.30),(.19,1.23),(.19,1.11),
                          (.29,1.08),(.33,.99)],IVORY,48)
    hoop(r,"step_nosing",(0,.16,0),1.257,.019,STEEL)
    for i in range(3):
        a=(i+.5)*math.tau/3
        sections=[]
        for j in range(21):
            t=j/20
            rad=.89+.27*math.sin(t*math.pi)-.63*t**3
            y=.30+2.76*t
            sections.append([((rad+dr)*math.cos(a)-dw*math.sin(a),y,
                              (rad+dr)*math.sin(a)+dw*math.cos(a))
                             for dr,dw in ((-.055,-.09),(.055,-.09),(.08,-.06),
                                           (.08,.06),(.055,.09),(-.055,.09))])
        ba._city_hull(r,"curved_stanchion",sections,IVORY)
        tube(r,"inner_conduit",[row[0] for row in sections],.025,STEEL,8)
    turned(r,"coronet",0,0,[(2.98,.28),(3.04,.36),(3.14,.34),(3.23,.22),(3.30,.14)],ALLOY)
    hoop(r,"resonator",(0,3.047,0),.36,.014,VIOLET)
    turned(r,"bed_socket",0,-.14,[(.32,.28),(.55,.20),(.67,.14)],STEEL)
    panel(r,"patient_form",0,1.36,-.14,.54,1.43,.18,.13,VINYL)
    panel(r,"neck_support",0,2.09,-.11,.32,.25,.15,.06,IVORY)
    for y in (1.07,1.64):
        open_straps(r,.24,y,-.05)
    for i in range(9):
        a=math.tau*(i+.5)/9
        def p(rad,y,turn=0):
            return (rad*math.cos(a+turn),y,rad*math.sin(a+turn))
        rod(r,"socket",p(.98,.27),p(1.025,.27),.058,ALLOY,12)
        tube(r,"umbilical",[p(1.01,.27),p(1.12,.20,.03),p(1.22,.17,.06),
                            p(1.27,.13,.08),p(1.28,.028,.13)],.021,RUBBER,8)
    beam(r,"lectern",(0,.27,.87),(0,1.0,.99),.088,.07,STEEL)
    panel(r,"plaque_frame",0,1,1,.50,.25,.05,.018,ALLOY)
    panel(r,"plaque_blank",0,1,1.027,.468,.216,.008,.011,IVORY)


def pharmacy_dispenser(r):
    cbox(r,"cabinet",(2.4,2.40,.452),(0,1.2,-.196),IVORY,.065)
    for x in (-1.135,1.135):
        cbox(r,"cheek",(.13,2.26,.78),(x,1.16,0),IVORY,.038)
    for y,h in ((.46,.85),(2.25,.30)):
        cbox(r,"fascia",(2.32,h,.86),(0,y,.02),IVORY,.04)
    for y in (1.08,1.56):
        cbox(r,"rack",(2.14,.055,.35),(0,y,.21),STEEL,.014)
        for j in range(6):
            x=(j-2.5)*.29
            turned(r,"dose_cartridge",x,.21,[(y+.028,.053),(y+.06,.081),(y+.24,.081),
                                             (y+.28,.053),(y+.29,.053)],VINYL if j%2 else IVORY,16)
    cbox(r,"window",(2.18,1.22,.013),(0,1.493,.415),GLASS)
    rod(r,"feeder_rail",(-1.05,2.03,.31),(1.05,2.03,.31),.028,STEEL,16)
    tube(r,"feeder",[(.68,2.03,.31),(.68,1.86,.32),(.48,1.78,.34)],.042,ALLOY,10)
    for x in (-.75,-.20,.35):
        panel(r,"drawer",x,.48,.454,.50,.40,.014,.025,DARK)
        panel(r,"drawer_flap",x,.50,.464,.45,.31,.010,.018,VINYL)
    readout(r,.85,.52,.453,.42,.31)
    for w,h in ((.18,.028),(.028,.18)):
        quad(r,"pharmacy_cross",(0,2.25,.451),w,h,"+z",GREEN)


def implant_showcase(r):
    turned(r,"pedestal",0,0,[(0,.48),(.07,.5),(.13,.44),(.67,.38),(.72,.47),(.78,.48)],IVORY)
    turned(r,"lightwell",0,0,[(.78,.45),(.80,.45)],WHITE)
    turned(r,"bell_glass",0,0,[(.79,.45),(1.95,.45),(2.05,.40),(2.10,.32)],GLASS)
    for y in (.81,1.96):
        hoop(r,"retainer",(0,y,0),.45,.012,STEEL)
    turned(r,"display_mount",0,0,[(.80,.19),(.85,.17),(.87,.045),(1.03,.045)],DARK)
    rod(r,"forearm",(0,1,.01),(-.08,1.44,0),.097,STEEL,20,.062)
    for s in (-1,1):
        rod(r,"tendon",(s*.064,1.06,.057),(-.08+s*.045,1.43,.043),.017,ALLOY,12)
    rod(r,"wrist",(-.08,1.41,0),(-.08,1.50,0),.063,DARK,16)
    panel(r,"palm",-.08,1.56,0,.22,.20,.094,.032,ALLOY)
    for i in range(5):
        thumb=i==4
        x=.023 if thumb else -.164+i*.052
        y=1.56 if thumb else 1.648
        dx=.080 if thumb else (i-1.5)*.019
        dy=.058 if thumb else .109-abs(i-1)*.016
        a,b,c=(x,y,.006),(x+dx,y+dy,.025),(x+dx*1.2,y+dy*1.64,.066)
        rod(r,"proximal",a,b,.021,STEEL,12,.017)
        rod(r,"knuckle",(b[0]-.019,b[1],b[2]),(b[0]+.019,b[1],b[2]),.019,DARK,12)
        rod(r,"distal",b,c,.017,STEEL,12,.011)


def lab_analyzer_bench(r):
    for x in (-.83,.83):
        cbox(r,"plinth",(.59,.09,.65),(x,.045,0),DARK,.018)
        cbox(r,"cabinet",(.66,.70,.73),(x,.43,0),IVORY,.034)
        for y in (.29,.56):
            panel(r,"drawer",x,y,.369,.57,.22,.016,.016,VINYL)
            cbox(r,"pull",(.20,.021,.029),(x,y+.07,.38),STEEL,.005)
    cbox(r,"worktop",(2.4,.09,.8),(0,.815,0),IVORY,.032)
    turned(r,"centrifuge",-.66,0,[(.86,.28),(.91,.31),(1.08,.30),(1.14,.26)],ALLOY)
    turned(r,"rotor",-.66,0,[(1.14,.18),(1.18,.21)],DARK)
    for j in range(8):
        a=j*math.tau/8
        x,z=-.66+.155*math.cos(a),.155*math.sin(a)
        rod(r,"ampoule",(x,1.17,z),(x,1.27,z),.030,VINYL,12)
    turned(r,"dust_cover",-.66,0,[(1.14,.27),(1.27,.26),(1.35,.20),(1.38,.13)],GLASS)
    cbox(r,"scope_base",(.35,.055,.32),(.06,.887,0),ALLOY,.018)
    tube(r,"scope_back",[(.06,.90,-.07),(.06,.98,-.13),(.06,1.26,-.14),(.06,1.32,-.05)],.051,IVORY,12)
    rod(r,"ocular",(.06,1.24,.04),(.06,1.48,-.11),.037,DARK,16)
    rod(r,"objective",(.06,1.30,-.02),(.06,1.16,.063),.033,STEEL,16)
    cbox(r,"stage",(.23,.03,.19),(.06,1.03,-.047),DARK,.01)
    cbox(r,"vial_rack",(.47,.11,.21),(.78,.915,0),ALLOY,.019)
    for i in range(4):
        x=.61+i*.11
        turned(r,"sample",x,0,[(.96,.032),(1.16,.032),(1.16,.039),(1.19,.039)],GLASS,16)


def med_cart(r):
    casters(r,.21,.32,.055)
    cbox(r,"trolley",(.56,.49,.66),(0,.37,-.03),IVORY,.036)
    for y in (.215,.363,.51):
        panel(r,"drawer",0,y,.304,.48,.127,.018,.013,VINYL)
        cbox(r,"pull",(.21,.022,.04),(0,y+.027,.322),STEEL,.006)
    cbox(r,"tray",(.60,.044,.78),(0,.634,-.06),STEEL,.018)
    for x in (-.279,.279):
        cbox(r,"raised_edge",(.032,.035,.75),(x,.664,-.06),IVORY,.01)
    tube(r,"push_bar",[(-.24,.57,.29),(-.24,.59,.429),(.24,.59,.429),(.24,.57,.29)],.021,STEEL,12)
    tube(r,"iv_hook",[(.20,.62,-.33),(.20,.986,-.33),(.045,.986,-.33),(.045,.956,-.33)],.014,ALLOY,10)
    panel(r,"infusion_bag",.045,.883,-.33,.115,.15,.047,.025,GLASS)
    panel(r,"fluid",.045,.86,-.33,.093,.085,.035,.014,VINYL)
    tube(r,"drip_line",[(.045,.809,-.33),(.05,.69,-.28),(.13,.658,-.18)],.007,RUBBER,6)


def info_totem(r):
    cbox(r,"weighted_foot",(.8,.095,.30),(0,.0475,0),ALLOY,.031)
    panel(r,"pedestal",0,.85,-.024,.52,1.55,.16,.09,STEEL)
    panel(r,"monolith",0,1.18,0,.76,2.04,.19,.072,IVORY)
    panel(r,"screen_recess",0,1.43,.096,.66,1.16,.019,.032,DARK)
    panel(r,"blank_display",0,1.43,.107,.60,1.095,.012,.022,"mat_glass")
    panel(r,"status_line",0,.787,.098,.48,.014,.012,.005,BLUE)
    panel(r,"reader",.13,.66,.10,.18,.11,.022,.017,ALLOY)
    for i in range(5):
        panel(r,"speaker_slot",-.21+i*.036,.65,.097,.012,.062,.010,.004,DARK)


def planter_bio(r):
    turned(r,"bowl",0,0,[(0,.72),(.07,.77),(.13,.76),(.43,.95),(.52,1.11),(.59,1.13)],IVORY,48)
    hoop(r,"underseat",(0,.50,0),1.076,.014,WHITE)
    # Siedzisko ma otwór, przez który widać ziemię i nasady roślin.
    for i in range(8):
        sections=[]
        for j in range(7):
            a=math.tau*(i+(j+.025)/6.05)/8
            sections.append([(rad*math.cos(a),h,rad*math.sin(a)) for rad,h in
                             ((.77,.57),(1.15,.54),(1.20,.57),(1.20,.64),(1.16,.67),(.79,.67),(.76,.64))])
        ba._city_hull(r,"seat_sector",sections,VINYL)
    turned(r,"soil",0,0,[(.59,.77),(.65,.76)],DARK)
    olive="mat_container_olive"
    for i in range(13):
        a=i*2.39996
        length=.80 if i<8 else .48
        height=.55+(i%4)*.075 if i<8 else 1.25-(i-8)*.06
        def leafpoint(t,side=0,lift=0):
            radial=.06+length*t
            return (radial*math.cos(a)-side*math.sin(a),.65+height*(1.5*t-.5*t*t)+lift,
                    radial*math.sin(a)+side*math.cos(a))
        tube(r,"frond_stem",[leafpoint(j/8) for j in range(9)],.010,olive,6)
        verts,faces=[],[]
        for j in range(2,9):
            t=j/10
            span=(.12 if i<8 else .085)*math.sin(math.pi*t)
            for s in (-1,1):
                k=len(verts)
                verts.extend((leafpoint(t),leafpoint(t+.059,s*span*.51,.021),
                              leafpoint(t+.11,s*span),leafpoint(t+.035,s*span*.54,-.012)))
                faces.extend(((k,k+1,k+2),(k,k+2,k+3)))
        surface(r,"pinnate_leaves",verts,faces,olive)
    for i in range(6):
        a=i*2.4
        x,z=.27*math.cos(a),.27*math.sin(a)
        tube(r,"shrub_branch",[(.02,.64,0),(x*.45,.89,z*.45),(x,1.10,z)],.021,olive,8)
        turned(r,"shrub_crown",x,z,[(1.05,.06),(1.12,.16),(1.25,.19),(1.37,.12),
                                    (1.41,.035)],olive,10)


def helix_sculpture(r):
    turned(r,"drum",0,0,[(0,1.38),(.07,1.50),(.17,1.50),(.21,1.44),(.75,1.44),
                          (.82,1.50),(.88,1.47),(.90,1.38)],IVORY,64)
    hoop(r,"base_inlay",(0,.24,0),1.444,.014,STEEL)
    turned(r,"mast",0,0,[(.90,.14),(1.08,.09),(7.81,.05),(8,.027)],ALLOY)
    for phase in (0,math.pi):
        rings=[]
        for j in range(97):
            a=phase+2*math.tau*j/96
            y=.89+6.91*j/96
            rings.append([(rad*math.cos(a),y+dy,rad*math.sin(a))
                          for rad,dy in ((.95,-.08),(1.05,-.08),(1.07,-.054),
                                         (1.07,.054),(1.05,.08),(.95,.08))])
        ba._city_hull(r,"helical_ribbon",rings,STEEL)
    for j in range(16):
        t=(j+.23)/16
        a=2*math.tau*t
        x,z=math.cos(a),math.sin(a)
        y=.89+6.91*t
        rod(r,"crosslink",(-x,y,-z),(x,y,z),.032,ALLOY,12)
        for s in (-1,1):
            rad=.118
            turned(r,"node",s*x,s*z,[(y+rad*math.sin(k*math.pi/6),
                   max(.003,rad*math.cos(k*math.pi/6))) for k in range(-3,4)],
                   BLUE if j%2 else WHITE,16)


NEW_BUILDERS = (door_portal, curtain_wall_frame, glass_balustrade, ceiling_panel,
                operating_table, surgical_robot, resonance_scanner, regen_pod, regen_pod_open,
                calibration_chair, kamerton_cradle, pharmacy_dispenser, implant_showcase,
                lab_analyzer_bench, med_cart, info_totem, planter_bio, helix_sculpture)
BUILDERS = (reception_counter, waiting_seats, entry_scanner, treatment_screen,
            treatment_bed, sample_fridge, freight_lift_frame, *NEW_BUILDERS)


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
        if build in NEW_BUILDERS:
            ba.PALETTE[WHITE] = ba.PALETTE[LENS]
            glass.surface_render_method = "BLENDED"
            for mat,rough,metal in ((STEEL,.31,.72),(ALLOY,.37,.56),(IVORY,.43,.05),(VINYL,.70,0)):
                shader = ba.material(mat).node_tree.nodes["Principled BSDF"]
                shader.inputs["Roughness"].default_value = rough
                shader.inputs["Metallic"].default_value = metal
        build(root)
        if build in NEW_BUILDERS:
            ba.bpy.context.view_layer.update()
            points = [o.matrix_world @ v.co for o in root.children for v in o.data.vertices]
            offset = ba.Vector([-(min(p[k] for p in points)+max(p[k] for p in points))/2
                                for k in (0,1)] + [-min(p.z for p in points)])
            for o in root.children:
                o.location += offset
        ba._port_merge(root,{})
        ba.export_glb(root,str(REPO / f"public/assets/models/city/{name}.glb"),animations=False)
        if not args.no_preview:
            previews(root,folder)


if __name__ == "__main__":
    main()
