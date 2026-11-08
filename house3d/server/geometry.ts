import {validHangingQuilt} from '../shared/airing.mjs';
import {mountedInRoom,blocksDoor} from '../shared/apartment.mjs';
import {fitsFootprint,balconyGeometry,balconyLocal} from '../shared/space.mjs';
import {
  type Item,
  type Room,
  type Context,
  type Data,
  record,
  requireValue,
  length,
} from "./types.js";
export const DEFAULT_SIZE = { width: 6, depth: 5, height: 2.4 };
export const LIMITS: Record<string, [number, number]> = {
  width: [4, 12],
  depth: [4, 10],
  height: [2.4, 4],
};
export const ROOM_DEFAULT = {
  ...DEFAULT_SIZE,
  wall_color: "#f3eee5",
  trim_color: "#d9c4a3",
  wallpapers: Object.fromEntries(
    ["back", "front", "left", "right"].map((w) => [w, "plain"]),
  ),
};
export function dimensions(room: Room = {}) {
  return Object.fromEntries(
    Object.entries(DEFAULT_SIZE).map(([k, v]) => [k, room[k] ?? v]),
  ) as typeof DEFAULT_SIZE;
}
export function boundaries(room: Room = {}) {
  const d = dimensions(room);
  return {
    furniture_x: d.width / 2 - 0.05,
    furniture_z: d.depth / 2 - 0.05,
    body_x: d.width / 2 - 0.72,
    body_z: d.depth / 2 - 0.72,
    height: d.height,
  };
}
export function wallsFor(room: Room = {}) {
  const b = boundaries(room);
  return (
    [
      ["back", "z", -b.furniture_z, 0, "后墙", 1],
      ["front", "z", b.furniture_z, Math.PI, "前墙", -1],
      ["left", "x", -b.furniture_x, Math.PI / 2, "左墙", 1],
      ["right", "x", b.furniture_x, -Math.PI / 2, "右墙", -1],
    ] as const
  ).map(([id, axis, position, yaw, label, inward]) => ({
    id,
    name: id,
    [axis]: position,
    yaw,
    label,
    axis,
    position,
    inward,
  }));
}
export function definition(obj: Item, ctx: Context) {
  return obj.asset_id ? ctx.assets[obj.asset_id] : ctx.catalog[obj.kind];
}
export function heightOf(
  obj: Item,
  objects: Item[],
  ctx: Context,
  seen = new Set<string>(),
): number {
  if (seen.has(obj.id)) return 0;
  seen.add(obj.id);
  if (!obj.on) return definition(obj, ctx)?.elevation || 0;
  const parent = objects.find((p) => p.id === obj.on!.id);
  if (!parent) return 0;
  const surface = definition(parent, ctx)?.surfaces?.[obj.on.surface];
  return surface
    ? heightOf(parent, objects, ctx, seen) +
        surface.height +
        (definition(obj, ctx)?.support_offset || 0)
    : 0;
}
export function parseSupport(value: unknown) {
  requireValue(
    record(value) &&
      Object.keys(value).sort().join(",") === "id,surface,x,yaw,z",
    "on requires id, surface, x, z and yaw; offsets are relative to the supporting surface",
  );
  requireValue(
    typeof value.id === "string" &&
      length(value.id) >= 1 &&
      length(value.id) <= 64,
    "Invalid support id",
  );
  requireValue(
    typeof value.surface === "string" &&
      length(value.surface) >= 1 &&
      length(value.surface) <= 64,
    "Choose a surface id from the supporting asset catalog",
  );
  for (const k of ["x", "z", "yaw"])
    requireValue(
      typeof value[k] === "number" &&
        Number.isFinite(value[k]) &&
        Math.abs(value[k]) <= (k === "yaw" ? Math.PI * 2 : 3),
      "Support offsets and yaw must be bounded finite numbers",
    );
  return { ...value } as Item["on"];
}
// A trailing vine has a solid pot and a hanging skirt of leaves. Check both:
// the pot must stand on the shelf and the foliage below it must clear its front lip.
function ledgeFit(obj: Item, ctx: Context, surface: Data) {
  const mount = definition(obj, ctx).ledge_mount, on = obj.on!;
  const c = Math.cos(on.yaw), s = Math.sin(on.yaw);
  const [px, pz] = mount.pot_center, r = mount.pot_radius;
  if (Math.abs(on.x + px*c + pz*s) + r > surface.size[0]/2 + .002 ||
      Math.abs(on.z - px*s + pz*c) + r > surface.size[1]/2 + .002) return 'support_overhang';
  const [left, back, right, front] = mount.tail;
  const nearest = Math.min(...[left,right].flatMap(x=>[back,front].map(z=>on.z-x*s+z*c)));
  if (surface.front_edge === undefined || nearest < surface.front_edge + .005) return 'foliage_clearance';
}
export function resolveSupports(objects: Item[], ctx: Context): Data[] {
  const byId = new Map(objects.map((o) => [o.id, o])),
    resolved = new Set<string>(),
    visiting = new Set<string>(),
    invalid = new Set<string>(),
    errors: Data[] = [];
  function error(code: string, obj: Item, message: string) {
    invalid.add(obj.id);
    errors.push({
      code,
      ids: [obj.id],
      message,
      suggestion: "检查 get_catalog 中的承载面和物品尺寸；先调整摆放，再预演。",
    });
  }
  function visit(obj: Item): boolean {
    if (resolved.has(obj.id)) return !invalid.has(obj.id);
    if (visiting.has(obj.id)) {
      error("support_cycle", obj, "物品之间不能循环承载。");
      return false;
    }
    visiting.add(obj.id);
    const own = definition(obj, ctx),
      on = obj.on;
    if (own.placement === "surface" && !on)
      error("surface_required", obj, "这个物品需要放在目录声明的承载面上。");
    if (on) {
      if (own.placement !== "surface")
        error("support_not_allowed", obj, "此家具不是桌面或层板摆件。");
      const parent = byId.get(on.id);
      if (!parent)
        error(
          "support_missing",
          obj,
          "承载家具不存在；移除家具时也需处理上面的物品。",
        );
      else if (visit(parent)) {
        const surface = definition(parent, ctx).surfaces?.[on.surface];
        if (!surface) error("surface_unknown", obj, "承载家具没有这个承载面。");
        else {
          const [cx, cz] = surface.center || [0, 0],
            x = cx + on.x,
            z = cz + on.z,
            c = Math.cos(parent.yaw),
            s = Math.sin(parent.yaw);
          Object.assign(obj, {
            x: parent.x + x * c + z * s,
            z: parent.z - x * s + z * c,
            yaw: parent.yaw + on.yaw,
          });
          const [w, d] = own.size,
            co = Math.abs(Math.cos(on.yaw)),
            si = Math.abs(Math.sin(on.yaw));
          if (own.ledge_mount) {
            const issue=ledgeFit(obj, ctx, surface);
            if(issue) error(issue,obj,issue==='support_overhang'?'花盆底部没有完整放在层板上。':'垂藤需要越过层板开放的前缘，请换位置或调整朝向。');
          } else if (
            Math.abs(on.x) + (w * co + d * si) / 2 >
              surface.size[0] / 2 + 0.002 ||
            Math.abs(on.z) + (w * si + d * co) / 2 > surface.size[1] / 2 + 0.002
          )
            error("support_overhang", obj, "物品超出承载面的安全边缘。");
          const top=heightOf(obj,objects,ctx)+own.height;
          let child: Item | undefined=obj;
          while(child?.on){
            const holder=byId.get(child.on.id);if(!holder)break;
            const level=definition(holder,ctx)?.surfaces?.[child.on.surface];
            if(level?.clearance!==undefined&&top>heightOf(holder,objects,ctx)+level.height+level.clearance+.002){
              error("support_clearance",obj,"物品高于层板净空，换到更高的格子或柜顶。");break;
            }
            child=holder;
          }
        }
      } else error("support_invalid", obj, "承载关系未通过检查。");
    }
    visiting.delete(obj.id);
    resolved.add(obj.id);
    return !invalid.has(obj.id);
  }
  for (const obj of objects) visit(obj);
  return errors;
}
export function supportsPair(a: Item, b: Item, objects: Item[]) {
  const byId = new Map(objects.map((o) => [o.id, o]));
  function ancestor(child: Item | undefined, parent: Item) {
    const seen = new Set<string>();
    while (child?.on && !seen.has(child.id)) {
      seen.add(child.id);
      if (child.on.id === parent.id) return true;
      child = byId.get(child.on.id);
    }
    return false;
  }
  return ancestor(a, b) || ancestor(b, a);
}
export function footprint(obj: Item, ctx: Context) {
  const [w, d] = definition(obj, ctx).size,
    c = Math.abs(Math.cos(obj.yaw)),
    s = Math.abs(Math.sin(obj.yaw));
  return [c * w + s * d, s * w + c * d];
}
// Keep full bounds for room and ceiling checks. Below its pot a vine occupies only
// the hanging silhouette, so a book behind that silhouette is not intersecting it.
export function occupiedSections(obj: Item, ctx: Context, y: number, w: number, d: number) {
  const asset=definition(obj,ctx), crown={x:obj.x,z:obj.z,w,d,bottom:y,top:y+asset.height};
  if(!asset.ledge_mount)return [crown];
  const [x0,z0,x1,z1]=asset.ledge_mount.tail;
  const c=Math.cos(obj.yaw),s=Math.sin(obj.yaw),mx=(x0+x1)/2,mz=(z0+z1)/2;
  const seat=y-asset.support_offset;
  return [{...crown,bottom:seat},{
    x:obj.x+mx*c+mz*s,z:obj.z-mx*s+mz*c,
    w:(x1-x0)*Math.abs(c)+(z1-z0)*Math.abs(s),d:(x1-x0)*Math.abs(s)+(z1-z0)*Math.abs(c),
    bottom:y,top:seat,
  }];
}
type Sections=ReturnType<typeof occupiedSections>;
export function sectionOverlap(first: Sections,second: Sections){
  for(const a of first)for(const b of second){
    if(a.top<=b.bottom+.01||b.top<=a.bottom+.01)continue;
    const x=(a.w+b.w)/2-Math.abs(a.x-b.x),z=(a.d+b.d)/2-Math.abs(a.z-b.z);
    if(x>.015&&z>.015)return {x,z};
  }
}
export function validateLayout(
  state: import("./types.js").State,
  ctx: Context,
) {
  validateBalcony(state,ctx);
  const limits = boundaries(state.room),
    errors = resolveSupports(state.objects, ctx);
  requireValue(!errors.length, errors[0]?.message);
  const solids: Array<[Item, Sections]> = [],
    seen = new Set<string>();
  for (const obj of state.objects) {
    requireValue(!seen.has(obj.id), "Duplicate furniture id");
    seen.add(obj.id);
    requireValue(
      !obj.asset_id || ctx.assets[obj.asset_id]?.kind === obj.kind,
      "Asset does not match furniture kind",
    );
    const def = definition(obj, ctx),
      y = heightOf(obj, state.objects, ctx),
      h = def.height,
      [w, d] = footprint(obj, ctx);
    requireValue(
      !(
        !fitsFootprint(state.room,obj,w,d) ||
        y < -0.001 ||
        y + h > limits.height
      ),
      "Furniture extends outside room: " + obj.id,
    );
    if (def.placement === "wall") {
      requireValue(mountedInRoom(state.room,obj,w,d),
        "Wall fixture must face into the room on the back or left wall",
      );
    }
    requireValue(validHangingQuilt(state.room,state.objects,obj),'Bring the quilt in before moving the rack indoors or removing its bed');
    if(!obj.on&&obj.kind!=="rug")requireValue(!blocksDoor(state.room,obj,w,d),"Furniture blocks a room doorway: "+obj.id);
    if (obj.kind === "rug") continue;
    const occupied=occupiedSections(obj,ctx,y,w,d);
    for (const [other,sections] of solids) {
      if (!sectionOverlap(occupied,sections) || supportsPair(obj, other, state.objects)) continue;
      throw Error("Furniture overlaps another item: " + other.id + " / " + obj.id);
    }
    solids.push([obj,occupied]);
  }
}

export function validateBalcony(state: import("./types.js").State,ctx:Context){
 const b=balconyGeometry(state.room);if(!b)return;
 const span=b.wall==='left'?(state.room?.depth??5):(state.room?.width??6);
 requireValue(Math.abs(b.center)+b.width/2<=span/2-.08,"Balcony must fit along its supporting wall");
 const door=state.objects.find(o=>o.id===b.door_id),def=door&&definition(door,ctx);
 requireValue(door&&def?.wall_opening&&def.placement==='wall',"Balcony requires its declared floor window/door");
 requireValue(Math.abs(door.yaw-(b.wall==='left'?Math.PI/2:0))<.001,"Balcony door must face its supporting wall");
 const q=balconyLocal(state.room,door)!;
 requireValue(Math.abs(q.v)<.25&&Math.abs(q.u)+def.wall_opening.width/2+.03<=b.width/2-.02,"Door opening must lie inside the balcony wall span");
}
