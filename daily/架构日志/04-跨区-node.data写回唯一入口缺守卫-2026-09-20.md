# 04-跨区-node.data写回唯一入口缺守卫-2026-09-20

## 探债

| ID | 位置 | 债的形态 | 归属 | 爆炸半径 | 利息 | 根因 | 大致解法 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| @见 债务.md | `src/hooks/useNodeData.ts`（node.data 写回唯一入口，24 处 import + 95 处字符串引用）；对照 `src/components/agent/canvas/agentCanvasHost.ts` `updateNodeData`（tests/unit/agentCanvasHost.test.ts:5 自承"写 node.data 有两条入口"） | 唯一入口缺真守卫：node.data 写回仅有注释红线（CLAUDE.md §5.4.9 列"唯一入口"），无运行时/机器守卫，已漂出第二份入口 `agentCanvasHost.updateNodeData`，违反 SSOT | 前端 hooks/useNodeData（画布/生成关键链路） | 所有节点 data 写回（结果写回/重命名/展开/字段编辑/Agent 写回）一旦绕行即双真相、回潮难查 | 中 | 唯一入口只在注释层，无 dev 期断言/守卫拦截直写 `setNodes` data；与 TD-08-38 同源（红线只在注释→必回潮） | 在 node store 写路径加 dev 守卫：node.data 变更必须经 useNodeData 收口（标记/断言拒绝直写），强制 SSOT | 待还 |

## 覆盖度表

| 文件层 | 覆盖状态灯 | 轮次/日期 | 证据 | 债/裁定 |
| --- | --- | --- | --- | --- |
| `src/hooks/useNodeData.ts` | 深审(有债待还) | 04-跨区-node.data写回唯一入口缺守卫-2026-09-20 | refs 24 import + 95 引用 | 唯一入口缺真守卫，已现第二份入口 |
| `src/components/agent/canvas/agentCanvasHost.ts` | 深审(有债待还) | 同上 | updateNodeData（test.ts:5 自承两条入口） | 第二份写回入口（SSOT 违反） |

## 七、状态行

本轮审 2 文件 / 共 2 / 未审 0。
- 新债：node.data 写回唯一入口 useNodeData 仅注释红线、无真守卫，已漂出第二份入口（agentCanvasHost.updateNodeData），目标=运行时守卫强制 SSOT（对标 TD-08-38）。
- 同族已机器化者（check-arch）：storage 深路径(规则8) / projects 键(规则9) / 事件广播(规则10) / 媒体判型(规则11) / 跨源裁决(规则12) / 后端落盘(fileStore) / data.images 写回(规则13)——node.data 全量写回守卫尚未收口。
- 不重复审已守卫项（assetType/filesApi 等），仅登记本缺口。
