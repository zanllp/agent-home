import {balconyGeometry,balconyDoor,spaceBounds} from '../shared/space.mjs';
import { readFileSync, statSync, realpathSync, existsSync } from "node:fs";
import { resolve, sep, extname } from "node:path";
import { randomUUID } from "node:crypto";
import {
  type State,
  type Context,
  type Data,
  record,
  requireValue,
  extra,
  stable,
  same,
} from "./types.js";
import { dimensions, boundaries, LIMITS, wallsFor } from "./geometry.js";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  objectList,
  BUSY_PHASES,
  worldPoint,
} from "./objects.js";
import { transition } from "./transition.js";
import { planLayout } from "./layout.js";
import { Store } from "./store.js";
export interface Input {
  method: string;
  url: string;
  headers: Record<string, string | undefined>;
  body?: unknown;
  bytes?: Buffer;
}
export interface Reply {
  status: number;
  body?: any;
  bytes?: Buffer;
  type?: string;
}
const json = (body: any, status = 200): Reply => ({ body, status });
export function loadContext(root: string): Context {
  const read = (name: string) =>
    JSON.parse(readFileSync(resolve(root, name), "utf8"));
  const data = read("server-data.json");
  return {
    ...data,
    assets: read("furniture-assets.json"),
    wallpapers: read("wallpapers.json"),
    presets: read("room-presets.json"),
  };
}
export class HouseApp {
  readonly store: Store;
  constructor(
    readonly ctx: Context,
    dbPath: string,
    readonly root: string,
    readonly webRoot: string,
    readonly now = () => Date.now() / 1000,
    readonly uuid = () => randomUUID().replaceAll("-", ""),
  ) {
    this.store = new Store(dbPath, ctx.defaultState);
  }
  handle(input: Input): Reply {
    const { method, headers } = input,
      host = headers.host || "localhost";
    if (!["127.0.0.1", "localhost"].includes(host.split(":")[0]))
      return json({ error: "Local host only" }, 403);
    if (
      method === "POST" &&
      headers.origin &&
      headers.origin !== `http://${host}`
    )
      return json({ error: "Cross-origin writes are not allowed" }, 403);
    const url = new URL(input.url, "http://localhost"),
      path = url.pathname,
      ctx = this.ctx,
      store = this.store,
      now = this.now(),
      get = method === "GET" || method === "HEAD",
      body = input.body;
    if (get && path === "/api/state") return json(store.state());
    if (get && path === "/api/catalog") {
      const current=store.state();
      const size = dimensions(current.room),
        limits = boundaries(size);
      return json({
        furniture: ctx.catalog,
        assets: ctx.assets,
        categories: Object.fromEntries(
          Object.entries(CATEGORY_LABELS).map(([key, label]) => [
            key,
            {
              label,
              asset_ids: Object.entries(ctx.assets)
                .filter(
                  ([, a]) => (CATEGORIES[a.kind || ""] || "decoration") === key,
                )
                .map(([id]) => id),
            },
          ]),
        ),
        wallpapers: ctx.wallpapers,
        room: {
          ...(current.room?.balcony?{balcony:{...current.room.balcony,bounds:{min_x:balconyGeometry(current.room)!.minX,max_x:balconyGeometry(current.room)!.maxX,min_z:balconyGeometry(current.room)!.minZ,max_z:balconyGeometry(current.room)!.maxZ},door:balconyDoor(current.room,current.objects),coordinate_basis:'Shared world X/Z in metres; door opening connects interior and balcony'}}:{}),
          styles: ["classic", "urban"],
          size: [size.width, size.depth],
          height: size.height,
          dimension_limits: LIMITS,
          furniture_bounds: [limits.furniture_x, limits.furniture_z],
          character_radius: 0.57,
          character_bounds: [limits.body_x, limits.body_z],
          walls: wallsFor(size),
        },
        activities: ["idle", "walk", "sit"],
        outfits: ["reference"],
        hairstyles: ["reference"],
        viewer: {
          path: "/wander.html",
          activities: ["idle", "walk"],
          sit: true,
          object_actions: ["sit", "sleep", "read", "leave"],
          interaction_requires_target: true,
          adapter: "Local HTTP only; no DSH connection",
        },
        limitations: [
          "No independent wardrobe yet",
          "move_character relocates rather than animating a route",
          "Screenshot requires an open visible house page",
        ],
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
              spawn: v.spawn,
            },
          ]),
        ),
        applying:
          "Explicit template reset: dry-run first; places the character at the declared spawn, preserves appearance",
      });
    if (get && path === "/api/objects")
      return json(
        objectList(
          store.state(),
          ctx,
          url.searchParams.get("category"),
          url.searchParams.get("capability"),
        ),
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
          return json({ error: (e as Error).message }, 400);
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
                additionalProperties: false,
              },
            },
          }),
        ),
      );
    if (get && path === "/api/tools")
      return json({
        tools: {
          observe_home: { method: "GET", path: "/api/observe" },
          walk_to: ["x", "z"],
          cancel_action: ["job_id"],
          update_room: [
            "wall_color",
            "trim_color",
            "style",
            "width",
            "depth",
            "height",
            "dry_run",
            "balcony",
          ],
          get_presets: { method: "GET", path: "/api/presets" },
          apply_preset: ["preset_id", "dry_run"],
          set_wallpaper: ["wall_id", "wallpaper_id"],
          list_objects: { method: "GET", path: "/api/objects" },
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
            "on",
          ],
          update_furniture: ["id", "asset_id", "x", "z", "yaw", "color", "on"],
          apply_layout: ["objects"],
          remove_furniture: ["id"],
          move_character: ["x", "z", "yaw"],
          set_activity: ["activity"],
          set_camera: ["preset"],
          set_light: ["preset"],
          set_note: ["text"],
          screenshot: { method: "POST", path: "/api/screenshots" },
        },
        command_endpoint: "/api/commands",
        command_shape: {
          id: "unique idempotency key",
          expected_revision: 0,
          tool: "set_light",
          arguments: { preset: "day" },
        },
      });
    if (method === "POST" && path === "/api/commands")
      return this.command(body, now);
    if (method === "POST" && path === "/api/screenshots") {
      const args = body ?? {};
      if (
        !record(args) ||
        extra(args, ["view"]) ||
        !["spectator", "character"].includes(args.view ?? "spectator")
      )
        return json({ error: "Unknown screenshot view" }, 400);
      const id = this.uuid();
      store.db
        .prepare(
          "INSERT INTO shots(id,status,png,created,view) VALUES(?,?,NULL,?,?)",
        )
        .run(id, "pending", now, args.view ?? "spectator");
      return json(
        { id, status: "pending", url: `/api/screenshots/${id}` },
        202,
      );
    }
    if (get && path === "/api/screenshots/pending") {
      if (url.searchParams.get("viewer") !== "life-v2")
        return json({ id: null, viewer_required: "life-v2" });
      store.db
        .prepare(
          "UPDATE shots SET status='expired' WHERE status='pending' AND created<?",
        )
        .run(now - 30);
      const r = store.db
        .prepare(
          "SELECT id,view FROM shots WHERE status='pending' ORDER BY created LIMIT 1",
        )
        .get() as Data | undefined;
      return json({ id: r?.id ?? null, view: r?.view ?? null });
    }
    const shot = /^\/api\/screenshots\/([^/]+)$/.exec(path);
    if (shot) {
      if (method === "POST") {
        if (headers["x-house-viewer"] !== "life-v2")
          return json({ error: "Reload the current Canvas viewer" }, 409);
        const bytes = input.bytes || Buffer.alloc(0);
        if (
          headers["content-type"]?.split(";")[0] !== "image/png" ||
          !bytes
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        )
          return json({ error: "Expected PNG" }, 400);
        const n = store.db
          .prepare(
            "UPDATE shots SET png=?,status='ready' WHERE id=? AND status='pending'",
          )
          .run(bytes, shot[1]);
        return n.changes
          ? json({ ok: true })
          : json({ error: "Request unavailable" }, 409);
      }
      if (get) {
        const r = store.db
          .prepare("SELECT * FROM shots WHERE id=?")
          .get(shot[1]) as Data | undefined;
        if (!r) return json({ error: "Not found" }, 404);
        if (r.status !== "ready")
          return json({ status: r.status }, r.status === "pending" ? 202 : 410);
        return { status: 200, bytes: Buffer.from(r.png), type: "image/png" };
      }
    }
    if (path.startsWith("/api/")) return json({ error: "Not found" }, 404);
    if (get) {
      let name: string;
      try {
        name = decodeURIComponent(
          path.startsWith("/models/")
            ? path.slice(8)
            : path === "/"
              ? "wander.html"
              : path.slice(1),
        );
      } catch {
        return json({ error: "Invalid path" }, 400);
      }
      const base = path.startsWith("/models/")
          ? resolve(this.root, "assets")
          : resolve(this.webRoot),
        file = resolve(base, name);
      if (
        (file !== base && !file.startsWith(base + sep)) ||
        name.includes("\0")
      )
        return json({ error: "Not found" }, 404);
      if (
        !existsSync(file) ||
        !statSync(file).isFile() ||
        !realpathSync(file).startsWith(realpathSync(base) + sep)
      )
        return json({ error: "Not found" }, 404);
      return {
        status: 200,
        bytes: readFileSync(file),
        type:
          (
            {
              ".html": "text/html; charset=utf-8",
              ".js": "text/javascript; charset=utf-8",
              ".css": "text/css; charset=utf-8",
              ".json": "application/json",
              ".glb": "model/gltf-binary",
              ".png": "image/png",
              ".svg": "image/svg+xml",
              ".webp": "image/webp",
              ".jpg": "image/jpeg",
            } as Data
          )[extname(file)] || "application/octet-stream",
      };
    }
    return json({ error: "Method not allowed" }, 405);
  }
  command(value: unknown, now: number): Reply {
    if (
      !record(value) ||
      typeof value.id !== "string" ||
      [...value.id].length < 1 ||
      [...value.id].length > 100
    )
      return json({ error: "Unique command id is required" }, 400);
    const body = value,
      store = this.store,
      ctx = this.ctx;
    return store.transaction(() => {
      const cached = store.db
        .prepare("SELECT * FROM commands WHERE id=?")
        .get(body.id) as Data | undefined;
      if (cached) {
        if (!same(JSON.parse(cached.request), body))
          return json(
            { error: "Command id reused with different payload" },
            409,
          );
        return json(JSON.parse(cached.body));
      }
      const old = store.state();
      if (body.expected_revision !== old.revision)
        return json(
          { error: "Revision conflict", revision: old.revision },
          409,
        );
      let next: State, report: Data | undefined;
      try {
        if (body.tool === "update_layout") {
          const planned = planLayout(
            old,
            body.arguments === undefined ? {} : body.arguments,
            ctx,
            (s, c, o) => transition(s, c, ctx, o),
            store.snapshot(),
            now,
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
                layout: report,
              },
              422,
            );
        } else {
          next = transition(old, body, ctx);
          if((old.room?.balcony||next.room?.balcony)&&['place_furniture','update_furniture','remove_furniture','apply_layout','update_object'].includes(body.tool)){
            const snap=store.snapshot();if(snap?.visible&&now-snap.received_at<6){
              requireValue(!snap.body.moving,"Stop walking before changing balcony layout/door");
              transition(next,{tool:'move_character',arguments:{x:snap.body.x,z:snap.body.z}},ctx,{check_busy:false});
            }
          }
          if (["apply_preset", "update_room"].includes(body.tool)) {
            if (
              body.tool === "update_room" &&
              Object.keys(body.arguments || {}).some((k) => k in LIMITS||k==='balcony')
            ) {
              const snapshot = store.snapshot();
              if (snapshot?.visible && now - snapshot.received_at < 6) {
                requireValue(
                  !snapshot.body.moving,
                  "Stop walking before resizing the room",
                );
                transition(
                  next,
                  {
                    tool: "move_character",
                    arguments: { x: snapshot.body.x, z: snapshot.body.z },
                  },
                  ctx,
                  { check_busy: false },
                );
              }
            }
            if (body.arguments?.dry_run ?? body.tool === "apply_preset")
              return json({ ok: true, applied: false, preview: next });
          }
        }
      } catch (e) {
        const args = body.arguments,
          defaultPreview = ["update_layout", "apply_preset"].includes(
            body.tool,
          ),
          preview =
            ["update_layout", "apply_preset", "update_room"].includes(
              body.tool,
            ) &&
            (record(args)
              ? (args.dry_run === undefined ? defaultPreview : args.dry_run) !==
                false
              : defaultPreview);
        if (!preview)
          store.event(now, "action_rejected", {
            command_id: body.id,
            action: body.tool ?? null,
            error: (e as Error).message,
          });
        return json({ error: (e as Error).message }, 400);
      }
      store.event(now, "command_accepted", {
        command_id: body.id,
        action: body.tool,
        arguments: body.arguments ?? {},
        status: next.interaction?.id === body.id ? "requested" : "applied",
      });
      const result: Data = { ok: true, state: next };
      if (["apply_preset", "update_room"].includes(body.tool))
        result.applied = true;
      if (report) Object.assign(result, { applied: true, layout: report });
      store.save(next);
      store.db
        .prepare("INSERT INTO commands VALUES(?,?,?)")
        .run(body.id, stable(body), JSON.stringify(result));
      return json(result);
    });
  }
  progress(id: string, value: unknown, now: number): Reply {
    if (
      !record(value) ||
      extra(value, [
        "phase",
        "approach_index",
        "error",
        "viewer_session",
        "position",
      ])
    )
      return json({ error: "Invalid progress" }, 400);
    const body = value,
      store = this.store;
    return store.transaction(() => {
      const state = store.state(),
        job = state.interaction || {};
      if (job.id !== id || !BUSY_PHASES.has(job.phase))
        return json({ error: "Stale interaction" }, 409);
      if (!store.viewerAllowed(body.viewer_session, now))
        return json({ error: "Another viewer owns this action" }, 409);
      const phase = body.phase,
        old = job.phase;
      if (typeof phase !== "string")
        return json({ error: "Invalid phase" }, 400);
      const allowed: Data = {
        requested:
          job.action === "leave"
            ? ["leaving", "completed", "failed"]
            : ["approaching", "failed"],
        approaching:
          job.pose === "walk"
            ? ["completed", "failed"]
            : ["entering", "failed"],
        entering: ["active", "failed"],
        active: [],
        leaving: ["completed", "failed"],
      };
      if (
        phase === old &&
        (body.approach_index ?? job.approach_index) === job.approach_index
      )
        return json({ ok: true, interaction: job });
      if (!allowed[old].includes(phase))
        return json({ error: "Invalid phase transition" }, 400);
      let config: Data | undefined,
        obj: State["objects"][number] | undefined,
        index: number | null = null;
      if (job.pose !== "walk") {
        obj = state.objects.find((o) => o.id === job.target_id)!;
        config =
          this.ctx.assets[obj.asset_id!].interactions![
            job.pose === "read" ? "sit" : job.pose
          ];
        index = body.approach_index ?? job.approach_index;
        if (
          !Number.isInteger(index) ||
          index === null ||
          index < 0 ||
          index >= config.approaches.length
        )
          return json({ error: "Invalid approach index" }, 400);
        if (job.approach_index != null && index !== job.approach_index)
          return json({ error: "Approach cannot change mid-interaction" }, 400);
      }
      if (
        phase === "failed" &&
        (typeof body.error !== "string" ||
          [...body.error].length < 1 ||
          [...body.error].length > 200)
      )
        return json({ error: "Failure reason required" }, 400);
      Object.assign(job, {
        phase,
        approach_index: index,
        error: phase === "failed" ? body.error : null,
      });
      if (phase === "active") {
        const p = worldPoint(obj!, config!.root);
        Object.assign(state.character, {
          x: p.x,
          z: p.z,
          yaw: p.yaw + (config!.yaw || 0),
          activity:
            job.pose === "sleep"
              ? "sleep"
              : job.pose === "read"
                ? "read"
                : "sit",
        });
      }
      if (phase === "completed" && job.action === "leave")
        state.character.activity = "idle";
      if (
        phase === "completed" &&
        job.action === "leave" &&
        job.from_active &&
        config
      ) {
        const p = worldPoint(obj!, config.approaches[index!]);
        Object.assign(state.character, {
          x: p.x,
          z: p.z,
          yaw: p.yaw,
          activity: "idle",
        });
      }
      if (phase === "completed" && job.action === "walk_to")
        Object.assign(state.character, { ...job.target, activity: "idle" });
      if ("position" in body) {
        if (
          phase !== "completed" ||
          job.action !== "leave" ||
          !record(body.position) ||
          Object.keys(body.position).sort().join(",") !== "x,yaw,z"
        )
          return json({ error: "Unexpected position feedback" }, 400);
        try {
          state.character = transition(
            state,
            { tool: "move_character", arguments: body.position },
            this.ctx,
          ).character;
        } catch (e) {
          return json({ error: (e as Error).message }, 400);
        }
      }
      store.event(now, "action_progress", {
        job_id: id,
        action: job.action,
        pose: job.pose,
        target_id: job.target_id ?? null,
        phase,
        error: job.error ?? null,
      });
      state.revision++;
      store.save(state);
      return json({ ok: true, interaction: job });
    });
  }
  close() {
    this.store.close();
  }
}
