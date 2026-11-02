# 架构与运行边界

## 一次构建、只用 Node 运行

TS 后端 → esbuild → `runtime/server.mjs`；浏览器源码 → Vite → `runtime/web/`。构建仅由开发/发布者执行。运行者使用 `node start.mjs`，不用安装 npm 包、Python 或原生数据库模块。后端只导入 Node 内置模块；第三方前端 Three.js 已包含在浏览器 bundle。

要求 Node 22.12+。22.12 的 SQLite 开关由启动器用同一个 Node 可执行文件自动处理；无需执行 shell、下载安装或改变全局配置。新版本无需额外开关。实验性 SQLite 提示来自 Node，未通过屏蔽警告冒充 API 已稳定。

## 状态链路

1. Agent 通过 Node CLI 或本地 HTTP 调用声明工具。
2. 后端检查参数、版本、幂等、布置和支撑关系，在 SQLite 事务中落盘。
3. 可见生活页面轮询期望状态，执行导航/姿态，再回传身体快照和动作进度。
4. Agent 用 `observe_home` 检查匹配 job、fresh、完成/受阻，不能把命令受理当完成。
5. 截图由可见页面渲染后上传到本地队列，Agent 取得 PNG。不是桌面、摄像头或其他应用截图。

## 代码

- `house3d/server/app.ts`：保持原 HTTP 路由与命令响应。
- `transition.ts`：状态转换、房间/物品操作。
- `geometry.ts` / `layout.ts`：尺寸、支撑、碰撞与近似可达性。
- `objects.ts` / `observation.ts`：动作声明、角色视角与反馈。
- `store.ts`：内置 SQLite、事务、幂等记录、事件与执行者租约。
- `index.ts` / `cli.ts`：HTTP 服务与命令行入口。
- `house3d/shared/space.mjs`：室内/阳台区域、门口与护栏边界，服务端与画布共用。
- `house3d/web/`：原浏览器生活画布；当前 GLB 和纹理保持不变。
- `tests/`：旧 HTTP 契约重放、原 SQLite 兼容、真实 HTTP 和无依赖运行包验收。

## 存档

默认数据库仍是 `house3d/data/house.sqlite`，保留 state/commands/shots/home_events/home_viewer 表。已有 state 不重置，旧 Python 格式的幂等请求可以重试；旧 shots 表缺 view 时只补原有同一列。没有改为 JSON 文件存储或新业务兜底。

运行包不携带数据库。更新/恢复前正常停止旧实例，保留并备份自己的数据；不要运行中替换数据库，也不删租约来抢身体执行权。

## 安全及限制

只监听 127.0.0.1。保留本机 Host、跨源写入、5 MiB 请求体限制和静态目录边界；不开放公网/认证权限，不接 DSH/QQ/模型服务。参数只影响声明的家居状态，不作为 shell 脚本执行。

几何与视野仍基于保守边界/声明支撑面，不是物理碰撞或感知传感器。没有可见执行页时只能维护持久状态，不继续模拟身体或提供无头截图。人物仍使用无光照贴图，家具独立受光；无通用换装、多人和内容包市场。
