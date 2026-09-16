# 整站 CSS 治理执行计划（严密版 v2）

> **一句话目标**：整站（`src` 真实产品 + `mockup`）CSS 在**四维度**（颜色 / 圆角 / 边框色 / 图标 SVG）达到"令牌唯一、闸守不回潮"。
> **唯一真相源**：`src/index.css` 顶部 `:root`（mockup 侧镜像进 `maomao-kit.css`）。任何缺口只补到此文件，不另立清单。
> **门禁**：`css-globals`（裸值 ratchet）+ `token-mirror`（副本对账）**两闸**，挂 `scripts/gates.manifest.json` 的 `push`，整仓生效（health 自动包含全部闸 —— **不要**再登记进 `healthOnly`，见 §3.6）。

---

## 0. 范围与边界（明确 in / out）

| | 纳入治理 | 排除（明确） |
|---|---|---|
| 颜色 | `src/**/*.css`、`mockup/**/*.css`、`.html` 的 `<style>` 块**与内联 `style="…"` 属性**里的裸 `#hex`/`rgb()`/`hsl()`（**前缀式**属性白名单见 §3.2） | `box-shadow`/`filter`/`drop-shadow` 装饰阴影（v1 债，见 §5）、vendor CSS（`--mock:*` 豁免） |
| 圆角 | 上述文件 `border-radius:` 裸 `px/rem/%`（非 `var(--mao-radius-*)`） | — |
| 边框色 | 上述文件 `border*`（**含单边** `border-top/right/bottom/left(-color)`）裸色（归颜色闸） | 边框宽度（默认 `var(--mao-border-w)`，低优先） |
| 图标 | `src/**/*.tsx` 的 lucide 裸 `size`/自定义内联 `<svg>`；`mockup` 图标约定 | 纯装饰一次性 SVG（尺寸/色仍走令牌） |

**两条已知绕过路径（v1 可以不挡，但必须记账 —— 不记，"整站令牌唯一"就是空话）**：
1. **Tailwind 任意值**：`bg-[#1b1b1a]` / `text-[11px]` 扫不到（实测 src 已有 5 处 hex 任意值：`PanoramaNode` 2、`NodeShell` / `FaceMosaicEditor` / `TemplateNode` / `videoEditor/ui/ui/tooltip` 各 1）。
2. **`.tsx` 里的裸 `size` / 内联 SVG** 归图标治理（§5.2），不进本闸。

**现状基数（实测，决定 ratchet 起点）**：
- **src 侧**：裸 hex **155** 处、裸 `border-radius` **187** 处、裸 `border:1px solid #hex` **7** 处（= `index.css` 2 + `director3d/styles.css` 5，已逐条核对 ✔）、lucide 直接导入 **113+ 文件**（口径 = 文件数，非引用处数）、自定义内联 SVG **7** 处。
- **mockup 侧**：存量 **741** 处，`_lagency/` 独占（`mockup-kit.css` 227、`storyboard-workspace` 103、`agent-panel-clean` 93、`leftpanel-tabs` 92、`panel-kit-card/index.html` 58 …）；翻新后的 `maomao-kit.css` 自身 57 处。
- **闸口径实测**：src 侧判 **344** = 155(颜色) + 187(圆角) + **2**（引擎额外捕获的 `outline` / `background-image` 裸值）。
  > 这 2 处差就是"枚举白名单必漏"的硬证据 → §3.2 因此定为**前缀式**。

---

## 1. 执行顺序（DAG + 因果）

```
Step1 翻新_lagency(止血·mockup子空间)
        │  (mockup 侧 741 处旧裸值若先入基线 = 把止血对象洗成"可接受"，故先清)
        ▼
Step2 加CSS门禁+副本对账(围栏·杠杆最高) ──先于 Step3──▶ 门禁先立：Step3 提一个令牌闸收一个；
                                                    且"改 src 忘同步 kit"当场红（副本对账闸）
        │
        ▼
Step3 裸值提令牌+图标统一(平整·降基线)  ──依赖 Step2 基线──▶ 每提一波跑闸确认只降不升
        │
        ▼
Step4 通用件收口(结构·.agent-icon-btn/.atw-icobtn/.node-btn-settings → pk-*)
        │
        ▼
Step5 kit反向耦合(收尾·@import路径入闸 + 去手动副本漂移)
```
**铁律**：凡收口无闸必回潮（本仓四度实证）→ Step2 先于一切平整动作落地。

---

## 2. 令牌层规格（单一真源 = `src/index.css` `:root`）

> 规则：缺口 token **在 Step3 扫描前先写入 `index.css`**（先定后扫）。Tailwind 镜像在 `tailwind.config.ts` + `tailwind.mockup.config.js` 的 **`colors` 段**（实测两处**都还没有 `borderRadius` 段** —— 是否新建须显式裁定，见 §2.2 坑 1/2）。

### 2.1 颜色（已有 + 待补缺口）
| token | 值(space-rgb) | hex | 对齐 Tailwind | 状态 |
|---|---|---|---|---|
| `--mao-surface*`/`--mao-text*`/`--mao-edge*`/`--mao-accent*`/`--mao-live`/`--mao-danger` | 见 `maomao-kit.css:30-97` | — | 已有 | 已定 |
| `--mao-success` | `34 197 94` | #22c55e | — | **缺口**：`.pk-badge.is-ok` 现 `rgb(34 197 94)`，与 `--mao-live`(#34d399) 不同，须独立 |
| `--mao-accent-bg` | `rgb(59 130 246 / 0.12)` | — | — | **缺口**：`.pk-accent-bg`/`.node-btn-settings.is-active` 0.6/`.prompt-chip` 0.16 三份收敛 |
| `--mao-accent-bg-strong` | `rgba(59 130 246 / 0.16)` | — | — | **缺口**：`.prompt-chip` 底 |
| `--mao-cyan` | `103 232 249` | #67e8f9 | — | **缺口**：`.at` 青 |
| `--mao-gold` | `224 181 94` | #e0b55e | — | **缺口**：director3d 金色强调边 |

> **"绿色"边界必须先定死**（否则新增 `--mao-success` 就是第 4 份绿真相）。仓内现有三绿：
> `--mao-live`（#34d399，本仓"进行中 / 已开"语义）· `--ve-ok`（#24d160，cutia 编辑器独立色系，仅 `.ve-scope` 内生效）·
> cutia `constructive` 回落值（34 197 94，见 `mockup/tailwind.mockup.config.js:93`）。
> 新增 `--mao-success`(#22c55e) **只用于成功态徽标**（`.pk-badge.is-ok`），**不得**替换 `--mao-live`。
> 规则：同一语义只准一个令牌；语义不同必须在表里写明"与谁/为何不同"，禁止"看着差不多就并"。

### 2.2 圆角（全新增 `--mao-radius-*`）
| token | 值 | Tailwind **默认**同名值 | 对比 | 取代现状 |
|---|---|---|---|---|
| `--mao-radius-pill` | 9999px | `rounded-full` = 9999px | 同值 | 胶囊/圆形按钮 |
| `--mao-radius-round` | 50% | —（无对应类）| — | 正圆（头像/点）|
| `--mao-radius-3xl` | 24px | `rounded-3xl` = 24px | 同值 | 大卡 |
| `--mao-radius-2xl` | 16px | `rounded-2xl` = 16px | 同值 | 面板壳 |
| `--mao-radius-xl` | 12px | `rounded-xl` = 12px | 同值 | 浮层（原 `--pk-radius-pop`）|
| `--mao-radius-lg` | 8px | `rounded-lg` = 8px | 同值 | 图标/文字按钮（原 `--pk-radius-btn`）|
| `--mao-radius-md` | 6px | `rounded-md` = 6px | 同值 | chip/紧凑件 |
| `--mao-radius-sm` | 4px | `rounded` = 4px | ⚠️ **与默认 `rounded-sm`(2px) 不同值** | — |
| `--mao-radius-xs` | 3px | —（无对应类）| — | `@引用`高亮（原 `.at` 3px）|
| `--mao-radius-2xs` | 2px | `rounded-sm` = 2px | 同值（但语义 ≠ sm）| — |

> ⚠️ **两个坑必须写进规格（原表两处写错，照抄会引发全站回归）**
> 1. **仓内目前没有 `borderRadius` 段** —— 实测 `tailwind.config.ts` 与 `mockup/tailwind.mockup.config.js` 里 `borderRadius` **0 命中**。这不是"镜像"，是**新建**。
> 2. **禁止把 `--mao-radius-*` 直接映成 Tailwind 默认键名**（`sm/md/lg/xl/2xl/3xl`）：`extend.borderRadius` 是**覆盖**语义 —— 写 `sm: '4px'` 会让全站 `rounded-sm` 从默认 2px **静默**变 4px（实测 `rounded-sm` 分布在 **14 个文件**，含 `timeline-transition-overlay` 4 处、`selection-overlay` 3 处）。
>    **二选一，必须显式定**：(a) 键名隔离 `rounded-mao-*`（如 `mao-lg: 'var(--mao-radius-lg)'`）；(b) **干脆不建 Tailwind 镜像**，改样式只用 `var(--mao-radius-*)`。默认取 (b)（少一份真相）。

`panel-kit.css` 的 `--pk-radius-btn/pop` 改为 `var(--mao-radius-lg/xl)`（8/12 值对齐），消除重复尺度。
> ⚠️ **`--pk-radius-pill`(7px) 与 `--pk-radius-seg`(11px) 不动** —— 它们不在 `--mao-radius-*` 值域里（3/2/4/6/8/12/16/24/9999），强行"就近吸附"到 8/12 会让整个面板群 +1px（视觉回归成本 > 收益）。裁定：**面板子尺度（与 30/26/20px 图标档配套）归 panel-kit 自己的语义层，不进全局半径表**；若 Step4 要收，再走"设计评审 + 视觉回归"。

> ⚠️ **改完必须同步 `maomao-kit.css` 里的手工副本段**（kit 没有 `@import panel-kit.css`，它是**抄**进去的）：改产品值而不改副本，`check-token-mirror`（§3.7 判据 B）当场红。

### 2.3 边框宽度
| token | 值 | 用途 |
|---|---|---|
| `--mao-border-w` | 1px | 默认描边 |
| `--mao-border-w-emph` | 2px | 强调（seg 激活 inset）|

### 2.4 图标尺度 / 描边
| token | 值 | 用途 |
|---|---|---|
| `--mao-icon-2xs..2xl` | 14/16/18/**20**/24/28/32px | 图标七档（20 默认）|
| `--mao-icon-stroke` | 1.75 | lucide 默认 2 在 20px 偏粗，统一 |

---

## 3. 门禁规格（`scripts/check-css-globals.mjs`）

### 3.1 扫描面
`src/**/*.css` + `mockup/**/*.css` + `mockup/**/*.html`：HTML 侧**同时**覆盖 `<style>…</style>` 块与**内联 `style="…"` 属性**（实测 `_lagency/*.html` 内联带色 **37 处**；只抽 `<style>` 会整片漏掉 —— 而 Step1 要改的正是这些文件）。
**先剥注释再计数**（`/* … */` 与 HTML `<!-- … -->`），剥离时**保留换行与偏移** → 否则行号错位，且"改注释"会引发假回潮。
不扫 `.tsx`（图标裸 `size` / Tailwind 任意值属结构治理，见 §0 的「绕过路径」与 §5）。

### 3.2 判定规则（精确）
**颜色**：属性白名单必须**前缀式**（枚举必漏，已实测）：`color` / `background*`（含 `background-image`）/ `border*`（含单边 `border-top|right|bottom|left(-color)`）/ `outline*` / `caret-color` / `fill` / `stroke` / `text-shadow`。
- 实测单边边框裸色 **22 处**（`assistant-table` 10 / `agent-panel` 4 / `director3d` 3 / `ve-theme` 2 / `panel-kit` 2 / `creative-library` 1）—— 只写 `border`/`border-color` 会整片漏掉，而那正是 §0 声称治理的对象。
命中正则（覆盖多格式）：
```
/#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/        // #abc #abcd #aabbcc #aabbccdd
rgb(a) / hsl(a) 括号内首段非 `var(                                           // 见下「派生色豁免」
```
> **派生色豁免（唯一例外，漏了它会误伤 100+ 处合法代码）**：`rgb(var(--mao-accent) / 0.3)`、`hsl(var(--x))` 是标准派生写法（`maomao-kit.css` 里大量存在）→ 取括号内容，**首段为 `var(` 即豁免**。
> **`url(#grad)` 是 SVG 片段引用、不是颜色** → 判色前先摘除 `url(...)`。

**圆角**：属性 `border-radius`（含 `-webkit-` 前缀），值为裸 `px/rem/em/%` 且**不以 `var(--mao-radius-` 开头** → 违规。`50%` / `9999px` v1 暂许（记债 §5）。
> ⚠️ **判定顺序陷阱**：`border-radius` 会被 `border*` 前缀命中 → 必须**先判圆角再判颜色**（脚本自测里有专门探针；本轮实现即因此先错后修）。

**排除**（不算违规）：
- **注释**（§3.1 已剥离）；
- 声明名为 `--mao-*` / `--pk-*` / `--ve-*` / `--mock:*` 的**定义行**（令牌来源本身）；
- 白名单文件（§3.3）。

**计数口径（必须写进脚本头，禁止口头约定）**：违规数 = **去注释后的声明条数**（非行数、非正则命中数）。裸 grep 得 157 / 196，与闸口径（155 / 187）之差即来自注释与令牌定义行。

### 3.3 白名单（写入脚本常量，可审计）
| 条目 | 原因 |
|---|---|
| `:root` / `--mao-*` / `--pk-*` / **`--ve-*`** 定义行 | 令牌来源（**`--ve-*` 必须与 `--mao-*` 同级豁免**：cutia 编辑器是独立色系，`ve-theme.css` 有一整套 `.ve-scope` 局部变量；不豁免 ⇒ 逼人改 cutia 值或加白名单 = 成本倒挂） |
| `*.min.css`、`*.regression-entry.css`、`**/vendor/**`、`**/node_modules/**` | 第三方 / 构建产物（react-image-crop 等）|
| 命中 `--mock:*` 前缀的声明 | 显式 mock 豁免 |

> **白名单只准收窄，不准放宽**（§申诉口 Q3）：需要"放一个进去"时，先证明它是**新语境**（新 vendor、新产物），而不是"存量太多、先放过"。

### 3.4 ratchet 算法（防"全红逼人绕过"）
```
基线文件 scripts/css-globals-baseline.json = { "<relpath>": <int 违规数> }   // 由 --baseline 生成
检查模式（CI）：
  for f in 扫描文件:
    cur = 统计(f)                                  // 当前违规数
    base = baseline[f] ?? 0
    if f 不在 baseline（新文件） and cur > 0: FAIL("新文件含裸值: " + 行号列表)
    if f 在 baseline and cur > base:           FAIL("回潮 +N: " + 新增行号列表)
  PASS 当且仅当全部文件 cur ≤ base
```
**性质**：存量只降不升；新文件零裸值；Step3 每提一波 → `cur` 降 → 基线可重生成收紧。

**基线的三条纪律（本轮实测得出）**：
1. **生成时点 = Step1 之后、任何平整动作之前**。理由是**基数实测**：mockup 侧现存 **741 处**（`_lagency/` 独占），若在 Step1 前生成，这 741 处会被固化进基线 = 把"止血对象"直接洗成"可接受"。
2. **基线里消失的文件不是失败**，但要提示可收紧（脚本打印 stale 清单，不阻断）—— 否则 Step1 删 `_lagency` 后基线会永久残留 11 条噪声。
3. **`cur < base` 时必须提示重生成**：不收紧 ⇒ 回潮空间被浪费，ratchet 退化成摆设（脚本已打印）。

### 3.5 失败样例 + 退出码
```
❌ css-globals: src/index.css 回潮 +2
   L342  border:1px solid #333
   L454  border:1px solid #1f2937
退出码 1（fail-fast，pre-push 与 CI 各跑一次）
```

### 3.6 登记（`gates.manifest.json`）
```json
{ "id": "css-globals", "cmd": "node scripts/check-css-globals.mjs",
  "phase": "push", "desc": "整站 CSS 裸值闸（颜色/圆角/边框色，ratchet 基线）" },
{ "id": "token-mirror", "cmd": "node scripts/check-token-mirror.mjs",
  "phase": "push", "desc": "令牌副本一致性（真源 ↔ kit 手工副本 · @import 存在性 · 空引用）" }
```
> ⚠️ **只登记进 `gates`，不要"同时加入 healthOnly"**（原方案此句是错的）：`gates-run.mjs` 的 health 选择是
> `[...gates, ...healthOnly]`，且 `_design.health` 明写"全量巡检 = 所有闸 + healthOnly" ⇒ 双注册会让该闸在一个
> health 里**跑两遍**，直接违反仓规「每个闸各跑一次，无重复」。

脚本头须带【★闸的申诉口 · 三问】（`check-gates.mjs` 元层闸要求：锚点 `★闸的申诉口` + `Q1 守什么：`/`Q2 何时该改：`/`Q3 怎么改：`，且必须在**首个 `*/` 之前**），否则自身被判违规。本轮两个脚本已按此写好头注释。

### 3.7 第二道闸：令牌副本一致性（`check-token-mirror.mjs`）
**为什么必须有**：`maomao-kit.css` 是**手工副本** —— 它 `@import` 了 5 个 src CSS，却把 `panel-kit.css` 整段**抄**进自己身体；且**已实测漂移一次**：`--mao-accent-soft` / `--mao-accent-soft-alpha` 在 `src/index.css:92-93` 有、kit 里没有。
**为什么必须在 Step3 之前**：Step3 的动作里写着"改 `src` 后**同步回** `maomao-kit.css`" ⇒ 数百处改动要**人工双写**，这正是漂移的出生地。先立对账闸，Step3 才有"同步漏没漏"的机器判据。

| 判据 | 内容 | 级别 |
|---|---|---|
| A | 同名键 · `src/index.css` :root ↔ kit :root 值必须全等 | 硬红 |
| B | 同名键 · `panel-kit.css` ↔ kit 手工副本段 值必须全等（Step3 改 `--pk-radius-*` 后 kit 未同步即红） | 硬红 |
| C | 凡 `<link>`/`@import` 了 `maomao-kit.css` 的 mockup 文件，其 `var(--mao-*)`/`var(--pk-*)` 必须能解析（空引用 ⇒ 颜色静默失效，最隐蔽的一类回归） | 硬红 |
| D | `mockup/**` 下 `.css` 的每个 `@import` 必须指向真实文件 | 硬红（**= Step5 ①，本轮已并入此闸**） |
| E | `tailwind.config.ts` / `mockup/tailwind.mockup.config.js` 里的 `var(--mao-*)` 必须解析到 src 真源 | 硬红 |
| — | src 有而 kit 无的键 | **WARN**（可见不阻断：不逼"为过闸而复制"，避免把副本份数推高） |

**无基线**：不一致就是不一致（硬红）。它的**正确终局**是"kit 由脚本从 src 生成"（§Step5）—— 那时 A/B 改为"生成物与源一致"（§申诉口 Q2 已写明改法）。

```
node scripts/check-token-mirror.mjs             # 检查
node scripts/check-token-mirror.mjs --warn      # 顺带列出缺键 WARN
node scripts/check-token-mirror.mjs --self-test
```
**当前实测**：`0 漂移 / 2 WARN`（那 2 条正是 `--mao-accent-soft` 族）→ Step2 落地时顺手补齐 kit 即可归零。

### 3.8 验证命令
```
node scripts/check-css-globals.mjs --self-test    # 判定规则先红后绿（14 例：单边边框/派生色/注释/圆角顺序）
node scripts/check-token-mirror.mjs --self-test
node scripts/check-css-globals.mjs --baseline     # 生成/刷新基线（Step1 之后、平整之前，只跑一次）
node scripts/gates-run.mjs push                   # 含上述两闸，本地先绿
node scripts/gates-run.mjs health                 # 全量巡检
node scripts/probe.mjs                            # 改闸后的闸探针（先红后绿，仓规）
```

---

## 4. Step 规格（统一模板：输入 → 动作 → 产出 → 验证 → DoD → 翻车点→缓解）

### Step 1 —— 翻新并迁出 `_lagency`（止血）
- **输入（已核实的真实清单）**：`_lagency/` 下 9 个 mockup HTML —— `agent-panel-clean` / `camera-params-mockup` / `director3d-stage-mockup` / `image-editor-mockup` / `image-editor-tabs-mockup` / `leftpanel-tabs-mockup` / `multi-image-composer-mockup` / `storyboard-workspace-mockup` / `video-editor-workbench-mockup`；+ `panel-kit-card/`（`index.html` + `mao-tokens.css` + `build-data.mjs` / `data.js`）；+ 旧 kit `mockup-kit.css`（227 处裸值，是 mockup 侧最大单一来源）。
  > ⚠️ **动手前先与 git 状态对齐**：`git status` 显示 8 个 `_lagency/*.html`（`agent-panel-mockup` / `creative-library-mockup` / `preset-quick-command-mockup(-v2)` / `video-editor-{current,dock,m2,}` 系列）已从工作区删除、**尚未提交**，且**不在**上面这份清单里 —— 即"计划标的 Step1 ⬜"与"工作区已动过手"不一致。先把待翻新清单与 git 状态对齐，再逐文件改；否则"逐文件对照真实类"的对象是错的。
- **动作**：① `<head>` 改引 `maomao-kit.css`+Tailwind CDN+`tailwind.mockup.config.js`；② 删旧 `<style>` 的 `:root` 与 `.mk-*`/`.btn`/`.ib`/`.seg`/旧 `.ve-*`/`.vd-*`/`.cam-*`/`.ncard`/`.row-card`；③ 换真实类 `pk-*`+模块类（`agent-*`/`ve-*`包`.ve-scope.dark`/`director3d`/`cl-*`/`atw-*`/`.cp-*`）+Tailwind 工具类，禁裸 hex；④ 移出并删 `_lagency/`，`panel-kit-card/` 删 `mao-tokens.css` 副本改引真 kit。
- **产出**：`mockup/` 下 10 个翻新文件，无 `_lagency/` 引用。
- **验证**：浏览器逐文件实开核对（不只 diff）。
- **DoD**：无 `_lagency/` 路径引用；颜色/圆角/边框与 kit 一致；`_lagency/` 已删。
- **翻车点→缓解**：
  - 旧 `.ve-*` 与真 `.ve-*` 同名 → **逐文件对照真实类，禁全局正则替换**；视频编辑器必须包 `.ve-scope.dark`。
  - CDN 离线即裸 → **关键结构只靠 `maomao-kit.css` 组件类**，不押 Tailwind 工具类。
  - 副本令牌漂移 → `panel-kit-card/mao-tokens.css` **删掉改引真文件**。
  - 只改 diff 不验视觉 → **浏览器实开**，防"引用不存在的类"。

### Step 2 —— 加 CSS 门禁 + 副本对账（围栏）
- **输入**：§3 规格 + 基线起点（**src 侧** 155/187/7；mockup 侧 741 处已被 Step1 清）。
- **动作**：① 写 `check-css-globals.mjs`（§3.1–3.4）**与 `check-token-mirror.mjs`（§3.7）** → ② 先补齐 kit 副本的 2 个缺键（`--mao-accent-soft` / `-alpha`）让对账闸归零 WARN → ③ 跑 `--baseline` 生成 `css-globals-baseline.json`（**时点不可提前**，§3.4 纪律 1）→ ④ 登记 manifest（§3.6：**只进 `gates`，不进 `healthOnly`**）。
- **产出**：`push` / `health` 含 `css-globals` + `token-mirror`；基线入库。
- **验证**：两个 `--self-test` 先绿；`node scripts/gates-run.mjs push` 通过；**做两次探针** —— A 故意加一处裸值、B 故意改一处 kit 副本值，各验一次 FAIL（先红后绿）。
- **DoD**：门禁生效；新裸色 / 裸半径 CI 红；**改 src 令牌忘同步 kit 也红**；基线 JSON 已提交。
- **翻车点→缓解**：
  - 一刀切全红逼人绕过 → **ratchet 基线**（§3.4），存量只降不升。
  - CSS 多格式漏判 → 正则覆盖 `#3/4/6/8` 位 + `rgb/rgba/hsl/hsla` 含空格分隔。
  - 闸自身 bug 卡死 push → 合入前本地 `check:gates`+单跑先绿。
  - 阴影/渐变误伤 → v1 **排除** `box-shadow`/`filter`/`drop-shadow`（§5 债）。
  - `var()` 内裸值误伤 → 只查声明值，**排除 `--mao-*`/`--pk-*` 定义行**。
  - tsx 任意值/图标裸 `size` 不在范围 → §5 延伸闸，v1 不挡。

### Step 3 —— 裸值提令牌 + 图标/SVG 统一（平整·降基线）
- **前置**：§2 缺口 token 已写入 `index.css`；门禁已立（`css-globals` + `token-mirror` **双绿**，其中 `token-mirror` 保证"改 src 忘同步 kit"当场红）。
- **动作（四类，逐个文件降 `cur`）**：
  - **3.1 颜色**：`panel-kit`（`--pk-accent`→`--mao-accent-strong`、`--pk-on`→`--mao-live`、`.pk-badge`红→`--mao-danger`、`.is-ok`→`--mao-success`、`.pk-pop-row.is-danger`→`--mao-danger`、`.pk-accent-bg`→`--mao-accent-bg`）；`index.css`（`.at`→`--mao-cyan`、`.cust-handle-dot`→`--mao-edge-strong`/`--mao-surface-deep`、react-flow 暗底→`--mao-canvas`/`--mao-text-subtle`）；各模块 14/13/43/4/4/1 处逐换 `--mao-*`。
  - **3.2 圆角**：`panel-kit` `--pk-radius-*`→`var(--mao-radius-*)`；director3d(78)/agent-panel(29)/assistant-table(21)/ve-theme(25)/creative-library(16)/index(15) 裸 px→就近 `--mao-radius-*`。
  - **3.3 边框**：`index.css:342 #333`→`--mao-edge`、`:454 #1f2937`→`--mao-surface-deep`；director3d 5 处 `#555555`→`--mao-edge-muted`、`#3a3a3a`→`--mao-edge`、`#e0b55e`→`--mao-gold`；`node-btn-primary:hover #6b7280`→`--mao-edge-strong`。
  - **3.4 图标/SVG**：
    - **A｜stroke 零成本先解决**：**不要**写 `strokeWidth="var(--mao-icon-stroke)"` —— **SVG 表现属性不支持 `var()`**，多数浏览器直接失效（令牌虚设）。改为 `index.css` 里**一条全局 CSS**：`svg.lucide { stroke-width: var(--mao-icon-stroke); }` ⇒ **114 处存量零成本统一**，无需逐个包 wrapper（原方案担心的"114 处爆炸"在 stroke 维度上不存在）。
    - **B｜wrapper + 收拢**：新增 `src/components/base/ui/Icon.tsx`（`size` 档 + `currentColor`，stroke 交给 A 的 CSS），**新代码强制走**；新建 `src/components/base/ui/icons/` 收拢 7 处内联 SVG（JianyingIcon 等），统一 `viewBox` + `currentColor` + `size` 默认 `--mao-icon-*`。
    - **C｜语义映射**：`docs/ICON-MAP.md`（约定 + 评审用，不追求机器闸）。
    - **D｜mockup 侧**：`MOCKUP-STYLE-GUIDE` 补图标约定（lucide CDN / `currentColor`）。
    - **E｜"新代码强制"必须有闸**（否则违反本方案自己的铁律）：在既有 `scripts/check-arch.mjs`（已是全 src 扫描闸）加一条红线 —— `from 'lucide-react'` **只允许**出现在 `src/components/base/ui/icons/**` 与 `Icon.tsx`。成本 = 一次 import 匹配，比 §5 里另立"延伸闸"更早生效、更省。
- **产出**：`cur` 单调下降；图标走令牌；`icons/` 集中；映射表建立。
- **验证**：每提一波 `node scripts/gates-run.mjs push` 确认不新增；`cur ≤ baseline`。
- **DoD**：src 全文件裸值趋零（状态色 / 阴影 / Vendor 外）；图标 stroke 由**全局 CSS 一条规则**统一；图标尺寸走 `--mao-icon-*`（新代码）；自定义 SVG 集中于 `icons/`；`ICON-MAP.md` 存在；`from 'lucide-react'` 仅出现在 `icons/` + `Icon.tsx`（`check-arch` 红线）。
- **翻车点→缓解**：
  - 透明度派生直接换 solid → 先补 `--mao-accent-bg`(12%)/`--mao-accent-bg-strong`(16%) 再换。
  - 成功绿偏色 → 先定 `--mao-success`(#22c55e) 再换，不混 `--mao-live`。
  - hover 边混用 `#6b7280` → 统一 `--mao-edge-strong`，不"看着差不多就留"。
  - 批量替换误伤阴影 → 先排除阴影/滤镜属性（同 §3.2）人工核对。
  - 两份真相再漂移 → Step3 改 `src` 后必须同步回 `maomao-kit.css`，**由 `check-token-mirror`（§3.7 判据 A/B）兜底**，不再靠人记得（终局见 Step5 生成式收尾）。
  - 图标改造 114 处爆炸 → **先立 wrapper+约定，新代码强制，存量随需求渐进**（ratchet 思路）。
  - 自定义 SVG 失 `currentColor` → 迁移强制 `fill/stroke="currentColor"`，否则暗色不可见。
  - 语义表变又一份真相 → `ICON-MAP` 仅约定+评审，新代码按表选；不追求机器闸。
  - wrapper 不强制 strokeWidth → `<Icon>` **强制** `strokeWidth`，否则令牌虚设。

### Step 4 —— 通用件收口（结构）
- **输入**：`.agent-icon-btn`/`.atw-icobtn`/`.node-btn-settings` 三套平行图标按钮。
- **动作**：尺寸三档（`--pk-icon/sm/xs`）已覆盖 → 复用 `.pk-icon-btn`；各模块自写 `pop`/`pill`→`pk-pop`/`pk-pill`；语义色统一（is-on 蓝/is-ok 绿/is-danger 红）。
- **验证**：真页面截图视觉回归对比。
- **DoD**：三套收敛为一套；视觉无差异。
- **翻车点→缓解**：直接删类破坏视觉 → **尺寸 token 统一**渐进迁入，留 `aria` 语义；语义色混用 → 统一 is-on/is-ok/is-danger 含义；需**设计评审+排期**，不在顺手清里做。

### Step 5 —— 修 kit 反向耦合（收尾）
- **输入**：`maomao-kit.css` `@import '../src/components/...'` + 手动副本模式。
- **动作**：① `@import` 路径存在性校验 —— **已在 Step2 并入 `check-token-mirror.mjs`（§3.7 判据 D）**，此处只做确认；② 用**脚本从 src 生成 kit**（token 段 + panel-kit 段）替代手动副本，消除"改 src 要手 sync"这个漂移母体 —— 这是本步**唯一实质交付**；生成落地后 §3.7 的 A/B 判据改写为"生成物与源一致 + 生成可复现"。
- **验证**：移动某 `@import` 源文件 → 门禁 FAIL。
- **DoD**：`@import` 路径入闸校验；kit/src 同步有机制保障。
- **翻车点→缓解**：反向依赖部署断链 → 路径校验仅兜底，根因是副本模式 → 优先"脚本生成 kit"；手动副本必漂移 → 机制替代人手。

---

## 5. 开放决策（需你拍板，未定即按括号默认）

1. **半径 `50%`/`9999px` 是否要求 token 化**？（默认：v1 暂许，记债，后续收 `var(--mao-radius-round/pill)`）
2. **114 处 lucide 是否强制走 `Icon` wrapper**？（默认：新代码强制，存量渐进；不一次性改造）
3. **阴影中性黑是否纳入颜色闸**？（默认：v1 排除，后续补 `--mao-shadow` 再收）
4. **颜色/圆角/边框色合并为一闸还是拆三闸**？（默认：合并为 `css-globals` 一次扫，降维护成本）
5. **Step5 kit 去副本：脚本生成 vs 保留手动副本+强 sync**？（默认：优先脚本生成）
6. **Tailwind 半径镜像：键名隔离 `rounded-mao-*` vs 不建镜像**？（默认：**不建**，改样式只用 `var(--mao-radius-*)` —— 少一份真相；见 §2.2 坑 2）
7. **`--pk-radius-pill`(7px) / `--pk-radius-seg`(11px) 是否收进全局半径表**？（默认：**不收** —— 值不在 `--mao-radius-*` 域内，"就近吸附"会让面板群 +1px，回归成本 > 收益；Step4 若要收必须走设计评审 + 视觉回归）
8. **图标"新代码强制"的闸位置**：并入既有 `check-arch.mjs` vs 新建延伸闸？（默认：并入 `check-arch.mjs`，零新增闸）
9. **`--mao-icon-*` 尺寸档：先测分布再定档**？（默认：先 grep `size={` 取值分布；现定档 14/16/18/20/24/28/32 **缺 12 与 22**，"就近取档"会造成无谓视觉回归）

---

## 6. 进度 / DoD 总表
| Step | 状态 | 关键交付 | DoD |
|---|---|---|---|
| 0 基础 | ✅ | `maomao-kit.css` / `tailwind.mockup.config.js` / `MOCKUP-STYLE-GUIDE.md` | 已存在 |
| 1 翻新 | ⬜（工作区已删 8 个旧 mockup，**未提交**） | 10 个翻新 mockup，删 `_lagency/` | 无旧引用 + 视觉一致（浏览器实开核对） |
| 2 门禁 | ⬜ **脚本已就绪**：`check-css-globals.mjs`（14 例自测全绿）+ `check-token-mirror.mjs`（实测 0 漂移 / 2 WARN） | 两闸 + 基线 + manifest（**只进 `gates`**） | 新裸值 CI 红；**改 src 忘同步 kit 也红** |
| 3 平整 | ⬜ | 缺口 token 入 `index.css`；裸值趋零；`Icon` / `icons/` / `ICON-MAP` | `cur ≤ baseline` + 图标 stroke 走全局 CSS 一条规则 |
| 4 收口 | ⬜ | `.agent-icon-btn` / `.atw-icobtn` / `.node-btn-settings` → `pk-*` | 视觉回归无差异（**需设计评审 + 排期，不在顺手清里做**） |
| 5 耦合 | ⬜ | 生成式 kit（去手动副本） | 移动源文件即 FAIL（已由 §3.7 判据 D 覆盖）；生成可复现 |

**总纲**：mockup 翻新是前置止血；门禁（整站·四维度·ratchet **+ 副本对账**）+ 令牌平整（`index.css :root` 持续完善 + 图标/SVG 收口）是主战场；通用件收口与去副本是收尾。凡收口无闸必回潮 → Step2 先于 Step3 落地、且用基线防"全红逼人绕过"。**副本对账闸必须与裸值闸同批落地**：否则 Step3 的"改 src + 手同步 kit"就是漂移母体的再生产线。
