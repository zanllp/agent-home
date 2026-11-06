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

const BASE = new URL(process.env.AGENT_HOME_URL || "http://127.0.0.1:19130");
const READS = {
  schemas: "/api/tool-schemas",
  state: "/api/state",
  observe: "/api/observe",
  catalog: "/api/catalog",
  objects: "/api/objects",
  presets: "/api/presets",
  viewer: "/api/viewer",
  tools: "/api/tools",
};
// 模型可能按 schema 里的工具名来调只读工具，这里做个别名
const READ_ALIAS = {
  get_state: "state",
  observe_home: "observe",
  get_catalog: "catalog",
  list_objects: "objects",
  get_presets: "presets",
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

async function waitJob(timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    const r = await request("GET", "/api/observe");
    last = r.body || {};
    const job = last.job;
    if (!job) return last;
    const phase = job.phase || job.status;
    if (["done", "completed", "error", "failed", "cancelled"].includes(phase)) return last;
    // 坐下/睡觉这类是持续姿态：pose 对上就算完成，不等 job 结束
    const pose = last.body && last.body.pose;
    const holding = phase === "active" && job.pose && pose === job.pose && !["leave", "cancel"].includes(job.action);
    if (holding) return last;
    await new Promise((res) => setTimeout(res, 400));
  }
  return last;
}

async function command(tool, args) {
  const st = await request("GET", "/api/state");
  if (st.status !== 200) throw new Error(`读 state 失败: ${st.status}`);
  return request("POST", "/api/commands", {
    id: crypto.randomUUID(),
    expected_revision: st.body.revision,
    tool,
    arguments: args,
  });
}

async function clearJob() {
  const first = (await request("GET", "/api/observe")).body || {};
  const job = first.job;
  if (!job) return;
  const pose = first.body && first.body.pose;
  const seated = ["sit", "sleep", "read", "play", "draw"].includes(job.action) && pose && pose !== "stand";
  if (seated && job.target_id) {
    await command("interact", { target_id: job.target_id, action: "leave" });
  } else if (job.id) {
    await command("cancel_action", { job_id: job.id });
  }
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    const o = (await request("GET", "/api/observe")).body || {};
    if (!o.job) return;
    await new Promise((r) => setTimeout(r, 400));
  }
}

async function goto(x, z) {
  await clearJob();
  let walked = await command("walk_to", { x, z });
  if (walked.status >= 400) {
    // 目标点被家具占了：在附近螺旋找最近的空位
    const offsets = [];
    for (let r = 0.4; r <= 1.6; r += 0.4) {
      for (const [dx, dz] of [[r,0],[-r,0],[0,r],[0,-r],[r,r],[-r,r],[r,-r],[-r,-r]]) {
        offsets.push([dx, dz]);
      }
    }
    for (const [dx, dz] of offsets) {
      const alt = await command("walk_to", { x: x + dx, z: z + dz });
      if (alt.status < 400) { walked = alt; break; }
    }
  }
  if (walked.status >= 400) {
    out({ status: walked.status, step: "walk_to", ...(walked.body || {}) });
    process.exit(1);
  }
  const fb = await waitJob(15000);
  out({ ok: true, target: { x, z }, observe: fb });
}

async function interactables() {
  const r = await request("GET", "/api/objects");
  const items = (r.body && (r.body.objects || r.body)) || [];
  const rows = [];
  for (const o of items) {
    const acts = (o.actions || []).filter((a) => a.available);
    if (!acts.length) continue;
    rows.push({
      id: o.id,
      label: o.label || o.kind,
      actions: acts.map((a) => `${a.id}(${a.label})`).join(", "),
    });
  }
  out({ count: rows.length, interactables: rows });
}

async function doAction(targetId, action) {
  await clearJob();
  const r = await command("interact", { target_id: targetId, action });
  if (r.status >= 400) {
    out({ status: r.status, step: "interact", ...(r.body || {}) });
    process.exit(1);
  }
  const fb = await waitJob(25000);
  out({ ok: true, target_id: targetId, action, observe: fb });
}

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

const [cmd, ...rest] = process.argv.slice(2);
try {
  if (!cmd || cmd === "help") {
    console.log("用法: node tools/agent-home.mjs <schemas|state|observe|objects|catalog|presets|interactables|do TARGET ACTION|goto X Z|screenshot [character|spectator] --out FILE|call TOOL JSON>");
    process.exit(0);
  }
  if (cmd in READS) {
    const r = await request("GET", READS[cmd]);
    out(r.body);
    process.exit(r.status >= 400 ? 1 : 0);
  }
  if (cmd === "interactables") {
    await interactables();
    process.exit(0);
  }
  if (cmd === "do") {
    if (!rest[0] || !rest[1]) throw new Error("用法: do TARGET_ID ACTION");
    await doAction(rest[0], rest[1]);
    process.exit(0);
  }
  if (cmd === "goto") {
    const x = Number(rest[0]);
    const z = Number(rest[1]);
    if (!Number.isFinite(x) || !Number.isFinite(z)) throw new Error("用法: goto X Z");
    await goto(x, z);
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
      const r = await request("GET", READS[READ_ALIAS[tool]]);
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
    const st = await request("GET", "/api/state");
    if (st.status !== 200) throw new Error(`读 state 失败: ${st.status}`);
    const r = await request("POST", "/api/commands", {
      id: crypto.randomUUID(),
      expected_revision: st.body.revision,
      tool,
      arguments: args,
    });
    out({ status: r.status, ...(typeof r.body === "object" ? r.body : { raw: r.body }) });
    if (wait && r.status < 400) {
      const fb = await waitJob();
      out({ observe: fb });
    }
    process.exit(r.status >= 400 ? 1 : 0);
  }
  throw new Error(`未知命令: ${cmd}`);
} catch (e) {
  console.error("ERR " + (e && e.message ? e.message : String(e)));
  process.exit(1);
}