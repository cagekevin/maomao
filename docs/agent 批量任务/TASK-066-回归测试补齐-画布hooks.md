# 回归测试补齐 · 画布与同步 hooks（TASK-066）

> 委派给：执行 AI
> 类型：**C/D（代码改写：新增回归测试）** —— 目标明确，需精确源文件定位
> 唯一产出：`tests/unit/canvasHooks.test.js`。**你只能写这个文件，碰任何其他文件视为失败。**

---

## 一、任务背景

项目 `maomao`（React Flow 画布）已有 `tests/unit/` 下 34 个测试文件、424 个测试，但**覆盖不全**。
本项目要批量补齐基础层回归测试。你负责为以下模块编写 vitest 单测（**新增文件**，不动任何已有文件）。

> 📄 代码基底参考：`tests/unit/` 下已有测试的模式（如 `storageAdapter.test.js`、`historyStack.test.js`、`eventBus.test.js`）可作为写法范例，可读但**不可改**。

---

## 二、并发安全（先读，最高优先）

## ⚠️ 铁律（违反即重做，并发安全最高优先）

1. **只允许运行这一个命令验证你的测试**：
   ```bash
   npx vitest run tests/unit/<你新建的测试文件>
   ```
   vitest 单文件运行是**进程内隔离**的（tests/setup.mjs 注入内存版 localStorage，不落盘、不占端口、不写任何共享文件），
   即使多个 AI 同时在各自终端跑各自的单文件测试，也**互不干扰**。
2. **绝对禁止运行以下任何命令**（它们占用共享资源，多个 AI 同时跑会冲突/竞争）：
   - `npx vitest run`（全量）—— 会跑所有测试文件
   - `node scripts/regression_test.cjs` —— 生成共享临时文件 `.regression-entry.cjs`
   - `npm run test:e2e` / `playwright test` —— 占用端口 5180 + 写 `tests/e2e/results.json`
   - `npx vite build` —— 写 `dist/` 目录
   - `node scripts/run_all_tests.cjs` —— 串行跑全套门禁
3. **绝对禁止修改 / 删除任何已存在的文件**，包括：
   - `tests/unit/` 下已有的 34 个测试文件（只能读作参考，不能改）
   - `src/` 下任何源文件（只读，不准动）
   - 其他任何非本任务产出的文件
   你只允许**新建**你自己唯一命名的测试文件。
4. **禁止新建任何非测试文件的资源**：不创建临时文件、不监听端口、不写输出文件、不 build。
5. 你的产出**只写一个文件**：`tests/unit/<你自己命名的测试文件>`。碰任何其他文件视为失败。


---

## 三、你要补测试的模块

### 1. `src/components/base/useCanvasHistory.js`

**模块职责**：撤销/重做 hook：核心逻辑已下沉 HistoryStack 纯类（已有测试），本 hook 做 React 桥接。补 useCanvasHistory 的 hook 层测试（历史栈测试注释明确标注"遗漏项"）。

**测试覆盖点（至少覆盖以下，可补充更多）**：
- record(snapshot) 调 stack.push 并触发重渲染
- undo/redo 调 stack.undo/redo 并 apply 快照、启动 600ms suppress
- clear 清空历史
- record 不传 snapshot 时回退用 getSnapshot()

**测试策略**：renderHook + mock HistoryStack（或直接测真实 HistoryStack）；断言 record/undo/redo/clear 调用 getSnapshot/apply 的行为。

---

### 2. `src/components/base/useSyncNodeData.js`

**模块职责**：节点 data 外部变更→本地 state 同步 hook：data 字段变化时调对应 setter；跳过首次与未变化。

**测试覆盖点（至少覆盖以下，可补充更多）**：
- data 字段变化 → 调对应 setter(next)
- 首次渲染不触发 setter（跳过初始化）
- 字段未变化不触发
- setter 非函数时跳过

**测试策略**：renderHook 模拟多次 data 变化断言 setter 调用。

---

### 3. `src/components/base/workflowRuntime.js`

**模块职责**：工作流运行时（纯逻辑，注释明确"可独立单测"）：createWorkflow 生命周期 status 流转、cancel/confirm/rollback/undo 栈。

**测试覆盖点（至少覆盖以下，可补充更多）**：
- createWorkflow 初始 status=idle
- start 后进入 planning/creating_nodes/running
- cancel 真取消所有运行中任务（AbortController）
- pushUndo/popUndo 栈行为
- confirm 翻转 awaitingConfirm
- rollback 清理建的节点

**测试策略**：纯逻辑直接 import 测；mock eventBus.publish。


---

## 四、硬约束

1. **测试框架**：vitest（项目已有）。用 `import { describe, it, expect, vi, beforeEach } from 'vitest'`。
2. **环境**：`tests/setup.mjs` 已注入内存版 localStorage/sessionStorage，可直接用。
3. **mock 原则**：
   - 源模块依赖 `global.fetch` 的 → 用 `vi.stubGlobal('fetch', mockFn)` 或 `globalThis.fetch = ...` mock。
   - 源模块依赖 `storageAdapter` 的 → 用 `vi.mock('.../storageAdapter.js', ...)` 提供内存实现（参考 projectStore.test.js）。
   - **禁止**对源模块本身做 partial mock 到"掩盖真实逻辑"的程度；mock 只针对外部依赖（fetch/localStorage/console/浏览器 API）。
4. **不要改源模块代码**。若某函数强依赖浏览器（如 canvas），只测可抽离的纯逻辑部分 + 明确用 `// TODO: 浏览器依赖未测` 注释说明。
5. **测试必须能跑通**：`npx vitest run tests/unit/canvasHooks.test.js` 0 失败。
6. 测试命名、断言清晰，覆盖边界（空输入、异常输入、正常输入）。

---

## 五、输出规范

只创建一个文件：`tests/unit/canvasHooks.test.js`，内容为完整可运行的 vitest 测试。
文件首行注释写：`// 回归测试：useCanvasHistory.js、useSyncNodeData.js、workflowRuntime.js`

---

## 六、验收标准（必须全部满足）

- [ ] 只创建了 `tests/unit/canvasHooks.test.js`，**未修改/删除任何其他文件**
- [ ] 只运行过 `npx vitest run tests/unit/canvasHooks.test.js` 这一个验证命令
- [ ] `tests/unit/canvasHooks.test.js` 所有测试通过（0 fail）
- [ ] 覆盖了「模块职责」里列出的所有测试覆盖点
- [ ] 对强浏览器依赖的部分有 `// TODO` 注释说明，且不伪造可通过的假断言
