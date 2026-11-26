"""Autorski samochód ekspozycyjny. Metry/glTF, nos +X, koła na y=0.

D:/Blender/blender.exe -b --factory-startup --python tools/blender/sets/mall_showcar.py
Korzysta z eksportera build_assets.py i materiałów zestawu mall_atrium.
"""

import math
import sys
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from mall_atrium import (
    REPO, ba, bpy, Vector, materials, finish_glazing, preview, pane,
    cbox, beam, rod, tube, loft, DARK, ALLOY, BRASS, RUBBER, CLOTH, GLASS, PANEL, AMBER,
)

PAINT = DARK


def apply(obj, modifier):
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def bevel(obj, width=0.025, segments=2):
    mod = obj.modifiers.new("rounded production edges", "BEVEL")
    mod.width, mod.segments = width, segments
    apply(obj, mod)
    for face in obj.data.polygons:
        face.use_smooth = True
    mod = obj.modifiers.new("weighted panel normals", "WEIGHTED_NORMAL")
    mod.keep_sharp = True
    apply(obj, mod)
    return obj


def torus(root, name, center, major, minor, mat, segments=24, sides=6, steering=False):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major, minor_radius=minor, major_segments=segments,
        minor_segments=sides, location=ba._city_point(center),
        rotation=(0, math.pi / 2, 0) if steering else (math.pi / 2, 0, 0),
    )
    obj = bpy.context.object
    obj.name, obj.parent = name, root
    obj.data.materials.append(ba.material(mat))
    for face in obj.data.polygons:
        face.use_smooth = True
    return obj


def subtract(obj, cutter):
    bpy.context.view_layer.update()
    mod = obj.modifiers.new("formed opening", "BOOLEAN")
    mod.operation, mod.solver, mod.object = "DIFFERENCE", "EXACT", cutter
    apply(obj, mod)
    bpy.data.objects.remove(cutter, do_unlink=True)


def showcar(root):
    # Broad shoulders taper into a low nose. A recessed waist gives two readable creases.
    sections = [
        (-2.28, .79, .64), (-2.10, .94, .74), (-1.48, .98, .83),
        (-.95, .91, .72), (-.20, .86, .68), (.65, .91, .72),
        (1.42, .98, .83), (1.98, .91, .59), (2.28, .75, .48),
    ]
    rings = []
    for x, w, h in sections:
        rings.append([(x, y, z) for y, z in (
            (.21, -w * .87), (.32, -w), (h * .70, -w * .94),
            (h * .93, -w), (h, -w * .78), (h + .015, 0),
            (h, w * .78), (h * .93, w), (h * .70, w * .94),
            (.32, w), (.21, w * .87),
        )])
    body = loft(root, "sculpted monocoque", rings, PAINT)
    for x in (-1.43, 1.43):
        for s in (-1, 1):
            cutter = rod(root, "wheel arch tool", (x, .355, s * .69), (x, .355, s * 1.2), .405, DARK, 24)
            subtract(body, cutter)
    cutter = cbox(root, "cockpit tool", (1.54, 1.2, 1.30), (-.13, .96, 0), DARK)
    subtract(body, cutter)
    bevel(body, .018, 2)
    bevel(cbox(root, "flat battery floor", (3.75, .09, 1.50), (0, .22, 0), DARK), .025, 2)

    # Hood creases, rear deck vents, skirt aero ducts and recessed door joints.
    for s in (-1, 1):
        tube(root, "hood crease", [(2.12, .52, s * .38), (1.55, .725, s * .43), (.86, .72, s * .63)], .009, ALLOY, 4)
        tube(root, "door shutline", [(.65, .70, s * .88), (.72, .52, s * .88), (.58, .30, s * .91), (-.80, .30, s * .89), (-.92, .65, s * .89)], .006, DARK, 4)
        bevel(cbox(root, "flush door handle", (.18, .025, .018), (-.53, .64, s * .90), ALLOY), .006, 2)
        bevel(cbox(root, "side sill blade", (1.78, .075, .14), (0, .24, s * .87), DARK), .02, 2)
        cbox(root, "amber sill accent", (1.60, .014, .02), (0, .272, s * .947), AMBER)
        pane(root, "side aero intake", [(-.86, .32, s * .92), (-.56, .39, s * .88), (-.57, .57, s * .86), (-.91, .62, s * .91)], RUBBER)
        rod(root, "mirror stem", (.55, .88, s * .69), (.60, .85, s * .88), .018, DARK, 6)
        bevel(cbox(root, "camera mirror", (.18, .065, .12), (.61, .86, s * .92), PAINT), .025, 3)
        for i in range(4):
            cbox(root, "rear deck louvre", (.028, .015, .38), (-1.72 + i * .10, .79, s * .38), DARK)

    # Continuous lamp ribbons wrap around the clipped front and rear corners.
    for x, y, mat in ((2.29, .438, PANEL), (-2.29, .58, AMBER)):
        sign = 1 if x > 0 else -1
        tube(root, "lamp recess", [(x - sign * .15, y + .015, -.82), (x, y, -.66), (x, y, .66), (x - sign * .15, y + .015, .82)], .043, DARK, 6)
        tube(root, "continuous light ribbon", [(x - sign * .15, y + .015, -.82), (x + sign * .012, y, -.66), (x + sign * .012, y, .66), (x - sign * .15, y + .015, .82)], .015, mat, 6)
    bevel(cbox(root, "front splitter", (.29, .045, 1.68), (2.13, .23, 0), DARK), .018, 2)
    bevel(cbox(root, "front lower inlet", (.022, .09, 1.10), (2.27, .32, 0), RUBBER), .015, 2)
    bevel(cbox(root, "rear diffuser", (.30, .12, 1.46), (-2.13, .26, 0), DARK), .02, 2)
    for z in (-.56, -.28, 0, .28, .56):
        cbox(root, "diffuser vane", (.34, .12, .018), (-2.14, .24, z), ALLOY)

    # Four separate tires, open five-spoke rims, brake rotors and amber calipers.
    for x in (-1.43, 1.43):
        for s in (-1, 1):
            torus(root, "tire", (x, .355, s * .91), .282, .073, RUBBER)
            torus(root, "machined rim lip", (x, .355, s * .982), .237, .018, ALLOY, 20, 4)
            rod(root, "brake rotor", (x, .355, s * .932), (x, .355, s * .95), .192, ALLOY, 24)
            bevel(cbox(root, "amber brake caliper", (.085, .19, .04), (x - .14, .39, s * .964), BRASS), .014, 2)
            rod(root, "wheel hub", (x, .355, s * .96), (x, .355, s * 1.001), .062, DARK, 12)
            for i in range(5):
                a = i * math.tau / 5
                beam(root, "swept alloy spoke", (x + .048 * math.cos(a), .355 + .048 * math.sin(a), s * .996),
                     (x + .228 * math.cos(a + .22), .355 + .228 * math.sin(a + .22), s * .986), .032, .022, ALLOY)
                rod(root, "hub bolt", (x + .037 * math.cos(a), .355 + .037 * math.sin(a), s * .999),
                    (x + .037 * math.cos(a), .355 + .037 * math.sin(a), s * 1.005), .009, ALLOY, 6)

    # Interior remains visible through genuine transparent panes, without an opaque canopy.
    for s in (-1, 1):
        bevel(cbox(root, "seat cushion", (.51, .12, .43), (-.22, .43, s * .34), CLOTH), .045, 3)
        back = cbox(root, "bucket seat back", (.13, .48, .44), (-.49, .69, s * .34), CLOTH)
        bevel(back, .045, 3)
        bevel(cbox(root, "headrest", (.14, .15, .24), (-.49, .97, s * .34), RUBBER), .04, 3)
        for dz in (-.17, .17):
            beam(root, "seat piping", (-.40, .48, s * .34 + dz), (-.40, .86, s * .34 + dz), .018, .014, BRASS)
    bevel(cbox(root, "dashboard", (.22, .13, 1.22), (.56, .70, 0), DARK), .035, 3)
    bevel(cbox(root, "center console", (.80, .19, .15), (-.02, .49, 0), DARK), .025, 2)
    cbox(root, "console touch strip", (.29, .008, .10), (.16, .59, 0), AMBER)
    cbox(root, "instrument display", (.015, .08, .24), (.435, .75, .34), PANEL)
    rod(root, "steering column", (.43, .68, .34), (.20, .73, .34), .023, DARK, 8)
    torus(root, "steering wheel", (.18, .75, .34), .117, .017, RUBBER, 24, 6, True)
    for angle in (0, 2.1, 4.2):
        rod(root, "steering spoke", (.18, .75, .34), (.18, .75 + .105 * math.sin(angle), .34 + .105 * math.cos(angle)), .012, ALLOY, 6)

    roof = loft(root, "arched roof", [
        [(x, 1.23, -.57), (x, 1.28, -.40), (x, 1.30, 0), (x, 1.28, .40), (x, 1.23, .57)]
        for x in (-.61, .18)
    ], PAINT, close=False)
    skin = roof.modifiers.new("roof shell", "SOLIDIFY")
    skin.thickness = .025
    apply(roof, skin)
    bevel(roof, .012, 2)
    pane(root, "windscreen", [(.86, .72, -.69), (.86, .72, .69), (.18, 1.235, .57), (.18, 1.235, -.57)])
    pane(root, "rear glass", [(-1.22, .73, .68), (-1.22, .73, -.68), (-.61, 1.235, -.57), (-.61, 1.235, .57)])
    for s in (-1, 1):
        corners = [(.86, .72, s * .69), (.18, 1.235, s * .57), (-.61, 1.235, s * .57), (-1.22, .73, s * .68)]
        pane(root, "side glazing", corners)
        for a, b in zip(corners, corners[1:] + corners[:1]):
            rod(root, "window frame", a, b, .023, PAINT, 8)
        rod(root, "window divider", (-.58, .72, s * .69), (-.58, 1.23, s * .57), .014, DARK, 6)


def previews(root, folder):
    # Same studio as mall_*; subsequent views reuse its lights and true glass opacity.
    preview(root, folder)
    scene = bpy.context.scene
    cam = scene.camera
    target = ba._city_point((0, .65, 0))
    for suffix, direction in (
        ("front", (1.4, .65, 1)), ("rear", (-1.4, .60, -1)), ("side", (.05, .33, 1.5)),
    ):
        cam.location = target + ba._city_point(direction).normalized() * 9
        cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
        cam.data.ortho_scale = 5.2
        scene.render.filepath = str(folder / f"mall_showcar_{suffix}.png")
        bpy.ops.render.render(write_still=True)
    target = ba._city_point((-.15, .71, .05))
    cam.location = target + ba._city_point((1.1, .9, 1.3)).normalized() * 5
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.ortho_scale = 2.3
    scene.render.filepath = str(folder / "mall_showcar_interior.png")
    bpy.ops.render.render(write_still=True)


def main():
    ba.reset_scene()
    root = ba._port_root("mall_showcar")
    materials()
    paint = ba.material(PAINT).node_tree.nodes.get("Principled BSDF")
    paint.inputs["Metallic"].default_value = .65
    paint.inputs["Roughness"].default_value = .26
    paint.inputs["Coat Weight"].default_value = .45
    showcar(root)
    finish_glazing(root)
    # Reduce curved bevel tessellation, preserving separate rims, glazing and interior.
    dense = [o for o in root.children if len(o.data.polygons) > 40 and o.data.materials[0].name != GLASS]
    for obj in dense:
        mod = obj.modifiers.new("display mesh budget", "DECIMATE")
        mod.ratio = .72
        apply(obj, mod)
    sources = REPO / "tools/blender/sources"
    sources.mkdir(exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(sources / "mall_showcar.blend"))
    ba._port_merge(root, {})
    triangles = sum(len(p.vertices) - 2 for obj in root.children for p in obj.data.polygons)
    assert 4000 <= triangles <= 8000, triangles
    print(f"[mall] mall_showcar: {triangles} tri", flush=True)
    ba.export_glb(root, str(REPO / "public/assets/models/city/mall_showcar.glb"), animations=False)
    folder = REPO / "tools/blender/previews/city"
    folder.mkdir(exist_ok=True)
    previews(root, folder)


if __name__ == "__main__":
    main()
