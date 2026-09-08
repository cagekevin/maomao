/**
 * 表格工作区运行态共享类型（中立模块，assistantTable 域内）。
 *
 * 把工作区运行态的形状（TableWorkspaceState 及其组成类型）抽到独立模块，
 * 避免 tableInvariants / tableWorkspaceState 之间为复用单个类型而互相反向依赖成环。
 * 各方都从这里 import；tableWorkspaceState.ts 负责 re-export 维持对外兼容。
 */
import type { AssistantTableJson, CellRange, TableColumn, TableRow } from './assistantTable.ts';

/**
 * 待确认预览（预览=确认，C5）：acceptTablePreview 时已把「操作后最终表格」算好存入，
 * 预览卡直接渲染 resultRows/resultCols，确认只原样写回——不做第二次推导。
 */
export interface TableWorkspacePreview {
  json: AssistantTableJson;
  messageId: unknown;
  /** 发消息/探测那一刻冻结的选中（含多选）；仅留痕，写回不依赖它 */
  selectedRowIds: string[];
  /** 预览要写入的目标 tab id（spec 3.3；默认 = 探测时的活动 tab；确认只原样写回该表） */
  targetTabId: string;
  /** 操作后「最终的全部行」（= 确认结果） */
  resultRows: TableRow[];
  /** 操作后列（保留原列 id/宽度，新增列才追加） */
  resultCols: TableColumn[];
  opKind: 'update' | 'append' | 'replace';
  /** update 场景：实际被更新的行数（预览卡文案用） */
  updatedCount: number;
  /** update 且 AI 行多于选中行 / append 场景：追加行数（预览卡文案用） */
  appendedCount: number;
  /** 「确认后会写回变化」的行 id（buildPreviewResult 产出），供预览卡据此展开变化行、折叠未变行 */
  changedRowIds: string[];
}

/**
 * 内部剪贴板（spec 3.6 + interaction-model §1.4）：**仅内存、不落盘**，供系统剪贴板不可用/表格内语义回退。
 * - `rows`：整行复制（cells 数组，按下标对齐当前列序），粘贴时从锚点行之后等长写入；
 * - `range`：矩形区域复制（二维 cells），粘贴时从锚点格按矩形铺开，越界裁剪不扩列；
 * - `cell`：单格文本（业界单格复制），粘贴时覆盖锚点格。
 * （2026-09-08 重构：rows 由「列 id → 值」对象改为 cells 数组，消灭外键；colIds 已删，无消费。）
 */
export type TableClipboard =
  | { kind: 'rows'; rows: string[][] }
  | { kind: 'range'; cells: string[][] }
  | { kind: 'cell'; text: string };

/** 共享「表格工作区运行态」形状（spec §四.5.1 + §1.5） */
export interface TableWorkspaceState {
  /** 表格工作区开合（左面板滑出 = 表格协作激活） */
  open: boolean;
  /** 左面板宽（px，clamp 360~1080，localStorage agent_split_width） */
  width: number;
  /** 选中行集合（多选，唯一意图信号；AI 注入读 / 预览写回判定读；空数组 = 未选中） */
  selectedRowIds: string[];
  /** 待确认预览（AI 返回表格 JSON → 探测命中置位；确认/取消清空） */
  preview: TableWorkspacePreview | null;
  /** 探测游标（原 AgentPanel tbPreviewHandledRef：最后一条已处理过的消息 id） */
  handledMessageId: unknown;
  /** 预览卡高度（px，仅内存、不落盘；null = 用 CSS 默认 clamp）spec 3.2 */
  previewHeight: number | null;
  /** 内部剪贴板（仅内存，spec 3.6） */
  clipboard: TableClipboard | null;
  /** 单元格矩形选区（仅内存，spec 3.6；null = 无选区） */
  range: CellRange | null;
  /** 当前聚焦的单格（业界"当前格"，spec interaction-model §3.1）。单击格设置，方向键移动的载体、复制/粘贴默认锚点 */
  focusedCell: { rowId: string; colId: string } | null;
  /** 当前正在编辑的格（整表唯一，业界模型）。双击格设置；提交/取消/Esc 清空；null = 全表选中态 */
  editingCell: { rowId: string; colId: string } | null;
}
