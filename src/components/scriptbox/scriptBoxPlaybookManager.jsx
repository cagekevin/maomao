import React, { useState, useRef } from 'react'
import { Pencil, Trash2, Plus, Check, X, Download, Upload, ChevronDown, ChevronRight } from 'lucide-react'
import ScriptBoxModal from './ScriptBoxModal.jsx'
import { getAllPlaybooks, saveCustomPlaybook, deleteCustomPlaybook, createCustomFrom } from './scriptBoxPlaybookStore.js'
import { DEFAULT_WORKFLOW } from './scriptBoxWorkflows.js'
import { exportText, parseImport } from './scriptBoxPlaybookIO.js'
import { downloadBlob } from '../base/clipboard.js'
import { toastSuccess, toastError } from '../base/toastStore.ts'

/**
 * 剧本盒子 Playbook 管理面板（设计 B：官方折叠 + 我的主区，直白 CRUD，无「另存为」）。
 *
 * 官网/个人分开：官方只读、折叠展示可选用；我的可 read/新建/编辑/删除，为主操作区。
 * - 选用：点任一行设为该节点工作流并关闭面板；当前项行内标「使用中」。
 * - 新建（＋ 新建）：给默认值（基于官方「漫剧」模板成品）、命名即建、进入编辑接管，不依赖当前选中。
 * - 编辑（✎）：选中该 playbook 并关面板 → 回设置弹窗 Tabs 编辑（官方只读不可✎）。
 * - 删除（▸）：行内二次确认（无全屏遮罩）；删除「使用中」项提示会回退漫剧。
 * - 导出（⭳）：每行（官方+我的）下载该 playbook 单个 JSON，给外部/AI 改。
 * - 导入（⤒）：读一个 playbook JSON，解析/归一化/去重后落为「我的」自定义。
 */
export default function ScriptBoxPlaybookManager({ currentId, onSelect, onClose }) {
  const [officialOpen, setOfficialOpen] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [renameId, setRenameId] = useState(null)
  const [renameVal, setRenameVal] = useState('')
  const [confirmDel, setConfirmDel] = useState(null) // {id,label}
  const fileRef = useRef(null)

  const playbooks = getAllPlaybooks()
  const official = playbooks.filter((p) => p.builtin)
  const mine = playbooks.filter((p) => !p.builtin)

  const nameTaken = (t, excludeId) => playbooks.some((p) => p.label === t && p.id !== excludeId)

  const pick = (id) => { onSelect(id); onClose() }

  const commitNew = () => {
    const t = String(newName || '').trim()
    if (!t || nameTaken(t)) return
    // 新建起点 = 官方漫剧默认模板（开箱可用，稳定可预期；不复制「当前选中」）
    const id = createCustomFrom(DEFAULT_WORKFLOW, {}, t)
    if (id) pick(id)
  }

  const commitRename = (pb) => {
    const t = String(renameVal || '').trim()
    if (!t || nameTaken(t, pb.id)) return
    saveCustomPlaybook({ ...pb, label: t })
    setRenameId(null)
  }

  const doDelete = () => {
    if (!confirmDel) return
    const deletingCurrent = confirmDel.id === currentId
    deleteCustomPlaybook(confirmDel.id)
    setConfirmDel(null)
    if (deletingCurrent) { onSelect(DEFAULT_WORKFLOW); onClose() } // 回退漫剧
  }

  const stop = (e) => { e.stopPropagation() }

  // 导出：单个 playbook → 下载 JSON（官方+我的都可导，给外部/AI 改）
  const onExport = (pb) => {
    const { text, filename } = exportText(pb)
    downloadBlob(new Blob([text], { type: 'application/json' }), filename)
  }

  // 导入：读单个 playbook JSON → 解析/归一化 → 去重 → 落为「我的」自定义
  const onImportFile = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = '' // 允许重复选择同一文件
    if (!f) return
    try {
      const text = await f.text()
      const r = parseImport(text)
      if (!r.ok) { toastError(r.error); return }
      const { playbook } = r
      const labels = new Set(playbooks.map((p) => p.label))
      let label = playbook.label
      let n = 2
      while (labels.has(label)) label = `${playbook.label} (${n++})`
      const id = `pb-import-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
      saveCustomPlaybook({ ...playbook, id, label, builtin: false })
      toastSuccess(`已导入工作流「${label}」`)
    } catch (err) {
      toastError(err?.message || '导入失败')
    }
  }

  const row = (pb) => {
    const using = pb.id === currentId
    const isMine = !pb.builtin
    return (
      <div key={pb.id} onClick={() => pick(pb.id)} className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 cursor-pointer transition-colors group ${using ? 'bg-surface-hover-strong text-white' : 'text-secondary hover:bg-surface-hover hover:text-primary'}`}>
        <span className="flex-1 whitespace-nowrap overflow-hidden text-ellipsis text-caption-sm">{pb.label}</span>
        {using && <span className="shrink-0 text-2xs text-muted">使用中</span>}

        {renameId === pb.id ? (
          <span className="flex items-center gap-1" onClick={stop}>
            <input
              value={renameVal}
              onChange={(e) => setRenameVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitRename(pb); if (e.key === 'Escape') setRenameId(null) }}
              autoFocus
              className="w-32 bg-surface-strong border border-white/[0.06] rounded px-1.5 py-0.5 text-caption-sm text-primary outline-none focus:border-white/20 nodrag"
            />
            <button className="text-emerald-400 hover:text-emerald-300" onClick={() => commitRename(pb)}><Check size={13} /></button>
            <button className="text-muted hover:text-white" onClick={() => setRenameId(null)}><X size={13} /></button>
          </span>
        ) : confirmDel && confirmDel.id === pb.id ? (
          <span className="flex items-center gap-1 shrink-0 text-2xs text-red-300" onClick={stop}>
            <span>删除「{pb.label}」？</span>
            <button className="hover:text-white" onClick={doDelete}>删除</button>
            <button className="hover:text-white" onClick={() => setConfirmDel(null)}>取消</button>
          </span>
        ) : (
          <span className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100" onClick={stop}>
            <button className="text-muted hover:text-white" onClick={() => onExport(pb)} title="导出 JSON"><Download size={13} /></button>
            {isMine && (
              <>
                <button className="text-muted hover:text-white" onClick={() => { setRenameId(pb.id); setRenameVal(pb.label) }} title="编辑"><Pencil size={13} /></button>
                <button className="text-muted hover:text-red-400" onClick={() => setConfirmDel({ id: pb.id, label: pb.label })} title="删除"><Trash2 size={13} /></button>
              </>
            )}
          </span>
        )}
      </div>
    )
  }

  return (
    <ScriptBoxModal
      title="剧本盒子工作流"
      onClose={onClose}
      width={360}
      bodyClass="p-0 flex flex-col min-h-0 flex-1"
      footer={
        <div className="flex justify-end px-5 py-3 shrink-0 border-t border-edge-faint">
          <button className="px-3 py-1.5 text-body-xs text-secondary hover:text-white rounded-lg" onClick={onClose}>完成</button>
        </div>
      }
    >
      <div className="flex-1 overflow-auto custom-scrollbar px-3 py-3 flex flex-col gap-4">
        {/* 官方（只读折叠） */}
        <div>
          <button onClick={() => setOfficialOpen((v) => !v)} className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-caption-sm text-muted hover:text-primary transition-colors">
            {officialOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span>官方工作流（{official.length}）</span>
          </button>
          {officialOpen && <div className="mt-1">{official.map(row)}</div>}
        </div>

        {/* 我的（主区） */}
        <div>
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-caption-sm text-muted">我的工作流（{mine.length}）</span>
            {showNew ? (
              <span className="flex items-center gap-1" onClick={stop}>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitNew(); if (e.key === 'Escape') { setShowNew(false); setNewName('') } }}
                  placeholder="新工作流名称"
                  autoFocus
                  className="w-36 bg-surface-strong border border-white/[0.06] rounded px-1.5 py-0.5 text-caption-sm text-primary outline-none focus:border-white/20 nodrag"
                />
                <button className="text-emerald-400 hover:text-emerald-300" onClick={commitNew}><Check size={13} /></button>
                <button className="text-muted hover:text-white" onClick={() => { setShowNew(false); setNewName('') }}><X size={13} /></button>
              </span>
            ) : (
              <span className="flex items-center gap-3">
                <button className="flex items-center gap-1 text-2xs text-secondary hover:text-primary" onClick={() => fileRef.current?.click()} title="导入单个 playbook JSON"><Upload size={12} /> 导入</button>
                <button className="flex items-center gap-1 text-2xs text-secondary hover:text-primary" onClick={() => setShowNew(true)}><Plus size={12} /> 新建</button>
              </span>
            )}
          </div>
          <div className="mt-1">
            {mine.length === 0 && <div className="px-2 py-2 text-2xs text-muted-2">还没有自己的工作流，点右上「新建」创建</div>}
            {mine.map(row)}
          </div>
        </div>
      </div>
      <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={onImportFile} />
    </ScriptBoxModal>
  )
}