"""Blender offline only. Reduce the generated GLB; retain Tripo topology, UV and color."""
import sys
import bpy
from pathlib import Path
src, dst = map(lambda s:Path(s).resolve(),sys.argv[sys.argv.index('--')+1:])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(src))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0]
if len(meshes)>1:bpy.ops.object.join()
o=bpy.context.object
world=o.matrix_world.copy();o.parent=None;o.matrix_world=world
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
tris=sum(len(p.vertices)-2 for p in o.data.polygons)
if tris>52000:
    mod=o.modifiers.new('Preserve Tripo UV and silhouette','DECIMATE')
    mod.ratio=52000/tris;mod.use_collapse_triangulate=True
    bpy.ops.object.modifier_apply(modifier=mod.name)
for m in o.data.materials:
    shader=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    base=shader.inputs['Base Color']
    assert base.is_linked, 'Need the textured Tripo export'
    tex=base.links[0].from_node
    assert tex.type=='TEX_IMAGE'
    img=tex.image
    if max(img.size)>2048:img.scale(*[round(2048*n/max(img.size)) for n in img.size]);img.pack()
    nodes=m.node_tree.nodes;nodes.clear()
    bsdf=nodes.new('ShaderNodeBsdfPrincipled');out=nodes.new('ShaderNodeOutputMaterial');tex=nodes.new('ShaderNodeTexImage');tex.image=img
    m.node_tree.links.new(tex.outputs['Color'],bsdf.inputs['Base Color']);m.node_tree.links.new(bsdf.outputs[0],out.inputs['Surface'])
o.name=src.parent.name+' - Tripo cloth'
bpy.ops.export_scene.gltf(filepath=str(dst),export_format='GLB',use_selection=True,export_image_format='JPEG',export_jpeg_quality=94)
print('Source triangles:',tris,'; prepared:',dst)
