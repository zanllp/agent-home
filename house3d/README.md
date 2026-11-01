# Agent Home · 轻量运行入口

安装与主入口见根 [README](../README.md)，工具流程见 [Agent 指南](../docs/AGENT_GUIDE.md)。`/` 与 `/wander.html` 均为当前生活 Canvas。

在项目根目录构建/运行：

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r house3d/requirements.txt
npm --prefix house3d ci
npm --prefix house3d run build
.venv/bin/python house3d/server.py
```

服务默认 http://127.0.0.1:19130 ，先检查端口，不启动副本。Vite 开发页使用 `npm --prefix house3d run dev`，19131 的 `/wander.html` 代理 API/models 到 19130。正式页面改源后需重新构建并刷新，服务端改动需正常停止后重启。

```sh
.venv/bin/python -m unittest discover -s house3d -p 'test_*.py'
(cd house3d && node --test test_*.mjs)
python3 tools/check_release.py
```

轻量版仅包含当前人物 `assets/dafeiyu-contact.glb`、全部家具目录资产及当前行为测试，不带旧人物候选、旧 2D 原型和跨版本模型对比套件。当前模型、材质、贴图、骨骼和动画未重编码或降质，SHA256 清单在根 `runtime-assets.json`。完整本机工程保留原始素材、Blender 源及历史测试。

数据库由启动时生成于 `data/house.sqlite`，不上传。原子命令、版本与幂等、布局预演、Agent 身体反馈及截图接口保留；截图和身体动作仍依赖可见浏览器。没有公网认证或无头服务端渲染，勿直接公开服务。
