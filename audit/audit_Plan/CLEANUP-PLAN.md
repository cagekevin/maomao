# 静态分析遗留项清理计划（P0 / P1 / P2）

> 来源：根目录静态分析工具箱 `audit/`（oxlint / knip / jscpd）。
> 这些工具**不是主工程的 CI/pre-commit gate**，是手动 / PR 级审计沙盒；其告警**不阻塞合入**，
> 但其中确有真实死代码与潜在 bug，应当清理。本文档供其他 Agent 认领执行。
>
> 最新实测基线（2026-09-08）：
> - **oxlint**：19 warning（`no-unused-vars`×6、`no-unused-expressions`×8、`unicorn/*` 风格×5）
> - **jscpd**：158 处克隆（156 处在 `src/components/`，多为 6–18 行小重复）
> - **knip**：120 个文件被标「未使用」，但**绝大多数是 `scripts/`、`docs/逆向专用_ai 禁止读/`、`scripts/1mao-scripts/archived/`、`.codebuddy/`**，主程序 `src/` 几乎未被标——说明 knip 配置没收紧到 app 代码，信号噪声比差。

---

## 〇、通用红线与跑工具须知（所有 Agent 必读）

### 红线（违背即作废本次改动）
- ~~**不扫描 / 不整改 / 不计入结论**：`src/components/director3d/`~~ **已作废（2026-09-09）**：解除豁免，可整改、可收口；边界见 `spec/CONTEXT.md` §五·五（克制、有目的地改）。
- **不读取 / 不改动**：`docs/逆向专用_ai 禁止读/`（见下条）。
- **AI 禁止读取**：`docs/逆向专用_ai 禁止读/` 整个目录——任何 Agent 都不得打开、不得依据其内容改动。
- **不得删除**：`.codebuddy/`（项目数据目录，非临时缓存）。
- 不改动主工程 `package.json` / `tsconfig.json` / CI 配置（工具箱独立沙盒，依赖装在 `audit/`）。

### 跑工具须知（`audit/README.md` 已记的坑）
- **从 `audit/` 目录运行**：所有脚本内部会先 `cd ..` 到主工程根。`cd /Users/kevin/Documents/maomao/audit && npm run <script>`。
- **macOS 无 `timeout` 命令**，脚本里别加。
- 产物在 `audit/download/out/`（从 `audit/` 目录看即 `download/out/`；含 `oxlint.json` / `jscpd-report.json` / `knip.json` 等），可随时删重跑。
- oxlint 的 JSON 报告用字段 `filename`（不是 `file`）；位置是**字节偏移 `labels[].span.offset`**，不是行号。
  要拿精确 `文件:行:列`，直接在根目录跑 stylish 输出：
  `cd /Users/kevin/Documents/maomao && ./audit/download/node_modules/.bin/oxlint src`（零配置，终端即打印 `path:line:col`）。

---

## P0 — 真实缺陷 / 安全死代码（阻塞，优先做）

### P0-1 · oxlint 未使用变量与导入（6 条，安全删除）
- **范围**：`no-unused-vars` 类。已知含未使用的 import：`deleteRow`（`assistantTable.ts`）、`setActiveTabId`、`ChevronDown`、`ChevronUp`（`AssistantTablePanel.tsx`），以及 `agentCore.ts` 里两处未使用的 catch 参数 `e` / `e2`。**完整清单以 oxlint.json 为准**，不要凭记忆。
- **做法**：
  1. `cd audit && npm run lint:bug` 生成 `out/oxlint.json`。
  2. 用下方「聚合命令」筛出 `code` 含 `no-unused-vars` 的条目，逐条 `filename` 定位。
  3. 对「未使用的 import」直接删；对「未使用的 catch 参数」改为 `_e`（或 `catch { }` 省略绑定）；对「未使用的局部变量」确认无副作用后删。
- **不要误删有副作用的绑定**（如某函数调用结果虽未赋值但触发了必要副作用）——这种情况改用 `void fn()` 显式表达意图，不要默默留着。

### P0-2 · oxlint 未使用表达式（8 条，逐条排查，可能有真 bug）
- **范围**：`no-unused-expressions` 类，分布在 `agentCore.ts` / `AgentPanel.tsx` / `AssistantTablePanel.tsx` / `TextGenerate.tsx` / `upstreamLink.ts` / `workflowRuntime.ts` / `ChatMarkdown.tsx` / `nodeDefaults.ts` / `DepthVideoModal.tsx` / `FaceMosaicNode.tsx` / `GridMergeNode.tsx` 等。
- **为什么是 P0**：这类告警里**可能藏着静默 no-op bug**——本该赋值 / 判断 / 返回的表达式结果被丢弃（例如把 `if (x === y)` 误写成 `x === y;` 独立成句，或三元结果被丢弃）。
- **做法**：
  1. 逐条打开 `filename` 对应位置（用 stylish 输出拿行号）。
  2. 判断意图：
     - 若是 `condition && sideEffect()` / `condition ? a : b` 作为语句（惯用法，结果本就被丢弃）→ 属误报，可在该表达式外包 `void` 或在文件顶部加 `/* eslint-disable ... */` 并注释理由（**不推荐全局 disable**）。
     - 若确实是写错（结果该被用却丢了）→ **按真实意图修复**（补赋值 / 补 return / 修正条件）。
  3. 每一条在 PR 描述里注明「误报」还是「已修 bug」及改法。
- **验收前提**：P0-2 不允许「一律忽略」——8 条每条都要有结论。

---

## P1 — 让工具可信 + 收敛明显冗余（中等优先级）

### P1-1 · 收紧 knip 配置，使其只报 app 代码
- **问题**：knip 当前把 `scripts/`、`docs/逆向专用_ai 禁止读/`、`scripts/1mao-scripts/archived/`、`.codebuddy/` 都标成「未使用」。README 说 `knip.json` 已 ignore 这些，但实测无效（`.mjs` 子路径、`docs/` 未被覆盖）。结果信号噪声比差，无法据此判断 app 死代码。
- **做法**：
  1. 编辑 `audit/knip.json`：在 `ignore` / `entry` 中显式把 `scripts/**`、`docs/**`、`.codebuddy/**`、`**/*.mjs`、`**/archived/**` 排除；确保 `src/` 是主要分析面。
  2. 重跑 `cd audit && npm run dead:code`，确认被标文件**只剩 `src/` 下的真实代码**。
- **注意**：knip 报「未声明依赖」会误报子路径导入（如 `zustand/middleware`，见 README 坑 6），需人工确认，勿盲加依赖。

### P1-2 · 清理 knip 报告里的 app 死代码
- **范围**：P1-1 收敛后，`out/knip.json` 里 `src/` 下的「未使用导出 / 未使用类型」（当前总计约 102 导出 + 55 类型，需先经 P1-1 过滤再确认归属）。
- **做法**：对每一条 `exports[]` / `types[]`：
  - 确认确实无引用（含测试、动态 import、跨包消费）→ 删定义与导出。
  - 若被其它入口（如 `localTool/`、测试）使用但 knip 看不到 → 在 `knip.json` 补对应 `entry` 或 `ignore`，而非删代码。
- **禁止**：因 knip 误报而删除被实际使用的公共 API。

### P1-3 · jscpd 组件重复收敛
- **范围**：158 处克隆中 156 处在 `src/components/`，多为 6–18 行 JSX / 工具函数重复。
- **做法**：按 `out/jscpd-report.json` 的 `lines` 降序，挑 ≥12 行的重复块（收益最高），抽成共享组件 / `src/components/.../shared.ts` 工具函数 / hook。
- **不要**：为消除 6–8 行微重复而过度抽象（抽象本身也是成本）。低于 12 行的可留到 P2 顺手处理。

---

## P2 — 长尾 / 可选（低优先级，按需）

### P2-1 · oxlint `unicorn/*` 风格类（5 条）
- `no-new-array`×2、`no-useless-spread`×1、`prefer-string-starts-ends-with`×1、`no-useless-fallback-in-spread`×1。
- 纯风格统一，可在对应 PR 顺手改，或纳入编辑器 / pre-commit 的 oxlint 风格规则（当前工具箱不挂 pre-commit，见 README §五）。

### P2-2 · 沉淀 ArchUnitTS 架构测试（README §六 待办）
- 把已稳定的规则（`no-circular`、分层、节点禁横向互引）写成 `tests/unit/` 下的架构测试，让 CI 长期守住，不再仅靠手动 `audit/` 跑。
- 不在此计划强制范围，但建议做完 P0/P1 后补上。

---

## 验收：做完之后怎么验证

> 每条任务自测 + 整体回归。所有命令从 `audit/` 或根目录按下方说明运行。

### A. 工具箱自身指标（证明清干净了）
```bash
cd /Users/kevin/Documents/maomao/audit

# 1) oxlint：重跑并聚合
npm run lint:bug
node -e "const d=require('./audit/download/out/oxlint.json');const sev={};d.diagnostics.forEach(x=>sev[x.severity]=(sev[x.severity]||0)+1);console.log('by severity:',JSON.stringify(sev));const byCode={};d.diagnostics.forEach(x=>byCode[x.code]=(byCode[x.code]||0)+1);console.log('by code:',JSON.stringify(byCode));"
# 目标：P0 后 no-unused-vars / no-unused-expressions = 0；
#      P2 后 unicorn/* 也归零（或仅剩已文档化的误报且数量不变、理由注明）。

# 2) knip：聚合未使用项（需先完成 P1-1 配置收敛）
./audit/download/node_modules/.bin/knip --config audit/knip.json --reporter json --no-exit-code \
 | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{const j=JSON.parse(s);const cat={};j.issues.forEach(i=>{for(const k in i){if(Array.isArray(i[k])&&i[k].length)cat[k]=(cat[k]||0)+i[k].length;}});console.log('issue categories:',JSON.stringify(cat));console.log('files:',[...new Set(j.issues.map(i=>i.file).filter(Boolean))].length);});"
# 目标：被标文件数大幅下降，且仅剩 src/ 下经确认的真实死代码；scripts/docs 不再出现。

# 3) jscpd：克隆数下降
npm run dup:code
node -e "const d=require('./audit/download/out/jscpd-report.json');console.log('clones=',(d.duplicates||[]).length,'duplicatedLines=',d.statistics&&d.statistics.duplicatedLines);"
# 目标：clones 较 158 下降（P1-3 完成后）。
```

### B. 主工程门禁不回归（证明没改坏）
```bash
cd /Users/kevin/Documents/maomao
npm run check:health            # 全量健康度：构建/契约/循环依赖/架构 全 ✔
npx tsc --noEmit -p tsconfig.json   # 0 error（含未使用导入告警也无）
npx vitest run                  # 全量单测绿（至少跑受影响的 assistantTable/conversation/agent 相关）
```

### C. 不引入新架构债
```bash
cd /Users/kevin/Documents/maomao/audit
npm run arch:cycles             # 必须维持 `✔ no dependency violations found`
```

### D. 红线未触碰（证明合规）
```bash
cd /Users/kevin/Documents/maomao
git status --short              # 确认改动文件不含：
#   docs/逆向专用_ai 禁止读/  reference-1mao/  localTool/  .codebuddy/
# 注：director3d/ 已于 2026-09-09 解除豁免，不在排除列表内。
```
- 若 `git status` 出现上述目录的改动 → 本次作废，回退重做。

---

## 派发建议
- **Agent-A（P0-1 + P0-2）**：纯 oxlint 死代码 / 潜在 bug 清理，风险低、价值高，优先派。
- **Agent-B（P1-1 + P1-2）**：knip 配置收敛 + app 死代码清理，需懂 knip 配置。
- **Agent-C（P1-3）**：jscpd 组件去重，纯重构、独立。
- P2 可并入各自 PR 顺手做，不必单独立项。
- **严禁**任何 Agent 在 `docs/逆向专用_ai 禁止读/` 上动手（AI 禁止读，见 §〇 红线）；P1-1 若需扩展 knip ignore，只改 `audit/knip.json`，不动主工程配置。
- `director3d/` 已解除豁免（2026-09-09），可派发整改；按 `spec/CONTEXT.md` §五·五 保持最小差异、克制修改。
