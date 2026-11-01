"""Test: a hand-built iron mine rendered at Aldermarch's map camera with a warm sun and real shadow."""
import bpy, math, random, sys, bmesh
from mathutils import Vector
OUT = sys.argv[sys.argv.index('--out')+1] if '--out' in sys.argv else '/tmp/mine.png'
SIZE = 1.6             # tiles across the sprite image (game draws it at TILE_W * SIZE)
PX_PER_TILE = 300
SUN_ELEV = float(sys.argv[sys.argv.index('--sun')+1]) if '--sun' in sys.argv else 32
random.seed(4)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.samples = 96; sc.cycles.use_denoising = True
sc.cycles.device = 'CPU'
sc.render.film_transparent = True
sc.render.resolution_x = sc.render.resolution_y = int(SIZE * PX_PER_TILE)
sc.view_settings.view_transform = 'Standard'
sc.view_settings.look = 'None'

def mat(name, color, rough=0.85, noise=None, emit=None):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1); b.inputs['Roughness'].default_value = rough
    if noise:
        tex = nt.nodes.new('ShaderNodeTexNoise'); tex.inputs['Scale'].default_value = noise[0]; tex.inputs['Detail'].default_value = 6
        ramp = nt.nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].color = (*noise[1], 1); ramp.color_ramp.elements[1].color = (*noise[2], 1)
        nt.links.new(tex.outputs['Fac'], ramp.inputs['Fac']); nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1); b.inputs['Emission Strength'].default_value = 6
    return m

ROCK = mat('rock', (0.3, 0.3, 0.33), noise=(10, (0.17, 0.17, 0.2), (0.42, 0.41, 0.44)))
WOOD = mat('wood', (0.36, 0.22, 0.12), noise=(12, (0.27, 0.16, 0.08), (0.45, 0.29, 0.16)))
DARK = mat('dark', (0.02, 0.015, 0.01), rough=1)
IRON = mat('iron', (0.25, 0.25, 0.27), rough=0.5)
ORE = mat('ore', (0.12, 0.10, 0.10), noise=(20, (0.07, 0.06, 0.06), (0.35, 0.20, 0.15)))
SPOIL = mat('spoil', (0.42, 0.33, 0.28), noise=(8, (0.32, 0.25, 0.21), (0.55, 0.44, 0.36)))
LEAF = mat('leaf', (0.25, 0.45, 0.12), noise=(6, (0.17, 0.34, 0.08), (0.42, 0.62, 0.18)))
GRASS = mat('grass', (0.33, 0.52, 0.16))
LAMP = mat('lamp', (1.0, 0.7, 0.3), emit=(1.0, 0.65, 0.25))

def add(obj, m):
    obj.data.materials.append(m); return obj

def rockish(loc, scale, m=ROCK, sub=4, strength=0.35, tex_scale=1.4, seed=0, flat=True):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=1, location=loc)
    o = bpy.context.object; o.scale = scale
    t = bpy.data.textures.new(f'v{seed}', 'VORONOI'); t.noise_scale = tex_scale; t.distance_metric = 'DISTANCE'
    d = o.modifiers.new('d', 'DISPLACE'); d.texture = t; d.strength = strength; d.texture_coords = 'GLOBAL'
    t2 = bpy.data.textures.new(f'c{seed}', 'CLOUDS'); t2.noise_scale = tex_scale * .35
    d2 = o.modifiers.new('d2', 'DISPLACE'); d2.texture = t2; d2.strength = strength * .6; d2.texture_coords = 'GLOBAL'
    if flat:
        dec = o.modifiers.new('dec', 'DECIMATE'); dec.decimate_type = 'DISSOLVE'; dec.angle_limit = math.radians(9)
    bpy.ops.object.shade_flat() if flat else bpy.ops.object.shade_smooth()
    return add(o, m)

def box(loc, dims, m, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object; o.scale = dims; return add(o, m)

# ground plane = shadow catcher (only the shadow reaches the image)
bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, 0))
ground = bpy.context.object; ground.is_shadow_catcher = True

# rocky hill: one big mass + a few crags, cut back to sit within ~1.2 tiles
hill = rockish((-0.3, 0.3, -0.05), (0.58, 0.5, 0.5), sub=5, strength=0.22, tex_scale=0.35, seed=1)
for i, (x, y, s) in enumerate([(-0.6, 0.45, 0.3), (0.0, 0.6, 0.26), (-0.65, 0.0, 0.22), (0.05, 0.2, 0.2)]):
    rockish((x, y, s * 0.7), (s * .8, s * .75, s * 1.6), sub=4, strength=0.09, tex_scale=0.8, seed=10 + i)

# tunnel mouth facing the camera side (+x, -y): dark opening + timber frame
fx, fy = 0.05, -0.05
face = Vector((1, -1, 0)).normalized()
ang = math.atan2(face.y, face.x) + math.pi / 2
box((fx - 0.02, fy + 0.02, 0.17), (0.04, 0.28, 0.34), DARK, rot=(0, 0, ang + math.pi / 2))
for side in (-1, 1):
    off = Vector((-face.y, face.x, 0)) * 0.15 * side
    box((fx + off.x, fy + off.y, 0.19), (0.045, 0.045, 0.38), WOOD)
box((fx, fy, 0.39), (0.045, 0.4, 0.055), WOOD, rot=(0, 0, ang + math.pi / 2))

# rails + sleepers running out of the tunnel toward the camera
L = 0.36
for i in range(7):
    t = 0.05 + i * L / 7
    p = Vector((fx, fy, 0)) + face * t
    box((p.x, p.y, 0.008), (0.03, 0.2, 0.012), WOOD, rot=(0, 0, ang + math.pi / 2))
for side in (-1, 1):
    off = Vector((-face.y, face.x, 0)) * 0.065 * side
    mid = Vector((fx, fy, 0)) + face * (L / 2 + 0.05) + off
    box((mid.x, mid.y, 0.02), (L, 0.012, 0.012), IRON, rot=(0, 0, math.atan2(face.y, face.x)))

# ore cart on the rails
cp = Vector((fx, fy, 0)) + face * 0.3
cart = box((cp.x, cp.y, 0.09), (0.16, 0.11, 0.08), WOOD, rot=(0, 0, math.atan2(face.y, face.x)))
for sx in (-1, 1):
    for sy in (-1, 1):
        off = face * 0.055 * sx + Vector((-face.y, face.x, 0)) * 0.065 * sy
        bpy.ops.mesh.primitive_cylinder_add(radius=0.03, depth=0.015, location=(cp.x + off.x, cp.y + off.y, 0.035),
                                            rotation=(math.pi / 2, 0, math.atan2(face.y, face.x)))
        add(bpy.context.object, IRON)
for i in range(9):
    rockish((cp.x + random.uniform(-.05, .05), cp.y + random.uniform(-.04, .04), 0.14 + random.uniform(0, .03)),
            (0.03, 0.03, 0.025), m=ORE, sub=1, strength=0.01, seed=40 + i)

# spoil heap beside the entrance
rockish((fx + 0.18, fy + 0.25, 0.0), (0.2, 0.17, 0.09), m=SPOIL, sub=3, strength=0.04, tex_scale=6, seed=60)

# grass tufts and a small tree on the rocks
for i in range(12):
    a = random.uniform(0, 2 * math.pi); r = random.uniform(0.2, 0.55)
    rockish((-0.3 + r * math.cos(a), 0.3 + r * math.sin(a), random.uniform(0.2, 0.45)), (0.05, 0.05, 0.03), m=GRASS, sub=2, strength=0.01, seed=80 + i, flat=False)
bpy.ops.mesh.primitive_cylinder_add(radius=0.02, depth=0.18, location=(-0.4, 0.4, 0.62)); add(bpy.context.object, WOOD)
for i, (dx, dy, dz, s) in enumerate([(0, 0, .72, .1), (.06, .03, .66, .08), (-.05, -.02, .68, .08)]):
    rockish((-0.4 + dx, 0.4 + dy, dz + .07), (s * 1.2, s * 1.2, s), m=LEAF, sub=3, strength=0.03, tex_scale=6, seed=100 + i, flat=False)

# lantern post
lp = Vector((fx, fy, 0)) + Vector((-face.y, face.x, 0)) * -0.2 + face * 0.08
bpy.ops.mesh.primitive_cylinder_add(radius=0.01, depth=0.28, location=(lp.x, lp.y, 0.14)); add(bpy.context.object, WOOD)
box((lp.x, lp.y, 0.29), (0.03, 0.03, 0.04), LAMP)

# light: warm low sun from the screen's upper left (world -x), cool sky fill
sun_dir = Vector((-1.0, 0.25, math.tan(math.radians(SUN_ELEV)) * math.hypot(1.0, 0.25))).normalized()
bpy.ops.object.light_add(type='SUN', location=(0, 0, 5))
sun = bpy.context.object; sun.data.energy = 4.2; sun.data.color = (1.0, 0.9, 0.76); sun.data.angle = math.radians(4)
sun.rotation_euler = (-sun_dir).to_track_quat('-Z', 'Y').to_euler()
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
bg = w.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (0.55, 0.65, 0.85, 1); bg.inputs['Strength'].default_value = 0.55

# camera: orthographic, 45 deg round, tilted so a ground square comes out 1.55 wide : 1 tall (the game's diamond)
elev = math.asin(1 / 1.55)
bpy.ops.object.camera_add()
cam = bpy.context.object; sc.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = SIZE * math.sqrt(2)
d = 20
cam.location = (d * math.cos(elev) * math.cos(math.radians(-45)), d * math.cos(elev) * math.sin(math.radians(-45)), d * math.sin(elev))
cam.rotation_euler = (Vector((0, 0, 0)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
# the tile centre sits where the game anchors a sprite: 0.45 tile-heights above the image bottom, centred
b = 0.45 * (1 / 1.55) / SIZE
cam.data.shift_y = 0.5 - b
sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print('rendered', OUT)
