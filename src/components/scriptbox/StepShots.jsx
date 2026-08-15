import React, { useState, useRef } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { SHOT_TYPES, LIGHTS, SOUNDS, MOTIONS, dialogueText, hlAt } from '../base/scriptBoxPrompts.js'
import { useOutsideClick } from '../base/hooks.js'

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

  const setStory = (story) => updateData({ story })
  const setStyle = (globalStyle) => updateData({ globalStyle })
  const setShotCount = (shotCount) => updateData({ shotCount })
  const setCustomCount = (customCount) => updateData({ customCount })

  // 更新单个分镜字段
  const patchShot = (idx, field, val) => {
    const shots2 = shots.map((s, i) => (i === idx ? { ...s, [field]: val } : s))
    updateData({ shots: shots2 })
  }

  // 对白数组 → 文本（可编辑）
  const dlgToText = (arr) => {
    const list = Array.isArray(arr) ? arr : []
    return list.map((x) => `${x.role || '台词'}：${x.text}`).join('\n')
  }
  const textToDlg = (text) =>
    text
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => {
        const m = l.match(/^([^：:]+)[：:](.+)$/)
        return m ? { kind: '台词', role: m[1].trim(), text: m[2].trim() } : { kind: '台词', role: '', text: l.trim() }
      })

  const openField = (idx, field, title) => { setEditing({ idx, field, title }); setEditVal(String(shots[idx]?.[field] ?? '')) }
  const commitField = () => {
    if (editing) patchShot(editing.idx, editing.field, editVal)
    setEditing(null)
  }
  const openDlg = (idx) => { setDlgEditing(idx); setDlgText(dlgToText(shots[idx]?.dialogue)) }
  const commitDlg = () => { if (dlgEditing !== null) patchShot(dlgEditing, 'dialogue', textToDlg(dlgText)); setDlgEditing(null) }

  const addShot = () => {
    const last = shots[shots.length - 1]
    const newShot = {
      id: (last?.id || 0) + 1,
      index: shots.length + 1,
      duration: '3s',
      description: '双击编辑画面描述（@引用资产）',
      shotType: '中景',
      lighting: '自然光',
      dialogue: [],
      sound: '环境音',
      motion: '固定',
      grid: 0,
      prompt: '',
      videoPrompt: '',
      promptLoading: false,
      connImg: false,
      connVid: false
    }
    updateData({ shots: [...shots, newShot] })
  }
  const delShot = (idx) => {
    const shots2 = shots.filter((_, i) => i !== idx).map((s, i) => ({ ...s, index: i + 1 }))
    updateData({ shots: shots2 })
  }

  return (
    <div className="grid grid-cols-[190px_1fr] gap-4">
      {/* 左栏 */}
      <div className="flex flex-col gap-3">
        <div>
          <div className="text-caption-sm text-gray-400 mb-1.5">统一风格</div>
          <input value={d.globalStyle || ''} onChange={(e) => setStyle(e.target.value)} className="w-full bg-surface-strong border border-edge rounded-md px-2 py-1 text-caption-sm text-gray-200 outline-none nodrag" placeholder="如：中世纪童话 皮克斯3D" />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {(d.styleChips || []).map((c) => (
              <button key={c} onClick={() => setStyle(c)} className={`px-2 py-0.5 text-caption rounded-md border ${d.globalStyle === c ? 'border-white/40 text-white bg-surface-hover' : 'border-edge text-gray-400 hover:border-edge-strong'}`}>{c}</button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-caption-sm text-gray-400 mb-1.5">剧情</div>
          <textarea value={d.story || ''} onChange={(e) => setStory(e.target.value)} placeholder="输入你的故事……" className="w-full h-32 bg-surface-strong border border-edge rounded-lg p-2.5 text-body-xs text-gray-200 outline-none resize-none custom-scrollbar nodrag nowheel" />
        </div>

        <div>
          <div className="text-caption-sm text-gray-400 mb-1.5">镜头数量</div>
          <div className="flex gap-1">
            {[['auto', '自动'], [10, '10'], [20, '20'], [30, '30'], [50, '50']].map(([v, l]) => (
              <button key={String(v)} onClick={() => setShotCount(v)} className={`px-2 py-0.5 text-caption rounded-md border ${String(d.shotCount) === String(v) ? 'border-white/40 text-white bg-surface-hover' : 'border-edge text-gray-400'}`}>{l}</button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="text-caption text-gray-500">自定义</span>
            <input type="number" min="1" max="300" placeholder="1~300" value={d.customCount || ''} onChange={(e) => { setCustomCount(e.target.value); setShotCount('custom') }} className="w-20 bg-surface-strong border border-edge rounded-md px-2 py-0.5 text-caption-sm text-gray-200 outline-none nodrag" />
          </div>
        </div>

        <button
          onClick={() => callbacks.onGenerateScript?.()}
          className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#27272a] hover:bg-[#313135] text-gray-200 text-body-xs font-medium rounded-lg transition-colors"
        >
          <span>⚡</span> 生成分镜脚本
        </button>
      </div>

      {/* 右栏表格 */}
      <div className="flex flex-col min-h-0 min-w-0">
        <div className="flex items-center justify-between mb-1.5 text-caption-sm text-gray-400">
          <span>分镜脚本 · 风格：{d.globalStyle || '未设置'}</span>
          <span>{shots.length} 镜</span>
        </div>
        {/* 表格用 table-fixed + 百分比列宽自适应右栏，不横向溢出，因此无 overflow 容器，下拉不被裁剪 */}
        <div className="border border-edge-faint rounded-lg">
          <table className="w-full table-fixed text-caption-sm border-collapse">
            <thead>
              <tr className="bg-[#171717]">
                {[['镜号', '5%'], ['时长', '6%'], ['画面描述', '26%'], ['景别', '9%'], ['光影', '11%'], ['对白/旁白', '18%'], ['音效', '11%'], ['运镜', '10%'], ['', '4%']].map(([h, w], k) => (
                  <th key={k} style={{ width: w }} className="text-left px-2 py-1.5 text-gray-500 font-normal whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shots.length === 0 && (
                <tr><td colSpan={9} className="text-center py-10 text-gray-600 text-body-xs">输入剧情后点「生成分镜脚本」，自动生成分镜表格</td></tr>
              )}
              {shots.map((s, i) => (
                <tr key={s.id} className="hover:bg-surface-raised">
                  <td className="px-1 py-1.5 text-gray-300 whitespace-nowrap">{s.index}</td>
                  <td className="px-1 py-1.5 whitespace-nowrap">
                    <input value={parseInt(s.duration) || 3} onChange={(e) => patchShot(i, 'duration', `${parseInt(e.target.value) || 3}s`)} className="w-8 bg-transparent text-gray-300 text-caption-sm outline-none nodrag" />
                  </td>
                  <td className="px-2 py-1.5" title="双击编辑">
                    <div className="text-gray-200 line-clamp-2 break-words cursor-text hover:bg-surface-1 rounded px-1 -mx-1" onDoubleClick={() => openField(i, 'description', '画面描述')} dangerouslySetInnerHTML={{ __html: hlAt(s.description) || '<span class="text-gray-600">双击编辑画面描述</span>' }} />
                  </td>
                  <td className="px-1.5 py-1.5 whitespace-nowrap"><DropTable opts={SHOT_TYPES} val={s.shotType} onPick={(v) => patchShot(i, 'shotType', v)} /></td>
                  <td className="px-1.5 py-1.5 whitespace-nowrap"><DropTable opts={LIGHTS} val={s.lighting} onPick={(v) => patchShot(i, 'lighting', v)} /></td>
                  <td className="px-2 py-1.5"><div className="text-gray-300 truncate cursor-text hover:bg-surface-1 rounded px-1 -mx-1" title="双击编辑" onDoubleClick={() => openDlg(i)}>{dialogueText(s.dialogue) || <span className="text-gray-600">双击编辑</span>}</div></td>
                  <td className="px-1.5 py-1.5 whitespace-nowrap"><DropTable opts={SOUNDS} val={s.sound} onPick={(v) => patchShot(i, 'sound', v)} /></td>
                  <td className="px-1.5 py-1.5 whitespace-nowrap"><DropTable opts={MOTIONS} val={s.motion} onPick={(v) => patchShot(i, 'motion', v)} /></td>
                  <td className="px-2 py-1.5"><button className="text-gray-600 hover:text-red-400" title="删除" onClick={() => delShot(i)}><Trash2 size={11} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="self-start flex items-center gap-1 px-2 py-1 mt-2 text-caption-sm text-gray-400 hover:text-white hover:bg-surface-1 rounded" onClick={addShot}><Plus size={11} /> 添加镜头</button>
      </div>

      {/* 双击字段编辑弹窗 */}
      {editing && (
        <Modal title={`编辑${editing.title}`} onClose={() => setEditing(null)}>
          <textarea autoFocus value={editVal} onChange={(e) => setEditVal(e.target.value)} className="w-full h-32 bg-surface-strong border border-edge rounded-lg p-2 text-body-xs text-gray-200 outline-none custom-scrollbar nodrag nowheel" />
          <div className="text-caption text-gray-500 mt-1">提示：用 @资产名 引用，如 @小马</div>
          <ModalFooter onCancel={() => setEditing(null)} onOk={commitField} />
        </Modal>
      )}

      {/* 对白编辑器 */}
      {dlgEditing !== null && (
        <Modal title="编辑对白/旁白" onClose={() => setDlgEditing(null)}>
          <textarea autoFocus value={dlgText} onChange={(e) => setDlgText(e.target.value)} placeholder="每行一条：角色名：台词（旁白写：旁白：内容）" className="w-full h-32 bg-surface-strong border border-edge rounded-lg p-2 text-body-xs text-gray-200 outline-none custom-scrollbar nodrag nowheel" />
          <ModalFooter onCancel={() => setDlgEditing(null)} onOk={commitDlg} />
        </Modal>
      )}
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
      <button className="w-full text-left text-gray-300 text-caption-sm px-1.5 py-0.5 rounded hover:bg-surface-hover whitespace-nowrap" onClick={() => setOpen(!open)}>{val || '选择'}</button>
      {open && (
        <div className="absolute z-modal mt-1 bg-surface-menu border border-edge rounded-lg shadow-2xl py-1 min-w-[90px]">
          {opts.map((o) => (
            <button key={o} className="block w-full text-left px-2.5 py-1 text-caption-sm text-gray-300 hover:bg-surface-hover" onClick={() => { onPick(o); setOpen(false) }}>{o}</button>
          ))}
        </div>
      )}
    </div>
  )
}

/** 通用弹窗容器（相对剧本盒子主容器定位，节点内部面板） */
function Modal({ children, onClose, title }) {
  return (
    <div className="absolute inset-0 z-modal flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-surface-menu border border-edge rounded-xl p-4 w-[440px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-body-xs text-gray-300 mb-2">{title}</div>
        {children}
      </div>
    </div>
  )
}
function ModalFooter({ onCancel, onOk }) {
  return (
    <div className="flex justify-end gap-2 mt-3">
      <button className="px-3 py-1 text-caption-sm text-gray-400 hover:text-white" onClick={onCancel}>取消</button>
      <button className="px-3 py-1 text-caption-sm bg-surface-hover hover:bg-surface-hover-strong text-gray-200 rounded-md" onClick={onOk}>确定</button>
    </div>
  )
}
