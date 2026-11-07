import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { createServer } from "node:net";
import { request as httpRequest } from "node:http";
import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
import { createHash } from "node:crypto";
import { unzipSync } from "fflate";
import { DatabaseSync } from "node:sqlite";
import { HouseApp, loadContext } from "../runtime/test-app.mjs";
const root = resolve("house3d"),
  ctx = loadContext(root),
  web = resolve("runtime/web");
function command(
  app,
  tool,
  args = {},
  id = "one",
  revision = app.store.state().revision,
) {
  return app.handle({
    method: "POST",
    url: "/api/commands",
    headers: { host: "localhost" },
    body: { id, expected_revision: revision, tool, arguments: args },
  });
}
function request(app, url, body, headers = {}) {
  return app.handle({
    method: body === undefined ? "GET" : "POST",
    url,
    headers: { host: "localhost", ...headers },
    body,
  });
}

test("legacy SQLite schema and Python-encoded cached commands survive reopening", () => {
  const folder = mkdtempSync(join(tmpdir(), "agent-home-sqlite-")),
    path = join(folder, "old.sqlite");
  try {
    const db = new DatabaseSync(path);
    db.exec(
      "CREATE TABLE state(id INTEGER PRIMARY KEY,body TEXT);CREATE TABLE commands(id TEXT PRIMARY KEY,request TEXT,body TEXT);CREATE TABLE shots(id TEXT PRIMARY KEY,status TEXT,png BLOB,created REAL)",
    );
    const state = structuredClone(ctx.defaultState);
    state.revision = 1;
    state.note = "旧存档";
    const payload = {
      id: "old-command",
      expected_revision: 0,
      tool: "set_note",
      arguments: { text: "旧存档" },
    };
    db.prepare("INSERT INTO state VALUES(1,?)").run(JSON.stringify(state));
    db.prepare("INSERT INTO commands VALUES(?,?,?)").run(
      "old-command",
      '{"arguments": {"text": "旧存档"}, "expected_revision": 0, "id": "old-command", "tool": "set_note"}',
      JSON.stringify({ ok: true, state }),
    );
    db.close();
    const app = new HouseApp(ctx, path, root, web);
    try {
      assert.equal(app.store.state().note, "旧存档");
      assert.ok(
        app.store.db
          .prepare("PRAGMA table_info(shots)")
          .all()
          .some((r) => r.name === "view"),
      );
      assert.equal(
        command(app, "set_note", { text: "旧存档" }, "old-command", 0).status,
        200,
      );
      assert.equal(app.store.state().revision, 1);
      assert.equal(
        app.store.db.prepare("select count(*) n from home_events").get().n,
        0,
      );
    } finally {
      app.close();
    }
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("explicit null arguments and prototype names cannot bypass validation", () => {
  const app = new HouseApp(ctx, ":memory:", root, web);
  try {
    for (const [tool, args] of [
      ["update_layout", null],
      ["set_note", null],
      ["apply_preset", { preset_id: "constructor" }],
      ["set_wallpaper", { wall_id: "all", wallpaper_id: "__proto__" }],
      ["set_wallpaper", { wall_id: "all", wallpaper_id: ["plain"] }],
      ["apply_preset", { preset_id: "childroom", dry_run: null }],
      ["update_room", { width: 8, dry_run: null }],
      [["set_note"], { text: "bad" }],
    ]) {
      assert.equal(
        command(app, tool, args).status,
        400,
        JSON.stringify([tool, args]),
      );
      assert.equal(app.store.state().revision, 0);
    }
  } finally {
    app.close();
  }
});

test("durable event cursor stays monotonic when bounded history is pruned", () => {
  const app = new HouseApp(ctx, ":memory:", root, web);
  try {
    for (let n = 0; n < 1010; n++)
      app.store.event(n, "command_accepted", {
        action: "set_note",
        status: "applied",
      });
    const a = app.store.feedback(ctx, 1011, 0);
    assert.equal(a.history_truncated, true);
    assert.equal(a.events.length, 100);
    assert.equal(a.more, true);
    const b = app.store.feedback(ctx, 1011, 1009);
    assert.equal(b.events[0].seq, 1010);
  } finally {
    app.close();
  }
});

test("no external runtime imports remain in the compiled backend or CLI", () => {
  for (const name of ["runtime/server.mjs", "runtime/agent.mjs"]) {
    const code = readFileSync(name, "utf8");
    for (const [, specifier] of code.matchAll(
      /(?:from\s*|import\s*)["']([^"']+)["']/g,
    ))
      assert.ok(specifier.startsWith("node:"), name + ": " + specifier);
    assert.ok(!code.includes("child_process.exec"));
  }
});

test("published-shaped ZIP runs with only Node: no Python, npm, node_modules, or build", async (t) => {
  const version = JSON.parse(readFileSync("package.json")).version,
    file = resolve("artifacts", `agent-home-${version}-node.zip`);
  assert.ok(
    existsSync(file),
    "Run npm run package before the complete release check",
  );
  const zipped = readFileSync(file),
    archive = unzipSync(zipped),
    folder = mkdtempSync(join(tmpdir(), "agent-home-node-only-"));
  for (const [name, bytes] of Object.entries(archive)) {
    assert.ok(!name.endsWith(".py"));
    assert.ok(!name.includes("node_modules"));
    assert.ok(!name.includes("/data/"));
    assert.ok(!name.includes(".."));
    const path = join(folder, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, bytes);
  }
  const manifest = JSON.parse(
    readFileSync(join(folder, "package-manifest.json")),
  );
  for (const [name, expected] of Object.entries(manifest.files)) {
    const bytes = readFileSync(join(folder, name));
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      expected.sha256,
      name,
    );
  }
  const probe = createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  let output = "";
  const child = spawn(process.execPath, [join(folder, "start.mjs")], {
    cwd: folder,
    env: {
      ...process.env,
      PATH: "",
      NODE_PATH: "",
      HOUSE_PORT: String(port),
      HOUSE_RUNNER: "0",
      HOUSE_DB: join(folder, "house3d/data/house.sqlite"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (b) => (output += b));
  child.stderr.on("data", (b) => (output += b));
  const url = `http://127.0.0.1:${port}`;
  const api = async (path, body) => {
    const r = await fetch(url + path, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, body: await r.json() };
  };
  try {
    const deadline = Date.now() + 10000;
    let ready = false;
    while (Date.now() < deadline) {
      try {
        const s = await api("/api/state");
        ready = s.status === 200;
        if (ready) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 40));
    }
    assert.ok(ready, output);
    assert.ok(existsSync(join(folder, "SKILL.md")));
    const clientObservation = JSON.parse(execFileSync(process.execPath,
      [join(folder, "tools/agent-home.mjs"), "observe"],
      {cwd: folder, env: {...process.env, PATH: "", NODE_PATH: "", AGENT_HOME_URL: url}, encoding: "utf8"}));
    assert.equal(clientObservation.body_job_id, null);
    assert.equal(clientObservation.fresh, false);
    assert.equal((await fetch(url + "/")).status, 200);
    assert.equal(
      await new Promise((resolve, reject) => {
        const r = httpRequest(
          url + "/api/state",
          { headers: { Host: "evil.example" } },
          (response) => {
            response.resume();
            resolve(response.statusCode);
          },
        );
        r.on("error", reject);
        r.end();
      }),
      403,
    );
    assert.equal(
      (
        await fetch(url + "/api/commands", {
          method: "POST",
          headers: {
            Origin: "https://evil.example",
            "Content-Type": "application/json",
          },
          body: "{}",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(url + "/api/commands", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{",
        })
      ).status,
      400,
    );
    const edit = (tool, args, id, revision) =>
      api("/api/commands", {
        id,
        expected_revision: revision,
        tool,
        arguments: args,
      });
    const preview = await edit(
      "apply_preset",
      { preset_id: "family-home", dry_run: true },
      "preview",
      0,
    );
    assert.equal(preview.body.applied, false);
    assert.equal((await api("/api/state")).body.revision, 0);
    const apply = await edit(
      "apply_preset",
      { preset_id: "family-home", dry_run: false },
      "family",
      0,
    );
    assert.equal(apply.body.state.objects.length, 79);
    assert.equal(apply.body.state.room.balcony.depth,2);
    assert.ok(apply.body.state.objects.some(o=>o.id==='balcony-drying-rack'));
    assert.equal(apply.body.state.room.width, 8);
    assert.equal(
      (
        await edit(
          "apply_preset",
          { preset_id: "family-home", dry_run: false },
          "family",
          0,
        )
      ).body.state.revision,
      1,
    );
    const listed = JSON.parse(execFileSync(process.execPath,
      [join(folder, "tools/agent-home.mjs"), "call", "list_interactions", '{"capability":"draw"}'],
      {cwd:folder,env:{...process.env,PATH:"",NODE_PATH:"",AGENT_HOME_URL:url},encoding:"utf8"}));
    assert.ok(listed.objects.length > 0);
    assert.ok(listed.objects.every(o=>o.actions.every(a=>a.id==="draw" && a.command.tool==="interact" && !a.available)));
    const primaryList = JSON.parse(execFileSync(process.execPath,
      [join(folder,"agent.mjs"),"list_interactions",'{"capability":"draw"}',"--url",url],
      {cwd:folder,env:{...process.env,PATH:"",NODE_PATH:""},encoding:"utf8"}));
    assert.deepEqual(primaryList.objects,listed.objects);

    const cat = (await api("/api/catalog")).body;
    for (const asset of Object.values(cat.assets)) {
      const r = await fetch(url + asset.model, { method: "HEAD" });
      assert.equal(r.status, 200, asset.model);
    }
    const shot = await api("/api/screenshots", { view: "character" });
    const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const upload = await fetch(url + shot.body.url, {
      method: "POST",
      headers: { "Content-Type": "image/png", "X-House-Viewer": "life-v2" },
      body: bytes,
    });
    assert.equal(upload.status, 200);
    assert.deepEqual(
      Buffer.from(await (await fetch(url + shot.body.url)).arrayBuffer()),
      bytes,
    );
    const cli = spawn(
      process.execPath,
      [join(folder, "agent.mjs"), "get_state", "--url", url],
      {
        env: { ...process.env, PATH: "", NODE_PATH: "" },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let result = "";
    cli.stdout.on("data", (b) => (result += b));
    const [code] = await once(cli, "exit");
    assert.equal(code, 0);
    assert.equal(JSON.parse(result).room.width, 8);
    assert.equal(
      (
        await fetch(url + "/api/commands", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "x".repeat(5 * 1024 * 1024 + 512),
        })
      ).status,
      413,
    );
    assert.ok(existsSync(join(folder, "house3d/data/house.sqlite")));
    assert.ok(zipped.length < 100_000_000);
    assert.ok(
      Object.values(archive).reduce((n, b) => n + b.length, 0) < 100_000_000,
    );
  } finally {
    child.kill("SIGTERM");
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(Error("Server did not exit cleanly"));
      }, 4000);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
    rmSync(folder, { recursive: true, force: true });
  }
});

test("malformed preview flags never add durable rejection events", () => {
  const app = new HouseApp(ctx, ":memory:", root, web);
  try {
    for (const tool of ["update_layout", "apply_preset", "update_room"]) {
      const args =
        tool === "update_layout"
          ? { operations: [], dry_run: null }
          : tool === "apply_preset"
            ? { preset_id: "childroom", dry_run: null }
            : { width: 8, dry_run: null };
      assert.equal(command(app, tool, args).status, 400);
      assert.equal(app.store.state().revision, 0);
      assert.equal(
        app.store.db.prepare("SELECT count(*) n FROM home_events").get().n,
        0,
      );
      assert.equal(
        app.store.db.prepare("SELECT count(*) n FROM commands").get().n,
        0,
      );
    }
  } finally {
    app.close();
  }
});


test("observation exposes the body sample's job, not the newer requested job", () => {
  const app = new HouseApp(ctx, ":memory:", root, web);
  try {
    const feedback = (job_id) => request(app, "/api/viewer", {
      session_id: "client-verification", visible: true, job_id,
      body: {x:0,y:0,z:0,yaw:0,pose:"stand",moving:false},
    });
    assert.equal(feedback(null).status,200);
    const accepted = command(app,"walk_to",{x:0,z:0},"new-walk");
    assert.equal(accepted.status,200);
    let seen=request(app,"/api/observe").body;
    assert.equal(seen.job.id,"new-walk");
    assert.equal(seen.body_job_id,null);
    assert.equal(seen.fresh,true);
    assert.equal(feedback("new-walk").status,200);
    seen=request(app,"/api/observe").body;
    assert.equal(seen.body_job_id,"new-walk");
    assert.equal(feedback("old-walk").status,400);
  } finally { app.close(); }
});
