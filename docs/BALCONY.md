# 可走入、可布置的阳台

## 当前范围

家庭模板附带 3.6 × 2 米阳台，连接左墙推拉门。儿童房不默认附带阳台。阳台地面、护栏是房间结构；绿植、洗衣机和独立晾衣架是普通持久化物件，不再挂在窗户模型下面。移动窗户不会带着这些家具走。

阳台与室内共用世界 X/Z 坐标、人物比例和地面高度。`get_catalog.room.balcony` 返回尺寸、世界边界、门状态；`list_objects` 的 `area`、`observe_home.area` 为 `interior` 或 `balcony`。画布的「位置」面板显示阳台轮廓、角色位置和朝向；两种截图都包含真实场景。

## Agent 操作

先查询当前目录、房间和物品，不假定用户仍在默认模板：

```sh
node agent.mjs get_catalog
node agent.mjs list_objects
node agent.mjs observe_home
```

以下坐标仅适用于未改变尺寸/位置的家庭模板：

```sh
node agent.mjs update_layout '{"operations":[{"op":"update","id":"balcony-washer","x":-5.1,"z":-2.6,"yaw":1.5707963267948966}],"dry_run":true}'
# 查看 can_apply、errors、warnings；停稳后用同样 operations、dry_run:false 应用。
node agent.mjs update_object '{"id":"window","properties":{"open":true}}'
node agent.mjs walk_to '{"x":-5,"z":-1.65}'
node agent.mjs observe_home
```

- 物品沿用 `update_layout` 的 add/update/remove；可移到室内、另选目录款式，也能删除。当前新增 `balcony-drying-rack-v1` 为独立晾衣架 GLB。
- 预演不写数据库。越界、物品重叠、占据身体、无效门连接属于错误；门开着但通路被家具挡住，会给 `balcony_unreachable` 警告和阳台可达网格数。
- `open:false` 表示关门；人物不能穿玻璃、穿旁边墙壁或越过护栏。门开关可包含在 `update_layout` 的 properties 操作中预演。身体正在移动/互动，或关门将夹住门口身体时拒绝应用。
- 远处目标虽可能站得下，也可能没有通路。`walk_to` 是异步请求；只有匹配 job 为 completed 且 fresh 身体反馈抵达，才能说走到了。不能用 `move_character` 假装走路成功。
- 当前洗衣机和晾衣架支持摆放，不含洗衣、取衣、晾衣或通用抓取动作。

## 阳台结构设置

沿用 `update_room`，新增显式 `balcony` 字段：

```json
{"balcony":{"wall":"left","center":1.25,"width":3.6,"depth":2,"door_id":"window"},"dry_run":true}
```

- `wall` 为 `left` 或 `back`；`center` 是沿墙坐标：后墙为世界 X，左墙为负的世界 Z。
- 宽度 3..6 米，进深 1.8..3 米，必须落在支撑墙范围内；`door_id` 必须是实际落地窗资产、贴着对应墙，并在阳台跨度内。
- 门框保留实际尺寸；三块门扇叠到左边时，右侧约 1.55 米为通道。窄通道使用当前人物的保守净空，不缩小人物碰撞体来强行通过。
- 改结构不会搬运独立家具；缩小/移位造成越界或身体受阻时拒绝，不自动删家具、推挤或瞬移身体。家具坐标不属于窗户的局部坐标。
- 传 `balcony:null` 可移除结构，但先要处理阳台家具、让人物回室内。切换儿童房模板是显式重置，不是清理用户存档的后台迁移。

旧存档不会自动加阳台或改室内布置。新家庭模板为留出通往窗边的保守通路，把沙发沿正 Z 方向挪了 0.4 米；其余原室内物件位置不变。此次本机预览也是先备份，再通过正常工具增加结构、摆件和这项小调整，没有覆盖整份布置或删除旧存档。

## 实现与验证

`shared/space.mjs` 统一室内/阳台区域、门口、墙段和护栏边界，供 TS 服务端与浏览器寻路使用；布置校验和导航不把整个外包矩形当成可走地面。`web/balcony.js` 只生成结构及远景，窗帘/推拉门仍在 `window-detail.js`。物件从常规资产加载与保存路径渲染。

原 56 个运行资产未重新编码；新增晾衣架是本地参数几何，可用开发工具 `node tools/export-drying-rack.mjs` 重建（改变资产时同时更新清单哈希）。城市远景仍是图片；近处结构、人物和所有可摆家具均为 3D。

测试覆盖连续往返路径、墙/护栏阻挡、关门重开、独立摆件预演/应用/移除、真实身体坐标、夹门保护、结构移除/缩放、后墙朝向、地图和资源清理。旧 Python 契约使用封存的旧模板/定义作为输入，保留 300 项旧行为重放；阳台扩展另有验收，不用新模板替换旧契约预期。
