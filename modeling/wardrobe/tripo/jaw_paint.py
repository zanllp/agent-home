"""Retouch two small dyed areas of the jaw's skin atlas, leaving the curls and the eyes intact."""
import sys, subprocess, tempfile
import numpy as np
from fit import load, read, save
from pathlib import Path


def retouch(source, dest):
    doc,b=load(source)
    head=next(m for m in doc['meshes'] if m['name']=='HeadHair')['primitives'][0]
    pos,uv=[read(doc,b,head['attributes'][k]) for k in ('POSITION','TEXCOORD_0')]
    tri=read(doc,b,head['indices']).reshape(-1,3)
    iv=doc['bufferViews'][doc['images'][0]['bufferView']];start=iv.get('byteOffset',0)
    jpeg=b[start:start+iv['byteLength']]
    info,data=subprocess.check_output(['djpeg','-ppm'],input=jpeg).split(b'\n255\n',1)
    w,h=map(int,info.split()[-2:]);img=np.frombuffer(data,'u1').reshape(h,w,3)
    for seed in (2016,4108):
        # Seeds were picked on the discoloured cheek in the posed mesh. Never
        # cross a UV seam to the blue hair surface just behind these patches.
        ids=np.unique(tri[seed])
        while True:
            faces=tri[np.isin(tri,ids).any(1)];expanded=np.unique(faces)
            if len(expanded)==len(ids):break
            ids=expanded
        pixels=uv*[w,h]
        x,y=np.maximum(0,np.floor((pixels[ids].min(0)-4)/16)*16).astype(int)
        ex,ey=(np.ceil((pixels[ids].max(0)+4)/16)*16).astype(int)
        original=img[y:ey,x:ex].astype(float)
        island=np.zeros(original.shape[:2],bool);local=np.zeros_like(island)
        for face in faces:
            a,c,e=pixels[face]-[x,y]
            lo=np.floor(np.min([a,c,e],0)).astype(int);hi=np.ceil(np.max([a,c,e],0)).astype(int)
            Y,X=np.mgrid[lo[1]:hi[1],lo[0]:hi[0]]+.5
            mat=np.array([c-a,e-a]).T
            if abs(np.linalg.det(mat))<1e-8:continue
            s,t=np.linalg.inv(mat)@np.stack([(X-a[0]).ravel(),(Y-a[1]).ravel()])
            inside=(s>=-.015)&(t>=-.015)&(s+t<=1.015)
            xyz=pos[face[0]]+s[:,None]*(pos[face[1]]-pos[face[0]])+t[:,None]*(pos[face[2]]-pos[face[0]])
            loc=(xyz[:,1]<.648)&(xyz[:,2]>.087)&(xyz[:,1]>.598)
            ix=np.s_[lo[1]:hi[1],lo[0]:hi[0]]
            island[ix]|=inside.reshape(X.shape);local[ix]|=(inside&loc).reshape(X.shape)
        r,g,bl=original.transpose(2,0,1);stain=local&(bl+8>r)&(r<207)
        clean=island&(r>g+8)&(r>bl+17)&(g>bl)&(r>160)
        assert stain.any() and clean.any()
        coords=np.argwhere(clean);cols=original[clean];out=original.copy()
        for yy,xx in np.argwhere(stain):
            ds=((coords-[yy,xx])**2).sum(1);k=np.argpartition(ds,16)[:16]
            out[yy,xx]=np.average(cols[k],axis=0,weights=1/(2+ds[k]))
        with tempfile.TemporaryDirectory() as tmp:
            tile=Path(tmp)/'jaw.jpg';ppm=f'P6\n{ex-x} {ey-y}\n255\n'.encode()+out.round().astype('u1').tobytes()
            tile.write_bytes(subprocess.check_output(['cjpeg','-quality','95','-sample','2x2'],input=ppm))
            jpeg=subprocess.check_output(['jpegtran','-trim','-drop',f'+{x}+{y}',str(tile)],input=jpeg)
    buf=bytearray()
    for view in doc['bufferViews']:
        offset=view.get('byteOffset',0);data=jpeg if view is iv else b[offset:offset+view['byteLength']]
        buf.extend(b'\0'*(-len(buf)%4));view.update(byteOffset=len(buf),byteLength=len(data));buf.extend(data)
    doc['buffers'][0]['byteLength']=len(buf);save(dest,doc,buf)

if __name__=='__main__':retouch(*sys.argv[1:])
