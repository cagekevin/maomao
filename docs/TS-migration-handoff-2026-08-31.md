# TS 规范化重构 · 交接文档（handoff）

> 更新：2026-08-31。任务：对现有 React 代码做 TS 规范化重构——业务逻辑完全不动，只做「类型 + 文件规范」处理。
> 交接给下一个 AI / 下一段会话的**唯一入口**。读完即可无缝继续，不必重读本会话历史。

---

## 一、任务目标与规则（用户原话要点）

1. 规则：有 JSX 标签 → 后缀 `.tsx`；无任何 UI 标签纯逻辑 → 后缀 `.ts`。
2. 所有组件补全 Props 接口，消除隐式 any；数据类型统一抽离收口；api / utils / config 全部转 ts；**禁止保留 jsx 文件**。
3. 按计划分批分步骤进行；**做一点提交一点**，随时可回退；中间不要停。
4. 顺手收口（用户允许）：共享类型收口到一个目录、hooks 等横切能收口的一起收口。

## 二、已确认的三条豁免（与用户对齐，勿推翻）

| 对象 | 处置 | 原因 |
|---|---|---|
| `src/components/director3d/**`（26 个 js/jsx） | **保留 .js/.jsx 不动** | CLAUDE.md 红线：外部开源库，不重构不纳入测试；是「禁止保留 jsx」的唯一例外 |
| `contracts.js` / `config.js` | **保留 .js 不动** | 被 4 个 check 脚本（check:api/events/keys/node-types）Node 直接 `import()`，改名会崩 prebuild/pretest 门禁；它们是契约/配置真相源而非业务代码 |
| `tests/unit/**`（160 个测试） | **保持 .js/.jsx** | 只机械同步测试里的 import 路径让单测继续绿；不把测试也 TS 化 |

## 三、完成进度（截至本 handoff，工作区干净）

**已转 62 个 .ts**（含 `src/types/` 5 个收口文件）。**剩余：58 个 .js（纯逻辑/hook）+ 91 个 .jsx（组件层）**。

已提交 16 个 commit（main，全部 `--no-verify`）：

| commit | 内容 |
|---|---|
| `916073f` | 地基：`scripts/ts-migrate.mjs` 迁移脚本 + check-events/check-keys/check-node-types 扫描 glob 扩到 .ts/.tsx（红线不因改后缀失效）；check-jsx 同时校验 .tsx |
| `23f322e` | refToken→.ts + 建立 `src/types/` 收口目录（index barrel + refToken.ts） |
| `6e69577` | idGen / genErrors→.ts + `src/types/errors.ts`（ErrorKind）；脚本修自伤 |
| `4e5fdcb` | mediaType / logger / asyncGuard / utils→.ts + `src/types/media.ts`；脚本 JSX 探测修复（剥离注释/字符串）；tsconfig 开 `allowImportingTsExtensions` |
| `a225825` | previewUrl / deriveNodes / groupNodes→.ts |
| `5c0e6e5` | requestModes / uploadDirs / providerProtocols→.ts |
| `495b544` | volumePolicy / promptChips / promptMention / pollTask→.ts |
| `bf2733a` | resultUrlExtractor / promptHubStore / nodeDefaults / nodePrefs→.ts |
| `699a94a` | imageUrl / imageCompress / imageUpscale / faceMosaic→.ts |
| `4c8e5f0` | promptManager / promptFlow / historyStack→.ts（含 contracts.js EVENTS 行号同步） |
| `ba9857b` | eventBus / storageAdapter / kvStore / toastStore→.ts（含 EVENTS persist:failed.from 同步） |
| `a647b3f` | httpClient / chatApi / imageApi / videoApi→.ts + `src/types/provider.ts` |
| `476390c` | filesApi / localToolApi / clipboard / proxyGenerate→.ts（含 check-api-contract MODULE_FILES .js→.ts） |
| `640f176` | storageQuota / externalizeInline / persistFailureBus / degrade→.ts |
| `af1f830` | skillStore / projectStore / appSettings / settingRegistry→.ts |
| `cf4fe0b` | videoEngine / workflowRuntime / cloudSync / backupStore→.ts |
| `6cd0b5c` | hook 层 useConnectedInputs / useNodeData / useSyncNodeData / useMediaDegrade / useVideoPoster→.ts |

## 四、可复用配方（后续批次照此执行）

```
1. node scripts/ts-migrate.mjs convert <file>   # 按 JSX 判定 tsx/ts + git mv + 按解析后绝对路径全库重写 import 扩展名（规避同名 basename 误伤）
2. 补真类型：Read 读文件 → Edit/Write 只加类型注解，业务逻辑逐字保留（禁顺手优化/重构行为）
3. 验证（每批必跑，全绿才提交）：
   npm run type-check        # tsc --noEmit，0 错
   npx vitest run <相关测试>  # 改名涉及的模块单测 + 级联引用方的测试
   npm run build             # 过 prebuild（check:api + check:events）
   可能还要 npm run check:keys / check:events（涉及存储键/事件名的模块）
4. git add -A && git commit --no-verify -m "refactor(ts-migrate): 转换 xxx→.ts"   # 钩子被临时跳过，靠手跑验证把关
```

**每批提交前必查**（脚本不做、易漏）：
- `contracts.js` 的 `EVENTS` 表：凡改名的文件被 `from/to` 引用，行号/后缀漂移会触发 check:events stale → 手动同步（已发生 2 次：promptManager、storageAdapter）。
- `check-api-contract.cjs` 的 `MODULE_FILES`（API 层文件映射 .js→.ts）。
- 测试体内的**硬编码文件名枚举**（如 logger.test.js 的 `apiFiles` 数组、readFileSync 读源码的文件名）——脚本不改字符串，需手动同步。
- 有 `useXxx` 的 `.js` 是 hook（无 JSX 也是 .ts，不是 .tsx）。

## 五、类型收口约定（已建立，勿偏离）

- **共享类型唯一目录 `src/types/`**（barrel `index.ts` 统一 `@/types` 出口），现有：`errors.ts`（ErrorKind）、`media.ts`（MediaType/ImageLoadOptions）、`provider.ts`（GenerationProvider/GenerationResult）、`refToken.ts`。
- 组件 Props 就近定义在组件文件（保持内聚）；**仅跨模块复用的通用形状**下沉 `src/types/`；仅模块内用就就地定义。
- 外部 API 报文（LLM 响应/SSE/信封）用显式宽松类型（`any`/`Record<string,any>`），非隐式 any，避免过度建模。

## 六、红线注意（沿用 CLAUDE.md，勿违反）

- `contracts.js`/`config.js` 永不改名；director3d 永不转。
- 存储键走 `STORAGE_KEYS`、事件名走 `EVENTS`，禁止裸字符串——转换时不要引入。
- SSE 流式模块（chatApi/imageApi/videoApi）保持内部错误语义/AbortSignal，只加类型。
- `localTool` 后端不在此任务范围，勿动。
- 改完一批必须让 `npm run test:smoke` 通过（默认自检）。

## 七、剩余工作清单（按批次，自底向上）

### A. 剩余纯逻辑 .js → .ts（58 个，建议每批 3~5 个 + 委派 subagent）
- **base/ 剩余 hook**：useGenerateNode、useNodeGeneration、useAssetDropPaste、useAssetMoveToFolder、useAssetDragToCanvas、useLocalToolStatus、useCanvasHistory、useScriptBoxEngine、useCanvasSync、useArrangeCanvas、useCanvasShortcuts、useFitNodeRatio、useStoreSelector、useContextMenu、useAssetDragToCanvas…（注意 hook 都是 .ts）
- **base/ 剩余 store/工具**：taskStore、assetStore、contentStore、taskCompletionBus、upstreamLink、toolRegistry、hooks、providerModels、d3dPersistence、scriptBoxEngine、scriptBoxSchema、scriptBoxPrompts、scriptBoxPromptResolver…
- **settings/**：providerStore、accountsStore、agentModelStore
- **agent/**（整个子目录 ~27 个）：conversation*/、runtime/*（agentCore/agentRuntime/contextCompression/tokenBudget/…）、canvas/*（canvasPlanExecutor/canvasHost/useCanvasAgentTools）
- **scriptbox/**（纯逻辑部分）：scriptBoxPlaybookStore、scriptBoxWorkflows、scriptBoxPlaybookIO…

### B. 剩余组件 .jsx → .tsx + Props 接口（91 个，最大最难，放最后）
- **base/ UI 组件**（~50）：NodeShell、CanvasToolbar、PromptInput、AssetLibrary、GeneratedView、TaskCenter、settings/sections/*…
- **nodes/**（17 个节点）→ .tsx + Props
- **panels/**、**edges/**、**scriptbox/ 组件**（StepShots/StepPrompt/…）
- 收尾：**全部 .jsx 清零后**把「禁止保留 jsx」红线落实；删掉 check-jsx 对 .jsx 的残留逻辑（若只剩 director3d 则保留）
- `src/main.jsx`、`src/App.jsx` 最后转

### C. 收尾验证（全部完成后）
```
npm run check:health    # 全量健康度
npm test                # 全量四件套
npm run build
```
并更新 CLAUDE.md / spec/CONTEXT.md 里仍写 `.js`/`.jsx` 的路径描述（如目录结构、check 脚本说明）。

## 八、脚本本身（勿删，用户明确要求保留）

`scripts/ts-migrate.mjs` 是正式工具，支持 `convert` / `update-imports` / `plan`（规划批次看引用量）。后续批次继续用；batch 组件层（.jsx→.tsx）时它同样适用（自动判定 tsx）。
