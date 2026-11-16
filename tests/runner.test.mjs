import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync, execFile } from "node:child_process";
import { promisify } from "node:util";
import { once } from "node:events";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import * as T from "three";
import { playbackBuffer } from "../house3d/web/live-playback.js";
import { batchStaticProp } from "../house3d/web/static-prop-batch.js";
const runFile = promisify(execFile);

test("display interpolation cannot mutate authoritative snapshots or cross jobs/teleports", () => {
  const buffer = playbackBuffer(),
    frame = (x, jobId = "walk") => ({
      jobId,
      phase: "approaching",
      body: { x, y: 0, z: 0, yaw: 0, moving: true },
      walk: { x, z: 0, yaw: 0 },
      contact: null,
    });
  const f = frame(0.3);
  buffer.push(frame(0), 100);
  buffer.push(f, 200);
  assert.equal(buffer.sample(250).walk.x, 0.15);
  assert.equal(f.walk.x, 0.3);
  assert.equal(buffer.sample(6300), null);
  buffer.push(frame(3), 400);
  assert.equal(buffer.sample(401).walk.x, 3);
  buffer.push(frame(3.1, "next"), 500);
  assert.equal(buffer.sample(501).walk.x, 3.1);
});
test("static batching preserves transformed positions, material and shadow flags; skips translucent geometry", () => {
  const root = new T.Group(),
    m = new T.MeshStandardMaterial(),
    parent = new T.Group();
  root.position.z = 3;
  parent.position.x = 2;
  parent.rotation.y = 0.2;
  root.add(parent);
  for (let i = 0; i < 4; i++) {
    const mesh = new T.Mesh(new T.BoxGeometry(1, 1, 1), m);
    mesh.position.y = i;
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
  }
  const glass = new T.Mesh(
    new T.PlaneGeometry(),
    new T.MeshBasicMaterial({ transparent: true })
  );
  root.add(glass);
  const before = new T.Box3().setFromObject(root, true);
  batchStaticProp(root);
  const after = new T.Box3().setFromObject(root, true);
  assert.ok(
    before.min.distanceTo(after.min) < 1e-5 &&
      before.max.distanceTo(after.max) < 1e-5
  );
  const batch = root.children.find((x) => x.material === m);
  assert.ok(batch.castShadow && batch.receiveShadow);
  assert.equal(parent.children.length, 0);
  assert.ok(root.children.includes(glass));
  assert.equal(batch.geometry.index.count, 144);
});
test("missing explicit Chromium executable fails clearly without a download", () => {
  const r = spawnSync(process.execPath, ["start.mjs"], {
    env: {
      ...process.env,
      HOUSE_RUNNER: "1",
      HOUSE_WEATHER: "off",
      HOUSE_CHROME: "/no-such-browser/agent-home-chrome",
    },
    encoding: "utf8",
  });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /HOUSE_CHROME/);
});
test(
  "real headless runner owns execution with zero viewers, streams identical poses, captures PNG and shuts down",
  { skip: process.env.HOUSE_TEST_RUNNER !== "1", timeout: 120000 },
  async () => {
    const dir = mkdtempSync(join(tmpdir(), "runner-test-")),
      probe = createServer();
    probe.listen(0, "127.0.0.1");
    await once(probe, "listening");
    const port = probe.address().port;
    await new Promise((ok) => probe.close(ok));
    const url = "http://127.0.0.1:" + port,
      p = spawn(process.execPath, ["start.mjs"], {
        env: {
          ...process.env,
          HOUSE_RUNNER: "1",
          HOUSE_WEATHER: "off",
          HOUSE_PORT: String(port),
          HOUSE_DB: join(dir, "s.sqlite"),
        },
        stdio: "ignore",
      }),
      closed = once(p, "exit");
    const get = async (path) => (await fetch(url + path)).json(),
      post = (path, body) =>
        fetch(url + path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
    const wait = async (fn) => {
      const end = Date.now() + 35000;
      while (Date.now() < end) {
        const val = await fn().catch(() => null);
        if (val) return val;
        await new Promise((ok) => setTimeout(ok, 150));
      }
      throw Error("Runner condition timeout");
    };
    const cmd = async (tool, args) => {
      const id = crypto.randomUUID(),
        r = await post("/api/commands", {
          id,
          expected_revision: (await get("/api/state")).revision,
          tool,
          arguments: args,
        });
      assert.equal(r.status, 200, await r.text());
      return id;
    };
    const abort = new AbortController();
    try {
      await wait(async () => (await get("/api/runtime")).online);
      const initial = await get("/api/state");
      assert.equal(initial.preset_id, "connected-home");
      assert.equal(initial.objects.length, 111);
      await wait(async () => {
        const o = await get("/api/observe");
        return o.fresh && !o.body.moving && o.body.pose === "stand" &&
          Math.hypot(o.body.x - initial.character.x, o.body.z - initial.character.z) < 0.02;
      });
      const cli = async (...args) => JSON.parse((await runFile(process.execPath,
        ["tools/agent-home.mjs", ...args],
        {env: {...process.env, AGENT_HOME_URL: url}, encoding: "utf8", timeout: 35000})).stdout);
      assert.ok(Array.isArray(await cli("schemas")));
      assert.equal((await cli("state")).preset_id, "connected-home");
      assert.equal((await cli("observe")).fresh, true);
      const choices = (await cli("interactables")).objects.flatMap(o => o.actions
        .filter(a => a.available && a.approach)
        .map(a => ({id: o.id, distance: a.approach.distance_m})));
      choices.sort((a, b) => a.distance - b.distance);
      assert.ok(choices.length);
      assert.equal((await cli("goto", choices[0].id)).observe.job.phase, "completed");
      const onboardingShot = join(dir, "home-check.png");
      assert.equal((await cli("screenshot", "character", "--out", onboardingShot)).ok, true);
      assert.equal(readFileSync(onboardingShot).readUInt32BE(0), 0x89504e47);
      for (const path of [
        "/api/viewer",
        "/api/interactions/a/progress",
        "/api/screenshots/a",
        "/api/runtime/frame",
      ])
        assert.equal((await post(path, {})).status, 403);
      await cmd("apply_preset", { preset_id: "family-home", dry_run: false });
      await cmd("set_activity", { activity: "idle" });
      await wait(async () => {
        const o = await get("/api/observe");
        return (
          o.fresh &&
          !o.body.moving &&
          Math.hypot(o.body.x - 1.2, o.body.z - 0.3) < 0.02
        );
      });
      const id = await cmd("interact", {
        target_id: "child-chair",
        action: "read",
      });
      await wait(async () => {
        const o = await get("/api/observe");
        return (
          o.fresh &&
          o.body_job_id === id &&
          o.job.phase === "active" &&
          o.body.pose === "read" &&
          !o.execution.requires_visible_viewer
        );
      });
      for (let i = 0; i < 2; i++) {
        const r = await fetch(url + "/api/runtime/stream", {
            signal: abort.signal,
          }),
          reader = r.body.getReader();
        let s = "";
        while (!s.includes("data: "))
          s += new TextDecoder().decode((await reader.read()).value);
        const f = JSON.parse(s.split("data: ")[1].split("\n")[0]);
        assert.equal(f.jobId, id);
        assert.equal(f.pose, "read");
      }
      assert.equal(
        (await post("/api/runtime/control", { paused: true })).status,
        200
      );
      await wait(async () => (await get("/api/observe")).execution.paused);
      assert.equal(
        (await post("/api/runtime/control", { brisk: "yes" })).status,
        400
      );
      assert.equal(
        (await post("/api/runtime/control", { paused: false })).status,
        200
      );
      await wait(async () => !(await get("/api/observe")).execution.paused);
      assert.equal(
        (
          await post("/api/runtime/perf", {
            session: "test-viewer",
            frames: 7,
            arbitrary: "DO_NOT_LOG_THIS",
          })
        ).status,
        200
      );
      assert.equal(
        (await post("/api/runtime/perf", { session: "test-viewer", frames: 8 }))
          .status,
        429
      );
      const diagnostics = readFileSync(
        join(dir, "logs/performance.jsonl"),
        "utf8"
      );
      assert.ok(!diagnostics.includes("DO_NOT_LOG_THIS"));
      assert.match(diagnostics, /"role":"viewer","frames":7/);
      for (const view of ["spectator", "character"]) {
        const shot = await (await post("/api/screenshots", { view })).json();
        const bytes = await wait(async () => {
          const r = await fetch(url + shot.url);
          return r.status === 200 && Buffer.from(await r.arrayBuffer());
        });
        assert.equal(bytes.readUInt32BE(0), 0x89504e47);
        assert.ok(bytes.length > 1000);
      }
      assert.match(
        readFileSync(join(dir, "logs/performance.jsonl"), "utf8"),
        /action_progress/
      );
      const forced = await cli("cancel", "--force");
      assert.equal(forced.unlocked, true);
      assert.equal(forced.body_confirmed, false);
      const forceId = forced.state.interaction.id;
      await wait(async () => {
        const o = await get("/api/observe");
        return o.fresh && o.body_job_id === forceId && o.job.forced &&
          o.job.phase === "failed" && o.body.pose === "stand" && !o.body.moving;
      });
      assert.equal((await cli("goto", "child-chair")).observe.job.phase, "completed");
      await cmd("apply_preset",{preset_id:"connected-home",dry_run:false});
      const waterState=await get("/api/state");
      await wait(async()=>{const o=await get("/api/observe");return o.fresh&&o.body.pose==="stand"&&!o.body.moving&&Math.hypot(o.body.x-waterState.character.x,o.body.z-waterState.character.z)<.02});
      const waterOptions=(await cli("interactables")).objects;
      const waterChoices=waterOptions.filter(o=>o.actions.some(a=>a.id==="water"&&a.available));
      assert.ok(waterChoices.length,JSON.stringify(waterOptions.filter(o=>o.actions.some(a=>a.id==="water"))));
      const wateringId = await cmd("interact",{target_id:waterChoices[0].id,action:"water"});
      await wait(async()=>{const o=await get("/api/observe");return o.fresh&&o.body_job_id===wateringId});
      const waterExit = await cli("cancel","--force");
      await wait(async()=>{const o=await get("/api/observe");return o.fresh&&o.body_job_id===waterExit.state.interaction.id&&o.body.pose==="stand"&&!o.body.moving});
      assert.equal((await cli("do","childroom-chair","read")).observe.body.pose,"read");

    } finally {
      abort.abort();
      p.kill("SIGTERM");
      await closed;
      rmSync(dir, { recursive: true, force: true });
    }
  }
);

test('closed overlay shades only the button while sampling the original canvas coordinates',async()=>{
 const {fitOverlayQuad}=await import('../house3d/web/overlay-quad.js');
 const mesh=new T.Mesh(new T.PlaneGeometry(1,1));
 fitOverlayQuad(mesh,1280,720,{x:1186,y:18,w:76,h:36});
 assert.equal(mesh.scale.x,80);assert.equal(mesh.scale.y,40);
 assert.ok(Math.abs(mesh.geometry.attributes.uv.getX(0)-1184/1280)<1e-6);
 assert.ok(Math.abs(mesh.geometry.attributes.uv.getY(3)-(1-56/720))<1e-6);
 fitOverlayQuad(mesh,1280,720,null);assert.equal(mesh.scale.x,1280);assert.equal(mesh.position.x,0);assert.equal(mesh.geometry.attributes.uv.getX(3),1);
});
