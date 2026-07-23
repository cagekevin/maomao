# Handoff — 2026-07-23 拆退回 4.1（4.2 未落地）

> **给下一位 AI**：先读 `CLAUDE.md`，再看 `docs/拆分计划.md`，最后读本文档。
> ⚠️ **重要**：拆分计划已**退回到阶段 4.1**。阶段 4.2（把 9004 网关请求切到 `src/services/gatewayClient.js`）**并未真正落地**，代码里没有 `gatewayClient.js` 这个文件。本文档旧版曾误写"4.2 已完成"，已作废。

---

## 当前状态（2026-07-23，commit `176437b`）

| 项目 | 值 |
|------|-----|
| 分支 | `main` @ `176437b` |
| 网关请求 | **仍在 App.js 内**，未切出。仅有 `src/services/gatewayProxy.js`（`zc` 函数，网关 proxy 转发层，切自 App.js L18078，App.js L24 `import { zc }` 使用） |
| GAS 云同步 | 仍在 App.js 内 `CloudSyncEngine` 对象（约 L41312 起）。push 函数已语义化改名：原 `ei` → `syncToCloud`（L41365）；pull 函数仍是 `ti`（L41415） |
| 构建 | `npx vite build` ✓ 成功 |
| 运行时 | GAS 同步正常，预存 bug `engine-*.js:489` 仍在（非本次引入） |

> Windows build 命令：`$env:NODE_OPTIONS="--max-old-space-size=1024"; npx vite build`

---

## 拆分进度（真实）

- **4.1 ✅**：模型权益/目录等已切到 `src/services/modelEntitlements.js` 等（见 `docs/拆分计划.md` §1 已切出清单）。
- **4.2 ❌ 未做（已退回）**：原计划把 9004 网关 fetch 切到 `src/services/gatewayClient.js`，**执行中发现问题已退回**。代码里**不存在** `gatewayClient.js`。如需重做 4.2，请先 `git log` 确认当前 `main` 状态，不要假设文件已存在。

---

## 本次真实改动（176437b）

- **GAS push 函数语义化重命名**：`ei` → `syncToCloud`（仅 App.js 内 2 处：L41365 定义 + L42329 `onClick` 引用）。
- ⚠️ **同名遮蔽提醒**：App.js 的 `Nv` 组件内**另有一个 `ei`**（L34671，是"打组"的 `Y.useCallback`），与已被改名的 GAS push `ei` 无关。改名后 `ei` 仅指打组函数，`syncToCloud` 专指 GAS push。下个 AI 搜 `ei` 时务必带行号区分，勿混淆。

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
