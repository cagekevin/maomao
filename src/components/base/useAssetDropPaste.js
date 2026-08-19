import { useCallback, useEffect, useRef } from 'react'
import { detectFileType, isAssetUrl } from './mediaType.js'
import { sanitizePastedText } from './clipboard.js'
import { showToast } from './toastStore.js'
import { uploadFileToLocal } from './filesApi.js'

/**
 * 画布素材「拖入 + 粘贴」hook（复刻官方 H_.jsx:10201-10350 onDragOver ki / onDrop Ai + handlePaste）。
 *
 * 【为什么抽成 hook】
 * App.jsx 里的 onDragOver/onDrop/onPaste/createNodeFromFile 是一组内聚的「素材导入」能力，
 * 直接写在画布宿主里会让 App 越来越臃肿。抽出来：
 *  - App.jsx 只调一次 hook、把事件挂到 ReactFlow，画布宿主保持清爽；
 *  - 其它画布宿主（脚本盒编辑器等）要支持拖入/粘贴，复用即可。
 *
 * 【映射规则（对齐官方）】
 *  - image / video / audio 文件 → imageNode（ImageNode 内部按 URL 判断类型展示；官方同此）
 *  - text 文件 / 纯文本 → textNode
 *  - 拖入 URL 文本：图片类 URL → imageNode，否则 → textNode
 * 原型无后端，文件用 FileReader 读 dataURL 写入节点 data（官方走 localTool hi() 上传 /files/）。
 *
 * @param {Object} opts
 * @param {Function} opts.addNode      建节点：addNode(type, pos, data)
 * @param {Function} opts.screenToFlowPosition  屏幕坐标 → 画布坐标
 * @param {Function} opts.onPasteNodeGroup  粘贴节点组（mutiwindow-nodes）回调：onPasteNodeGroup(json, pos) → boolean
 * @returns {{ onDragOver, onDrop, onPaste }} 挂到 ReactFlow 的事件 + 供 window paste 监听
 */
export function useAssetDropPaste({ addNode, screenToFlowPosition, onPasteNodeGroup }) {
  // 记录最近一次鼠标位置（视口坐标）：粘贴时优先落在鼠标处，无鼠标则回退到视图中心。
  // paste 事件本身不带 clientX/Y，官方也是用「当前视口位置」建节点；这里用 mousemove 追踪
  // 更贴近用户预期（在哪儿右键/停留就在哪儿粘贴），对齐 H_.jsx 用视口坐标建节点的思路。
  const lastMouse = useRef(null)
  useEffect(() => {
    const track = (e) => {
      lastMouse.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('mousemove', track)
    return () => window.removeEventListener('mousemove', track)
  }, [])

  // 计算粘贴落点（flow 坐标）：最近鼠标位置优先，回退到视图中心。都经 screenToFlowPosition 换算。
  const pastePos = useCallback(() => {
    if (lastMouse.current) return screenToFlowPosition(lastMouse.current)
    return screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
  }, [screenToFlowPosition])

  // 拖入时阻止浏览器默认（打开文件），标记 copy
  const onDragOver = useCallback((e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  // 文件 → 建素材节点（图片/视频/音频→imageNode，文本→textNode）
  const createNodeFromFile = useCallback(
    (file, pos) => {
      const type = detectFileType(file)
      // 文本：读文本 → textNode
      if (type === 'text') {
        const fr = new FileReader()
        fr.onload = () => {
          addNode('textNode', pos, { text: fr.result, label: file.name })
          showToast(`已导入文本「${file.name}」`)
        }
        fr.readAsText(file)
        return
      }
      if (type === 'other' || type === 'empty') return
      // 图片/视频/音频：优先直接上传 localTool 成 /files/ URL（对齐官方 H_.jsx onDrop hi(file)），
      // 避免把大视频 dataURL 塞进画布快照导致刷新丢失；上传失败（localTool 离线等）才 fallback 到 dataURL。
      ;(async () => {
        const url = await uploadFileToLocal(file, 'canvas/drop')
        if (url) {
          addNode('imageNode', pos, { imageUrl: url, label: file.name })
          showToast(`已导入${type === 'image' ? '图片' : type === 'video' ? '视频' : '音频'}「${file.name}」`)
          return
        }
        // 上传失败 → fallback 读 dataURL 建节点（刷新可依赖 KV 自动外置兜底）
        const fr = new FileReader()
        fr.onload = () => {
          addNode('imageNode', pos, { imageUrl: fr.result, label: file.name })
          showToast(`已导入${type === 'image' ? '图片' : type === 'video' ? '视频' : '音频'}「${file.name}」`)
        }
        fr.readAsDataURL(file)
      })()
    },
    [addNode]
  )

  // 拖入
  const onDrop = useCallback(
    (e) => {
      e.preventDefault()
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY })

      // 素材库素材拖入（AssetLibrary 写 application/x-yimao-asset）：用素材 url 建节点
      const assetRaw = e.dataTransfer?.getData('application/x-yimao-asset')
      if (assetRaw) {
        try {
          const asset = JSON.parse(assetRaw)
          if (asset?.url) {
            // 文字素材 → textNode（把 data:text 内容解码成文本）；图片/视频/音频 → imageNode
            if (asset.type === 'text') {
              let content = asset.text || ''
              if (!content && asset.url.startsWith('data:text')) {
                try { content = decodeURIComponent(asset.url.slice(asset.url.indexOf(',') + 1)) } catch { content = asset.name || '' }
              }
              addNode('textNode', pos, { text: content, label: asset.name || '文字素材' })
              showToast(`已添加文字素材「${asset.name || '文字素材'}」`)
            } else {
              addNode('imageNode', pos, { imageUrl: asset.url, label: asset.name || '素材' })
              showToast(`已添加素材「${asset.name || '素材'}」`)
            }
            return
          }
        } catch { /* 非法数据忽略 */ }
      }

      const files = e.dataTransfer?.files
      if (!files || files.length === 0) {
        // 拖入 URL 文本（非文件）：图片类 URL → imageNode，其它 → textNode
        const text = e.dataTransfer?.getData('text/plain')
        if (text) {
          if (isAssetUrl(text)) {
            addNode('imageNode', pos, { imageUrl: text })
            showToast('已导入图片链接')
          } else {
            addNode('textNode', pos, { text, expanded: false })
            showToast('已导入文本')
          }
        }
        return
      }
      Array.from(files).forEach((f, i) => createNodeFromFile(f, { x: pos.x + i * 50, y: pos.y + i * 50 }))
    },
    [screenToFlowPosition, addNode, createNodeFromFile]
  )

  // 建 textNode（普通文本，经 sanitize 清洗；内部 mutiwindow-* JSON 用原始 text 解析，不在此清洗）
  const handleTextPaste = useCallback(
    (rawText, pos) => {
      if (!rawText || !rawText.trim()) return
      try {
        const parsed = JSON.parse(rawText)
        if (parsed?.type === 'mutiwindow-nodes') {
          // 粘贴节点组（含连线），交由宿主（App）解析重建
          if (typeof onPasteNodeGroup === 'function') onPasteNodeGroup(rawText, pos)
          return
        }
        if (parsed?.type === 'mutiwindow-images' && Array.isArray(parsed.images)) {
          const images = parsed.images
          if (images.length === 0) return
          images.forEach((img, i) => {
            const col = i % 6
            const row = Math.floor(i / 6)
            addNode('imageNode', { x: pos.x + col * 150, y: pos.y + row * 150 }, { imageUrl: img, label: `提取帧 ${i + 1}` })
          })
          showToast(`已粘贴 ${images.length} 张提取的图片`)
          return
        }
      } catch {}
      // 普通文本 → textNode
      const cleanText = sanitizePastedText(rawText)
      if (cleanText) addNode('textNode', pos, { text: cleanText, expanded: false })
    },
    [addNode, onPasteNodeGroup]
  )

  // 从 text/html 里提取 <img src>（外部「复制图片」常是 text/html 带 <img>，而不是 image File）
  const extractImgFromHtml = useCallback((html) => {
    if (!html) return ''
    // 用 DOMParser 解析（不依赖挂在 DOM 上），jsdom 可用；解析失败则正则兜底
    try {
      const doc = new DOMParser().parseFromString(String(html), 'text/html')
      const img = doc.querySelector('img[src]')
      if (img) return img.getAttribute('src') || ''
    } catch {}
    const m = String(html).match(/<img[^>]*\ssrc=["']([^"']+)["']/i)
    return m ? m[1] : ''
  }, [])

  // 把 ClipboardItem 的 Blob 包装成 File（createNodeFromFile 需要 name/type 判型）。name 从 mime 推。
  const blobToPastedFile = useCallback((blob, mime) => {
    const name = (mime.split('/')[1] || 'image').replace(/[^a-z0-9]/gi, '') || 'image'
    return new File([blob], name, { type: mime || blob.type || 'application/octet-stream' })
  }, [])

  // 读取 ClipboardItem 某类型的文本内容：getType 真浏览器返回 Blob、测试 mock 直接返回字符串，都兼容。
  const readClipText = useCallback(async (item, type) => {
    const got = await item.getType(type)
    if (typeof got?.text === 'function') return got.text()
    return typeof got === 'string' ? got : String(got ?? '')
  }, [])

  // 粘贴：优先 navigator.clipboard.read() 实时读剪贴板；失败/不可用回落 paste 事件同步数据。
  // 【万全之策，修复三处根因】
  //  1. 不再依赖「会被回收的 paste 事件 clipboardData 快照 + 异步 getAsString」→ read() 实时读 + 同步 getData。
  //  2. contenteditable 只放行图片（图片→建节点），纯文本仍在可编辑区插入（不吞图）。
  //  3. 全失败 → toast 提示，不静默。
  // 焦点在 input/textarea（纯文本编辑，必不可能贴图片样式）时交给浏览器原生，不拦截。
  const onPaste = useCallback(
    (e) => {
      const t = e?.target
      const tag = t?.tagName
      const isInputLike = tag === 'INPUT' || tag === 'TEXTAREA'
      const isContentEditable = !!(t && (t.isContentEditable || (t.closest && t.closest('[contenteditable="true"]'))))
      // input/textarea 内粘贴 → 走原生，不拦截、不建节点（纯文本无富文本风险，见 hook 头注释）
      if (isInputLike) return

      const pos = pastePos()

      // ── 优先：实时读剪贴板（navigator.clipboard.read）──
      const tryReadClipboard = async () => {
        if (typeof navigator?.clipboard?.read !== 'function') return 'fallback'
        try {
          const items = await navigator.clipboard.read()
          if (!items || items.length === 0) return 'fallback'
          for (const item of items) {
            const types = item.types || []
            // 图片 Blob（image/*）→ 建 imageNode
            const imgType = types.find((x) => x.startsWith('image/'))
            if (imgType) {
              const blob = await item.getType(imgType)
              if (blob) { e.preventDefault?.(); createNodeFromFile(blobToPastedFile(blob, imgType), pos); return 'ok' }
              continue
            }
            // text/html 里的 <img>（外部「复制图片」）→ 建 imageNode
            if (types.includes('text/html')) {
              const html = await readClipText(item, 'text/html')
              const src = extractImgFromHtml(html)
              if (src) {
                e.preventDefault?.()
                if (isAssetUrl(src)) addNode('imageNode', pos, { imageUrl: src })
                else if (!isContentEditable) addNode('textNode', pos, { text: src, expanded: false })
                return 'ok'
              }
            }
            // text/plain → 文本链路。contenteditable 内纯文本交给 insertText（不建节点、不吞），
            // 非可编辑区才走 handleTextPaste（mutiwindow-nodes/images / 普通文本）。
            if (types.includes('text/plain')) {
              const text = await readClipText(item, 'text/plain')
              if (text && text.trim()) {
                e.preventDefault?.()
                if (isContentEditable) return 'ok'
                handleTextPaste(text, pos)
                return 'ok'
              }
            }
          }
          return 'fallback'
        } catch {
          return 'fallback'
        }
      }

      // ── 兜底：paste 事件同步数据（read 失败/不可用）──
      const trySyncEvent = () => {
        const cd = e.clipboardData
        if (!cd) return false
        // 同步拿文本（不用异步 getAsString，避免事件结束快照回收读空）
        const text = typeof cd.getData === 'function' ? cd.getData('text/plain') : ''
        if (text && text.trim()) {
          e.preventDefault?.()
          if (!isContentEditable) handleTextPaste(text, pos)
          return true
        }
        // 同步拿文件（getAsFile）
        const items = cd.items
        if (items) {
          for (const item of items) {
            if (item.kind === 'file') {
              const type = item.type || ''
              if (type.startsWith('image/') || type.startsWith('video/') || type.startsWith('audio/')) {
                const file = item.getAsFile && item.getAsFile()
                if (file) { e.preventDefault?.(); createNodeFromFile(file, pos); return true }
              }
            }
          }
        }
        const files = cd.files
        if (files && files.length) {
          const file = files[0]
          const type = detectFileType(file)
          if (type !== 'other' && type !== 'empty') { createNodeFromFile(file, pos); return true }
        }
        return false
      }

      // 执行：read 优先 → sync 兜底；都落空 → toast（不静默）
      ;(async () => {
        const verdict = await tryReadClipboard()
        if (verdict === 'ok') return
        const done = trySyncEvent()
        if (!done && !isContentEditable) showToast('粘贴失败，请重试')
      })()
    },
    [createNodeFromFile, pastePos, addNode, handleTextPaste, extractImgFromHtml, blobToPastedFile, readClipText]
  )

  // createNodeFromFile 供右键菜单「上传」复用（对齐官方 Re.current 隐藏 file input → 建素材节点）
  return { onDragOver, onDrop, onPaste, createNodeFromFile }
}

/**
 * 注册全局粘贴监听（window paste → onPaste）。宿主在组件里调用一次即可。
 *
 * 附带一层「contenteditable 纯文本化」保险：contenteditable 原生粘贴会带入 HTML 样式，
 * 这里拦截、清洗为纯文本后手动插入。textarea/input 原生粘贴本就是纯文本（不可能带样式），
 * 按「绝不可能贴样式的地方不加保险」原则不做拦截，交给 onPaste/浏览器原生。
 * @param {Function} onPaste
 */
export function useGlobalPaste(onPaste) {
  useEffect(() => {
    if (!onPaste) return
    const handler = (e) => {
      const t = e.target
      const isCE = t && (t.isContentEditable || (t.closest && t.closest('[contenteditable="true"]')))
      // 仅 contenteditable 富文本需要清洗：读到纯文本 → 清洗 → 插入光标处，阻止原生带样式粘贴。
      // 【万全之策】contenteditable 里如果是「图片」粘贴，必须放行到 onPaste 建节点（不能 insertText 吞掉）。
      if (isCE) {
        const isImagePaste = Array.from(e.clipboardData?.items || []).some(
          (it) => it.kind === 'file' && it.type && it.type.startsWith('image/')
        )
        if (!isImagePaste) {
          e.preventDefault()
          const text = e.clipboardData?.getData('text/plain') || ''
          document.execCommand('insertText', false, sanitizePastedText(text))
          return
        }
      }
      onPaste(e)
    }
    window.addEventListener('paste', handler)
    return () => window.removeEventListener('paste', handler)
  }, [onPaste])
}
