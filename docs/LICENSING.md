# 许可与署名

**代码公开不等于素材可任意转载、改编或商用。** 本项目没有把整套角色、模型和图片统一重新授权为 MIT。以下按当前文件与制作记录划分范围；不能代替权利人授权或专业法律意见。

## 代码与依赖

| 内容 | 许可依据 | 使用时保留 |
| --- | --- | --- |
| 项目应用代码、工具、文档中的程序说明 | 根 [LICENSE](../LICENSE) 的 MIT 代码条款；注明的第三方文件除外 | 原版权与许可声明 |
| Star Office UI 来源 | [UPSTREAM](../UPSTREAM.md) 固定研究版本；[原始完整声明](../licenses/STAR-OFFICE-UI-LICENSE.md) | Ring Hyacinth、Simon Lee 署名；不要把其美术条款说成代码条款 |
| 随浏览器产物包含的 Three.js 和 addons | [Three.js MIT 原文](../licenses/THREE-LICENSE.txt) | 原作者版权与 MIT 文本 |
| 构建/测试 npm 依赖 | `package-lock.json` 与相应包的许可 | 修改或另行分发依赖时分别核对；不表示需要运行者安装它们 |

根 LICENSE 使用标准 MIT 文本，适用于项目代码。Star Office UI 的原始代码与美术声明完整保留在 [上游许可副本](../licenses/STAR-OFFICE-UI-LICENSE.md)。素材分别适用各自许可，不暗示上游作者为本项目背书。

## 默认人物：社区衍生设计，不是官方角色

当前运行文件为 `house3d/assets/dafeiyu-contact.glb`，不是早期 Blender 小样或 2D 桌宠图集。制作链包括社区参考、AI 辅助概念、Tripo 图生 3D/绑定、局部几何与纹理修复，以及人物专用的接触动作处理。不要据历史原型记录把它描述为纯手工原创或通用换装模型。

保留以下署名链与原文：

- 原始鲸鱼娘／溟月设计：**上善无形（上善）**；DeepSeek 元素的女仆二次设计：**ZipZipPipe**。
- 外观与多视图参考：**YunYueSama**，来源 [codex-deepseek-pet](https://github.com/YunYueSama/codex-deepseek-pet)。
- 多视图设定与署名整理：**xiaoweigen**，来源 [deepseek-dafeiyu-assets](https://github.com/xiaoweigen/deepseek-dafeiyu-assets)。
- 早期桌宠动作候选参考：**ArvinZJC / PC2005-cloud**，来源与使用范围见 [ARVIN-ATTRIBUTION](../research/characters/ARVIN-ATTRIBUTION.md)。并非所有候选文件都用于当前运行模型。
- 原始声明副本：[`research/characters`](../research/characters/)、[`modeling/licenses`](../modeling/licenses/)、[`house3d/licenses`](../house3d/licenses/)。副本里的相对链接属于原仓库，结合文件所列上游地址阅读。

参考链记录了 **CC BY-NC-SA 4.0** 义务：署名、非商业、衍生同许可、说明修改。见 [原始署名记录](../research/characters/XIAOWEIGEN-NOTICE.md)、[完整 CC 文本](../research/characters/XIAOWEIGEN-LICENSE) 和 [CC 官方说明](https://creativecommons.org/licenses/by-nc-sa/4.0/)。YunYueSama 的 [素材说明](https://github.com/YunYueSama/codex-deepseek-pet/blob/main/ASSET_LICENSE.md) 只授权其有权授权的新增贡献，不扩张底层参考作品的权利。

以上是已有来源的限制，**不是已替所有上游权利人核准当前 3D 衍生模型**。正式公开前仍要确认参考链、衍生分发义务和生成模型的服务授权，记录当前模型的修改内容。公开截图、视频和直播也涉及美术使用；尤其有广告、订阅或商业推广时，不因为代码 MIT 就自动可用。不代表 DeepSeek、OpenAI 或上游创作者官方授权或背书。

## 家具、贴图与宣传图片

现有详细来源见 [ASSETS](ASSETS.md)；模型文件和目录条目不一一对应，多个条目可共用同一个 GLB。

| 类别 | 范围/识别方式 | 公开前要确认什么 |
| --- | --- | --- |
| Tripo 生成或加工的模型 | 家具目录 `source` 标记 Tripo 的条目；默认人物也来自此制作链 | 生成时的日期、套餐、账号使用依据、输入图权利、允许再分发/再许可的条款 |
| 本地代码生成的几何 | 目录 `source_type: native_geometry` 或指向 `tools/export-*.mjs`；源代码随仓库提供 | 独立几何与内嵌图片分别判断；“代码生成”本身不是所有内嵌美术的许可 |
| AI 生成/参考制作的纹理、绘本、概念与场景图 | `house3d/assets/materials`、文档插图及模型内嵌图片 | 输入参考的权利、生成服务条款、角色衍生限制；不能把生成图片冒称真实家庭照片 |
| 上游引用/署名文本 | research、modeling、licenses 下的文字记录 | 保留原作者、链接、原始声明和修改说明；不要因精简仓库删掉许可 |

[Tripo 当前服务条款](https://www.tripo3d.ai/terms) 和 [官方权利说明](https://www.tripo3d.ai/help/privacy-policy/how-to-use-tripo-models-commercially) 区分套餐与输入图权利。**当前条款不证明历史每件资产的生成套餐或权利已经核实**，也不能仅凭现在有付费积分推定过去所有模型均可分发。需要保存生成当时适用的记录；不把账号密码、Cookie 或付款详情放进公开证明文件。

制作任务 ID 和服务内链接是来源线索，不是密钥；现有清单保留它们，但它们不是可供公众访问的源文件下载或授权凭据。若链接本身含临时签名、访问令牌或个人信息，则应去掉敏感参数、私存原记录，而不是删除制作来源。

## 天气服务另有条款

可选天气来自 Open-Meteo 免费 API。代码许可不改变服务的请求限制、非商业服务条款和天气数据的署名要求。见 [Open-Meteo 条款](https://open-meteo.com/en/terms)；需要离线或不接受其条件时设置 `HOUSE_WEATHER=off`。不要把固定北京朝阳示例当作用户的实时定位。

## 当前发布结论

代码可按已有代码许可整理；**完整素材包的公开分发审查尚未全部闭合**。缺权利依据时应补授权、替换素材，或先只发布范围明确的代码；维护者不能仅通过写一份说明把未取得的权利授给使用者。本轮没有删除素材、改变上游许可或对仓库执行公开操作。
