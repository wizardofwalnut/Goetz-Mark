"""Render an imported model at the Aldermarch map camera, warm sun upper-left, shadow-catcher ground."""
import bpy, math, sys
from mathutils import Vector, Matrix
a = sys.argv
src = a[a.index('--in')+1]; out = a[a.index('--out')+1]
rotz = float(a[a.index('--rotz')+1]) if '--rotz' in a else 0
tilt = float(a[a.index('--tilt')+1]) if '--tilt' in a else 0
width_tiles = float(a[a.index('--width')+1]) if '--width' in a else 1.2
SIZE = 1.6; PX = 300; SUN_ELEV = 32
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.samples = 64; sc.cycles.use_denoising = True
sc.render.film_transparent = True
sc.render.resolution_x = sc.render.resolution_y = int(SIZE * PX)
sc.view_settings.view_transform = 'Standard'
if src.endswith('.obj'):
    bpy.ops.wm.obj_import(filepath=src)
else:
    bpy.ops.import_scene.gltf(filepath=src)
objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
o = objs[0]
# TripoSR is y-up-ish: stand it up, then turn
o.rotation_euler = (math.radians(tilt), 0, math.radians(rotz))
bpy.context.view_layer.update()
bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
mn = Vector((min(v.x for v in bb), min(v.y for v in bb), min(v.z for v in bb)))
mx = Vector((max(v.x for v in bb), max(v.y for v in bb), max(v.z for v in bb)))
s = width_tiles / max(mx.x - mn.x, mx.y - mn.y)
o.scale = (s, s, s); bpy.context.view_layer.update(); bpy.ops.object.transform_apply(scale=True)
bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
cx = (min(v.x for v in bb) + max(v.x for v in bb)) / 2; cy = (min(v.y for v in bb) + max(v.y for v in bb)) / 2; mz = min(v.z for v in bb)
o.location = (o.location.x - cx, o.location.y - cy, o.location.z - mz)
# vertex colours as the surface
m = bpy.data.materials.new('vc'); m.use_nodes = True
nt = m.node_tree; b = nt.nodes['Principled BSDF']; b.inputs['Roughness'].default_value = .9
if o.data.color_attributes:
    ca = nt.nodes.new('ShaderNodeVertexColor'); ca.layer_name = o.data.color_attributes[0].name
    nt.links.new(ca.outputs['Color'], b.inputs['Base Color'])
o.data.materials.clear(); o.data.materials.append(m)
bpy.ops.object.shade_smooth()
bpy.ops.mesh.primitive_plane_add(size=12); bpy.context.object.is_shadow_catcher = True
sun_dir = Vector((-1.0, 0.25, math.tan(math.radians(SUN_ELEV)) * math.hypot(1.0, 0.25))).normalized()
bpy.ops.object.light_add(type='SUN'); sun = bpy.context.object
sun.data.energy = 4.2; sun.data.color = (1.0, 0.9, 0.76); sun.data.angle = math.radians(4)
sun.rotation_euler = (-sun_dir).to_track_quat('-Z', 'Y').to_euler()
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
bg = w.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (0.55, 0.65, 0.85, 1); bg.inputs['Strength'].default_value = 0.6
elev = math.asin(1 / 1.55)
bpy.ops.object.camera_add(); cam = bpy.context.object; sc.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = SIZE * math.sqrt(2)
d = 20; cam.location = (d * math.cos(elev) * math.cos(math.radians(-45)), d * math.cos(elev) * math.sin(math.radians(-45)), d * math.sin(elev))
cam.rotation_euler = (-cam.location).to_track_quat('-Z', 'Y').to_euler()
cam.data.shift_y = 0.5 - 0.45 * (1 / 1.55) / SIZE
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
print('rendered', out)
