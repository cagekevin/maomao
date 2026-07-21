# ei/ti 多绑定 + 资源采集链路（AI05 / 深三度审计）

> 目的：核对 `ei`/`ti` 在 var-mapping 的收录是否完整；并核实 `background.ts` 资源采集链路与 ARCHITECTURE 描述是否一致。
> 范围：仅审计，不改任何文件。回填见 `07`。

---

## 1. ❌ `ei`/`ti` 四义绑定，var-mapping 只收了 1 处（最严重映射表缺陷）

var-mapping L9/L10 记录：`ei = pushToCloud`、`ti = pullFromCloud`（仅 GAS 同步那一处）。
实测 `ei`/`ti` 在 App.js 至少 **4 处不同绑定**：

| 行号 | 绑定 | 真实身份 | 证据 |
|------|------|---------|------|
| L1853-1854 | `var ei = new Map()` / `ti = new Map()` | **缩略图/缓存 Map**（模块级） | `var ei = new Map(), ti = new Map()` |
| L36784 | `ei = Y.useCallback(() => {...})` | **打组函数**（group selected nodes，生成 `group-${Date.now()}`） | L36785 `Qt.current.filter(e=>e.selected)` → W(建组) |
| L36822 | `ti = Y.useCallback(async () => {...})` | **清理画布缓存**（扫描 data: 媒体 → `ii(i,{subfolder:'canvas/cleaned'})`） | L36836 `ii(i,{subfolder:'canvas/cleaned'})` |
| L43950 | `ei = async () => {...}` | **GAS pushToCloud**（var-mapping L9 收的这处） | L43962 `CloudSyncEngine.push(e,...)` |
| L43974 | `ti = async () => {...}` | **GAS pullFromCloud**（var-mapping L10 收的这处） | L43977 `CloudSyncEngine.pull(...)` |

> ⚠️ 结论：var-mapping L9/L10 漏收了 L1853(Map)/L36784(打组)/L36822(清缓存) 三处，且未标注"同名多绑定，引用必须带行号"。这是本次审计发现的**最严重映射表缺陷**——比 Zr 双绑定更危险，因为 4 义跨越 Map/UI 回调/云同步三个语义域，下一个 AI 按 `ei=pushToCloud` 去 grep 会处处误读。

**建议 func-mapping 补录（带行号区分）**：
```
ei_map = thumbnailCacheMap        # var @L1853（原 ei=new Map()）
ti_map = cacheMap2                # var @L1854（原 ti=new Map()）
ei_group = groupSelectedNodes     # @L36784（打组）
ti_cleanCache = cleanCanvasCache  # @L36822（清理画布缓存 data:→canvas/cleaned）
ei_pushCloud = pushToCloud        # @L43950（GAS，原 var-mapping L9）
ti_pullCloud = pullFromCloud      # @L43974（GAS，原 var-mapping L10）
```
（或直接在原 var-mapping 标注：ei/ti 四义，引用须带行号）

## 2. ⚠️ `background.ts` 采集链路与 ARCHITECTURE X1.2 描述不符

| ARCHITECTURE X1.2 说法 | 代码事实（background.ts） |
|----------------------|--------------------------|
| "background.ts handleSaveToTransit() → chrome.storage.local.set('transitResources') → sendMessage(resourceAdded) → 前端 onMessage(L43436) → 追加 transitItems + **Zr() 下载 → uploads/migrated/** → Sv() POST /api/resources/save 入库" | background.ts **L80 注释明确「直接使用原始 URL，不再经过本地引擎上传」**；L81-89 构造 `newResource` 带 `source:'extension'`，`url` 为原始 `info.srcUrl`/`selectionText`；L99-108 写 `transitResources`(≤5) + `sendMessage({action:'resourceAdded'})`。**无下载步骤**。前端 L43527 收到后，仅当 `source!=='local-tool'`（即 extension）才调 `Zr(url,{subfolder:'migrated'})` 下载（见 `01`/`08` 节）——但这是**前端侧**下载，且失败则丢弃整条（L43542 `return ... false`）。 |

**真相**：
- background.ts 本身**不下载**，只存元数据 URL（`source:'extension'`）。
- 真正下载发生在前端 `resourceAdded` 处理(@L43539 `Zr(url,{subfolder:'migrated'})`)，且**下载失败整条丢弃**（不入库）。
- ARCHITECTURE X1.2 把"Zr() 下载"放在 background.ts 侧描述，是**过时/错位**的（旧版可能 background 下载，现版不下载）。

**连锁影响**（与 ARCHITECTURE X3 交叉）：
- `source='extension'` 的资源**不被 rescan 孤儿清理**（X3.2）——符合"只存元数据，下载失败才丢"的设计。
- TASKS P1 #2「资源面板 URL 拖入不落盘」与此同构：拖入 URL 只 `O([{url,source:'drop'}])` 入内存（模块2 B@L29188），与采集的 `source:'extension'` 一样是"仅元数据"策略。

## 3. ✅ GAS 同步链路确认（ei/ti @L43950/L43974）

```
ei()(pushToCloud) @L43950
  → 收集 9 个配置键（app_settings/api_configs/users/membership/projects/presetPrompts/customNodeTemplates/modelSchedules/cloud_storage_config）
  → Q.getObject(t) 取本地值
  → CloudSyncEngine.push(e,...) → GAS_CLOUD_SYNC_URL (config.js)
ti()(pullFromCloud) @L43974
  → CloudSyncEngine.pull(...) → 回写本地
```
与 `02` 模块1 配置层 + `ARCHITECTURE.md` §4.5 GAS 云同步一致 ✅。CloudSyncEngine @L43897 读 `GAS_CLOUD_SYNC_URL`，未配置则 throw「未配置有效的 GAS URL」。

## 4. 汇总：本轮新增文档缺陷

| 缺陷 | 严重度 | 处置 |
|------|--------|------|
| `ei`/`ti` 四义绑定，var-mapping 只收 1 处 | 🔴 高 | func-mapping 补录 4 义 + 标注行号（见 §1） |
| ARCHITECTURE X1.2 采集链路描述过时（background 下载 vs 前端下载） | 🟡 中 | 改为「background 只存元数据，前端 resourceAdded 处理下载」 |
| background 下载失败整条丢弃 | 🟡 设计 | 非 bug，但文档应注明，避免误判为"采集必入库" |

## 5. 校验

- `ei`/`ti` 四处绑定 L1853/L36784/L36822/L43950 + L1854/L43974 全部命中 ✅
- background.ts L80「不再经过本地引擎上传」✅ / L99-108 storage+sendMessage ✅ / L88 source:'extension' ✅
- 前端 resourceAdded 下载 `Zr(url,{subfolder:'migrated'})`@L43539 ✅（见 `01`/`08`）
- CloudSyncEngine.push/pull @L43962/L43977 ✅ / GAS_CLOUD_SYNC_URL @L43899 ✅
