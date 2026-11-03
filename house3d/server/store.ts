import {spaceBounds,regionAt} from '../shared/space.mjs';
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  type State,
  type Data,
  type Context,
  record,
  requireValue,
  length,
  extra,
} from "./types.js";
import { dimensions } from "./geometry.js";
import { observe } from "./observation.js";
export class Store {
  readonly db: DatabaseSync;
  constructor(path: string, initial: State) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(
      `PRAGMA busy_timeout=10000; CREATE TABLE IF NOT EXISTS home_events(seq INTEGER PRIMARY KEY AUTOINCREMENT,at REAL,kind TEXT,body TEXT); CREATE TABLE IF NOT EXISTS home_viewer(id INTEGER PRIMARY KEY,body TEXT); CREATE TABLE IF NOT EXISTS state(id INTEGER PRIMARY KEY,body TEXT); CREATE TABLE IF NOT EXISTS commands(id TEXT PRIMARY KEY,request TEXT,body TEXT); CREATE TABLE IF NOT EXISTS drawings(revision INTEGER PRIMARY KEY,png BLOB NOT NULL); CREATE TABLE IF NOT EXISTS shots(id TEXT PRIMARY KEY,status TEXT,png BLOB,created REAL);`,
    );
    if (
      !(this.db.prepare("PRAGMA table_info(shots)").all() as Data[]).some(
        (r) => r.name === "view",
      )
    )
      this.db.exec(
        "ALTER TABLE shots ADD COLUMN view TEXT NOT NULL DEFAULT 'spectator'",
      );
    this.db
      .prepare("INSERT OR IGNORE INTO state VALUES(1,?)")
      .run(JSON.stringify(initial));
  }
  state(): State {
    return JSON.parse(
      (this.db.prepare("SELECT body FROM state WHERE id=1").get() as Data).body,
    );
  }
  save(state: State) {
    this.db
      .prepare("UPDATE state SET body=? WHERE id=1")
      .run(JSON.stringify(state));
  }
  snapshot(): Data | null {
    const r = this.db
      .prepare("SELECT body FROM home_viewer WHERE id=1")
      .get() as Data | undefined;
    return r ? JSON.parse(r.body) : null;
  }
  transaction<T>(fn: () => T): T {
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
  event(now: number, kind: string, body: Data) {
    this.db
      .prepare("INSERT INTO home_events(at,kind,body) VALUES(?,?,?)")
      .run(now, kind, JSON.stringify(body));
    this.db.exec(
      "DELETE FROM home_events WHERE seq < (SELECT COALESCE(MAX(seq),0)-1000 FROM home_events)",
    );
  }
  viewerAllowed(session: unknown, now: number) {
    const s = this.snapshot();
    return (
      !s || (s.session_id === session && s.visible && now - s.received_at < 6)
    );
  }
  heartbeat(body: unknown, state: State, now: number) {
    requireValue(
      record(body) &&
        !extra(body, ["session_id", "visible", "body", "job_id", "paused"]),
      "Invalid viewer feedback",
    );
    requireValue(
      typeof body.session_id === "string" &&
        length(body.session_id) >= 1 &&
        length(body.session_id) <= 100,
      "Invalid viewer session",
    );
    if ("paused" in body)
      requireValue(typeof body.paused === "boolean", "paused must be boolean");
    requireValue(typeof body.visible === "boolean", "visible must be boolean");
    const a = body.body;
    requireValue(
      record(a) &&
        !extra(a, ["x", "y", "z", "yaw", "pose", "moving"]) &&
        Object.keys(a).length === 6,
      "Invalid body feedback",
    );
    const size = dimensions(state.room),extent=spaceBounds(state.room),
      limits: Data = {
        x: state.room?.balcony?Math.max(Math.abs(extent.minX),Math.abs(extent.maxX))+.2:size.width / 2 + 0.2,
        z: state.room?.balcony?Math.max(Math.abs(extent.minZ),Math.abs(extent.maxZ))+.2:size.depth / 2 + 0.2,
        y: size.height + 0.2,
        yaw: 10,
      };
    for (const k of ["x", "y", "z", "yaw"])
      requireValue(
        typeof a[k] === "number" &&
          Number.isFinite(a[k]) &&
          Math.abs(a[k]) <= limits[k],
        "Invalid body coordinate",
      );
    if(state.room?.balcony)requireValue(regionAt(state.room,a)!==null,"Body is outside interior/balcony");
    requireValue(
      ["stand", "sit", "sleep", "read", "play", "draw", "transition"].includes(a.pose) &&
        typeof a.moving === "boolean",
      "Invalid body pose",
    );
    const previous = this.snapshot();
    if (
      previous &&
      previous.session_id !== body.session_id &&
      previous.visible &&
      now - previous.received_at < 6
    )
      return {
        controller: false,
        owner_age_seconds: now - previous.received_at,
      };
    requireValue(
      body.job_id == null || body.job_id === state.interaction?.id,
      "Stale job feedback",
    );
    this.db
      .prepare("INSERT OR REPLACE INTO home_viewer VALUES(1,?)")
      .run(JSON.stringify({ ...body, received_at: now }));
    return { controller: true, received_at: now };
  }
  feedback(ctx: Context, now: number, since: number) {
    const rows = this.db
        .prepare("SELECT * FROM home_events WHERE seq>? ORDER BY seq LIMIT 100")
        .all(since) as Data[],
      events = rows.map((r) => ({
        seq: r.seq,
        at: r.at,
        kind: r.kind,
        ...JSON.parse(r.body),
      }));
    for (const e of events) {
      if (e.kind === "action_progress") {
        const labels: Data = {
          approaching: "正在走过去。",
          entering: "正在慢慢坐稳、调整姿势。",
          active:
            e.action === "sleep"
              ? "已经躺好。"
              : e.action === "draw" ? "坐在椅子上，拿蜡笔画画。" : e.action === "play" ? "已经坐好，玩具就在手边。" : e.action === "read"
                ? "坐好，开始看书。"
                : "已经坐稳。",
          leaving: e.pose === "read" ? "正在放下书、起身。" : "正在起身。",
          completed: e.action === "walk_to" ? "已经到达。" : "已经站稳。",
          failed: "走不过去或动作未能完成；请查看原因。",
        };
        e.message = labels[e.phase] || "动作状态已更新。";
      } else if (e.kind === "command_accepted")
        e.message =
          e.status === "requested"
            ? "收到请求，等待身体执行。"
            : "家里的设置已更新。";
      else e.message = "这次操作没能执行；请查看原因。";
    }
    const first = (
      this.db.prepare("SELECT MIN(seq) AS seq FROM home_events").get() as Data
    ).seq;
    return {
      ...observe(this.state(), ctx, this.snapshot(), now, events),
      cursor: events.length ? events.at(-1)!.seq : since,
      more: rows.length === 100,
      history_truncated: !!(first && since < first - 1),
    };
  }
  close() {
    this.db.close();
  }
}
