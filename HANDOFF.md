# Handoff: ⚠️ 本文件已作废，请勿据此改动代码

> **状态（2026-07-22 更新）**：本文件描述的「修复」经实测是破坏代码的元凶，相关未提交改动已通过 `git checkout -- src/App.js src/entry.js` **全部回退**。当前正常工作基线是 commit `7504c3e`（fix: localTool 两个接口 bug 修复）。
>
> **下个 AI 请直接读 `docs/PROJECT_LOG.md` 与 `CLAUDE.md`，不要参考本文件列出的「修复方案」。**

## 本文件哪里错了（避免重蹈覆辙）

| 本文件声称的修复 | 实际情况 |
|------------------|----------|
| 移除 App.js 中与内部定义冲突的导入 `Vr, Kr, Qr, ri` | 这些是 storage 模块的导入符号，App.js 内部**引用**它们（如 `Vr.getItem`、`Kr()`）。删除导入导致运行时 `TypeError: Vr.getItem is not a function` 等致命错误，应用无法进入。 |
| localTool.js 将硬编码模块 ID `24996` 改为 `Nr()` 动态获取 React | `Nr` 在 storage 模块里是 localStorage 后端（有 `getItem`），不是 React；React 真正来自 vendor 的 `Nr` 导出。该改动混淆了两处 `Nr`，属错误修复。 |
| 「应用运行时仍报错，React 对象为 null」 | 回退后验证（日志 `1784687267140.log`）：应用正常进入，画布加载、localTool 连接成功、初始化完成 `isLoggedIn: true`。仅剩两个**已知无害噪音**（见下）。 |

## 已知无害噪音（不要修，不要为了消灭它大改）

1. `TypeError: Cannot read properties of null (reading 'useState')` + `[RootErrorBoundary] 捕获到未处理异常` —— 被 RootErrorBoundary 捕获后应用正常恢复，基线版本即存在。
2. `127.0.0.1:9004` 的 4 个 404（`/api/public/platform/models`、`/plugin/manifest.json`、`/api/workflow-apps/by-project/default`、`/api/public/platform/builtin`）—— 网关从未实现，本地模式用不到，前端兜底。

## 当前正确状态

- 基线 commit：`7504c3e`
- 已验证：应用正常进入、localTool(:18080) 连接、`/api/tasks/save` 与 `/api/proxy` 后端 bug 已在 `7504c3e` 修复（见 `docs/PROJECT_LOG.md`）。
- 工作区相对 `7504c3e` 仅有 untracked 文件：`src/services/{apiService,localTool,taskManager}.js`、`src/utils/endpoint.js` —— **这些是未完成的解耦实验，未被基线 import，请勿直接启用**（其中 `apiService.js` 曾误用 `Q.getItem` 调用 StorageManager，而 `Q` 无 `getItem` 方法，是典型坑）。

## 正确的下一步

读 `docs/PROJECT_LOG.md` 末尾「2026-07-22 任务1收尾」与「下一步计划」，按红线（`src/App.js` / `config.js` / `localTool/**` 可改，`dist/` / `vendor/` 禁改）继续。
