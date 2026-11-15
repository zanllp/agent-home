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
  "tools/agent-home.mjs",
  "SKILL.md",
  "runtime-assets.json",
  "runtime/server.mjs",
  ...((await readdir(resolve(root,"runtime"))).filter(n=>/^shared-.*\.mjs$/.test(n)).map(n=>"runtime/"+n)),
  "runtime/agent.mjs",
  "runtime/web",
  "house3d/assets",
  "house3d/server-data.json",
  "house3d/furniture-assets.json",
  "house3d/wallpapers.json",
  "house3d/room-presets.json",
  "house3d/licenses",
  "LICENSE",
  "SECURITY.md",
  "docs/LICENSING.md",
  "docs/OPEN_SOURCE.md",
  "licenses",
  "UPSTREAM.md",
  "docs/AGENT_GUIDE.md",
  "docs/AGENT_SETUP.md",
  "docs/START.md",
  "docs/RUNNER.md",
  "docs/OUTDOORS.md",
  "docs/examples/family-supper.json",
  "docs/examples/after-school.json",
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
const homepage = await readFile(resolve(root, "README.md"), "utf8");
const setupPrompt = homepage.match(/```text\n([\s\S]*?)\n```/)?.[1];
if (!setupPrompt) throw Error("README is missing the copyable Agent setup prompt");
files["README.md"] = new TextEncoder().encode([
  `# Agent Home ${version}`,
  "",
  "给现有 Agent 使用的 3D 生活环境 harness：Agent 通过工具行动、布置和观察，你在浏览器里看它生活。",
  "",
  "## 复制给你的 Agent，让它自己装好并打开",
  "",
  "交给你自己的大肥鱼或其他 Agent。已有这个运行包就直接复用，把下面整段发给它：",
  "",
  "```text", setupPrompt, "```",
  "",
  "<details>",
  "<summary>想自己安装？Windows / macOS / Linux 手动步骤</summary>",
  "",
  "准备好 Node.js 22.12+ 和 Chrome，解压后在项目文件夹运行 `node start.mjs`，然后 [打开小家](http://127.0.0.1:19130/)。停止时按 Ctrl+C。",
  "",
  "详细步骤见 [手动安装与使用说明](docs/START.md)。",
  "",
  "</details>",
  "",
  "接入流程见 [AGENT_SETUP](docs/AGENT_SETUP.md)，工具规范见 [SKILL](SKILL.md)，完整参数见 [AGENT_GUIDE](docs/AGENT_GUIDE.md)。",
  "",
  "首次打开默认是连通小家；已有存档继续保留。更新前停止旧服务并备份 house3d/data，不覆盖或删除自己的存档。",
  "",
  "默认只监听本机。运行包不含数据库、账号凭据、视频或首页概念图。代码与美术许可分别适用，默认角色含非商业参考义务，部分生成素材分发仍待确认；见 [LICENSING](docs/LICENSING.md) 和 [ASSETS](docs/ASSETS.md)。",
  "",
].join("\n"));
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
