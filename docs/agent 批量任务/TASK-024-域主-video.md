# TASK-024 · 域主：`video`

> **先读 `TASK-022-总纲-域籍判定与交叉验证规程（全批必读）.md`** —— 判据、四件证据、成因代号、输出格式、交叉验证协议全在那里，本文件只给**你的领地**和**本域特有事项**。
> **你只能写这个文件**：`docs/agent 批量任务/TASK-024-域主-video.md`。**碰任何其他文件视为失败。**
> **本轮只登记，不搬。**（不许 `git mv`、不许改 `src/**`）

## 1. 领地（逐件，不许抽样）

```
src/components/video/**        # 约 12 件，递归全部
```

含：`nodes/` · `depthVideo/` · `lib/` · 域根散件 · `index.ts`（若有）。
**不含**（别越界）：`videoEditor/**`（TASK-027 的地，那是**另一个域**）· `director3d/**`（**禁重审**）· `src/hooks/**`（TASK-030）· `src/components/base/**`（TASK-029）。

## 2. 本域计划内结构（判「域内错位」的比对基准）

来自 `docs/plan/域归位-最终执行计划.md` §3（**目标**，不是现状）：

```
video/
├── nodes/       VideoGenerate · VideoExtractNode · VideoProcessNode
├── depthVideo/
└── lib/         videoEngine · captureFrame · timeScale · sourceTime
```

**留域根的例外**：无（除 D1 三类）。域根出现任何件 ⇒ 域根散件。

## 3. 本域特有事项（必须逐条给结论）

1. **`video` vs `videoEditor` 是两个域，别合并**：判"该在 video 还是 videoEditor"只看 ADR-0040 L1 两条。若你实测发现二者其实是**同一个"能指着说的东西"**，写进「判据缺口」，别自行合并。
2. **`depthVideo/` 是否达标**（D2/D3）：件数是否 ≥3？职责是否单一？
3. **`lib/` 纯能力**（D3）：`lib/` 里不许有 JSX / React hook。逐件验。
4. **域内分层方向**（D4）：`nodes/` → `lib/` 是允许方向；**`lib/` → `nodes/` 是违规**，逐件查。
5. **域门面**：`video/index.ts` 是否存在、是否把 `lib/` 内部件全部对外暴露（泄漏内部）——给结论。
6. **域根散件清单**（D1）。
7. **本域是否有"未成域的能力成片"**（成因 H）：例：`depthVideo` 之外是否还有第二个成片（编解码 / 抽帧 / 合成 / 预览）散在 `lib/` 与 `nodes/` 之间。

## 4. 线索（只是线索 · 不是结论 · 可能已过期）

> **不要照抄**。每条用 `refs`/`ls`/`grep` 现场复核；对不上按实测记录，并标进「描述过期」。

- `TD-25-14`：`base/utils/timeline/sourceTime.ts` · `timeScale.ts`（+ `videoEngine.ts`）应在 `video/lib/` —— **注意**同一笔债里的 `useMediaLoadFailed.ts` 可能被域外横切件锁死（成因 D），那件由 TASK-029 判，**不是你的**。
- `TD-11-15`（母债）：摘要只列 4 件，正文约 15 件；**摘要已过期**，别当清单用。
- 计划 §4 A6 批次明确把 `captureFrame` · `videoEngine` · `timeScale` · `sourceTime` 列为 `video/lib/` 目标。
- **闸历史（成因 B）**：2026-09-19 拆 `canvas/nodes` 时，`video/nodes/` 的三个节点曾让两处闸失效（`check-node-handles` 豁免失灵导致 `npm run build` 硬红；`check-node-data.mjs` 三条路径 stale）。请顺手复核：**本域内是否还有别的地方引用旧的 `canvas/nodes/...` 路径**（`refs` 之外的字符串引用）：
  ```bash
  grep -rn "canvas/nodes" src/components/video tests 2>/dev/null
  ```
- `TD-18-45`：`src/types/asset.ts` vs `videoEditor/types/assets.ts` 只差一个 s —— 若你在本域发现**同名近似**的类型文件，同上登记（成因 C）。

## 5. 输出

按 **TASK-022 §7** 的格式（主表 + 8 个末尾小节）。**域籍判定列只许四种**。

## 6. 验收补充（除 TASK-022 §9 外）

- [ ] `find src/components/video -type f | sort` 的**每一件**都在主表出现。
- [ ] 「`video` 与 `videoEditor` 是否同一域」给了**明确结论 + L1 证据**（哪怕结论是"是两个域"）。
- [ ] `depthVideo/` 达标性、`lib/` 纯度、`video/index.ts` 门面泄漏三问**各有结论**。

---
---

# TASK-024 产出 · `video` 域籍台账（第一波 · 只登记不搬）

> 取证工具：`find`/`git ls-files` · `node scripts/mv-sync-refs.mjs refs <件>` · `grep -rn` · 逐件读源。
> 判据来源：ADR-0040（L1–L7）· ADR-0042（D1–D5）· ADR-0039（N5/N6）· TASK-022 §3–§6。
> 领地实测件数：**12 个受版本控制源码件 + 1 个 OS 元数据件**（`git ls-files src/components/video` = 12；`find -type f` = 13）。
> **本轮未改任何 `src/**`、未 `git mv`、未新建脚本、未 `debt.mjs add`。**

## 0. 域级结论（任务书 §3 七问 · 逐条）

**① `video` 与 `videoEditor` 是两个域 —— 结论：是两个域。**（L1 两条判据各自独立取证，`refs` 实测两域**零生产互引**：`grep -rn "components/videoEditor" src/components/video/` 只命中 5 处注释/文档串，零 `import`；反向 `videoEditor/**` 亦不引 `video/**`。）
- **界面位置**（L1①）：`video` 的三件是**画布内节点**，注册在节点目录 `canvas/shell/NodePalette.ts:203-215`（`cat:'video'`）· `:258`，重件走 `canvas/shell/lazyNode.tsx:129`，由 ReactFlow 画布渲染；`videoEditor` 是**全屏独立应用**，`src/App.tsx:96` 引入、`:1643-1652` 以 `<div className="ve-scope dark fixed inset-0 z-modal"><EditorShell/></div>` 挂在**画布之外的整屏遮罩**上（App 注释原文：`z-modal：编辑器是**一个全屏弹窗**`）。
- **数据落点**（L1②）：`video` 写**画布节点快照 `node.data`**——`VideoGenerate.tsx:222`（`resultKey:'videoUrl'`）· `VideoProcessNode.tsx:504/:525/:1204`（`patchNodeDataById`）· `VideoExtractNode.tsx:255/:321/:369`（`patchData`），落盘产物走 `UPLOAD_DIRS.videoProcess`；`videoEditor` 写**自己的独立 store 群** `videoEditor/stores/*`（`timeline-store.ts` `panel-store.ts` `media-preview-store.ts` `keybindings-store.ts` `assets-panel-store.tsx` `sounds-store.ts` `stickers-store.ts`）+ `canvasProjectId` 工程，二者不相交。
- **判据缺口？无。** 与 `TASK-022` 给的口径（ADR-0040 判据 2 用户判例「深度视频是**视频节点上的 hover 工具**」· `DOMAIN-MODULES §3.1.3`「视频能力 ⊃ …」vs「剪辑器（videoEditor，独立应用）」）一致；**不合并**。

**② `depthVideo/` 达标性 —— 结论：达标（D2 件数 ✅ / D3 职责单一 ✅）。**
5 件 ≥ 3 门槛（`DepthVideoModal.tsx` `depthUrls.ts` `engine.ts` `loader.ts` `spawn.ts`）；四分离职责（`depthUrls` 资源单源 · `engine` 纯逻辑 · `loader` 模型装载/释放 · `spawn` 派生收口），消费链实测只在子域内部 + 域门面（`refs`：`DepthVideoModal`→`video/index.ts`；`engine`→modal/loader/spawn/tests；`loader`→modal/tests；`depthUrls`→modal/loader/tests；`spawn`→`video/index.ts`）。ADR-0042 §37-39 亦以它为**「小而深」范本**。⇒ 它不是 D3 意义的「假子域」（混的是**同一能力内部的分层**，不是两种职责）。

**③ `lib/` 纯度（D3）—— 结论：三件全部达标，零 JSX / 零 React hook。**
- `videoEngine.ts`：出向 import 仅 `mediabunny` `gifenc` + `base/{core/log/logger, api/filesApi, utils/uploadDirs, core/utils, utils/captureFrame, utils/net/asyncGuard}`（:15-45），无 `react`、无 JSX。
- `sourceTime.ts`：**零 import**（纯 `ClipTimeWindow` + 两函数）。
- `timeScale.ts`：**零 import**（纯数值函数）。

**④ 域内分层方向（D4）—— 结论：无违规。** `nodes/` → `lib/` 是允许方向且确有（`VideoProcessNode.tsx:23-29/:40-50/:60`）；**反向 `lib/` → `nodes/` 零发生**（三件 `lib/` 的出向 import 全落在横切层/第三方，无一处引本域 `nodes/`、`depthVideo/` 或 `video/index.ts`）。

**⑤ 域门面 `video/index.ts` —— 结论：存在；未泄漏 `lib/` 内部件。**
`index.ts:22-23` 只 `export` 2 个域外真实需要的符号（`DepthVideoModal` · `spawnDepthVideoNode`），`lib/{videoEngine,sourceTime,timeScale}` 与 `depthVideo/{engine,loader,depthUrls}` **一概不外露**。反向观察（非泄漏，属§4 门面口径问题）：域外对 `video/nodes/*` 的消费**绕门面直连**（`NodePalette.ts:28-29` · `lazyNode.tsx:129`）——见「判据缺口 ④」。

**⑥ 域根散件 —— 结论：0 件。** 域根仅 `index.ts`（命中 D1 例外 ① 门面），另有 `video/.DS_Store`（macOS OS 元数据，非源码件、零 `refs`、已在 `git ls-files` 之外，建议清理）。

**⑦ 「未成域的能力成片」（成因 H）—— 结论：`depthVideo` 之外无第二块「未落位」的成片；但发现 1 块「已落位但机制外置」的成片 + 2 处注释级幽灵。**
- **已落位、不构成 H**：「视频处理（编解码/合成）」整块能力 = `lib/videoEngine.ts`（697 行，trim/extractAudio/sizeFrameRate/concat/toGif 五模式全在一份）+ 唯一宿主 `nodes/VideoProcessNode.tsx`，落点正确（`refs` 非测试消费者仅 `VideoProcessNode`）。
- **构成 H（机制外置）**：「视频抽帧」能力的核心机制（`drawVideoFrame` seek+drawImage）**不在本域**，落在横切层 `base/utils/captureFrame.ts`，由 `video`（4 件）+ `scriptbox/scriptBoxEngine.ts` + `hooks/useVideoPoster.ts` 共用 ⇒ 本域只剩宿主（`VideoExtractNode.tsx`），机制成片外置。该件**不在本任务领地**（`base/**` 属 TASK-029），故本域**只登记、不判归属**（见「判据缺口 ③」）。
- **注释级幽灵（不是成片，是描述过期 G）**：`lib/videoEngine.ts` 两段**孤立 JSDoc 无对应实现** —— `:242-256`（「媒体探测：`ok`/`failed` 三态…」+「探测一个媒体文件…」）与 `:534-558`（「无损直通导出…只暴露**一个**入口」）；`grep -rn "exportLossless"` 全仓仅命中 `:545` 这行注释自身；该文件 `^export` 实测 9 个，均无此二者。

---

## 主表 · 域籍台账（每件一行 · 13/13 全覆盖）

| # | 件（相对路径） | 判定 | 应属域 | 应属域内落点 | 证据①界面位置 | 证据②数据落点 | 证据③refs ① 段原文 | 反证检查 | 成因代号 | 置信度 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `src/components/video/index.ts` | 本域·合规 | `video` | `video/index.ts`（门面，D1 例外①） | 非 UI 件；被 `image/nodes/AssetNode.tsx:41` 与 `video/nodes/VideoGenerate.tsx:22` import | 无自持数据（:22-23 仅两条 `export`） | `src/components/image/nodes/AssetNode.tsx` · `src/components/video/nodes/VideoGenerate.tsx` | N/A（本域门面，非送出项） | G（:16-17 头注路径过期，见下） | 高 |
| 2 | `src/components/video/depthVideo/DepthVideoModal.tsx` | 本域·合规 | `video` | `video/depthVideo/` | 本域：`video/nodes/VideoGenerate.tsx:564-580`（hover「转深度视频」`:280-286` → 弹窗 `:565`）；域外宿主：`image/nodes/AssetNode.tsx:531`（走门面） | `:419` `uploadFileToLocal(blob, UPLOAD_DIRS.videoProcess, outName)` → `:438` `onSave(up.url, outName)` → 下游 assetNode `node.data` | `src/components/video/index.ts` | 本域 **1 处直接渲染**（`VideoGenerate.tsx:565`）⇒ 本域确在用 | — | 高 |
| 3 | `src/components/video/depthVideo/spawn.ts` | 本域·合规 | `video` | `video/depthVideo/` | 由深度弹窗 `onSave` 调用：`VideoGenerate.tsx:570`（本域）· `AssetNode.tsx:536`（域外） | 写下游 `assetNode` 的 `node.data`（`engine.ts:185-188` 产 `{assetUrl,assetType:'video',label,expanded}`）并经 `:70` `spawnAndCommit` 提交画布 | `src/components/video/index.ts` | 本域 **1 处调用**（`VideoGenerate.tsx:570`）⇒ 不许报「非本域」，若报只能降 `待核`；实判本域（L5 配套件随主件） | F（见判据缺口①） | 中 |
| 4 | `src/components/video/depthVideo/engine.ts` | 本域·合规 | `video` | `video/depthVideo/` | 非 UI（纯函数）；经 `DepthVideoModal.tsx:29-36` 的渲染链使用 | 无自持；`:178-189` `buildDepthChildSpec` 产下游 `node.data` 形状 | `src/components/video/depthVideo/DepthVideoModal.tsx` · `.../loader.ts` · `.../spawn.ts` · `tests/unit/depthVideo.test.ts` | 本域 **4 处**消费 | — | 高 |
| 5 | `src/components/video/depthVideo/loader.ts` | 本域·合规 | `video` | `video/depthVideo/` | `DepthVideoModal.tsx:370-382`（动态 `import(...)` 后 `ensureModel`）· `:526/:476/:108`（切 fast / 卸载即 `disposeModel`） | 改 transformers `env`（`configureEnv`）+ 模型资源 `/depth-video/models/`（`depthUrls.ts:44`），无业务数据落点 | `src/components/video/depthVideo/DepthVideoModal.tsx` · `tests/unit/depthVideo.test.ts` | 本域 **2 处**消费 | — | 高 |
| 6 | `src/components/video/depthVideo/depthUrls.ts` | 本域·合规 | `video` | `video/depthVideo/` | `DepthVideoModal.tsx:27/:369/:371/:376`（`RUNTIME_MODELS` 注入 import map + 动态 import 与模型根） | `:39-51` 派生 `/depth-video/{vendor,models}` 资源前缀（无业务数据） | `.../DepthVideoModal.tsx` · `.../loader.ts` · `tests/unit/depthVideo.test.ts` | 本域 **3 处**消费（含测试） | — | 高 |
| 7 | `src/components/video/lib/videoEngine.ts` | 本域·合规 | `video` | `video/lib/` | `video/nodes/VideoProcessNode.tsx:40-50`（五模式执行链的入口） | `:695` `uploadFileToLocal(blob, subfolder, name)` 落盘；宿主写回 `node.data`（`VideoProcessNode.tsx:1204-1206`） | `src/components/video/nodes/VideoProcessNode.tsx` · `tests/unit/VideoProcessNode.test.tsx` · `tests/unit/videoEngine.test.ts` | 本域 **1 处**生产消费（单域 ⇒ L4 归 `video/lib`） | G（`:242-256`/`:534-558` 孤立 JSDoc + `:682` `@returns` 过期，见下） | 高 |
| 8 | `src/components/video/lib/sourceTime.ts` | 本域·合规 | `video` | `video/lib/` | `VideoProcessNode.tsx:60`（时间轴↔源媒体换算，原内联 3 遍已收口） | 纯函数无落点；宿主读 `node.data` 内片段字段后在 `:504/:525` 写回 `node.data` | `src/components/video/nodes/VideoProcessNode.tsx` · `tests/unit/timelineSourceTime.test.ts` | 本域 **1 处**生产消费 | — | 高 |
| 9 | `src/components/video/lib/timeScale.ts` | 本域·合规 | `video` | `video/lib/` | `VideoProcessNode.tsx:23-29`（时间↔像素换算 + 吸附） | 纯函数无落点 | `src/components/video/nodes/VideoProcessNode.tsx` · `tests/unit/timelineShared.test.ts` | 本域 **1 处**生产消费 | — | 高 |
| 10 | `src/components/video/nodes/VideoGenerate.tsx` | 本域·合规 | `video` | `video/nodes/` | 画布节点：`canvas/shell/NodePalette.ts:255-259`（`type:'videoGenerateNode'` `label:'视频生成'` `cat:'video'`，E 快捷重复故子分类不列） | `node.data.videoUrl`（`:222` `resultKey:'videoUrl'` · `:253-257` `setVideoUrl`+`setVidPrefs`）· `node.data.{prompt,size,resolution,selectedSeconds,selectedModel,creativePresets}` | `src/components/canvas/shell/NodePalette.ts` · `tests/unit/VideoGenerate.test.tsx` · `tests/unit/VideoGenerate.upstream.test.tsx` · `tests/unit/nodes/ssrRegression.test.ts` | 本域件自身 | — | 高 |
| 11 | `src/components/video/nodes/VideoExtractNode.tsx` | 本域·合规 | `video` | `video/nodes/` | 画布节点：`canvas/shell/NodePalette.ts:200-206`（`type:'videoExtractNode'` `label:'视频抽帧'` `cat:'video'`） | `node.data.extractedImages`（`patchData` `:255` 清旧 / `:321` 一次写全 / `:369` 手动追加）+ `node.data.{mode,frameCount,intervalSec,sensitivity,videoUrl?}` | `src/components/canvas/shell/NodePalette.ts` · `tests/unit/VideoExtractNode.test.tsx` · `tests/unit/nodes/ssrRegression.test.ts` | 本域件自身 | H（其抽帧机制在 `base/utils/captureFrame`，见结论⑦/判据缺口③） | 高 |
| 12 | `src/components/video/nodes/VideoProcessNode.tsx` | 本域·合规 | `video` | `video/nodes/` | 画布节点（重件懒加载）：`canvas/shell/lazyNode.tsx:129` + `NodePalette.ts:207-215`（`cat:'video'`） | `patchNodeDataById` `:504/:525`（源元数据）· `:1093-1101`（GIF 产物 + `outputName`）· `:1204-1206`（处理产物 + `outputName`）· `:919` 错误态 | `src/components/canvas/shell/lazyNode.tsx` · `tests/unit/VideoProcessNode.test.tsx` · `tests/unit/nodes/ssrRegression.test.ts` | 本域件自身 | — | 高 |
| 13 | `src/components/video/.DS_Store` | 本域·合规（非源码件） | `video` | 建议**删除**（非件） | N/A（OS 元数据，不渲染） | 无 | **无 `refs` 输出**（`git ls-files` 未收录；`find -type f` 可见） | N/A | — | 高 |

> **主表成因列只出现 `G` 两处 · `F`/`H` 各一处（均为域级发现，另见下方小节）；其余 `—` 表示无异常。**

### `video/index.ts:16-17` 头注路径过期（成因 G · 原文对照）
```
 * 不是天然入口 ⇒ **必建**。域外消费者（`refs` 实测 2 处）：`canvas/nodes/AssetNode` ·
 * `canvas/nodes/VideoGenerate` —— 同一「深度视频」能力被 **2 个不同宿主**消费，
```
实测（本批 `refs` 原文）：域外消费者是 **`src/components/image/nodes/AssetNode.tsx`** 与 **`src/components/video/nodes/VideoGenerate.tsx`** —— `canvas/nodes/AssetNode` 不存在（`AssetNode` 实测在 `image/nodes/`），`canvas/nodes/VideoGenerate` 是**本域自己的件**（不算域外）。结论句（「2 宿主消费 ⇒ 必建门面」）**成立且被本次实测复核**，仅路径名过期。同类过期还见于 `docs/adr/ADR-0042:39`（不在本任务可写范围，仅登记）。

### `lib/videoEngine.ts` 描述过期（成因 G）
- `:242-256` 两段 JSDoc（「媒体**探测**结果…三态可判别」+「探测一个媒体文件…」）**其后无任何函数**（`:258` 起即 `processVideo` 的 JSDoc）。
- `:534-558` 整段 JSDoc（「无损直通导出…单段与多段是同一件事…只暴露**一个**入口」）**其后无任何函数**（`:561` 起即 `loadVideoElement`）；`exportLossless*` 全仓仅此注释命中。
- `:682` `@returns {Promise<{ url: string } | null>}` 与真实签名 `Promise<UploadOutcome>`（`:685`）不一致（且 `:671-676` 正文已按 `UploadOutcome` 说明，属注解未同步）。
⇒ 三处均为**注释级**描述过期/幽灵预留，**非生产消费**，本轮只登记（ADR-0053 口径：真要用时按当时消费方重建）。

---

## 认领域分布（我送出到各域各几件）

| 目标域 | 件数 | 件清单 |
| --- | --- | --- |
| （无） | **0** | — |

> 说明：本域 12 个源码件全部判 `本域·合规`，**零送出**。视频能力在 2026-09-19 域归位已迁入（`lib/` 三件迁入记录见 `index.ts:8-9`；`refs` 实测三件的非测试消费者**只有** `video/nodes/VideoProcessNode.tsx`，符合 ADR-0040 L4）。

## 域内错位表（属本域 · 子目录不对 · 本轮登记不搬）

| 件 | 现子目录 | 应入子目录 | 依据 |
| --- | --- | --- | --- |
| （无） | — | — | 12 件与计划 §3 目标逐一比对**全部一致**：`nodes/` 3 件 ✅ · `depthVideo/` 5 件 ✅ · `lib/` 3 件（`videoEngine` `sourceTime` `timeScale`）✅ · 域根门面 1 件 ✅。计划 §3 中 `lib/` 的另一项目标 `captureFrame` 实测在 `base/utils/`（非本域件，见判据缺口③）。 |

## 域根散件清单（现状 0 件 · 目标 0）

| 件 | 现位置 | 应入子目录 | 命中哪条 D1 例外（无则"无例外"） |
| --- | --- | --- | --- |
| `video/index.ts` | 域根 | （留域根） | **D1 ① 门面** |
| `video/.DS_Store` | 域根 | **删除**（OS 元数据，非源码件，零 `refs`） | **无例外**（不属"散件"意义上的代码件，但计入域根清理项） |

## 假子域 / 域内分层违规 / 成环

| 现象 | 涉及件 | 依据 |
| --- | --- | --- |
| **无假子域** | `depthVideo/*`（5） | `refs` 实测：全部消费链 = 子域内部（modal↔engine↔loader↔depthUrls↔spawn）+ 域门面 `video/index.ts`；不存在第二种职责的外泄面。混的是「同一能力内部的分层」（视图/纯逻辑/装载/单源/派生），非 D3「混了两种职责」 |
| **无域内分层违规（`lib/` → `nodes/` 零发生）** | `lib/videoEngine.ts` · `lib/sourceTime.ts` · `lib/timeScale.ts` | `videoEngine.ts:15-45` 出向 import 全在 `base/*`+第三方；另两件零 import。无一处引本域 `nodes/`/`depthVideo/`/`index.ts` |
| **无成环，但存在「域内自引门面」形态（隐患）** | `nodes/VideoGenerate.tsx:22` → `video/index.ts:22-23` → `depthVideo/{DepthVideoModal,spawn}` | `VideoGenerate` 经 `@/components/video` **自引本域门面**。当前门面不导出 `nodes/`，故不成环；**一旦门面为「门面完整」而改导出 `nodes/*`，即构成 `index → nodes → index` 环** |
| **域外消费一半走门面 / 一半绕门面** | 走门面：`image/nodes/AssetNode.tsx:41`；绕门面：`canvas/shell/NodePalette.ts:28-29` · `canvas/shell/lazyNode.tsx:129`（直连 `video/nodes/*`） | `refs` 实测原文（见主表 1/10/11/12）。节点**装配点**是否属 ADR-0039 N5「例外」需口径（见判据缺口④） |

## 判据缺口（无据可依处 · 供裁判裁定）

- **①「能力件派生的画布结构件」随谁** —— `depthVideo/spawn.ts` 的 L1 两条**分指两域**（①界面：画布节点上的 hover 工具 → `video`；②数据：写 canvas `node.data` 并经 `setNodes/setEdges/history.record` 提交 → `canvas`）。建议补口径：**能力件所派生的 canvas 结构件随能力件（L5 配套件），还是随画布**；本次按 L5 + ADR-0042 §37-39 范本判 `video`。
- **②「恰好 2 域消费」的件无落点口径** —— `base/utils/captureFrame.ts` 实测消费域 = `scriptbox`（`scriptBoxEngine.ts`）+ `video`（4 件）+ `hooks/useVideoPoster.ts`：不满 L3（要求 ≥3 域），也不适用 L4（只管「只被 1 域用」）。建议补：**2 域件的处置（归主力域 / 留横切并登记例外）**。
- **③ 计划目标与本域门面头注「已裁定」冲突（需唯一结论）** —— `docs/plan/域归位-最终执行计划.md:113` 与 `:262`（A6 批次 41-43）把 `captureFrame` 列为 **`video/lib/`** 目标；而 `video/index.ts:11-12` 头注称 `base/utils/captureFrame` **「已裁定留原处（不得重审）· 跨 scriptbox+video，真横切」**。⇒ 请裁判给唯一结论（该件在 `base/**`，非本任务领地，本域**只登记冲突、不判归属**）。建议补：ADR-0040 增「2 域消费」与「计划目标 vs 已裁定冲突时以谁为准」。
- **④ 门面的「装配点例外」是否覆盖节点目录** —— `video/index.ts` 只露 depthVideo 2 符号，而 `video/nodes/*` 被 `canvas/shell/{NodePalette,lazyNode}` **直连**（绕过门面）。ADR-0039 N5 允许「装配点/构建期例外」但要求**在门面头写理由**；本域门面未写该例外声明。建议补：**结论「节点注册类直连算不算绕过门面」**，或在门面头补例外声明。

## 交叉验证请求（要下列域复核我的送出项）

| 送出的件 | 请哪个域复核 | 复核对什么 |
| --- | --- | --- |
| （本域 **0 送出**） | — | — |
| `base/utils/captureFrame.ts`（**非我领地**，仅提出复核请求） | **TASK-029（`base` 横切层）** 为主，TASK-027（scriptbox）附议 | ① 实测消费域是否仅 `scriptbox`+`video`（附 `hooks/useVideoPoster` 是否算第 3 域）⇒ 是否满足 L3 真横切；② 与计划 §4 A6「→ `video/lib/`」冲突的取舍 |
| `video/nodes/{VideoGenerate,VideoExtractNode,VideoProcessNode}.tsx`（本域自判本域） | **TASK-025（`canvas`）**（可选，反证式复核） | 反证：这三个节点是否应算「画布宿主件」而归 `canvas`。本域反证证据：`NodePalette.ts` 按产品能力轴标 `cat:'video'`；三者数据落点为主域 `node.data` 且 `<NodeShell>` 外壳内置（ADR-0034）⇒ 判本域 |

## 计数

- 本域扫描件数：**13**（`find -type f`）；其中受版本控制源码件 **12**、OS 元数据件 1
- 本域·合规：**13**（12 源码件 + `.DS_Store` 按"非源码件"登记）
- 本域·域内错位：**0**
- 非本域：**0**
- 待核：**0**
- 成因分布（主表 13 行）：A 0 / B 0 / C 0 / D 0 / E 0 / F 1（`spawn.ts` 判据缺口）/ G 2（`index.ts` 头注、`videoEngine.ts` 描述）/ H 1（`VideoExtractNode` 机制外置）
  - **域级发现（不入主表 · 见各小节）**：F 4（判据缺口四条）· G 3（含 `ADR-0042:39` 同款过期标签，非本任务可写范围）· H 1（`captureFrame` 成片外置）
  - **零命中**：A（历史平铺未跟进）· B（闸/脚本硬编码旧路径）· C（按名字就近放）· D（被域外横切件锁死）· E（搬迁工具缺陷）
- 无 `refs` 输出的件：**`src/components/video/.DS_Store`**（OS 元数据，`git ls-files` 未收录）

### 复核：任务书 §4 线索的现场结论

| 线索 | 现场实测 | 结论 |
| --- | --- | --- |
| `TD-25-14`：`base/utils/timeline/{sourceTime,timeScale}.ts`（+`videoEngine`）应在 `video/lib/` | 三件**已在** `video/lib/`；`refs` 非测试消费者分别仅 `VideoProcessNode.tsx` | ✅ 已达成（债描述为历史态）；`useMediaLoadFailed.ts` **未出现在本域 `refs` 任何一处**，确非本域事项 |
| `TD-11-15`（母债）：摘要 4 件 / 正文约 15 件，摘要已过期 | 不以摘要为清单，全部按 `refs` 现测 | ⚠️ 依 TASK-022 §4 只作线索，未引用 |
| 计划 §4 A6：`captureFrame`·`videoEngine`·`timeScale`·`sourceTime` → `video/lib/` | 后三件已落位；`captureFrame` 仍在 `base/utils/`，且与本域门面头注"已裁定留原处"冲突 | ⚠️ 见判据缺口③ |
| 闸历史（成因 B）：`canvas/nodes` 拆域后两处闸失效 | `scripts/check-node-data.mjs:75/76/81` 已指向 `src/components/video/nodes/*`；`check-node-handles.mjs:89` · `node-file-resolver.cjs:40` 亦已含 `video/nodes`；**`grep -rn "canvas/nodes" scripts/ tests/ src/components/video`** 在本域内仅命中 `video/index.ts:16-17` 的**注释** | ✅ 本域**无** stale 路径引用；`tests/unit/{timelineShared,utils}.test.ts` 中的旧路径是**多候选回退**（有意保留，手册 §5），非 stale bug，且不在本域 |
| `TD-18-45`：本域是否存在同名近似类型文件（成因 C） | `video/**` 内类型只有 `ProcessVideoOptions`(`videoEngine.ts:64`) · `RuntimeModelPaths`(`depthUrls.ts:14`) · `ClipTimeWindow`(`sourceTime.ts:25`) · `DepthVideoModalProps` 等，**无跨域同名近似** | ✅ 零命中 |

### 自检（TASK-022 §9）

- [x] 领地每个文件在主表出现一次（13/13；无 `refs` 输出者已单列）
- [x] 无「非本域」结论（故无四件证据义务）；仍对 3 个最可能被误送的件（`depthVideo/*` · `spawn.ts` · `nodes/*`）做了**反证检查**并记入主表
- [x] 每条填了成因代号或 `—`（`—` 仅用于无异常行）
- [x] 无一条依据是「名字叫 xxx」或「目录在 xxx」；每条均附 `文件:行` 与 `refs` 原文
- [x] 未改本文件以外的任何文件（见下方 `git status --short` 自检）

### `git status` 自检摘要（本轮结束时实测）

```
$ git diff --stat                      # 工作区 vs 索引：无未暂存改动
（空输出）

$ git status --short -- "docs/agent 批量任务/" | grep TASK-024
A  "docs/agent 批量任务/TASK-024-域主-video.md"        # 本批新文件；本轮仅在此文件内追加报告
```

- 本会话对工作区的**唯一写入** = `docs/agent 批量任务/TASK-024-域主-video.md`（在任务书原文之后追加「TASK-024 产出 · 域籍台账」，原文一字未动）。
- `src/**` 中显示的 `M `/`R ` 状态**全部为会话开始前已存在的暂存改动**（`git status` 快照可见 44 个 commit 未推、`renamed` 一栏等），与本轮无关；`git diff --stat` 为空即证明本轮未触碰任何源码。
- 未 `git mv` · 未新建 `.mjs/.cjs/.sh/.js` · 未 `debt.mjs add` · 未改 `docs/plan/**` · 未读 `daily/架构日志/债务*` 或其它 `TASK-*` 产出文件。

