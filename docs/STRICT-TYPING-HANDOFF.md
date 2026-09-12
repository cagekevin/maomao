# Handoff · 渐进消除 src 隐式 any（TD-09-1 选项 A）

> **读者**：接手「类型收口」的执行者（人或模型）。
> **目标**：把 `src` 侧现存的 **1114 处隐式 any** 逐目录清零；每清零一个目录就纳入门禁白名单，**永不复涨**。
> **节奏**：**不必一次做完**。每次只啃一个文件/一个目录，小步、可验证、可回滚。
> **背景**：`tsconfig.json` 关了 `noImplicitAny`（历史遗留），所以这些错平时不报。我们用「按目录开放的 strict 门禁」渐进收口，而不是一次翻开全仓（会 1424 错、瘫掉开发）。
> 详细审计见 `daily/架构日志/09-类型诚实性-隐式any复核-2026-09-12.md`。
> **状态（2026-09-12 收口）**：✅ **src 侧已全部收口（1435 → 0）**，18 项白名单 0 隐式 any，`npm run check:strict-src` 永不复涨。本手册转为**历史执行记录 + tests 侧（TD-09-2）复用**。仅余 tests 侧 1323 处（不影响生产代码）。

---

## 0. 一句话流程

```
读报告（strict-report）→ 选一个文件 → 按 §4 的错误码表修 → 跑 §5 三条验证 → 绿了换下一个
→ 一个目录全清 → 加进白名单（§7）→ 门禁从此守住它

# tests 侧（TD-09-2）走另一条路，详见 §8.5：
#   读 §2.5 两份前辈文档 → 跑 tsc -p tests/tsconfig.strict.probe.json 按真实错排序
#   → 只改测试侧对齐 src（vi.mocked / as unknown as X / vi.fn(..._args:any[])）
#   → IDE lints + vitest 实跑判据；绝不新建白名单 JSON（那是 src 侧机制，错配）
```

---

## 1. 铁律（违反 = 白干，必须回退）

1. **禁止用 `any` 敷衍**。不许把参数标成 `any`、不许 `as any`、不许 `as unknown as X` 绕过。
   这不是「消除错误」，只是把债换个写法——门禁认的就是 `noImplicitAny`，标了 `any` 检测不到但**评审会打回**。
2. **禁止为了让错误消失而删代码 / 删注释 / 删功能**。只有当某个参数/分支**确实是死代码**时才可删，且要在提交说明里写清理由。
3. **禁止改 `tsconfig.json` 里的 `strict` / `noImplicitAny`**（那是自欺欺人，且会被门禁脚本的目标配置发现）。
4. **禁止跳过验证**（§5）。任何改动必须跑完三条命令。
5. **拿不准就停**：不确定某参数真实类型时，不要猜一个塞进去；在提交说明里标 `⚠️ 待确认`，或只修你能确证的那些。

---

## 2. 工具

| 命令 | 作用 |
| - | - |
| `node scripts/strict-report.mjs` | **总览**：存量、按域/错误码分类、TOP 文件、「建议下一步（最易啃）」 |
| `node scripts/strict-report.mjs --file <path>` | **单文件**全部错误（开工前先看它） |
| `node scripts/strict-report.mjs --dir <path>` | **某目录**全部错误 + 明细 |
| `npm run check:strict-src` | **门禁**（src 侧）：白名单目录必须 0 隐式 any（红 = 没修完） |
| `npm run type-check` | 常规类型闸（src + tests 全量，必须一直绿） |
| `npx tsc -p tests/tsconfig.strict.probe.json --noEmit` | **tests 侧旁路探针**（TD-09-2）：开 strict 看真实存量，**不写回门禁** |
| `node scripts/ts-tests.mjs check <file>` / `verify <file>` | tests 侧单文件检查 / 去帽验证（前辈体系，勿重建） |
| `node scripts/ts-detail.mjs` | tests 侧逐条明细（含解析率自检，防误判 0 错） |

---

## 2.5 历史沉淀（**务必先读，别重复造轮子**）

2026-09-01 前辈已对 **tests 侧**做过同类工作，方法论与工具可直接复用：

| 文档 / 工具 | 价值 |
| - | - |
| `docs/75-测试类型消化-Handoff-2026-09-01.md` | tests 侧类型消化的完整 Handoff：**19 条踩坑**（正则自检、GBK 假阳性、`vi.mocked`、别用判别联合…）+ 作战流程 |
| `docs/75-strict探针报告-2026-09-01.md` | tests 侧 strict 探针结论：4309 错中**噪音型 2593（隐式 any）/ 真实型 1716**；**「按错误总数排序会误判优先级，应改按真实错误数排」**（最重要的一条经验） |
| `scripts/ts-detail.mjs` | tests 侧**逐条明细**查看器（含解析率自检）；支持 `--project <dir>` |
| `scripts/ts-tests.mjs` | tests 侧单文件 `check`/`verify` + 全局 `status` |
| `tests/tsconfig.strict.probe.json` | tests 侧 strict 探针配置（**只含 `tests/unit`，不含 src**——这正是本文档补的另一半） |

**两个面的关系（别混淆）**：

| | tests 侧（前辈，已收口） | **src 侧（本文档）** |
| - | - | - |
| 配置 | `tests/tsconfig.json`（已纳入 `type-check`，`@ts-nocheck` 已清零） | `tsconfig.json`（`noImplicitAny:false`） |
| 存量 | 常规错已清零；strict 探针 4309（噪音 2593 + 真实 1716） | **1350**（几乎全是隐式 any 噪音） |
| 状态 | 已达标（常规闸绿） | **待翻新**（TD-09-1） |

> ⚠️ **必须复用前辈的经验**：① 别按错误总数排序（会被「看着吓人但无隐患」的文件带偏）；② 报告工具必须带**解析率自检**；③ 判断「真干净」要用**真实文件 + IDE lints + vitest 实跑**，不要相信「复制副本扫描」的数字（GBK 假阳性，踩坑 #17）。

---

## 3. 怎么定「真实类型」（最关键的一步）

隐式 any 的修法 = **给出真实类型**。三个信息来源，按优先级：

1. **调用方**（最可靠）→ 先用 **`mv-sync-refs.mjs refs`**（一次列出**全部 import 方 + 字符串残留引用**，比 grep 更全）：
   ```bash
   node scripts/mv-sync-refs.mjs refs src/components/nodes/ImageGenerate.tsx
   ```
   再按需补 JSX 调用点：`grep -rn "<ImageGenerate" src`。
2. **库的类型定义**：若是库的回调（ReactFlow / React / three 等），去 `node_modules/@xyflow/react` 等找同名的 props/类型。
   *本项目已有的现成类型：* `@xyflow/react` 的 `Node`/`Edge`/`EdgeProps`/`NodeProps`、React 的 `React.MouseEvent<T>`/`React.ChangeEvent<T>`、`Record<string, xxx>`。
3. **运行时用法**：函数体里怎么用它，就说明它是什么。`x.slice()` → string；`x.map()` → 数组；`x.toString()` → string|number。

> 若三者都定不下来 → 用 `unknown` + 守卫（`typeof x === 'string'`），**不要用 `any`**。

### 3.5 类型地图：这个仓库的常见类型去哪找（**「快速找到类型」的答案**）

| 你要标的东西 | 类型去哪找 |
| - | - |
| 节点组件 props / data | 该节点文件顶部的 `interface XxxNodeProps` / `XxxNodeData`（如 `nodes/ImageGenerate.tsx`）；外壳 props → `base/ui/NodeShell.tsx` 的 `NodeShellProps` |
| 节点类型字符串 | `base/core/contracts.ts` 的 `NODE_TYPES`（**唯一登记表**，禁止裸字符串） |
| 端口 contract | `contracts.ts` 的 `NODE_HANDLE_CONTRACT` / `NodeHandleContract` |
| 事件名 + 载荷 | `contracts.ts` 的 `EVENTS`（每条含 `from`/`to`/`payload`/`note`）与 `EventRegistryEntry` |
| 存储键 | `contracts.ts` 的 `STORAGE_KEYS` / `StorageKeyMeta` |
| ReactFlow 的 Node/Edge/回调 | `@xyflow/react`：`Node`、`Edge`、`EdgeProps`、`NodeProps`、`Viewport`、`Connection`、`ConnectionLineComponentProps` |
| 节点产出（上游→下游） | `hooks/useConnectedInputs.ts` 的 `NODE_OUTPUTS` / `NodeOutputItem` / `NodeOutputGroup` |
| 生成结果信封 / 工具结果 | `base/core/contracts.ts` 的 `{code,data}`；`base/toolRegistry.ts` 的 `ToolResult` |
| store 状态形状 | 各 store 文件顶部 interface（`taskStore`/`assetStore`/`projectStore`/`conversationStore`…） |
| 节点参数记忆 | `canvas/nodePrefs.ts` 的 `PREFS_FIELDS` / `PREFS_DEFAULTS` |
| 通用工具返回 | 就近看该 `utils/*.ts` 的导出签名（`mediaType`、`assetUrl`、`clipboard`…） |

> 还找不到就：`grep -rn "interface Xxx" src`，或 `node scripts/mv-sync-refs.mjs refs <file>`（查某文件被谁 import、依赖谁——见 `CLAUDE.md §5.4`）。

---

## 4. 错误码 → 修复模式（按出现频率，含真实样例）

### TS7006 参数隐式 any —— 979 处（最多）

```
src/App.tsx(149,31): error TS7006: Parameter 'code' implicitly has an 'any' type.
```
真实代码：`function handleReactFlowError(code, message) { ... }`
→ 它是 ReactFlow 的错误回调（见同文件 `onError={handleReactFlowError}`），按库语义标：
```ts
function handleReactFlowError(code: string | number, message: string) { ... }
```

另一个例子：
```
src/App.tsx(362,47): error TS7006: Parameter 'v' implicitly has an 'any' type.
```
真实代码：`const onViewportChange = React.useCallback((v) => { viewportRef.current = v || null }, [])`
→ `v` 是 ReactFlow 视窗值（`{x,y,zoom}`），可标 `Viewport`（`import type { Viewport } from '@xyflow/react'`）或按用法标 `{ x: number; y: number; zoom: number } | null`。

**修法要点**：一次只处理一处；优先查调用方；库回调优先用库类型。

### TS7031 解构绑定隐式 any —— 239 处

```
src/App.tsx(1586,33): error TS7031: Binding element 'performanceMode' implicitly has an 'any' type.
```
真实代码：`function LodPerformanceBanner({ performanceMode }) {`
→ 这是 React 组件，**给解构整体标一个 props 接口**：
```ts
interface LodPerformanceBannerProps {
  performanceMode: boolean;
}
function LodPerformanceBanner({ performanceMode }: LodPerformanceBannerProps) { ... }
```
分不清字段类型时看使用处：`if (!performanceMode || lodLevel < 2) return null` → 布尔。

### TS7053 索引访问隐式 any —— 74 处

```
src/App.tsx(1263,11): error TS7053: Element implicitly has an 'any' type because expression of type 'any' can't be used to index type '{}'.
```
**根因通常是别处的 TS7006/TS7005**（索引键是 any）。→ **先修那个源头的 any**；或给对象标索引签名：
```ts
const map: Record<string, Item> = {};
```

### TS7005 / TS7034 变量隐式 any —— 65 处

```
src/components/agent/canvas/canvasPlanExecutor.ts(605,43): error TS7005: Variable 'wave1' implicitly has an 'any[]' type.
```
真实代码：`let wave1 = []` 之后才往里 push → TS 推不出元素类型。
→ 显式标注**真实元素类型**（看 push 进去的是什么）：
```ts
const wave1: TaskCall[] = [];
```
（TS7034 与它同类，只是报在"某些位置无法确定类型"。）

### TS7018 对象字面量属性隐式 any —— 31 处

```
src/components/agent/canvas/useCanvasAgentTools.ts(787,7): error TS7018: Object literal's property 'sourceHandle' implicitly has an 'any' type.
```
→ 给对象/变量标类型（见 §6 的 `satisfies` 坑：**必须用前缀标注**）。

### TS7011 函数表达式缺返回类型 —— 10 处

```
src/components/base/api/filesApi.ts(256,36): error TS7011: Function expression, which lacks return-type annotation, implicitly has an 'any' return type.
```
→ 给箭头函数加返回类型（看它 return 什么）：`: Promise<Blob>` / `: string | null`。

### 其余（少量连锁）

TS2339 / TS2345 / TS2322 —— 通常是**上面某处的 any 引发的连锁**。修完上游 any，这些往往自行消失；若仍在，再单独看报错里的类型不匹配。

---

## 5. 每次必跑的验证（顺序，全绿才算完）

```bash
npm run check:strict-src     # 白名单目录不许有新错（收口白名单目录时必须 0 报）
npm run type-check           # 常规闸必须绿
npx vitest run <相关测试文件>  # 改到哪个模块就测哪个（如 tests/unit/xxx.test.ts）
```

**加速（可选）**：不确定该跑哪些测试时，用 `node scripts/test-affected.cjs` —— 它按 **git 暂存区**改动反查「同名 stem 的相关测试」并只跑它们（比 `vitest --changed` 准：能由 `src/x.ts` 改动找到 `tests/unit/x*.test.ts`）。
> 前提：需先 `git add`（它读 `git diff --cached`）；若未暂存则跳过。**主路径仍是显式指定测试文件**，它是加速不是替代。

> 若你改的是**白名单目录**（如 `src/components/base/core/`）：`check:strict-src` 必须 **0 报**，这是硬门槛。

---

## 6. 常见坑（都已真实踩过）

1. **`satisfies` 不提供上下文类型**
   ```ts
   const X = { from: [] } satisfies Record<string, string[]>;  // ❌ from 仍是 any[]，TS7018 不消
   const X: Record<string, string[]> = { from: [] };           // ✅ 前缀标注才给上下文
   ```
2. **`strictNullChecks` 目前是关的** → `null` 能赋给任何类型，别误以为安全。若某参数实际会被传 `null`，标注写 `handle?: string | null`（为将来开 `strictNullChecks` 留路）。
3. **非标准全局属性**（`window.__DEBUG_*` 之类）**别用 `(window as any)`**，声明类型：
   ```ts
   type DebugWindow = Window & { [k: `__DEBUG_${string}`]: boolean | undefined };
   (window as unknown as DebugWindow)[key]
   ```
4. **别一次改一个几百行文件的大片区域**。一次只处理一个函数/一段，改完就验证，避免连锁报错失控。
5. **不要顺手重构**。本任务只加类型标注；行为、逻辑、命名一律不动。
6. **禁止用判别联合收口宽松类型**（前辈踩坑 #7）：`strict:false` 下大量代码直接访问 `.data`/`.error`，改成判别联合（`{ok:true;data} | {ok:false;error}`）会连锁弄红**已绿的 src**。用宽松对象 `{ ok: boolean; data?: T; error?: unknown }`。
7. **若动到测试**：`vi.mock` 导入的具名函数直接调 `.mockResolvedValue` 会 TS2339 → 包 `vi.mocked(fn)`；`vi.fn(async () => …)` 参数被推断成空元组 `[]` → 改 `vi.fn(async (..._args: any[]) => …)`（一处消 TS2493/TS18048/TS2532 三码）。
8. **报告工具必须能自证解析率**：正则失配时静默输出「0 错」比不扫更危险。`strict-report.mjs` / `ts-detail.mjs` 都带自检——**看到 `⚠ 解析率异常` 就不要信那些数字**。
9. **对象字面量里的字符串会被拓宽成 `string`（加类型时容易反手造出新错，2026-09-12 在 `PromptInput.tsx` 真踩）**
   ```ts
   const all = React.useMemo<PromptAssetItem[]>(() => [
     ...refImages.map((i, idx) => ({ id: ..., label: ..., kind: 'image' })), // ❌ kind 推断为 string → TS2322
   ], [refImages, refTexts]);
   ```
   `useMemo<PromptAssetItem[]>` 的泛型**管不到 `.map()` 回调内部**（spread 元素不向下传上下文类型）。必须给回调标返回类型：
   ```ts
   ...refImages.map((i, idx): PromptAssetItem => ({ id: ..., label: ..., kind: 'image' })), // ✅ kind 保住字面量
   ```
   症状：本来 0 错的文件，补完类型后冒出 `TS2322: Type '{...kind: string;}' is not assignable to ...`。**看到这种「新错」先怀疑字面量拓宽，别怀疑自己标错**。
10. **`as` 的边界（本次实践结论）**：§1 禁的是 `any` / `as unknown as X`。把 `unknown` 载荷断言成**具体接口**（如 `item as PromptChipItem`）是允许且必要的收窄手段——但断言前必须先做 `typeof x === 'object' && 'id' in x` 守卫，并把「为什么这个形状成立」写在注释里。

### 6.5 负面清单：这几个脚本**不要**用于本任务

| 脚本 | 为什么不用 |
| - | - |
| `scripts/m1-scan.mjs` | 「复制 `tests/unit` → 副本剥 `@ts-nocheck` → 扫描」的方式：① **面向 tests 侧**（src 无 `@ts-nocheck`，无需副本）；② 复制副本有 **GBK 假阳性**（踩坑 #17，数字虚高失真）。**本案 src 侧用 `strict-report.mjs`**（直接跑真实文件、0 副本）。 |
| `scripts/ts-exts.cjs` | JS→TS 迁移期的「扩展名豁免清单 / `resolveSourceFile`」基础设施（迁移已完成、豁免清单已清空），**与类型标注无关**。 |
| `scripts/mv-sync-refs.mjs` 的 `rename`/`move`/`convert` 子命令 | 那是**机械改名/搬迁 + 同步 import**工具（对「改名任务」有用）。本任务**只加类型标注、不动文件位置**，故只用它的 `refs` 子命令（见 §3）。 |
| `scripts/ts-tests.mjs` | 面向 **tests 侧**的 `check`/`verify`/`status`（摘 `@ts-nocheck` 用）；src 侧无 `@ts-nocheck`，用不上。 |

---

## 7. 收口一个目录后：纳入门禁

编辑 `scripts/strict-src-whitelist.json`（白名单**单一真源**，两个脚本共用）：
```json
{
  "whitelist": [
    "src/components/base/core/",
    "src/components/base/storage/"
  ]
}
```
然后 `npm run check:strict-src` 必须绿。**此后任何人往该目录写隐式 any 都会红。**

---

## 8. 进度与建议顺序

**当前快照（2026-09-12 收口实测，`node scripts/strict-report.mjs` 可随时重算）**：

| 域 | 存量 | 门禁机制 |
| - | - | - |
| **src 侧（TD-09-1 范围）** | **0 ✅ 已全目录收口** | 白名单门禁 `npm run check:strict-src`（§7） |
| tests 侧（TD-09-2，另一面） | 真实门禁已绿；strict 探针 4309 处（待翻新，**不阻塞**） | **无白名单门禁**，走全量 `npm run type-check` + 旁路 `tsconfig.strict.probe.json` |

> **✅ TD-09-1 已结清（2026-09-12）**：`node scripts/strict-report.mjs --dir src` = **0 处**；`npm run check:strict-src` 白名单 **18 项 0 报、exit 0**。白名单（18 项 = 16 目录 + `src/App.tsx`/`src/main.tsx`）：core / storage / api / utils / store / prompt / ui / editors / base/panels / hooks / nodes / agent / edges / panels / scriptbox / **director3d（最大 712 → 0，最后收口）** / `src/App.tsx` / `src/main.tsx`。

> **⚠️ tests 侧（TD-09-2）关键澄清（2026-09-12 修订，曾误判）**：
> - `tsconfig.json` 2026-09-12 已将 `tests/**`（含 `.mjs` 底座）**并入根扫描**（取消独立 `tests/tsconfig.json`）。即 tests 的**真实门禁 = 根 `npm run type-check`（`tsc --noEmit`）**，已由 husky/pre-commit 守住，**不是** src 侧那套白名单机制。
> - 所谓「tests 侧 1323 处隐式 any」是**临时开 `--noImplicitAny` 扫出的噪音存量**，前辈 `docs/75-测试类型消化-Handoff-2026-09-01.md` 早已把 172 个测试文件 `@ts-nocheck` 清零、常规闸（当时 `strict:false`）全绿。这些 1323 处**平时不报**（根 `tsconfig` 的 `noImplicitAny:false`），属「待翻新」非「破门禁」。
> - **因此 tests 侧不要新建 JSON 白名单门禁**（那是 src 侧 TD-09-1 的机制，错配）。正确做法是沿用前辈已验证的体系：全量 `tsc -p tests/tsconfig.strict.probe.json` 旁路探针 + 按真实错误数排序 + IDE/vitest 实跑判据。详见 **§8.5**。
> - 旁路线索：1286 处里绝大多数是隐式 any 噪音（见 §2.5 探针报告），`accountsStore`/`providerStore`/`logger` 等错误数 top5 真实隐患为 0；真要攻坚应聚焦 `canvasAgentTools`(86 真实错) 等真实型文件。

**已收口（白名单，隐式 any 存量 0）**：core / storage / api / utils / store / prompt / ui / editors / base/panels / hooks（34→0）/ nodes（126→0）/ agent（197→0）/ edges（2→0）/ panels（21→0）/ scriptbox（45→0）/ `src/App.tsx`+`main.tsx`（37→0）/ **director3d（712→0）** → **合计 1435 → 0 ✅**。

**src 侧已无待排期目录**：全部 src 目录均已收口并纳入白名单（见上）。若后续新增 src 目录，请按 §7 从零维护白名单。

### 进度小结（截至 2026-09-12 晚）

| 目录 | 收口处数 | 关键修法 | 测试 |
| - | - | - | - |
| `core/` | 早期完成 | — | — |
| `storage/` | 完成 | — | — |
| `api/` | 完成 | — | — |
| `utils/` | 完成 | gifenc 补 `src/types/gifenc.d.ts`；`unknown`+守卫收窄、回调补类型 | `npx vitest run tests/unit/utils` → 86 passed |
| `store/` | 31 处 | `accountsStore`/`backupStore`/`cloudSync` 三文件：`unknown`+守卫收窄、回调补 `(msg:string)=>void`、索引签名补 `Record<>` | `npx vitest run tests/unit/store` → 87 passed |
| `prompt/` | 17 处 | 新增 `PromptChipItem`/`PromptAssetItem` 本地类型；DOM 句柄补 `HTMLElement`/`Element`；React 事件补 `KeyboardEvent`/`ClipboardEvent`；map 回调标返回类型防字面量拓宽 | `npx vitest run tests/unit/{promptChips,promptHub,promptManager,promptMention}.test.ts tests/unit/PromptInput.*.test.tsx` → 86 passed |
| `editors/` | 75 处 | `OverlayEditor`(52)：抽 `OverlayLayer`/`OverlayState`/`OverlayEditorProps`/`DragState` 接口，组件 props 与导出函数 `renderLayerCanvas`/`renderOverlayCanvas` 标类型，连锁消除 `layers.map/find/filter` 的 `l` 隐式 any；`toCanvasPos`/`drawStroke` 数值参数、拖拽/涂抹事件分别标 `React.MouseEvent`/`PointerEvent`/`KeyboardEvent`；`pending`/`raf`/`dragRef` 等显式类型；`applyMask` 补 `paintLayerId` 空值守卫、`e.target` 断言 `HTMLElement`。`FaceMosaicEditor`(7)/`ImageZoomDialog`(5)/`InlineImageCropper`(11)：回调参数补 `React.PointerEvent`/`WheelEvent`/`CropSelection`/`MosaicMode` 等。 | `npm run check:strict-src` ✅ 白名单 0 报 · `npm run type-check` ✅ |
| `base/panels/` | 96 处 | 新增 `DonutSegment`/`BarItem`/`StatProps`/`EnvMenuProps`/`FetchModelsModalProps`/`FetchedModelGroup`/`ModelCatKey` 本地接口；`polarToCartesian`/`buildDonutPath` 数值参数标 `number`；React 事件补 `React.MouseEvent`/`React.DragEvent`/`React.ChangeEvent`；`Set` 标 `Set<string>`、`CATEGORY_COLORS`/`TYPE_BADGE`/`TYPE_ICON` 补 `Record<string, …>` 索引签名；`AccountEnv`/`RawModel`/`Task`/`UISettingDef`/`LucideIcon` 用于 props 与回调；`row.key as keyof typeof settings` 收窄索引键 | `npm run check:strict-src` ✅ 白名单 0 报 · `npm run type-check` ✅ · 无同 stem 测试 |
| `src/（根文件）` | 37 处 | 新增 `DragConnection`（`Connection & { dropPosition }`）/`ConnectEndState` 本地类型；ReactFlow 回调 `onConnect`/`onConnectEnd`/`onDelete`/`onEdgeDoubleClick`/`onNodeDragStop`/`onViewportChange`/`onNodesChangeForEdges`/`handleReactFlowError`/`handleCanvasMouseDown` 按库类型（`Connection`/`ConnectEndState`/`Edge`/`Node`/`Viewport`/`NodeChange`/`React.MouseEvent`/`MouseEvent|TouchEvent`）标注；`viewportRef` 显式 `Viewport | null`；`selectionMap` 补 `Record<string, boolean>`；`handleCreateProject`(`Project`)/`handleSwitchProject`/`persistCanvas`/`syncAgentKey`/`agentKeyForProject` 等补 `string`；`onConnectEnd` 的 `event` 用 `'changedTouches' in event` 守卫收窄解构 | `npm run check:strict-src` ✅ 白名单 0 报 · `npm run type-check` ✅ · 无同 stem 测试（纯类型标注，全仓编译已覆盖） |

> `store/` 收口明细：
> - `accountsStore.ts`(2)：`push` 回调补 `AccountCookie`；localStorage 回写 `store as Record<string,string>`。
> - `backupStore.ts`(7)：`conversationKeys/readLS/writeLS/readLSAsync/importAll/backupToBlob` 参数补类型；`importAll` 用 `backup as {...}` 收窄。
> - `cloudSync.ts`(22)：`callGateway/push/pull` 等回调补 `(msg:string)=>void`；`readLS/writeLS/restoreLocal` 补类型；`SYNC_LABELS`/`SYNC_DOMAIN_SWITCHES` 补 `Record<>` 索引签名。
>
> 两道门禁均绿：`npm run check:strict-src`（白名单 0 报）、`npm run type-check`。

> `prompt/` 收口明细（2026-09-12，17 处 → 0）：
> - `promptChips.ts`(1)：`pushTextWithBreaks(text: string)`。
> - `promptHubStore.ts`(3)：`const items: Prompt[] = []`（`Prompt` 已在该文件 `export`），消除 TS7034/TS7005 连锁。
> - `PromptInput.tsx`(11)：文件内新增 `type PromptChipItem`（`{id; label?; kind?: 'image'|'text'; url?}`）与 `type PromptAssetItem`（`{id; label; kind: 'image'|'text'; url?}`）；`setEditorRef(el: HTMLDivElement | null)`；`saveCursor(root: HTMLElement)`；`restoreCursor(root: HTMLElement, offset: number)`；两处 `ELEMENT_NODE` 分支改 `(node as Element).hasAttribute(...)` 修 TS2339×2；`insertChipAtCursor`/`handleSelectMention` 参数标 `PromptChipItem`；`handleExternalInsert(payload: unknown)` + `'id' in item` 守卫（载荷来自 `ResourceStrip.onInsert`/父级 `onReady`，形状见 `ResourceStripProps` 注释）；`handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>)`；`handlePaste(e: React.ClipboardEvent<HTMLDivElement>)`；`all` 的 useMemo **两个 map 回调标 `: PromptAssetItem` 返回类型**（否则 `kind` 拓宽成 `string`，见 §6 坑 9）。
> - `PromptLibraryButton.tsx`(2)：新增 `export interface PromptLibraryButtonProps { category?: string; onAppend?: (prompt: string) => void }`；`handleUse(prompt: string)`。
> - 验证：`npm run check:strict-src` ✅ 白名单 0 报 · `npm run type-check` ✅ · 上述 vitest 7 文件 86 passed。
> - 顺手结论：`.map()` 内部对象字面量的 `kind: 'image'` 若无返回类型标注会拓宽成 `string`——这是本次唯一的新增错，已在 §6 记录。

### 下一步：`hooks/` + `base/ui/` 编辑方案（直接照做即可）

**① `src/components/base/ui/`（4 处，最简单，建议先做）**

- `NodeShell.tsx`(2)：`function useNodeWidth(id)` / `useNodeHeight(id)` → `(id: string)`（id 来自 `NodeShellProps.id`，`useStore((s) => s?.nodeLookup?.get(id))`）。
- `ResizeFullscreenHandle.tsx`(2)：`onMouseDown(e: React.MouseEvent<HTMLDivElement>)`；`const move = (ev: MouseEvent) => batch(ev.clientX, ev.clientY)`。

**② `src/hooks/`（34 处，6 文件）**

- `useArrangeCanvas.ts`(17)：`n`/`node`/`groupId`/`nid` 等补 `Node`（`@xyflow/react`）；`components`/`compBoxes`/`laid` 三个 `TS7034/TS7005` 按「push 进去的是什么」标显式数组元素类型（大概率是 `Node` 或 `{id,x,y,w,h}` 之类的盒子对象——**先 `--file` 看用法再定**）。
- `useConnectedInputs.ts`(8)：`d`/`sourceHandle`/`s` 补类型（`d` 是节点 data，优先就近取 `NodeOutputItem`/已知信封）；L192 的 `TS7053` 是 `NODE_OUTPUTS` 索引访问 → 给该对象补 `Record<string, ...>` 索引签名（**别改判别联合**，见 §6 坑 6）。
- `useSyncNodeData.ts`(5)：`(data, setters)` 补类型；L28/31/35 三处 `TS7053` 同因 → `Record<string, unknown>` 索引签名。
- `useVideoPoster.ts`(2)：`(url: string, enabled: boolean)`。
- `useAssetDegrade.ts`(1)：`(type: string)`。
- `useNodeGeneration.ts`(1)：L278 `TS7011` 箭头函数补返回类型（看它 return 什么）。

落完编辑 → `npm run check:strict-src` 必须 0 报 → 把 `src/hooks/`、`src/components/base/ui/` 逐条加进 `scripts/strict-src-whitelist.json` → `npx vitest run tests/unit` 相关用例（`hooks` 相关测试用 `node scripts/mv-sync-refs.mjs refs <file>` 找同 stem 测试）。

**建议顺序（自底向上：先地基、后 UI；先小后大）——全部完成 ✅**：
1. ✅ `core/`、`storage/`、`api/`、`utils/`（底层地基）
2. ✅ `store/`、`prompt/`
3. ✅ `src/hooks/`（34 → 0）· ✅ `src/components/base/ui/`（4 → 0）
4. ✅ `src/components/nodes/`（126 → 0）
5. ✅ `src/components/base/editors/`（75 → 0）· ✅ `src/components/base/panels/`（96 → 0）
6. ✅ `src/components/agent/`（197 → 0）
7. ✅ `src/components/director3d/`（**最大 712 → 0，2026-09-12 最后收口**）

> **src 侧已 100% 收口（1435 → 0）**。`src/` 根文件 `App.tsx`/`main.tsx` 亦已于 2026-09-12 收口，登记为白名单文件级条目。后续新增 src 目录请按 §7 从零维护白名单。

> 每完成一个目录，就更新本节表格 + 白名单，并在提交说明里附 `check:strict-src` 输出。

---

## 8.5 tests 侧（TD-09-2）实战纠错与正确姿势（2026-09-12 增补）

本节是「在 tests 侧动手」前**必读**的血泪复盘。一次真实执行中，执行者误把 src 侧的白名单门禁机制套到 tests 侧，走了弯路。把正确做法钉死如下。

### 8.5.1 最大误判：tests 侧 ≠ src 侧，不要新建白名单门禁

| | src 侧（TD-09-1） | **tests 侧（TD-09-2）** |
| - | - | - |
| 门禁 | `npm run check:strict-src`（白名单 JSON + 路径过滤） | **无白名单**。真实门禁 = 根 `npm run type-check`（`tsc --noEmit`，已含 tests） |
| 配置 | `tsconfig.json` 关 `strict`/`noImplicitAny`，靠门禁脚本临时 `--noImplicitAny` | 根 `tsconfig.json` 同样关 `noImplicitAny`；tests 已被并入主扫描 |
| 存量 | 1435 → 0（已收口） | 常规闸已绿；strict 探针 4309 处（含 2593 噪音）**不阻塞门禁** |
| 复用工具 | `scripts/strict-src-whitelist.json` + `check-strict-src.mjs` | **`scripts/ts-tests.mjs`**（check/verify/status）+ `scripts/ts-detail.mjs`（逐条明细+解析率自检）+ `tests/tsconfig.strict.probe.json`（旁路 strict 探针） |

**❌ 错误做法**（本次踩坑）：新建 `scripts/check-strict-tests.mjs` + `scripts/strict-tests-whitelist.json` + `package.json` 的 `check:strict-tests`，把 `_nodeMocks.mjs` 重命名为 `.ts` 并补真实类型标注。
**为什么错**：① tests 侧本就有全量门禁（根 `tsc --noEmit`），无需再立白名单；② 在 `strict:false` 配置下，那 9 个文件**原本就已经是 0 错**，所谓"收口"是冗余标注 + 重复造轮子（前辈 2026-09-01 的 `ts-tests.mjs` 体系已覆盖）；③ 违反 Handoff §2.5「tests 侧方法论与工具可直接复用，别重复造轮子」。
**✅ 正确做法**：要做 tests 侧 strict 收口，起点是 `npx tsc -p tests/tsconfig.strict.probe.json --noEmit`（旁路、不动门禁），按探针报告的**真实错误数**排序攻坚，且**绝不新建白名单 JSON**。

### 8.5.2 探针报告的核心排序铁律（§2.5 已强调，此处钉死）

`docs/75-strict探针报告-2026-09-01.md` 第 2 节：

> **按错误总数排序会误判优先级，应改按「真实错误数」排。**

| 文件 | 总错 | 真实错 | 结论 |
| - | - | - | - |
| `accountsStore.test.ts` | 95 | **0** | 纯噪音，别碰 |
| `providerStore.test.ts` | 92 | **0** | 纯噪音，别碰 |
| `logger.test.ts` | 62 | **0** | 纯噪音，别碰 |
| `canvasAgentTools.test.ts` | 89 | **86** | 🎯 M3 靶心（src 类型太宽，TS2322 主导） |
| `useAgentChat.hook.test.ts` | 84 | 21 | 75% 是缺标注，先补测试侧 |

**先吃「准干净」文件**（23 个只差 1~2 处，几乎零风险），再啃真实型大头。

### 8.5.3 修测试的正确姿势（建在前辈踩坑之上，勿重蹈）

前置必读：`docs/75-测试类型消化-Handoff-2026-09-01.md` 的 §7「踩坑记录 19 条」与 §6c 实战。复用要点：

1. **区分「测试错 vs src 连带错」**（踩坑 #3）：跑 `tsc -p tests/tsconfig.strict.probe.json` 时 src 被连带检查，但该探针已是真实文件直跑（无副本），src 错会混入。**动手前先确认报错归属**——是测试侧 mock 形状不对，还是 src 业务类型太宽。前者测侧改，后者（M3）才动 src。
2. **`vi.mocked()` 是标准解法**（踩坑 #10）：`vi.mock`'d 模块的具名导入函数直接 `.mockReset/.mockResolvedValue` 报 TS2339 → 包 `vi.mocked(fn)`。
3. **`vi.fn(async () => …)` 参数被推断成空元组 `[]`**（踩坑 #12，最大根因）：统一改 `vi.fn(async (..._args: any[]) => …)`，一处消 TS2493/TS18048/TS2532 三码；`vi.mock` 工厂 `(...a) => h.x(...a)` 同款 → 若 `h` 属性不被重赋值直接引用 `h.x`。
4. **`importOriginal()` 返回 `unknown`**（踩坑 #16）：`await importOriginal()` 直接 spread 报 TS2698 → 先 `as Record<string, unknown>` 再 spread。
5. **DOM/Canvas/事件 mock 用 `as unknown as X` 收尾**（踩坑 #11）：`getContext` 返回、`fakeDataTransfer()`、事件对象、crypto stub，因缺 DOM 字段报 TS2740/2322，cast 成对应类型（测试 mock 本就只实现被测用到的字段）。
6. **JSX 组件 cast 写法**（踩坑补充）：把 `const X = SomeComp; <X {...props} />` 写成 `(SomeComp as any)({...})` 虽过 TS，但运行时 React 无法以函数调用形式渲染 → 渲染失败。正确姿势：**保留 JSX 语法**，用 `{...({} as any)}` 或 `const XAny: any = SomeComp; <XAny .../>`。
7. **fetch mock 只需类型对齐**（踩坑 #9）：`setup.mjs` 已把 `globalThis.fetch` 定义成共享 vi.fn，运行时就是 mock；TS 却当 `typeof fetch`。`const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>` 即可，**不要**在测试里 `vi.stubGlobal`（会静默失败）。
8. **判据只用 IDE `read_lints`（真实文件）+ `vitest` 实跑**（踩坑 #17 + 探针 §6）：任何「复制副本扫描」的数字（如旧 `m1-scan.mjs`）有 GBK 假阳性，不可信。**全量 `tsc -p tests/tsconfig.strict.probe.json --noEmit` 兜底 + `vitest run` 实跑**才是真干净标准。

### 8.5.4 真实案例：src 重构后测试不同步的修法（2026-09-12 实战）

tests 侧的真实报错，常常是 **src 有意重构（改名/删功能）后，测试还锁着旧签名**——这不是类型收口债，是「改实现没同步测试」的回归。修法**只在测试侧改，绝不碰 src 行为**（Handoff 铁律 2）。

案例 A：`src/components/base/editors/InlineImageCropper.tsx` 把 `cropRectFromSelection(sel, renderW, renderH, natW, natH)` 重构成 `cropRectFromPercent(percentCrop, boxW, boxH, natW, natH)`（纯函数 + object-contain 留白校正 + 单一实现）。测试 `InlineImageCropper.cropRect.test.ts` 改用新函数名/新签名，并**按源码真实输出值**重写断言（contain 校正后：相同宽高比盒子 → 同一选区映射同一自然区域；不同宽高比盒子 → 不保证相等）。

> ⚠️ **测试断言必须反映源码真实行为，不要「假设完美」**。本次写测试时曾按手算假设 `sh:800`，实际源码 `toNatSize(50, 200, 200, 800)=400` → 真实为 `sh:400`；并把「不同宽高比盒子落到同一区域」写成断言（实际只有**同宽高比**盒子才相等）。**手算不如实跑**：写完先 `vitest run` 拿真实返回值，再回填 `toEqual`，避免自以为是。

> ⚠️ **源码边界缺陷要如实记录，不要为测试强行改 src**。本函数当选区贴右边界时 `sx+sw` 会 = `natW+1`（源码 `Math.max(1, Math.min(natW-sx, size))` 在 `sx=natW` 时给出 1，未严格钳制）。这超出「测试对齐」范围，测试只锁形状并标注 `⚠️ 待确认（源码右边界最小宽度未钳制）`，留待 src 侧单独修。

案例 B：`src/components/base/store/taskStore.ts` 移除了 `retryTask(id)` 导出及 `eventBus.subscribe('resource:renamed', …)` 订阅逻辑（有意功能收口）。测试 `taskStore.test.ts` 中依赖它们的用例（`retryTask 触发…`、`resource:renamed 同步 resultUrl` 整块）成为**死测试** → 按 Handoff 铁律 2 删除对应用例 + 解构里移除已删导出 + 移除不再使用的 `publish` import。**保留仍有效的注册语义用例**（`registerTaskRetry → isNodeRegistered`）。

验证（两案例共同）：
```bash
npm run type-check                                    # ✅ 真实门禁绿（原 2 个 TS 错消失）
npx vitest run tests/unit/taskStore.test.ts tests/unit/InlineImageCropper.cropRect.test.ts  # ✅ 18 passed
```

### 8.5.5 一句话总结（给下次接手）

> tests 侧要动手前：**先读 §2.5 两份前辈文档 + 跑 `tsc -p tests/tsconfig.strict.probe.json` 按真实错排序**；修法只动测试侧、沿用 `vi.mocked` / `as unknown as X` / `vi.fn(..._args:any[])` 三板斧；判据用 IDE lints + vitest 实跑；**绝不新建白名单 JSON、绝不重复造 `ts-tests.mjs` 的轮子、绝不假设源码行为（实跑拿真值）**。

---

## 9. 单次任务的交付格式（模板）

```
[strict] <目录/文件>：N 处 → 0 处

- 修改：<文件> —— <错误码> × <数量>（简述修法，如"事件回调参数补 ReactFlow 类型"）
- 验证：
  - npm run check:strict-src → ✅ 白名单 0 报
  - npm run type-check → ✅
  - npx vitest run tests/unit/xxx.test.ts → ✅ N passed
- 白名单：<是否新增目录>
- ⚠️ 待确认：<若有拿不准的，列出来，别硬猜>
```
