# 区域 04 · App.tsx 聚焦审计（2026-09-16）

> **触发**：用户要求「查查 app.ts 有没有债务」。锁定目标 `src/App.tsx`（主应用根组件，上帝组件）。
> **起点**：本文件属 area 04（画布/节点）覆盖，画布编排段已深审；本轮补审其**渲染段 / 持久化段 / 死钩子注释**三类历史「未审残留」+ 全文件高频形态扫描。
> **覆盖度账**：本轮回查 `src/App.tsx` 渲染段 + `persistCanvas` + 死钩子注释；`CanvasToolbar.tsx` 抽审。

---

## 一、链路快照（refs 实证）

`node scripts/mv-sync-refs.mjs refs src/App.tsx`：
- ① 模块引用 **1 处**：`src/main.tsx`（入口，App 是根组件，fan-in 本就仅此 1 处，**正常**）。
- ② 字符串残留引用 362 处：绝大多数为注释（含 TD-18-3 留下的「文件名变更留痕」+ 39 处历史叙述/当前指引类 `App.jsx` 注释，均属有意保留，非债）。
- 本文件是画布编排中枢：`useAssetDropPaste` / `useNodeData.patchNodeDataById` / `useCanvasSync` / `projectStore` 等均已收口，无裸 `localStorage` / 裸 `kv*` / 裸 `node.data` 直写。

## 二、溯源

App.tsx 在 area 04 的覆盖度表中标注「画布编排段大部分审，未审残留：onNodesChangeForEdges / 初始演示画布 / handleNodeDragStop / viewport 恢复竞态」。本轮按 SOP §3.4 先对全文跑高频形态扫描（静默吞 / 死代码 / 注释漂移 / 绕过唯一入口 / SSOT 第二份），再逐条取证，不重审已深审段落。

## 三、定海 / 切割（无）

## 四、探债

| TD-ID | 决策点 / 问题点 | 归类 | 归属 | 爆炸半径 | 利息率 | 根因 | 偿还计划 | 状态 |
| ----- | --------------- | ---- | ---- | -------- | ------ | ---- | -------- | ---- |
| TD-04-32 | App.tsx:1511 注释「占位按钮 onRun/onClearCache 未传」失实：① `onClearCache` 已于 :1520 传入 `handleClearCache`；② `onRun` 根本不是 `CanvasToolbar` 的属性（接口 `CanvasToolbarProps` :4-21 无此 prop） | 增债 | 结构债 | 单注释行 | 低 | 孤例（注释漂移）：事后给 `CanvasToolbar` 补了 `onClearCache` 接线却未回改 App 侧注释 | 删/改 App.tsx:1511 注释为「仅 onRun 占位（非 CanvasToolbar 属性，待接真系统）」；或确认 onRun 是否真需预留 | 已解决 2026-09-16（回改为现状：onClearCache 已接，无 onRun 属性） |

**非债结论（留痕，防下次重审 / 当 bug 补）**：

| 候选点 | 判定 | 证据 |
| ------ | ---- | ---- |
| App.tsx:304-312 画布加载失败 `.catch` | 非债（有意设计） | `logger.warn('App','项目画布加载失败…')` + `showToast('画布加载失败…',{type:'warning'})` 双重可见；注释明示「但必须可查+可见」，= 防白屏卡死的兜底，**不静默** |
| App.tsx:477 `persistCanvas` save `.catch` | 非债（已记日志） | `.catch((e) => logger.warn('canvas','save-fail',{projectId,error:e?.message}))` 有日志，非「零日志静默吞」；冲突路径另经 `setCanvasConflict` 红条可见（:471）；属「一次性落盘」fire-and-forget，异常记日志合理 |
| App.tsx:325-329 死钩子注释（mutiwindow-task-completed/rerun-task） | 非债（准确留痕） | 注释如实说明旧窗口内事件「只有监听、从未 dispatch」、**未复刻**；全仓 grep `addEventListener('mutiwindow` 仅 `pagehide`（:517），无任何死监听代码；注释＝对「刻意不复刻」的忠实记录 |

## 五、覆盖度表（增量，本轮新纳入 / 状态变化）

| 文件 | 层 | 覆盖状态 | 灯 | 轮次/日期 | 证据(refs/行号) | 债/裁定 |
| ---- | -- | -------- | -- | --------- | --------------- | ------- |
| src/App.tsx（渲染段 / 持久化段 / 死钩子注释） | 上层 | 🟢 已还清(TD-04-32) | 🟢 | 还债 2026-09-16 | :1511 注释已回改为现状（onClearCache 已接 handleClearCache；CanvasToolbar 无 onRun 属性） | TD-04-32 已解决 |
| src/components/base/panels/CanvasToolbar.tsx | 上层 UI | 抽审（欠深审） | ⚪ | 04-App.tsx聚焦审计-2026-09-16 | App.tsx:1512 引用 + 读 props 接口 | 仅验证属性接口，全文件欠深审 |

## 六、结论

App.tsx 整体与其「深审」状态一致（画布编排主体已收口，无绕过唯一入口 / SSOT 第二份类债）。本轮在渲染段发现 **1 笔注释漂移债（TD-04-29）**，并留痕 3 处非债结论（防回潮重审）。`CanvasToolbar.tsx` 仅抽审属性接口，全文件欠一轮深审。

## 七、状态

- 区域 04 总体维持：**已验证(有债待还)**（本次新增 TD-04-29 不改变区状态）。
- 本轮聚焦：`src/App.tsx` 新增 1 债 TD-04-32（注释漂移）＋ 3 非债留痕；`CanvasToolbar.tsx` 标抽审（欠深审，建议另开一轮深审）。
