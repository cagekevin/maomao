# audit/ · AI 向代码审计工具箱

> **定位**：给 AI（和命令行）用的静态分析工具箱，**不是给人看的看板**。
> 选品唯一标准：**CLI 可调用 + 输出 JSON/结构化数据**，能直接被解析、聚合、喂给 AI。
> 所有工具装在 `audit/download/` 独立沙盒（`audit/download/package.json`），**不进主工程的 `package.json` 依赖**，避免污染 `npm ci` 与 CI。
> 目录分工：`audit/` 外层 = 规则资产（scripts + 配置 + 文档，**入库**）；`audit/download/` 内层 = 依赖沙盒 + 产物，**不入库**。

## 一、工具清单（版本为 2026-08-31 实测）

| 工具 | 版本 | 解决什么 | 输出格式 |
|---|---|---|---|
| **oxlint** | 1.80.0 | 常见 bug、无用变量、可疑表达式（零配置，秒级） | `--format=json` |
| **dependency-cruiser** | 18.2.0 | 架构：依赖图、跨层引用、循环依赖、孤儿模块 | `json` / `err` / `dot` / `mermaid` |
| **madge** | 8.0.0 | 循环依赖（轻量交叉验证，比 depcruise 更敏感） | `--json` |
| **knip** | 6.33.0 | 死代码：未使用文件 / 导出 / 类型 / 依赖、未声明依赖 | `--reporter json` |
| **jscpd** | 5.0.16 | 重复代码块（复制粘贴型腐化） | `json` |
| **ast-grep** | 0.45.3 | 结构搜索 + **批量 rewrite**（架构重构执行器） | `--json=compact` |

## 二、快速开始

```bash
cd /Users/kevin/Documents/maomao/audit
npm run lint:bug       # oxlint  → out/oxlint.json
npm run arch:cycles    # depcruise 依赖违规（文本）
npm run arch:json      # depcruise 全量依赖图 → out/deps.json
npm run cycles:madge   # madge 循环依赖 → out/madge.json
npm run dead:code      # knip 死代码（JSON 打印到 stdout）
npm run dup:code       # jscpd 重复代码 → out/jscpd-report.json
```

**所有 script 内部都会先 `cd ..` 到主工程根再执行**，原因见「四、已知坑」1/2。不要在 `audit/` 里直接传 `../src` 路径。

`out/` 是产物目录（`oxlint.json` / `knip.json` / `deps.json` / `deps.dot` / `madge.json` / `jscpd-report.json`），可随时删重跑。

## 三、输出结构速查（给 AI 解析用）

- **oxlint** `out/oxlint.json`：顶层 `{ diagnostics: [{ message, code, severity, filename, ... }], numberOfFiles, numberOfRules }`。
  聚合示例：`diagnostics.reduce((m,x)=>(m[x.code]=(m[x.code]||0)+1,m),{})`。
- **dependency-cruiser** `out/deps.json`：顶层 `{ modules: [{ source, dependencies:[{ module, resolved }], ... }], summary }`。
- **madge** `out/madge.json`：`{ "<file>": ["<依赖文件>", ...] }`；`--circular` 文本模式更适合直接读。
- **knip** `out/knip.json`：顶层是 **`{ issues: [...] }`**（不是数组）。每个 issue：
  `{ file, files[], exports[], types[], dependencies[], unlisted[], unresolved[], duplicates[], enumMembers[] }`。
- **jscpd** `out/jscpd-report.json`：`{ duplicates: [{ firstFile:{name,start,end}, secondFile:{...}, fragment, lines, tokens, format }], statistics }`。
  ⚠️ 行数字段是 **`lines`**，不是 `duplicatedLines`；`name` 是**相对扫描根**的路径（不带 `src/` 前缀）。
- **ast-grep**：`ast-grep scan . --inline-rules '<YAML 规则>' --json=compact`。

## 四、已知坑（都踩过，别重复）

1. **oxlint 拒绝含 `..` 的路径**：报 `` PATH must not contain ".." `` → 必须从主工程根执行。
2. **depcruise 报 `TS18003: No inputs were found`**：`--ts-config` 按 cwd 解析相对路径 → 必须从主工程根执行。
3. **depcruise `--no-config` 不含循环依赖规则**：实测 `--no-config` 输出「no dependency violations found」，但 madge 同时找到 2 个循环。**要查循环必须写 `.dependency-cruiser.cjs`**（见「六、待办」）。
4. **macOS 无 `timeout` 命令**，别在命令里加。
5. knip / jscpd 对 `reference-1mao/`、`public/`、`Temp/`、`dist/`、`localTool/`、`scripts/` 有**大量噪声**，必须先配 ignore 才能看结论。
6. knip 报「未使用依赖」会误报按子路径导入的包（如 `zustand/middleware`）→ 需人工确认。
7. ~~`src/components/director3d/` 外部开源集成 → 不扫描、不整改、不计入结论~~ **已作废（2026-09-09）**：director3d 解除豁免，按 `spec/CONTEXT.md` §五·五「可改、可收口、但要克制」处理，纳入全量扫描。工具箱配置已同步移除该目录的排除项（`.dependency-cruiser.cjs` 的 `exclude`、`knip.json` 的 `ignore`、`scripts/check-arch.mjs` 的原 `SKIP_DIR`）。原「见 `CLAUDE.md` §二」引用已失效（§二 无对应条目）。
8. ast-grep 0.45 **没有 `-p/--pattern`**，只有 `--inline-rules`（YAML 文本）或 `-r <规则文件>`。

## 五、与主工程的关系

- 主工程 `package.json`、`tsconfig.json`、CI 均**未改动**。
- 与主工程既有 gates 的分工：`npm run type-check` 管类型、`npm test` 管行为、`check:*` 管契约；本工具箱管**架构与腐化**。
- 按 `CLAUDE.md §3.1` 的历史决策（全量 lint 门禁弊大于利），本工具箱**不挂 pre-commit**，只在需要时手动跑 / PR 级跑。

## 六、待办

- [x] 加 `audit/.dependency-cruiser.cjs`（2026-08-31 完成）：启用 `no-circular` + 分层规则（`nodes/*` 禁横向互引、`base/` 禁反向依赖业务域、禁 `src/**` → `reference-1mao/**`）。`arch:cycles` 已从 `--no-config` 改为加载本配置，现报 `✔ no dependency violations found`。`base/` 依赖 `nodes/` 豁免了 2 个合理例外：`NodePalette.ts`（节点注册表单源）、`lazyNode.tsx`（重节点懒加载）。
- [x] 加 `audit/knip.json`（2026-08-31 完成）：ignore `reference-1mao/`、`public/`、`Temp/`、`dist/`、`localTool/`、`src/components/director3d/`；ignoreDependencies 加 `three-stdlib`/`zustand`（子路径误报，见坑 6）。`esbuild`/`@xyflow/system` 未声明依赖已补入主工程 `package.json` devDependencies。
- [ ] 把结论稳定的规则沉淀成 ArchUnitTS 架构测试（复用主工程 `tests/unit/`）。

## 七、已解问题（2026-08-31 / 2026-09-06）

- **P0 循环依赖 2 处已清零**：`scriptBoxEngine/Prompts/PromptResolver` 从 `base/` 迁入 `scriptbox/`，共享类型抽到 `scriptBoxTypes.ts`。`madge --circular` 与 depcruise `no-circular` 双工具确认 `✔ No circular dependency found`。

- **P0 循环依赖复发已再清（2026-09-06）**：agent 会话模块出现新环
  `conversationState.ts →(副作用 import) agentCore.ts →(type) conversationImageMap.ts → conversationState.ts`。
  根因：`conversationState.ts`（宣称"单向底座"，本不应反向依赖上层）残留一行**纯副作用 `import '../runtime/agentCore.ts'`**（commit `ca8a712` 误留，全文无任何符号使用；agentCore 本身也是无副作用的纯函数层）。
  修复：删除该行副作用 import。depcruise `no-circular` + madge 双工具确认 `✔ No circular dependency found`；`check:arch`、`tsc` 通过；conversation 相关单测 29 个全绿。

- **depcruise 豁免规则失效已修复（2026-09-06）**：`.dependency-cruiser.cjs` 的 `no-base-to-business` 豁免正则写错目录段
  （`^src/components/base/(NodePalette|lazyNode)` 漏了真实位置的 `canvas/` 子目录）→ 本应豁免的两个"合理例外"被误报 17 条。
  修正为 `^src/components/base/canvas/(NodePalette|lazyNode)` 后清零。

- **`no-nodes-cross` 对共享 hook 误报已豁免（2026-09-06）**：`nodes/useImageHoverActions.tsx` 是跨图片节点共享 hook
  （ImageNode/PromptNode 共用，有专属单测，base/README 2026-09-04 决策收于 nodes/）。它被多节点引用触发
  `no-nodes-cross`，但这是**主工程既有合理设计**（audit/ 规则不应推翻 base/README 架构决策）→ 在
  `no-nodes-cross` 的 `to.pathNot` 加豁免。另删除该 hook 无引用的 `export default`（调用方均走具名导出）。

- **`no-nodes-cross` 回归已根治（2026-09-11）**：新建的「节点主图唯一写入口」`nodeImage.ts` 误置于
  `src/components/nodes/`，被 `ImageGenerate.tsx`、`AssetNode.tsx` 反向 import，触发 2 条 `no-nodes-cross`。
  根因是**物理位置错误**（共享收敛点落在了叶子节点目录），不是规则太严。
  修复：将其迁至 `src/components/base/nodeImage.ts`（地基），依赖方向归正为 `nodes/ → base/`（业务依赖地基），
  2 处 import 改 `../base/nodeImage.ts`，**不新增任何规则豁免**。depcruise `no-nodes-cross` + madge 双工具确认
  `✔ no dependency violations found`。
  ⚠️ 不要误判同类：`useImageHoverActions.tsx` 的 `no-nodes-cross` 豁免**不是债**。它是图片节点专属 UI 行为 hook
  （返回 crop/pencil/upscale/compress 按钮、产出 `<ImageEditor>` JSX、持有 `useState`），属业务域视图层；
  2026-09-04 重组时由 `base/` **主动回收**到 `nodes/`（base/README「业务域专属件回收」），豁免是刻意的真缝隙
  标记（choke-point），与本次 `nodeImage.ts`（纯地基逻辑误置叶子目录）性质不同，勿照搬本次迁移手法。

**当前 depcruise 全量 `✔ no dependency violations found`（296 modules）。**

### 契约门禁脚本解析 bug（2026-09-06，挂 prebuild 的 `scripts/`，非 audit/ 内）

全量 `npm run build` 曾因 prebuild 两个契约脚本误报而红，皆非真契约漂移而是**脚本解析局限**：

- `check-api-contract.cjs`：`extractBackendRoutes` 原**逐行**解析后端路由，对「method/pattern/handler 分多行展开」的路由对象（`fetch-models`、`workflow-apps` 两处）整条漏解析 → 误报 `白实现(fetchModels)` / `RESERVED 后端无路由(workflowApps)`。重构为**按括号深度切对象块**再提取（含 `extractPatternLiteral` 正确处理字符串/正则字面量与转义斜杠），单行/多行均兼容。
- `check-events.mjs`：`LITERAL_EVENT_RE` 原**逐行**匹配，对 `subscribe(\n 'persist:failed'`（usePersistFailureToast 多行展开）漏检 → 反向校验误报 `EVENTS['persist:failed'].to 指向 stale`。补**跨行合并**逻辑：本行有未闭合 `fn(` 时向后合并到括号配对再定位事件名真实行。

修复后：`check:api` ✔（error 0/warn 0）、`check:events` ✔（251 文件自洽）、`npm run build` ✔、smoke ✔。
