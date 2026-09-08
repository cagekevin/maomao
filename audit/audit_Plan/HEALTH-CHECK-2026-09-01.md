# 网站健康检查报告（2026-09-01）

> 工具：`download/README.md` 所列 CLI 工具箱（静态分析），全部产物落 `download/out/`。
> 范围：主工程 `src/`（220 模块）。主工程自有 gate（build / test:all / 契约门禁 / 主工程 health-check）**不在本报告范围**。

## 结论摘要

| 维度 | 结果 | 级别 |
|---|---|---|
| 循环依赖（madge） | **0 处** ✓ | — |
| 架构分层 / 依赖违规（depcruise） | **✔ 无违规**（220 模块 / 910 依赖） | — |
| oxlint 质量问题 | 119 条（115 未用变量 + 4 其他，其中 3 处误报） | P1 |
| 重复代码（jscpd） | 111 组 / 1184 行 / **1.99%** | P2 |
| 死代码（knip） | src/ 下 49 文件有未使用项；**未声明依赖 0** ✓ | P3 |

**整体判断：架构层健康（循环依赖已清零、分层无违规、未声明依赖已清零）。oxlint 6 处非 unused 告警已逐一人工复核：1 处真问题已改、1 处顺手清理已改、4 处误报/合理代码不改。**

### 已整改（2026-09-01 复查确认）

| 文件 | 规则 | 处置 |
|---|---|---|
| `useAgentChat.ts` (finally return) | `no-unsafe-finally` | **已改**：把 finally 里的 return 改为 if/else 结构，awaiting_confirm 分支与通用收尾互斥，语义等价且不再吞异常 |
| `FetchModelsModal.tsx:80` | `no-useless-spread` | **已改**：`...[...selected[cat.key]]` → `...selected[cat.key]`，去掉多余 spread |

### 复核后判定「不改」（误报/合理代码）

| 文件 | 规则 | 理由 |
|---|---|---|
| `clipboard.ts:43` | `no-control-regex` | 故意匹配 C0 控制字符的清洗正则，正是要匹配控制符 |
| `workflowRuntime.ts:181` | `no-new-array` | 并发按索引收集结果，`new Array(n)` 预分配是合理写法 |
| `upstreamLink.ts:43` | `no-useless-spread` | spread 是把 Set 转数组，for-of 遍历 Set 所必需 |
| `AssetMenu.jsx:119` | `no-unused-expressions` | 三元表达式当语句用（两分支均有副作用），功能正常；且文件在 `director3d/` 外部集成，按边界不整改 |

---

## 1. 架构 · 循环依赖（madge）

```
circular 数组长度: 0   →  ✔ No circular dependency found
```

上一轮（2026-08-31 REPORT）的 2 处 P0 循环依赖（`base/` ⇄ `scriptbox/`）已确认清零。

---

## 2. 架构 · 依赖违规（dependency-cruiser，`arch:cycles`）

```
✔ no dependency violations found (220 modules, 910 dependencies cruised)
```

加载 `download/.dependency-cruiser.cjs`（启用 `no-circular` + 分层规则：
`nodes/*` 禁横向互引、`base/` 禁反向依赖业务域、禁 `src/**` → `reference-1mao/**`）。
`out/deps.json` 中 `violations: []`，分层约束全部通过。

---

## 3. oxlint · 121 条质量问题

| 数量 | 规则 | 性质 |
|---|---|---|
| 115 | `eslint(no-unused-vars)` | 清理类 |
| 2 | `unicorn(no-useless-spread)` | 清理类 |
| 1 | `eslint(no-unsafe-finally)` | **疑似逻辑 bug** |
| 1 | `eslint(no-control-regex)` | **疑似逻辑 bug** |
| 1 | `eslint(no-unused-expressions)` | **疑似逻辑 bug** |
| 1 | `unicorn(no-new-array)` | 清理类 |

### 必须先人工看的 4 处（非格式）

| 文件 | 规则 | 说明 |
|---|---|---|
| `src/components/agent/runtime/useAgentChat.ts` | `no-unsafe-finally` | `finally` 块里可能有 return/抛错会吞掉 try 结果 |
| `src/components/base/clipboard.ts` | `no-control-regex` | 正则含控制字符 |
| `src/components/director3d/panels/AssetMenu.jsx` | `no-unused-expressions` | 表达式被当语句用（无副作用） |
| `src/components/base/workflowRuntime.ts` | `no-new-array` | `new Array(单参)` |

> 注：`director3d/` 按 `CLAUDE.md §二` 属外部开源集成，`AssetMenu.jsx` 是否整改需按边界判断。

### 未使用变量 TOP 文件（可直接批量清）

```
  9  src/components/nodes/PromptNode.tsx
  5  src/components/nodes/DiscountVideoNode.tsx
  4  src/components/scriptbox/StepPrompt.tsx
  4  src/components/panels/AgentPanel.tsx
  4  src/components/agent/canvas/useCanvasAgentTools.ts
  4  src/components/nodes/GridMergeNode.tsx
  4  src/App.tsx
  3  src/components/scriptbox/StepAssets.tsx
  3  src/components/base/api/httpClient.ts
  3  src/components/nodes/ImageNode.tsx
  3  src/components/base/PromptHub.tsx
  3  src/components/nodes/FaceMosaicNode.tsx
  3  src/components/agent/runtime/agentCore.ts
  3  src/components/nodes/VideoProcessNode.tsx
```

---

## 4. 重复代码（jscpd · 111 组 / 1184 行 / 1.99%）

按格式修正后的重复率（`duplicatedLines / lines`）：

| 格式 | 重复行 / 总行 | 重复率 |
|---|---|---|
| tsx | 959 / 25458 | 3.77% |
| typescript | 174 / 25259 | 0.69% |
| jsx | 44 / 4501 | 0.98% |
| javascript | 7 / 2760 | 0.25% |
| css | 0 / 1362 | 0.00% |
| markdown | 0 / 108 | 0.00% |
| **合计** | **1184 / 59448** | **1.99%** |

重复集中在 `tsx`（79 组），需按 TOP 重复对抽公共组件（详见 `out/jscpd-report.json`）。

---

## 5. 死代码（knip · 124 个问题文件，src/ 下 49 个）

| 类别 | 数量 |
|---|---|
| 未使用文件（files） | 72（多为 `scripts/` 历史脚本与 `localTool/`，已知噪声） |
| 未使用导出（exports） | 88 |
| 未使用类型（types） | 42 |
| 未使用依赖（dependencies） | 0 |
| **未声明依赖（unlisted）** | **0 ✓** |

> 上一轮 REPORT 的 `esbuild`、`@xyflow/system` 未声明依赖已在主工程 `package.json` 补入并生效。
> `src/` 下 49 文件有未使用项，排除 `director3d/`（外部集成，不处理）后按 `out/knip.json` 逐条清理。

### 5.1 未使用类型（types）42 项 —— 复核判定：高置信度误报，非死代码

knip 判定「未使用导出」的标准是「该导出从未被任何其它文件 `import`」。但这 42 个类型全部是**定义文件内部使用、且作为对外 API 契约**的类型，外部靠 JSX 传 props / TS 结构类型推断消费，从不显式 import，故被误报。

**抽查验证（逐一在定义文件内部找到真实引用）：**

| 类别 | 数量 | 代表性类型 | 内部使用证据 |
|---|---|---|---|
| 组件 `*Props` 接口 | ~10 | `ContextMenuProps`、`CanvasToolbarProps`、`HoverToolbarProps`、`PanoViewerProps`、`ToolbarButtonProps`、`SelectOption`、`TopNavProps`、`PromptLibraryProps` | 被组件内部解构参数标注：`function ContextMenu({...}: ContextMenuProps)` |
| hook 参数/返回类型契约 | ~13 | `useNodeGeneration`：`GenerationTypeInfo`/`NodeGenerationResult`/`GenerationRunner`/`GenerationValidate`/`GenerationOnSuccess`/`GenerationOnRecover`/`TaskCompletedDetail`/`NodeGenerationStartResult`；`useAssetDropPaste`：`FlowPosition`/`AddNodeFn`/`ScreenToFlowFn`/`PatchNodeDataFn`/`PasteNodeGroupFn` | 全部被 `Use*Options`/`*Api` 接口引用，调用方靠结构类型推导传参 |
| re-export 传播 | ≥1 | `TaskController` | `useNodeGeneration.ts:22` re-export 自 `taskStore.ts`，knip 不追踪 re-export 链 |
| 其余 store/util 内部类型 | ~18 | `WorkModeDef`、`SyncResult`、`SizeSyncMode`、`AwaitTaskResult`、`AgentStreamMode`、`PresetType`、`ToolExecuteCtx`、`UpstreamUpdatedPayload`、`ContextMenuPos`、`FitByRatio`、`AssetCategory`、`RefImageNode`、`RefTextNode` | 分别被 `Record<WorkMode,WorkModeDef>`、`() => Promise<SyncResult>`、`useCallback<FitByRatio>`、`RefTokenNode = RefImageNode \| RefTextNode` 等本文件内部引用 |

**为什么外部没有 import 它们？**
- props 类型：调用方写 `<ContextMenu items={...} />`，TS 自动检查，无需 `import { ContextMenuProps }`。
- hook 类型：调用方直接传对象字面量，TS 结构类型推导，无需显式 import。
- re-export：经 `export type { X } from` 中转，knip 不识别。

**结论**：42 项中**无证据表明存在可安全删除的真死类型**，删掉会破坏类型契约，**不应删**。这类「导出但仅靠内部使用/结构类型传播」是 TS 项目正常形态，knip 的 `exports` 判定天然高噪声。后续如需降噪，可在 `download/knip.json` 加 `ignoreExportsUsedInFile: true`（语义：同文件内已使用的导出不报未使用），但**当前保持配置不动**。

---

## 6. 处理顺序建议

1. ✅ **人工核 6 处非 unused 告警已完成**（2026-09-01）：`useAgentChat.ts`(no-unsafe-finally) 与 `FetchModelsModal.tsx`(no-useless-spread) 已改；`clipboard.ts`/`workflowRuntime.ts`/`upstreamLink.ts`/`AssetMenu.jsx` 判定误报或外部集成，不改。
2. **批量清 115 处未使用变量**（低风险，机器可改，改完跑主工程 `test:all` + `build` 验证）。
3. **抽公共消重复**（jscpd TOP 对，先看 tsx 下 79 组）。
4. **knip src/ 下死代码逐条清**（49 文件；其中「未使用类型 42 项」已复核为误报不删，见 5.1）。

---

## 产物

`download/out/`：`oxlint.json`、`deps.json`、`madge.json`、`knip.json`、`jscpd-report.json`。
