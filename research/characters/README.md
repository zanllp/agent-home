# 大肥鱼角色素材调研

日期：2026-10-30。用户要求先调研现成素材，目标是高清、经典三头身。没有替换页面角色、安装桌宠/DSH 插件或生成新图，没有提交。

## 结论

有可复用的大肥鱼社区素材，不需要继续用 Office 猫咪。不过现成素材的分辨率、比例和动作覆盖不同，不能把“图集高清”当作“每帧高清”，也不能把二头身拉伸当三头身。

短期可使用用户指定的 Dafeiyu On Duty 动画占位；长期优先从高清角色标准图确定外观，按三头身重新统一比例与动作。未找到同时具备高清三头身、走路/坐下/喝茶/睡觉/换装全部能力、且能直接导入小家的完整成品。

## 1. 用户指定：Dafeiyu On Duty

- 页面：https://codex-pets.net/#/pets/dafeiyu-on-duty
- 源码：https://github.com/ArvinZJC/dafeiyu-on-duty-codex-pet
- 图集原样保存为 arvin-spritesheet.webp，来自页面展示的版本化 Sheet 链接：
  https://codex-pets.net/assets/pets/v/1793285482813/dafeiyu-on-duty/spritesheet.webp
- 已读取页面并检查文件元数据：1536×2288，11 行；按 8 列划分，每格 192×208。格内角色还会有透明留白，不能当作 1536 像素高的单人原画。
- 九种动画：待机、左右移动、挥手、跳跃、失败、等待、运行/思考、审阅；另有 16 个注视姿势。参考 examples/animations.json，部分行不是 8 个有效动作帧，不能整张图按统一帧数播放。
- 适合先把错误的猫咪角色替换掉；不适合依靠放大提供高清人物特写。注视姿势不等于完整侧背面走路；没有验证坐椅子、拿杯子、换衣服等房屋动作。
- 项目明确代码/文档 MIT，美术及其衍生为 CC BY-NC-SA 4.0；保留作者、上游来源、许可与修改说明。详见随附 ARVIN-ATTRIBUTION.md 和 ARVIN-CODE-LICENCE。
- 作者声明参考 PC2005-cloud/dsh-pet 的角色与动画，不是官方 DeepSeek 形象。

## 2. 高清原画与动作：YunYueSama/codex-deepseek-pet

- 仓库：https://github.com/YunYueSama/codex-deepseek-pet
- 标准图：https://github.com/YunYueSama/codex-deepseek-pet/blob/main/design/character-standard.png
- 待机图：https://github.com/YunYueSama/codex-deepseek-pet/blob/main/assets/whale/idle-front.png
- 本地 yunyue-character-standard.png：1536×1024，包含正侧背面与表情，并非每个角色都占满整张图。
- 本地 yunyue-idle-front.png：2048×1024，左右两个待机姿势（睁眼/闭眼），不是一张 2048 高的单人立绘；每个姿势分区约 1024×1024，透明留白也在其中。
- 已看原图：蓝色渐层长发、蓝瞳、鳍状耳、鲸尾、深蓝女仆装、白色鲸鱼围裙。比例仍偏大头 Q 版，不能直接宣称符合严格三头身。
- assets/whale/manifest.json 的 cell=512；提供 idle/walk/eat/wave/jump/dance/sneak/sleep/turn 等动作资料。README 声明部分画面是关键姿势与过渡，并非每秒 60 张独立原画；本次未下载/验收全部动作连续性。
- 更适合作为高清人物和日常动作的候选源，不必引入其 Electron/聊天/模型逻辑。
- ASSET_LICENSE.md 声明作者有权授权的新增贡献可按自定义署名许可使用、修改、分享及商用，但明确不授予社区参考图、底层角色设计等第三方额外权利。不能概括为“整个人物完全无条件开源商用”。已保留 YUNYUE-ASSET-LICENSE.md、YUNYUE-LICENSE。

## 3. 多视图与服装参考：xiaoweigen/deepseek-dafeiyu-assets

- 仓库：https://github.com/xiaoweigen/deepseek-dafeiyu-assets
- 提供基础六视图、古风发型/服装和武器设定，适合统一前后左右外观及后续服装设计。
- 本地 xiaoweigen-base-six-views.png：1536×1024，六个角度共享一张图，单个角度不是 1536×1024。
- 已看基础图：中性白色打底服、完整鲸尾和侧背面。它是设定参考，不是游戏动作帧，也不是已经分层的换装文件。
- 仓库标明 CC BY-NC-SA 4.0，同时保留前序作者的署名/许可义务。已保存 XIAOWEIGEN-NOTICE.md、XIAOWEIGEN-LICENSE；最终以完整文本为准。

## 4. 其他相关资源

- https://github.com/PC2005-cloud/dsh-pet ：用户给的宠物所参考的上游，README 描述有 100+ 生活/工作透明视频动画，VP9-alpha WebM 为主要动画形式；Mac/Safari 透明播放另有兼容素材说明。动画丰富，但不能直接把视频当作可任意组合的服装与动作层。代码 MIT 不自动覆盖美术许可。这里只读文档，未安装。
- https://github.com/br0ny4/dsh-live2d-pet ：有鲸鱼娘角色、立绘网格变形与 Live2D 管线，可参考“如何让同一张立绘动起来”；第三方角色立绘与 Cubism 等有各自许可。不是我们房屋实现的必需依赖，未安装、未改 DSH。

## 高清三头身的制作方向（提案）

1. 先确定一张三头身标准站姿：不计呆毛/头饰，头顶到下巴约占身高三分之一；保留脸、发色、鳍耳、鲸尾等识别特征。现成参考偏二点几头身，不能靠纵向缩放改变比例。
2. 美术使用干净的高清 2D 插画，不开启 Phaser pixelArt 来放大低分辨率帧。房间也需逐步与人物清晰度统一，不能只让角色高清而背景继续低清。
3. 原画可用每姿势 1024×1024 的独立透明画布作为制作起点；最终根据页面中角色的实际显示尺寸与 DPR 导出 512/768 等运行尺寸。大画布仍需检查角色本体占比，不能只看文件尺寸。
4. 第一批只要站立/眨眼、左右走路、坐下、拿杯子、休息。动作保持同一脸、同一身高和脚底锚点；坐下与拿杯子需要配合家具锚点，不能只切换文字。
5. 优先完整角色序列帧以接上现有 Phaser，不为了替换人物先引入 Live2D/3D。衣服将来扩展，但暂不承诺现成图能直接变成分层换装。
6. 不混用多个作者的单帧来凑一套动作；确认一个外观基准后统一制作，避免走路突然变脸、变比例。

以上是候选选择与设计建议，不是已完成的人物替换。当前运行页面仍为此前原型。
