"""Refit only Moon Tide's toe boxes after feet.py, keeping its scanned ankle, UVs and rig."""
import sys, subprocess, tempfile
from pathlib import Path
import numpy as np
from fit import load, read, save, TYPES

CUT = .117
TILE = 112
GUTTER = 5

def knit_tile(angles, colors):
    y,x = np.indices((TILE,TILE))
    u = np.clip((x+.5-GUTTER)/(TILE-2*GUTTER),0,1)
    t = np.clip((y+.5-GUTTER)/(TILE-2*GUTTER),0,1)
    theta = u*2*np.pi
    # Match the existing knit at the join; soften its baked shadows towards the tip.
    edge = np.stack([np.interp(u,angles,c,period=1) for c in colors.T],axis=-1)
    shade = np.clip((np.sin(theta)*np.cos(t*np.pi/2)+.66+.17*t)/1.40,0,1)
    target = np.array([188,171,161])+(np.array([250,243,234])-[188,171,161])*shade[:,:,None]
    target = target*(1-.14*t[:,:,None])+np.array([235,223,211])*.14*t[:,:,None]
    w = np.minimum(t*3,1);w=w*w*(3-2*w)
    knit = .9*np.cos(theta*25 + .9*np.sin(2*np.pi*t*17)) + .5*np.sin(2*np.pi*t*17)
    seam = 5*np.exp(-((t-.53)/.020)**2)-2*np.exp(-((t-.55)/.024)**2)
    rgb = edge*(1-w[:,:,None])+target*w[:,:,None]+((knit-seam)*w*(1-t)**.5)[:,:,None]
    return b'P6\n%d %d\n255\n'%(TILE,TILE)+rgb.clip(0,255).astype('u1').tobytes()

def repair(source,dest):
    doc,b=load(source);mesh=doc['meshes'][0]
    assert mesh['name']=='Moon-tide-Tripo'
    p=mesh['primitives'][0];keys=dict(p['attributes'])
    for i,target in enumerate(p['targets']):
        keys.update({f'{i}:{k}':v for k,v in target.items()})
    arr={k:read(doc,b,i) for k,i in keys.items()}
    tri=read(doc,b,p['indices']).reshape(-1,3);pos=arr['POSITION']
    image=doc['images'][0]['bufferView'];view=doc['bufferViews'][image]
    off=view.get('byteOffset',0);jpeg=b[off:off+view['byteLength']]
    ppm=subprocess.check_output(['djpeg','-ppm'],input=jpeg);header,pix=ppm.split(b'\n255\n',1)
    W,H=map(int,header.split()[-2:]);atlas=np.frombuffer(pix,'u1').reshape(H,W,3)
    extra={k:[] for k in arr};cuts={};edges=[[],[]]
    def get(k,i):return arr[k][i] if i<len(pos) else extra[k][i-len(pos)]
    def append(data):
        i=len(pos)+len(extra['POSITION'])
        for k in arr: extra[k].append(data[k])
        return i
    def cut(a,b):
        key=tuple(sorted((a,b)))
        if key not in cuts:
            t=(CUT-pos[a,2])/(pos[b,2]-pos[a,2])
            data={k:v[a]*(1-t)+v[b]*t for k,v in arr.items()}
            # Both ends are rigidly bound to the same foot here.
            assert arr['JOINTS_0'][a,0]==arr['JOINTS_0'][b,0] and arr['WEIGHTS_0'][[a,b],0].min()>.999
            for k in ['JOINTS_0','WEIGHTS_0']:data[k]=arr[k][a]
            cuts[key]=append(data)
        return cuts[key]
    local=pos[tri,1].max(1)<.046
    behind=pos[tri,2]<=CUT
    faces=tri[~local|behind.all(1)].tolist()
    for f in tri[local & behind.any(1) & ~behind.all(1)]:
        ring=[]
        for a,b0 in zip(f,np.roll(f,-1)):
            if pos[a,2]<=CUT:ring.append(a)
            if (pos[a,2]<=CUT)!=(pos[b0,2]<=CUT):ring.append(cut(a,b0))
        for i in range(1,len(ring)-1):faces.append([ring[0],ring[i],ring[i+1]])
        edges[int(pos[f,0].mean()>0)].extend((i,j) for i,j in zip(ring,ring[1:]+ring[:1]) if min(i,j)>=len(pos))

    uv=arr['TEXCOORD_0'][tri];uvlo=uv.min(1)*[W,H];uvhi=uv.max(1)*[W,H]
    for side,(ox,oy) in enumerate([(848,1136),(944,1360)]):
        # Two unoccupied, MCU-aligned patches; JPEG drop preserves all other DCT blocks.
        assert not np.any((uvlo[:,0]<ox+TILE)&(uvhi[:,0]>=ox)&(uvlo[:,1]<oy+TILE)&(uvhi[:,1]>=oy))
        seg=edges[side];ids=sorted({v for e in seg for v in e});pts=np.array([get('POSITION',v) for v in ids])
        c=(pts.max(0)+pts.min(0))/2;rad=np.ptp(pts,axis=0)[:2]/2
        assert .028<rad[0]<.039 and .012<rad[1]<.020
        xy=(pts[:,:2]-c[:2])/rad
        angle=dict(zip(ids,np.arctan2(xy[:,1],xy[:,0])/(2*np.pi)%1))
        st=np.array([get('TEXCOORD_0',v) for v in ids])
        cols=atlas[(st[:,1]*H).astype(int),(st[:,0]*W).astype(int)]
        tile=knit_tile(np.array(list(angle.values())),cols)
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'toe.jpg'
            path.write_bytes(subprocess.check_output(['cjpeg','-quality','90','-sample','2x2'],input=tile))
            jpeg=subprocess.check_output(['jpegtran','-trim','-drop',f'+{ox}+{oy}',str(path)],input=jpeg)
        cache={};sgn=1 if side else -1
        def vertex(v,step,wrap):
            key=(v,step,wrap)
            if key in cache:return cache[key]
            u=angle[v]+wrap;th=u*2*np.pi;cs,sn=np.cos(th),np.sin(th)
            t=step/16;phi=t*np.pi/2;f=np.sin(phi)
            a=get('POSITION',v)
            # An asymmetric continuous dome, slightly longer on the big-toe side;
            # retain the scanned cross section at the join and the flat sole line.
            q=(a[:2]-c[:2])*(1-f)+rad*np.array([cs,sn])*f
            xyz=c.copy();xyz[:2]+=q*np.cos(phi)
            xyz[0]-=sgn*.008*f*f
            xyz[1]-=.0065*f
            xyz[2]+=.034*f-.004*sgn*cs*np.cos(phi)*f
            normal=np.array([cs*np.cos(phi)/rad[0],sn*np.cos(phi)/rad[1],f/.034])
            data={k:get(k,v) for k in arr}
            data.update(POSITION=xyz,NORMAL=normal/np.linalg.norm(normal),
                        TEXCOORD_0=np.array([(ox+GUTTER+u*(TILE-2*GUTTER))/W,(oy+GUTTER+t*(TILE-2*GUTTER))/H]))
            cache[key]=append(data);return cache[key]
        for a,b0 in seg:
            aw=int(angle[b0]-angle[a]>.5);bw=int(angle[a]-angle[b0]>.5)
            for n in range(16):
                aa,bb=vertex(a,n,aw),vertex(b0,n,bw)
                cc=vertex(a,n+1,aw)
                faces.append([bb,aa,cc])
                if n<15:faces.append([bb,cc,vertex(b0,n+1,bw)])
    used,idx=np.unique(np.asarray(faces),return_inverse=True)
    arrays={i:np.vstack((arr[k],extra[k]))[used] for k,i in keys.items()};arrays[p['indices']]=idx.reshape(-1,1)
    views={image:jpeg}
    for i,data in arrays.items():
        acc=doc['accessors'][i];acc['count']=len(data)
        for field,fn in [('min',np.min),('max',np.max)]:
            if field in acc:acc[field]=fn(data,axis=0).tolist()
        views[acc['bufferView']]=data.astype(TYPES[acc['componentType']]).tobytes()
    buf=bytearray()
    for i,v in enumerate(doc['bufferViews']):
        start=v.get('byteOffset',0);data=views.get(i,b[start:start+v['byteLength']])
        buf.extend(b'\0'*(-len(buf)%4));v.update(byteOffset=len(buf),byteLength=len(data));buf.extend(data)
    doc['buffers'][0]['byteLength']=len(buf);save(dest,doc,buf)

if __name__=='__main__':repair(*sys.argv[1:])
