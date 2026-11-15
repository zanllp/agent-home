# Agent 接入：下载、启动、操作并打开小家

这是给有终端权限的 Agent 的执行说明。用户可直接复制 [首页的整段提示词](../README.md#复制给你的-agent让它自己装好并打开)，不需要先手动安装项目。

**默认路线：本机下载 → `node start.mjs` → CLI 接入 → 验证身体与截图 → 打开浏览器。** Windows、macOS、Linux 都走这条路线，不要求 WSL，不需要新的模型 API Key、npm 依赖、构建或 MCP 插件。

## 1. 找到项目，先保护现有环境

- 仓库：<https://github.com/zanllp/agent-home>；有 Git 可 clone，没有就下载 [main ZIP](https://github.com/zanllp/agent-home/archive/refs/heads/main.zip)。私有状态下需要用户已有的 GitHub 访问权限，不把 404 当作项目不存在，不寻找别人的凭据。
- 已有检出先复用；检查当前分支、脏文件和存档，不自动覆盖、reset、stash、切分支或删除 `house3d/data/`。需要更新时，干净工作树才正常快进；不能快进就报告差异。
- 找到包含 `start.mjs`、`agent.mjs`、`runtime/` 的目录。遵守 `AGENTS.md`（如有），再读 `SKILL.md`；不要因为看到 `package.json` 就运行 `npm install` 或重新构建。
- Node.js 最低 22.12。默认后台执行需要**服务所在环境**内可执行的 Chrome/Chromium；Windows 也会尝试发现已安装的 Edge。缺环境时使用官方来源，权限、条款、登录或付费需要用户处理时明确提出。

## 2. 复用或启动一个服务

先请求 `http://127.0.0.1:19130/api/tools`，确认是小家的工具列表，不只检查“端口有响应”。已有小家服务就复用；不要停止它、清库或启动第二份。

没有服务时，在项目目录运行：

```sh
node start.mjs
```

通过你所在 Agent 的长进程/终端会话机制持续运行，保存进程或会话 ID 和日志位置。不能让命令超时后悄悄杀掉服务，也不要安装开机自启任务。端口被其他程序占用时选空闲端口，通过 `HOUSE_PORT` 启动，并把下文 URL 与 `AGENT_HOME_URL` 一起改为实际端口。各系统环境变量写法见 [START](START.md)。

就绪检查：

1. `GET /api/tools`、`GET /api/state` 正常。
2. `GET /api/runtime` 返回 `runner:true, online:true`。
3. `GET /api/observe` 返回 `fresh:true`。首次加载有等待时间；未就绪先查本次服务日志，不启动副本。

若明确选择 `--no-runner` 模式，则必须打开并保留一个可见执行页，之后等待身体反馈；不能把后台 Runner 离线当作默认路线已经成功。

## 3. 接入工具，不是只把网页打开

在项目目录执行：

```sh
node tools/agent-home.mjs schemas
node tools/agent-home.mjs state
node tools/agent-home.mjs observe
node tools/agent-home.mjs interactables
```

`schemas` 返回当前工具定义。之后使用同一个 CLI 就能操作；不需要修改模型、安装全局 skill 或配置账号密钥。为后续会话保留**项目目录、实际服务 URL 和本页入口**，只用当前宿主已经允许的记忆/配置方式，不擅自改全局设置。

- `goto OBJECT_ID`：从实际列表选物品，自动找可达边缘、走过去并等待实际到达。
- `do OBJECT_ID ACTION`：执行实际列表里的身体动作，自带走过去和结果等待。
- `call TOOL JSON`：调用其他声明工具；身体动作需要时加 `--wait`。没有等待的受理回执不是完成。
- `screenshot character --out home-check.png`：等待并保存角色视角 PNG；输出文件仅留本地。

`OBJECT_ID`、`ACTION`、`TOOL`、`JSON` 是说明中的占位符，要用查询结果替换，不能原样执行。不硬编码另一套房间的 ID；筛选和完整参数见 [Agent 指南](AGENT_GUIDE.md)。

非默认端口：设置 `AGENT_HOME_URL` 供上述客户端使用；根目录的 `node agent.mjs` 则使用 `--url`。两种 CLI 不要混用参数。

### 你的宿主需要 function calling 时

`GET /api/tool-schemas` 返回工具 schemas；使用宿主已有的 HTTP/工具桥接能力转发，当前项目不是一个已经安装好的通用 MCP server。

| 工具 | 实际 HTTP |
| --- | --- |
| `get_tools` / `get_state` / `get_catalog` / `get_presets` / `get_life_plan` | GET `/api/tools` / `/api/state` / `/api/catalog` / `/api/presets` / `/api/life-plan` |
| `observe_home` / `list_objects` / `list_interactions` | GET `/api/observe` / `/api/objects` / `/api/interactions`，参数放 query |
| `screenshot` | POST `/api/screenshots`；等待返回 URL 的 PNG |
| `draw_crayon` 及其余写工具 | POST `/api/commands`，参数放 `arguments` |

写命令先读最新 state.revision，生成唯一 ID，提交下面的结构，不让模型编造 revision：

```json
{
  "id": "unique-operation-id",
  "expected_revision": 0,
  "tool": "工具返回的实际名称",
  "arguments": {}
}
```

上面的 0 只是结构示例。409 重新读取状态后判断；不要用新 ID 盲目重放已受理的操作。跨环境可达性没有解决时，不靠改 Host 或公开监听来伪装接入成功。

## 4. 做一次轻量验收，再打开给用户看

1. 先读 `observe` 和 `get_life_plan`。已有活动安排、正在移动或保持坐卧时不打断，只读验证。
2. 空闲时从 `interactables` 选择附近可达、不消耗资源的目标，用 `goto` 做一次真实走动；不要重置预设、瞬移、挪家具，或拿盛饭/浇水当默认验收。
3. 检查 `fresh:true`、同一 `body_job_id`、job.phase 和实际身体位置。失败、暂停、被替换或超时都要如实报告，不自动重发。
4. 保存并检查一次角色视角 PNG。它应是小家真实画布，不是桌面截图、概念图或 HTTP 返回的 JSON 文本。
5. 用当前宿主的浏览器/打开 URL 能力，在用户这台电脑打开 [小家](http://127.0.0.1:19130/)。没有浏览器控制能力时，可按系统使用 macOS 的 `open`、Windows PowerShell 的 `Start-Process`、Linux 桌面的 `xdg-open`；无桌面服务器不能声称“已在用户电脑打开”。

最后报告：**项目目录、访问地址、服务进程/会话与日志、后续工具命令、动作与截图的真实结果、未完成项**。有终端但没有图像查看能力时，也要说明截图只生成未目视检查。

## 5. 环境不同就先说明，别擅自开放网络

- 默认按用户电脑本机安装与打开，不要求迁到 WSL 或容器。
- WSL、容器、远程服务器里 `127.0.0.1` 指各自环境，不必然是用户电脑。先核对现有可达路径；WSL 的 localhost 转发需要实际验证。
- 同一已有可达环境的 HTTP 客户端可配置 `AGENT_HOME_URL`。这不自动打通网络，不是公网认证，也不是给任意容器暴露服务的许可。
- 不改监听范围、关闭安全检查、加 `--no-sandbox`、读桌面/摄像头、改其他机器人或用户模型配置。
- 浏览器负责显示和身体执行；只启动一个 Node 服务、没有可用执行者，不等于接入验收完成。详细边界见 [RUNNER](RUNNER.md) 与 [SECURITY](../SECURITY.md)。
