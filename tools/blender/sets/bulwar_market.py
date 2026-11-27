"""Nocny targ pod estakadą. Wymiary w metrach glTF, przód +Z."""
import argparse
import math
import sys
from contextlib import contextmanager
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from bulwar_clinic import REPO, GLASS, turned
from warehouse_kurogane import ba, beam, cbox, panel, previews, rod, surface, tube
from warehouse_kurogane import STEEL, DARK, ALLOY, RUBBER, NAVY

WOOD, OLIVE, OCHRE = "mat_wood", "mat_container_olive", "mat_container_ochre"
PAPER, WHITE, AMBER = "mat_plaster", "mat_light_panel", "mat_neon_amber"
BLUE, PLASTIC = "mat_neon_blue", "mat_plastic"
IVORY = "mat_clinic_laminate"
TAU = math.tau


@contextmanager
def component(root, name):
    """Złóż detale jednej ruchomej lub prefabrykowanej części przed eksportem."""
    previous = set(root.children)
    yield
    pieces = sorted(set(root.children)-previous, key=lambda o:o.name)
    ba.bpy.ops.object.select_all(action="DESELECT")
    for piece in pieces:
        piece.select_set(True)
    ba.bpy.context.view_layer.objects.active = pieces[0]
    ba.bpy.ops.object.join()
    pieces[0].name = name


def box(r, name, x, y, z, w, h, d, mat, bevel=0):
    return cbox(r, name, (w, h, d), (x, y, z), mat, bevel)


def boards(r, x, y, z, w, d, n, thick=.06):
    for i in range(n):
        box(r, "plank", x, y, z + d*((i+.5)/n-.5), w, thick, d/n-.008, WOOD, .004)


def table(r, w, h, d, mat=WOOD, bottom=0):
    for x in (-w/2+.08, w/2-.08):
        for z in (-d/2+.08, d/2-.08):
            box(r, "leg", x, (h+bottom)/2, z, .09, h-bottom, .09, mat)
        box(r, "end_rail", x, h-.07, 0, .08, .11, d-.09, mat)
    for z in (-d/2+.08, d/2-.08):
        box(r, "apron", 0, h-.09, z, w-.12, .13, .055, mat)
    if mat == WOOD:
        boards(r, 0, h-.03, 0, w, d, 5)
    else:
        box(r, "worktop", 0, h-.03, 0, w, .06, d, mat, .015)


def frame(r, x, y, z, w, h, border, mat, face=DARK):
    box(r, "sign_back", x, y, z, w, h, .045, face)
    for s in (-1, 1):
        box(r, "jamb", x+s*(w-border)/2, y, z+.031, border, h, .045, mat)
        box(r, "lip", x, y+s*(h-border)/2, z+.031, w-2*border, border, .045, mat)


def skin(r, name, nx, ny, point, mat, offset):
    """Dwustronne poszycie z zamkniętym brzegiem."""
    pts = [point(i/nx, j/ny) for j in range(ny+1) for i in range(nx+1)]
    n = len(pts)
    verts = pts + [tuple(a+b for a,b in zip(p,offset)) for p in pts]
    faces = []
    for j in range(ny):
        for i in range(nx):
            a = j*(nx+1)+i
            q = (a,a+1,a+nx+2,a+nx+1)
            faces.extend((q, tuple(k+n for k in reversed(q))))
    edge = (list(range(nx+1)) + [j*(nx+1)+nx for j in range(1,ny+1)]
            + list(range(n-2,n-nx-2,-1)) + [j*(nx+1) for j in range(ny-1,0,-1)])
    for a,b in zip(edge,edge[1:]+edge[:1]):
        faces.append((a,b,b+n,a+n))
    surface(r,name,verts,faces,mat)


def roof(r, w, y, d, mat):
    waves = round(w*5)
    skin(r,"corrugated_roof",waves*6,2,
         lambda u,v: ((u-.5)*w,y-.12*v-.014*(1-math.cos(TAU*waves*u)),(v-.5)*d),
         mat,(0,-.014,0))


def pot(r, x, y, z, radius, h, lid=False, mat=ALLOY):
    profile = [(0,.64),(.09,.8),(.64,.98),(.92,1),(1,1.02),(1,.91),(.18,.72)]
    turned(r,"vessel",x,z,[(y+b*h,a*radius) for b,a in profile],mat,20)
    if lid:
        turned(r,"domed_lid",x,z,[(y+h,radius),(y+h*1.13,radius*.82),
               (y+h*1.23,radius*.2),(y+h*1.32,radius*.14)],STEEL,20)


def lamp(r, x, bottom, z, scale, mat, stitched=True):
    def profile(name, points, material, sides):
        turned(r,name,x,z,[(bottom+h*scale,rad*scale) for h,rad in points],material,sides)
    # Szwy papieru: naprzemienne grzbiety i wklęsłe załamania jednego klosza.
    ribs = []
    for i in range(15):
        u = i/14
        ribs.append((.15+.47*u, .145+.105*math.sin(math.pi*u)-.018*(i%2)))
    profile("pleated_paper",ribs,mat,8)
    for y in (.14,.62):
        profile("binding",[(y,.15),(y+.024,.15)],DARK,8)
    profile("silk_tassel",[(0,.031),(.082,.014),(.11,.03),(.14,.012)],OCHRE,6)
    profile("cord",[(.644,.009),(.9,.009)],RUBBER,4)
    for i in range(10 if stitched else 0):
        a=TAU*i/10
        px=x+.14*scale*math.cos(a)
        pz=z+.14*scale*math.sin(a)
        py=bottom+.628*scale
        d=.015*scale
        surface(r,"binding_knot",[(px-d,py,pz),(px+d,py,pz),(px,py+d,pz+d),
                (px,py+d,pz-d)],[(0,1,2),(1,0,3),(0,2,3),(1,3,2)],OCHRE)


def targ_paper_lantern(r):
    lamp(r,0,0,0,1,WHITE)


def targ_paper_lantern_amber(r):
    lamp(r,0,0,0,1,AMBER)


def targ_gate(r):
    for s in (-1,1):
        x = 3.44*s
        box(r,"shoe",x,.11,0,.82,.22,1,DARK,.02)
        for dx in (-.30,.30):
            for z in (-.32,.32):
                top=5.47+max(0,abs(x+dx)-3.18)*.46
                box(r,"chord",x+dx,(top+.10)/2,z,.1,top-.10,.1,STEEL)
        for i in range(6):
            a=x+(-1)**i*.30
            beam(r,"lattice",(a,.18+i*.84,.33),(2*x-a,1.02+i*.84,.33),.08,.065,OCHRE)
            box(r,"gusset",a,.22+i*.84,.36,.16,.17,.03,ALLOY)
        for j in range(4):
            box(r,"cladding",x, .46+j*.26,.39,.68,.235,.055,WOOD)
        for i in range(3):
            with component(r,"side_lantern"):
                lamp(r,x,1.65+i*.91,.40,.65,AMBER if i%2==0 else WHITE,False)
            rod(r,"hook",(x,2.235+i*.91,.26),(x,2.235+i*.91,.4),.028,STEEL)
        for dx in (-.12,.02):
            tube(r,"loom",[(x+dx,.25,-.36),(x+dx-.12,2,-.38),(x+dx,4.8,-.36),
                           (s*2.5,5.36,-.27),(0,5.33,-.24)],.032,RUBBER)
    frame(r,0,4.74,.12,5,1,.075,OCHRE)
    for x in (-2.2,2.2):
        box(r,"hanger",x,5.29,.12,.07,.26,.07,STEEL)
    for z in (-.26,.24):
        box(r,"lintel",0,5.48,z,6.5,.28,.32,WOOD,.025)
        for s in (-1,1):
            beam(r,"raised_eave",(s*3.18,5.48,z),(s*3.95,5.84,z),.33,.26,WOOD)
    for i in range(13):
        x=(i-6)*.61
        box(r,"roof_batten",x,5.65+max(0,abs(x)-3.14)*.48,0,.53,.09,.94,OLIVE)
    skin(r,"folded_cap",96,2,lambda u,v: ((u-.5)*8,
         5.725+.38*max(0,abs((u-.5)*8)-3.21)-.028*v+.012*math.cos(TAU*24*u),
         (v-.5)*.99),OLIVE,(0,-.02,0))


def targ_noodle_cart(r):
    table(r,2.36,1.04,1.22,bottom=.29)
    for x in (-1.02,1.02):
        for z in (-.48,.48):
            rod(r,"wheel",(x,.17,z-.056),(x,.17,z+.056),.17,RUBBER,16)
            rod(r,"hub",(x,.17,z-.06),(x,.17,z+.06),.067,OCHRE,12)
            rod(r,"canopy_post",(x,1,z),(x,2.45-.1*(z+.5),z),.035,STEEL)
    for i in range(5):
        box(r,"cart_siding",0,.40+i*.138,.55,2.27,.13,.06,WOOD)
    frame(r,.53,.72,.60,.8,.5,.035,OCHRE)
    for i,x in enumerate((-.72,-.02,.69)):
        turned(r,"burner",x,0,[(1.04,.19),(1.12,.22)],DARK,16)
        pot(r,x,1.12,0,.29,.3,i<2)
        for s in (-1,1):
            box(r,"ear_handle",x+s*.285,1.35,0,.08,.043,.12,DARK)
    roof(r,2.6,2.5,1.5,OCHRE)
    tube(r,"ladle_stem",[(-.9,2.39,.48),(-.9,2.28,.54),(-.91,1.88,.55)],.015,STEEL)
    pot(r,-.91,1.81,.55,.085,.08)


def targ_wok_station(r):
    table(r,1.8,.93,.9,STEEL)
    for x in (-.43,.42):
        turned(r,"burner",x,.04,[(.93,.21),(1.01,.22)],DARK,16)
        pot(r,x,1.01,.04,.31,.14,mat=DARK)
        beam(r,"wok_handle",(x,1.13,.31),(x+.05,1.19,.44),.057,.04,WOOD)
    for x in (-.77,.77):
        rod(r,"hood_post",(x,.91,-.36),(x,1.71,-.36),.035,STEEL)
    cbox(r,"extractor",(1.74,.23,.82),(0,1.78,-.02),ALLOY,.015,(.62,.5))
    for x in (-.56,-.28,0,.28,.56):
        box(r,"filter",x,1.68,.37,.18,.045,.04,DARK)
    turned(r,"flue",0,-.15,[(1.89,.13),(2.1,.13)],STEEL,16)
    turned(r,"gas_bottle",.57,.06,[(0,.15),(.07,.20),(.55,.20),(.64,.16),(.68,.07)],OCHRE,20)
    turned(r,"valve",.57,.06,[(.68,.04),(.73,.055)],ALLOY,12)
    tube(r,"gas_hose",[(.57,.72,.06),(.4,.65,.13),(.30,.38,.1),(.18,.5,-.12),(.18,.91,-.12)],.024,RUBBER)


def targ_stool_set(r):
    for x,z,mat in ((-.62,0,OCHRE),(.62,0,OLIVE),(0,-.62,NAVY),(0,.62,OCHRE)):
        cbox(r,"seat",(.36,.055,.36),(x,.285,z),mat,.018)
        for a in (-1,1):
            for b in (-1,1):
                beam(r,"splayed_leg",(x+a*.156,.012,z+b*.156),(x+a*.11,.27,z+b*.11),.04,.048,mat)
    for x in (-.23,.23):
        for z in (-.23,.23):
            box(r,"corner",x,.17,z,.055,.34,.055,DARK)
    for h in (.08,.23):
        for z in (-.23,.23):
            box(r,"slat",0,h,z,.46,.086,.036,OLIVE)
    boards(r,0,.345,0,.55,.54,3,.04)
    for x in (-.105,.105):
        pot(r,x,.365,0,.089,.135,mat=PAPER)
        for z in (.10,.13):
            rod(r,"chopstick",(x-.09,.37,z),(x+.09,.37,z+.025),.006,WOOD,4)


def targ_tarp_canopy(r):
    def cloth(u,v):
        sag = .44*math.sin(math.pi*u)+.23*math.sin(math.pi*v)
        fold = .075*math.sin(TAU*(4*u+.36*v))*math.sin(math.pi*v)
        return ((u-.5)*3.8,3.6-.10*u-.07*v-sag+fold,(v-.5)*2.8)
    skin(r,"patched_canvas",32,18,cloth,OLIVE,(0,-.014,0))
    for u in (0,1):
        for v in (0,1):
            x,y,z=cloth(u,v)
            rod(r,"upright",(x,0,z),(x,y,z),.044,STEEL,10)
            rod(r,"binding",(x,y-.11,z),(x,y-.065,z),.062,OCHRE,10)
            rod(r,"guy",(x,y-.06,z),(x/.95,.09,z/.94),.011,RUBBER)
            box(r,"stake",x/.95,.07,z/.94,.04,.14,.04,STEEL)
    for u in (.28,.74):
        tube(r,"canvas_seam",[cloth(u,j/16) for j in range(17)],.013,OCHRE,5)
    x,y,z=cloth(.5,.5)
    lamp(r,x,y-.9,z,1,WHITE)


def fish(r,x,y,z,length,angle,dried=False):
    """Wrzeciono, płetwy i rozwidlony ogon we wspólnym układzie lokalnym."""
    def point(a,b,c):
        if not dried:
            b,c=.66*b+.75*c,-.75*b+.66*c
        return (x+length*(a*math.cos(angle)-b*math.sin(angle)),
                y+length*(a*math.sin(angle)+b*math.cos(angle)),z+c*length)
    rings=[]
    for a,h,d in ((-.34,.032,.024),(-.23,.092,.06),(.02,.143,.1),(.23,.105,.078),(.34,.025,.032)):
        rings.append([point(a,h*math.cos(TAU*i/8),d*math.sin(TAU*i/8)) for i in range(8)])
    ba._city_hull(r,"fish_body",rings,OCHRE if dried else ALLOY)
    for outline in (((-.29,0),(-.49,.14),(-.445,0),(-.49,-.14)),
                    ((-.17,.09),(-.09,.205),(.11,.13))):
        ba._city_hull(r,"fin",[[point(a,b,c) for a,b in outline] for c in (-.012,.012)],
                      WOOD if dried else NAVY)
    rod(r,"eye",point(.216,.034,.058),point(.216,.034,.082),.024*length,DARK,8)


def targ_fish_table(r):
    table(r,2.4,.70,1.2)
    def bed(z):
        return .778-.105*z
    ba._port_box(r,"sloped_tray",(1.65,.075,1.10),(-.32,.738,0),STEEL,pitch=6)
    for z in (-.53,.53):
        box(r,"tray_wall",-.32,bed(z)+.022,z,1.67,.11,.045,ALLOY)
    for x in (-1.14,.50):
        beam(r,"tray_rim",(x,bed(-.53)+.022,-.53),(x,bed(.53)+.022,.53),.045,.11,ALLOY)
    for j,z in enumerate((-.32,0,.32)):
        for i in range(3):
            x = -.83+i*.49+.035*(j%2)
            with component(r,"fresh_fish"):
                fish(r,x,bed(z)+.066,z,.55,.085*(-1)**(i+j))
            for s in (-1,1):
                phase=2*i+3*j+s
                cx=x+s*(.12+.024*math.sin(phase))
                cz=z+.104+.023*math.cos(phase)
                rad=.047+.012*math.cos(phase)
                turned(r,"chipped_ice",cx,cz,[(bed(cz)-.012,.72*rad),
                       (bed(cz)+.031,rad),(bed(cz)+.054,.43*rad)],IVORY,5)
    box(r,"scale",.84,.78,-.23,.46,.16,.43,OLIVE,.018)
    turned(r,"scale_pan",.84,-.23,[(.86,.09),(.91,.18),(.95,.21)],STEEL,20)
    frame(r,.84,.812,.004,.28,.10,.012,ALLOY,PAPER)
    pot(r,.85,.70,.265,.195,.40,mat=PLASTIC)


def hand(r,x,y,z,scale):
    def p(a,b,c):
        return (x+a*scale,y+b*scale,z+c*scale)
    cbox(r,"palm",(.17*scale,.19*scale,.08*scale),p(0,-.09,0),ALLOY,.016*scale)
    rod(r,"wrist",p(0,0,0),p(0,.055,0),.054*scale,DARK,10)
    for i in range(4):
        dx=(i-1.5)*.043
        tube(r,"digit",[p(dx,-.166,0),p(dx*1.23,-.245,.008),
                        p(dx*1.24,-.31+.016*abs(i-1),.046)],.018*scale,STEEL,6)
    tube(r,"thumb",[p(-.075,-.05,0),p(-.128,-.105,.028),p(-.13,-.17,.062)],.026*scale,STEEL,6)


def targ_hanging_rack(r):
    rod(r,"rail",(-1.20,1.18,0),(1.2,1.18,0),.043,STEEL,12)
    for x in (-.96,.96):
        turned(r,"ceiling_plate",x,0,[(1.56,.15),(1.60,.15)],DARK,12)
        rod(r,"suspension",(x,1.18,0),(x,1.57,0),.025,STEEL,8)
    for i,x in enumerate((-.98,-.61,-.22,.19,.58,.98)):
        h=.87-.07*(i%3)
        tube(r,"hook",[(x,1.18,-.04),(x,1.24,0),(x,1.18,.046),(x,h,.05),
                       (x+.043,h-.046,.05),(x+.089,h,.05)],.019,ALLOY,8)
        if i in (1,4):
            hand(r,x+.06,h-.10,.05,1.65)
        else:
            fish(r,x+.052,h-.285,.05,.82,-1.48,True)


def targ_cold_door(r):
    box(r,"top_track",0,2.53,0,2.4,.14,.28,STEEL,.014)
    box(r,"threshold",0,.034,0,2.4,.068,.29,STEEL)
    box(r,"strip_shadow",.91,1.26,-.093,.54,2.40,.042,DARK)
    for i in range(5):
        box(r,"pvc_strip",.685+i*.108,1.27,-.045+.01*(i%2),.101,2.41,.022,PLASTIC,.008)
    box(r,"seal",-.27,1.26,-.06,1.83,2.46,.14,RUBBER,.032)
    panel(r,"insulated_leaf",-.27,1.27,.018,1.77,2.39,.15,.065,ALLOY)
    for y in (.41,.46,1.01,2.17):
        box(r,"pressed_rib",-.27,y,.099,1.63,.024,.018,STEEL)
    frame(r,-.25,1.73,.105,.73,.49,.047,DARK,NAVY)
    for x in (-.97,.39):
        rod(r,"roller",(x,2.44,.07),(x,2.44,.132),.086,DARK,12)
    tube(r,"lever",[(.42,1.32,.09),(.42,1.30,.166),(.32,1.06,.166)],.034,OCHRE,10)
    box(r,"indicator",.42,1.53,.108,.06,.085,.018,BLUE)


def targ_parts_stall(r):
    table(r,2.86,.58,1.29)
    for x in (-1.33,1.33):
        for z in (-.56,.56):
            box(r,"post",x,1.51,z,.07,1.87,.07,WOOD)
    for z in (-.01,.58):
        box(r,"case_rail",0,.99,z,2.73,.045,.045,STEEL)
    box(r,"case_lid",0,1,.28,2.68,.024,.58,GLASS)
    box(r,"case_glass",0,.793,.58,2.68,.37,.016,GLASS)
    for x in (-1.325,1.325):
        box(r,"case_end",x,.793,.28,.016,.38,.59,GLASS)
    for x in (-.95,-.46):
        box(r,"support",x,.765,.08,.04,.37,.055,DARK)
        rod(r,"wrist_pin",(x,.90,.08),(x,.90,.22),.024,STEEL)
        hand(r,x,.86,.22,.84)
    for i in range(5):
        x=.04+.25*i
        box(r,"logic_module",x,.623,.28,.18,.086,.28,OLIVE,.012)
        for z in (.19,.32):
            box(r,"socket",x,.67,z,.106,.023,.047,ALLOY)
    for j,y in enumerate((1.12,1.59,2.02)):
        box(r,"stock_shelf",0,y,-.39,2.72,.063,.40,WOOD)
        for i in range(6 if j!=1 else 3):
            x=-1.09+i*.425
            with component(r,"labelled_stock_bin"):
                box(r,"stock_bin",x,y+.143,-.42,.36,.224,.30,(OCHRE,OLIVE,NAVY)[(i+j)%3],.012)
                box(r,"inventory_label",x,y+.14,-.264,.14,.068,.008,PAPER)
    for x in (.26,.66,1.06):
        frame(r,x,1.79,-.32,.34,.32,.025,STEEL,NAVY)
        box(r,"scope_trace",x,1.81,-.292,.21,.013,.008,BLUE)
    for z in (-.56,.56):
        box(r,"purlin",0,2.462-.085*z,z,2.77,.13,.085,WOOD)
    roof(r,3,2.6,1.4,OLIVE)
    tube(r,"lamp_arm",[(-1.33,1.65,-.52),(-1.07,1.96,-.31),(-.86,1.92,.24)],.033,STEEL,8)
    turned(r,"shade",-.86,.24,[(1.76,.14),(1.90,.047),(1.94,.036)],OCHRE,16)
    turned(r,"diffuser",-.86,.24,[(1.75,.119),(1.765,.125)],WHITE,16)
    rod(r,"iron_handle",(.47,1.044,.33),(.71,1.044,.29),.032,DARK,10)
    rod(r,"iron_tip",(.71,1.044,.29),(.85,1.024,.266),.022,STEEL,8,.003)


def targ_drawer_wall(r):
    box(r,"cabinet_back",0,1.22,-.17,3,2.44,.16,WOOD)
    for x in (-1.46,1.46):
        box(r,"stile",x,1.22,-.02,.08,2.44,.45,WOOD)
    for j in range(7):
        y=.22+j*.327
        for i in range(6):
            x=(i-2.5)*.47
            z=.06 if (i+3*j)%13==0 else -.025
            with component(r,"drawer"):
                box(r,"bin",x,y,z,.448,.303,.30,(OLIVE,NAVY,DARK)[(i+2*j)%5%3],.012)
                panel(r,"tag",x,y+.062,z+.153,.16,.055,.008,.008,PAPER)
                box(r,"pull",x,y-.049,z+.167,.18,.033,.053,ALLOY)
    box(r,"cap",0,2.44,0,3,.08,.49,WOOD)
    for i in range(4):
        x=(i-1.5)*.66
        box(r,"carton",x,2.64,-.012,.60,.32,.43,OCHRE if i%2 else OLIVE,.014)
        box(r,"packing_tape",x-.09,2.64,.206,.081,.32,.01,PAPER)


def targ_implant_chair(r):
    turned(r,"pedestal",0,.07,[(0,.37),(.08,.38),(.13,.22),(.17,.16),(.55,.13),(.61,.22)],STEEL,20)
    box(r,"seat_pan",0,.62,.07,.7,.12,.70,ALLOY,.035)
    box(r,"seat",0,.721,.08,.70,.15,.72,RUBBER,.052)
    ba._port_box(r,"back",(.69,.79,.14),(0,1.075,-.37),PLASTIC,pitch=-18)
    ba._port_box(r,"headrest",(.44,.26,.16),(0,1.52,-.50),RUBBER,pitch=-18)
    ba._port_box(r,"leg_pad",(.59,.13,.65),(0,.59,.70),RUBBER,pitch=23)
    box(r,"heel_stop",0,.48,.98,.63,.10,.14,STEEL,.02)
    box(r,"vinyl_patch",-.14,.799,.085,.22,.015,.31,OLIVE,.006)
    for x in (-.38,.38):
        tube(r,"arm_support",[(x,.61,.23),(x,.90,.23),(x,.94,-.19)],.036,STEEL,8)
        box(r,"arm_pad",x,.96,.015,.102,.087,.48,RUBBER,.025)
    rod(r,"tool_column",(-.40,0,-.77),(-.40,2.15,-.77),.052,STEEL,12)
    box(r,"mast_base",-.31,.042,-.55,.38,.084,.93,DARK,.02)
    for i,(x,y,z) in enumerate(((.17,1.76,-.39),(-.04,1.42,-.1),(-.33,1.19,.13))):
        h=1.98-i*.21
        joint=(x-.09,h+.012,-.52)
        tube(r,"articulated_arm",[(-.40,h,-.77),joint,(x,y+.12,z)],.027,ALLOY,8)
        rod(r,"hinge",(joint[0],joint[1],-.55),(joint[0],joint[1],-.49),.057,OCHRE,12)
        rod(r,"tool_grip",(x,y+.13,z),(x,y,z),.035,DARK,10)
        if i==2:
            for s in (-1,1):
                tube(r,"jaw",[(x,y,z),(x+s*.037,y-.045,z),(x+s*.014,y-.083,z)],.009,STEEL)
        else:
            rod(r,"bit",(x,y,z),(x,y-.12,z),.025 if i==0 else .009,STEEL,8,.003)
    tube(r,"lamp_neck",[(-.4,2.10,-.77),(-.35,2.28,-.69),(.05,2.28,-.53),(.12,2.17,-.43)],.023,STEEL,8)
    turned(r,"shade",.12,-.43,[(2.02,.15),(2.14,.065),(2.18,.035)],OLIVE,16)
    turned(r,"lens",.12,-.43,[(2.012,.139),(2.026,.141)],WHITE,16)
    rod(r,"tray_mount",(.32,.64,.08),(.48,.91,.1),.022,ALLOY)
    box(r,"instrument_tray",.48,.919,.10,.24,.032,.42,STEEL,.011)
    for z in (.05,.12):
        rod(r,"file",(.40,.944,z),(.56,.944,z+.03),.011,DARK,6)
    pot(r,.38,0,-.66,.17,.27,mat=ALLOY)


def targ_curtain_screen(r):
    for s in (-1,1):
        x=s*1.14
        box(r,"foot",x,.067,0,.085,.08,.3,DARK)
        for z in (-.10,.10):
            rod(r,"wheel",(x-.028,.044,z),(x+.028,.044,z),.044,RUBBER,10)
        rod(r,"upright",(x,.08,0),(x,2.07,0),.032,STEEL,10)
    rod(r,"rail",(-1.2,2.069,0),(1.2,2.069,0),.031,STEEL,12)
    def pleat(u,v):
        return (-1.08+2.16*u,1.96-1.69*v-.025*v*math.sin(TAU*3*u),
                (.076+.024*v)*math.sin(TAU*(8*u+.08*v)))
    skin(r,"olive_curtain",64,8,pleat,OLIVE,(0,0,-.008))
    for i in range(9):
        x=-1.08+i*.27
        tube(r,"loop",[(x,1.966,0),(x,2.076,-.04),(x,2.108,0),
                       (x,2.076,.04),(x,1.955,.018)],.009,OCHRE,6)
    tube(r,"stitched_hem",[pleat(i/64,.97) for i in range(65)],.008,WOOD,4)


def targ_tea_table(r):
    table(r,1.05,.385,.99)
    for x,z,w,d in ((-.71,0,.38,.52),(.71,0,.38,.52),(0,-.71,.52,.38),(0,.71,.52,.38)):
        cbox(r,"piped_cushion",(w,.045,d),(x,.058,z),OCHRE,.022)
        cbox(r,"stuffed_pad",(w-.006,.105,d-.006),(x,.073,z),OLIVE,.044)
    box(r,"lacquer_tray",0,.409,0,.82,.048,.61,DARK,.014)
    turned(r,"teapot",-.12,0,[(.433,.078),(.456,.11),(.51,.15),(.586,.145),
           (.626,.092),(.641,.08),(.656,.066),(.669,.024)],OCHRE,24)
    tube(r,"bail",[(-.25,.55,0),(-.27,.64,0),(-.20,.69,0),(-.09,.69,0),(.016,.63,0),(.02,.55,0)],.011,DARK,8)
    rod(r,"spout",(-.071,.51,.10),(-.013,.604,.236),.05,OCHRE,16,.025)
    for x,z in ((.21,.15),(.23,-.12),(-.32,-.16)):
        pot(r,x,.433,z,.066,.065,mat=PAPER)


def targ_tea_counter(r):
    table(r,3.6,.99,1)
    for i in range(13):
        x=(i-6)*.269
        box(r,"bar_front",x,.51,.443,.258,.88,.056,WOOD,.004)
    for y in (.14,.86):
        box(r,"binding",0,y,.481,3.52,.058,.036,OCHRE)
    for x in (-1.70,1.70):
        box(r,"rack_post",x,1.66,-.41,.082,1.42,.10,WOOD)
    for j,y in enumerate((1.37,1.88,2.37)):
        box(r,"shelf",0,y,-.31,3.49,.06,.34,WOOD)
        if j==2:
            continue
        for i in range(8):
            x=(i-3.5)*.391
            with component(r,"tea_canister"):
                turned(r,"tea_tin",x,-.32,[(y+.03,.126),(y+.28,.126),(y+.285,.133),(y+.316,.133)],
                       (OLIVE,OCHRE,NAVY)[(i+j)%3],16)
                box(r,"tin_label",x,y+.16,-.195,.084,.105,.013,PAPER)
    for x in (-.81,.69):
        turned(r,"samovar",x,.17,[(.99,.18),(1.045,.20),(1.10,.108),(1.16,.13),
               (1.24,.218),(1.46,.239),(1.56,.18),(1.58,.19),(1.62,.10),(1.65,.043)],OCHRE,24)
        for s in (-1,1):
            tube(r,"urn_grip",[(x+s*.20,1.44,.17),(x+s*.30,1.45,.17),(x+s*.29,1.32,.17),
                               (x+s*.21,1.31,.17)],.022,DARK,6)
        with component(r,"spigot"):
            tube(r,"tap",[(x,1.24,.33),(x,1.24,.47),(x,1.19,.47)],.023,STEEL,8)
            box(r,"tap_key",x,1.27,.435,.092,.025,.028,DARK)
    box(r,"light_hood",0,2.31,-.169,2.90,.077,.094,ALLOY)
    box(r,"strip_lamp",0,2.269,-.169,2.80,.015,.067,WHITE)


def targ_crate_stack(r):
    for j,mat in enumerate((OLIVE,OCHRE,NAVY)):
        x=(0,.026,-.025)[j]
        y=j*.43
        box(r,"floor",x,y+.028,0,1.14,.056,.86,mat)
        for s in (-1,1):
            for t in (-1,1):
                box(r,"corner",x+s*.55,y+.21,t*.40,.07,.42,.08,mat)
            with component(r,"moulded_side"):
                for h in (.12,.26,.40):
                    box(r,"long_slat",x,y+h,s*.406,1.14,.058,.045,mat)
                for a in (-.30,0,.30):
                    box(r,"web",x+a,y+.212,s*.399,.032,.39,.035,mat)
            with component(r,"moulded_end"):
                for h in (.12,.26,.40):
                    box(r,"end_slat",x+s*.55,y+h,0,.047,.058,.83,mat)
        if j==2:
            box(r,"produce_liner",x,1.21,0,1.05,.09,.74,OLIVE)
    for j in range(3):
        for i in range(4):
            x=(i-1.5)*.245+.014*math.cos(i+j)
            z=(j-1)*.24
            turned(r,"squash",x,z,[(1.25,.06),(1.36,.12),(1.47,.054)],
                   OLIVE if (i+j)%3 else OCHRE,6)
            rod(r,"stem",(x,1.46,z),(x+.016,1.50,z),.019,WOOD,5)


def targ_stage(r):
    box(r,"deck_core",0,.57,0,7.91,1.14,4.90,DARK)
    boards(r,0,1.17,0,8,5,14)
    for i in range(10):
        x=(i-4.5)*.79
        with component(r,"stage_panel"):
            panel(r,"skirt",x,.61,2.455,.76,.93,.065,.065,NAVY if i%3 else OLIVE)
            box(r,"skirt_clip",x,.99,2.493,.13,.036,.014,OCHRE)
    for s in (-1,1):
        x=s*3.72
        for dx in (-.15,.15):
            for z in (-1.99,-1.66):
                rod(r,"truss_chord",(x+dx,1.20,z),(x+dx,5.15,z),.043,ALLOY,8)
        for j in range(8):
            dx=(-1)**j*.15
            rod(r,"lattice",(x+dx,1.24+j*.48,-1.66),(x-dx,1.72+j*.48,-1.66),.03,OCHRE)
        frame(r,s*2.33,2.85,-1.77,2.4,3.2,.105,ALLOY,NAVY)
        for dx in (-.78,.78):
            box(r,"screen_foot",s*2.33+dx,1.23,-1.77,.17,.06,.32,STEEL)
        box(r,"speaker",s*3.33,1.69,.93,.64,.98,.57,DARK,.04)
        for y,rad in ((1.52,.229),(1.94,.13)):
            rod(r,"driver",(s*3.33,y,1.21),(s*3.33,y,1.26),rad,STEEL,16,rad*.91)
            rod(r,"dust_cap",(s*3.33,y,1.26),(s*3.33,y,1.29),rad*.44,RUBBER,12)
    for y in (4.79,5.15):
        for z in (-1.99,-1.66):
            rod(r,"cross_chord",(-3.88,y,z),(3.88,y,z),.05,ALLOY,8)
    for i in range(14):
        a=-3.78+i*.54
        rod(r,"cross_web",(a,4.79+.36*(i%2),-1.66),(a+.54,5.15-.36*(i%2),-1.66),.032,OCHRE)
    for x in (-2.88,-1.11,1.11,2.88):
        with component(r,"spotlight"):
            tube(r,"yoke",[(x-.15,4.57,-1.66),(x-.15,4.79,-1.66),
                           (x+.15,4.79,-1.66),(x+.15,4.57,-1.66)],.029,STEEL)
            rod(r,"spot",(x,4.60,-1.76),(x,4.51,-1.43),.142,DARK,16,.165)
            rod(r,"fresnel",(x,4.51,-1.43),(x,4.50,-1.409),.139,WHITE,16)
    box(r,"lectern_foot",0,1.26,.78,.76,.12,.58,STEEL,.025)
    cbox(r,"lectern",(.68,.97,.43),(0,1.78,.78),NAVY,.025,(.81,.89))
    ba._port_box(r,"reading_desk",(.91,.084,.58),(0,2.28,.78),WOOD,pitch=-9)
    box(r,"blue_inlay",0,1.82,.992,.41,.029,.015,BLUE)


def targ_neon_totem(r):
    box(r,"anchor",0,.082,0,.91,.164,.60,DARK,.024)
    box(r,"mast",0,2.83,-.075,.15,5.43,.20,STEEL)
    for i in range(5):
        x=(-1)**i*.125
        y=1.11+i*.94
        for h in (-.23,.23):
            box(r,"bracket",x,y+h,-.043,.71,.053,.22,ALLOY)
        box(r,"lightbox",x,y,.027,.75,.83,.20,(OLIVE,NAVY,OCHRE)[i%3],.023)
        frame(r,x,y,.145,.73,.78,.033,(OCHRE,STEEL)[i%2],DARK)
        box(r,"illuminated_lip",x,y+.327,.173,.61,.025,.014,(AMBER,WHITE,BLUE)[i%3])
        tube(r,"feed",[(x+.21,y-.36,-.079),(x+.19,y-.53,-.14),(0,y-.48,-.19)],.023,RUBBER)
    for x,h in ((-.054,6),(.056,5.82)):
        rod(r,"aerial",(x,5.42,-.08),(x,h,-.08),.016,ALLOY,8,.007)


def targ_shrine(r):
    table(r,.86,.58,.61)
    boards(r,0,.20,0,.78,.54,3)
    box(r,"backboard",0,.985,-.25,.81,.87,.066,WOOD)
    for x in (-.382,.382):
        for z in (-.24,.23):
            box(r,"pillar",x,.995,z,.066,.84,.066,OCHRE)
    for s in (-1,1):
        beam(r,"gable",(0,1.56,0),(s*.49,1.37,0),.7,.064,WOOD)
        beam(r,"fascia",(0,1.54,.332),(s*.49,1.35,.332),.035,.086,OCHRE)
    turned(r,"cat_body",0,-.05,[(.58,.113),(.62,.143),(.76,.122),(.86,.085)],IVORY,16)
    turned(r,"cat_head",0,-.036,[(.83,.065),(.88,.13),(.986,.135),(1.05,.098)],IVORY,16)
    for s in (-1,1):
        rod(r,"ear",(s*.077,1.016,-.05),(s*.105,1.125,-.055),.061,IVORY,8,.006)
        rod(r,"eye",(s*.050,.966,.077),(s*.050,.966,.094),.014,DARK,8)
    rod(r,"nose",(0,.929,.095),(0,.924,.111),.014,OCHRE,8,.008)
    turned(r,"collar",0,-.05,[(.836,.102),(.859,.105)],OLIVE,16)
    tube(r,"raised_paw",[(.073,.73,-.05),(.154,.79,-.024),(.16,.931,.008)],.051,IVORY,10)
    turned(r,"paw",.16,.008,[(.914,.048),(.97,.052),(.994,.037)],IVORY,12)
    for x in (-.274,.274):
        turned(r,"votive",x,.128,[(.58,.053),(.606,.058),(.706,.042)],OCHRE,12)
        turned(r,"flame",x,.128,[(.706,.019),(.73,.029),(.794,.004)],AMBER,10)
    for x in (-.087,.087):
        pot(r,x,.58,.218,.072,.066,mat=NAVY)


BUILDERS = {
    targ_gate:(8,6,1), targ_noodle_cart:(2.6,2.5,1.5), targ_wok_station:(1.8,2.1,.9),
    targ_stool_set:(1.6,.5,1.6), targ_tarp_canopy:(4,3.6,3), targ_fish_table:(2.4,1.1,1.2),
    targ_hanging_rack:(2.4,1.6,.3), targ_cold_door:(2.4,2.6,.3), targ_parts_stall:(3,2.6,1.4),
    targ_drawer_wall:(3,2.8,.5), targ_implant_chair:(1.2,2.3,2.1), targ_curtain_screen:(2.4,2.1,.3),
    targ_tea_table:(1.8,.7,1.8), targ_tea_counter:(3.6,2.4,1), targ_paper_lantern:(.5,.9,.5),
    targ_paper_lantern_amber:(.5,.9,.5), targ_crate_stack:(1.2,1.5,.9), targ_stage:(8,5.2,5),
    targ_neon_totem:(1,6,.6), targ_shrine:(1,1.6,.7),
}


def fit(root, size):
    from mathutils import Matrix, Vector
    ba.bpy.context.view_layer.update()
    points = [o.matrix_world @ v.co for o in root.children for v in o.data.vertices]
    lo = Vector([min(p[i] for p in points) for i in range(3)])
    hi = Vector([max(p[i] for p in points) for i in range(3)])
    origin = Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
    scale = Matrix.Diagonal(Vector((size[0]/(hi.x-lo.x),size[2]/(hi.y-lo.y),
                                    size[1]/(hi.z-lo.z),1)))
    for obj in root.children:
        obj.data.transform(scale @ Matrix.Translation(-origin) @ obj.matrix_world)
        obj.matrix_basis = Matrix.Identity(4)
    ba.bpy.context.view_layer.update()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", help="Identyfikatory modeli rozdzielone przecinkami")
    parser.add_argument("--no-preview", action="store_true")
    args = parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    folder = REPO / "tools/blender/previews/bulwar"
    folder.mkdir(parents=True,exist_ok=True)
    for build,size in BUILDERS.items():
        name = "bw_"+build.__name__
        if args.only and name not in args.only.split(","):
            continue
        ba.reset_scene()
        root = ba._port_root(name)
        ba.PALETTE[WHITE] = ba.PALETTE["mat_light_white"]
        ba.PALETTE[IVORY] = ((.79,.77,.65,1),None)
        ba.PALETTE[GLASS] = ((.42,.48,.46,1),None)
        if build == targ_parts_stall:
            glass = ba.material(GLASS)
            glass.node_tree.nodes["Principled BSDF"].inputs["Alpha"].default_value = .22
            glass.diffuse_color = (*glass.diffuse_color[:3],.22)
            glass.surface_render_method = "BLENDED"
        build(root)
        parts = len(root.children)
        low,high = (50,100) if build in (targ_gate,targ_stage,targ_parts_stall) else (15,60)
        if not low <= parts <= high:
            raise ValueError(f"{name}: {parts} części poza zakresem {low}–{high}")
        print(f"{name}: {parts} elementów przed scaleniem",flush=True)
        fit(root,size)
        # Eksporter ma wysłać po jednym prymitywie na materiał także dla części wielobarwnych.
        ba.bpy.ops.object.select_all(action="DESELECT")
        for obj in root.children:
            obj.select_set(True)
        ba.bpy.context.view_layer.objects.active = root.children[0]
        ba.bpy.ops.object.join()
        ba.bpy.ops.object.mode_set(mode="EDIT")
        ba.bpy.ops.mesh.select_all(action="SELECT")
        ba.bpy.ops.mesh.separate(type="MATERIAL")
        ba.bpy.ops.object.mode_set(mode="OBJECT")
        ba.export_glb(root,str(REPO / f"public/assets/models/city/{name}.glb"),animations=False)
        if not args.no_preview:
            previews(root,folder)


if __name__ == "__main__":
    main()
