# Agent 操作指南

Agent Home 是一个独立的可观察、可操作环境。不要把模型生成的描述当作家里的实际状态；先调用工具，收到回执，再根据新鲜的身体反馈判断结果。

## 1. 发现能力

- `GET /api/tool-schemas`：当前 function schemas，接入方以它为准。
- `get_tools`：HTTP/命令入口。
- `get_catalog`：资产、承载面、墙纸、房间边界与尺寸限制。
- `get_presets`：`childroom`、`family-home`、`connected-home` 三套模板。
- 无存档的首次启动默认使用 `connected-home`；更新不会自动替换已有布置。已有用户想换成它，仍需先预演再明确应用 `apply_preset`。
- `list_objects`：已放置的物品、分类、状态；支持 `category`/`capability` 筛选。
- `list_interactions`（`GET /api/interactions`）：可直接执行的动作列表，保留不可用原因、当前身体的路线检查和 `command.tool/arguments`；同样支持分类/动作筛选。只在选择动作时查询，不必逐帧检查。
- `observe_home`：身体视角反馈；`get_state`：持久化的期望状态。两者不是同一回事。

CLI 语法：

```sh
node agent.mjs TOOL '{"argument":"value"}'
```

可用 `--url http://127.0.0.1:19130` 指定实例，`--id` 指定幂等 ID，`--revision` 指定期望版本。CLI 不调用模型、不持有模型密钥。

先选动作而不是猜坐标：

```sh
node agent.mjs list_interactions '{"capability":"draw"}'
```

检查 `available` 和 `reason`，直接提交返回的 `command`。`execution: walk_then_pose` 已含整段走路和进入姿态；`approach` 是预演信息，不是让 Agent 逐段下发的路线。`state_update` 仅改变物品状态，`leave_pose` 为安全起身。`reachable` 基于当时的身体和布置，执行时仍会重新核验；收到受理后还要确认实际完成。

## 2. 布置：选择、预演、应用

先从目录选资产/支撑面，再提交有序操作：

```json
{
  "operations": [
    {"op":"add","id":"my-books","asset_id":"urban-books-v1",
     "on":{"id":"bookcase","surface":"shelf-3","x":0,"z":0,"yaw":0}}
  ],
  "dry_run": true
}
```

以上示例适用于有 `bookcase` 的家庭模板，仍需先检查该层是否已占用。不要直接照抄后盲目应用。

`update_layout` 默认 dry-run。检查报告的 `errors`、`warnings`、`can_apply`；显式改为 `dry_run:false` 才应用整个批次。会一起验证最终状态，所以可以在同一批交换两个物品位置。布局/身体改变后需重新预演，不能沿用过期结论。

- `on` 中 x/z/yaw 是承载面局部坐标；不传任意 y 高度。
- 移动父家具会带动摆件。父物体被删、面不存在、超出台面、同层干涉、支撑循环会拒绝，不自动删摆件兜底。
- 阻挡检测是包围盒与近似寻路。警告不是物理碰撞仿真的证明。
- 可用 `update_object` 改允许的状态；例如已声明灯具的 on/brightness，而不是发明家电能力。

## 3. 房间与模板

```sh
node agent.mjs update_room '{"width":8.4,"depth":6.8,"height":2.7,"dry_run":true}'
```

宽 4..12、深 4..10、高 2.4..4 米。挂墙物品跟随原墙；地面家具保留位置，不自动缩放。缩小时越界/干涉/阻挡身体会拒绝；先结束走动或坐卧。`update_room` 默认实际应用，预演需明确传 true。

`set_wallpaper` 的 wall_id 为 back/front/left/right/all，wallpaper_id 从目录读。`plain` 移除图案。`update_room` 也支持墙/饰条颜色和 classic/urban 风格。

`apply_preset` 默认预演；实际应用必须传 false。它会替换完整家具布局、房间尺寸/墙面、角色位置、灯光和相机。它不是“切换后自动记住各房间修改”的存档槽；先保存自己的布局，再决定是否覆盖。

## 4. 动作受理不等于完成

```sh
node agent.mjs walk_to '{"x":1.2,"z":0.3}'
# 或只指定物品，小家选择可达边缘；两种参数不能混用
node agent.mjs walk_to '{"target_id":"child-desk"}'
node agent.mjs observe_home
# 确认 child-chair 支持 read 且当前可用之后
node agent.mjs interact '{"target_id":"child-chair","action":"read"}'
```

上述目标是家庭模板示例，不保证所有布置中都可走到。以反馈为准。

- `walk_to` 接收 x/z 或 target_id，自动规划整条路线，无需分段。对象模式要求新鲜、可见、未暂停的站立身体反馈；用该位置选择可达终点，返回 job.target 和 target_id。桌面物品按其地面支撑家具选边缘位置。指定坐标则保持精确目标，不静默换终点；`move_character` 是直接定位，不是走路。
- 动作一般经过 requested → approaching → entering → active；走到目的地会 completed。
- `read`/`sleep` 的 active 表示姿态保持中，不是自动结束。用 `interact` 的 `leave` 安全起身；也可用 `cancel_action` 携带当前 job_id 取消匹配动作。
- 睡着后会自然地在仰睡和侧睡之间翻身，不必重复发 `sleep`。暂停会停在当前姿势；翻身不会改变睡眠任务，也不会替你掀被或盖被。
- 确认同一个 job_id、phase、error，并检查 `fresh`、`body_job_id` 和 `body.pose`；`body_job_id` 是身体快照对应的任务，不是当前期望任务。它必须与本次 job.id 一致；新鲜反馈未到时不能宣布已完成。
- `observe_home` 的 `since` 接上次 cursor 读取增量事件，不要反复把历史完成事件当新消息。
- `fresh:false`、无在线执行者或 paused 时，应报告等待/不可执行，而不是编造成功。

HTTP 便捷客户端 `node tools/agent-home.mjs goto X Z` 和 `do TARGET ACTION` 会等待匹配任务及身体反馈，失败返回非零退出码。已完成的旧任务不再取消或多等四秒；即时物品操作不会自动起身。超时只表示尚未确认，不会自行取消正在执行的动作。

## 5. 看自己与截图

`observe_home` 返回世界坐标（米，Y 向上）、yaw（弧度）、姿态、运动、近处墙面与物体信息；可见物体由近似边界推导，不是逐像素视觉识别或触觉传感器。不会推断饥饿、疲劳或情绪。

页面右上「位置」展示自己的位置和朝向，镜头有全景、正面、脸部、侧面等预设。旁观相机与角色眼睛是两个独立视角。

```sh
node agent.mjs screenshot '{"view":"character"}' --output /tmp/agent-home-eyes.png
node agent.mjs screenshot '{"view":"spectator"}' --output /tmp/agent-home-room.png
```

截图请求返回任务 ID/URL；CLI 的 `--output` 等待 PNG 再写文件。**默认需要在线 Runner；--no-runner 模式才需要可见生活页面**；超时/expired 不能当成截图成功。睡觉时角色视角会变暗。接口只拍小家画布，不读取桌面、摄像头或其他应用。

## 6. HTTP、并发与重试

```json
{
  "id":"unique-intent-id",
  "expected_revision":286,
  "tool":"set_light",
  "arguments":{"preset":"day"}
}
```

POST `/api/commands`。revision 必须来自刚读取的状态，不硬编码示例值。

- 409：版本冲突或幂等 ID 被不同请求复用。重新读取、判断意图、预演后再发新请求。
- 400：参数/直接操作验证失败；422：批量布局正式应用被阻止，查看 layout 报告。
- 同一 ID + 完全相同请求重试可返回已保存结果；不要对一次已受理动作生成新 ID 盲目重复。
- 默认 Runner 是唯一执行者，多个观看页只同步展示；--no-runner 模式才由一个可见页执行；不要删租约或改数据库来抢控制。状态工具不依赖模型提供商，但身体动作和截图依赖浏览器执行者。

当前不含已安装的 MCP server 或 DSH 插件。接入适配器应只暴露这些声明工具，不把任意自然语言/家具元数据当作 shell 授权。

## 7. 阳台

家庭模板现有独立阳台；`update_room.balcony` 显式声明结构，`list_objects` 与 `observe_home` 提供 `area`。绿植、洗衣机、晾衣架沿用 `update_layout`；开门后通过 `walk_to` 真实走过去。先预演，检查 `navigation.balcony` 和 `balcony_unreachable`；不把物品可摆放当成路线必然可达。完整参数、示例和旧存档说明见 [阳台指南](BALCONY.md)。

### 坐在地毯上玩机器人

家庭模板的沙发旁有一套软垫、零件盒、说明卡和机器人。它是可移动的普通家具（资产 `floor-robot-kit-v1`），不是贴在地毯上的背景。已有存档不会被模板自动覆盖；没有这件玩具时可用 `update_layout` 在空地预演添加，检查碰撞及可达性，再应用。

```sh
node agent.mjs list_objects '{"category":"play","capability":"play"}'
node agent.mjs interact '{"target_id":"floor-workshop","action":"play"}'
node agent.mjs observe_home
node agent.mjs interact '{"target_id":"floor-workshop","action":"leave"}'
```

使用实际返回的物品 ID。新鲜反馈里，同一任务为 `active`、身体为 `play`、手持 `toy_robot` 才表示已拿起。正面镜头会把软垫、双手和说明卡一起框入；第一人称截图看向手里的玩具。起身后机器人回到原处，结束再移动整组。当前动作是拿起、端详和摆弄成品，不是独立零件的物理拼装。

### 用蜡笔画一张画

Agent 自己决定画什么、用什么颜色和线条。一次调用 `draw_crayon` 就返回最终静态 PNG，不排队、不要求房间页面在线，也不会改变大肥鱼的动作。最新作品在 `get_state.last_drawing`，每张图有独立的 `artwork.url`；下一幅不会覆盖旧链接。在家庭预设里可以指定 `target_id: "workbook"`，画会出现在儿童书桌的绘本右页。不指定则选当前房间的第一本摊开的绘本或练习册；没有画本也能出图。

    node agent.mjs draw_crayon '{"title":"窗外的小太阳","marks":[["oval","ochre",72,23,10,10],["line","mint",4,78,28,55,52,75,72,59,96,78]]}' --output sunshine.png

坐标按纸面百分比（左上 0,0，右下 100,100）。按从背景到细节的顺序给 1–32 笔：`line` 连续折线，`oval` 椭圆轮廓，`wash` 矩形涂色。六色为 ink、mint、green、blue、ochre、coral。直播时建议模型直接给十来笔，不要先解释、逐笔调工具或输出 SVG。自定义端口时 CLI 加 `--url http://127.0.0.1:19134`。

给原画添笔：把当前画的 `artwork.url` 作为 `base_url`，只传新增的笔画（和新标题），仍一次返回一张静态图。旧链接保留；画本已换页则拒绝，先重新看当前作品。可以用简笔画降低构图难度，例如 `["flower","coral",84,75,8,15]` 表示在右下画一朵花，后四个数是中心和半宽、半高。也支持 `sun` 和 `house`。

### 收好地毯上的玩具

用 `list_objects {"capability":"tidy"}` 找到玩具组，然后 `interact {"target_id":"floor-workshop","action":"tidy"}`。机器人和三块散件回到托盘，坐垫和说明书留在原处；`properties.packed` 为 true。用 `unpack` 把它们摆回地毯。两者都是立即生效的物品状态，不是行走任务；可以在她坐在这组玩具上玩的时候调用，不必先让她起身。

想让观众看到她本人在画：先用 `list_objects {"capability":"draw"}` 找到前面有桌子和摊开绘本的椅子。在家庭预设里调用 `interact {"target_id":"child-chair","action":"draw"}`。这是身体动作，需要在线 Runner 或可见页执行者；等同一任务进入 `active`、`observe_home` 报告 `pose: draw` 和手持 `crayon`，再调 `draw_crayon` 出图。此时不传 `target_id` 默认画在她膝前的那本；起身用这把椅子的 `leave`，本子回到桌上。只要 PNG 则不必先就座。

### 电饭锅与小饭碗

家庭预设的餐桌上有一口打开的电饭锅（初始 3 份白饭）和一只空碗，两者是可分别摆放的物件。用 `list_objects {"capability":"serve_rice"}` 找碗，然后 `interact {"target_id":"rice-bowl","action":"serve_rice"}` 盛一碗。锅和碗须在同一件家具的同一台面上；有多口锅时用最近且还有饭的那口。盛好后锅的 `properties.servings` 减 1，碗的 `properties.filled` 为 true。不能往满碗重复盛；这是即时物品变化，不是人物吃饭动画。现有存档不会自动被新预设覆盖。

### 家庭直播和生活区

`set_camera {"preset":"broadcast"}` 是房间内前方高处的固定镜头，拍得到墙、窗和真实天花板，不显示 HUD、位置图或物品面板，也不接管人物。轻点画面或在画布聚焦时按 Esc/V 回到普通全景；Agent 可随时再调 `set_camera`。需要查全屋或摆家具时用 `home`。直播截图用 `screenshot {"view":"spectator"}`。

家庭预设里，橘子盘放在餐垫上，旁边的小白花瓶（`dining-flowers`）可单独挪走。靠枕、鲸鱼和搭毯放在沙发上，拖鞋在门垫上；这些都是独立物件，可用 `update_layout` 预演移动。电饭锅与小碗仍在同一张餐桌上。入户门是内景装饰，不是通往其他房间的出口。阳台的两侧亮窗为固定玻璃，中央滑门才是通行口。

家庭电视柜可以布置 `top`、`upper_bay`、`lower_bay` 三处。目录里的 `surfaces` 会给出尺寸；带 `clearance` 的格子还标出层间净高（米）。先用 `update_layout` 预演：超高返回 `support_clearance`，即使中间垫了另一件物品也不能穿过层板。上格的坐标原点在右侧开放格中央，不是整台电视柜的中央。

家庭预设的 `family-trailing-pothos-v1` 可从书柜或墙上层板整盆移动。选目录中标有 `front_edge` 的承载面，让盆底站稳、枝叶朝向前缘。例如 `pothos-child` 在 `wall-shelf-child` 的 `top` 上，局部位置 `x:0.03, z:0.11, yaw:0`。先用 `update_layout` 预演：`support_overhang` 表示盆底悬空，`foliage_clearance` 表示藤叶会穿板或该台面不支持悬垂。普通盆栽仍按原有规则布置。

家庭模板里，两张书桌上的灯彼此独立。例如：

```sh
node agent.mjs update_object '{"id":"study-lamp","properties":{"on":true,"brightness":0.65}}'
node agent.mjs interact '{"target_id":"study-lamp","action":"turn_off"}'
```

### 给第三个人留个饭位

默认家庭模板留着最后一个家具位置，不强制摆满。要一起吃饭时，可以把第三把枫木椅放到餐桌靠书桌的一侧：

```sh
node agent.mjs update_layout @docs/examples/family-supper.json
```

示例只预演，适用于未改位置的家庭餐区。检查 `can_apply`、每把椅子的 `reachable` 和通往阳台的路线；通过后再原样提交该批操作并显式设 `dry_run:false`。使用 `interact` 对 `family-guest-chair` 请求 `sit`，再用 `observe_home` 看对应 job 和身体姿态。饭后先 `leave`，再预演移除这把椅子即可腾回名额，不必重置房间。

启动、WSL 跨端观看、停用 Runner 和监控字段见 [Runner 与性能日志](RUNNER.md)。

### 直接使用演示中的连通小家

在家里的 agent-home 仓库正常停止旧服务，备份实际使用的 SQLite 存档，执行 `git pull --ff-only`，再按原配置启动。无需安装 npm 依赖或重新构建。传统单房存档不会自动变更。等她站定后执行：

```sh
node agent.mjs get_presets
node agent.mjs apply_preset '{"preset_id":"connected-home","dry_run":true}'
# 仅在确认用整套预设替换当前布置时执行
node agent.mjs apply_preset '{"preset_id":"connected-home","dry_run":false}'
```

预设保存了演示中的墙面、阳台、96 件物品的摆放和状态、日间灯光、阳台起点和家长跟拍。不会从演示机复制动作队列、数据库、会话或天气；角色外观沿用自己的存档。CLI 默认连接 19130；不同端口在每条命令后加 `--url http://127.0.0.1:实际端口`。**想保留自己摆的家具，请用下面的 `connect_rooms`，不要应用整套预设。**

### 把两个房间接起来
在命名的 `family-home` 或标准尺寸的 `childroom` 存档，站定并离开家具交互后：
```sh
node agent.mjs connect_rooms '{}'
node agent.mjs connect_rooms '{"dry_run":false}'
```
第一步仅预览。第二步会保存连通布局；请勿用 `apply_preset` 代替，它会替换布局。原房间内的物件 ID、属性和支撑关系保留；若从儿童房出发，物件和角色一起平移到儿童房的新世界坐标。客厅通向走廊，走廊分别通儿童房、家长卧室和浴室，客厅的阳台保留独立推拉门。家具不能堵门；可用 `list_objects` 找实际 ID，再用 `walk_to` 接近目标，并核对同一 job 的到达反馈。

阳台晾架的 `air_quilt` 会把一条闲置的睡被挂上，优先取鲸鱼床的，`properties.quilt_from` 记录它来自哪张床。晾着时不能盖这条被子；`bring_in_quilt` 收回。床上留床单，睡被不会同时出现在床和晾架上。新一轮睡觉时，有被子就默认盖好；躺下后可以用 `uncover` 把它折到床尾，或用 `cover` 重新盖上。不会模拟“晒干了”或自动判断天气。可以先读 `/api/outdoors` 决定要不要晒。画好的最近一张绘本会展示在家庭书桌的画板上。

饭锅不再常满。一锅能盛 3 次，碗有饭时仍不能重复盛；对碗 `eat_rice` 后可继续盛。锅空后对锅 `cook_rice`，30 分钟后才能再盛，期间不能重复启动。原来的 `keep_full` 和 `refill_rice` 已取消；旧存档升级会关闭常满、把余量限制到最多 3 份，不重置布局。煮饭和吃饭是物品状态，不冒充淘米或进食动画。电视支持重复调用 `turn_on` 或 `turn_off`，关机后屏幕变暗并停止绘制节目。

想看她在房间之间小跑，用 `set_camera {"preset":"companion"}`（画布上叫「家长跟拍」）。相机以约 1.6 米眼高跟着她，不随她转头旋转；根据墙面和家具包围盒检查头、躯干、脚的视线，受挡时换一个角度，空间太窄则取遮挡最少的位置。跟拍时可以拖动、平移或缩放镜头。松手后保留这个角度 30 秒，再平滑回到所选机位；再次调整会重新计时，直接选择机位则立即切换。这个操作只影响自己的观看窗口。走跑走模式在长而通畅的路段最高约 1.65 米/秒，转弯、靠近家具和抵达前收步；「慢慢走」保持原速。

只有「房间全景」「房间俯视」「全屋留影」会剖开近侧墙壁。家庭直播、人物镜头和角色视角截图均保留实墙及阳台栏杆，能透过真实门窗看到另一间房，但不会为了看到角色而隐藏墙壁；固定直播机位不保证总能看到在隔壁活动的她。

连通小家的饲养员卧室有阅读角；`evening-paperback` 是摊开的书和折起的眼镜，`evening-lamp` 可独立开关。走廊挂架和浴室镜前的牙刷套件也都是独立物品。较早的标准连通存档可以在角色空闲时预演 `node agent.mjs update_layout @docs/examples/connected-evening.json`，通过后再将副本的 `dry_run` 改为 `false` 应用。自定义过户型或摆放时先核对位置和 ID，不需要重新套用预设。

### 沙发休息与办公椅

客厅奶油沙发（含宽座款）和云朵沙发支持 `sit`、`lie`、`sleep`。先用 `list_interactions` 确认可达；动作自行走到前侧再进入姿势。软垫办公椅支持 `sit`，用 `leave` 起身，暂不提供转椅或推椅。

同一张沙发已经处于 active 的坐卧姿势时，可以直接切换，不必先起身：

```sh
node agent.mjs interact '{"target_id":"sofa","action":"sit"}'
# 确认 active 和匹配的身体反馈之后再发下一条
node agent.mjs interact '{"target_id":"sofa","action":"lie"}'
node agent.mjs interact '{"target_id":"sofa","action":"sleep"}'
node agent.mjs interact '{"target_id":"sofa","action":"uncover"}'
node agent.mjs interact '{"target_id":"sofa","action":"leave"}'
```

`lie` 睁着眼侧躺，默认不盖毯；电视沿用自己的开关和节目，不会因为躺下自动开机。同房间有打开的电视时会小幅偏头（最多约 21 度），角色视角截图同步朝向；不会隔墙找儿童房外的屏幕。`sleep` 闭眼并默认盖毯，也可以在躺着时单独 `cover` / `uncover`。客厅使用扶手搭毯，展开时不再同时显示扶手上那一条；起身后恢复。没有扶手搭毯的沙发配一条折毯。抱枕和抱偶在侧躺时视觉上收拢到空的一端，起身复位，不改存档摆放。均为预设接触与布形，不是物理布料模拟；小沙发保持侧卧，不做床上的大幅翻身。

### 绿植养护与煮饭时间

`list_objects`、`list_interactions` 和角色观察返回 `care`：绿植有 `moisture`、`needs_water`、`water_due_at`；饭锅有 `status`（ready / empty / cooking）、`servings`、`ready_at`、`remaining_seconds`。时间戳是 UTC 秒，使用真实时间；暂停画面、关浏览器和重启服务不会暂停煮饭或土壤变干，也不需要后台轮询计时任务。

这是统一的虚拟养护规则，不是按真实植物品种推断：3 天后提示浇水，7 天降到 0%，不会永久死掉；浇后恢复 100%，半天内不重复浇。旧绿植从升级时开始算，新放的绿植从摆入时开始算；移动不会重置时间，预演也不会开始计时。

连通模板的阳台配有可独立移动的 `watering-can`（薄荷绿小水壶）。已有连通存档可先预演 `update_layout @docs/examples/watering-can.json`，检查通过后把副本的 `dry_run` 改为 false 应用；不要为添水壶重套模板。自定义布局需调整落点。

```sh
node agent.mjs list_interactions '{"capability":"water"}'
node tools/agent-home.mjs do balcony-ficus water
node agent.mjs list_objects '{"capability":"cook_rice"}'
node agent.mjs interact '{"target_id":"rice-cooker","action":"cook_rice"}'
```

`water` 是有限的身体任务：取壶 → 走到盆栽旁 → 倾倒浇水 → 把壶放回。倒水完成反馈后才记录浇水，取消取壶不算浇过；最终要等同一 job 的 completed、fresh、stand，不能把受理当完成。高于约 1 米或隔着家具够不到的盆栽会拒绝，请先移到可达处。水壶当前不模拟容量消耗，未做灌水流程。

物品菜单可看湿度、剩余碗数、煮饭剩余时间。到点的米饭在下次查询时结算，不因读状态重复加饭；相关时间保存在原 SQLite 存档里，不随模板之外的文件更新清空。

## 生活安排：一次决定，分步执行

不必每个坐姿都等下一次模型唤醒。模型给出有限步骤，由当前服务调度、原有 Runner 执行；不增加模型调用或第二个身体执行者。不改 DSH 的 16–20 分钟周期，也没有接入提前唤醒模型。

先检查物品 ID 和当前姿态，再提交（示例用于 `connected-home`；不要为用示例重置已有布置）：

```sh
node agent.mjs set_life_plan @docs/examples/after-school.json
node agent.mjs get_life_plan
node agent.mjs control_life_plan '{"action":"pause"}'
node agent.mjs control_life_plan '{"action":"resume"}'
node agent.mjs control_life_plan '{"action":"cancel"}'
```

- 1–16 步；`action` 和 `target_id` 从实际物品能力选择。坐、读书、画画、玩具、躺卧、睡觉必须给 `duration_seconds`（5–1200 秒）。时间从**匹配 job 的真实姿态反馈**开始，不从受理开始。画画步骤只是已有持笔动作，不会代替模型生成画作；盛饭/吃饭只是已有物品状态操作，不冒充完整进食动画。
- 浇水等有限动作等待完整完成；持续姿态到时安全起身再走下一步。盛饭、开电视、收玩具等物品操作会先走近目标。每步以当前布局和可用性重新检查，不绕过冷却、空碗、剩饭或寻路规则。
- `when:{condition,target_id,on_false?,timeout_seconds?}`：条件为 `needs_water`、`rice_ready`、`bowl_empty` 或 `bowl_full`；不满足默认跳过。`on_false:"wait"` 可等待（默认1900秒，允许5–3600秒），到时仍不满足就停止并报告原因。
- 持续姿态可加 `until:{condition,target_id}`，如玩玩具时等饭好；条件满足或持续时间耗尽均安全退出。它只判断家里的实际状态，不自行编造需求或理解新信息。
- `get_life_plan` 返回 `status`、`index`、当前 `phase/job_id`、`history` 和错误。`completed` 才是整个安排完成；`needs_attention` 要重新观察、处理原因，再提交新安排，不自动重试耗材动作。
- `pause` 暂停安排和计时，不会硬切断正在走的路或正在倒的水。`cancel` 会安全退出自己的动作，等匹配的站立反馈后才标记 `cancelled`。画布顶部有“暂停/继续安排”和“结束安排”，底部原有“暂停”仍是暂停整个身体。
- 手动身体指令和布置修改成功后，安排让出控制并暂停；不抢回用户的新动作。若原 job 已被替换，旧安排不能直接继续，应取消后重新安排。
- Runner 离线、页面不可见或全局暂停时不推进计时。重启保留检查点，恢复新鲜反馈后继续原步骤，不快进或重放已完成的盛饭/浇水。调用方仍需查看反馈，不能保证关机时身体继续活动。

例如“饭好后去盛饭”可以放在玩具步骤后：

```json
{"action":"serve_rice","target_id":"rice-bowl","label":"饭好啦，去盛一小碗","when":{"condition":"rice_ready","target_id":"rice-cooker","on_false":"wait","timeout_seconds":1900}}
```

只在有安排时每秒检查一次；静态等待不反复写存档、不强制画帧。现有米饭半小时和植物天级时间规则不变。调度过程写入已有事件流 `life_plan_progress`，便于接入方以后按完成、失败或需要重新决策的事件唤醒模型。
