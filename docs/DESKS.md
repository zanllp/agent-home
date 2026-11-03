# 工作桌与学习桌精修

## 可选款式，不覆盖原素材

新增两款原生圆角桌架：`urban-workdesk-detailed-v1`、`urban-child-desk-detailed-v1`。保留原桌的占地和 top 承载面尺寸/高度，原 Tripo GLB 没有改写。成人桌是浅木桌板、圆形金属桌腿、边侧抽屉和背部线槽；学习桌采用雾蓝防磕边、调节扣和边侧收纳。中间保留腿部空间，不把抽屉塞到座位正前方。

双屏套件另有独立的精修款 `urban-dual-monitor-detailed-v1`，使用实测居中占地，桌前为手记留出间距。

新增五个独立物件：陶瓷杯、桌面绿植、布面手记、文具收纳盒、软木便签板。前三件放在工作桌上，收纳盒放在学习桌上，便签板是独立挂墙物件。它们通过常规 `on`、`update_layout` 移动/旋转/删除，桌面物品跟随桌子，不是烘焙在桌板里的贴图。

当前家庭模板保持房间、两张桌子和椅子的世界位置不变，只换桌架款式、调整桌面摆件：双屏套件往桌后移 10 厘米，儿童练习册居中；没有增加室内地面障碍物或改变座位锚点。本机改造前布置与 SQLite 在 artifacts 下备份，未自动覆盖其他用户的旧存档。

## 画面细节

- 双屏：独立显示器背板、支架、走线、鼠标和约 60 个真实键帽；细小键位标记由本地 Canvas 生成，横屏轮换编辑器和终端，竖屏独立轮换随手记和周计划。
- 学习台灯：圆形底座、双连杆、铰链、螺钉、柔和灯罩和小范围暖光。笔筒有中空杯口，彩笔有六角笔杆、木质削尖段和笔芯。
- 摊开画册：弯曲纸页、页层和绘本/观察笔记印刷；手记、便签板也有本地生成的印刷细节。
- 桌板木纹为本地确定性纹理，不联网下载；新原生资产保留自身的材质粗糙度，不统一变成粉笔般的哑光表面。
- 阅读时的手持绘本只在阅读过渡/动作中显示，休息时不再额外盖在工作桌键盘上。独立练习册不受影响。

现有四件学习摆件的运行画布精修位于 `desk-models.js` / `desk-finishes.js`，原 GLB 保留。新资产原生几何可以通过开发命令 `node tools/export-desks.mjs` 重建，清单哈希同步更新；运行者仍只需 Node，不需要该导出命令。

## 能力边界与验证

抽屉、桌腿调节扣是静态结构；杯子、书页、便签和电脑画面是装饰，不代表饮用、书写、真实桌面或新增的家电功能。旧版台灯仍为独立的装饰摆件。家庭模板的暖白阅读灯是可开关的灯，灯罩下的光随桌子和灯的位置移动。未改变原人物、穿搭或坐读动作。

测试覆盖所有新增网格的有限坐标、目录边界、台面高度、膝部留空、原摆件占地约束、材质/印刷资源、闲置绘本隐藏，以及挂载物移动、预演只读、独立移除和支撑关系。浏览器另检查近景、斜侧及现有坐读动作。

## 儿童学习区第二轮

家庭模板的儿童桌有九件独立桌面摆件和一只挂包：右侧连杆台灯、花园绘本、叠放/立放故事书、彩色铅笔筒、短水笔筒、水杯、磨砂文具罐、抽屉收纳盒、蓝色小本，以及桌侧书包。收纳盒自带静态小台历和明信片；它们不是可单独取出的库存物品。

新增七个可选资产：`urban-picture-book-v1`、`urban-storybooks-v1`、`urban-school-bottle-v1`、`urban-marker-cup-v1`、`urban-pencil-jar-v1`、`urban-schoolbag-v1`、`urban-pocket-notebook-v1`。旧练习册和原故事书仍在目录中，不改变它们的尺寸。桌面 top 尺寸、高度、桌椅位置和人物未改；仅为这款学习桌增设 `bag-hook` 承载面，局部中心 `[0.42,0.30]`、高度 0.589 米。书包使用自身声明的 -0.30 米挂置偏移，提环挂在桌沿下，避开中间膝部空间。仍使用既有 `on` 和 `update_layout`，不接受任意 y 坐标、不绕过干涉校验。

桌架新增真实脚轮和挂钩；书包有厚度、肩带、拉链、包边及小狗挂件。水杯、双笔筒、书页均为实体网格；印刷只贴在纸页、封面或标签上，不把整张桌面做成一张图片。书包、台灯和其他摆件均可独立移除、移动或更换。

### 绘本印刷图来源

`house3d/assets/materials/garden-picture-book-v1.png` 使用内置生图工具生成（2026-11-02），原图保存在项目内，哈希在 `runtime-assets.json`。用于绘本两页及故事书封面；没有重绘人物或改写原有 56 个运行资产。生成提示词：

> Use case: illustration-story. Asset type: a flat printed illustration texture for the two pages of an open children's picture book in a cozy stylized 3D family home. Create ONE landscape image, 5:3 aspect ratio. Orthographic perfectly flat scan, edge-to-edge ivory paper, NO perspective, NO book object, NO shadow, NO table. Left half: a charming illustrated neighborhood garden with a small cream house, little orange cat, watering can, herbs, flowers, tiny butterflies. Right half: colorful botanical field notebook with friendly watercolor drawings of sunflowers, tulips, leaves, strawberries, ladybug and tiny diagram doodles. Sophisticated children's editorial illustration, soft gouache and colored pencil details, warm muted cream and sage with bright ochre/coral/sky blue accents, fine delicate hand-drawn linework, generous paper margins and a quiet central gutter. Suitable for a ten-year-old, not babyish. Crisp detailed print, joyful and lived-in. No readable text, no logos, no people, no photorealism.

这轮仅细化家庭模板的儿童学习区；不替换儿童房模板、不增加拿取/喝水/翻页动作，也不宣称已达到参考图全部的模型与照明品质。

家庭书桌现在搭雾蓝无扶手学习椅，保留原椅 0.3515 米座面和起坐位置，裙摆两侧不加硬扶手。儿童房的鲸梦软椅、目录中的 Tripo 双背椅都没有替换。学习椅是独立家具，可通过现有 `update_layout` 换回；角色骨架不变。

家庭双屏保留原模型和占地。浏览器让横屏利用原先两屏间的空隙，把竖屏转向座位，并补上底座、悬臂、理线和一对桌面音箱。两块屏幕用本地画出的山海桌布，横屏叠放编辑器或终端和手作预览，竖屏轮播随手记、周计划；不会读取宿主机桌面或运行屏幕里的指令。壁纸在模型载入时绘制一次，窗口沿用原来的低帧率更新。
