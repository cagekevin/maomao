/**
 * AI 助手表格 —— 左栏表格工作区组件（UI 薄壳 + 交互逻辑）。
 *
 * 形态：普通 HTML 表格，活在 AgentPanel 左栏，与画布完全解耦（不占画布、不用画布节点机制）。
 * 数据真相源 = 当前对话会话记忆 memory.assistantTable；globalStyle 复用 memory.global_contract.unified_style_prompt。
 * 本组件自读自写（经 conversationStore 原子订阅 + setCurrentAssistantTable/setCurrentGlobalContract 写回），
 * 渲染 跟随 mockup：全局风格条(.gs) → 工具条(.sb-tools) → 表体(.sbt 表头吸顶/表体滚动)，均可编辑 + 行操作。
 *
 * 关键交互（对应定稿 §1.3/§1.4 + 实施 §1.5）：
 *  - 粘贴：显式「粘贴表格」入口读取剪贴板 → parsePasted(TSV/HTML) → 首行表头，写回表格。
 *  - 点选行：选中态全库只存共享态 selectedRowIds（唯一意图信号，C1）；普通点击=单选/取消，
 *    Cmd/Ctrl+点击=累加/取消多选；删除行时同步从选中集合移除。
 *  - AI 生成整表 / 改行 / 追加：watch 最后一条 assistant 消息 → 解析「表格 JSON」→ 本组件顶部渲染预览卡 .pv
 *    → 确认才写回（预览=确认：写回的就是预览所见，见 tableWorkspaceState），取消则表格不动。
 *  - 落画布：行操作「发送到画布」→ rowToText → onSendToCanvas（复用 sendContentToCanvas）。
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { subscribe, getState } from '../conversation/conversationState.ts';
import { useStoreSelector, shallowEqual } from '@/hooks/useStoreSelector.ts';
import {
  setCurrentAssistantTable,
  getCurrentGlobalContract,
  setCurrentGlobalContract,
} from '../conversation/conversationStore.ts';
import {
  normalizeAssistantTable,
  parsePasted,
  addRow,
  deleteRow,
  moveRow,
  duplicateRow,
  setCell,
  rowToText,
  renameColumn,
  insertColumnAfter,
  deleteColumn,
  setColumnWidth,
  estimateColumnWidth,
} from './assistantTable.ts';
import type { AssistantTable, TableRow, AssistantTablePreview } from './assistantTable.ts';
import { showToast } from '@/components/base/core/toastStore.ts';
import { askConfirm } from '@/components/base/core/confirmStore.ts';
import { useTableWorkspace, setTableWorkspaceRows } from './tableWorkspaceState.ts';
import AssistantTablePreviewCard from './AssistantTablePreviewCard.tsx';
import '../../panels/agent-panel.css';

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
  /** 【待确认预览卡（收进左栏表格下方）2026-09-06】AI 返回表格 JSON → AgentPanel 解析出的「待确认预览模型」。
   *  非 null 时在本左栏、正式表格下方渲染预览卡（与正式表格同宽、上下贴邻），替代原先横跨整个
   *  面板宽度的全屏 dock。确认/取消由 AgentPanel 执行真正写回（onConfirmPreview/onCancelPreview）。 */
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
  // 选中态唯一信号（C1）：共享态 selectedRowIds（普通点击=单选/取消，Cmd/Ctrl=多选 toggle）
  const { selectedRowIds } = useTableWorkspace();
  // ── 响应式读 store ──
  const activeConversationId = useStoreSelector(
    subscribe,
    getState,
    (s) => s.activeId || '',
    shallowEqual,
  );
  const rawTable = useStoreSelector(
    subscribe,
    getState,
    (s) => {
      const c = (s.conversations || []).find((x) => x.id === s.activeId);
      return c?.memory?.assistantTable ?? null;
    },
    shallowEqual,
  );
  const rawGc = useStoreSelector(
    subscribe,
    getState,
    (s) => {
      const c = (s.conversations || []).find((x) => x.id === s.activeId);
      return c?.memory?.global_contract ?? null;
    },
    shallowEqual,
  );
  const storyboard = useMemo<AssistantTable>(() => normalizeAssistantTable(rawTable), [rawTable]);
  const globalStyle =
    rawGc && typeof rawGc === 'object' && 'unified_style_prompt' in rawGc
      ? String((rawGc as Record<string, unknown>).unified_style_prompt ?? '').trim()
      : '';

  // ── 本地编辑态 ──
  const [edits, setEdits] = useState<Record<string, string>>({}); // `${rowId}:${colId}` → draft
  const [colRenameDraft, setColRenameDraft] = useState<Record<string, string>>({}); // colId → 列名 draft
  const [styleDraft, setStyleDraft] = useState(globalStyle);

  // 切对话 → 重置本地编辑草稿（避免跨对话串表；选中态由共享态 resetTableWorkspace 清，勿另持副本）。
  // AI 表格预览已上移到 AgentPanel 对话流内处理
  useEffect(() => {
    setEdits({});
    setColRenameDraft({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId]);

  // 全局风格外部变化 → 同步草稿（仅当外部值变化，用户在输入时不被覆盖因 typing 不改 rawGc）
  useEffect(() => {
    setStyleDraft(globalStyle);
  }, [globalStyle]);

  const commit = (sb: AssistantTable) => {
    setCurrentAssistantTable(sb);
  };

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
      showToast?.('未识别到表格内容（首行为列名，行用 Tab 分隔）', {
        type: 'error',
      });
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
  // （Word/Notion/飞书等富文本粘上保留网格）。无 HTML 权限时回退纯 TSV，仍是表格。
  const handleCopyTable = useCallback(async () => {
    if (!storyboard.columns.length) {
      showToast?.('表格还没有列，无法复制', { type: 'error' });
      return;
    }
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const cols = storyboard.columns;
    const header = cols.map((c) => c.label).join('\t');
    const bodyRows = storyboard.rows
      .map((r) => cols.map((c) => (r.values[c.id] ?? '').replace(/\t/g, ' ')).join('\t'))
      .join('\n');
    const tsv = bodyRows ? `${header}\n${bodyRows}` : header;
    const html =
      '<table border="1" cellspacing="0" cellpadding="4"><thead><tr>' +
      cols.map((c) => `<th>${esc(c.label)}</th>`).join('') +
      '</tr></thead><tbody>' +
      storyboard.rows
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
      showToast?.(`已复制表格 · ${storyboard.rows.length} 行 ${cols.length} 列`, {
        type: 'success',
      });
    } catch {
      showToast?.('复制失败（浏览器可能限制了剪贴板权限）', { type: 'error' });
    }
  }, [storyboard]);

  // 清空表格：复用全局 askConfirm（即删除会话同款确认弹窗，danger 红样式），确认后才清空。
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

  // ── 行操作 ──
  const ops = (row: TableRow) => {
    const apply = (fn: (sb_: AssistantTable) => AssistantTable) => {
      const next = fn(storyboard);
      if (next !== storyboard) commit(next);
    };
    return (
      <div className="ops" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="tw-op"
          title="复制该行"
          onClick={() => {
            apply((s) => duplicateRow(s, row.id));
            showToast?.('已复制到下一行');
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>
        <button
          type="button"
          className="tw-op"
          title="上移"
          onClick={() => apply((s) => moveRow(s, row.id, 'up'))}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>
        <button
          type="button"
          className="tw-op"
          title="下移"
          onClick={() => apply((s) => moveRow(s, row.id, 'down'))}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        <button
          type="button"
          className="tw-op"
          title="删除"
          onClick={() => {
            apply((s) => deleteRow(s, row.id));
            if (selectedRowIds.includes(row.id)) {
              setTableWorkspaceRows(selectedRowIds.filter((id) => id !== row.id));
            }
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
        <button
          type="button"
          className="tw-op"
          title="发送到画布去生图"
          onClick={() => {
            const t = rowToText(storyboard, row);
            onSendToCanvas?.(t);
            showToast?.('已发送到画布（建成文本节点）');
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
      </div>
    );
  };

  const cells = (row: TableRow) =>
    storyboard.columns.map((col) => {
      const key = `${row.id}:${col.id}`;
      const value = key in edits ? edits[key] : (row.values[col.id] ?? '');
      const commitCell = () => {
        const next = setCell(storyboard, row.id, col.id, value);
        if (next !== storyboard) commit(next);
        setEdits((prev) => {
          if (!(key in prev)) return prev;
          const n = { ...prev };
          delete n[key];
          return n;
        });
      };
      return (
        <td key={col.id}>
          <CellEditor
            value={value}
            onChange={(v) => setEdits((prev) => ({ ...prev, [key]: v }))}
            onCommit={commitCell}
          />
        </td>
      );
    });

  /** 点选行（唯一意图信号，C1）：普通点击=单选/再点取消；Cmd/Ctrl+点击=累加/取消多选。
   *  只写共享态 setTableWorkspaceRows，高亮/注入/写回全部读同一份（B-004 双源归一）。 */
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

  // 列宽策略（性能优先 + 可选拖拽，无副作用）：
  //  - 估算值只在「列结构（id 集合）变化」时计算一次（建表/增删列），按内容给舒适宽；
  //    编辑单元格内容**不**触发重算 → 不抖动、不重渲染。
  //  - 用户拖拽写回 col.width（持久化到会话记忆），优先于估算。
  const COL_W_MIN = 60;
  const COL_W_MAX = 600;
  const colWidthMapRef = useRef<Record<string, number>>({});
  const colSigRef = useRef<string>('');
  const colSig = storyboard.columns.map((c) => c.id).join('|');
  const colWidths = useMemo(() => {
    if (colSigRef.current !== colSig) {
      const next: Record<string, number> = {};
      for (const col of storyboard.columns) {
        if (col.width != null && Number.isFinite(col.width)) {
          // 已手动锁定 → 用锁定值（clamp 合法范围）
          next[col.id] = Math.max(COL_W_MIN, Math.min(COL_W_MAX, col.width));
        } else if (colWidthMapRef.current[col.id] !== undefined) {
          // 已有估算记忆 → 沿用（防「插入新列」时旧列跳变抖动）
          next[col.id] = colWidthMapRef.current[col.id];
        } else {
          // 新列 → 按内容估算一次
          next[col.id] = estimateColumnWidth(col.label, storyboard.rows, col.id);
        }
      }
      colWidthMapRef.current = next;
      colSigRef.current = colSig;
    }
    return colWidthMapRef.current;
    // storyboard 进依赖只为首帧拿到最新内容；sig 不变时直接返回 ref，开销 O(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colSig, storyboard]);

  // 列宽拖拽：拖拽中只直接改 <col> DOM + 更新 ref（不 setState → 整表不重渲），松手才 commit 一次。
  const colElsRef = useRef<Array<HTMLTableColElement | null>>([]);
  const resizingRef = useRef<{
    colId: string;
    ci: number;
    startX: number;
    startW: number;
    handleEl: HTMLElement;
  } | null>(null);
  const storyboardRef = useRef(storyboard);
  storyboardRef.current = storyboard;

  const onResizeMove = useCallback((e: PointerEvent) => {
    const r = resizingRef.current;
    if (!r) return;
    const w = Math.max(COL_W_MIN, r.startW + (e.clientX - r.startX));
    const el = colElsRef.current[r.ci];
    if (el) el.style.width = `${w}px`;
    colWidthMapRef.current = { ...colWidthMapRef.current, [r.colId]: w };
  }, []);
  const onResizeUp = useCallback(() => {
    const r = resizingRef.current;
    if (!r) return;
    window.removeEventListener('pointermove', onResizeMove);
    window.removeEventListener('pointerup', onResizeUp);
    document.body.style.userSelect = '';
    resizingRef.current = null;
    r.handleEl.classList.remove('active');
    const w = colWidthMapRef.current[r.colId];
    if (Number.isFinite(w) && w !== r.startW) {
      commit(setColumnWidth(storyboardRef.current, r.colId, w));
    }
  }, [onResizeMove, commit]);
  const startResize = useCallback(
    (e: ReactPointerEvent, colId: string, ci: number) => {
      e.preventDefault();
      e.stopPropagation();
      const el = colElsRef.current[ci];
      if (!el) return;
      (e.currentTarget as HTMLElement).classList.add('active');
      resizingRef.current = {
        colId,
        ci,
        startX: e.clientX,
        startW: el.getBoundingClientRect().width,
        handleEl: e.currentTarget as HTMLElement,
      };
      document.body.style.userSelect = 'none';
      window.addEventListener('pointermove', onResizeMove);
      window.addEventListener('pointerup', onResizeUp);
    },
    [onResizeMove, onResizeUp],
  );

  const hasData = storyboard.columns.length > 0;

  return (
    <section className="sb" style={{ width }}>
      <div className="sb-head">
        {/* 顶部单行：全局风格 +（正式页）行数 / 新增一行；粘贴入口仅见于空态下方 */}
        <div className="sb-bar">
          <div className="gs">
            <span className="gs-l">
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              全局
            </span>
            <input
              className={`gs-v ${styleDraft ? '' : 'is-ph'}`}
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
            <svg
              className="pen"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
            </svg>
          </div>

          {hasData && <span className="cnt">{storyboard.rows.length} 行</span>}
          {hasData && (
            <>
              <button
                type="button"
                className="tw-op"
                title="新增一行"
                onClick={() => {
                  commit(addRow(storyboard));
                  showToast?.('已新增一行（点格子填内容）');
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
              <button
                type="button"
                className="tw-op"
                title="复制为表格（粘到 Excel/Word/Notion 等仍是表格）"
                onClick={handleCopyTable}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
              <button type="button" className="tw-op" title="清空表格" onClick={handleClearTable}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {!hasData ? (
        <div className="sb-empty">
          <div className="mark">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="3" y1="15" x2="21" y2="15" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
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
        <div className="sb-body">
          <table className="sbt">
            <colgroup>
              <col style={{ width: 32 }} />
              {storyboard.columns.map((col, ci) => (
                <col
                  key={col.id}
                  ref={(el) => {
                    colElsRef.current[ci] = el;
                  }}
                  style={{ width: colWidths[col.id] ?? colWidths[ci] }}
                />
              ))}
              <col style={{ width: 88 }} />
            </colgroup>
            <thead>
              <tr>
                <th>#</th>
                {storyboard.columns.map((col, ci) => (
                  <th key={col.id} title="点击改列名">
                    <input
                      className="col-head"
                      value={colRenameDraft[col.id] ?? col.label}
                      onChange={(e) =>
                        setColRenameDraft((p) => ({
                          ...p,
                          [col.id]: e.target.value,
                        }))
                      }
                      onBlur={() => {
                        const v = (colRenameDraft[col.id] ?? col.label).trim();
                        if (v && v !== col.label) commit(renameColumn(storyboard, col.id, v));
                        setColRenameDraft((p) => {
                          const n = { ...p };
                          delete n[col.id];
                          return n;
                        });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.nativeEvent.isComposing)
                          (e.target as HTMLInputElement).blur();
                      }}
                    />
                    {/* 列头操作组（hover 显示，+ / × 同款样式，用户裁定 2026-09-06）：
                        每个列表头都有「+（在该列后插入一列）」和「×（删除该列）」，不再固定只能加末尾一列 */}
                    <span className="col-ops">
                      <button
                        type="button"
                        className="tw-op"
                        title="在该列右侧插入一列"
                        onClick={() => {
                          commit(insertColumnAfter(storyboard, col.id));
                          showToast?.('已插入一列（点表头可改名）');
                        }}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="tw-op"
                        title="删除该列"
                        onClick={() => {
                          commit(deleteColumn(storyboard, col.id));
                          showToast?.('已删除列');
                        }}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </span>
                    {/* 列宽拖拽手柄：hover 表头显示，拖拽只改 DOM 不重渲，松手 commit 一次 */}
                    <span
                      className="col-resize"
                      title="拖拽调整列宽"
                      onPointerDown={(e) => startResize(e, col.id, ci)}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {storyboard.rows.map((row, i) => (
                <tr
                  key={row.id}
                  className={selectedRowIds.includes(row.id) ? 'sel' : ''}
                  onClick={(e) => onClickRow(e, row)}
                >
                  <td className="idx">{i + 1}</td>
                  {cells(row)}
                  <td>{ops(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 【待确认预览卡 · 正式表格下方】AI 返回表格 JSON → 解析成预览模型后，在左栏正式表格
          下方渲染预览卡（与正式表格同宽、上下贴邻，替代原先横跨面板宽度的全屏 dock，2026-09-06 用户裁定）。
          确认/取消由上层 AgentPanel 真正写回；确认/取消后本块卸载、消息流原位显示 pv-done 历史痕迹。 */}
      {preview && (
        <div className="sb-preview">
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

/** 单元格编辑器：受控 textarea，随内容自动撑高（长文本多行换行，对齐 mockup），blur 提交 */
function CellEditor({
  value,
  onChange,
  onCommit,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const grow = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);
  // 外部值变化（粘贴/写回/切对话）→ 重算高度
  useEffect(() => {
    grow();
  }, [value, grow]);
  return (
    <textarea
      ref={ref}
      className="cell"
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onInput={grow}
      onBlur={onCommit}
      spellCheck={false}
    />
  );
}
