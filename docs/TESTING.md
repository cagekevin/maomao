# 原型测试地基（react-nodes）

> 本目录的测试体系，作为原型（`prototypes/react-nodes`）开发 / 提交 / 交付前的质量门禁。
> 借鉴了原产品（根目录 `scripts/`）的 health-check / safety-net 思想，并按原型（jsx + vite + 插件）做了适配。

## 一、快速上手

```bash
npm test                 # 等价 npm run test:all：跑统一测试门禁（推荐）
npm run check:health     # 工程健康度全量检查（含构建 + 测试 + TDZ + dist 基线）
npm run build            # 构建插件包（dist/）
```

日常改代码后，提交前跑一次 `npm test` 即可。

## 二、命令总览

| 命令 | 说明 | 阻塞? |
|---|---|---|
| `npm run test:smoke` | 静态检查：JSX 语法 / ReactFlow API 误用 / 节点注册 / 依赖 | 是 |
| `npm run test:unit` | **vitest 全量单元测试**（`tests/unit/` 下 24 文件/244 用例：剧本盒引擎/AI 工具/纯函数/管线契约等） | 是 |
| `npm run test:regression` | SSR 渲染 4 个核心节点 + 断言关键结构 class（能渲染不崩） | 是 |
| `npm run test:tools` | Agent 工具层验证（create/delete/update/connect/read_canvas） | 是 |
| `npm run test:all` | **统一门禁**：smoke + vitest全量单测 + regression + tools 一次跑完，任一失败退出码 1 | 是 |
| `npm test` | 等价 `test:all` | 是 |
| `npm run check:health` | **工程健康度全量检查**（见下节） | 是 |

## 三、check:health 检查项

`scripts/health-check.cjs` 一键检查 6 大项：

1. **文件存在性** —— 16 个关键文件（源码 / 插件 manifest / background / 图标 / 测试脚本）
2. **npm scripts 完整性** —— `dev/build/test:*` 是否齐全
3. **构建** —— `npm run build` 能否成功
4. **统一测试门禁** —— `test:all` 是否通过
5. **TDZ 风险扫描** —— 扫 `src` 下所有 `.jsx/.js` 的 TDZ / 未定义 / 非函数调用（防 `Cannot access 'x' before initialization`）
6. **dist 构建产物基线** —— 借鉴原产品 `safety-net.cjs`：对比 `dist/` 各文件大小，防意外增删 / 体积异常（基线存于 `scripts/dist-snapshot.json`，dist 有意义的更新后需重新生成基线）

> ⚠️ **dist 基线**：首次运行自动生成快照（仅记录）。之后每次对比；若你**刻意改了构建产物**（新增资源/插件文件），运行后会有差异提示，确认没问题后删除 `scripts/dist-snapshot.json` 重新生成即可。

## 四、测试文件结构

```
scripts/
├── smoke_test.cjs          # 冒烟：静态检查（调用 _smoke_checks.cjs）
├── _smoke_checks.cjs       # 冒烟检查明细（含 ReactFlow useReactFlow 白名单等）
├── regression_test.cjs     # 回归：SSR 渲染节点 + class 断言
├── test_agent_tools.cjs    # Agent 工具单测
├── run_all_tests.cjs       # 统一门禁聚合脚本（smoke + vitest + regression + tools）
├── health-check.cjs        # 工程健康度全量检查
└── dist-snapshot.json      # dist 基线快照（自动生成，勿手改）

tests/
├── setup.mjs               # vitest 全局 setup（jsdom 等）
└── unit/                   # vitest 单元测试（`npm run test:unit` 全量跑）
    ├── scriptBoxEngine.test.js      # 剧本盒引擎回调 + 纯函数（含分批并发/toast/JSON解析）
    ├── scriptBoxPrompts.test.js     # 剧本盒纯函数（ZgPrompt/hlAt/collectAssets 等）
    ├── canvasAgentTools.test.js     # AI 画布工具层（24 工具，含改名后契约）
    ├── useConnectedInputs.test.js   # 管线契约（getNodeOutput）
    └── ...（其余纯函数/逻辑单测）
```

## 五、常见问题

### 1. 改了节点外观，regression 报 class 找不到
回归测试断言的是节点**根 / 主容器的关键 class**（如 `bg-surface-raised`、`rounded-xl`、`border-edge`、`cust-handle`）。
如果你改动了 NodeShell 外壳 / 节点外观，同步更新 `scripts/regression_test.cjs` 里对应节点的 `expect` 数组。

### 2. 用了新的 ReactFlow API，smoke 报 warning
`_smoke_checks.cjs` 里有 `allowedFromUseReactFlow` 白名单。React Flow 12 的 `useReactFlow()` 返回值若不在白名单会 warning。
确认是合法 API 后，把方法名加进白名单（如 `deleteElements`）。

### 3. 改代码触发 TDZ / 未定义
`check:health` 的 TDZ 扫描会提示。典型场景：在 `const x = useState(...)` 定义前就 `useXxx(x)` 调用（参考 DiscountVideoNode 的修复：把依赖的 hook 调用移到 state 定义之后）。

## 六、已补 / 后续可补

- ✅ **已补 vitest 单测**（2026-08-16）：`tests/unit/` 下 24 文件 / 244 用例，覆盖剧本盒引擎（回调/分批并发/toast/@资产高亮）、AI 画布工具层、管线契约、各纯函数。
- ✅ **已补「算法与逻辑层」单测（阶段一，2026-08-17）**：`tests/unit/` 新增 5 文件 / 54 用例，覆盖 `promptManager`（预设 CRUD+持久化+卡片映射）、`resourcesApi`（fetch 封装全 mock）、`pollTask`（轮询状态机+结果 URL 提取）、`faceMosaic`（detector 单例+打码模式）、`videoEngine`（ProgressController 取消传播）。详见 `docs/10-测试覆盖补齐计划-2026-08-17.md`。
- ✅ **已补 Playwright E2E 部分用例**：`tests/e2e/` 已有节点渲染（`nodes.render.spec.js`）与剧本盒状态机（`scriptBox.spec.js`），`npm run test:e2e` 可跑。
- 🟡 **仍可补（第二阶段全覆盖，2026-08-17 续，详见计划文档）**：当前 `src/components` 共 185 文件、已覆盖 48、仍有 **137 个零测试文件**待清零，按 7 批推进：
  1. ✅ **批 1 已完成**（2026-08-17）：`backupStore` `clipboard` `cloudSync` `imageCompress` `workflowRuntime` `hooks`(纯函数) `useCanvasHistory` `useSyncNodeData` —— 新增 8 个测试文件（`backupStore/clipboard/cloudSync/imageCompress/workflowRuntime/hooks/useCanvasHistory/useSyncNodeData.test.js`）。`nodePrefs` 实为 React hook，下移批 3。
  2. ✅ **批 2 已完成**（2026-08-17）：`apiBase` `chatApi` `imageApi` `videoApi` `filesApi` `tasksApi` `projectsApi` `settingsApi`(providerApi) —— 新增 8 个测试文件（48 用例）。关键基建：在 `tests/setup.mjs` 用 `Object.defineProperty` 强制 mock 全局 `fetch`（Node 原生 fetch 不可配置，`vi.stubGlobal` 失效）。
  3. **批 3** 业务 hook：`nodePrefs`（从批 1 移入）`useArrangeCanvas` `useAssetDragToCanvas` `useAssetDropPaste` `useContextMenu` `useVideoPoster` `useLocalToolStatus` `useFitNodeRatio` `useMediaDegrade` `useNodeGeneration` `useScriptBoxData` `useScriptBoxEngine` `useCanvasAgentTools`
  4. **批 4** 顶层节点组件（剩余 12）：`Comet` `ConnectionLine` `CustomEdge` `CustomHandle` `DiscountVideoNode` `GhostTargetNode` `ImageBoxNode` `JianyingIcon` `NodeTitle` `ScriptBoxNode` `AgentMessage` `AgentPanel`
  5. **批 5** base UI 组件（高频优先）：`ContextMenu` `AssetLibrary` `CanvasToolbar` `GeneratedView` `ImageEditor` `OverlayEditor` `TaskCenter` `TopNav` `PromptInput` `ModelSelect` `NodePalette` `ProjectSelector` 及次级 UI / settings 各 section
  6. **批 6** director3d 逻辑层/store（0→全）：`directorStore` `directorSelectors` `directorProject` `cameraGeometry` `cameraTarget` `poseSchema` `viewportAspect*` `adapters` `panoramaMath` `viewportAspectFrame` `gltfImport` `humanoidRig` `localModelImport` `panoramaImport` `modelLibraryCatalog` `mannequinPosePresets` `skeletonMappings` `bodyTypes` `mannequinPose` `ue4MannequinRig` `ue4MannequinPoseApplication` `exportProjectJson` `importProjectJson` `captureBridge` `hostBridge` `screenshotExport`
  7. **批 7** director3d React 组件 + E2E 收口：`App` `DirectorDeskShell` `DirectorCanvas` `SceneRoot` 等组件（smoke 级）+ 新增 `generation.flow` / `director3d` / `clipboard.group` E2E 场景
