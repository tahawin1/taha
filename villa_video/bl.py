import bpy, sys, math, mathutils
S=0.0343
X=lambda px:(px-375)*S
Zt=lambda py:(py-985)*S
def B(px,py,h): return mathutils.Vector((X(px), -Zt(py), h))   # three(x,y,z)->blender(x,-z,y)
out=sys.argv[sys.argv.index('--')+1]; views=sys.argv[sys.argv.index('--')+2:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='/tmp/villa.glb')
sc=bpy.context.scene
# materials
for m in bpy.data.materials:
    n=m.name.split('.')[0]; nt=m.node_tree; bs=nt.nodes.get('Principled BSDF')
    if not bs: continue
    m.blend_method='OPAQUE' if hasattr(m,'blend_method') else None
    def inp(k): return bs.inputs[k]
    if n in('glass','glassTint'):
        inp('Alpha').default_value=1; inp('Transmission Weight').default_value=1; inp('Roughness').default_value=0.02; inp('IOR').default_value=1.45
        inp('Base Color').default_value=(0.9,0.97,1,1) if n=='glass' else (0.7,0.85,0.9,1)
    elif n=='water':
        inp('Alpha').default_value=1; inp('Transmission Weight').default_value=0.9; inp('Roughness').default_value=0.03; inp('Base Color').default_value=(0.1,0.55,0.7,1)
        inp('Emission Strength').default_value=0
    elif n in('led','ledCool'):
        inp('Emission Color').default_value=(1,0.85,0.6,1); inp('Emission Strength').default_value=6
    elif n=='curtain': pass
    else:
        if 'Emission Strength' in bs.inputs: inp('Emission Strength').default_value=0
        if n in('stone','marble','tileDark','bathTile','poolTile'): inp('Roughness').default_value=0.15
# world sky
w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True
sk=w.node_tree.nodes.new('ShaderNodeTexSky'); sk.sky_type='MULTIPLE_SCATTERING'; sk.sun_elevation=math.radians(42); sk.sun_rotation=math.radians(150)
w.node_tree.links.new(sk.outputs[0], w.node_tree.nodes['Background'].inputs[0]); w.node_tree.nodes['Background'].inputs[1].default_value=1.0
sun=bpy.data.lights.new('sun','SUN'); sun.energy=3; sun.angle=math.radians(1.5); so=bpy.data.objects.new('sun',sun); sc.collection.objects.link(so)
so.rotation_euler=(math.radians(48),0,math.radians(-35))
# interior lights: area lights per room (soft fill)
def area(px,py,h,size=3,e=250,col=(1,0.85,0.65)):
    l=bpy.data.lights.new('a','AREA'); l.energy=e; l.size=size; l.color=col
    o=bpy.data.objects.new('a',l); o.location=B(px,py,h); o.rotation_euler=(math.pi,0,0); sc.collection.objects.link(o)
for (px,py,h) in [(650,600,3.2),(620,750,3.2),(878,455,3.2),(878,770,3.2),(757,745,6.0),(640,775,6.3),(895,470,6.3),(890,800,6.3),(700,690,6.3),(650,600,-0.1),(620,740,-0.1),(880,450,-0.1),(880,750,-0.1),(780,600,-0.1)]:
    area(px,py,h)
# render settings
sc.render.engine='CYCLES'; sc.cycles.device='CPU'; sc.cycles.samples=int(48); sc.cycles.use_denoising=True
try: sc.cycles.denoiser='OPENIMAGEDENOISE'
except: pass
sc.cycles.max_bounces=6; sc.cycles.transmission_bounces=8; sc.cycles.glossy_bounces=4
sc.render.resolution_x=1600; sc.render.resolution_y=900; sc.render.resolution_percentage=100
sc.view_settings.view_transform='AgX'; sc.view_settings.look='AgX - Medium High Contrast' if False else 'None'
sc.view_settings.exposure=-1.3
cam=bpy.data.cameras.new('c'); co=bpy.data.objects.new('c',cam); sc.collection.objects.link(co); sc.camera=co
for v in views:
    name,a=v.split(':'); px,py,h,tx,ty,th,fov=[float(x) for x in a.split(',')]
    co.location=B(px,py,h); d=B(tx,ty,th)-co.location
    co.rotation_euler=d.to_track_quat('-Z','Y').to_euler(); cam.angle=math.radians(fov)
    sc.render.filepath=f'{out}/{name}.png'; bpy.ops.render.render(write_still=True); print('done',name,flush=True)
