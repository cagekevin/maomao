# 回归测试补齐 · 文件与任务 API（TASK-063）

> 委派给：执行 AI
> 类型：**C/D（代码改写：新增回归测试）** —— 目标明确，需精确源文件定位
> 唯一产出：`tests/unit/filesTasksApi.test.js`。**你只能写这个文件，碰任何其他文件视为失败。**

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

### 1. `src/components/base/filesApi.js`

**模块职责**：文件落盘：saveInlineToLocal(dataUrl) 幂等去重落盘 /api/files/upload；safeName 文件名清洗 + 时间戳唯一化；saveResultToTasks。

**测试覆盖点（至少覆盖以下，可补充更多）**：
- safeName：去非法字符 [\/:*?"<>|]、空格→下划线、补时间戳+扩展名
- EXT_BY_TYPE：image→png / text→txt / video→mp4 / audio→m4a
- saveInlineToLocal：非 data: 前缀返回 null；落盘失败返回 null（不抛）
- toAbsoluteFileUrl re-export 来自 imageUrl.js

**测试策略**：纯函数（safeName/EXT_BY_TYPE）直接测；saveInlineToLocal mock fetch 与 sha1。

---

### 2. `src/components/base/tasksApi.js`

**模块职责**：任务中心后端 API：fetchTasks/saveTask/batchSaveTasks/batchDeleteTasks/clearTasks（fetch 到 /api/tasks/*）。

**测试覆盖点（至少覆盖以下，可补充更多）**：
- fetchTasks：构造 page/pageSize/keyword 查询参数；非 ok 抛错
- saveTask/batchSaveTasks：POST JSON body；非 ok 抛错
- batchSaveTasks 空数组返回 {ok:true}
- delete/clear 返回 {deleted:n}

**测试策略**：mock global.fetch 断言 URL/参数/body/错误处理。

---

### 3. `src/components/base/projectsApi.js`

**模块职责**：项目 API：fetchProjects/saveProjects（fetch 到 /api/projects）。

**测试覆盖点（至少覆盖以下，可补充更多）**：
- fetchProjects 返回项目列表
- saveProjects 发送项目 id/name + currentId

**测试策略**：mock global.fetch 断言请求构造与错误处理。


---

## 四、硬约束

1. **测试框架**：vitest（项目已有）。用 `import { describe, it, expect, vi, beforeEach } from 'vitest'`。
2. **环境**：`tests/setup.mjs` 已注入内存版 localStorage/sessionStorage，可直接用。
3. **mock 原则**：
   - 源模块依赖 `global.fetch` 的 → 用 `vi.stubGlobal('fetch', mockFn)` 或 `globalThis.fetch = ...` mock。
   - 源模块依赖 `storageAdapter` 的 → 用 `vi.mock('.../storageAdapter.js', ...)` 提供内存实现（参考 projectStore.test.js）。
   - **禁止**对源模块本身做 partial mock 到"掩盖真实逻辑"的程度；mock 只针对外部依赖（fetch/localStorage/console/浏览器 API）。
4. **不要改源模块代码**。若某函数强依赖浏览器（如 canvas），只测可抽离的纯逻辑部分 + 明确用 `// TODO: 浏览器依赖未测` 注释说明。
5. **测试必须能跑通**：`npx vitest run tests/unit/filesTasksApi.test.js` 0 失败。
6. 测试命名、断言清晰，覆盖边界（空输入、异常输入、正常输入）。

---

## 五、输出规范

只创建一个文件：`tests/unit/filesTasksApi.test.js`，内容为完整可运行的 vitest 测试。
文件首行注释写：`// 回归测试：filesApi.js、tasksApi.js、projectsApi.js`

---

## 六、验收标准（必须全部满足）

- [ ] 只创建了 `tests/unit/filesTasksApi.test.js`，**未修改/删除任何其他文件**
- [ ] 只运行过 `npx vitest run tests/unit/filesTasksApi.test.js` 这一个验证命令
- [ ] `tests/unit/filesTasksApi.test.js` 所有测试通过（0 fail）
- [ ] 覆盖了「模块职责」里列出的所有测试覆盖点
- [ ] 对强浏览器依赖的部分有 `// TODO` 注释说明，且不伪造可通过的假断言
