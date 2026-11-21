# 贡献指南

欢迎改进 Agent 操作、可观察性、动作和小家画面。提交前先阅读 [架构](docs/ARCHITECTURE.md)、[Agent 指南](docs/AGENT_GUIDE.md)、[安全边界](SECURITY.md) 与 [素材许可](docs/LICENSING.md)。

## 开发和验证

运行成品无需 npm 安装；修改源码则需要 Node.js 22.12+、npm 开发依赖，真实 Runner 测试另需 Chrome/Chromium。不要使用用户的日常存档来跑破坏性测试，指定独立的 `HOUSE_DB`、`HOUSE_LOG_DIR` 和未占用的 `HOUSE_PORT`。

```sh
npm ci --registry=https://registry.npmjs.org
npm run typecheck
npm run build
npm run package
npm test
HOUSE_TEST_RUNNER=1 HOUSE_TEST_APARTMENT=1 npm test
npm run check:release
npm run check:public
```

`package` 在完整测试前运行，因为运行包验收会实际解压 ZIP。没有浏览器的测试环境应明确说明未执行的真实 Runner 测试，不能用默认测试结果冒充完整跨端验收。发布者提交对应的 `runtime/` 预构建产物，使用者不必每次拉代码再构建；`runtime/shared-*.mjs` 也是运行必需文件。

- 改角色、服装或蒙皮后，运行 `npm run check:wardrobe`，打开生成的 HTML 先看全身，再看各部位。[验收与基准图说明](modeling/wardrobe/README.md#角色与换装验收)。
- 修改 UI 时保留单 Canvas、可操作的小屏布局与已经接受的人物外观；说明机位、预设和实际前后变化。
- 修改动作时验证匹配的 job 与新鲜身体反馈，至少覆盖取消、暂停、受阻、手动接管；受理不是完成，物品状态变化不是通用拿取/进食动画。
- 修改 API、默认行为、户型或模型能力，先在 Issue/PR 说明动机、兼容范围和验证；不要偷偷改模型配置、唤醒频率或外部 Agent 服务。
- 截图和性能测试固定场景、机位与尺寸；WSL 软件渲染与桌面硬件加速结果不能直接互称。详见 [性能基线](docs/PERFORMANCE_BASELINE.md)。

## 素材贡献

模型和图片要附作者、原始来源、许可、参考图和修改说明；生成服务素材还需记录生成时套餐与可再分发依据。不要提交账号、Cookie、付款记录、临时签名下载链接或未获许可的原图。独立生成的几何也要检查内嵌贴图的来源。添加资产后同步目录、`runtime-assets.json`、所需署名和验证，不靠缩图/减面偷偷满足 100 MB 限制。

## PR 说明

写清改了什么、如何验证、还没实现什么，以及是否改变现有存档/API。不要为无关问题覆盖其他人的修改或重写历史。不同来源的代码与美术遵守各自的许可；提交本身不会把第三方作品变成项目原创。
