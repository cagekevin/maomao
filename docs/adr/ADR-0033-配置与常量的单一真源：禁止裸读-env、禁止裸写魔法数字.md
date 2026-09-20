# ADR-0033 · 配置与常量的单一真源：禁止裸读 env、禁止裸写魔法数字

- **状态**：生效
- **结论**：环境变量只在 core/config.ts 读一次并导出命名常量；魔法数字/超时/阈值一律命名常量。禁止各文件裸读 env 或裸写数字。
- **日期**：2026-09-19
- **裁定人**：架构师（归位取证；规则原文见 `spec/CONTEXT.md:57` 与 `core/config.ts:4`）
- **触发**：TD-18-20 —— 该判决句长期只存在于 CONTEXT，`adr.mjs search` **0 命中**（违反 ADR-0025 判据 1）

## 背景

这条规则此前**只有两处载体，且都不是 ADR**：

- `spec/CONTEXT.md:57`「配置集中：环境变量统一在 `config.ts` 读一次……禁止各文件裸读 env 或裸写数字」；
- `src/components/base/core/config.ts:4` 文件头「所有 `import.meta.env` 读取必须集中在此文件，禁止散落在业务代码中」。

按 ADR-0025，判据类内容**只**属于 ADR；CONTEXT 只装路由与例外，代码头只装"这个函数怎么用"。
⇒ 它没有违反判据、没有检索入口、没有责任人 —— **写了等于没写**。

**可测的现状（2026-09-19 取证）**：`grep -rn "import.meta.env" src` 命中 **5 个文件**，其中 **4 个在 `config.ts` 之外**：

| 文件:行 | 读什么 | 性质 |
| --- | --- | --- |
| `director3d/models.tsx:81` | `import.meta.env.BASE_URL` | **真配置值**（应迁 `config.ts`） |
| `director3d/project.ts:517` | `import.meta.env?.DEV` | 开发态判定 |
| `base/core/modalLayer.ts:129` | `import.meta.env?.DEV` | 开发态判定 |
| `agent/assistantTable/tableWorkspaceState.ts:120` | `import.meta.env?.DEV` | 开发态判定 |

即：**规则已存在四年表述，却仍有 4 处违反**。这正是"判决句未归位"的代价 —— 不是没有规则，是**规则没有防线**。

## 判据（它凭什么成立）

1. **唯一入口已存在且是叶模块**：`core/config.ts` **零 import**（只有注释里提到 `./config.js`），
   任意层引用都不会成环 ⇒ "集中读一次"在物理上**做得到**，不是口号。
2. **裸读 env 的代价是缺省值分裂**：同一变量在两处解析、一处给缺省一处不给 ⇒
   换机 / 新增环境时**静默错**（不是崩，是悄悄用了错的缺省）。
3. **裸写数字的代价是不可 grep**：阈值散落 ⇒ "把这个超时从 30s 调到 60s" 要改几处**没人答得出**；
   命名常量后，`contracts.ts` 与常量本身形成可检索的登记面。
4. **`DEV` 判定是例外不是反例**：`import.meta.env?.DEV` 只用于"开发期多打一行日志"这类
   **非配置语义**；但它同样算裸读 ⇒ 正解是走 `config.ts` 导出的 `isDev`（或同等命名常量），
   而不是在每个文件各写一遍（本条**不强制**一次性清完存量，见 §后果）。

## 决议

1. **唯一入口**：`src/components/base/core/config.ts`（叶模块）。新增环境变量 → 在此读一次并导出命名常量。
2. **魔法数字 / 超时 / 阈值** → 命名常量；跨模块复用的进 `core/contracts.ts` 登记。
3. **禁止**：业务代码直接读 `import.meta.env`；禁止裸写**含义不明**的数字。**"含义不明"的可判定边界**（满足任一即须命名常量）：① **跨模块复用**（同一字面量在 ≥2 文件出现）② **参与判据比较**（阈值 / 上限 / 超时 / 重试次数 / 尺寸）③ **与外部契约对齐**（API 契约值 / 协议常量）。⇒ **单文件内、不参与判据、不跨模块的局部字面量不算**（如 `arr[0]` · `slice(0, 3)`）。
4. **DEBUG 开关**沿用既有机制（`config.ts` 的 `isDebugModuleOn(module)`，**运行时实时读**、不缓存顶层常量）；
   新增模块在 `DEBUG_MODULES` 登记，**禁止再起独立散开关**（见 `spec/CONTEXT.md:158`）。
5. **CONTEXT 只留一行指针**（不抄判据正文）—— 见 ADR-0025。

## 后果

- ✅ 判据有了唯一主场与检索入口（`adr.mjs search 配置` 可命中），也有了下面这条可执行的违反判据。
- ✅ 新增环境变量的路径变短且唯一：改一处、全局生效。
- ✅ **存量已清零（2026-09-20 复核）**：原 4 处裸读（`director3d/models.tsx` · `director3d/project.ts` · `base/core/modalLayer.ts` · `agent/assistantTable/tableWorkspaceState.ts`）已由 **TD-18-32** 全部收口 ⇒ `import.meta.env` 现只命中 `base/core/config.ts` 一处，
  违反判据 1 因此**不再常红**，回归为"**新增**即红"。
- ⚠️ **回潮风险**："就一行 `import.meta.env.DEV`，懒得去 config.ts 加导出" —— 防线是下面的 grep 判据，
  而不是自觉。

📌 **违反时的判据（怎么发现"又回去了"）**：

1. `grep -rn "import\.meta\.env" src` 命中的文件 **> 1**（`config.ts` 之外出现即为违规）；
2. 同一环境变量在两处及以上被解析，或只有一处给了缺省值；
3. 出现含义不明的裸数字（超时 / 阈值 / 上限）且 `contracts.ts` 无对应登记；
4. `spec/CONTEXT.md` 再次出现本条判据的**正文**（应只有一行指针）。
- **毕业去向**：结构+闸：base/core/config.ts 为 env 唯一读取点（裸读 import.meta.env 会被 scripts/check-any-honesty.mjs 与 review 拦）
