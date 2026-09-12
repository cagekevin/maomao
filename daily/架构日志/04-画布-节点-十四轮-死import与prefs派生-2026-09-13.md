# 04 区 · 十四轮 — TD-04-23 / 04-26 清偿 + TD-04-21 升级专项

> 日期：2026-09-13 ｜ 方法：**按 `架构师改码7步法.md` 执行**（Step 1 证伪 → Step 2 归因 → Step 3 定位 → 施工 → Step 7 验证落账）。
> 范围：`nodePrefs.ts` + 三节点 + `canvasContextMenu.tsx` + 10 个测试 mock（TD-04-23/26）；TD-04-21 仅取证不定案。

---

## Step 1 · 证伪（三条逐条取证）

| # | 债描述 | 取证结果 |
| - | - | - |
| **TD-04-26** | canvasContextMenu 死副作用 import | ✅ **成立**：`L39 import './lazyNode.tsx'` 存在；文件内 `prefetchHeavyNode`（L54/L90）是 **ctx 接口属性**（App 注入）**非 lazyNode 符号** → 该 import 无任何符号消费方 |
| **TD-04-23** | nodePrefs 默认值两处维护 | ✅ **成立**：`PREFS_DEFAULTS`（nodePrefs.ts:77）与三节点 `useNodePrefs(type, {字面量})` **逐字一致**（实测 ImageGenerate/TextGenerate/VideoGenerate） |
| **TD-04-21** | contenteditable 放行双实现 | ✅ **成立，但债描述不足**（详见 §4） |

---

## Step 2 · 归因（母体与孤例分开）

| 组 | 性质 | 处置 |
| - | - | - |
| **TD-04-24 + 25 + 27** | **同一母体**：选中衍生状态未做只读实时派生 → 多份手工副本 + updater 副作用同步（13 轮已明说"协同"，TD-04-25 的层位倒置是 TD-04-24 正解的前置） | **单独专项**（App.tsx 编排层翻新级，风险高） |
| **TD-04-23 / 26** | 各自独立小债 | 本轮清 |
| **TD-04-21** | 独立，但取证后发现**比登记复杂** | 升级专项 |

> **判据**：不为凑母体而强行合并（TD-04-23/26/21 三者在"为什么产生"上无共同根因）；也不把不同语义的闸"抽成一个函数"当作母体收口。

---

## Step 3+6 · 施工

### TD-04-26：删死副作用 import（零风险）

`canvasContextMenu.tsx` 删 `import './lazyNode.tsx';` + 注释说明删因。
**副作用**：本模块不再提前触发 lazy 模块加载 → 文件头「无副作用」自述**自此成立**。

### TD-04-23：默认值派生（零行为变化）

- `nodePrefs.ts`：`const PREFS_DEFAULTS` → **`export const PREFS_DEFAULTS`**（+ 头注说明为何导出）
- 三节点：`useNodePrefs('xGenerateNode', PREFS_DEFAULTS.xGenerateNode)` 替代就地字面量

### ⚠️ 配套改动：10 个测试 mock（**本轮最大工作量，也是教训**）

导出 `PREFS_DEFAULTS` 后，**21 个测试立刻变红**：
```
No "PREFS_DEFAULTS" export is defined on the ".../nodePrefs.ts" mock.
```

**根因**：10 个测试用 `vi.mock('...nodePrefs.ts', () => ({ useNodePrefs: ... }))` **整体替换**模块 →
新导出 `PREFS_DEFAULTS` 缺失 → 节点侧参数求值取到 `undefined` 而崩。

**修法（拒绝"抄一份默认值到测试里"）**：改用 **`importOriginal` 部分 mock**：
```ts
vi.mock('...nodePrefs.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('...nodePrefs.ts')>()),  // 其余导出保持真实
  useNodePrefs: <原 mock>,                                        // 只覆盖 hook
}));
```
- **为什么不加 `PREFS_DEFAULTS: {}`**：那会在测试里造**第三份默认值**（假数据），将来误导。
- **教训**：`export` 一个新符号 = **该模块所有整体 mock 的隐式契约变更**（与 TD-03-5「barrel 绕行须与 22 个测试成对改」同型）。**改导出面时必须先 grep 全仓 mock**。

---

## §4 · TD-04-21 取证升级为专项（**未定案，禁止贸然抽函数**）

债登记建议：「抽 `shouldPassToCanvas(clipboardData)` 纯函数两处共用 + 单测；**需先确认两道闸行为等价**」。
**本轮取证结论：两道闸行为不等价** —— 且调用链比登记描述的复杂。

### 4.1 两道闸判据不同（实测）

| | A：`useGlobalPaste` handler | B：`onPaste` 内 |
| - | - | - |
| 判据 | `放行 ⟺ isImagePaste OR isGroupJson` | `拦截 ⟺ onlyPlainText AND NOT isGroupJson`<br>（⇒ 放行 ⟺ NOT onlyPlainText OR isGroupJson） |
| 含 `text/html`（非纯文本、非图片） | **拦截**（走浏览器原生） | **放行** → 落到 `sanitizePastedText` → **建 textGenerateNode** |

**行为差异**：用户在 contenteditable（PromptInput）粘贴**网页富文本**时，
A 让它走原生插入（符合预期），B 会**把它建成一个文本节点**（用户没想要）。

### 4.2 调用链有两条入口

```
① window paste → useGlobalPaste.handler（A 判断）→ 放行则调 onPaste（B 判断）
② ReactFlow 的 onPaste 事件 ────────────────→ 直入 onPaste（B 判断）
```
→ 可能存在**同一粘贴被两个入口处理**的情况（若 contenteditable 位于画布容器内、事件冒泡到画布）。

### 4.3 为什么**不能**照债登记"抽一个函数两处共用"

- 抽共用 = **强行统一两个语义不同的闸** → 必然改变其中一处行为；
- 且"哪个行为正确"是**用户可感知的行为语义**（§零.4 正确性 / Step 5 定权边界），
- 在**未确认"哪种粘贴该建节点"**之前动手，等于**把 bug 换个位置**。

**→ 转专项**：需先定语义（建议向用户确认期望行为）+ 理清双入口是否重复触发，再设计收口。

---

## Step 7 · 验证与落账

| 项 | 结果 |
| - | - |
| `tsc --noEmit` | ✅ 0 错 |
| 相关测试（11 文件：nodePrefs / canvasContextMenu / 三节点各套） | ✅ **67 例全绿** |
| `lint`（src + tests 全量） | ✅ 0 告警 |
| `check:arch` / `check:any` / `check:catch` | ✅ 全绿 |

**度量（§零.3）**：

| 口径 | 改前 | 改后 |
| - | - | - |
| `PREFS_DEFAULTS` 默认值来源份数 | 2（模块表 + 三节点字面量） | **1** |
| 无符号消费的副作用 import | 1 | **0** |
| 测试里"抄一份默认值"的风险点 | — | **0**（用 importOriginal，不抄） |
| 改动文件数 | — | **15**（1 模块 + 3 节点 + 1 UI + 10 测试 mock） |

---

## 结论

- **TD-04-23 / 04-26 已解决**（零行为变化）。
- **TD-04-21 升级专项**（取证推翻"行为等价"假设 → 不贸然抽函数）。
- **TD-04-24 / 25 / 27 母体**：待专项（App.tsx 编排层）。
- **04 区现状**：13 轮新立 4 条中 **2 清**（23/26）、**1 升级专项**（21）、**3 母体待专项**（24/25/27）。
