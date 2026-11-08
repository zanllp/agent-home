"""Authoring only: reshape the gathered sleeve transition on the accepted contact rig."""
import argparse
import hashlib
import json
import struct
from pathlib import Path

import numpy as np

SOURCE = "ba77ffe8f161201ba515577b006620ee9f12468794908aa997c7946f4e4e2ae6"
DTYPES = {5126: "<f4", 5123: "<u2", 5121: "u1"}
DIMS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}
# Sections in millimetres along the sleeve, not horizontal slices through the body.
STATIONS = [-32, -22, -12, -5, 2, 10, 22, 36, 52]
# Centre and projected radii of the finished sleeve section.
PROFILES = [
    [14, 13, 11, 7, 5, 5, 5, 4, 4],
    [-7, -8, -10, -12, -13, -14, -15, -15, -13],
    [27, 28, 27, 23, 18, 18.5, 20, 20, 21],
    [31, 31, 30, 25, 21, 21.5, 23, 23, 25],
]


def smooth(t):
    t = np.clip(t, 0., 1.)
    return t * t * (3 - 2*t)


def frame(left):
    sign = 1 if left else -1
    along = np.array([.63*sign, -.76, .16])
    along /= np.linalg.norm(along)
    across = np.array([.76*sign, .63, 0])
    across -= across.dot(along)*along
    across /= np.linalg.norm(across)
    return (np.array([.102 if left else -.116, .475, .076]),
            np.array([along, across, np.cross(across, along)*-sign]))


def reshape(p, origin, basis, left):
    h, v, w = ((p-origin) @ basis.T)*1000
    blend = smooth((h+32)/18)*smooth((52-h)/24)
    if not blend:
        return p
    cv, cw, rv, rw = [np.interp(h, STATIONS, values) for values in PROFILES]
    # Original medial surfaces are asymmetric where the two arms were detached.
    old_v = np.interp(h, STATIONS, [14,16,18,13,5,4,0,3,4] if left else [14,19,17,11,2,-2,-4,-2,1])
    old_w = np.interp(h, STATIONS, [-6,-8,-13,-15,-16,-16,-17,-15,-12])
    delta = np.array([v-old_v, w-old_w])
    length = np.linalg.norm(delta/[rv,rw])
    # Keep buried vertices inside the sleeve instead of turning them inside out.
    shell = delta / max(length, .38)
    target = .10*delta + .90*shell + [cv if left else cv-5, cw]
    return p + blend * ((target-[v,w]) @ basis[1:])/1000


def add_facing(arrays, tris, origin, basis, left, joints):
    # A tucked-in fabric lining behind the cut edges. Join it to the existing
    # skinned sleeve primitive: no extra material, draw call or runtime update.
    count = 32
    start = len(arrays["POSITION"])
    for ring, (h, inset) in enumerate([(-24,9),(-14,4),(-7,1.5),(0,1),(6,1),
                                       (12,2),(19,3),(27,6),(32,10)]):
        cv,cw,rv,rw = [np.interp(h,STATIONS,col) for col in PROFILES]
        for j in range(count):
            a = 2*np.pi*j/count
            c,s = np.cos(a),np.sin(a)
            local = np.array([h, cv-(0 if left else 5)+(rv-inset)*c, cw+(rw-inset)*s])
            point = origin+local@basis/1000
            normal = basis[1]*c/(rv-inset)+basis[2]*s/(rw-inset)
            fore = np.clip((.4451+.025-point[1])/.05,0,1)
            side = "Left" if left else "Right"
            arrays["POSITION"].append(point)
            arrays["NORMAL"].append(normal/np.linalg.norm(normal))
            arrays["JOINTS_0"].append([joints.index("mixamorig:"+side+"Arm"),joints.index("mixamorig:"+side+"ForeArm"),0,0])
            arrays["WEIGHTS_0"].append([1-fore,fore,0,0])
            rgb = np.array([44,49,101])*(.95+.06*s+.025*np.cos(3*a))
            arrays["COLOR_0"].append(np.r_[((rgb/255+.055)/1.055)**2.4,1]*65535)
            if ring:
                i=start+ring*count+j
                k=start+ring*count+(j+1)%count
                faces=[[i-count,k-count,k],[i-count,k,i]]
                tris.extend([f[::-1] if not left else f for f in faces])


def refine(source, output):
    raw = source.read_bytes()
    if hashlib.sha256(raw).hexdigest() != SOURCE:
        raise ValueError("Expected the original contact rig; do not apply twice")
    n = struct.unpack_from("<I", raw, 12)[0]
    g = json.loads(raw[20:20+n])
    data = raw[28+n:]
    blocks = [data[v.get("byteOffset",0):v.get("byteOffset",0)+v["byteLength"]] for v in g["bufferViews"]]

    def attribute(i):
        a = g["accessors"][i]
        assert not a.get("byteOffset") and "byteStride" not in g["bufferViews"][a["bufferView"]]
        return np.frombuffer(blocks[a["bufferView"]],DTYPES[a["componentType"]]).reshape(-1,DIMS[a["type"]])

    def store(i, values):
        a = g["accessors"][i]
        a["count"] = len(values)
        values = np.asarray(values, dtype=DTYPES[a["componentType"]]).reshape(a["count"],-1)
        if "min" in a:
            a.update(min=values.min(0).tolist(), max=values.max(0).tolist())
        blocks[a["bufferView"]] = values.tobytes()

    for mesh in g["meshes"]:
        if mesh["name"] not in ("Arm.L","Arm.R","Arm.L.SleeveSeam.0","Arm.R.SleeveSeam.0"):
            continue
        left = mesh["name"].startswith("Arm.L")
        origin,basis = frame(left)
        prim, = mesh["primitives"]
        attrs = prim["attributes"]
        arrays = {k:list(attribute(i).astype(float)) for k,i in attrs.items()}
        pos = arrays["POSITION"]
        tris = attribute(prim["indices"]).reshape(-1,3).tolist()
        for _ in range(2):
            mid = {}
            def split(a,b):
                key = tuple(sorted((a,b)))
                if key in mid:
                    return mid[key]
                ha,hb = [(pos[j]-origin).dot(basis[0]) for j in (a,b)]
                if min(ha,hb)>.052 or max(ha,hb)<-.032 or np.linalg.norm(pos[b]-pos[a])<.012:
                    return None
                i = mid[key] = len(pos)
                weights = {}
                for j in (a,b):
                    for bone,w in zip(arrays["JOINTS_0"][j],arrays["WEIGHTS_0"][j]):
                        if w: weights[bone]=weights.get(bone,0)+w
                best = sorted(weights.items(),key=lambda pair:(-pair[1],pair[0]))[:4]
                best += [(0,0)]*(4-len(best))
                ids,ws = np.array(best).T
                for k,vs in arrays.items():
                    val = (vs[a]+vs[b])/2
                    if k=="JOINTS_0": val=ids
                    if k=="WEIGHTS_0": val=ws/ws.sum()
                    if k=="NORMAL": val/=max(np.linalg.norm(val),1e-12)
                    vs.append(val)
                return i
            refined=[]
            for a,b,c in tris:
                verts=[a,b,c]; edges=[split(a,b),split(b,c),split(c,a)]
                count=sum(e is not None for e in edges)
                if count==0: refined.append([a,b,c]);continue
                if count==3:
                    x,y,z=edges;refined.extend([[a,x,z],[x,b,y],[z,y,c],[x,y,z]]);continue
                k=next(i for i,e in enumerate(edges) if (e is not None)==(count==1))
                a,b,c=(verts[(i+k)%3] for i in range(3))
                x,y,z=(edges[(i+k)%3] for i in range(3))
                refined.extend([[a,x,c],[x,b,c]] if count==1 else [[a,b,z],[b,y,z],[z,y,c]])
            tris=refined
        arrays["POSITION"]=[reshape(v,origin,basis,left) for v in pos]
        if "SleeveSeam" in mesh["name"]:
            node = next(n for n in g["nodes"] if n.get("mesh")==g["meshes"].index(mesh))
            joints = [g["nodes"][j]["name"] for j in g["skins"][node["skin"]]["joints"]]
            add_facing(arrays,tris,origin,basis,left,joints)
        for k,i in attrs.items(): store(i,arrays[k])
        store(prim["indices"],np.array(tris).reshape(-1))
    binary=bytearray()
    for v,block in zip(g["bufferViews"],blocks):
        binary.extend(bytes(-len(binary)%4))
        v.update(byteOffset=len(binary),byteLength=len(block))
        binary.extend(block)
    g["buffers"][0]["byteLength"]=len(binary)
    binary.extend(bytes(-len(binary)%4))
    j=json.dumps(g,separators=(",",":")).encode()
    j+=b" "*(-len(j)%4)
    output.write_bytes(struct.pack("<4sIIII",b"glTF",2,28+len(j)+len(binary),len(j),0x4E4F534A)+j+
                       struct.pack("<II",len(binary),0x004E4942)+binary)


if __name__=="__main__":
    cli=argparse.ArgumentParser(description=__doc__)
    cli.add_argument("source",type=Path)
    cli.add_argument("output",type=Path)
    args=cli.parse_args()
    refine(args.source,args.output)
