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

### 8.5.6 实战进度与下一步（2026-09-13 更新）

**本交接文档的对象**：写给**后续接手的 agent / 未来的同一会话**——记录 tests 侧 strict 收口的进度、靶心与修正手法，便于无缝续作。它不是给某个具体的人，而是给「下一个开工的 AI 会话」的工作备忘录（呼应 §18「读报告 → 选文件 → 修 → 绿了换下一个」的循环）。

**收口累计（本轮会话，10 批共 60 个文件真实错全清零；测试侧真实错已 = 0）**
- 第一批（路径/会话/图像类）：`projectPath` / `agentLogic` / `conversationState` / `imageUpscale` / `storageQuota`
- 第二批（纯函数+图标+通道）：`JianyingIcon`(noise=0 整文件清零) / `d3dPersistence` / `cloudSync` / `channelContract`
- 第三批（组件/数据，`never[]` 根因）：`tracks` / `agentRuntime` / `FaceMosaicNode` / `promptChips` / `VideoGenerate`
- 第四批（组件 `!`/`?.`/`as`）：`AgentPanel` / `CustomEdge` / `LazyImage`
- 第五批（real=6 组：`never[]` 定型 + `as never` 对齐脏数据）：`projectStore` / `refToken` / `imageCompress` / `assetUrl` / `scriptBoxPrompts` / `ImageBoxNode` / `VideoGenerate.upstream`
- 第六批（real=5 组）：`contentStore` / `promptManager` / `agentModelStore` / `ImageGenerate.hoverToolbar` / `director3d.trackWriteParity`
- 第七批（real=4 组）：`TaskCenter` / `useScriptBoxEngine` / `Comet` / `PromptInput.disconnectCleanup` / `useNodeGeneration` / `agentMessages`
- 第八批（1–2 错散兵，标准 `!`/`as unknown as`/`?.()` 桥接）：`providerModels` / `skillStore` / `relayProxy` / `asyncGuard` / `upstreamLink` / `addNodeConcurrency` / `accountsStore` / `taskStore`
- 第九批（1–2 错散兵，`never[]` 默认参标型 / `Record` 定型 / `null as never` 脏数据）：`useNodeData` / `autoSync` / `deriveNodes` / `useVideoPoster` / `useNodeRename` / `useConnectedInputs` / `useCanvasAgentTools` / `useAssetDropPaste` / `workflowState` / `resourceStore` / `scriptBoxEngine` / `storageAdapter` / `taskStore.concurrency`
- 第十批（组件 `querySelector`/`closest`→`!` · `state.nodes`定型 · `mocks`经`any`桥接）：`TemplateNode` / `VideoProcessNode` / `AgentMessage` / `ConnectionLine` / `GridMergeNode` / `NodeTitle`

**验证三道（对标 §5/§8.5）**：增量严格探针**测试侧真实错全清零（=0）** · `npm run type-check`（真门禁）绿 · `vitest run` 全过（含 `imageUpscale` 经 `test:unit:heavy`）。探针全量错误由约 1963 → 1588；其中 **tests 侧真实错已 0**（835 全是噪音码 TS7006/7005/7031/7053/7034/TS7019=隐式 any 产物，按 §8.5.2「别碰」留最后），余 753 为 `src/` 在 strict 探针下**顺 import 被拉入程序**而暴露的严格模式专属问题（错误码 TS2322/2345/2339/18048/18047…，751 真实码+2 噪音码）。⚠️ 注意：这 753 **不是项目实际报错**——根 `tsconfig.json` 刻意 `strict:false`/`strictNullChecks:false`/`noImplicitAny:false`（见该文件注释「非紧急不缩紧」），故真门禁 `type-check` 全绿、`src/` 实际 0 错；它们是 strict 探针照出的潜在类型债，与 test 收口无关，本轮不动。

**修正手法（复用 §8.5.3 三板斧，本轮新增要点）**：`never[]` 根因（`h.state.nodes = []` / `connectedInputs` / `setup` 的 `connected` 默认 `{images:[],texts:[]}` / mock 的 `buttons=[]` / `KV_VALUE={nodes:[],edges:[]}` / `makeHandles(nodes=[],edges=[])` / `state = { nodes: [] }`）→ 定型 `MockNode[]`/`MockEdge[]`/具体元素类型/`any`；`lastData(): any` 对齐 `Record<string,unknown>` 子集访问；可选返回（`loadAgentChatModel`/`getCurrentPending`/`normalizeWorkflow`/`ToolCall.function`/`ChannelKey.fields`/`wfSteer().steerQueue`/`nodeData()`）→ `!` 或定型；`querySelector`/`getSelection`/`find`/`readStored()`/`closest` 返回 null/undefined → `!`；可选回调 `onChange?.()`；`mockResolvedValue(null as never)` 与 `as never` 对齐脏数据用例；`handler`/`resolve`/`r` 被推成 `null` 字面量时 `!`→`never` 不可调用 → 改 `as unknown as (...a:any[])=>void` 桥接；**测试内旧实现对照函数**默认参数 `= []` 需显式标型（如 `removeFrames: number[] = []` / `makeHandles(nodes: any[]=[])`）；`mocks` 来自 `.mjs` 缺字段 → `(mocks as any).xxx` 桥接；`globalThis.chrome` 无索引签名 → `delete (globalThis as any).chrome`。

**下一步：test 侧真实错已清零，收口进入「噪音码收尾」阶段**
- ✅ 截至本批，`tests/unit` 下所有**真实型错误**（排除噪音码）已 = 0；探针 1588 全为噪音码（835 tests + 753 src）。
- 余下 test 侧 835 个噪音码（TS7006/7005/7031/TS7053/TS7034/TS7019）= 隐式 `any` 产物。按 §8.5.2「别碰」铁律**留待最后**：若后续要消，仅机械补参数/索引标注（`(_:any)` / `as any`），**绝不立白名单 JSON、绝不重复造 `ts-tests.mjs`**。
- src 侧 753 错不在 test 收口范围；如需推进应另开专项，不混进本战役。
- 红线（§8.5.1/§8.5.3）：**绝不新建白名单 JSON、绝不重复造 `ts-tests.mjs` 的轮子、绝不假设源码行为（以实跑拿真值）**。

### 8.5.7 src 严格错影响评估（专项备选，非 test 战役范围）

> 背景：严格探针（`tests/tsconfig.strict.probe.json`，`strict:true`）顺着测试 import 把 `src/` 文件拉入程序一并校验，暴露出 **753 个 src 严格错**。它们在根 `tsconfig.json`（`strict:false`/`strictNullChecks:false`/`noImplicitAny:false`，见其注释「非紧急不缩紧」）下**不报错、真门禁 `type-check` 全绿**——属「strict 模式专属潜在债」，非项目当前实际 bug。本评估仅在团队有意推进全仓 strict 时才有意义。

**规模与分布（决定打法）**
- 涉及 **747 个唯一 src 文件**；其中 **741 个文件仅 1 错、6 个文件 2 错**，无集中热点。
- 模块分布：`components` 734、`hooks` 19。即错误**极薄极散**——不是「几个大文件」，而是「几百个文件各 1 处」。
- 含义：**big-bang 全量迁移性价比低、风险高**；适合**童子军法则**（谁改到哪个文件/哪个模块出真 bug，顺手清掉附近 strict 错）。

**价值分层（按错误码）**
| 层级 | 错误码 | 数量 | 性质 / 价值 |
|------|--------|------|------------|
| 高（崩溃防护） | `TS18047`/`TS18048`/`TS2531`/`TS2532`/`TS18049`/`TS2722`/`TS2349` | **266** | 对象可能 `null`/`undefined` 仍访问、可选回调可能未定义仍调用 → 直指 `Cannot read X of undefined` 运行时崩溃。**最高价值**，建议优先。 |
| 中（类型/联合误用） | `TS2339`/`TS2345`/`TS2322`/`TS2769` | **454** | 属性不存在于 `{}`、参数/返回值类型不匹配、联合收窄失败。部分含真实逻辑 bug（如 `.message` 访问 untyped `{}`），部分纯类型层噪声。需逐处判断，不可一刀切 `as any`。 |
| 低（其余） | `TS2538`(`useUnknownInCatchVariables`)/`TS2488`/缺声明 `TS7016`/`TS2783` 等 | **23** | catch 变量需 `as`、缺迭代器、缺 `.d.ts`。量小、机械处理。 |

**高价值子集抽样（266 处，典型形态）**
- `conversationStore.ts`：`conv` 可能 `null`/`undefined` 仍访问（`TS18047/18048`）——会话对象取不到时直接崩。
- `canvasPlanExecutor.ts(904,922,923)`：`e`/`Object` 可能 `undefined`（建图/执行链路）。
- `useCanvasAgentTools.ts(495-775)`：`built.edges`/`built.newNode` 可能 `undefined`，且 `Node | undefined` 不赋 `Node`——**同一根因**：builder 返回可选、代码假设必存在。这类「builder 结果未判空」是批量同构问题，可抽象一处 helper（如 `assertBuilt()`）统一消。

**收益 vs 成本（给决策层）**
- 收益：① 抓到 266 处真会炸的空值崩溃点；② 让 test 侧 strict 收口「名副其实」（被测 src 也严格）；③ 命中根配置注释自陈的判别联合脚枪；④ 长期降债、利重构。
- 成本：747 个触碰点、多数需真设计判断（空值策略/联合结构），粗心 `as any` 静音会反噬（§8.5.2 铁律）；且 753 仅为被测试 import 的子集，全量 strict 化未测文件还会更多。
- 建议路径：**不并入 test 战役**；若立项，按「高价值 266 先行 → 同构根因批量消（如 builder 判空 helper）→ 中价值 454 逐处判真/假阳性 → 低价值 23 机械处理」推进。

**红线（沿用 §8.5.1/§8.5.3）**：**绝不 `as any` 一刀切静音**、**绝不新建白名单 JSON**、**绝不重复造 `ts-tests.mjs`**、**绝不假设源码行为（实跑拿真值）**。高价值空值错优先用「运行时已 guard 则补 `!`/`?.`、未 guard 则补判空/默认」而非强转。

**实战进展（2026-09-13 已动手，src 收口启动）**
- 已启动：`conversationStore.ts`（16 处全消）、`useCanvasAgentTools.ts`（约 15 处全消）、`scriptBoxPrompts.ts`（约 19 处全消）、`useArrangeCanvas.ts`（约 9 处全消）、`useAgentChat.ts`（约 19 处全消，见第 7 点）、`VideoProcessNode.tsx`（约 58 处全消，见第 8 点）、`project.ts`（47 处全消，见第 9 点）、`accountsStore.ts`（19 处全消，见第 10 点）、`skillStore.ts`（15 处全消，见第 11 点）、`OverlayEditor.tsx`（21 处全消，见第 12 点）、`cloudSync.ts`（13 处全消，见第 13 点）、`volumePolicy.ts`/`ImageGenerate.tsx`/`StepPrompt.tsx`/`GridMergeNode.tsx`/`scriptBoxEngine.ts`（共 65 处，见第 14–18 点）。src 严格错 **753 → 606 → 559 → 537 → 522 → 488 → 426**（累计净消 327）。真门禁 `type-check` 绿，相关测试 `conversationState.test.ts`(12)、`useCanvasAgentTools.test.ts`(14)、`scriptBoxPrompts.test.ts`(65)、`useArrangeCanvas.test.ts`(6)、`useAgentChat.hook.test.ts`(65)、`VideoProcessNode.test.tsx`(10)、`director3d.cameraAtFrameWithPath.test.ts`(19)/`director3d.trackWriteParity.test.ts`(11)/`projectPath.test.ts`(18)/`projectsApi.test.ts`(3)/`projectStore.test.ts`(23)/`projectMemoryStore.test.ts`(10)、`accountsStore.test.ts`(30)、`skillStore.test.ts`(16)、`cloudSync.test.ts`(47)/`cloudSync.rehydrate.test.ts`(2)/`OverlayEditor.upstreamSync.test.tsx`(1)（共 180）全过。
- 复用手法（比评估更具体）：
  1. **builder 返回类型加判别联合**：`buildCreateNode` 原无返回标注→TS 把 `newNode`/`edges` 推成可选，调用点 `if(built.error) return…` 无法收窄。改为 `type BuildCreateNodeResult = {error:string} | {id;newNode:Node;edges:Edge[]}`；调用点 `if ('error' in built)` 判别收窄（不能用 `built.error` 因变体 2 无该字段，会 TS2339）。`buildConnect` 同理（`status:'error'|'already'|'created'` 判别联合，消 `edge` 可选误判）。**一处源头定型 → 联动消全部调用点**（约 14 处）。
  2. **`normalizeConversation({合法字面量})!`**：该函数入参非法时真返 `null`（反序列化入口，不可改返回类型），但字面量调用恒合法→`!` 安全、不改运行时。
  3. **catch 变量定型**：`(e as {message?:string})?.message` 替代 `e?.message`（`useUnknownInCatchVariables` 下 `e` 为 `unknown`，直接 `.message` TS2339）。
  4. **注册边界单点断言**：`defs` 为异质联合数组，`{...def,mutating}` 展开后整体不满足 `ToolDef`（且 `execute` 方法简写 vs 属性箭头在 strict 下逐个冲突，强标 `ToolDef[]` 反把 1 错扩成 20）。仅在 `registerTool({...} as ToolDef)` 单点断言，运行时本即合法 ToolDef。
  5. 数组/参数定型：`gate.gens as GenerationStep[]` 等。
  6. **保运行时/测试契约（关键教训）**：消 strict 错时**严禁为过类型而改返回值**。例 `formatLineBreaks(null)` 测试契约断言 `toBe(null)`，原 `if(!text) return text;` 运行时恰返回 `null`（符合契约），仅类型上 `null` 不符声明 `:string`。正确做法 `return text as string`（类型断言、运行时值不变），而非改成 `return ''`（会破坏 `toBe(null)` 测试）。`stripAtRef` 同理用 `text as string | null` 而非 `?? null`（后者把 `undefined` 行为改成 `null`）。**先读该函数的单测契约再动手**。
  7. **useAgentChat.ts（最大单簇，约 19 处全消，src 691 → 672）**：手法——`rec.text ?? ''`（可选默认）；`callTool` 在 `runToolCalls` 注入点包一层 `(name: string|undefined, args) => callTool(name ?? '', args ?? {})` 对齐 `ToolCallCtx.callTool` 形参（`name` 容许 `undefined`、`args` 必填，避免直接传 `(name:string,args?)` 触发逆变报错，且不在 `useCanvasAgentTools` 改签名以免扩散）；`messages` 用 `NonNullable<Parameters<typeof compressToSummary>[0]['messages']>` 收窄（该函数 `messages?` 为可选，原 `as` 仍含 `undefined` 致 `.length` 报 18048）；`provider!` 非空断言（roundTrip / maybeCompressSummary / 强制压缩 3 处，运行期必有 provider）；`a.url ?? ''` 过滤前兜底（配合 `.filter(Boolean)` 等价剔除空串）；`skillsRef.current as SkillItem[]` 单点断言（需补 `agentCore` 的 `SkillItem` 类型 import）；`tc.id!` 回调返回 `string`；`assistant && assistant.tool_calls && assistant.tool_calls.length > 0`（`assistant` 可能 undefined 且 `tool_calls` 为可选属性，需双重判断——先 `assistant` 后 `tool_calls` 真值）；`updateMessageByContent` 的 `patch` 改可选 + 内部 `patch ?? {}`、`cancelPendingConfirm` 参数改 `unknown` + `updateMessageByContent(assistantContent as string, …)`，以对齐返回接口签名（`patch?:` / `assistantContent?: unknown`）。测试 `useAgentChat.hook.test.ts`(65) 全过，`type-check` 绿。
  8. **VideoProcessNode.tsx（最大单簇，约 58 处全消，src 672 → 606）**：单一大型节点组件，报错集中在 `TimelineClip`/`VClip` 的可选字段（`sourceStart`/`sourceEnd`/`duration`/`timelineStart`，类型里标 `?` 但 builder 构造处恒会赋值）。手法——可选数值字段一律 `?? 0`（参与算术/排序/索引/显示，运行时恒有值，行为零变化）；`clip.url!` / `clip!.sourceStart` 断言（clips 构造恒带 url/`trim` 分支下 clips[0] 必存在）；`let clip: VClip | undefined` + `if (!clip) return` 消除 `Object.assign` 的 TS2769 与 `clip` 未定义；`sourceMetadata[id ?? '']` / `currentClip.sourceId != null ? sourceMetadata[id] : undefined` 消除 `undefined` 索引 TS2538；`meta.duration ?? 0` 避免 NaN；`previewUrls.create(...)` 返回 `string | null` → `if (!u) continue` 跳过（原本 `?? ''` 亦可，但 continue 更贴合"无 blob 不记缩略图"语义）；`spawnAndCommit(..., { history: history ?? undefined })` 收口 `CanvasHistoryApi | null`；catch 变量 `e` 为 `{}` → `(e as { message?: string })?.message`；`data.mode ?? ''` 喂 `normalizeMode`。测试 `VideoProcessNode.test.tsx`(10) 全过，`type-check` 绿。
  9. **project.ts（最大单簇，47 处全消）**：3D 导演台领域逻辑（纯函数归一化/求值）。手法——① `normalizeInterpolation(key.interpolation ?? '')`：`key.interpolation` 可选字段喂给要求 `string` 的归一化函数，统一 `?? ''` 兜底（函数内部对空串有定义行为）；② `numeric`/`color` 两个闭包形参由 `number`/`string` 放宽到 `number | undefined`/`string | undefined`：它们本就 `Number(value)`/`String(value || '')` 容错，调用点 `lighting.*` 来自 `Partial<ProjectLighting>` 必为可选，单点放宽比逐参数 `?? fallback` 更省且行为零变化；③ `key.fields?.[field]`：`ChannelKey.fields` 已是可选属性，索引访问补可选链（连同 `normalizeCameraField`/`normalizeObjectField` 的 `key.fields[field]` 入参）；④ `keys.at(-1)` 先取出为 `lastKey` 再 `lastKey?.frame ?? 0` 判空，并 `left/right: lastKey ?? keys[0]` 保类型非 null；⑤ `locateChannelKey` 的 `left/right/key` 在三个求值函数（`evaluateNumericChannel`/`evaluateActionChannel`/`evaluateSkeletonChannel`）调用点加 `!`：三函数开头已对 `!keys.length` 提前返回，运行期到 `left/right/key` 使用时恒非 null，符合「运行期已 guard 则补 `!`」原则；⑥ `OBJECT_STATE_FIELDS[object.type ?? '']`、`object.position/rotation/scale ?? []`、`normalizeObjectTrack(..., object.type ?? 'object')` 三处可选字段兜底空值；⑦ `canvas.getContext('2d')!`：浏览器运行期恒非 null。测试 `director3d.cameraAtFrameWithPath.test.ts` 等 6 文件 84 全过，`type-check` 绿。
  10. **accountsStore.ts（19 处全消）**：浏览器扩展环境桥（`chrome.tabs`/`chrome.cookies`/`chrome.scripting`）。手法——① `chrome.*` API 在严格模式类型里被标为「可能 undefined」（仅扩展运行期恒存在），17 处访问统一加 `!`（`chrome.tabs!.query`/`chrome.cookies!.getAll`/`chrome.scripting!.executeScript` 等）：**不**用 `?.`（会让返回值退化成 `Promise | undefined` 并向下游级联 `undefined`），`!` 才保住返回类型、运行期零变化；② catch 变量 `e`（`useUnknownInCatchVariables` 下为 `unknown`）→ `(e as {message?:string})?.message`；③ `parseCookies` 的 `map(...)` 回调显式标注返回 `AccountCookie | null`，再 `.filter((c): c is AccountCookie => c !== null)` 收窄（直接 `.filter(Boolean)` 不剔除 null 类型，触发 TS2322/TS2677）。测试 `accountsStore.test.ts`(30) 全过，`type-check` 绿。
  11. **skillStore.ts（15 处全消）**：手法——① `ch.codePointAt(0) ?? 0`：`String.prototype.codePointAt` 返回 `number | undefined`，单字符迭代恒有值，兜底 0（不影响乱码判定）；② 8 处 catch 变量 `e`（`useUnknownInCatchVariables` 下为 `unknown`，访问 `.message` 报 TS2339 `不存在于 {}`）→ 统一 `(e as {message?:string})?.message || String(e)`（logger 透传原始 `e` 保留排查信息）。测试 `skillStore.test.ts`(16) 全过，`type-check` 绿。
  12. **OverlayEditor.tsx（21 处全消）**：手法——① `useEffect` 内 `const d = dragRef.current;`（`DragState | null`）→ 在 rAF 批量回调开头加 `if (!d) return;` 收窄（运行期 `dragRef.current` 在 `onUp` 的 `batch.flush()` 之前已置位，且 flush 后即便后续 rAF 迟到早退也仅跳过一帧，行为零变化）；② 另一 rAF 内 `const p = pending;`（`Point | null`）→ 同理 `if (!p) return;`；③ 菜单按钮 `onClick` 为可选属性 `(() => void) | undefined`，调用由 `onClick()` 改为 `onClick?.()`。测试 `OverlayEditor.upstreamSync.test.tsx`(1) 全过，`type-check` 绿。
  13. **cloudSync.ts（13 处全消）**：手法——全部为 catch 变量 `e`（`useUnknownInCatchVariables` 下为 `unknown`）。① 两处 `onError(e.message)`（`onError` 形参要求 `string`）→ `onError((e as {message?:string}).message ?? String(e))`；② 其余 11 处 `e?.message`（`logger.warn` 透传、可 `|| '未知'/'同步失败'` 兜底）→ 统一替换为 `(e as {message?:string})?.message`，保留 `?.` 以便后续 `||` 兜底生效。测试 `cloudSync.test.ts`(47)/`cloudSync.rehydrate.test.ts`(2) 全过，`type-check` 绿。
- `volumePolicy.ts`（13 处全消，src 488 → 475）：手法——`downgradeConversation` 返回 `Conversation | null | undefined`，`projected` 定型为 `Conversation[]` 并经类型谓词 `filter((c): c is Conversation => c != null)` 收窄；克隆循环内 `c.messages`/`c.memory?.summary` 可选字段补 `?? ''`/`?? []` 兜底。测试 `volumePolicy.test.ts`(21) 全过，`type-check` 绿。
- `ImageGenerate.tsx`（14 处全消，src 475 → 461）：手法——`sync` 的 5 个 `Dispatch<SetStateAction>` 包成 `(v: unknown) => setX(v as 真类型)`（cameraSettings 用 `CameraGenerationSettings | undefined` 而非 `string`）；`provider: useProvider!`；`refUrls` 经 `filter((u): u is string => u != null)` 收窄；`setAssetUrl(r.url ?? '')`/`data.label ?? ''`/`label ?? ''` 兜底；`targetRef` as `React.RefObject<HTMLElement>`、`zoomUrl ?? undefined`、`history: history ?? undefined`。测试 `ImageGenerate.*.test.tsx`(24)/`volumePolicy.test.ts` 全过，`type-check` 绿。
- `StepPrompt.tsx`（12 处全消，src 461 → 449）：手法——`ScriptBoxShot.id`/`prompt`/`videoPrompt` 可选字段在回调实参处统一 `?? ''`；批量 `shots[i].id` 在 `.map` 内 `?? ''` 匹配 `(string|number)[]`。无同 stem 测试，`type-check` 绿。
- `GridMergeNode.tsx`（12 处全消，src 449 → 437）：手法——`urls`/`imgs` 经类型谓词 `filter`（`u is string`/`img is HTMLImageElement`）消 `.filter(Boolean)` 不收窄连锁；`openZoom(preview ?? '')`/`zoomUrl ?? undefined`/`history: history ?? undefined`。测试 `GridMergeNode.test.tsx`(6) 全过，`type-check` 绿。
- `scriptBoxEngine.ts`（14 处全消，src 437 → 426）：手法——5 处 catch 变量 `e?.message` → `(e as {message?:string})?.message`；`addNodes` 可选 → `addNodes?.()`；`connectShotNode`/`shotHandleId` 实参 `id ?? ''`；`prevTailFrameVariants` 经 `as TailFrameVariant[]` 收窄消除 `unknown` 回调形参错。测试 `scriptBoxEngine.test.ts`(44)/`useScriptBoxEngine.test.ts`(12) 全过，`type-check` 绿。
- （注：本批之前工作树尚有 **426 → 349** 的中间批次已在 WIP 中清零但未单独记账——即 `TextGenerate`/`VideoGenerate`/`TemplateNode`/`PromptInput`/`agentRuntime`/`videoEngine`/`InlineImageCropper`/`conversationState`/`StepShots`/`SceneGizmo`/`scriptBoxPlaybookManager` 等目录级清零；本批承接 **349** 续作。）
- `App.tsx`（41 处全消，src 严格错 349 → 299）、`useToast.ts`（3 处，根因 `useState([])` 推断 `never[]`）、`Timeline.tsx`（导出 `KeyframeMove` 消除同名类型碰撞）。App.tsx 41 处手法：**根因两处**——① `useToast` 的 `useState([])` 推断为 `never[]` → `useState<ToastItem[]>([])`（新增本地 `ToastItem` 接口），消除 `toasts.map` 内 `item.level/id/text` 的 5 处 `never`；② `Timeline` 本地 `interface KeyframeMove` 与 App 内同名 interface 碰撞（TS2719，`onMoveKeyframes` 误报"两个同名类型"）→ 改为在 `Timeline` 导出、`App` import 复用、删除本地重复定义。**机械收窄**：`clearTimeout(history.timer ?? undefined)`（`timer: ReturnType<typeof setTimeout> | null`，`clearTimeout` 不吃 null）、`setActiveShotId(x.activeShotId ?? '')`（2 处，`string | undefined → string`）、`entityTypeFor(trackId ?? '')` + `characterKeyframes[trackId ?? '']`（`trackId: string | null` 索引/入参）、`objectAtFrame(objects.find(...) !)`、`monitorCanvasRef.current!`（函数内部 `?.` 兜底）、`source.position ?? [0,0,0]`、`setObjectInterpolation/moveObjectFrame` 的 `trackId!`（else 分支恒非空）、catch `error` 取 `message` 改 `(error as {message?:string})?.message`（3 处）、`document.activeElement?.tagName ?? ''`、`applyTimingToPath` 返回 `MotionPath | null` → `if(!next) return` 守卫、`let canvas: HTMLCanvasElement | null` + 局部 `current = ref.current as HTMLCanvasElement | null`（ref.current 在异步循环中 CFA 被收窄为 `never` 的怪象，断言收窄）。**JSX prop 对齐**：`onGizmoReady` 参数补 `| null`（对齐 `MainViewport`/`SceneGizmo` 的 `(handler: ((name:string)=>void) | null) => void`）、`onSelect={(id: string|null) => setSelectedId(id ?? '')}`（对齐 `EditorSceneProps.onSelect: (id: string | null) => void`）、`selected={inspectorSelected ?? null}`（undefined→null）、`objectTrack` 的 `name/type ?? '' / ?? 'object'`（对齐 `ObjectTrackView` 的 `string` 字段）。验证：`npx tsc -p tests/tsconfig.strict.probe.json` App.tsx = 0；`npm run type-check` 绿；`vitest run tests/unit/director3d`（cameraAtFrameWithPath 19 + trackWriteParity 11 = 30）全过。
- 余量：src 严格错剩 **299**（高频簇再消 App.tsx 41；此前"741 文件各 1 错"评估已证伪，实际为多个高密度簇，应优先吃簇）。当前剩余密度排名：`director3d/Viewport.tsx`(38) / `panels/AgentPanel.tsx`(37) / `director3d/models.tsx`(34) / `nodes/Director3DNode.tsx`(6) / `director3d/panels/AssetMenu.tsx`(6) / `scriptbox/scriptBoxPlaybookStore.ts`(5) / `panels/AgentMessage.tsx`(5) / `nodes/ImageBoxNode.tsx`(5) / `nodes/AssetNode.tsx`(5) / `director3d/tracks.ts`(5) / `director3d/panels/Timeline.tsx`(5) / `director3d/panels/Inspector.tsx`(5) / `base/store/projectStore.ts`(5) / `base/prompt/PromptLibrary.tsx`(5) / `agent/conversation/conversationSnapshot.ts`(5) …（其余 4 及以下）。继续按「高密度簇优先（判别联合源头）+ 簇内空值字段机械 `?? 0`/`!`/`?.`/`as 收窄」推进；`Viewport`/`AgentPanel`/`models.tsx` 三簇为异质真类型问题，需逐处设计判断（同簇机械项如 `Timeline` 的 `event.currentTarget.parentElement` 可能 null、`string | undefined` 入参等，可一并收口）。

### 8.5.8 src 总开关已全开（2026-09-13 决策）→ ✅ 已全绿（src 严格错 281 → 0）

> **状态变更**：根 `tsconfig.json` 的 `strict` 总开关已从 `false` 翻为 **`true`**，并一并开启 `noImplicitAny` / `strictNullChecks` / `noUnusedLocals` / `noUnusedParameters` / `noImplicitReturns`。**tests 经 `exclude` 排除，保持原宽松态不变**（由其他 AI 专项收口，本手册 §8.5 流程不变）。

**翻开关瞬间实测（清 incremental 缓存全量重算，`npx tsc --noEmit`）**：src 严格错 = **281 处**。错误码分布（作战地图）：

| 类别 | 错误码 | 数量 |
|---|---|---|
| 未使用类（3 配套触发，机械可消） | TS6133+TS7030+TS6196 | 29 |
| 参数/属性/赋值不匹配（strict 类型） | TS2345+TS2339+TS2322+TS2769+TS2349+TS2698 | 196 |
| 空值未判（高价值崩溃点） | TS18047+TS18048+TS18049+TS2532+TS2531+TS2722+TS18046 | 52 |
| catch 变量 / 其他 | TS2538+TS2739 | 5 |

> **✅ 终态（2026-09-13 收口，实测 `npx tsc --noEmit --incremental false` = 0 错 / exit 0）**：
> 上述 281 处已在本会话后续工作中**全部清零**（`src` 侧严格模式专项、含 §8.5.7 所记 src 严格错专项随之结清），修复落在未提交工作树（134 文件改动，净删为主，符合"补类型标注 / 去 `as any`"形态）。
> 打法即按原作战要点执行：**52 处空值崩溃点先行**（运行期已 guard 补 `!`/`?.`、未 guard 补判空/默认；catch 变量 `e` 统一 `(e as {message?:string})?.message`）→ **29 处未使用类机械清**（TS6133/TS7030/TS6196）→ **196 处严格类型错逐处判真/假阳性**（禁用一刀切 `as any`，保运行时/测试契约优先，见 §8.5.7 第 6 点 `formatLineBreaks`/`stripAtRef` 教训）。
> **`noImplicitAny` 隐式 any = 0**（TD-09-1 门禁守住，翻开关不爆量）；`npm run type-check` 对 src **现已全绿**，`src` 侧严格收口正式结案。

**原作战要点（已执行完，备查）**：① 隐式 any = 0，翻开关不爆量；② 52 处空值崩溃点优先消；③ 196 处严格类型错逐处判真/假阳性，禁一刀切 `as any`；④ 29 处未使用类机械清。

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

---

## 8.5.9 test 侧严格收口行动计划（2026-09-13 续作 · 供后续 AI 接手）

> **本作战对象**：`npm run type-check`（= `tsc --noEmit`，根 `tsconfig.json` 已 `strict:true` 且 `include` 现已含 `tests/**`）在 tests 侧报出的 **866 处**错误。src 侧已 0 错（已实测 `grep '^src/'` = 0），本战役**只动 tests，绝不碰 src**。
> **目标**：让 `tsc --noEmit` 全仓库 exit 0；行为零变化（`vitest` 实跑仍全过）。
> **本段为「计划 + 现状快照」，不含已实施改动**（动手请另开会话，按 §9 模板记账）。

### 8.5.9.1 现状快照（2026-09-13 实测）

| 维度 | 数值 |
| - | - |
| 总错误 | **866** |
| 涉及文件 | **90**（`tests/unit/**` + 4 个 `.mjs` 底座） |
| src 侧错误 | **0 ✅**（已收口，勿动） |
| 真门禁 | `npm run type-check` → `tsc --noEmit`（现已含 tests） |

### 8.5.9.2 错误码分布（作战地图）

| 错误码 | 数量 | 含义 / 标准修法指向 |
| - | - | - |
| **TS7005** | 363 | 变量（常是 `let mod`）被推成 `any` → §8.5.9.3 根因 A |
| **TS7006** | 313 | 函数/箭头参数隐式 `any` → 根因 B / E |
| **TS7031** | 61 | 解构绑定（`{ children, label }`）隐式 `any` → 根因 D |
| **TS7034** | 55 | 变量在部分位置无法定型的 `any` → 根因 A 伴生 |
| **TS7053** | 30 | 索引访问（字符串键）隐式 `any` → 根因 F |
| **TS7019** | 27 | rest 参数 `(...a)` 隐式 `any[]` → 根因 C / E |
| **TS6133** | 17 | 声明但未使用（unused）→ 根因 G |

> 注：旧 `strict-report.mjs` / `tests/tsconfig.strict.probe.json` 探针**不再作为权威门禁**——根 `tsconfig` 现已全量 strict 且含 tests，直接用 `npx tsc --noEmit` 看真实数字。探针可当「更严一档」可选复检，但权威以 `type-check` 为准。

### 8.5.9.3 根因分组与标准修法（按根因聚类，比按文件更高效）

#### 根因 A — 动态 import 句柄 `let mod;`（清掉 363 TS7005 + 伴生 55 TS7034 + 大部分 TS7006）

`accountsStore.test.ts` 等大量文件用 `let mod; mod = await import('...')` 拿模块句柄。`mod` 被推成 `any` 后，所有 `mod.xxx` 访问与回调参数连带报 `any`。**一处注解清一整簇**：

```ts
// ❌ before
let mod;
beforeEach(async () => { mod = await import('../../src/components/base/store/accountsStore.ts'); });

// ✅ after（精确模块类型，零 any）
let mod: Awaited<typeof import('../../src/components/base/store/accountsStore.ts')>;
beforeEach(async () => { mod = await import('../../src/components/base/store/accountsStore.ts'); });
```

> 这是**杠杆最高**的一招：每个文件只需标一次类型，`mod` 下的 TS7005/7034 与众多 TS7006 一并消失。涉及文件含 `accountsStore`(96)、`providerStore`(42)、`previewUrl`(37)、`httpClient`(20)、`kvStore`(17)、`storageAdapter`(22)、`agentRuntime`(6) 等所有有此模式的文件。

#### 根因 B — `vi.mock` 工厂内联箭头参数（TS7006）

```ts
// ❌ before
vi.mock('react', () => ({ useSyncExternalStore: (subscribe, getSnapshot) => getSnapshot() }));

// ✅ after（标真实形参；未用的标 _ 前缀顺带清 TS6133）
vi.mock('react', () => ({
  useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => getSnapshot(),
}));
```

#### 根因 C — `.mjs` 底座的 rest 参数 `(...a)`（TS7019，27 处）

4 个 `.mjs` 在 `checkJs:true` 下被查。`.mjs` **不能写 TS 语法**，用 JSDoc：

```js
// ❌ before
const mockNode = (...a) => h.x(...a);

// ✅ after（JSDoc rest 注解）
/** @param {...any} a */
const mockNode = (...a) => h.x(...a);
```

涉及：`_nodeMocks.mjs`(34)、`_channelLegacy.mjs`(17)、`setup.mjs`(12)、`_testUtils.mjs`(8)。**先打这 4 个底座**，它们被大量测试 import，清掉能顺带消很多下游报错。

#### 根因 D — `.mjs` mock 组件解构 `({ children, label })`（TS7031，61 处中大部分在 `.mjs`）

```js
// ❌ before
const MockNode = ({ children, label, title, testId }) => <div data-testid={testId}>{children}</div>;

// ✅ after（JSDoc props 形状）
/** @param {{children?: any, label?: string, title?: string, testId?: string}} props */
const MockNode = ({ children, label, title, testId }) => <div data-testid={testId}>{children}</div>;
```

> `.tsx` 内的解构（如 `AgentPanel.test.tsx`、`CustomEdge.test.tsx`）同因，直接给组件 props 标接口/内联类型即可（不必 JSDoc）。

#### 根因 E — `vi.fn` 工厂 / mock 回调参数（TS7006 / TS7019 散兵）

测试 mock 回调本就只实现被测用到的字段，参数无可指摘的「真实类型」时，用前辈三板斧之一（§8.5.3 #3）：

```ts
// ❌ before
const fn = vi.fn(async () => 1);

// ✅ after（rest 标 any[]，一处消 TS7019/TS2493/TS18048/TS2532）
const fn = vi.fn(async (..._args: any[]) => 1);
```

#### 根因 F — 索引访问 `obj[key]`（TS7053，30 处）

- `STORAGE_KEYS[key]` / `EVENTS[key]`：`key` 是 `string` 去索引 `StorageKeyMeta`/`EventRegistryEntry`（无索引签名）。优先把 `key` 收窄成 `keyof typeof STORAGE_KEYS`；若确为动态键，给常量补 `[k: string]: ...` 索引签名或 `as Record<string, X>`。
- `obj['data-label']` 去索引 `{'data-testid': string}`：给 mock props 类型补索引签名或加该具体键。
- 通用：索引键是 `any` 时，先回去修那个 `any`（多半是根因 A/B 的伴生），不要只给对象补 `Record` 掩盖源头。

#### 根因 G — 未使用声明 TS6133（17 处）

- 未使用的**参数** → 改名加 `_` 前缀（`noUnusedParameters` 自动忽略）。
- 未使用的**局部变量**（含解构 `...rest`）→ `noUnusedLocals` **不**认 `_` 前缀，需删除该绑定；若解构 rest 必须保留，用 `void rest;` 或直接从模式中删掉。
- `import React` 未用（react-jsx 转换无需它）→ 删掉 import，或改 `import type React`。
- `.mjs` 同样受 `checkJs` 的 unused 检查约束，规则一致。

### 8.5.9.4 铁律澄清（test 侧 `any` 容忍边界，避免接手者 confusion）

- §1「禁止 `any`」是**针对生产代码（src）**的硬律，src 已守住、勿动。
- **test 侧（`.test.*` + 4 个 `.mjs` 底座）明确豁免**（依据 §8.5.3 / §8.5.6 前辈体系）：mock 工厂 / mock 回调 / 测试夹具里无可指摘真实类型时，允许 `(..._args: any[])` / `as unknown as X` / `(_: any)`。
- **优先用精确类型**：根因 A 的 `Awaited<typeof import('...')>`、根因 B 的具名形参都零 `any` 且更优——能免 `any` 就免。
- **绝不**用 `any` 去粉饰一个「本该由 src 收窄」的真实类型问题（那才是 §1 违规）。若某报错根在 src 类型太宽，本战役只在 test 侧对齐，**不回头改 src**（与 §8.5.4 同原则）。

### 8.5.9.5 建议执行顺序（按根因聚类，簇内按文件密度从高到低）

1. **打 4 个 `.mjs` 底座**（根因 C/D，71 处）→ 顺带消大量下游。
2. **根因 A 簇**（`let mod` 动态 import，约 350+ 处）→ 每文件一处注解，杠杆最高。
3. **根因 B / E 簇**（`vi.mock` 工厂 + `vi.fn` 回调）。
4. **根因 G**（TS6133 散兵，17 处，纯机械）。
5. **根因 F**（TS7053 索引，30 处，逐处判）。
6. **剩余 TS7006/TS7031/TS7019 散兵**（各 `.test.ts(x)` 内）→ 按根因 B/D/E 套用。
7. 每清完一个根因/一批文件 → 跑 §8.5.9.7 三道验证 → 绿了进下一批（小步可回滚）。

### 8.5.9.6 完整按文件清单（90 文件，数字 = 该文件错误数）

```
  96  tests/unit/accountsStore.test.ts          37  tests/unit/previewUrl.test.ts
  62  tests/unit/logger.test.ts                 34  tests/unit/_nodeMocks.mjs
  52  tests/unit/scriptBoxEngine.deep.test.ts    25  tests/unit/useAssetDropPaste.test.tsx
  48  tests/unit/inputStateMachine.test.ts       24  tests/unit/director3d.trackWriteParity.test.ts
  42  tests/unit/providerStore.test.ts           23  tests/unit/AgentPanel.test.tsx
  22  tests/unit/storageAdapter.test.ts          20  tests/unit/httpClient.test.ts
  17  tests/unit/kvStore.test.ts                 17  tests/unit/_channelLegacy.mjs
  17  tests/unit/VideoGenerate.test.tsx          14  tests/unit/promptHub.test.ts
  13  tests/unit/canvasPlanExecutor.deps.test.ts 12  tests/unit/ImageGenerate.upstream.test.tsx
  12  tests/unit/ImageGenerate.hoverToolbar.test.tsx 12 tests/unit/setup.mjs
  10  tests/unit/creditGateModes.test.ts         10  tests/unit/VideoGenerate.upstream.test.tsx
   9  tests/unit/persistFailedChain.test.ts       9  tests/unit/channelEvaluation.test.ts
   9  tests/unit/TemplateNode.test.tsx            9  tests/unit/TaskCenter.test.tsx
   8  tests/unit/useScriptBoxEngine.test.ts       8  tests/unit/useResourceCardDragProps.test.ts
   8  tests/unit/filesApi.test.ts                8  tests/unit/_testUtils.mjs
   7  tests/unit/tracks.test.ts                   7  tests/unit/storageQuota.test.ts
   7  tests/unit/ImageGenerate.saveRatioSync.test.tsx
   6  tests/unit/scriptBoxEngine.test.ts          6  tests/unit/promptChips.test.ts
   6  tests/unit/lazyNode.test.tsx               6  tests/unit/director3d.cameraAtFrameWithPath.test.ts
   6  tests/unit/assetTools.test.ts              6  tests/unit/agentRuntime.test.ts
   6  tests/unit/FaceMosaicNode.test.tsx         6  tests/unit/ConnectionLine.test.tsx
   5  tests/unit/useImageHoverActions.test.tsx    5  tests/unit/useAssetDragToCanvas.test.ts
   5  tests/unit/cameraLook.test.ts              5  tests/unit/CustomEdge.test.tsx
   5  tests/unit/Comet.test.tsx
   4  tests/unit/promptManager.test.ts           4  tests/unit/generate.test.ts
   4  tests/unit/GhostTargetNode.test.tsx
   3  tests/unit/useVideoPoster.test.ts          3  tests/unit/useNodeGeneration.test.ts
   3  tests/unit/useCanvasShortcuts.test.tsx      3  tests/unit/upstreamLink.test.ts
   3  tests/unit/skillStore.test.ts              3  tests/unit/nodePrefsRegression.test.ts
   3  tests/unit/PromptInput.sharedValue.test.tsx 3 tests/unit/PromptInput.disconnectCleanup.test.tsx
   3  tests/unit/LazyImage.test.tsx              3  tests/unit/GroupNode.test.tsx
   2  tests/unit/useResourceMoveToFolder.test.tsx 2 tests/unit/tokenBudget.test.ts
   2  tests/unit/taskStore.concurrency.test.ts   2  tests/unit/relayProxy.test.ts
   2  tests/unit/projectStore.test.ts            2  tests/unit/faceMosaic.test.ts
   2  tests/unit/deriveNodes.test.ts             2  tests/unit/debouncedPersist.test.ts
   2  tests/unit/contracts.test.ts               2  tests/unit/StepShots.upstream.test.tsx
   2  tests/unit/ImageBoxNode.test.tsx           2  tests/unit/AgentMessage.test.tsx
   1  tests/unit/utils.test.ts                   1  tests/unit/useFitNodeRatio.test.ts
   1  tests/unit/useCanvasSync.test.ts           1  tests/unit/useAssetDegrade.test.ts
   1  tests/unit/useAgentChat.hook.test.ts       1  tests/unit/scriptBoxPrompts.test.ts
   1  tests/unit/scriptBoxPromptResolver.test.ts 1  tests/unit/resourcesApi.test.ts
   1  tests/unit/nodeTypes.test.ts               1  tests/unit/d3dPersistence.test.ts
   1  tests/unit/cloudSync.test.ts               1  tests/unit/channelContract.test.ts
   1  tests/unit/captureFrame.test.ts            1  tests/unit/assetUrl.test.ts
   1  tests/unit/assetMove.test.ts              1  tests/unit/agentPersistRecovery.test.ts
   1  tests/unit/agentAttachments.test.ts       1  tests/unit/ChatMarkdown.test.tsx
   1  tests/unit/AssistantTablePreviewCard.test.tsx
```
> 实时重算：`npx tsc --noEmit 2>&1 | grep -E '^tests/' | sed -E 's#\(.*##' | sort | uniq -c | sort -rn`

### 8.5.9.7 验证三道（每批必跑，全绿才算完）

```bash
npx tsc --noEmit                                  # ✅ 权威门禁：全仓库（含 tests）exit 0；866 → 0
npx vitest run <本批所碰测试文件>                  # ✅ 行为零变化，实跑仍全过（改的只是类型标注/未用声明）
npm run check:strict-src                          # ✅ 顺带确认：src 白名单仍 0 报（证明没误伤 src）
```
> ⚠️ **绝不**为过类型而改测试断言/返回值（§8.5.7 第 6 点 `formatLineBreaks`/`stripAtRef` 教训）。本战役只加类型标注、删未用声明、给 mock 补形状——逻辑、断言、运行时一律不动。

### 8.5.9.8 进度记账模板（接手者每批提交时用，套 §9 格式）

```
[strict-tests] <根因/文件>：N 处 → 0 处
- 修改：<文件> —— <错误码> × <数量>（简述，如"let mod 补 Awaited<typeof import> 定型" / ".mjs rest 补 JSDoc @param {...any}"）
- 验证：
  - npx tsc --noEmit → ✅ 0
  - npx vitest run <相关> → ✅ N passed
  - npm run check:strict-src → ✅ 白名单 0 报
- ⚠️ 待确认：<拿不准的列出来>
```

> **终态判据**：`npx tsc --noEmit` 输出为空、exit 0，且 `tests/**` 与 `src/**` 同绿 → test 侧严格收口结案。
