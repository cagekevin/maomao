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

## 六 · 结论

**母体债 TD-08-17**：后端「ext→类别」无单一真值源，`RESCAN_FILE_TYPE` 与 `CATEGORY_BY_EXT` 各自手抄、彼此漂移，且无机器闸防回潮——典型 SSOT 第二份（本仓最高频形态之一，今日 16 区同源债 TD-16-4~12 已在前端坐实）。

**症状债 TD-08-18（高利息，核心链路）**：`RESCAN_FILE_TYPE` 严格是 `CATEGORY_BY_EXT` 子集，漏 `wmv/aac/opus/json/csv/xml/html/css/log` 等 ≥9 扩展名。这些文件经 rescan 入库时 `extToFileType` 返回 null → resources.ts:348 `|| 'image'` **静默误判为图片**：`.wmv` 视频、`.aac`/`.opus` 音频、`.json` 文本均被当成图片 → 破图/无法播放/无文本渲染，且与 admin 端点对同文件类别判定矛盾（如 `.m4a` 在 rescan 为 audio、在 admin 为「其他」；`.wmv` 在 rescan 为 image、在 admin 为视频）。**一收全消**：把 rescan 的类别查表统一到 `CATEGORY_BY_EXT`（或其上位真值源）即可同时消灭漏同步与口径错位两类症状。

同源已对齐点（`mime.ts` SSOT、`JIMP_MIME_BY_EXT` 域专用收口、`resolveLocalImages` 委托）判非债、维持现状；本轮不重审。

## 七 · 状态

- 本区域状态：**已验证(有债待还)**（本轮新增 TD-08-17、TD-08-18；08 区原「已验证(无债)」由本轮回退为「已验证(有债待还)」——此前 16 债全结清但漏扫后端 ext→类别 真值源分裂；建议还债后回「已验证(无债)」）

## 覆盖度表（本轮实证文件）

| 文件 | 层 | 覆盖状态 | 灯 | 轮次/日期 | 证据 | 债/裁定 |
| --- | --- | --- | --- | --- | --- | --- |
| `localTool/src/utils/mime.ts` | 地基 | 深审 | 🟢 | 本轮 09-16 | `EXT_TO_MIME:23` 为官方 SSOT（仅缺 wmv，随母体补） | 非债(SSOT本身) |
| `localTool/src/routes/resources.ts` | 后端 | 有债待还(TD-08-17/18) | 🔴 | 本轮 09-16 | `RESCAN_FILE_TYPE:24-51`；`extToFileType:53`；`:348 \|\| 'image'` | 有债待还(TD-08-17/18) |
| `localTool/src/routes/admin.ts` | 后端 | 有债待还(TD-08-17/18) | 🔴 | 本轮 09-16 | `CATEGORY_BY_EXT:221-252`；`categoryOf:253` | 有债待还(TD-08-17/18) |
| `localTool/src/utils/fileStore.ts` | 后端 | 已裁定非债 | 🟢 | 本轮 09-16 | `JIMP_MIME_BY_EXT:281-288`；文件头:262-280 域专用·TD-02-41收口 | 非债(有意设计) |
| `localTool/src/utils/resolveLocalImages.ts` | 后端 | 已裁定非债 | 🟢 | 本轮 09-16 | `:60 \|\| 'png'` 兜底委托 `jimpMimeForExt`（域专用） | 非债 |
