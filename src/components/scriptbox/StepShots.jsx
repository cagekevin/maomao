import React, { useState, useRef } from 'react'
import { Loader2, Plus, Trash2, Film, Link2 } from 'lucide-react'
import { SHOT_TYPES, LIGHTS, MOTIONS, dialogueText, textToDlg, dlgToText, hlAt, patchShots, createNewShot, removeShot, applyTailFrameSelection, parseShotSeconds } from '../base/scriptBoxPrompts.js'
import MaterialStrip from '../base/MaterialStrip.jsx'
import { useOutsideClick } from '../base/hooks.js'
import { useRenderImageResolver } from '../base/imageUrl.js'
import ScriptBoxModal from './ScriptBoxModal.jsx'

/**
 * 剧本盒子 步骤1「确认镜头」：左栏控制 + 右栏分镜表格（复刻原型 renderV1）。
 * 数据只读 node.data（props.data），编辑经 props.updateData 写回，生成经 props.callbacks。
 *
 * 表格 8 列：镜号/时长/画面描述(双击编辑,@资产高亮)/景别/光影/对白(双击弹窗)/音效/运镜 + 删除。
 */
export default function StepShots({ data, updateData, callbacks }) {
  const d = data || {}
  const shots = d.shots || []
  const [editing, setEditing] = useState(null) // { idx, field, title }
  const [editVal, setEditVal] = useState('')
  const [dlgEditing, setDlgEditing] = useState(null) // 对白编辑器 idx
  const [dlgText, setDlgText] = useState('')
  const [tfShotId, setTfShotId] = useState(null) // 尾帧变体浮层：当前查看的 shot id（P1-1）
  const [scriptLoading, setScriptLoading] = useState(false) // 生成分镜脚本：按钮转圈+「生成中」
  // 缩略图显示复用系统统一按需出图出口（与资产卡/ImageNode 一致）
  const render = useRenderImageResolver()

  const setStory = (story) => updateData({ story })
  const setStyle = (globalStyle) => updateData({ globalStyle })
  const setShotCount = (shotCount) => updateData({ shotCount })
  const setCustomCount = (customCount) => updateData({ customCount })

  // 更新单个分镜字段（复用纯函数 patchShots，收口 StepShots/StepPrompt 重复）
  const patchShot = (idx, field, val) => updateData({ shots: patchShots(shots, idx, field, val) })

  // 对白数组 → 文本（可编辑）与 文本 → 对白数组：统一复用 scriptBoxPrompts 纯函数
  //（dlgToText / textToDlg，与引擎生成解析一致，含旁白识别）
  const openField = (idx, field, title) => { setEditing({ idx, field, title }); setEditVal(String(shots[idx]?.[field] ?? '')) }
  const commitField = () => {
    if (editing) patchShot(editing.idx, editing.field, editVal)
    setEditing(null)
  }
  const openDlg = (idx) => { setDlgEditing(idx); setDlgText(dlgToText(shots[idx]?.dialogue)) }
  const commitDlg = () => { if (dlgEditing !== null) patchShot(dlgEditing, 'dialogue', textToDlg(dlgText)); setDlgEditing(null) }

  const addShot = () => {
    updateData({ shots: [...shots, createNewShot(shots)] })
  }
  const delShot = (idx) => {
    updateData({ shots: removeShot(shots, idx) })
  }

  // P1-1 尾帧变体选帧（浮层内）：写回 selectedTailFrameVariantId + usePrevShotVideoTail 开关 + prevShotImageRefUrls。
  // 单次 updateData 一次性写回（避免多次 patch 读旧引用互相覆盖）。选「不使用尾帧」时 useTail=false、清参考 URL。
  const selectTailFrame = (shotId, variant, useTail) => {
    const next = applyTailFrameSelection(shots, shotId, variant, useTail)
    if (!next) return // 找不到 shotId：不写回、不关浮层（与原实现一致）
    updateData({ shots: next })
    setTfShotId(null)
  }
  // 浮层内重试生成尾帧变体
  const openTailFrame = (shotId) => { setTfShotId(shotId); callbacks.onGenerateTailFrameVariants?.(shotId) }

  return (
    <div data-testid="step-shots" className="grid grid-cols-[190px_1fr] gap-4">
      {/* 左栏 */}
      <div className="flex flex-col gap-3">
        <div>
          <div className="text-caption-sm text-secondary mb-1.5">统一风格</div>
          <input value={d.globalStyle || ''} onChange={(e) => setStyle(e.target.value)} className="w-full bg-surface-strong border border-edge rounded-md px-2 py-1 text-caption-sm text-primary outline-none nodrag" placeholder="如：中世纪童话 皮克斯3D" />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {(d.styleChips || []).map((c) => (
              <button key={c} onClick={() => setStyle(c)} className={`px-2 py-0.5 text-caption rounded-md border ${d.globalStyle === c ? 'border-white/40 text-white bg-surface-hover' : 'border-edge text-secondary hover:border-edge-strong'}`}>{c}</button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-caption-sm text-secondary mb-1.5">剧情</div>
          {/* 上游接入只读素材区（位置在剧情框上方）：展示连入的上游文本/图片，内容只读不可改，仅可断线。
              素材来自 node.data.upstreamTexts / upstreamImages（ScriptBoxNode 经 useConnectedInputs 同步）；
              多个时 flex-wrap 自动换行。 */}
          {(d.upstreamImages?.length > 0 || d.upstreamTexts?.length > 0) && (
            <div className="mb-1.5">
              <MaterialStrip images={d.upstreamImages || []} texts={d.upstreamTexts || []} readOnly onDisconnect={callbacks?.onDisconnectUpstream} />
            </div>
          )}
          <textarea value={d.story || ''} onChange={(e) => setStory(e.target.value)} placeholder="输入你的故事……" className="w-full h-32 bg-surface-strong border border-edge rounded-lg p-2.5 text-body-xs text-primary outline-none resize-none custom-scrollbar nodrag nowheel" />
        </div>

        <div>
          <div className="text-caption-sm text-secondary mb-1.5">镜头数量</div>
          <div className="flex gap-1">
            {[['auto', '自动'], [10, '10'], [20, '20'], [30, '30'], [50, '50']].map(([v, l]) => (
              <button key={String(v)} onClick={() => setShotCount(v)} className={`px-2 py-0.5 text-caption rounded-md border ${String(d.shotCount ?? 'auto') === String(v) ? 'border-white/40 text-white bg-surface-hover' : 'border-edge text-secondary'}`}>{l}</button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="text-caption text-muted">自定义</span>
            <input type="number" min="1" max="300" placeholder="1~300" value={d.customCount || ''} onChange={(e) => { const v = e.target.value; setCustomCount(v); setShotCount(v === '' ? 'auto' : Number(v)) }} className="w-20 bg-surface-strong border border-edge rounded-md px-2 py-0.5 text-caption-sm text-primary outline-none nodrag" />
          </div>
        </div>

        <button
          onClick={async () => {
            setScriptLoading(true)
            try {
              await callbacks.onGenerateScript?.()
            } finally {
              setScriptLoading(false)
            }
          }}
          disabled={scriptLoading}
          className="flex items-center justify-center gap-2 w-full py-2.5 bg-surface-hover hover:bg-surface-hover-2b text-primary text-body-xs font-medium rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {scriptLoading ? <Loader2 size={13} className="animate-spin" /> : <span>⚡</span>}
          {scriptLoading ? '生成中…' : '生成分镜脚本'}
        </button>
      </div>

      {/* 右栏表格 */}
      <div className="flex flex-col min-h-0 min-w-0">
        <div className="flex items-center justify-between mb-1.5 text-caption-sm text-secondary">
          <span>分镜脚本 · 风格：{d.globalStyle || '未设置'}</span>
          <span>{shots.length} 镜</span>
        </div>
        {/* 表格用 table-fixed + 百分比列宽自适应右栏，不横向溢出，因此无 overflow 容器，下拉不被裁剪 */}
        <div className="border border-edge-faint rounded-lg">
          <table className="w-full table-fixed text-caption-sm border-collapse">
            <thead>
              <tr className="bg-surface-deep">
                {[['镜号', '4%'], ['时长', '5%'], ['画面描述', '29%'], ['景别', '7%'], ['光影', '14%'], ['对白/旁白', '16%'], ['音效', '12%'], ['运镜', '8%'], ['', '5%']].map(([h, w], k) => (
                  <th key={k} style={{ width: w }} className="text-left px-2 py-1.5 text-muted font-normal whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shots.length === 0 && (
                <tr><td colSpan={9} className="text-center py-10 text-muted-2 text-body-xs">输入剧情后点「生成分镜脚本」，自动生成分镜表格</td></tr>
              )}
              {shots.map((s, i) => (
                <tr key={s.id} className="hover:bg-surface-raised">
                  <td className="px-1 py-1.5 text-body whitespace-nowrap">{s.index}</td>
                  <td className="px-1 py-1.5 whitespace-nowrap">
                    <input value={parseShotSeconds(s.duration)} onChange={(e) => patchShot(i, 'duration', `${parseShotSeconds(e.target.value)}s`)} className="w-8 bg-transparent text-body text-caption-sm outline-none nodrag" />
                  </td>
                  <td className="px-2 py-1.5 align-top" title="双击编辑">
                    <div className="text-primary break-words cursor-text hover:bg-surface-1 rounded px-1 -mx-1 whitespace-normal" onDoubleClick={() => openField(i, 'description', '画面描述')} dangerouslySetInnerHTML={{ __html: hlAt(s.description, (d.assets || []).map((a) => a.name)) || '<span class="text-muted-2">双击编辑画面描述</span>' }} />
                  </td>
                  <td className="px-1.5 py-1.5 whitespace-nowrap"><DropTable opts={SHOT_TYPES} val={s.shotType} onPick={(v) => patchShot(i, 'shotType', v)} /></td>
                  <td className="px-1.5 py-1.5 whitespace-nowrap"><DropTable opts={LIGHTS} val={s.lighting} onPick={(v) => patchShot(i, 'lighting', v)} /></td>
                  <td className="px-2 py-1.5"><div className="text-body line-clamp-2 break-words cursor-text hover:bg-surface-1 rounded px-1 -mx-1" title="双击编辑" onDoubleClick={() => openDlg(i)}>{dialogueText(s.dialogue) || <span className="text-muted-2">双击编辑</span>}</div></td>
                  <td className="px-2 py-1.5"><div className="text-body line-clamp-2 break-words cursor-text hover:bg-surface-1 rounded px-1 -mx-1" title="双击编辑" onDoubleClick={() => openField(i, 'sound', '音效')}>{s.sound || <span className="text-muted-2">双击编辑</span>}</div></td>
                  <td className="px-1.5 py-1.5 whitespace-nowrap"><DropTable opts={MOTIONS} val={s.motion} onPick={(v) => patchShot(i, 'motion', v)} /></td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center justify-end gap-1">
                      {i > 0 && (
                        <button
                          className={`${s.tailFrameVariantsLoading ? 'text-muted' : s.usePrevShotVideoTail ? 'text-emerald-400' : 'text-muted hover:text-white'}`}
                          title={s.usePrevShotVideoTail ? '视觉起点已锁定于上一镜尾帧' : '生成/查看尾帧变体'}
                          onClick={() => openTailFrame(s.id)}
                        >
                          {s.tailFrameVariantsLoading ? <Loader2 size={12} className="animate-spin" /> : s.usePrevShotVideoTail ? <Link2 size={12} /> : <Film size={12} />}
                        </button>
                      )}
                      <button className="text-gray-600 hover:text-red-400" title="删除" onClick={() => delShot(i)}><Trash2 size={11} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="self-start flex items-center gap-1 px-2 py-1 mt-2 text-caption-sm text-secondary hover:text-white hover:bg-surface-1 rounded" onClick={addShot}><Plus size={11} /> 添加镜头</button>
      </div>

      {/* 双击字段编辑弹窗：与提示词弹窗同一套素雅暗色语言（无边框大留白编辑区，参考 FullscreenEditor 风格） */}
      {editing && (
        <ScriptBoxModal title="" onClose={() => setEditing(null)} onOk={commitField} width={520} bodyClass="flex flex-col flex-1 min-h-0 p-0">
          <div className="flex-1 flex flex-col min-h-0 px-5 pt-4 pb-3">
            <textarea autoFocus value={editVal} onChange={(e) => setEditVal(e.target.value)} className="flex-1 w-full bg-transparent outline-none resize-none rounded-lg px-0 py-3.5 text-primary custom-scrollbar nodrag nowheel transition-colors" style={{ fontSize: '14px', lineHeight: 1.8 }} />
            <div className="text-caption-sm text-muted-2 shrink-0 pt-2">提示：用 @资产名 引用，如 @小马</div>
          </div>
        </ScriptBoxModal>
      )}

      {/* 对白编辑器：同素雅暗色语言（无边框大留白编辑区） */}
      {dlgEditing !== null && (
        <ScriptBoxModal title="" onClose={() => setDlgEditing(null)} onOk={commitDlg} width={520} bodyClass="flex flex-col flex-1 min-h-0 p-0">
          <div className="flex-1 flex flex-col min-h-0 px-5 pt-4 pb-3">
            <textarea autoFocus value={dlgText} onChange={(e) => setDlgText(e.target.value)} placeholder="每行一条：角色名：台词（旁白写：旁白：内容）" className="flex-1 w-full bg-transparent outline-none resize-none rounded-lg px-0 py-3.5 text-primary placeholder:text-muted-2 custom-scrollbar nodrag nowheel transition-colors" style={{ fontSize: '14px', lineHeight: 1.8 }} />
          </div>
        </ScriptBoxModal>
      )}

      {/* 尾帧变体浮层（P1-1）：展示 original + composed 变体，选帧写回视觉起点 */}
      {tfShotId !== null && (() => {
        const tfShot = shots.find((x) => x.id === tfShotId)
        if (!tfShot) { setTfShotId(null); return null }
        const variants = Array.isArray(tfShot.prevTailFrameVariants) ? tfShot.prevTailFrameVariants : []
        return (
          <ScriptBoxModal title={`镜头${tfShot.index} · 尾帧变体（视觉起点）`} onClose={() => setTfShotId(null)}>
            {tfShot.tailFrameVariantsLoading && (
              <div className="flex items-center gap-2 py-3 text-secondary"><Loader2 size={14} className="animate-spin" /> 正在抽帧并生成变体…</div>
            )}
            {!tfShot.tailFrameVariantsLoading && tfShot.tailFrameVariantsError && (
              <div className="text-red-400 text-caption-sm mb-2">{tfShot.tailFrameVariantsError}</div>
            )}
            <div className="flex flex-wrap gap-2">
              {variants.map((v) => (
                <button
                  key={v.id}
                  className={`flex flex-col items-center gap-1 border rounded-lg p-2 ${tfShot.selectedTailFrameVariantId === v.id ? 'border-white/60 bg-surface-hover' : 'border-edge hover:border-edge-strong'}`}
                  onClick={() => selectTailFrame(tfShotId, v, true)}
                >
                  <img src={v.imageUrl ? render(v.imageUrl) : ''} alt="" className="w-24 h-16 object-cover rounded" />
                  <span className="text-caption-xs text-secondary">{v.id === 'original' ? '原始尾帧' : '重构变体'}</span>
                </button>
              ))}
              {!tfShot.tailFrameVariantsLoading && variants.length === 0 && (
                <div className="text-caption text-muted w-full">
                  {tfShot.tailFrameVariantsError ? '变体生成失败，可重试。' : '尚未生成变体，请点击「生成变体」。'}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between mt-3">
              <button
                className={`text-caption-sm px-2 py-1 rounded border ${tfShot.usePrevShotVideoTail ? 'border-white/40 text-white' : 'border-edge text-secondary hover:border-edge-strong'}`}
                onClick={() => selectTailFrame(tfShotId, null, false)}
              >不使用尾帧</button>
              {!tfShot.tailFrameVariantsLoading && (
                <button className="text-caption-sm px-2 py-1 rounded border border-edge text-body hover:border-edge-strong" onClick={() => callbacks.onGenerateTailFrameVariants?.(tfShotId)}>重新生成变体</button>
              )}
            </div>
          </ScriptBoxModal>
        )
      })()}
    </div>
  )
}

/** 表格下拉（景别/光影/音效/运镜），用 base 的 useOutsideClick 自动关闭 */
function DropTable({ opts, val, onPick }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useOutsideClick(ref, open, () => setOpen(false))
  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button className="w-full text-left text-body text-caption-sm px-1.5 py-0.5 rounded hover:bg-surface-hover line-clamp-2 break-words block" title={val || '选择'} onClick={() => setOpen(!open)}>{val || '选择'}</button>
      {open && (
        <div className="absolute z-modal mt-1 bg-surface-menu border border-edge rounded-lg shadow-2xl py-1 min-w-[90px]">
          {opts.map((o) => (
            <button key={o} className="block w-full text-left px-2.5 py-1 text-caption-sm text-body hover:bg-surface-hover" onClick={() => { onPick(o); setOpen(false) }}>{o}</button>
          ))}
        </div>
      )}
    </div>
  )
}


