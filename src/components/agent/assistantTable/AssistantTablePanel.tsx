/**
 * AI 助手表格 —— 左栏表格工作区组件（UI 薄壳 + 交互逻辑）。
 *
 * 形态：普通 HTML 表格，活在 AgentPanel 左栏，与画布完全解耦（不占画布、不用画布节点机制）。
 * 数据真相源 = 当前对话会话记忆 memory.assistantTable；globalStyle 复用 memory.global_contract.unified_style_prompt。
 * 本组件自读自写（经 conversationStore 原子订阅 + setCurrentAssistantTable/setCurrentGlobalContract 写回），
 * 渲染 跟随 mockup：全局风格条(.gs) → 工具条(.sb-tools) → 表体(.sbt 表头吸顶/表体滚动)，均可编辑 + 行操作。
 *
 * 关键交互（对应定稿 §1.3/§1.4）：
 *  - 粘贴：显式「粘贴表格」入口读取剪贴板 → parsePasted(TSV/HTML) → 首行表头，写回表格。
 *  - 点选行：本组件持 selectedRowId，lift 给 AgentPanel onSelectRow 供发 AI 时注入上下文。
 *  - AI 生成整表 / 改单行：watch 最后一条 assistant 消息 → 解析「表格 JSON」→ 本组件顶部渲染预览卡 .pv →
 *    确认才写回（整表 replace / 单行 mergeRowFromObj），取消则表格不动（预览与正式表两份状态）。
 *  - 落画布：行操作「发送到画布」→ rowToText → onSendToCanvas（复用 sendContentToCanvas）。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { subscribe, getState } from '../conversation/conversationState.ts'
import { useStoreSelector, shallowEqual } from '@/hooks/useStoreSelector.ts'
import {
  setCurrentAssistantTable, getCurrentGlobalContract, setCurrentGlobalContract,
} from '../conversation/conversationStore.ts'
import {
  normalizeAssistantTable, parsePasted, addRow, deleteRow, moveRow, duplicateRow, setCell,
  rowToText, jsonToSb, mergeRowFromObj, tryParseAssistantTableJson,
} from './assistantTable.ts'
import type { AssistantTable, AssistantTableJson, TableRow } from './assistantTable.ts'
import { showToast } from '@/components/base/core/toastStore.ts'

/** 写全局风格（复用到 memory.global_contract.unified_style_prompt；缺另两字段时补空串对齐 GlobalContractShape） */
function writeGlobalStyle(style: string): void {
  const cur = getCurrentGlobalContract()
  const next = cur ? { ...cur, unified_style_prompt: style } : { visual_positioning: '', unified_style_prompt: style, unified_negative_prompt: '' }
  setCurrentGlobalContract(next)
}

/** 面板外部注入：消息流（据此探测 AI 表格 JSON）与回调 */
export interface AssistantTablePanelProps {
  messages: Array<{ id?: unknown; role?: unknown; content?: unknown }>
  /** 左栏固定宽度（px）（父级分栏拖拽决定） */
  width?: number
  /** 当前是否正在发送（行操作/确认时避免并发） */
  sending?: boolean
  /** 选中某行（null=取消选中）。供 AgentPanel 在发 AI 时自动注入该行上下文 */
  onSelectRow?: (rowId: string | null) => void
  /** 某行 → 发送到画布（AgentPanel 传 sendContentToCanvas，内部 rowToText 拼好文字） */
  onSendToCanvas?: (text: string) => void
  /** 让输入框聚焦（"用 AI 生成"入口的引导） */
  onFocusComposer?: () => void
}

export default function AssistantTablePanel({ messages, width = 460, sending = false, onSelectRow, onSendToCanvas, onFocusComposer }: AssistantTablePanelProps) {
  // ── 响应式读 store ──
  const activeConversationId = useStoreSelector(subscribe, getState, (s) => s.activeId || '', shallowEqual)
  const rawTable = useStoreSelector(subscribe, getState, (s) => {
    const c = (s.conversations || []).find((x) => x.id === s.activeId)
    return c?.memory?.assistantTable ?? null
  }, shallowEqual)
  const rawGc = useStoreSelector(subscribe, getState, (s) => {
    const c = (s.conversations || []).find((x) => x.id === s.activeId)
    return c?.memory?.global_contract ?? null
  }, shallowEqual)
  const storyboard = useMemo<AssistantTable>(() => normalizeAssistantTable(rawTable), [rawTable])
  const globalStyle = (rawGc && typeof rawGc === 'object' && 'unified_style_prompt' in rawGc ? String((rawGc as Record<string, unknown>).unified_style_prompt ?? '').trim() : '')

  // ── 本地编辑态 ──
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, string>>({}) // `${rowId}:${colId}` → draft
  const [styleDraft, setStyleDraft] = useState(globalStyle)
  const [preview, setPreview] = useState<{ json: AssistantTableJson; messageId: unknown } | null>(null)
  const previewHandledRef = useRef<unknown>(null) // 已处理过的最新 assistant 消息 id（防重复弹卡）

  // 切对话 → 重置本地选中/预览/编辑草稿（避免跨对话串表）
  useEffect(() => {
    setSelectedRowId(null)
    setPreview(null)
    setEdits({})
    previewHandledRef.current = null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId])

  // 全局风格外部变化 → 同步草稿（仅当外部值变化，用户在输入时不被覆盖因 typing 不改 rawGc）
  useEffect(() => { setStyleDraft(globalStyle) }, [globalStyle])

  // ⚠️ 暂存编辑草稿随行删除/列变化清理（简单处理：行删了残留草稿不影响渲染，读不到即忽略；不额外清理保持轻量）

  // ── AI 表格 JSON 探测：watch 最后一条 assistant 消息 ──
  useEffect(() => {
    if (messages.length === 0) return
    // 只认「已结束流式」的 assistant 消息（streaming 仍 true 是流式中途的增量占位，内容未定，跳过防误解析）
    const last = [...messages].reverse().find((m) =>
      (m as { streaming?: unknown }).streaming !== true &&
      m?.role === 'assistant' && typeof m?.content === 'string' && String(m.content).trim() !== ''
    )
    if (!last) return
    if (last.id === previewHandledRef.current) return // 已处理过（含已确认/取消/非表格回复），不重复弹
    previewHandledRef.current = last.id
    const hit = tryParseAssistantTableJson(last.content)
    if (hit) {
      setPreview({ json: hit.json, messageId: last.id })
    }
    // 非表格回复 → 不弹卡（已推进 handled）
  }, [messages, storyboard])

  const commit = (sb: AssistantTable) => { setCurrentAssistantTable(sb) }

  const handlePaste = async () => {
    let text = ''
    let html = ''
    try {
      if (navigator.clipboard && typeof navigator.clipboard.read === 'function') {
        const items = await navigator.clipboard.read()
        for (const item of items) {
          for (const type of item.types) {
            if (type === 'text/plain' && !text) text = await (_readType(item, type))
            else if (type === 'text/html' && !html) html = await (_readType(item, type))
          }
        }
      }
    } catch { /* read() 可能缺权限，回退 readText */ }
    try {
      if (!text) text = await navigator.clipboard.readText()
    } catch { /* 权限被拒 */ }
    const sb = parsePasted(text, html)
    if (!sb) { showToast?.('未识别到表格内容（首行为列名，行用 Tab 分隔）', { type: 'error' }); return }
    commit(sb)
    showToast?.(`已粘贴表格 · ${sb.rows.length} 行`, { type: 'success' })
  }
  async function _readType(item: ClipboardItem, type: string): Promise<string> {
    const blob = await item.getType(type)
    return (await blob.text())
  }

  const handleStyleCommit = () => {
    const next = styleDraft.trim()
    if (next !== globalStyle) writeGlobalStyle(next)
  }

  // ── 行操作 ──
  const ops = (row: TableRow) => {
    const apply = (fn: (sb_: AssistantTable) => AssistantTable) => {
      const next = fn(storyboard)
      if (next !== storyboard) commit(next)
    }
    return (
      <div className="ops" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="op" title="复制该行" onClick={() => { apply((s) => duplicateRow(s, row.id)); showToast?.('已复制到下一行') }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
        <button type="button" className="op" title="上移" onClick={() => apply((s) => moveRow(s, row.id, 'up'))}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
        </button>
        <button type="button" className="op" title="下移" onClick={() => apply((s) => moveRow(s, row.id, 'down'))}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <button type="button" className="op" title="删除" onClick={() => { apply((s) => deleteRow(s, row.id)); if (selectedRowId === row.id) { setSelectedRowId(null); onSelectRow?.(null) } }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
        <button type="button" className="op" title="发送到画布去生图" onClick={() => { const t = rowToText(storyboard, row); onSendToCanvas?.(t); showToast?.('已发送到画布（建成文本节点）') }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        </button>
      </div>
    )
  }

  const cells = (row: TableRow) => storyboard.columns.map((col) => {
    const key = `${row.id}:${col.id}`
    const value = key in edits ? edits[key] : (row.values[col.id] ?? '')
    const commitCell = () => {
      const next = setCell(storyboard, row.id, col.id, value)
      if (next !== storyboard) commit(next)
      setEdits((prev) => { if (!(key in prev)) return prev; const n = { ...prev }; delete n[key]; return n })
    }
    return (
      <td key={col.id}>
        <input
          className="cell"
          value={value}
          onChange={(e) => setEdits((prev) => ({ ...prev, [key]: e.target.value }))}
          onBlur={commitCell}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); (e.target as HTMLInputElement).blur() }
          }}
        />
      </td>
    )
  })

  const onClickRow = (row: TableRow) => {
    const next = selectedRowId === row.id ? null : row.id
    setSelectedRowId(next)
    onSelectRow?.(next)
  }

  // 预览卡确认/取消
  const dismissPreview = () => { setPreview(null) }
  const confirmPreview = () => {
    if (!preview) return
    const { json } = preview
    // 单行（rows.length === 1 且当前有选中行）→ 只 merge 回该行（不毁列/其它行）
    if (Array.isArray(json.rows) && json.rows.length === 1 && selectedRowId) {
      const obj = (json.rows[0] && typeof json.rows[0] === 'object') ? (json.rows[0] as Record<string, unknown>) : {}
      const next = mergeRowFromObj(storyboard, selectedRowId, obj)
      if (next !== storyboard) commit(next)
    } else {
      // 整表：AI 设计列 + 行 → 全量替换
      const { globalStyle: gs, sb: next } = jsonToSb(json)
      if (gs && gs !== globalStyle) writeGlobalStyle(gs)
      if (next.columns.length > 0) commit(next)
    }
    setPreview(null)
    showToast?.('已写入表格', { type: 'success' })
  }

  const hasData = storyboard.columns.length > 0

  return (
    <section className="sb" style={{ width }}>
      <div className="sb-head">
        {/* 全局风格条（表外独立一行，不占 rows） */}
        <div className="gs">
          <span className="gs-l">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            全局风格
          </span>
          <input
            className={`gs-v ${styleDraft ? '' : 'is-ph'}`}
            value={styleDraft}
            placeholder="未设置（AI 会自行补一个）"
            onChange={(e) => setStyleDraft(e.target.value)}
            onBlur={handleStyleCommit}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); (e.target as HTMLInputElement).blur() } }}
          />
          <svg className="pen" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
        </div>

        {preview && (
          <div className="pv">
            <div className="pv-hd">
              <span className="badge">表格预览</span>
              <span>AI 生成 · 未写入</span>
              <span className="spacer" />
              <span className="rows">共 {Array.isArray(preview.json.rows) ? preview.json.rows.length : 0} 行</span>
            </div>
            {preview.json.globalStyle ? <div className="gs-line"><b>全局风格：</b><span>{preview.json.globalStyle}</span></div> : null}
            <div className="pv-body">
              <PreviewTable json={preview.json} />
            </div>
            <div className="pv-ft">
              <button type="button" className="btn btn-ok" onClick={confirmPreview} disabled={sending}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                确认写入{selectedRowId && Array.isArray(preview.json.rows) && preview.json.rows.length === 1 ? '该行' : '表格'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={dismissPreview}>取消</button>
              <span className="tip">只覆盖文字</span>
            </div>
          </div>
        )}

        <div className="sb-tools">
          <button type="button" className="tb" onClick={handlePaste} title="粘贴：读取剪贴板，首行作为表头">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            粘贴表格
          </button>
          <button type="button" className="tb primary" onClick={() => { onFocusComposer?.(); showToast?.('在右侧对话框用一句话描述表格需求，AI 会设计列并填充') }} title="去右侧对话发需求，AI 生成整表">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.8 4.7L18.5 9l-4.7 1.3L12 15l-1.8-4.7L5.5 9l4.7-1.3z"/><path d="M18.5 15.5l.8 2 2.2.8-2.2.8-.8 2-.8-2-2.2-.8 2.2-.8z"/></svg>
            用 AI 生成
          </button>
          <span className="spacer" />
          {hasData && <span className="cnt">{storyboard.rows.length} 行</span>}
          {hasData && (
            <button type="button" className="ib sm" title="新增一行" onClick={() => { commit(addRow(storyboard)); showToast?.('已新增一行（点格子填内容）') }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          )}
        </div>
      </div>

      {!hasData ? (
        <div className="sb-empty">
          <div className="mark">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
          </div>
          <h4>还没有表格</h4>
          <p>粘贴一段带表头的文字（首行=列名），<br/>或在右侧对话里描述需求让 AI 设计表头并填充</p>
          <div className="acts">
            <button type="button" className="tb" onClick={handlePaste}>粘贴表格</button>
            <button type="button" className="tb primary" onClick={() => { onFocusComposer?.(); showToast?.('在右侧对话框发需求，AI 生成整表') }}>让 AI 生成</button>
          </div>
        </div>
      ) : (
        <div className="sb-body">
          <table className="sbt">
            <colgroup><col style={{ width: 34 }} /><col style={{ width: 96 }} /><col /><col style={{ width: 120 }} /></colgroup>
            <thead>
              <tr>
                <th>#</th>
                {storyboard.columns.map((col) => <th key={col.id}>{col.label}</th>)}
                <th />
              </tr>
            </thead>
            <tbody>
              {storyboard.rows.map((row, i) => (
                <tr key={row.id} className={selectedRowId === row.id ? 'sel' : ''} onClick={() => onClickRow(row)}>
                  <td className="idx">{i + 1}</td>
                  {cells(row)}
                  <td>{ops(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

/** 预览内嵌表格（展示 AI 返回 JSON；首行键即列名） */
function PreviewTable({ json }: { json: AssistantTableJson }) {
  const rows = Array.isArray(json.rows) ? json.rows : []
  const cols = (rows[0] && typeof rows[0] === 'object') ? Object.keys(rows[0] as Record<string, unknown>) : []
  return (
    <table>
      {cols.length > 0 && (
        <thead>
          <tr>{cols.map((c, i) => <th key={i}>{c}</th>)}</tr>
        </thead>
      )}
      <tbody>
        {rows.map((r, ri) => (
          <tr key={ri}>
            {cols.map((c, ci) => <td key={ci}>{String((r as Record<string, unknown>)[c] ?? '')}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  )
}