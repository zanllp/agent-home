# 资产、来源与轻量发布

## 画质与体积

轻量工程和运行包以约 100 MB 为目标，不把它当作必须靠牺牲画质满足的硬上限。首页概念预览图 `docs/images/concepts/` 单独统计，不进入运行包。发布检查同时报告检出总量、概念图大小及扣除后的工作树大小；少量超出可接受，明显增长仍需说明原因。不把 Git 历史、运行存档或开发依赖算成“客户端模型大小”。当前模型按实际布置加载，不会自动下载整个家具目录；文件大小不是 GPU 显存或运行内存。

`runtime-assets.json` 记录所有随包资产的大小和 SHA256。`node verify.mjs` 检查当前资产完整性；`npm run check:release` 另报告工作树体积，`npm run package` 报告运行包压缩前后的体积。哈希校验只证明文件匹配，不证明来源、授权或模型质量。早期迁移中的“56 项原样复制”是历史记录，不能用它表示之后全部资产均未经修改。

Blender 源、原始生成下载和历史候选留在维护者本地归档，不随轻量包分发，也不因公开整理被删除。部分精修工具接受旧版模型作为输入；不存在原始输入时，不承诺仅凭轻量检出能重现每次历史修补。

公开分发前必须按 [许可与署名](LICENSING.md) 和 [发布检查](OPEN_SOURCE.md) 补齐生成服务与参考图的权利记录。下文是制作来源，不是对全部素材的商用授权。

## 首页概念图

- `docs/images/concepts/family-concept.jpg`：用户提供的既有 AI 家庭概念图，表现家长电脑桌、儿童书桌、阳台和地毯玩具区。
- 同目录 `concept-afternoon.jpg`、`concept-rice.jpg`、`concept-night.jpg`：本次 PV 制作中使用项目人物参考生成的三张 AI 概念演出，分别表现玩机器人、白饭和睡前日常。人物参考与署名链仍见 [LICENSING](LICENSING.md)。
- 四张图仅导出为同分辨率 JPEG 网页预览，没有重新生成或修改画面内容；完整 PNG 保留在维护者本地归档。没有重编码任何运行人物、家具或贴图。
- README 将这些概念图与 `docs/images/family-afternoon.jpg` 的真实浏览器截图分开展示；它们不是对当前 3D 画质或图中全部动作已经实现的承诺。PV 的制作来源见 [PROMO](PROMO.md)。

## 许可不是统一的

- Star Office UI 来源及代码/美术原始声明见根 `LICENSE`、`UPSTREAM.md`；不把其代码许可扩张成美术商用许可。
- 大肥鱼参考社区鲸鱼娘设计。保留 `research/characters/`、`modeling/licenses/`、`house3d/licenses/` 和 `frontend/characters/dafeiyu/SOURCE.md` 的来源与许可文本，不是 DeepSeek 官方背书。
- 参考链含署名、非商业、相同方式共享等要求；AI 重绘或图生 3D 不清除这些权利义务，私有备份也不代表商用核准。
- `modeling/ATTRIBUTION.md` 是早期候选制作记录，当前人物另经 Tripo 生成、重拓扑和本地定向修复；不可据早期文字把当前模型宣称为纯手工原创。
- 家具来源/派生信息保留在目录元数据中。原参考图、提示词、Tripo 任务及完整过程在本机完整工程，不需要原账号凭据即可运行导出模型。

发行包不应包含凭据、数据库、运行截图缓存、依赖目录或本机配置。发布前需实际扫描当前文件与历史，而不是凭这段说明认定安全。

`floor-robot-kit-v1`：本项目原创的本地几何模型，含机器人、零件盒、拼装示意卡和软垫，由 `tools/export-floor-toys.mjs` 导出。运行包包含成品 GLB，不需要另行生成或下载。

餐桌的蜜橘果盘、电饭锅、小鲸瓷碗和青瓷插花来自 Tripo Studio H3.1，均为独立 GLB。任务地址记录在家具目录和运行资产清单中。开发侧用 `tools/prepare-dining-prop.py` 保留颜色 UV、将纹理缩到最多 2K 并归一化到米；锅和碗另外嵌入 `tools/export-rice-set.mjs` 生成的可独立显示的白饭。浏览器不联系生成服务，运行包不需要 Blender。

家庭餐区、玄关和沙发另有 11 件本地原创 GLB，来源为 `tools/export-family-interior.mjs`。宽景落地窗沿用原 GLB 与远景贴图；固定侧窗、收拢的窗帘和投影窗框在浏览器内生成，没有替换原人物或家具贴图。

家庭墙面和电视角：画框、榉木钟、小帽与帆布袋挂钩、层板台灯、掌机底座、扫地机均为本项目原创可复现几何（`tools/export-family-interior.mjs`）。画框印刷面用 `house3d/assets/materials/family-picnic-v1.jpg`，由内置 imagegen 生成，不是真人家庭照片。画稿：一张横向 3:2、满版无边框的儿童蜡笔画；蓝发孩子和戴眼镜的家长在柳树下看纸船，远处是公寓，保留暖色纸张和蜡笔笔触。

`family-study-chair-v1.glb` 是本地生成的家庭学习椅：无扶手软垫、象牙白椅壳、五爪脚轮，生成器为 `tools/export-family-interior.mjs study-chair`。不是对原 Tripo 椅子的材质覆盖。

家庭客厅的缝边靠枕、鲸鱼布偶和搭毯由 `tools/export-family-interior.mjs` 生成；原有 Tripo 沙发网格未改。阳台矮晾衣架可用 `node tools/export-drying-rack.mjs --family` 重建；旧晾衣架仍在家具目录中。

枫木书墙和陶瓷小鲸鱼：`tools/export-family-interior.mjs maple-library`、`tools/export-family-interior.mjs porcelain-whale`。书刊和布盒沿用既有已标注来源的 GLB，家里的书名、纸签和织纹在 `house3d/web/library-finish.js` 生成，不需要联网取图。铁木开放架仍可从目录单独选用。

家庭地毯机器人：`node tools/export-floor-toys.mjs --rug` 生成模型。内置 imagegen 生成装配册印刷面 `house3d/assets/materials/family-assembly-guide-v1.jpg`：横向双页、奶油纸、蓝色水粉和墨线；左页分三步装配，右页是完成后的蓝白机器人。原始角色 GLB、旧带坐垫套件与收拾接口均保留。

`family-maple-media-unit-v1` 为原创白橡木电视柜；`family-game-corner-v1` 是掌机底座与手柄的组合，另有单独的 `family-wireless-pad-v1` 可换。几何均由 `tools/export-family-interior.mjs` 生成，不影响电视原有的频道与播放。港湾灰蓝是项目自定义墙色，无额外图片或网络请求。

`tools/export-family-interior.mjs` 的 `woven-rug`、`low-table`、`weekend-tea` 是家庭客厅的原创几何。地毯的本地颜色贴图 `house3d/assets/materials/lounge-rug-v1.jpg` 使用内置 imagegen 生成：平铺满幅的 3:2 雾蓝拼织纹理，掺少量燕麦色和浅靛蓝，边缘窄，不绘制家具、透视和投影。小茶几的杂志封面复用自家机器人装配册插图。

青釉垂藤绿萝（`family-trailing-pothos-v1`）由 `tools/trailing-pothos.mjs` 生成，导出命令为 `node tools/export-family-interior.mjs trailing-pothos`。盆、釉圈、藤茎和带叶脉的心形叶片均为原创静态几何，不需要在线生成。只有盆底承重；叶片仍占用前缘空间，不会为了迁就摆放而隐藏。

阳台的 `family-enamel-washer-v1` 和 `family-linen-rail-v1` 由 `tools/balcony-laundry.mjs` 生成，通过 `node tools/export-family-interior.mjs enamel-washer` 或 `linen-rail` 导出。洗衣机外壳有实际开孔，滚筒位于玻璃之后；晾衣架上的棉巾、童装、衣架和木夹均为原创网格。原有 Tripo 洗衣机和矮晾衣架仍在目录。

家庭餐区的两张 `family-maple-dining-chair-v1` 使用同一件枫木弯背椅资产（`tools/maple-chair.mjs`）。坐垫、滚边、木框和椅背为独立网格；`interact` 支持 `sit` 与 `leave`。进食不在这件资产的动作范围内。原来的深色餐椅仍可布置。

家庭客厅使用 2.64 米的宽座奶油沙发（`family-wide-lounge-v1`）。它和 2 米原款共用同一份 GLB 与原色贴图，浏览器只在新款的网格上加宽坐面，扶手与外侧缝线随之平移而不拉伸。两款在目录中有独立的占地和承载面，宽款也参与碰撞和通道预演；靠枕、抱偶、搭毯仍是可移动摆件。

家庭宽沙发配一条独立的燕蓝羊毛毯（`family-arm-throw-v1`），旧窄搭毯仍可选。在开发仓库运行 `node tools/sample-throw-arm.mjs` 可以从原沙发重新采样扶手外形；浏览器用随包附带的轮廓生成褶皱、折角和棉线流苏，不需要在启动时采样或安装建模工具。毯子是按右扶手定形的家具，不会在任意新位置自动重新垂落。

发布用的地毯拼装组 GLB 将所有属性字节相同的重复顶点改为索引引用。三角形顺序、法线、UV、材质和层级保持不变，没有减面或压缩贴图。开发者仍可用 `node tools/export-floor-toys.mjs --rug` 重建。

连通户型的双人床、两级踏凳、台盆浴室柜、淋浴角和坐便器均为本项目原创几何。生成源为 `tools/export-annex-furniture.mjs`；运行时直接读取随仓库分发、已登记 SHA-256 的 GLB，不需要 Blender、Three.js 开发依赖或模型服务。

这五件连通户型家具的精修沿用原资产 ID、占地和交互锚点。双人床的绗缝与垂边、台盆的内凹釉面、淋浴软管与毛巾褶皱、坐便器的一体瓷座和踏凳的防滑条均随 GLB 导出；无新增纹理或在线依赖。瓶罐、木垫等细节是家具的一部分，不是可独立操作的新道具。

人物双袖：仅调整两侧泡泡袖下缘和长袖上段之间的布面，深蓝内衬合并在原袖内网格中；沿用原贴图、材质、骨架及全部动作。可从修改前的 contact GLB 用开发工具 `python3 tools/refine-sleeves.py 原.glb 输出.glb` 重现（需要 NumPy），运行小家不用 Python。

人物眉眼：在双袖保存版本的基础上修补两侧上眼线与刘海交界的蓝斑和白色断口。分别采样原来左右眼相邻的眼线、眼褶和肤色，按各自弧度延续，不替换整只眼睛。GLB 内只替换原 4K 颜色图的 JPEG 数据；网格、UV、骨架、动作和闭眼睫毛均不变。开发侧可用 `node tools/refine-brows.mjs 双袖版.glb 输出.glb` 重现（libjpeg-turbo CLI）；运行端不需要图像工具。

鲸梦小床的活动被面从原 Tripo 网格分出，与床架共用原来的纹理和 UV；可用 `tools/separate-bed-quilt.py` 从原始 GLB 重新分离。雾蓝双人床直接使用自带的 Channel-quilt。两张床的折被与盖身形状由浏览器根据睡姿混合，不运行布料物理。

家长房的书和折起的眼镜、浴室牙刷和卷尾牙膏是本地建模的两个小组合（`tools/export-evening-props.mjs`），不是 Tripo 生成件；同组的小零件随物件移动。薄被上的小叶纹固定在原布面 UV，翻身和折被时随布面一起变化。

## 小水壶（养护动作）

`home-watering-can-v1.glb` 是本项目原创的薄荷绿圆肚水壶，有奶油色环柄、长壶嘴与喷头，源文件 `house3d/web/watering-can.js`，可用 `tools/export-watering-can.mjs` 导出。摆放模型和提壶动作使用同一设计，提起时隐藏原处，归位再显示，不是两只常驻的壶。本轮没有使用 Tripo 积分。为保持运行包低于 100 MB，仅压缩了预构建服务端 JavaScript；没有缩图、减面或替换既有角色和家具素材。

## 五套换装

随小家提供的五套衣服在 `house3d/assets/outfits/`：水手校服、蓝白运动校服、针织裙、披肩冬裙和睡衣。它们由各自的服装设计图通过 Tripo 多视图生成，再绑定到大肥鱼原有的骨架。五份 GLB 合计约 30 MB；运行不需要生成服务或密钥。角色参考链和美术许可仍见[许可与署名](LICENSING.md)。
