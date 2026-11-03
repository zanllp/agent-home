import {drawable} from './crayon.mjs';
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
  drying_rack: "storage",
};
export const CATEGORY_LABELS: Record<string, string> = {
  play: "玩具",
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
export function categoriesFor(ctx: Context) {
  if (Object.values(ctx.assets).some(a => a.kind === "toy_set")) return CATEGORY_LABELS;
  const {play, ...categories} = CATEGORY_LABELS;return categories;
}
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
export function drawingBook(chair: Item,state: State) {
  const desk=readingDesk(chair,state);
  return desk && state.objects.find(o=>drawable(o) && o.on?.id===desk.id && o.on.surface==="top");
}
export function riceSource(bowl: Item, state: State) {
  if(bowl.asset_id!=="home-rice-bowl-v1" || !bowl.on)return undefined;
  return state.objects.filter(o=>o.asset_id==="home-rice-cooker-v1" && o.on?.id===bowl.on!.id &&
    o.on?.surface===bowl.on!.surface && (o.properties?.servings ?? 4)>0)
    .sort((a,b)=>Math.hypot(a.x-bowl.x,a.z-bowl.z)-Math.hypot(b.x-bowl.x,b.z-bowl.z))[0];
}
export function actionsFor(obj: Item, ctx: Context, state: State) {
  const def = ctx.assets[obj.asset_id || ""] || {},
    result: Data[] = [],
    job = state.interaction || {};
  for (const name of Object.keys(def.interactions || {}))
    result.push({
      id: name,
      label: ({ play: "坐下玩机器人", sit: "坐一会儿", sleep: "躺下睡觉" } as Data)[name],
      available: !busy(state),
      reason: busy(state) ? "先结束当前互动" : null,
      reachability: "not_checked",
    });
  if (obj.asset_id === "home-rice-bowl-v1") {
    const full=obj.properties?.filled===true,source=riceSource(obj,state);
    result.push({id:"serve_rice",label:"盛一碗白饭",available:!full && !!source,
      reason:full?"碗里已经有饭":source?null:"把碗放到还有饭的电饭锅旁，同一个台面上"});
  }
  if (obj.kind === "toy_set" && def.interactions?.play) {
    const packed = obj.properties?.packed === true;
    const available = !busy(state) || (job.target_id===obj.id && job.pose==="play" && job.phase==="active");
    result.push({id:packed?"unpack":"tidy",label:packed?"拿出玩具":"收好玩具",available,reason:available?null:"先结束当前互动"});
    if(packed){
      const play=result.find(a=>a.id==="play");
      if(play){play.available=false;play.reason="先拿出玩具"}
    }
  }
  if (def.interactions?.sit && readingDesk(obj, state))
    result.push({
      id: "read",
      label: "坐下看书",
      available: !busy(state),
      reason: busy(state) ? "先结束当前互动" : null,
      reachability: "not_checked",
    });
  if (def.interactions?.sit && drawingBook(obj,state))
    result.push({id:"draw",label:"拿蜡笔画画",available:!busy(state),reason:busy(state)?"先结束当前互动":null,reachability:"not_checked"});
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
      cat = obj.asset_id==="home-rice-bowl-v1"?"tables":CATEGORIES[obj.kind] || "decoration",
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
        obj.asset_id==="home-rice-cooker-v1"?{servings:4,...obj.properties}:obj.asset_id==="home-rice-bowl-v1"?{filled:false,...obj.properties}:obj.properties ??
        (obj.kind==="toy_set"?{packed:false}:obj.id===state.room?.balcony?.door_id?{open:true}:obj.kind === "lamp"
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
    categories: categoriesFor(ctx),
    objects,
    interaction: state.interaction ?? null,
  };
}
