# AGENTS.md · 猫猫画布

> 适用对象：所有参与本仓库的 AI 编码代理（CodeBuddy / Claude Code / Codex / Cursor 等）。
> **本文件是唯一 Agent 入口**（原 `CLAUDE.md` 已退役，只留指针，见文件末尾）。
> 只写「开工前必须做什么 / 绝对不允许什么 / 怎么说话怎么下笔」；具体写法一律指向 `spec/` 与代码注释，这里不复述，避免出现第二套标准。

---

## 项目速览（30 秒）

**是什么**：猫猫画布 —— Chrome 扩展（MV3）形态的 AI 画布工具，前端 Vite + React 19 + `@xyflow/react` 画布，后端为自研 `localTool`（Node，端口 `18080`）。

```
├── src/            主力开发：App.tsx / components/（按域分：canvas image video scriptbox agent …）
│                   base/ = 横切地基（core 契约与存储 / utils 纯逻辑 / storage / store / api / media）
├── localTool/      自研后端（TS）：路由 / 任务中心 / 落盘 /files/ / 各 provider 直连
├── spec/           🏛️ 权威规范（CONTEXT / TEST-GUIDE / NEW-NODE-GUIDE / DATAFLOW）
├── docs/           临时与历史文档（可过时，不当依据）+ adr/（已裁定判据）
├── scripts/        工程工具（mv-sync-refs / adr / debt / test-affected / gates）
└── daily/          架构日志（执行留痕，不导航）
```

**入口**：`src/main.tsx` → `src/App.tsx`；前端唯一本地入口 = `config.ts` 的 `apiBase` → localTool `:18080`。

**运行**：`npm run dev`（5180，无需后端即可看画布）；后端 `cd localTool && npm run build && node dist/index.js`。

---

## 〇、三条最高优先（先记这三条，其余都是展开）

**1. 状态唯一铁律：同一能力只许一个可抄样本。**

新写法不是增量，是**替换**。落地前提（同批做完，缺一条就回到「不写」）：旧写法当场删净 → 旧调用方全部迁完 → 范本与目录树同步 → 变更登记。
**判据一句话**：新代码落地后，同一能力在仓里能被抄到几个样本？**1 才叫做完**；≥2 就地把多出来的删掉，不许留到下一轮。
`npm run check` 全绿证明不了这件事，只能由动手的人自己保证（见 §9 四问）。

**2. 失败必须可见，成功必须为真。**

- 读路径不许把「确实是空」和「读失败」压成同一个 `{}` / `[]` / `null` / `false`。
- 用户可见的「成功」（toast / 状态 / 计数）只能取自**被调函数的返回值**，不得取自输入、`items.length` 或「没抛错」。
- 契约缺位先改契约：被调函数返回 `void` 就先把它改成能表达失败的判别联合，再改调用点。

**3. 决策落对位置，否则下一轮 AI 读不到。**

| 改动类型 | 记在哪 |
| --- | --- |
| 已裁定的判据（新增唯一入口 / 收口 / 红线 / 推翻既有约定 / 用户裁定） | `docs/adr/`（走 `node scripts/adr.mjs add`，禁手写文件与索引） |
| 横跨 ≥2 处的现状与拓扑（谁引用谁） | `spec/DATAFLOW.md`（只写现状，不写判据与日期） |
| 场景 → 入口的路由 / 规则适用性的例外 | `spec/CONTEXT.md`（只装路由与例外，不装判据） |
| 单文件局部机制 | 该文件**文件头 JSDoc**（改文件必须同步文件头） |
| 动手前的取舍（过了哪三关、为什么这么选） | 轮次文件 `daily/架构日志/<NN>-*.md` 的「决策留痕」节（骨架 `_template.md`） |

---

## 1、开工前置（硬性门槛）

在**创建 / 修改 / 删除任何项目文件之前**，按顺序读完：

| # | 文档 | 回答什么 |
| --- | --- | --- |
| 1 | `spec/CONTEXT.md` | 我这一处该走哪条路 / 哪条规则在这里不适用 |
| 2 | `spec/TEST-GUIDE.md` | 测试写在哪层、跑哪条命令、怎么算过 |
| 3 | `spec/DATAFLOW.md` | 这条链路在哪些文件（防跨目录乱搜） |
| 4 | `docs/adr/README.md` | 已裁定的判据与落点表 |

要求：

- **全文读取**，不接受只读目录、只读标题、用搜索片段代替。
- **读完再动手**，不允许「边读边改」。
- 第一次回复里必须有一行确认，格式固定：

  ```
  已读完 spec/CONTEXT.md + spec/TEST-GUIDE.md + spec/DATAFLOW.md + docs/adr/README.md；本次最相关条款：§x、§y
  ```

  并附这两条条款的**实际内容要点**（照文件写，不许凭记忆复述）。没有这行确认，视为违规开工。
- 按任务追加：新增节点 → `spec/NEW-NODE-GUIDE.md`；改样式 → `tailwind.config.ts`（令牌唯一真相）；改后端 → `localTool/scripts/README.md`。
- 两份文件冲突时以 `spec/CONTEXT.md` 为准；都没覆盖的情况，先补 `CONTEXT.md` 再写代码。

---

## 2、写代码流程（三步，顺序不可颠倒）

1. **定数据流**：数据从哪来、经哪些模块、落哪（状态 / 落盘 / KV）。对齐唯一入口与字符串契约（§6）。画通才动手。
2. **定契约**：输入 / 输出 / 边界是什么？状态归哪、走哪个唯一入口？跨模块字符串是否已登记（§5）？
3. **构思测试 = 细化契约**：能写出「输入 → 输出」的具体断言，契约才算定清。逻辑能抽纯函数就放 `base/utils/`（或 `base/core/`），边写边锁单测；组件只补关键交互 + 防崩。断言须「源码一变必红」，自证式断言无效。

**分层**：纯逻辑 `base/utils/`（或域内 `.ts`）→ 补 `.test.ts`；hook → 把判据抽成纯函数再测；组件 → **不写测试**（见 §2.3）。

### 2.1 🚫 写代码过程中禁止跑全量测试（用户裁定，最高优先）

**定位用最小射程；全量是验收动作，须先申请。**

```bash
node scripts/test-affected.cjs                        # ① 默认：只跑与改动相关的单测（提交钩子同款）
node scripts/mv-sync-refs.mjs refs <改动的文件>        # ② 手工定射程：查引用 + 字符串残留
npx vitest run tests/unit/A.test.ts                   # ③ 单文件
npx vitest run --bail=1 tests/unit                    # ④ 不确定时：首个失败即停
```

禁止：为定位 1 个失败用例连跑 `npm test` / `test:unit` / `check:health`；输出被污染后重复跑同一条全量命令。

### 2.2 改 bug 先加日志、再动逻辑

体感类 bug（不落盘 / 没反应 / 点了没用）第一反应是**加日志让用户复现**，不是猜根因改逻辑。

- 前端：`logger.debug(分类, 动作, 详情)`，开关 `VITE_DEBUG_ASSET=1` 或 `window.__DEBUG_ASSET=true`；业务代码禁散落 `console.log`。
- 后端：`logDebug(模块, 动作, 详情)`（`utils/logDebug.ts`），开关 `LOG_DEBUG_<MODULE>=1`；**禁写 `console.debug`**（`logWriter` 不接管，既不落盘也不受开关控制）。
- 拿真实日志确认根因后再改；排查完**把开关关掉**再提交。

### 2.3 🚫 测试面只许 `.test.ts`：禁止新增 TSX 测试（用户裁定 2026-11-07）

**规则**：`tests/**` 只收 `*.test.ts`。**禁止新增、恢复或保留** `*.test.tsx` / `*.spec.tsx`。

**为什么**：渲染/交互测试的断言绑在 DOM 结构与组件实现上，改一次组件就要跟着改一次断言，维护成本高于收益；而它抓的 bug 大多是"点一下就发现"的。2026-11-07 已整体删除 70 个 `.test.tsx`（593 例），测试面从 3,367 例收敛到 2,863 例。

**该测什么、放哪**：

| 被测物 | 做法 |
| --- | --- |
| 纯逻辑 / 算法 / 判据 | 放 `base/utils/`（或域内 `.ts`）→ 写 `tests/unit/<stem>.test.ts` |
| hook 里的判据 | **先把判据抽成纯函数**（`base/utils/` 或域内 `.ts`）再测；hook 本身只留接线 |
| 组件渲染 / 交互 / 布局 | **不写测试** —— 靠人工点 + `npm run test:smoke`（契约漂移 / React 单实例 / chunk 完整性）兜底 |
| 契约 / 登记表 / 结构不变量 | 写元测试（扫源码的 `.test.ts`，如 `mockPartialSpread` / `check-arch` 同族） |

**结构上的排除**：`vitest.config.ts` 的 `include` 只有 `tests/unit/**/*.test.ts` —— 新建 `.test.tsx` **不会被执行**，写了等于没写。这条不额外建闸（`ADR-0004`：结构优先于闸，闸只当证据）；规则靠这一节 + include 本身承载。

**禁止的替代做法**：不要为了"能测组件"去装 `@testing-library/*` / `jsdom` / `happy-dom`，也不要改 `vitest.config.ts` 的 `environment` 或把 `include` 扩回 `tsx`。

---

## 3、绝对禁区（违反即返工）

- **端口与入口**：禁止改 `18080`；禁止改唯一本地入口（前端 `config.ts` 的 `apiBase` → localTool `:18080`）。`9004` 与 `/api/proxy` 已退役，禁止恢复。
- **禁止手改 `dist/`**：`dist/` 是 `src/` 构建产物，一律改 `src/` 后 `npm run build`。
- **禁止新文件循环 import 大模块**（TDZ）：跨模块引用走既有 barrel / 已导出符号。
- **React 单实例不可破**：整工程唯一 React 实例，不可新增独立 `react` / `react-dom`。
- **存储键 / 事件名禁止裸字符串**（P0）：必须引用 `contracts.ts` 的 `STORAGE_KEYS` / `EVENTS`，见 §5。
- **禁止新增 `any`**（桥接层除外）、禁止为过闸而 `as unknown as` 双重断言。
- **禁止「先绕过后面再改」「两套写法并存」「保留 deprecated 过渡层」**（完整判据见 §0.1）。
- **参考代码边界**：`docs/逆向专用_ai 禁止读/` 不读取；`docs/` 是临时/历史文档，可过时，不当依据。
- **VPN 前置**：连 Lovart（`lgw.lovart.ai:443`）必须开 VPN，否则网关静默 502，不是代码问题。
- **git push 必须走代理 7897**：
  ```bash
  HTTPS_PROXY=http://127.0.0.1:7897 HTTP_PROXY=http://127.0.0.1:7897 git push origin main
  ```
- **禁止用脚本改文档**：`.md` 一律用编辑工具逐处改，禁止 `sed` / `python` / 一次性 `node` 脚本批量重写。确需机械替换时先说明范围与备份并请示。

---

## 4、单一规则原则（收口的总判据）

**编码三准则**（与单一规则原则同时成立）：

- **奥卡姆剃刀**：如无必要勿增实体（依赖 / 文件 / 端点 / 抽象）；多解并存时取假设最少的一条。
- **精准修改**：只碰必须碰的，顺手清孤儿代码；每行改动能说清目的。
- **目标驱动**：任务先转成可验证目标（跑什么命令、看到什么结果），验收不了的改动不算完成。

**同一语义在库里只准存在一条规则 / 一条实现路径。** 两处规则打架（同语义、两种行为）必须删掉一个，禁止「为兼容先都留着」——留着的代价是此后每次改动都要改两处，且必然漂移。

- **判据**：同一语义的可写点 / 可判点 ≥ 2 处，**且已经漂移过一次** → 该收。
- **做法**：抽出唯一实现放既有归属模块，其余调用方改为委托；**不留 re-export 兼容层、不留旧分支**。
- **同一语义的两种输入形态不算两条规则**（如 File 源 vs dataURL 源）——它们必须共用同一份失败 / 降级策略。

**已收口的先例（禁止回退，新增同类能力一律挂上去）**：

| 语义 | 唯一实现 |
| --- | --- |
| 媒体判型 | `base/utils/media/assetType.ts`（一张 `EXT_KIND` 表派生全部 `isX / detectX`） |
| node.data 写回 | `useNodeData` / `useNodeField` |
| 节点改名 / 展开态 | `useNodeRename` / `useNodeExpanded` |
| 图像入节点落盘降级 | `filesApi`（`resolveNodeImageUrl` / `showThenPersistInline`；统一降级 = 落盘失败回退内联，不阻断、不回滚） |
| 存储读写 | `base/core/contentStore.ts` + `contracts.ts` 的 `STORAGE_KEYS` |
| 事件发布 | `base/core/eventBus` + `contracts.ts` 的 `EVENTS` |
| 生成结果权威源 | 任务中心为权威、`node.data` 为渲染缓存；写只走 `useNodeGeneration`，刷新后单向回填，节点不回写 |

**动手收口时走** `.codebuddy/commands/形状收口手术_执行方.md`（原语 → 形状 → 契约 → 数据流 四环闭环）；改码纪律走 `架构师改码7步法.md`。

**架构重排（移位置 / 改名字）统一走** `scripts/mv-sync-refs.mjs`，禁止手写 `mv` / 手改 import：

```bash
node scripts/mv-sync-refs.mjs move <src> <dst> --suffix ts   # 移动
node scripts/mv-sync-refs.mjs rename <file> <newName> --suffix ts
node scripts/mv-sync-refs.mjs refs <file>                     # 查谁 import 它 + 字符串残留
node scripts/mv-sync-refs.mjs rename-symbol <old> <new>       # 符号级改名（类型感知）
```

**必须带 `--suffix ts`**（本项目 import 显式写 `.ts/.tsx`）。每批后跑 `npm run type-check`，收尾 `npm run build` + `npm run test:smoke`。

---

## 5、契约登记（四张表 + 四道闸）

跨模块共享的字符串与类型必须先登记，再由静态检查兜底。**裸写即违规。**

| 契约 | 登记位置 | 拦截命令 |
| --- | --- | --- |
| 存储键 | `contracts.ts` 的 `STORAGE_KEYS` | `npm run check:keys`（静态）+ `contentStore.checkRegistered` 运行时 throw |
| 事件名 | `contracts.ts` 的 `EVENTS` | `npm run check:events`（双向：裸名必须登记 + `to/from` 须与代码实测自洽） |
| API 端点 | `contracts.ts` 的 `apiRegistry` | `npm run check:api`（与 localTool router 互检，防镜像漂移 / 信封不符） |
| 节点类型 | `contracts.ts` 的 `NODE_TYPES` | `npm run check:node-types`（裸 nodePrefs 命名空间拦截） |

- 新增键 / 事件 / 端点 = **「加函数 + 登记」双动作**，缺一即白实现。
- `EVENTS` 表 `to: []` 但代码实测有 `subscribe` ⇒ 视为登记表滞后，**禁止据此判定死事件**。
- **字符串契约零损伤**：`127.0.0.1:18080`、`t.data[0].url`、`{code,data}` 信封、SSE 事件格式——改任何引用必须全量 grep 同步。
- 类型检测已是最严格模式（`strict` + `noUncheckedIndexedAccess` / `exactOptionalPropertyTypes` / `verbatimModuleSyntax` 等），全仓 `tsc --noEmit` 0 错；不要为了过闸放宽 tsconfig。

---

## 6、错误与信号（四条红线，同族）

**6.1 成功必须为真**

`toast.success(...)` / `ok: true` / `{ deleted: N }` 里的数字与真假，只能来自被调函数的返回值（`r.changes` / `res.linked.length` / `res.success`），不得来自 `items.length` / `ids.length` / `!res.skipped` / 恒真字面量。

**6.2 只有生产者才有权呈现错误**

「呈现」= 让用户看见什么文案、以什么频率、由谁决定 —— 全归**失败的生产者**。转发者 / 容器 / 通用组件只准：① 原样转发生产者的判词；② 呈现它自己生产的事实（如「本组件发起的第 N 次重试」）。
**判据**：写下任何一句用户可见的失败文案前，先问「这句话断言的事实是谁生产的？」不是自己生产的，不许断言。

**6.3 失败不得伪装成「空」或「默认值」**

读路径返回空值时必须能区分三种形态，**处置唯一**：

| 形态 | 处置 |
| --- | --- |
| ① 真空（键不存在 / `== null`） | 合法状态，**静默**返回空值 |
| ② 形状违约（有值但类型 / 结构不符） | `logger.warn`（带 key + 实际形状）**并如实返回** |
| ③ 读取抛错（超时 / 4xx / 解析异常） | **原样上抛**，由拥有 UI 的那层处理 |

重复禁止：`catch { return {} }` / `catch { return [] }` / `catch { return null }` / 用默认值掩「读取是否成功」。

**6.4 只有网络错误才能重试**

重试只用于「请求根本没送达 / 响应没拿到」（连接失败、重置、超时、DNS）。**业务错误与 HTTP 状态码（含 4xx/5xx）不得重试** —— 那是「这次就是失败了」，重发只是重复失败（非幂等请求还会重复建任务 / 重复计费）。
**判据**：重试前必须能回答「这次重发会有什么副作用」；按状态码重试须显式声明并给出瞬态证据。

---

## 7、注释与写作

**默认读者是下一个 AI**（本仓约 90% 代码与文档如此）。

- **真实不误导**：与代码现状一致，宁可少写不写错；标注「已完成 / 规划中 / 已失效」。
- **简洁**：最少字传达必要信息，不写流水账 / 客套 / 重复。
- **精确**：脚本、文件、npm 命令必须是仓库真实存在的。
- **留痕**：反直觉改动立即注释「语义 + 原始命名 / 来源」。

### 7.1 注释位置（固定三处，全中文）

| 位置 | 写什么 |
| --- | --- |
| 文件头 | 块注释写清：是什么、唯一入口、谁在用、禁止什么；带 `【范本】` 的再写「新增同类代码照此结构」 |
| 导出符号 | `/** 一句话语义 */` 紧贴 `export`，不写 `@param` / `@returns` 套话 |
| 函数内 | 只标「不知道就会改错」的点：隐含前提、通道与版本坑、契约出处 |

有行为的模块必须有文件头；纯声明文件与 `*.test.ts` 不强制。

**禁止**：注释掉的代码、`TODO` / `FIXME` / `XXX` / `HACK`（全仓零条，待办写 `docs/plan/`）、复述代码的注释、装饰性分隔线、署名与日期、变更叙事（只写现在是什么形状、为什么这样）、emoji。

### 7.2 只追加，不删「为什么」

注释与文档里讲逻辑、讲架构、讲设计决策、讲反直觉原因的句子是核心资产：**只可追加更新，不可删除**。
可删的只有**过时言论**（结构已重构、行为已变、结论已被推翻），且删除时要一并写明「为何过时 / 新行为是什么」，不留真空。语义变化一律追加 `// 更新(2026-xx)：…`。

---

## 8、沟通铁律（回复用户 / 给方案 / 汇报时）

原则：**先给动作，再给解释；能一步说清不写两段；说完了就停。**

1. **第一行给下一步动作**：开头是可执行命令 / 文件路径 / 结论，不是「让我看看 / 好的 / 我来分析」式铺垫。
2. **多步任务编号**：步骤 >1 写成 `1. 2. 3.`，每步一个动作。
3. **结尾给一个下一步**：有事未了，收尾给 ONE 个 ≤2 分钟能做的动作；不写「还需要我做什么吗」。
4. **砍跑题**：一个事说完再提下一个。
5. **每轮重述状态**：多步汇报先说「第 N/M 步完成」；有任务列表工具就用它，一条一步、同时只有一个 in-progress。
6. **具体时间 / 范围预估**：说「约 15 分钟 / 改 3 处」。
7. **成果可见**：做完直接说「现在能跑 `npm run build`」，不埋进长段总结。
8. **错误就事论事**：报错直接说「原因 + 修法」。
9. **列表 ≤5 项**：超 5 项拆「先做 / 后做」。
10. **禁废话**：删开场客套、结尾客套、无信息量副词；有真实不确定才用「可能」。

**例外（默认规则之上，安全 / 任务 / 歧义优先）**：

- 破坏性操作（`rm -rf`、强推、`git reset --hard`、删表）→ 先确认再动手，安全 > 简洁。
- 同一问题连续 3 轮没解决 → 停止改代码，说出「可能想错了的假设」，问 1 个诊断问题。
- 请求真有歧义 → 问 1 个短的澄清问题，胜过猜错重写。
- 规则会删掉答案本身（如「有哪些选项」）→ 任务赢、形状留，给 2~4 个带取舍的排序选项。
- 用户明确要「解释 / 带我过一遍」→ 可完整展开，头尾仍不客套。

---

## 9、交付前

```bash
npm run type-check        # 必须 0 错
npm run test:smoke        # 每次改动默认自检（极快，抓契约漂移 / React 单实例 / chunk 完整性）
node scripts/test-affected.cjs   # 与改动相关的单测
npm run build             # 构建校验 + 回灌 dist/
```

**全量（须先申请）**：`npm test`（= `test:all`：smoke + vitest 全量 + regression + tools）、`npm run check:health`。
**改了 `localTool/src/**`**：`cd localTool && npm test` 必跑（`tsc --noEmit` + `node --test`）。

### 9.1 交付必须回答的四问（写进回复，不许只在心里想）

> **机制**：`npm run type-check` 结束时会自动把本节四问打到 stdout（`scripts/type-check.mjs`，成功失败都打）。**看到这段输出 ⇒ 本轮回复必须逐条回答**，不许只写「已通过 type-check」。

1. 这轮动了哪个入口？**旧入口还在吗**？（`git diff` 里每个 `export` 逐个看）
2. 旧入口还在的话，它的消费者**全部**迁完了吗？没迁完 = 两条线 = **未完成**。
3. 同一能力数出几个入口？同前缀并存（`Xxx` 与 `XxxOr` / `XxxRaw`）或旧入口仍被调用 ⇒ **两条线**。
4. **这段代码下一个 AI 看得懂吗**？有没有**唯一范本可照抄对**？既看不懂又没范本 ⇒ 不许交付。

**出现两条线（1–3）⇒ 不许写「已完成 / 已修复 / 已收口」，回去删掉其中一条。**

> **绿 ≠ 对。** `npm run check` 全绿只证明「你没踩坏现有测试」，证明不了「你没多造第二条路」。

### 9.2 途中发现既有违规 → 先登记债，再继续手上的活

不许顺手改、不许只在回答里提一句：

```bash
node scripts/debt.mjs add --area 08 --summary "一句话说清违规与位置" --class 增债 --rate 中
```

- `--area` 用 `daily/架构日志/index.md` 的区号 `01`–`13`；摘要 ≤120 字，禁裸竖线 `|`，引号用「」。
- `--class`：`增债` / `还债` / `持平`；`--rate`：`高` / `中` / `低`。
- 登记完**继续做原来的任务**，修它属于另一轮。回答里只给债号（`TD-<区号>-<序号>`）。
- 查与结账：`node scripts/debt.mjs list [--area NN]` / `show TD-xx` / `resolve TD-xx --note "销账证据"`。

**唯一账本是 `daily/架构日志/债务.md`（写入口 `debt.mjs`）**：不许把债写进 `AGENTS.md` / `docs/plan/` / `CHANGELOG` 当待办清单。

---

## 10、排障铁律（先拿真实数据，再下结论）

| 用户说什么 | 第一件事跑什么 |
| --- | --- |
| 画布任何问题（节点缺失 / 错位、连线异常、边 id 报错、key 警告、布局、保存异常） | `cd localTool && node scripts/task-inspect.mjs --canvas-health [projectId]` |
| 查任务 / 查图 / 查视频 / 图丢了 / 刷新没图 | `cd localTool && node scripts/task-inspect.mjs --lifecycle <id>` |
| 三层一致性（画布 ↔ 任务中心 ↔ 磁盘） | `--consistency [proj]` |
| 全库丢图体检 / 画布结构体检 | `--lost-check` / `--canvas-health` |
| 日志 / 节点比对 / 任意 SQL | `--logs` / `--task` / `--sql` |

**禁止**在查任务时去翻 `taskStore.ts` / `tasks.ts` 硬猜断点 —— 先跑脚本拿真实数据再定位。
`id` 三种都收：`task_id` / `thread_id` / `node_id`，脚本自动判定。

常见判读：无 id 边 → `EdgeRenderer` 用 `undefined` 作 key 触发重复 key 警告；重复 id / 悬空边 → 数据链路错误。

---

## 11、文档导航（别维护一堆文档，机制看代码注释）

| 任务 | 必读 |
| --- | --- |
| 任何任务第一步 | **本文件** |
| 写代码 | `spec/CONTEXT.md`（规则适用性地图） |
| 改数据流 / 架构 | `spec/DATAFLOW.md`（链路索引） |
| 写 / 改测试 | `spec/TEST-GUIDE.md`（测试权威） |
| 新增画布节点 | `spec/NEW-NODE-GUIDE.md` |
| 判据凭什么成立 | `docs/adr/` |
| 样式令牌 | `tailwind.config.ts`（禁裸色值） |
| 按需深挖 | `docs/NODE-DESIGN-SPEC.md` / `docs/ARCHITECTURE.md` / `docs/BASE-CAPABILITIES.md` |
| **不读** | `docs/逆向专用_ai 禁止读/`、`daily/`（执行日志，不导航） |

**查数据流 / 依赖 / 谁引用谁（trace 链路、判死代码）**：`node scripts/mv-sync-refs.mjs refs <file>` 一屏给出「谁 import 它 + 字符串残留引用」，是查影响面最快的命令。

---

## 12、常用命令

```bash
npm run dev            # 开发服务器（5180）
npm run build          # 构建校验 + 回灌 dist/
npm run type-check     # tsc --noEmit
npm run lint           # eslint src tests localTool/src
npm run test:smoke     # 冒烟质量门（AI 默认自检）
npm run test:unit      # vitest 全量单测（验收用，写码中禁用）
npm test               # 四件套全量（须先申请）
npm run check:health   # 工程健康全量（较大改动 / 提交前）
npm run check:keys / check:events / check:api / check:node-types   # 四道契约闸
npm run check:arch     # 分层与依赖方向
npm run check:any      # any 诚实性
npm run check:dead-code # 死代码
```

**提交钩子**：`pre-commit` 自动跑 lint-staged + `type-check` + `test-affected` + 3 个秒级 SSR 门禁；`pre-push` 跑全量 lint；`main` 的 push/PR 由 CI 跑 type-check + 全量单测。

**启动后端**：`cd localTool && npm run build && node dist/index.js`（端口 18080）。

---

## 13、技术机制与场景速查（原 CLAUDE.md §四/§六/§七 并入）

### 13.1 同步与异步双模（网关层）

- **异步（默认）**：提交后返回 `task_id`，调用方轮询或 webhook 收结果（webhook 幂等去重）。
- **同步（规划）**：请求带 `wait:true`，内部复用轮询直至终态直接返回，自带超时（504）。**必须保持异步为默认。**
- **独立聊天**：`chat_completions` 走内部轮询，**绝对不经过**图片同步的提交路径。

### 13.2 localTool 落盘与文件管理

- **唯一文件入口**：localTool 的 `/files/`；落盘由 `saveRemoteUrl`（`sha1(url)` 幂等）统一收口，前端不再有独立落盘通道。
- **降级策略**：下载失败仍返回 CDN 链接 + WARN，**绝不抛 500 阻断生图**。
- **丢图排查**：`cd localTool && npm run inspect -- --lost-check`，日志看 `[download] FAIL`；外因多为 CDN 需代理 / VPN 抖动。
- **查任务三步走**：① `--lifecycle <前端 task_id>` 拿全链路 + `poll_task_id`；② `--poll-status <id>` 拿 relay 聚合后的 `status`/`url`（需 18080 在跑，不必开 VPN）；③ 仅直连 Lovart 时才用 `--lovart-result <thread_id>`（需凭据 + 代理）。
- **出站代理**：localTool 原生 `fetch` 不继承系统代理，走 `utils/netProxy.ts` 的 `fetchWithProxy`（直连 → 环境变量 → 探测本机端口 → 隧道）。

### 13.3 场景速查

| 场景 | 做法 |
| --- | --- |
| 改 / 查 API 端点 | 先看 `contracts.ts` 的 `apiRegistry`（前后端唯一契约真源），跑 `npm run check:api`；改端点 = 加函数 + 登记双动作 |
| 改代理 / 转发 | `localTool/src/routes/passthrough.ts`（`handlePassthrough`）+ `routes/generate.ts`（`/api/generate`）+ `relay-poll.ts`（后端常驻轮询落盘）；旧 `/api/proxy` 已退役 |
| 查官方权益转发 | `localTool/src/routes/official.ts`（中转 + 短缓存，不伪造权限） |
| 改画布前端 | 改 `src/` → `npm run test:smoke` → `npm run build`；严禁手改 `dist` |
| 新增画布节点 | `spec/NEW-NODE-GUIDE.md`；类型在 `contracts.ts` 的 `NODE_TYPES` 登记，落 `src/components/<域>/nodes/` |
| 查链路 / 影响面 / 死代码 | `node scripts/mv-sync-refs.mjs refs <file>`；链路图维护在 `spec/DATAFLOW.md` |
| 本机模型资产（深度视频 / 抠图 / 打码 / 3D / 转写：换机、丢文件、加模型） | 读 `localTool/runtime-models/README.md` →「零」三条命令；清单现算用 `runtime-model.mjs list`，**不维护副本**；模型不进 `dist/` |
| 后端 KV 缓存清理 | `POST /api/admin/clear-cache`（localTool 侧） |

### 13.4 已知坑

- **`vite build` 报 `Expected "..." but found "}"`**：根因是 JSX **开标签属性列表**里写了 `{/* 注释 */}`（esbuild 不支持）。改回裸 `/* */` 即过。子元素区 `{/* */}` 不受影响，别误改。
- **字段对不上**：画布硬编码读 `t.data[0].url`，需 localTool 侧剥 `{code,data}` 信封对齐。
- **网关 502**：先查 VPN 是否连通 `lgw.lovart.ai:443`。

---

## 14、旧章节号对照（`CLAUDE.md` 退役说明）

`CLAUDE.md` **已退役**：规则只维护本文件这一份，那边不再新增条目。
但它**暂时不能删** —— 源码与文档里有 206 处注释按 `CLAUDE.md §x` 引用（如 `§5.4.9 单一规则原则`）。删掉会让这些引用全部断链，那是把「真实不误导」换成「到处都是死链」。
**处理方式**：`CLAUDE.md` 顶部已标注退役、只作索引；新写的注释一律引用**本文件**章节号。等旧引用随改动自然迁移完，再删 `CLAUDE.md`。

| 旧（`CLAUDE.md`） | 新（本文件） |
| --- | --- |
| §一 / §二 项目定位与架构 | 顶部「项目速览」 |
| 🔒 决策记录铁律 | §0 第 3 条 |
| §〇 写作铁律 | §7 |
| §〇.1 沟通铁律 / §〇.3 例外 | §8 / §8 例外 |
| §〇.2 验收标准 | §9.1 |
| §3.0 写代码流程 | §2 |
| §3.0.1 禁跑全量测试 | §2.1 |
| §3.1 改动流程与验证 | §9 |
| §3.2 改 bug 先加日志 | §2.2 |
| §3.3 localTool 必测 | §9 |
| §四 技术机制（双模 / 落盘 / 代理） | §13.1 / §13.2 |
| §5.1 绝对禁区（含成功为真 / 生产者呈现 / 失败不伪装 / 只重试网络错误） | §3 + §6 |
| §5.2 变更记录留痕 | §7.2 |
| §5.3 参考代码边界 | §3 |
| §5.4 复用规则（含单一规则原则 5.4.9） | §4 |
| §5.5 Karpathy 三准则 | §4 |
| §5.5.1 生成链路真相源 | §4 先例表末行 |
| §5.6 反直觉必须注释 | §7 |
| §5.7 字符串契约零损伤 | §5 |
| §六 运维排障（含 §六.0 画布体检铁律） | §10 + §13.4 |
| §七 文档导航 / §七.2 场景速查 | §11 / §13.3 |
