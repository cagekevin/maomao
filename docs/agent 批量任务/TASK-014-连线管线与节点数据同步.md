# TASK-014 — 连线管线与节点数据同步薄弱点探查

> ⚠️ 铁律（违反重做）
> 1. 你只能写这个文件，碰任何其他文件视为失败。
> 2. 不写脚本：本任务是「读源码 + 在本文档表格里写结论」，不要写脚本去批量改代码。
> 3. 每行号必须来自本次你实际读到的文件，禁止套用历史行号。

## 一、任务背景

TASK-006 聚焦 AI 执行链路。但画布真正的数据流动靠「连线」：上游节点产出 → 下游实时读取。同时 Agent 用 `update_node` 改 node.data，节点组件需同步到本地 state。这两套机制（连线数据传递、data 外部变更同步）存在大量边界，尚未被审计。本任务专门探查。

## 二、硬约束

- 只读 `src/components/base/` 指定文件，不修改任何 `src/`。
- 不参考现有文档作为结论来源（探索起点见本节）。
- 每条结论附「文件 + 行号 + 真实片段 + 触发场景 + 后果」，区分「已确认缺陷 / 设计权衡 / 健康」。

## 三、探索起点（本次会话已定位，必须逐文件通读）

- `src/components/base/useConnectedInputs.js`（177 行，已读）：通用连线数据传递。核心 `getNodeOutput(node, sourceHandle)`、`useConnectedInputs(nodeId)`、`NODE_OUTPUTS` 声明表、`resolveKind`、`classifyUrl`、`toAbsoluteFileUrl` 补全路径。注释明言「只接一层上游」「实时从上游读取」。
- `src/components/base/useSyncNodeData.js`（37 行，已读）：`data` 外部变更 → 本地 state 同步。靠 `prevRef` 比较，`(key in prev)` 跳过首次。
- `src/components/base/scriptBoxPrompts.js`：`collectAssets(shot, assets)` 被 `useConnectedInputs` 调用（`useConnectedInputs.js L118`）。
- 上游产出节点：`src/components/ImageNode.jsx`、`src/components/PromptNode.jsx`、`src/components/TextNode.jsx`、`src/components/ImageBoxNode.jsx`、`src/components/VideoProcessNode.jsx`（产出 mediaType 等）、`src/components/GroupNode.jsx`。

## 四、覆盖清单（按维度，枚举「出现的所有地方」）

1. **管线只接一层**：`useConnectedInputs.js L17` 注释明言「只接一层上游」。但若用户需要「上游的上游」（多跳依赖），机制不支持 → 下游拿不到隔层数据。判定权衡还是缺陷取决于是否真有此需求（看节点是否有多跳连线场景）。
2. **getNodeOutput 未覆盖新节点类型**：`NODE_OUTPUTS`（`useConnectedInputs.js L72-83`）只声明了 imageBoxNode/videoExtractNode/gridSplitNode/gridMergeNode。其余有产出的节点（如 `ImageNode`/`PromptNode`/`PanoramaNode`/`DiscountVideoNode` 走 `genericOutput` 单值兜底，`FaceMosaicNode`/`VideoProcessNode` 等走 spawn 推出新节点）。需确认：①所有数组产出方是否已在 `NODE_OUTPUTS` 显式声明（避免 `genericOutput` 只看单 url 而漏判 `data.images[]`/`extractedImages[]`）；②spawn 路径的产物是否经 spawn 节点正确进入管线。
3. **mediaType 缺失误判**：`resolveKind`（`L52-55`）：`mediaType` 缺失时回退 `classifyUrl`（`L42-46`）按 URL 扩展名判定。blob:/data: 无扩展名的音频会被误判为 image（`useConnectedInputs.js L48-51` 注释已承认 VideoProcessNode extractAudio 的坑）。还有哪些节点产出 blob: 音频/视频会被误判？
4. **useSyncNodeData 首值跳过**：`useSyncNodeData.js L30` `if (!(key in prev)) { prev[key]=next; continue }` 跳过首次。若节点挂载时 `data[key]` 为 `undefined`，后续从 `undefined→值` 变化能否触发？`prev[key]` 初始为 `undefined`，`next===last`（`undefined===undefined`）会 `continue` 不更新 → 首帧赋值丢失的可能。
5. **连线数据 vs Agent 改 data 冲突**：Agent `update_node` 改 `node.data` 经 `useSyncNodeData` 同步到本地；但节点本地 state 改了（`setAspectRatio`）又经 `onChange` 写回 data → 双向同步是否死循环？grep 各节点 `useSyncNodeData` 用法 + `onChange` 写回，找循环。
6. **group 产出聚合**：`useConnectedInputs.js L152-163` group 作为出口时聚合组内子节点产出。若子节点 `hidden` 或被删但仍在 `nodeIds`，是否漏/错聚合？

## 五、输出规范

| # | 维度 | 文件:行 | 真实代码片段 | 触发场景 | 后果 | 判定(缺陷/权衡/健康) |
|---|------|---------|--------------|----------|------|---------------------|
| 1 | 只接一层 | `useConnectedInputs.js L17` | `//  1. 上游「只接一层」：只取 edge.target === 本节点 的边，不递归无限上游。`<br>`edges.filter((e) => e.target === nodeId)`（L145-146） | 用户把 A→B→C 连成链，想让 C 直接吃 A 的产出（多跳依赖）。画布当前无此类官方布局，实际连线均为「直接上游一层」。 | 下游 C 的 `useConnectedInputs` 只遍历 `e.target===C` 的边，A 不在其中 → C 拿不到 A 产出，需显式 B→C 再连线。 | 权衡（文档 L18-19 明言「隔层不应自动混入，否则依赖关系不可控、数据爆炸」；现状无多跳刚需，符合设计意图） |
| 2 | NODE_OUTPUTS 漏覆盖 | `useConnectedInputs.js L72-83`（`NODE_OUTPUTS` 仅 4 项）<br>`genericOutput` L86-101 | `const NODE_OUTPUTS = { imageBoxNode, videoExtractNode, gridSplitNode, gridMergeNode }`<br>`genericOutput` 候选：`{ url: d.imageUrl }, { url: d.videoUrl }, { url: d.resultUrl }`（L88-92） | 盘点所有有「连线产出」的节点：<br>① 已在 `NODE_OUTPUTS` 显式声明（数组产出）：`imageBoxNode`(d.images L74-78)、`videoExtractNode`/`gridSplitNode`/`gridMergeNode`(d.extractedImages L80-82)。<br>② 走 `genericOutput` 单值兜底（健康）：`ImageNode`(data.imageUrl)、`PromptNode`(data.imageUrl)、`PanoramaNode`(data.imageUrl，写回 L67)、`DiscountVideoNode`(data.videoUrl)。<br>③ `FaceMosaicNode`：`outputResults` 走 **spawn imageNode**（L75-91，`setNodes([...ns, ...list])`，每张结果 spawn 一个 `imageNode` 带 `imageUrl`），其本地 `resultUrls` state（L52/124）**不写回 `data`**（无 `patchData({resultUrls})`）→ 连 FaceMosaicNode 本身无产出是设计预期。<br>④ `VideoProcessNode`：trim/concat 结果通过 `spawnVideoNode` spawn 成 imageNode（L690-710），extractAudio 通过 `spawnAudioNode`（L723-731），GIF 通过 `spawnGifNode`（L737-752）——产出方都是 spawn 出的 imageNode，不直接作为管线源。 | ①声明节点正确覆盖数组产出，健康。<br>②单值节点被 `genericOutput` 兜底，健康。<br>③连 FaceMosaicNode 本身无产出，但下游应连其 **spawn 出的 imageNode**（产物推送路径），非缺陷而是设计；若用户误以为「连 FaceMosaicNode 口」能拿到结果图则体验坑，但管线语义自洽。<br>④VideoProcessNode 同③。 | **健康（设计上无遗漏）**；补充：`genericOutput` 只认单值 `imageUrl/videoUrl/resultUrl`，不认数组字段，但所有数组产出方已在 `NODE_OUTPUTS` 显式声明，故无实际缺口。<br>⚠️ 体验提示（非缺陷）：FaceMosaicNode/VideoProcessNode 的真实产物经 spawn 节点传递，用户需连 spawn 节点而非原节点。 |
| 3 | mediaType 误判 | `resolveKind` L52-55<br>`classifyUrl` L42-46<br>`genericOutput` L88-92 | `function resolveKind(url, mediaType){ if (mediaType==='image'||mediaType==='video'||mediaType==='audio') return mediaType; return classifyUrl(url||'') }`<br>候选里 `mediaType: d.mediaType` 随 `d.videoUrl`/`d.imageUrl` 一起取。`genericOutput` 对 `DiscountVideoNode`：`{ url: d.videoUrl, mediaType: d.mediaType }`（L90），但 `DiscountVideoNode` 写回 `data` 时**不带 `mediaType`**（`onSuccess` L152 仅 `setVideoUrl(r.url)`；`onRecover` L157-160 `patchData({videoUrl})` 也不带）。 | 现状所有经 `genericOutput` 的视频/音频产出方：`DiscountVideoNode` 的 `data.videoUrl` 来自网关返回的 `/files/...mp4`（带扩展名）→ `classifyUrl` L43 正则命中 `.mp4` → 判 `video`，健康；`VideoProcessNode` 的 spawn 节点（imageNode）已显式带 `mediaType:'video'/'audio'/'image'`（L703/726/749），`resolveKind` 直接返回 mediaType 不走 classifyUrl，健康；`extractAudio` 的 blob 音频因 spawn 带 `mediaType:'audio'` 不被误判（L48-51 注释所述坑已被规避）。<br>**潜在边界**：若未来新增「只写 `videoUrl`/`audioUrl` 不带 mediaType 且 URL 为 `blob:`/`data:` 无扩展名」的产出方，`classifyUrl` 对无扩展名回退 `image`（L45）→ 视频/音频被判图片。 | `blob:`/`data:` 无扩展名视频/音频被当图片 → 下游生图节点把其当参考图请求 → 网关报错或破图。现存路径因「URL 带扩展名」或「spawn 显式带 mediaType」均已规避，故**现状无触发**；属契约未强制的潜在边界。 | **健康（现状实测无触发）**；⚠️ 潜在缺陷边界：依赖「产出方 URL 带扩展名」或「spawn 显式带 mediaType」的未强制约定，新增产出方易踩坑 |
| 4 | 首值跳过 | `useSyncNodeData.js L30` | `if (!(key in prev)) { prev[key] = next; continue }` | 节点挂载时 `useSyncNodeData(data, { aspectRatio: setAspectRatio })`，`data.aspectRatio` 为 `undefined`（PromptNode 初始化 `useState(data.aspectRatio || 'Auto')`，data 里没该字段则为 undefined）。首次 effect：`prev` 为空，`'aspectRatio' in prev` 为 false → 走跳过分支，`prev.aspectRatio = undefined`，`continue` 不 set（正确，由 useState 初值兜底）。后续若 Agent `update_node` 把 `aspectRatio` 从 `undefined` 改成一个值：`next = '16:9'`，`last = prev.aspectRatio = undefined`，`next === last` 为 false → set('16:9')，正常同步。 | 仅在「挂载时 data[key] 就是 undefined，且期望被外部改为值」时，首帧因 prev 记录 undefined 而放行，不丢。真正风险场景：若某 key 挂载时为 undefined，**且**逻辑期望「挂载即赋值」——但 useState 已处理初值，无丢失。 | 健康（prev 记录 undefined 使后续 undefined→值 的变化可触发；机制自洽） |
| 5 | 双向同步循环 | `PromptNode.jsx L57` + `L361,364,377`（`patchData` 写回 data）<br>`DiscountVideoNode.jsx L163-167` | `useSyncNodeData(data, { aspectRatio: setAspectRatio, ... })`（L57）<br>UI 改：`setAspectRatio(r); setImgPrefs({aspectRatio:r}); patchData({ aspectRatio: r })`（L364）<br>`patchData` → `setNodes(ns.map(n => n.id===id ? {...n, data:{...n.data, ...patch}} : n))`（L70-72）<br>effect 内：`if (next === last) continue`（useSyncNodeData.js L31） | PromptNode：用户选比例 → `setAspectRatio` + `patchData` 写回 data → ReactFlow setNodes 触发新 `data` 引用 → effect 跑：`next='16:9'`，`last=prev.aspectRatio='16:9'`（上轮已记），`next===last` → `continue` 不 set → 无事。DiscountVideoNode：裸 effect `if (data.videoUrl && data.videoUrl !== videoUrl) setVideoUrl(data.videoUrl)`（L163-167），单向（data→state），state 不写回 data，无回环。 | 无死循环：`useSyncNodeData` 用 `===` 短路，state→data→data 引用变化但值相等时不回写；写回 data 的 `patchData` 不改变被同步字段值（同值），effect 立即收敛。 | 健康（双向写入设计已通过「值相等即跳过」规避循环，符合 TASK-006/本任务目标） |
| 6 | group 聚合 | `useConnectedInputs.js L152-163` | `if (src.type === 'group') { nodes.filter((n) => n.parentId === src.id && !n.hidden).forEach(child => { const r = getNodeOutput(child); out.images.push(...r.images); ... }) }` | A 拖进 group G，下游 D 连 G 的 source 口（GroupNode 右端口 L109）。聚合时遍历 `parentId===G.id` 且 `!hidden` 的子节点。①子节点被删除：React Flow 从 `nodes` 数组移除 → filter 取不到 → 不聚合（健康）。②group 折叠：GroupNode `toggleCollapse` 把子节点 `hidden:true`（`GroupNode.jsx L56`）→ filter 排除 → 下游拿不到组内产出。 | 折叠态下下游连线「看似连着 group 却无产出」，展开 group 后自动恢复（依赖 `useStore` 订阅 nodes 变化 L140-141 重算）。不会错聚已删节点，但折叠时用户可能困惑。 | 权衡（折叠隐藏子节点是预期语义，展开即恢复；无「漏聚已删节点」错误） |

## 七（补充）、Top 3 最值得修

> 审计结论：6 维度中**无已确认运行缺陷**（FaceMosaicNode 误判已排除——其产物走 spawn imageNode，非管线直连）。以下 3 项按「风险等级」排序，均为**潜在边界/体验坑/契约加固**，非当前必现 bug。

1. **mediaType 契约未强制（维度 3，潜在缺陷边界）**：`genericOutput`/`resolveKind` 依赖产出方 `data.mediaType` 判断视频/音频，但 `DiscountVideoNode` 写回 `data.videoUrl` 时不带 `mediaType`（L152/157-160），仅靠 URL 扩展名兜底。现状因 URL 带 `.mp4` 扩展名健康，但一旦新增「只写 `videoUrl`/`audioUrl` 且为 `blob:`/`data:` 无扩展名」的产出方即误判为图片。修复：①在 `genericOutput` 内对已知视频/音频节点类型（`discountVideoNode` 等）硬判类型；②或在 `patchData({videoUrl})` 处强制补 `mediaType:'video'`。优先级最高（契约加固，防未来踩坑）。

2. **group 折叠时静默无产出（维度 6，权衡→易踩坑）**：下游连 group 的 source 口（L109 `CustomHandle`）在折叠态下因子节点 `hidden:true`（L55-56）被 filter 排除（L154），下游静默拿不到组内产出，用户无提示。展开即恢复。修复：折叠态保留「仍聚合非 hidden 子节点」选项，或 UI 给连线 tooltip「编组折叠时子节点不传下游」。优先级中。

3. **spawn 节点产物路径易连错（维度 2/3 衍生，体验坑）**：`FaceMosaicNode`/`VideoProcessNode` 的真实产物经 `outputResults`/`spawnVideoNode`/`spawnAudioNode`/`spawnGifNode` 推送到新 spawn 的 `imageNode`，原节点本身连线无产出。用户若误连原节点而非 spawn 节点，会疑惑「为什么没图」。修复：文档/引导层说明产物节点来源，或在原节点 source 口对「已知产物走 spawn」的节点类型给出连线提示。优先级低（语义自洽，仅 UX 引导）。 |

## 六、验收标准

- [ ] 6 维度覆盖，附行号+片段。
- [ ] 凡「缺陷」给触发场景→后果链路。
- [ ] 区分缺陷/权衡/健康。
- [ ] 末尾 Top 3 最值得修。

## 七、铁律文件名

`docs/agent 批量任务/TASK-014-连线管线与节点数据同步.md`
