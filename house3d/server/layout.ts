import {fitsFootprint,createSpace,spaceBounds,balconyGeometry,balconyDoor} from '../shared/space.mjs';
import {
  type State,
  type Item,
  type Context,
  type Data,
  clone,
  record,
  extra,
  requireValue,
  round,
  same,
} from "./types.js";
import {
  boundaries,
  definition,
  heightOf,
  footprint,
  occupiedSections,
  sectionOverlap,
  resolveSupports,
  supportsPair,
  validateBalcony,
} from "./geometry.js";
import { busy, worldPoint } from "./objects.js";
export function geometryIssues(objects: Item[], ctx: Context, room?: Data) {
  const boundsRoom = boundaries(room),
    issues: Data[] = [],
    boxes: Array<[Item, ReturnType<typeof occupiedSections>]> = [];
  for (const obj of objects) {
    const def = definition(obj, ctx),
      [w, d] = footprint(obj, ctx),
      y = heightOf(obj, objects, ctx),
      h = def.height,
      bounds = {
        x: [obj.x - w / 2, obj.x + w / 2],
        z: [obj.z - d / 2, obj.z + d / 2],
        y: [y, y + h],
      },
      overflow = Object.fromEntries(
        (["x", "z"] as const).map((axis) => [
          axis,
          round(
            Math.max(
              0,
              -boundsRoom[axis === "x" ? "furniture_x" : "furniture_z"] -
                bounds[axis][0],
              bounds[axis][1] -
                boundsRoom[axis === "x" ? "furniture_x" : "furniture_z"],
            ),
            4,
          ),
        ]),
      );
    if (
      !fitsFootprint(room,obj,w,d) ||
      y < -0.001 ||
      y + h > boundsRoom.height
    )
      issues.push({
        code: "outside_room",
        ids: [obj.id],
        bounds,
        overflow_m: overflow,
        message: "家具超出墙面或天花板。",
        suggestion: "向室内移动，或从目录选择更小的款式。",
      });
    if (def.placement === "wall") {
      const a = Math.atan2(Math.sin(obj.yaw), Math.cos(obj.yaw));
      if (
        !(
          (Math.abs(a) < 0.001 &&
            Math.abs(obj.z - (-boundsRoom.furniture_z + d / 2)) < 0.025) ||
          (Math.abs(a - Math.PI / 2) < 0.001 &&
            Math.abs(obj.x - (-boundsRoom.furniture_x + w / 2)) < 0.025)
        )
      )
        issues.push({
          code: "wall_mount",
          ids: [obj.id],
          message: "此挂件需朝内贴在后墙或左墙。",
          suggestion:
            "按 get_catalog.room 当前内边界贴墙；后墙 yaw=0，左墙 yaw=π/2。",
        });
    }
    if (obj.kind === "rug") continue;
    const occupied=occupiedSections(obj,ctx,y,w,d);
    for (const [other,sections] of boxes) {
      const overlap=sectionOverlap(occupied,sections);
      if (!overlap || supportsPair(obj, other, objects)) continue;
      issues.push({
        code: "overlap",
        ids: [other.id, obj.id],
        overlap_m: { x: round(overlap.x, 4), z: round(overlap.z, 4) },
        message: "两件家具的保守包围盒重叠。",
        suggestion: "拉开间距或旋转后重新 dry-run；这不是逐三角形碰撞检测。",
      });
    }
    boxes.push([obj,occupied]);
  }
  return issues;
}
export function navigationReport(
  objects: Item[],
  ctx: Context,
  body: Data,
  room?: Data,
) {
  const b = boundaries(room),
    solids = objects
      .filter((o) => o.kind !== "rug" && !o.on)
      .map((obj) => ({
        obj,
        size: definition(obj, ctx).size,
        c: Math.cos(obj.yaw),
        s: Math.sin(obj.yaw),
      }));
  const space=room?.balcony?createSpace(room,objects):null,extent=spaceBounds(room);
  function free(p: Data, radius = 0.57, ignore?: string) {
    if (
      space?!space.free(p,radius):(Math.abs(p.x) > b.furniture_x - 0.1 - radius ||
      Math.abs(p.z) > b.furniture_z - 0.1 - radius)
    )
      return false;
    return !solids.some(({ obj, size: [w, d], c, s }) => {
      if (obj.id === ignore||obj.id===room?.balcony?.door_id) return false;
      const dx = p.x - obj.x,
        dz = p.z - obj.z;
      return (
        Math.hypot(
          Math.max(0, Math.abs(dx * c - dz * s) - w / 2),
          Math.max(0, Math.abs(dx * s + dz * c) - d / 2),
        ) < radius
      );
    });
  }
  function line(a: Data, z: Data, radius = 0.57, ignore?: string) {
    const steps = Math.max(
      1,
      Math.ceil(Math.hypot(a.x - z.x, a.z - z.z) / 0.025),
    );
    for (let i = 0; i <= steps; i++)
      if (
        !free(
          {
            x: a.x + ((z.x - a.x) * i) / steps,
            z: a.z + ((z.z - a.z) * i) / steps,
          },
          radius,
          ignore,
        )
      )
        return false;
    return true;
  }
  const points = new Map<string, Data>(),
    indices = new Map<string, [number, number]>();
  const x0=space?extent.minX:-b.body_x,z0=space?extent.minZ:-b.body_z,x1=space?extent.maxX:b.body_x,z1=space?extent.maxZ:b.body_z;
  for (let i = 0; i <= Math.floor((x1-x0)*10); i++)
    for (let j = 0; j <= Math.floor((z1-z0)*10); j++) {
      const p = { x: x0 + i * 0.1, z: z0 + j * 0.1 };
      if (free(p)) {
        points.set(`${i},${j}`, p);
        indices.set(`${i},${j}`, [i, j]);
      }
    }
  const reached = new Set<string>();
  if (free(body) && points.size) {
    for (const [key, p] of points)
      if (Math.hypot(p.x - body.x, p.z - body.z) < 0.2 && line(body, p))
        reached.add(key);
    const queue = [...reached];
    for (let n = 0; n < queue.length; n++) {
      const key = queue[n],
        [i, j] = indices.get(key)!;
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]) {
        const next = `${i + dx},${j + dz}`;
        if (
          points.has(next) &&
          !reached.has(next) &&
          line(points.get(key)!, points.get(next)!)
        ) {
          reached.add(next);
          queue.push(next);
        }
      }
    }
  }
  const interactions = [];
  for (const obj of objects)
    for (const [action, config] of Object.entries(
      ctx.assets[obj.asset_id || ""]?.interactions || {},
    )) {
      const root = worldPoint(obj, config.root);
      const approaches = config.approaches.map(
        (local: number[], index: number) => {
          const p = worldPoint(obj, local),
            standing = free(p),
            entry = standing && line(p, root, 0.32, obj.id),
            reachable =
              entry &&
              [...reached].some(
                (k) =>
                  Math.hypot(points.get(k)!.x - p.x, points.get(k)!.z - p.z) <
                    0.2 && line(points.get(k)!, p),
              );
          return {
            index,
            position: p,
            clear: standing,
            entry_clear: entry,
            reachable,
          };
        },
      );
      interactions.push({
        id: obj.id,
        action,
        reachable: approaches.some((a: Data) => a.reachable),
        approaches,
      });
    }
  return {
    ...(room?.balcony?{balcony:{door:balconyDoor(room,objects),free_cells:[...points.values()].filter(p=>{const g=balconyGeometry(room)!;return p.x>=g.minX&&p.x<=g.maxX&&p.z>=g.minZ&&p.z<=g.maxZ}).length,reachable_cells:[...reached].filter(k=>{const p=points.get(k)!,g=balconyGeometry(room)!;return p.x>=g.minX&&p.x<=g.maxX&&p.z>=g.minZ&&p.z<=g.maxZ}).length}}:{}),
    body_clear: free(body),
    free_cells: points.size,
    reachable_cells: reached.size,
    interactions,
    grid_step_m: 0.1,
    radius_m: 0.57,
    basis:
      "Approximate 2D catalog rectangles, same radii as viewer; not mesh/cloth collision or a guarantee of pose quality.",
  };
}
export function planLayout(
  state: State,
  args: unknown,
  ctx: Context,
  mutate: (state: State, command: Data, options?: Data) => State,
  snapshot: Data | null = null,
  now = 0,
) {
  requireValue(
    record(args) && !extra(args, ["operations", "dry_run"]),
    "Unknown layout argument",
  );
  requireValue(
    typeof (args.dry_run === undefined ? true : args.dry_run) === "boolean",
    "dry_run must be boolean",
  );
  requireValue(
    Array.isArray(args.operations) &&
      args.operations.length >= 1 &&
      args.operations.length <= 80,
    "Expected 1..80 layout operations",
  );
  let trial = clone(state);
  const errors: Data[] = [],
    warnings: Data[] = [];
  for (const [index, operation] of args.operations.entries())
    try {
      requireValue(
        record(operation) && ["add", "update", "remove"].includes(operation.op),
        "op must be add, update or remove",
      );
      const { op, ...item } = operation;
      if (op === "add") {
        requireValue(
          typeof item.asset_id === "string" && !!ctx.assets[item.asset_id],
          "Choose asset_id from get_catalog.assets",
        );
        requireValue(
          !("kind" in item),
          "kind is derived from the selected asset",
        );
        item.kind = ctx.assets[item.asset_id].kind;
      }
      trial = mutate(
        trial,
        {
          tool: (
            {
              add: "place_furniture",
              update: "update_furniture",
              remove: "remove_furniture",
            } as Data
          )[op],
          arguments: item,
        },
        { check_geometry: false, check_busy: false },
      );
    } catch (e) {
      errors.push({
        code: "invalid_operation",
        operation_index: index,
        message: (e as Error).message,
        suggestion: "按工具定义和目录修正这条操作，再重试整批。",
      });
    }
  try{validateBalcony(trial,ctx)}catch(e){errors.push({code:'balcony_invalid',message:(e as Error).message})}
  errors.push(
    ...resolveSupports(trial.objects, ctx),
    ...geometryIssues(trial.objects, ctx, trial.room),
  );
  if (busy(state))
    errors.push({
      code: "interaction_busy",
      ids: [state.interaction?.target_id ?? null],
      message: "正在与物品互动；可以预演，但现在不能挪动家具。",
      suggestion: "结束当前互动后重新预演并应用。",
    });
  const fresh = !!(
      snapshot?.visible &&
      now - snapshot.received_at >= 0 &&
      now - snapshot.received_at < 6
    ),
    body = fresh ? snapshot!.body : state.character;
  if (!fresh)
    warnings.push({
      code: "body_not_fresh",
      message: "没有新鲜的角色位置，暂按最后保存的位置检查。",
      suggestion: "打开小家页面，等待身体反馈后重新 dry-run。",
    });
  else if (body.moving)
    errors.push({
      code: "body_moving",
      message: "角色正在走动；预演可继续，正式应用需先停稳。",
      suggestion: "先休息一下，再重新 dry-run。",
    });
  const navigation = navigationReport(trial.objects, ctx, body, trial.room);
  if (!navigation.body_clear)
    errors.push({
      code: "body_blocked",
      message: "新布置占据角色脚下位置或所需站立空间。",
      suggestion: "先让她走到空地，或调整家具位置；不会自动瞬移角色。",
    });
  for (const interaction of navigation.interactions)
    if (!interaction.reachable)
      warnings.push({
        code: "interaction_unreachable",
        ids: [interaction.id],
        action: interaction.action,
        message: "当前起点未找到可走到且可进入的互动接近点。",
        suggestion: "给座位或床边留出通道，调整朝向；在实际页面再次检查。",
      });
  if(navigation.balcony&&navigation.balcony.door?.open&&!navigation.balcony.reachable_cells)warnings.push({code:'balcony_unreachable',message:'当前布置未找到通往阳台的通路。',suggestion:'移开门口和阳台通道上的物品后重新预演。'});
  const old = new Map(state.objects.map((o) => [o.id, o])),
    next = new Map(trial.objects.map((o) => [o.id, o])),
    changes = {
      added: [...next.keys()].filter((k) => !old.has(k)),
      removed: [...old.keys()].filter((k) => !next.has(k)),
      updated: [...next.keys()].filter(
        (k) => old.has(k) && !same(next.get(k), old.get(k)),
      ),
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
      collision_basis:
        "Conservative rotated AABB with height ranges; rugs excluded.",
    },
  };
}
