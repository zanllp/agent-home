"""Open the two capped ends of the generated sleeves without changing the rest of the Tripo surface."""
import numpy as np

# Plane in Tripo's normalized bind coordinates, measured inside the knitted band.
RIM = -.391
def open_cuffs(arrays,indices,lo,hi):
    pos=arrays['POSITION']
    q=(pos-(lo+hi)/2)/(hi[1]-lo[1]);q[:,1]+=.5
    x,h,z=q.T; ax=np.abs(x)
    across=.835*ax+.55*h
    sleeve=(across>.523)&(h>.574)&(ax>.194)&(h<.84)
    dist=np.where(sleeve,.55*ax-.835*h-RIM,-1)
    return clip_cuffs(arrays,indices,dist)

def clip_cuffs(arrays,indices,dist):
    pos=arrays['POSITION']
    tri=indices.reshape(-1,3);outside=dist[tri]>0
    faces=tri[~outside.any(axis=1)].tolist()
    boundary={};extra={k:[] for k in arrays}
    def intersection(a,b):
        key=tuple(sorted((int(a),int(b))))
        if key not in boundary:
            f=dist[a]/(dist[a]-dist[b])
            boundary[key]=len(pos)+len(extra['POSITION'])
            for k,arr in arrays.items():extra[k].append(arr[a]+(arr[b]-arr[a])*f)
        return boundary[key]
    for face in tri[outside.any(axis=1)&~outside.all(axis=1)]:
        ring=[]
        for a,b in zip(face,np.roll(face,-1)):
            if dist[a]<=0:ring.append(a)
            if (dist[a]>0)!=(dist[b]>0):ring.append(intersection(a,b))
        for i in range(1,len(ring)-1):faces.append([ring[0],ring[i],ring[i+1]])
    assert {np.sign(pos[a,0]) for a,b in boundary}=={-1,1}, "Expected two cuff openings"
    used,remap=np.unique(np.array(faces),return_inverse=True)
    result={k:np.vstack((arr,extra[k]))[used] for k,arr in arrays.items()}
    result['NORMAL']/=np.maximum(np.linalg.norm(result['NORMAL'],axis=1,keepdims=True),1e-8)
    return result,remap.reshape(-1,1)
