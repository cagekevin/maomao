# HANDOFF4 — 画布疯狂刷新 / 生成停不下来（2026-07-20 未解决）

> 跨 session 交接：仅沉淀已用代码证实的事实与待查方向，不下未证实的结论。

## 现象
- 画布里节点反复生成、资源面板反复 rescan。
- localTool 日志可见循环序列：`proxy → /v1/images/edits → tasks/save → rescan → resources → 又 proxy`。

## 已用代码证实（App.js）
- 生图主流程 `Jn` 单次失败是 `throw`，**无自动重试循环**（约 L32821 `if(!l.ok){...throw Error(e)}`，`Jn` 内无 while/setInterval/递归重调自身）。
- 全文件搜 `retry`/`rerun`：均为「多模型按序重试」或「用户手动点重试按钮」，**无失败自动重发**逻辑。
- `Failed to fetch` 在生图路径是连接错误文案（L34-38 / L38155），不是循环证据。

## 已确认事实
- 排查当时网关 9004 是死的（`Failed to fetch`），但「网关死是否等于前端死循环」**未用代码证实，勿当定论**。

## 待查方向（下一个 AI 接手）
- 谁在反复调用 `onGenerate` / `Jn`？可能是某个 effect 在节点状态变化后反复触发重新运行，或节点 `loading` 状态未被清除导致 effect 认为"该运行"。
- 建议 grep：`onGenerate` 的调用方 + `mutiwindow-task-completed` 的监听方（已知 L31371 有一处，只写资源+刷新，不重跑——需找是否还有别处）。

## 与破图的关系
- 破图已修复（`d5d48dd`，rescan 入库 url 补全为完整地址，资源面板图片已能显示）。
- 疯狂刷新是**独立问题**，不要和破图混为一谈（上一个 AI 曾误把两者归因到一起）。
