import {regionAt,balconyGeometry,wallBlocksSight} from '../shared/space.mjs';
import {
  type State,
  type Item,
  type Context,
  type Data,
  round,
} from "./types.js";
import { ROOM_DEFAULT, wallsFor, heightOf, definition } from "./geometry.js";
import { objectList } from "./objects.js";
export function occludes(
  a: Data,
  b: Data,
  obj: Item,
  def: Data,
  baseY = def.elevation || 0,
) {
  if (obj.kind === "rug") return false;
  const c = Math.cos(obj.yaw),
    s = Math.sin(obj.yaw),
    [w, d] = def.size;
  let lo = 0,
    hi = 1;
  const points = [a, b].map((p) => {
    const dx = p.x - obj.x,
      dz = p.z - obj.z;
    return [dx * c - dz * s, dx * s + dz * c];
  });
  for (const [i, extent] of [
    [0, w / 2],
    [1, d / 2],
  ]) {
    const origin = points[0][i],
      delta = points[1][i] - origin;
    if (Math.abs(delta) < 1e-9) {
      if (Math.abs(origin) > extent) return false;
    } else {
      const t = [(-extent - origin) / delta, (extent - origin) / delta].sort(
        (a, b) => a - b,
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
export function observe(
  state: State,
  ctx: Context,
  snapshot: Data | null,
  now: number,
  events: Data[],
) {
  const age = snapshot ? Math.max(0, now - snapshot.received_at) : null,
    fresh = age !== null && age < 6 && !!snapshot?.visible,
    body = snapshot?.body ?? null;
  const result: Data = {
    revision: state.revision,
    source: "character perspective, not spectator camera",
    fresh,
    age_seconds: age === null ? null : round(age, 2),
    execution: {
      paused: snapshot ? (snapshot.paused ?? false) : null,
      requires_visible_viewer: true,
    },
    job: state.interaction ?? null,
    events,
    cursor: events.length ? events.at(-1)!.seq : null,
    room: { ...ROOM_DEFAULT, ...state.room },
    ...(state.room?.balcony?{area:body?regionAt(state.room,body):null}:{}),
    limitations: [
      "Visibility uses approximate furniture bounds, not a pixel-perfect image or physical sensation sensor.",
      "No hunger, tiredness or emotions are inferred.",
    ],
  };
  if (!fresh)
    return {
      ...result,
      summary:
        "还没有新鲜的身体视角反馈；页面未打开或暂时断开。动作是否完成请看 job，不能把已受理当完成。",
      body,
      sight: { status: "unavailable", objects: [] },
      touch: [],
    };
  const job = state.interaction || {},
    pose = body.pose,
    support = state.objects.find((o) => o.id === job.target_id),
    active = job.phase === "active" && snapshot!.job_id === job.id,
    eyesClosed = pose === "sleep",
    eye = {
      ...body,
      y:
        body.y +
        (eyesClosed ? 0.22 : pose === "play" ? 0.57 : ["sit", "read","draw"].includes(pose) ? 0.78 : 0.9),
    },
    visible: Data[] = [];
  for (const obj of objectList(state, ctx).objects) {
    const def = definition(obj, ctx) || {},
      dx = obj.x - body.x,
      dz = obj.z - body.z,
      distance = Math.hypot(dx, dz),
      angle = Math.atan2(
        Math.sin(Math.atan2(dx, dz) - body.yaw),
        Math.cos(Math.atan2(dx, dz) - body.yaw),
      );
    const direction =
      Math.abs(angle) < Math.PI / 6
        ? "前面"
        : Math.abs(angle) > (Math.PI * 5) / 6
          ? "后面"
          : angle < 0
            ? "左边"
            : "右边";
    const item = {
      id: obj.id,
      label: obj.label,
      category: obj.category,
      ...(state.room?.balcony?{area:obj.area}:{}),
      distance_m: round(distance, 2),
      direction,
      actions: obj.actions,
      support: obj.support,
    };
    const point = {
      x: obj.x,
      z: obj.z,
      y: Math.min(
        1.25,
        (def.height ?? 0.5) * 0.7 + heightOf(obj, state.objects, ctx),
      ),
    };
    if (
      !eyesClosed &&
      distance < 5.5 &&
      !(state.room?.balcony&&wallBlocksSight(state.room,state.objects,eye,point)) &&
      Math.abs(angle) < (70 * Math.PI) / 180 &&
      !state.objects.some(
        (o) =>
          o.id !== obj.id &&
          o.id!==state.room?.balcony?.door_id &&
          occludes(
            eye,
            point,
            o,
            definition(o, ctx),
            heightOf(o, state.objects, ctx),
          ),
      )
    )
      visible.push(item);
  }
  const touch =
    active && support
      ? [
          {
            object_id: support.id,
            kind: pose === "sleep" ? "lying_support" : "seated_support",
            description: pose === "sleep" ? "身体躺在床面上" : pose === "play" ? "坐在玩具组的软垫上" : "坐在座面上",
            basis: "confirmed active contact pose",
          },
        ]
      : [];
  const balcony=balconyGeometry(state.room);
  const walls = (balcony&&regionAt(state.room,body)==='balcony'?[{id:'balcony-railing',label:'阳台护栏',axis:balcony.wall==='left'?'x':'z',position:balcony.wall==='left'?balcony.minX:balcony.minZ}]:wallsFor(state.room))
    .map((w) => ({
      id: w.id,
      label: w.label,
      wallpaper_id: state.room?.wallpapers?.[w.id] ?? "plain",
      distance_m: round(Math.abs(body[w.axis] - w.position), 2),
    }))
    .sort((a, b) => a.distance_m - b.distance_m);
  let status = eyesClosed
    ? "闭着眼睛，躺在床上。"
    : pose === "draw" ? "坐在椅子上，低头用蜡笔画画。" : pose === "play" ? (support?.properties?.packed ? "玩具收在盒里，坐在地垫上。" : "坐在地垫上，摆弄拼装机器人。") : pose === "read"
      ? "坐好，正在看书。"
      : pose === "sit"
        ? "坐在座位上。"
        : body.moving
          ? "正在走动。"
          : pose === "transition"
            ? "正在调整姿势。"
            : state.room?.balcony&&regionAt(state.room,body)==='balcony'?"站在阳台上。":"站在房间里。";
  if (snapshot!.paused) status = "动作已暂停。" + status;
  if (visible.length)
    status +=
      "眼前有" +
      visible
        .slice(0, 4)
        .map((o) => o.label)
        .join("、") +
      "。";
  return {
    ...result,
    summary: status,
    body,
    sight: {
      status: eyesClosed ? "eyes_closed" : "open",
      fov_degrees: 140,
      objects: visible,
    },
    nearby: visible
      .filter((o) => o.distance_m < 1.2)
      .sort((a, b) => a.distance_m - b.distance_m),
    touch,
    hands: {
      holding: pose==="draw" && active ? "crayon" : pose === "read" && active ? "storybook" : pose === "play" && active && !support?.properties?.packed ? "toy_robot" : null,
      basis: pose==="draw" && active ? "active drawing prop" : pose === "read" && active ? "active reading prop" : pose === "play" && active && !support?.properties?.packed ? "active toy prop" : "no held prop",
    },
    walls,
    light: state.light,
  };
}
