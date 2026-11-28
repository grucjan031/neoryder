"""Build enemy_chimera.glb from the actual Run 3 cryo specimen in Blender."""
import math
from pathlib import Path

import bpy
import bmesh
import numpy as np
from mathutils import Vector

root = Path(__file__).resolve().parents[2]
assets = root / "public/assets/models"
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(assets / "city/lab_cocoon_tall_cryo.glb"))

# Coordinates below follow the cocoon generator (Y up, +Z toward the face).
def point(x, y, z):
    return Vector((x, -z, y - 1.036)) * .91

pieces = []
for obj in list(bpy.context.scene.objects):
    if obj.type != 'MESH':
        continue
    mat = obj.data.materials[0].name
    if mat not in {'mat_snow', 'mat_neon_blue', 'mat_rubber', 'mat_trim', 'mat_metal'}:
        continue
    mesh = obj.data.copy()
    bm = bmesh.new()
    bm.from_mesh(mesh)
    for v in list(bm.verts):
        p = obj.matrix_world @ v.co
        x, y, z = p.x, p.z, -p.y
        if mat not in {'mat_snow', 'mat_rubber'} and not (
            abs(x) < .41 and 1.04 < y < 3.34 and -.2 < z < .44
        ):
            bm.verts.remove(v)
        else:
            v.co = point(x, y, z)
    if bm.faces:
        bm.to_mesh(mesh)
        part = bpy.data.objects.new(mat + "_body", mesh)
        bpy.context.collection.objects.link(part)
        pieces.append(part)
    bm.free()

for obj in list(bpy.context.scene.objects):
    if obj not in pieces:
        bpy.data.objects.remove(obj, do_unlink=True)

bones = {}
def joint(name, parent, start, end):
    bones[name] = (parent, point(*start), point(*end))

joint('pelvis', None, (0,2.10,0), (0,2.30,0))
joint('torso','pelvis',(0,2.30,0),(0,2.83,.06))
joint('head','torso',(0,2.83,.06),(0,3.31,.26))
for side, k in [('L',1),('R',-1)]:
    shoulder, elbow, wrist = (k*.237,2.66,.015),(k*.355,2.34,.13),(k*.32,2.04,.24)
    hip,knee,ankle=(k*.115,2.13,-.025),(k*.17,1.64,.11),(k*.15,1.13,.04)
    joint('upper'+side,'torso',shoulder,elbow)
    joint('fore'+side,'upper'+side,elbow,wrist)
    joint('hand'+side,'fore'+side,wrist,(k*.32,1.82,.27))
    joint('thigh'+side,'pelvis',hip,knee)
    joint('shin'+side,'thigh'+side,knee,ankle)
    joint('foot'+side,'shin'+side,ankle,(k*.15,1.08,.22))

arm = bpy.data.armatures.new('Chimera')
rig = bpy.data.objects.new('Chimera',arm)
bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for name,(parent,start,end) in bones.items():
    b=arm.edit_bones.new(name)
    # Parallel local axes simplify authoring poses in anatomical planes.
    b.head=start
    b.tail=start+Vector((0,.08,0))
    if parent:
        b.parent=arm.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
for part in pieces:
    part.parent=rig
    mod=part.modifiers.new('Joints','ARMATURE')
    mod.object=rig
    vertices=np.array([v.co[:] for v in part.data.vertices])
    distances=[]
    groups=[]
    for name,(_,start,end) in bones.items():
        groups.append(part.vertex_groups.new(name=name))
        axis=np.array(end-start)
        offset=vertices-np.array(start)
        along=np.clip(offset @ axis / (axis @ axis),0,1)
        distances.append(np.linalg.norm(offset-along[:,None]*axis,axis=1))
    for i,row in enumerate(np.array(distances).T):
        nearest=row.argsort()[:3]
        weights=np.exp(-(row[nearest]-row[nearest[0]])/.022)
        for idx,w in zip(nearest,weights/weights.sum()):
            groups[idx].add([i],w,'REPLACE')

# Single-cycle actions. Each swipe has a matching anticipation and follow-through.
def pose(action, t):
    wave=math.sin(t*math.tau)
    angles={'torso':(-8+2*wave,0,0),'head':(9,-4*wave,0)}
    for side,k in [('L',1),('R',-1)]:
        arm=-15+3*k*wave
        elbow=-17
        leg=0
        knee=0
        spread=k*6
        if action in ('Walk_Loop','Jog_Fwd_Loop'):
            sprint=action=='Jog_Fwd_Loop'
            leg=(48 if sprint else 25)*wave*k
            knee=max(0,-leg)*1.3
            arm=-leg-12
            elbow=-50 if sprint else -20
            angles['torso']=(-24 if sprint else -10,3*k*leg/25,6*wave)
        elif action=='Lost':
            angles['head']=(15+9*wave,0,46*wave)
            angles['torso']=(-16+6*wave,7*wave,-15*wave)
            arm=-38+22*k*wave
            elbow=-48
        elif action.startswith(('Ready','Claw')):
            style=action[-1]
            active=style=='B' or side==style
            if active:
                ready=action.startswith('Ready')
                pull=t if ready else 1-t
                reach=0 if ready else math.sin(math.pi*min(1,t*3.5))
                arm=-12-75*pull-83*reach
                spread=k*(7+53*pull-14*reach)
                elbow=-14-53*pull
                if style=='B':
                    arm=-12-135*pull-55*reach
                    spread=k*(7+14*pull)
                    angles['torso']=(-8+12*pull-36*reach,0,0)
                else:
                    angles['torso']=(-8-18*reach,0,k*(22*pull-21*reach))
        elif action.startswith('Hit'):
            angles['torso']=(23*math.sin(t*math.pi),12*wave,4*wave)
            angles['head']=((38 if action=='Hit_Head' else 12)*math.sin(t*math.pi),
                            15*wave if action=='Hit_Head' else 0,0)
            arm=10+24*k*wave
        angles['upper'+side]=(arm,spread,0)
        angles['fore'+side]=(elbow,0,0)
        angles['thigh'+side]=(leg,0,0)
        angles['shin'+side]=(knee,0,0)
    return angles

rig.animation_data_create()
for name in ['Idle_Loop','Walk_Loop','Jog_Fwd_Loop','Lost','Hit_Head','Hit_Chest',
             'ReadyL','ReadyR','ReadyB','ClawL','ClawR','ClawB']:
    action=bpy.data.actions.new(name)
    rig.animation_data.action=action
    for frame in range(0,25,2):
        for bone,degrees in pose(name,frame/24).items():
            pb=rig.pose.bones[bone]
            pb.rotation_mode='XYZ'
            pb.rotation_euler=[math.radians(a) for a in degrees]
            pb.keyframe_insert(data_path='rotation_euler',frame=frame)
    track=rig.animation_data.nla_tracks.new()
    track.name=name
    track.strips.new(name,0,action)
    track.mute=True
    rig.animation_data.action=None
for pb in rig.pose.bones:
    pb.rotation_euler=(0,0,0)
bpy.ops.export_scene.gltf(filepath=str(assets/'enemy_chimera.glb'),export_animation_mode='ACTIONS',
                          export_yup=True,export_texcoords=False,export_frame_range=False)

