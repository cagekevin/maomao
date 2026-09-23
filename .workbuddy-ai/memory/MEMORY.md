# 项目长期记忆 · maomao（画布仓）

> 只记跨会话仍成立的约定与踩坑。每日流水在 `YYYY-MM-DD.md`。

## 一 · 判据体系（唯一真源）
- 改码流程/轮次文件：`.codebuddy/commands/架构师改码7步法.md`；轮次文件 `daily/架构日志/NN-区域-主题-日期.md` 只引指针，**禁抄数字**。
- ADR：`node scripts/adr.mjs list`（现行39条，`--all`含已退出15）。真源=各 `docs/adr/ADR-NNNN-*.md` 头部字段；`README.md` 索引是生成物（禁手改）。改完必跑 `adr.mjs index --write` + `adr.mjs audit`（硬线：结论≤120字·单文件≤80行·超限即报）。`list` 过滤已退出、`search` 不过滤 ⇒ 引用前先看 `状态` 字段（15条已退出里7条标题是命令句易误当判据）。
- 关键判据：0016 建闸默认不建 · 0019 验收看数量净减 · 0048 fail-soft/fail-fast 按后果选 · 0049 测试只锁用户可感知契约（射程=只对新增/新改执法，存量只随"改到哪改哪"增量）· 0052 六级落点 · 0053 造→判→删前四关（目的/能力/消费/红线）· 0057 收口三动作。
- **ADR-0057（收口）**：① 开工前先数载体 N（grep 出不许估）② 建真源后逐个销副本（删或改指真源，只改注释不算）③ N→M 且 M<N 才算过。载体四型：数值/类型/配置/文档；**按数值清点只能找到第一种**。载体清单不写进 ADR（过期被抄成第二份），收口在任务书现填。
- **判据登记表 = `spec/判据登记表.md`（174 条 · 9 板块 · 未收口 24 · 跨板块 ~45）**：**人工整理版**，按板块分 §一~§九，每行 = 判据／真源(`文件:行`)／N／型别／跨板块／备注；§0 是**维护规矩**（列只有 6 列不许改、跨板块列**只放板块名**、单元格禁裸 `|`）。**开工前在这张表数 N、收口后数 M，M<N 才算完成**（ADR-0057 执行面）。⚠️ **不要用脚本合并生成**（`tmp/register-build.cjs` 曾产出跨板块列半截句 + 未配对反引号，被用户否）；源数据在 `docs/agent 批量任务/TASK-032~040`，整理靠人工。
- ⚠️ **"逐个销副本"销的是每一个消费点，不是每一类载体**（2026-09-22 活样本）：`capability.ts` 收口时接了 HTTP 边界与 GET attach 两条路径，**漏了恢复扫描**（`relay-poll.ts:962/:990`）⇒ 真源已立、症状原样保留（TD-08-51 仍在）。⇒ 收口后必查：**这个判据的每一个消费点都接上了吗**。
- 七步法 SOP Step3 现有8条判据；第8条「判据适用面」自检「改的是实例还是规则」。⚠️ 最易只铺代码不铺声明面（头注释/用例编号/模块README表格/plan规格块/类型签名）。skill `architect-7-steps` 与之同源，改 SOP 同步改 skill。
- 债务账本：`node scripts/debt.mjs add|show|edit|audit`，**禁手改**。`edit` 支持 summary/solution/classify/rate；可改归档行；锚点用 `reanchor`。硬约束：`--summary`≤120字、禁裸竖线（用「／」）、`--rate`仅高/中/低。`resolve` 覆盖原注（丢带sha解法）⇒ 只补注用 `edit`。债号按主表最大值+1 ⇒ 以 `add` 回显号为准。

## 二 · 度量脚本
- `scripts/m1-count.mjs` = M1 React 重渲形态计数，AST 口径（TS createSourceFile）。**非闸**（无pass/fail、退出码恒0、不挂CI）。用法：`--json tmp/x.json` 落基线（开工前）→ `--diff` 算净减。替代手写 grep 口径。
- ⚠️ `m1-scan.mjs` 是测试 TS 类型错误分布，无关。口径必须钉 AST 禁停 grep（旧grep把30行注释里 `memo(` 计入）。`grep 归零` 验收只作人工命令，禁写单测（ADR-0049 形态⑤断源码文本=自证式）。

## 三 · 生成预算真源（143·后端持真相）
- 唯一真源 `localTool/src/budget.ts`（`DEFAULT_BUDGET_MS`+`budgetMsFor(capability,override?)`）。前端只读不硬编码。三值：`chat 180_000`（=`CHAT_TOTAL_TIMEOUT`，非120s段值）· `image 300_000`（实测p99,n=478）· `video 600_000`（⚠️无实测,n=6,待补）。
- ⚠️ `override` 必过 `Number.isFinite && >0`（`0??5===0`不掐点、`NaN??5===NaN`立即触发）。不预建 `[provider]` 层（ADR-0053①）。真相归属按"任务是否脱离调用方存活"：image/video 异步句柄⇒后端持（前端读响应 `budgetMs`）；chat 同步⇒**前端声明** `body.timeoutMs`、后端作override原样用（禁把chat收口成后端持真相；`ai-relay`是连接层kit，业务策略落 `localTool/src/`）。

## 四 · 运行时取证入口（实测发生没发生）
- localTool 日志 `localTool/logs/localtool_18080_YYYY-MM-DD.log`，**UTC 时间戳**（别当本地）。全盘仅此一处。
- 任务真相表 `C:\Users\xinye\.maomao-localtool\localtool.db`→`tasks`（788行）。**只读**（`sqlite3.connect('file:...?mode=ro',uri=True)`，epoch ms），用托管python sqlite3。⚠️ 全 `completed`（幸存者偏差，失败率/放弃率是下界须带声明）；`poll_count`/`not_found_count` 全0不可当证据；日志只记HTTP，出站轮询不在此⇒"零请求"只证"没经本实例"。一次对账最低要求：`POST /api/generate` 时刻 + `tasks` 对应行；拿不出=传闻级，不许当决议前提。

## 五 · 反复踩的坑
1. 区间差值≠轮次净减：基线须该轮开工前跑，事后 git worktree 检出不可行（提交混装/整轮搬迁同区间）。
2. 判据晚于行为不判违规：先核 ADR 日期 vs 代码日期。
3. 同形≠同载体：判 ADR 毕业前须实测载体（真闸/类型层才算；行为单测不算）。
4. 可能并行会话在写：动 git 前后看 mtime；报"src零改动"前必用 mtime 核。审计期间目标会动⇒下结论前再核 mtime，漂移先逐条复核而非继续挖。取证用 Grep(ripgrep) 非 shell grep（zsh下 `--include` 报glob错、`\|` 静默返空=最危险假证据）。
5. 审计自注负例；引 ADR 豁免先划射程（豁免管"本条执法范围"非"资产冻结"）；报失败形态前读语义标签（`{ok:false,pending:true}` 非终态、`unknown` 终态但"可能已生成"勿折 failed/running）；"已有裁定"与"新数据"不冲突，数据支持定值即足。
6. `debt.mjs add` 后必复跑 `audit`（锚点断链）。复核别人"已完成"须**重跑可机判凭证**（lint/check:*/测试），只读结论=没复核。
7. 写"账实不符"必附读数时间戳，结论标"截至HH:MM"。
8. 复核别人轮次先 `git show <sha> --stat` 拿完整改动面再对照覆盖表，勿接受"不归本轮"结论（归属判错=漏审）。易漏面：类型层SSOT（同枚举多份定义TS同构不报）、"不同判据不冲突"须反证、注释复述已移出数值（回潮）、注释论证与实现互斥。动别人账本行前先 `show` 看凭证。
9. **"已排期/排在 X 之后"是排序、不是依赖**：动手前先判"X 真的挡着它吗"（实证：`plan142` 把删壳排 B 批后，而 B 批动的是设置页、与面板不撞车 ⇒ 前提从未被锁住）。**别把"待办已排期"当成"不能动"**。
10. **桩比生产乐观 = 测试给假保证**：改/删被桩覆盖的路径时，红的可能是"桩的假象"而非回归 —— 先读**生产**那条链再决定改代码还是改断言（实证：mock 的 `findSkill` 直读夹具、绕过了 `listAllSkills()` 的降级）。同族：测试的订阅桩 `cbs[key]=cb` **后者覆盖前者**，同键注册两处时打不到想打的那个。
11. **判"谁能触发 X / 某开关是否恒假"要两级取证，缺一级就会误判**（2026-09-23 审 plan145，我为此来回推翻了两次）：
   ① **grep 全量触发源**（不能只数 UI 传参）；② **逐个判生产可达性** —— 有调用点 ≠ 可达，还要看
   它**有没有 UI 消费者**、**是否被更早的超时先覆盖**。实证：`scriptBoxEngine` 的 `onStopScriptItem`
   看着是"剧本盒停止"，实际全仓只有 schema 声明 + 2 个测试 mock，**UI 里没有任何停止按钮**；
   同处 `withTimeout` 兜底（360s）也被 image `budgetMs`（300s）先覆盖 ⇒ 两个 abort 源**生产上都不可达**
   ⇒ 二稿"删节点停止后无人能触发 cancel"**是对的**，我一度判它错。**教训：只 grep 到调用点就当"可达"，
   是最容易把对的判成错的一种假证据。**
12. **判"前端写不动某字段"先看它是不是「改内存 + persist」两段式**：`taskStore.failTask/patchTask` 先 `tasks.map` + `notify()`（**UI 立即变**）再 `persist()`（落库才可能被 `EXECUTION_OWNED_COLUMNS` 拦）。只看落库那段会误判成"UI 无反馈"（我 09-23 就误判过，已推翻留档）。
13. **看见 `cond ? f(x) : undefined` 别急着判"可为 undefined ⇒ 出事"**（09-23 审 plan145）：要追到 `f` 的**返回契约**与**调用链可达性**再判。实证：`rowBudgetMs = cap ? budgetMsFor(cap) : undefined` 看着像"预算可缺失"，但 `DEFAULT_BUDGET_MS: Record<RelayCapability, number>` 类型上恒有值、非法 override 也兜回默认，且 live 路径的 `timeoutMs` 来自 POST 响应（缺则 fail-fast）⇒ **正常路径必掐点**；undefined 只在快照 capability 非法（= TD-08-51 既有情形）。我据此把人家写对的结论判成"事实错误"，已推翻。
14. **断言"某类对象也出现在 X 处"前先查它的唯一生产者**（grep 生产函数的所有调用方）：我断言"任务中心含本地处理/遗留 running 行"，实际 `reportGenerate` **唯一调用方**就是 `generationOrchestration`，`VideoExtractNode`/`VideoProcessNode` 根本不建任务行 ⇒ 差异只有 text。

## 六 · 工具债（A10）
- 归属区=**17 审计工具链治理**（非25）。范围 `scripts/**`·`.codebuddy/commands/**`·`package.json`；红线🚫`src/**`·`localTool/**`·借机重构·改对外契约/持久化。判不准→按业务债处理（只登记不动手）。
- 收尾：`node --check`+实跑+先红后绿+账本一行 `已解决`（`add`→`resolve`→`archive`）。

## 七 · 样式纪律（字体栈 · 2026-09-23 立的规）
- **正文字体栈必须与 `src/index.css`（html/body）同口径**：`ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Microsoft YaHei', sans-serif`。**禁写"苹果优先"栈**（`-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', 'PingFang SC', ...`）—— 它是 Mac/Windows 观感分裂的根源，已修掉唯一一处（`settings.css` 的 `.st-root`）。
- **为什么**：Windows 上苹果优先栈前 5 个字体全落空 ⇒ 整页（含拉丁/数字）走雅黑，而全站走 `system-ui`⇒Segoe UI ⇒ 两页字体不同；且**雅黑非 UI 版只有 300/400/700**，CSS 字体匹配会把 500/600 **直接顶到 Bold**（标题/当前项/数字变粗糊黑体）。Segoe UI 有真 Semibold 不跳档。Mac 上两栈都落 SF ⇒ 差异被抹平，所以 Mac 看不出来 —— **跨平台观感问题必须按 Windows 口径查**。
- 面板级 CSS 跟着补 `font-synthesis: none`（与 `director3d/styles.css` 同口径）：禁浏览器合成伪粗/伪斜。
- 等宽字体（`ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`）是代码块专用例外，不算违反。
- **字号刻度纪律**：面板/整页 CSS 的字号令牌值必须落在 `tailwind.config.ts` → `theme.extend.fontSize` 的那组刻度上（8/9/10/11/12/13/15 + 默认 xs12/sm14/base16/lg18/xl20），**禁另立档位**；逐行注释标出对应 Tailwind 档名。`settings.css` 的 `--st-fs-*` 已按此标注（xs=caption-sm · sm=body-xs · md=body-sm · lg=base-sm · xl=lg）。
- **全站字号分布实测（2026-09-23，grep 全 src）**：`caption-sm(11px) 212 · caption(10px) 130 · xs(12px) 107 · 裸12px 86 · sm(14px) 84 · 裸11px 76 · body-xs(12px) 30 · meta(9px) 29 · body-sm(13px) 23 · lg(18px) 8 · xl(20px) 2 · 3xl(30px) 1`。⇒ 判「某页字号脱节」就用这张表比，别凭印象。20px 是全站第二大、仅 2 处 ⇒ 页面标题用 20px 必显重，已把 settings 的 `--st-fs-xl` 收到 18px。
- 排查同类问题的三步：`grep -rn apple-system src` 找非同口径栈 → 对比 `font-weight` 档位是否超出雅黑可用字重（300/400/700）→ 拿上面的分布表比字号档位。行高/正文色差异多为设计选择（settings 1.55 vs 全局 1.2-1.4），用户明确说过「行高没问题」，别顺手改。
- ⚠️ `-webkit-font-smoothing: antialiased` **只在 macOS 生效**，Windows 完全无效 —— 别拿它当跨平台观感的解释或手段。

## 八 · 沟通
- 收口=建真源+销副本，两步缺一即半态。副本四型，按**判据**清点（不只数值）。多一层间接而副本没归零=复杂度净增。
- 审计口径（用户裁定）：只查①文件吻合度②复杂度降低③SSOT④生产者消费者关系。**不查数值**、**不查运行时库**（db对账非审计取证）。裁定过的照做不反复验证。
- 🔴 先分析再判断；账本"解法"是上一执行者假设非最优解——引用前自按复杂度+SSOT重判。SOP/skill写了命令就**直接跑命令**，别先读一堆文件猜。
- 结论先行；凭证可复现（附命令+输出）；用户质疑=要求重新取证，非道歉。
