/**
 * `expanded` 缺省值唯一真源（2026-11-06 · C8 收口）。
 *
 * 【为什么立这个模块】「节点 data.expanded 未设置时算展开还是折叠」此前有三处各写一份：
 *   ① `useNodeExpanded.ts`（输入面板族 hook）`dataExpanded === undefined ? true`；
 *   ② `src/App.tsx` Tab 一键折叠 `(n.data?.['expanded'] ?? true)`；
 *   ③ `ImageBoxNode.tsx` `data.expanded ?? false`（图盒族）。
 * 缺省值属**判据**（缺字段时怎么解释），判据重复必漂移（ADR-0031）——某天改「默认展开」
 * 为「默认折叠」时漏一处，Tab 一键折叠与节点自身初值就会打架。
 *
 * 【两个语义族（刻意不同值，勿合并成一个常量）】
 *  - **输入面板族**（textGenerate/imageGenerate/videoGenerate 三类生成节点 + TemplateNode 蓝本）：
 *    未设置 = **展开**。理由：生成节点的核心交互是改提示词，新建时面板必须露出来；
 *    新建路径由 `nodeDataSchema.defaultNodeData` 对 INPUT_PANEL_NODE_TYPES **显式注入 false**
 *    （折叠新建是产品行为），所以 `undefined` 只出现在**存量旧节点**上——旧数据没有这个字段，
 *    按「展开」解释才能还原历史渲染。
 *  - **图盒族**（imageBoxNode）：未设置 = **折叠**。理由：图盒默认态就是紧凑网格，展开是临时态；
 *    新建路径 `NODE_DATA_DEFAULTS.imageBoxNode` 已显式登记 `expanded:false`，undefined 同样只
 *    出现在存量旧节点上，按「折叠」解释与其登记默认一致。
 *
 * 【用法】读侧一律 `data.expanded ?? EXPANDED_DEFAULT.inputPanel`（或 `.imageBox`），
 * 禁止再手写 `?? true` / `=== undefined ? true` / `?? false` 字面量。
 */
export const EXPANDED_DEFAULT = {
  /** 输入面板族：未设置 = 展开（生成节点核心交互是提示词，新建时面板须露出）。 */
  inputPanel: true,
  /** 图盒族：未设置 = 折叠（紧凑网格是默认态）。 */
  imageBox: false,
} as const;
