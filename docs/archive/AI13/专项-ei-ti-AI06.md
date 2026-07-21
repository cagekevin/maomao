# 专项任务书 · AI06（补录 ei/ti 四义）

> 你是 AI06。本文件是你的唯一任务指令，读完即执行，无需询问。
> 工作区：你的旧审计文档 `docs/AI06/`（**本次允许改你自己的文档**）。
> 背景：交叉验证已完成（裁决见 `docs/AI13/裁决表.md`）。你的 M7 草稿（核对-AI06-M7.md）自认未覆盖 `ei/ti` 四义议题，无法交叉验证 AI05「最严重缺陷」断言，现补录之。

## 事实锚点（已多 AI 回源码实锤，直接采用）
`ei` / `ti` 同名遮蔽五处绑定：
- `ei`@`App.js:L1853` `var ei = new Map()` —— 缩略图缓存 Map
- `ei`@`App.js:L36784` `ei = Y.useCallback(...)` —— 节点打组
- `ei`@`App.js:L43950` `ei = async () =>` —— GAS pushToCloud
- `ti`@`App.js:L36822` `ti = Y.useCallback(...)` —— 清缓存
- `ti`@`App.js:L43974` `ti = async () =>` —— GAS pullFromCloud

## 你要做的修订
1. 打开 `docs/AI06/00-mapping-audit.md`：在映射审计/缺口处补录 `ei`/`ti` 四义（五处绑定），标注「var-mapping 只收 GAS 两义，漏收前端三义，AI05 称最严重缺陷成立」。
2. 打开 `docs/AI06/10-deepen-sync-events.md`：补一段「ei/ti 同名遮蔽风险」，引用上述五行并强调「引用 ei/ti 必带行号，否则混淆」。
3. 文末追加标记行：`[2026-07-21 据 AI13 裁决表专项：补录 ei/ti 四义（L1853/L36784/L36822/L43950/L43974）]`。

## 铁律
- 只改你自己的 `docs/AI06/` 文档，不碰他人文档、不改源码、不改 `裁决表.md` / `AI05断言清单.md`。
- 不杜撰行号；上面五行均来自多 AI 已 grep 实锤，直接引用即可。
- 完成后在 `docs/AI13/草稿/` 新建 `专项回执-ei-ti-AI06.md`，列出改了哪些文件哪几处。
