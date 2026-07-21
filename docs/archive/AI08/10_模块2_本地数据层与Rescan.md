# AI08 · 模块2 本地数据层与 Rescan（四段式审计）

> 审计对象：前端 ↔ `localTool`(`:18080`) 的本地数据层：资源入库 / 删除 / rescan / 上传落盘 / 缩略图。
> 全部行号 grep 复核于 `src/_engine/App.js`（2026-07-21）。混淆名字典见 `01_已坐实锚点快照.md`。
> 红线对齐：CLAUDE.md §3.2（路径绝对化、轮询落盘）、§3.3（不得绕过 `StorageManager`=混淆名 `Q`）。

---

## ① 运转图景

本模块是**前端表现层与 localTool 存储层之间的本地数据面**。所有"文件落盘 / 资源元数据持久 / 重扫磁盘目录 / 缩略图"都在此。与模块3（AI 生成）的接缝是：AI 生图完成后**必须把 CDN/网关 URL 经 `ii()` 落盘到 localTool**，再经事件总线通知资源面板刷新（详见 `20_交叉流审计.md`）。

localTool 侧端点（来自 `var-mapping` + 代码实测）：
- `POST ${Hr}/api/files/upload`（Blob 版 `Xr` L1812 / URL 版 `Zr` L1832）
- `GET ${Hr}/api/files/thumbnail`（缩略图 `ri` L1871）
- `POST ${vv}/api/resources/save`（入库 `Sv` L42838）
- `POST ${vv}/api/resources/delete?id=`（删 `wv` L42857，**只删DB**）
- `POST ${vv}/api/resources/clear`（清空 `Tv` L42866，**带 deleteFiles**）
- `POST ${vv}/api/resources/rescan`（重扫 `Ev` L42883）

> `Hr`=`vv`=`http://127.0.0.1:18080`（硬编码，TASKS P0 已知）。

---

## ② 核心混淆字典（本模块）

| 混淆名 | 行号 | 真身 | 调用去向 |
|--------|------|------|----------|
| `ii` | L1888 | `uploadFile`（落盘封装） | `Xr`(L1898) / 直链返回 |
| `Xr` | L1802 | `uploadToLocalTool`（Blob） | `/api/files/upload` |
| `Zr` | L1827 | `uploadFileByUrl`（URL） | `/api/files/upload` |
| `ri` | L1856 | `getThumbnailUrl`（缓存） | `/api/files/thumbnail` |
| `Sv` | L42838 | `saveResource` | `/api/resources/save` |
| `wv` | L42857 | `deleteResource` | `/api/resources/delete` |
| `Tv` | L42866 | `clearResources` | `/api/resources/clear` |
| `Ev` | L42883 | `rescanResources` | `/api/resources/rescan` |
| `Cv` | L42851 | `saveResourceFavorite` | `Sv` |
| `Kr` | 局部 | localTool 连通检测 | `Xr`/`ri`/`Zr` 前置 |
| `Hr`/`vv` | var-map | localTool base URL | 18080 |

> ⚠️ `B`/`R` 在 L29188/L29160 是**组件内局部回调**（拖拽/粘贴/上传处理），非模块级函数（见 `01_已坐实锚点快照.md` §2 同名陷阱）。

---

## ③ 关键数据流（带 file:line）

### 流 A：AI 生图结果落盘 → 资源入库（模块3→模块2 接缝，红线 §3.2）
1. 生图完成：`i === 'completed'` 触发 `Ev().then(...)` 后端 rescan（`App.js:L31426`）。
2. URL 持久化：HTTP URL 经 `ii(u,{subfolder:'tasks',preferThumbnail:true})` 落盘（`App.js:L33049`、`L33098`、`L35863`、`L36081` 等多处）。
3. `ii()` 内部：直链 `return {url:e}`（L1895）；否则 `Xr(e)` → `fetch(${Hr}/api/files/upload)`（L1812）返回 `{url,thumbnailUrl,path}`（L1818）。

### 流 B：资源入库消费（事件总线）
- 监听 `resourceAdded`：`if (e.action === 'resourceAdded' && e.resource)`（`App.js:L43527`）。
- 入库：`await Sv({...})`（`App.js:L43552`）→ `POST ${vv}/api/resources/save`（L42838）。
- 同时更新前端 state：`D(e=>[i,...e])`、`G(e=>e+1)`（L43552 区）。

### 流 C：删除（**P2 风险点**）
- 用户删除：`wv(e).catch(...)`（`App.js:L44281`）。
- `wv` 实现：`fetch(${vv}/api/resources/delete?id=${e})`（L42857）—— **只发 delete 请求，无 `deleteFiles` 参数 → 只删 DB 记录**。
- 前端同步清 state：`ue(t=>t.filter(...))`、`D(t=>t.filter(...))`（L44281 区）。
- 对照 `Tv`（L42866）：`clearResources` **带 `deleteFiles:t`**，可删磁盘。
- **结论**：`wv`（单条删除）与 `Tv`（清空）不对称——`wv` 不联动删磁盘 → 长期产生孤儿文件（TASKS P2 #6 坐实）。

### 流 D：Rescan 孤儿清理（**P2 风险点**）
- `Ev`（L42883）→ `POST /api/resources/rescan` 返回 `count`。
- 孤儿清理逻辑在 localTool 侧（`localTool/src/routes/resources.ts:L120-L130` 仅 `source='local-tool'`），TASKS P2 #7 指控"只清 `source='local-tool'`"，`source='extension'` 不被清理 → **门4（30_ B.2）与模块8（35_）已双向坐实**，属设计特性（extension 瞬态，见 31_）。

### 流 E：缩略图（**P2 伪复制风险点**）
- `ri`（L1856）：内存 `ei`(Map, 带 expire) + `ti`(Promise 缓存) → `fetch(${Hr}/api/files/thumbnail?url=...)`（L1871）。
- 前端是"取缩略图 URL"并非"复制文件"；TASKS P2 #8 "缩略图伪复制"指向 localTool `files.ts` 的 `copyFileSync`（`tryGenerateThumbnail` files.ts:L137），**门4（30_ B.3）与模块8（35_）已跨审坐实**：`copyFileSync` 复制原图当缩略图，建议接 sharp 真实缩放。

---

## ④ 存疑 Bug（对照 TASKS P0–P2）

| TASKS | 本模块证据 | 状态 | 备注 |
|-------|-----------|------|------|
| P0 URL 格式不统一破图 | `Sv`(L42838) 保存前未统一 `toAbsoluteFileUrl`（仅 `handleResourcesRescan` 用 `toAbsoluteFileUrl` resources.ts:L31，save 路径未调） | ⚠️ 坐实方向对 | 属模块1 配置层/模块2 入库交界，见 `11_模块1` |
| P1 拖入 URL 不落盘 | `B` 回调(L29188)拖入 `files` 走 `R`(L29160)→`O([{url,source:'upload'}])` 仅存 state，**未调 `ii()`/`Zr()` 落盘** | ⚠️ 坐实方向对 | 拖入的是 `files`（本地 File），粘贴 URL 才 `O([{url,source:'paste'}])`（L29181），两者都只存 state 不落盘 → 刷新丢失 |
| P1 文件上传不入库 | `R`(L29160) 上传后 `O(t=>...)` 仅更新 state，**未调 `Sv()`** | ⚠️ 坐实 | 需手动 rescan(`Ev`) 才入库；与流 B 的 `resourceAdded→Sv` 不互通 |
| P2 删除不删磁盘 | `wv`(L42857) 无 `deleteFiles` vs `Tv`(L42866) 有 | ✅ 坐实 | 修复：`wv` 加 `deleteFiles` 可选联动，或改走 `Tv` 单条语义 |
| P2 Rescan 孤儿只清 local-tool | `handleResourcesRescan` 孤儿清理仅 `source='local-tool'`(resources.ts:L123) | ✅ 坐实（门4 B.2 + 模块8） | extension 瞬态设计，非 bug |
| P2 缩略图伪复制 | `ri`(L1856) 仅是取 URL；伪复制在 `tryGenerateThumbnail`(files.ts:L137) `copyFileSync` | ✅ 坐实（门4 B.3 + 模块8） | 建议接 sharp 真实缩放 |
| P2 统一 base URL | `Hr`/`vv` 均为硬编码 18080（var-map L117/L118） | ✅ 坐实 | host 硬编码，TASKS P0 残留；`YIMAO_DATA_DIR` 切换不生效 |

---

## 边界契约（阶段2.5 缝合点）

| 接缝类型 | 标识 | 位置(file:line) | 方向 |
|----------|------|-----------------|------|
| HTTP 路由 | `POST /api/files/upload` | App.js:L1812(L1802 Xr)/L1832(L1827 Zr) | 前端→localTool |
| HTTP 路由 | `GET /api/files/thumbnail` | App.js:L1871(L1856 ri) | 前端→localTool |
| HTTP 路由 | `POST /api/resources/save` | App.js:L42838 Sv | 前端→localTool |
| HTTP 路由 | `POST /api/resources/delete` | App.js:L42857 wv | 前端→localTool |
| HTTP 路由 | `POST /api/resources/rescan` | App.js:L42883 Ev | 前端→localTool |
| CustomEvent | `resourceAdded` | App.js:L43527 | 总线→资源面板 |
| 配置开关 | `USE_LOCAL_ENGINE` | config.js | 切 18080/9004（模块1） |
| 存储后端 | `StorageManager`(混淆名 `Q`) | var-map L20 | 不得绕过（红线 §3.3） |

> 本模块文档为「已验证草稿」待门3 校验报告（见 `10_模块2_本地数据层与Rescan_校验报告.md`）。门4 对抗审计待 `20_交叉流审计.md` 完成时统一质询。
