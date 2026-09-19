# TASK-027 · 域主：`scriptbox` + `settings` + `creative`

> 总纲 `TASK-022` 已读（判据 L1/L3/L4 · D1–D4 · 四件证据 · 成因 A–H · 输出格式 §7）。
> 本轮**只登记，不搬**：全程未 `git mv`、未改 `src/**`、未新建脚本。本文件是唯一被写的文件。
> 全部结论均来自本次 `find` / `refs` / `ls` / `grep` 实测（2026-09-19 23:00 前后），**未照抄线索**。

## 0. 实测基线

```
$ find src/components/scriptbox src/components/settings src/components/creative -type f | sort
→ scriptbox 20 件 / settings 12 件 / creative 12 件（含 1 个 .DS_Store）= 44 件
```

44 件**全部**出现在下面三张主表里（`.DS_Store` 也在 creative 主表内，单列说明）。
44 件**全部**跑过 `node scripts/mv-sync-refs.mjs refs`（`.DS_Store` 除外，非源码件）。

---

# 一、`scriptbox`（20 件 · 全部在域根 · 无 `index.ts` 门面）

## 1.1 主表 · 域籍台账

| # | 件（相对路径） | 判定 | 应属域 | 应属域内落点 | 证据①界面位置 | 证据②数据落点 | 证据③refs ① 段原文 | 反证检查 | 成因代号 | 置信度 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `scriptbox/GearSettings.tsx` | 本域·域内错位 | `scriptbox` | `scriptbox/parts/` | `scriptbox/ScriptBoxNode.tsx:296` `<GearSettings` + `scriptbox/ScriptBoxFullscreen.tsx:127` `<GearSettings` | `scriptbox/scriptBoxPlaybookStore.ts:132` `saveCustomPlaybook` → `KEY_SCRIPTBOX_PLAYBOOKS`（`base/core/contracts.ts:301`） | `src/components/scriptbox/ScriptBoxFullscreen.tsx` · `src/components/scriptbox/ScriptBoxNode.tsx` · `tests/unit/ScriptBoxNode.test.tsx` | 本域 2 处渲染（非送出，仅登记错位） | A | 高 |
| 2 | `scriptbox/ScriptBoxAssetPicker.tsx` | 本域·域内错位 | `scriptbox` | `scriptbox/parts/` | `scriptbox/StepAssets.tsx:184` `<ScriptBoxAssetPicker`（其自身在 `:76` 内套 `<ScriptBoxModal`） | 只读消费 `resource/resourceStore.ts`（`mergeResourcesFromBackend`）；选中 URL 经 `onPick` 回写 `node.data`（真源 `scriptbox/scriptBoxSchema.ts`） | `src/components/scriptbox/StepAssets.tsx` | 本域 1 处渲染 | A | 高 |
| 3 | `scriptbox/ScriptBoxFullscreen.tsx` | 本域·域内错位 | `scriptbox` | `scriptbox/editors/` | `scriptbox/ScriptBoxNode.tsx:305` `<ScriptBoxFullscreen` | `node.data`（`scriptbox/scriptBoxSchema.ts`，随 `canvas-state-v1-{projectId}` 快照，`base/core/contracts.ts:794`） | `src/components/scriptbox/ScriptBoxNode.tsx` | 本域 1 处渲染 | A | 高 |
| 4 | `scriptbox/ScriptBoxModal.tsx` | 本域·域内错位 | `scriptbox` | `scriptbox/ui/` | 域内 6 处渲染：`GearSettings.tsx:135` · `StepShots.tsx:349/374/418` · `StepPrompt.tsx:453` · `ScriptBoxAssetPicker.tsx:76` · `scriptBoxPlaybookManager.tsx:216` | 无自有数据（纯容器，props 驱动，零 store 读写） | `scriptbox/GearSettings.tsx` · `scriptbox/ScriptBoxAssetPicker.tsx` · `scriptbox/StepPrompt.tsx` · `scriptbox/StepShots.tsx` · `scriptbox/scriptBoxPlaybookManager.tsx` · `tests/unit/ScriptBoxModal.test.tsx` · `tests/unit/StepShots.upstream.test.tsx` | 本域 6 处渲染 | A | 高 |
| 5 | `scriptbox/ScriptBoxNode.tsx` | **本域·合规** | `scriptbox` | `scriptbox/`（域根 · 计划明定例外②） | `canvas/shell/NodePalette.ts:235` `component: ScriptBoxNode`（画布节点装配） | `node.data` → 画布快照 `canvas-state-v1-{projectId}`（`base/core/contracts.ts:794`） | `src/components/canvas/shell/NodePalette.ts` · `tests/unit/ScriptBoxNode.test.tsx` · `tests/unit/nodes/ssrRegression.test.ts` | 域门面件，按 §2 明定不动 | —（无成因） | 高 |
| 6 | `scriptbox/Select.tsx` | 本域·域内错位 | `scriptbox` | `scriptbox/ui/`（**结论：scriptbox 域内 UI 件，非横切 UI kit**） | `scriptbox/GearSettings.tsx:161` `<Select<string>` | 无（纯受控组件，零 store / 零 schema） | **仅** `src/components/scriptbox/GearSettings.tsx`（1 处，**零域外消费者**） | 本域 1 处渲染；`base/ui/form/` 下**不存在**同名 `Select.tsx`（实测 `ls`：仅 `ModelSelect/DropdownPanel/DropdownRow/Toggle/InlineNameInput`） | C | 高 |
| 7 | `scriptbox/StepAssets.tsx` | 本域·域内错位 | `scriptbox` | `scriptbox/editors/` | `ScriptBoxNode.tsx:269` / `ScriptBoxFullscreen.tsx:121` | `node.data.assets`（`scriptBoxSchema.ts`）+ `scriptBoxPrompts.ts` 的 `ZgPrompt/renameAssetRefs` | `scriptbox/ScriptBoxFullscreen.tsx` · `scriptbox/ScriptBoxNode.tsx` · `tests/unit/ScriptBoxNode.test.tsx` | 本域 2 处渲染 | A | 高 |
| 8 | `scriptbox/StepNav.tsx` | 本域·域内错位 | `scriptbox` | `scriptbox/ui/`（两视图复用的导航 chrome） | `ScriptBoxNode.tsx:256` / `ScriptBoxFullscreen.tsx:116` | 无（纯 props，只 import `scriptBoxSchema` 的**类型**） | `scriptbox/ScriptBoxFullscreen.tsx` · `scriptbox/ScriptBoxNode.tsx` | 本域 2 处渲染 | A | 高 |
| 9 | `scriptbox/StepPrompt.tsx` | 本域·域内错位 | `scriptbox` | `scriptbox/editors/` | `ScriptBoxNode.tsx:270` / `ScriptBoxFullscreen.tsx:122` | `node.data.shots[]` + `getPlaybook`（`scriptBoxPlaybookStore.ts:100`） | `scriptbox/ScriptBoxFullscreen.tsx` · `scriptbox/ScriptBoxNode.tsx` · `tests/unit/ScriptBoxNode.test.tsx` | 本域 2 处渲染 | A | 高 |
| 10 | `scriptbox/StepShots.tsx` | 本域·域内错位 | `scriptbox` | `scriptbox/editors/` | `ScriptBoxNode.tsx:268` / `ScriptBoxFullscreen.tsx:120` | `node.data.shots[]`（`scriptBoxSchema.ts`）+ `scriptBoxPrompts` 的 `createNewShot/removeShot` | `scriptbox/ScriptBoxFullscreen.tsx` · `scriptbox/ScriptBoxNode.tsx` · `tests/unit/ScriptBoxNode.test.tsx` · `tests/unit/StepShots.upstream.test.tsx` | 本域 2 处渲染 | A | 高 |
| 11 | `scriptbox/scriptBoxEngine.ts` | 本域·域内错位 | `scriptbox` | `scriptbox/lib/` | 无界面（能力层，由 `useScriptBoxEngine.ts:3` `createScriptBoxEngine` 调用） | 经 `setNodes` 写回 `node.data`；产物落素材库 `resource/resourceStore.ts`（`localizeAndStoreToResourceLibrary`） | `scriptbox/useScriptBoxEngine.ts` · `tests/unit/ScriptBoxNode.test.tsx` · `tests/unit/scriptBoxEngine.deep.test.ts` · `tests/unit/scriptBoxEngine.test.ts` · `tests/unit/useScriptBoxEngine.test.ts` | 本域 1 处消费（非送出） | A | 高 |
| 12 | `scriptbox/scriptBoxPlaybookIO.ts` | 本域·域内错位 | `scriptbox` | `scriptbox/lib/` | 经 `scriptBoxPlaybookManager.tsx`（导入/导出按钮）间接触发 | 不落盘（只做 `Playbook ↔ 文本`），落盘走 `scriptBoxPlaybookStore` | `scriptbox/GearSettings.tsx` · `scriptbox/scriptBoxPlaybookManager.tsx` · `scriptbox/scriptBoxPlaybookStore.ts` · `tests/unit/scriptBoxPlaybookIO.test.ts` | 本域消费 | A | 高 |
| 13 | `scriptbox/scriptBoxPlaybookManager.tsx` | 本域·域内错位 | `scriptbox` | `scriptbox/parts/` | `scriptbox/GearSettings.tsx:393` `<ScriptBoxPlaybookManager` | `scriptBoxPlaybookStore.ts` 的 `getAllPlaybooks/saveCustomPlaybook/deleteCustomPlaybook/createCustomFrom` | `src/components/scriptbox/GearSettings.tsx` | 本域 1 处渲染 | A | 高 |
| 14 | `scriptbox/scriptBoxPlaybookStore.ts` | 本域·域内错位 | `scriptbox` | `scriptbox/lib/`（本域 store 仅 1 件，**未达 D2 的 3 件门槛 ⇒ 不建 `store/`，并入 `lib/`**） | 经 `GearSettings` / `scriptBoxPlaybookManager` 编辑 | `scriptBoxPlaybookStore.ts:89` `contentSet(PLAYBOOKS_KEY, obj)` → `KEY_SCRIPTBOX_PLAYBOOKS`（`contracts.ts:301`，`backend:'local'`） | `scriptbox/GearSettings.tsx` · `scriptbox/StepPrompt.tsx` · `scriptbox/scriptBoxPlaybookManager.tsx` · `scriptbox/scriptBoxPromptResolver.ts` · `tests/unit/scriptBoxPlaybookStore.test.ts` · `tests/unit/scriptBoxPromptResolver.test.ts` | 本域消费 | A | 高 |
| 15 | `scriptbox/scriptBoxPromptResolver.ts` | 本域·域内错位 | `scriptbox` | `scriptbox/lib/` | 无（纯函数，被 `StepAssets.tsx` / `scriptBoxEngine.ts` 消费） | 只读 `getPlaybook`（`scriptBoxPlaybookStore.ts`，纯读无写） | `scriptbox/StepAssets.tsx` · `scriptbox/scriptBoxEngine.ts` · `tests/unit/scriptBoxPromptResolver.test.ts` | 本域消费 | A | 高 |
| 16 | `scriptbox/scriptBoxPrompts.ts` | 本域·域内错位 | `scriptbox` | `scriptbox/lib/` | 无（纯函数，被 `StepShots/StepAssets/StepPrompt/scriptBoxEngine` 消费） | 无（默认值取自 `scriptBoxWorkflows.ts` 的 `SCRIPT_BOX_WORKFLOWS`，零持久化） | `scriptbox/StepAssets.tsx` · `scriptbox/StepPrompt.tsx` · `scriptbox/StepShots.tsx` · `scriptbox/scriptBoxEngine.ts` · `scriptbox/scriptBoxSchema.ts` · `src/hooks/useConnectedInputs.ts` · `tests/unit/scriptBoxPrompts.boundaryDiag.test.ts` · `tests/unit/scriptBoxPrompts.test.ts` | 本域 4 处消费 | A | 高 |
| 17 | `scriptbox/scriptBoxSchema.ts` | 本域·域内错位 | `scriptbox` | `scriptbox/contract/` | 无（`ScriptBoxNode.data` 全字段的**唯一真相源**） | `node.data` 声明层（文件头 `:5` 明载；随画布快照落盘） | `scriptbox/GearSettings.tsx` · `ScriptBoxFullscreen.tsx` · `ScriptBoxNode.tsx` · `StepAssets.tsx` · `StepNav.tsx` · `StepPrompt.tsx` · `StepShots.tsx` · `scriptBoxEngine.ts` · `useScriptBoxEngine.ts` · `tests/unit/StepShots.upstream.test.tsx` · `tests/unit/scriptBoxEngine.test.ts` | 本域 9 处消费 | A | 高 |
| 18 | `scriptbox/scriptBoxTypes.ts` | 本域·域内错位 | `scriptbox` | `scriptbox/contract/` | 无（纯类型，零运行时导出） | 无 | `scriptbox/StepPrompt.tsx` · `scriptbox/scriptBoxPlaybookIO.ts` · `scriptbox/scriptBoxPromptResolver.ts` · `scriptbox/scriptBoxWorkflows.ts` | 本域消费 | A | 高 |
| 19 | `scriptbox/scriptBoxWorkflows.ts` | 本域·域内错位 | `scriptbox` | `scriptbox/contract/`（默认提示词常量表，被 `lib/` 单向消费） | 经 `GearSettings` 的工作流下拉间接出现（`scriptBoxPlaybookStore` 归一化后列出） | 代码常量（`SCRIPT_BOX_WORKFLOWS`）；内置 playbook 不落盘（`scriptBoxPlaybookStore.ts` 文件头明载） | `scriptbox/GearSettings.tsx` · `scriptbox/scriptBoxPlaybookManager.tsx` · `scriptbox/scriptBoxPlaybookStore.ts` · `scriptbox/scriptBoxPrompts.ts` | 本域消费 | A | 高 |
| 20 | `scriptbox/useScriptBoxEngine.ts` | 本域·域内错位 | `scriptbox` | `scriptbox/lib/`（紧邻引擎；**D3 无 hook 落点 ⇒ 见判据缺口 ①**） | `scriptbox/ScriptBoxNode.tsx:66` `useScriptBoxEngine(id, data)` | `node.data`（经 `updateData` 写回）+ `settings/providerStore.ts:14` 取模型 | `scriptbox/ScriptBoxNode.tsx` · `tests/unit/ScriptBoxNode.test.tsx` · `tests/unit/useScriptBoxEngine.test.ts` | 本域 1 处消费 | A | 高 |

## 1.2 本域特有事项结论（任务书 §3 的 1–4）

### ① 域根散件（D1）· 子域划分方案 —— 逐件去处

**方案（按职责实测得出，非照抄示例）**：

| 目标子目录 | 件数 | 逐件 | 职责 | D2 达标性 | D4 层位 |
| --- | --- | --- | --- | --- | --- |
| `scriptbox/`（域根） | 1 | `ScriptBoxNode.tsx` | 域门面节点 | **例外②**（计划 §2 明定「该域节点没有 `nodes/` 子目录，不许为了"节点都该在 nodes/"而迁它」） | 视图层 |
| `scriptbox/editors/` | 4 | `ScriptBoxFullscreen.tsx` · `StepShots.tsx` · `StepAssets.tsx` · `StepPrompt.tsx` | 三步编辑面 + 全屏工作台（同一份 `stepProps` 驱动，窗口/全屏两视图共用） | 4 ≥ 3 ✓ | 视图层 |
| `scriptbox/parts/` | 3 | `GearSettings.tsx` · `ScriptBoxAssetPicker.tsx` · `scriptBoxPlaybookManager.tsx` | 浮层/弹窗类业务零件（三者都套 `ScriptBoxModal`，且**都读写业务数据**：playbook / 素材 / 资产） | 3 ≥ 3 ✓ | 机制层 |
| `scriptbox/ui/` | 3 | `ScriptBoxModal.tsx` · `Select.tsx` · `StepNav.tsx` | 域内可复用 UI 原语（**零 store 读写、零 schema 写入**、纯 props 驱动，被 ≥2 处复用） | 3 ≥ 3 ✓ | 视图层 |
| `scriptbox/lib/` | 5 | `scriptBoxEngine.ts` · `scriptBoxPrompts.ts` · `scriptBoxPromptResolver.ts` · `scriptBoxPlaybookIO.ts` · `scriptBoxPlaybookStore.ts` · `useScriptBoxEngine.ts`（**6**） | 纯能力 + 状态（**实测全部零 `.tsx` / 零 React import**，见下 §1.2③） | 6 ≥ 3 ✓ | 能力层 |
| `scriptbox/contract/` | 3 | `scriptBoxSchema.ts` · `scriptBoxTypes.ts` · `scriptBoxWorkflows.ts` | schema / 纯类型 / 默认提示词常量表（**零逻辑、零 IO**） | 3 ≥ 3 ✓ | 能力层（最底） |

- **为什么 `StepNav` 进 `ui/` 而不是 `editors/`**：它同时被节点窗口（`ScriptBoxNode.tsx:256`）与全屏（`ScriptBoxFullscreen.tsx:116`）两处复用，且**只消费 props、不碰 `data`/store**（实测 import 仅 `type { ScriptBoxShot, ScriptBoxAsset }`）—— 与 `ScriptBoxModal`/`Select` 同属「被复用的零数据 chrome」。
- **为什么 `GearSettings` 进 `parts/` 而不是 `ui/`**：它读写 playbook store（`saveCustomPlaybook`），有业务语义，`ui/` 的 D3 定义是「域内 UI kit」。
- **`lib/` 实收 6 件**：`useScriptBoxEngine.ts` 与引擎一对一（文件头：`UI 组件只调 callbacks.onXxx?.()`），放 `lib/` 紧邻 `scriptBoxEngine.ts`；它是全表唯一「React 件进能力层」的例外 —— 判据缺口 ① 请裁判裁定。
- **另建门面**：本域**没有 `index.ts`**（实测 `ls` 无），D1 例外① 的门面缺失 ⇒ 建议裁判补 `scriptbox/index.ts`（只露 `ScriptBoxNode` + 引擎回调契约类型）。

### ② `Select.tsx` 现行地位 —— 明确结论

> **结论：属 `scriptbox` 域内 UI 件（落点 `scriptbox/ui/`），不是真横切 UI kit。**

| 四件证据 | 实测 |
| --- | --- |
| ① 界面位置 | `scriptbox/GearSettings.tsx:161` `<Select<string>`（剧本盒子齿轮弹窗内的工作流/参数下拉） |
| ② 数据落点 | **无**（纯受控组件：`value/onChange/options` props，零 store、零 schema、零 localStorage） |
| ③ `refs` ① 段原文 | **仅** `src/components/scriptbox/GearSettings.tsx`（1 处） |
| ④ 反证检查 | 本域 1 处渲染（`GearSettings.tsx:161`）；`base/ui/form/` 实测**没有**另一个 `Select.tsx`；无任何其它域 import 它 |

**判据演算**：
- **L3 真横切 = 「≥3 个业务域消费」+「零业务语义」** —— 实测消费域数 = **1**（scriptbox），**不达标**（既有业务消费者不足，且它带 `SelectOption/placeholder/popupTo` 这类本域 UI 语义）。
- **L4**（只被一个业务域消费的件不许留横切层）—— 它**已经**被 A4 #39 移出 `base/panels`，现不在横切层，L4 无残留违规。
- 故：**不回 `base/ui`**，落 `scriptbox/ui/`。若 base 域（TASK-028）主张与 `base/ui/form/ModelSelect.tsx` 并案（两者共用 `DropdownPanel`+`DropdownRow` 同一套原语），我方**不并案**（fan-in=1，并案会让横切层反向长出业务下拉件），已列入交叉验证请求。

### ③ `scriptBoxEngine` / `scriptBoxSchema` / `scriptBoxPrompts` / `scriptBoxPlaybookStore` 四件的层次（D4）—— 逐件跑 `refs` 验

| 件 | 出向 import 实测（D4 判定依据） | 是否依赖 UI | 结论 |
| --- | --- | --- | --- |
| `scriptBoxEngine.ts` | `base/core/idGen` · `base/api` · `base/utils/*` · `base/core/*` · `base/store/generationOrchestration` · `resource/resourceStore` · 本域 `scriptBoxPrompts`/`scriptBoxPromptResolver` | **零 `.tsx`、零 React** | 能力层 ✓ 合规 |
| `scriptBoxSchema.ts` | 仅 `import type { Shot } from './scriptBoxPrompts'` | **零** | 能力层 ✓ 合规 |
| `scriptBoxPrompts.ts` | 仅 `import { SCRIPT_BOX_WORKFLOWS } from './scriptBoxWorkflows.ts'` | **零** | 能力层 ✓ 合规 |
| `scriptBoxPlaybookStore.ts` | `base/core/contentStore` · `base/core/log/*` · `base/core/idGen` · `base/core/contracts` · 本域 `scriptBoxWorkflows`/`scriptBoxPlaybookIO` | **零** | 能力层 ✓ 合规 |

**本域未发现 D4 反向依赖**（`lib/ → 视图层` 一条都没有）。唯一跨层直连域外实现件的是 `StepShots.tsx:8` → `canvas/shell/ResourceStrip.tsx`（跨域、非域内反向），已登记在「假子域/分层违规」小节作备注。

### ④ `KEY_SCRIPTBOX_PLAYBOOKS` 的域标注 —— 判**错**

现状（`base/core/contracts.ts:362-369`）：
```
[KEY_SCRIPTBOX_PLAYBOOKS]: { domain: 'settings', store: 'scriptBoxPlaybookStore.ts', backend: 'local', sync: true, ... }
```
按 **L1** 判数据落点实测：
- 写它的 store 文件 = `src/components/scriptbox/scriptBoxPlaybookStore.ts:89`（`contentSet(PLAYBOOKS_KEY, obj)`）——**在 scriptbox 域**。
- 编辑它的两个 UI 入口 = `scriptbox/GearSettings.tsx:135`（齿轮弹窗）与 `scriptbox/scriptBoxPlaybookManager.tsx:216`（管理面板）——**全在 scriptbox 域**。
- `settings/` 域内**零处** import `scriptBoxPlaybookStore`（实测 `grep "settings/"` 反向、`refs` ① 段均无任何 settings 件）。

⇒ **`domain: 'settings'` 判错，应改 `domain: 'scriptbox'`。**
**成因 = G（登记与真源自相矛盾：同一条登记的 `store` 字段已指向 scriptbox 文件，`domain` 却写 settings）**，次因 C（"playbook 是配置项 → 归 settings" 的按语义就近归类，L2 明禁）。

---

## 1.3 `scriptbox` 末尾小节

### 认领域分布（我送出到各域各几件）

| 目标域 | 件数 | 件清单 |
| --- | --- | --- |
| （无）**本域零送出** | 0 | —— 20 件全是本域人；19 件是域根散件（域内错位），1 件合规 |

> **并案候选（非送出，交裁判/他域裁定）**：`Select.tsx`（base 域）、`ScriptBoxAssetPicker.tsx`（resource 域）、`providerStore.ts`（见 settings 表）—— 见下文「交叉验证请求」。

### 域内错位表（属本域 · 子目录不对 · 本轮登记不搬）

| 件 | 现子目录 | 应入子目录 | 依据 |
| --- | --- | --- | --- |
| `GearSettings.tsx` | 域根 | `parts/` | 浮层类业务零件（读写 playbook store），与 `ScriptBoxAssetPicker`/`scriptBoxPlaybookManager` 同为 3 件 |
| `ScriptBoxAssetPicker.tsx` | 域根 | `parts/` | 同上（弹窗零件，套 `ScriptBoxModal`） |
| `scriptBoxPlaybookManager.tsx` | 域根 | `parts/` | 同上 |
| `ScriptBoxFullscreen.tsx` | 域根 | `editors/` | 全屏工作台视图（D3 `editors/` = 编辑器） |
| `StepShots.tsx` | 域根 | `editors/` | 三步编辑面之 1（窗口/全屏共用同一 `stepProps`） |
| `StepAssets.tsx` | 域根 | `editors/` | 三步编辑面之 2 |
| `StepPrompt.tsx` | 域根 | `editors/` | 三步编辑面之 3 |
| `ScriptBoxModal.tsx` | 域根 | `ui/` | 零数据 UI 原语，被 6 处复用 |
| `Select.tsx` | 域根 | `ui/` | 零数据下拉原语（fan-in=1，详见 §1.2②） |
| `StepNav.tsx` | 域根 | `ui/` | 零数据导航 chrome，被 2 视图复用 |
| `scriptBoxEngine.ts` | 域根 | `lib/` | 纯能力，零 `.tsx`（D4 实测） |
| `scriptBoxPrompts.ts` | 域根 | `lib/` | 纯函数层（文件头「100% 纯函数，无 React」） |
| `scriptBoxPromptResolver.ts` | 域根 | `lib/` | 纯读解析层，零 UI |
| `scriptBoxPlaybookIO.ts` | 域根 | `lib/` | 纯函数，只做对象↔文本 |
| `scriptBoxPlaybookStore.ts` | 域根 | `lib/` | 本域 store 仅 1 件 < D2 门槛 ⇒ 不建 `store/`，并入 `lib/` |
| `useScriptBoxEngine.ts` | 域根 | `lib/` | 引擎的 React 注入口，与 `scriptBoxEngine.ts` 一对一（hook 落点见判据缺口①） |
| `scriptBoxSchema.ts` | 域根 | `contract/` | `node.data` 唯一真相源（D3 `contract/` = schema/常量） |
| `scriptBoxTypes.ts` | 域根 | `contract/` | 纯类型（零运行时导出） |
| `scriptBoxWorkflows.ts` | 域根 | `contract/` | 默认提示词常量表，被 `lib/` 单向消费 |

### 域根散件清单（现状 20 件 · 目标 1）

| 件 | 现位置 | 应入子目录 | 命中哪条 D1 例外 |
| --- | --- | --- | --- |
| `ScriptBoxNode.tsx` | 域根 | 留域根 | **例外②**（任务书 §2 明定：不许为"节点都该在 nodes/"而迁它） |
| 其余 19 件 | 域根 | 见上表 | 无例外 |

**注：本域缺 D1 例外① 的门面 `index.ts`** —— 建议裁判补建（只露 `ScriptBoxNode` + `ScriptBoxCallbacks`/`ScriptBoxData` 类型）。

### 假子域 / 域内分层违规 / 成环

| 现象 | 涉及件 | 依据 |
| --- | --- | --- |
| 域内分层违规 | **未发现**（`lib/` 5 件零 `.tsx`、零 React；无 `lib/→editors/` 反向 import） | 逐件 `grep import` 实测（§1.2③） |
| 成环 | **未发现**（`contract/→lib/→parts/editors` 单向；`scriptBoxTypes` 正是为解环而抽，见其文件头） | `scriptBoxTypes.ts` 文件头注释 + `refs` 出向核对 |
| 跨域直连实现件（非域内违规，仅登记） | `StepShots.tsx:8` → `canvas/shell/ResourceStrip.tsx`；`ScriptBoxNode.tsx:8-9` → `canvas/parts/NodeShell`/`CustomHandle` | 直连他域 `parts/shell` 而非 `canvas/index.ts` 门面；属全仓惯例，本轮不判 |
| 横切层反向依赖本域（规则 2 风险 · 非我领地） | `src/hooks/useConnectedInputs.ts:15` → `scriptbox/scriptBoxPrompts.ts` | 已列入交叉验证请求，交 TASK-029 |

### 判据缺口（无据可依处 · 供裁判裁定）

1. **域内 hook 无落点**：D3 十二个子目录名里没有 `hooks/`。实测全仓口径不一 —— `scriptbox/useScriptBoxEngine.ts` 堆域根、`image/` 堆 3 个 hook（`useCopyNode`/`useFitNodeRatio`/`useImageHoverActions`）、`director3d/` 堆 `useToast.ts`、`videoEditor/` 自建 `hooks-cutia/`。→ 建议 ADR-0040/0042 补一条「域内 hook 的落点」（我方建议：随其宿主能力进 `lib/`，或统一新增 `hooks/`）。
2. **`lib/` 是否允许含 React hook**：D3 定义 `lib/` = 纯能力、**禁 JSX**。`useScriptBoxEngine.ts` 无 JSX 但依赖 React/`useReactFlow`。→ 建议明确「禁 JSX」是否等价于「禁 React」。

### 交叉验证请求（要下列域复核）

| 件 | 请哪个域复核 | 复核对什么 |
| --- | --- | --- |
| `scriptbox/Select.tsx` | **base**（TASK-028） | 是否与 `base/ui/form/ModelSelect.tsx` 并案（共用 `DropdownPanel`+`DropdownRow` 原语）。我方结论：**不并案**（fan-in=1，L3 不达标） |
| `scriptbox/ScriptBoxAssetPicker.tsx` | **resource**（TASK-029） | 素材库是否已有通用「选一张图」选择器可并案（线索 TD-03-21「素材一物覆盖三处」的 H 风险） |
| `src/hooks/useConnectedInputs.ts` | **hooks**（TASK-029） | 横切 hook 反向 import `scriptbox/scriptBoxPrompts.ts`（`:15`）—— 是否违反规则 2；该 hook 被 5 个域消费（33 处） |
| 线索 `TD-25-31` 复核（第二波回应） | 裁判 / TASK-029 | 线索称 `src/hooks/useScriptBoxEngine.ts` 属 scriptbox；**实测 `src/hooks/` 下无此文件**（`ls` 全 20 个 hook 无它）⇒ **线索描述过期（成因 G）**。真实件是 `src/components/scriptbox/useScriptBoxEngine.ts`，已在我领地并判本域 ⇒ **无需搬迁，建议关闭该条** |
| 线索 `TD-18-38` 复核 | TASK-028 | `refs base/api/relayProxy.ts` ① 段只有 `base/api/generate.ts` + `base/api/pollTask.ts`（+2 tests）⇒ **本域零消费**，与本域无关 |

### 计数（scriptbox）

- 本域扫描件数：**20**
- 本域·合规：**1**（`ScriptBoxNode.tsx`）
- 本域·域内错位：**19**
- 非本域：**0**
- 待核：**0**
- 成因分布：A **19** / B 0 / C **1**（`Select.tsx`）+ G **1**（`KEY_SCRIPTBOX_PLAYBOOKS` 登记，计在域外登记项，不计入件数）/ 其余 0
- 无 `refs` 输出的件：**无**（20 件全部有 ① 段输出）

---

# 二、`settings`（12 件 · 域根 5 + `sections/` 7 · 无 `index.ts`）

## 2.1 主表 · 域籍台账

| # | 件（相对路径） | 判定 | 应属域 | 应属域内落点 | 证据①界面位置 | 证据②数据落点 | 证据③refs ① 段原文 | 反证检查 | 成因代号 | 置信度 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `settings/SettingsFrame.tsx` | **本域·合规** | `settings` | `settings/`（域根） | `src/App.tsx:1631` `{view === 'settings' && <SettingsFrame />}` | 无自有数据（只做侧栏分发 4 个 section） | `src/App.tsx` | 装配入口，D1 例外③ | — | 高 |
| 2 | `settings/accountsStore.ts` | 本域·域内错位 | `settings` | `settings/store/`（条件未满足，见 §2.2⑥） | `src/App.tsx:1629` `{view === 'accounts' && <AccountsSettings />}`（经 AccountsSettings 渲染） | `KEY_YIMAO_ACCOUNTS`（`contracts.ts:253`，`contracts.ts:467` 登记 `domain:'account'`/`backend:'kv'`） | `base/store/cloudSync.ts` · `settings/sections/AccountsSettings.tsx` · `tests/unit/accountsStore.test.ts` · `tests/unit/cloudSync.rehydrate.test.ts` | 本域渲染（非送出） | A | 高 |
| 3 | `settings/providerStore.ts` | 本域·域内错位 | `settings` | `settings/store/` | `settings/sections/ApiSettings.tsx`（设置页第三方 API 配置）+ `agent/panels/AgentPanel.tsx:38` + `scriptbox/GearSettings.tsx:2` | `KEY_ACTIVE_API_ENDPOINT`（`contracts.ts:302`；本件 `:499` `contentSetAsync`，`backend:'kv'`）+ `providerApi.saveProviders`（后端 `/api/providers`） | `agent/panels/AgentPanel.tsx` · `base/store/cloudSync.ts` · `scriptbox/GearSettings.tsx` · `scriptbox/useScriptBoxEngine.ts` · `settings/sections/AgentChatSettings.tsx` · `settings/sections/ApiSettings.tsx` · `src/hooks/useGenerateNode.ts` · tests ×15 | 本域渲染；但 **fan-in 22 处、跨 agent/scriptbox/generate/settings 4 域** ⇒ 报「并案候选」，不送出 | A | 高 |
| 4 | `settings/providerUrlAdapters.ts` | 本域·域内错位 | `settings` | 建议 `settings/contract/`（仅 2 件未达 D2 ⇒ 请裁判裁定，见判据缺口③） | `settings/sections/ApiSettings.tsx`（协议显示名下拉） | 无（纯常量表 `PROVIDER_PROTOCOL_LABELS`；真源在后端 `protocolAdapters.ts`，文件头明载） | `settings/sections/ApiSettings.tsx` | 本域 1 处消费 | A · F | 中 |
| 5 | `settings/settingRegistry.ts` | 本域·域内错位 | `settings` | 建议 `settings/store/`（随「声明→默认值→持久化」链；若裁判立 `contract/` 则归 `contract/`） | `settings/sections/OtherSettings.tsx`（遍历 `UI_SETTING_ROWS` 渲染开关行） | `app_settings` 键（`contracts.ts:355` `domain:'settings'`，经 `base/store/appSettings.ts:18` 消费） | `base/store/appSettings.ts` · `settings/sections/OtherSettings.tsx` | 本域渲染（非送出） | A · C | 高 |
| 6 | `settings/sections/AccountsSettings.tsx` | 本域·域内错位 | `settings` | **`settings/` 域根**（D1 例外③） | `src/App.tsx:1629` `{view === 'accounts' && <AccountsSettings />}` | `settings/accountsStore.ts`（`KEY_YIMAO_ACCOUNTS`） | `src/App.tsx` | 本域渲染；**它不在 `SettingsFrame` 的 4 个分节里**（`SettingsFrame.tsx:26-31` SECTIONS 只有 agent/api/other/storage） | C | 高 |
| 7 | `settings/sections/AgentChatSettings.tsx` | **本域·合规** | `settings` | `settings/sections/` | `settings/SettingsFrame.tsx:72` `return <AgentChatSettings />` | `agent/runtime/agentModelStore.ts`（`KEY_AGENT_CHAT_MODEL`/`KEY_AGENT_HISTORY_TURNS`，`contracts.ts` 登记 `domain:'agent'`） | `settings/SettingsFrame.tsx` | 本域 1 处渲染 | —（L1 两条冲突 ⇒ 判据缺口④） | 中 |
| 8 | `settings/sections/ApiSettings.tsx` | **本域·合规** | `settings` | `settings/sections/` | `settings/SettingsFrame.tsx:70` `return <ApiSettings />` | `settings/providerStore.ts`（`save`/`applyFetchedModels`/`toggleProviderEnabled`） | `settings/SettingsFrame.tsx` | 本域渲染 | — | 高 |
| 9 | `settings/sections/FetchModelsModal.tsx` | **本域·合规** | `settings` | `settings/sections/` | `settings/sections/ApiSettings.tsx:324` `<FetchModelsModal` | 无自有（`fetched`/`existing` 由 ApiSettings 传入，写入走 `applyFetchedModels`） | `settings/sections/ApiSettings.tsx` | 本域 1 处渲染 | —（备注：若严格按 D3 单一职责，弹窗件可归 `parts/`） | 中 |
| 10 | `settings/sections/OtherSettings.tsx` | **本域·合规** | `settings` | `settings/sections/` | `settings/SettingsFrame.tsx:74` `return <OtherSettings />` | `base/store/appSettings.ts`（`useAppSettings`/`setSetting` → `app_settings` 键）+ `settingRegistry.ts` 的 `UI_SETTING_ROWS` | `settings/SettingsFrame.tsx` | 本域渲染 | — | 高 |
| 11 | `settings/sections/SkillSettings.tsx` | **本域·合规** | `settings` | `settings/sections/` | `settings/sections/AgentChatSettings.tsx:221` `<SkillSettings />`（设置页「AI 助手」分区内） | `agent/runtime/skillStore.ts`（`KEY_AGENT_SKILLS`/`KEY_AGENT_SKILL_ENABLED`，`contracts.ts` 登记 `domain:'agent'`） | `settings/sections/AgentChatSettings.tsx` | **反证命中**：本域 1 处直接渲染 ⇒ **不许报非本域**（门闩第 4 条） | —（L1 两条冲突 ⇒ 判据缺口④） | 中 |
| 12 | `settings/sections/StorageMonitor.tsx` | **本域·合规** | `settings` | `settings/sections/` | `settings/SettingsFrame.tsx:76` `return <StorageMonitor />` | 只读后端报表 `base/api/localToolApi.fetchStorageHealth` + `base/storage/index`（`/api/admin/storage-health`）；**无自有持久化键** | `settings/SettingsFrame.tsx` | 本域渲染 | — | 高 |

## 2.2 本域特有事项结论（任务书 §3 的 5–7）

### ⑤ `sections/` 职责单一（D3）—— **不达标一处**

`sections/` 现有 7 件，其中 6 件确实是「由 `SettingsFrame` 静态装配的设置分节」（`ApiSettings`·`AgentChatSettings`·`OtherSettings`·`StorageMonitor` + 其附属件 `FetchModelsModal`·`SkillSettings`）。
**例外**：`AccountsSettings.tsx` **不在 `SettingsFrame` 的分节表内**（`SettingsFrame.tsx:26-31` 的 `SECTIONS` 只有 agent/api/other/storage 四项），它由 `App.tsx:1629` 作为**独立页面**（`view === 'accounts'`）直接渲染。
⇒ 判「域内错位」：它不属 `sections/`（不是设置分节），应回域根走 D1 例外③（被 `App.tsx` 直接消费的装配入口）。成因 **C**（按名字带 `Settings` 就近塞进 `sections/`）。

### ⑥ store 类件该在域根还是 `store/`（D2/D3）—— **条件未满足，暂不建**

| 计划列举的 4 件 | 实测在哪 | 在 settings 域内？ |
| --- | --- | --- |
| `appSettings` | **`src/components/base/store/appSettings.ts`** | **否**（实测 `find` 无 `settings/appSettings.*`；它 import `settings/settingRegistry`，见 `appSettings.ts:18`） |
| `settingRegistry` | `settings/settingRegistry.ts` | 是，但性质是**声明表**（文件头明载「与 contracts.ts 各登记表同属静态声明表家族」），非状态 |
| `providerStore` | `settings/providerStore.ts` | 是 |
| `accountsStore` | `settings/accountsStore.ts` | 是 |

⇒ **实测同职责（状态）件只有 2 件**（`providerStore` + `accountsStore`），**D2 门槛 ≥3 不达标**。
但 D1 又规定「域根散件 = 0」⇒ **D1 与 D2 死锁**（判据缺口③）。

**我方建议（给裁判）**：计划 §3 明定 `settings/` 应含 `appSettings`，而它至今仍在 `base/store/`（TASK-028 领地）。**先把 `appSettings.ts` 归位到 `settings/`** ⇒ 状态类件达 3 件（`appSettings` + `providerStore` + `accountsStore`），`settings/store/` 即达标 ✓。
**条件未满足前不建 `store/`**，`providerStore`/`accountsStore` 暂留域根并登记为「域根散件·待条件」。

### ⑦ 是否存在"看似 settings、其实属于别域"的件

逐件查了三个高危候选，**结论：零送出**（全部反证命中或界面在设置页）：

| 候选 | 疑点 | 反证检查（本域内有无渲染/引用） | 结论 |
| --- | --- | --- | --- |
| `SkillSettings.tsx` | 数据全落 `agent/runtime/skillStore`（`domain:'agent'`） | **有** —— `settings/sections/AgentChatSettings.tsx:221` 直接渲染 | 门闩第 4 条命中 ⇒ **不报非本域**；判本域·合规，L1 冲突记入判据缺口④ |
| `AgentChatSettings.tsx` | 数据落 `agent/runtime/agentModelStore`（`domain:'agent'`） | **有** —— `SettingsFrame.tsx:72` 渲染 | 同上 |
| `providerStore.ts` | 被 agent/scriptbox/generate 3 域消费（22 处），疑似共享件 | **有** —— `ApiSettings.tsx` 渲染并写它 | 判本域·合规；但**报为「并案候选」**交三域复核（L3 需"零业务语义"，provider 供应商配置有业务语义 ⇒ 我方不判横切） |

## 2.3 `settings` 末尾小节

### 认领域分布

| 目标域 | 件数 | 件清单 |
| --- | --- | --- |
| （无）**本域零送出** | 0 | —— |
| 并案候选 | 1 | `providerStore.ts`（请 agent/scriptbox/generate 复核是否共享件） |

### 域内错位表

| 件 | 现子目录 | 应入子目录 | 依据 |
| --- | --- | --- | --- |
| `accountsStore.ts` | 域根 | `store/` | 状态类（待 `appSettings` 归位后达标） |
| `providerStore.ts` | 域根 | `store/` | 状态类 |
| `settingRegistry.ts` | 域根 | `store/`（或 `contract/`） | 声明表，与 appSettings 同链（`appSettings.ts:18` import 它） |
| `providerUrlAdapters.ts` | 域根 | `contract/`（或随 `store/`） | 常量表，零 IO（2 件未达 D2 ⇒ 待裁） |
| `sections/AccountsSettings.tsx` | `sections/` | **`settings/` 域根**（D1 例外③） | 不在 `SettingsFrame.SECTIONS` 内（`SettingsFrame.tsx:26-31`），由 `App.tsx:1629` 作独立页渲染 |

### 域根散件清单（现状 5 件 · 目标 1）

| 件 | 现位置 | 应入子目录 | 命中哪条 D1 例外 |
| --- | --- | --- | --- |
| `SettingsFrame.tsx` | 域根 | 留域根 | **例外③**（`App.tsx:103` import + `:1631` 直接渲染的装配入口） |
| `accountsStore.ts` | 域根 | `store/`（待条件） | 无例外 |
| `providerStore.ts` | 域根 | `store/`（待条件） | 无例外 |
| `settingRegistry.ts` | 域根 | `store/` 或 `contract/` | 无例外 |
| `providerUrlAdapters.ts` | 域根 | `contract/` | 无例外 |

**注：本域也缺门面 `index.ts`**（实测无），D1 例外① 空缺。

### 假子域 / 域内分层违规 / 成环

| 现象 | 涉及件 | 依据 |
| --- | --- | --- |
| `sections/` 混入非分节件 | `AccountsSettings.tsx` | 它由 `App.tsx:1629` 作独立页渲染，不在 `SettingsFrame.SECTIONS`（4 项）内 —— `sections/` 名义职责 = 设置分节，实为「分节 + 独立页」两种职责 ⇒ 轻度假子域 |
| `sections/` 混入弹窗件 | `FetchModelsModal.tsx` | 它是 `ApiSettings.tsx:324` 的附属弹窗；严格按 D3 单一职责可归 `parts/`（本轮判合规，仅登记） |
| 域内分层违规 | **未发现** | 域根 store 件均零 `.tsx` import |
| 成环 | **未发现** | `settingRegistry ← appSettings`（单向）；`providerUrlAdapters` 无出向依赖 |
| 横切层反向依赖 | `base/store/appSettings.ts:18` → `settings/settingRegistry`；`base/store/cloudSync.ts:50-51` → `settings/accountsStore`/`providerStore` | 横切 `base/store` 反向依赖 settings 域（规则 2 风险）⇒ 交 TASK-028 复核（**若 `appSettings` 归位 settings 则此环自解**） |

### 判据缺口

3. **D1 与 D2 死锁**（settings 最重）：D1 要域根散件归零，D2 要 ≥3 件才许建子目录；本域状态件实测仅 2 件 ⇒ 无合法落点。→ 建议裁判：① 先执行计划 §3「`appSettings` → `settings/`」（向 TASK-028 要件），② 或为「声明表/常量表/状态」这类**低件数高内聚**的职责设 D2 豁免条款。
4. **L1 两条冲突无优先级**：`AgentChatSettings`（界面=设置页 / 数据=agent store）、`SkillSettings`（界面=设置页 / 数据=agent skillStore）、`creative`（界面=生成节点 / 数据=节点 data + creative 自有键）都出现「界面位置」与「数据落点」指向不同域。→ 建议 ADR-0040 补一条优先规则；**我方建议「界面装配位置优先」**（数据可被跨域 store 承载，界面装配点是唯一不可让渡的）。

### 交叉验证请求

| 件 | 请哪个域复核 | 复核对什么 |
| --- | --- | --- |
| `settings/providerStore.ts` | **agent**（TASK-026）/ **generate** / **scriptbox**（本域自查已做） | 是否判「并案（共享件）」。我方结论：不送出（界面在设置页 + `KEY_ACTIVE_API_ENDPOINT` 登记 `domain:'settings'`），但 fan-in 22 处、跨 4 域，请对方表态 |
| `base/store/appSettings.ts` | **base**（TASK-028） | 计划 §3 明定它属 `settings/`；实测仍在 `base/store/`，且被 `base/store/cloudSync.ts` 反向拉住。请 base 域确认可否归位 settings（**它是 `settings/store/` 能否达标的唯一前提**） |
| `base/store/cloudSync.ts` | **base**（TASK-028） | 它 import `settings/accountsStore`/`providerStore`（`cloudSync.ts:50-51`）—— 横切层反向依赖业务域（规则 2） |

### 计数（settings）

- 本域扫描件数：**12**
- 本域·合规：**7**
- 本域·域内错位：**5**
- 非本域：**0**
- 待核：**0**
- 成因分布：A **4** / B 0 / C **1**（`AccountsSettings`）/ D 0 / E 0 / F **1**（`providerUrlAdapters` 落点无据）/ G 0 / H 0
- 无 `refs` 输出的件：**无**（12 件全部有 ① 段输出）

---

# 三、`creative`（12 件 · 含 1 个 `.DS_Store`）

## 3.1 主表 · 域籍台账

| # | 件（相对路径） | 判定 | 应属域 | 应属域内落点 | 证据①界面位置 | 证据②数据落点 | 证据③refs ① 段原文 | 反证检查 | 成因代号 | 置信度 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `creative/index.ts` | **本域·合规** | `creative` | `creative/`（域根） | ——（门面，无界面） | ——（只 re-export 6 个符号） | `agent/canvas/agentCanvasHost.ts` · `image/nodes/ImageGenerate.tsx` · `text/TextGenerate.tsx` · `video/nodes/VideoGenerate.tsx` · `src/hooks/useNodeData.ts` | 门面件，D1 例外① | — | 高 |
| 2 | `creative/CreativeLibraryButton.tsx` | **本域·合规** | `creative` | `creative/`（域根 · 装配入口） | `image/nodes/ImageGenerate.tsx:802` · `text/TextGenerate.tsx:502` · `video/nodes/VideoGenerate.tsx:516` 三处 `<CreativeLibraryButton` | 宿主节点 `data.creativePresets`（`src/hooks/useNodeData.ts:150` `{ ...d, creativePresets: { ...dict, [presetId]: entry } }`） | `creative/index.ts` · tests ×7（`ImageGenerate.*`/`TextGenerate`/`VideoGenerate`/`TemplateNode.*`） | 域对外唯一 UI 入口（经门面导出） | —（D1 例外③ 口径待裁，见判据缺口⑤） | 高 |
| 3 | `creative/CreativeLibrary.tsx` | 本域·域内错位 | `creative` | `creative/parts/` | `creative/CreativeLibraryButton.tsx`（`import CreativeLibrary` 并渲染） | 无自有（`onApply` 上抛宿主；文件头 `:15` 明载「落胶囊/写 data 由入口组件完成」） | `creative/CreativeLibraryButton.tsx` | 本域 1 处渲染 | A | 高 |
| 4 | `creative/creativeCatalog.ts` | 本域·域内错位 | `creative` | `creative/lib/` | 经 `CreativeLibrary.tsx:23`（`catalogByKind, MJ_PRESETS`）间接 | 只读 `data/*.json`（SSOT，文件头 `:3` 明载「随包发布、只读」） | `creative/CreativeLibrary.tsx` · `creative/views/MjStyleBrowser.tsx` · `tests/unit/creative/presets.test.ts` | 本域消费 | A | 高 |
| 5 | `creative/creativePresets.ts` | 本域·域内错位 | `creative` | `creative/lib/` | 无（纯逻辑；但**门面已暴露** `normalizeChipFieldWrite`/`toDictEntry` 给域外） | 节点 `data.creativePresets` 字典形态真源（`useNodeData.ts:150` 写入的 `entry` 由 `toDictEntry` 定形） | `creative/CreativeLibrary.tsx` · `creative/CreativeLibraryButton.tsx` · `creative/creativeCatalog.ts` · `creative/index.ts` · `creative/views/PresetGridView.tsx` · `creative/views/PromptPresetView.tsx` · `tests/unit/creative/presets.test.ts` | 本域消费 | A | 高 |
| 6 | `creative/promptManager.ts` | 本域·域内错位 | `creative` | `creative/lib/` | `creative/views/PromptPresetView.tsx`（第 5 分区「我的提示词」） | `KEY_YIMAO_PRESET_PROMPTS` / `KEY_YIMAO_PRESET_RECENT`（`contracts.ts:254`/`:252`，经 `base/core/contentStore.ts`） | `creative/views/PromptPresetView.tsx` · `tests/unit/promptManager.test.ts` | 本域消费 | A | 高 |
| 7 | `creative/data/creativeCatalog.json` | **本域·合规** | `creative` | `creative/data/` | 经 `creativeCatalog.ts:25` import | 静态真值（217 style / 51 motion / 17 filter，只读） | `creative/creativeCatalog.ts` | 本域消费 | F（2 件未达 D2 ⇒ 判据缺口⑥） | 中 |
| 8 | `creative/data/mjStyleCatalog.json` | **本域·合规** | `creative` | `creative/data/` | 经 `creativeCatalog.ts:26` import | 静态真值（493 条三组，只读） | `creative/creativeCatalog.ts` | 本域消费 | F（同上） | 中 |
| 9 | `creative/views/MjStyleBrowser.tsx` | 本域·域内错位 | `creative` | `creative/parts/`（现 `views/` 不在 D3 白名单） | `creative/CreativeLibrary.tsx` 渲染（MJ 分区） | 无自有（`onApply` 上抛） | `creative/CreativeLibrary.tsx` | 本域 1 处渲染 | A · F | 高 |
| 10 | `creative/views/PresetGridView.tsx` | 本域·域内错位 | `creative` | `creative/parts/` | `creative/CreativeLibrary.tsx` 渲染（风格/滤镜/运镜 3 分区） | 无自有 | `creative/CreativeLibrary.tsx` · `tests/unit/presetGridHover.test.tsx` | 本域 1 处渲染 | A · F | 高 |
| 11 | `creative/views/PromptPresetView.tsx` | 本域·域内错位 | `creative` | `creative/parts/` | `creative/CreativeLibrary.tsx` 渲染（第 5 分区） | 无自有（经 `promptManager` 读写，但写动作在其内部） | `creative/CreativeLibrary.tsx` | 本域 1 处渲染 | A · F | 高 |
| 12 | `creative/.DS_Store` | 待核（口径缺口） | —— | —— | —— | —— | 未跑 refs（非源码件） | macOS Finder 元数据，非源码；`find` 出现故登记 | F | 高 |

## 3.2 本域特有事项结论（任务书 §3 的 8–9）

### ⑧ `creative` 到底是不是一个域（成因 F · 必答）—— **是独立域**

按 **L1** 两条逐条实测：

**① 界面长在哪**：创作库面板 = 全屏层（`CreativeLibraryButton.tsx:20` 用 `base/panels/FullscreenModal` 挂模态层），由**三个不同业务域的节点**各自的「预设」按钮打开：
- `image/nodes/ImageGenerate.tsx:802`
- `text/TextGenerate.tsx:502`
- `video/nodes/VideoGenerate.tsx:516`
- 另有 `agent/canvas/agentCanvasHost.ts:29`（import 门面符号 `normalizeChipFieldWrite`）

⇒ **≥3 个业务域**（image / text / video / agent）直接消费，**不可能是 image 或 canvas 的独占部分**（否则只有一域渲染）。

**② 数据落到哪**：
- 选中结果 → 宿主节点 `data.creativePresets` 字典（真源 `creativePresets.ts`，写入点 `src/hooks/useNodeData.ts:150`）—— 跨 image/text/video 三域节点，**不归任何单一节点域**；
- 「我的提示词」分区有**本域自有存储键** `KEY_YIMAO_PRESET_PROMPTS` / `KEY_YIMAO_PRESET_RECENT`（`contracts.ts:254`/`:252`，读写在 `creative/promptManager.ts`）。

⇒ 有独立界面 + 独立数据落点（自有存储键）⇒ **判：是独立域**。

**反证（为什么不能判归 image）**：`image/nodes/ImageGenerate.tsx:802` 确实渲染 `CreativeLibraryButton`，但同一按钮也被 text/video 渲染 —— 若判归 image，则 text/video 跨域反向依赖 image 的分节件；且 L3 真横切需「零业务语义」，而本域有明确的业务语义（217 风格 / 493 MJ 码 / 运镜预设）⇒ **既不属 image，也不是横切件** ⇒ 独立域成立。

**域内结构方案（子域划分 + 达标性）**：

| 目标子目录 | 件数 | 逐件 | 职责 | D2 达标性 | D4 层位 |
| --- | --- | --- | --- | --- | --- |
| `creative/`（域根） | 2 | `index.ts`（门面 · D1 例外①）+ `CreativeLibraryButton.tsx`（对外装配入口 · 例外③ 待裁） | 门面 + 入口 | —— | —— |
| `creative/lib/` | 3 | `creativeCatalog.ts` · `creativePresets.ts` · `promptManager.ts` | 归一化 / 纯逻辑 / 本地库（**均零 React**） | 3 ≥ 3 ✓ | 能力层 |
| `creative/parts/`（**现 `views/` 改名并入**） | 4 | `CreativeLibrary.tsx` · `MjStyleBrowser.tsx` · `PresetGridView.tsx` · `PromptPresetView.tsx` | 面板内视图/零件（全部只被 `CreativeLibrary` 消费） | 4 ≥ 3 ✓ | 机制层 |
| `creative/data/` | 2 | `creativeCatalog.json` · `mjStyleCatalog.json` | 静态真值 | **2 < 3 ✗**（判据缺口⑥） | 能力层 |

- **`views/` 必须改名**：D3 的十二个子目录名里**没有 `views/`**（实测 `creative/views/` 已存在、`videoEditor/ui/ui/` 也在自造名）⇒ 既是「目录名不在白名单」，也说明 D3 缺 `views/` 这一常见职责。建议：`views/` 三件并入 `parts/`（面板内视图都是 `CreativeLibrary` 的零件）。
- **`CreativeLibraryButton` 为什么留域根**：它是 `index.ts` 门面唯一对外暴露的 UI 入口，被 image/text/video 三域直接渲染 —— 功能等价于「装配入口」。但 D1 例外③ 只认「被 `App.tsx` 直接消费」⇒ 严格说它是散件 ⇒ 判据缺口⑤ 请裁判裁定是否扩展例外③。

### ⑨ `creative-library.css` 一类样式件的落点

**实测**：该文件**不在 creative 域内**，而在 `src/components/base/panels/creative-library.css`；消费者 2 处：
- `creative/CreativeLibrary.tsx:24` `import '../base/panels/creative-library.css';`
- `base/panels/ImportMediaModal.tsx:82` `import './creative-library.css';`

⇒ **结论：不随 creative 走，留在 `base/`（现 `base/panels/`；若要归位建议 `base/ui/`）**。三条理由：
1. **它不是 creative 独占** —— 被 2 个域消费（creative + 导入媒体弹窗/resource 侧），搬进 `creative/` 会让另一消费方反向依赖业务域；
2. **L3 也不达标** —— 真横切需 ≥3 个业务域消费，实测 2 个，且 `.cl-*` 类名带业务语义（"创作库"）⇒ 也不是 `base/ui` 意义上的通用 kit；
3. **L1 对它失效** —— CSS 既无「界面位置」也无「数据落点」⇒ 判据缺口⑦。

## 3.3 `creative` 末尾小节

### 认领域分布

| 目标域 | 件数 | 件清单 |
| --- | --- | --- |
| （无）**本域零送出** | 0 | —— |

### 域内错位表

| 件 | 现子目录 | 应入子目录 | 依据 |
| --- | --- | --- | --- |
| `CreativeLibrary.tsx` | 域根 | `parts/` | 面板壳，只被 `CreativeLibraryButton` 消费 |
| `creativeCatalog.ts` | 域根 | `lib/` | 归一化层，零 React |
| `creativePresets.ts` | 域根 | `lib/` | 纯逻辑/类型层，零 React |
| `promptManager.ts` | 域根 | `lib/` | 本地库（本域 store 仅 1 件 <3 ⇒ 不建 `store/`，并入 `lib/`） |
| `views/MjStyleBrowser.tsx` | `views/` | `parts/` | `views/` 不在 D3 白名单 |
| `views/PresetGridView.tsx` | `views/` | `parts/` | 同上 |
| `views/PromptPresetView.tsx` | `views/` | `parts/` | 同上 |

### 域根散件清单（现状 6 件 · 目标 2）

| 件 | 现位置 | 应入子目录 | 命中哪条 D1 例外 |
| --- | --- | --- | --- |
| `index.ts` | 域根 | 留域根 | **例外①**（门面） |
| `CreativeLibraryButton.tsx` | 域根 | 留域根（建议） | **例外③ 待裁**（被 image/text/video 三域直接渲染的装配入口，非 `App.tsx`） |
| `CreativeLibrary.tsx` | 域根 | `parts/` | 无例外 |
| `creativeCatalog.ts` | 域根 | `lib/` | 无例外 |
| `creativePresets.ts` | 域根 | `lib/` | 无例外 |
| `promptManager.ts` | 域根 | `lib/` | 无例外 |

### 假子域 / 域内分层违规 / 成环

| 现象 | 涉及件 | 依据 |
| --- | --- | --- |
| **目录名不在 D3 白名单** | `creative/views/`（3 件） | D3 十二个子目录名无 `views/`；改名 `parts/` 即可达标（4 件） |
| 域内分层违规 | **未发现** | `lib/` 3 件零 React；`parts/` → `lib/` 单向 |
| 成环 | **未发现** | `creativeCatalog → creativePresets` 单向；`views/* → creativeCatalog/creativePresets/promptManager` 单向 |
| 跨域直连 | `creativePresets.ts:25` → `canvas/shell/promptChips.ts` | 直连 canvas `shell/` 而非门面；属全仓惯例，本轮不判 |

### 判据缺口

5. **D1 例外③ 的范围**：现只认「被 `App.tsx` 直接消费」，但 `creative/CreativeLibraryButton.tsx` 被 image/text/video **三域**直接渲染（比 App.tsx 更"入口"）。→ 建议把例外③ 扩为「被域外直接渲染的域装配入口」。
6. **JSON 静态数据是否豁免 D2**：`creative/data/` 只有 2 件 JSON（真值数据，随包发布）⇒ 严格按 D2 不许建 `data/`。→ 建议为「静态真值数据」设门槛豁免（否则此类件永远无处可放）。
7. **样式件（CSS）无归属判据**：L1 两条（界面/数据）对 CSS 均不适用；`creative-library.css` 被 2 个域消费（creative + `base/panels/ImportMediaModal`）⇒ 既不属 creative 独占、也不达 L3 横切门槛。→ 建议补一条「样式/静态资源的归属 = 唯一消费域；被 ≥2 域消费则进 `base/ui/` 并去掉业务类名前缀」。**我方结论：留在 `base/`（建议 `base/ui/`），不可搬进 `creative/`。**
8. **contracts 登记的 `domain` 值不在可判目标域全集**：`KEY_YIMAO_PRESET_PROMPTS`/`KEY_YIMAO_PRESET_RECENT` 写 `domain:'preset'`（全集里没有 `preset`），`store` 字段还写 `promptManager.js`（实际 `creative/promptManager.ts`）⇒ **成因 G**。→ 建议改 `domain:'creative'` + `store:'creative/promptManager.ts'`。

### 交叉验证请求

| 件 | 请哪个域复核 | 复核对什么 |
| --- | --- | --- |
| `base/panels/creative-library.css` | **base**（TASK-028）+ **resource**（TASK-029，`ImportMediaModal` 侧） | 它是 creative 私有视觉但被 `base/panels/ImportMediaModal.tsx:82` 复用 ⇒ 落点归 `base/ui/` 还是 creative？我方：**留 base** |
| `creative/CreativeLibraryButton.tsx` | **image**（TASK-023）/ **text** / **video**（TASK-024） | 三域都直接渲染它（`:802`/`:502`/`:516`）—— 是否认可它作为 creative 的域外装配入口（我方判合规，需对方认领"继续这样用"） |
| 线索 `TD-03-21` 回应 | **resource**（TASK-029） | 素材"一物覆盖三处"（`resourceStore` + 素材 UI + `librarySource`）：creative 域内**未发现**素材类重复实现（本域只做"风格/滤镜/运镜/MJ/提示词"预设，不碰素材库）⇒ 本域无 H 风险 |

### 计数（creative）

- 本域扫描件数：**12**（含 `.DS_Store`）
- 本域·合规：**4**（`index.ts` · `CreativeLibraryButton.tsx` · `data/` ×2）
- 本域·域内错位：**7**
- 非本域：**0**
- 待核：**1**（`.DS_Store` · 非源码件，建议删除 —— 本轮不动）
- 成因分布：A **6** / B 0 / C 0 / D 0 / E 0 / F **3**（`data/` ×2 门槛 + `.DS_Store`）+ 3（`views/` 目录名不在 D3，与 A 并列计）/ G 0 / H 0
- 无 `refs` 输出的件：**1** —— `creative/.DS_Store`（非源码件，未跑 refs）

---

# 四、三域汇总

| 域 | 扫描件数 | 本域·合规 | 域内错位 | 非本域 | 待核 | 域根散件数 | 主要成因 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `scriptbox` | 20 | 1 | 19 | 0 | 0 | **19**（域根 20 件，`ScriptBoxNode` 命中例外②） | A（历史平铺未跟进 19） |
| `settings` | 12 | 7 | 5 | 0 | 0 | **4**（域根 5 件，`SettingsFrame` 命中例外③） | A 4 · C 1 · F 1 |
| `creative` | 12 | 4 | 7 | 0 | 1 | **4**（域根 6 件，`index.ts` 例外① + `CreativeLibraryButton` 例外③待裁） | A 6 · F 3 |
| **合计** | **44** | **12** | **31** | **0** | **1** | **27** | A 29 · C 2 · F 5 · G 2（登记项，不计件） |

**读法**：
- **零送出 ≠ 没查出问题** —— 44 件里 31 件是「域内错位」（属本域但子目录不对），本批真正待搬的几乎全在**域内**，三个域**全部没有门面以外的域根合规件**，`scriptbox` 与 `settings` 还**都缺 `index.ts` 门面**。
- **非本域 = 0** 是实测结果，不是没查：三个高危疑似件（`Select.tsx` / `SkillSettings.tsx` / `providerStore.ts`）都走了门闩第 4 条，全部反证命中（本域仍在渲染/消费），按总纲 §4「有一处 ⇒ 不许报非本域」。

---

# 五、给裁判的四条硬提醒

1. **`KEY_SCRIPTBOX_PLAYBOOKS` 的 `domain:'settings'` 判错**（`contracts.ts:363`），应改 `'scriptbox'` —— 成因 G（登记与真源自相矛盾：`store` 字段已指向 scriptbox 文件）+ 次因 C。
2. **`KEY_YIMAO_PRESET_PROMPTS`/`KEY_YIMAO_PRESET_RECENT` 的 `domain:'preset'` 不在可判目标域全集**（`contracts.ts:424`/`:432`），应改 `'creative'`，`store` 改 `creative/promptManager.ts` —— 成因 G。
3. **白名单（成因 B）**：`scripts/strict-src-whitelist.json:20` 登记的是**目录前缀** `src/components/scriptbox/`。
   - **域内**建子目录（`scriptbox/lib/`·`ui/`·`parts/`·`editors/`·`contract/`）**仍在前缀覆盖内，不会缩水**；
   - 但**任何送出件**（如 `Select.tsx` 若判并案去 `base/ui`）会**当天脱离白名单** ⇒ 搬迁必须同批同步白名单并重跑 `strict-src` 闸（2026-09-19 已发生过一次 15→4 的缩水事故）。
4. **两个域缺门面**：`scriptbox/` 与 `settings/` 实测均无 `index.ts`（`creative/` 有，可作范式参考）。建议在搬迁窗口内一并补，否则 D1 例外① 长期空缺。

# 六、验收自测

- [x] 三个域 `find` 输出的 **44 件全部**出现在各自主表（`.DS_Store` 单列并说明）。
- [x] 每条「非本域」凑齐四件证据 —— **本轮零条非本域**，故不适用；三个高危疑似件已在 §2.2⑦ / §1.2② 逐条走完四件证据 + 门闩。
- [x] 反证检查逐件做：`SkillSettings`（本域渲染命中）、`AgentChatSettings`（本域渲染命中）、`providerStore`（本域渲染命中）、`Select`（本域渲染 + base 无同名件）。
- [x] 每条都填了成因代号，无形容词（A/C/F/G 四类，均对应 §6 机理表）。
- [x] 无一条依据是「名字叫 xxx」或「目录在 xxx」—— 全部依据 `refs` ① 段实测 + 渲染行 `文件:行` + 数据落点 `文件:行`。
- [x] 未改本文件以外的任何文件（无 `git mv`、未动 `src/**`、未新建脚本；`refs` 为只读查询）。
- [x] `scriptbox` 给了子域划分方案（5 个子目录 · 逐件去处 · 逐项 D2 达标性与 D4 层位）。
- [x] `creative` 是否成域给了明确结论（**是独立域**）+ L1 两条实测证据（≥3 域渲染 + 自有存储键）。
- [x] `Select.tsx` 归属给了明确结论（**scriptbox 域内 UI 件 → `scriptbox/ui/`**，非横切）+ 四件证据 + L3/L4 演算。
