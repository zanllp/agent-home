import {regionAt} from '../shared/space.mjs';
import { type State, type Item, type Context, type Data } from "./types.js";
import { heightOf } from "./geometry.js";
export const CATEGORIES: Record<string, string> = {
  wall_shelf: "storage",
  wall_art: "decoration",
  storage_box: "storage",
  desktop: "study",
  books: "study",
  air_conditioner: "appliances",
  appliance: "appliances",
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
  drying_rack: "storage",
};
export const CATEGORY_LABELS: Record<string, string> = {
  seating: "坐具",
  sleeping: "寝具",
  study: "学习创作",
  tables: "桌几",
  storage: "收纳",
  appliances: "家电",
  lighting: "灯光",
  decoration: "装饰植物",
  environment: "环境",
};
export const BUSY_PHASES = new Set([
  "requested",
  "approaching",
  "entering",
  "active",
  "leaving",
]);
export const busy = (state: State) => BUSY_PHASES.has(state.interaction?.phase);
export function worldPoint(obj: Item, point: number[]) {
  const [x, y, z] = point,
    c = Math.cos(obj.yaw),
    s = Math.sin(obj.yaw);
  return {
    x: obj.x + x * c + z * s,
    y,
    z: obj.z - x * s + z * c,
    yaw: obj.yaw,
  };
}
export function readingDesk(obj: Item, state: State) {
  if (obj.kind !== "chair") return undefined;
  return state.objects
    .filter((d) => {
      if (d.kind !== "desk") return false;
      const dx = d.x - obj.x,
        dz = d.z - obj.z,
        c = Math.cos(obj.yaw),
        s = Math.sin(obj.yaw),
        forward = dx * s + dz * c,
        side = dx * c - dz * s;
      return forward > 0.4 && forward < 1.35 && Math.abs(side) < 0.45;
    })
    .sort(
      (a, b) =>
        Math.hypot(a.x - obj.x, a.z - obj.z) -
        Math.hypot(b.x - obj.x, b.z - obj.z),
    )[0];
}
export function actionsFor(obj: Item, ctx: Context, state: State) {
  const def = ctx.assets[obj.asset_id || ""] || {},
    result: Data[] = [],
    job = state.interaction || {};
  for (const name of Object.keys(def.interactions || {}))
    result.push({
      id: name,
      label: ({ sit: "坐一会儿", sleep: "躺下睡觉" } as Data)[name],
      available: !busy(state),
      reason: busy(state) ? "先结束当前互动" : null,
      reachability: "not_checked",
    });
  if (def.interactions?.sit && readingDesk(obj, state))
    result.push({
      id: "read",
      label: "坐下看书",
      available: !busy(state),
      reason: busy(state) ? "先结束当前互动" : null,
      reachability: "not_checked",
    });
  if (busy(state) && job.target_id === obj.id)
    result.push({
      id: "leave",
      label: job.pose === "sleep" ? "起床" : "起身",
      available: job.action !== "leave",
      reason: null,
    });
  if (
    def.interactions?.sleep &&
    job.target_id === obj.id &&
    job.phase === "active"
  ) {
    const covered = obj.properties?.covered ?? true;
    result.push({
      id: covered ? "uncover" : "cover",
      label: covered ? "掀开被子" : "盖好被子",
      available: true,
    });
  }
  if (obj.kind === "lamp")
    result.push(
      { id: "turn_on", label: "开灯", available: true },
      { id: "turn_off", label: "关灯", available: true },
    );
  return result;
}
export function objectList(
  state: State,
  ctx: Context,
  category?: string | null,
  capability?: string | null,
) {
  const objects = [];
  for (const obj of state.objects) {
    const def = ctx.assets[obj.asset_id || ""] || {},
      cat = CATEGORIES[obj.kind] || "decoration",
      actions = actionsFor(obj, ctx, state);
    if (
      (category && category !== cat) ||
      (capability && !actions.some((a) => a.id === capability))
    )
      continue;
    objects.push({
      ...obj,
      ...(state.room?.balcony?{area:regionAt(state.room,obj)}:{}),
      label: obj.label ?? def.label ?? obj.kind,
      category: cat,
      category_label: CATEGORY_LABELS[cat],
      support: obj.on
        ? { ...obj.on, base_height: heightOf(obj, state.objects, ctx) }
        : null,
      writable_properties:
        obj.id===state.room?.balcony?.door_id?{open:{type:"boolean"}}:obj.kind === "lamp"
          ? {
              on: { type: "boolean" },
              brightness: { type: "number", minimum: 0, maximum: 1 },
            }
          : def.interactions?.sleep
            ? { covered: { type: "boolean" } }
            : {},
      actions,
      properties:
        obj.properties ??
        (obj.id===state.room?.balcony?.door_id?{open:true}:obj.kind === "lamp"
          ? { on: true, brightness: 0.7 }
          : obj.kind === "bed"
            ? { covered: true }
            : {}),
      interaction:
        state.interaction?.target_id === obj.id ? state.interaction : null,
    });
  }
  return {
    revision: state.revision,
    categories: CATEGORY_LABELS,
    objects,
    interaction: state.interaction ?? null,
  };
}
