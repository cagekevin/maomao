# 一毛AI画布 · 产品与需求（Concept）

> 事实锚点经 AI13 交叉验证实锤（2026-07-21），详见 `docs/AI13/交叉验证最终报告.md`。
> 本文只陈述产品价值、用户故事与边界；实现细节见 `02-architecture.md`；**想开发/接接口请看 `06-integration.md`**。

---

## 一、核心价值（一段话）

一毛AI画布（猫猫画布，包名 `yimao-ai-canvas` v1.3.5）是一个 **Chrome 扩展 / 本地应用**，把「可视化画布工作流」与「AI 生成能力」在完全本地可控的架构下闭环：

- **画布**：ReactFlow 魔改画布，节点承载图片 / 视频 / 文本 / 3D 等素材与处理链。
- **AI 生图 / 视频 / 文本**：请求经自研网关（:9004）翻译转发 Lovart，异步任务轮询回填。
- **本地工具链（localTool :18080）**：文件落盘、缩略图、资源 / 任务 / KV 的 SQLite(WASM) 持久化。
- **GAS 云同步**：可选把配置 / 资源元数据同步到 Google Apps Script 部署，跨设备漫游。

整个链路不依赖官方后端，数据默认留在本地磁盘（`~/.yimao-localtool/`）。

### 0. 它为什么是"本地魔改版"（来历 Why）

项目源于某闭源商用产品，被反编译出一个**本地模式 V1** 工程。团队在其基础上做了两件关键本地化改造，才形成今天的 maomao：

1. **自研 localTool（:18080）**：用 `sql.js`(WASM) SQLite 取代原 Go 二进制，承接文件落盘 / 缩略图 / resources·tasks·kv 持久化。
2. **自研网关 apimart-gateway（:9004）**：FastAPI 把原私有协议翻译转发 Lovart，承接异步生图 / 生视频任务轮询。

> 即：**"去官方后端依赖、本地可控"是此项目的一等目标，不是附加特性。** 详见 `docs/02-architecture.md` ADR 与 `docs/06-integration.md` §11 项目来历。

> 注：曾启动 V2 重写（`src/v2/`），目前**已暂停 / 归档**，线上只跑 V1（`src/_engine/App.js`）。任何新开发默认基于 V1，勿依赖 `src/v2/`。

---

## 二、用户故事（从已实现数据流反推）

1. **作为用户，我拖入一张图片到画布** → 系统经 `ii({subfolder:'canvas/drop'})` 落盘 `uploads/canvas/drop/`，节点直接引用本地文件（`02-architecture.md` §画布拖放）。
2. **作为用户，我右键网页图片"发送到资源"** → `background.ts` 经 `chrome.runtime` 跨进程发 `resourceAdded` 消息 → 前端 `Zr`@L1827 下载落盘 `uploads/migrated/` 并入库 → 资源面板刷新。
3. **作为用户，我触发 AI 生图** → `Jn`@L32490 主回调派发网关异步任务 → 轮询 `GET /v1/tasks/{id}` → 结果落盘 `uploads/tasks/` → `mutiwindow-task-completed` 广播回填节点并触发 rescan。
4. **作为用户，我点"同步到本地"** → 统一同步 effect 遍历 `globalTasks`，未本地化者 `uploadFile` 下载 → 同样经 `mutiwindow-task-completed` → rescan 刷新。

---

## 三、边界（不做什么）

- **不做云端协作编辑**：多人同时编辑同一画布无支持；GAS 同步仅限配置 / 元数据，非实时协同。
- **不内置模型推理**：所有 AI 生成经网关转发 Lovart，本地不跑推理。
- **不做多用户权限系统**：`auth_token` 本地模式永远返回本地 token（`Oa`@L3543）；网关 `USER_KEYS` 仅做独立计费隔离，非完整权限模型。
- **不做音频 / 音乐生成**：网关 `/v1/music` `/v1/audio` 当前返回 501（README 与 main.py 矛盾，待修）。
- **不做剪映素材真实发送**：`/api/jianying/send` 仅记日志占位。

---

## 四、阅读导航

| 文档 | 角色 |
|------|------|
| `06-integration.md` | **对外能力接口清单（开发者/AI 首选）** |
| `02-architecture.md` | 架构主文件（拓扑 / ADR / 已裁决事实） |
| `03-database.md` | 数据模型（resources / tasks / kv） |
| `04-api/api-reference.md` | 接口契约（localTool + 网关 + 跨进程） |
| `05-runbook.md` | 运维启动 |
| `glossary.md` | 同名遮蔽 / 已证伪项 / 黑话 |
