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
node tools/agent-home.mjs screenshot character --out out.png
```

默认连 `http://127.0.0.1:19130`，可用 `AGENT_HOME_URL` 覆盖（容器里通常是 `http://host.docker.internal:19130`）。

服务端只接受 `Host: localhost`，客户端已处理；不要用浏览器 fetch 直接打接口。

## 先看自己在哪

```sh
node tools/agent-home.mjs observe
```

- `fresh:true`：刚拍的身体反馈，可信
- `fresh:false` / `age_seconds` 很大 / `execution.requires_visible_viewer:true`：没有可见的执行者，身体动不了
- `state` 是期望状态，`observe` 才是真实身体反馈

## 两套房子

| id | 名字 | 气质 |
|---|---|---|
| `childroom` | 儿童房（鲸鱼主题） | 6×5m，9 件：床 / 书桌 / 椅子 / 书架 / 沙发 / 绿植 / 台灯 / 地毯 / 窗 |
| `family-home` | 和饲养员的家 | 8×6.5m，79 件，urban 风，带 3.6×2m 阳台 |

- 儿童房完整就是 9 件；少了 `sofa` 或 `window`、房间显空，重新 `apply_preset childroom` 恢复
- 应用模板会整体重置布置，人物回到出生点；先 `dry_run` 再应用
- 切换后网页会黑屏几秒（资源加载），等加载完再判断

## 动作

```sh
node tools/agent-home.mjs interactables
node tools/agent-home.mjs do child-chair sit
```

`interact` 的 action：`sit`、`sleep`、`read`、`leave`、`play`、`draw`、`tidy`、`unpack`、`serve_rice`、`turn_on`、`turn_off`、`cover`、`uncover`。

- 走路：`goto X Z`（自动离开座位、目标被占时在附近找空位）
- 家具：`update_layout`、`update_object`、`place_furniture`、`remove_furniture`、`update_furniture`
- 房间：`update_room`、`set_wallpaper`、`set_light`、`set_camera`
- 状态：`set_activity`、`set_note`
- 出图：`draw_crayon`、`screenshot`

## 执行者规则

- 同时只有一个页面能当"身体执行者"（最近心跳且可见）
- 多个标签页会让动作卡在 `requested` / `approaching`
- 后台标签页会暂停动作，切回前台会继续
- 动作卡住：`call cancel_action '{"job_id":"..."}'` 清掉再重试
- 只有页面开着，走路/坐下/睡觉/截图才能完成
