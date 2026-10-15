# 生成流水线（主线 0~1）

> 起点只有一个官方编译好的产物 `dist`，没有任何其它输入。`step0_raw/` 是第 0 步**提取**出来的。

---

## 1. 输入提取（第 0 步 `extract_input.cjs`）

```powershell
node scripts/extract_input.cjs <最初的dist路径>
```

- `step0_raw/chunks/` ← 从 `dist/assets/` **glob 自适应提取「业务 chunk」**，剔除 `vendor-*` / `rolldown-runtime-*` / `__vite-browser-external-*`，其余一律收齐。**不写死白名单**，换源/换版本无需改代码。
- `step0_raw/static/` ← 从 `dist/` 根提 `index.html`、从 `dist/share/` 提 `share.html`、从 `dist/public/` 提 `manifest.json` / `background.js` / 图标 / `mediapipe` / `models` / `assets/*.css` 到 `static/public/`。

**chunk 自动分档**：
- **DEEP**（核心业务，走完整 webcrack → 拆分）：文件名匹配 `^(App|httpClient|src)-`
- **OTHER**（其余业务 chunk）：只拷贝

---

## 2. 真实阶段顺序（`run.cjs` 内部，务必按此）

```
⓪ webcrack
→ ① 01_expand        结构展开
→ ①b 00_sanitize     清 webcrack 伪迹（必须在 ① 后、② 前，因为 expand 会重新引入伪迹）
→ ② 02_split         组件拆分（free-variable 分析核心）
→ ③ 03_facade        门面替换
→ ④ 04_unicode       中文还原
→ ⑤ assemble         组装工程（shim + vite.config + css 占位）
→ clean_project      终检（递归清理残留伪迹）
```

> 终检必须放在组装**之后**——拆分会再次触发 babel 失败，需兜底再跑一次。

---

## 3. 各脚本职责

| 脚本 | 作用 |
|---|---|
| `run.cjs` | 总入口：识别 chunks → webcrack → 00~04 → 组装 + shim + vite.config + CSS 占位 + 终检 |
| `00_sanitize.cjs` | 清 webcrack 伪迹 `function NAME() { [native code] }` → `NAME` |
| `01_expand.cjs` | AI 结构展开 |
| `02_split.cjs` | 智能组件拆分（生成 `*_components/` + `component_map.json`） |
| `03_facade.cjs` | 门面替换（原 JS → re-export） |
| `04_unicode.cjs` | Unicode 中文还原 |
| `05_rename.cjs` | 可读化（可选）：作用域安全语义改名，glob 自适应所有 bundle js |
| `clean_project.cjs` | 终检：递归清理 webcrack `[native code]` 伪迹 |
| `fix_esm.cjs` | 后处理：五类 ESM 修复（见 `esm-fix.md`） |
| `fix_cmp_imported.cjs` | 后处理：剥离 `_cmp_` 前缀 |

---

## 4. 依赖

```json
{
  "dependencies": { "@babel/core": "^7.26.0", "playwright": "^1.62.1", "prettier": "^3.4.0" },
  "devDependencies": {
    "@babel/generator": "^8.0.6", "@babel/parser": "^8.0.7",
    "@babel/traverse": "^8.0.7", "@babel/types": "^8.0.6", "webcrack": "^2.16.0"
  }
}
```

> `fix_esm.cjs` 依赖 `@babel/*`，在 `scripts/` 的 `node_modules` 里解析；从工程根调用它也能解析（require 按脚本路径向上找 node_modules）。

---

## 5. 换源 / 换版本流程

1. 重新 `node scripts/extract_input.cjs <新dist路径>`（glob 自适应，无需改代码）
2. 重跑 `run.cjs`（**仅在换源时才重跑整条流水线**）
3. 若官方版本变了，**业务 CSS 文件名会变**（如 1.4.2=`src-DoQUrSOl.css`、1.4.3=`src-DQ-1CVtg.css`）——`run.cjs` 的 post-build 钩子会自动从 `public/assets` 拷真实 CSS，**不要写死旧版 CSS 名**。

---

## 6. 已知问题（务必知道）

| 问题 | 现象 | 处置 |
|---|---|---|
| **run.cjs 收尾挂死** | 常在收尾清理阶段挂死（总耗时 5~8 分钟） | 产物完整时**不要重跑**，直接后处理兜底 |
| **PowerShell stderr 误报** | webcrack/clean 的 stderr 被当 `RemoteException` 中断 node | 用 `cmd /d /c "node ... > log 2>&1"` 包裹 |
| **300s 超时** | 交互式命令超时杀掉流水线，`output/project/src` 残缺 | 后台 detached 跑 + 轮询；或给 webcrack 加结果缓存 `.wc_cache` |
| **中文路径乱码** | PowerShell/cmd 下参数被 GBK/UTF-8 错解 | 用 ASCII 路径，或整个工作区 `Copy-Item` 到 ASCII 路径再跑 |
| **文件名保持原样** | `run.cjs` 内部按 `00_sanitize.cjs` 等原名互相调用 | 改名会破坏调用链，**别改名** |
