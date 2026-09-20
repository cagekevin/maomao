# 域模块化 · Handoff（2026-09-19 · 第三轮会话交接）

> **给下一个会话/AI**：这是接手「域模块化 / 域归位 / 闸」的**唯一入口**（勿再建第二份）。
> 读法：**§1 状态快照 → §2 真源地图 → §3 判据 → §4 下一件事（放开闸·带坐标）→ §5 硬坑 → §6 开工顺序**。
> **铁律**：登记/计划/债账本里的描述**必须实测复核后再执行**（三轮会话合计 **12 处被推翻**，其中 1 处照做会丢数据；判据见 ADR-0001/ADR-0040 L2）。

---

## 1 · 状态快照（会话结束时）

- **HEAD = `f6f9e2ee`**（`refactor(域归位 A6)`）。**工作区 104 项未提交** —— A6 之后的平台批次（21 件搬迁 + 判据 + 闸同步 + 35 个测试 + 7 本任务书/2 本裁定 + 计划与日志）。
  - 未提交的**必看**：`scripts/check-arch.mjs` · `scripts/dead-code-baseline.json` · `scripts/strict-src-whitelist.json` · `src/App.tsx` · `src/components/**`（大量 `R` 重命名）· `tests/unit/*`（35）· `docs/adr/{ADR-0040,README.md}` · `daily/架构日志/{index.md,25-跨区-…}`。
  - **开工第一件事 = 提交**（见 §6-1；提交前 `git status` 复核内容，本环境同一条命令可能被执行两次）。
- **闸全绿（实测，非照抄）**：`tsc --noEmit` 0 错 · `check-arch` ✅ · `npm run build` 的 6 道构建闸 ✅ · `check-strict-src` ✅ · 单测 **246 文件 / 3044 例** · knip 基线 **71 = 当前 71** · `adr audit` **0 问题**。
- ⚠️ **本机 `npm run build` 仍必红**：IDE safe-delete 护栏（`public/mj-styles` 986 件 → 清 `dist` 触发 500 阈值）。验证请走 `npx vite build --outDir /tmp/<x>`，或调 IDE 阈值/改用 B 案（见 §5-18）。
- ✅ **运行时 TDZ 已修**（用户报 `Cannot access 'HE' before initialization` @ `vendor-3d`）：根因 = `manualChunks` 的**路径子串判据**把 `zustand` 劈成两半（`esm/react.mjs` 含 `react` → vendor-react；`esm/vanilla.mjs`、`use-sync-external-store/**` 不含 → 无归属 → 折进 vendor-3d）⇒ `Circular chunk: vendor-3d -> vendor-react -> vendor-3d` ⇒ TDZ + 1.06MB 首屏必载。修法见 §5-15。

## 2 · 真源地图（每类内容只有一个持有者）

| 内容 | 唯一真源 | 备注 |
| --- | --- | --- |
| **最终目标** | 用户原话：「把每个域都构造成新模块，提升我改码效率」 | 一切批次的价值判据 |
| **域籍判据** | **`docs/adr/ADR-0040`** | L1 / **L1-bis** / L2 / L3 / **L3-bis** / L4 / **L4-bis** / **L4-ter** / L5 / L6 / L7（粗体=本轮新增） |
| **域内落点判据** | **`docs/adr/ADR-0044`** | 域根口径 · D2 优先于 D3 · **门面按用例建**（「纯中转必删」已于 2026-09-20 作废；**拆门面前提 = 复杂度变低 + SSOT 变好**，§7/§9）· 类型件落点 |
| **域内深构规划（能力片）** | **`docs/plan/域内深构-能力片规划.md`** | **对象＝能力片，不是域**；14 域实测台账 + 样板域 `generate` + 每域三步盘点法 |
| **机器可判定性** | `docs/adr/ADR-0041` | 每条结构规则须可写成检查 + **负例探针证明它真会红**；**闸绿不算证据** |
| 命名 / 门面 · 改名边界 | `ADR-0039`（N1–N9）· `ADR-0038` | 判据 = 撞名；运行时字符串冻结 |
| **执行计划（施工）** | `docs/plan/域归位-最终执行计划.md` | A1–A6 已实施；**§A5（`editors/index.ts` 判删）已推翻 · §A6（`captureFrame`→`video/lib`）已过期** |
| 域清单 / 数据流 | `spec/DATAFLOW.md` | 链路**内容**可信、**标题名**不可信 |
| 判据合集 | `docs/DOMAIN-MODULES.md`（§2.0-bis · §3.0） | 域 = 用户能指着说的东西 |
| 本轮域主台账 | `docs/agent 批量任务/TASK-023~029`（附录形）+ `TASK-030/031`（裁定） | 规程 = `TASK-022`（含**成因代号 A–H**，禁自造） |
| **本轮过程与证据** | `daily/架构日志/25-跨区-域籍判定与搬迁-2026-09-19.md` | **只作证据，不作判据**（判据去 ADR）；债明细真源 = 该文件 §五-bis |
| 债 | `node scripts/debt.mjs`（**禁手写**） | 账本描述已过期 6 处，见 §6-4 |

## 3 · 判据变化（本轮）

- **ADR-0040 新增 4 条边界**：`L1-bis` 计域数 = 直连域 ∪ **经 barrel 消费的域**（判"单域件"前先对桶跑 `refs`）· `L3-bis` 零业务语义件 **≥2 域**即归横切 · `L4-bis` **L4 的「域」= 业务域**（`App.tsx` 根装配 / 横切管线条不算）· `L4-ter` **契约原语例外**（键构造 SSOT，导出面不随功能增长）。另加判据 7–9 与违反判据 ④⑤（可执行命令）。
- **ADR-0044 新增**：域根口径（D3 增 `hooks/`）· D2 优先 D3 · 子域门面 vs 域门面 · 类型件例外。
- **ADR-0043 已删号**（`adr.mjs rm`）：它是**记录**不是判据 ⇒ 判据并入 ADR-0040，过程转日志。**门槛（下次别再犯）**：答不出"它推翻了什么既有约定" ⇒ 它是记录，去 `daily/架构日志/`，不占 ADR 编号。ADR 硬约束：**正文 ≤80 行、结论 ≤120 字**（`node scripts/adr.mjs audit`）。

## 4 · 下一件事：**放开所有闸**（用户 2026-09-19 指令）

> **定义**：把「为了让搬迁过关」而加的**清单式白名单 / 路径豁免 / 基线同步****撤回**，改用**反向判据**；撤回后凡变红 ⇒ 逐条判「真违规（改代码）／误报（改判据）」。

**铁律（真源 = `scripts/gates.manifest.json` 的 `_design.gateCost`）**：

- ② 新增/改闸评审：会不会拦住「让同一语义份数下降」的动作？会 ⇒ 用**反向判据，别用清单白名单**（**清单必漏**，且「加一个合法模块就要改闸」本身就是母体）。
- ③ 闸拦住正确动作时 **【改闸不绕行】**；改完必须跑 `node scripts/probe.mjs` **先红后绿**（正例精确红 + 反例仍红）。
- **先例（照它做）**：`2ef6db66` 规则 2 从「整个 base/」收窄到「base 的横切子目录」，**并把 `BASE_ALLOWLIST`（2 条清单式例外）整个删除** —— "收窄后纯度仍 100%，清单整个删除"。

### 4.1 撤除清单（坐标已核 · 逐条放开）

| # | 坐标 | 现状（形态） | 问题（实证） | 放开方向 |
| --- | --- | --- | --- | --- |
| ① | `scripts/check-arch.mjs:684` `CANVAS_WRITE_EXEMPT` | **按文件路径**列"唯一实现本体"（1 条） | 改名即豁免失效（该处注释自述 TD-17-24：S1-2 改名后**假红 14 处**） | 改**定义关系**判据（豁免 = AST 里**定义**这些符号的文件），不按路径列 |
| ② | `scripts/check-arch.mjs:1473` `GETLOCALKEYS_LEGIT` | 列 3 条路径（定义处 + `cloudSync` + `backupStore`） | **本轮刚因搬迁假红**（diff 已证：`canvas/backupStore.ts` → `base/store/backupStore.ts`）；第 3 条是"全量备份"语义例外 | 定义处按"谁导出 `getLocalKeys`"推导；消费者按**是否消费 `SYNC_ALLOW`** 判；确需例外者须**可自证标注**（参照 ④ 的 `// storage-raw-ok:` 形态） |
| ③ | `scripts/check-arch.mjs:993` `KV_SYNC_READ_SCOPE_EXEMPT` | 谓词：`contentStore.ts` + `base/storage/` **前缀** | 目录前缀 ⇒ 该层搬迁/改名即瞎 | "唯一入口本体" + "底层实现层（**定义** `kvGet/kvSet` 的目录）"，按定义关系推 |
| ④ | `scripts/check-arch.mjs:1587` `RAW_LS_SCOPE_EXEMPT` | 谓词：`base/storage/` 前缀 | 同上 | 同上（该层是裸访问收敛层，可用"定义 `legacyRawKey` 原语的目录"判） |
| ⑤ | `scripts/strict-src-whitelist.json` | **收口目录清单**（本轮 +3：`canvas/lib/` `generate/lib/` `task/`） | 方向相反（收口=更严），但**搬迁后静默缩水**（A2 实证：`canvas/nodes` 覆盖 15→4 件） | 判据本应是「**src 全域** 0 隐式 any」；清单只作**存量豁免**且必须带**缩减计划**；或改"按目录树自动枚举 + 禁手工清单" |
| ⑥ | `scripts/dead-code-baseline.json`（count **76 → 71**） | 存量豁免（`--update-baseline` 可重生成） | 基线 = 把债冻住。本轮只同步**改名/搬迁**的键 + 删 3 条已消失键（合规），但**无清偿机制** | 逐条判「真死 → 删」/「工具误报 → 登记反例」，目标清零 |
| ⑦ | `scripts/check-node-data.mjs` 的 `NODE_TYPE_TO_FILE`(6 条) + `NON_NODE_FILES` | 清单（本轮修 3 条 stale） | 清单式 ⇒ 搬迁必改 | 落点已收口到 `node-file-resolver.cjs` ✓；`NODE_TYPE_TO_FILE` 可改由 resolver 派生（**待做**） |
| ⑧ | `scripts/check-api-contract.cjs`（模块名 → 导出） | 契约清单 | 搬迁必改 | **待核**：能否按目录派生 |
| ⑨ | `check-any-honesty.mjs` | 自述「**全 src 零白名单**」 | ✅ 已达标 | **不动**；当样板看 |
| ⑩ | 其余 `new Set([...])`（`ENVELOPE_INTERFACE_BAN` · `NODE_FIELD_SPREAD` · `WRITE_CALLS` · `MEDIA_SSOT` · `STORAGE_FNS_FOR_KEY` · `VE_ARRAY_*` · `DISPATCH_GLOBALS` 等） | **符号名集合**（判据本体） | 不是豁免 | **不动**（`MEDIA_SSOT` 例外：含"Skill 白名单真源"，需单独核） |

### 4.2 方法（每条撤除都要留证据）

1. 撤 → 跑闸 → 记录红/绿；**先红后绿**用 `node scripts/probe.mjs`（若该闸无探针 ⇒ 先按 ADR-0041 补探针，否则"绿"不算证据）。
2. 变红 ⇒ 二分：**真违规**（改代码/搬件）／**误报**（改判据；改完必须证"**反例仍红**"）。
3. 每道闸改完必过元层两道：`node scripts/check-gates.mjs`（申诉口三问齐）· `node scripts/check-gate-vitals.mjs`（扫描基数 ≠ 0）。
4. 收尾：`npm run check:push`（9 道 push 闸）+ `npm run build`（6 道构建闸，注意 §1 的 IDE 护栏）。

## 5 · 🔴 硬坑清单（三轮回计 · 只留仍有效的）

**搬迁/改名类**

1. `mv-sync-refs` 工具缺口（**2026-09-20 复核**）：~~`rename` 对 `.css` 丢扩展名~~ 已修（`RESOURCE_EXTS` 表，`mv-sync-refs.mjs:171`）· ~~不改写无扩展名 import~~ **归因证伪**（实测 `rename` 会改写无扩展名说明符；真因是**仓库根级件未进扫描根**，已修：`rootLevelSources()`）· `move-dir` 的三处损坏（不搬 `.css`/`.json`/`data` · 被搬文件的兄弟导入写成**旧目录**别名 · 按旧路径回写造**残留副本**）**已修**（`mapTarget` 目标平移 + 跳过 `oldDir` 内文件 + `collectAllFilesUnder`，TD-17-27），`move-dir --undo` 保留可用。
2. `rename-symbol` **不动 `vi.mock` 的对象键** ⇒ 改名后 mock 静默失效。每批改名后必 `grep -rn "vi.mock.*<被改模块>" tests`。
3. **CSS 副作用 import 指向旧目录，`tsc` 查不出，只有 `vite build` 会炸** ⇒ 碰 CSS 的批次必跑 build。
4. **测试写死目录** ⇒ `nodePrefsRegression.test.ts` 已两次因搬迁变红。凡"测试自己写死目录"一律改多候选目录扫描（本轮 `_smoke_checks.cjs`/`mockPartialSpread` 同款）。
5. **计数/清单断言须机器复算**，禁沿用旧数（本文件件数栽过 3 次：563→564→491→504）。

**闸/判据类**

6. **闸硬编码路径**（成因 B，本轮 5 处）：`check-node-handles` 豁免派生写死 `canvas/nodes/${Pascal}.tsx` ⇒ A2 后**豁免失效、build 硬红**；规则 3 扫描根写死 ⇒ 覆盖 15→4 件；`check-node-data` 3 条 stale；`strict-src-whitelist` 保护面缩水；`_smoke_checks.cjs`。**已收口到 `scripts/node-file-resolver.cjs`（落点唯一真源，`.mjs`/`.cjs` 共用）** —— 新增节点目录只改这一处。
7. **`refs` 的 ① 段只给直连 fan-in** ⇒ 经 barrel 消费会被漏掉。实证：按直连把 `backupStore` 判成 canvas 件并迁走（TD-25-21 错误处置）⇒ 已回迁。判「单域件」前先对 barrel 跑 `refs`（ADR-0040 L1-bis）。
8. **验证脚本自己也要先自检**（本会话验证脚本错 2 次：前缀漏配 / 扩展名漏配）。
9. **豁免标记的量 ≠ 豁免的量**：`// catch-ok` 的教训（该闸已删）⇒ 标记类豁免必须**打印全部使用点**（`// storage-raw-ok:` 的做法可抄）。
10. **闸的分工**：`pre-commit` = lint-staged + `test-affected.cjs`（按源码→同名 stem 反查，**会漏跨 stem 的测试**）+ 3 个秒级 SSR 门禁；代码闸（tsc/arch/any…）**只在 pre-push** 跑一次。跨 stem 的 mock 测试要手工点名跑。

**环境类**

11. **本环境同一条命令可能被执行两次** ⇒ 重复提交 / "nothing to commit" 是第二次运行的正常回显；提交后**必须 `git log` 核对 HEAD 内容**。
12. **区域日志状态行标签必须是 `本区域状态`** —— 写成 `本区状态` ⇒ `scripts/arch-index.mjs` **静默回退到更旧轮次**且结果照过（本轮实修 `25-跨区-…` 一处）。
13. **IDE safe-delete 护栏**：`public/mj-styles` 986 件 → `vite build` 第一步 `emptyDir(dist)` 撞阈值（count 1354 > 500）⇒ **本机 `npm run build` 必红**，且会留下**残缺 `dist/`**（无 `index.html`）。验证走 `--outDir /tmp/…`；根治 = 移出 `publicDir` 或调 IDE 阈值。
14. **`manualChunks` 用「路径子串」判归属 ⇒ 会劈开同一个包**：`zustand` 三份副本（顶层 · `tunnel-rat/` · `@xyflow/react/`），`esm/react.mjs` 含 `react` 而入 vendor-react，`esm/vanilla.mjs`、`use-sync-external-store/**` 不含 ⇒ 无归属 ⇒ 折进 vendor-3d ⇒ **`Circular chunk` → 运行期 TDZ**（`Cannot access 'HE' before initialization`）+ 1.06MB 首屏必载。**修法**：先按 **`packageName(id)`（取最内层 `node_modules/` 之后）整包归组**，再判 3D/react。**判据**：`grep -ci circular <build.log>` 必须 **0**；`grep -lc useSyncExternalStoreWithSelector dist/assets/vendor-3d-*.js` 必须为空。

## 6 · 开工顺序

```
1) 提交工作区 —— 一把提交；提交后 git log 核对 HEAD
2) ★ **域内收口**（ADR-0044）：无门面的 8 域补门面（`generate`·`settings`·`resource`·`scriptbox`·`task`·`text`·`prompt`·`director3d`）· 域根散件清零（`scriptbox` 20 最重）· 消费者全走门面（`App.tsx` 对 canvas 的 **23 条直连 → 0**）
3) ★ **域内深构**（`docs/plan/域内深构-能力片规划.md` §5 顺序）：样板域 = `generate`；三形态 = 同语义多份 / 一入口多动词 / 杂物间
4) 放开闸剩余 4 处（**TD-25-32**）+ 门面门槛机器化（**TD-25-38**）+ 4 处新判据的负例探针（**TD-25-33**）
5) 债账本描述回改（**TD-25-37**）；DATAFLOW 已就地改完，仅余 fan-in 复测（**TD-25-34**）
6) 修 `mv-sync-refs` 的 TD-17-22/23（下次大改名前修，收益最大）

每批开工前：refs 实测 + 残留复扫（`ls` 旧目录）+ vi.mock 核对
每批收工：真跑 tsc / check:arch / vite build / 单测（贴命令与输出，不写「✅」）+ 提交 + 覆盖度表回填
```

## 7 · 一句话交接

> **跨域归位 A1–A6 已落，域结构成型；判据在 ADR-0040（归属）· 0044（域内落点）· 0041（机器可判定）。**
> 下一步：**先提交，再「放开所有闸」**（§4：撤掉清单式白名单/路径豁免，改反向判据，逐条探针先红后绿）。
> **记住三条**：① 归属看界面位置 + 数据落点（**含经桶消费**），别信名字；② 搬完必须同步闸/测试/白名单，否则假红或假绿；③ 验收必须真跑并贴结果，**闸绿不算证据**。
