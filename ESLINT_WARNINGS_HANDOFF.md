# ESLint 269 Warning 清理 — 交接文档（已完成 ✅）

> 目标：根治仓库里 269 个 ESLint warning（非屏蔽、不降级、不改规则）。
> 状态：**2026-09-06 完成**。`eslint src tests` 输出 **0 problems**，`tsc --noEmit` **0 错误**，`test:unit`（174 文件/2195 用例）+ `regression` + `tools` + `smoke` 全绿。
> 工具：`scripts/_fix_unused_vars.mjs`（已修复 4 类 bug + 加安全护栏，见 §3.1）。

***

## 1. 最终基线（2026-09-06 实测）

```
ESLint 总问题数: 0（原 269 = 213 no-unused-vars + 56 exhaustive-deps）
tsc --noEmit 错误数: 0
```

- pre-commit 门禁只跑 type-check + 测试，不跑 ESLint；本批改动不影响门禁。

- ⚠️ `npm test`（test:all）会因 **check:api 基线失败**（`fetchModels /api/providers/{id}/fetch-models` 白实现）中断 —— 该失败**早于本次改动**（git stash 验证过），与 ESLint 清理无关，未处理。

***

## 2. 两类任务的实际处理方式

### A 类：`@typescript-eslint/no-unused-vars`（213 个）✅ 清零

- **脚本自动修复 183 edits**（多轮级联收敛，`scripts/_fix_unused_vars.mjs`）。

- **人工收尾 16 项跳过**（脚本保守跳过项）：

  1. 未用 `interface RefImage/RefText`（TextNode ×2、DiscountVideoNode ×1）→ 直接删除（确认无引用）。
  2. 未用 `type LodValue`（mediaTools.test）→ 删除。
  3. 未用函数 `vectorCatmullRom`（project.ts）→ 删除（无调用无导出）。
  4. 泛型 `httpRequest<T>`（httpClient.ts）→ 改名 `_T`（泛型名不参与调用方契约）。
  5. 兼容字段 `legacyRunModeReader`（runModeRegistry.ts）→ 改名 `_legacyRunModeReader`（`_` 前缀=官方认可「有意不用」标记，两处同步改）。
  6. write-only `let`（hoverToolbar 的 genConfig、logger.test 4 组 infoSpy/errorSpy）→ 删除声明+赋值（**注意：只删 eslint 报未用的那 4 组，第一个 describe 的 infoSpy 被断言，保留**）。
  7. shadow 误报（boundaryDiag 的 `const shot`）→ 内层 it 有自己的 shot，外层删除。

### B 类：`react-hooks/exhaustive-deps`（56 个）✅ 清零

按 4 种处理方式：

1. **unnecessary 依赖删除（11 处）**：模块级 import 函数（appendMsg/setHistory 等）和稳定 setter 从 deps 移除 —— 稳定引用列入 deps 属规则误报，删了行为不变。
2. **logical expression / 展开数组稳定化（13 处）**：`data.x || []`、`[...a, ...b]` 每渲染新建引用 → 包 `useMemo`（依赖原始字段），根治「deps 每渲染变化」。
3. **稳定引用补依赖（\~26 处）**：getNodes/getNode/addNodes/addEdges/setToast/setCurrentSnapshot/camera 等直接加入 deps（稳定引用或语义需要）。
4. **合理** **`eslint-disable-next-line`** **+ 理由注释（6 处）**：TDZ 变量（定义在 Hook 之后，无法列入 deps）、ref cleanup 读最新值（VideoProcessNode thumbUrls）、有意每渲染轮询（useCanvasSync）、细粒度 useMemo 缓存（lod.tsx）、menu 对象不稳定加依赖反致每渲染重建（App.tsx ×2）。

***

## 3. 脚本 `scripts/_fix_unused_vars.mjs`（保留，可复用）

### 3.1 2026-09-06 重写，修复的旧版 bug（务必保留这些修复）

1. **import Map key 不一致**：旧版 ImportSpecifier 分支取 `p.parent.parent.parent`（ImportDeclaration），与 default/namespace 分支的 ImportClause 不是同一 key → 同一语句产生重叠编辑互相覆盖。统一为 ImportClause。
2. **多声明 const 逗号删除**：旧版只查相邻字符，`const a = 1, b = 2;` 删 b 留 `const a = 1, ;` 语法错。改为前后都跳过空白找逗号。
3. **副作用判断递归化**：`const a = maybe() ?? []` 旧版判为无副作用整行删（丢调用）。改为递归查 Call/New/Await/Yield/TaggedTemplate。
4. **ESLint column 是 code point、TS position 是 UTF-16**：定位转换，防 emoji/非 BMP 行节点漂移。
5. **isNamePos 名称位过滤**：类型注解键（`idx: number`）、JSX 属性名（`idx={x}`）、属性访问名（`wf.cancel()`）不是变量引用，旧版误当「同名引用」导致该改的绑定被误拦（踩坑：StepAssets 解构参数、fps 参数被拦）。
6. **collectBodyRefs 只扫 fn.body**：参数默认值里的 `.fps` 属性名不算函数体内引用。
7. **skipped 统计用 Set.size**：旧版 `a.length`（Set 无 length）→ NaN → 清单永不打印。
8. **tsc 兜底回退 + poison**：每轮改完跑 `tsc --noEmit`，报错文件自动写回原始内容并标记 poison（防改→回退死循环）。

### 3.2 已知跳过项（脚本保守，留人工）

- write/类型位置同名引用（hasSameNameRef 按位置拦截改名破坏场景）

- 未用 class 声明 / 导出声明 / 非标识符绑定

### 3.3 用法

```bash
node scripts/_fix_unused_vars.mjs   # 幂等：已 `_` 前缀跳过，可重复跑
npx tsc --noEmit                    # 必须 0 错误
npx eslint src tests --ext .ts,.tsx,.js,.jsx -f compact
```

***

## 4. 踩坑记录（给接手的 AI，务必避免重蹈）

1. **eslint-disable-next-line 必须紧贴报错行**，中间隔注释行不生效（useCanvasSync/lod/VideoProcessNode 都踩过）。
2. **TDZ 变量不能进依赖数组**：deleteSelected/duplicateSelected（App.tsx）、spawnMergedImage（GridMergeNode）、setCurrentSnapshot（AgentPanel）定义在 Hook 之后，列入 deps 数组立即求值 → tsc 报 `Block-scoped variable used before its declaration`。只能 eslint-disable + 注释。
3. **sed 批量删行会误删被断言的同名 spy**：logger.test.ts 第一个 describe 的 infoSpy 被 `toHaveBeenCalledTimes` 断言，按行内容 sed 时误删 → 8 用例红。**删 spy 前必须逐 describe 确认断言位置**。
4. **ESLint 无类型信息，会误判类型用途为未用**（typeof x / `x: Type` 注解）。改完必须 `tsc --noEmit` 兜底。
5. **`import {} from 'x'`** **残留**：脚本删光具名项后生成 `import {} from`（语义=副作用 import），收尾用 `sed 's/^import {} from /import /g'` 规范化。
6. **`data.x || []`** **/** **`[...a, ...b]`** **作 useCallback 依赖**：每渲染新引用 → 规则报 deps change；根治=useMemo 稳定化，不是加依赖。

***

## 5. 验收标准（已达成）

- [x] `npx eslint src tests --ext .ts,.tsx,.js,.jsx -f compact` → **0 problems**

- [x] `npx tsc --noEmit` → **0 错误**

- [x] `npm run test:smoke` / `test:unit`（174/2195）/ `test:regression`（13）/ `test:tools`（53）全绿

- [x] 未修改 `.eslintrc.cjs` 规则；6 处 `eslint-disable` 均带理由注释（TDZ/ref/有意设计，非掩盖）

