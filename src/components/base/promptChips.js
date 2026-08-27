/**
 * promptChips —— prompt 富文本的「芯片」纯逻辑层（无 React / 无 DOM 环境依赖，可单测）。
 *
 * 职责：把 prompt 里的 `@{id:label}` 素材引用与 DOM 芯片互转，以及生成前把芯片解析回
 * 「纯文本 + 参考图」。是唯一入口，禁止在别处手写 /@\{/ 正则或就地解析。
 *
 * 序列化约定（与参考仓库 AI-Canvas-tauri 一致）：
 *   芯片 → 字符串：`@{id:label}`
 *   字符串 → 芯片：用 PROMPT_CHIP_RE 解析
 *   旧数据（无 `@{...}` 格式的纯文本 `@素材名`）→ 解析不到 → 原样显示为文字，向后兼容不崩。
 *
 * 数据模型（token 统一形态，来自 refImages / refTexts）：
 *   { id, label, url?, kind: 'image' | 'text', sourceNodeId? }
 *
 * 注意：本文件只做纯转换，不做文件系统/网络访问；缩略图 URL 一律由调用方经 token.url 提供。
 */

/** 芯片序列化正则（唯一入口，禁止散落复制） */
export const PROMPT_CHIP_RE = /@\{([^:]+):([^}]+)\}/g

/** 零宽空格：芯片前后光标落点占位 */
export const ZWSP = '\u200B'

/**
 * 判断节点是否为「芯片元素」（携带 data-ref-id 的 span）。
 * @param {Node|null} node
 * @returns {boolean}
 */
export function isChipEl(node) {
  return !!node
    && node.nodeType === Node.ELEMENT_NODE
    && (node).hasAttribute('data-ref-id')
}

/**
 * 判断节点是否为 <br> 元素。
 * @param {Node|null} node
 * @returns {boolean}
 */
export function isBrEl(node) {
  return !!node
    && node.nodeType === Node.ELEMENT_NODE
    && node.tagName === 'BR'
}

/**
 * 确保芯片前有光标落点（零宽空格）：
 *   - 前一个兄弟为空或 <br> → 插一个 ZWSP 文本节点；
 *   - 前一个兄弟是空文本 → 填 ZWSP；
 *   - 否则（已有内容）不处理。
 * 这样光标才能停在芯片前面，避免行首芯片无法聚焦。
 * @param {Node} chip 芯片元素
 */
export function ensureCaretSlotBeforeChip(chip) {
  const previous = chip.previousSibling
  if (!previous || isBrEl(previous)) {
    chip.parentNode?.insertBefore(document.createTextNode(ZWSP), chip)
  } else if (previous.nodeType === Node.TEXT_NODE && !previous.textContent) {
    previous.textContent = ZWSP
  }
}

/**
 * 遍历根下所有芯片，补齐每个芯片前的光标落点（删字/换行后调用，防止行首芯片无法聚焦）。
 * @param {HTMLElement} root
 */
export function normalizeChipSlots(root) {
  const chips = root.querySelectorAll('[data-ref-id]')
  for (const chip of Array.from(chips)) ensureCaretSlotBeforeChip(chip)
}

/**
 * 序列化：把 contentEditable 根 DOM 转回 `@{id:label}` 字符串。
 *   - 文本节点 → 原文；<br> → '\n'；芯片元素 → `@{id:label}`；其余递归子节点。
 *   - 剔除 ZWSP，剥掉尾部换行。
 * @param {HTMLElement} root
 * @returns {string}
 */
export function serializeDOM(root) {
  let result = ''
  const walk = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent || ''
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node
    if (el.hasAttribute('data-ref-id')) {
      result += `@{${el.getAttribute('data-ref-id')}:${el.getAttribute('data-ref-label') || ''}}`
      return
    }
    if (el.tagName === 'BR') {
      result += '\n'
      return
    }
    for (const child of Array.from(node.childNodes)) walk(child)
  }
  for (const child of Array.from(root.childNodes)) walk(child)
  return result.split(ZWSP).join('').replace(/\n+$/, '')
}

/**
 * 建芯片元素（contentEditable=false 的 span）。
 *   - kind='image' 且有缩略图 → 显示缩略图；否则显示 `@` 图标 + 标签。
 *   - 存 data-ref-id / data-ref-label，供 serializeDOM / 删除 / 光标处理识别。
 * @param {string} id    素材唯一 id
 * @param {string} label 芯片显示名
 * @param {string} kind  'image' | 'text'
 * @param {string} [thumbnailUrl] 图片缩略图 URL（仅 kind='image' 时用）
 * @returns {HTMLSpanElement}
 */
export function buildChipEl(id, label, kind = 'text', thumbnailUrl) {
  const span = document.createElement('span')
  span.className = 'prompt-chip'
  span.contentEditable = 'false'
  span.setAttribute('data-ref-id', id)
  span.setAttribute('data-ref-label', label)
  span.title = label

  const icon = document.createElement('span')
  icon.className = 'prompt-chip-icon'
  icon.setAttribute('aria-hidden', 'true')
  if (kind === 'image' && thumbnailUrl) {
    icon.classList.add('has-thumbnail')
    const img = document.createElement('img')
    img.src = thumbnailUrl
    img.className = 'prompt-chip-thumb'
    img.alt = ''
    icon.appendChild(img)
  } else {
    icon.textContent = kind === 'image' ? '🖼' : '@'
  }
  span.appendChild(icon)

  const labelEl = document.createElement('span')
  labelEl.className = 'prompt-chip-label'
  labelEl.textContent = label.length > 16 ? `${label.slice(0, 14)}…` : label
  span.appendChild(labelEl)
  return span
}

/**
 * 反序列化：把 `@{id:label}` 文本渲染成 Node[]（文本 + 芯片 + <br>）。
 *   - `\n` 拆成 <br>；`@{...}` 解析为芯片（有 metaMap 缩略图则显示缩略图，kind='image'）；
 *   - 芯片之间用 ZWSP 分隔保证光标可聚焦。
 * @param {string} text
 * @param {Map<string,{kind:string,url?:string}>} metaMap id → {kind,url}（用于查缩略图/类型）
 * @returns {Node[]}
 */
export function renderPromptToNodes(text, metaMap) {
  const nodes = []
  const pushChip = (chip) => {
    const previous = nodes[nodes.length - 1]
    if (!previous || isBrEl(previous) || isChipEl(previous)) nodes.push(document.createTextNode(ZWSP))
    nodes.push(chip)
  }
  const pushTextWithBreaks = (text) => {
    if (!text) return
    text.split('\n').forEach((line, index) => {
      if (index > 0) nodes.push(document.createElement('br'))
      if (line) nodes.push(document.createTextNode(line))
    })
  }

  let lastIndex = 0
  let match
  while ((match = PROMPT_CHIP_RE.exec(text)) !== null) {
    pushTextWithBreaks(text.slice(lastIndex, match.index))
    const id = match[1]
    const label = match[2]
    const meta = metaMap ? metaMap.get(id) : undefined
    const kind = meta?.kind || 'text'
    const url = meta?.url
    pushChip(buildChipEl(id, label, kind, url))
    lastIndex = PROMPT_CHIP_RE.lastIndex
  }
  pushTextWithBreaks(text.slice(lastIndex))
  return nodes
}

/**
 * 生成前解析：把 prompt 里的 `@{id:label}` 芯片解析为「纯文本 + 参考图」。
 *   - 图片素材芯片 → 其 url 加入 refImages 参考图列表（同一 id 去重），位置替换为 `图片N`；
 *   - 文本素材芯片 → 替换为其 label（作为纯文本随 prompt 发出）；
 *   - 找不到对应素材 → 替换为空（不产生垃圾字符）。
 * @param {string} rawPrompt 含 `@{id:label}` 的原始 prompt
 * @param {Array<{id:string,url:string}>} refImages 可用图片素材（按 id 查 url）
 * @param {Array<{id:string,label:string}>} refTexts 可用文本素材（按 id 查 label）
 * @returns {{ text: string, refImages: Array<{id:string,url:string}> }}
 */
export function resolvePromptChips(rawPrompt, refImages = [], refTexts = []) {
  const imgById = new Map()
  for (const im of refImages) if (im && im.id) imgById.set(im.id, im.url)
  const textById = new Map()
  for (const t of refTexts) if (t && t.id) textById.set(t.id, t.label)

  const imageKeyToIndex = new Map() // 图引用去重：id → 图片N
  const resolvedRefImages = []

  const text = String(rawPrompt || '').replace(PROMPT_CHIP_RE, (_match, id, label) => {
    const imgUrl = imgById.get(id)
    if (imgUrl) {
      let idx = imageKeyToIndex.get(id)
      if (idx === undefined) {
        idx = imageKeyToIndex.size + 1
        imageKeyToIndex.set(id, idx)
        resolvedRefImages.push({ id, url: imgUrl })
      }
      return `图片${idx}`
    }
    const textLabel = textById.get(id)
    if (textLabel) return textLabel
    return ''
  })

  return { text: text.trim(), refImages: resolvedRefImages }
}
