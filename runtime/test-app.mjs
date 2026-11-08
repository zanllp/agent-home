// house3d/shared/apartment.mjs
var CONNECTED_HOME = "connected-home";
function apartment(room = {}) {
  if (room.floorplan !== CONNECTED_HOME) return null;
  const w = room.width ?? 8, d = room.depth ?? 6.5, entry = d / 2, hallZ = entry + 1.1;
  const rect = (id, label, x, z, width, depth) => ({ id, label, x, z, width, depth, minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2 });
  const bathWidth = Math.min(3.2, w - 1), bathX = w / 2 - bathWidth / 2;
  const zones = [
    rect("living", "\u5BB6\u5EAD\u5BA2\u5385", 0, 0, w, d),
    rect("hall", "\u8D70\u5ECA", 0, hallZ, w, 2.2),
    rect("child", "\u9CB8\u9C7C\u513F\u7AE5\u623F", -w / 2 - 3, hallZ - 0.45, 6, 5),
    rect("parent", "\u9972\u517B\u5458\u7684\u5367\u5BA4", w / 2 + 2.5, hallZ, 5, 4.4),
    rect("bath", "\u6D74\u5BA4", bathX, entry + 2.2 + 1.7, bathWidth, 3.4)
  ];
  const doors = [
    { a: "living", b: "hall", axis: "z", at: entry, center: -w * 0.12, width: Math.min(3.6, w - 0.6) },
    { a: "hall", b: "child", axis: "x", at: -w / 2, center: hallZ, width: 1.48 },
    { a: "hall", b: "parent", axis: "x", at: w / 2, center: hallZ, width: 1.72 },
    { a: "hall", b: "bath", axis: "z", at: entry + 2.2, center: bathX, width: 1.6 }
  ];
  return { zones, doors };
}
function zoneAt(plan, p) {
  return plan?.zones.find((z) => p.x >= z.minX - 1e-8 && p.x <= z.maxX + 1e-8 && p.z >= z.minZ - 1e-8 && p.z <= z.maxZ + 1e-8);
}
function wallSpan(zone, side) {
  const axis = ["left", "right"].includes(side) ? "x" : "z", cross = axis === "x" ? "z" : "x";
  const at = { left: zone.minX, right: zone.maxX, back: zone.minZ, front: zone.maxZ }[side];
  return { axis, cross, at, min: axis === "x" ? zone.minZ : zone.minX, max: axis === "x" ? zone.maxZ : zone.maxX };
}
function doorsOnWall(plan, zone, side) {
  const wall = wallSpan(zone, side);
  return plan.doors.filter((d) => (d.a === zone.id || d.b === zone.id) && d.axis === wall.axis && Math.abs(d.at - wall.at) < 1e-7);
}
function solidWallSegments(plan, zone, side, extra2 = []) {
  const { axis, cross, at, min, max } = wallSpan(zone, side), holes = [...doorsOnWall(plan, zone, side), ...extra2].sort((a, b) => a.center - b.center);
  let start = min;
  const segments = [];
  const add = (a, b) => {
    if (b - a > 1e-8) segments.push([{ [axis]: at, [cross]: a }, { [axis]: at, [cross]: b }]);
  };
  for (const hole of holes) {
    add(start, Math.min(max, hole.center - hole.width / 2));
    start = Math.max(start, hole.center + hole.width / 2);
  }
  add(start, max);
  return segments;
}
function mountedInRoom(room, p, w, d) {
  const plan = apartment(room), zone = zoneAt(plan, p);
  const back = (zone?.minZ ?? -(room?.depth ?? 5) / 2) + 0.05 + d / 2, left = (zone?.minX ?? -(room?.width ?? 6) / 2) + 0.05 + w / 2;
  const a = Math.atan2(Math.sin(p.yaw), Math.cos(p.yaw));
  return Math.abs(a) < 1e-3 && Math.abs(p.z - back) < 0.025 || Math.abs(a - Math.PI / 2) < 1e-3 && Math.abs(p.x - left) < 0.025;
}
function blocksDoor(room, p, w, d) {
  const plan = apartment(room);
  return !!plan?.doors.some((door) => {
    const along = door.axis === "x" ? p.z : p.x, half = door.axis === "x" ? d / 2 : w / 2, depth = door.axis === "x" ? w / 2 : d / 2;
    return Math.abs(p[door.axis] - door.at) < depth + 0.57 && Math.abs(along - door.center) < half + door.width / 2;
  });
}

// house3d/shared/space.mjs
function balconyGeometry(room = {}) {
  const b = room.balcony;
  if (!b) return null;
  const left = b.wall === "left", wall = left ? -(room.width ?? 6) / 2 : -(room.depth ?? 5) / 2;
  const origin = left ? { x: wall, z: -b.center } : { x: b.center, z: wall };
  const along = left ? { x: 0, z: -1 } : { x: 1, z: 0 }, outward = left ? { x: -1, z: 0 } : { x: 0, z: -1 };
  const point = (u, v) => ({ x: origin.x + along.x * u + outward.x * v, z: origin.z + along.z * u + outward.z * v });
  const a = point(-b.width / 2, 0), c = point(b.width / 2, b.depth);
  return { ...b, origin, along, outward, point, minX: Math.min(a.x, c.x), maxX: Math.max(a.x, c.x), minZ: Math.min(a.z, c.z), maxZ: Math.max(a.z, c.z) };
}
function balconyLocal(room, p) {
  const b = balconyGeometry(room);
  if (!b) return null;
  const x = p.x - b.origin.x, z = p.z - b.origin.z;
  return { u: x * b.along.x + z * b.along.z, v: x * b.outward.x + z * b.outward.z };
}
function regionAt(room, p, plan = apartment(room)) {
  const b = balconyGeometry(room), q = b && balconyLocal(room, p);
  return q && Math.abs(q.u) <= b.width / 2 + 1e-8 && q.v > 0 && q.v <= b.depth + 1e-8 ? "balcony" : plan ? zoneAt(plan, p)?.id ?? null : Math.abs(p.x) <= (room.width ?? 6) / 2 + 1e-8 && Math.abs(p.z) <= (room.depth ?? 5) / 2 + 1e-8 ? "interior" : null;
}
function spaceBounds(room = {}) {
  const b = balconyGeometry(room), x = (room.width ?? 6) / 2, z = (room.depth ?? 5) / 2;
  const zones = apartment(room)?.zones || [];
  return { minX: Math.min(-x, b?.minX ?? -x, ...zones.map((z2) => z2.minX)), maxX: Math.max(x, b?.maxX ?? x, ...zones.map((z2) => z2.maxX)), minZ: Math.min(-z, b?.minZ ?? -z, ...zones.map((z2) => z2.minZ)), maxZ: Math.max(z, b?.maxZ ?? z, ...zones.map((z2) => z2.maxZ)) };
}
function fitsFootprint(room = {}, p, w, d, margin = 0.05) {
  const x = (room.width ?? 6) / 2, z = (room.depth ?? 5) / 2, b = balconyGeometry(room);
  const within = (a, c, e, f) => p.x - w / 2 >= a + margin - 1e-8 && p.x + w / 2 <= c - margin + 1e-8 && p.z - d / 2 >= e + margin - 1e-8 && p.z + d / 2 <= f - margin + 1e-8;
  return within(-x, x, -z, z) || !!apartment(room)?.zones.some((z2) => within(z2.minX, z2.maxX, z2.minZ, z2.maxZ)) || !!(b && within(b.minX, b.maxX, b.minZ, b.maxZ));
}
function balconyDoor(room, objects) {
  const b = balconyGeometry(room);
  if (!b) return null;
  const door = objects.find((o) => o.id === b.door_id);
  if (!door) return null;
  const q = balconyLocal(room, door);
  return { id: door.id, u: q.u + 0.4, width: 1.55, open: door.properties?.open !== false };
}
function spaceSegments(room = {}, objects = []) {
  const x = (room.width ?? 6) / 2, z = (room.depth ?? 5) / 2, b = balconyGeometry(room), door = balconyDoor(room, objects), segments = [];
  const add = (a, c) => segments.push([a, c]);
  const walls = [["back", { x: -x, z: -z }, { x, z: -z }], ["right", { x, z: -z }, { x, z }], ["front", { x, z }, { x: -x, z }], ["left", { x: -x, z }, { x: -x, z: -z }]];
  const plan = apartment(room);
  if (plan) {
    for (const zone of plan.zones) for (const side of ["back", "right", "front", "left"]) {
      const extra2 = zone.id === "living" && side === b?.wall && door?.open ? [{ center: b.wall === "left" ? b.point(door.u, 0).z : b.point(door.u, 0).x, width: door.width }] : [];
      segments.push(...solidWallSegments(plan, zone, side, extra2));
    }
  } else for (const [id, a, c] of walls) {
    if (b && id === b.wall && door?.open) {
      add(a, b.point(door.u - door.width / 2, 0));
      add(b.point(door.u + door.width / 2, 0), c);
    } else add(a, c);
  }
  if (b) {
    add(b.point(-b.width / 2, 0), b.point(-b.width / 2, b.depth));
    add(b.point(-b.width / 2, b.depth), b.point(b.width / 2, b.depth));
    add(b.point(b.width / 2, b.depth), b.point(b.width / 2, 0));
  }
  return segments;
}
function createSpace(room = {}, objects = []) {
  const segments = spaceSegments(room, objects), plan = apartment(room), balcony = balconyGeometry(room);
  const regions = plan ? [...plan.zones] : [{ minX: -(room.width ?? 6) / 2, maxX: (room.width ?? 6) / 2, minZ: -(room.depth ?? 5) / 2, maxZ: (room.depth ?? 5) / 2 }];
  if (balcony) regions.push(balcony);
  const spans = segments.map(([a, b]) => ({ x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), z0: Math.min(a.z, b.z), z1: Math.max(a.z, b.z) }));
  function clearance(p) {
    if (!regions.some((z) => p.x >= z.minX - 1e-8 && p.x <= z.maxX + 1e-8 && p.z >= z.minZ - 1e-8 && p.z <= z.maxZ + 1e-8)) return -Infinity;
    let d = Infinity;
    for (const s of spans) {
      const dx = Math.max(s.x0 - p.x, p.x - s.x1, 0), dz = Math.max(s.z0 - p.z, p.z - s.z1, 0);
      d = Math.min(d, dx * dx + dz * dz);
    }
    return Math.sqrt(d) - (balcony ? 0.1 : 0.15);
  }
  return { segments, clearance, free(p, radius = 0.57) {
    return Number.isFinite(p.x) && Number.isFinite(p.z) && clearance(p) >= radius - 1e-8;
  } };
}
function wallBlocksSight(room, objects, a, b, assets = {}) {
  const d = balconyGeometry(room), door = d && objects.find((o) => o.id === d.door_id), q = door && balconyLocal(room, door), w = (room.width ?? 6) / 2, h = (room.depth ?? 5) / 2;
  const plan = apartment(room);
  if (plan) {
    for (const zone of plan.zones) for (const side of ["left", "right", "back", "front"]) {
      const { axis, cross, at, min, max } = wallSpan(zone, side), delta = b[axis] - a[axis];
      if (Math.abs(delta) < 1e-9) continue;
      const t = (at - a[axis]) / delta, u = a[cross] + (b[cross] - a[cross]) * t, y = a.y + (b.y - a.y) * t;
      if (t <= 1e-3 || t >= 0.999 || u < min || u > max || y < 0 || y > (room.height ?? 2.4)) continue;
      if (y <= 2.1 && doorsOnWall(plan, zone, side).some((d2) => Math.abs(d2.center - u) < d2.width / 2)) continue;
      const glass = objects.some((o) => {
        const win = assets[o.asset_id]?.wall_opening, sliding = o.id === door?.id;
        if (!win || zoneAt(plan, o)?.id !== zone.id || side !== (Math.abs(o.yaw) < 1e-3 ? "back" : "left")) return false;
        const bottom = sliding ? 0.03 : (assets[o.asset_id].elevation || 0) + (win.bottom || 0);
        return Math.abs(o[cross] - u) <= win.width / 2 && y >= bottom && y <= (sliding ? 2.2 : bottom + win.height);
      });
      if (!glass) return true;
    }
    return false;
  }
  for (const [id, axis, value, other, span] of [["left", "x", -w, "z", h], ["right", "x", w, "z", h], ["back", "z", -h, "x", w], ["front", "z", h, "x", w]]) {
    const delta = b[axis] - a[axis];
    if (Math.abs(delta) < 1e-9) continue;
    const t = (value - a[axis]) / delta;
    if (t <= 1e-3 || t >= 0.999) continue;
    const p = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }, y = a.y + (b.y - a.y) * t;
    if (Math.abs(p[other]) > span || y < 0 || y > (room.height ?? 2.4)) continue;
    if (d && id === d.wall && q && Math.abs(balconyLocal(room, p).u - q.u) <= (assets[door.asset_id]?.wall_opening?.width ?? 2.42) / 2 && y >= 0.03 && y <= 2.2) continue;
    return true;
  }
  return false;
}

// house3d/shared/navigation.mjs
function createNavigation(objects, catalog, { radius = 0.57, step = 0.1, assets = {}, room = {} } = {}) {
  const size = { width: room.width ?? 6, depth: room.depth ?? 5 }, bounds = { x: size.width / 2 - 0.15 - radius, z: size.depth / 2 - 0.15 - radius };
  const space = room.balcony || room.floorplan ? createSpace(room, objects) : null, extent = spaceBounds(room);
  const obstacles = objects.filter((o) => o.kind !== "rug" && !o.on && (!room.balcony || o.id !== room.balcony.door_id)).map((o) => ({ x: o.x, z: o.z, c: Math.cos(o.yaw), s: Math.sin(o.yaw), w: (assets[o.asset_id] || catalog[o.kind]).size[0] / 2, d: (assets[o.asset_id] || catalog[o.kind]).size[1] / 2 }));
  function free(p) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.z) || (space ? !space.free(p, radius) : Math.abs(p.x) > bounds.x || Math.abs(p.z) > bounds.z)) return false;
    return !obstacles.some((o) => {
      const dx = p.x - o.x, dz = p.z - o.z, c = o.c, s = o.s;
      const x = Math.abs(dx * c - dz * s), z = Math.abs(dx * s + dz * c);
      return Math.hypot(Math.max(0, x - o.w), Math.max(0, z - o.d)) < radius;
    });
  }
  function line(a, b) {
    const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(d / 0.025));
    for (let i = 0; i <= n; i++) if (!free({ x: a.x + (b.x - a.x) * i / n, z: a.z + (b.z - a.z) * i / n })) return false;
    return true;
  }
  const minX = space ? extent.minX : -bounds.x, minZ = space ? extent.minZ : -bounds.z, maxX = space ? extent.maxX : bounds.x, maxZ = space ? extent.maxZ : bounds.z;
  const nx = Math.floor((maxX - minX) / step) + 1, nz = Math.floor((maxZ - minZ) / step) + 1;
  const point = (i) => ({ x: minX + i % nx * step, z: minZ + Math.floor(i / nx) * step });
  const nodes = Array.from({ length: nx * nz }, (_, i) => point(i));
  const valid = nodes.map(free);
  function nearest(p) {
    const ix = Math.min(nx - 1, Math.max(0, Math.round((p.x - minX) / step))), iz = Math.min(nz - 1, Math.max(0, Math.round((p.z - minZ) / step)));
    let best = -1, d = Infinity;
    function visit(x, z) {
      if (x < 0 || z < 0 || x >= nx || z >= nz) return;
      const i = z * nx + x;
      if (!valid[i]) return;
      const q = nodes[i], distance = Math.hypot(p.x - q.x, p.z - q.z);
      if (distance < d && line(p, q)) {
        d = distance;
        best = i;
      }
    }
    for (let ring = 0; ring < Math.max(nx, nz); ring++) {
      for (let x = ix - ring; x <= ix + ring; x++) {
        visit(x, iz - ring);
        if (ring) visit(x, iz + ring);
      }
      for (let z = iz - ring + 1; z < iz + ring; z++) {
        visit(ix - ring, z);
        visit(ix + ring, z);
      }
      if (d <= (ring + 0.5) * step) return best;
    }
    return best;
  }
  function path(a, b) {
    if (!free(a) || !free(b)) return null;
    if (line(a, b)) return [{ ...a }, { ...b }];
    const start = nearest(a), end = nearest(b);
    if (start < 0 || end < 0) return null;
    const open = /* @__PURE__ */ new Set([start]), prev = /* @__PURE__ */ new Map(), cost = /* @__PURE__ */ new Map([[start, 0]]), score = /* @__PURE__ */ new Map([[start, 0]]);
    while (open.size) {
      let current = -1, best = Infinity;
      for (const i of open) if (score.get(i) < best) {
        best = score.get(i);
        current = i;
      }
      if (current === end) {
        let route = [b];
        for (let i = end; i !== void 0; i = prev.get(i)) route.push(nodes[i]);
        route.push(a);
        route.reverse();
        const smooth = [route[0]];
        for (let i = 0; i < route.length - 1; ) {
          let j = route.length - 1;
          while (j > i + 1 && !line(route[i], route[j])) j--;
          smooth.push(route[j]);
          i = j;
        }
        return smooth;
      }
      open.delete(current);
      const x = current % nx, z = Math.floor(current / nx);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const xx = x + dx, zz = z + dz;
        if (xx < 0 || xx >= nx || zz < 0 || zz >= nz) continue;
        const next = zz * nx + xx;
        if (!valid[next] || !line(nodes[current], nodes[next])) continue;
        const g = cost.get(current) + Math.hypot(dx, dz) * step;
        if (g >= (cost.get(next) ?? Infinity)) continue;
        prev.set(next, current);
        cost.set(next, g);
        score.set(next, g + Math.hypot(nodes[next].x - nodes[end].x, nodes[next].z - nodes[end].z));
        open.add(next);
      }
    }
    return null;
  }
  function clearance(p) {
    return Math.min(space ? space.clearance(p) - radius : bounds.x - Math.abs(p.x), space ? Infinity : bounds.z - Math.abs(p.z), ...obstacles.map((o) => {
      const dx = p.x - o.x, dz = p.z - o.z, c = o.c, s = o.s;
      return Math.hypot(Math.max(0, Math.abs(dx * c - dz * s) - o.w), Math.max(0, Math.abs(dx * s + dz * c) - o.d)) - radius;
    }));
  }
  return { free, line, path, clearance, nodes: nodes.filter((_, i) => valid[i]), bounds, radius };
}

// house3d/shared/object-destination.mjs
function routeLength(path) {
  return path.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - path[i].x, p.z - path[i].z), 0);
}
function planObjectDestination(objects, catalog, assets, room, start, targetId, nav) {
  const target = objects.find((o) => o.id === targetId);
  if (!target) return { ok: false, code: "target_missing", reason: "Target object not found" };
  nav ??= createNavigation(objects, catalog, { assets, room });
  if (!nav.free(start)) return { ok: false, code: "start_blocked", reason: "The current body position has no walking clearance" };
  let support = target;
  const seen = /* @__PURE__ */ new Set();
  while (support.on) {
    if (seen.has(support.id)) return { ok: false, code: "invalid_support", reason: "Support cycle" };
    seen.add(support.id);
    support = objects.find((o) => o.id === support.on.id);
    if (!support) return { ok: false, code: "invalid_support", reason: "Support object missing" };
  }
  const def = assets[support.asset_id] || catalog[support.kind];
  if (!def?.size) return { ok: false, code: "invalid_support", reason: "Object footprint missing" };
  const [width, depth] = def.size, margin = nav.radius + 0.035;
  const c = Math.cos(support.yaw), s = Math.sin(support.yaw);
  const world = (x, z) => ({ x: support.x + x * c + z * s, z: support.z - x * s + z * c });
  const dx = target.x - support.x, dz = target.z - support.z;
  const local = { x: dx * c - dz * s, z: dx * s + dz * c };
  const candidates = [];
  if (support.kind === "rug") candidates.push({ x: target.x, z: target.z });
  const clamp = (v, n) => Math.max(-n, Math.min(n, v));
  for (const sign of [-1, 1]) {
    candidates.push(world(sign * (width / 2 + margin), clamp(local.z, depth / 2)));
    candidates.push(world(clamp(local.x, width / 2), sign * (depth / 2 + margin)));
    for (let i = 0; i <= Math.ceil(depth / 0.25); i++) candidates.push(world(sign * (width / 2 + margin), -depth / 2 + depth * i / Math.ceil(depth / 0.25)));
    for (let i = 0; i <= Math.ceil(width / 0.25); i++) candidates.push(world(-width / 2 + width * i / Math.ceil(width / 0.25), sign * (depth / 2 + margin)));
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let i = 1; i < 8; i++) {
    const angle = i * Math.PI / 16;
    candidates.push(world(sx * (width / 2 + margin * Math.cos(angle)), sz * (depth / 2 + margin * Math.sin(angle))));
  }
  const unique = new Map(candidates.filter((p) => nav.free(p)).map((p) => [`${p.x.toFixed(5)},${p.z.toFixed(5)}`, p]));
  const goals = [...unique.values()].sort((a, b) => Math.hypot(a.x - start.x, a.z - start.z) - Math.hypot(b.x - start.x, b.z - start.z));
  let best = null;
  for (const p of goals) {
    if (best && Math.hypot(p.x - start.x, p.z - start.z) >= best.distance) break;
    const path = nav.path(start, p);
    if (!path) continue;
    const distance = routeLength(path);
    if (!best || distance < best.distance) best = { point: p, path, distance };
  }
  return best ? { ok: true, target_id: targetId, support_id: support.id, ...best } : { ok: false, code: "unreachable", reason: "No collision-free route to the object edge; clear a passage" };
}

// house3d/shared/interaction-approach.mjs
function worldPoint(obj, [x, y, z]) {
  const c = Math.cos(obj.yaw), s = Math.sin(obj.yaw);
  return { x: obj.x + x * c + z * s, y, z: obj.z - x * s + z * c, yaw: obj.yaw };
}
function chooseApproach(obj, config, nav, start) {
  return config.approaches.map((p, index) => ({ point: worldPoint(obj, p), index })).filter((v) => nav.free(v.point)).map((v) => ({ ...v, path: nav.path(start, v.point) })).filter((v) => v.path).sort((a, b) => routeLength(a.path) - routeLength(b.path))[0] || null;
}
function interactionApproach(obj, config, nav, start, { objects, catalog, assets, room }) {
  const target = worldPoint(obj, config.root);
  const entryNav = createNavigation(objects.filter((o) => o.id !== obj.id), catalog, { assets, radius: 0.32, room });
  return chooseApproach(obj, config, { ...nav, free: (p) => nav.free(p) && entryNav.line(p, target) }, start);
}

// house3d/shared/airing.mjs
function airingBed(state, rack) {
  if (rack.kind !== "drying_rack") return null;
  const airing = new Set(state.objects.filter((o) => o.kind === "drying_rack").map((o) => o.properties?.quilt_from));
  return state.objects.find((o) => o.kind === "bed" && !airing.has(o.id) && o.asset_id === "whale-bed-v1") ?? state.objects.find((o) => o.kind === "bed" && !airing.has(o.id));
}
function validHangingQuilt(room, objects, rack) {
  const id = rack.properties?.quilt_from;
  return !id || rack.kind === "drying_rack" && regionAt(room, rack) === "balcony" && objects.some((o) => o.kind === "bed" && o.id === id);
}

// house3d/server/crayon.mjs
import { deflateSync, inflateSync, crc32 } from "node:zlib";
var palette = { ink: [44, 66, 88], mint: [94, 176, 166], green: [99, 155, 86], blue: [75, 131, 194], ochre: [241, 174, 58], coral: [223, 107, 110] };
var drawingWidth = 480;
var drawingHeight = 360;
var drawable = (item) => ["urban-picture-book-v1", "urban-workbook-v1"].includes(item.asset_id);
var motifs = ["sun", "house", "flower"];
function validateDrawing(title, marks) {
  if (typeof title !== "string" || !title.trim() || [...title].length > 32) throw Error("Use a title of 1\u201332 characters");
  if (!Array.isArray(marks) || !marks.length || marks.length > 32) throw Error("Use 1\u201332 crayon marks");
  marks.forEach((mark, i) => {
    const invalid = () => {
      throw Error("Invalid crayon mark " + (i + 1) + ": check shape, palette color and page bounds");
    };
    if (!Array.isArray(mark)) invalid();
    const [op, color, ...n] = mark;
    if (typeof color !== "string" || !Object.hasOwn(palette, color) || !["line", "oval", "wash", ...motifs].includes(op) || n.length < 4 || n.length > 20 || n.length % 2 || !n.every((x2) => Number.isFinite(x2) && x2 >= 0 && x2 <= 100)) invalid();
    if (op !== "line" && n.length !== 4) invalid();
    const [x, y, a, b] = n;
    if ((op === "oval" || motifs.includes(op)) && (!a || !b || x - a < 0 || x + a > 100 || y - b < 0 || y + b > 100)) invalid();
    if (op === "wash" && (a <= x || b <= y)) invalid();
  });
}
function chunk(name, data) {
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length);
  out.write(name, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, -4)), out.length - 4);
  return out;
}
function strokes(mark) {
  const [op, color, x, y, a, b] = mark;
  if (!motifs.includes(op)) return [mark];
  const oval = (u, v, rx, ry) => ["oval", color, x + u * a, y + v * b, rx * a, ry * b];
  const line = (...points) => ["line", color, ...points.map((p, i) => i % 2 ? y + p * b : x + p * a)];
  if (op === "sun") {
    const rays = Array.from({ length: 8 }, (_, i) => {
      const u = Math.cos(i * Math.PI / 4), v = Math.sin(i * Math.PI / 4);
      return line(0.75 * u, 0.75 * v, u, v);
    });
    return [oval(0, 0, 0.56, 0.56), ...rays];
  }
  if (op === "house") return [line(-1, -0.1, 0, -1, 1, -0.1, -1, -0.1), line(-0.8, -0.1, -0.8, 1, 0.8, 1, 0.8, -0.1), line(-0.4, 1, -0.4, 0.4, 0, 0.4, 0, 1), line(0.22, 0.18, 0.54, 0.18, 0.54, 0.5, 0.22, 0.5, 0.22, 0.18)];
  const petals = Array.from({ length: 5 }, (_, i) => oval(0.48 * Math.sin(i * 2 * Math.PI / 5), -0.42 - 0.34 * Math.cos(i * 2 * Math.PI / 5), 0.26, 0.19));
  return [line(0, -0.14, 0.04, 0.99), line(0.02, 0.72, -0.62, 0.42, -0.34, 0.73, 0.02, 0.72), ...petals, oval(0, -0.42, 0.19, 0.14)];
}
function readPaper(png, byteLength) {
  const length2 = png.readUInt32BE(33);
  const scan = inflateSync(png.subarray(41, 41 + length2), { maxOutputLength: byteLength });
  if (scan.length !== byteLength) throw Error("Unexpected stored drawing size");
  return scan;
}
function crayonPng(marks, base = void 0) {
  const w = drawingWidth, h = drawingHeight, stride = 1 + 3 * w, scan = base ? readPaper(base, stride * h) : Buffer.alloc(stride * h), grain = new Float32Array(w * h);
  let seed = 31415;
  const random = () => (seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 4294967296;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = grain[y * w + x] = random(), shade = 5 * v + 3 * random(), i = y * stride + 1 + x * 3;
    if (!base) {
      scan[i] = 253 - shade;
      scan[i + 1] = 249 - shade;
      scan[i + 2] = 235 - shade;
    }
  }
  for (const [op, color, ...n] of marks.flatMap(strokes)) {
    const points = [], rgb = palette[color], r = op === "wash" ? 3.5 : 2.3;
    const [x, y, a, b] = n;
    if (op === "line") for (let i = 0; i < n.length; i += 2) points.push([n[i], n[i + 1]]);
    if (op === "oval") for (let i = 0; i <= 36; i++) points.push([x + a * Math.cos(i * Math.PI / 18), y + b * Math.sin(i * Math.PI / 18)]);
    if (op === "wash") {
      const rows = Math.max(3, Math.ceil((b - y) / 1.3));
      for (let j = 0; j < rows; j++) {
        const yy = y + (b - y) * j / (rows - 1), l = [x, yy], u = [a, yy];
        points.push(...j % 2 ? [u, l] : [l, u]);
      }
    }
    const px = points.map(([u, v]) => [18 + u * (w - 36) / 100, 14 + v * (h - 28) / 100]);
    for (let j = 1; j < px.length; j++) {
      const [sx, sy] = px[j - 1], dx = px[j][0] - sx, dy = px[j][1] - sy, steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 1.3));
      for (let k = 0; k <= steps; k++) {
        const t = k / steps, cx = sx + dx * t + 0.8 * Math.sin(j + t), cy = sy + dy * t + 0.7 * Math.sin(1.5 * j + 4 * t);
        for (let iy = Math.floor(cy - r); iy <= cy + r; iy++) for (let ix = Math.floor(cx - r); ix <= cx + r; ix++) {
          const d = ((ix - cx) ** 2 + (iy - cy) ** 2) / (r * r);
          if (d >= 1) continue;
          const alpha = (op === "wash" ? 0.22 : 0.55) * (1 - d) * Math.min(1, grain[iy * w + ix] * 2.4), i = iy * stride + 1 + ix * 3;
          for (let c = 0; c < 3; c++) scan[i + c] += Math.round((rgb[c] - scan[i + c]) * alpha);
        }
      }
    }
  }
  const hdr = Buffer.alloc(13);
  hdr.writeUInt32BE(w);
  hdr.writeUInt32BE(h, 4);
  hdr[8] = 8;
  hdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", hdr), chunk("IDAT", deflateSync(scan)), chunk("IEND", Buffer.alloc(0))]);
}

// house3d/server/types.ts
var record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
var clone = (value) => structuredClone(value);
var length = (s) => [...s].length;
function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}
function number(v, low, high, floatBounds = false) {
  requireValue(
    typeof v === "number" && Number.isFinite(v) && v >= low && v <= high,
    `Expected finite number in [${floatBounds && Number.isInteger(low) ? low.toFixed(1) : low}, ${floatBounds && Number.isInteger(high) ? high.toFixed(1) : high}]`
  );
  return v;
}
function round(v, digits) {
  const f = 10 ** digits;
  return Math.round((v + Number.EPSILON) * f) / f;
}
function same(a, b) {
  return stable(a) === stable(b);
}
function stable(value) {
  return JSON.stringify(
    value,
    (_key, v) => record(v) ? Object.fromEntries(
      Object.keys(v).sort().map((k) => [k, v[k]])
    ) : v
  );
}
function extra(value, allowed) {
  const keys = new Set(allowed);
  return Object.keys(value).some((k) => !keys.has(k));
}

// house3d/server/geometry.ts
var DEFAULT_SIZE = { width: 6, depth: 5, height: 2.4 };
var LIMITS = {
  width: [4, 12],
  depth: [4, 10],
  height: [2.4, 4]
};
var ROOM_DEFAULT = {
  ...DEFAULT_SIZE,
  wall_color: "#f3eee5",
  trim_color: "#d9c4a3",
  wallpapers: Object.fromEntries(
    ["back", "front", "left", "right"].map((w) => [w, "plain"])
  )
};
function dimensions(room = {}) {
  return Object.fromEntries(
    Object.entries(DEFAULT_SIZE).map(([k, v]) => [k, room[k] ?? v])
  );
}
function boundaries(room = {}) {
  const d = dimensions(room);
  return {
    furniture_x: d.width / 2 - 0.05,
    furniture_z: d.depth / 2 - 0.05,
    body_x: d.width / 2 - 0.72,
    body_z: d.depth / 2 - 0.72,
    height: d.height
  };
}
function wallsFor(room = {}) {
  const b = boundaries(room);
  return [
    ["back", "z", -b.furniture_z, 0, "\u540E\u5899", 1],
    ["front", "z", b.furniture_z, Math.PI, "\u524D\u5899", -1],
    ["left", "x", -b.furniture_x, Math.PI / 2, "\u5DE6\u5899", 1],
    ["right", "x", b.furniture_x, -Math.PI / 2, "\u53F3\u5899", -1]
  ].map(([id, axis, position, yaw, label, inward]) => ({
    id,
    name: id,
    [axis]: position,
    yaw,
    label,
    axis,
    position,
    inward
  }));
}
function definition(obj, ctx) {
  return obj.asset_id ? ctx.assets[obj.asset_id] : ctx.catalog[obj.kind];
}
function heightOf(obj, objects, ctx, seen = /* @__PURE__ */ new Set()) {
  if (seen.has(obj.id)) return 0;
  seen.add(obj.id);
  if (!obj.on) return definition(obj, ctx)?.elevation || 0;
  const parent = objects.find((p) => p.id === obj.on.id);
  if (!parent) return 0;
  const surface = definition(parent, ctx)?.surfaces?.[obj.on.surface];
  return surface ? heightOf(parent, objects, ctx, seen) + surface.height + (definition(obj, ctx)?.support_offset || 0) : 0;
}
function parseSupport(value) {
  requireValue(
    record(value) && Object.keys(value).sort().join(",") === "id,surface,x,yaw,z",
    "on requires id, surface, x, z and yaw; offsets are relative to the supporting surface"
  );
  requireValue(
    typeof value.id === "string" && length(value.id) >= 1 && length(value.id) <= 64,
    "Invalid support id"
  );
  requireValue(
    typeof value.surface === "string" && length(value.surface) >= 1 && length(value.surface) <= 64,
    "Choose a surface id from the supporting asset catalog"
  );
  for (const k of ["x", "z", "yaw"])
    requireValue(
      typeof value[k] === "number" && Number.isFinite(value[k]) && Math.abs(value[k]) <= (k === "yaw" ? Math.PI * 2 : 3),
      "Support offsets and yaw must be bounded finite numbers"
    );
  return { ...value };
}
function ledgeFit(obj, ctx, surface) {
  const mount = definition(obj, ctx).ledge_mount, on = obj.on;
  const c = Math.cos(on.yaw), s = Math.sin(on.yaw);
  const [px, pz] = mount.pot_center, r = mount.pot_radius;
  if (Math.abs(on.x + px * c + pz * s) + r > surface.size[0] / 2 + 2e-3 || Math.abs(on.z - px * s + pz * c) + r > surface.size[1] / 2 + 2e-3) return "support_overhang";
  const [left, back, right, front] = mount.tail;
  const nearest = Math.min(...[left, right].flatMap((x) => [back, front].map((z) => on.z - x * s + z * c)));
  if (surface.front_edge === void 0 || nearest < surface.front_edge + 5e-3) return "foliage_clearance";
}
function resolveSupports(objects, ctx) {
  const byId = new Map(objects.map((o) => [o.id, o])), resolved = /* @__PURE__ */ new Set(), visiting = /* @__PURE__ */ new Set(), invalid = /* @__PURE__ */ new Set(), errors = [];
  function error(code, obj, message) {
    invalid.add(obj.id);
    errors.push({
      code,
      ids: [obj.id],
      message,
      suggestion: "\u68C0\u67E5 get_catalog \u4E2D\u7684\u627F\u8F7D\u9762\u548C\u7269\u54C1\u5C3A\u5BF8\uFF1B\u5148\u8C03\u6574\u6446\u653E\uFF0C\u518D\u9884\u6F14\u3002"
    });
  }
  function visit(obj) {
    if (resolved.has(obj.id)) return !invalid.has(obj.id);
    if (visiting.has(obj.id)) {
      error("support_cycle", obj, "\u7269\u54C1\u4E4B\u95F4\u4E0D\u80FD\u5FAA\u73AF\u627F\u8F7D\u3002");
      return false;
    }
    visiting.add(obj.id);
    const own = definition(obj, ctx), on = obj.on;
    if (own.placement === "surface" && !on)
      error("surface_required", obj, "\u8FD9\u4E2A\u7269\u54C1\u9700\u8981\u653E\u5728\u76EE\u5F55\u58F0\u660E\u7684\u627F\u8F7D\u9762\u4E0A\u3002");
    if (on) {
      if (own.placement !== "surface")
        error("support_not_allowed", obj, "\u6B64\u5BB6\u5177\u4E0D\u662F\u684C\u9762\u6216\u5C42\u677F\u6446\u4EF6\u3002");
      const parent = byId.get(on.id);
      if (!parent)
        error(
          "support_missing",
          obj,
          "\u627F\u8F7D\u5BB6\u5177\u4E0D\u5B58\u5728\uFF1B\u79FB\u9664\u5BB6\u5177\u65F6\u4E5F\u9700\u5904\u7406\u4E0A\u9762\u7684\u7269\u54C1\u3002"
        );
      else if (visit(parent)) {
        const surface = definition(parent, ctx).surfaces?.[on.surface];
        if (!surface) error("surface_unknown", obj, "\u627F\u8F7D\u5BB6\u5177\u6CA1\u6709\u8FD9\u4E2A\u627F\u8F7D\u9762\u3002");
        else {
          const [cx, cz] = surface.center || [0, 0], x = cx + on.x, z = cz + on.z, c = Math.cos(parent.yaw), s = Math.sin(parent.yaw);
          Object.assign(obj, {
            x: parent.x + x * c + z * s,
            z: parent.z - x * s + z * c,
            yaw: parent.yaw + on.yaw
          });
          const [w, d] = own.size, co = Math.abs(Math.cos(on.yaw)), si = Math.abs(Math.sin(on.yaw));
          if (own.ledge_mount) {
            const issue = ledgeFit(obj, ctx, surface);
            if (issue) error(issue, obj, issue === "support_overhang" ? "\u82B1\u76C6\u5E95\u90E8\u6CA1\u6709\u5B8C\u6574\u653E\u5728\u5C42\u677F\u4E0A\u3002" : "\u5782\u85E4\u9700\u8981\u8D8A\u8FC7\u5C42\u677F\u5F00\u653E\u7684\u524D\u7F18\uFF0C\u8BF7\u6362\u4F4D\u7F6E\u6216\u8C03\u6574\u671D\u5411\u3002");
          } else if (Math.abs(on.x) + (w * co + d * si) / 2 > surface.size[0] / 2 + 2e-3 || Math.abs(on.z) + (w * si + d * co) / 2 > surface.size[1] / 2 + 2e-3)
            error("support_overhang", obj, "\u7269\u54C1\u8D85\u51FA\u627F\u8F7D\u9762\u7684\u5B89\u5168\u8FB9\u7F18\u3002");
          const top = heightOf(obj, objects, ctx) + own.height;
          let child = obj;
          while (child?.on) {
            const holder = byId.get(child.on.id);
            if (!holder) break;
            const level = definition(holder, ctx)?.surfaces?.[child.on.surface];
            if (level?.clearance !== void 0 && top > heightOf(holder, objects, ctx) + level.height + level.clearance + 2e-3) {
              error("support_clearance", obj, "\u7269\u54C1\u9AD8\u4E8E\u5C42\u677F\u51C0\u7A7A\uFF0C\u6362\u5230\u66F4\u9AD8\u7684\u683C\u5B50\u6216\u67DC\u9876\u3002");
              break;
            }
            child = holder;
          }
        }
      } else error("support_invalid", obj, "\u627F\u8F7D\u5173\u7CFB\u672A\u901A\u8FC7\u68C0\u67E5\u3002");
    }
    visiting.delete(obj.id);
    resolved.add(obj.id);
    return !invalid.has(obj.id);
  }
  for (const obj of objects) visit(obj);
  return errors;
}
function supportsPair(a, b, objects) {
  const byId = new Map(objects.map((o) => [o.id, o]));
  function ancestor(child, parent) {
    const seen = /* @__PURE__ */ new Set();
    while (child?.on && !seen.has(child.id)) {
      seen.add(child.id);
      if (child.on.id === parent.id) return true;
      child = byId.get(child.on.id);
    }
    return false;
  }
  return ancestor(a, b) || ancestor(b, a);
}
function footprint(obj, ctx) {
  const [w, d] = definition(obj, ctx).size, c = Math.abs(Math.cos(obj.yaw)), s = Math.abs(Math.sin(obj.yaw));
  return [c * w + s * d, s * w + c * d];
}
function occupiedSections(obj, ctx, y, w, d) {
  const asset = definition(obj, ctx), crown = { x: obj.x, z: obj.z, w, d, bottom: y, top: y + asset.height };
  if (!asset.ledge_mount) return [crown];
  const [x0, z0, x1, z1] = asset.ledge_mount.tail;
  const c = Math.cos(obj.yaw), s = Math.sin(obj.yaw), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
  const seat = y - asset.support_offset;
  return [{ ...crown, bottom: seat }, {
    x: obj.x + mx * c + mz * s,
    z: obj.z - mx * s + mz * c,
    w: (x1 - x0) * Math.abs(c) + (z1 - z0) * Math.abs(s),
    d: (x1 - x0) * Math.abs(s) + (z1 - z0) * Math.abs(c),
    bottom: y,
    top: seat
  }];
}
function sectionOverlap(first, second) {
  for (const a of first) for (const b of second) {
    if (a.top <= b.bottom + 0.01 || b.top <= a.bottom + 0.01) continue;
    const x = (a.w + b.w) / 2 - Math.abs(a.x - b.x), z = (a.d + b.d) / 2 - Math.abs(a.z - b.z);
    if (x > 0.015 && z > 0.015) return { x, z };
  }
}
function validateLayout(state, ctx) {
  validateBalcony(state, ctx);
  const limits = boundaries(state.room), errors = resolveSupports(state.objects, ctx);
  requireValue(!errors.length, errors[0]?.message);
  const solids = [], seen = /* @__PURE__ */ new Set();
  for (const obj of state.objects) {
    requireValue(!seen.has(obj.id), "Duplicate furniture id");
    seen.add(obj.id);
    requireValue(
      !obj.asset_id || ctx.assets[obj.asset_id]?.kind === obj.kind,
      "Asset does not match furniture kind"
    );
    const def = definition(obj, ctx), y = heightOf(obj, state.objects, ctx), h = def.height, [w, d] = footprint(obj, ctx);
    requireValue(
      !(!fitsFootprint(state.room, obj, w, d) || y < -1e-3 || y + h > limits.height),
      "Furniture extends outside room: " + obj.id
    );
    if (def.placement === "wall") {
      requireValue(
        mountedInRoom(state.room, obj, w, d),
        "Wall fixture must face into the room on the back or left wall"
      );
    }
    requireValue(validHangingQuilt(state.room, state.objects, obj), "Bring the quilt in before moving the rack indoors or removing its bed");
    if (!obj.on && obj.kind !== "rug") requireValue(!blocksDoor(state.room, obj, w, d), "Furniture blocks a room doorway: " + obj.id);
    if (obj.kind === "rug") continue;
    const occupied = occupiedSections(obj, ctx, y, w, d);
    for (const [other, sections] of solids) {
      if (!sectionOverlap(occupied, sections) || supportsPair(obj, other, state.objects)) continue;
      throw Error("Furniture overlaps another item: " + other.id + " / " + obj.id);
    }
    solids.push([obj, occupied]);
  }
}
function validateBalcony(state, ctx) {
  const b = balconyGeometry(state.room);
  if (!b) return;
  const span = b.wall === "left" ? state.room?.depth ?? 5 : state.room?.width ?? 6;
  requireValue(Math.abs(b.center) + b.width / 2 <= span / 2 - 0.08, "Balcony must fit along its supporting wall");
  const door = state.objects.find((o) => o.id === b.door_id), def = door && definition(door, ctx);
  requireValue(door && def?.wall_opening && def.placement === "wall", "Balcony requires its declared floor window/door");
  requireValue(Math.abs(door.yaw - (b.wall === "left" ? Math.PI / 2 : 0)) < 1e-3, "Balcony door must face its supporting wall");
  const q = balconyLocal(state.room, door);
  requireValue(Math.abs(q.v) < 0.25 && Math.abs(q.u) + def.wall_opening.width / 2 + 0.03 <= b.width / 2 - 0.02, "Door opening must lie inside the balcony wall span");
}

// house3d/server/objects.ts
var CATEGORIES = {
  wall_shelf: "storage",
  wall_art: "decoration",
  storage_box: "storage",
  desktop: "study",
  books: "study",
  air_conditioner: "appliances",
  appliance: "appliances",
  toy_set: "play",
  chair: "seating",
  sofa: "seating",
  armchair: "seating",
  bed: "sleeping",
  desk: "study",
  shelf: "storage",
  sideboard: "storage",
  nightstand: "storage",
  fridge: "appliances",
  office_chair: "seating",
  dining_chair: "seating",
  coffee_table: "tables",
  dining_table: "tables",
  media_console: "storage",
  tv: "appliances",
  washer: "appliances",
  computer: "study",
  lamp: "lighting",
  plant: "decoration",
  rug: "decoration",
  window: "environment",
  drying_rack: "storage"
};
var CATEGORY_LABELS = {
  play: "\u73A9\u5177",
  seating: "\u5750\u5177",
  sleeping: "\u5BDD\u5177",
  study: "\u5B66\u4E60\u521B\u4F5C",
  tables: "\u684C\u51E0",
  storage: "\u6536\u7EB3",
  appliances: "\u5BB6\u7535",
  lighting: "\u706F\u5149",
  decoration: "\u88C5\u9970\u690D\u7269",
  environment: "\u73AF\u5883"
};
function categoriesFor(ctx) {
  if (Object.values(ctx.assets).some((a) => a.kind === "toy_set")) return CATEGORY_LABELS;
  const { play, ...categories } = CATEGORY_LABELS;
  return categories;
}
var BUSY_PHASES = /* @__PURE__ */ new Set([
  "requested",
  "approaching",
  "entering",
  "active",
  "leaving"
]);
var busy = (state) => BUSY_PHASES.has(state.interaction?.phase);
function worldPoint2(obj, point) {
  const [x, y, z] = point, c = Math.cos(obj.yaw), s = Math.sin(obj.yaw);
  return {
    x: obj.x + x * c + z * s,
    y,
    z: obj.z - x * s + z * c,
    yaw: obj.yaw
  };
}
function readingDesk(obj, state) {
  if (obj.kind !== "chair") return void 0;
  return state.objects.filter((d) => {
    if (d.kind !== "desk") return false;
    const dx = d.x - obj.x, dz = d.z - obj.z, c = Math.cos(obj.yaw), s = Math.sin(obj.yaw), forward = dx * s + dz * c, side = dx * c - dz * s;
    return forward > 0.4 && forward < 1.35 && Math.abs(side) < 0.45;
  }).sort(
    (a, b) => Math.hypot(a.x - obj.x, a.z - obj.z) - Math.hypot(b.x - obj.x, b.z - obj.z)
  )[0];
}
function drawingBook(chair, state) {
  const desk = readingDesk(chair, state);
  return desk && state.objects.find((o) => drawable(o) && o.on?.id === desk.id && o.on.surface === "top");
}
function riceSource(bowl, state) {
  if (bowl.asset_id !== "home-rice-bowl-v1" || !bowl.on) return void 0;
  return state.objects.filter((o) => o.asset_id === "home-rice-cooker-v1" && o.on?.id === bowl.on.id && o.on?.surface === bowl.on.surface && (o.properties?.servings ?? 4) > 0).sort((a, b) => Math.hypot(a.x - bowl.x, a.z - bowl.z) - Math.hypot(b.x - bowl.x, b.z - bowl.z))[0];
}
function actionsFor(obj, ctx, state) {
  const def = ctx.assets[obj.asset_id || ""] || {}, result = [], job = state.interaction || {};
  for (const name of Object.keys(def.interactions || {}))
    result.push({
      id: name,
      label: { play: "\u5750\u4E0B\u73A9\u673A\u5668\u4EBA", sit: "\u5750\u4E00\u4F1A\u513F", sleep: "\u8EBA\u4E0B\u7761\u89C9" }[name],
      available: !busy(state),
      reason: busy(state) ? "\u5148\u7ED3\u675F\u5F53\u524D\u4E92\u52A8" : null,
      reachability: "not_checked"
    });
  if (obj.asset_id === "home-rice-bowl-v1") {
    const full = obj.properties?.filled === true, source = riceSource(obj, state);
    result.push({
      id: "serve_rice",
      label: "\u76DB\u4E00\u7897\u767D\u996D",
      available: !full && !!source,
      reason: full ? "\u7897\u91CC\u5DF2\u7ECF\u6709\u996D" : source ? null : "\u628A\u7897\u653E\u5230\u8FD8\u6709\u996D\u7684\u7535\u996D\u9505\u65C1\uFF0C\u540C\u4E00\u4E2A\u53F0\u9762\u4E0A"
    });
  }
  if (obj.asset_id === "home-rice-bowl-v1") result.push({ id: "eat_rice", label: "\u5403\u5B8C\u7897\u91CC\u7684\u996D", available: obj.properties?.filled === true, reason: obj.properties?.filled ? null : "\u7897\u91CC\u8FD8\u6CA1\u6709\u996D" });
  if (obj.asset_id === "home-rice-cooker-v1") result.push({ id: "refill_rice", label: "\u6DFB\u6EE1\u767D\u996D", available: (obj.properties?.servings ?? 4) < 4, reason: (obj.properties?.servings ?? 4) < 4 ? null : "\u9505\u91CC\u5DF2\u7ECF\u6EE1\u4E86" });
  if (obj.kind === "tv") result.push({ id: "turn_on", label: "\u6253\u5F00\u7535\u89C6", available: true }, { id: "turn_off", label: "\u5173\u7535\u89C6", available: true });
  if (obj.kind === "drying_rack") {
    if (obj.properties?.quilt_from) result.push({ id: "bring_in_quilt", label: "\u6536\u56DE\u667E\u7740\u7684\u88AB\u5B50", available: true });
    else {
      const outdoors = regionAt(state.room, obj) === "balcony", bed = airingBed(state, obj);
      result.push({ id: "air_quilt", label: "\u6652\u4E00\u6652\u88AB\u5B50", available: outdoors && !!bed && !busy(state), reason: !outdoors ? "\u5148\u628A\u667E\u67B6\u653E\u5728\u9633\u53F0" : !bed ? "\u6CA1\u6709\u7A7A\u95F2\u7684\u88AB\u5B50" : busy(state) ? "\u5148\u7ED3\u675F\u5F53\u524D\u4E92\u52A8" : null });
    }
  }
  if (obj.kind === "toy_set" && def.interactions?.play) {
    const packed = obj.properties?.packed === true;
    const available = !busy(state) || job.target_id === obj.id && job.pose === "play" && job.phase === "active";
    result.push({ id: packed ? "unpack" : "tidy", label: packed ? "\u62FF\u51FA\u73A9\u5177" : "\u6536\u597D\u73A9\u5177", available, reason: available ? null : "\u5148\u7ED3\u675F\u5F53\u524D\u4E92\u52A8" });
    if (packed) {
      const play = result.find((a) => a.id === "play");
      if (play) {
        play.available = false;
        play.reason = "\u5148\u62FF\u51FA\u73A9\u5177";
      }
    }
  }
  if (def.interactions?.sit && readingDesk(obj, state))
    result.push({
      id: "read",
      label: "\u5750\u4E0B\u770B\u4E66",
      available: !busy(state),
      reason: busy(state) ? "\u5148\u7ED3\u675F\u5F53\u524D\u4E92\u52A8" : null,
      reachability: "not_checked"
    });
  if (def.interactions?.sit && drawingBook(obj, state))
    result.push({ id: "draw", label: "\u62FF\u8721\u7B14\u753B\u753B", available: !busy(state), reason: busy(state) ? "\u5148\u7ED3\u675F\u5F53\u524D\u4E92\u52A8" : null, reachability: "not_checked" });
  if (busy(state) && job.target_id === obj.id)
    result.push({
      id: "leave",
      label: job.pose === "sleep" ? "\u8D77\u5E8A" : "\u8D77\u8EAB",
      available: job.action !== "leave",
      reason: null
    });
  if (def.interactions?.sleep && job.target_id === obj.id && job.phase === "active") {
    const covered = obj.properties?.covered ?? true;
    result.push({
      id: covered ? "uncover" : "cover",
      label: covered ? "\u6380\u5F00\u88AB\u5B50" : "\u76D6\u597D\u88AB\u5B50",
      available: !state.objects.some((o) => o.properties?.quilt_from === obj.id)
    });
  }
  if (obj.kind === "lamp")
    result.push(
      { id: "turn_on", label: "\u5F00\u706F", available: true },
      { id: "turn_off", label: "\u5173\u706F", available: true }
    );
  return result;
}
function objectList(state, ctx, category, capability) {
  const objects = [];
  for (const obj of state.objects) {
    const def = ctx.assets[obj.asset_id || ""] || {}, cat = obj.asset_id === "home-rice-bowl-v1" ? "tables" : CATEGORIES[obj.kind] || "decoration", actions = actionsFor(obj, ctx, state);
    if (category && category !== cat || capability && !actions.some((a) => a.id === capability))
      continue;
    objects.push({
      ...obj,
      ...state.room?.balcony ? { area: regionAt(state.room, obj) } : {},
      label: obj.label ?? def.label ?? obj.kind,
      category: cat,
      category_label: CATEGORY_LABELS[cat],
      support: obj.on ? { ...obj.on, base_height: heightOf(obj, state.objects, ctx) } : null,
      writable_properties: obj.id === state.room?.balcony?.door_id ? { open: { type: "boolean" } } : obj.kind === "tv" ? { on: { type: "boolean" } } : obj.asset_id === "home-rice-cooker-v1" ? { keep_full: { type: "boolean" } } : obj.kind === "lamp" ? {
        on: { type: "boolean" },
        brightness: { type: "number", minimum: 0, maximum: 1 }
      } : def.interactions?.sleep ? { covered: { type: "boolean" } } : {},
      actions,
      properties: obj.asset_id === "home-rice-cooker-v1" ? { servings: 4, keep_full: false, ...obj.properties } : obj.asset_id === "home-rice-bowl-v1" ? { filled: false, ...obj.properties } : obj.properties ?? (obj.kind === "tv" ? { on: true } : obj.kind === "toy_set" ? { packed: false } : obj.id === state.room?.balcony?.door_id ? { open: true } : obj.kind === "lamp" ? { on: true, brightness: 0.7 } : obj.kind === "bed" ? { covered: true } : {}),
      interaction: state.interaction?.target_id === obj.id ? state.interaction : null
    });
  }
  return {
    revision: state.revision,
    categories: categoriesFor(ctx),
    objects,
    interaction: state.interaction ?? null
  };
}

// house3d/server/interactions.ts
var POSES = /* @__PURE__ */ new Set(["sit", "sleep", "read", "draw", "play"]);
function interactionList(state, ctx, snapshot, now, category, capability) {
  const fresh = !!snapshot?.visible && now - snapshot.received_at < 6;
  const body = snapshot?.body;
  const viewerReason = !fresh ? "\u6CA1\u6709\u65B0\u9C9C\u7684\u8EAB\u4F53\u53CD\u9988\uFF0C\u8BF7\u6253\u5F00\u5C0F\u5BB6\u9875\u9762" : snapshot?.paused ? "\u5C0F\u5BB6\u5DF2\u6682\u505C\uFF0C\u8BF7\u5148\u6062\u590D" : null;
  let nav;
  const checked = /* @__PURE__ */ new Map();
  const objects = objectList(state, ctx, category, capability).objects.flatMap((obj) => {
    if (!obj.actions.length) return [];
    const actions = obj.actions.filter((a) => !capability || a.id === capability).map((action) => {
      const pose = POSES.has(action.id), bodyAction = pose || action.id === "leave";
      let available = action.available, reason = action.reason ?? null;
      let reachability = bodyAction ? "not_checked" : "not_required";
      let approach = null;
      if (available && bodyAction && viewerReason) {
        available = false;
        reason = viewerReason;
      }
      if (available && pose) {
        if (body?.pose !== "stand") {
          available = false;
          reason = "\u5148\u8D77\u8EAB\u7AD9\u7A33\uFF0C\u518D\u5F00\u59CB\u65B0\u7684\u52A8\u4F5C";
        } else {
          nav ??= createNavigation(state.objects, ctx.catalog, { assets: ctx.assets, room: state.room ?? {} });
          const kind = ["read", "draw"].includes(action.id) ? "sit" : action.id;
          const key = obj.id + ":" + kind;
          if (!checked.has(key)) checked.set(key, interactionApproach(
            obj,
            ctx.assets[obj.asset_id].interactions[kind],
            nav,
            body,
            { objects: state.objects, catalog: ctx.catalog, assets: ctx.assets, room: state.room ?? {} }
          ));
          const plan = checked.get(key);
          if (plan) {
            reachability = "reachable";
            approach = { x: plan.point.x, z: plan.point.z, distance_m: Math.round(routeLength(plan.path) * 100) / 100 };
          } else {
            available = false;
            reachability = "blocked";
            reason = "\u6CA1\u6709\u80FD\u8D70\u5230\u5E76\u8FDB\u5165\u8BE5\u59FF\u52BF\u7684\u8DEF\u7EBF\uFF0C\u8BF7\u5148\u817E\u51FA\u901A\u9053";
          }
        }
      }
      if (action.id === "leave" && available) reachability = "not_required";
      return {
        ...action,
        available,
        reason,
        reachability,
        execution: pose ? "walk_then_pose" : bodyAction ? "leave_pose" : "state_update",
        ...approach ? { approach } : {},
        command: { tool: "interact", arguments: { target_id: obj.id, action: action.id } }
      };
    });
    return [{ id: obj.id, label: obj.label, category: obj.category, category_label: obj.category_label, actions }];
  });
  return {
    revision: state.revision,
    fresh,
    body_job_id: snapshot?.job_id ?? null,
    position: body ? { x: body.x, z: body.z, yaw: body.yaw, pose: body.pose } : null,
    objects,
    limitations: ["Reachability uses current body and furniture clearance; execution checks the route again. State updates do not imply a walking or manipulation animation."]
  };
}

// house3d/server/app.ts
import { readFileSync, statSync, realpathSync, existsSync } from "node:fs";
import { resolve, sep, extname } from "node:path";
import { randomUUID } from "node:crypto";

// house3d/server/connect-home.ts
function connectHome(state, ctx, start) {
  requireValue(!state.room?.floorplan, "Rooms are already connected");
  const fromChild = state.preset_id === "childroom";
  requireValue(fromChild || state.preset_id === "family-home", "Start from a family-home or childroom save; unlabelled layouts are not replaced");
  if (fromChild) requireValue(state.room?.width === 6 && state.room?.depth === 5, "Connecting a resized child room requires a custom floorplan");
  const family = ctx.presets["family-home"], child = ctx.presets.childroom;
  const room = { ...clone(fromChild ? family.room : state.room), floorplan: CONNECTED_HOME, child_finish: clone(fromChild ? state.room : child.room) };
  const plan = apartment(room), zone = (id) => plan.zones.find((z) => z.id === id);
  const childZone = zone("child"), parent = zone("parent"), bath = zone("bath");
  const objects = [], ids = /* @__PURE__ */ new Set();
  function insert(items, dx, dz, added, prefix) {
    const renamed = /* @__PURE__ */ new Map();
    for (const o of items) {
      let id = added && prefix === "child" ? "childroom-" + o.id : o.id;
      if (ids.has(id) && added) id = prefix + "-" + o.id;
      requireValue(!ids.has(id) && id.length <= 64, "Cannot connect: duplicate item ID " + id);
      ids.add(id);
      renamed.set(o.id, id);
    }
    for (const original of items) {
      const o = clone(original);
      o.id = renamed.get(o.id);
      if (o.on) o.on.id = renamed.get(o.on.id) ?? o.on.id;
      else {
        o.x += dx;
        o.z += dz;
      }
      objects.push(o);
    }
    return renamed;
  }
  if (fromChild) {
    insert(state.objects, childZone.x, childZone.z, false, "child");
    const names = insert(family.objects, 0, 0, true, "living");
    room.balcony.door_id = names.get(family.room.balcony.door_id);
  } else {
    insert(state.objects, 0, 0, false, "living");
    insert(child.objects, childZone.x, childZone.z, true, "child");
  }
  const add = (id, asset_id, x, z, label, yaw = 0) => {
    requireValue(!ids.has(id), "New fixture ID already exists: " + id);
    ids.add(id);
    objects.push({ id, asset_id, kind: ctx.assets[asset_id].kind, x, z, yaw, ...label ? { label } : {} });
  };
  add("child-footstool", "apartment-step-v1", childZone.x - 2.55, childZone.z - 0.95);
  add("child-nightstand", "whale-nightstand-v1", childZone.x + 0.7, childZone.z - 2.19);
  add("child-nightlight", "family-shelf-lamp-v1", 0, 0, "\u5E8A\u5934\u5C0F\u591C\u706F");
  objects.at(-1).on = { id: "child-nightstand", surface: "top", x: 0, z: 0, yaw: 0 };
  objects.at(-1).properties = { on: true, brightness: 0.36 };
  add("bedroom-bed", "apartment-bed-v1", parent.x + 0.72, parent.z - 0.92);
  add("bedroom-cabinet", "oak-sideboard-v1", parent.x - 1.47, parent.z - 1.66);
  add("bath-basin", "apartment-basin-v1", bath.minX + 0.34, bath.z - 0.78, void 0, Math.PI / 2);
  add("bath-shower", "apartment-shower-v1", bath.minX + 0.6, bath.z + 0.86, void 0, Math.PI / 2);
  add("bath-toilet", "apartment-toilet-v1", bath.x + 1.13, bath.z - 0.82, void 0, -Math.PI / 2);
  for (const pot of objects.filter((o) => o.asset_id === "home-rice-cooker-v1" && o.properties?.keep_full === void 0)) pot.properties = { ...pot.properties, keep_full: true, servings: 4 };
  state.objects = objects;
  state.room = room;
  state.preset_id = CONNECTED_HOME;
  Object.assign(state.character, start ?? state.character);
  if (fromChild) {
    state.character.x += childZone.x;
    state.character.z += childZone.z;
  }
  state.control_revisions = { ...state.control_revisions, position: state.revision + 1, camera: state.revision + 1 };
  state.camera = "home";
  validateLayout(state, ctx);
}

// house3d/server/transition.ts
function transition(input, command, ctx, { check_geometry = true, check_busy = true, navigation_start = null } = {}) {
  let state = clone(input);
  const op = command.tool, args = command.arguments === void 0 ? {} : command.arguments;
  requireValue(record(args), "arguments must be an object");
  const def = typeof op === "string" && Object.hasOwn(ctx.definitions, op) ? ctx.definitions[op] : void 0;
  requireValue(!!def, "Unknown or unavailable tool");
  const [, props, required] = def;
  requireValue(!extra(args, Object.keys(props)), "Unknown argument");
  requireValue(
    required.every((k) => k in args),
    "Required argument missing"
  );
  if (check_busy && busy(state) && [
    "apply_layout",
    "place_furniture",
    "update_furniture",
    "remove_furniture",
    "move_character",
    "set_activity",
    "apply_preset",
    "connect_rooms"
  ].includes(op))
    throw Error(
      "Finish the current object interaction with interact/leave before moving furniture or the character"
    );
  const mutate = (s, c, o = {}) => transition(s, c, ctx, o);
  if (op === "connect_rooms") {
    requireValue(typeof (args.dry_run ?? true) === "boolean" && args.dry_run !== null, "dry_run must be boolean");
    connectHome(state, ctx, navigation_start);
    mutate(state, { tool: "move_character", arguments: { x: state.character.x, z: state.character.z } }, { check_busy: false });
  } else if (op === "draw_crayon") {
    validateDrawing(args.title, args.marks);
    const sessionBook = busy(state) && state.interaction?.pose === "draw" ? state.interaction.related_id : null;
    const target = "target_id" in args ? args.target_id : sessionBook;
    const book = "target_id" in args || target != null ? state.objects.find((o) => o.id === target && drawable(o)) : state.objects.find(drawable);
    requireValue(!("target_id" in args) || book, "Target must be an open workbook or picture book");
    const previous = book ? book.artwork : state.last_drawing;
    if ("base_url" in args) requireValue(typeof args.base_url === "string" && previous?.url === args.base_url && (previous.target_id ?? null) === (book?.id ?? null), "base_url must match the current drawing on this page");
    state.last_drawing = { title: args.title.trim(), width: drawingWidth, height: drawingHeight, target_id: book?.id ?? null, url: `/api/drawings/${state.revision + 1}.png` };
    if (book) book.artwork = state.last_drawing;
  } else if (op === "set_wallpaper") {
    if (Array.isArray(args.wallpaper_id))
      throw Error("unhashable type: 'list'");
    requireValue(
      ["all", "back", "front", "left", "right"].includes(args.wall_id) && typeof args.wallpaper_id === "string" && Object.hasOwn(ctx.wallpapers, args.wallpaper_id),
      "Unknown wall or wallpaper; choose from get_catalog"
    );
    const room = { ...ROOM_DEFAULT, ...state.room }, papers = { ...ROOM_DEFAULT.wallpapers, ...room.wallpapers };
    for (const wall of args.wall_id === "all" ? Object.keys(papers) : [args.wall_id])
      papers[wall] = args.wallpaper_id;
    state.room = { ...room, wallpapers: papers };
  } else if (op === "update_room") {
    const resizing = Object.keys(args).some((k) => k in LIMITS || k === "balcony");
    if (resizing && state.room?.floorplan && check_geometry) throw Error("Connected room partitions cannot be resized while furnished");
    if (resizing && check_busy && busy(state))
      throw Error("Finish the interaction before resizing the room");
    requireValue(
      typeof (args.dry_run === void 0 ? false : args.dry_run) === "boolean",
      "dry_run must be boolean"
    );
    for (const [k, v] of Object.entries(args)) {
      if (k === "dry_run") continue;
      if (k === "balcony") {
        requireValue(v === null || record(v) && !extra(v, ["wall", "center", "width", "depth", "door_id"]) && ["wall", "center", "width", "depth", "door_id"].every((k2) => k2 in v), "Invalid balcony configuration");
        if (v) {
          requireValue(["left", "back"].includes(v.wall), "Balcony wall must be left or back");
          number(v.center, -6, 6);
          number(v.width, 3, 6);
          number(v.depth, 1.8, 3);
          requireValue(typeof v.door_id === "string" && length(v.door_id) > 0 && length(v.door_id) <= 64, "Invalid balcony door id");
        }
        continue;
      }
      if (k in LIMITS) {
        number(v, ...LIMITS[k], true);
        continue;
      }
      if (k === "style") {
        requireValue(
          ["classic", "urban"].includes(v),
          "Unknown room style"
        );
        continue;
      }
      requireValue(
        typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v),
        "Expected #RRGGBB room paint"
      );
    }
    const { dry_run, ...finish } = args;
    state.room = { ...ROOM_DEFAULT, ...state.room, ...finish };
    if (state.room.balcony === null) delete state.room.balcony;
    if (resizing) {
      const bounds = boundaries(state.room);
      for (const obj of state.objects) {
        if (ctx.assets[obj.asset_id || ""]?.placement !== "wall") continue;
        const [w, d] = footprint(obj, ctx);
        if (Math.abs(obj.yaw) < 1e-3) obj.z = -bounds.furniture_z + d / 2;
        else obj.x = -bounds.furniture_x + w / 2;
      }
      if (check_geometry) {
        validateLayout(state, ctx);
        mutate(
          state,
          {
            tool: "move_character",
            arguments: { x: state.character.x, z: state.character.z }
          },
          { check_busy: false }
        );
      }
    }
  } else if (op === "walk_to") {
    requireValue(!busy(state), "Finish the current action first");
    const objectTarget = "target_id" in args;
    requireValue(objectTarget ? !("x" in args || "z" in args) : "x" in args && "z" in args, "Use target_id OR x and z, not both");
    let planned = null;
    if (objectTarget) {
      requireValue(typeof args.target_id === "string" && args.target_id.length > 0, "Invalid target_id");
      requireValue(navigation_start, "A fresh visible standing body is required to plan an object destination");
      planned = planObjectDestination(state.objects, ctx.catalog, ctx.assets, state.room ?? {}, navigation_start, args.target_id);
      requireValue(planned.ok, planned.reason);
    }
    const b = boundaries(state.room), extent = spaceBounds(state.room), point = planned?.point ?? {
      x: number(args.x, state.room?.balcony || state.room?.floorplan ? extent.minX : -b.body_x, state.room?.balcony || state.room?.floorplan ? extent.maxX : b.body_x),
      z: number(args.z, state.room?.balcony || state.room?.floorplan ? extent.minZ : -b.body_z, state.room?.balcony || state.room?.floorplan ? extent.maxZ : b.body_z)
    };
    mutate(state, { tool: "move_character", arguments: point });
    state.interaction = {
      id: command.id || "walk-" + (state.revision + 1),
      target_id: objectTarget ? args.target_id : null,
      target: point,
      action: "walk_to",
      pose: "walk",
      phase: "requested",
      error: null,
      approach_index: null
    };
  } else if (op === "cancel_action") {
    const old = state.interaction || {};
    requireValue(
      busy(state) && old.id === args.job_id,
      "No matching active job"
    );
    state.interaction = {
      ...old,
      id: command.id || "cancel-" + (state.revision + 1),
      action: "leave",
      phase: "requested",
      from_active: ["active", "entering"].includes(old.phase),
      error: null
    };
  } else if (op === "interact") {
    const obj = state.objects.find((o) => o.id === args.target_id);
    requireValue(obj, "Target object not found");
    const action = args.action;
    requireValue(
      actionsFor(obj, ctx, state).some((a) => a.id === action && a.available),
      "Action unavailable for this object/state"
    );
    if (action === "serve_rice") {
      const pot = riceSource(obj, state);
      pot.properties = { ...pot.properties, servings: pot.properties?.keep_full ? 4 : (pot.properties?.servings ?? 4) - 1 };
      obj.properties = { ...obj.properties, filled: true };
    } else if (action === "air_quilt") {
      obj.properties = { ...obj.properties, quilt_from: airingBed(state, obj).id };
    } else if (action === "bring_in_quilt") {
      delete obj.properties.quilt_from;
    } else if (action === "eat_rice") {
      obj.properties = { ...obj.properties, filled: false };
    } else if (action === "refill_rice") {
      obj.properties = { ...obj.properties, servings: 4 };
    } else if (action === "tidy" || action === "unpack") {
      obj.properties = { ...obj.properties, packed: action === "tidy" };
    } else if (["turn_on", "turn_off"].includes(action)) {
      obj.properties ??= obj.kind === "tv" ? { on: true } : { on: true, brightness: 0.7 };
      obj.properties.on = action === "turn_on";
    } else if (["cover", "uncover"].includes(action)) {
      obj.properties ??= { covered: true };
      obj.properties.covered = action === "cover";
    } else {
      const old = state.interaction || {};
      state.interaction = {
        id: command.id || "interaction-" + (state.revision + 1),
        target_id: obj.id,
        action,
        pose: action === "leave" ? old.pose : action,
        related_id: action === "draw" ? drawingBook(obj, state).id : action === "read" ? readingDesk(obj, state).id : action === "leave" ? old.related_id ?? null : null,
        phase: "requested",
        approach_index: action === "leave" ? old.approach_index ?? null : null,
        from_active: action === "leave" && ["active", "entering"].includes(old.phase),
        error: null
      };
    }
  } else if (op === "update_object") {
    const obj = state.objects.find((o) => o.id === args.id);
    requireValue(obj, "Target object not found");
    if ("label" in args) {
      requireValue(
        typeof args.label === "string" && length(args.label) >= 1 && length(args.label) <= 40,
        "Label must be 1..40 characters"
      );
      obj.label = args.label;
    }
    if ("properties" in args) {
      const p = args.properties, allowed = obj.id === state.room?.balcony?.door_id ? ["open"] : obj.kind === "tv" ? ["on"] : obj.asset_id === "home-rice-cooker-v1" ? ["keep_full"] : obj.kind === "lamp" ? ["on", "brightness"] : ctx.assets[obj.asset_id || ""]?.interactions?.sleep ? ["covered"] : [];
      requireValue(
        record(p) && allowed.length && !extra(p, allowed),
        "Unsupported object properties"
      );
      if ("open" in p) {
        requireValue(typeof p.open === "boolean", "open must be boolean");
        requireValue(!check_busy || !busy(state), "Finish the current action before changing the balcony door");
      }
      if ("keep_full" in p) requireValue(typeof p.keep_full === "boolean", "keep_full must be boolean");
      if ("covered" in p)
        requireValue(typeof p.covered === "boolean", "covered must be boolean");
      if ("on" in p)
        requireValue(typeof p.on === "boolean", "on must be boolean");
      if ("brightness" in p) number(p.brightness, 0, 1);
      obj.properties = {
        ...obj.id === state.room?.balcony?.door_id ? { open: obj.properties?.open ?? true } : obj.properties ?? (obj.kind === "tv" ? { on: true } : obj.asset_id === "home-rice-cooker-v1" ? { servings: 4 } : obj.kind === "lamp" ? { on: true, brightness: 0.7 } : { covered: true }),
        ...p,
        ...p.keep_full === true ? { servings: 4 } : {}
      };
    }
    if (obj.id === state.room?.balcony?.door_id && check_geometry) validateLayout(state, ctx);
  } else if (op === "apply_layout") {
    requireValue(
      Array.isArray(args.objects) && args.objects.length <= (state.room?.floorplan ? 128 : 80),
      state.room?.floorplan ? "Expected at most 128 furniture items" : "Expected at most 80 furniture items"
    );
    let trial = { ...clone(state), objects: [] };
    for (const item of args.objects) {
      requireValue(record(item), "Invalid furniture item");
      trial = mutate(
        trial,
        { tool: "place_furniture", arguments: item },
        { check_geometry: false, check_busy: false }
      );
    }
    validateLayout(trial, ctx);
    state.objects = trial.objects;
  } else if (op === "set_camera") {
    requireValue(
      ["home", "album", "broadcast", "companion", "portrait", "front", "face", "side", "back", "top"].includes(
        args.preset
      ),
      "Unknown camera preset"
    );
    state.camera = args.preset;
  } else if (op === "set_light") {
    requireValue(
      ["day", "evening", "night"].includes(args.preset),
      "Unknown light preset"
    );
    state.light = args.preset;
  } else if (op === "set_note") {
    requireValue(
      typeof args.text === "string" && length(args.text) <= 240,
      "Note must be at most 240 characters"
    );
    state.note = args.text;
  } else if (["place_furniture", "update_furniture", "remove_furniture"].includes(op)) {
    const id = args.id;
    requireValue(
      typeof id === "string" && length(id) >= 1 && length(id) <= 64,
      "Invalid furniture id"
    );
    let obj = state.objects.find((o) => o.id === id);
    if (op === "place_furniture") {
      requireValue(!obj, "Furniture id already exists");
      requireValue(state.objects.length < (state.room?.floorplan ? 128 : 80), "Room item limit reached");
      requireValue(
        typeof args.kind === "string" && (Object.hasOwn(ctx.catalog, args.kind) || typeof args.asset_id === "string" && ctx.assets[args.asset_id]?.kind === args.kind),
        "Unknown furniture kind"
      );
      requireValue(
        "on" in args || "x" in args && "z" in args,
        "Floor placement requires x and z"
      );
      obj = { id, kind: args.kind, x: 0, z: 0, yaw: 0, color: "#c39a78" };
      state.objects.push(obj);
    } else requireValue(obj, "Furniture not found");
    if (op === "remove_furniture")
      state.objects = state.objects.filter((o) => o !== obj);
    else {
      if ("asset_id" in args) {
        requireValue(
          typeof args.asset_id === "string" && ctx.assets[args.asset_id]?.kind === obj.kind,
          "Unknown or mismatched asset"
        );
        obj.asset_id = args.asset_id;
        delete obj.color;
      }
      if ("color" in args && obj.asset_id && !ctx.assets[obj.asset_id].recolorable)
        throw Error(
          "Painted asset is not recolorable; choose another asset variant"
        );
      if ("on" in args) obj.on = parseSupport(args.on);
      else if (obj.on && ["x", "z", "yaw"].some((k) => k in args))
        throw Error("Move supported props with on local offsets");
      for (const k of ["x", "z", "yaw"])
        if (k in args)
          obj[k] = number(
            args[k],
            k === "yaw" ? -Math.PI * 2 : state.room?.balcony || state.room?.floorplan ? Math.min(-6, spaceBounds(state.room)[k === "x" ? "minX" : "minZ"]) : -6,
            k === "yaw" ? Math.PI * 2 : state.room?.balcony || state.room?.floorplan ? Math.max(6, spaceBounds(state.room)[k === "x" ? "maxX" : "maxZ"]) : 6
          );
      if ("color" in args) {
        requireValue(
          typeof args.color === "string" && /^#[0-9a-fA-F]{6}$/.test(args.color),
          "Expected #RRGGBB"
        );
        obj.color = args.color;
      }
    }
    if (op !== "remove_furniture" && ("label" in args || "properties" in args)) {
      const changes = Object.fromEntries(
        Object.entries(args).filter(
          ([k]) => ["id", "label", "properties"].includes(k)
        )
      );
      state.objects = mutate(state, {
        tool: "update_object",
        arguments: changes
      }, { check_geometry, check_busy }).objects;
    }
    if (check_geometry) validateLayout(state, ctx);
  } else if (op === "apply_preset") {
    requireValue(
      typeof (args.dry_run === void 0 ? true : args.dry_run) === "boolean",
      "dry_run must be boolean"
    );
    requireValue(
      typeof args.preset_id === "string" && Object.hasOwn(ctx.presets, args.preset_id),
      "Choose a preset_id from get_presets"
    );
    const preset = ctx.presets[args.preset_id], rev = state.revision;
    let trial = { ...clone(state), objects: [] };
    if (trial.room) {
      delete trial.room.floorplan;
      delete trial.room.child_finish;
    }
    trial = mutate(
      trial,
      {
        tool: "update_room",
        arguments: Object.fromEntries(
          Object.entries({ ...preset.room, ...state.room?.balcony && !preset.room.balcony ? { balcony: null } : {} }).filter(([k]) => k !== "wallpapers")
        )
      },
      { check_busy: false, check_geometry: false }
    );
    for (const [wall_id, wallpaper_id] of Object.entries(
      preset.room.wallpapers || {}
    ))
      trial = mutate(
        trial,
        { tool: "set_wallpaper", arguments: { wall_id, wallpaper_id } },
        { check_busy: false }
      );
    trial = mutate(
      trial,
      { tool: "apply_layout", arguments: { objects: preset.objects } },
      { check_busy: false }
    );
    trial = mutate(
      trial,
      { tool: "move_character", arguments: preset.spawn },
      { check_busy: false }
    );
    delete trial.interaction;
    Object.assign(trial, {
      revision: rev,
      camera: "home",
      light: "day",
      preset_id: args.preset_id
    });
    trial.control_revisions = {
      ...trial.control_revisions,
      ...Object.fromEntries(
        ["position", "activity", "camera", "light"].map((k) => [k, rev + 1])
      )
    };
    state = trial;
  } else if (op === "set_activity") {
    requireValue(
      ["idle", "walk", "sit"].includes(args.activity),
      "Only idle, walk and sit are currently available"
    );
    state.character.activity = args.activity;
  } else if (op === "move_character") {
    const b = boundaries(state.room), extent = spaceBounds(state.room), x = number(args.x, state.room?.balcony || state.room?.floorplan ? extent.minX : -b.body_x, state.room?.balcony || state.room?.floorplan ? extent.maxX : b.body_x), z = number(args.z, state.room?.balcony || state.room?.floorplan ? extent.minZ : -b.body_z, state.room?.balcony || state.room?.floorplan ? extent.maxZ : b.body_z);
    if (state.room?.balcony || state.room?.floorplan) requireValue(createSpace(state.room, state.objects).free({ x, z }), "Target is outside walkable space or blocked by wall/railing/closed door");
    for (const obj of state.objects) {
      if (obj.kind === "rug" || obj.on || obj.id === state.room?.balcony?.door_id) continue;
      const [w, d] = definition(obj, ctx).size, c = Math.cos(obj.yaw), s = Math.sin(obj.yaw), dx = x - obj.x, dz = z - obj.z, u = Math.abs(dx * c - dz * s), v = Math.abs(dx * s + dz * c);
      requireValue(
        Math.hypot(Math.max(0, u - w / 2), Math.max(0, v - d / 2)) >= 0.57,
        "Target is occupied"
      );
    }
    Object.assign(state.character, { x, z, activity: "idle" });
    if ("yaw" in args)
      state.character.yaw = number(args.yaw, -Math.PI * 2, Math.PI * 2);
  } else throw Error("Unknown or unavailable tool");
  const control = {
    set_camera: "camera",
    set_light: "light",
    set_note: "note",
    set_activity: "activity",
    move_character: "position"
  }[op];
  if (control) {
    state.control_revisions ??= {};
    state.control_revisions[control] = state.revision + 1;
  }
  state.revision++;
  return state;
}

// house3d/server/layout.ts
function geometryIssues(objects, ctx, room) {
  const boundsRoom = boundaries(room), issues = [], boxes = [];
  for (const obj of objects) {
    const def = definition(obj, ctx), [w, d] = footprint(obj, ctx), y = heightOf(obj, objects, ctx), h = def.height, bounds = {
      x: [obj.x - w / 2, obj.x + w / 2],
      z: [obj.z - d / 2, obj.z + d / 2],
      y: [y, y + h]
    }, overflow = Object.fromEntries(
      ["x", "z"].map((axis) => [
        axis,
        round(
          Math.max(
            0,
            -boundsRoom[axis === "x" ? "furniture_x" : "furniture_z"] - bounds[axis][0],
            bounds[axis][1] - boundsRoom[axis === "x" ? "furniture_x" : "furniture_z"]
          ),
          4
        )
      ])
    );
    if (!fitsFootprint(room, obj, w, d) || y < -1e-3 || y + h > boundsRoom.height)
      issues.push({
        code: "outside_room",
        ids: [obj.id],
        bounds,
        overflow_m: overflow,
        message: "\u5BB6\u5177\u8D85\u51FA\u5899\u9762\u6216\u5929\u82B1\u677F\u3002",
        suggestion: "\u5411\u5BA4\u5185\u79FB\u52A8\uFF0C\u6216\u4ECE\u76EE\u5F55\u9009\u62E9\u66F4\u5C0F\u7684\u6B3E\u5F0F\u3002"
      });
    if (def.placement === "wall") {
      if (!mountedInRoom(room, obj, w, d))
        issues.push({
          code: "wall_mount",
          ids: [obj.id],
          message: "\u6B64\u6302\u4EF6\u9700\u671D\u5185\u8D34\u5728\u540E\u5899\u6216\u5DE6\u5899\u3002",
          suggestion: "\u6309 get_catalog.room \u5F53\u524D\u5185\u8FB9\u754C\u8D34\u5899\uFF1B\u540E\u5899 yaw=0\uFF0C\u5DE6\u5899 yaw=\u03C0/2\u3002"
        });
    }
    if (!validHangingQuilt(room, objects, obj)) issues.push({ code: "quilt_outside", ids: [obj.id], message: "\u667E\u67B6\u4E0A\u7684\u88AB\u5B50\u9700\u8981\u5148\u6536\u56DE\u3002", suggestion: "\u5BF9\u667E\u67B6\u8C03\u7528 bring_in_quilt\uFF0C\u518D\u79FB\u52A8\u667E\u67B6\u6216\u79FB\u9664\u8FD9\u5F20\u5E8A\u3002" });
    if (!obj.on && obj.kind !== "rug" && blocksDoor(room, obj, w, d)) issues.push({ code: "door_blocked", ids: [obj.id], message: "\u5BB6\u5177\u5360\u7528\u4E86\u623F\u95E8\u901A\u9053\u3002", suggestion: "\u95E8\u4E24\u4FA7\u7559\u51FA\u901A\u884C\u7A7A\u95F4\u3002" });
    if (obj.kind === "rug") continue;
    const occupied = occupiedSections(obj, ctx, y, w, d);
    for (const [other, sections] of boxes) {
      const overlap = sectionOverlap(occupied, sections);
      if (!overlap || supportsPair(obj, other, objects)) continue;
      issues.push({
        code: "overlap",
        ids: [other.id, obj.id],
        overlap_m: { x: round(overlap.x, 4), z: round(overlap.z, 4) },
        message: "\u4E24\u4EF6\u5BB6\u5177\u7684\u4FDD\u5B88\u5305\u56F4\u76D2\u91CD\u53E0\u3002",
        suggestion: "\u62C9\u5F00\u95F4\u8DDD\u6216\u65CB\u8F6C\u540E\u91CD\u65B0 dry-run\uFF1B\u8FD9\u4E0D\u662F\u9010\u4E09\u89D2\u5F62\u78B0\u649E\u68C0\u6D4B\u3002"
      });
    }
    boxes.push([obj, occupied]);
  }
  return issues;
}
function navigationReport(objects, ctx, body, room) {
  const b = boundaries(room), solids = objects.filter((o) => o.kind !== "rug" && !o.on).map((obj) => ({
    obj,
    size: definition(obj, ctx).size,
    c: Math.cos(obj.yaw),
    s: Math.sin(obj.yaw)
  }));
  const space = room?.balcony || room?.floorplan ? createSpace(room, objects) : null, extent = spaceBounds(room);
  function free(p, radius = 0.57, ignore) {
    if (space ? !space.free(p, radius) : Math.abs(p.x) > b.furniture_x - 0.1 - radius || Math.abs(p.z) > b.furniture_z - 0.1 - radius)
      return false;
    return !solids.some(({ obj, size: [w, d], c, s }) => {
      if (obj.id === ignore || obj.id === room?.balcony?.door_id) return false;
      const dx = p.x - obj.x, dz = p.z - obj.z;
      return Math.hypot(
        Math.max(0, Math.abs(dx * c - dz * s) - w / 2),
        Math.max(0, Math.abs(dx * s + dz * c) - d / 2)
      ) < radius;
    });
  }
  function line(a, z, radius = 0.57, ignore) {
    const steps = Math.max(
      1,
      Math.ceil(Math.hypot(a.x - z.x, a.z - z.z) / 0.025)
    );
    for (let i = 0; i <= steps; i++)
      if (!free(
        {
          x: a.x + (z.x - a.x) * i / steps,
          z: a.z + (z.z - a.z) * i / steps
        },
        radius,
        ignore
      ))
        return false;
    return true;
  }
  const points = /* @__PURE__ */ new Map(), indices = /* @__PURE__ */ new Map();
  const x0 = space ? extent.minX : -b.body_x, z0 = space ? extent.minZ : -b.body_z, x1 = space ? extent.maxX : b.body_x, z1 = space ? extent.maxZ : b.body_z;
  for (let i = 0; i <= Math.floor((x1 - x0) * 10); i++)
    for (let j = 0; j <= Math.floor((z1 - z0) * 10); j++) {
      const p = { x: x0 + i * 0.1, z: z0 + j * 0.1 };
      if (free(p)) {
        points.set(`${i},${j}`, p);
        indices.set(`${i},${j}`, [i, j]);
      }
    }
  const reached = /* @__PURE__ */ new Set();
  if (free(body) && points.size) {
    for (const [key, p] of points)
      if (Math.hypot(p.x - body.x, p.z - body.z) < 0.2 && line(body, p))
        reached.add(key);
    const queue = [...reached];
    for (let n = 0; n < queue.length; n++) {
      const key = queue[n], [i, j] = indices.get(key);
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1]
      ]) {
        const next = `${i + dx},${j + dz}`;
        if (points.has(next) && !reached.has(next) && line(points.get(key), points.get(next))) {
          reached.add(next);
          queue.push(next);
        }
      }
    }
  }
  const interactions = [];
  for (const obj of objects)
    for (const [action, config] of Object.entries(
      ctx.assets[obj.asset_id || ""]?.interactions || {}
    )) {
      const root = worldPoint2(obj, config.root);
      const approaches = config.approaches.map(
        (local, index) => {
          const p = worldPoint2(obj, local), standing = free(p), entry = standing && line(p, root, 0.32, obj.id), reachable = entry && [...reached].some(
            (k) => Math.hypot(points.get(k).x - p.x, points.get(k).z - p.z) < 0.2 && line(points.get(k), p)
          );
          return {
            index,
            position: p,
            clear: standing,
            entry_clear: entry,
            reachable
          };
        }
      );
      interactions.push({
        id: obj.id,
        action,
        reachable: approaches.some((a) => a.reachable),
        approaches
      });
    }
  return {
    ...room?.balcony ? { balcony: { door: balconyDoor(room, objects), free_cells: [...points.values()].filter((p) => {
      const g = balconyGeometry(room);
      return p.x >= g.minX && p.x <= g.maxX && p.z >= g.minZ && p.z <= g.maxZ;
    }).length, reachable_cells: [...reached].filter((k) => {
      const p = points.get(k), g = balconyGeometry(room);
      return p.x >= g.minX && p.x <= g.maxX && p.z >= g.minZ && p.z <= g.maxZ;
    }).length } } : {},
    body_clear: free(body),
    free_cells: points.size,
    reachable_cells: reached.size,
    interactions,
    grid_step_m: 0.1,
    radius_m: 0.57,
    basis: "Approximate 2D catalog rectangles, same radii as viewer; not mesh/cloth collision or a guarantee of pose quality."
  };
}
function planLayout(state, args, ctx, mutate, snapshot = null, now = 0) {
  requireValue(
    record(args) && !extra(args, ["operations", "dry_run"]),
    "Unknown layout argument"
  );
  requireValue(
    typeof (args.dry_run === void 0 ? true : args.dry_run) === "boolean",
    "dry_run must be boolean"
  );
  requireValue(
    Array.isArray(args.operations) && args.operations.length >= 1 && args.operations.length <= 80,
    "Expected 1..80 layout operations"
  );
  let trial = clone(state);
  const errors = [], warnings = [];
  for (const [index, operation] of args.operations.entries())
    try {
      requireValue(
        record(operation) && ["add", "update", "remove"].includes(operation.op),
        "op must be add, update or remove"
      );
      const { op, ...item } = operation;
      if (op === "add") {
        requireValue(
          typeof item.asset_id === "string" && !!ctx.assets[item.asset_id],
          "Choose asset_id from get_catalog.assets"
        );
        requireValue(
          !("kind" in item),
          "kind is derived from the selected asset"
        );
        item.kind = ctx.assets[item.asset_id].kind;
      }
      trial = mutate(
        trial,
        {
          tool: {
            add: "place_furniture",
            update: "update_furniture",
            remove: "remove_furniture"
          }[op],
          arguments: item
        },
        { check_geometry: false, check_busy: false }
      );
    } catch (e) {
      errors.push({
        code: "invalid_operation",
        operation_index: index,
        message: e.message,
        suggestion: "\u6309\u5DE5\u5177\u5B9A\u4E49\u548C\u76EE\u5F55\u4FEE\u6B63\u8FD9\u6761\u64CD\u4F5C\uFF0C\u518D\u91CD\u8BD5\u6574\u6279\u3002"
      });
    }
  try {
    validateBalcony(trial, ctx);
  } catch (e) {
    errors.push({ code: "balcony_invalid", message: e.message });
  }
  errors.push(
    ...resolveSupports(trial.objects, ctx),
    ...geometryIssues(trial.objects, ctx, trial.room)
  );
  if (busy(state))
    errors.push({
      code: "interaction_busy",
      ids: [state.interaction?.target_id ?? null],
      message: "\u6B63\u5728\u4E0E\u7269\u54C1\u4E92\u52A8\uFF1B\u53EF\u4EE5\u9884\u6F14\uFF0C\u4F46\u73B0\u5728\u4E0D\u80FD\u632A\u52A8\u5BB6\u5177\u3002",
      suggestion: "\u7ED3\u675F\u5F53\u524D\u4E92\u52A8\u540E\u91CD\u65B0\u9884\u6F14\u5E76\u5E94\u7528\u3002"
    });
  const fresh = !!(snapshot?.visible && now - snapshot.received_at >= 0 && now - snapshot.received_at < 6), body = fresh ? snapshot.body : state.character;
  if (!fresh)
    warnings.push({
      code: "body_not_fresh",
      message: "\u6CA1\u6709\u65B0\u9C9C\u7684\u89D2\u8272\u4F4D\u7F6E\uFF0C\u6682\u6309\u6700\u540E\u4FDD\u5B58\u7684\u4F4D\u7F6E\u68C0\u67E5\u3002",
      suggestion: "\u6253\u5F00\u5C0F\u5BB6\u9875\u9762\uFF0C\u7B49\u5F85\u8EAB\u4F53\u53CD\u9988\u540E\u91CD\u65B0 dry-run\u3002"
    });
  else if (body.moving)
    errors.push({
      code: "body_moving",
      message: "\u89D2\u8272\u6B63\u5728\u8D70\u52A8\uFF1B\u9884\u6F14\u53EF\u7EE7\u7EED\uFF0C\u6B63\u5F0F\u5E94\u7528\u9700\u5148\u505C\u7A33\u3002",
      suggestion: "\u5148\u4F11\u606F\u4E00\u4E0B\uFF0C\u518D\u91CD\u65B0 dry-run\u3002"
    });
  const navigation = navigationReport(trial.objects, ctx, body, trial.room);
  if (!navigation.body_clear)
    errors.push({
      code: "body_blocked",
      message: "\u65B0\u5E03\u7F6E\u5360\u636E\u89D2\u8272\u811A\u4E0B\u4F4D\u7F6E\u6216\u6240\u9700\u7AD9\u7ACB\u7A7A\u95F4\u3002",
      suggestion: "\u5148\u8BA9\u5979\u8D70\u5230\u7A7A\u5730\uFF0C\u6216\u8C03\u6574\u5BB6\u5177\u4F4D\u7F6E\uFF1B\u4E0D\u4F1A\u81EA\u52A8\u77AC\u79FB\u89D2\u8272\u3002"
    });
  for (const interaction of navigation.interactions)
    if (!interaction.reachable)
      warnings.push({
        code: "interaction_unreachable",
        ids: [interaction.id],
        action: interaction.action,
        message: "\u5F53\u524D\u8D77\u70B9\u672A\u627E\u5230\u53EF\u8D70\u5230\u4E14\u53EF\u8FDB\u5165\u7684\u4E92\u52A8\u63A5\u8FD1\u70B9\u3002",
        suggestion: "\u7ED9\u5EA7\u4F4D\u6216\u5E8A\u8FB9\u7559\u51FA\u901A\u9053\uFF0C\u8C03\u6574\u671D\u5411\uFF1B\u5728\u5B9E\u9645\u9875\u9762\u518D\u6B21\u68C0\u67E5\u3002"
      });
  if (navigation.balcony && navigation.balcony.door?.open && !navigation.balcony.reachable_cells) warnings.push({ code: "balcony_unreachable", message: "\u5F53\u524D\u5E03\u7F6E\u672A\u627E\u5230\u901A\u5F80\u9633\u53F0\u7684\u901A\u8DEF\u3002", suggestion: "\u79FB\u5F00\u95E8\u53E3\u548C\u9633\u53F0\u901A\u9053\u4E0A\u7684\u7269\u54C1\u540E\u91CD\u65B0\u9884\u6F14\u3002" });
  const old = new Map(state.objects.map((o) => [o.id, o])), next = new Map(trial.objects.map((o) => [o.id, o])), changes = {
    added: [...next.keys()].filter((k) => !old.has(k)),
    removed: [...old.keys()].filter((k) => !next.has(k)),
    updated: [...next.keys()].filter(
      (k) => old.has(k) && !same(next.get(k), old.get(k))
    )
  };
  trial.revision = state.revision + 1;
  return {
    state: trial,
    report: {
      dry_run: args.dry_run ?? true,
      base_revision: state.revision,
      can_apply: !errors.length,
      changes,
      errors,
      warnings,
      objects: trial.objects,
      navigation,
      body_source: fresh ? "fresh_viewer" : "persisted_state",
      collision_basis: "Conservative rotated AABB with height ranges; rugs excluded."
    }
  };
}

// house3d/server/store.ts
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

// house3d/shared/rug.mjs
function rugBelow(x, z, objects, assets) {
  let highest = null, best = -Infinity;
  for (const rug of objects) {
    if (rug.kind !== "rug") continue;
    const def = assets[rug.asset_id] || { size: [1.8, 1.3], height: 0.018 }, dx = x - rug.x, dz = z - rug.z, c = Math.cos(rug.yaw), s = Math.sin(rug.yaw);
    const u = (dx * c - dz * s) / (def.size[0] / 2), v = (dx * s + dz * c) / (def.size[1] / 2);
    if ((def.shape === "ellipse" ? u * u + v * v < 1 : Math.abs(u) < 1 && Math.abs(v) < 1) && def.height > best) {
      highest = rug;
      best = def.height;
    }
  }
  return highest;
}

// house3d/server/observation.ts
function occludes(a, b, obj, def, baseY = def.elevation || 0) {
  if (obj.kind === "rug") return false;
  const c = Math.cos(obj.yaw), s = Math.sin(obj.yaw), [w, d] = def.size;
  let lo = 0, hi = 1;
  const points = [a, b].map((p) => {
    const dx = p.x - obj.x, dz = p.z - obj.z;
    return [dx * c - dz * s, dx * s + dz * c];
  });
  for (const [i, extent] of [
    [0, w / 2],
    [1, d / 2]
  ]) {
    const origin = points[0][i], delta = points[1][i] - origin;
    if (Math.abs(delta) < 1e-9) {
      if (Math.abs(origin) > extent) return false;
    } else {
      const t = [(-extent - origin) / delta, (extent - origin) / delta].sort(
        (a2, b2) => a2 - b2
      );
      lo = Math.max(lo, t[0]);
      hi = Math.min(hi, t[1]);
      if (lo > hi) return false;
    }
  }
  if (hi <= 0 || lo >= 0.99) return false;
  const height = a.y + (b.y - a.y) * Math.max(0, lo);
  return baseY <= height && height <= def.height + baseY;
}
function observe(state, ctx, snapshot, now, events) {
  const age = snapshot ? Math.max(0, now - snapshot.received_at) : null, fresh = age !== null && age < 6 && !!snapshot?.visible, body = snapshot?.body ?? null;
  const result = {
    revision: state.revision,
    source: "character perspective, not spectator camera",
    fresh,
    age_seconds: age === null ? null : round(age, 2),
    body_job_id: snapshot?.job_id ?? null,
    execution: {
      paused: snapshot ? snapshot.paused ?? false : null,
      requires_visible_viewer: true
    },
    job: state.interaction ?? null,
    events,
    cursor: events.length ? events.at(-1).seq : null,
    room: { ...ROOM_DEFAULT, ...state.room },
    ...state.room?.balcony ? { area: body ? regionAt(state.room, body) : null } : {},
    limitations: [
      "Visibility uses approximate furniture bounds, not a pixel-perfect image or physical sensation sensor.",
      "No hunger, tiredness or emotions are inferred."
    ]
  };
  if (!fresh)
    return {
      ...result,
      summary: "\u8FD8\u6CA1\u6709\u65B0\u9C9C\u7684\u8EAB\u4F53\u89C6\u89D2\u53CD\u9988\uFF1B\u9875\u9762\u672A\u6253\u5F00\u6216\u6682\u65F6\u65AD\u5F00\u3002\u52A8\u4F5C\u662F\u5426\u5B8C\u6210\u8BF7\u770B job\uFF0C\u4E0D\u80FD\u628A\u5DF2\u53D7\u7406\u5F53\u5B8C\u6210\u3002",
      body,
      sight: { status: "unavailable", objects: [] },
      touch: []
    };
  const job = state.interaction || {}, pose = body.pose, support = state.objects.find((o) => o.id === job.target_id), active = job.phase === "active" && snapshot.job_id === job.id, eyesClosed = pose === "sleep", eye = {
    ...body,
    y: body.y + (eyesClosed ? 0.22 : pose === "play" ? 0.57 : ["sit", "read", "draw"].includes(pose) ? 0.78 : 0.9)
  }, visible = [];
  for (const obj of objectList(state, ctx).objects) {
    const def = definition(obj, ctx) || {}, dx = obj.x - body.x, dz = obj.z - body.z, distance = Math.hypot(dx, dz), angle = Math.atan2(
      Math.sin(Math.atan2(dx, dz) - body.yaw),
      Math.cos(Math.atan2(dx, dz) - body.yaw)
    );
    const direction = Math.abs(angle) < Math.PI / 6 ? "\u524D\u9762" : Math.abs(angle) > Math.PI * 5 / 6 ? "\u540E\u9762" : angle < 0 ? "\u5DE6\u8FB9" : "\u53F3\u8FB9";
    const item = {
      id: obj.id,
      label: obj.label,
      category: obj.category,
      ...state.room?.balcony ? { area: obj.area } : {},
      distance_m: round(distance, 2),
      direction,
      actions: obj.actions,
      support: obj.support
    };
    const point = {
      x: obj.x,
      z: obj.z,
      y: Math.min(
        1.25,
        (def.height ?? 0.5) * 0.7 + heightOf(obj, state.objects, ctx)
      )
    };
    if (!eyesClosed && distance < 5.5 && !(state.room?.balcony && wallBlocksSight(state.room, state.objects, eye, point, ctx.assets)) && Math.abs(angle) < 70 * Math.PI / 180 && !state.objects.some(
      (o) => o.id !== obj.id && o.id !== state.room?.balcony?.door_id && occludes(
        eye,
        point,
        o,
        definition(o, ctx),
        heightOf(o, state.objects, ctx)
      )
    ))
      visible.push(item);
  }
  const floorPlay = pose === "play" && support && ctx.assets[support.asset_id || ""]?.assembly_guide;
  const seat = floorPlay ? rugBelow(body.x, body.z, state.objects, ctx.assets) : support;
  const playSurface = floorPlay ? seat ? "\u5730\u6BEF" : "\u5730\u677F" : "\u8F6F\u57AB";
  const touch = active && seat ? [
    {
      object_id: seat.id,
      kind: pose === "sleep" ? "lying_support" : "seated_support",
      description: pose === "sleep" ? "\u8EAB\u4F53\u8EBA\u5728\u5E8A\u9762\u4E0A" : pose === "play" ? "\u76D8\u817F\u5750\u5728" + playSurface + "\u4E0A" : "\u5750\u5728\u5EA7\u9762\u4E0A",
      basis: "confirmed active contact pose"
    }
  ] : [];
  const balcony = balconyGeometry(state.room);
  const zone = zoneAt(apartment(state.room), body);
  const walls = (balcony && regionAt(state.room, body) === "balcony" ? [{ id: "balcony-railing", label: "\u9633\u53F0\u62A4\u680F", axis: balcony.wall === "left" ? "x" : "z", position: balcony.wall === "left" ? balcony.minX : balcony.minZ }] : zone ? wallsFor(zone).map((w) => ({ ...w, position: w.position + zone[w.axis] })) : wallsFor(state.room)).map((w) => ({
    id: w.id,
    label: w.label,
    wallpaper_id: (zone?.id === "child" ? state.room?.child_finish?.wallpapers : !zone || zone.id === "living" ? state.room?.wallpapers : null)?.[w.id] ?? "plain",
    distance_m: round(Math.abs(body[w.axis] - w.position), 2)
  })).sort((a, b) => a.distance_m - b.distance_m);
  let status = eyesClosed ? "\u95ED\u7740\u773C\u775B\uFF0C\u8EBA\u5728\u5E8A\u4E0A\u3002" : pose === "draw" ? "\u5750\u5728\u6905\u5B50\u4E0A\uFF0C\u4F4E\u5934\u7528\u8721\u7B14\u753B\u753B\u3002" : pose === "play" ? "\u5750\u5728" + playSurface + "\u4E0A\uFF0C" + (support?.properties?.packed ? "\u73A9\u5177\u5DF2\u7ECF\u6536\u597D\u4E86\u3002" : "\u6446\u5F04\u62FC\u88C5\u673A\u5668\u4EBA\u3002") : pose === "read" ? "\u5750\u597D\uFF0C\u6B63\u5728\u770B\u4E66\u3002" : pose === "sit" ? "\u5750\u5728\u5EA7\u4F4D\u4E0A\u3002" : body.moving ? "\u6B63\u5728\u8D70\u52A8\u3002" : pose === "transition" ? "\u6B63\u5728\u8C03\u6574\u59FF\u52BF\u3002" : state.room?.balcony && regionAt(state.room, body) === "balcony" ? "\u7AD9\u5728\u9633\u53F0\u4E0A\u3002" : zone ? "\u7AD9\u5728" + zone.label + "\u91CC\u3002" : "\u7AD9\u5728\u623F\u95F4\u91CC\u3002";
  if (snapshot.paused) status = "\u52A8\u4F5C\u5DF2\u6682\u505C\u3002" + status;
  if (visible.length)
    status += "\u773C\u524D\u6709" + visible.slice(0, 4).map((o) => o.label).join("\u3001") + "\u3002";
  return {
    ...result,
    summary: status,
    body,
    sight: {
      status: eyesClosed ? "eyes_closed" : "open",
      fov_degrees: 140,
      objects: visible
    },
    nearby: visible.filter((o) => o.distance_m < 1.2).sort((a, b) => a.distance_m - b.distance_m),
    touch,
    hands: {
      holding: pose === "draw" && active ? "crayon" : pose === "read" && active ? "storybook" : pose === "play" && active && !support?.properties?.packed ? "toy_robot" : null,
      basis: pose === "draw" && active ? "active drawing prop" : pose === "read" && active ? "active reading prop" : pose === "play" && active && !support?.properties?.packed ? "active toy prop" : "no held prop"
    },
    walls,
    light: state.light
  };
}

// house3d/server/store.ts
var Store = class {
  db;
  constructor(path, initial) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(
      `PRAGMA busy_timeout=10000; CREATE TABLE IF NOT EXISTS home_events(seq INTEGER PRIMARY KEY AUTOINCREMENT,at REAL,kind TEXT,body TEXT); CREATE TABLE IF NOT EXISTS home_viewer(id INTEGER PRIMARY KEY,body TEXT); CREATE TABLE IF NOT EXISTS state(id INTEGER PRIMARY KEY,body TEXT); CREATE TABLE IF NOT EXISTS commands(id TEXT PRIMARY KEY,request TEXT,body TEXT); CREATE TABLE IF NOT EXISTS drawings(revision INTEGER PRIMARY KEY,png BLOB NOT NULL); CREATE TABLE IF NOT EXISTS shots(id TEXT PRIMARY KEY,status TEXT,png BLOB,created REAL);`
    );
    if (!this.db.prepare("PRAGMA table_info(shots)").all().some(
      (r) => r.name === "view"
    ))
      this.db.exec(
        "ALTER TABLE shots ADD COLUMN view TEXT NOT NULL DEFAULT 'spectator'"
      );
    this.db.prepare("INSERT OR IGNORE INTO state VALUES(1,?)").run(JSON.stringify(initial));
  }
  state() {
    return JSON.parse(
      this.db.prepare("SELECT body FROM state WHERE id=1").get().body
    );
  }
  save(state) {
    this.db.prepare("UPDATE state SET body=? WHERE id=1").run(JSON.stringify(state));
  }
  snapshot() {
    const r = this.db.prepare("SELECT body FROM home_viewer WHERE id=1").get();
    return r ? JSON.parse(r.body) : null;
  }
  transaction(fn) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const value = fn();
      this.db.exec("COMMIT");
      return value;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  event(now, kind, body) {
    this.db.prepare("INSERT INTO home_events(at,kind,body) VALUES(?,?,?)").run(now, kind, JSON.stringify(body));
    this.db.exec(
      "DELETE FROM home_events WHERE seq < (SELECT COALESCE(MAX(seq),0)-1000 FROM home_events)"
    );
  }
  viewerAllowed(session, now) {
    const s = this.snapshot();
    return !s || s.session_id === session && s.visible && now - s.received_at < 6;
  }
  heartbeat(body, state, now) {
    requireValue(
      record(body) && !extra(body, ["session_id", "visible", "body", "job_id", "paused"]),
      "Invalid viewer feedback"
    );
    requireValue(
      typeof body.session_id === "string" && length(body.session_id) >= 1 && length(body.session_id) <= 100,
      "Invalid viewer session"
    );
    if ("paused" in body)
      requireValue(typeof body.paused === "boolean", "paused must be boolean");
    requireValue(typeof body.visible === "boolean", "visible must be boolean");
    const a = body.body;
    requireValue(
      record(a) && !extra(a, ["x", "y", "z", "yaw", "pose", "moving"]) && Object.keys(a).length === 6,
      "Invalid body feedback"
    );
    const size = dimensions(state.room), extent = spaceBounds(state.room), limits = {
      x: state.room?.balcony || state.room?.floorplan ? Math.max(Math.abs(extent.minX), Math.abs(extent.maxX)) + 0.2 : size.width / 2 + 0.2,
      z: state.room?.balcony || state.room?.floorplan ? Math.max(Math.abs(extent.minZ), Math.abs(extent.maxZ)) + 0.2 : size.depth / 2 + 0.2,
      y: size.height + 0.2,
      yaw: 10
    };
    for (const k of ["x", "y", "z", "yaw"])
      requireValue(
        typeof a[k] === "number" && Number.isFinite(a[k]) && Math.abs(a[k]) <= limits[k],
        "Invalid body coordinate"
      );
    if (state.room?.balcony || state.room?.floorplan) requireValue(regionAt(state.room, a) !== null, "Body is outside interior/balcony");
    requireValue(
      ["stand", "sit", "sleep", "read", "play", "draw", "transition"].includes(a.pose) && typeof a.moving === "boolean",
      "Invalid body pose"
    );
    const previous = this.snapshot();
    if (previous && previous.session_id !== body.session_id && previous.visible && now - previous.received_at < 6)
      return {
        controller: false,
        owner_age_seconds: now - previous.received_at
      };
    requireValue(
      body.job_id == null || body.job_id === state.interaction?.id,
      "Stale job feedback"
    );
    this.db.prepare("INSERT OR REPLACE INTO home_viewer VALUES(1,?)").run(JSON.stringify({ ...body, received_at: now }));
    return { controller: true, received_at: now };
  }
  feedback(ctx, now, since) {
    const rows = this.db.prepare("SELECT * FROM home_events WHERE seq>? ORDER BY seq LIMIT 100").all(since), events = rows.map((r) => ({
      seq: r.seq,
      at: r.at,
      kind: r.kind,
      ...JSON.parse(r.body)
    }));
    for (const e of events) {
      if (e.kind === "action_progress") {
        const labels = {
          approaching: "\u6B63\u5728\u8D70\u8FC7\u53BB\u3002",
          entering: "\u6B63\u5728\u6162\u6162\u5750\u7A33\u3001\u8C03\u6574\u59FF\u52BF\u3002",
          active: e.action === "sleep" ? "\u5DF2\u7ECF\u8EBA\u597D\u3002" : e.action === "draw" ? "\u5750\u5728\u6905\u5B50\u4E0A\uFF0C\u62FF\u8721\u7B14\u753B\u753B\u3002" : e.action === "play" ? "\u5DF2\u7ECF\u5750\u597D\uFF0C\u73A9\u5177\u5C31\u5728\u624B\u8FB9\u3002" : e.action === "read" ? "\u5750\u597D\uFF0C\u5F00\u59CB\u770B\u4E66\u3002" : "\u5DF2\u7ECF\u5750\u7A33\u3002",
          leaving: e.pose === "read" ? "\u6B63\u5728\u653E\u4E0B\u4E66\u3001\u8D77\u8EAB\u3002" : "\u6B63\u5728\u8D77\u8EAB\u3002",
          completed: e.action === "walk_to" ? "\u5DF2\u7ECF\u5230\u8FBE\u3002" : "\u5DF2\u7ECF\u7AD9\u7A33\u3002",
          failed: "\u8D70\u4E0D\u8FC7\u53BB\u6216\u52A8\u4F5C\u672A\u80FD\u5B8C\u6210\uFF1B\u8BF7\u67E5\u770B\u539F\u56E0\u3002"
        };
        e.message = labels[e.phase] || "\u52A8\u4F5C\u72B6\u6001\u5DF2\u66F4\u65B0\u3002";
      } else if (e.kind === "command_accepted")
        e.message = e.status === "requested" ? "\u6536\u5230\u8BF7\u6C42\uFF0C\u7B49\u5F85\u8EAB\u4F53\u6267\u884C\u3002" : "\u5BB6\u91CC\u7684\u8BBE\u7F6E\u5DF2\u66F4\u65B0\u3002";
      else e.message = "\u8FD9\u6B21\u64CD\u4F5C\u6CA1\u80FD\u6267\u884C\uFF1B\u8BF7\u67E5\u770B\u539F\u56E0\u3002";
    }
    const first = this.db.prepare("SELECT MIN(seq) AS seq FROM home_events").get().seq;
    return {
      ...observe(this.state(), ctx, this.snapshot(), now, events),
      cursor: events.length ? events.at(-1).seq : since,
      more: rows.length === 100,
      history_truncated: !!(first && since < first - 1)
    };
  }
  close() {
    this.db.close();
  }
};

// house3d/server/app.ts
var json = (body, status = 200) => ({ body, status });
function loadContext(root) {
  const read = (name) => JSON.parse(readFileSync(resolve(root, name), "utf8"));
  const data = read("server-data.json");
  return {
    ...data,
    assets: read("furniture-assets.json"),
    wallpapers: read("wallpapers.json"),
    presets: read("room-presets.json")
  };
}
var HouseApp = class {
  constructor(ctx, dbPath, root, webRoot, now = () => Date.now() / 1e3, uuid = () => randomUUID().replaceAll("-", "")) {
    this.ctx = ctx;
    this.root = root;
    this.webRoot = webRoot;
    this.now = now;
    this.uuid = uuid;
    this.store = new Store(dbPath, ctx.defaultState);
  }
  store;
  handle(input) {
    const { method, headers } = input, host = headers.host || "localhost";
    if (!["127.0.0.1", "localhost"].includes(host.split(":")[0]))
      return json({ error: "Local host only" }, 403);
    if (method === "POST" && headers.origin && headers.origin !== `http://${host}`)
      return json({ error: "Cross-origin writes are not allowed" }, 403);
    const url = new URL(input.url, "http://localhost"), path = url.pathname, ctx = this.ctx, store = this.store, now = this.now(), get = method === "GET" || method === "HEAD", body = input.body;
    const drawing = /^\/api\/drawings\/(\d+)\.png$/.exec(path);
    if (get && drawing) {
      const row = store.db.prepare("SELECT png FROM drawings WHERE revision=?").get(drawing[1]);
      return row ? { status: 200, type: "image/png", bytes: Buffer.from(row.png) } : json({ error: "Drawing not found" }, 404);
    }
    if (get && path === "/api/state") return json(store.state());
    if (get && path === "/api/catalog") {
      const current = store.state();
      const size = dimensions(current.room), limits = boundaries(size);
      return json({
        furniture: ctx.catalog,
        assets: ctx.assets,
        categories: Object.fromEntries(
          Object.entries(categoriesFor(ctx)).map(([key, label]) => [
            key,
            {
              label,
              asset_ids: Object.entries(ctx.assets).filter(
                ([id, a]) => (id === "home-rice-bowl-v1" ? "tables" : CATEGORIES[a.kind || ""] || "decoration") === key
              ).map(([id]) => id)
            }
          ])
        ),
        wallpapers: ctx.wallpapers,
        room: {
          ...current.room?.balcony ? { balcony: { ...current.room.balcony, bounds: { min_x: balconyGeometry(current.room).minX, max_x: balconyGeometry(current.room).maxX, min_z: balconyGeometry(current.room).minZ, max_z: balconyGeometry(current.room).maxZ }, door: balconyDoor(current.room, current.objects), coordinate_basis: "Shared world X/Z in metres; door opening connects interior and balcony" } } : {},
          ...current.room?.floorplan ? { floorplan: current.room.floorplan, ...apartment(current.room), world_bounds: spaceBounds(current.room), bounds_note: "size and symmetric bounds describe the living room; zones and doors are world metres" } : {},
          styles: ["classic", "urban"],
          size: [size.width, size.depth],
          height: size.height,
          dimension_limits: LIMITS,
          furniture_bounds: [limits.furniture_x, limits.furniture_z],
          character_radius: 0.57,
          character_bounds: [limits.body_x, limits.body_z],
          walls: wallsFor(size)
        },
        activities: ["idle", "walk", "sit"],
        outfits: ["reference"],
        hairstyles: ["reference"],
        viewer: {
          path: "/wander.html",
          activities: ["idle", "walk"],
          sit: true,
          object_actions: ["sit", "sleep", "read", ...Object.values(ctx.assets).some((a) => a.interactions?.play) ? ["play", "tidy", "unpack", "draw", ...ctx.assets["home-rice-bowl-v1"] ? ["serve_rice", ...ctx.definitions.connect_rooms ? ["eat_rice", "refill_rice", "air_quilt", "bring_in_quilt", "turn_on", "turn_off"] : []] : []] : [], "leave"],
          interaction_requires_target: true,
          adapter: "Local HTTP only; no DSH connection"
        },
        limitations: [
          "No independent wardrobe yet",
          "move_character relocates rather than animating a route",
          "Screenshot requires an open visible house page"
        ]
      });
    }
    if (get && path === "/api/presets")
      return json({
        presets: Object.fromEntries(
          Object.entries(ctx.presets).map(([k, v]) => [
            k,
            {
              label: v.label,
              room: v.room,
              objects: v.objects.length,
              spawn: v.spawn
            }
          ])
        ),
        applying: "Explicit template reset: dry-run first; places the character at the declared spawn, preserves appearance"
      });
    if (get && path === "/api/interactions")
      return json(interactionList(store.state(), ctx, store.snapshot(), now, url.searchParams.get("category"), url.searchParams.get("capability")));
    if (get && path === "/api/objects")
      return json(
        objectList(
          store.state(),
          ctx,
          url.searchParams.get("category"),
          url.searchParams.get("capability")
        )
      );
    if (get && path === "/api/observe") {
      const raw = url.searchParams.get("since") ?? "0";
      if (!/^\s*\+?\d+\s*$/.test(raw) || !Number.isSafeInteger(Number(raw)))
        return json({ error: "Invalid event cursor" }, 400);
      return json(store.feedback(ctx, now, Number(raw)));
    }
    if (method === "POST" && path === "/api/viewer")
      return store.transaction(() => {
        try {
          return json(store.heartbeat(body, store.state(), now));
        } catch (e) {
          return json({ error: e.message }, 400);
        }
      });
    const progress = /^\/api\/interactions\/([^/]+)\/progress$/.exec(path);
    if (method === "POST" && progress)
      return this.progress(decodeURIComponent(progress[1]), body, now);
    if (get && path === "/api/tool-schemas")
      return json(
        Object.entries(ctx.definitions).map(
          ([name, [description, properties, required]]) => ({
            type: "function",
            function: {
              name,
              description,
              parameters: {
                type: "object",
                properties,
                required,
                additionalProperties: false
              }
            }
          })
        )
      );
    if (get && path === "/api/tools")
      return json({
        tools: {
          observe_home: { method: "GET", path: "/api/observe" },
          ...ctx.definitions.draw_crayon ? { draw_crayon: ["title", "marks", "target_id?", "base_url?"] } : {},
          walk_to: ["x and z, or target_id"],
          cancel_action: ["job_id"],
          update_room: [
            "wall_color",
            "trim_color",
            "style",
            "width",
            "depth",
            "height",
            "dry_run",
            "balcony"
          ],
          get_presets: { method: "GET", path: "/api/presets" },
          apply_preset: ["preset_id", "dry_run"],
          ...ctx.definitions.connect_rooms ? { connect_rooms: ["dry_run"], get_outdoors: { method: "GET", path: "/api/outdoors" } } : {},
          set_wallpaper: ["wall_id", "wallpaper_id"],
          list_objects: { method: "GET", path: "/api/objects" },
          list_interactions: { method: "GET", path: "/api/interactions" },
          interact: ["target_id", "action"],
          update_object: ["id", "label", "properties"],
          get_state: { method: "GET", path: "/api/state" },
          get_catalog: { method: "GET", path: "/api/catalog" },
          update_layout: ["operations", "dry_run"],
          place_furniture: [
            "id",
            "kind",
            "asset_id",
            "x",
            "z",
            "yaw",
            "color",
            "on"
          ],
          update_furniture: ["id", "asset_id", "x", "z", "yaw", "color", "on"],
          apply_layout: ["objects"],
          remove_furniture: ["id"],
          move_character: ["x", "z", "yaw"],
          set_activity: ["activity"],
          set_camera: ["preset"],
          set_light: ["preset"],
          set_note: ["text"],
          screenshot: { method: "POST", path: "/api/screenshots" }
        },
        command_endpoint: "/api/commands",
        command_shape: {
          id: "unique idempotency key",
          expected_revision: 0,
          tool: "set_light",
          arguments: { preset: "day" }
        }
      });
    if (method === "POST" && path === "/api/commands")
      return this.command(body, now);
    if (method === "POST" && path === "/api/screenshots") {
      const args = body ?? {};
      if (!record(args) || extra(args, ["view"]) || !["spectator", "character"].includes(args.view ?? "spectator"))
        return json({ error: "Unknown screenshot view" }, 400);
      const id = this.uuid();
      store.db.prepare(
        "INSERT INTO shots(id,status,png,created,view) VALUES(?,?,NULL,?,?)"
      ).run(id, "pending", now, args.view ?? "spectator");
      return json(
        { id, status: "pending", url: `/api/screenshots/${id}` },
        202
      );
    }
    if (get && path === "/api/screenshots/pending") {
      if (url.searchParams.get("viewer") !== "life-v2")
        return json({ id: null, viewer_required: "life-v2" });
      store.db.prepare(
        "UPDATE shots SET status='expired' WHERE status='pending' AND created<?"
      ).run(now - 30);
      const r = store.db.prepare(
        "SELECT id,view FROM shots WHERE status='pending' ORDER BY created LIMIT 1"
      ).get();
      return json({ id: r?.id ?? null, view: r?.view ?? null });
    }
    const shot = /^\/api\/screenshots\/([^/]+)$/.exec(path);
    if (shot) {
      if (method === "POST") {
        if (headers["x-house-viewer"] !== "life-v2")
          return json({ error: "Reload the current Canvas viewer" }, 409);
        const bytes = input.bytes || Buffer.alloc(0);
        if (headers["content-type"]?.split(";")[0] !== "image/png" || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
          return json({ error: "Expected PNG" }, 400);
        const n = store.db.prepare(
          "UPDATE shots SET png=?,status='ready' WHERE id=? AND status='pending'"
        ).run(bytes, shot[1]);
        return n.changes ? json({ ok: true }) : json({ error: "Request unavailable" }, 409);
      }
      if (get) {
        const r = store.db.prepare("SELECT * FROM shots WHERE id=?").get(shot[1]);
        if (!r) return json({ error: "Not found" }, 404);
        if (r.status !== "ready")
          return json({ status: r.status }, r.status === "pending" ? 202 : 410);
        return { status: 200, bytes: Buffer.from(r.png), type: "image/png" };
      }
    }
    if (path.startsWith("/api/")) return json({ error: "Not found" }, 404);
    if (get) {
      let name;
      try {
        name = decodeURIComponent(
          path.startsWith("/models/") ? path.slice(8) : path === "/" ? "wander.html" : path.slice(1)
        );
      } catch {
        return json({ error: "Invalid path" }, 400);
      }
      const base = path.startsWith("/models/") ? resolve(this.root, "assets") : resolve(this.webRoot), file = resolve(base, name);
      if (file !== base && !file.startsWith(base + sep) || name.includes("\0"))
        return json({ error: "Not found" }, 404);
      if (!existsSync(file) || !statSync(file).isFile() || !realpathSync(file).startsWith(realpathSync(base) + sep))
        return json({ error: "Not found" }, 404);
      return {
        status: 200,
        bytes: readFileSync(file),
        type: {
          ".html": "text/html; charset=utf-8",
          ".js": "text/javascript; charset=utf-8",
          ".css": "text/css; charset=utf-8",
          ".json": "application/json",
          ".glb": "model/gltf-binary",
          ".png": "image/png",
          ".svg": "image/svg+xml",
          ".webp": "image/webp",
          ".jpg": "image/jpeg"
        }[extname(file)] || "application/octet-stream"
      };
    }
    return json({ error: "Method not allowed" }, 405);
  }
  command(value, now) {
    if (!record(value) || typeof value.id !== "string" || [...value.id].length < 1 || [...value.id].length > 100)
      return json({ error: "Unique command id is required" }, 400);
    const body = value, store = this.store, ctx = this.ctx;
    return store.transaction(() => {
      const cached = store.db.prepare("SELECT * FROM commands WHERE id=?").get(body.id);
      if (cached) {
        if (!same(JSON.parse(cached.request), body))
          return json(
            { error: "Command id reused with different payload" },
            409
          );
        return json(JSON.parse(cached.body));
      }
      const old = store.state();
      if (body.expected_revision !== old.revision)
        return json(
          { error: "Revision conflict", revision: old.revision },
          409
        );
      let next, report;
      try {
        if (body.tool === "update_layout") {
          const planned = planLayout(
            old,
            body.arguments === void 0 ? {} : body.arguments,
            ctx,
            (s, c, o) => transition(s, c, ctx, o),
            store.snapshot(),
            now
          );
          next = planned.state;
          report = planned.report;
          if (report.dry_run)
            return json({ ok: true, applied: false, layout: report });
          if (!report.can_apply)
            return json(
              {
                ok: false,
                applied: false,
                error: "Layout blocked; inspect layout.errors",
                layout: report
              },
              422
            );
        } else {
          const snapshot = store.snapshot();
          const navigation_start = snapshot?.visible && !snapshot.paused && now - snapshot.received_at < 6 && snapshot.body.pose === "stand" ? snapshot.body : null;
          if (body.tool === "connect_rooms" && snapshot?.visible && now - snapshot.received_at < 6) requireValue(!snapshot.body.moving && snapshot.body.pose === "stand", "Stand still before connecting rooms");
          next = transition(old, body, ctx, { navigation_start });
          const changesDoor = body.tool === "update_object" && body.arguments?.id === old.room?.balcony?.door_id && "open" in (body.arguments?.properties ?? {});
          if ((old.room?.balcony || next.room?.balcony) && (changesDoor || ["place_furniture", "update_furniture", "remove_furniture", "apply_layout"].includes(body.tool))) {
            const snap = store.snapshot();
            if (snap?.visible && now - snap.received_at < 6) {
              requireValue(!snap.body.moving, "Stop walking before changing balcony layout/door");
              transition(next, { tool: "move_character", arguments: { x: snap.body.x, z: snap.body.z } }, ctx, { check_busy: false });
            }
          }
          if (["apply_preset", "update_room", "connect_rooms"].includes(body.tool)) {
            if (body.tool === "update_room" && Object.keys(body.arguments || {}).some((k) => k in LIMITS || k === "balcony")) {
              const snapshot2 = store.snapshot();
              if (snapshot2?.visible && now - snapshot2.received_at < 6) {
                requireValue(
                  !snapshot2.body.moving,
                  "Stop walking before resizing the room"
                );
                transition(
                  next,
                  {
                    tool: "move_character",
                    arguments: { x: snapshot2.body.x, z: snapshot2.body.z }
                  },
                  ctx,
                  { check_busy: false }
                );
              }
            }
            if (body.arguments?.dry_run ?? body.tool !== "update_room")
              return json({ ok: true, applied: false, preview: next });
          }
        }
      } catch (e) {
        const args = body.arguments, defaultPreview = ["update_layout", "apply_preset", "connect_rooms"].includes(
          body.tool
        ), preview = ["update_layout", "apply_preset", "connect_rooms", "update_room"].includes(
          body.tool
        ) && (record(args) ? (args.dry_run === void 0 ? defaultPreview : args.dry_run) !== false : defaultPreview);
        if (!preview)
          store.event(now, "action_rejected", {
            command_id: body.id,
            action: body.tool ?? null,
            error: e.message
          });
        return json({ error: e.message }, 400);
      }
      store.event(now, "command_accepted", {
        command_id: body.id,
        action: body.tool,
        arguments: body.arguments ?? {},
        status: next.interaction?.id === body.id ? "requested" : "applied"
      });
      const result = { ok: true, state: next };
      if (body.tool === "draw_crayon") {
        const base = body.arguments.base_url;
        const row = base ? store.db.prepare("SELECT png FROM drawings WHERE revision=?").get(/^\/api\/drawings\/(\d+)\.png$/.exec(base)?.[1] ?? "") : void 0;
        if (base && !row) throw Error("Base drawing missing from store");
        store.db.prepare("INSERT INTO drawings(revision,png) VALUES(?,?)").run(next.revision, crayonPng(body.arguments.marks, row && Buffer.from(row.png)));
        result.artwork = next.last_drawing;
      }
      if (["apply_preset", "update_room", "connect_rooms"].includes(body.tool))
        result.applied = true;
      if (report) Object.assign(result, { applied: true, layout: report });
      store.save(next);
      store.db.prepare("INSERT INTO commands VALUES(?,?,?)").run(body.id, stable(body), JSON.stringify(result));
      return json(result);
    });
  }
  progress(id, value, now) {
    if (!record(value) || extra(value, [
      "phase",
      "approach_index",
      "error",
      "viewer_session",
      "position"
    ]))
      return json({ error: "Invalid progress" }, 400);
    const body = value, store = this.store;
    return store.transaction(() => {
      const state = store.state(), job = state.interaction || {};
      if (job.id !== id || !BUSY_PHASES.has(job.phase))
        return json({ error: "Stale interaction" }, 409);
      if (!store.viewerAllowed(body.viewer_session, now))
        return json({ error: "Another viewer owns this action" }, 409);
      const phase = body.phase, old = job.phase;
      if (typeof phase !== "string")
        return json({ error: "Invalid phase" }, 400);
      const allowed = {
        requested: job.action === "leave" ? ["leaving", "completed", "failed"] : ["approaching", "failed"],
        approaching: job.pose === "walk" ? ["completed", "failed"] : ["entering", "failed"],
        entering: ["active", "failed"],
        active: [],
        leaving: ["completed", "failed"]
      };
      if (phase === old && (body.approach_index ?? job.approach_index) === job.approach_index)
        return json({ ok: true, interaction: job });
      if (!allowed[old].includes(phase))
        return json({ error: "Invalid phase transition" }, 400);
      let config, obj, index = null;
      if (job.pose !== "walk") {
        obj = state.objects.find((o) => o.id === job.target_id);
        config = this.ctx.assets[obj.asset_id].interactions[["read", "draw"].includes(job.pose) ? "sit" : job.pose];
        index = body.approach_index ?? job.approach_index;
        if (!Number.isInteger(index) || index === null || index < 0 || index >= config.approaches.length)
          return json({ error: "Invalid approach index" }, 400);
        if (job.approach_index != null && index !== job.approach_index)
          return json({ error: "Approach cannot change mid-interaction" }, 400);
      }
      if (phase === "failed" && (typeof body.error !== "string" || [...body.error].length < 1 || [...body.error].length > 200))
        return json({ error: "Failure reason required" }, 400);
      Object.assign(job, {
        phase,
        approach_index: index,
        error: phase === "failed" ? body.error : null
      });
      if (phase === "active") {
        const p = worldPoint2(obj, config.root);
        Object.assign(state.character, {
          x: p.x,
          z: p.z,
          yaw: p.yaw + (config.yaw || 0),
          activity: job.pose
        });
      }
      if (phase === "completed" && job.action === "leave")
        state.character.activity = "idle";
      if (phase === "completed" && job.action === "leave" && job.from_active && config) {
        const p = worldPoint2(obj, config.approaches[index]);
        Object.assign(state.character, {
          x: p.x,
          z: p.z,
          yaw: p.yaw,
          activity: "idle"
        });
      }
      if (phase === "completed" && job.action === "walk_to")
        Object.assign(state.character, { ...job.target, activity: "idle" });
      if ("position" in body) {
        if (phase !== "completed" || job.action !== "leave" || !record(body.position) || Object.keys(body.position).sort().join(",") !== "x,yaw,z")
          return json({ error: "Unexpected position feedback" }, 400);
        try {
          state.character = transition(
            state,
            { tool: "move_character", arguments: body.position },
            this.ctx
          ).character;
        } catch (e) {
          return json({ error: e.message }, 400);
        }
      }
      store.event(now, "action_progress", {
        job_id: id,
        action: job.action,
        pose: job.pose,
        target_id: job.target_id ?? null,
        phase,
        error: job.error ?? null
      });
      state.revision++;
      store.save(state);
      return json({ ok: true, interaction: job });
    });
  }
  close() {
    this.store.close();
  }
};
export {
  HouseApp,
  loadContext
};
