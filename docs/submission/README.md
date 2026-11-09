# 参赛文章发布说明

主文件：

- `tianchi-post-final.md`：按参赛要求整理好的最终稿，可直接粘贴到天池编辑器
- `tianchi-post-plain.txt`：去掉 Markdown 标记的纯文本版，适合直接粘进富文本编辑器
- `fogport-submission-article.md`：上一版草稿，仅作留档
- `assets/`：文章配图，按文中顺序上传到对应段落

## 已确认信息

- 作者：熊诗毅、黄广程（团队作品）
- 作品类型：Lifehack
- 在线体验：<https://fogport-letters-e3phwckhb92.qoder.zone>
- 项目仓库：<https://github.com/xlc0007/fogport-letters>

在线站点当前为公开访问，真实浏览器可直接打开；线上使用本地演示叙事，不调用外部 API。

## 配图顺序

| 文件 | 建议位置 | 内容 |
| --- | --- | --- |
| `00-home-1440.png` | 二、作品是什么 | 主页：开始 / 继续 / 存档 / 成就 |
| `02-main-1440.png` | 二、作品是什么 | 主界面与输入区 |
| `03-map-hover-1440.png` | 四、怎么用 | 地图、雾灯书店、人物位置与身份卡 |
| `04-people-1440.png` | 四、怎么用 | 四位 NPC 的立绘、关系与个人短记 |
| `09-saves-1440.png` | 五、Qoder 过程 | 存档界面 |
| `08-achievements-1440.png` | 五、Qoder 过程 | 15 枚成就与隐藏成就 |
| `05-mobile-main-390.png` | 六、Qoder Sites 部署 | 390px 主界面 |
| `06-mobile-map-390.png` | 六、Qoder Sites 部署 | 移动端地图身份卡 |
| `07-mobile-people-390.png` | 六、Qoder Sites 部署 | 移动端人物卡 |

所有截图使用默认代号「林见雾」，不含测试玩家名、真实姓名、手机号或 API Key。

## 发布步骤

1. 在浏览器登录阿里云天池账号。
2. 打开 <https://tianchi.aliyun.com/forum/newPost?type=0&operation=add&raceId=532536>。
3. 标题使用：`【雾港来信】把 AI 关进规则里：用 Qoder 做一个 4 小时、12 种收束的中文互动叙事`。
4. 类型选择 Lifehack，作者填写熊诗毅、黄广程。
5. 粘贴 `tianchi-post-final.md` 正文，按上表逐张上传配图。
6. 发布前确认两个网址均可打开，且文章不含未授权素材或真实密钥。

## 已知阻塞

- 天池发帖页会跳转阿里云登录；当前浏览器没有登录态，无法代为提交。
- GitHub 仓库目前只有初始化文件，完整源码尚未推送；推送需要用户在自己的消息中明确点名 `xlc0007/fogport-letters` 为目标仓库。
- 文章已刻意避开隐藏真结局的条件与名称，避免游戏内剧透。
