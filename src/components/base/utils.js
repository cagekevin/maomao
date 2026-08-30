import { useEffect } from 'react'

/**
 * 通用工具集中实现 —— 唯一入口，禁止散落手写替代。
 *
 * 约定：
 *  - deepClone / formatTime / debounce / throttle 一律从本文件 import
 *  - 业务代码禁止手写 `JSON.parse(JSON.stringify())`、`setTimeout` 防抖、时间格式化
 *  - ID 生成不在此，统一走 ./idGen.js 的 generateId
 */

/** JSON 深拷贝（通用业务对象；含函数/Date/循环引用者请勿用） */
export function deepClone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value))
}

/** data: URL → Blob（base64 编码）。缺省 MIME 从 data: meta 段解析（失败回退 octet-stream）。
 * 收口：dataURL 转 Blob 统一在此（曾散落 filesApi / imageCompress / imageUpscale / FaceMosaicNode 四份，
 * 其中 imageCompress 因法定「imageUrl↔imageCompress 禁反向 import」不能依赖 imageUrl，故放本通用的叶模块）。
 * @param {string} dataUrl data:...;base64,xxx
 * @param {string} [mime] 可选 MIME 覆盖（调用方已知目标类型时传，如 'image/png'）
 */
export function dataUrlToBlob(dataUrl, mime) {
  const idx = dataUrl.indexOf(',')
  const meta = dataUrl.slice(0, idx)
  const raw = dataUrl.slice(idx + 1)
  const type = mime || meta.match(/^data:([^;]+)/)?.[1] || 'application/octet-stream'
  const bin = atob(raw)
  const len = bin.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type })
}

/** 多路图片源合并去重（PromptNode/TemplateNode refImages 公共实现）：
 *  按 id（缺省回退 url）去重，保留首次出现；无 key（id/url 皆空）的项丢弃。
 *  解决同一批资产图经「连线上游 + data.images」双路进入导致渲染 key 重复 / 图显示两份。 */
export function mergeRefImages(...groups) {
  const seen = new Set()
  const merged = []
  groups.forEach((g) => {
    ;(Array.isArray(g) ? g : []).forEach((im) => {
      const key = im && (im.id ?? im.url)
      if (!key || seen.has(key)) return
      seen.add(key)
      merged.push(im)
    })
  })
  return merged
}

/** 从素材取显示名（统一兼容 MaterialStrip 的 onInsert 两种形态）：
 *  - 对象 { label, ... }（富文本芯片插入，MaterialStrip 现传完整对象）→ 返回 label
 *  - 字符串 name（旧式纯文本插入回调）→ 原样返回
 * 供未升级节点的 onInsert 字符串拼接回调复用，避免把对象拼成 [object Object]。 */
export function assetLabel(asset) {
  if (typeof asset === 'string') return asset
  return (asset && asset.label) || ''
}

/** 有效提示词 = 本地 prompt + 上游文本合并（PromptNode/TextNode/TemplateNode/DiscountVideoNode 公共实现）：
 *  本地主提示词在前，上游文本（refTexts）去空后追加在后，一起参与生成。返回 '' 表示空。 */
export function buildEffectivePrompt(localPrompt, refTexts) {
  const upstream = (refTexts || [])
    .map((t) => (t.text || '').trim())
    .filter(Boolean)
    .join('\n')
  return [String(localPrompt ?? '').trim(), upstream].filter(Boolean).join('\n') || ''
}

/** 通用数值钳制：把 v 钳到 [lo, hi]（lo/hi 可缺省）。收口：各节点不得各写 Math.max/min 样板。 */
export function clamp(v, lo, hi) {
  const lower = lo == null ? -Infinity : lo
  const upper = hi == null ? Infinity : hi
  return Math.max(lower, Math.min(upper, v))
}

/** 视频时长钳制（DiscountVideoNode 滑块公共实现）：非法/0 → 下界兜底；越界钳到 [min,max]。 */
export function clampSeconds(value, min = 4, max = 15) {
  return clamp(Number(value) || min, min, max)
}

/** 文件名安全化（磁盘文件名 base）：trim → 非法字符替换为 sep → 可选去尾部扩展名 → 空白替换为 sep。
 * 收口：各处文件名清洗统一走这里（assetStore.safeAssetBase / filesApi.safeName / videoEngine 等），
 * 不再各写 replace 样板。处理顺序与 assetStore.safeAssetBase 逐字节一致（其行为有单测钉住）。
 * @param {string} [name] 名字
 * @param {{sep?:string, stripExt?:boolean, fallback?:string}} [o]
 *  - sep 非法字符/空白替换成的字符，默认 '_'；stripExt 是否去掉尾部 `.ext`，默认 false；fallback 为空时回退名，默认 ''
 * @returns {string} */
export function safeFileName(name, o = {}) {
  const { sep = '_', stripExt = false, fallback = '' } = o
  let b = String(name ?? '').trim()
  b = b.replace(/[\\/:*?"<>|]/g, sep)
  if (stripExt) b = b.replace(/\.[a-z0-9]{2,5}$/i, '')
  b = b.replace(/\s+/g, sep)
  return b || fallback
}

/**
 * 存储键模板 → 编译后正则（模块级缓存）。收口（2026-08-30）：contentStore / kvStore / storageQuota
 * 原各有逐字相同的 getPatternRegex，统一收敛到本函数，新增使用方一律 import 本函数、禁止再复制。
 * 语义：把 STORAGE_KEYS 的 `{xxx}` 动态键模板（如 canvas-state-v1-{projectId}）编译成
 * `^canvas-state-v1-.+$`；模板数量有限（契约层登记量级），按模板 lazy 编译一次缓存，天然防无限膨胀。
 * @param {string} template 含 {占位} 的模板
 * @returns {RegExp}
 */
const patternRegexCache = new Map()
export function compilePatternRegex(template) {
  let re = patternRegexCache.get(template)
  if (!re) {
    const parts = template.split(/\{[^}]+\}/)
    const escaped = parts.map((p) => p.replace(/[.+^$()|[\]\\]/g, '\\$&')).join('.+')
    re = new RegExp('^' + escaped + '$')
    patternRegexCache.set(template, re)
  }
  return re
}

/**
 * 时间格式化。opts：
 *  - 默认 `{ locale: 'zh-CN' }` → `new Date(ts).toLocaleString('zh-CN', { hour12: false })`（TaskCenter）
 *  - `{ mode: 'time' }` → HH:mm:ss（logger）
 *  - `{ mode: 'file' }` → yyyymmdd_HHmmss，落盘文件名时间戳（filesApi）
 */
export function formatTime(ts = Date.now(), opts = {}) {
  const d = typeof ts === 'number' || typeof ts === 'string' ? new Date(ts) : ts
  if (Number.isNaN(d.getTime())) return ''
  if (opts.mode === 'file') {
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  }
  if (opts.mode === 'time') {
    const pad = (n) => String(n).padStart(2, '0')
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }
  try { return d.toLocaleString('zh-CN', { hour12: false }) } catch { return '' }
}

/**
 * 格式化字节大小（存储监控专用，B/KB/MB/GB）。
 * 与 videoEngine.formatBytes（仅 B/KB/MB，视频文件用）语义不同：本版覆盖到 GB 级存储占用，
 * 并做非法值兜底（负数/NaN → '0 B'）。存储占用口径统一走本函数，禁止散落手写。
 */
export function formatBytes(bytes) {
  const n = Number(bytes)
  if (!Number.isFinite(n) || n <= 0) return '0 B'
  if (n < 1024) return `${n} B`
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1073741824) return `${(n / 1048576).toFixed(2)} MB`
  return `${(n / 1073741824).toFixed(2)} GB`
}

/** 防抖（返回包装函数 + cancel + flush） */
export function debounce(fn, ms) {
  let timer = null
  let lastArgs = null
  const wrapped = (...args) => {
    lastArgs = args
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => { timer = null; fn(...args) }, ms)
  }
  wrapped.cancel = () => { if (timer) { clearTimeout(timer); timer = null } }
  // flush：立即执行最后一次待提交（失焦/卸载落盘兜底，避免防抖窗口内丢数据）
  wrapped.flush = () => {
    if (timer) { clearTimeout(timer); timer = null }
    if (lastArgs) fn(...lastArgs)
    lastArgs = null
  }
  return wrapped
}

/**
 * IME 感知的输入提交工厂（P2/P12 收口原语，替代散落的手写 setTimeout 防抖）。
 *
 * 场景：中文/日文输入法组字期间，onChange 会携带「组字中间态」频繁触发；
 * 若直接防抖提交（搜索/落盘/写 store），会拿未组完的拼音去搜索，体验抖动。
 * 本工厂用 isComposing 门控：组字中仅缓存最新值不提交；组字结束立即提交一次；
 * 非组字输入走 debounce 合并（连续输入窗口内只提交 1 次，提交最新值）。
 *
 * 用法（与 AgentPanel isComposing 范式对齐）：
 *   const submit = createImeInput((v) => setQuery(v), 200)
 *   <input
 *     value={q}
 *     onChange={(e) => submit.onChange(e.target.value, e.nativeEvent.isComposing)}
 *     onCompositionEnd={(e) => submit.onCompositionEnd(e.target.value)}
 *   />
 *
 * 语义：
 *  - onChange(value, composing=true)：组字中 → 仅缓存，不提交、不调度。
 *  - onChange(value, composing=false)：非组字 → 重置防抖窗口，窗口内多次输入只提交 1 次（最新值）。
 *  - onCompositionEnd(value)：组字结束 → 立即提交一次（补触发，避免组字完成不提交）。
 *  - cancel()：取消未执行的提交（卸载/重置兜底）。
 */
export function createImeInput(submit, ms = 200) {
  const d = debounce(submit, ms)
  let latest = ''
  return {
    onChange(value, composing = false) {
      latest = value
      if (composing) {
        d.cancel() // 组字中：取消可能存在的待提交（避免拼音中间态触发）
        return
      }
      d(latest)
    },
    onCompositionEnd(value) {
      latest = value
      d.cancel()
      submit(latest) // 组字结束立即提交一次
    },
    cancel() {
      d.cancel()
    }
  }
}

/** 节流（返回包装函数 + cancel） */
export function throttle(fn, ms) {
  let last = 0
  let timer = null
  let lastArgs = null
  const wrapped = (...args) => {
    const now = Date.now()
    const remain = ms - (now - last)
    lastArgs = args
    if (remain <= 0) {
      if (timer) { clearTimeout(timer); timer = null }
      last = now
      fn(...args)
    } else if (!timer) {
      timer = setTimeout(() => { timer = null; last = Date.now(); fn(...lastArgs) }, remain)
    }
  }
  wrapped.cancel = () => { if (timer) { clearTimeout(timer); timer = null } }
  return wrapped
}

/**
 * rAF 合并原语（P3 收口：高频 pointermove/wheel 合并到每帧只执行 1 次）。
 *
 * 场景：拖拽/缩放手柄/滚轮缩放等高频事件，若每个事件都同步做状态更新/样式写入，
 * 一帧内会重复计算多次，浪费主线程。本原语只记录「最新入参」，由 requestAnimationFrame
 * 合并到下一帧统一执行一次 fn（last-args-wins）。
 *
 * 用法（对齐方案 P3 注意点）：
 *  - 入参是「绝对值/最新值」时直接透传：`const batch = createRafBatch((x, y) => ...)`，move 里 `batch(e.clientX, e.clientY)`。
 *  - 入参是「累计增量」时：move 里累加到 pending 再 `batch(pending)`，fn 里消费后清零（保证每帧增量不丢）。
 *  - end/卸载前必须 flush() 最后一次状态，否则松手位置差一帧；真正结束用 cancel() 丢弃待执行帧。
 *
 * 返回：
 *  - wrapped(...args)：记录最新入参并调度一帧
 *  - wrapped.flush()：取消待执行帧并立即执行最后一次（拖拽结束收尾）
 *  - wrapped.cancel()：丢弃未执行的最后一帧（真正结束/卸载）
 */
export function createRafBatch(fn) {
  let rafId = null
  let lastArgs = null
  const wrapped = (...args) => {
    lastArgs = args
    if (rafId != null) return
    rafId = requestAnimationFrame(() => {
      rafId = null
      const a = lastArgs
      lastArgs = null
      if (a) fn(...a)
    })
  }
  wrapped.flush = () => {
    if (rafId != null) { cancelAnimationFrame(rafId); rafId = null }
    const a = lastArgs
    lastArgs = null
    if (a) fn(...a)
  }
  wrapped.cancel = () => {
    if (rafId != null) { cancelAnimationFrame(rafId); rafId = null }
    lastArgs = null
  }
  return wrapped
}

/**
 * effect 内防抖 hook（封装「依赖变化 → 重建定时器 → cleanup 清除」模式）。
 * 等价于手写 `useEffect(() => { const t = setTimeout(fn, ms); return () => clearTimeout(t) }, deps)`。
 * condition=false 时跳过（不设定时器），等价于手写 effect 里提前 `if (cond) return`。
 */
export function useDebouncedEffect(fn, deps, delay, condition = true) {
  useEffect(() => {
    if (!condition) return undefined
    const timer = setTimeout(fn, delay)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
