# 模块2 · 本地数据层与 Rescan（审计 · AI02）

> 四段式：运转图景 / 核心混淆字典 / 关键数据流 / 存疑 Bug。附「边界契约」子节。
> 行号 2026-07-21 grep 坐实（App.js ~46397 行）。每条事实带 `App.js:Lnnn`。
> 关联：`02_文档错误修正.md`（Xr/Zr 误锚已修）、`01_映射表补全记录.md`（ii/Sv/wv/Ev/ri 已补）。

---

## 一、运转图景

模块2 负责**画布资源在前端的持久化协作层**：把文件/URL 落盘到 localTool(:18080)，并维护「资源面板」展示的 `resources` 列表（持久）与内存 `transitItems`（易失）两套数据源。

核心参与方：
- **上传落盘**：`ii`(L1888) 统一入口 → 调 `Xr`(L1802, openInTab，实为上传落盘实现) → POST `:18080/api/files/upload`。
- **缩略图**：`ri`(L1856) 内存缓存 + 调 `:18080/api/files/thumbnail`。
- **资源 CRUD**：`Sv`(L42838 入库) / `Cv`(L42851 收藏) / `wv`(L42857 删除) / `Tv`(L42866 清空) / `Ev`(L42883 rescan)。
- **加载**：资源面板 `we`(L43015, Y.useCallback) = rescan+查询；`xv`(L42742 查询) / `Ev`(L42883 rescan)。

---

## 二、核心混淆字典（模块2 已坐实）

| 混淆名 | 行号 | 真实语义 | 证据 |
|--------|------|----------|------|
| `ii` | L1888 | `uploadFileLocal`：落盘上传统一入口。http(s) 非 data: → **直接返回 url 不落盘**（CDN 直链坑）；否则调 `Xr` 上传 | `async function ii(e,t={})`；L1889 分支 `if http && !data:` return `{url:e}` |
| `Xr` | L1802 | `openInTab` 模块级；但 `ii` 内 `Xr(e,{subfolder,...})` 实为**上传落盘实现**（非仅打开 tab） | `ii` L1898 `let n = await Xr(e,{subfolder...})`；另有组件内 `Xr` L43881 |
| `ri` | L1856 | `thumbnailCache`：缩略图内存缓存（Map `ei` TTL=ni + 在途 `ti`）+ fetch `:18080/api/files/thumbnail` | `async function ri(e,t={})`；L1871 fetch `${Hr}/api/files/thumbnail` |
| `Sv` | L42838 | `saveResource`：POST `:18080/api/resources/save`，返回 ok | `async function Sv(e)`；L42840 |
| `Cv` | L42851 | `toggleFavorite`：Sv({...e,isFavorite:t}) | L42852 |
| `wv` | L42857 | `deleteResource`：**POST `:18080/api/resources/delete?id=` 只删 DB，无 deleteFiles 参数** | `async function wv(e)`；L42859 无 body |
| `Tv` | L42866 | `clearResources`：POST `:18080/api/resources/clear`，body `{folder, deleteFiles}` | L42868；L42875 `deleteFiles:t` |
| `Ev` | L42883 | `rescanResources`：POST `:18080/api/resources/rescan`，返回 count | `async function Ev()`；L42885 |
| `xv` | L42742 | `queryResources`：GET `:18080/api/resources` | （见 ARCHITECTURE L1.4） |
| `we`(资源面板) | L43015 | `loadResources`：rescan+查询（`we = Y.useCallback(async()=>{...})`） | 组件内 callback |
| `we`(PromptNode) | L4176 | ⚠️ **`@提及` 文本插入回调**（往 PromptNode textarea 插 `@xxx`），**非资源加载** | `we=(t,n=false)=>{...textareaRef...}` |
| `B` | L29188 | 资源面板"发送到/拖入"处理回调（`m(false)` 关菜单） | 组件内 `let B = Y.useCallback` |
| `R` | L29159 引用 | 文件→资源 Promise 映射回调（File→{url,...}），`z`/`B` 内调用 | `let z = Y.useCallback(async e=>{let t=await R(e)...})` L29159 |
| `ei` | var-mapping L9 | `pushToCloud`（GAS）；此处 `ri` 内 `ei.get/set` 是**缩略图缓存 Map**（同名不同作用域，注意混淆） | `ri` L1860 `ei.get(n)` |
| `ti` | — | 缩略图在途 Promise Map（L1862 `ti.get/set/delete`） | `ri` L1862 |
| `ni` | — | 缩略图缓存 TTL(ms)，`ri` L1882 `Date.now()+ni` | 模块级常量，待补 |
| `Hr` / `vv` | var-mapping L117/L118 | `Hr`=localToolStatusUrl、`vv`=localToolBaseUrl，均 `http://127.0.0.1:18080` | `ri` L1871 用 `Hr`；`Sv` L42840 用 `vv` |

> ⚠️ **命名雷区**：`ei` 在 var-mapping 是 `pushToCloud`(GAS 云同步)，但在 `ri`(L1860) 内是缩略图缓存 Map——同名不同作用域；`we` 两处语义完全不同（L4176 @提及 vs L43015 资源加载）。审计引用必须带行号+组件上下文。

---

## 三、关键数据流

### 3.1 文件落盘（画布拖入 / 上传）
```
onDrop / 文件选择
  → ii(file, {subfolder:'canvas/drop'})        App.js L1888
  → ii 内 if http → 直返(不落盘)；else → Xr(file,{subfolder})  App.js L1898
  → Xr → POST :18080/api/files/upload          返回 {url, thumbnailUrl}
  → 返回 {url, thumbnailUrl} 给节点 data
```

### 3.2 资源入库（右键"发送到资源"）
```
background.ts resourceAdded
  → 前端 onMessage App.js L43436
  → 追加 transitItems(内存)
  → ii()(L1888) 落盘 uploads/migrated/
  → Sv()(L42838) POST :18080/api/resources/save 入库
  → Ev()(L42883) rescan 刷新
```

### 3.3 缩略图读取
```
节点渲染取 url
  → ri(url, {maxDim, quality})                  App.js L1856
  → 缓存命中(ei/ti) 返回；否则 fetch :18080/api/files/thumbnail?url=   L1871
  → 返回 thumbnailUrl
```

### 3.4 资源删除（P2 根因）
```
用户删资源 → wv(id)                             App.js L42857
  → POST :18080/api/resources/delete?id=        ❗ 只删 DB
  → 磁盘文件 uploads/... 残留 → 孤儿文件积累
```
对比 `Tv`(清空) L42866 带 `deleteFiles` 参数可删磁盘，但 `wv`(单删) **无此参数**——设计不一致。

---

## 四、存疑 Bug（已坐实，回填 TASKS）

| 优先级 | 问题 | 代码证据 | 修复方向 |
|--------|------|----------|----------|
| P0 | URL 格式不统一破图（host 硬编码 18080 / 中文 Latin1） | `ii` 返回相对路径由前端兜底（`d5d48dd` 修复）；`Sv` 保存前未统一绝对化 | `Sv`(L42838) 保存前对 `e.url` 调 `toAbsoluteFileUrl` |
| P1 | **资源面板 URL 拖入/粘贴不落盘** | `ii`(L1889) 对 http(s) 直接 `return {url:e}` 不落盘；粘贴 L29181 `O([{url:r,source:'paste'}])` 只存状态 | `ii` 增加「强制落盘」开关，或 L29176/L29181 调下载后 `ii` |
| P1 | 文件上传不自动入库 | `R`(L29159)/`z`(L29160) 上传后 `O(t)` 仅更新内存，未调 `Sv` | `z` 成功后调 `Sv`/`we` 入库 |
| P2 | 删除不删磁盘 | `wv`(L42857) 无 `deleteFiles`；`Tv`(L42866) 有 | `wv` 加可选 `deleteFiles` 联动 |
| P2 | 缩略图伪复制 | `ri` 仅 fetch `:18080/api/files/thumbnail`（真实缩放由 localTool 做）；前端无 copyFileSync 问题在此层无（ARCHITECTURE L2.4 记 localTool 侧伪复制） | 归 localTool 侧，前端 `ri` 正常 |
| P2 | Rescan 孤儿清理只清 `source='local-tool'` | `Ev`(L42883) 触发；清理逻辑在 localTool `resources.ts` rescan，非前端 | 归 localTool 侧 |

> 注：P1「URL 不落盘」根因比 TASKS 原文更深——**不是缺 `Zr()` 调用，而是 `ii` 的 http 分支主动短路不落盘**（L1889）。原 TASKS L34 写「调 Zr() 下载」已证伪（Zr=注销），修正见 `02_文档错误修正.md`。

---

## 五、边界契约（缝合点 · 阶段2.5 用）

### 5.1 HTTP 路由（前端 → localTool :18080）
| 路由 | 方法 | 调用方(行号) | 说明 |
|------|------|------------|------|
| `/api/files/upload` | POST | `ii`→`Xr`(L1888/L1802) | 落盘上传 |
| `/api/files/thumbnail` | GET | `ri`(L1871) | 缩略图 |
| `/api/resources/save` | POST | `Sv`(L42840) | 入库 |
| `/api/resources/delete?id=` | POST | `wv`(L42859) | 删(只DB) |
| `/api/resources/clear` | POST | `Tv`(L42868) | 清空(可删盘) |
| `/api/resources/rescan` | POST | `Ev`(L42885) | 重扫 |
| `/api/resources` | GET | `xv`(L42742) | 查询 |

### 5.2 window CustomEvent（前端内）
| 事件 | 触发/消费 | 模块内位置 |
|------|-----------|-----------|
| `resourceAdded` | background.ts 发 → 前端 L43436 收 | 入库链起点 |
| `mutiwindow-task-completed` | 统一同步 effect 发 → `Ev` rescan 收 | 资源刷新 |
| `mutiwindow-sync-local` | 资源面板按钮 → `we`(L43015) | 手动同步 |

### 5.3 config 开关依赖
- `USE_LOCAL_ENGINE`(config.js)：true → 走 localTool(:18080)，`Hr`/`vv` 固定 18080；false → 文件走 9004 无上传路由（TASKS 跨层风险3）。
- `BASE` 一致性：`ri` 用 `Hr`(状态)、`Sv/wv/Ev` 用 `vv`(数据)，值相同=18080，仅 `USE_LOCAL_ENGINE=false` 分支分歧。

---

## 六、审计校验（门3 自测）
- [x] 每个函数名均 grep 坐实行号（ii/Xr/ri/Sv/Cv/wv/Tv/Ev/xv/we 双定义）。
- [x] 每条数据流带 `App.js:Lnnn`。
- [x] Bug 证据来自函数体阅读（L1889 短路 / L42859 无 deleteFiles）。
- [x] 门3 机器校验脚本 `scripts/check-doc-citations.cjs` 已建并跑通（见 `校验报告.md`：✅3 🟡1 ❌0）；本模块引用均经复核。

> 校验状态：🟢 人工 grep 坐实 + 门3 机器校验通过（T0.4 已完成，非阻塞）。
