// house3d/server/cli.ts
import { parseArgs } from "node:util";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
var { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    url: { type: "string", default: "http://127.0.0.1:19130" },
    id: { type: "string" },
    revision: { type: "string" },
    output: { type: "string" },
    help: { type: "boolean" }
  }
});
if (values.help || !positionals.length) {
  console.log(
    "Usage: node agent.mjs TOOL [JSON|@file] [--url URL] [--id ID] [--revision N] [--output FILE]"
  );
  process.exit(values.help ? 0 : 1);
}
var [tool, argument = "{}"] = positionals;
async function call(path, data) {
  const response = await fetch(values.url + path, {
    method: data === void 0 ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    body: data === void 0 ? void 0 : JSON.stringify(data),
    signal: AbortSignal.timeout(1e4)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(result));
  return result;
}
try {
  if (values.output && !["screenshot", "draw_crayon"].includes(tool))
    throw Error("--output is only available for screenshot or draw_crayon");
  const args = JSON.parse(
    argument.startsWith("@") ? await readFile(argument.slice(1), "utf8") : argument
  );
  let result;
  const reads = {
    get_state: "/api/state",
    get_catalog: "/api/catalog",
    get_outdoors: "/api/outdoors",
    get_tools: "/api/tools",
    get_presets: "/api/presets"
  };
  if (tool === "observe_home" || tool === "list_objects" || tool === "list_interactions")
    result = await call(
      (tool === "observe_home" ? "/api/observe?" : tool === "list_interactions" ? "/api/interactions?" : "/api/objects?") + new URLSearchParams(args)
    );
  else if (reads[tool]) result = await call(reads[tool]);
  else if (tool === "screenshot") {
    result = await call("/api/screenshots", args);
    if (values.output) {
      let ready = false;
      const deadline = performance.now() + 32e3;
      while (performance.now() < deadline) {
        const r = await fetch(values.url + result.url, {
          signal: AbortSignal.timeout(1e4)
        });
        if (r.status === 410)
          throw Error(
            "Screenshot expired: keep the house page open and visible"
          );
        if (!r.ok) throw Error(await r.text());
        if (r.headers.get("content-type")?.split(";")[0] === "image/png") {
          const path = resolve(values.output);
          await mkdir(dirname(path), { recursive: true });
          await writeFile(path, Buffer.from(await r.arrayBuffer()));
          Object.assign(result, { status: "ready", output: path });
          ready = true;
          break;
        }
        await new Promise((resolve2) => setTimeout(resolve2, 300));
      }
      if (!ready)
        throw Error(
          "Screenshot timed out: keep the house page open and visible"
        );
    }
  } else {
    const revision = values.revision === void 0 ? (await call("/api/state")).revision : Number(values.revision);
    if (!Number.isSafeInteger(revision))
      throw Error("--revision must be an integer");
    result = await call("/api/commands", {
      id: values.id || randomUUID().replaceAll("-", ""),
      expected_revision: revision,
      tool,
      arguments: args
    });
  }
  if (tool === "draw_crayon" && values.output) {
    const r = await fetch(values.url + result.artwork.url, { signal: AbortSignal.timeout(1e4) });
    if (!r.ok || r.headers.get("content-type") !== "image/png") throw Error("Drawing download failed");
    const path = resolve(values.output);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, Buffer.from(await r.arrayBuffer()));
    result.output = path;
  }
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(JSON.stringify({ error: error.message }));
  process.exitCode = 1;
}
