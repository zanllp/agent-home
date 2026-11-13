#!/usr/bin/env node
/**
 * Agent Home 客户端（跑在 dsh-qqbot 容器里，后端在 WSL）。
 *
 *   node tools/agent-home.mjs schemas
 *   node tools/agent-home.mjs state | observe | objects | catalog | presets
 *   node tools/agent-home.mjs call walk_to '{"x":1,"z":0}'
 *   node tools/agent-home.mjs screenshot character --out /workspace/output/home.png
 *
 * 后端只接受 Host: localhost，所以这里用 node:http 手动设置 Host 头。
 * 注意：只读工具走 GET 接口，写操作才走 POST /api/commands。
 */
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const BASE = new URL(process.env.AGENT_HOME_URL || "http://127.0.0.1:19130");
const READS = {
  outdoors: "/api/outdoors",
  schemas: "/api/tool-schemas",
  state: "/api/state",
  observe: "/api/observe",
  catalog: "/api/catalog",
  objects: "/api/objects",
  presets: "/api/presets",
  viewer: "/api/viewer",
  tools: "/api/tools",
  interactables: "/api/interactions",
};
// 模型可能按 schema 里的工具名来调只读工具，这里做个别名
const READ_ALIAS = {
  get_outdoors: "outdoors",
  get_state: "state",
  observe_home: "observe",
  get_catalog: "catalog",
  list_objects: "objects",
  get_presets: "presets",
  list_interactions: "interactables",
};

function rawRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : JSON.stringify(body);
    const headers = { host: "localhost" };
    if (data) {
      headers["content-type"] = "application/json";
      headers["content-length"] = Buffer.byteLength(data);
    }
    const req = http.request(
      { hostname: BASE.hostname, port: BASE.port || 80, path, method, headers, timeout: 20000 },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, buffer: Buffer.concat(chunks) }));
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function request(method, path, body) {
  const r = await rawRequest(method, path, body);
  let parsed;
  try {
    parsed = JSON.parse(r.buffer.toString("utf8"));
  } catch {
    parsed = r.buffer.toString("utf8");
  }
  return { status: r.status, body: parsed };
}

const BUSY = new Set(["requested", "approaching", "entering", "active", "leaving"]);
const BODY_ACTIONS = new Set(["sit", "lie", "sleep", "read", "play", "draw", "water"]);

export class ActionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

function checked(response) {
  if (response.status >= 400 || response.body?.ok === false) {
    throw new ActionError("request_failed", response.body?.error || "请求失败", { status: response.status });
  }
  return response.body;
}

// Matching the accepted job and a newer body sample matters more than polling faster.
export async function waitForJob(request, expected, {
  timeoutMs = 25000,
  now = Date.now, sleep = ms => new Promise(r => setTimeout(r, ms)),
} = {}) {
  if (!expected?.id) throw new ActionError("missing_job", "响应里没有本次动作编号");
  const deadline = now() + timeoutMs;
  let last = null;
  while (now() < deadline) {
    last = checked(await request("GET", "/api/observe"));
    const job = last.job;
    if (job && job.id !== expected.id) {
      throw new ActionError("superseded", "动作已被另一个任务替换", { job_id: expected.id, observe: last });
    }
    if (job?.phase === "failed" || job?.phase === "cancelled") {
      throw new ActionError(job.phase, job.error || "动作未完成", { job_id: expected.id, observe: last });
    }
    if (last.execution?.paused) {
      throw new ActionError("paused", "小家暂停了，请先恢复页面", { job_id: expected.id, observe: last });
    }
    const matchingBody = last.fresh === true && last.body_job_id === expected.id;
    if (job?.id === expected.id && matchingBody) {
      const body = last.body;
      const arrived = ["walk_to", "leave", "water"].includes(expected.action) && job.phase === "completed" && body?.pose === "stand" && body.moving === false &&
        (expected.action !== "walk_to" || (expected.target &&
          Math.hypot(body.x - expected.target.x, body.z - expected.target.z) <= .08));
      const holding = job.phase === "active" && BODY_ACTIONS.has(expected.action) &&
        body?.pose === expected.pose && body.moving === false;
      if (arrived || holding) return last;
    }
    await sleep(Math.min(200, Math.max(0, deadline - now())));
  }
  throw new ActionError(last?.fresh === false ? "viewer_unavailable" : "timeout",
    last?.fresh === false ? "没有新鲜的身体反馈，动作尚未确认" : "等待超时，动作尚未确认",
    { job_id: expected.id, observe: last });
}

export function createActions(request) {
  async function command(tool, args) {
    const st = checked(await request("GET", "/api/state"));
    const response = await request("POST", "/api/commands", {
      id: crypto.randomUUID(), expected_revision: st.revision, tool, arguments: args,
    });
    return { body: checked(response) };
  }
  async function wait(result, timeoutMs) {
    return waitForJob(request, result.body.state?.interaction, { timeoutMs });
  }
  async function clearJob() {
    const feedback = checked(await request("GET", "/api/observe")), job = feedback.job;
    if (!job || !BUSY.has(job.phase)) return;
    if (job.action === "leave") {
      await waitForJob(request, job, { timeoutMs: 15000 });
      return;
    }
    const result = await command("cancel_action", { job_id: job.id });
    await wait(result, 15000);
  }
  async function goto(x, z) {
    await clearJob();
    const result = await command("walk_to", typeof x === "string" && z === undefined ? {target_id:x} : { x, z });
    // Never send exploratory movement commands or silently change the user's destination.
    const feedback = await wait(result, 60000);
    return { ok: true, target: result.body.state.interaction.target, target_id: result.body.state.interaction.target_id ?? null, observe: feedback };
  }
  async function doAction(targetId, action) {
    if (BODY_ACTIONS.has(action)) {
      const {body:state}=await request("GET","/api/state"),old=state.interaction;
      const sameSofa=old?.target_id===targetId && old.phase==="active" &&
        ["sit","lie","sleep"].includes(old.pose) && ["sit","lie","sleep"].includes(action) &&
        state.objects.find(o=>o.id===targetId)?.kind==="sofa";
      if (!sameSofa) await clearJob();
    }
    const result = await command("interact", { target_id: targetId, action });
    if (!BODY_ACTIONS.has(action) && action !== "leave") return { ...result.body, target_id: targetId, action };
    const feedback = await wait(result, 60000);
    return { ok: true, target_id: targetId, action, observe: feedback };
  }
  return { command, goto, doAction };
}
const actions = createActions(request);


function out(v) {
  console.log(JSON.stringify(v, null, 2));
}

async function screenshot(view, output) {
  const v = view === "character" || view === "spectator" ? view : "spectator";
  const created = await request("POST", "/api/screenshots", { view: v });
  if (created.status >= 400 || !created.body?.id) {
    out({ status: created.status, ...(created.body || {}) });
    process.exit(1);
  }
  const id = created.body.id;
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const r = await rawRequest("GET", `/api/screenshots/${id}`);
    if (r.status === 200 && r.buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
      fs.writeFileSync(output, r.buffer);
      out({ ok: true, file: output, bytes: r.buffer.length, view: v });
      return;
    }
    if (r.status === 410) {
      out({ status: 410, error: "screenshot expired" });
      process.exit(1);
    }
    await new Promise((res) => setTimeout(res, 700));
  }
  out({ status: 408, error: "screenshot timeout (viewer 没取走截图)" });
  process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(resolve(process.argv[1]))).href) {
const [cmd, ...rest] = process.argv.slice(2);
try {
  if (!cmd || cmd === "help") {
    console.log("用法: node tools/agent-home.mjs <schemas|state|observe|objects|catalog|presets|interactables|do TARGET ACTION|goto X Z|goto OBJECT_ID|screenshot [character|spectator] --out FILE|call TOOL JSON>");
    process.exit(0);
  }
  if (cmd in READS) {
    const r = await request("GET", READS[cmd]);
    out(r.body);
    process.exit(r.status >= 400 ? 1 : 0);
  }
  if (cmd === "do") {
    if (!rest[0] || !rest[1]) throw new Error("用法: do TARGET_ID ACTION");
    out(await actions.doAction(rest[0], rest[1]));
    process.exit(0);
  }
  if (cmd === "goto") {
    if (rest.length === 1 && rest[0].trim()) out(await actions.goto(rest[0]));
    else {
      const x = Number(rest[0]), z = Number(rest[1]);
      if (rest.length !== 2 || !rest[0].trim() || !rest[1].trim() || !Number.isFinite(x) || !Number.isFinite(z)) throw new Error("用法: goto X Z 或 goto OBJECT_ID");
      out(await actions.goto(x, z));
    }
    process.exit(0);
  }
  if (cmd === "screenshot") {
    const view = rest.find((a) => a === "character" || a === "spectator") || "spectator";
    const i = rest.indexOf("--out");
    const output = i >= 0 && rest[i + 1] ? rest[i + 1] : "/workspace/output/agent-home-shot.png";
    await screenshot(view, output);
    process.exit(0);
  }
  if (cmd === "call") {
    const tool = rest[0];
    if (!tool) throw new Error("缺少 tool 名");
    if (tool in READ_ALIAS) {
      const args = rest[1] ? JSON.parse(rest[1]) : {};
      const filterable = ["list_interactions", "list_objects"].includes(tool);
      if (filterable && (!args || Array.isArray(args) || typeof args !== "object" || Object.keys(args).some(k=>!["category","capability"].includes(k)) || Object.values(args).some(v=>typeof v!=="string"))) throw new Error("列表筛选只接受 category 和 capability 字符串");
      const query = filterable ? new URLSearchParams(args).toString() : "";
      const r = await request("GET", READS[READ_ALIAS[tool]] + (query ? "?"+query : ""));
      out(r.body);
      process.exit(r.status >= 400 ? 1 : 0);
    }
    if (tool === "screenshot") {
      let args = {};
      if (rest[1]) args = JSON.parse(rest[1]);
      await screenshot(args.view, args.out || "/workspace/output/agent-home-shot.png");
      process.exit(0);
    }
    const wait = rest.includes("--wait");
    const argText = rest[1] && rest[1] !== "--wait" ? rest[1] : null;
    let args = {};
    if (argText) args = JSON.parse(argText);
    const result = await actions.command(tool, args);
    if (wait && (tool === "walk_to" || tool === "cancel_action" ||
        (tool === "interact" && (BODY_ACTIONS.has(args.action) || args.action === "leave")))) {
      const observe = await waitForJob(request, result.body.state?.interaction, { timeoutMs: 60000 });
      out({ ...result.body, observe });
    } else out(result.body);
    process.exit(0);
  }
  throw new Error(`未知命令: ${cmd}`);
} catch (e) {
  out({ ok: false, error: e.message || String(e), code: e.code || "client_error", ...e.details });
  process.exit(1);
}
}
