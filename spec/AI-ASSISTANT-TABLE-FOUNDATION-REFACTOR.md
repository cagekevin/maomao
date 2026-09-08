# AI 助手表格 —— 地基重构计划（`values` 外键 → `cells` 下标）

> **状态：待批准（2026-09-08）**
> 前置：`AI-ASSISTANT-TABLE-INVARIANTS.md`（不变量清单，本文是它的**根治方案**）。
> 一句话：**把格子的身份从「列的 id」改回「位置」。消灭外键，让一类 bug 无法被表示。**

---

## 一、为什么要动地基

### 1.1 病根

```ts
values: Record<colId, string>   // 用「列的身份」索引「格子的值」
```

**格子的本质是 `(行, 列)` 这个位置**，实现却用"列的 id"去索引它 → 制造了一个**外键**：
`values` 的每个 key 都必须引用 `columns` 里存在的 id。

外键 = 需要人工维护的一致性 = bug 温床。

### 1.2 事故复盘（全部是外键问题）

| 事故 | 引用类型 |
| --- | --- |
| `copyTab` 复制出空表 | colId 重映射遗漏 |
| 「假成功」（提示已写入但表空） | `preview.targetTabId` 查不到 |
| 非幂等读（误报目标不存在） | tab id 惰性生成 |
| `selectedRowIds` 悬空 | rowId 外键 |
| `range` 锚点失效 | colId 外键 |

**表格域的复杂度几乎 100% 来自「跨结构的字符串引用」。**

### 1.3 为什么"加护栏"解决不了

已验证的事实：

1. `validateTabs` 装在 `normalizeAssistantTabs` **之后**，而 normalize 会重建 `values`
   （`:125-128` 只按 columns 建键、孤儿键丢弃）→ **I4 永远成立，护栏永远不报警**；
2. 而且这个"自动修复"正是把错误**变成空表**的元凶（copyTab 事故）；
3. 即便报警，也只是 `logger.warn`，**照样落盘**——不拦任何事。

结论：**继续加护栏是无底洞**（地基不稳 → 漏洞越多 → 护栏越多 → 复杂度越高）。

---

## 二、目标模型

```ts
/** 列：id 保留为「主键」（列宽记忆 / 选区锚点），但不再参与值的索引 */
export interface TableColumn {
  id: string;
  label: string;
  width?: number;
}

/** 行：cells 下标 == columns 下标 */
export interface TableRow {
  id: string;
  cells: string[];
}

export interface AssistantTable {
  columns: TableColumn[];
  rows: TableRow[];
}
```

### 唯一核心不变量

> **`row.cells.length === columns.length`**（所有行、恒等）

O(1) 可查，且**违反即意味着代码有 bug**（不是数据脏）。

### 关键决策（先钉死，勿中途摇摆）

| 决策 | 内容 | 理由 |
| --- | --- | --- |
| **D-1** | **列 id 保留** | `useColumnResize` 的 `colWidthMapRef[col.id]` 用它做稳定主键（注释明写"防插入新列时旧列跳变抖动"）；改下标会让列宽记忆整体错位 |
| **D-2** | **行 id 保留** | 选中行要跨"删除其它行"保持稳定（主键，无一致性问题） |
| **D-3** | **值的索引改下标** | 消灭外键，这是本次唯一实质改动 |
| **D-4** | **选区 `range` 仍用 id** | 列删除后锚点应"明确失效"而非"指向别的列"（现有 `rangeToCells` 行为正确） |
| **D-5** | **`normalize` 不再"静默修复"** | 改为：结构合法则原样通过；长度不一致 → 视为脏数据并**显式告警**（不再悄悄清空） |

### 主键 vs 外键（判断标准，供后续新增代码时对照）

- **主键** = 自身身份，**无一致性问题** → 保留（`row.id` / `tab.id` / `col.id`）
- **外键** = 用 id 索引另一个集合的数据，**有一致性问题** → 消灭（本次干掉 `values`）
- 后续**任何**"用 id 当 map key 去索引别处数据"的写法，都应视为危险信号

---

## 三、改动面（已量化）

| 范围 | 数量 | 说明 |
| --- | --- | --- |
| src `values[` 读写 | **30 处 / 5 文件** | `assistantTable.ts`、`TableGrid.tsx`、`AssistantTablePanel.tsx`、`useTableSelection.ts`、`AgentPanel.tsx` |
| 测试文件 | **4 个** | `assistantTable.test.ts`、`assistantTable.memory.test.ts`、`tableInvariants.test.ts`、`tableWorkspaceState.test.ts` |
| 无关误报 | 已排除 | `channelEvaluation/channelWrite/channelContract/ScriptBoxNode` 里的 `values` 是 `Object.values()`，与表格无关 |

### ⭐ 最大安全保障

改掉 `TableRow` 类型后，**所有残留的 `values` 访问都会被 TypeScript 报错**。
这是纯机械替换却能保证不遗漏的根本原因——**编译器就是清单**。

---

## 四、阶段划分

> 每阶段独立提交、独立验收、可单独 revert。

### 阶段 0 · 定稿与清单（0.5 天）

- [ ] 类型定稿（§二），同步 `AI-ASSISTANT-TABLE-INVARIANTS.md` 标注"重构中"
- [ ] 逐函数列出改动清单（`assistantTable.ts` 全部导出函数）
- [ ] 落盘迁移方案定稿（§阶段 2）
- **验收**：清单评审通过，无遗漏函数

### 阶段 1 · 纯函数层（1 天）· 核心

**测试驱动**：先改测试断言 → 跑红 → 再改实现。

- [ ] 改 `TableRow` / 相关类型
- [ ] 改 `assistantTable.ts` 全部函数（`setCell` / `rowToObj` / `rowToText` / `addColumn` /
      `deleteColumn` / `insertColumnAfter` / `buildPreviewResult` / `pasteRows` /
      `copyRowsToTab` / `parsePasted` / `normalizeAssistantTable` …）
- [ ] **重点验证 `copyTab`**：从"建 idMap + 逐行重建 values"退化为**复制数组**
      （这类 bug 从此无法被表达）
- **验收**：`assistantTable*.test.ts` + `tableInvariants.test.ts` 全绿

### 阶段 2 · 落盘与迁移（0.5 天）

- [ ] `normalizeAssistantTable` 兼容旧格式：有 `values` 无 `cells` → 按 `columns` 顺序转换
- [ ] 旧数据迁移测试（构造真实老会话数据，断言读回内容不丢）
- [ ] 按 **D-5** 改 `normalize`：不再静默清空，长度不一致 → 显式告警
- **验收**：老数据可读且内容正确；新数据落盘格式正确

### 阶段 3 · UI 层（1 天）

- [ ] `TableGrid.tsx`（渲染 `row.cells[ci]`）
- [ ] `AssistantTablePanel.tsx`、`useTableSelection.ts`、`useTableDrafts.ts`、`AgentPanel.tsx`
- [ ] 列宽逻辑**保持用 `col.id`**（D-1，不动）
- **验收**：全量 2350 测试绿 + 手工冒烟清单：
  - 增删列 / 插入列 / 改列名
  - 复制标签页（**重点：内容必须完整**）
  - 跨表复制行、粘贴
  - AI 建表 / 改行 / 预览确认写回
  - 列宽拖拽 + 刷新后保持

### 阶段 4 · 护栏瘦身（0.5 天）· 净减少复杂度

重构后这些不变量**不可能再被违反**，对应校验应删除：

| 删除 | 原因 |
| --- | --- |
| I4（缺键 / 孤儿键） | 没有键了 |
| I2 / I3 部分 | 结构与之一致 |
| `copyTab` 的 `idMap` 重映射 | 复制数组即可 |
| S2 同名列的部分兜底 | 重新评估是否仍需 |

**保留**：
- 长度不变量 `cells.length === columns.length`（O(1)，新增）
- tab 引用检查（P1 / T4 / I5）
- S1 空列名、S6/T1 tabs ≥ 1

**重新评估**：`materializeAssistantTabs` 是否仍必要（本次可能让它变得多余，待阶段 1 后判断）。

- **验收**：**净删除行数 > 净新增行数**（这是"地基变稳"的硬指标）

### 阶段 5 · 性质测试（0.5 天，建议）

- [ ] 随机操作序列（加列 / 删列 / 复制表 / 粘贴 / AI 写入 / 撤销重做）× N 次
- [ ] 每步断言 `cells.length === columns.length` 恒成立
- [ ] 作为长期护栏，替代大部分静态校验

---

## 五、风险与对策

| 风险 | 等级 | 对策 |
| --- | --- | --- |
| 落盘格式变更影响老用户 | 中 | 阶段 2 兼容层 + 真实老数据迁移测试 |
| UI 层视觉回归 | 中 | 阶段 3 手工冒烟清单（列宽、行高、选区） |
| 漏改某处 `values` | **低** | **TypeScript 编译即报错**（最大保障） |
| 测试大面积改动 | 中 | 测试驱动，先改测试看红，逐个收敛 |
| 中途发现遗漏设计点 | 中 | 阶段 0 先出完整函数清单；每阶段可 revert |

---

## 六、成功标准

- [ ] 全量 **2350 测试**绿
- [ ] 代码中 `values` 消失（grep 为 0）
- [ ] 不变量从 **35 条 → ≤ 10 条**
- [ ] **净删除代码行数 > 净新增**（护栏瘦身达标）
- [ ] `copyTab` 实现退化为数组复制（无 idMap）
- [ ] 新增"长度不变量"检查，O(1)

---

## 七、为什么现在做

表格是长期承载功能的基础设施。**地基不稳时，每加一个功能都在给外键债务付利息**——
`copyTab` 式的 bug 会在每个"批量构造行"的新功能里重演一次（附件列、TableCardNode、未来的导入导出……）。

现在回过头把地基做实，后续增加复杂度才没有负担。

---

## 八、与既有工作的关系

| 既有产物 | 处置 |
| --- | --- |
| `tableIds.ts`（id 生成收口） | **保留**（列 id 仍存在，D-1） |
| `tableInvariants.ts` | **阶段 4 大幅瘦身**，保留 tab 引用与长度检查 |
| `materializeAssistantTabs` | 阶段 1 后重新评估，可能可简化 |
| 单一入口 `useActiveAssistantTable` | **保留**（减少重复本身是对的） |
| `AI-ASSISTANT-TABLE-INVARIANTS.md` | 重构后按新模型**重写**不变量清单 |
