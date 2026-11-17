"""Własny zestaw budowy/elektrowni; metry, glTF Y-up, spód y=0.

    blender -b --factory-startup --python tools/blender/sets/construction_power.py
    -- --only build_site_office,power_cooling_tower_breach [--no-preview]

Początek: środek podstawy, poza żurawiem (oś masztu). Przód +Z.
Betoniarka ma długą oś Z; żuraw ma wysięgnik w +Z.
Poręcze są ponad poziomem powierzchni chodzenia; nie wliczać ich do collidera płyty.
Modele i materiały są własne, bez obrazów, napisów i zewnętrznych zasobów.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import build_assets as ba
import bmesh
import bpy
from mathutils import Vector

COLORS = {
    "mat_formwork_plywood": "625544",
    "mat_concrete_raw_cast": "566072",
    "mat_slag_heap": "34383f",
    "mat_cooling_tower_concrete": "657080",
    "mat_turbine_hall_floor": "444d5b",
}
B = ba._city_box
R = ba._city_rod
T = ba._city_tube


def root(name):
    obj = ba._port_root(name)
    for key, color in COLORS.items():
        rgb = [int(color[i:i + 2], 16) / 255 for i in (0, 2, 4)]
        linear = tuple(c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in rgb)
        ba.PALETTE[key] = ((*linear, 1), None)
    return obj


def surface(parent, name, verts, faces, mat):
    bm = bmesh.new()
    vs = [bm.verts.new(ba._city_point(v)) for v in verts]
    for face in faces:
        bm.faces.new(tuple(vs[i] for i in face))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    return ba.mesh_object(name, bm, mat, parent=parent)


def hollow(parent, name, a, b, radius, wall, mat="mat_concrete_raw_cast", sides=20):
    av, bv = Vector(a), Vector(b)
    direction = (bv - av).normalized()
    u = direction.cross(Vector((0, 1, 0)))
    if u.length < .01:
        u = direction.cross(Vector((1, 0, 0)))
    u.normalize()
    v = direction.cross(u)
    verts = [tuple(c + rr * (u * math.cos(i * math.tau / sides) + v * math.sin(i * math.tau / sides)))
             for c, rr in ((av, radius), (bv, radius), (av, radius-wall), (bv, radius-wall))
             for i in range(sides)]
    faces = []
    for i in range(sides):
        j = (i+1) % sides
        faces += [(i, j, sides+j, sides+i), (2*sides+i, 3*sides+i, 3*sides+j, 2*sides+j),
                  (i, 2*sides+i, 2*sides+j, j), (sides+i, sides+j, 3*sides+j, 3*sides+i)]
    return surface(parent, name, verts, faces, mat)


def rails(parent, name, xs, zs, y, ends=False, mat="mat_hivis"):
    for z in zs:
        for yy in (y+.55, y+1.05):
            R(parent, name+"_rail", (xs[0], yy, z), (xs[1], yy, z), .035, mat, 4)
        n = max(1, math.ceil((xs[1]-xs[0])/2.4))
        for i in range(n+1):
            x = xs[0] + (xs[1]-xs[0])*i/n
            R(parent, name+"_post", (x,y,z), (x,y+1.1,z), .035, mat, 4)
    if ends:
        for x in xs:
            for yy in (y+.55, y+1.05):
                R(parent, name+"_end", (x,yy,zs[0]), (x,yy,zs[1]), .035, mat, 4)


def lattice(parent, name, y0, y1, bottom, top, steps, mat="mat_metal", radius=.08):
    for sx,sz in ((-1,-1),(1,-1),(1,1),(-1,1)):
        R(parent,name+"_upright",(sx*bottom,y0,sz*bottom),(sx*top,y1,sz*top),radius,mat,4)
    for k in range(steps):
        low, high = y0+(y1-y0)*k/steps, y0+(y1-y0)*(k+1)/steps
        w0, w1 = bottom+(top-bottom)*k/steps, bottom+(top-bottom)*(k+1)/steps
        a = [(-w0,low,-w0),(w0,low,-w0),(w0,low,w0),(-w0,low,w0)]
        b = [(-w1,high,-w1),(w1,high,-w1),(w1,high,w1),(-w1,high,w1)]
        for i in range(4):
            j = (i+1)%4
            R(parent,name+"_tie",b[i],b[j],radius*.8,mat,4)
            R(parent,name+"_diagonal",a[i],b[j],radius*.65,mat,4)


def build_tower_crane():
    r = root("build_tower_crane")
    B(r,"ballasted_base",(6,1,6),(0,.5,0),"mat_concrete_raw_cast",.12)
    for x in (-2.2,2.2):
        B(r,"anchor_block",(1.2,.5,5.2),(x,1.25,0),"mat_concrete")
    lattice(r,"mast",1,58,1.35,1.35,19,"mat_crane_paint",.12)
    R(r,"slewing_bearing",(0,57.9,0),(0,58.7,0),1.8,"mat_machine",16)
    # 50 m front boom, 14 m counter-jib; mast is the mounting pivot.
    for z0,z1 in ((0,50),(-14,0)):
        for x,y in ((-1,59),(1,59),(0,61.3)):
            R(r,"jib_chord",(x,y,z0),(x,y,z1),.12,"mat_crane_paint",4)
        count = round((z1-z0)/2)
        for k in range(count):
            a=z0+(z1-z0)*k/count
            b=z0+(z1-z0)*(k+1)/count
            for sign in (-1,1):
                R(r,"jib_web",(sign,59,a),(0,61.3,b),.075,"mat_crane_paint",4)
            R(r,"jib_lower_tie",(-1,59,a),(1,59,b),.06,"mat_crane_paint",4)
    B(r,"counterweight",(3.4,3.2,4.6),(0,60.5,-11.1),"mat_concrete_raw_cast",.1)
    B(r,"operator_cab",(2.2,2.3,2.8),(2.2,57.6,1.5),"mat_crane_paint",.12)
    for z in (.65,2.35):
        B(r,"cab_glazing",(2.25,1.4,1.25),(2.2,57.85,z),"mat_glass",.035)
    B(r,"cab_front_window",(1.8,1.35,.04),(2.2,57.85,2.92),"mat_glass")
    lattice(r,"head",59,65,1,.25,2,"mat_crane_paint",.1)
    for z in (-13,39):
        R(r,"jib_stay",(0,65,0),(0,61.2,z),.055,"mat_cable",6)
    B(r,"trolley",(2.7,.65,1.7),(0,58.9,32),"mat_machine")
    for x in (-.25,.25):
        R(r,"lifting_cable",(x,58.5,32),(x,23.2,32),.035,"mat_cable",6)
    B(r,"hook_block",(.9,.9,.7),(0,23.2,32),"mat_hivis",.08)
    T(r,"load_hook",[(0,22.8,32),(0,22,32),(0,21.7,32.4),(0,21.9,32.8),(0,22.25,32.8)],.12,"mat_metal",6)
    for z in (-13.9,49.9):
        B(r,"jib_marker",(.3,.22,.2),(0,61.45,z),"mat_neon_amber")
    B(r,"mast_beacon",(.3,.25,.3),(0,65.125,0),"mat_neon_amber")
    B(r,"work_lamp",(.7,.12,.45),(2.2,56.38,2.2),"mat_light_white")
    return r


def build_scaffold_bay():
    r=root("build_scaffold_bay")
    B(r,"deck_backing",(2.5,.06,1.2),(0,1.93,0),"mat_formwork_plywood")
    for i in range(5):
        B(r,"deck_plank",(2.5,.04,.24),(0,1.98,-.48+i*.24),"mat_formwork_plywood",.001)
    for x in (-1.19,1.19):
        for z in (-.54,.54):
            R(r,"standard",(x,.06,z),(x,3.1 if z>0 else 2,z),.035,"mat_metal",6)
            B(r,"base_plate",(.12,.06,.12),(x,.03,z),"mat_metal")
    for z in (-.54,.54):
        R(r,"cross_brace",(-1.19,.2,z),(1.19,1.85,z),.022,"mat_metal",4)
        R(r,"cross_brace",(1.19,.2,z),(-1.19,1.85,z),.022,"mat_metal",4)
    rails(r,"guard",(-1.19,1.19),(.54,),2)
    for z in (.57,):
        B(r,"toe_board",(2.5,.15,.035),(0,2.075,z),"mat_formwork_plywood")
    return r


def build_unfinished_column():
    r=root("build_unfinished_column")
    B(r,"raw_column",(.6,4,.6),(0,2,0),"mat_concrete_raw_cast",.015)
    for x in (-.21,.21):
        for z in (-.21,.21):
            R(r,"exposed_rebar",(x,3.7,z),(x,4.8,z),.022,"mat_rust",6)
    for y in (4.15,4.45):
        T(r,"rebar_tie",[(-.23,y,-.23),(.23,y,-.23),(.23,y,.23),(-.23,y,.23)],.013,"mat_rust",4,closed=True)
    for y in (1.3,2.6):
        B(r,"casting_seam",(.605,.012,.605),(0,y,0),"mat_concrete")
    return r


def build_rebar_bundle():
    r=root("build_rebar_bundle")
    for x in (-2.1,2.1):
        B(r,"timber_bearer",(.18,.15,1),(x,.075,0),"mat_formwork_plywood")
    for row in range(3):
        for col in range(8-row):
            z=(col-(7-row)/2)*.115
            R(r,"reinforcing_bar",(-3,.21+row*.13,z),(3,.21+row*.13,z),.055,"mat_rust",6)
    for x in (-1.9,1.9):
        T(r,"bundle_strap",[(x,.14,-.5),(x,.57,-.35),(x,.57,.35),(x,.14,.5)],.022,"mat_trim",4,closed=True)
    return r


def build_precast_stack():
    r=root("build_precast_stack")
    for layer in range(4):
        y=.1+layer*.4
        for x in (-2,2):
            B(r,"spacer",(.2,.1,2.3),(x,y-.05,0),"mat_formwork_plywood")
        B(r,"precast_panel",(6,.3,2.4),(0,y+.15,0),"mat_concrete_raw_cast",.025)
        for x in (-2.4,2.4):
            B(r,"lifting_recess",(.13,.08,.012),(x,y+.16,1.2),"mat_trim")
    return r


def build_pipe_stack():
    r=root("build_pipe_stack")
    for x,y in ((-.76,.75),(.76,.75),(0,.75+math.sqrt(1.5**2-.76**2))):
        hollow(r,"hollow_precast_tube",(x,y,-1.5),(x,y,1.5),.75,.13)
    for x in (-1.4,1.4):
        B(r,"timber_chock",(.2,.25,2.5),(x,.125,0),"mat_formwork_plywood")
    return r


def build_mixer_truck():
    r=root("build_mixer_truck")
    B(r,"chassis",(8.4,.35,2.15),(0,1.0,0),"mat_trim")
    for x in (-3,-1.5,2.9):
        R(r,"axle",(x,.57,-1.15),(x,.57,1.15),.12,"mat_trim",8)
        for z in (-1.02,1.02):
            R(r,"tire",(x,.58,z-.23),(x,.58,z+.23),.58,"mat_rubber",12)
            R(r,"wheel_hub",(x,.58,z-.235),(x,.58,z+.235),.31,"mat_machine",8)
    B(r,"cab",(2.6,2.35,2.36),(3,2.025,0),"mat_container_navy",.13)
    B(r,"front_windshield",(.06,.85,2),(4.315,2.56,0),"mat_glass",.02)
    for z in (-1.19,1.19):
        B(r,"door_window",(1.55,.78,.035),(3.1,2.56,z),"mat_glass",.02)
        B(r,"door_handle",(.28,.05,.04),(2.75,1.9,z),"mat_metal")
        B(r,"step",(1.3,.13,.13),(2.9,1.1,z),"mat_steel_grating")
    B(r,"front_bumper",(.26,.3,2.5),(4.37,.9,0),"mat_metal")
    for z in (-.8,.8):
        B(r,"headlamp",(.03,.18,.38),(4.505,1.35,z),"mat_light_white")
    # Three conical sections form the sloped, recognisable mixer drum.
    axis=[(-3.45,2.6,0),(-2.75,2.5,0),(-.3,2.15,0),(1.5,1.9,0)]
    radii=(.55,1.0,1.12,.62)
    for i in range(3):
        R(r,"mixing_drum",axis[i],axis[i+1],radii[i],"mat_crane_paint",16,tip_radius=radii[i+1])
    for x,y,rr in ((-2.55,2.47,1.015),(-.5,2.18,1.115)):
        ba._city_ring(r,"drum_band",(x,y,0),rr,axis="x",thickness=.065,mat="mat_trim",segments=16)
    B(r,"hopper",(.7,.8,1.1),(-3.75,2.9,0),"mat_machine",.06,taper=(1.5,1.35))
    ba._port_box(r,"delivery_chute",(1.5,.17,.55),(-3.73,1.9,0),"mat_machine",pitch=0)
    B(r,"rear_guard",(.2,.28,2.4),(-4.4,.9,0),"mat_hivis")
    for y in (1.4,1.8,2.2,2.6):
        R(r,"ladder_rung",(-3.7,y,.7),(-3.1,y,.7),.025,"mat_metal",4)
    for obj in r.children:
        obj.rotation_euler.z -= math.pi / 2
        obj.location = Vector((obj.location.y, -obj.location.x, obj.location.z))
    return r


def build_site_office():
    r=root("build_site_office")
    lx,h,w=6.058,2.591,2.438
    B(r,"office_body",(lx-.08,h-.1,w-.08),(0,h/2,0),"mat_container_graphite")
    for y in (.05,h-.05):
        B(r,"stacking_frame",(lx,.1,w),(0,y,0),"mat_metal")
    for x in (-lx/2+.06,lx/2-.06):
        for z in (-w/2+.06,w/2-.06):
            B(r,"corner_post",(.12,h,.12),(x,h/2,z),"mat_metal")
    for z in (-w/2+.025,w/2-.025):
        for x in (-1.85,-.35,1.8):
            if x==1.8 and z>0:
                B(r,"door_frame",(1,2.15,.04),(x,1.14,z),"mat_metal")
                B(r,"door",(.87,2.03,.04),(x,1.14,z+.001),"mat_container_navy")
                B(r,"door_glass",(.65,.55,.045),(x,1.65,z),"mat_glass")
                B(r,"door_handle",(.12,.05,.047),(x-.29,1.05,z),"mat_hivis")
            else:
                B(r,"window_frame",(1.17,1.05,.04),(x,1.58,z),"mat_metal")
                B(r,"window_glass",(1.04,.9,.045),(x,1.58,z),"mat_glass")
                B(r,"window_mullion",(.035,.92,.047),(x,1.58,z),"mat_metal")
    for x in [-2.7+i*.3 for i in range(19)]:
        B(r,"lower_wall_rib",(.025,.5,.02),(x,.4,w/2-.015),"mat_corrugated")
    return r


def build_site_office_stairs():
    r=root("build_site_office_stairs")
    rise=2.591
    count=15
    for i in range(count):
        x=-2.8+(i+.5)*.32
        B(r,"step",(.32,.09,1.4),(x,(i+1)*rise/count-.045,0),"mat_steel_grating")
    B(r,"landing",(1,.14,1.4),(2.5,rise-.07,0),"mat_steel_grating")
    for z in (-.76,.76):
        R(r,"stringer",(-2.8,.09,z),(2,rise-.09,z),.08,"mat_metal",4)
        for yy in (.55,1.05):
            R(r,"sloping_handrail",(-2.8,yy,z),(2,rise+yy,z),.035,"mat_hivis",4)
        for k in range(6):
            x=-2.8+k*.96
            y=k*rise/5
            R(r,"rail_post",(x,max(.03,y-.05),z),(x,y+1.1,z),.035,"mat_hivis",4)
        R(r,"landing_support",(2.9,0,z),(2.9,rise,z),.06,"mat_metal",4)
    rails(r,"landing",(2,3),(-.76,.76),rise)
    return r


def build_hoarding_fence():
    r=root("build_hoarding_fence")
    B(r,"hoarding",(4,2.25,.1),(0,1.275,0),"mat_container_graphite")
    for x in (-1.75,1.75):
        B(r,"post",(.1,2.4,.12),(x,1.2,-.09),"mat_metal")
        B(r,"foot",(.5,.12,1.1),(x,.06,-.2),"mat_concrete")
        R(r,"raker",(x,.15,-.7),(x,1.4,-.15),.045,"mat_metal",4)
    B(r,"hazard_band",(4,.42,.018),(0,1.45,.059),"mat_trim")
    for i in range(10):
        B(r,"amber_diagonal",(.14,.38,.02),(-1.8+i*.4,1.45,.065),"mat_hivis",spin=-25)
    return r


def cooling_tower(breach=False):
    r=root("power_cooling_tower_breach" if breach else "power_cooling_tower")
    segments=48
    # Hyperboloid neck r=15 at 2/3 of 70m. Shell starts above a 4m inlet gap.
    neck=70*2/3
    def radius(y):
        return math.sqrt(15**2+400*((y-neck)/(4-neck))**2)
    ys=[4,10,14,20,27,34,41,neck,52,58,64,70]
    angles=[i*math.tau/segments for i in range(segments)]
    if breach:
        # Dedicated jamb columns retain >8m clear width at the inner shell at y=10.
        portal_angle=math.asin(4.3/radius(10))
        angles[1]=portal_angle
        angles[-1]=math.tau-portal_angle
    verts=[]
    for inner in (False,True):
        for y in ys:
            rr=radius(y)-(.45 if inner else 0)
            for i in range(segments):
                angle=angles[i]
                verts.append((rr*math.sin(angle),y,rr*math.cos(angle)))
    faces=[]
    n=segments*len(ys)
    for ring in range(len(ys)-1):
        for i in range(segments):
            j=(i+1)%segments
            center=(angles[i]+(angles[j] if j else math.tau))/2
            # 8m clear portal: omit central front strips up to 10m.
            gap=breach and ys[ring]<10 and abs(math.sin(center)*radius(10))<4.2 and math.cos(center)>.9
            if gap:
                continue
            a=ring*segments+i
            b=ring*segments+j
            c=(ring+1)*segments+j
            d=(ring+1)*segments+i
            faces.extend([(a,b,c,d),(n+d,n+c,n+b,n+a)])
    for ring in (0,len(ys)-1):
        for i in range(segments):
            j=(i+1)%segments
            center=(angles[i]+(angles[j] if j else math.tau))/2
            if breach and ring==0 and abs(math.sin(center)*radius(10))<4.2 and math.cos(center)>.9:
                continue
            a=ring*segments+i;b=ring*segments+j
            faces.append((a,n+a,n+b,b))
    surface(r,"hyperboloid_shell",verts,faces,"mat_cooling_tower_concrete")
    # The floor lies exactly at y=0, keeping the inlet and breach unobstructed.
    floor=[(0,0,0)]+[(24.3*math.sin(i*math.tau/segments),0,24.3*math.cos(i*math.tau/segments)) for i in range(segments)]
    surface(r,"interior_floor",floor,[(0,i+1,(i+1)%segments+1) for i in range(segments)],"mat_turbine_hall_floor")
    for i in range(32):
        a=i*math.tau/32
        if breach and math.cos(a)>.95:
            continue
        x,z=24*math.sin(a),24*math.cos(a)
        B(r,"leg_pad",(.8,.3,.8),(x,.15,z),"mat_concrete_raw_cast")
        R(r,"inlet_leg",(x,.3,z),(24.7*math.sin(a+.018),4,24.7*math.cos(a+.018)),.28,"mat_concrete_raw_cast",6)
    # Broad embedded stains are actual geometry; no texture dependency.
    for i in range(17):
        angle=(i+.3)*math.tau/17
        y0=15+(i%4)*6
        y1=min(67,y0+18+(i%3)*6)
        rows=[]
        # Follow actual polygon rings, rather than a curve hidden below the shell.
        stripe_ys=[y for y in ys if y0<=y<=y1]
        for y in stripe_ys:
            rr=radius(y)+.035
            rows.extend([(rr*math.sin(angle-.012),y,rr*math.cos(angle-.012)),
                         (rr*math.sin(angle+.012),y,rr*math.cos(angle+.012))])
        surface(r,"weather_streak",rows,[(2*k,2*k+1,2*k+3,2*k+2) for k in range(len(stripe_ys)-1)],"mat_concrete")
    if breach:
        for sign in (-1,1):
            B(r,"fractured_portal_cheek",(.55,5.7,.65),(sign*4.65,6.85,23.1),"mat_concrete_raw_cast",.09)
        # Exposed short bars remain above 10m clear headroom.
        for x in (-2.8,-1.2,.6,2.4):
            R(r,"torn_rebar",(x,10.15,22.3),(x+.18,11.1,22.1),.035,"mat_rust",6)
    return r


def power_turbine_housing():
    r=root("power_turbine_housing")
    B(r,"plinth",(20,.45,6),(0,.225,0),"mat_concrete_raw_cast",.08)
    B(r,"machine_bed",(18.8,.6,4.5),(0,.75,0),"mat_trim")
    for x0,x1,rr in ((-8,-2.5,1.85),(-2.5,3,2.15),(3,8,1.5)):
        R(r,"turbine_casing",(x0,3,0),(x1,3,0),rr,"mat_machine",16)
        for x in (x0+.1,x1-.1):
            ba._city_ring(r,"casing_flange",(x,3,0),rr+.08,axis="x",thickness=.11,mat="mat_metal",segments=16)
    for x in (-8,-3,3,8):
        for z in (-2.5,2.5):
            B(r,"deck_column",(.18,5.55,.18),(x,3.225,z),"mat_metal")
    B(r,"service_deck",(20,.2,6),(0,5.9,0),"mat_turbine_hall_floor")
    rails(r,"service_guard",(-9.85,9.85),(-2.85,2.85),6)
    for x in (-7,-2,3,7):
        B(r,"casing_panel",(2,.65,.12),(x,3,2.12),"mat_container_graphite",.035)
        B(r,"status_lamp",(.14,.12,.02),(x,3.15,2.19),"mat_neon_green")
    return r


def power_transformer():
    r=root("power_transformer")
    B(r,"foundation",(6,.35,4),(0,.175,0),"mat_concrete_raw_cast",.06)
    B(r,"oil_tank",(4,2.8,2.25),(0,1.85,0),"mat_paint",.1)
    for side in (-1,1):
        for i in range(12):
            x=-2.5+i*5/11
            B(r,"cooling_fin",(.12,2.6,.6),(x,1.9,side*1.5),"mat_metal")
        R(r,"radiator_header",(-2.6,3.1,side*1.5),(2.6,3.1,side*1.5),.10,"mat_machine",8)
    for x in (-1.3,0,1.3):
        R(r,"bushing_core",(x,3.2,0),(x,4.8,0),.12,"mat_machine",8)
        for y in (3.55,3.8,4.05,4.3,4.55):
            R(r,"insulator_disc",(x,y-.055,0),(x,y+.055,0),.29,"mat_glass",10)
        R(r,"terminal",(x,4.75,0),(x,5,0),.075,"mat_metal",6)
    R(r,"conservator",(-2,3.65,-.95),(2,3.65,-.95),.32,"mat_paint",12)
    B(r,"control_box",(.85,1.05,.3),(2.45,1.45,1.82),"mat_container_graphite",.035)
    B(r,"status",(.12,.12,.02),(2.45,1.65,1.98),"mat_neon_green")
    return r


def power_hv_pylon():
    r=root("power_hv_pylon")
    for x in (-3,3):
        for z in (-3,3):
            B(r,"footing",(1.2,.5,1.2),(x,.25,z),"mat_concrete_raw_cast")
    lattice(r,"tower",.5,28.8,3,.45,10,"mat_metal",.085)
    for y,span in ((20,8),(24,6.5),(28,5)):
        for sign in (-1,1):
            tip=sign*span
            R(r,"crossarm",(0,y,0),(tip,y,0),.14,"mat_metal",4)
            R(r,"crossarm_brace",(0,y-2,0),(tip,y,0),.09,"mat_metal",4)
            for k in range(7):
                yy=y-.2-k*.24
                R(r,"insulator_string",(tip,yy-.06,0),(tip,yy+.06,0),.25,"mat_glass",8)
            R(r,"wire_socket",(tip,y-2,0),(tip,y-1.65,0),.08,"mat_metal",6)
    R(r,"earth_spike",(0,28.7,0),(0,30,0),.05,"mat_metal",6)
    return r


def power_pipe_rack():
    r=root("power_pipe_rack")
    for x in (-5.85,0,5.85):
        for z in (-1.7,1.7):
            B(r,"footing",(.3,.2,.6),(x,.1,z),"mat_concrete_raw_cast")
            B(r,"stanchion",(.18,5.95,.18),(x,3.175,z),"mat_metal")
        B(r,"crosshead",(.24,.3,4),(x,5.9,0),"mat_metal")
        R(r,"frame_brace",(x,3.7,-1.7),(x,5.8,-.4),.07,"mat_metal",4)
    for z,rr in ((-1.5,.25),(-.78,.25),(-.06,.25)):
        hollow(r,"process_pipe",(-6,6.3,z),(6,6.3,z),rr,.055,"mat_machine",16)
        for x in (-5.5,0,5.5):
            ba._city_ring(r,"pipe_flange",(x,6.3,z),rr+.06,axis="x",thickness=.065,mat="mat_trim",segments=12)
    # Nominal walkway is 1.4m; rails are outside its clear width.
    B(r,"service_walkway",(12,.16,1.4),(0,6.12,1.25),"mat_steel_grating")
    rails(r,"walkway_guard",(-5.9,5.9),(.515,1.985),6.2)
    return r


def power_chimney():
    r=root("power_chimney")
    R(r,"foundation",(0,0,0),(0,1,0),5,"mat_concrete_raw_cast",48)
    R(r,"chimney_shaft",(0,1,0),(0,118.8,0),4.8,"mat_concrete",48,tip_radius=2.9)
    hollow(r,"open_stack_lip",(0,118.5,0),(0,120,0),2.95,.35,"mat_concrete_raw_cast",48)
    for y in (35,70,105):
        rr=4.8+(2.9-4.8)*(y-1)/117.8
        R(r,"amber_band",(0,y-.8,0),(0,y+.8,0),rr+.13,"mat_hivis",48,tip_radius=rr+.104)
    for y in (40,80,117):
        rr=4.8+(2.9-4.8)*(y-1)/117.8
        ba._city_ring(r,"inspection_band",(0,y,0),rr+.08,axis="y",thickness=.12,mat="mat_metal",segments=32)
        for a in (0,math.pi/2,math.pi,math.pi*1.5):
            B(r,"warning_beacon",(.3,.4,.3),((rr+.15)*math.sin(a),y+.25,(rr+.15)*math.cos(a)),"mat_neon_amber")
    return r


def power_slag_heap():
    r=root("power_slag_heap")
    # 26m footprint and 7m summit: regular 32-gon apothem yields max slope 28.42deg.
    # Slight radial variation stays >=12.5m, hence every face remains below 30deg.
    n=32
    verts=[(0,7,0)]
    for i in range(n):
        a=i*math.tau/n
        rr=13 if i%8==0 else 12.8+.2*math.cos(i*1.7)
        verts.append((rr*math.cos(a),0,rr*math.sin(a)))
    obj=surface(r,"walkable_slag_slopes",verts,[(0,i+1,(i+1)%n+1) for i in range(n)],"mat_slag_heap")
    obj.data.materials.append(ba.material("mat_asphalt"))
    for i,p in enumerate(obj.data.polygons):
        if i%5==1:
            p.material_index=1
    return r


BUILDERS={
    "build_tower_crane":build_tower_crane,
    "build_scaffold_bay":build_scaffold_bay,
    "build_unfinished_column":build_unfinished_column,
    "build_rebar_bundle":build_rebar_bundle,
    "build_precast_stack":build_precast_stack,
    "build_pipe_stack":build_pipe_stack,
    "build_mixer_truck":build_mixer_truck,
    "build_site_office":build_site_office,
    "build_site_office_stairs":build_site_office_stairs,
    "build_hoarding_fence":build_hoarding_fence,
    "power_cooling_tower":lambda:cooling_tower(False),
    "power_cooling_tower_breach":lambda:cooling_tower(True),
    "power_turbine_housing":power_turbine_housing,
    "power_transformer":power_transformer,
    "power_hv_pylon":power_hv_pylon,
    "power_pipe_rack":power_pipe_rack,
    "power_chimney":power_chimney,
    "power_slag_heap":power_slag_heap,
}

WALKABLE={
    "build_scaffold_bay":[{"x":[-1.25,1.25],"z":[-.6,.52],"y":2}],
    "build_precast_stack":[{"x":[-2.975,2.975],"z":[-1.175,1.175],"y":1.6}],
    "build_site_office":[{"x":[-3.029,3.029],"z":[-1.219,1.219],"y":2.591}],
    "build_site_office_stairs":[{"x":[2,3],"z":[-.7,.7],"y":2.591}],
    "power_turbine_housing":[{"x":[-9.8,9.8],"z":[-2.8,2.8],"y":6}],
    "power_pipe_rack":[{"x":[-6,6],"z":[.55,1.95],"y":6.2}],
}


def metrics(r):
    bpy.context.view_layer.update()
    pts=[]
    tris=0
    mats=set()
    for obj in r.children_recursive:
        if obj.type!="MESH":
            continue
        for vertex in obj.data.vertices:
            v=obj.matrix_world@vertex.co
            pts.append((v.x,v.z,-v.y))
        tris+=sum(len(p.vertices)-2 for p in obj.data.polygons)
        mats.update(m.name for m in obj.data.materials)
    lo=[round(min(v[i] for v in pts),6) for i in range(3)]
    hi=[round(max(v[i] for v in pts),6) for i in range(3)]
    return {"min":lo,"max":hi,"size":[round(hi[i]-lo[i],6) for i in range(3)],
            "triangles":tris,"materials":sorted(mats),"walkable":WALKABLE.get(r.name,[]),
            "pivot":"mast base center" if r.name=="build_tower_crane" else "base center",
            "front":"+Z"}


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--only",default="")
    parser.add_argument("--no-preview",action="store_true")
    parser.add_argument("--metrics-file",type=Path)
    args=parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    selected=[n for n in args.only.split(",") if n] or list(BUILDERS)
    unknown=set(selected)-BUILDERS.keys()
    if unknown:
        parser.error("Unknown model(s): "+", ".join(sorted(unknown)))
    out=Path(ba.OUT_DIR)/"city"
    previews=Path(ba.PREVIEW_DIR)/"city"
    out.mkdir(parents=True,exist_ok=True)
    previews.mkdir(parents=True,exist_ok=True)
    report={}
    for name in selected:
        ba.reset_scene()
        r=BUILDERS[name]()
        # One draw mesh per material; semantic materials remain swappable in the game.
        ba._port_merge(r,{m:m.removeprefix("mat_") for m in ba.PALETTE})
        report[name]=metrics(r)
        ba.export_glb(r,str(out/(name+".glb")),animations=False)
        if not args.no_preview:
            if name=="power_cooling_tower_breach":
                scene=ba._preview_scene((640,640),(.75,.75,.78))
                cam=ba._preview_camera(scene,(0,0,35),(.23,-1,.32),160)
                cam.data.clip_end=1000
                scene.render.filepath=str(previews/(name+".png"))
                bpy.ops.render.render(write_still=True)
            else:
                ba.render_preview(r,str(previews/(name+".png")))
        print("MODEL_METRICS "+name+" "+json.dumps(report[name]),flush=True)
    if args.metrics_file:
        args.metrics_file.write_text(json.dumps(report,indent=2),encoding="utf-8")
        print("METRICS_FILE "+str(args.metrics_file),flush=True)


if __name__=="__main__":
    main()
