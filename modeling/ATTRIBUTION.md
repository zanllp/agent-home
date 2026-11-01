# 大肥鱼建模小样的来源与改编记录

制作日期：2026-10-30。本次使用 Blender Python 创建几何、材质、骨骼、衣服、家具和动作；没有把参考图片贴在平面上，也没有将参考图片当作 UV 贴图。几何和动作是本次新制作，人物识别特征仍属于社区角色的衍生设计，不因此成为无来源、无条件可商用的角色。

## 参考与署名

- 原始角色「溟月／鲸鱼娘」：**上善无形（上善）**，[作者主页](https://space.bilibili.com/4456176)。
- DeepSeek 鲸鱼娘二次设计：**ZipZipPipe**，[作者主页](https://space.bilibili.com/4168597)、[原作品](https://www.pixiv.net/artworks/148186519)。
- 多视图与表情参考：**YunYueSama**，[codex-deepseek-pet](https://github.com/YunYueSama/codex-deepseek-pet)。
- 身体、侧背面与鲸尾结构参考：**xiaoweigen**，[deepseek-dafeiyu-assets](https://github.com/xiaoweigen/deepseek-dafeiyu-assets)。
- 动作与外观参考：**ArvinZJC**，[dafeiyu-on-duty-codex-pet](https://github.com/ArvinZJC/dafeiyu-on-duty-codex-pet)；其上游参考为 [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet)。
- 本地 AI 辅助站姿概念图：`../frontend/characters/dafeiyu/stand-v1.png`，来源说明已复制到 `licenses/STANDING-CONCEPT-SOURCE.md`。
- 既有协作头像：`../../note/transfer/avatars/dafeiyu.png`，只查看脸部识别特征，未复制到模型或纹理。

本次查看的六项参考及原文件 SHA-256 保留在 `references.json`。完整调研、来源链与原始许可继续保存在 `../research/characters/`；为便于交付，相关声明原文也复制到本目录 `licenses/`。这些副本中的相对链接沿用原文，应结合原项目地址理解。

## 本次改编

重新建立三头身人体比例与儿童日常造型；保留蓝发、蓝眼、鳍耳、鲸尾。默认服装改为 T 恤与背带短裤，另有星星睡衣；建立披发与马尾，新增可编辑骨骼、原地动作、桌椅、书和交互节点。披发长度收在椅背上方，不照搬参考中的长裙、女仆装和超长发。

## 分发边界

本小样的人物模型、角色渲染及衍生美术按参考链记录的 **CC BY-NC-SA 4.0（署名、非商业性使用、相同方式共享）** 保留义务；同时保留 YunYueSama 对其新增贡献要求的署名和完整许可。不将其描述为官方 DeepSeek 角色或作者背书的作品。代码许可不能替代角色美术许可。

分发 `.blend`、GLB 或渲染时，请一并携带本文件、`references.json` 和 `licenses/`。本轮未发布、上传或商用这些资产。
