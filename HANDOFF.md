# Handoff — 2026-07-24 C 阶段 ✅ 完成，进入 D 阶段

> **给下一位 AI**：先读 `CLAUDE.md`，再看 `docs/拆分计划.md` §11 终局路线图。

---

## 当前状态

| 项目 | 值 |
|------|-----|
| 分支 | `main` @ `0fa05ab`（已推送） |
| App.js | 44,684 行，27 个节点函数体全部语义化完成 |
| 当前阶段 | **D. vendor翻译层**（D-1 ✅ 建 vendor-readable.js 186条；D-2 ✅ 73条存疑验证+24修正合并回 mapping；D-3 ⏸️ 清理过时 `#` 描述；`Mr/Nr/Q/R/Zn/_/jr` 续研未尽）|

---

## C 阶段完成（2026-07-24 ✅）

### 全部 27 个节点完成

| 组 | 函数 | 
|----|------|
| AB01 | ImageNodeComp, PromptNodeComp, TextNodeComp |
| AB02 | CropNodeComp, GridSplitNodeComp, GridMergeNodeComp |
| AB03 | VideoGenNodeComp, SD2VideoNodeComp, DiscountVideoNodeComp |
| AB04 | AudioTranscribeNodeComp, AudioPlayerNodeComp, CustomNodeComp |
| AB05 | RhWebappNodeComp, VideoExtractNodeComp, VideoToGifNodeComp |
| AB06 | ImageCompressNodeComp, FaceMosaicNodeComp, CompareNodeComp |
| AB07 | TextConcatNodeComp, UrlToImageNodeComp, FileToUrlNodeComp |
| AB08 | PanoramaNodeComp, Director3DNodeComp, ImageBoxNodeComp |
| AB09 | GroupNodeComp, Nh, StickyNoteNodeComp |

### 合并教训
- 合并脚本正则不可能完美（模板字面量反引号、CRLF/LF混用），**不要死缠脚本**，手动替换更可靠
- 代码块末尾多余的 `}` 会导致双重闭合，需检查
- AB 文件代码块格式要统一：`| nodeType | varName |` 表头 + ` ``` ` 后跟 `|`

---

## 已完成阶段

- **A. 注释化** ✅：287 个模块级函数全部标注中文说明
- **B. 重命名** ✅：27 个节点组件名全部语义化
- **C. 函数体重写** ✅：27 个函数体局部变量语义化 + 段落注释，全部合并到 App.js
- **安全网** ✅：`safety-net.cjs` 3层验证（文件大小 + 26节点JSX + 构建哈希）

---

## 6 个常驻脚本

```
safety-net    — --snapshot 建基线 / --check 3层验证
check-build   — 不用 Chrome 的静态分析（错误签名/注释/TDZ/语法）
vendor-lookup — 查 vendor 混淆名来源（如 Dj→Three.Texture）
summarize     — 单函数摘要（参数/hook/依赖/JSX 骨架）
annotate      — 基于映射表刷新 App.js 注释
status        — 项目状态速览
merge-rewrites— 合并 AB 代码块到 App.js（有已知缺陷，优先手动改）
```

---

## 终局路线图（`docs/拆分计划.md` §11）

```
A.注释化 ✅ → B.重命名 ✅ → C.函数体重写 ✅ → D.vendor翻译层 📍 → E.新代码直连 ⏸️ → F.旧代码替换 ⏸️
```

**D 阶段**：建 `src/vendor-readable.js`（186 导出→标准库翻译层，0 重复 0 空名），vendor.js 原样不动。

> 数字变更说明：早期"192 导出"是旧解析脚本容错偏宽的虚高值；经 D-2 严格解析，`docs/vendor-mapping.txt` 真实有效映射为 **186 条**，与 `vendor-readable.js` 导出数一致。`CLAUDE.md`、`docs/` 中凡出现"199 / 192"之处均指 186。

### D 阶段进度详情（2026-07-24）

**D-1. vendor-readable.js** ✅ 已完成（commit `6fedfc9` / `cd94bdb` / `16efa09`）
- 输入：`docs/vendor-mapping.txt` 186 有效映射（7 条噪声已清理）
- 输出：`src/vendor-readable.js` 186 导出，0 重复、0 空名
- `npm run build` ✅、check-build 7 项 ✅，vendor 体积不变（tree-shaking）

**D-2. vendor-mapping.txt 73 条存疑验证** ✅ 4 个 AI 已完成
- 分配：`docs/agent-tasks/TASK-01~04-vendor-verify.md`，每 AI ~18 条
- 方法：以 `src/vendor/vendor.js` 末尾 `export{ 本地名 as 导出短名 }` 为权威源，定位 minified 定义体判定真实库/API（**不**用 vendor-readable.js 当证据，会循环）
- 汇总：**确认 42 / 修正 24 / 存疑 7**

| Agent | 文件 | 确认 | 修正 | 存疑 | 关键修正 |
|-------|------|------|------|------|----------|
| AI01 | TASK-01 | 13 | 2 | 4 | `I`→@aws-sdk/signature-v4::SignatureV4；`Or`→@mediapipe/tasks-vision::detector/model |
| AI02 | TASK-02 | 6 | 11 | 2 | `Rn/Tt/Un/V/Vn/Wn/Xn/Z/_t/a/an` 多为 lucide 图标/app helper，非 rolldown/scheduler 内部 |
| AI03 | TASK-03 | 9 | 10 | 0 | — |
| AI04 | TASK-04 | 14 | 1 | 1 | `mr`→react::executionContext（续研修正，高置信假说）|

**存疑 7 条**：`Mr` `Nr` `Q` `R`（AI01，已交回 01 续研）· `Zn` `_`（AI02）· `jr`（AI04）
- 主因：导出块内部名为单字母/双字母（如 `l`/`a`/`GC`/`Lw`），1.66MB 压缩包难唯一定位
- 处理：`Mr/Nr/Q/R` 由 AI01 继续探索；`Zn/_/jr` 保留 `(?)` 不修正

**D-2 已完成（commit `16efa09`）**：
1. ✅ 24 条修正合并回 `vendor-mapping.txt`（value 去掉 `(?)`，注释保留——过时注释留 D-3 清理）
2. ✅ 重新生成 `vendor-readable.js`：**186 条导出，0 重复 0 空名**（之前 192 条为旧脚本容错偏宽的虚高数字，186 是严格解析的真实覆盖）
3. ✅ 三层验证通过：`npm run build` ✅、`check-build` 7 项 ✅、`safety-net --check` ✅（物理/JSX/产物指纹均无破坏）

**D-2 仍未结清**：
- `Mr / Nr / Q / R`（AI01 4 条存疑）—— 续研结果回来后再合并
- `Zn / _ / jr`（3 条保留 `(?)`）—— 无 sourcemap 不强求
- D-3 待办：vendor-mapping.txt 中已修正条目对应的 # 描述还是旧的（如 Z 的 "未定位真实 API" 已不准确），需要按映射重写描述

---

## 改码标准流程

```
1. status          了解当前状态
2. safety-net --snapshot  建基线
3. 改代码
4. safety-net      3层验证
5. build + check-build  编译+静态分析
6. 提交
```
