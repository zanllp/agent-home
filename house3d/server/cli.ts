import { parseArgs } from "node:util";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    url: { type: "string", default: "http://127.0.0.1:19130" },
    id: { type: "string" },
    revision: { type: "string" },
    output: { type: "string" },
    help: { type: "boolean" },
  },
});
if (values.help || !positionals.length) {
  console.log(
    "Usage: node agent.mjs TOOL [JSON|@file] [--url URL] [--id ID] [--revision N] [--output FILE]",
  );
  process.exit(values.help ? 0 : 1);
}
const [tool, argument = "{}"] = positionals;
async function call(path: string, data?: unknown) {
  const response = await fetch(values.url + path, {
    method: data === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
    signal: AbortSignal.timeout(10000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(result));
  return result as Record<string, any>;
}
try {
  if (values.output && !["screenshot","draw_crayon"].includes(tool))
    throw Error("--output is only available for screenshot or draw_crayon");
  const args = JSON.parse(
    argument.startsWith("@")
      ? await readFile(argument.slice(1), "utf8")
      : argument,
  );
  let result: Record<string, any>;
  const reads: Record<string, string> = {
    get_state: "/api/state",
    get_catalog: "/api/catalog",
    get_tools: "/api/tools",
    get_presets: "/api/presets",
  };
  if (tool === "observe_home" || tool === "list_objects")
    result = await call(
      (tool === "observe_home" ? "/api/observe?" : "/api/objects?") +
        new URLSearchParams(args),
    );
  else if (reads[tool]) result = await call(reads[tool]);
  else if (tool === "screenshot") {
    result = await call("/api/screenshots", args);
    if (values.output) {
      let ready = false;
      const deadline = performance.now() + 32000;
      while (performance.now() < deadline) {
        const r = await fetch(values.url + result.url, {
          signal: AbortSignal.timeout(10000),
        });
        if (r.status === 410)
          throw Error(
            "Screenshot expired: keep the house page open and visible",
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
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      if (!ready)
        throw Error(
          "Screenshot timed out: keep the house page open and visible",
        );
    }
  } else {
    const revision =
      values.revision === undefined
        ? (await call("/api/state")).revision
        : Number(values.revision);
    if (!Number.isSafeInteger(revision))
      throw Error("--revision must be an integer");
    result = await call("/api/commands", {
      id: values.id || randomUUID().replaceAll("-", ""),
      expected_revision: revision,
      tool,
      arguments: args,
    });
  }
  if(tool==="draw_crayon" && values.output){
    const r=await fetch(values.url+result.artwork.url,{signal:AbortSignal.timeout(10000)});
    if(!r.ok || r.headers.get("content-type")!=="image/png")throw Error("Drawing download failed");
    const path=resolve(values.output);
    await mkdir(dirname(path),{recursive:true});
    await writeFile(path,Buffer.from(await r.arrayBuffer()));
    result.output=path;
  }
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(JSON.stringify({ error: (error as Error).message }));
  process.exitCode = 1;
}
