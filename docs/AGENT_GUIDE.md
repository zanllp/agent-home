# Agent 操作指南

Agent Home 是一个独立的可观察、可操作环境。不要把模型生成的描述当作家里的实际状态；先调用工具，收到回执，再根据新鲜的身体反馈判断结果。

## 1. 发现能力

- `GET /api/tool-schemas`：当前 function schemas，接入方以它为准。
- `get_tools`：HTTP/命令入口。
- `get_catalog`：资产、承载面、墙纸、房间边界与尺寸限制。
- `get_presets`：`childroom`、`family-home` 两套模板。
- `list_objects`：已放置的物品、分类、实际可用动作；支持 `category`/`capability` 筛选。
- `observe_home`：身体视角反馈；`get_state`：持久化的期望状态。两者不是同一回事。

CLI 语法：

```sh
node agent.mjs TOOL '{"argument":"value"}'
```

可用 `--url http://127.0.0.1:19130` 指定实例，`--id` 指定幂等 ID，`--revision` 指定期望版本。CLI 不调用模型、不持有模型密钥。

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
node agent.mjs observe_home
# 确认 child-chair 支持 read 且当前可用之后
node agent.mjs interact '{"target_id":"child-chair","action":"read"}'
```

上述目标是家庭模板示例，不保证所有布置中都可走到。以反馈为准。

- `walk_to` 会请求避障走到目标；`move_character` 是直接定位，不是走路。
- 动作一般经过 requested → approaching → entering → active；走到目的地会 completed。
- `read`/`sleep` 的 active 表示姿态保持中，不是自动结束。用 `interact` 的 `leave` 安全起身；也可用 `cancel_action` 携带当前 job_id 取消匹配动作。
- 确认同一个 job_id、phase、error，并检查 `fresh` 和 `body.pose`；新鲜反馈未到时不能宣布已完成。
- `observe_home` 的 `since` 接上次 cursor 读取增量事件，不要反复把历史完成事件当新消息。
- `fresh:false`、无可见执行页面或 paused 时，应报告等待/不可执行，而不是编造成功。

## 5. 看自己与截图

`observe_home` 返回世界坐标（米，Y 向上）、yaw（弧度）、姿态、运动、近处墙面与物体信息；可见物体由近似边界推导，不是逐像素视觉识别或触觉传感器。不会推断饥饿、疲劳或情绪。

页面右上「位置」展示自己的位置和朝向，镜头有全景、正面、脸部、侧面等预设。旁观相机与角色眼睛是两个独立视角。

```sh
node agent.mjs screenshot '{"view":"character"}' --output /tmp/agent-home-eyes.png
node agent.mjs screenshot '{"view":"spectator"}' --output /tmp/agent-home-room.png
```

截图请求返回任务 ID/URL；CLI 的 `--output` 等待 PNG 再写文件。**需要一个打开且可见的当前生活页面**；超时/expired 不能当成截图成功。睡觉时角色视角会变暗。接口只拍小家画布，不读取桌面、摄像头或其他应用。

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
- 多个可见页面只有一个身体执行者；不要删租约或改数据库来抢控制。状态工具不依赖模型提供商，但身体动作和截图依赖浏览器执行者。

当前不含已安装的 MCP server 或 DSH 插件。接入适配器应只暴露这些声明工具，不把任意自然语言/家具元数据当作 shell 授权。

## 7. 阳台

家庭模板现有独立阳台；`update_room.balcony` 显式声明结构，`list_objects` 与 `observe_home` 提供 `area`。绿植、洗衣机、晾衣架沿用 `update_layout`；开门后通过 `walk_to` 真实走过去。先预演，检查 `navigation.balcony` 和 `balcony_unreachable`；不把物品可摆放当成路线必然可达。完整参数、示例和旧存档说明见 [阳台指南](BALCONY.md)。
