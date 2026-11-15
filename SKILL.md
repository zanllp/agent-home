---
name: agent-home
description: Agent Home 里的 3D 小家。查看自己在哪、走到书桌、看书、画蜡笔画、收拾房间、上床睡觉、调整家具、拍照。用户提到家、小屋、回家、家具、走动、睡觉、收拾房间时使用。
---

# Agent Home

这是一间可被 Agent 操作、人在浏览器里观看的 3D 小家。

## 两种调用方式

**仓库内（Node 直接跑）**

```sh
node agent.mjs TOOL '{"argument":"value"}' --url http://127.0.0.1:19130
```

**HTTP 客户端（需要到本机服务的可达路径）**

```sh
node tools/agent-home.mjs state
node tools/agent-home.mjs goto 0 0
node tools/agent-home.mjs goto child-desk
node tools/agent-home.mjs screenshot character --out out.png
```

默认连 `http://127.0.0.1:19130`，可用 `AGENT_HOME_URL` 覆盖（容器里通常是 `http://host.docker.internal:19130`）。

服务默认仅监听回环地址，并检查 Host/Origin。HTTP 客户端会设置本机 Host；这不是身份认证，也不会自动开放容器或远程访问。不要为接入修改成公网监听。

## 先看自己在哪

```sh
node tools/agent-home.mjs observe
```

- `fresh:true`：身体反馈新鲜，但不代表目标动作已完成；还需匹配本次 job 和实际姿态/位置
- `fresh:false` 或 `execution.paused:true`：身体反馈过期或执行暂停，不能确认动作完成
- `execution.requires_visible_viewer:true` 只是说明需要可见页面，不代表页面离线
- `state` 是期望状态，`observe` 才是真实身体反馈

## 切换房屋预设

可用模板是 `childroom`、`family-home`、`connected-home`。尺寸与物品数以 `get_presets` 的实际返回为准，不按旧文档硬编码。`connected-home` 包含儿童房、客厅、走廊、家长卧室、浴室和阳台。

`apply_preset` 会整体替换当前布置，人物回到模板起点，必须先 `dry_run`；不要为了“补一件东西”重置用户的家。保留原布置的扩建用 `connect_rooms`，同样先预演。资源首次加载可能需要等待，先确认执行者和反馈再判断失败。

## 动作

```sh
node tools/agent-home.mjs interactables
node tools/agent-home.mjs call list_interactions '{"capability":"draw"}'
node tools/agent-home.mjs do child-chair sit
```

`interact` 的 action：`sit`、`lie`、`sleep`、`read`、`leave`、`play`、`draw`、`tidy`、`unpack`、`serve_rice`、`eat_rice`、`cook_rice`、`water`、`turn_on`、`turn_off`、`cover`、`uncover`（具体以当前目标的动作列表为准）。

- 走路：`goto X Z` 指定精确空地终点；`goto OBJECT_ID` 自动选物品旁可达位置。桌面物品会靠近其支撑家具，不走进桌子中心。需要时先安全起身，整条路线由小家规划。封路或目标不可达会报错，不擅自移家具或瞬移。
- 看书/画画/坐下直接用 `do TARGET ACTION`，自带走过去，不要先发多段 goto。目标 ID 与动作以 interactables 为准。
- 家具：`update_layout`、`update_object`、`place_furniture`、`remove_furniture`、`update_furniture`
- 房间：`update_room`、`set_wallpaper`、`set_light`、`set_camera`
- 状态：`set_activity`、`set_note`
- 出图：`draw_crayon`、`screenshot`

## 执行者规则

- 默认只有后台 Runner 执行身体。可见页面只是观看端；--no-runner 才使用可见页租约
- 默认 Runner 模式下多个观看标签页不争抢身体，关闭观看页不停止执行；Runner 离线时观看页不会自动接管
- 仅 `--no-runner` 模式需要一个持有租约的可见页面；其隐藏或暂停会影响身体执行
- 动作卡住先查 observe 的任务、错误、执行者与暂停状态；需要取消时用 `call cancel_action '{"job_id":"..."}'` 安全退出，不删数据库或租约，也不盲目重发
- 默认无需打开观看页；Runner 在线即可走路、坐卧、截图。查看 GET /api/runtime

## 客户端动作回执

`goto`、`do` 的身体动作，以及 `call ... --wait` 会等待同一任务与新鲜身体反馈（`body_job_id` 必须匹配）。走路还核对实际到达的位置；坐卧等动作核对保持中的姿态。失败、被替换、暂停、超时均退出非零并返回 `ok:false` 和 `code`，不当成成功。超时不代表任务已取消，先查 observe，不盲目重发。客户端与服务端需一起更新。

已完成/失败的旧任务不会再次取消；收玩具、开灯、盖被子、盛饭等即时物品操作不自动起身，也不等待无关的身体任务。它们成功表示物品状态已保存，不表示执行了进食等尚不存在的身体动画。

## 从可交互列表选择动作

`interactables` / `list_interactions` 返回按物品组织的动作，不隐藏不可用项：

- `available`、`reason`：现在能否执行、不能的原因（暂停、没有身体反馈、忙碌、路线被挡等）。
- `reachability: reachable`：从当前身体位置到接近点、再进入姿态的通道已检查；执行时会重新规划，不是永久保证。
- `command.tool` / `command.arguments`：直接调用的工具与参数。`walk_then_pose` 一次调用走过去并进入姿态，不要先把 `approach` 拆成走路命令；它只是预览。
- `execution: state_update`：只更新物品状态，不宣称身体已经走去开灯或盛饭；`leave_pose` 是安全起身。
- 列表带 `revision` 和身体位置。家里或身体变了就重新读；不要沿用旧列表当作成功回执。

例如列表中的 `{"tool":"interact","arguments":{"target_id":"child-chair","action":"draw"}}` 可用 `call interact ... --wait`，也可用 `do child-chair draw` 等待真实身体反馈。若列表说先结束互动，先起身；便捷 `do` 会自动安全起身后再开始身体动作。

## 有限生活安排

查询计划的两种 CLI 写法：

```sh
node agent.mjs get_life_plan
node tools/agent-home.mjs call get_life_plan
```

`call set_life_plan` 接受 `title` 与 `steps`；持续姿态必须给 `duration_seconds`，步骤可带 `when`/`until` 条件。用 `get_life_plan` 读取检查点，`control_life_plan` 暂停、继续或安全取消。完整例子与限制见 [Agent 指南](docs/AGENT_GUIDE.md#生活安排一次决定分步执行)。

计划完成后会停止，不会持续自主选事，也不会唤醒模型。不要因为已提交一张计划，就承诺角色会永远自己生活。浇水有冷却；一锅饭可盛三碗，空锅重新煮饭需要半小时。先看实际物品状态，不重复消耗资源。
