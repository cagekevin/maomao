# SOP：代码拆解标准流程（一毛AI画布 1mao 版）

> 适用场景：从 `src/bundle/httpClient-BknZwXjG.js` / `src/bundle/App-BX6o9fW5.js` 等**前端混淆产物**中提取功能模块为独立文件；或从 `src/bundle/httpClient-BknZwXjG_components/`（140 个还原 JSX 组件）中整理归属。
> 参考案例：剧本盒子崩溃修复（`c_.jsx` 分镜字段编辑器 `rt` 的 contentEditable → 双击弹窗编辑，见 `docs/38`）；素材落盘修复（`localTool/src/routes/resources.ts`）。
> 项目现状速览：前端源码在 `src/bundle/`（逆向还原），自研后端 `localTool/`（:18080 唯一出口），Lovart 网关 `apimart-gateway/`（:9004），官方接入点 `https://www.1mao.cc`（备1 `1mao.16iai.com`、备2 `154.219.102.152:3012`），构建产物 `dist/`（已 gitignore，不追踪）。

---

## 为什么做（动机）

本 SOP 的终极目标：**让 AI 代理（如 CodeBuddy）和未来人类协作者都能更高效、更低风险地修改这份代码。首要目标是提升 AI 改代码的效率**——因为 `src/bundle/httpClient-BknZwXjG.js` / `App-BX6o9fW5.js` 等是数万行混淆产物，AI 代理在其上做改动的主要障碍**不是"读不懂缩写"**（AI 能读全文件、grep 定义、追调用链），而是三类结构性问题：

1. **散点炸点**：一个 key 名 / 上传协议 / 事件频道散在 30~38 处裸写，AI 改一处易漏改其余 → 引入 bug。
2. **隐式依赖**：模块级可变状态（`Se.current` / `pendingSyncRef` 等）跨函数跨文件被读写，AI 改一个函数看不到副作用 → 引入回归。其中最痛的是**初始化时序依赖**——模块级 `let/const` 的初始化时机被函数调用顺序悄悄绑死，稍一调整就触发 `Cannot access 'X' before initialization` 类 TDZ bug，定位极耗时间（实测曾耗时数十分钟）。
3. **巨文件单体**：数万行混淆产物（`httpClient-BknZwXjG.js` / `App-BX6o9fW5.js`）摊薄 AI 上下文与注意力，改动难以聚焦。

> **修代码贵的三成本（本 SOP 每条改动都至少压低其一）**：
> - **定位成本**：不知道该改哪儿 → 用"概念单一归属"解决（key / 逻辑 / 变量只在一处声明）。
> - **波及成本**：改一处怕引发别处崩 → 用"散点收口成单点"解决（修复只动一处）。
> - **时序成本**：调用顺序的隐式依赖 → 用"收敛全局可变状态 + 显式 init / lazy getter"解决（改函数不再触发 TDZ）。

因此判定一条改动是否该做的标准是——

> **它是否减少了"AI 改代码时的散点改动次数"或"隐式依赖范围"？且改动风险是否可控？**

（附带收益：对人类可读性也有帮助，但这是次要目标。语义化改名对人类价值高、对 AI 边际价值有限——AI 能读缩写。）

1mao 已落地的适配/纪律（验证该思路可行，对 AI 价值极高，直接压低"定位+波及"成本）：
- **接入点适配**：`localTool`（:18080）是唯一出口，`/api/proxy` 统一转发 Lovart 网关（:9004）；官方权益走 `official.ts` 透传官方接入点。AI 知道"换后端只改 localTool 适配/接入点配置"，不会到处乱改协议。
- **落盘命名纪律**：素材落盘 id 对齐 rescan 命名 `local-${folder}-${basename}`（`localTool/src/routes/resources.ts`），避免同一文件双记录。AI 改落盘命名只动一处。

---

## 做哪些改动（路线图 · 按 AI 改代码效率分级）

**ROI = 减少 AI 散点改动/隐式依赖的程度 ÷ 风险**。AI 不怕缩写、怕散点与隐式依赖，故排序与人类可读性视角相反——语义化改名降级，收敛散点/隐式依赖/显式契约升级。

### 高 ROI — 优先（直接减少 AI 散点/隐式依赖，多数零行为变化）
| ID | 改动 | 对 AI 的价值 |
|---|---|---|
| **A1（已做）** | 接入点适配：`localTool`(:18080) 统一出口 + `/api/proxy`→Lovart(:9004) | AI 改后端契约只动 localTool 一处，不散改 host |
| **A2（已做）** | 落盘命名纪律：素材 id 对齐 rescan `local-${folder}-${basename}` | AI 改落盘命名只动 `resources.ts` 一处 |
| **H1** | 事件频道常量化：`window.dispatchEvent('yimao:xxxChanged')` 等裸写频道名登记为常量 | AI 改频道名只动一处，不漏多处裸写 |
| **H3** | 上传/落盘链路去重：抽统一 `uploadToLocalTool(blob, name, type)` helper | AI 改变上传/落盘协议只动 1 个 helper |
| **M1** | 全局可变状态收口（跨函数读写易 TDZ） | 消除 AI 最易踩的隐式依赖回归坑 |
| **M3** | 核心数据结构加 `@typedef`/注释签名（画布节点/任务数据） | AI 编辑凭显式签名少编造错误调用 |
| **拆文件** | 继续按 feature 拆小混淆产物（SOP 核心） | 对 AI 极高：小文件=context 聚焦、回归风险低 |

### 中 ROI — 次阶段
| ID | 改动 | 对 AI 的价值 |
|---|---|---|
| **H2** | 混淆符号语义化改名（`Li→fetchBuiltinFavorites` 等，改时留原名注释） | 对人类高、对 AI 中：AI 能读缩写，改名仅让 grep 更精准、少误匹配 |
| **M2** | 统一 logger（如 `localTool/` 日志 + 前端埋点），先覆盖高频区 | 可观测性，AI debug 时受益有限 |

### 低性价比 — 暂缓（不做）
| ID | 改动 | 为什么 |
|---|---|---|
| **L1** | 全量 TS 迁移 | 成本极高；M3 渐进覆盖即可 |
| **L2** | `vendor-Z-adA07W.js` 清理 | 第三方产物，升级即覆盖 |
| **L3** | 前端混淆产物一次性彻底重写 | 数月工程；应作为小步拆分的自然结果 |

### 执行顺序
```
Phase 1（零风险，减散点）  H1 → H3 → 继续拆文件（小步）
Phase 2（需回归，消隐式依赖） M1 → M3
Phase 3（持续）  H2 按需、M2 分批
```

---

## 〇、核心原则

### 原则一：渐进式拆解，目标可读性

`src/bundle/` 里的前端混淆产物从数万行逐渐瘦身，每次拆一个模块。目的是让代码**可读、可维护**，不是为了拆而拆。

- 拆出来的文件必须比原来更好懂 — 语义化变量名、清晰的结构注释（还原码改动要留原名与语义注释，如 `// rt = 分镜字段编辑器`）
- 不改变数据通路：KV 读写、localTool 存储、状态管理保持原有逻辑
- 拆完就清理原混淆产物里的孤儿代码（被替代的函数/变量），不留死代码

### 原则二：奥卡姆剃刀 · 简洁优先

**如无必要，勿增实体。** 任何新增的依赖/文件/端点/开关，先问"删掉它有影响吗" — 答不上来就是多余。

- 标准拆解 2 个文件（service + component），不做过度设计
- 能复用就不要新建：多个入口打开同一个组件，不各自实现
- 数据流选最简单的：调用点 ≤ 2 个用 props 回调，超过用事件总线
- 不引入新依赖、不新增存储键、不改变现有协议

### 原则三：易变契约收敛到单一适配层（利于未来改代码）

**凡是"后端提供什么、长什么样"会随部署环境变化的东西（模型列表、权益、目录结构……），绝不在业务代码里直接写死对端路径/字段名。集中到一个适配层（adapter），业务代码只消费归一化后的内部结构。**

- 前端只认**归一化内部结构**（如 `{catalog, series}`），不认对端原始响应形态。
- 对端差异（Lovart 网关 `:9004`、localTool `:18080`、官方 `www.1mao.cc` 三套 host 与路径）全部在适配层吸收。
- 用**接入点/配置开关**决定走哪套契约（如"后端接入点"可选 `http://127.0.0.1:18080` / `https://www.1mao.cc`），切换后端只改配置 + 适配层，不动业务代码。
- 适配层失败必须**优雅降级**（warn + 沿用旧数据 / 允许全部），不能让前端崩。
- 实战案例：`localTool`（:18080）是唯一出口，`/api/proxy` 统一转发到 Lovart 网关 `:9004`；官方权益接口走 `official.ts` 透传官方接入点。⚠️ 已知坑：接入点=18080 时"官方模型聊天"拼出 `/api/v1/chat/completions` 被透传官方 404（见 `daily/2026-08-11` 待研究），接入点差异必须在适配层吸收，别在业务代码里散拼 host。

> **反模式（不要做）**：业务函数里直接 `fetch('http://127.0.0.1:9004/...')` 或散拼 host 并硬校验 `{success, data}` —— 一旦接入点换成官方/自研，每个调用点都要改。

### 原则四：存储纪律 · 一切落盘经 Q，key 名集中登记（利于未来改代码）

**任何持久化（localTool KV / localStorage）尽量走统一出口、key 名集中登记，禁止业务代码散拼字符串 key、禁止为同一事实在多地裸写不同 key。** 素材落盘、画布节点数据等持久化走 `localTool`（:18080，唯一出口）；纯浏览器侧 UI 偏好走 `localStorage` 但 key 名要语义化并集中登记（登记在 `docs/01` 存储纪律或前端 config 常量）。

- **为什么**：剪贴板粘贴素材曾因"前端自造 `id=时间戳` + rescan 用 `local-${folder}-${basename}`"两个 id 不一致，同一文件产生两条记录（见 `daily/2026-08-11` / `docs/34`）。key/命名约定分散时，改名/换引擎要全局 grep，且易因命名不一致出数据重复/遗漏。
- **新增存储 key / 命名约定**：① 先确认是否已有对应常量/约定 → ② 语义化命名并集中登记 → ③ 只在登记处定义、业务消费不散拼。
- 实战案例：素材落盘 id 对齐 rescan 命名 `local-${folder}-${basename}`（`localTool/src/routes/resources.ts`）消除双记录。

> **反模式（不要做）**：为剪贴板素材另起一套 `id=Date.now().toString()`，与 rescan 的 `local-${folder}-${basename}` 命名不一致 → 同一文件被 rescan 再入库一条、前端重复显示。

### 原则五：单一数据源 · 职责单一 · 链路清晰（手段，不是目的）

**这是三条"让未来改代码更容易"的倾向性目标，不是强制铁律。它们的价值只在于压低 SOP 开篇说的"改代码贵的三成本"（定位 / 波及 / 时序）。**

> ⚠️ **核心边界（奥卡姆剃刀优先）**：如果为了追求"单一 / 职责 / 清晰"而引入新的抽象层、适配层、间接调用，导致代码**反而更复杂、更绕、更难改**——那就违背本原则的本意，应**放弃收口，保持简单**。单一化是手段，降低改码成本才是目的；手段损害目的时，丢弃手段。

#### 1. 数据源单一（倾向，非强制）
- **一个事实尽量只在一处产生、一处定义形态**。`t.id` 这类关键标识由**上游（任务创建 / 恢复 / transit 合并，都是我们自己写的）在产生时就保证结构完整**，下游直接信任、按 `task.id` 用。
- **禁止"下游兜底"式自欺**：上游漏了 `id`，下游绝不该编个 `tid-xxxx` 假 id 让它"看起来成功"——那只是把 bug 藏起来，下次还犯。上游错了就**去改上游**，让错误在产生的地方暴露、在产生的地方修。下游裸读 `task.id` 崩了，是好事：它精准指向"上游产生了不完整任务"这个真问题。
- 但：若为了"单一"要去加一道全局校验层 / 包装结构，而当前只有 1~2 处消费，直接就地读 `task.id` 更简单 —— 那就就地读，别过度设计。
- 经验法则：消费点 ≥ 3 处且形态不一致时，才值得把"产生 + 归一化"收口到单一入口（收口的目的仍是让上游一处负责，不是让下游去补）。

#### 2. 职责单一（倾向，非强制）
- **一个函数尽量只做一类易变的事**：拼文件名、URL→blob 转换、落盘这些如果散在多处且常要一起改，收口成一个 helper（如 H3 的 `uploadToLocalTool`）能降波及成本。
- 但：如果调用点就 1 处，抽 helper 只是多一层跳转、没减少任何散点 —— 那不抽，原地写清楚即可。
- 经验法则：收口后"未来改这里要动几个文件/几处"明显变少，才值得抽；否则保持内联。

#### 3. 链路清晰（倾向，非强制）
- **数据通路尽量一眼可读**：跨环节用显式入参传递，不靠闭包隐式捕获外层变量（曾踩坑：回调闭包读外层 `t.id`，调用点看不出依赖，改 A 影响 B）。
- 但：为了"清晰"而把本可局部闭包的状态硬拆成 props/事件层层透传，若让链路更长更绕 —— 那是过度清晰，反噬改码成本。
- 经验法则：隐式依赖会导致"改 A 不知影响 B"的回归坑时，才值得显式化；纯局部、无副作用的状态，闭包更省事。

> **判定标准（改码前自问，带退出条件）**：这段逻辑"数据源多处产生 / 一函数又拼名又落盘 / 链路靠闭包"——命中后，先算一笔账：**收口后下次改这里是不是真的更简单（文件/改动点变少、依赖可见）？** 是 → 收口；否（只是多一层间接、没减少散点）→ **别收口，保持原样甚至就地加注释说明**。永远拿"改码成本"这把尺量，不拿"够不够单一"这把尺量。

> **实战案例（为什么对，是因为降了成本，不是因为"单一"神圣）**：素材落盘 `handleResourcesSave`（`localTool/src/routes/resources.ts`）落盘 dataURL 后，`body.id` 原来用前端传的时间戳，与 rescan 的 `local-${folder}-${basename}` 命名不一致，导致同一文件两条记录。
> - **真正根因在上游（产生时命名不统一）**：前端自造 id 与 rescan 命名是**两套约定**。**正确修法 = 在产生时对齐单一命名**（落盘时 `body.id = local-${folder}-${basename(urlPath)}`），而不是下游 rescan 时去"跳过"或"补一条"。修一处上游，整条链路一致。
> - **收口（H3 同理）是因为降成本才值得**：把"URL→本地化→落盘→id 命名"收口到 `handleResourcesSave` 一处，未来改上传/落盘协议只动一处。
> - **若当时只有 1 处消费**：连收口都不必抽，原地写清楚即可——不要为了"单一"而加层。

---

## 一、前置检查清单

拆解前逐项确认，全部通过才能动手。

| # | 检查项 | 判断标准 | 不通过则 |
|---|--------|----------|----------|
| 1 | 目标代码是否被多个模块级函数高频依赖？ | 搜索调用点数量 | 不可拆，参考翻车 #16 |
| 2 | 目标代码是否引用混淆产物模块级闭包变量？ | 检查函数体内使用的外部变量 | 提取为参数传入 |
| 3 | 目标代码体积是否值得拆？ | 至少 50 行以上 | 太短不值得 |
| 4 | 是否有对应模块文档/变更记录？ | `docs/01 长期目标` 变更台账 / 对应 `docs/*` 排查文档 | 先读文档再动手 |

**翻车案例参考**：被多模块级函数高频依赖的共享函数不可拆（如 `c_.jsx` 的 `rt` 被 list/single 视图 3 处引用，改它要从根因层面改而不可简单抽离）——拆分前务必 grep 全量调用点。

---

## 二、标准拆解流程

### 步骤 1：读懂旧代码

- 读 `docs/README.md` 的「改什么读什么」表 + `docs/01 长期目标` 变更台账（先看是否已有变更记录/重打提示）
- 定位符号：`npm run ask symbol <名>`（语义定位）、查 `src/bundle/symbol_map.json` / `BUNDLE_MAP.md` / `AI_NAVIGATION.md`，在 `src/bundle/` 对应混淆产物中确认起止行号
- 追踪数据流：从哪里读数据 → 怎么处理 → 写到哪里（localTool `:18080` / Lovart `:9004` / 官方接入点）
- 确认外部依赖（`httpClient-BknZwXjG_components/` 内共享、`vendor-Z-adA07W.js`、`localTool/` 后端）

**产物**：明确的行号区间 + 数据流图（文字即可）。

---

### 步骤 2：设计方案

与用户对齐三个问题：
1. 拆几个文件？（标准 2 个：service + component）
2. 数据流怎么走？（props 直传 / 事件总线 / 回调？）
3. 编辑入口怎么统一？（多个入口开同一个组件）

**产物**：用户确认后的文件清单 + 数据流方案。

---

### 步骤 3：写代码

#### 3.1 数据层（如需）

```js
// src/services/xxxManager.js
// 纯函数，无 UI 依赖
export function loadData() { /* 从 KV 读 */ }
export function saveData(data) { /* 写 KV + 通知 UI */ }
export function filterData(data, criteria) { /* 过滤逻辑 */ }
```

#### 3.2 UI 组件（自包含 CSS）

**强制规则**：组件样式必须完全自包含，不依赖 Tailwind/JIT（尤其**禁止 Tailwind 任意值类**，如 `min-h-[480px]`、`text-[#e5e5e5]`——这类类名在 1mao build 时可能不被扫描、样式不生效，曾致弹窗尺寸无效）。

- **新建独立组件** → `src/bundle/httpClient-BknZwXjG_components/_cmp_XXX.jsx`（语义命名），用下方模板。
- **改混淆还原码内的小 UI（推荐内嵌）** → 在现有 `*.jsx` 内联 `const XXX_CSS = \`...\`` + `<style>{XXX_CSS}</style>` 注入，类名用语义前缀（如 `shotedit-*`）。不新建文件、不增 import，最贴合"改官方码最小差异"（参考 `c_.jsx` 双击弹窗）。

标准模板：

```js
// 1. 导入 vendor（1mao 产物：rolldown-runtime-aKtaBQYM.js / vendor-Z-adA07W.js）
import { i as e } from "../bundle/rolldown-runtime-aKtaBQYM.js";
import { Nr as le, Ar as o, Mr as ae } from "../bundle/vendor-Z-adA07W.js";
var Y = e(le(), 1), Un = ae();
var X = o();

// 2. 定义自包含 CSS（统一前缀，如 pl- / pd-）
const STYLES = `
  .pl-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); ... }
  .pl-card { background: #1a1a1a; border: 1px solid #2a2a2a; ... }
  .pl-card:hover { border-color: #444; }
`;

// 3. 组件函数
function MyComponent(props) {
  // ... 逻辑、状态 ...

  if (!props.open) return null;

  return Un.createPortal(X.jsxs("div", {
    className: "pl-overlay",
    children: [
      X.jsx("style", { children: STYLES }),  // ← 注入样式
      // ... 其他 JSX，全部用 pl- 前缀
    ]
  }), document.body);
}
```

**CSS 规则**：
- 颜色用 `hex`/`rgba`，字体用 `px`，间距用 `px`
- 伪类（`:hover`、`:focus`）写在 CSS 字符串里
- 滚动条复用官方既有 `custom-scrollbar` 类，不自定义
- 多个组件共享前缀时，复用同一个 `STYLES`/`XXX_CSS` 字符串

**禁止使用**：
- ❌ `className="gap-[16px]"` — Tailwind 任意值语法
- ❌ `className="text-[#e5e5e5]"` — 同上
- ❌ `className="rounded-[18px]"` — 同上

---

### 步骤 4：修改混淆产物 / localTool

#### 4.1 大块删除（推荐 Node.js 脚本）

对于 300+ 行的删除操作，`replace_in_file` 容易出现上半截换了、下半截留着的错误。用脚本更安全：

```js
// scripts/extract-xxx.cjs
const fs = require('fs');
const appPath = 'src/bundle/httpClient-BknZwXjG.js'; // 或 App-BX6o9fW5.js 等混淆产物
let content = fs.readFileSync(appPath, 'utf8');

// 删除函数（用语义签名定位，勿写死行号）
const targetStart = content.indexOf('let rt = ');
const targetEnd = content.indexOf('let J = ', targetStart);
content = content.slice(0, targetStart) + content.slice(targetEnd);

// 添加 import 和替换引用
// ...

fs.writeFileSync(appPath, content);
```

关键原则：
- 用 `indexOf` + `substring` 定位，兼容 Windows `\r\n`
- 不用 `replace_in_file` 做大段替换

#### 4.2 状态同步

如果拆出的组件需要写回混淆产物/宿主组件的状态：

**方案 A — 事件总线**（组件 → 宿主，推荐）：
```js
// 组件内写完后派发事件
saveAndNotify(newData); // 内部调用 window.dispatchEvent('yimao:xxxChanged')

// 宿主监听
Y.useEffect(() => {
  const handler = (e) => { e.detail && Array.isArray(e.detail) && Mr(e.detail); };
  window.addEventListener('yimao:xxxChanged', handler);
  return () => window.removeEventListener('yimao:xxxChanged', handler);
}, []);
```

**方案 B — props 回调**（父组件 → 子组件直传）：
```js
<MyComponent onDataChange={(newData) => setState(newData)} />
```

选择原则：调用点多于 2 个用事件总线，否则用 props 回调。

---

### 步骤 5：验证

顺序执行，全部通过才算完成。

```
1. npm run build           ← Vite 编译通过、回灌 dist/（前端改动）
2. npm run contracts       ← 契约/质量门 PASS（后端 localTool 改动需 tsc 编译）
3. npm run test:smoke      ← 冒烟（React 单实例、chunk 完整性、契约漂移）
   ⚠️  smoke 检查 React 单实例 / dist 重复 chunk / 契约漂移；抓不了 vendor React 兼容性问题。
        Chrome 真机验证不可跳过。
4. Chrome 加载 dist/       ← 功能正常（用 dev 模式则 `npm run dev`）
   - 增删改查全部测试
   - 各入口点开确认正常
   - 检查控制台无新增报错
```

---

### 步骤 6：提交与沉淀

```
git add -A
git commit -m "fix/feat(xxx): 改动说明（改的是哪个混淆产物/后端文件，见 docs/01 变更#N / docs/3X）"
```

然后在 `docs/01 长期目标-未来适配方向.md` 变更台账登记（含：现象/根因/改动点/验证/重打提示），若本次改动过大或后端改动，另在 `daily/` 当日记录。记录：
- 改了什么
- 遇到什么问题
- 怎么解决的
- 下次怎么避免 / 官方更新重打提示

---

## 三、快速参考卡片

| 场景 | 做法 |
|------|------|
| 要拆 UI 组件 | 读 §3.2 模板，自包含 CSS |
| 要拆数据层 | 读 §3.1，纯函数无 UI |
| 要删大段代码 | 读 §4.1，写 Node 脚本 |
| 组件要写回宿主/混淆产物状态 | 读 §4.2，事件总线 / props 回调 |
| 拆前检查是否安全 | 读 §1 前置检查清单 |
| 遇到后端契约/接入点差异 | 读 §二·原则三，建适配层，`localTool`(:18080) 统一出口 |
| 新增/修改存储或落盘命名 | 读 §二·原则四，走 `localTool`，命名对齐 rescan（`local-${folder}-${basename}`） |
| 完成后要做什么 | 读 §5 验证 + §6 提交沉淀（登记 `docs/01` + `daily/`） |
| 遇到不认识的函数名 | `npm run ask symbol <名>` 语义定位；查 `symbol_map.json` |
| 遇到不认识的 vendor 导出 | 查 `src/bundle/BUNDLE_MAP.md` / `symbol_map.json` |
| 想知道当前项目状态 | `npm run map` 生成 BUNDLE_MAP；`npm run health` 体检 |
| 冒烟验证 | `npm run test:smoke` + `npm run contracts`（无需 Chrome） |

---

## 四、已有翻车经验（1mao 已踩坑，记录在 `docs/01 长期目标-未来适配方向.md` 变更台账 + 各排查文档）

| # | 教训 | 对策 |
|---|------|------|
| 16 | 被高频依赖的共享函数不可拆（如 `c_.jsx` 的 `rt` 被 3 处引用） | §1 检查 #1，grep 全量调用点 |
| 10 | 新组件必须用自包含 CSS + vendor 导入模板 | §3.2 模板 |
| 11 | 图标用内联 SVG/官方既有图标，不新增 import vendor 图标 | §3.2 图标部分 |
| 6 | 不能从新文件 import 混淆产物/宿主 | 不 import，用事件总线通信 |
| 14 | 不用 Tailwind 任意值类（`min-h-[480px]` 等，build 可能不生成样式） | §3.2 自包含 CSS |

---

## 输出前自检清单

改码完成、提交前，逐项确认：

- [ ] `npm run build` 通过（前端改动回灌 `dist/`）
- [ ] `npm run contracts` 通过（契约/质量门）
- [ ] `npm run test:smoke` 通过（但 **不等价于 Chrome 验证** — smoke 抓不了 vendor React 兼容性，真机不可跳过）
- [ ] 本地工具改动过 `localTool/` tsc 编译通过
- [ ] 新组件使用自包含 CSS（无 Tailwind 任意值，尤其 `min-h-[x]` 这类）
- [ ] 未修改 `src/bundle/vendor-*.js`、`dist/`、`*.css`（dist 已 gitignore）
- [ ] 未改变数据通路（localTool KV、素材落盘命名）
- [ ] 经验已登记 `docs/01 长期目标`（变更台账）或 `daily/` 当日记录
- [ ] Commit message 格式正确
