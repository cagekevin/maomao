# 16-跨区·后端 ext→kind 第二份（RESCAN_FILE_TYPE 漂移）· 2026-09-16

> 触发：用户「债务登记 5 步法 · 从历史已有债务深入推导，未登记 没有被发现的债务」。
> 起点：区域 16（utils 工具层）SSOT 第二份母体集群 TD-16-4…12（扩展名/媒体类型判定旁路 assetType / mime 真值源）。
> 本轮从这批已登记母体横向推导到**后端 localTool**，找"不在 TD-16-x 清单里"的同根兄弟债。
> 跨区只开一份（债 ID 绑根因区 16，文件在 08 区 resources.ts，@见 08 区）。

## 一 · 链路快照（自下而上）

```
全库「扩展名 → 媒体类别(kind)」真值源
  ├─ 前端（src）：assetType.ts  EXT_KIND 单表（assetType.ts:29-34） ← 唯一真源
  │    消费方：AssetNode / useAssetDropPaste / resourceStore.detectAssetType（L242 显式委托 detectFileType，✅健康）
  └─ 后端（localTool）：应统一走 mime.ts EXT_TO_MIME（ext→mime 真源，TD-08-5 已收口）
       └─ resources.ts rescan 却自持 RESCAN_FILE_TYPE（ext→kind 表） ← 第二份，未收口
           调用方：rescan 循环（L187-189 if(!type) continue）/ normalizeResourceRecord（L348 || 'image'）
```

## 二 · 溯源（母体）

- M-SSOT 第二份：TD-16-4…12 收口了**前端 src 侧** 9 处内联扩展名/媒体类型映射（creativeCatalog / scriptBoxEngine / director3d/project / markdownImages / media-utils / processing / imageCompress 等）。
- TD-08-5（已解决）收口了**后端 MIME↔ext** 6 处（mime.ts EXT_TO_MIME / mimeToExt 唯一实现）。
- **缺口**：TD-08-5 只覆盖 ext→**mime**；后端 rescan 用的 ext→**kind**（RESCAN_FILE_TYPE）从未被纳入收口，仍是一张手写独立表，与前端真源 `assetType.EXT_KIND` 同源两写、已漂移。

## 三 · 定海（唯一真源 / 契约）

- 前端真源：`src/components/base/utils/assetType.ts:29-34` `EXT_KIND`（video/audio/image/text 四类）。
- 后端真源：`localTool/src/utils/mime.ts` `EXT_TO_MIME`（ext→mime）。kind 应由 mime 类推导（video/→video 等），不应另立一张 ext→kind 字面量表。

## 四 · 切割（实证结果）

| # | 发现 | 实证 | 判定 |
| --- | --- | --- | --- |
| A | `resources.ts:25-51` `RESCAN_FILE_TYPE` 是手写独立 ext→kind 表，与 `assetType.EXT_KIND` 同语义第二份 | 逐键比对（下表）：缺 `avif/tiff`(img) `ogv`(vid) `oga/aac/opus/wma/aiff`(aud) `json/log/csv/srt`(txt)，多 `flv`(vid) | **新债 TD-16-13** |
| B | `resolveLocalImages.ts:38 resolveLocalPath` 用正则 `(\/files\/.*)$` 抓磁盘路径，**不剥 `?`/`#`** | 正则 L35 捕获含 query/fragment；同仓 `relativePathFromFileUrl`(resources.ts:103) 用 `pathname` 剥了 → 后端两兄弟口径矛盾 | 已立债 **TD-08-16**（摘要截断处即 resolveLoc），不重立；本发现佐证 TD-08-16 根因仍活 |
| C | `relativePathFromFileUrl`(resources.ts:103) 用 `new URL(url).pathname` 自动剥 `?#` | 读 L103-114 | **非债**（合规标杆） |

**A 漂移明细（RESCAN_FILE_TYPE vs EXT_KIND）**：

| kind | EXT_KIND（前端真源） | RESCAN_FILE_TYPE（后端） | 缺口 |
| --- | --- | --- | --- |
| image | png/jpg/jpeg/webp/gif/bmp/svg/**avif** | png/jpg/jpeg/webp/gif/bmp/svg | **缺 avif**（tiff 两端皆无，略） |
| video | mp4/webm/mov/mkv/avi/m4v/**ogv** | mp4/webm/mov/avi/mkv/**flv**/m4v | **缺 ogv，多 flv** |
| audio | mp3/wav/ogg/**oga**/m4a/flac/**aac/opus/wma/aiff** | mp3/wav/flac/ogg/m4a | **缺 oga/aac/opus/wma/aiff** |
| text | txt/md/markdown/**json/log/csv/srt** | md/markdown/txt | **缺 json/log/csv/srt** |

**A 伤害实证**：rescan 循环 `extToFileType(ext)` 返回 null → `if (!type) continue`（L188-189）直接跳过该文件，不进素材库；但前端 `assetType.detectFileType` 会认 `.avif/.aac/.ogv/.json` 等 → 同一文件前端判为媒体、后端 rescan 丢弃，**跨端口径错位**。

## 五 · 探债（明细）

| TD-ID | 决策点 / 问题点 | 归类 | 归属 | 爆炸半径 | 利息率 | 根因 | 偿还计划 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TD-16-13 | `localTool/src/routes/resources.ts` `RESCAN_FILE_TYPE`（L25-51）与前端 `assetType.EXT_KIND` 同语义第二份且已漂移（缺 avif/ogv/oga/aac/opus/wma/aiff/json/log/csv/srt，多 flv）；rescan 不识别扩展名文件被 `continue` 丢弃，与前端判型口径错位 | 增债 | 结构债 | rescan 全量文件分类 | 中 | 母体 M-SSOT 第二份（TD-16-4…12 同根，后端 ext→kind 漏收口） | `extToFileType` 改为由 `mime.ts` `EXT_TO_MIME` 按 mime 类推导 kind（video/→video 等），删独立表；前端新增格式只改 EXT_KIND，后端经 mime.ts 自动跟随，消除跨端漂移 | 待还（@见 08 区 resources.ts） |

## 六 · 结论 + 覆盖账

- **新债 1 笔**（TD-16-13，归 16 区）：后端 rescan ext→kind 第二份，M-SSOT 第二份母体在后端侧的遗漏实例（TD-08-5 只收了 ext→mime，漏了 ext→kind）。
- **已立债核实 1 笔**（TD-08-16）：`resolveLocalPath` 不剥 `?#` 仍活，且与本仓 `relativePathFromFileUrl` 口径矛盾 → 根因未收口，本轮仅佐证不重立。
- **非债裁定 1 笔**（C）：`relativePathFromFileUrl` 合规。
- 前端 `assetType` 真源链健康（resourceStore 显式委托、所有 URL→文件名提取均用 `pathname` 剥 `?#`），无新增前端兄弟债。

**覆盖度表（本轮增量）**：

| 文件 | 层 | 覆盖状态 | 灯 | 轮次/日期 | 证据 | 债/裁定 |
| --- | --- | --- | --- | --- | --- | --- |
| `localTool/src/routes/resources.ts` | L0 后端契约 | 有债待还(TD-16-13) | 🔴 | 本轮 09-16 | L25-51 RESCAN_FILE_TYPE 漂移对比表 | TD-16-13 |
| `localTool/src/utils/resolveLocalImages.ts` | L1 后端工具 | 有债待还(TD-08-16)（核实） | 🔴 | 本轮 09-16（佐证） | L35/L38 不剥 `?#` | TD-08-16 仍活 |
| `localTool/src/routes/resources.ts` `relativePathFromFileUrl` | L1 后端工具 | 已裁定非债（合规标杆） | 🟢 | 本轮 09-16 | L103-114 pathname 剥 `?#` | 非债 |
| `src/components/base/utils/assetType.ts` | L0 真源 | 深审 | 🟢 | 本轮 09-16 | L29-34 EXT_KIND；L61 剥 `?#` | 非债（真源健康） |
| `src/components/base/store/resourceStore.ts` | L1 store | 已裁定非债（显式委托） | 🟢 | 本轮 09-16 | L38 import detectFileType；L242 委托 | 非债 |
| `src/**` URL→文件名提取（AssetNode/VideoProcess/VideoExtract/clipboard/filesApi） | L2-3 | 已裁定非债（均用 pathname 剥 `?#`） | 🟢 | 本轮 09-16 | 逐一 grep `new URL(url).pathname` | 非债 |

**本轮审了 6 处（后端 rescan 真源 + 前端真源链 + URL 解析口径），未审 0。DATAFLOW 灯与实证一致，未漂，已对账一致。**

## 七 · 状态

16 区：**已验证(无债)**（本轮新增 TD-16-13 已结清，详见下方「已结清」段）

> **【已结清 · 2026-09-16 同日后续轮】** TD-16-13 已随
> [16-跨区-媒体类型判定与URL提取真值源收口-2026-09-16](16-跨区-媒体类型判定与URL提取真值源收口-2026-09-16.md)
> 结清（后端 `RESCAN_FILE_TYPE` 整表删除、改委托 `mime.extToKind` 唯一真源），并加 `check-arch` 规则 13 防回潮。
> 本轮记录的 TD-08-16 亦在同轮结清。同轮另结清 TD-08-21 / TD-08-22 / TD-08-19（含跨栈常量对账闸 14）。
> ⇒ **16 区待还债清零，可回「已验证(无债)」**。
