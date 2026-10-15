# 工具选型与决策树（专业工具）

> 动手前**先选路径**，再跑脚本。选错路径会白干几小时。
>
> ⚠️ **来源说明**：本文件的工具名 / 仓库地址来自公开检索，**未逐个实测**（星数、版本、许可证、维护状态请自行核实）。已在项目中实战验证的只有 **webcrack + 自研流水线**（见 `references/bundle/pipeline.md`）。
> 本文件是对 `pipeline.md`（自研 webcrack 流水线）的补充——先看这里有没有更省事的路。

---

## 0. 决策树（从上到下，命中即停）

```
目标产物
│
├─ 1. 有 .map（sourcemap）吗？
│     有 → reverse-sourcemap 直接还原原始源码  ★ 最快，跳过整条流水线
│
├─ 2. 是打包产物（webpack / vite / rolldown / browserify）吗？
│     是 → webcrack 拆包（本分支主线）或 web-unpacker / webpack-unpack
│
├─ 3. 是通用混淆（obfuscator.io / javascript-obfuscator / js-confuser）吗？
│     是 → restringer / js-defuser / synchrony / ben-sb 反混淆器
│
├─ 4. 是 JS 自定义 VM（JSVMP / 风控引擎）吗？
│     是 → 分支 C：references/runtime/jsvm-deobfuscation.md
│
└─ 5. 是 V8 字节码（.jsc / bytenode / Electron）吗？
      是 → View8
```

**怎么判断属于哪类**：看文件头。
- `function(e,t,n){...}` 且有 `__webpack_require__` → **webpack**
- `!function(){var U=void 0,y=parseInt...}` 单字母变量 + 大 switch → **JSVMP**
- `_0x` 开头变量 + 字符串数组 → **obfuscator.io 系**
- 二进制/`\x00asm` → WASM（转二进制工具）
- `.jsc` / 无法读的字节码 → **V8 字节码**

---

## 1. Sourcemap 还原（★ 优先检查，最快路径）

> 如果产物带 `.map` 且含 `sourcesContent`，**可以直接还原出原始源码**——比任何反混淆都干净。

| 工具 | 说明 |
|---|---|
| **reverse-sourcemap** | npm 全局包，从 `.map` 反推原始 JS/CSS 源码；`reverse-sourcemap --output-dir src xxx.js.map` |
| **restore-source-tree** | 还原目录树（部分文件可能还原不了） |
| **shuji** | 还原文件（同名文件会被忽略） |
| **unwebpack-sourcemap** | 针对 webpack 的 sourcemap 还原 |

**前置检查**：打开 `.map`，确认 `sourcesContent` 非空。若为空/缺失，**任何工具都还原不出**，只能走反混淆路径。

**做法**：把 `.map` 和对应 chunk 放同目录，跑 `reverse-sourcemap`，产物即为原始源码树。

---

## 2. 打包产物拆包

| 工具 | 仓库 | 说明 |
|---|---|---|
| **webcrack** | `j4k0xb/webcrack` | **本分支已用**。解 obfuscator.io、unminify、transpile、拆 webpack/browserify，尽量还原原始源码 |
| **web-unpacker** | `evlon/web-unpacker` | CLI，AST 解析拆 webpack 模块 |
| **webpack-unpack** | `goto-bus-stop/webpack-unpack` | 从 webpack bundle 提取模块 |

> webcrack 拆完后的 ESM 非法结构仍需后处理 → 本分支 `fix_esm.cjs`（见 `esm-fix.md`）。

---

## 3. 通用 AST 反混淆（非打包类混淆）

| 工具 | 仓库 | 说明 |
|---|---|---|
| **restringer** | `HumanSecurity/restringer` | 自动检测混淆模式并还原字符串、简化逻辑；可组合变换 |
| **javascript-deobfuscator** | `ben-sb/javascript-deobfuscator` | 针对 **obfuscator.io**：数组解包、代理函数替换、表达式简化 |
| **synchrony** | `relative/synchrony` | javascript-obfuscator / obfuscator.io 清洗器；命令行 `synchrony deobfuscate x.js` |
| **js-defuser** | `Arsylk/js-defuser` | **全自动**，可还原 js-confuser 最高档（含 locks）与 javascript-obfuscator |
| **deob-transformations** | — | 可组合的 AST 变换集合 |

**选择建议**：简单压缩/格式乱 → `js-beautify` / `prettier` 即可；深度混淆 → 先 `restringer`，obfuscator.io 系再上 `javascript-deobfuscator` / `synchrony`；js-confuser 系上 `js-defuser`。

---

## 4. 浏览器扩展解包

| 工具 | 仓库 | 说明 |
|---|---|---|
| **crxviewer** | `Rob--W/crxviewer` | 查看 Chrome/Firefox/Opera 扩展源码；在线版 `robwu.nl/crxviewer/` |
| 手动 | — | `crx` 是 zip：改后缀解压即可；再读 `manifest.json`（见 `extension-anatomy.md`） |

---

## 5. JSVMP（JS 自定义虚拟机）

→ 完整流程见 `references/runtime/jsvm-deobfuscation.md`。
参考工具/资料：栈帧式 JSVMP 工具链 **Twisted**（TS 实现，编译器→IR→字节码，适合理解 VM 语义）。

---

## 6. V8 字节码（Electron / bytenode）

| 工具 | 仓库 | 说明 |
|---|---|---|
| **View8** | `suleram/View8` | 把序列化的 V8 字节码对象（`.jsc`）静态反编译成可读代码 |
| **view8-jsc-decode** | `mypanda/view8-jsc-decode` | View8 的封装/变体 |

> 注意：不同 V8 版本字节码布局不同，可能需要按 V8 版本调整；稳定取结果往往要回到 V8 源码层改输出逻辑。

---

## 7. 与当前流水线的关系

| 场景 | 用什么 |
|---|---|
| 有 sourcemap | `reverse-sourcemap`（**优先**，可跳过流水线） |
| 打包产物（本项目主场景） | 本分支主线：`extract_input` → `run.cjs`（webcrack）→ `fix_esm.cjs` → 真机验收 |
| 打包产物但 webcrack 拆得不好 | 换 `web-unpacker` / `webpack-unpack` 试 |
| 非打包的深度混淆 | 先 `restringer` / `js-defuser` 洗一遍，再进流水线 |
| 扩展包 | `crxviewer` / 手动解压 + `extension-anatomy.md` |
| JSVMP | 分支 C：`references/runtime/overview.md` |
| V8 字节码 | `View8` |
