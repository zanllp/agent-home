"""Development only: blender -b -P tools/prepare-dining-prop.py -- INPUT.glb OUTPUT.glb fruit|cooker|bowl|vase [food.glb]"""
import numpy as np
from pathlib import Path
import sys
import bpy
from mathutils import Vector

source,output,kind,*food=sys.argv[sys.argv.index('--')+1:]
src,dst=Path(source).resolve(),Path(output).resolve()
width={"fruit":.292,"cooker":.37,"bowl":.152,"vase":.18}[kind]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(src))
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
if not meshes:
    raise ValueError('No fruit geometry')
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes)>1:
    bpy.ops.object.join()
obj = bpy.context.object
world = obj.matrix_world.copy()
obj.parent = None
obj.matrix_world = world
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
if tris > 22000:
    mod = obj.modifiers.new('Preserve fruit silhouettes and colour UV', 'DECIMATE')
    mod.ratio = 22000 / tris
    mod.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=mod.name)
points = [Vector(v) for v in obj.bound_box]
lo = Vector([min(v[i] for v in points) for i in range(3)])
hi = Vector([max(v[i] for v in points) for i in range(3)])
scale = width / max(hi.x - lo.x, hi.y - lo.y)
floor_center = Vector(((lo.x+hi.x)/2, (lo.y+hi.y)/2, lo.z))
for v in obj.data.vertices:
    v.co = (v.co-floor_center)*scale
for p in obj.data.polygons:
    p.use_smooth = True
obj.name = {'fruit':'Celadon dish and fresh mandarins','cooker':'Whale rice cooker','bowl':'Whale porcelain bowl','vase':'Daisies in celadon'}[kind]
for mat in obj.data.materials:
    nodes=mat.node_tree.nodes
    bsdf=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
    base=bsdf.inputs['Base Color']
    albedo=next((n.image for n in nodes if n.type=='TEX_IMAGE' and n.image and 'basecolor' in n.image.name.lower()), None)
    if not albedo:
        raise ValueError('Missing painted base-colour texture')
    if max(albedo.size)>2048:
        factor=2048/max(albedo.size)
        albedo.scale(*[max(1, round(v*factor)) for v in albedo.size])
    # Correct the generated yellow cast on peel and porcelain, leave the cool painted accents intact.
    if kind in ('fruit','bowl'):
        pixels=np.empty(len(albedo.pixels),dtype=np.float32)
        albedo.pixels.foreach_get(pixels)
        rgb=pixels.reshape(-1,4)[:,:3]
        r,g,b=rgb.T.copy()
        if kind=='fruit':
            strength=np.clip((r-g*.93)*6,0,1)*np.clip((g-b)*5,0,1)
            rgb[:,0]+=strength*(.085+.08*r)
            rgb[:,1]*=1-.17*strength
        else:
            strength=np.clip((r-b)*5,0,1)*np.clip((r-.09)*8,0,1)
            rgb+=strength[:,None]*(np.array([.78,.74,.65])-rgb)*.46
        np.clip(rgb,0,1,out=rgb)
        albedo.pixels.foreach_set(pixels)
        albedo.pack()
    nodes.clear()
    shader=nodes.new('ShaderNodeBsdfPrincipled')
    shader.inputs['Roughness'].default_value={'fruit':.65,'bowl':.32,'cooker':.48,'vase':.55}[kind]
    out=nodes.new('ShaderNodeOutputMaterial')
    tex=nodes.new('ShaderNodeTexImage')
    tex.image=albedo
    mat.node_tree.links.new(tex.outputs['Color'], shader.inputs['Base Color'])
    mat.node_tree.links.new(shader.outputs[0], out.inputs['Surface'])
    mat.use_backface_culling=False
if kind in ('bowl','cooker'):
    if not food:
        raise ValueError('Pass the corresponding food layer from tools/export-rice-set.mjs')
    bpy.ops.import_scene.gltf(filepath=str(Path(food[0]).resolve()))
    if not bpy.data.objects.get('Steamed-rice'):
        raise ValueError('Missing removable food group')
    obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(dst),export_format='GLB',use_selection=True,
    export_image_format='JPEG', export_jpeg_quality=93)
