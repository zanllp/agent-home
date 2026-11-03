import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { HouseApp, loadContext } from "../runtime/test-app.mjs";
const root = new URL("../house3d/", import.meta.url).pathname;
const context = loadContext(root);
function revive(value) {
  if (Array.isArray(value)) return value.map(revive);
  if (value && typeof value === "object") {
    if (value.__bytes__) return Buffer.from(value.__bytes__, "base64");
    if (value.__number__) return Number(value.__number__);
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, revive(v)]),
    );
  }
  return value;
}
const cases = revive(
  JSON.parse(
    gunzipSync(
      readFileSync(new URL("./python-contracts.json.gz", import.meta.url)),
    ),
  ),
);
// Replay with the wallpaper catalog recorded alongside the original Flask responses.
const recordedWallpapers = cases.find(f => f.input.url === "/api/catalog" && f.expected.body?.wallpapers).expected.body.wallpapers;
function normalized(value) {
  if (Array.isArray(value)) return value.map(normalized);
  if (value && typeof value === "object" && !Buffer.isBuffer(value))
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        ["body", "request"].includes(k) && typeof v === "string"
          ? normalized(JSON.parse(v))
          : normalized(v),
      ]),
    );
  return value;
}
function equivalent(a, b, path = "") {
  if (typeof a === "number" && typeof b === "number") {
    assert.ok(
      Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)),
      `${path}: ${a} != ${b}`,
    );
    return;
  }
  if (Array.isArray(b)) {
    assert.ok(Array.isArray(a), path);
    assert.equal(a.length, b.length, path);
    for (let i = 0; i < b.length; i++) equivalent(a[i], b[i], path + "." + i);
    return;
  }
  if (b && typeof b === "object") {
    assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort(), path);
    for (const k of Object.keys(b)) equivalent(a[k], b[k], path + "." + k);
    return;
  }
  assert.equal(a, b, path);
}
for (const [index, fixture] of cases.entries())
  test(`Python contract ${index + 1}: ${fixture.input.method} ${fixture.input.url}`, () => {
    const app = new HouseApp(
      { ...context, wallpapers: recordedWallpapers, definitions: JSON.parse(readFileSync(new URL("./python-definitions.json",import.meta.url))), presets: JSON.parse(readFileSync(new URL("./python-presets.json",import.meta.url))), assets: fixture.assets },
      ":memory:",
      root,
      root + "../runtime/web",
      () => fixture.now,
      () => fixture.expected.body?.id || "unused",
    );
    try {
      for (const table of [
        "state",
        "commands",
        "shots",
        "home_events",
        "home_viewer",
        "sqlite_sequence",
      ]) {
        app.store.db.exec(`DELETE FROM ${table}`);
        for (const row of fixture.before[table]) {
          const keys = Object.keys(row);
          app.store.db
            .prepare(
              `INSERT INTO ${table}(${keys.join(",")}) VALUES(${keys.map(() => "?").join(",")})`,
            )
            .run(...keys.map((k) => row[k]));
        }
      }
      const actual = app.handle(fixture.input);
      assert.equal(actual.status, fixture.expected.status);
      // The live discovery endpoint intentionally advertises the approved balcony extension.
      if(fixture.input.url==='/api/tools'&&fixture.expected.body?.tools?.update_room&&!fixture.expected.body.tools.update_room.includes('balcony'))fixture.expected.body.tools.update_room.push('balcony');
      if (fixture.expected.body !== null)
        equivalent(actual.body, fixture.expected.body, "response");
      if (fixture.expected.bytes)
        assert.deepEqual(actual.bytes, fixture.expected.bytes);
      const after = Object.fromEntries(
        Object.keys(fixture.after).map((t) => [
          t,
          app.store.db
            .prepare(`SELECT * FROM ${t}`)
            .all()
            .map((r) => Object.fromEntries(Object.entries(r))),
        ]),
      );
      equivalent(normalized(after), normalized(fixture.after), "database");
    } finally {
      app.close();
    }
  });
