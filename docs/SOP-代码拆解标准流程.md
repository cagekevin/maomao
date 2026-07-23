# SOP：代码拆解标准流程

> 适用场景：从 `App.js`（~4.4 万行混淆代码）中提取功能模块为独立文件。
> 参考案例：提示词管理拆解（`qa` + `Ja` → `PromptLibrary.jsx` + `promptManager.js`，App.js -386 行）。

---

## 一、前置检查清单

拆解前逐项确认，全部通过才能动手。

| # | 检查项 | 判断标准 | 不通过则 |
|---|--------|----------|----------|
| 1 | 目标代码是否被多个模块级函数高频依赖？ | 搜索调用点数量 | 不可拆，参考翻车 #16 |
| 2 | 目标代码是否引用 App.js 模块级闭包变量？ | 检查函数体内使用的外部变量 | 提取为参数传入 |
| 3 | 目标代码体积是否值得拆？ | 至少 50 行以上 | 太短不值得 |
| 4 | 是否有对应模块专题文档？ | `docs/模块专题/` 目录 | 先读文档再动手 |

**翻车案例参考**：`docs/拆分计划.md` 翻车点 #16 — 48 行 `si`(NodeHeader) 拆炸了，因为被多个模块级函数依赖。

---

## 二、标准拆解流程

### 步骤 1：读懂旧代码

- 读 `docs/模块专题/` 对应的专题文档
- 在 `App.js` 中定位函数体，确认起止行号
- 追踪数据流：从哪里读数据 → 怎么处理 → 写到哪里
- 确认外部依赖（`config/`、`services/`、`utils/` 等）

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

**强制规则**：组件样式必须完全自包含，不依赖 Tailwind/JIT。

```
src/components/xxx/XxxPanel.jsx  ← UI 组件
```

标准模板：

```js
// 1. 导入 vendor
import { i as e } from "../../vendor/rolldown-runtime.js";
import { Nr as le, Ar as o, Mr as ae } from "../../vendor/vendor.js";
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
- 滚动条用统一类名 `pl-custom-scrollbar`
- 多个组件共享前缀时，复用同一个 `STYLES` 字符串

**禁止使用**：
- ❌ `className="gap-[16px]"` — Tailwind 任意值语法
- ❌ `className="text-[#e5e5e5]"` — 同上
- ❌ `className="rounded-[18px]"` — 同上

---

### 步骤 4：修改 App.js

#### 4.1 大块删除（推荐 Node.js 脚本）

对于 300+ 行的删除操作，`replace_in_file` 容易出现上半截换了、下半截留着的错误。用脚本更安全：

```js
// scripts/extract-xxx.cjs
const fs = require('fs');
const appPath = 'src/App.js';
let content = fs.readFileSync(appPath, 'utf8');

// 删除函数 qa（行号区间）
const qaStart = content.indexOf('function qa(');
const qaEnd = content.indexOf('function Ja(', qaStart);
content = content.slice(0, qaStart) + content.slice(qaEnd);

// 删除函数 Ja
// ...

// 添加 import 和替换引用
// ...

fs.writeFileSync(appPath, content);
```

关键原则：
- 用 `indexOf` + `substring` 定位，兼容 Windows `\r\n`
- 不用 `replace_in_file` 做大段替换

#### 4.2 状态同步

如果拆出的组件需要写回 App.js 的状态：

**方案 A — 事件总线**（组件 → App.js，推荐）：
```js
// 组件内写完后派发事件
saveAndNotify(newData); // 内部调用 window.dispatchEvent('yimao:xxxChanged')

// App.js 监听
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
1. npm run build          ← 编译通过
2. npx eslint src/...     ← 无新 error（warning 可忽略）
3. Chrome 加载 dist/      ← 功能正常
   - 增删改查全部测试
   - 各入口点开确认正常
   - 检查控制台无新增报错
```

---

### 步骤 6：提交与沉淀

```
git add -A
git commit -m "feat(xxx): 拆解 XXX 模块，App.js -N 行"
```

然后将经验追加到 `docs/拆分计划.md` 翻车点区域，记录：
- 改了什么
- 遇到什么问题
- 怎么解决的
- 下次怎么避免

---

## 三、快速参考卡片

| 场景 | 做法 |
|------|------|
| 要拆 UI 组件 | 读 §3.2 模板，自包含 CSS |
| 要拆数据层 | 读 §3.1，纯函数无 UI |
| 要删大段代码 | 读 §4.1，写 Node 脚本 |
| 组件要写回 App.js 状态 | 读 §4.2，事件总线 / props 回调 |
| 拆前检查是否安全 | 读 §1 前置检查清单 |
| 完成后要做什么 | 读 §5 验证 + §6 提交沉淀 |

---

## 四、已有翻车经验（来自 `docs/拆分计划.md`）

| # | 教训 | 对策 |
|---|------|------|
| 16 | 被高频依赖的共享函数不可拆 | §1 检查 #1 |
| 10 | 新组件必须用 vendor 导入模板 | §3.2 模板 |
| 11 | 图标用内联 SVG，不 import vendor 图标 | §3.2 图标部分 |
| 6 | 不能从新文件 import App.js | 不 import，用事件总线通信 |
| 14 | vendor 导入必须用导出名 | 对照 vendor.js 确认 |

---

## 输出前自检清单

改码完成、提交前，逐项确认：

- [ ] `npm run build` 通过
- [ ] `npx eslint` 无新 error
- [ ] 新组件使用自包含 CSS（无 Tailwind 任意值）
- [ ] 未修改 `src/vendor/`、`dist/`、`*.css`
- [ ] 未改变数据通路（KV 读写、GAS 同步键）
- [ ] 经验已追加到 `docs/拆分计划.md`
- [ ] Commit message 格式正确
