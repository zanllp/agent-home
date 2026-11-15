# 下载、启动、打开

**支持 Windows、macOS 和 Linux。** 想让 Agent 全部代劳，复制 [首页提示词](../README.md#复制给你的-agent让它自己装好并打开)。

## 最短路线

1. 安装 [Node.js](https://nodejs.org/en/download)（22.12 或更高）与 [Chrome](https://www.google.com/chrome/)；已有就跳过。
2. [下载项目 ZIP](https://github.com/zanllp/agent-home/archive/refs/heads/main.zip)，解压到自己的文件夹。
3. 在有 `start.mjs` 的文件夹打开终端，运行 `node start.mjs`。不用 `npm install`、Python 或 Blender，不用构建。
4. 保留终端，在浏览器打开 [http://127.0.0.1:19130/](http://127.0.0.1:19130/)。第一次会加载模型，等房间和人物出现。

有 Git 也可这样下载：

```sh
git clone https://github.com/zanllp/agent-home.git
cd agent-home
node start.mjs
```

启动不等于自动接入聊天模型；让 Agent 操作还需要 [接入步骤](AGENT_SETUP.md)。默认后台 Runner 执行动作，可见页面用来观看；不是把模型密钥填到网页里。

## 常见问题

| 现象 | 怎么处理 |
| --- | --- |
| 下载 404 / 无法 clone | 先确认 GitHub 账号有仓库访问权限；不要下载别人的同名仓库或来路不明的安装包。 |
| `node` 不存在 / 版本太低 | 安装官方 Node.js 后重新打开终端，用 `node --version` 检查，至少 22.12。 |
| 找不到 `start.mjs` | 终端还不在项目文件夹；进入解压后能看到该文件的目录。 |
| 缺少 `runtime/server.mjs` | 下到的是不含预构建产物的版本。重新从本项目 main 下载，不让普通用户现场构建。 |
| 找不到 Chrome/Chromium | 在服务所在系统安装可执行的浏览器，或用下面的方法指定路径。Windows 也会尝试发现已安装的 Edge。 |
| 提示端口被占用 | 先看是否已有小家服务，能打开就复用；不要随便结束占用进程。需要时换一个空闲端口。 |
| 有页面但 Agent 不能动 / 不能截图 | 看 `/api/runtime` 的 online 和 `/api/observe` 的 fresh；具体见 [Runner 与日志](RUNNER.md)。 |
| SQLite 实验性提示 | 部分 Node 版本的官方提示；入口会自动处理所需启动参数，不是缺项目依赖。 |

## 换端口或指定浏览器

下面以 19131 为例，换端口后打开的 URL 也要改成 `http://127.0.0.1:19131/`。

**Windows PowerShell：**

```powershell
$env:HOUSE_PORT = '19131'
node start.mjs
```

浏览器没被找到时，可在启动前设置 `HOUSE_CHROME` 为真实可执行文件的绝对路径，例如：

```powershell
$env:HOUSE_CHROME = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
```

**macOS / Linux 终端：**

```sh
HOUSE_PORT=19131 node start.mjs
```

需要手动指定浏览器时，macOS 通常为 `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`，Linux 使用本机实际安装路径，例如：

```sh
HOUSE_CHROME=/usr/bin/chromium node start.mjs
```

路径必须确实存在、可执行；不要为绕过错误关闭浏览器 sandbox。仅使用可见页面执行时可以运行 `node start.mjs --no-runner`，但该页面必须保持打开可见，不能再声称关闭页面也能执行动作。

## 保存、退出和更新

- 退出：在启动服务的终端按 `Ctrl+C`，本服务会正常关闭自己的后台浏览器。
- 第一次打开默认是连通小家。布置和状态保存在 `house3d/data/house.sqlite`；下次启动继续，不重置已有存档。
- 更新：先停止旧服务并备份 `house3d/data/`，不要用新包覆盖或删除存档；不要对同一存档启动两份服务。
- 文件大小不是运行内存或显存占用。当前运行包和模型都在本地，正常启动不要求登录模型生成网站。

## WSL、容器、服务器是可选路线

不是必需环境。WSL 用户可以在 WSL 内运行服务，再由 Windows 浏览器通过 localhost 观看，但需确认转发确实可用。容器/远程服务器的 localhost 不等于用户电脑；本项目默认仅本机访问，不为“接入”自动改成公网监听。见 [Agent 接入边界](AGENT_SETUP.md#5-环境不同就先说明别擅自开放网络)。
