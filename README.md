# 雾港来信 · Fogport Letters

一款有明确主线的中文 AI 互动小说。你是雾港中央邮局的夜班邮差；黎明 07:17，旧钟最后一响后，整座城都会忘记你。

**在线体验：** <https://fogport-letters-e3phwckhb92.qoder.zone>

## 这是什么

游戏不是纯粹的聊天框。它有一条固定主线和一组由服务端决定的结局；Qwen 负责对白与局部叙事，真相、时间、线索、关系和结局不能由模型改写。

- 5 个地点、4 位可建立信任的人物、3 条关键线索
- 03:17 → 07:17，共 240 分钟；每回合约 10–25 分钟
- 四类结局与人物化尾声，另有隐藏真结局
- 主页、存档库、15 枚成就、线索/行囊未读红点
- 地图上的雾灯书店与人物位置；悬浮或点按查看身份卡
- 每幕固定戏剧压力 + 每位 NPC 的个人线

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | React 19、Vite、TypeScript |
| 后端 | Node.js、Fastify、TypeScript |
| 本地数据 | SQLite（better-sqlite3，WAL） |
| 在线数据 | Qoder Sites Function 数据库 |
| AI | Qwen OpenAI 兼容接口；无 Key 时使用内置演示叙事 |
| 校验 | Zod |
| 测试 | Node Test、Playwright |

## 目录

```text
shared/     共享 API 契约与展示类型
server/     世界设定、回合引擎、结局、提示词、SQLite 仓储
client/     React 界面、地图、人物卡、存档与成就
functions/  Qoder Sites Edge Function 入口
scripts/    安装时还原 base64 图片资源
```

## 本地开发

```bash
npm install
cp .env.example .env   # Windows 可手动创建 .env
npm run dev
```

前端默认在 <http://127.0.0.1:5173>，后端默认在 3000。`auto` 模式在没有 Qwen Key 时会使用完整的内置演示叙事。

```bash
npm run typecheck
npm test
npm run build
```

## 关于素材

角色立绘与地图位图是二进制资源，在线版本已包含全部素材。仓库中的 `assets-encoded/` 保存了用于文本分发的 base64 资源；在完整本地项目中，`npm install` 会通过 `scripts/prepare-assets.mjs` 还原缺失图片。

地图底图使用 [Kenney Map Pack](https://kenney.nl/assets/map-pack)（CC0）；界面图标来自 [game-icons.net](https://game-icons.net)（CC BY 3.0，作者 Lorc / Delapouite）。完整署名与许可见 `client/src/assets/kenney-map/License.txt` 与项目文档。
