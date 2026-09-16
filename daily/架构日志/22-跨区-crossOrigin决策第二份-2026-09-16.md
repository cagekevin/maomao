# 22-跨区 · crossOrigin 决策第二份（绕过 SSOT setCrossOriginForReadable）

> **登记日期**：2026-09-16
> **触发区**：22（TD-22-1 在此确立 crossOrigin 单点裁决 SSOT）
> **母体**：M-C「绕过唯一入口」同胞债；根因区 = 22，跨 16/19/22 消费方，只开本份
> **落点**：明细 = 本文件；摘要 = `debt.mjs add`；DATAFLOW 灯 = 不改（SSOT 原语本身健康）

---

## 一 · 链路快照（refs 实证）

**SSOT 唯一裁决**：`base/utils/captureFrame.ts::setCrossOriginForReadable(video, url)`（captureFrame.ts:88-91）

```js
export function setCrossOriginForReadable(video, url) {
  if (sameOriginUrl(url)) return; // 同源：不强制 CORS，canvas 可读
  video.crossOrigin = 'anonymous';
}
```

`sameOriginUrl` 定义在 captureFrame.ts:94，为 SSOT 的判定助手。

`node scripts/mv-sync-refs.mjs refs captureFrame.ts` 实测 fan-in = **7 处**（均为守约方）：
DepthVideoModal · videoEngine · VideoExtractNode · VideoProcessNode · scriptBoxEngine · useVideoPoster · captureFrame.test。

---

## 二 · 溯源（母体归因）

TD-22-1（2026-09-13，22 区）将 crossOrigin 决策收口为单点裁决：**同源不设 crossOrigin（否则网关不对 `/files/*` 回 `Access-Control-Allow-Origin` ⇒ 媒体成 opaque ⇒ canvas 被污染 ⇒ `toBlob`/`getImageData` 返 `null`）**；真跨源才设 `anonymous`。该原语已 `export` 供全树复用（DATAFLOW §十 `captureFrame.ts 🟢`）。

横向推导自底层（contracts.ts 契约 → captureFrame.ts 工具原语）出发，发现 **≥5 处手写 `crossOrigin="anonymous"` / `crossOrigin='anonymous'` 未走该 SSOT** —— 即「第二份 crossOrigin 决策」，且其中站点会回读 canvas，**精确重演 TD-22-1 缺陷**。

---

## 三 · 探债（债明细真源）

| TD-ID | 决策点 / 问题点 | 归类 | 归属 | 爆炸半径 | 利息率 | 根因 | 偿还计划 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TD-22-55 | crossOrigin 决策 SSOT 被 ≥5 处硬编码绕过 | 增债 | 结构债 | clipboard / ImageZoomDialog / videoEditor 渲染节点 / VideoExtractNode 预览 | 中 | 母体 M-C（crossOrigin 决策第二份，缺机器守卫） | 抽 `withReadableCrossOrigin(el, url)` 统一替代手写 `crossOrigin='anonymous'`；加 `check-arch` 规则禁裸写 `crossOrigin`（若 videoEditor 渲染器确需恒 anonymous 则显式登记豁免） | 待还 |

**同源症状清单（挂 @见 TD-22-55，不单列债，一收全消）**：

1. `base/utils/clipboard.ts:68` `img.crossOrigin = 'anonymous'` → 随后 `canvas.toBlob(...)`（clipboard.ts:80）读 canvas。同源 `/files/` 走 CORS 模式 ⇒ opaque ⇒ `toBlob` 返 `null` ⇒ 复制图片静默降级为复制链接（TD-22-1 同类）。**危害最重**。
2. `videoEditor/engine/services/renderer/nodes/image-node.ts:19` `image.crossOrigin = 'anonymous'`（绘入渲染上下文，导出回读 ⇒ 同源劣化）。
3. `videoEditor/engine/services/renderer/nodes/sticker-node.ts:21` 同上；且该文件已 `import { buildIconSvgUrl }`（具备 SSOT 意识）却仍硬编码 ⇒ **内部矛盾**。
4. `nodes/VideoExtractNode.tsx:457` 预览 `<video crossOrigin="anonymous">`；同文件 line 259 已正确走 `setCrossOriginForReadable` ⇒ **同文件自相矛盾**。
5. `base/editors/ImageZoomDialog.tsx:245` `<video crossOrigin="anonymous">` 纯显示态（无 canvas 回读，危害最低，但仍是第二份）。
6. **观察（同母体第二套实现）**：`base/utils/asyncGuard.ts:100` 自带 `crossOrigin = 'anonymous'` 默认 + line 139 失败去 crossOrigin 重试 —— 与 SSOT 的 `sameOriginUrl` 是**两套决策实现**（策略不同：恒 anonymous+重试 vs 同源免 CORS）。建议并入收口，统一为同一原语。

---

## 四 · 横向扫描已裁定非债 / 无新增（不重查留痕）

- `window.dispatchEvent`（第二套广播，TD-22-23 同类）：仅 contracts / eventBus / playback-manager 注释引用，**无新增裸调用** → 已收口。
- `video_editor_` 字面量手拼（SSOT = `base/core/videoEditorKeys.ts`）：仅 SSOT 与 contracts 注释出现，**无第二份** → 无新增。
- `shot-` 前缀（SSOT = `SHOT_HANDLE_PREFIX` / `parseShotHandle`）：仅 contracts.ts 定义，**无硬编码** → 无新增。
- `buildIconSvgUrl`（SSOT iconify 出站）：3 处调用全走 SSOT，**无直连公网** → 无新增（TD-22-47 已收口）。
- `EditorCore.releaseProjectContext`（SSOT 项目上下文生命周期）：16 处全走唯一编排点，**无手动 reset 旁路** → 无新增（TD-22-32 已收口）。
- `getVisualSourceTime` / `sourceTimeAt`（SSOT 时间轴↔源时间）：消费方全走 SSOT，**无内联时间数学旁路** → 无新增（TD-22-21 已收口）。

---

## 五 · 覆盖度表

| 文件 | 层 | 覆盖状态 | 灯 | 轮次/日期 | 证据(refs/行号) | 债/裁定 |
| --- | --- | --- | --- | --- | --- | --- |
| base/utils/captureFrame.ts | L1 工具原语 | 深审 | 🟢 | 跨区 09-16 | refs 7 fan-in；setCrossOriginForReadable 正确 | 无债（SSOT 本身健康） |
| base/utils/clipboard.ts | L1 工具 | 深审 | 🔴 | 跨区 09-16 | clipboard.ts:68 / 80 | TD-22-55 |
| base/utils/asyncGuard.ts | L1 工具 | 抽审 | 🔴 | 跨区 09-16 | asyncGuard.ts:100 / 139 第二套决策 | TD-22-55（同母体） |
| base/editors/ImageZoomDialog.tsx | L3 UI | 抽审 | 🔴 | 跨区 09-16 | ImageZoomDialog.tsx:245 | TD-22-55 |
| videoEditor/.../renderer/nodes/image-node.ts | L2 渲染 | 抽审 | 🔴 | 跨区 09-16 | image-node.ts:19 | TD-22-55 |
| videoEditor/.../renderer/nodes/sticker-node.ts | L2 渲染 | 抽审 | 🔴 | 跨区 09-16 | sticker-node.ts:21 | TD-22-55 |
| nodes/VideoExtractNode.tsx | L3 节点 | 深审 | 🔴 | 跨区 09-16 | VideoExtractNode.tsx:457 vs 259 自矛盾 | TD-22-55 |

---

## 六 · 结论

自最底层（contracts.ts 契约地基 → captureFrame.ts 工具原语）横向推导，命中 **1 个母体债家族**：crossOrigin 决策第二份（绕过 SSOT `setCrossOriginForReadable`）。其中 `clipboard.ts` 的 `toBlob` 路径精确重演 TD-22-1 不透明 canvas 缺陷，为最高实害点。

DATAFLOW 已对账一致：SSOT 原语 `captureFrame.ts` 保持 🟢（原语本身健康），本次为消费方绕过 SSOT、非链路漂移，故**不改灯**。

覆盖账：本轮审 7 文件 / 本家族共 7 文件 / 未审 0；全部挂 TD-22-55（母体一收全消），无漏网。
