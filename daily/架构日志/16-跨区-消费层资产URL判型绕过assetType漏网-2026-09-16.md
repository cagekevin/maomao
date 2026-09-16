# 16-跨区-消费层资产 URL 判型绕过 assetType 漏网（2026-09-16）

> **触发**：用户要求「仔细看看，还有哪些是应该收口到底层的东西，但是却落在了消费层或者抽象层」。
> **方法**：自底向上核对 2026-09-16「媒体类型判定与 URL 提取真值源收口」母体（TD-16-4..14）的收口覆盖率，用 `refs` + `grep` 验证消费层是否已统一走 `base/utils/assetType.ts` 单一判型入口；重点查漏网。
> **结论一句话**：该母体号称「一收全消」，但 **ImageBoxNode 三处仍手写 `startsWith('http')||startsWith('data:image')` 绕过 `assetType.isAssetUrl`／`classifyAssetUrlKind` 单一入口**——是漏网的同母体残债；其余消费层（markdownImages／VideoProcessNode／aspectRatio／UPLOAD_DIRS）已正确委托或已裁定非债。

---

## 一 · 链路快照（本轮实证 · refs / grep）

- `base/utils/assetType.ts` ← **15 处模块 import**（refs 实证）：filesApi／nodeMedia／creativeCatalog／GeneratedView／ResourceLibrary／resourceStore／imageCompress／director3d/project／**AssetNode**／**VideoProcessNode**／markdownImages／scriptBoxEngine／useAssetDropPaste／useConnectedInputs／mediaType.test。**关键：`nodes/ImageBoxNode.tsx` 不在其 fan-in 中**（grep 其 import 仅含 asyncGuard／assetUrl／filesApi，无 assetType）。
- `assetType.ts` 文件头红线：「禁止再就地手写 `\.(mp4|webm…)$` 正则；此前 5 处各写一份已漂移出三类不一致（ogg 归属相反／ogv·oga·opus 漏认／`a.mp4?token=1` 误判 image）」。单一真值源 = `isAssetUrl`(:119) + `classifyAssetUrlKind`(:54) + `isAudio`(:132)。
- **ImageBoxNode 三处内联判型**（均绕过单一入口，且无任何注释固化理由）：
  - `nodes/ImageBoxNode.tsx:268`：`img.url.startsWith('http') || img.url.startsWith('data:image')`（上游连线取图判型）
  - `nodes/ImageBoxNode.tsx:341`：`text.startsWith('http') || text.startsWith('data:image/')`（粘贴 URL 判型）
  - `nodes/ImageBoxNode.tsx:371`：`text.startsWith('http') || text.startsWith('data:image/')`（拖拽 URL 判型）

## 二 · 溯源（母体 = 2026-09-16 收口的「媒体类型判定与 URL 提取真值源收口」）

| 母体 | 既有收口 | 本轮缺口 |
| --- | --- | --- |
| M-A 资产／图片 URL 判型 SSOT 第二份 | TD-16-4..14（creativeCatalog／scriptBoxEngine／director3d／markdownImages／media-utils／processing／resources／imageCompress）已「母体一收全消」 | **ImageBoxNode（消费层节点）未被纳入该母体扫描**，残留 3 处内联判型 |

> 该母体收口轮以「消费层／utils 内联正则」为清扫对象，而 ImageBoxNode 用的是 `startsWith` 字面量组合（非正则），形态不同 → 漏检。属「收口轮的形态盲点」，非新机制。

## 三 · 探债（逐文件结论 + 证据）

### 1 · ImageBoxNode 三处绕过单一判型入口 —— 债（母体漏网，结构债）
- **五问**：① 同一真相抄成 ≥2 份？是——`isAssetUrl`+`classifyAssetUrlKind` 已是真值源，ImageBoxNode 又手写一份「http／data:image 即图」判型。② 绕过唯一入口？是（fan-in 14 个消费点都走 assetType，唯 ImageBoxNode 不走）。③ 静默吞错？否。④ 死代码？否。⑤ 注释与实现一致？否——与 assetType 文件头红线直接冲突，且无任何注释说明为何单独写。
- **口径错位（潜在）**：`isAssetUrl` 含 `blob:`，ImageBoxNode 内联判型不含 `blob:`，与真值源在「blob 是否算资产 URL」上口径不一致。实测 `classifyAssetUrlKind(blob:…)` 因无扩展名返回 null → 不是 image，故**当前无行为 bug**；但这是「副本碰巧与真值源同结论」，一旦 assetType 的 image 判据演进，ImageBoxNode 不跟随 → 回潮风险。
- **根因**：属 M-A（资产／图片 URL 判型 SSOT）母体残漏，与 TD-16-4..14 同源。
- **归属**：结构债（纯收口，无业务决策）。
- **偿还计划（本流程不执行）**：ImageBoxNode 三处改为 `isAssetUrl(url) && classifyAssetUrlKind(url) === 'image'`（从 `base/utils/assetType.ts` 引入）；如确需排除 `blob:` 等临时协议，应在 canonical 层统一表达一次，而非消费层各写一份。可选：在 `check:arch` 加「禁止内联 `startsWith('http')||startsWith('data:image')` 资产 URL 判型」机器闸防复发。

### 2 · markdownImages.looksLikeImageUrl —— 非债（已裁定，留痕防重审）
- `panels/markdownImages.ts:30` 仍有 `if (u.startsWith('data:')) return u.startsWith('data:image/');`，看似第二副本，但 TD-16-7 已裁决：本函数与 `assetType.isAssetUrl` **契约不同**（消息渲染域「是否当图渲染」需排除网页后缀／临时协议），已改名 `looksLikeImageUrl` 消歧，且 :33 已委托 `classifyAssetUrlKind` 作「扩展名是否图片」真值源。属**有意设计 + 注释已固化** → 非债（与本轮母体同根但已闭环）。
- **证据**：markdownImages.ts:12-17 文件头裁定 + TD-16-7 已解决。

### 3 · VideoProcessNode.nameFromUrl —— 非债（观察，不登记）
- `nodes/VideoProcessNode.tsx:145-146`：`data:`→`'video.mp4'`、`blob:`→`'local-video.mp4'` 是「无文件名时的默认展示名」兜底，属文件名启发式而非媒体判型；当前无 canonical「按 kind 默认文件名」表，行为正确。**注意** :343 已正确走 `classifyAssetUrlKind(u) === 'video'`，仅文件名兜底段内联，不构成 SSOT 第二份 → 非债。若将来抽象「默认文件名表」可一并收口，但本轮不登记。

### 4 · aspectRatio／UPLOAD_DIRS 在节点层 —— 非债（已正确委托）
- 节点层 `aspectRatio` 仅作 `node.data` 字符串透传（如 `'16:9'`／`'1:1'`／`'Auto'`），像素换算真值在 `imagePixel.ts` 的 `RATIO_PIXEL_TABLE`；上传子目录统一走 `UPLOAD_DIRS`（VideoProcessNode:53／AssetNode:28 均 `import { UPLOAD_DIRS } from '../base/utils/uploadDirs.ts'`）。无第二份 → 非债。
- **证据**：grep `imagePixel|RATIO_PIXEL|UPLOAD_DIRS|subfolder` 全仓仅消费方引用，无内联表。

## 四 · 结论

本轮聚焦「应落底层（assetType 单一判型入口）却落在消费／抽象层」的残债：
- **发现 1 笔结构债**：ImageBoxNode 三处内联资产／图片 URL 判型绕过 `assetType` 单一入口（母体 M-A 漏网，TD-16-4..14 收口轮因形态盲点漏检）。登记 TD-16-17。
- **非债／已裁定 3 笔**（markdownImages／VideoProcessNode 文件名兜底／aspectRatio+UPLOAD_DIRS），留痕防下一轮 AI 重审。
- DATAFLOW 该链路（§15.1／§三 assetType）现状与代码一致，**无需改现状图**（已对账一致）。

## 五 · 覆盖度表（本轮实证文件）

| 文件 | 层 | 覆盖状态 | 灯 | 轮次/日期 | 证据 | 债/裁定 |
| --- | --- | --- | --- | --- | --- | --- |
| `base/utils/assetType.ts` | L0 地基 | 深审 | 🟢 | 本轮 09-16 | 15 fan-in；红线禁内联判型 | 非债(SSOT 已饱和) |
| `nodes/ImageBoxNode.tsx` | 上层(消费) | 深审 | 🔴(有债待还) | 本轮 09-16 | :268/341/371 内联判型绕过 assetType，无注释 | 有债待还(TD-16-17) |
| `panels/markdownImages.ts` | 上层 | 深审 | 🟢 | 本轮 09-16 | :30 内联系 TD-16-7 已裁定有意设计 | 已裁定非债 |
| `nodes/VideoProcessNode.tsx` | 上层 | 抽审 | ⚪→🟢 | 本轮 09-16 | :343 已走 classifyAssetUrlKind；:145 仅文件名兜底 | 非债(观察) |
| `nodes/*`（aspectRatio/UPLOAD_DIRS 使用方） | 上层 | 抽审 | 🟢 | 本轮 09-16 | 正确委托 imagePixel/uploadDirs | 非债 |

## 七 · 状态（机器生成源 · 改此即改 index.md）

- 区域 16 utils 工具层：**有债待还**（本轮新增 TD-16-17，母体 M-A 漏网）→ 🔴
- 区域 04 画布／节点：@见 16 区 TD-16-17（ImageBoxNode 症状，债 ID 绑根因区 16）
- 区域 19 UI 基础组件层：markdownImages 已裁定非债，状态不变
