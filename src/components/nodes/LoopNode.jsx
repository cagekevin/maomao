import React, { useState, useRef, useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { Repeat, Play, ChevronDown } from 'lucide-react'
import NodeShell from '../base/NodeShell.jsx'
import { useConnectedInputs } from '../base/useConnectedInputs.js'
import { showToast, toastWarning } from '../base/toastStore.js' // 保留阻断校验提示
import { useSyncNodeData } from '../base/useSyncNodeData.js'
import { useOutsideClick } from '../base/hooks.js'
import { generateId } from '../base/idGen.js'
import { buildSpawnNodes, spawnAndCommit } from '../base/deriveNodes.js'
import { useCanvasEdges } from '../base/CanvasEdgesContext.jsx'

/**
 * 循环节点（逐像素对齐大雄 Infinite-Canvas 的 smart-loop）。
 *
 * 【它解决什么】把上游一段长文案（文本节点），切成多段，每段生成一个生图节点。
 *
 * 【UI 结构（紧凑，符合 maomao 风格）】
 *  右上角(拆分方式下拉) + 分段 prompt 列表(序号徽章 + 紧凑 textarea) + 底部(段数 + 运行)
 *
 * 【数据模型】
 *  - splitMethod: string             拆分方式（newline/number/ordinal/semicolon/json）
 *
 * 【运行行为】点「运行」→ 为上游 N 段文案，每段自动创建一个生图节点(promptNode)：
 *  - 该段文案填入生图节点 prompt；
 *  - 统一参考图（循环节点自己的上游图）塞进每个生图节点 data.images；
 *  - 自动连线：循环节点 → 生图节点（下游 useConnectedInputs 能读到上游依赖）。
 *  图由用户在那些生图节点里自己点「生成」。
 */

/**
 * 锚点分割：把上游文案切成多段。
 * 1. 优先按「数字序号」（1. 1、 1) 1）1．），序号后可有可无空格/换行）切；
 * 2. 再按「换行」切；
 * 3. 再按「分号/句号」等常见分隔切；
 * 4. 都不行则整段。
 * （对齐大雄 smartLoop 的「上游文案切段」，但放宽了分隔符后必须跟空格的限制，
 *   以兼容 `1.主图` / `1、主图` 这类无空格的常见写法。）
 */
export function splitSmartPromptItems(text) {
  const trimmed = String(text || '').trim()
  if (!trimmed) return []

  // ① 数字序号：1. / 1、 / 1) / 1） / 1．，后接任意空白（含无空白）直到下一个序号前
  const numbered = trimmed
    .split(/\s*(?:^|[\s;；\n])\d+\s*[.、)）．]\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (numbered.length >= 2) return numbered

  // ② 换行
  const lines = trimmed.split(/\r?\n+/).map((s) => s.trim()).filter(Boolean)
  if (lines.length >= 2) return lines

  // ③ 分号 / 句号 / 顿号 / 逗号（每段末尾常见分隔）
  const sepSplit = trimmed.split(/[;；。\n]/).map((s) => s.trim()).filter(Boolean)
  if (sepSplit.length >= 2) return sepSplit

  return [trimmed]
}

/** 拆分方式选项（用户可选的拆分形式） */
export const SPLIT_METHODS = [
  { key: 'newline', label: '按回车换行' },
  { key: 'number', label: '按序号 (1. 2. 3.)' },
  { key: 'ordinal', label: '按「第一张图」' },
  { key: 'semicolon', label: '按分号 ;' },
  { key: 'json', label: '按 JSON 数组' },
]

/** 按用户选定的方式切分上游文案为多段 */
export function splitByMethod(text, method) {
  const trimmed = String(text || '').trim()
  if (!trimmed) return []
  const clean = (list) => list.map((s) => String(s ?? '').trim()).filter(Boolean)
  switch (method) {
    case 'newline':
      return clean(trimmed.split(/\r?\n+/))
    case 'number':
      return splitSmartPromptItems(trimmed)
    case 'ordinal': {
      // 按「第N张图/第N个/第一张/第二张」等序数词切段
      const parts = trimmed.split(/(?=第[一二三四五六七八九十百千\d]+[张幅个]?(?:图|画面|卖点|分镜)?)/)
      return clean(parts)
    }
    case 'semicolon':
      return clean(trimmed.split(/[;；]/))
    case 'json': {
      try {
        const arr = JSON.parse(trimmed)
        return Array.isArray(arr) ? clean(arr.map(String)) : [trimmed]
      } catch {
        return [trimmed]
      }
    }
    default:
      return splitSmartPromptItems(trimmed)
  }
}

function LoopNode({ id, data, selected }) {
  // 上游连线：读取直接上游节点的文本（textNode 产出 data.text）
  const connected = useConnectedInputs(id)
  const { setNodes, setEdges, getNodes, getEdges } = useReactFlow()
  const history = useCanvasEdges()

  // 从 data 初始化（splitMethod=newline）
  const [splitMethod, setSplitMethod] = useState(data.splitMethod || 'newline')
  // overrides：用户对某段提示词的手动编辑（key=段 index），切换拆分方式/上游变化时清空
  const [overrides, setOverrides] = useState({})

  // 运行态
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  // 拆分方式下拉浮层开关
  const [showSplitMenu, setShowSplitMenu] = useState(false)
  const splitMenuRef = useRef(null)
  useOutsideClick(splitMenuRef, showSplitMenu, () => setShowSplitMenu(false))

  // 同步 Agent(update_node) 外部写入
  useSyncNodeData(data, { splitMethod: setSplitMethod })

  const patchData = useCallback((patch) => {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)))
  }, [id, setNodes])

  // 上游文案：聚合所有直接上游文本节点（对齐大雄 smartLoopInputPromptItems）
  const upstreamItems = (connected.texts || []).map((t) => String(t.text || '').trim()).filter(Boolean)
  const upstreamText = upstreamItems.join('\n')

  // 每段提示词：按用户选定的拆分方式实时切上游文案（每次切换 splitMethod 都会重新切段）
  const segments = upstreamText ? splitByMethod(upstreamText, splitMethod) : []

  // 最终显示/运行段：segments 基础上叠加用户手动编辑的 overrides（key=index）
  const displaySegs = segments.map((seg, i) => (overrides[i] != null ? overrides[i] : seg))

  // 切换拆分方式：清空手动编辑覆盖，让界面按新方式重新切段
  const changeSplitMethod = (m) => {
    setSplitMethod(m)
    setOverrides({})
    patchData({ splitMethod: m })
  }

  // 本段 prompt：替换《计数》/《总数》/《进度》token（对齐大雄 smartLoopPrompt）
  const promptForSegment = (seg, index) => {
    const total = displaySegs.length
    const num = index + 1
    return String(seg || '')
      .replaceAll('《计数》', String(num))
      .replaceAll('[计数]', String(num))
      .replaceAll('《总数》', String(total))
      .replaceAll('[总数]', String(total))
      .replaceAll('《进度》', `${num}/${total}`)
      .replaceAll('[进度]', `${num}/${total}`)
      .trim()
  }

  // 运行：为上游 N 段文案，每段自动创建一个生图节点(promptNode)，自动填好该段提示词、
  // 连好统一参考图（可选）、并自动连到循环节点。一个提示词对应一个生图节点。
  // 图由用户在那些下游生图节点里自己点「生成」（对齐 maomao 生图节点接上游文本/图片的机制）。
  const handleGenerate = () => {
    if (running) return
    // 逐段遍历全部显示段（N 段文案就建 N 个节点，count 只控制 UI 显示，不限制建节点数）
    const segs = displaySegs
    if (segs.length === 0) { toastWarning('没有可生成的提示词（请连接上游文本节点或手动填写每段提示词）'); return }

    // 统一参考图：循环节点从自己上游接到的图片（连线），塞给每个生图节点当参考图
    const refImages = (connected.images || []).map((img) => ({ url: img.url, name: img.label || `参考图 ${img.id || ''}` })).filter((x) => x.url)
    // 循环节点自身连线传到下游生图节点（让下游 useConnectedInputs 能读到上游文本/图片依赖）
    const me = (getNodes() || []).find((n) => n.id === id)
    const baseX = (me?.position?.x ?? 300) + (me?.measured?.width ?? 300) + 80
    const baseY = me?.position?.y ?? 200

    setRunning(true)
    setError('')

    const ts = Date.now()
    const specs = []
    segs.forEach((seg, i) => {
      const prompt = promptForSegment(seg, i)
      if (!prompt) return
      const nodeId = `loop-out-${id}-${i}-${ts}-${generateId('o')}`
      specs.push({
        id: nodeId,
        type: 'promptNode',
        position: { x: baseX, y: baseY + i * 750 },
        data: {
          prompt,                          // 该段文案填进生图节点提示词
          aspectRatio: '1:1',
          imageSize: '1K',
          ...(refImages.length ? { images: refImages } : {}),  // 统一参考图塞给每个生图节点
        },
        width: 420,
        height: 420,
      })
    })

    const spawned = buildSpawnNodes({ id, position: { x: baseX, y: baseY } }, specs)
    spawnAndCommit(spawned, { getNodes, getEdges, setNodes, setEdges, history })
    // 下游节点已生成在画布，结果可见，无需 toast
    setRunning(false)
  }

  // 分段编辑：写入手动覆盖 overrides（key=段 index）
  const updateSegment = (i, value) => {
    setOverrides((prev) => ({ ...prev, [i]: value }))
  }

  return (
    <NodeShell
      id={id}
      label={data.label}
      defaultTitle="循环"
      icon={<Repeat size={11} className="text-gray-500" />}
      selected={selected}
      handleVariant="small"
      minWidth={240}
      minHeight={180}
      aspectRatio={null}
      defaultHeight={280}
      titleRight={(
        <div className="relative flex items-center gap-1 nodrag" ref={splitMenuRef}>
          <button
            type="button"
            className="node-btn-settings"
            title="选择按什么形式拆分上游文案"
            onClick={(e) => { e.stopPropagation(); setShowSplitMenu((v) => !v) }}
          >
            <span>{SPLIT_METHODS.find((m) => m.key === splitMethod)?.label}</span>
            <ChevronDown size={11} />
          </button>
          {showSplitMenu && (
            <div className="absolute top-full right-0 mt-1 min-w-[9rem] w-max bg-surface-1 border border-edge rounded-lg shadow-popover p-1 z-dropdown flex flex-col max-h-60 overflow-y-auto custom-scrollbar nowheel nopan nodrag" onClick={(e) => e.stopPropagation()}>
              {SPLIT_METHODS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  className={`flex items-center gap-1.5 mb-1 last:mb-0 text-left px-2 py-1.5 text-caption-sm rounded-md transition-colors cursor-pointer ${splitMethod === m.key ? 'bg-surface-hover-strong text-white' : 'text-gray-400 hover:bg-surface-hover hover:text-gray-200'}`}
                  onMouseDown={(e) => { e.preventDefault(); changeSplitMethod(m.key); setShowSplitMenu(false) }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    >
      {/* 主面板（紧凑布局；bg-surface 作为内层内容底，让外边框有对比；不加 rounded-xl 避免嵌套圆角） */}
      <div className="relative w-full flex-1 min-h-0 flex flex-col gap-1.5 p-2 bg-surface drag-handle cursor-move">
        {/* 分段提示词列表 */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-0.5 nodrag nowheel">
          <div className="flex flex-col gap-1">
            {displaySegs.map((seg, i) => (
              <div key={i} className="flex items-start gap-1">
                <span className="w-4 h-4 mt-1 shrink-0 flex items-center justify-center rounded-full bg-surface-hover-strong border border-edge-muted text-caption text-gray-400">{i + 1}</span>
                  <textarea
                    id={`loop-prompt-${id}-${i}`}
                    className="flex-1 min-h-[36px] max-h-[72px] resize-none bg-input border border-edge rounded-md p-1.5 text-caption-sm text-gray-200 outline-none focus:border-blue-500 nodrag nowheel custom-scrollbar"
                    value={seg ?? ''}
                    placeholder="输入该段生图提示词"
                    onChange={(e) => updateSegment(i, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
            ))}
          </div>
        </div>

        {/* 底部：段数 + 运行（紧凑） */}
        <div className="flex items-center justify-between gap-1 pt-1 border-t border-edge-faint nodrag">
          {displaySegs.length > 0 && <span className="text-caption text-gray-500 shrink-0">{displaySegs.length} 段</span>}
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            <button className="node-btn-primary" type="button" onClick={(e) => { e.stopPropagation(); handleGenerate() }}>
              <Play size={12} fill="currentColor" /><span>运行</span>
            </button>
          </div>
        </div>

        {/* 错误提示 */}
        {error && <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-red-500 z-node-inner bg-canvas p-4 text-center pointer-events-none nodrag"><span className="text-caption-sm break-all">{error}</span></div>}
      </div>
    </NodeShell>
  )
}
export default React.memo(LoopNode)
