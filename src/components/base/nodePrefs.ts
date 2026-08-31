/**
 * 节点「上次参数」记忆（跨节点 / 跨会话 / 跨窗口）。
 *
 * 目的：新建节点时默认用「上次选择」的参数（模型/比例/尺寸/张数等），
 * 复刻原产品「记住上次选择」的体验，减少重复设置。
 *
 * ═══ 与官方多窗口 mutiwindow_* 的关系 ═══
 * 官方 H_.jsx 用一堆散落的 localStorage 键（`mutiwindow_discountvideo_size`、
 * `mutiwindow_prompt_aspectRatio`、`mutiwindow_text_model` 等）跨窗口同步各节点参数。
 * 本模块用**统一结构化键** `yimao_node_prefs` 实现同一件事（等价且更整洁）：
 *   - 读：新窗口/新节点初始化时读 localStorage → 拿到其他窗口存的最新参数
 *     （localStorage 天然跨标签页共享，故「新窗口默认参数一致」天然成立）
 *   - 写：改动参数时 setItem 持久化
 *
 * ═══ 为什么不做「实时 storage 监听」（另一个窗口改 → 本窗口已开节点实时跟变）═══
 * 1) 官方其实也只做了「读取兜底」，未对每个参数都挂 storage 监听实时同步；
 *    实时跟变不是官方的完整行为，复刻无依据。
 * 2) 实时监听会用外部事件改本窗口正在编辑的表单 state，容易造成输入框失焦、
 *    选中态丢失、打断用户正在进行的编辑，体验反而更差。
 * 3) 主要使用场景是「新开窗口延续上次参数」，读兜底已覆盖；实时多窗口并发编辑
 *    同一类节点参数是极低频场景。
 * 结论：只做「新窗口默认参数一致」，不做实时 storage 监听。若未来确有强诉求，
 * 可在本模块加一个 useNodePrefsStorageSync()：监听 storage 事件，仅当 key 命中且
 * 不是本窗口触发时 setPrefs 覆盖，注意用 e.newValue 且避免覆盖用户正在编辑的项。
 *
 * 用法（各节点通用）：
 *   const prefs = useNodePrefs('textNode', { model: 'lovart-chat' })  // 读上次 + 注入默认
 *   prefs.set({ model })                                              // 保存本次选择
 *   onChange={(model) => { setSelectedModel(model); prefs.set({ model }) }}
 *
 * 存储：localStorage 键 `yimao_node_prefs`，结构 { [nodeType]: { ...lastParams } }。
 * 接真系统：可改为后端 KV（app_settings / node_prefs），本模块是纯前端唯一数据源。
 */
import { useState, useCallback } from 'react'
import { contentGet, contentSet } from './contentStore.ts'

const STORAGE_KEY = 'yimao_node_prefs'

/** 节点上次参数存储形状：{ [key]: any }（值类型因节点而异，宽松以兼容存量） */
type NodePrefsMap = Record<string, any>
/** 节点类型 → data 键名 → 记忆键名 映射 */
type PrefsFieldMap = Record<string, Record<string, string>>

function loadAll(): NodePrefsMap {
  try {
    const parsed = contentGet(STORAGE_KEY)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * 【纯读取，无 React】读取某节点类型的上次参数（合并默认值）。
 * 用途：新建节点唯一入口 App.addNode 在「创建那一刻」把记忆值注入新节点的 data，
 * 使得记忆只影响「新建」节点、绝不反向污染已挂载/快照还原的存量节点。
 * 组件初始化不再读记忆做回退（见各节点 useState 的 ?? 常量），从根上消除污染。
 * @param {string} type 节点类型
 * @param {object} defaults 默认参数
 * @returns {object} 合并后的参数
 */
export function getNodePrefs(type: string, defaults: NodePrefsMap = {}): NodePrefsMap {
  return { ...defaults, ...(loadAll()[type] || {}) }
}

// data 键名 → 记忆键名 的映射（记忆里存的是官方口径，data 里是节点口径，如 selectedModel←model）
const PREFS_FIELDS: PrefsFieldMap = {
  promptNode: { selectedModel: 'model', aspectRatio: 'aspectRatio', imageSize: 'imageSize' },
  textNode: { selectedModel: 'model' },
  templateNode: { selectedModel: 'model', aspectRatio: 'aspectRatio' },
  discountVideoNode: { selectedModel: 'model', size: 'size', resolution: 'resolution', selectedSeconds: 'seconds' },
}
const PREFS_DEFAULTS: PrefsFieldMap = {
  promptNode: { model: '', aspectRatio: 'Auto', imageSize: '1K' },
  textNode: { model: '' },
  templateNode: { model: '', aspectRatio: '1:1' },
  discountVideoNode: { model: '', size: '16:9', resolution: '1080p', seconds: '10' },
}

/**
 * 【新建注入 · 纯函数】把「上次参数」记忆填进新节点的 data。
 * 仅在 data 未显式传该字段时注入（传入优先于记忆，如剧本盒子端口预填）；
 * 记忆只在「新建那一刻」影响节点，绝不碰已挂载/快照还原的存量节点。
 * 配合各节点 useState(data.x ?? 纯常量)（不再读记忆回退），从根上消除
 * 「记忆反向改写存量节点」的 bug。
 * @param {string} type 节点类型
 * @param {object} data 新建节点的 data（会被就地补默认，返回同一引用）
 * @returns {object} 注入后的 data
 */
export function injectNodePrefs(type: string, data: NodePrefsMap): NodePrefsMap {
  const fieldMap = PREFS_FIELDS[type]
  if (!fieldMap) return data
  const prefs = getNodePrefs(type, PREFS_DEFAULTS[type])
  for (const dataKey of Object.keys(fieldMap)) {
    if (data[dataKey] === undefined) data[dataKey] = prefs[fieldMap[dataKey]]
  }
  return data
}

/**
 * 读取某节点类型的上次参数（合并默认值）。
 * @param {string} type 节点类型，如 'textNode' / 'promptNode' / 'discountVideoNode'
 * @param {object} defaults 默认参数
 * @returns {{ prefs: object, set: (patch: object) => void }}
 */
export function useNodePrefs(type: string, defaults: NodePrefsMap = {}): { prefs: NodePrefsMap; set: (patch: NodePrefsMap) => void } {
  const [prefs, setPrefs] = useState<NodePrefsMap>(() => {
    const all = loadAll()
    return { ...defaults, ...(all[type] || {}) }
  })

  const set = useCallback(
    (patch: NodePrefsMap) => {
      setPrefs((prev) => {
        const next = { ...prev, ...patch }
        // 持久化
        try {
          const all = loadAll()
          all[type] = next
          contentSet(STORAGE_KEY, all)
        } catch { /* ignore */ }
        return next
      })
    },
    [type]
  )

  return { prefs, set }
}
