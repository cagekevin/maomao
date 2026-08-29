import { useCallback, useEffect, useRef } from 'react'
import { detectFileType, isAssetUrl } from './mediaType.js'
import { isEditableTarget } from './hooks.js'
import { sanitizePastedText } from './clipboard.js'
import { showToast } from './toastStore.js'
import { uploadFileToLocal, downloadRemoteToLocal, WEB_DROP_SUBFOLDER } from './filesApi.js'
import { fileToDataUrl } from './imageUrl.js'
import { UPLOAD_DIRS } from './uploadDirs.js'
import { logger } from './logger.js'

/**
 * ════════════════════════════════════════════════════════════════════════
 * 【用户需求（硬约束 · 勿删勿改方向 · 改动前必须先读这里）】
 * 用户对「复制 / 粘贴」的明确要求，按优先级记录，后续任何 AI 改这块都必须遵守：
 *
 * 1. 复制图片、复制文字、复制节点，三件事都要可靠、清晰。
 * 2. 「粘贴文字就是要清洗」——用户明确要求粘贴到画布的文字必须经过彻底清洗
 *    （sanitizePastedText）：压缩连续空格/空行、去行首行尾空格、统一换行、去不可见脏字符。
 *    核心目的：粘贴表格/富文本时，绝不能被当成图片或带样式贴进来，必须压成干净纯文本。
 *    所以 textNode 内容用 sanitizePastedText 处理，不要改成"保留格式"（那是错误方向）。
 * 3. 复制「文本节点」有两种语义，都要可靠：
 *    A. 工具栏「复制文本」→ 复制节点里的文字（纯文本）→ 粘贴到画布建 textNode（经清洗）。
 *    B. 右键「复制」→ 复制整个节点（mutiwindow-nodes JSON）→ 粘贴到画布重建节点组。
 * 4. 焦点在可编辑元素（contenteditable / input / textarea）内时：
 *    - 纯文本 → 走浏览器原生插入（不建节点、不拦截）；
 *    - 节点组/图片组 JSON（mutiwindow-nodes / mutiwindow-images）→ 必须放行到画布建节点，
 *      不能退化成把 JSON 文本塞进编辑框，否则会「复制节点粘贴不上」且焦点卡住后后续全失败。
 * 5. 粘贴要稳定可靠，三层防线：
 *    - 主路径用「同步 getData('text/plain')」优先（paste 事件不回收），getAsString 仅补充；
 *    - 同步 getData 二次补充；
 *    - navigator.clipboard.read() 极端兜底；全部失败必须 showToast 提示，不静默。
 * 6. 图片：file / text/html 里的 <img> / read() 的 image blob，都要能建 imageNode。
 *
 * 注意：sanitizePastedText 是用户明确要的方向，见 ./clipboard.js。若再被改成 normalize/
 * 保留格式，是背离需求的错误改动。
 * 官方参考：reference-1mao/httpClient-BEVPUWLI_components/_Component95.jsx:12124-12173
 *（handlePaste）与 :10228-10543（Ri 粘贴重建）。官方文字只 trim()（text: e.trim()），
 * 用户要求比官方更强清洗，以「用户诉求」为准。
 * ════════════════════════════════════════════════════════════════════════
 *
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
 * @param {Function} opts.addNode      建节点：addNode(type, pos, data) → 返回节点 id
 * @param {Function} opts.screenToFlowPosition  屏幕坐标 → 画布坐标
 * @param {Function} opts.onPasteNodeGroup  粘贴节点组（mutiwindow-nodes）回调：onPasteNodeGroup(json, pos) → boolean
 * @param {Function} [opts.patchNodeData]  节点 data 写回：patchNodeData(id, patch)（走 useNodeData 唯一入口；
 *                                         网页图后台本地化成功后替换 imageUrl 用；不传则跳过本地化）
 * @returns {{ onDragOver, onDrop, onPaste }} 挂到 ReactFlow 的事件 + 供 window paste 监听
 */
export function useAssetDropPaste({ addNode, screenToFlowPosition, onPasteNodeGroup, patchNodeData }) {
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
        const url = await uploadFileToLocal(file, UPLOAD_DIRS.canvasDrop)
        if (url) {
          addNode('imageNode', pos, { imageUrl: url, label: file.name })
          showToast(`已导入${type === 'image' ? '图片' : type === 'video' ? '视频' : '音频'}「${file.name}」`)
          return
        }
        // 上传失败 → fallback 读 dataURL 建节点（刷新可依赖 KV 自动外置兜底）；读 URL 统一走 fileToDataUrl，不散写 FileReader。
        // 读取失败（非正常文件）→ 返回 null，保持原"静默不建节点"语义（上传已失败，读又失败则放弃）。
        const dataUrl = await fileToDataUrl(file).catch(() => null)
        if (!dataUrl) return
        addNode('imageNode', pos, { imageUrl: dataUrl, label: file.name })
        showToast(`已导入${type === 'image' ? '图片' : type === 'video' ? '视频' : '音频'}「${file.name}」`)
      })()
    },
    [addNode]
  )

  // 拖入网络图片 URL → 先用原 URL 同步建 imageNode（立即显示，能显示就显示，防盗链破图不阻塞导入）。
  // 后台本地化（先显示后替换）：复用后端 fileUrl 下载（服务端 + 7897 代理，绕 CORS）落盘专用 web 目录，
  // 成功把节点 imageUrl 替换为本地 /files/ URL（发送/图生图/压缩/裁剪都能用）；失败保持原 URL，不打扰、日志留痕。
  // 不加 label：与 onPaste 的 html <img> 建图路径一致，节点 data 保持最简 { imageUrl }。
  const addImageNodeFromUrl = useCallback(
    (pos, url) => {
      if (!url) return
      const id = addNode('imageNode', pos, { imageUrl: url })
      // 未注入 patchNodeData 则跳过本地化（纯显示模式）；非 http(s) 由 downloadRemoteToLocal 内部拦截（返回 null 不替换）
      if (id && typeof patchNodeData === 'function') {
        downloadRemoteToLocal(url, { folder: WEB_DROP_SUBFOLDER })
          .then((localUrl) => {
            if (localUrl && localUrl !== url) patchNodeData(id, { imageUrl: localUrl })
          })
          .catch((e) => logger.warn('assetDrop', '网页图本地化失败，保持原 URL', e))
      }
    },
    [addNode, patchNodeData]
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
        // 拖入 URL 文本（非文件）：图片类 URL → imageNode，其它 → textNode。
        // 从网页拖图时 URL 通常不在 text/plain，而在 text/uri-list（拖拽 URL 的标准 MIME），
        // 故两者都读，取第一个非空 URL 候选（uri-list 可能多行，取首行 URL）。
        const uriList = e.dataTransfer?.getData('text/uri-list') || ''
        const text = e.dataTransfer?.getData('text/plain') || ''
        const candidate = (uriList.trim() || text.trim()).split(/\r?\n/)[0]?.trim() || ''
        if (candidate) {
          if (isAssetUrl(candidate)) {
            // 网页图 URL → 直接用原 URL 建 imageNode（方案C：能显示就显示，防盗链破图不阻塞导入；不做本地化）
            addImageNodeFromUrl(pos, candidate)
          } else {
            addNode('textNode', pos, { text: candidate, expanded: false })
            showToast('已导入文本')
          }
        }
        return
      }
      Array.from(files).forEach((f, i) => createNodeFromFile(f, { x: pos.x + i * 50, y: pos.y + i * 50 }))
    },
    [screenToFlowPosition, addNode, createNodeFromFile, addImageNodeFromUrl]
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
      // 普通文本 → textNode：经 sanitizePastedText 彻底清洗（压缩连续空格/空行、去行首行尾空格、
      // 统一换行、去不可见脏字符）。用户核心诉求：粘贴表格/富文本时绝不能被当成图片或带样式贴进来，
      // 必须压成干净纯文本。官方（reference-1mao _Component95.jsx:10524）只做 trim()，这里按用户要求更强清洗。
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

  // 粘贴：【稳定模型 + 收口图片放行】
  //  - 主路径 = paste 事件同步数据（e.clipboardData.items）：图片/视频/音频 getAsFile 同步拿（最稳）、
  //    纯文本 text/plain 走 getAsString（与旧版一致，稳定可用）、text/html 提取 <img>。
  //  - contenteditable 内：图片放行建节点（787ca25 收口价值），纯文本/其他 return 走原生（不吞、不建节点）。
  //  - input/textarea 内 return 走原生。
  //  - 极端兜底：同步数据完全为空时，再试 navigator.clipboard.read() 实时读（仅补充，不作为主路径）。
  const onPaste = useCallback(
    (e) => {
      const t = e?.target
      const isCE = !!(t && (t.isContentEditable || (t.closest && t.closest('[contenteditable="true"]'))))
      // 可编辑元素（contenteditable / input / textarea）内的粘贴默认走原生（在编辑区插入），
      // 不拦截、不建节点。但「节点组 / 图片组」JSON 是画布语义，必须放行到画布建节点，
      // 否则会退化成把 JSON 文本塞进编辑框 → 表现为「复制节点粘贴不上」，且焦点卡在编辑区后
      // 后续所有节点粘贴都被吞（用户感知为「之后复制任何节点都粘贴不上」）。
      const peekClipText = () => {
        const cd0 = e.clipboardData
        if (!cd0 || typeof cd0.getData !== 'function') return ''
        try { return cd0.getData('text/plain') || '' } catch { return '' }
      }
      const isCanvasGroupClip = (txt) => {
        if (!txt || !txt.trim()) return false
        try {
          const p = JSON.parse(txt)
          return p?.type === 'mutiwindow-nodes' || p?.type === 'mutiwindow-images'
        } catch { return false }
      }
      if (isCE) {
        const ceItems = e.clipboardData?.items || []
        const hasImageFile = ceItems.some((it) => it.kind === 'file' && it.type && it.type.startsWith('image/'))
        const onlyPlainText = !hasImageFile && ceItems.length > 0 && ceItems.every((it) => it.kind === 'string' && it.type === 'text/plain')
        // 纯文本（非节点组 JSON）→ 走原生；图片 / 节点组JSON → 放行到画布建节点
        if (onlyPlainText && !isCanvasGroupClip(peekClipText())) return
      } else if (isEditableTarget(e)) {
        // input/textarea（非 contenteditable）：节点组 JSON 放行建节点，其余走原生
        if (!isCanvasGroupClip(peekClipText())) return
      }

      const items = e.clipboardData?.items
      const cd = e.clipboardData
      const pos = pastePos()

      // 主路径：同步遍历 clipboardData.items（与旧版一致，稳定）
      if (items) {
        for (const item of items) {
          if (item.kind === 'file') {
            const type = item.type || ''
            if (type.startsWith('image/') || type.startsWith('video/') || type.startsWith('audio/')) {
              const file = item.getAsFile && item.getAsFile()
              if (file) { e.preventDefault(); createNodeFromFile(file, pos); return }
            }
          } else if (item.kind === 'string' && item.type === 'text/plain') {
            e.preventDefault()
            // 同步 getData 优先（paste 事件 getData 不回收、稳）；getAsString 仅作补充（偶发被回收读空）。
            // 节点组(mutiwindow-nodes) JSON 走这条，必须稳，否则偶发「复制节点粘贴不上」。
            const syncPlain = cd && typeof cd.getData === 'function' ? cd.getData('text/plain') : ''
            if (syncPlain && syncPlain.trim()) { handleTextPaste(syncPlain, pos); return }
            item.getAsString((text) => {
              if (text && text.trim()) handleTextPaste(text, pos)
            })
            return
          }
        }
      }

      // text/html 里的 <img>（外部「复制图片」常是 html 而非 file）→ 建节点
      const html = cd && typeof cd.getData === 'function' ? cd.getData('text/html') : ''
      if (html) {
        const src = extractImgFromHtml(html)
        if (src) {
          e.preventDefault()
          if (isAssetUrl(src)) addNode('imageNode', pos, { imageUrl: src })
          else addNode('textNode', pos, { text: src, expanded: false })
          return
        }
      }

      // 同步补充：直接读 getData('text/plain')（部分环境纯文本不在 items 里，而在 getData 中）
      const syncText = cd && typeof cd.getData === 'function' ? cd.getData('text/plain') : ''
      if (syncText && syncText.trim()) {
        e.preventDefault()
        handleTextPaste(syncText, pos)
        return
      }

      // 极端兜底：同步数据完全为空才试 read() 实时读（仅补充）
      if (cd && (!items || items.length === 0)) {
        ;(async () => {
          if (typeof navigator?.clipboard?.read !== 'function') {
            if (!isCE) showToast('读取剪贴板失败，请使用 Ctrl+V 快捷键粘贴')
            return
          }
          try {
            const clip = await navigator.clipboard.read()
            if (!clip || clip.length === 0) { if (!isCE) showToast('无法识别剪贴板内容，请尝试复制图片或文字后再粘贴'); return }
            for (const item of clip) {
              const types = item.types || []
              const imgType = types.find((x) => x.startsWith('image/'))
              if (imgType) {
                const blob = await item.getType(imgType)
                if (blob) { createNodeFromFile(blobToPastedFile(blob, imgType), pos); return }
                continue
              }
              if (types.includes('text/html')) {
                const html = await readClipText(item, 'text/html')
                const src = extractImgFromHtml(html)
                if (src) {
                  if (isAssetUrl(src)) addNode('imageNode', pos, { imageUrl: src })
                  else addNode('textNode', pos, { text: src, expanded: false })
                  return
                }
              }
              if (types.includes('text/plain')) {
                // contenteditable 内的纯文本 → 交给浏览器原生插入（不建节点）
                const text = await readClipText(item, 'text/plain')
                if (text && text.trim() && !isCE) { handleTextPaste(text, pos); return }
              }
            }
            if (!isCE) showToast('无法识别剪贴板内容，请尝试复制图片或文字后再粘贴')
          } catch {
            if (!isCE) showToast('读取剪贴板失败，请使用 Ctrl+V 快捷键粘贴')
          }
        })()
      }
    },
    [createNodeFromFile, pastePos, addNode, handleTextPaste, extractImgFromHtml, blobToPastedFile, readClipText, isEditableTarget]
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
  // 用 ref 存最新 onPaste，监听只绑一次（空依赖）。目的：无论 onPaste 引用怎么变，
  // window 上的 paste 监听都稳定挂着，不因依赖变化反复重挂而「粘贴完全没反应」。
  // （React StrictMode 下也只会规范地 绑→解→绑 一次，不会因 onPaste 抖动丢失监听。）
  const onPasteRef = useRef(onPaste)
  onPasteRef.current = onPaste
  useEffect(() => {
    const handler = (e) => {
      const t = e.target
      const isCE = t && (t.isContentEditable || (t.closest && t.closest('[contenteditable="true"]')))
      // contenteditable 内：纯文本/其他走浏览器原生（在可编辑区插入），不拦截；
      // 仅「图片」或「节点组/图片组 JSON」需放行到 onPaste 建节点（前者避免塞进富文本，
      // 后者避免把 JSON 退化成文本、且焦点卡编辑区导致后续所有节点粘贴被吞）。
      if (isCE) {
        const items0 = Array.from(e.clipboardData?.items || [])
        const isImagePaste = items0.some((it) => it.kind === 'file' && it.type && it.type.startsWith('image/'))
        let isGroupJson = false
        try {
          const txt = e.clipboardData?.getData?.('text/plain') || ''
          if (txt.trim()) {
            const p = JSON.parse(txt)
            isGroupJson = p?.type === 'mutiwindow-nodes' || p?.type === 'mutiwindow-images'
          }
        } catch {}
        if (!isImagePaste && !isGroupJson) return
      }
      onPasteRef.current?.(e)
    }
    window.addEventListener('paste', handler)
    return () => window.removeEventListener('paste', handler)
  }, [])
}
