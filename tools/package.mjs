import { zipSync } from "fflate";
import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url)),
  files = {},
  version = JSON.parse(
    await readFile(resolve(root, "package.json"), "utf8"),
  ).version;
const roots = [
  "start.mjs",
  "verify.mjs",
  "agent.mjs",
  "runtime-assets.json",
  "runtime/server.mjs",
  "runtime/agent.mjs",
  "runtime/web",
  "house3d/assets",
  "house3d/server-data.json",
  "house3d/furniture-assets.json",
  "house3d/wallpapers.json",
  "house3d/room-presets.json",
  "house3d/licenses",
  "LICENSE",
  "licenses",
  "UPSTREAM.md",
  "docs/AGENT_GUIDE.md",
  "docs/BALCONY.md",
  "docs/DESKS.md",
  "docs/ASSETS.md",
  "research/characters",
  "modeling/licenses",
  "frontend/characters/dafeiyu/SOURCE.md",
];
async function add(path) {
  const info = await stat(path);
  if (info.isDirectory()) {
    for (const name of (await readdir(path)).sort())
      await add(resolve(path, name));
  } else
    files[relative(root, path).replaceAll("\\", "/")] = new Uint8Array(
      await readFile(path),
    );
}
for (const item of roots) await add(resolve(root, item));
files["README.md"] = new TextEncoder().encode(
  `# Agent Home ${version}\n\n只需要 Node.js 22.12+。无需 Python、npm install、Blender 或构建。\n\n启动：\n\n    node start.mjs\n\n打开 http://127.0.0.1:19130/ 。默认只监听本机；先确认没有旧服务占用端口。Node 22.12 所需的 SQLite 参数由启动器自动处理，可能出现 Node 官方实验性模块提示。\n\nAgent 工具：\n\n    node agent.mjs get_tools\n    node agent.mjs get_catalog\n    node agent.mjs get_presets\n    node agent.mjs observe_home\n\n首次生成的存档在 house3d/data/house.sqlite。切换房间、布置预演、动作及截图用法见 docs/AGENT_GUIDE.md。动作与截图仍需要一个可见的浏览器页面。模型和贴图与完整本机工程相同，没有降质；许可见 docs/ASSETS.md 和随附声明。\n\n更新前正常停止旧服务并备份自己的存档，不用发布包覆盖或删除 house3d/data。发布包不包含数据库或账号凭据。\n`,
);
const manifest = Object.fromEntries(
  Object.entries(files).map(([name, bytes]) => [
    name,
    {
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    },
  ]),
);
files["package-manifest.json"] = new TextEncoder().encode(
  JSON.stringify({ version, files: manifest }, null, 2) + "\n",
);
const unpacked = Object.values(files).reduce((n, b) => n + b.length, 0);
if (unpacked >= 100_000_000) throw Error("Runtime package exceeds 100 MB");
const folder = resolve(root, "artifacts");
await mkdir(folder, { recursive: true });
const file = resolve(folder, `agent-home-${version}-node.zip`),
  bytes = zipSync(files, { level: 6 });
await writeFile(file, bytes);
const sha = createHash("sha256").update(bytes).digest("hex");
await writeFile(file + ".sha256", `${sha}  ${file.split("/").at(-1)}\n`);
console.log(
  JSON.stringify(
    { file, packed_bytes: bytes.length, unpacked_bytes: unpacked, sha256: sha },
    null,
    2,
  ),
);
