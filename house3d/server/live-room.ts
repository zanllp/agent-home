import type { ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import type { Input, Reply } from "./app.js";
type Log = (event: string, fields?: Record<string, unknown>) => void;
export class LiveRoom {
  readonly key = randomUUID();
  private clients = new Set<ServerResponse>();
  private latest: unknown = null;
  lastFrameAt = 0;
  controls: {
    paused?: boolean;
    brisk?: boolean;
    pausedRev?: number;
    briskRev?: number;
    revision: number;
  } = { revision: 0 };
  private reports = new Map<string, number>();
  constructor(readonly enabled: boolean, readonly log: Log) {}
  stream(res: ServerResponse) {
    if (this.clients.size >= 32) {
      res.writeHead(429);
      res.end();
      return;
    }
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    });
    res.write(": connected\n\n");
    if (this.fresh) res.write("data: " + JSON.stringify(this.latest) + "\n\n");
    this.clients.add(res);
    res.on("close", () => this.clients.delete(res));
  }
  get fresh() {
    return Boolean(this.lastFrameAt && Date.now() - this.lastFrameAt < 6000);
  }
  close() {
    for (const r of this.clients) r.end();
    this.clients.clear();
  }
  handle(i: Input, path: string): Reply | undefined {
    const owner = this.enabled && i.headers["x-house-runner"] === this.key,
      post = i.method === "POST";
    if (path === "/api/runtime" && i.method === "GET")
      return {
        status: 200,
        body: { runner: this.enabled, online: this.fresh },
      };
    if (path === "/api/runtime/perf" && post) {
      const b = i.body as any;
      if (
        !b ||
        typeof b.session !== "string" ||
        !/^[-\w]{1,64}$/.test(b.session)
      )
        return { status: 400 };
      const now = Date.now();
      for (const [k, t] of this.reports)
        if (now - t > 60000) this.reports.delete(k);
      const rateKey = b.session + (b.stall_ms !== undefined ? ":stall" : "");
      if (
        (!this.reports.has(rateKey) && this.reports.size >= 128) ||
        now - (this.reports.get(rateKey) || 0) < 5000
      )
        return { status: 429 };
      const data: Record<string, unknown> = {
        session: b.session,
        role: owner ? "runner" : this.enabled ? "viewer" : "local",
      };
      for (const k of [
        "window_ms",
        "ticks",
        "active_ticks",
        "frames",
        "shadow_frames",
        "calls",
        "triangles",
        "frame_p95_ms",
        "submit_ms",
        "gpu_sample_ms",
        "gpu_samples",
        "long_frames",
        "screenshots",
        "reconnects",
        "capture_ms",
        "sync_errors",
        "stall_ms",
        "buffer_width",
        "buffer_height",
      ]) {
        if (typeof b[k] === "number" && Number.isFinite(b[k]) && b[k] >= 0)
          data[k] = b[k];
      }
      this.reports.set(rateKey, now);
      this.log(data.stall_ms === undefined ? "browser" : "frame_stall", data);
      return { status: 200, body: { ok: true } };
    }
    if (!this.enabled) return;
    if (path === "/api/runtime/control" && post) {
      const b = i.body as any;
      if (
        !b ||
        Object.keys(b).length !== 1 ||
        !["paused", "brisk"].includes(Object.keys(b)[0]) ||
        typeof Object.values(b)[0] !== "boolean"
      )
        return { status: 400 };
      if (!this.fresh)
        return { status: 409, body: { error: "Runner 尚未就绪" } };
      this.controls = {
        ...this.controls,
        ...b,
        [Object.keys(b)[0] + "Rev"]: this.controls.revision + 1,
        revision: this.controls.revision + 1,
      };
      return { status: 200, body: { ok: true } };
    }
    if (path === "/api/runtime/fault" && post && owner) {
      const message = String((i.body as any)?.message || "Initialization error")
        .replaceAll(this.key, "[runner]")
        .slice(0, 300);
      this.log("runner_error", { message });
      console.error("Runner:", message);
      return { status: 200, body: { ok: true } };
    }
    if (path === "/api/runtime/frame" && post) {
      if (!owner) return { status: 403 };
      if (!i.body || JSON.stringify(i.body).length > 32768)
        return { status: 400 };
      if (!this.fresh) this.log("runner_connected");
      this.latest = i.body;
      this.lastFrameAt = Date.now();
      const msg = "data: " + JSON.stringify(this.latest) + "\n\n";
      for (const r of this.clients) if (!r.write(msg)) r.destroy();
      return {
        status: 200,
        body: { ...this.controls, watchers: this.clients.size },
      };
    }
    if (
      !owner &&
      ((post &&
        (path === "/api/viewer" ||
          /^\/api\/interactions\/[^/]+\/progress$/.test(path) ||
          /^\/api\/screenshots\/[^/]+$/.test(path))) ||
        path === "/api/screenshots/pending")
    )
      return {
        status: 403,
        body: {
          error: "Only the local Runner may execute actions or upload captures",
        },
      };
  }
}
