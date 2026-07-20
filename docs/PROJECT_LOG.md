# 一毛AI画布 · 项目日志

> 只记关键决策，不堆细节。
> **规则：本日志只可向后追加，不可覆盖/改写已有条目。新人接手时新增条目，勿改动历史记录。**

## 2026-07-20 11:50
- 控制台三类报错（9004 的 4 个 404、RootErrorBoundary 的 `useState null`、18080 连不上）均为无害噪音，**不予修改**。
  - 9004 的 `/api/public/platform/builtin`、`/public/platform/models`、`/plugin/manifest.json`、`/api/workflow-apps/by-project/default` 网关从未实现（本地模式用不到），前端兜底吞掉。
  - 18080 连不上是 localTool 未启动导致，非代码 bug。
- 之前注释掉的 UI 功能（模型选择/插件市场/工作流管理）仍会发请求，因请求来自底层取数函数（`App.js` L3224/L3240/L38212/L43311），不在被注释的 UI 层——属预期，不改。
- localTool（18080）、网关（9004）需手动启动，属运行前提。

## 2026-07-20 13:07
- **HANDOFF4 死循环修复完成**（`cd3c0aa`）：
  - 根因：`uploadFile` 返回相对路径 `/files/...`，Chrome 扩展环境解析为 `chrome-extension://` 前缀导致加载失败
  - 同时统一同步 effect 的本地化判定未覆盖相对路径，已本地化任务被反复重新上传 → 死循环
  - 修复：两处改动——`uploadFile` 返回补全绝对路径 + 本地化判定补上 `e.startsWith('/files/')` 相对路径检测
  - 遗留：单任务轮询卡 `pending_confirmation` 仍是独立问题，未修

## 2026-07-20 待观察
- **导出/恢复/云端上传的 JSON 不是同一份**（代码已确认，待观察是否要统一）：
  - 导出备份 `Ri` (L44443) 与 恢复导入 `Bi` (L44482) 是同一份 `{localforage, kvStore}` 结构，互为对偶。
  - 云端上传 `ei` (L43888) → GAS `push_data` 是另一份独立扁平结构，仅 9 个 kvStore 键（`app_settings, api_configs, users, membership, projects, presetPrompts, customNodeTemplates, modelSchedules, cloud_storage_config`）。
  - 差异：云端**不含**画布节点(localforage)、`old_membership`、`lastOpenedProject`、项目详情 `Cr(id)`，但**多含** `modelSchedules`；导出备份反之。
  - 互用问题：导出备份拿去云端 push 会丢字段（`ei` 硬编码只取那 9 键）；云端拉取 `ti` 只写 kvStore 不碰 localforage，画布不会回来。
  - 待观察：是否要统一三者（让云端也带 localforage + 补齐缺失键，或导出也带 modelSchedules）。当前未改。
