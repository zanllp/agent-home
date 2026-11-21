"""Bind the generated Tripo triangles (no procedural garment mesh) to the original character."""
import json,struct,sys
from pathlib import Path
import numpy as np
from cuffs import open_cuffs, RIM

def load(path):
    raw=Path(path).read_bytes()
    size=struct.unpack_from('<I',raw,12)[0]
    return json.loads(raw[20:20+size]),raw[28+size:]
def save(path,doc,bin):
    raw=json.dumps(doc,separators=(',',':')).encode()
    raw+=b' '*(-len(raw)%4);bin+=b'\0'*(-len(bin)%4)
    Path(path).write_bytes(struct.pack('<4sIIII',b'glTF',2,28+len(raw)+len(bin),len(raw),0x4e4f534a)+raw+struct.pack('<I4s',len(bin),b'BIN\0')+bin)

TYPES={5121:'u1',5123:'<u2',5125:'<u4',5126:'<f4'}
DIMS={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def read(doc,buf,i):
    a=doc['accessors'][i];v=doc['bufferViews'][a['bufferView']]
    assert 'byteStride' not in v
    return np.frombuffer(buf,dtype=TYPES[a['componentType']],count=a['count']*DIMS[a['type']],offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,DIMS[a['type']])
def smooth(lo,hi,x):
    t=np.clip((x-lo)/(hi-lo),0,1);return t*t*(3-2*t)

def fit(raw,base,out,transform,*,cutter=open_cuffs,name="Moon-tide-Tripo",targets=("SeatedFit",),original_color=None):
    doc,b=load(raw);rig,br=load(base);buf=bytearray()
    source=dict(doc)
    doc['bufferViews']=[];doc['accessors']=[]
    image_doc,image_bin=source,b
    images=source['images']
    if original_color:
        # Keep the source JPEG bytes, not Blender's resized/re-encoded color.
        assert len(images)==1 and len(doc['materials'])==1
        image_doc,image_bin=load(original_color)
        assert len(image_doc['materials'])==1
        color=image_doc['materials'][0]['pbrMetallicRoughness']['baseColorTexture']['index']
        images=[image_doc['images'][image_doc['textures'][color]['source']]]
    for img,embedded in zip(doc['images'],images):
        view=image_doc['bufferViews'][embedded['bufferView']]
        img['mimeType']=embedded['mimeType']
        start=view.get('byteOffset',0);size=view['byteLength']
        buf.extend(b'\0'*(-len(buf)%4))
        img['bufferView']=len(doc['bufferViews'])
        doc['bufferViews'].append({'buffer':0,'byteOffset':len(buf),'byteLength':size})
        buf.extend(image_bin[start:start+size])
    def put(arr,kind,typ,bounds=False):
        arr=np.ascontiguousarray(arr,dtype=TYPES[typ]); buf.extend(b'\0'*(-len(buf)%4));off=len(buf);buf.extend(arr.tobytes())
        doc['bufferViews'].append({'buffer':0,'byteOffset':off,'byteLength':arr.nbytes})
        a={'bufferView':len(doc['bufferViews'])-1,'componentType':typ,'count':len(arr),'type':kind}
        if bounds:a.update(min=arr.min(axis=0).tolist(),max=arr.max(axis=0).tolist())
        doc['accessors'].append(a);return len(doc['accessors'])-1
    skin=rig['skins'][0];ids=skin['joints'];jointNames=[rig['nodes'][i]['name'].split(':')[-1] for i in ids]
    bones=sorted(ids);remap={old:i for i,old in enumerate(bones)}
    nodes=[]
    for idx in bones:
        n=dict(rig['nodes'][idx]);n['name']=n['name'].replace(':','')
        if 'children'in n:n['children']=[remap[i] for i in n['children'] if i in remap]
        nodes.append(n)
    ibm=read(rig,br,skin['inverseBindMatrices'])
    roots=[remap[i] for i in bones if all(i not in rig['nodes'][j].get('children',[]) for j in bones)]
    assert len(roots)==1 and len(doc['meshes'])==1
    doc['skins']=[{'joints':[remap[i] for i in ids],'inverseBindMatrices':put(ibm,'MAT4',5126),'skeleton':roots[0]}]
    prims=doc['meshes'][0]['primitives']
    P=[read(source,b,p['attributes']['POSITION']) for p in prims]
    allp=np.concatenate(P);low=allp.min(0);high=allp.max(0)
    for p in prims:
        arrays,indices=cutter({k:read(source,b,i) for k,i in p['attributes'].items()},read(source,b,p['indices']),low,high)
        for k,kind in [('NORMAL','VEC3'),('TEXCOORD_0','VEC2')]:
            p['attributes'][k]=put(arrays[k],kind,5126)
        p['indices']=put(indices,'SCALAR',5123 if indices.max()<65535 else 5125)
        xyz,w,*deltas=transform(arrays['POSITION'],low,high,jointNames)
        a=p['attributes'];a['POSITION']=put(xyz,'VEC3',5126,True)
        order=np.argsort(-w,axis=1)[:,:4];selected=np.take_along_axis(w,order,axis=1)
        assert selected.sum(1).min()>.94
        a['JOINTS_0']=put(order,'VEC4',5123);a['WEIGHTS_0']=put(selected/selected.sum(1)[:,None],'VEC4',5126)
        assert len(deltas)==len(targets)
        p['targets']=[{'POSITION':put(delta,'VEC3',5126,True)} for delta in deltas]
    doc['meshes'][0].update(name=name,weights=[0]*len(targets),extras={'targetNames':list(targets)})
    # Only the generated mesh and original bind joints are present; no character art.
    nodes.append({'name':name,'mesh':0,'skin':0});doc['nodes']=nodes;doc['scenes']=[{'nodes':roots+[len(nodes)-1]}];doc['scene']=0
    for m in doc['materials']:
        m['extensions']={'KHR_materials_unlit':{}};m['doubleSided']=True
    doc['extensionsUsed']=sorted(set(doc.get('extensionsUsed',[])+['KHR_materials_unlit']))
    doc['buffers']=[{'byteLength':len(buf)}];save(out,doc,buf)

def moon_tide(pos,lo,hi,names):
    # Coordinates measured on the real three-view export, normalized to collar height.
    p=(pos-(lo+hi)/2)/(hi[1]-lo[1]);p[:,1]+=.5
    x,h,z=p.T;ax=np.abs(x); left=x>0
    boundary=np.interp(h,[.60,.65,.73,.80,.87,.93,1],[.210,.188,.157,.132,.100,.082,.095])
    arm=smooth(boundary-.012,boundary+.014,ax)*smooth(.580,.604,h)*(1-smooth(.91,.975,h))
    cuff=arm*(1-smooth(.637,.90,h))
    y=h*.616+cuff*np.where(left,-.028,-.011)
    px=x*.616-.006+cuff*np.where(left,.012,-.011)
    pz=z*.59+.068+cuff*np.where(left,.028,.014)
    xyz=np.stack([px,y,pz],axis=1)
    # Seat the existing ring on the scanned palm axis (the two bind wrists
    # aren't mirror images). Use one frame for the whole circumference.
    station=.55*ax-.835*h
    across=.835*ax+.55*h
    end=smooth(-.50,-.411,station)*smooth(.498,.536,across)*smooth(.543,.59,h)*(1-smooth(.80,.85,h))
    arm=arm*(1-end)+end
    sign=np.where(left,1,-1)
    axis=np.column_stack([.76*sign,np.full_like(h,-.62),np.full_like(h,.18)])
    axis/=np.linalg.norm(axis,axis=1)[:,None]
    lateral=np.column_stack([.62*sign,np.full_like(h,.76),np.zeros_like(h)])
    lateral/=np.linalg.norm(lateral,axis=1)[:,None]
    depth=np.cross(axis,lateral)*sign[:,None]
    center=np.column_stack([np.where(left,.190,-.207),np.full_like(h,.376),np.full_like(h,.093)])
    ring=center+axis*((station-RIM)*.62)[:,None]+lateral*((across-.593)*.46)[:,None]+depth*((z+.008)*.59)[:,None]
    xyz=xyz*(1-end[:,None])+ring*end[:,None]

    # At seated flexion keep the shirt's embroidered hem above the thighs.
    # Only a corrective morph; it does not supply replacement geometry.
    seat=np.zeros_like(xyz)
    hem=smooth(.34,.51,h)*(1-smooth(.51,.68,h))*(1-arm)
    seat[:,1]=hem*(.012+.020*smooth(-.04,.12,z));seat[:,2]=hem*(.013+.027*smooth(0,.12,z))
    w=np.zeros((len(pos),len(names)))
    def add(b,weight):w[:,names.index(b)]+=weight
    top=smooth(.34,.66,h);pants=(1-top)*(1-arm);torso=(1-arm)*top
    spine1=smooth(.405,.457,y);spine2=smooth(.462,.522,y)
    add('Hips',torso*(1-spine1));add('Spine1',torso*(spine1-spine2));add('Spine2',torso*spine2)
    side=smooth(-.008,.008,x)
    for label,part in [('Left',side),('Right',1-side)]:
        upper=smooth(.175,.239,y);shin=(1-upper)*smooth(.052,.091,y)
        add(label+'UpLeg',pants*upper*part);add(label+'Leg',pants*shin*part);add(label+'Foot',pants*(1-upper-shin)*part)
        forearm=1-smooth(.425,.47,y);shoulder=smooth(.531,.565,y)
        hand=smooth(.86,1,cuff)*.80*(1-end)+end*np.where(left,.46,.65);add(label+'Hand',arm*forearm*part*hand);add(label+'ForeArm',arm*forearm*part*(1-hand));add(label+'Arm',arm*(1-forearm)*(1-shoulder)*part);add(label+'Shoulder',arm*shoulder*part)
    return xyz,w,seat
if __name__=='__main__': fit(*sys.argv[1:4],moon_tide)
