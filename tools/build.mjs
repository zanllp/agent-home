import { build as bundle } from "esbuild";
import { build as viteBuild } from "vite";
import { readdir, rm, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
await mkdir(resolve(root, "runtime"), { recursive: true });
// Share server code with the test entry instead of shipping two copies.
for(const name of await readdir(resolve(root,"runtime")))
  if(/^shared-.*\.mjs$/.test(name))await rm(resolve(root,"runtime",name));
await bundle({
  entryPoints: {server:resolve(root,"house3d/server/index.ts"),agent:resolve(root,"house3d/server/cli.ts"),"test-app":resolve(root,"house3d/server/app.ts")},
  outdir:resolve(root,"runtime"),outExtension:{".js":".mjs"},chunkNames:"shared-[hash]",
  platform:"node",target:"node22",format:"esm",bundle:true,splitting:true,sourcemap:false,minify:true,
});
process.chdir(resolve(root, "house3d"));
await viteBuild({
  root: resolve(root, "house3d"),
  configFile: resolve(root, "house3d/vite.config.js"),
  build: { outDir: resolve(root, "runtime/web"), emptyOutDir: true },
});
