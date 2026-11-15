# Agent Home 开发入口

默认运行需要 Node 22.12+ 和已有 Chrome/Chromium：在项目根目录执行 `node start.mjs`。CLI 为 `node agent.mjs`。运行者不用安装 npm/Python 依赖，也不需要构建。`--no-runner` 可关闭后台执行者，改由可见页面执行；无执行页面时身体不会继续活动。

## 开发

只有修改源代码的开发者才需要：

```sh
npm ci --registry=https://registry.npmjs.org
npm run typecheck
npm run build
npm run package
npm test
npm run check:release
```

- `server/`：TypeScript 后端；Node 内置 HTTP/fs/crypto/SQLite，无运行时第三方 npm 包。
- `server-data.json`：首次入住的默认预设 ID、基础角色配置、原始目录/工具定义；`loadContext` 从预设目录展开初始状态，已有存档不替换。
- `web/`：当前生活 Canvas、动作、导航与镜头。画面与资产未随后端迁移更换。
- `assets/`：当前人物、家具、墙纸和地板；根 `runtime-assets.json` 校验原始哈希。
- 根 `runtime/server.mjs` / `runtime/agent.mjs` / `runtime/shared-*.mjs`：预编译后端/CLI；`runtime/web/`：预构建页面，不是临时缺失时才由使用者构建。
- `data/house.sqlite`：运行时生成，表结构沿用旧版本，不放进发行包。

根 `tools/build.mjs` 用 esbuild 构建 TS 后端/CLI、用 Vite 构建前端；开发工具只在构建时使用。运行 ZIP 中不含 node_modules、Python、npm、TS 编译器或数据库。

300 组来自旧 Python 测试的 HTTP 契约样本包含原目录覆盖、固定时钟及 SQLite 前后状态。Node 测试直接读取压缩样本，不需要 Python；样本保留旧协议作为迁移证据，不是重新运行 Python 后端。

开发前端可运行 `npx vite house3d --config house3d/vite.config.js`（由开发工具环境提供）；代理 API/models 到 19130。不要停止原本机完整工程的服务；隔离测试使用 HOUSE_PORT/HOUSE_DB 指定另一个端口和临时数据库。
