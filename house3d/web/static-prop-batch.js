import { Matrix4, Mesh } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// Only applied to allowlisted, non-articulated cached models after their finishes.
// Keep material identity, geometry attributes, normals and shadow flags unchanged.
export function batchStaticProp(root) {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert(),
    buckets = new Map();
  root.traverseVisible((o) => {
    const g = o.geometry,
      m = o.material;
    if (
      !o.isMesh ||
      o === root ||
      o.children.length ||
      o.isSkinnedMesh ||
      o.isInstancedMesh ||
      !m ||
      Array.isArray(m) ||
      m.transparent ||
      m.stencilWrite ||
      g.drawRange.count !== Infinity ||
      Object.keys(g.morphAttributes).length ||
      o.matrixWorld.determinant() <= 0
    )
      return;
    const attrs = Object.entries(g.attributes).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    if (attrs.some(([, a]) => a.isInterleavedBufferAttribute)) return;
    const key = [
      m.uuid,
      o.castShadow,
      o.receiveShadow,
      o.renderOrder,
      o.layers.mask,
      !!g.index,
      ...attrs.map(([k, a]) =>
        [k, a.itemSize, a.normalized, a.array.constructor.name].join(":")
      ),
    ].join("|");
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(o);
  });
  for (const group of buckets.values()) {
    if (group.length < 3) continue;
    const geos = group.map((o) =>
      o.geometry
        .clone()
        .applyMatrix4(new Matrix4().multiplyMatrices(inverse, o.matrixWorld))
    );
    const merged = mergeGeometries(geos);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    const first = group[0],
      mesh = new Mesh(merged, first.material);
    mesh.castShadow = first.castShadow;
    mesh.receiveShadow = first.receiveShadow;
    mesh.renderOrder = first.renderOrder;
    mesh.layers.mask = first.layers.mask;
    root.add(mesh);
    for (const o of group) o.removeFromParent();
  }
}
