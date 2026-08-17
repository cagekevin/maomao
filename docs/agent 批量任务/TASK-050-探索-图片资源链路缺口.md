# TASK-050 — 探索：图片/资源链路"该走却没走"缺口（最终优化版）

> 铁律：只读不改，禁止写脚本。自包含，不查看其他 TASK。一切结论带代码证据（文件 + 行号 + 片段），行号亲自打开核实。
> 本文为审计修订版：初稿 7 条经逐行复核后，**4 条被证伪已撤回**，保留并精确化 4 条真实缺口（A–D）。

## 一、链路全景（已核实）

```
上传/粘贴/生成
   │  useAssetDropPaste → compressAndSaveLocal → filesApi.saveFiles → 落盘 localTool /files/
   ▼  返回绝对地址（API_BASE=http://127.0.0.1:18080/files/...）
节点 data：data.imageUrl / data.images[].url / data.resultUrl
   │
存储：storageAdapter(sGet/sSet/sRemove) → localStorage / chrome.storage.local  [注意：无 getValue/setValue]
   │
刷新加载：从存储读 data → 组件渲染
   │
归一化出口（imageUrl.js）：
   · 读取/展示：toAbsoluteFileUrl(url)  —— /files/ 相对 → 补全绝对 http（line 18-22，normalizeImageUrl 是其别名 line 31-33）
   · 发送/给AI：normalizeImageUrlForSend(url)—— blob→data、/files/→绝对、data/http 原样（line 99-108）
   ▼
展示（<img> / LazyImage） & 发送（refImage.resolveRefImages → useAgentChat）
```

**关键事实（已核实，推翻初稿误判）**：
- `imageUrl.js` 提供两个出口，且**本身实现正确、已覆盖相对/绝对/blob/data 四种形式**。问题不在模块，而在"个别组件忘了调用读取出口"。
- 发送链路（refImage.js → useAgentChat）**完全正确**：`resolveRefImages`/`resolveRefImageUrl`（refImage.js:25-37）底层即 `normalizeImageUrlsForSend`；useAgentChat.js:844/991 对 attachments 统一 `normalizeImageUrlForSend`。
- 基础 `ImageNode.jsx` **已正确**：line 35 `const url = toAbsoluteFileUrl(data.imageUrl || data.url || '') || ''`，`displayUrl` 派生自查线由 `url`（line 160, 230, 331）。
- 生成落盘 **已防御**：`useNodeGeneration.js:92-101` 仅接受字符串 URL，`saveResultToTasks` 落盘的是 URL 而非 base64，不会撑爆存储。
- 存储层 `storageAdapter.js` **无 `getValue`/`setValue`**，仅导出 `sGet/sSet/sRemove/initStorage`（line 24/73/89/100/122）。

## 二、已撤回的初稿误判（诚实记录，避免误导）

| 初稿条目 | 撤回原因（证据） |
|----------|------------------|
| G1 ImageNode 未归一化 | ❌ `ImageNode.jsx:35` 已 `toAbsoluteFileUrl(...)` 且 line 230/331 经 `displayUrl` 使用，已正确。 |
| G4 生成落盘存 base64 撑爆 | ❌ `useNodeGeneration.js:92-101` 已防御：只收字符串 URL，`saveResultToTasks` 落盘 URL，不存 base64。 |
| G6 引用 `getValue()` 返回 undefined | ❌ `storageAdapter.js` 不存在 `getValue`（仅 sGet/sSet）。`toAbsoluteFileUrl` 确实对 falsy 原样返回，但属防御性细节，见 D 条。 |
| G7 refImage.js 只聚合 data.imageUrl | ❌ `refImage.js` 是**发送端统一出口**，line 25-37 正确调用 `normalizeImageUrlForSend`/`normalizeImageUrlsForSend`，功能完善。 |

## 三、真实缺口清单（A–D，均带证据）

### A. 【核心缺陷】ImageBoxNode 主图与缩略图未走归一化出口
- **证据**：`src/components/ImageBoxNode.jsx`
  - line 491：主图 `<img src={current.url} .../>` —— `current.url` 直接来自 `data.images[].url`，**未过 `toAbsoluteFileUrl`**。
  - line 568：缩略图 `<LazyImage src={img.thumb || img.url} .../>` —— 同样未归一化。
  - line 683：缩放大图 `<img src={toAbsoluteFileUrl(zoomUrl)} />` —— **已归一化**。
- **矛盾点**：同一文件里 zoomUrl（line 683）已调用 `toAbsoluteFileUrl`，说明作者知道要归一化，但**漏了主图（491）和缩略图（568）两处**。
- **后果**：若 `data.images[].url` 存的是相对 `/files/...`（落盘后常见），在 http(localhost) 协议下 `<img>` 解析成错误源 → 主图与缩略图破图。zoomUrl 因已归一化反而能显示，表现不一致。
- **是否缺陷**：✅ 是（本任务最核心发现）。

### B. 【健壮性缺陷】上游连线图片过滤器只认 http/data:image
- **证据**：`src/components/ImageBoxNode.jsx:206-213`
  ```js
  connected.images.forEach((img) => {
    if (typeof img.url === 'string' && (img.url.startsWith('http') || img.url.startsWith('data:image'))) {
      list.push({ id: `up-${img.id}`, url: img.url })
    }
  })
  ```
- **分析**：上游经 `useConnectedInputs.js:174` 已对 `im.url` 跑 `toAbsoluteFileUrl`，本地图被补全为 `http://127.0.0.1:18080/files/...`，**以 http 开头 → 当前同机场景能过过滤**。但此逻辑**脆弱**：它依赖 `useConnectedInputs` 必须先补全；且过滤意图不明确（为何排除 `file://`、为何排除其它 scheme）。更稳妥做法是"放行所有非空 url"，把归一化职责完全交给 `toAbsoluteFileUrl`。
- **后果**：同机画布环境一般不破；若上游 url 未经 `useConnectedInputs` 补全（相对路径直传）或环境变化，导入即失败且无提示（仅 toast 无图）。属隐蔽健壮性缺口。
- **是否缺陷**：⚠️ 条件性/健壮性（非必破，但应修）。

### C. 【防御性缺陷】toAbsoluteFileUrl 对 falsy 原样返回，ImageBoxNode 无兜底
- **证据**：`src/components/base/imageUrl.js:18-22`
  ```js
  export function toAbsoluteFileUrl(url) {
    if (!url || typeof url !== 'string') return url   // undefined→undefined, null→null
    if (url.startsWith('/files/')) return `${API_BASE}${url}`
    return url
  }
  ```
  - `ImageNode.jsx:35` 有防护：`toAbsoluteFileUrl(...) || ''` ✅
  - `ImageBoxNode.jsx:491` `<img src={current.url}>` 无 `|| ''` 防护 ❌（`current.url` 为 undefined 时 `<img src={undefined}>`）。
- **后果**：url 缺失时图片不渲染且无降级；与 ImageNode 的防护不一致。
- **是否缺陷**：🟡 防御性（低危，但应统一加 `|| ''`）。

### D. 【架构一致性】读取出口调用不一致（归一化模块本身无问题）
- **证据**：
  - 读取/展示出口 `toAbsoluteFileUrl`：`ImageNode.jsx:35`（用）、`ImageBoxNode.jsx:683`（用）、`AgentMessage.jsx:148`（用）、`useConnectedInputs.js:174`（用）、`ImageBoxNode.jsx:491/568`（**漏用**）。
  - 发送出口 `normalizeImageUrlForSend`：`refImage.js` + `useAgentChat.js:844/991`（统一用）。
- **结论**：模块层已统一（读取=`toAbsoluteFileUrl`，发送=`normalizeImageUrlForSend`），但 **ImageBoxNode 的展示两处（A 条）忘了调用读取出口**，是"该走统一出口却没走"的实例。命名上 `normalizeImageUrl` 与 `toAbsoluteFileUrl` 是同一函数（alias），无需新增，只需补调用点。
- **是否缺陷**：✅ 是（体现为 A 的具体根因）。

## 四、补充观察（非破图类，供参考）

- **blob URL 风险（潜在）**：`useAssetDropPaste.js` 上传失败时可能把 `URL.createObjectURL`（blob:）或原始 dataURL 作为 `url` 写回 `data.imageUrl`；blob: 刷新后必死。但 `ImageNode`/`ImageBoxNode` 读取出口不会把 blob 转 data（只有发送出口 `normalizeImageUrlForSend` 会）。若失败结果被入库，刷新即破。建议上传失败回退为原始 dataURL 而非 blob。（需结合 useAssetDropPaste 错误处理段进一步确认，本次未展开。）
- **ChatMessage.jsx 不存在**：聊天图片展示走 `AgentMessage.jsx:148` 用 `toAbsoluteFileUrl`，已正确。

## 五、结论

经逐行审计，真实缺口收敛为 **4 条（A–D）**，全部满足验收（≥3 条、带文件:行证据、覆盖落盘/存储/刷新加载/归一化）：

| 编号 | 环节 | 文件:行 | 本该 | 实际 | 严重性 |
|------|------|---------|------|------|--------|
| A | 刷新加载/展示 | `ImageBoxNode.jsx:491,568` | 走 `toAbsoluteFileUrl` | 主图/缩略图直接用 `current.url`/`img.url` | 🔴 高（必破图） |
| B | 刷新加载/上游导入 | `ImageBoxNode.jsx:210` | 放行所有非空 url | 仅认 http/data:image | 🟠 中（条件性） |
| C | 防御性 | `imageUrl.js:19` + `ImageBoxNode.jsx:491` | falsy 给 `''` 兜底 | 原样返回 undefined | 🟡 低 |
| D | 架构一致性 | 见三.D | 全组件调同一读取出口 | ImageBoxNode 漏两处 | 🔴 根因（=A） |

**撤回 4 条误判**（G1/G4/G6/G7）—— 因初稿未逐行核实，已据实更正。

**修复建议（供后续 TASK，不在本任务范围）**：
1. A/C：在 `ImageBoxNode.jsx:491` 改为 `src={toAbsoluteFileUrl(current.url) || ''}`，line 568 改为 `src={toAbsoluteFileUrl(img.thumb || img.url) || ''}`。
2. B：把 line 210 过滤改为 `if (typeof img.url === 'string' && img.url) list.push(...)`，归一化交给 `toAbsoluteFileUrl`。
3. 无需新增模块，`imageUrl.js` 的 `toAbsoluteFileUrl` 已足够，补调用点即可。
