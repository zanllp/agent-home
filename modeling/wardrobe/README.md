# 大肥鱼试衣间
五件服装都能在正式小家换上，共用大肥鱼原来的脸、头发和动作，默认仍为原装。

- `../../house3d/assets/outfits/snow-letter.glb`：雪夜来信，短披肩、冬裙、针织袜和短靴。
- `../../house3d/assets/outfits/moon-tide.glb`：晚安小鲸，软领上衣、长裤与软袜。
- 开发环境在项目根目录运行 `npx --no-install vite --host 127.0.0.1 --port 19243`，打开 `/modeling/wardrobe/`。默认加载实际导出的 GLB，以 2× 像素密度预览，可换装、转镜头、播放原动作。加上 `?outfit=school-track&tour` 可直接看指定套装依次小跑、抱书、坐下，各旋转一圈。三姿势环视可对照前后侧面；转台以 48 个等距角度分别渲染垂手、抱书和坐下。
- `node modeling/wardrobe/check.mjs` 核对资产指纹、关节顺序、逆绑定矩阵、权重、坐姿形变与自发色画风。替换导出物需复核画面再同步 manifest 中的指纹。

## 一个人物，一个动作源，多个服装包
1. `manifest.json` 锁定原底模 SHA-256、骨架版本、覆盖规则和稳定服装 ID。`reference` 永远代表原装。GLB 只携带衣服、内嵌贴图及 glTF 所需的绑定关节定义，不复制人物、动作或动画播放器。
2. `house3d/web/outfit-fit.js` 在挂载前验证所有关节名、顺序和逆绑定矩阵，再让衣服使用人物正在播放的同一份 Skeleton。鞋袜跟足骨、袖口跟前臂、披肩跟上身；坐下时同一个 `SeatedFit` 参数展开裙摆/衣摆。无需每帧计算布料物理。
3. 替换衣服时保留原脸、长发、鱼鳍、尾巴和手指。原扫描把手和袖子合并、下巴的一条边划进了 Dress。睡衣在腕部截面外从指尖沿连通面保留整只手，排除不相连的旧蕾丝；下巴保留原来的贴图选区。新袖口沿针织边切开，左右分别对齐手腕，不改源 GLB。还原时直接恢复原几何和可见性。
4. 颜色沿用人物的无光照绘制方式。款式来自本轮 AI 原创试衣图的第 1、3 套。`swatches/` 是入选布片参考；1 号冬装来自 Tripo H3.1 三视图任务 `00e5ed18-ec6c-413c-9757-dd232800c299`。`tripo/winter.py` 切开袖口，并给同一条裙子制作坐姿和被下躺姿形变。重做冬装时运行 `python winter.py prepared.glb character.glb outfit.glb original-tripo.glb`；第四个参数用于从原始导出直接复制 4096 × 4096 颜色贴图，不再编码。3 号睡衣使用 Tripo H3.1 的正、左、后三视图任务 ecba1fed-b102-40e8-ae5e-5bc3c8b0fb09 生成，保留生成的衣服与 UV。`tripo/prepare.py` 精简原始导出，`tripo/fit.py` 适配原骨架与坐姿；旧的手工睡衣不是当前预览资产。底模参考与许可仍见项目 docs/LICENSING.md。

重导这三份资产时，先对未修脚的导出文件运行 `python tripo/feet.py input.glb output.glb`，再更新资产指纹。3 号睡衣在更新指纹前，还需对修脚后的 GLB 运行 `python tripo/sock_toes.py input.glb output.glb`，把分趾前掌收成一整个针织袜头（制作时需要 libjpeg-turbo，运行小家不需要）。前一步拆开原装鞋内侧的连接面；两件换装按左右脚各自的连通网格修正绑定，不靠缩小跑步步幅掩盖问题。

## 正式小家
使用 `set_outfit` 切换原装、冬装、睡衣，以及 `sailor-day`（水手校服）、`school-track`（蓝白运动校服）、`lilac-reader`（窗边读书）。三件日常装分别从独立三视图生成，保留 Tripo 原始 4K 色图；离线重建命令为 `python daywear.py 套装ID raw.glb prepared.glb character.glb outfit.glb`；Runner 与观看页读取同一个存档。试衣间和正式小家共用服装 GLB 和蒙皮代码。

## 角色与换装验收

在仓库根目录运行 `npm run check:wardrobe`（开发依赖已安装，本机有 Chrome/Chromium）。试衣间使用当前源码；卧室使用正式的预构建小家和临时存档。如果刚改了小家的运行时代码，先 `npm run build`。不访问正在使用的存档，不要求 Python、Blender 或模型密钥。

- **人看**：打开命令最后打印的 `index.html`，选套装，先看全身正面、侧面、背面，再按部位筛选、点图放大。仰睡和侧睡取自独立小家的实际床铺，不是试衣间的躺姿。图片内嵌，单发 HTML 也能离线看。
- **Agent 看**：同目录的 `report.json` 记录每项检查、每张图的套装、动作、机位、文件和指纹。失败返回非零；缺图或缺浏览器不能算通过。自动通过不等于美术认可。
- **前后对照**：人工认可某轮后，保留它的整个目录。下一次运行 `npm run check:wardrobe -- --baseline "已认可目录/report.json"`；同机位并排显示，新增或改机位的图不冒充对照。JSON 的 `changed_bytes` 仅表示文件不同，不是穿模判定。不会自动挑选或覆盖基准。
- 默认每轮新建 `artifacts/wardrobe/reports/<时间>/`；可用 `--out 新目录` 指定位置。报告和截图不随运行包分发。
