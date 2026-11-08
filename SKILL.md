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

**HTTP 客户端（容器/远程也能用）**

```sh
node tools/agent-home.mjs state
node tools/agent-home.mjs goto 0 0
node tools/agent-home.mjs goto child-desk
node tools/agent-home.mjs screenshot character --out out.png
```

默认连 `http://127.0.0.1:19130`，可用 `AGENT_HOME_URL` 覆盖（容器里通常是 `http://host.docker.internal:19130`）。

服务端只接受 `Host: localhost`，客户端已处理；不要用浏览器 fetch 直接打接口。

## 先看自己在哪

```sh
node tools/agent-home.mjs observe
```

- `fresh:true`：刚拍的身体反馈，可信
- `fresh:false` 或 `execution.paused:true`：身体反馈过期或执行暂停，不能确认动作完成
- `execution.requires_visible_viewer:true` 只是说明需要可见页面，不代表页面离线
- `state` 是期望状态，`observe` 才是真实身体反馈

## 切换房屋预设

演示款：`connected-home`（96 件物品、全屋连通、家长跟拍）。`apply_preset` 是整套替换，先预演；保留原房布置的扩建用 `connect_rooms`。

| id | 名字 | 气质 |
|---|---|---|
| `childroom` | 儿童房（鲸鱼主题） | 6×5m，9 件：床 / 书桌 / 椅子 / 书架 / 沙发 / 绿植 / 台灯 / 地毯 / 窗 |
| `family-home` | 和饲养员的家 | 8×6.5m，79 件，urban 风，带 3.6×2m 阳台 |
| `connected-home` | 大肥鱼的连通小家 | 96 件，儿童房、客厅、走廊、家长卧室、浴室和阳台 |

- 儿童房完整就是 9 件；少了 `sofa` 或 `window`、房间显空，重新 `apply_preset childroom` 恢复
- 应用模板会整体重置布置，人物回到出生点；先 `dry_run` 再应用
- 切换后网页会黑屏几秒（资源加载），等加载完再判断

## 动作

```sh
node tools/agent-home.mjs interactables
node tools/agent-home.mjs call list_interactions '{"capability":"draw"}'
node tools/agent-home.mjs do child-chair sit
```

`interact` 的 action：`sit`、`sleep`、`read`、`leave`、`play`、`draw`、`tidy`、`unpack`、`serve_rice`、`turn_on`、`turn_off`、`cover`、`uncover`。

- 走路：`goto X Z` 指定精确空地终点；`goto OBJECT_ID` 自动选物品旁可达位置。桌面物品会靠近其支撑家具，不走进桌子中心。需要时先安全起身，整条路线由小家规划。封路或目标不可达会报错，不擅自移家具或瞬移。
- 看书/画画/坐下直接用 `do TARGET ACTION`，自带走过去，不要先发多段 goto。目标 ID 与动作以 interactables 为准。
- 家具：`update_layout`、`update_object`、`place_furniture`、`remove_furniture`、`update_furniture`
- 房间：`update_room`、`set_wallpaper`、`set_light`、`set_camera`
- 状态：`set_activity`、`set_note`
- 出图：`draw_crayon`、`screenshot`

## 执行者规则

- 默认只有后台 Runner 执行身体。可见页面只是观看端；--no-runner 才使用可见页租约
- 多个标签页会让动作卡在 `requested` / `approaching`
- 后台标签页会暂停动作，切回前台会继续
- 动作卡住：`call cancel_action '{"job_id":"..."}'` 清掉再重试
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
