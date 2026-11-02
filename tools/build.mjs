import { build as bundle } from "esbuild";
import { build as viteBuild } from "vite";
import { cp, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
await mkdir(resolve(root, "runtime"), { recursive: true });
await bundle({
  entryPoints: [resolve(root, "house3d/server/index.ts")],
  outfile: resolve(root, "runtime/server.mjs"),
  platform: "node",
  target: "node22",
  format: "esm",
  bundle: true,
  sourcemap: false,
});
await bundle({
  entryPoints: [resolve(root, "house3d/server/cli.ts")],
  outfile: resolve(root, "runtime/agent.mjs"),
  platform: "node",
  target: "node22",
  format: "esm",
  bundle: true,
  sourcemap: false,
});
await bundle({
  entryPoints: [resolve(root, "house3d/server/app.ts")],
  outfile: resolve(root, "runtime/test-app.mjs"),
  platform: "node",
  target: "node22",
  format: "esm",
  bundle: true,
  sourcemap: false,
});
process.chdir(resolve(root, "house3d"));
await viteBuild({
  root: resolve(root, "house3d"),
  configFile: resolve(root, "house3d/vite.config.js"),
  build: { outDir: resolve(root, "runtime/web"), emptyOutDir: true },
});
