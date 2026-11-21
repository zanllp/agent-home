"""Select original chin/hand triangles by their painted skin atlas (offline authoring)."""
from fit import *
import subprocess
doc,buf=load(sys.argv[1])
iv=doc['bufferViews'][doc['images'][0]['bufferView']];off=iv.get('byteOffset',0)
img=subprocess.check_output(['djpeg','-ppm'],input=buf[off:off+iv['byteLength']])
header,body=img.split(b'\n255\n',1);w,h=map(int,header.split()[-2:])
pix=np.frombuffer(body,'u1').reshape(h,w,3)
mask={}
for name in ['Arm.L','Arm.R','Dress']:
    m=next(m for m in doc['meshes'] if m['name']==name)
    p=next(p for p in m['primitives'] if p['material']==0)
    a=p['attributes'];xyz=read(doc,buf,a['POSITION']);uv=read(doc,buf,a['TEXCOORD_0']);tri=read(doc,buf,p['indices']).reshape(-1,3);c=xyz[tri].mean(axis=1)
    if name=='Dress':
        region=(c[:,1]>.576)&(abs(c[:,0]+.006)<.114)&(c[:,2]>.065)
        votes=np.zeros(len(tri))
        for bc in [[1/3]*3,[.7,.15,.15],[.15,.7,.15],[.15,.15,.7]]:
            u=(uv[tri]*np.array(bc)[None,:,None]).sum(axis=1)
            r,g,b=pix[(u[:,1]*(h-1)).astype(int),(u[:,0]*(w-1)).astype(int)].astype(float).T
            votes+=(r>120)&(r>g*1.015)&(r>b*1.035)&(g>b*.92)
        keep=np.flatnonzero(region&(votes>=1))
    else:
        # Beyond this wrist section the hand is separate from the scalloped
        # lace. Flood from the fingertips, welding only coincident UV seams.
        sign=1 if name=='Arm.L' else -1
        center=[.186 if sign==1 else -.202,.378,.092]
        axis=np.array([.76*sign,-.62,.18])
        station=(c-center)@axis
        candidates=np.flatnonzero((station>-.008)&(c[:,1]<.419))
        _,weld=np.unique(xyz.round(5),axis=0,return_inverse=True)
        faces=weld[tri[candidates]]
        incident={}
        for i,face in enumerate(faces):
            for v in face: incident.setdefault(v,[]).append(i)
        seed=int(np.argmax(station[candidates]))
        seen={seed};todo=[seed]
        while todo:
            for v in faces[todo.pop()]:
                for nxt in incident.pop(v,[]):
                    if nxt not in seen: seen.add(nxt);todo.append(nxt)
        keep=np.sort(candidates[list(seen)])
        assert np.isin(np.flatnonzero(station>.020),keep).all(), 'Detached fingertip'
    ranges=[]
    for n in keep:
        if ranges and n==sum(ranges[-1]):ranges[-1][1]+=1
        else:ranges.append([int(n),1])
    mask[name]=ranges
# The jaw crosses two skinned primitives. Pair its duplicated border vertices
# in bind space rather than changing any nearby hair or the cheek artwork.
def surface(name):
    m=next(m for m in doc['meshes'] if m['name']==name)
    p=next(p for p in m['primitives'] if p['material']==0)
    return read(doc,buf,p['attributes']['POSITION']),read(doc,buf,p['indices']).reshape(-1,3)
p,t=surface('Dress')
sel=np.concatenate([np.arange(i,i+n) for i,n in mask['Dress']])
border={tuple(v) for v in p[np.unique(t[sel])].round(6)}
head,_=surface('HeadHair')
mask['jawSeamVertices']=[i for i,v in enumerate(head.round(6)) if tuple(v) in border]
assert mask['jawSeamVertices']
Path(sys.argv[2]).write_text(json.dumps(mask,separators=(',',':'))+'\n')
