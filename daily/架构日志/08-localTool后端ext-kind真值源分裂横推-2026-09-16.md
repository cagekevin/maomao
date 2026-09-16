# 08-localTool 后端 ext→kind 真值源分裂横推（2026-09-16）

> **触发**：用户要求「从历史已有债务深入推导，未登记 没有被发现的债务」。
> **方法**：取本仓最高频母体「`assetType`／`EXT_KIND`／`mime` 真值源分裂」（今日 16 区 TD-16-4~12 已横扫**前端 src 侧**内联绕行），反推后端 localTool 是否同样存在「扩展名→媒体类别」多份手写表、且不委托 `mime.ts` SSOT；自底向上取证（grep 检测信号 → 读真实表 → 比对覆盖度）。
> **结论一句话**：localTool 后端「ext→媒体类别」真值源分裂为 `RESCAN_FILE_TYPE`(resources.ts:24) 与 `CATEGORY_BY_EXT`(admin.ts:221) 两份手写表，互不委托 `mime.ts EXT_TO_MIME`(23)／前端 `assetType EXT_KIND`，无机器闸已漂移；`RESCAN_FILE_TYPE` 为 `CATEGORY_BY_EXT` 真子集，漏 `wmv/aac/opus/json/csv/xml/html/css/log` 等 ≥9 扩展名，经 `extToFileType`(53) 返回 null 后 resources.ts:348 `|| 'image'` **静默误判为图片**。共 1 母体债（TD-08-17）+ 1 症状债（TD-08-18，高利息）；`JIMP_MIME_BY_EXT` 域专用已收口判非债。

---

## 一 · 链路快照（本轮实证 · grep / refs）

- `localTool/src/utils/mime.ts:23` `EXT_TO_MIME` —— 后端官方 SSOT（ext↔MIME，含 png/webp/gif/bmp/tiff/svg/avif + mp4/webm/mov/avi/mkv/m4v/flv + mp3/wav/m4a/flac/ogg），**只做 ext↔MIME，不含「类别/kind」维度**。
- `localTool/src/routes/resources.ts:24-51` `RESCAN_FILE_TYPE: Record<string,string>` —— **第二份**手写「ext→类别」表（image/video/audio/text），仅被 `extToFileType`(53) 查表，缺省走 resources.ts:348 `|| 'image'`。
- `localTool/src/routes/admin.ts:221-252` `CATEGORY_BY_EXT: Record<string,string>` —— **第三份**手写「ext→类别」表（图片/视频/音频/文本），被 `categoryOf`(253) 查表，缺省 `|| '其他'`。
- `refs resources.ts`：模块 0 import 引用，字符串残留 74 处；`/api/resources/rescan` 被 `localToolApi.ts:204` 调用、前端 `resourceStore`/`resourcesApi`/`ScriptBoxAssetPicker` 消费 → **rescan 端点活**，债非死代码。
- `CATEGORY_BY_EXT` 被 `admin.ts:313`(`categoryOf(f.name)`)、`:348`(`.map(...category: categoryOf(f.name))`) 调用 → **admin 文件清单活**。

## 二 · 溯源（母体来自现有债）

| 母体 | 现有债先例 | 本轮落点 |
| --- | --- | --- |
| ext/mime/kind 真值源分裂（SSOT 第二份） | 16 区 TD-16-4~12（前端 `assetType` 被 `creativeCatalog`/`scriptBoxEngine`/`media-utils`/`imageCompress` 等内联绕过） | 后端 localTool 内部 `RESCAN_FILE_TYPE`/`CATEGORY_BY_EXT` 两份并行，且**彼此**不一致 |
| 静默吞／失败伪装成功（兜底误判） | 16 区 TD-16-10（`processing.ts` 二进制兜底静默归位） | `extToFileType(... ) || 'image'`（resources.ts:348）未知扩展静默当图片 |

> 今日 16 区轮次（媒体类型SSOT横推复查／扩展名真值源横向推导／绕assetType内联类型判定横展）均聚焦 **src 前端**，后端 localTool 的「类别」维度从未被系统横扫（debt 搜 `rescan`/`RESCAN_FILE_TYPE`/`CATEGORY_BY_EXT`/`jimpMimeForExt`/`extToFileType` 全 0 命中）→ 确属未登记。

## 三 · 定海（应守的不变量）

全库「扩展名→媒体类别」应只有**一份真值源**（`mime.ts EXT_TO_MIME` 派生 kind，或前端 `assetType EXT_KIND` 经共享模块）；其余查表，**禁手写第二份**，且新增/修正扩展名只改一处、其余自动派生（机器闸防回潮）。

## 四 · 切割（在哪破 / 不归本区）

- **破点 1（母体）**：`RESCAN_FILE_TYPE`(resources.ts:24) 与 `CATEGORY_BY_EXT`(admin.ts:221) 两份手写「ext→类别」表并行维护，互不委托 `mime.ts`／`assetType`，无机器闸。
- **破点 2（症状）**：`RESCAN_FILE_TYPE` 为 `CATEGORY_BY_EXT` 真子集（后者含前者全部 + `wmv/aac/opus/ico/json/csv/xml/html/css/log`）。漏网扩展名经 `extToFileType`(53) 返回 null → resources.ts:348 `|| 'image'` **静默误判为图片**；且同文件在 rescan 端点与 admin 端点拿到不同类别（口径错位）。
- **对照（已对齐／非债）**：
  - `fileStore.ts JIMP_MIME_BY_EXT`(281-288)：文件头(262-280)明确「2026-09-16 收口 TD-02-41、域专用 Jimp 编码器能力表、有意设计、不并入 mime.ts」→ **非债**，不重审。
  - `resolveLocalImages.ts:60` `|| 'png'` 兜底 + `jimpMimeForExt`：委托域专用 `JIMP_MIME_BY_EXT`，try/catch 兜底，属图像预处理预期行为 → **非债**。
  - `mime.ts EXT_TO_MIME` 本身为 SSOT，仅缺 `wmv`（随母体一并补），不单列债。

## 五 · 探债（债明细）

| TD-ID | 决策点 / 问题点 | 归类 | 归属 | 爆炸半径 | 利息率 | 根因 | 偿还计划 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TD-08-17 | localTool 后端「ext→媒体类别」真值源分裂为 RESCAN_FILE_TYPE(resources.ts:24) 与 CATEGORY_BY_EXT(admin.ts:221) 两份手写表，互不委托 mime.ts EXT_TO_MIME(23)／前端 assetType EXT_KIND；无机器闸致已漂移（见 TD-08-18） | 增债 | 结构债 | 资源库类型误判、资源面板/播放器错配、同文件两端类别不一致 | 中 | M1-后端ext-kind真值源分裂（SSOT第二份+无机器守卫） | 建后端唯一 ext→kind 表（或委托前端 assetType EXT_KIND 经共享模块），两表改查表+统一兜底语义；补机器闸防回潮 | 待还 |
| TD-08-18 | RESCAN_FILE_TYPE(resources.ts:24-51) 为 CATEGORY_BY_EXT(admin.ts:221-252) 真子集，漏 wmv/aac/opus/json/csv/xml/html/css/log 等≥9扩展名；经 extToFileType(53) 返回 null 后 resources.ts:348 `|| 'image'` 静默误判为图片；且与 admin 对同文件类别判定矛盾 | 增债 | 结构债 | .wmv视频/.aac/.opus音频/.json文本入库变 image→破图/无法播放/无文本渲染 | 高 | M1-后端ext-kind真值源分裂（第二份+漏同步，母体症状） | RESCAN_FILE_TYPE 改查统一 ext→kind 表（含全套扩展名）或显式委托 CATEGORY_BY_EXT；兜底从 `|| 'image'` 改为未知→需派生/标记而非默认图片 | 待还 |
| TD-08-21 | files.ts:364 `imageExts=['.png','.jpg','.jpeg','.webp','.gif','.bmp','.svg']` 内联图片扩展名白名单，绕过同文件已引入的SSOT `isJimpEncodableExt`(line23引入／line447已用于format判据)；属ext→媒体能力真值源第二份，且比SSOT多含webp/svg(Jimp 0.22不可编码)→tryGenerateThumbnail对已含webp/svg的源做必然失败的resizeImage尝试(浪费)；与line447判据不一致，未来JIMP_MIME_BY_EXT扩表时此列表不自动同步(继续漂移) | 增债 | 结构债 | 缩略图路径对webp/svg做必败resize(浪费+延迟)＋与同文件line447判据双真相源，新扩展名只改SSOT不.sync此列表 | 中 | M1-后端ext-kind真值源分裂（SSOT第二份+无机器守卫） | 删除imageExts常量，tryGenerateThumbnail改为 `if(!isJimpEncodableExt(ext.replace(/^\./,''))) return null`；注释钉死禁内联扩展名白名单(与fileStore.ts:278消费方约定一致) | 待还 |

## 六 · 结论

**母体债 TD-08-17**：后端「ext→类别」无单一真值源，`RESCAN_FILE_TYPE` 与 `CATEGORY_BY_EXT` 各自手抄、彼此漂移，且无机器闸防回潮——典型 SSOT 第二份（本仓最高频形态之一，今日 16 区同源债 TD-16-4~12 已在前端坐实）。

**症状债 TD-08-18（高利息，核心链路）**：`RESCAN_FILE_TYPE` 严格是 `CATEGORY_BY_EXT` 子集，漏 `wmv/aac/opus/json/csv/xml/html/css/log` 等 ≥9 扩展名。这些文件经 rescan 入库时 `extToFileType` 返回 null → resources.ts:348 `|| 'image'` **静默误判为图片**：`.wmv` 视频、`.aac`/`.opus` 音频、`.json` 文本均被当成图片 → 破图/无法播放/无文本渲染，且与 admin 端点对同文件类别判定矛盾（如 `.m4a` 在 rescan 为 audio、在 admin 为「其他」；`.wmv` 在 rescan 为 image、在 admin 为视频）。**一收全消**：把 rescan 的类别查表统一到 `CATEGORY_BY_EXT`（或其上位真值源）即可同时消灭漏同步与口径错位两类症状。

同源已对齐点（`mime.ts` SSOT、`JIMP_MIME_BY_EXT` 域专用收口、`resolveLocalImages` 委托）判非债、维持现状；本轮不重审。

**补遗（独立复扫发现）**：原覆盖度表漏列 `localTool/src/routes/files.ts`，其缩略图路径仍藏「ext→媒体能力」第二份真相源——`tryGenerateThumbnail`(364) 的 `imageExts` 内联白名单，而同文件 line23 已引入、line447 已使用 SSOT `isJimpEncodableExt`。该列表比 SSOT 多含 `webp/svg`（Jimp 0.22 不可编码），对已含这两类的源必然走一次失败 `resizeImage`；且与 line447 判据形成双真相源，未来 `JIMP_MIME_BY_EXT` 扩表时此列表不同步→继续漂移。已登记 **TD-08-21**（中利息·结构债·收敛到 `isJimpEncodableExt`）。
同轮对后端其余扩展名/ MIME 处理点复扫并裁定：
- ~~`ai-relay/providers/lovart/lovart_attachments.ts` 的 `extFromDataHeader/extFromContentType` 手抄 mime→ext＋`return 'png'` 兜底看似 SSOT 第二份，但其文件头明承「照抄外部 `main.py` 1:1 镜像、跟 main 一模一样」——属**有意设计·外部对齐**，非本仓漂移，判**非债**（避免下个 AI 误当债补）；~~
  > **⚠️ 本判非债已推翻（2026-09-16 同名日后续轮 · TD-08-22，见
  > [08-跨区-lovart附件扩展名推断绕过mime真源-2026-09-16](08-跨区-lovart附件扩展名推断绕过mime真源-2026-09-16.md)）**：
  > 「照抄 main」是真的，但**照抄了一个有缺陷的实现 ≠ 有意设计**。实测（复核脚本）：
  > `audio/aac`·`ogg`·`flac`·`wma`·`opus` 因 `includes('audio')` **全错归 `.mp3`**、`video/mpeg` 错归 `.mp3`、
  > `image/avif`/`svg` 静默兜底 `.png` —— 客观缺陷，且会让 Lovart 按错格式解析。
  > **教训**：「外部对齐」只在**该行为本身正确**时才构成豁免；否则它只是**把 bug 的来源从本仓搬到 upstream**。
  > **本判已按 A7 就地回改**（留痕对比，而非只在新文档记修正表）。
- `index.ts` 的 `FRONTEND_MIME`/`mimeMap` 是前端应用静态资源(wasm/ico/woff2)服务用 content-type，语义≠用户媒体 ext→kind，独立关切，判**非债**；
- `files.ts:446` `srcExt = ... || 'png'` 输出扩展名缺省兜底（源无扩展名时落 png），属输出默认值、语义可接受，标为**低优先观察、不单列债**。

## 七 · 状态

- 本区域状态：**已验证(无债)**（本轮发现的 TD-08-17/18/21 已结清，详见下方「同日后续轮」段）

> **【已结清 · 2026-09-16 同日后续轮】** TD-08-17 / TD-08-18 / **TD-08-21** 已随
> [16-跨区-媒体类型判定与URL提取真值源收口-2026-09-16](16-跨区-媒体类型判定与URL提取真值源收口-2026-09-16.md)
> 结清：删 `RESCAN_FILE_TYPE` + `CATEGORY_BY_EXT` 两张手抄表、建 `mime.extToKind` 唯一真源、兜底改 `'other'`；
> TD-08-21 的 `tryGenerateThumbnail` 内联 `imageExts` 白名单（多含 webp/svg，Jimp 不可编码）→ 委托 `isJimpEncodableExt`。
> 同轮另结清 TD-08-16（URL 未剥 `?#`）· TD-08-20（下载名漏 decode）。
> 同轮另补 **TD-08-22**（lovart_attachments 内联子串链 → 委托 `mimeToExt` + 后端对等闸 13-b）与
> **TD-08-19**（跨栈 `MAX_SEND_DIM` 对账闸 14）。⇒ **08 区待还债清零，可回「已验证(无债)」**。

## 覆盖度表（本轮实证文件）

| 文件 | 层 | 覆盖状态 | 灯 | 轮次/日期 | 证据 | 债/裁定 |
| --- | --- | --- | --- | --- | --- | --- |
| `localTool/src/utils/mime.ts` | 地基 | 深审 | 🟢 | 本轮 09-16 | `EXT_TO_MIME:23` 为官方 SSOT（仅缺 wmv，随母体补） | 非债(SSOT本身) |
| `localTool/src/routes/resources.ts` | 后端 | 有债待还(TD-08-17/18) | 🔴 | 本轮 09-16 | `RESCAN_FILE_TYPE:24-51`；`extToFileType:53`；`:348 \|\| 'image'` | 有债待还(TD-08-17/18) |
| `localTool/src/routes/admin.ts` | 后端 | 有债待还(TD-08-17/18) | 🔴 | 本轮 09-16 | `CATEGORY_BY_EXT:221-252`；`categoryOf:253` | 有债待还(TD-08-17/18) |
| `localTool/src/utils/fileStore.ts` | 后端 | 已裁定非债 | 🟢 | 本轮 09-16 | `JIMP_MIME_BY_EXT:281-288`；文件头:262-280 域专用·TD-02-41收口 | 非债(有意设计) |
| `localTool/src/utils/resolveLocalImages.ts` | 后端 | 已裁定非债 | 🟢 | 本轮 09-16 | `:60 \|\| 'png'` 兜底委托 `jimpMimeForExt`（域专用） | 非债 |
| `localTool/src/routes/files.ts` | 后端 | 有债待还(TD-08-21) | 🔴 | 补遗 09-16 | `:364 imageExts` 内联白名单；`:23/447` 已引入并用SSOT `isJimpEncodableExt` | 有债待还(TD-08-21) |
| `localTool/src/ai-relay/providers/lovart/lovart_attachments.ts` | 后端 | 已解决(TD-08-22) | 🟢 | 补遗 09-16 → **后续轮推翻** | ~~非债(外部对齐)~~ → 实为客观缺陷（includes 漏判）→ 已收口 `mimeToExt` | **债·已解决(TD-08-22)** |
| `localTool/src/index.ts` | 后端 | 已裁定非债 | 🟢 | 补遗 09-16 | `FRONTEND_MIME`/`mimeMap` 为前端应用静态资源(wasm/ico/woff2)服务用 content-type，语义≠用户媒体 ext→kind，独立关切 | 非债 |
