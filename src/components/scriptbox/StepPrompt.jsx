import React, { useState, useRef } from 'react'
import { Loader2, Image as ImageIcon, Video, LayoutGrid, Columns2, RefreshCw, Link2, Wand2, Copy, Check } from 'lucide-react'
import { dialogueText, hlAt, patchShots, formatLineBreaks, IMAGE_GEN_TYPES, IMAGE_GEN_DEFAULT } from '../base/scriptBoxPrompts.js'
import { toastWarning } from '../base/toastStore.js'
import ScriptBoxModal from './ScriptBoxModal.jsx'

/**
 * 剧本盒子 步骤3「合成提示词」：列表/单镜头双视图 + 每镜卡片（生图 prompt/生视频 prompt 双击编辑 + 宫格选择 + 生成）+
 * 已连线面板（复刻原型 renderV3）。
 */
export default function StepPrompt({ data, updateData, callbacks }) {
  const d = data || {}
  const shots = d.shots || []
  const [view, setView] = useState('list')
  const [editing, setEditing] = useState(null) // { idx, field, title, base, awaiting }
  const [draft, setDraft] = useState(null) // 预览/编辑缓冲：AI 改写结果或人手直接改的内容，点「应用」才写回 shot
  const [chatInput, setChatInput] = useState('') // 弹窗：下方输入意见（AI 改写用）
  const [gridPick, setGridPick] = useState({}) // idx -> grid 模式
  const [selShots, setSelShots] = useState(new Set())
  const [genType, setGenType] = useState({}) // idx -> 选中的生图类型
  const [copied, setCopied] = useState({}) // idx -> 是否已复制
  const [singleIdx, setSingleIdx] = useState(0) // 单镜头视图：当前查看的镜头 idx
  const [regenerating, setRegenerating] = useState(null) // 待重新生成的镜头 id（弹意见输入框）
  const [feedback, setFeedback] = useState('') // 重新生成时的用户修改意见
  const [mergeLoading, setMergeLoading] = useState(false) // 合并生成视频：按钮转圈+「生成中」

  const patchShot = (idx, field, val) => updateData({ shots: patchShots(shots, idx, field, val) })

  const toggleSel = (idx) => {
    const s2 = new Set(selShots)
    if (s2.has(idx)) s2.delete(idx)
    else s2.add(idx)
    setSelShots(s2)
  }

  const openField = (idx, field, title) => { setEditing({ idx, field, title, awaiting: false }); setDraft(formatLineBreaks(String(shots[idx]?.[field] ?? ''))); setChatInput('') }
  // AI 生图内容（关键帧/四宫格/九宫格/俯视调度图 imgGen）编辑：field 用 'imgGen'，提交写回 shots[i].imgGen.prompt
  const openImgGen = (idx, title) => { setEditing({ idx, field: 'imgGen', title, awaiting: false }); setDraft(formatLineBreaks(String(shots[idx]?.imgGen?.prompt ?? ''))); setChatInput('') }

  /** 聊天式：把意见交给 AI 审计改写。引擎把改写结果 resolve 回来 → 写入 draft 预览；点「应用」才落盘。 */
  const sendFeedback = async () => {
    if (!editing || !chatInput.trim()) return
    const id = shots[editing.idx]?.id
    if (!id) return
    const msg = chatInput.trim()
    setEditing((e) => (e ? { ...e, awaiting: true } : e)) // 驱动"AI 正在编辑"动画 + 防重入
    try {
      const res = await callbacks.onReviewShotPrompt?.(id, editing.field, msg)
      if (res?.ok && res.text != null) setDraft(res.text)
      else if (res?.ok === false) toastWarning('改写失败，请重试') // 引擎 resolveResult({ok:false}) 兜底，防组件静默
    } finally {
      setEditing((e) => (e ? { ...e, awaiting: false } : e))
    }
    setChatInput('')
  }
  /** 把 draft 正式写回 shot（「应用」；AI 改完或人手直接改，都经这里落盘） */
  const applyDraft = () => {
    if (!editing || draft == null) return
    if (editing.field === 'imgGen') {
      const s = shots[editing.idx]
      patchShot(editing.idx, { imgGen: { ...(s?.imgGen || {}), prompt: draft } })
    } else {
      patchShot(editing.idx, editing.field, draft)
    }
    setDraft(null)
    setEditing(null)
  }

  const cardFor = (s, i) => {
    // 卡片级生成中动画遮罩：该分镜正在生成（promptLoading=分镜提示词 / imgGenLoading=关键帧等 AI 生图）时，
    // 只给这一个卡片盖遮罩 + 锁定其内部所有操作（重新生成/生成关键帧/生图/生视频/编辑等），
    // 其他分镜照常可用。「每块拆开」——批量生成时分镜各自独立动画、互不影响。
    const cardBusy = !!(s.promptLoading || s.imgGenLoading)
    return (
    <div key={s.id ?? i} className="relative flex flex-col gap-2 p-3 bg-surface-strong border border-edge-faint rounded-lg">
      <div className="flex items-center gap-2 text-caption-sm">
        <span className="px-1.5 py-0.5 bg-surface-hover rounded text-body">镜头 {s.index}</span>
        <span className="text-muted">{s.duration}</span>
        {s.connImg && <span className="text-emerald-400">图✓</span>}
        {s.connVid && <span className="text-blue-400">视频✓</span>}
        <div className="flex-1" />
        <button
          className={`flex items-center justify-center px-2 py-1.5 rounded-md transition-colors ${selShots.has(i) ? 'bg-surface-hover-strong text-white' : 'text-muted hover:text-white hover:bg-surface-hover'}`}
          title={selShots.has(i) ? '取消选择' : '选择'}
          onClick={() => toggleSel(i)}
        >
          <span className="text-base leading-none">{selShots.has(i) ? '☑' : '☐'}</span>
        </button>
      </div>
      <div className="text-caption-sm text-secondary leading-relaxed">{s.description}</div>
      {(s.dialogue || []).length > 0 && <div className="text-caption text-muted italic">「{dialogueText(s.dialogue)}」</div>}

      {/* prompt 区：左侧生图提示词（AI 生图在下方），右侧生视频提示词（操作按钮在下方），左右均衡 */}
      <div className="grid grid-cols-2 gap-2">
        {/* 左侧：生图提示词 + 生图按钮 + AI 生图 */}
        <div className="flex flex-col gap-1.5 min-w-0">
          <PromptBox label="生图提示词" text={s.prompt} loading={s.promptLoading} onEdit={() => openField(i, 'prompt', '生图提示词')} assetNames={(d.assets || []).map((a) => a.name)} />
          {/* AI 生成提示词（关键帧/四宫格/九宫格/俯视调度图，均属生图），样式与重新生成/连下游一致 */}
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-1">
              {/* 生图类型下拉（关键帧/四宫格/九宫格/俯视调度图） */}
              <select
                value={genType[i] || IMAGE_GEN_DEFAULT}
                onChange={(e) => setGenType((g) => ({ ...g, [i]: e.target.value }))}
                className="px-2 py-1 text-caption text-body bg-surface-1 hover:bg-surface-hover rounded outline-none nodrag cursor-pointer"
              >
                {Object.entries(IMAGE_GEN_TYPES).map(([key, t]) => (
                  <option key={key} value={key} className="bg-surface-menu text-body">{t.label}</option>
                ))}
              </select>
              {s.imgGenLoading ? (
                <Loader2 size={12} className="animate-spin text-secondary" />
              ) : (
                <button
                  className="flex items-center gap-1 px-2 py-1 text-caption text-body bg-surface-1 hover:bg-surface-hover rounded"
                  onClick={() => callbacks.onGenerateShotImage?.(s.id, genType[i] || IMAGE_GEN_DEFAULT)}
                >
                  <Wand2 size={10} /> 生成提示词
                </button>
              )}
              {/* 生成完提示词 → 生图（连生图下游） */}
              <button className="flex items-center gap-1 px-2 py-1 text-caption text-body bg-surface-1 hover:bg-surface-hover rounded" onClick={() => callbacks.onConnectShot?.(s.id, 'image')}><ImageIcon size={10} /> 生图</button>
            </div>
            {s.imgGen && !s.imgGenLoading && (
              <div className="flex flex-col gap-1 bg-code-bg rounded p-2 border border-edge-faint">
                <div className="flex items-center gap-1.5">
                  <span className="text-meta text-secondary px-1 py-px rounded bg-surface-1">{s.imgGen.label}</span>
                  <span className="text-meta text-muted-2">{new Date(s.imgGen.ts).toLocaleTimeString()}</span>
                  <div className="flex-1" />
                  <button className="flex items-center gap-0.5 text-meta text-secondary hover:text-white" onClick={() => { navigator.clipboard?.writeText(s.imgGen.prompt).catch(() => toastWarning('复制提示词失败')); setCopied((c) => ({ ...c, [i]: true })); setTimeout(() => setCopied((c) => ({ ...c, [i]: false })), 1200) }}>
                    {copied[i] ? <Check size={9} className="text-emerald-400" /> : <Copy size={9} />} {copied[i] ? '已复制' : '复制'}
                  </button>
                  <button className="px-1.5 py-0.5 text-meta rounded bg-surface-hover hover:bg-surface-hover-strong text-body" onClick={() => patchShot(i, 'prompt', s.imgGen.prompt)}>应用到生图</button>
                </div>
                <div className="text-caption text-body leading-relaxed line-clamp-4 break-words cursor-text hover:bg-surface-1 rounded px-1 -mx-1" title="双击编辑" onDoubleClick={() => openImgGen(i, s.imgGen.label)}><span dangerouslySetInnerHTML={{ __html: hlAt(s.imgGen.prompt, (d.assets || []).map((a) => a.name)) }} /></div>
              </div>
            )}
          </div>
        </div>
        {/* 右侧：生视频提示词 + 操作 */}
        <div className="flex flex-col gap-1.5 min-w-0">
          <PromptBox label="生视频提示词" text={s.videoPrompt} loading={s.promptLoading} onEdit={() => openField(i, 'videoPrompt', '生视频提示词')} assetNames={(d.assets || []).map((a) => a.name)} />
          <div className="flex gap-1.5">
            <button
              className="flex items-center gap-1 px-2 py-1 text-caption text-body bg-surface-1 hover:bg-surface-hover rounded"
              title="左键：直接随机重生成；右键：带修改意见重生成"
              onClick={() => callbacks.onGenerateShotPrompts?.([s.id])}
              onContextMenu={(e) => { e.preventDefault(); setFeedback(''); setRegenerating(s.id) }}
            ><RefreshCw size={10} /> 重新生成</button>
            <button className="flex items-center gap-1 px-2 py-1 text-caption text-body bg-surface-1 hover:bg-surface-hover rounded" onClick={() => callbacks.onConnectShot?.(s.id, 'video')}><Video size={10} /> 生视频</button>
          </div>
        </div>
      </div>

      {/* 卡片级生成中动画遮罩：只遮当前正在生成的分镜，锁定其内部操作 */}
      {cardBusy && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-surface-strong/85 rounded-lg">
          <Loader2 size={18} className="animate-spin text-emerald-400" />
          <span className="text-caption-sm text-body">{s.imgGenLoading ? '正在生成关键帧…' : '正在生成提示词…'}</span>
        </div>
      )}
    </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 视图切换 + 批量 */}
      <div className="flex items-center gap-2">
        <div className="flex items-center bg-surface-strong rounded-lg p-0.5">
          <button className={`flex items-center gap-1.5 px-3 py-1.5 text-caption-sm rounded-md whitespace-nowrap ${view === 'list' ? 'bg-surface-hover text-white' : 'text-secondary'}`} onClick={() => setView('list')}><Columns2 size={11} /> 列表</button>
          <button className={`flex items-center gap-1.5 px-3 py-1.5 text-caption-sm rounded-md whitespace-nowrap ${view === 'grid' ? 'bg-surface-hover text-white' : 'text-secondary'}`} onClick={() => setView('grid')}><LayoutGrid size={11} /> 单镜头</button>
        </div>
        <div className="flex-1" />
        {/* 批量操作：始终显示。未选镜头 → 作用于全部；选中镜头 → 只作用于选中的（与第2步「批量生成素材」逻辑一致） */}
        <button
          className="flex items-center gap-1 px-2.5 py-1.5 text-caption-sm text-primary bg-surface-hover hover:bg-surface-hover-strong rounded-md whitespace-nowrap"
          title={selShots.size ? `为选中的 ${selShots.size} 镜批量生成提示词` : '为全部镜头批量生成提示词'}
          onClick={() => callbacks.onGenerateShotPrompts?.([...selShots].map((i) => shots[i].id))}
        >
          <RefreshCw size={11} /> 批量生成提示词{selShots.size ? `(${selShots.size})` : ''}
        </button>
        <button
          className="flex items-center gap-1 px-2.5 py-1.5 text-caption-sm text-primary bg-surface-hover hover:bg-surface-hover-strong rounded-md whitespace-nowrap"
          title={selShots.size ? `为选中的 ${selShots.size} 镜批量生图` : '为全部镜头批量生图'}
          onClick={() => callbacks.onConnectShots?.([...selShots].map((i) => shots[i].id), 'image')}
        >
          <ImageIcon size={11} /> 批量生图{selShots.size ? `(${selShots.size})` : ''}
        </button>
        {/* 合并生成视频：勾选 ≥2 镜 → AI 合并生成一条序号连贯的提示词 → 新建视频生成节点（剧本数据不变）。
            生成中按钮转圈 + 文字「生成中」，结束（成功/失败）复位。 */}
        <button
          className="flex items-center gap-1 px-2.5 py-1.5 text-caption-sm text-primary bg-surface-hover hover:bg-surface-hover-strong rounded-md whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
          title={mergeLoading ? '正在生成合并视频提示词…' : (selShots.size >= 2 ? `将选中的 ${selShots.size} 镜合并生成一个视频` : '勾选 2 个以上镜头后合并生成视频')}
          disabled={selShots.size < 2 || mergeLoading}
          onClick={async () => {
            setMergeLoading(true)
            try {
              await callbacks.onGenerateMergedVideo?.([...selShots].map((i) => shots[i].id))
            } finally {
              setMergeLoading(false)
            }
          }}
        >
          {mergeLoading ? <Loader2 size={11} className="animate-spin" /> : <Video size={11} />}
          {mergeLoading ? '生成中…' : `合并生成视频${selShots.size >= 2 ? `(${selShots.size})` : ''}`}
        </button>
        <span className="text-caption-sm text-muted">{shots.length} 镜</span>
      </div>

      {/* 内容 */}
      {shots.length === 0 ? (
        <div className="text-center py-12 text-muted-2 text-body-xs">暂无分镜，请先在「确认镜头」步骤生成</div>
      ) : view === 'list' ? (
        /* 列表视图：所有镜头小卡片纵向排列 */
        <div className="flex flex-col gap-2 min-h-0">{shots.map((s, i) => cardFor(s, i))}</div>
      ) : (
        /* 单镜头视图：一次一个大镜头，‹ 镜N/N › 切换（复刻官方 le==='single'） */
        <div className="flex flex-col gap-3">
          {/* 切换器 + 当前镜头顶部操作 */}
          <div className="flex items-center gap-2">
            <button
              className="px-2.5 py-1 text-base leading-none text-gray-500 hover:text-white disabled:opacity-30 disabled:hover:text-gray-500"
              disabled={singleIdx <= 0}
              onClick={() => setSingleIdx((v) => Math.max(0, v - 1))}
            >‹</button>
            <span className="text-base-sm text-white font-medium">镜{shots[singleIdx]?.index}</span>
            <span className="text-body-xs text-muted">/ {shots.length}</span>
            <button
              className="px-2.5 py-1 text-base leading-none text-gray-500 hover:text-white disabled:opacity-30 disabled:hover:text-gray-500"
              disabled={singleIdx >= shots.length - 1}
              onClick={() => setSingleIdx((v) => Math.min(shots.length - 1, v + 1))}
            >›</button>
            <div className="flex-1" />
            {/* 当前镜头操作：生成提示词 / 生图 / 生视频（统一深色按钮，与整体设计语言一致） */}
            <button className="flex items-center gap-1 px-2.5 py-1.5 text-caption-sm text-primary bg-surface-hover hover:bg-surface-hover-strong rounded" onClick={() => callbacks.onGenerateShotPrompts?.([shots[singleIdx].id])}>
              <RefreshCw size={11} /> {shots[singleIdx]?.prompt || shots[singleIdx]?.videoPrompt ? '重生成提示词' : '生成提示词'}
            </button>
            <button className="flex items-center gap-1 px-2.5 py-1.5 text-caption-sm text-primary bg-surface-hover hover:bg-surface-hover-strong border border-edge rounded" onClick={() => callbacks.onConnectShot?.(shots[singleIdx].id, 'image')}>
              <ImageIcon size={11} /> 生图
            </button>
            <button className="flex items-center gap-1 px-2.5 py-1.5 text-caption-sm text-primary bg-surface-hover hover:bg-surface-hover-strong border border-edge rounded" onClick={() => callbacks.onConnectShot?.(shots[singleIdx].id, 'video')}>
              <Video size={11} /> 生视频
            </button>
          </div>
          {shots[singleIdx] && cardFor(shots[singleIdx], singleIdx)}
        </div>
      )}

      {/* 已连线面板 */}
      {(d.connected || []).length > 0 && (
        <div className="text-caption-sm text-muted border-t border-edge-faint pt-2">
          <div className="mb-1 text-secondary">已连线</div>
          {d.connected.map((c, i) => <div key={i} className="text-muted">镜头{c.shotId} · {c.type} · {c.nodeId}</div>)}
        </div>
      )}

      {/* 双击编辑弹窗：聊天式改提示词（上看当前提示词，下写意见→AI 改→上方自动刷新）。
          imgGen（关键帧提示词）无独立 AI 改写通道，仍走手写 textarea。 */}
      {editing && (
        <ScriptBoxModal
          title=""
          onClose={() => setEditing(null)}
          width={720}
          height={560}
          bodyClass="flex flex-col flex-1 min-h-0 p-0"
          footer={
            <div className="flex justify-between items-center px-4 py-3 border-t border-edge-faint shrink-0">
              <span className="text-caption-sm text-muted">预览区可直接编辑；满意后「应用」才写回</span>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1 text-caption-sm text-muted hover:text-white transition-colors" onClick={() => { setDraft(null); setEditing(null) }}>关闭</button>
                <button
                  className="px-3 py-1 text-caption-sm bg-surface-hover hover:bg-surface-hover-strong text-primary rounded-md disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  disabled={draft == null}
                  onClick={applyDraft}
                >应用</button>
              </div>
            </div>
          }
        >
          <ChatEdit
            editing={editing}
            shots={shots}
            draft={draft}
            chatInput={chatInput}
            assetNames={(d.assets || []).map((a) => a.name)}
            onDraft={setDraft}
            onInput={setChatInput}
            onSend={sendFeedback}
            busy={!!editing.awaiting}
          />
        </ScriptBoxModal>
      )}

      {/* 重新生成意见弹窗：带上用户本次修改意见一起发，避免随机重生成 */}
      {regenerating && (
        <ScriptBoxModal
          title="重新生成此镜头提示词"
          onClose={() => setRegenerating(null)}
          width={520}
          onOk={() => {
            const id = regenerating
            setRegenerating(null)
            callbacks.onGenerateShotPrompts?.([id], feedback)
          }}
          okText="重新生成"
        >
          <textarea autoFocus value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="（可选）填写你的修改意见，会一起发给 AI。例如：更简洁、突出小狗站起来的动作、换成侧方环绕运镜…不填则按原镜头随机重生成。"
            className="w-full h-28 bg-transparent outline-none custom-scrollbar resize-none nodrag nowheel rounded-lg" style={{ fontSize: '13px', lineHeight: 1.7, color: 'rgb(var(--mao-text-secondary))' }} />
        </ScriptBoxModal>
      )}
    </div>
  )
}

/** 提示词展示（标题栏右侧可选的"生成"按钮；onGen 为空则不渲染） */
function PromptBox({ label, text, loading, onEdit, onGen, assetNames }) {
  return (
    <div className="flex flex-col gap-1 bg-code-bg rounded p-2">
      <div className="flex items-center justify-between">
        <span className="text-caption text-muted">{label}</span>
        {onGen && (
          <button className="flex items-center gap-0.5 text-caption text-secondary hover:text-white" onClick={onGen}>{loading ? <Loader2 size={10} className="animate-spin" /> : <ImageIcon size={10} />} 生成</button>
        )}
      </div>
      <div className="text-caption text-secondary leading-relaxed line-clamp-3 break-words cursor-text hover:bg-surface rounded px-1 -mx-1" onDoubleClick={onEdit} title="双击编辑">
        {text ? <span dangerouslySetInnerHTML={{ __html: hlAt(text, assetNames) }} /> : <span className="text-muted-2">双击编辑</span>}
      </div>
    </div>
  )
}

/**
 * 提示词编辑弹窗主体：上方大「预览编辑区」（可编辑 textarea，draft），下方一条细「意见输入条」
 * （让 AI 按意见改；imgGen 无 AI 通道，只有编辑区）。AI 改写时顶部显示状态行 + 按钮转圈。
 * 预览可直接手改；满意后点「应用」才写回 shot。⌘/Ctrl+Enter 发送意见。
 */
function ChatEdit({ editing, shots, draft, chatInput, assetNames, onDraft, onInput, onSend, busy }) {
  const cur = shots[editing.idx]
  const isImgGen = editing.field === 'imgGen'
  const fieldCurrent = isImgGen ? cur?.imgGen?.prompt : (editing.field === 'prompt' ? cur?.prompt : cur?.videoPrompt)
  const previewText = draft != null ? draft : fieldCurrent
  const changed = draft != null && draft !== fieldCurrent
  // 意见输入条 auto-resize：内容超过一行自动增高（上限 96px≈4行），不再裁掉换行后的第一行
  const inputRef = useRef(null)
  const resizeInput = () => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      {/* AI 改写中：绝对定位浮层，不占文档流、不挤布局（浮在底部输入条上方居中） */}
      {busy && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-3 z-10 pointer-events-none">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-menu/95 border border-edge shadow-lg">
            <Loader2 size={13} className="animate-spin text-emerald-400" />
            <span className="text-caption-sm text-emerald-300">AI 正在编辑…</span>
          </div>
        </div>
      )}

      {/* 预览 / 编辑区（占满） */}
      <div className="flex-1 flex flex-col min-h-0 px-5 pt-4 pb-3">
        <div className="flex items-center gap-1.5 pb-2 shrink-0">
          <span className={`w-2 h-2 rounded-full ${changed ? 'bg-emerald-400' : 'bg-gray-600'}`} />
          <span className="text-caption-sm text-secondary">{isImgGen ? '提示词（直接编辑）' : (changed ? '预览 · 有改动待应用' : '当前提示词（可直接编辑）')}</span>
        </div>
        <textarea
          autoFocus
          value={previewText ?? ''}
          onChange={(e) => onDraft(e.target.value)}
          placeholder={isImgGen ? '填写关键帧提示词…' : '可手写，或写意见让 AI 改…'}
          className="flex-1 w-full bg-transparent outline-none resize-none rounded-lg px-0 py-3.5 custom-scrollbar text-caption-sm leading-relaxed transition-colors"
          style={{
            fontSize: '14px', lineHeight: 1.8, color: 'rgb(var(--mao-text-primary))',
            border: '1px solid transparent',
          }}
        />
      </div>

      {/* 底部细输入条（让 AI 按意见改；imgGen 无 AI 通道，隐藏） */}
      {!isImgGen && (
        <div className="shrink-0 px-5 pt-1 pb-3">
          <div className="flex items-center gap-2 bg-input border border-edge rounded-xl px-3 py-1.5 focus-within:border-emerald-400/40 transition-colors">
            <textarea
              ref={inputRef}
              value={chatInput}
              onChange={(e) => { onInput(e.target.value); resizeInput() }}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onSend() } }}
              placeholder="提修改意见，让 AI 改…（⌘/Ctrl+Enter 发送）"
              rows={1}
              disabled={busy}
              className="flex-1 bg-transparent outline-none resize-none custom-scrollbar text-caption-sm text-primary placeholder:text-muted-2 disabled:opacity-50 transition-colors"
              style={{ fontSize: '13px', lineHeight: 1.75 }}
            />
            <button
              onClick={onSend}
              disabled={!chatInput.trim() || busy}
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-500 text-white hover:bg-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="按意见改写（⌘/Ctrl+Enter）"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13" /><path d="M22 2 15 22 11 13 2 9 22 2z" /></svg>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

