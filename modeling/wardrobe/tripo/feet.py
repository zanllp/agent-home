"""Offline repair for the original scan's joined shoes and the generated outfits' sock/boot weights."""
import sys
from collections import defaultdict
import numpy as np
from fit import load, read, save, TYPES


def side_weights(doc, attrs, owners):
    names = [doc['nodes'][n]['name'] for n in doc['skins'][0]['joints']]
    joints, weights = attrs['JOINTS_0'], attrs['WEIGHTS_0']
    for v, left in owners.items():
        src, dst = ('Right', 'Left') if left else ('Left', 'Right')
        for k, (j, w) in enumerate(zip(joints[v], weights[v])):
            if w and names[j].endswith('Hips') and attrs['POSITION'][v,1] < .05:
                # The winter skirt's radial mask also caught the very tip of the boot.
                joints[v,k] = next(i for i,n in enumerate(names) if n.endswith(dst+'Foot'))
            elif w and src in names[j]:
                joints[v,k] = names.index(names[j].replace(src, dst))


def disconnected_feet(pos, tri):
    # Weld UV seams for island identification only. Do not split at x=0:
    # the insides of the boots overlap that plane in the scanned rest pose.
    faces = tri[pos[tri,1].max(axis=1) < .14]
    _, ids = np.unique(pos.round(5), axis=0, return_inverse=True)
    parent = np.arange(ids.max()+1)
    def root(n):
        while parent[n] != n:
            parent[n] = parent[parent[n]]
            n = parent[n]
        return n
    for a,b,c in ids[faces]:
        parent[root(b)] = root(a)
        parent[root(c)] = root(a)
    groups = defaultdict(list)
    for i in np.unique(faces):
        groups[root(ids[i])].append(i)
    owners = {}
    for group in groups.values():
        owners.update(dict.fromkeys(group, np.mean(pos[group,0]) > -.006))
    return owners


def separate_original(attrs, tri):
    pos = attrs['POSITION']
    # Only the short bridge between the navy shoes is joined. Keep the sock,
    # leg and the seated morph unchanged except for opposite-foot influences.
    local = pos[tri,1].max(axis=1) < .09
    center = -.009
    left = pos[tri,0].mean(axis=1) > center
    edges = defaultdict(list)
    for fi in np.flatnonzero(local):
        for a,b in zip(tri[fi], np.roll(tri[fi], -1)):
            key = tuple(sorted((tuple(pos[a].round(6)),tuple(pos[b].round(6)))))
            edges[key].append((fi,a,b))
    dup = {}
    copy = list(range(len(pos)))
    owners = {v: pos[v,0] > center for v in np.flatnonzero(pos[:,1] < .14)}
    def index(v, side):
        if owners[v] == side:
            return v
        if (v,side) not in dup:
            dup[v,side] = len(copy)
            owners[len(copy)] = side
            copy.append(v)
        return dup[v,side]
    faces = [list(f) for f in tri]
    for fi in np.flatnonzero(local):
        faces[fi] = [index(v,left[fi]) for v in tri[fi]]
    # Close both medial surfaces with their own rim positions, UVs and morph
    # deltas. This contact patch is a single small ring on the original scan.
    seam = [e for e in edges.values() if len(e)==2 and left[e[0][0]]!=left[e[1][0]]]
    assert seam, 'Expected the joined medial shoe rim'
    for side in (False, True):
        rim = [next((a,b) for fi,a,b in e if left[fi]==side) for e in seam]
        next_edge = {tuple(pos[a].round(6)):(a,b) for a,b in rim}
        assert len(next_edge)==len(rim)
        loop=[]; a=rim[0][0]
        while tuple(pos[a].round(6)) in next_edge:
            v,a=next_edge.pop(tuple(pos[a].round(6)))
            loop.append(index(v,side))
        assert not next_edge and len(loop)>2
        faces.extend([[loop[0],loop[i+1],loop[i]] for i in range(1,len(loop)-1)])
    return {k:a[copy] for k,a in attrs.items()},np.array(faces),owners


def repair(source,dest):
    doc,b = load(source)
    orig = any(m['name']=='Legs' for m in doc['meshes'])
    mesh = next(m for m in doc['meshes'] if m['name']=='Legs') if orig else doc['meshes'][0]
    changes = {}
    for p in mesh['primitives']:
        keys = dict(p['attributes'])
        for i,t in enumerate(p.get('targets',[])):
            keys.update({f'{i}:{k}':v for k,v in t.items()})
        attrs = {k:read(doc,b,v).copy() for k,v in keys.items()}
        tri = read(doc,b,p['indices']).reshape(-1,3)
        if orig:
            attrs,tri,owners = separate_original(attrs,tri)
            changes.update({a:attrs[k] for k,a in keys.items()})
            changes[p['indices']] = tri.reshape(-1,1)
        else:
            owners = disconnected_feet(attrs['POSITION'],tri)
        side_weights(doc,attrs,owners)
        changes[keys['JOINTS_0']] = attrs['JOINTS_0']
    # Repack changed accessors in place; leave textures and all other views byte-identical.
    views = {}
    for i,a in changes.items():
        acc=doc['accessors'][i]; vi=acc['bufferView']
        assert sum(k.get('bufferView')==vi for k in doc['accessors'])==1 and not acc.get('byteOffset')
        acc['count']=len(a)
        for field,fn in [('min',np.min),('max',np.max)]:
            if field in acc:acc[field]=fn(a,axis=0).tolist()
        views[vi]=a.astype(TYPES[acc['componentType']]).tobytes()
    buf=bytearray()
    for i,v in enumerate(doc['bufferViews']):
        base=v.get('byteOffset',0); data=views.get(i,b[base:base+v['byteLength']])
        buf.extend(b'\0'*(-len(buf)%4));v.update(byteOffset=len(buf),byteLength=len(data));buf.extend(data)
    doc['buffers'][0]['byteLength']=len(buf)
    save(dest,doc,buf)

if __name__=='__main__':repair(*sys.argv[1:])
