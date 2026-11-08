import {outdoorService} from './outdoors.mjs';
import { launchRunner, browserBinary } from "./browser-runner.js";
import { LiveRoom } from "./live-room.js";
import { performanceLog } from "./perf-log.js";
import { createServer, type IncomingMessage } from "node:http";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { HouseApp, loadContext, type Reply } from "./app.js";
const root =
  process.env.HOUSE_ROOT ||
  fileURLToPath(new URL("../house3d/", import.meta.url));
const web =
  process.env.HOUSE_WEB_ROOT ||
  fileURLToPath(new URL("./web/", import.meta.url));
const port = Number(process.env.HOUSE_PORT || 19130);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw Error("HOUSE_PORT must be an integer between 1 and 65535");
const enabled =
  process.env.HOUSE_RUNNER !== "0" && !process.argv.includes("--no-runner");
const binary = enabled ? browserBinary() : null;
const db = process.env.HOUSE_DB || resolve(root, "data/house.sqlite");
const metrics = performanceLog(
  process.env.HOUSE_LOG_DIR || resolve(dirname(db), "logs")
);
const outdoors=outdoorService({weather:process.env.HOUSE_WEATHER,daylight:process.env.HOUSE_DAYLIGHT});
const live = new LiveRoom(enabled, metrics.log);
let runner: ReturnType<typeof launchRunner> | undefined;
const jobs = new Map<string, number>();
const app = new HouseApp(loadContext(root), db, root, web);
const server = createServer(async (req, res) => {
  const reply = (r: Reply) => {
    const bytes =
      r.bytes ??
      Buffer.from(JSON.stringify(r.body ?? { error: "Request rejected" }));
    res.writeHead(r.status, {
      "Content-Type": r.type || "application/json; charset=utf-8",
      "Content-Length": bytes.length,
      "X-Content-Type-Options": "nosniff",
    });
    res.end(req.method === "HEAD" ? undefined : bytes);
  };
  try {
    const host = req.headers.host || "";
    if (
      !["127.0.0.1", "localhost"].includes(host.split(":")[0]) ||
      (req.headers.origin && req.headers.origin !== "http://" + host)
    ) {
      reply({ status: 403, body: { error: "Local origin only" } });
      return;
    }
    const path = new URL(req.url || "/", "http://localhost").pathname;
    if (req.method === "GET" && path === "/api/runtime/stream" && enabled) {
      live.stream(res);
      return;
    }
    if(req.method==='GET'&&path==='/api/outdoors'){reply({status:200,body:await outdoors()});return}
    const chunks: Buffer[] = [];
    let length = 0;
    for await (const chunk of req) {
      length += chunk.length;
      if (length > 5 * 1024 * 1024) {
        reply({ status: 413, body: { error: "Request body exceeds 5 MiB" } });
        req.resume();
        return;
      }
      chunks.push(Buffer.from(chunk));
    }
    const bytes = Buffer.concat(chunks);
    let body: unknown;
    if (
      bytes.length &&
      (req.headers["content-type"] || "").split(";")[0] === "application/json"
    ) {
      try {
        body = JSON.parse(bytes.toString("utf8"));
      } catch {
        reply({ status: 400, body: { error: "Invalid JSON" } });
        return;
      }
    }
    const headers = Object.fromEntries(
      Object.entries(req.headers).map(([k, v]) => [
        k,
        Array.isArray(v) ? v.join(",") : v,
      ])
    );
    const input = {
      method: req.method || "GET",
      url: req.url || "/",
      headers,
      body,
      bytes,
    };
    const result = live.handle(input, path) ?? app.handle(input);
    if (result.status === 200 && enabled && path === "/api/observe") {
      result.body.execution = {
        ...result.body.execution,
        requires_visible_viewer: false,
        executor: "runner",
        runner_online: live.fresh,
      };
    }
    if (result.status === 200 && enabled && path === "/api/catalog") {
      result.body.viewer.executor = "runner";
      result.body.limitations = result.body.limitations.map((s: string) =>
        s === "Screenshot requires an open visible house page"
          ? "Screenshot requires an online local Runner"
          : s
      );
    }
    if (req.method === "POST" && result.status < 300) {
      const job = result.body?.state?.interaction;
      if (
        path === "/api/commands" &&
        job?.id === (body as any)?.id &&
        !jobs.has(job.id)
      ) {
        if (jobs.size >= 128) jobs.delete(jobs.keys().next().value!);
        jobs.set(job.id, performance.now());
        metrics.log("action_accepted", { job: job.id, action: job.action });
      }
      const m = /^\/api\/interactions\/([^/]+)\/progress$/.exec(path);
      if (m) {
        const phase = (body as any)?.phase,
          t = jobs.get(m[1]);
        metrics.log("action_progress", {
          job: m[1],
          phase,
          since_accept_ms: t === undefined ? null : performance.now() - t,
        });
        if (["active", "failed", "completed"].includes(phase))
          jobs.delete(m[1]);
      }
    }
    reply(result);
  } catch (e) {
    console.error("House request failed:", (e as Error).message);
    if (!res.headersSent)
      reply({ status: 500, body: { error: "Internal server error" } });
    else res.end();
  }
});
server.requestTimeout = 15000;
server.headersTimeout = 10000;
server.on("error", (error) => {
  console.error("Could not start Agent Home:", error.message);
  app.close();
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", () => {
  console.log(
    `Agent Home: http://127.0.0.1:${port}/ (${
      enabled ? "headless runner" : "visible viewer"
    })`
  );
  if (binary) {
    runner = launchRunner(
      binary,
      `http://127.0.0.1:${port}/wander.html#runner=${live.key}`,
      (reason) => {
        live.lastFrameAt = 0;
        metrics.log("runner_exit", { reason });
        console.error("Runner 已退出，动作执行不可用:", reason);
      }
    );
    metrics.log("runner_start", { pid: runner.pid });
  }
});
let closing = false;
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.on(signal, async () => {
    if (closing) return;
    closing = true;
    const closed = new Promise<void>((done) => server.close(() => done()));
    live.close();
    await runner?.stop();
    await closed;
    metrics.close();
    app.close();
    process.exit(0);
  });
