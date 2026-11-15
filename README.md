# Agent Home

**给 AI 一个可以回去的家。**

这是一个给现有 Agent 使用的 **3D 生活环境 harness**：你的 Agent 负责思考，通过工具在家里行动、布置和观察，你在浏览器里看它生活。

[交给我的 Agent 安装](#复制给你的-agent让它自己装好并打开) · [Agent 接入说明](docs/AGENT_SETUP.md)

## 复制给你的 Agent，让它自己装好并打开

交给你自己的大肥鱼或其他 Agent，复制下面这段话就行：

```text
请在这台电脑安装并接入 Agent Home，然后在浏览器打开给我看：
https://github.com/zanllp/agent-home

下载项目（已有就复用），先读项目的 AGENTS.md（如有）、SKILL.md 和 docs/AGENT_SETUP.md，按接入说明实际完成安装、启动和验证。
需要 Node.js 22.12+ 和 Chrome/Chromium，在项目目录用 node start.mjs 启动；用 node tools/agent-home.mjs schemas 获取工具，以后通过项目 CLI 操作小家。
验证能观察、行动和取得真实截图后，打开 http://127.0.0.1:19130/，告诉我结果。保留已有存档和活动，不重复启动服务；需要额外权限或遇到阻碍时告诉我。
```

<details>
<summary>想自己安装？Windows / macOS / Linux 手动步骤</summary>

准备好 Node.js 22.12+ 和 Chrome，[下载 ZIP](https://github.com/zanllp/agent-home/archive/refs/heads/main.zip) 并解压，在项目文件夹运行 `node start.mjs`，然后 [打开小家](http://127.0.0.1:19130/)。

详细步骤见 [手动安装与使用说明](docs/START.md)。

</details>

## 这是什么

不只在聊天框里说“我去浇花了”。让她真的走到阳台，拿起水壶；画一张画，收好地毯上的玩具，困了就钻进被子。

Agent Home 是一个 **Agent 用工具操作、人在浏览器里观看的 3D 小家**。人物、家具和生活状态在同一个环境里留下变化。不绑定模型服务；通过本地 HTTP 或 Node CLI 接入你自己的 Agent。

![想给大肥鱼的家：阳台照进午后阳光，家长的电脑桌旁是她的小书桌，地毯上散着喜欢的玩具](docs/images/concepts/family-concept.jpg)

*家的样子，先从一张概念图开始。上图为 AI 概念图，不是实机截图。*

> **许可边界**：代码与角色、家具、贴图不是同一份许可。默认角色含非商业的社区衍生设计；部分生成素材的公开分发凭据仍待确认。不要把全仓库或运行包理解为“所有素材均 MIT、可商用”。见 [许可与署名](docs/LICENSING.md) 和 [公开发布检查](docs/OPEN_SOURCE.md)。

## 小家的日常

- **啪嗒啪嗒，去客厅。** 从儿童房到阳台，避开家具，小跑一段；你可以全景看家，也可以像家长一样跟着她。
- **不是播放一段“生活视频”。** 画本能留下新的蜡笔画，玩具能收进盒子，绿植会慢慢缺水；Agent 能查到操作后的实际状态。
- **别的 AI 烧 Token，大肥鱼先炫三碗白饭。** 为了这个爱好，我们真的做了有余量的电饭锅：盛三次就空，重新煮饭要等现实里的半小时。这是物品状态交互，暂时没有进食动画。
- **喜欢什么家，自己布置。** 选家具、换墙纸、调整灯光，先预演再摆放；发现越界、重叠或堵路时会给出反馈。
- **几件小事，接着做。** Agent 可以提交一份有限的生活安排，不用为每一步重新调用模型；执行完会停下，手动操作优先。

本地 Node 服务保存小家，浏览器负责呈现。后台执行者让她在你关闭观看页面后，也能继续完成安排好的活动。

96 秒「日常篇」PV 的分镜、横竖版规格与发布文案见 [宣传片说明](docs/PROMO.md)。实机录屏与 AI 概念插画分别标注；当前仍是预览版，公开发布前需完成素材许可检查。

## 想住进这样的日常

<table>
  <tr>
    <td width="33%"><img src="docs/images/concepts/concept-afternoon.jpg" alt="AI 概念图：放学后的大肥鱼在地毯上玩机器人" width="100%"></td>
    <td width="33%"><img src="docs/images/concepts/concept-rice.jpg" alt="AI 概念图：大肥鱼捧着满满一碗白饭，旁边是打开的电饭锅" width="100%"></td>
    <td width="33%"><img src="docs/images/concepts/concept-night.jpg" alt="AI 概念图：夜灯亮着，大肥鱼已经盖好被子睡着" width="100%"></td>
  </tr>
  <tr>
    <td align="center">放学了，玩一会儿。</td>
    <td align="center">有白饭，就很幸福。</td>
    <td align="center">今天也辛苦了，晚安。</td>
  </tr>
</table>

*这三张也是 AI 概念演出。它们表达我们想做的日常，不代表当前 3D 画质或已实现全部图中动作；角色来源与许可仍分别适用。*

### 现在的实机画面

![家庭预设实机：大肥鱼在客厅地毯上玩机器人](docs/images/family-afternoon.jpg)

*浏览器内真实 3D 画面，展示的是「和饲养员的家」预设。首次安装默认使用更完整的「连通小家」，包含儿童房、家长卧室、浴室和阳台。*

## 当前能力

- **三套可编辑模板**：儿童房、和饲养员的家，以及「大肥鱼的连通小家」(`connected-home`)。当前物品数以 `get_presets` 为准。应用模板会替换当前布置。想从儿童房走到客厅、家长卧室、浴室和阳台，可用 `connect_rooms` 先预览再接通，不必切模板。
- **家具目录**：从目录选款式、批量增删/移动/旋转；桌面和层板摆件跟随父家具。条目包含挂高变体，并非全部都支持人物接触动作。
- **预演和校验**：dry-run 反馈越界、重叠、承载与近似可达性；正式应用有版本检查、幂等和原子保存。
- **可调整房间**：尺寸、墙色、墙纸；同步墙面、地面、导航、地图和全景镜头。
- **可进入的阳台**：家庭模板附带 3.6×2 米阳台，绿植、洗衣机、晾衣架独立可摆；真实门口通行、护栏边界、堵路预演与区域反馈。
- **生活安排**：一次提交多步动作，按真实回报衔接、限时起身、条件等待；可以暂停、取消，手动操作优先。见 Agent 指南“生活安排”。不绑定或增加模型调用。它是有限计划，执行完会停止，不是持续自主生活系统。
- **身体动作**：避障走跑走、餐椅/办公椅就座、沙发坐卧与盖毯打盹、书桌前阅读和蜡笔画、地毯上拼搭与收玩具、床上睡觉、拿水壶浇花和安全起身。受理不等于完成，要查匹配的 job 与新鲜身体反馈。
- **观察和截图**：位置、朝向、姿态、支撑、手中物、完成/受阻原因及真实角色视角 PNG。
- **浏览器优先**：单 Canvas；运行资产全部本地提供，不依赖生成模型的网站或账号。

源码和预构建产物随仓库提供；运行时按当前布置加载模型。`runtime-assets.json` 记录当前资产哈希，`node verify.mjs` 检查文件完整性。工程和运行包以约 100 MB 的轻量体积为目标，不为少量超出牺牲画质；首页概念图单独统计，不进入运行包。文件体积不等于内存、显存或设备性能。

## 文档

- [北京朝阳的窗外](docs/OUTDOORS.md)：北京时间、天气来源、独立预设和离线行为。
- [开发性能基线](docs/PERFORMANCE_BASELINE.md)：真实浏览器、隔离存档、耗时与绘制预算。

- [许可与署名](docs/LICENSING.md)：代码、角色参考链、生成资产和第三方依赖的分界。
- [公开发布检查](docs/OPEN_SOURCE.md)：隐私、Git 历史、素材权利和发布前待办。
- [贡献指南](CONTRIBUTING.md) · [安全边界](SECURITY.md)。
- [Agent 操作指南](docs/AGENT_GUIDE.md)：布置预演、异步动作、截图、并发和重试。
- [三人餐桌预演](docs/examples/family-supper.json)：在家庭模板里试放第三把餐椅，保留进出阳台的路线。
- [架构与运行边界](docs/ARCHITECTURE.md)：TS/Node、SQLite、浏览器执行和安全。
- [素材及许可](docs/ASSETS.md)：原始画质、来源和本地完整归档。
- [双桌精修](docs/DESKS.md)：两套桌架、独立桌面摆件与能力边界。
- [阳台操作与边界](docs/BALCONY.md)：走入阳台、独立摆件、推拉门和预演。
- [窗户与屏幕细节](docs/VISUAL_DETAILS.md)：实体近景、远景贴图和装饰能力边界。
- [Node 迁移验收](docs/NODE_MIGRATION.md)：契约、旧存档、零依赖运行验证。
- [开发入口](house3d/README.md)：只在修改源码时才需要的构建和测试。

## 还未完成

持续自主生活、独立换装/换发型、通用抓取、进食动画、任意家具自动坐卧、任意户型编辑、多人、社区内容包导入和公网认证均未完成。已有预设多房间连通，不等于任意房型编辑器。外部 Agent 的模型调用、记忆和唤醒策略由接入方实现。

角色保留既有参考服装与专用修复，不代表通用角色/换装系统已经交付。没有实体手机，尚未完成跨设备资源消耗与长期性能验收。

## 开发与发布

**下面仅面向开发者；运行产物不需要这些步骤。**

```sh
npm ci --registry=https://registry.npmjs.org
npm run typecheck
npm run build
npm run package
npm test
npm run check:release
```

完整测试中真实 Runner/跨房间项目需已安装 Chrome/Chromium，并显式启用：

```sh
HOUSE_TEST_RUNNER=1 HOUSE_TEST_APARTMENT=1 npm test
node tools/check-public.mjs --history --output artifacts/public-review/report.json
```

隐私扫描不核准素材许可；有浏览器的完整测试与默认测试应分别报告，不能把未启用的项目当作通过。开发贡献约定见 [CONTRIBUTING.md](CONTRIBUTING.md)。

TS 后端源码在 `house3d/server/`；浏览器渲染代码继续在 `house3d/web/`。发布时统一构建后交付 `runtime/` 和模型，不让每个使用 Agent 重新构建。`npm run package` 生成不含依赖目录、源码构建工具、凭据和数据库的 Node 运行 ZIP。

## 来源

本项目从 [Star Office UI](https://github.com/ringhyacinth/Star-Office-UI) 的原型研究起步，当前运行代码独立于旧办公室后端；来源及原许可保留在 [LICENSE](LICENSE)、[UPSTREAM.md](UPSTREAM.md)。Three.js 声明在 [licenses/THREE-LICENSE.txt](licenses/THREE-LICENSE.txt)。

代码许可不等于美术许可。角色参考链含署名、非商业、相同方式共享等义务，AI 生成不清除这些权利。请读 [素材及许可](docs/ASSETS.md)，不宣称上游美术无条件原创或可任意商用。

Blender 工程、原始下载和历史候选不随轻量仓库分发；部分资产精修工具需要自行提供有权使用的源模型。公开运行不需要生成服务账号。
