> 本文件是「逆向学习」技能的一个分支指南。**入口与场景分流见技能根目录的 `SKILL.md`**。


# 混淆产物还原（编译产物 → 可读源码）

> 本分支补分支 A（读源码型逆向）缺的那一环——**手上只有 `dist`，没有任何源码**。
> **适用**：Vite / Rolldown / webpack 打包并压缩混淆的 JS（含 React）产物，尤其是 Chrome MV3 扩展。
> **不适用**：有源码的项目（走分支 A）；原生二进制 / APK（另一类工具链）。

---

## 一、定位与目标

| 项 | 内容 |
|---|---|
| **输入** | 一个官方编译混淆的产物 `dist`（`assets/` 下是几 MB 的 `function(e,t){...}` chunk） |
| **输出** | 有结构、可读、可维护、**能跑**的工程源码 |
| **不是** | 只求 `build` 通过——产物能 build 但源码仍是一团混淆，等于没做 |

**核心矛盾**：`build 通过 / 验收通过` 只是「还原质量够好」的**验证手段**，不是目的本身。

---

## 二、达成线（三条同时满足即停手）

1. **能构建**：`npm run build` 退出码 0，产出 `dist/`（含 index.html + 全部 chunk + CSS）。
2. **能加载**：Chrome 加载 `dist/` 不报「加载即崩」（图标齐全 + HTML 样式引用完整非空）。
3. **真机零应用级报错**：`report.json` 的 `errorCount` 可以 ≠ 0，但**剩下的全是噪声**（`sw.createCDPSession` / 单个 404 / localhost 未连接），**无任何 `ReferenceError` / `TypeError` / `NotFoundError: removeChild`**。

> **不要在「构建零 warning / 验收零 error」上无限打地鼠。** 允许遗留：rollup 体积告警、`Illegal reassignment of import` 告警、个别 webcrack 伪迹残留（手动跑一次 `00_sanitize.cjs` 即可）。
> 只有**构建退出码非 0** / **静态门不过** / **真机出现应用级报错** 才需要继续修。

---

## 三、先选路径 → 主线

**动手前先按决策树选最快路径**（完整版见 `references/bundle/toolchain.md`）：

1. **产物带 `.map`？** → `reverse-sourcemap` 直接还原原始源码，**可跳过整条流水线**（最快）
2. **打包产物**（webpack/vite/rolldown）→ 走下面主线（webcrack）
3. **通用混淆**（obfuscator.io / js-confuser）→ `restringer` / `js-defuser` / `synchrony`
4. **JSVMP 自定义 VM** → 分支 C：`references/runtime/overview.md`
5. **V8 字节码**（`.jsc` / bytenode / Electron）→ `View8`

### 主线（打包产物，0 → 7）

| 步 | 动作 | 关卡 |
|---|---|---|
| **0 提取输入** | `node scripts/extract_input.cjs <最初的dist路径>` → 生成 `step0_raw/`（chunks + static） | glob 自适应，换源/换版本无需改代码 |
| **1 生成工程** | `node scripts/pipeline/run.cjs` → webcrack → 00~04 → 组装 → `output/project` | 见 `references/bundle/pipeline.md` |
| **2 先构建** | `cd output/project && npm install && npm run build` | **关卡**：能构建才说明拆包可用 |
| **3 可读化（可选）** | `node scripts/pipeline/05_rename.cjs output/project/src/bundle` | 作用域安全语义改名；改前先 snapshot |
| **4 静态冒烟门** | `node scripts/verifiers/verify_build.cjs output/project` | 秒级断言，不通过则回修 |
| **5 后处理根治** | `node scripts/pipeline/fix_esm.cjs output/project` | **逆向还原的核心一步**（五类修复） |
| **6 再构建** | `npm run build` | 退出码 0 即达标 |
| **7 真机验收** | `node scripts/verifiers/AI01_ext/verify_ext.cjs` | 看 `report.json`，以「达成线」为准 |

> **避坑**：**不要轻易重跑整条生成流水线**——`run.cjs` 常在收尾清理阶段挂死（5~8 分钟）。产物完整时直接后处理兜底（`fix_esm.cjs` 十几秒一次，可无限迭代）。
> 只有**换源 / 换 dist 版本**才重跑 `extract_input.cjs` + `run.cjs`。

---

## 四、四个关键机制（先理解再动手）

### 1. React 单实例 shim
拆出的代码 `import React from 'react'`，但运行时只能有**一份** React（vendor 里的 `Rr` 工厂）。
用 `_react_shim.js` + `_jsx_runtime.js` + `vite.config.ts` 的 `alias` / `dedupe` 缝合。
→ 详见 `references/bundle/react-single-instance.md`（含「vendor 被复制多份 → 双实例」这一更隐蔽的坑）。

### 2. `component_map.json` 是真相表（最大坑）
每个 `*_components/` 目录各一份，结构是 **`原始组件名 → 文件名`**，且**两者可以不同**（如 `"I_": "I__1"`）。
**所有引用修复都必须以该表为真相，不能按文件名猜**——按文件名猜会漏接。

### 3. `fix_esm.cjs` 五类 ESM 修复
webcrack 拆出的代码天然带 ESM 非法结构，必须后处理才可读可跑：
**C 伪迹清理 → D constructor 还原 →（shared.js 走 A 导出同步；其他文件走 E 悬空补全 + E2 组件引用改写）→ B import 赋值改写**。
→ 详见 `references/bundle/esm-fix.md`（含三个真实 bug 案例）。

### 4. 「加载即崩」类致命错误（优先级高于一切）
`Couldn't load icon` / 界面错乱 / 样式丢失 → 让 Chrome **直接拒绝加载整个扩展**，连报错栈都看不到。
**先修产物再谈验收**：图标齐全 + `index.html` 同时引用真实业务 CSS 与 vendor CSS 且非空。
→ 详见 `references/bundle/pitfalls.md` 与 `references/bundle/templates.md`。

---

## 五、排错闭环

**每修一类 → 重跑 `fix_esm.cjs` → `npm run build` → `verify_ext.cjs` → 看 `report.json`**，直到 `ReferenceError` 全消。

**只修**真机调用栈里的 `ReferenceError` / `TypeError` / `NotFoundError: removeChild`；其余（`sw.createCDPSession`、404、localhost）一律**不修**。

三个真实案例（定位方法 + 修法）见 `references/bundle/esm-fix.md`：
- `Qn is not defined`（抽出的组件，父文件仍用原始名）
- `I_ is not defined`（原始名 ≠ 文件名，必须查 `component_map.json`）
- `_r is not defined`（JSX 成员表达式对象 `<_r.Provider>` 漏收集）

---

## 六、参考文件索引（按需加载）

| 文件 | 什么时候读 |
|---|---|
| `references/bundle/toolchain.md` | **动手前先读**：决策树 + 专业工具选型（sourcemap / 拆包 / AST 反混淆 / V8 字节码） |
| `references/bundle/pipeline.md` | 跑主线 0~1、理解各脚本职责、换源/换版本 |
| `references/bundle/esm-fix.md` | 主线 5 后处理；真机报 `X is not defined` 时定位 |
| `references/bundle/react-single-instance.md` | 真机报 `useState`/`forwardRef` 为 null / Invalid hook call |
| `references/bundle/templates.md` | 补 `vite.config.ts` / `package.json` / shim 模板 |
| `references/bundle/extension-anatomy.md` | 目标是浏览器扩展，需解剖 manifest / service worker / content script / messaging |
| `references/bundle/pitfalls.md` | 全程对照（基础设施坑 / 悬空引用坑 / 验证坑） |
| `references/bundle/raw/` | 需要完整细节时读原始三份长文档 |

> **相关分支**：若需在**运行时**抓签名 / 加密参数，或目标是 JS 自定义 VM（JSVMP）→ 分支 C `references/runtime/overview.md`。

## 七、scripts/（可直接执行）

```
scripts/
├── extract_input.cjs              # 第0步：从 dist 提取 step0_raw/
├── pipeline/                      # 生成 + 后处理
│   ├── run.cjs                    # 总入口（webcrack → 00~04 → 组装）
│   ├── 00_sanitize.cjs ~ 05_rename.cjs
│   ├── clean_project.cjs          # 组装后终检伪迹
│   ├── fix_esm.cjs                # 五类 ESM 修复（核心）
│   └── fix_cmp_imported.cjs       # 剥离 _cmp_ 前缀
└── verifiers/
    ├── verify_build.cjs           # 构建后静态冒烟门
    └── AI01_ext/verify_ext.cjs    # Playwright 真机验收（含 mac 变体）
```

**依赖**：`webcrack` / `@babel/*` / `playwright`（见 `scripts/` 旁 `package.json` 说明，或 `references/bundle/pipeline.md`）。
**执行注意**：PowerShell 会把 webcrack 的 stderr 当 `RemoteException` 中断 node → 用 `cmd /d /c "node ... > log 2>&1"` 包裹。

---

## 八、一键复现（占位符请替换）

```powershell
# 0) 提取输入（从最初的 dist → step0_raw/）
node scripts/extract_input.cjs <最初的dist路径>

# 1) 生成工程（用 cmd 包裹，避免 PowerShell 把 stderr 当错误中断）
cmd /d /c "node scripts/pipeline/run.cjs > run_gen.log 2>&1"

# 2) 先构建验证（关卡）
cd output/project; npm install; npm run build

# 3) 可读化（可选）
node ../../scripts/pipeline/05_rename.cjs output/project/src/bundle

# 4) 静态冒烟门
node ../../scripts/verifiers/verify_build.cjs output/project

# 5) 后处理根治
node ../../scripts/pipeline/fix_esm.cjs output/project

# 6) 再构建
cd output/project; npm run build

# 7) 真机验收
cd ../../scripts/verifiers/AI01_ext
$env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
npm install playwright@1.62.0
$env:EXT_PATH = (Resolve-Path ../../../output/project/dist)
node verify_ext.cjs
```
