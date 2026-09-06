/**
 * AI 助手表格 —— 左栏表格工作区组件（UI 薄壳 + 组合子组件，2026-09-06 拆分）。
 *
 * 形态：普通 HTML 表格，活在 AI 面板左栏，与画布完全解耦。数据真相源 = 会话记忆 memory.assistantTable；
 * globalStyle 复用 memory.global_contract.unified_style_prompt。自读自写（conversationStore 原子订阅 + setCurrent* 写回）。
 *
 * 【拆分结构】（从原 777 行"上帝组件"拆出，各层单一职责，见 spec/AI-ASSISTANT-TABLE-UI-FOUNDATION.md）：
 *   - 本文件：薄壳 —— 数据订阅 + 剪贴板/清空/落画布 + 空态 + 工具条 + 预览卡装配；
 *   - TableGrid.tsx：表格主体纯渲染（表头/行/格/行号/操作列），cells()/ops() 随迁；
 *   - CellEditor.tsx：单格 textarea（自动撑高）；
 *   - useColumnResize.ts：列宽估算 + 拖拽 hook（命令式改 DOM、松手 commit，保留性能设计）；
 *   - useTableDrafts.ts：edits/colRenameDraft/styleDraft 三份散落 state 收口；
 *   - icons.tsx：统一图标表（消灭重复 inline SVG）；
 *   - assistant-table.css：表格域样式自持（.atw* 语义类名，不依赖祖先 .tw-panel）。
 *
 * 关键交互（定稿 §1.3/§1.4 + 实施 §1.5）：
 *  - 点选行：选中态全库只存共享态 selectedRowIds（C1）；普通点击=单选/取消，Cmd/Ctrl=多选；删除行同步移除。
 *  - 复制整表=TSV+HTML 双格式；清空走 askConfirm；行「发送到画布」→ rowToText → onSendToCanvas。
 *  - AI 生成整表/改行/追加：watch 消息解析「表格 JSON」→ 顶部渲染预览卡；确认才写回（预览=确认），取消不动。
 */

import { useCallback, type MouseEvent as ReactMouseEvent } from 'react';
import {
  setCurrentAssistantTable,
  getCurrentGlobalContract,
  setCurrentGlobalContract,
} from '../conversation/conversationStore.ts';
import {
  parsePasted,
  addRow,
  deleteRow,
  moveRow,
  duplicateRow,
  rowToText,
  insertColumnAfter,
  deleteColumn,
} from './assistantTable.ts';
import type { AssistantTable, TableRow, AssistantTablePreview } from './assistantTable.ts';
import { showToast } from '@/components/base/core/toastStore.ts';
import { askConfirm } from '@/components/base/core/confirmStore.ts';
import { useTableWorkspace, setTableWorkspaceRows } from './tableWorkspaceState.ts';
import { useActiveAssistantTable } from './useActiveAssistantTable.ts';
import { useTableDrafts } from './useTableDrafts.ts';
import { useColumnResize } from './useColumnResize.ts';
import TableGrid from './TableGrid.tsx';
import Icon from './icons.tsx';
import AssistantTablePreviewCard from './AssistantTablePreviewCard.tsx';
import './assistant-table.css';

/** 写全局风格（复用到 memory.global_contract.unified_style_prompt；缺另两字段时补空串对齐 GlobalContractShape） */
function writeGlobalStyle(style: string): void {
  const cur = getCurrentGlobalContract();
  const next = cur
    ? { ...cur, unified_style_prompt: style }
    : {
        visual_positioning: '',
        unified_style_prompt: style,
        unified_negative_prompt: '',
      };
  setCurrentGlobalContract(next);
}

/** 面板外部注入：回调与左栏宽度 */
export interface AssistantTablePanelProps {
  /** 左栏固定宽度（px）（父级分栏拖拽决定） */
  width?: number;
  /** AI 表格预览当前是否存在（待确认写回）。存在且空表时左栏空态提示「等你在右侧确认后写入」 */
  previewing?: boolean;
  /** 某行 → 发送到画布（AgentPanel 传 sendContentToCanvas，内部 rowToText 拼好文字） */
  onSendToCanvas?: (text: string) => void;
  /** 【待确认预览卡（收进左栏表格下方）】AI 返回表格 JSON → AgentPanel 解析出的「待确认预览模型」。 */
  preview?: AssistantTablePreview | null;
  /** 是否正在发送（发送中禁用确认按钮） */
  sending?: boolean;
  /** 确认：AgentPanel 把 AI 新内容写回正式表格（整表 replace / 单行 merge） */
  onConfirmPreview?: () => void;
  /** 取消：放弃本次预览，正式表格不动 */
  onCancelPreview?: () => void;
}

export default function AssistantTablePanel({
  width = 460,
  previewing = false,
  onSendToCanvas,
  preview = null,
  sending = false,
  onConfirmPreview,
  onCancelPreview,
}: AssistantTablePanelProps) {
  // 选中态唯一信号（C1）：普通点击=单选/取消，Cmd/Ctrl=多选 toggle
  const { selectedRowIds } = useTableWorkspace();

  // ── 响应式读 store（会话表格 + 全局风格，订阅逻辑收口于 hook） ──
  const { activeConversationId, table: tableData, globalStyle } = useActiveAssistantTable();

  /** 唯一写回入口 */
  const commit = (sb: AssistantTable) => {
    setCurrentAssistantTable(sb);
  };

  // 列宽策略/拖拽 + 本地编辑草稿（两处散落逻辑已收口为可测 hook）
  const { colWidths, colElsRef, startResize, resizeTick } = useColumnResize(tableData, commit);
  const {
    cellValue,
    setCellDraft,
    commitCell,
    colRename,
    setColRename,
    commitColRename,
    styleDraft,
    setStyleDraft,
  } = useTableDrafts(tableData, globalStyle, activeConversationId, commit);

  const handlePaste = async () => {
    let text = '';
    let html = '';
    try {
      if (navigator.clipboard && typeof navigator.clipboard.read === 'function') {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          for (const type of item.types) {
            if (type === 'text/plain' && !text) text = await _readType(item, type);
            else if (type === 'text/html' && !html) html = await _readType(item, type);
          }
        }
      }
    } catch {
      /* read() 可能缺权限，回退 readText */
    }
    try {
      if (!text) text = await navigator.clipboard.readText();
    } catch {
      /* 权限被拒 */
    }
    const sb = parsePasted(text, html);
    if (!sb) {
      showToast?.('未识别到表格内容（首行为列名，行用 Tab 分隔）', { type: 'error' });
      return;
    }
    commit(sb);
    showToast?.(`已粘贴表格 · ${sb.rows.length} 行`, { type: 'success' });
  };
  async function _readType(item: ClipboardItem, type: string): Promise<string> {
    const blob = await item.getType(type);
    return await blob.text();
  }

  // 复制整表为表格：一次写两种格式 —— TSV（Excel/Sheets/Word 粘上成表）+ HTML <table>
  const handleCopyTable = useCallback(async () => {
    if (!tableData.columns.length) {
      showToast?.('表格还没有列，无法复制', { type: 'error' });
      return;
    }
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const cols = tableData.columns;
    const header = cols.map((c) => c.label).join('\t');
    const bodyRows = tableData.rows
      .map((r) => cols.map((c) => (r.values[c.id] ?? '').replace(/\t/g, ' ')).join('\t'))
      .join('\n');
    const tsv = bodyRows ? `${header}\n${bodyRows}` : header;
    const html =
      '<table border="1" cellspacing="0" cellpadding="4"><thead><tr>' +
      cols.map((c) => `<th>${esc(c.label)}</th>`).join('') +
      '</tr></thead><tbody>' +
      tableData.rows
        .map(
          (r) =>
            '<tr>' + cols.map((c) => `<td>${esc(r.values[c.id] ?? '')}</td>`).join('') + '</tr>',
        )
        .join('') +
      '</tbody></table>';
    try {
      if (
        navigator.clipboard &&
        'write' in navigator.clipboard &&
        typeof ClipboardItem !== 'undefined'
      ) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/plain': new Blob([tsv], { type: 'text/plain' }),
            'text/html': new Blob([html], { type: 'text/html' }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(tsv);
      }
      showToast?.(`已复制表格 · ${tableData.rows.length} 行 ${cols.length} 列`, {
        type: 'success',
      });
    } catch {
      showToast?.('复制失败（浏览器可能限制了剪贴板权限）', { type: 'error' });
    }
  }, [tableData]);

  // 清空表格：复用全局 askConfirm（danger 红样式），确认后才清空
  const handleClearTable = useCallback(async () => {
    const ok = await askConfirm({
      title: '清空表格？',
      message: '所有行和列都会被删除，且无法撤销。',
      confirmText: '清空',
      danger: true,
    });
    if (!ok) return;
    commit({ columns: [], rows: [] });
    showToast?.('已清空表格', { type: 'success' });
  }, [commit]);

  const handleStyleCommit = () => {
    const next = styleDraft.trim();
    if (next !== globalStyle) writeGlobalStyle(next);
  };

  /** 行操作组（复制/上移/下移/删除/发送到画布）——闭包沿用原逻辑，随 renderRowOps 传给 TableGrid */
  const ops = (row: TableRow) => {
    const apply = (fn: (sb_: AssistantTable) => AssistantTable) => {
      const next = fn(tableData);
      if (next !== tableData) commit(next);
    };
    return (
      <div className="ops" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="atw-icobtn"
          title="复制该行"
          onClick={() => {
            apply((s) => duplicateRow(s, row.id));
            showToast?.('已复制到下一行');
          }}
        >
          <Icon name="copy" />
        </button>
        <button
          type="button"
          className="atw-icobtn"
          title="上移"
          onClick={() => apply((s) => moveRow(s, row.id, 'up'))}
        >
          <Icon name="chevron-up" />
        </button>
        <button
          type="button"
          className="atw-icobtn"
          title="下移"
          onClick={() => apply((s) => moveRow(s, row.id, 'down'))}
        >
          <Icon name="chevron-down" />
        </button>
        <button
          type="button"
          className="atw-icobtn"
          title="删除"
          onClick={() => {
            apply((s) => deleteRow(s, row.id));
            if (selectedRowIds.includes(row.id)) {
              setTableWorkspaceRows(selectedRowIds.filter((id) => id !== row.id));
            }
          }}
        >
          <Icon name="trash" />
        </button>
        <button
          type="button"
          className="atw-icobtn"
          title="发送到画布去生图"
          onClick={() => {
            const t = rowToText(tableData, row, globalStyle);
            onSendToCanvas?.(t);
            showToast?.('已发送到画布（建成文本节点）');
          }}
        >
          <Icon name="send" />
        </button>
      </div>
    );
  };

  /** 点选行（唯一意图信号，C1）：普通点击=单选/再点取消；Cmd/Ctrl+点击=累加/取消多选 */
  const onClickRow = (e: ReactMouseEvent, row: TableRow) => {
    const multi = e.metaKey || e.ctrlKey;
    let next: string[];
    if (multi) {
      next = selectedRowIds.includes(row.id)
        ? selectedRowIds.filter((id) => id !== row.id)
        : [...selectedRowIds, row.id];
    } else {
      next = selectedRowIds.length === 1 && selectedRowIds[0] === row.id ? [] : [row.id];
    }
    setTableWorkspaceRows(next);
  };

  const hasData = tableData.columns.length > 0;

  return (
    <section className="atw" style={{ width }}>
      <div className="atw-head">
        {/* 顶部单行：全局风格 +（正式页）行数 / 新增一行；粘贴入口仅见于空态下方 */}
        <div className="atw-toolbar">
          <div className="atw-style">
            <span className="atw-style-label">
              <Icon name="globe" size={11} />
              全局
            </span>
            <input
              className={`atw-style-input ${styleDraft ? '' : 'is-ph'}`}
              value={styleDraft}
              placeholder="未设置（AI 会自行补一个）"
              onChange={(e) => setStyleDraft(e.target.value)}
              onBlur={handleStyleCommit}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
              }}
            />
            <Icon className="pen" name="edit" size={12} />
          </div>

          {hasData && <span className="cnt">{tableData.rows.length} 行</span>}
          {hasData && (
            <>
              <button
                type="button"
                className="atw-icobtn"
                title="新增一行"
                onClick={() => {
                  commit(addRow(tableData));
                  showToast?.('已新增一行（点格子填内容）');
                }}
              >
                <Icon name="plus" />
              </button>
              <button
                type="button"
                className="atw-icobtn"
                title="复制为表格（粘到 Excel/Word/Notion 等仍是表格）"
                onClick={handleCopyTable}
              >
                <Icon name="copy" />
              </button>
              <button
                type="button"
                className="atw-icobtn"
                title="清空表格"
                onClick={handleClearTable}
              >
                <Icon name="trash-clear" />
              </button>
            </>
          )}
        </div>
      </div>

      {!hasData ? (
        <div className="atw-empty">
          <div className="mark">
            <Icon name="table" size={18} strokeWidth={1.8} />
          </div>
          <h4>{previewing ? '等你在右侧确认后写入' : '还没有表格'}</h4>
          <p>
            {previewing
              ? '预览不改正式表 —— 确认才是唯一写回闸口'
              : '粘贴一段带表头的文字（首行=列名），或在右侧对话里描述需求让 AI 设计表头并填充'}
          </p>
          {previewing ? null : (
            <div className="acts">
              <button type="button" className="tb" onClick={handlePaste}>
                粘贴表格
              </button>
            </div>
          )}
        </div>
      ) : (
        <TableGrid
          table={tableData}
          selectedRowIds={selectedRowIds}
          colWidths={colWidths}
          colElsRef={colElsRef}
          resizeTick={resizeTick}
          cellValue={cellValue}
          onCellChange={setCellDraft}
          onCellCommit={commitCell}
          onRowClick={onClickRow}
          colRename={colRename}
          onColRenameChange={setColRename}
          onColRenameCommit={commitColRename}
          onInsertColumnAfter={(colId) => {
            commit(insertColumnAfter(tableData, colId));
            showToast?.('已插入一列（点表头可改名）');
          }}
          onDeleteColumn={(colId) => {
            commit(deleteColumn(tableData, colId));
            showToast?.('已删除列');
          }}
          onStartResize={startResize}
          renderRowOps={ops}
        />
      )}

      {/* 【待确认预览卡 · 正式表格下方】AI 返回表格 JSON → 解析成预览模型后，在左栏正式表格
          下方渲染预览卡（与正式表格同宽、上下贴邻）。确认/取消由上层 AgentPanel 真正写回；
          确认/取消后本块卸载、消息流原位显示 pv-done 历史痕迹。 */}
      {preview && (
        <div className="atw-preview">
          <AssistantTablePreviewCard
            preview={preview}
            sending={sending}
            onConfirm={onConfirmPreview ?? (() => {})}
            onCancel={onCancelPreview ?? (() => {})}
          />
        </div>
      )}
    </section>
  );
}
