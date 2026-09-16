# 16-跨区-消费层资产 URL 判型绕过 assetType 漏网（2026-09-16）

> **后续（2026-09-17）**：本文所立 **TD-16-17 / TD-16-18 / TD-16-20**（ImageBoxNode · AgentPanel · AssetNode 手写判型）**已解决**；**TD-16-19**（type→ext 逆映射）取证后**改判非债**（grep 未命中所述形态）—— @见 `18-跨区-地基单源第二份收口-clamp-idGen-deepClone-判型-2026-09-17`。
>
> **触发**：用户要求「仔细看看，还有哪些是应该收口到底层的东西，但是却落在了消费层或者抽象层」。
> **方法**：自底向上核对 2026-09-16「媒体类型判定与 URL 提取真值源收口」母体（TD-16-4..14）的收口覆盖率，用 `refs` + `grep` 验证消费层是否已统一走 `base/utils/assetType.ts` 单一判型入口；重点查漏网（URL 与 File 两个入口都查，并扩扫其它底层唯一真值源）。
> **结论一句话**：该母体号称「一收全消」，但 **① ImageBoxNode 三处手写 `startsWith('http')||startsWith('data:image')` 绕过 `assetType.isAssetUrl`／`classifyAssetUrlKind`**；**② ImageBoxNode:296/329 与 AgentPanel:1055 用 `f.type.startsWith('image/')` 绕过 `assetType.detectFileType`**（判型入口从 URL 换成 File）；**③ AssetNode:233 用 `detectAssetType(f.name)+内联 f.type.startsWith('text/')` 拼装文本判型、未走统一 `detectFileType(f)`**——三处都是漏网的同母体残债；其余消费层（markdownImages／VideoProcessNode／aspectRatio／UPLOAD_DIRS／provider／formatBytes／genErrors／refToken／previewUrl／assetUrl／externalizeInline／dataUrlToBlob／idGen／日期格式化／URL query 剥离）已正确委托或已裁定非债。

---

## 一 · 链路快照（本轮实证 · refs / grep）

- `base/utils/assetType.ts` ← **15 处模块 import**（refs 实证）：filesApi／nodeMedia／creativeCatalog／GeneratedView／ResourceLibrary／resourceStore／imageCompress／director3d/project／**AssetNode**／**VideoProcessNode**／markdownImages／scriptBoxEngine／useAssetDropPaste／useConnectedInputs／mediaType.test。**关键：`nodes/ImageBoxNode.tsx` 与 `panels/AgentPanel.tsx` 不在其 fan-in 中**（grep 二者 import 仅含 asyncGuard／assetUrl／filesApi 等，无 assetType）。`AssetNode` 虽 import 了 `detectAssetType`（文件名/URL 分类器），但**从不 import 也不调用 `detectFileType`（文件分类器）**。
- `assetType.ts` 文件头红线：「禁止再就地手写 `\.(mp4|webm…)$` 正则；此前 5 处各写一份已漂移出三类不一致（ogg 归属相反／ogv·oga·opus 漏认／`a.mp4?token=1` 误判 image）」。单一真值源 = `isAssetUrl`(:119) + `classifyAssetUrlKind`(:54) + `detectFileType`(:86，File→kind，mime 优先+扩展名兜底) + `detectAssetType`(:71，URL/文件名→kind) + `isAudio`(:132)。
- **ImageBoxNode 三处 URL 内联判型**（绕过 `isAssetUrl`/`classifyAssetUrlKind`，无注释固化理由）：
  - `nodes/ImageBoxNode.tsx:268`：`img.url.startsWith('http') || img.url.startsWith('data:image')`（上游连线取图判型）
  - `nodes/ImageBoxNode.tsx:341`：`text.startsWith('http') || text.startsWith('data:image/')`（粘贴 URL 判型）
  - `nodes/ImageBoxNode.tsx:371`：`text.startsWith('http') || text.startsWith('data:image/')`（拖拽 URL 判型）
- **ImageBoxNode 两处 + AgentPanel 一处 File 内联判型**（绕过 `detectFileType`，无注释固化理由）：
  - `nodes/ImageBoxNode.tsx:296`：`Array.from(files).filter((f) => f.type.startsWith('image/'))`（拖入文件过滤）
  - `nodes/ImageBoxNode.tsx:329`：`.filter((it) => it.kind === 'file' && it.type.startsWith('image/'))`（粘贴文件过滤）
  - `panels/AgentPanel.tsx:1055`：`if (!f.type.startsWith('image/')) continue;`（Skill 导入附件过滤）
- **AssetNode 一处 File 判型半绕过**（已 import 模块但用错入口）：
  - `nodes/AssetNode.tsx:233`：`if (f.type.startsWith('text/') || detectAssetType(f.name) === 'text')`（文件输入判文本）→ 等价于 `detectFileType(f) === 'text'` 却不直接调用。

## 二 · 溯源（母体 = 2026-09-16 收口的「媒体类型判定与 URL 提取真值源收口」）

| 母体 | 既有收口 | 本轮缺口 |
| --- | --- | --- |
| M-A 资产／图片 URL 判型 SSOT 第二份 | TD-16-4..14（creativeCatalog／scriptBoxEngine／director3d／markdownImages／media-utils／processing／resources／imageCompress）已「母体一收全消」 | **ImageBoxNode（消费层节点）未被纳入该母体扫描**，残留 3 处 URL 内联判型 |
| M-A 资产／图片 File 判型 SSOT 第二份 | 同上（`detectFileType` 入口，resourceStore／filesApi／scriptBoxEngine／processing／director3d 等 6 处已正确 import） | **ImageBoxNode:296/329 + AgentPanel:1055 完全绕过**；**AssetNode:233 半绕过（用 detectAssetType+内联 mime 代替 detectFileType）** |

> 该母体收口轮以「消费层／utils 内联正则」为清扫对象，而 ImageBoxNode/AgentPanel/AssetNode 用的是 `startsWith` 字面量组合（非正则），且同时出现在 URL 与 File 入口、甚至出现「用错 canonical 函数+内联片段」形态 → 漏检。属「收口轮的形态盲点」，非新机制。

## 三 · 探债（逐文件结论 + 证据）

### 1 · ImageBoxNode 三处 URL 判型绕过单一判型入口 —— 债（母体漏网，结构债）
- **五问**：① 同一真相抄成 ≥2 份？是——`isAssetUrl`+`classifyAssetUrlKind` 已是真值源，ImageBoxNode 又手写一份「http／data:image 即图」判型。② 绕过唯一入口？是（fan-in 14 个消费点都走 assetType，唯 ImageBoxNode 不走）。③ 静默吞错？否。④ 死代码？否。⑤ 注释与实现一致？否——与 assetType 文件头红线直接冲突，且无任何注释说明为何单独写。
- **口径错位（潜在）**：`isAssetUrl` 含 `blob:`，ImageBoxNode 内联判型不含 `blob:`，与真值源在「blob 是否算资产 URL」上口径不一致。实测 `classifyAssetUrlKind(blob:…)` 因无扩展名返回 null → 不是 image，故**当前无行为 bug**；但这是「副本碰巧与真值源同结论」，一旦 assetType 的 image 判据演进，ImageBoxNode 不跟随 → 回潮风险。
- **根因**：属 M-A（资产／图片 URL 判型 SSOT）母体残漏，与 TD-16-4..14 同源。
- **归属**：结构债（纯收口，无业务决策）。
- **偿还计划（本流程不执行）**：ImageBoxNode 三处改为 `isAssetUrl(url) && classifyAssetUrlKind(url) === 'image'`（从 `base/utils/assetType.ts` 引入）；如确需排除 `blob:` 等临时协议，应在 canonical 层统一表达一次，而非消费层各写一份。可选：在 `check:arch` 加「禁止内联 `startsWith('http')||startsWith('data:image')` 资产 URL 判型」机器闸防复发。

### 1.1 · ImageBoxNode/AgentPanel 文件判型绕过 detectFileType —— 债（母体漏网，结构债）
- **五问**：① 同一真相抄成 ≥2 份？是——`detectFileType` 已是 File→kind 真值源（resourceStore／filesApi／scriptBoxEngine／processing／director3d 等 6 处均 import 它），ImageBoxNode 与 AgentPanel 又手写 `f.type.startsWith('image/')`。② 绕过唯一入口？是（ImageBoxNode 全文件无 assetType import；AgentPanel 亦然）。③ 静默吞错？**是——口径错位**：`f.type.startsWith('image/')` 只看 mime，漏「无 mime 但扩展名是图片」的文件（如 `.png` 但 `type===''`），而 `detectFileType` 是 mime 优先 + EXT_KIND 全表兜底 → 前者更严，会**误拒**后者接受的图片附件。④ 死代码？否。⑤ 注释与实现一致？否——与 assetType 文件头红线冲突，且无注释说明。
- **根因**：同属 M-A（资产／图片类型判型 SSOT）母体残漏，与 §三.1 的 URL 入口同源、与 TD-16-4..14 同源。
- **归属**：结构债（纯收口，无业务决策）。
- **偿还计划（本流程不执行）**：三处改为 `detectFileType(f) === 'image'`（从 `base/utils/assetType.ts` 引入）。`detectFileType` 入参只需 `{name,type}`，`File`／`DataTransferItem` 天然满足，无需改调用形态。

### 1.2 · AssetNode 文件判型半绕过 detectFileType —— 债（母体漏网，milder）
- **现象**：`nodes/AssetNode.tsx:233`：`if (f.type.startsWith('text/') || detectAssetType(f.name) === 'text')`。它**已 import `detectAssetType`**（:19），但用的是「URL/文件名分类器 `detectAssetType` + 内联 `f.type.startsWith('text/')`」拼出文本判型，而非统一的文件分类器 `detectFileType(f)`。
- **五问**：① 同一真相抄成 ≥2 份？是——`detectFileType`（:86）已是 mime-first + 扩展名兜底的文件分类真值源，AssetNode 却把其中「mime 是否 text」片段（`detectFileType:92` 的 `mime.startsWith('text/')`）手写一份，再用 `detectAssetType(f.name)` 补扩展名口径，等价于 `detectFileType(f) === 'text'` 却不直接调用。② 绕过唯一入口？是（AssetNode 全文件只 import `detectAssetType`，从不调用 `detectFileType`；File 输入本应走 `detectFileType`）。③ 静默吞错？**否——当前功能等价**：`f.type.startsWith('text/') || detectAssetType(f.name)==='text'` 与 `detectFileType(f)==='text'` 在所有分支同结论（mime 优先 + 扩展名兜底）。④ 死代码？否。⑤ 注释与实现一致？未固化理由——:251 注释只说「assetType 交由 detectAssetType 由 URL 判断」，未解释为何 File 输入不统一走 `detectFileType`。
- **根因**：同属 M-A（资产／图片类型判型 SSOT）母体残漏；与 TD-16-17/18 同源，但 milder（已用模块、只是用错入口函数 + 内联 mime 片段）。
- **归属**：结构债（纯收口，无业务决策）。
- **偿还计划（本流程不执行）**：`AssetNode.tsx:233` 改为 `if (detectFileType(f) === 'text')`（从 `base/utils/assetType.ts` 引入 `detectFileType`），删掉内联 `f.type.startsWith('text/')` 与 `detectAssetType(f.name)` 拼装。

### 2 · markdownImages.looksLikeImageUrl —— 非债（已裁定，留痕防重审）
- `panels/markdownImages.ts:30` 仍有 `if (u.startsWith('data:')) return u.startsWith('data:image/');`，看似第二副本，但 TD-16-7 已裁决：本函数与 `assetType.isAssetUrl` **契约不同**（消息渲染域「是否当图渲染」需排除网页后缀／临时协议），已改名 `looksLikeImageUrl` 消歧，且 :33 已委托 `classifyAssetUrlKind` 作「扩展名是否图片」真值源。属**有意设计 + 注释已固化** → 非债（与本轮母体同根但已闭环）。
- **证据**：markdownImages.ts:12-17 文件头裁定 + TD-16-7 已解决。

### 3 · VideoProcessNode.nameFromUrl —— 非债（观察，不登记）
- `nodes/VideoProcessNode.tsx:145-146`：`data:`→`'video.mp4'`、`blob:`→`'local-video.mp4'` 是「无文件名时的默认展示名」兜底，属文件名启发式而非媒体判型；当前无 canonical「按 kind 默认文件名」表，行为正确。**注意** :343 已正确走 `classifyAssetUrlKind(u) === 'video'`，仅文件名兜底段内联，不构成 SSOT 第二份 → 非债。若将来抽象「默认文件名表」可一并收口，但本轮不登记。

### 4 · aspectRatio／UPLOAD_DIRS／provider／formatBytes —— 非债（已正确委托或无内联）
- 节点层 `aspectRatio` 仅作 `node.data` 字符串透传（如 `'16:9'`／`'1:1'`／`'Auto'`），像素换算真值在 `imagePixel.ts` 的 `RATIO_PIXEL_TABLE`；上传子目录统一走 `UPLOAD_DIRS`（VideoProcessNode:53／AssetNode:28 均 `import { UPLOAD_DIRS } from '../base/utils/uploadDirs.ts'`）；provider URL 适配（`providerUrlAdapters`／`providerModels.resolveProviderModel`）在节点层正确委托（VideoGenerate／ImageGenerate／TextGenerate 均 import `resolveProviderModel`）；`formatBytes` 仅在 `base/core/utils.ts:290` 定义一处，StorageMonitor／VideoProcessNode:42 均正确 import → 无第二份。
- **证据**：grep `imagePixel|RATIO_PIXEL|UPLOAD_DIRS|subfolder|providerUrlAdapters|resolveProviderModel|formatBytes` 全仓仅消费方引用，无内联表／副本。

### 5 · genErrors／refToken／previewUrl／assetUrl／externalizeInline／dataUrlToBlob／idGen／日期格式化／URL query 剥离 —— 非债（已正确收口）
- **genErrors**：`classifyError` 是错误→类型单一入口；消费层用 `isTimeoutError`／`e instanceof HttpError` 等类型分支（VideoProcessNode:1218／DepthVideoModal:435／projectStore:461／service.ts:208），全仓 grep 已无 `if(/网络错误/)` 之类内联关键词判型（仅 genErrors 自身向后兼容识别 `message.startsWith('网络错误')`）→ 既有的「节点自写 if(/网络错误/)」泄漏已由本模块收口，非本轮新债。
- **refToken**：`encodeRefToken`／`parseRefTokensFromText` 是参考图 token 编解码唯一入口，agent 层正确引用；节点层出现的 `data-ref-id` 是 prompt 芯片 DOM 属性，与 refToken 无关。
- **previewUrl**：`previewUrls.create/release` 是预览 URL 生命周期唯一入口，VideoExtractNode／VideoProcessNode／FaceMosaicNode 均正确 import 使用，无内联构造。
- **assetUrl／toAbsoluteFileUrl**：`/files/` URL 仅在 base 底层（`base/core/utils.ts`、`assetUrl.ts`）与已委托的 `agentAttachments.ts:42` 出现，节点层 0 处内联拼 `/files/`；节点层 URL query 剥离（split('?')/replace）0 处。
- **externalizeInline**：`externalizeInlineData` 是 dataURL→本地 URL 外置唯一入口（文件头写明「从 App.jsx 抽出」），无节点层内联副本。
- **dataUrlToBlob**：仅在 `base/core/utils.ts:106` 定义一处，FaceMosaicNode 从 base 引入，无多文件副本。
- **idGen**：节点层内联 `Math.random()/Date.now()` 生成 ID 仅 `_template/TemplateNode.tsx:525` 一处且位于模板注释示例，非真实消费层泄漏。
- **日期格式化**：节点层仅 VideoProcessNode:128 一处 `padStart(2,'0')` 时间戳拼接，无 canonical 时间工具被绕过（亦无重复副本）。

## 四 · 结论

本轮聚焦「应落底层（assetType 单一判型入口）却落在消费／抽象层」的残债，并扩扫其它底层唯一真值源：
- **发现 3 笔结构债（同母体 M-A）**：
  1. **URL 入口**（TD-16-17）：ImageBoxNode 三处 `startsWith('http')||startsWith('data:image')` 绕过 `isAssetUrl`/`classifyAssetUrlKind`。
  2. **File 入口·全绕过**（TD-16-18）：ImageBoxNode:296/329 + AgentPanel:1055 `f.type.startsWith('image/')` 绕过 `detectFileType`（且会误拒无 mime 的图片文件）。
  3. **File 入口·半绕过**（TD-16-20）：AssetNode:233 用 `detectAssetType(f.name)+内联 f.type.startsWith('text/')` 拼文本判型，未走统一 `detectFileType(f)`（当前功能等价，但绕开文件分类唯一入口，回潮风险）。
  - 三者均母体 M-A 漏网，TD-16-4..14 收口轮因「只扫内联正则、漏扫 startsWith 字面量 + 跨 URL/File 两入口 + 漏扫『用错入口函数』形态」而漏检。
- **非债／已裁定 5 笔**（markdownImages／VideoProcessNode 文件名兜底／aspectRatio+UPLOAD_DIRS+provider+formatBytes／genErrors+refToken+previewUrl+assetUrl+externalizeInline+dataUrlToBlob+idGen+日期格式化+URL query 剥离），留痕防下一轮 AI 重审。
- DATAFLOW 该链路（§15.1／§三 assetType）现状与代码一致，**无需改现状图**（已对账一致）。

## 五 · 覆盖度表（本轮实证文件）

| 文件 | 层 | 覆盖状态 | 灯 | 轮次/日期 | 证据 | 债/裁定 |
| --- | --- | --- | --- | --- | --- | --- |
| `base/utils/assetType.ts` | L0 地基 | 深审 | 🟢 | 本轮 09-16 | 15 fan-in；红线禁内联判型 | 非债(SSOT 已饱和) |
| `nodes/ImageBoxNode.tsx` | 上层(消费) | 深审 | 🔴(有债待还) | 本轮 09-16 | :268/341/371 URL 判型 + :296/329 File 判型均绕过 assetType，无注释 | 有债待还(TD-16-17+TD-16-18) |
| `panels/AgentPanel.tsx` | 上层 | 深审 | 🔴(有债待还) | 本轮 09-16 | :1055 `f.type.startsWith('image/')` 绕过 detectFileType | 有债待还(TD-16-18) |
| `nodes/AssetNode.tsx` | 上层(消费) | 深审 | 🔴(有债待还) | 本轮 09-16 | :233 用 detectAssetType+内联 mime 拼文本判型，未走 detectFileType | 有债待还(TD-16-20) |
| `panels/markdownImages.ts` | 上层 | 深审 | 🟢 | 本轮 09-16 | :30 内联系 TD-16-7 已裁定有意设计 | 已裁定非债 |
| `nodes/VideoProcessNode.tsx` | 上层 | 抽审 | ⚪→🟢 | 本轮 09-16 | :343 已走 classifyAssetUrlKind；:145 仅文件名兜底 | 非债(观察) |
| `nodes/*`（aspectRatio/UPLOAD_DIRS/provider/formatBytes 使用方） | 上层 | 抽审 | 🟢 | 本轮 09-16 | 正确委托 imagePixel/uploadDirs/providerModels/formatBytes | 非债 |
| `base/utils/genErrors,refToken,previewUrl,assetUrl,externalizeInline,dataUrlToBlob` 等 | L0 地基 | 抽审 | 🟢 | 本轮 09-16 | 消费层均正确走 canonical，无内联副本 | 非债(已收口) |

## 七 · 状态（机器生成源 · 改此即改 index.md）

- 本区域状态：**已验证(有债待还)**（本轮新增 TD-16-17 + TD-16-18 + TD-16-20，母体 M-A 资产/图片类型判型收口漏网：URL 入口 ImageBoxNode 三处 + File 入口 ImageBoxNode:296/329、AgentPanel:1055、AssetNode:233 均绕过 assetType 单一入口）
- 区域 04 画布／节点：@见 16 区 TD-16-17/TD-16-18/TD-16-20（ImageBoxNode、AssetNode 症状，债 ID 绑根因区 16）
- 区域 19 UI 基础组件层：AgentPanel 症状 @见 TD-16-18；markdownImages 已裁定非债
