"""Sample nearby undyed skin on each finger in bind space, across UV seams."""
import sys,json,subprocess
from pathlib import Path
import numpy as np
from fit import load, read
doc,buf=load(sys.argv[1]);mask=json.loads(Path(sys.argv[2]).read_text())
view=doc['bufferViews'][doc['images'][0]['bufferView']]
off=view.get('byteOffset',0)
ppm=subprocess.check_output(['djpeg','-ppm'],input=buf[off:off+view['byteLength']])
header,pixels=ppm.split(b'\n255\n',1);w,h=map(int,header.split()[-2:])
pixels=np.frombuffer(pixels,'u1').reshape(h,w,3)
out={}
bary=np.array([[i/8,j/8,(8-i-j)/8] for i in range(9) for j in range(9-i)])
for name in ['Arm.L','Arm.R']:
    p=next(m for m in doc['meshes'] if m['name']==name)['primitives'][0]
    ix=read(doc,buf,p['indices']).reshape(-1,3)
    ix=ix[np.concatenate([np.arange(i,i+n) for i,n in mask[name]])]
    pos,nrm,uv=[read(doc,buf,p['attributes'][k]) for k in ['POSITION','NORMAL','TEXCOORD_0']]
    def samples(data):return (bary@data[ix]).reshape(-1,data.shape[1])
    st=samples(uv)
    colors=pixels[np.clip((st[:,1]*h).astype(int),0,h-1),np.clip((st[:,0]*w).astype(int),0,w-1)].astype(float)
    r,g,b=colors.T
    good=(r>203)&(r>g+7)&(r>b+12)&(g>b+1)
    xyz=samples(pos)[good];norm=samples(nrm)[good];colors=colors[good]
    # Blend in 3D rather than across the neighbouring blue islands of the atlas.
    swatches=[]
    for v in np.unique(ix):
        d=np.sum((xyz-pos[v])**2,axis=1)+.000019*np.maximum(0,1-norm@nrm[v])
        k=np.argpartition(d,72)[:72]
        swatches.append(np.average(colors[k],weights=1/(d[k]+.000003),axis=0))
    out[name]=np.uint8(np.rint(swatches)).tobytes().hex()
Path(sys.argv[3]).write_text(json.dumps(out,separators=(',',':'))+'\n')
