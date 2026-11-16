import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { HouseApp, loadContext } from "../runtime/test-app.mjs";

test("viewer heartbeat normalizes finite yaw and rejects non-finite yaw", () => {
  const root = resolve("house3d");
  const app = new HouseApp(
    loadContext(root),
    ":memory:",
    root,
    resolve("runtime/web"),
    () => 100,
  );
  try {
    const state = app.store.state();
    const heartbeat = (yaw) => ({
      session_id: "yaw-test",
      visible: true,
      paused: false,
      body: { x: 0, y: 0.006, z: 0, yaw, pose: "stand", moving: false },
      job_id: null,
    });
    assert.equal(app.store.heartbeat(heartbeat(10.1), state, 100).controller, true);
    const saved = app.store.snapshot().body;
    assert.ok(Math.abs(saved.yaw) <= Math.PI + 1e-9);
    assert.ok(Math.abs(Math.sin(saved.yaw) - Math.sin(10.1)) < 1e-9);
    assert.ok(Math.abs(Math.cos(saved.yaw) - Math.cos(10.1)) < 1e-9);
    const invalid = heartbeat(Number.NaN);
    assert.throws(
      () => app.store.heartbeat(invalid, state, 101),
      /Invalid body yaw/,
    );
  } finally {
    app.close();
  }
});
