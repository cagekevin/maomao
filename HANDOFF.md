# Handoff — 2026-07-22 阶段 4.2：已完成

> **给下一位 AI**：先读 `CLAUDE.md`，再看 `docs/拆分计划.md`，最后读本文档。

---

## 当前状态

| 项目 | 值 |
|------|-----|
| 分支 | `main` |
| 工作区 | App.js 已修改 + `gatewayClient.js` 新建 |
| 构建 | `npx vite build` ✓ 成功，38 modules，~5.5s |
| 运行时 | GAS 同步正常，预存 bug `engine-*.js:489` 仍在（非本次引入） |

> Windows build 命令：`$env:NODE_OPTIONS="--max-old-space-size=1024"; npx vite build`

---

## 阶段 4.2：已完成 ✅

10 个 9004 网关端点已全部从 App.js 提取到 `src/services/gatewayClient.js`：

| # | 函数名 | 端点 | 方法 |
|---|--------|------|------|
| 1 | `uploadToGateway` | `/v1/gateway/upload` | POST (fetch) |
| 2 | `submitSd2Video` | `/v1/video/generations` | POST (zc) |
| 3 | `pollSd2Video` | `/v1/video/generations/{id}` | GET (fetch) |
| 4 | `submitDiscountVideo` | `/v1/gateway/generate` | POST (zc) |
| 5 | `pollDiscountVideo` | `/v1/gateway/task/{id}` | GET (fetch) |
| 6 | `pollImageTask` | `/v1/tasks/{id}` | GET (zc, 3处共用) |
| 7 | `confirmTask` | `/v1/tasks/{id}/confirm` | POST (zc) |
| 8 | `getVideoResult` | `/v1/videos/{id}` | GET (zc) |
| 9 | `submitVideoGeneration` | 视频生成提交 | POST (zc, FormData) |
| 10 | `submitImageGeneration` | 生图提交 | POST (zc, FormData/JSON) |

App.js import 已添加在 L25（`import { zc }` 之后）。

---

## 本次额外修复

- **"ei is not defined"** — 删除了 `_saveLocalTemplates` 中无效的 `ei().catch(() => {})` 调用（L28636），该引用指向不存在的变量导致 GAS 同步拉取失败。已修复，拉取正常。

---

## 已知问题（无需处理）

1. **engine 错误三件套（`setObject`/`on`/`mt`）** — 控制台显示 3 个错误：
   - `engine-*.js:1 (setObject)` → import 语句，Vite 打包的 ESM 导入行，无对应源码
   - `engine-*.js:433 (on)` → App.js L26545，CSS 样式字符串 `var Oh = \`...`，与 `on` 完全无关
   - `engine-*.js:599 (mt)` → App.js L40797，JSON 配置字符串 `Lr = \`{...}`，与 `mt` 完全无关
   - **结论**：sourcemap 定位后确认全部是误报。压缩后变量名与 sourcemap 行号错位导致 Chrome 误显示，不影响功能。无需处理。
   - **排查方法**：`vite.config.ts` 设 `sourcemap: true` 构建，用 `source-map` 包反查 `consumer.originalPositionFor({line, column:0})`
2. **`[Storage] 拒绝保存空对象/空数组`** — Storage 层防御性 warn，云端无数据时触发，不影响功能

---

## 拆分计划的 4 条铁律（红线）

1. **降低认知负担** — 切完后调用方是不是更容易找到和理解这段代码？
2. **奥卡姆剃刀** — "删掉这个改动有影响吗？" 答不上来就不做。不建包装层、不建桶文件。
3. **切而不改** — 从 App.js 搬代码时原样不动。新创建的函数用语义化 camelCase 命名。
4. **每步 build 必须过** — 切完立刻从 App.js 删除原代码，不保留重复。不碰 `entry.js`/`vendor/`/`dist/`/`.css`。
