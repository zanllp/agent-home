"""Split the original whale bed's painted quilt. Usage: input.glb output.glb (Pillow)."""
import io
import json
import struct
import sys
from pathlib import Path

from PIL import Image

data = Path(sys.argv[1]).read_bytes()
size = struct.unpack_from("<I", data, 12)[0]
doc = json.loads(data[20:20 + size])
binary = bytearray(data[28 + size:])
mesh = doc["meshes"][0]
prim, = mesh["primitives"]
assert len(doc["meshes"]) == 1 and not any(n.get("name") == "Sleep-quilt" for n in doc["nodes"])

def view(i):
    v = doc["bufferViews"][i]
    start = v.get("byteOffset", 0)
    return binary[start:start + v["byteLength"]]

def unpack(i, fmt):
    a = doc["accessors"][i]
    assert not a.get("byteOffset")
    return list(struct.iter_unpack(fmt, view(a["bufferView"])))

pos = unpack(prim["attributes"]["POSITION"], "<3f")
uv = unpack(prim["attributes"]["TEXCOORD_0"], "<2f")
index = doc["accessors"][prim["indices"]]
fmt = {5123: "<H", 5125: "<I"}[index["componentType"]]
ids = [i for i, in unpack(prim["indices"], fmt)]
albedo = Image.open(io.BytesIO(view(doc["images"][0]["bufferView"]))).convert("RGB")
fixed, quilt = [], []
for face in zip(ids[::3], ids[1::3], ids[2::3]):
    x, y, z = (sum(pos[i][k] for i in face) / 3 for k in range(3))
    u, v = (sum(uv[i][k] for i in face) / 3 for k in range(2))
    r, g, b = albedo.getpixel((int(u * (albedo.width-1)), int(v * (albedo.height-1))))
    # At the footboard and the hanging hem, wood and fabric share a silhouette.
    timber = (z > .74 or y < .29) and r-b > 36 and g-b > 17
    cloth = -.439 < z and y > .105 and not timber and (z < .775 or abs(x) > .735)
    (quilt if cloth else fixed).extend(face)
assert len(quilt) > 9000 and len(fixed) > 9000
# Partition only the index buffer. Both parts retain the original UVs and albedo.
off = doc["bufferViews"][index["bufferView"]].get("byteOffset", 0)
for k, part in enumerate([fixed, quilt]):
    blob = b"".join(struct.pack(fmt, i) for i in part)
    binary[off:off+len(blob)] = blob
    doc["bufferViews"].append(dict(buffer=0, byteOffset=off, byteLength=len(blob), target=34963))
    doc["accessors"].append(dict(index, bufferView=len(doc["bufferViews"])-1,
                                 count=len(part), min=[min(part)], max=[max(part)]))
    if not k:
        prim["indices"] = len(doc["accessors"])-1
    else:
        doc["meshes"].append(dict(name="Sleep-quilt", primitives=[dict(prim, indices=len(doc["accessors"])-1)]))
        doc["nodes"].append(dict(name="Sleep-quilt", mesh=len(doc["meshes"])-1))
        doc["nodes"][0].setdefault("children", []).append(len(doc["nodes"])-1)
    off += len(blob)
j = json.dumps(doc, separators=(",", ":")).encode()
j += b" " * (-len(j) % 4)
out = struct.pack("<4sIIII", b"glTF", 2, 28+len(j)+len(binary), len(j), 0x4e4f534a)
Path(sys.argv[2]).write_bytes(out + j + struct.pack("<II", len(binary), 0x004e4942) + binary)
