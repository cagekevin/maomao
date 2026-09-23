# 19 UI 基础组件层 · 三轮 · GenerateButton「刷新」冗余

> 触发：用户发现视频生成节点（VideoGenerate）底部「刷新」按钮语义不符 —— 点它实际等于「停止」。
> 本轮只探一笔债（聚焦，非整区 sweep）。区域 19 其余文件覆盖状态沿用 `19-UI基础组件层-二轮-TD19-1下拉窄原语-2026-09-13.md`，本轮不重审。

---

## 一、探债

| ID | 位置(文件:行号 / refs) | 债的形态 | 归属(模块) | 爆炸半径 | 利息 | 根因(母体?/孤例) | 大致解法(一句话·可选) | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TD-19-6 | `src/components/canvas/parts/GenerateButton.tsx:27,51-63`（onRefresh 可选 prop + 「刷新状态」按钮）· `src/components/video/nodes/VideoGenerate.tsx:547`（`onRefresh={onStop}`） | UI affordance 标签与行为不符：L0 原语的「刷新状态」按钮在节点层被接到 `onStop`，成为「停止」的贴错标签副本（两者点击均 `abortRef.abort()` + 清 loading），且节点级生成恢复走 `agent:task-completed` 广播自动回填，无手动重查状态入口 → 该按钮实为孤儿/冗余 | 19 UI 基础组件层（原语孤儿 affordance）／@见 04·22 视频节点（唯一消费者） | 仅 VideoGenerate 一个节点可见「刷新」按钮（其它生成节点不传 onRefresh 故不渲染）；不改则长期误导用户「刷新＝停止」 | 中 | 孤例（非母体）：照搬官方 jn.jsx 的 TaskCenter「刷新状态」语义（参考 docs/plan/03-任务ID全链路-2026-08-16.md §4.6），但未在节点级提供对应「重查异步任务状态」处理函数，遂以 onStop 兜底填充；GenerateButton 自 2026-08-15 初始提交即带此按钮、19 区首轮标记「抽审」从未深审（git blame `^e96f6096`） | 业务债·待拍板：A 删 GenerateButton 的 onRefresh/「刷新」按钮（节点级恢复已自动，无手动重查需求）；B 给 VideoGenerate 接真正「重查任务状态」逻辑（复用任务中心 pollOneTask 思路）；C 仅改 label 为「停止」消除误导（最小改动） | 待还 |

### 证据链（自证，可独立复现）
- `GenerateButton.tsx` 定义 `onRefresh?: () => void`（:27），仅在 `loading` 时渲染「刷新状态」按钮（:51-63，title="刷新状态" :54，文案「刷新」 :61）。
- `VideoGenerate.tsx:547` 传 `onRefresh={onStop}`；`onStop` 来自 `useNodeGeneration`（`src/hooks/useNodeGeneration.ts:298`）＝`abortRef.current?.abort()` + `updateNodeRuntime(nodeId,{loading:false})`，与「停止」按钮（同文件 :64-77）点击效果完全相同。
- 全仓唯一消费者：`grep onRefresh src` 仅命中 GenerateButton（定义）与 VideoGenerate（:547）；其余 `onRefreshed` 为资源库刷新、无关。
- 节点级恢复已自动：`useNodeGeneration.ts:318-331` 订阅 `agent:task-completed` 广播回填 `resultUrl`，无需手动重查 → 节点层「刷新」按钮无真实语义落点。
- 起源：`git blame` 两处均 `^e96f6096`（2026-08-15 初始提交，cagekevin），随 1mao 参考代码一并引入，后仅随「域归位」搬移路径（`base/ui` → `canvas/parts`），逻辑未变。

---

## 二、覆盖度表（本轮增量）

| 文件 | 覆盖状态 | 轮次/日期 | 证据(refs/行号) | 债/裁定 |
| --- | --- | --- | --- | --- |
| `src/components/canvas/parts/GenerateButton.tsx` | 有债待还(TD-19-6) | 三轮 2026-09-23 | onRefresh:27／刷新按钮:51-63 | 孤儿 affordance（原 抽审→命中债） |
| `src/components/video/nodes/VideoGenerate.tsx` | 有债待还(TD-19-6) | 三轮 2026-09-23 | :547 onRefresh={onStop} | 接错 handler（同债消费者） |

> 区域 19 其余文件（NodeTitle／ToolbarButton／GeneratingOverlay／ExpandablePanel／VideoThumbnail 等）覆盖状态沿用二轮文件，本轮未动、未重审。

---

## 七、状态行

- 本轮审 2 文件 / 共 2 文件（聚焦本债）/ 未审 0（区域其余文件沿用二轮，不重审）。
- 结论：1 笔业务债（标签＝行为不符的冗余「刷新」按钮），待用户拍板 A/B/C。
- 未改任何 `src/**`／`localTool/**` 代码（只读登记）。
