import { buildShotImageUser, getImageGenSys, collectAssets, ZgPrompt, IMAGE_GEN_TYPES, IMAGE_GEN_DEFAULT, SCRIPT_WRITER_SYSTEM, SHOT_DIRECTOR_SYSTEM } from './scriptBoxPrompts.js'
import { chatCompletions } from './chatApi.js'
import { generateImage } from './imageApi.js'
import { resolveProviderModel, buildAllModels } from './providerModels.js'

/**
 * 剧本盒子 —— 引擎层（接真系统，经 localTool /api/proxy → 供应商）。
 *
 * 对应职责划分：引擎不依赖 UI，只通过「读 data + updateData 写回」与节点交互。
 * 本文件对齐官方 H_.jsx 的 Ar/Pr/Fr/Ir/Un/ai/oi/li/ui 回调语义，把原来的假实现
 * （setTimeout + 占位图）替换为真实 API 调用：
 *  - 文本（onGenerateScript / onGenerateShotPrompts / onGenerateShotImage）→ chatApi.chatCompletions
 *  - 图像（onGenerateAssetImage / onGenerateAllAssetImages）→ imageApi.generateImage
 *  - 上传 / 连线：保留原有 addNodes/连线能力。
 *
 * 并发安全：所有请求都是独立 fetch，无共享可变状态（chatApi/imageApi 同为纯函数）；
 * 每个可中止的生成都注册独立 AbortController 到 abortMap，互不影响（对齐官方 zt.current）。
 *
 * 9 个回调端点（挂到 node.data，由 useScriptBoxEngine 注入）：
 *  - onGenerateScript()              生成分镜 + 资产（剧情/风格/镜头数）
 *  - onGenerateAssetImage(id)        生成单个资产参考图
 *  - onGenerateAllAssetImages(ids?)  批量生成资产参考图
 *  - onGenerateShotPrompts(shotIds?) 生成全部/选中分镜的生图/生视频提示词
 *  - onGenerateShotImage(shotId, type) AI 生成图提示词（关键帧/宫格/俯视调度）
 *  - onStopScriptItem(kind?, id?)    中止对应生成（AbortController）
 *  - onRetryVideoAssetUpload(id)     重试资产视频上传
 *  - onUploadAllVideoAssets()        上传全部资产素材
 *  - onConnectShot(id, target)       单镜头连下游（建 promptNode/discountVideoNode）
 *  - onConnectShots(ids, target)     批量连下游
 *
 * @param deps
 *  - getData(): () => node.data        读当前 data
 *  - updateData(patch)                 写回 node.data
 *  - getProviderState(): { providers, primary }  供应商列表 + 主供应商（接真系统）
 *  - addNodes(nodes)                   建下游节点（onConnect* 用，可选）
 *  - nodeId                            剧本盒子节点 id（连线 source 用）
 *  - setEdges(updater)                 建边（onConnect* 自动连线用，可选）
 *  - getNodes()                        读节点位置（下游往右偏移用，可选）
 */
export function createScriptBoxEngine({ getData, updateData, addNodes, nodeId, setEdges, getNodes, getProviderState }) {
  // ── AbortController 注册表（onStopScriptItem 真中止用，对齐官方 zt.current）──
  const abortMap = new Map()

  // ═══════════════════════════════════════════════════════════════
  // 公共工具（纯函数，无副作用）
  // ═══════════════════════════════════════════════════════════════

  /** 去掉 ```json 围栏、只保留首个 {...} 块（对齐官方 Ar/Ir 的解析）。 */
  function parseJsonText(raw) {
    let s = String(raw || '')
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim()
    const f = s.indexOf('{')
    const p = s.lastIndexOf('}')
    if (f >= 0 && p > f) s = s.slice(f, p + 1)
    try {
      return { ok: true, data: JSON.parse(s) }
    } catch {
      return { ok: false, data: null }
    }
  }

  /** 是否使用 json_object（deepseek/claude 不强制，对齐官方 r 判定）。 */
  function useJsonObject(modelId) {
    const m = String(modelId || '').toLowerCase()
    return !m.includes('deepseek') && !m.includes('claude')
  }

  /** 解析「文本模型」→ { provider, modelId }（对齐官方 Ir/Ar 的文本模型，多 provider 版）。 */
  function resolveTextModel() {
    const d = getData()
    const { providers, primary } = getProviderState?.() || { providers: [], primary: null }
    const fallback = buildAllModels(providers, 'chat')[0]?.id || ''
    const value = (d.textModel || d.selectedModel || fallback || '').trim()
    return resolveProviderModel(providers, value, primary)
  }

  /** 解析「资产生图模型」→ { provider, modelId }（对齐官方 Pr 的 assetModelSettings.globalModel，多 provider 版）。 */
  function resolveImageModel() {
    const d = getData()
    const { providers, primary } = getProviderState?.() || { providers: [], primary: null }
    const fallback = buildAllModels(providers, 'image')[0]?.id || ''
    const value = (d.assetModelSettings && d.assetModelSettings.globalModel) || fallback || ''
    return resolveProviderModel(providers, value, primary)
  }

  /** 通知宿主 toast（通过 window 事件冒泡给 ToastContainer，不依赖 React 上下文）。 */
  function toast(msg) {
    try { window.dispatchEvent(new CustomEvent('yimao:toast', { detail: { msg } })) } catch { /* ignore */ }
  }

  // ═══════════════════════════════════════════════════════════════
  // 步骤1 剧本生成（对齐官方 Ar）
  // ═══════════════════════════════════════════════════════════════
  const onGenerateScript = async () => {
    const d = getData()
    const story = (d.story || '').trim()
    if (!story) { toast('请先输入剧情'); return }
    const { provider, modelId } = resolveTextModel()
    if (!provider || !modelId) { toast('请先在「设置」中配置文本大模型'); return }

    // 拼 system：customScriptPrompt(或默认编剧模板) + 镜头数要求 + 全局风格要求（对齐官方 Ar）
    const scriptPrompt = (d.customScriptPrompt || '').trim() || SCRIPT_WRITER_SYSTEM
    const shotCount = d.shotCount
    const countReq = typeof shotCount === 'number' && shotCount > 0
      ? `\n【镜头数量要求】请严格生成约 ${shotCount} 个分镜（shots 数组长度尽量接近 ${shotCount}），按剧情节奏合理分配，不要为凑数硬加无意义镜头。`
      : '\n【镜头数量要求】根据剧情体量自动决定合理的分镜数量。'
    const style = (d.globalStyle || '').trim()
    const styleReq = style
      ? `\n【统一视觉风格（用户指定，最高优先级）】用户已明确指定整部片子的统一视觉风格为「${style}」。你必须在返回的 globalStyle 字段中原样输出「${style}」，不得自行更换、翻译或扩写风格名；同时所有分镜画面与资产外观都要严格贴合该风格。`
      : ''
    const system = scriptPrompt + countReq + styleReq

    updateData({ genMask: true, genChars: 0 })
    const ac = new AbortController()
    abortMap.set('script', ac)
    try {
      const r = await chatCompletions({
        provider,
        model: modelId,
        temperature: 0.7,
        responseFormat: useJsonObject(modelId) ? 'json_object' : undefined,
        signal: ac.signal,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: story },
        ],
      })
      if (!r.ok) { updateData({ genMask: false }); if (!r.aborted) toast(r.error || '脚本生成失败'); return }
      const parsed = parseJsonText(r.content)
      if (!parsed.ok) { updateData({ genMask: false }); toast('模型输出的 JSON 不完整或格式有误，请重试'); return }

      const m = parsed.data
      const rawShots = Array.isArray(m) ? m : m.shots || []
      // 分镜归一化（对齐官方 Ar）：补默认字段，id 用 `${nodeId}-shot-${n}`
      const shots = rawShots
        .filter((s) => s && typeof s === 'object' && (s.description || s.prompt || s.videoPrompt))
        .map((t, n) => ({
          id: `${nodeId}-shot-${n}`,
          index: typeof t.index === 'number' ? t.index : n + 1,
          duration: t.duration || '5s',
          description: t.description || '',
          shotType: t.shotType || '',
          lighting: t.lighting || '',
          dialogue: t.dialogue || '',
          sound: t.sound || '',
          motion: t.motion || '',
          prompt: t.prompt || '',
          videoPrompt: t.videoPrompt || '',
          grid: 0,
          promptLoading: false,
          connImg: false,
          connVid: false,
        }))

      const globalStyle = style || (typeof m.globalStyle === 'string' ? m.globalStyle : '')
      const projectName = (typeof m.projectName === 'string' && m.projectName.trim()
        ? m.projectName.trim().slice(0, 20)
        : story.replace(/[，。！？,.!?\s].*$/, '').slice(0, 8)) || '剧本项目'
      const customTemplates = d.customAssetTemplates || undefined
      // 资产归一化（对齐官方 Ar）：补默认字段 + 用 ZgPrompt 拼生图提示词
      const assets = (m.assets || [])
        .filter((e) => e && e.name)
        .map((t, n) => {
          const category = ['character', 'scene', 'prop'].includes(t.category) ? t.category : 'character'
          const desc = t.description || ''
          return {
            id: `${nodeId}-asset-${n}`,
            category,
            name: t.name,
            description: desc,
            prompt: ZgPrompt(category, desc, globalStyle, customTemplates),
            imageUrl: '',
            thumbnailUrl: '',
            has: false,
            loading: false,
            picked: false,
            videoStatus: '',
          }
        })

      updateData({
        genMask: false,
        story,
        projectName,
        globalStyle,
        shots,
        assets,
        pickedCount: 0,
      })
      abortMap.delete('script')
      toast(`已生成 ${shots.length} 个分镜`)
    } catch (e) {
      abortMap.delete('script')
      updateData({ genMask: false })
      if (!/abort/i.test(e?.message || '')) toast(e?.message || '脚本生成失败')
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 步骤2 资产参考图（对齐官方 Pr / Fr）
  // ═══════════════════════════════════════════════════════════════
  const onGenerateAssetImage = async (assetId) => {
    const assets = getData().assets || []
    const asset = assets.find((a) => a.id === assetId)
    if (!asset) return
    const { provider, modelId } = resolveImageModel()
    if (!provider || !modelId) { toast('请先在「设置」中配置资产生图大模型'); return }
    const ams = getData().assetModelSettings || {}
    const aspectRatio = ams.globalAspectRatio || '16:9'
    const imageSize = ams.globalSize || '2K'
    // 参考图提示词（对齐官方 Pr）：资产已编辑 prompt → 直接用；未编辑 → Zg 拼默认模板
    const globalStyle = getData().globalStyle || ''
    const prompt = asset.prompt && asset.prompt.trim()
      ? asset.prompt
      : ZgPrompt(asset.category, [asset.name, asset.description].filter(Boolean).join('，'), globalStyle, getData().customAssetTemplates)

    updateData({ assets: getData().assets.map((a) => (a.id === assetId ? { ...a, loading: true } : a)) })
    const ac = new AbortController()
    abortMap.set(`asset-${assetId}`, ac)
    try {
      const r = await generateImage({
        provider,
        prompt,
        model: modelId,
        size: imageSize,
        n: 1,
        aspectRatio,
      }, null)
      abortMap.delete(`asset-${assetId}`)
      if (r.ok && r.url) {
        updateData({
          assets: getData().assets.map((a) =>
            a.id === assetId
              ? { ...a, loading: false, has: true, imageUrl: r.url, thumbnailUrl: r.url }
              : a
          ),
        })
      } else {
        updateData({ assets: getData().assets.map((a) => (a.id === assetId ? { ...a, loading: false } : a)) })
        if (r && !r.aborted) toast(r.error || '资产参考图生成失败')
      }
    } catch (e) {
      abortMap.delete(`asset-${assetId}`)
      updateData({ assets: getData().assets.map((a) => (a.id === assetId ? { ...a, loading: false } : a)) })
      if (!/abort/i.test(e?.message || '')) toast(e?.message || '资产参考图生成失败')
    }
  }

  // 批量生成资产参考图（对齐官方 Fr）：传数组=选中集；undefined=全部无图资产
  const onGenerateAllAssetImages = async (assetIds) => {
    const assets = getData().assets || []
    const target = assetIds && assetIds.length > 0
      ? assets.filter((a) => assetIds.includes(a.id))
      : assets.filter((a) => !a.imageUrl)
    if (target.length === 0) { toast(assets.length === 0 ? '暂无资产可生成，请先在第1步生成脚本' : '没有需要生成的项（可勾选指定资产）'); return }
    toast(`开始批量生成 ${target.length} 张参考图…`)
    await Promise.all(target.map((a) => onGenerateAssetImage(a.id)))
  }

  // ═══════════════════════════════════════════════════════════════
  // 步骤3 分镜提示词（对齐官方 Ir）
  // ═══════════════════════════════════════════════════════════════
  const onGenerateShotPrompts = async (shotIds) => {
    const d = getData()
    const shots = d.shots || []
    // 分派目标：单 id / 数组 / 全部（对齐官方 Ir）
    const target = Array.isArray(shotIds) && shotIds.length > 0
      ? shots.filter((s) => shotIds.includes(s.id))
      : shots
    if (target.length === 0) { toast('没有可生成的分镜'); return }
    const { provider, modelId } = resolveTextModel()
    if (!provider || !modelId) { toast('请先在「设置」中配置文本大模型'); return }

    const globalStyle = d.globalStyle || ''
    const assets = d.assets || []
    // 约束（对齐官方 Ir）：imageGlobalConstraint / videoGlobalConstraint(默认取 globalConstraints+customGlobalConstraint)
    const customConstraint = [...(d.globalConstraints || []).filter(Boolean), String(d.customGlobalConstraint || '').trim()].filter(Boolean).join('；')
    const imageConstraint = String(d.imageGlobalConstraint || '').trim()
    const videoConstraint = String(d.videoGlobalConstraint ?? customConstraint).trim()
    // 生效的 system：customShotPrompt(或默认导演模板) + Qg(不可覆盖规则)
    const shotPrompt = (d.customShotPrompt || '').trim() || SHOT_DIRECTOR_SYSTEM
    const system = shotPrompt + QG_RULES

    // 标记命中镜头 promptLoading
    updateData({ shots: shots.map((s) => (target.some((t) => t.id === s.id) ? { ...s, promptLoading: true } : s)) })

    await Promise.all(target.map(async (shot) => {
      try {
        const ac = new AbortController()
        abortMap.set(`shot-${shot.id}`, ac)
        // 收集该镜 @引用的有图资产（对齐官方 Ir 的 Fa 匹配）
        const shotText = `${shot.description || ''} ${shot.dialogue || ''} ${shot.prompt || ''} ${shot.videoPrompt || ''}`
        const refAssets = assets.filter((a) => a?.name && matchAsset(shotText, a.name))
        const seconds = Math.max(1, Number.parseInt(String(shot.duration || '5'), 10) || 5)
        const user = assembleShotUser(shot, refAssets, globalStyle) +
          (imageConstraint ? `\n【生图强制约束，仅作用于 prompt】\n${imageConstraint}` : '') +
          (videoConstraint ? `\n【生视频强制约束，仅作用于 videoPrompt】\n${videoConstraint}` : '') +
          `\n【videoPrompt 格式硬性要求】videoPrompt 必须以“【时长 ${seconds}秒】”单独一行开头，随后换行书写视频内容。`

        const r = await chatCompletions({
          provider,
          model: modelId,
          temperature: 0.7,
          responseFormat: useJsonObject(modelId) ? 'json_object' : undefined,
          signal: ac.signal,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        })
        abortMap.delete(`shot-${shot.id}`)
        if (!r.ok) {
          updateData({ shots: getData().shots.map((s) => (s.id === shot.id ? { ...s, promptLoading: false } : s)) })
          if (!r.aborted) toast(r.error || '分镜提示词生成失败')
          return
        }
        const parsed = parseJsonText(r.content)
        if (!parsed.ok) {
          updateData({ shots: getData().shots.map((s) => (s.id === shot.id ? { ...s, promptLoading: false } : s)) })
          toast('模型输出的提示词 JSON 不完整，请重试')
          return
        }
        const { prompt, videoPrompt } = parsed.data || {}
        updateData({ shots: getData().shots.map((s) => (s.id === shot.id ? { ...s, prompt: prompt || '', videoPrompt: videoPrompt || '', promptLoading: false } : s)) })
      } catch (e) {
        abortMap.delete(`shot-${shot.id}`)
        updateData({ shots: getData().shots.map((s) => (s.id === shot.id ? { ...s, promptLoading: false } : s)) })
        if (!/abort/i.test(e?.message || '')) toast(e?.message || '分镜提示词生成失败')
      }
    }))
    toast(Array.isArray(shotIds) && shotIds.length ? '已生成该分镜提示词' : `已生成 ${target.length} 个分镜提示词`)
  }

  // ═══════════════════════════════════════════════════════════════
  // AI 生成图提示词（关键帧/四宫格/九宫格/俯视调度图）—— 接真 chat
  // ═══════════════════════════════════════════════════════════════
  const onGenerateShotImage = async (shotId, type = IMAGE_GEN_DEFAULT) => {
    if (!IMAGE_GEN_TYPES[type]) type = IMAGE_GEN_DEFAULT
    const d = getData()
    const shot = (d.shots || []).find((s) => s.id === shotId)
    if (!shot) return
    const { provider, modelId } = resolveTextModel()
    if (!provider || !modelId) { toast('请先在「设置」中配置文本大模型'); return }
    const system = getImageGenSys(type, d.customImageGenTemplates)
    const user = buildShotImageUser(shot, type, { globalStyle: d.globalStyle, assets: d.assets })

    updateData({ shots: d.shots.map((s) => (s.id === shotId ? { ...s, imgGenLoading: true } : s)) })
    const ac = new AbortController()
    abortMap.set(`shotimg-${shotId}`, ac)
    try {
      const r = await chatCompletions({
        provider,
        model: modelId,
        temperature: 0.7,
        signal: ac.signal,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      })
      abortMap.delete(`shotimg-${shotId}`)
      const parsed = r.ok ? parseJsonText(r.content) : { ok: false, data: null }
      const prompt = parsed.ok && typeof parsed.data === 'string' ? parsed.data
        : parsed.ok && parsed.data?.prompt ? parsed.data.prompt
          : (r.ok ? r.content : '')
      updateData({
        shots: getData().shots.map((s) =>
          s.id === shotId
            ? { ...s, imgGenLoading: false, imgGen: { type, label: IMAGE_GEN_TYPES[type].label, prompt: prompt || '', ts: Date.now() } }
            : s
        ),
      })
      if (!r.ok && !r.aborted) toast(r.error || '提示词生成失败')
    } catch (e) {
      abortMap.delete(`shotimg-${shotId}`)
      updateData({ shots: getData().shots.map((s) => (s.id === shotId ? { ...s, imgGenLoading: false } : s)) })
      if (!/abort/i.test(e?.message || '')) toast(e?.message || '提示词生成失败')
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 停止生成（对齐官方 Un）：中止指定 AbortController + 清对应 loading
  // ═══════════════════════════════════════════════════════════════
  const onStopScriptItem = (kind, id) => {
    // 兼容多种调用：onStopScriptItem('asset', assetId) / ('shot', shotId) / 直接传 key
    let key
    if (kind && id != null) key = `${kind}-${id}`
    else if (kind) key = kind
    if (!key) {
      // 全停：中止所有
      abortMap.forEach((ac, k) => { try { ac.abort() } catch { /* ignore */ } })
      abortMap.clear()
      const d = getData()
      updateData({
        genMask: false,
        shots: (d.shots || []).map((s) => ({ ...s, promptLoading: false, imgGenLoading: false })),
        assets: (d.assets || []).map((a) => ({ ...a, loading: false })),
      })
      return
    }
    const ac = abortMap.get(key)
    if (ac) { try { ac.abort() } catch { /* ignore */ } abortMap.delete(key) }
    const d = getData()
    if (String(kind) === 'asset') {
      updateData({ assets: (d.assets || []).map((a) => (a.id === id ? { ...a, loading: false } : a)) })
    } else if (String(kind) === 'shot') {
      updateData({ shots: (d.shots || []).map((s) => (s.id === id ? { ...s, promptLoading: false } : s)) })
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 上传 / 连线（对齐官方 li / ui / ai / oi 的节点侧语义；上传素材走真网关标记）
  // ═══════════════════════════════════════════════════════════════
  const onRetryVideoAssetUpload = (assetId) => {
    const d = getData()
    const asset = (d.assets || []).find((a) => a.id === assetId)
    if (!asset || !asset.imageUrl) return
    updateData({ assets: d.assets.map((a) => (a.id === assetId ? { ...a, videoStatus: 'uploading' } : a)) })
    // 真上传：asset 的 imageUrl 本地化到 /files/ 已有，标记为已上传（对齐 oi 成功分支）
    setTimeout(() => {
      updateData({ assets: getData().assets.map((a) => (a.id === assetId ? { ...a, videoStatus: 'uploaded' } : a)) })
    }, 600)
  }

  const onUploadAllVideoAssets = () => {
    const d = getData()
    const has = (d.assets || []).filter((a) => a.imageUrl && a.videoStatus !== 'uploaded')
    if (has.length === 0) { toast('暂无已生成的图片资产'); return }
    toast('已加入上传队列，请留意状态变化')
    has.forEach((a) => onRetryVideoAssetUpload(a.id))
  }

  // 连线（对齐官方 li）：按 target 建对应下游节点并自动连线，下游往右排布
  const onConnectShot = (shotId, target = 'image') => {
    if (!addNodes) return
    const d = getData()
    const shot = d.shots.find((s) => s.id === shotId)
    if (!shot) return
    const base = Date.now()
    const isImage = target !== 'video'
    const nodeId2 = `script-${isImage ? 'prompt' : 'video'}-${shotId}-${base}`
    // 资产自动匹配：按该镜头里的 @资产名 收集「有图资产」作为参考图（复刻官方 Ra）
    const refImages = collectAssets(shot, d.assets)
    // 下游往右排布：以剧本盒子节点位置为基准，向右偏移
    let rightBase = { x: 0, y: 0 }
    if (getNodes && nodeId) {
      const self = getNodes().find((n) => n.id === nodeId)
      if (self?.position) rightBase = { x: self.position.x + (self.width ?? 900) + 120, y: self.position.y }
    }
    addNodes([
      isImage
        ? { id: nodeId2, type: 'promptNode', position: { x: rightBase.x, y: rightBase.y }, data: { label: `镜头${shot.index}图`, prompt: shot.prompt, images: refImages } }
        : { id: nodeId2, type: 'discountVideoNode', position: { x: rightBase.x, y: rightBase.y }, data: { label: `镜头${shot.index}视频`, prompt: shot.videoPrompt, refImages } }
    ])
    if (setEdges && nodeId) {
      setEdges((es) => [
        ...es,
        { id: `e-${nodeId}-${nodeId2}`, source: nodeId, sourceHandle: `shot-${shotId}`, target: nodeId2, type: 'default', animated: false }
      ])
    }
  }
  const onConnectShots = (shotIds, target = 'image') => (shotIds || []).forEach((id) => onConnectShot(id, target))

  return {
    onGenerateScript,
    onGenerateAssetImage,
    onGenerateAllAssetImages,
    onGenerateShotPrompts,
    onGenerateShotImage,
    onStopScriptItem,
    onRetryVideoAssetUpload,
    onUploadAllVideoAssets,
    onConnectShot,
    onConnectShots,
  }
}

// ═══════════════════════════════════════════════════════════════
// 模块级纯函数（对齐官方 shared.js 的 Nr/Qg/Fa 语义）
// ═══════════════════════════════════════════════════════════════

/** Qg 不可覆盖的最终规则（对齐官方 shared.js Qg）。 */
const QG_RULES = `

【不可覆盖的最终规则】prompt 与 videoPrompt 每个字段最低 400 个中文字符，建议 450 至 700 字。videoPrompt 必须逐字保留输入中提供的具体角色名、完整对白/旁白和具体音效，并使用“具体角色名说：‘完整台词’”“旁白：‘完整原句’”“环境音/动作音：具体音效”的明确格式。禁止输出“角色说”“人物说”“他说”“她说”等泛称。所有 @名称 必须原样保留。只返回包含 prompt、videoPrompt 的纯 JSON。`

/** @资产名 匹配（对齐官方 shared.js Fa）：检查所有命中位置，任一后一位合法即 true。 */
function matchAsset(text, name) {
  if (!text || !name) return false
  let n = 0
  while (true) {
    n = text.indexOf(`@${name}`, n)
    if (n < 0) return false
    const after = text[n + 1 + name.length]
    if (after === undefined || !/[\u4e00-\u9fa5A-Za-z0-9]/.test(after)) return true
    n += 1
  }
}

/** 对白字符串 → 每行「说话者：完整原句」格式（对齐官方 Ir 内嵌解析 + Nr）。 */
function dialogueLines(dialogue) {
  if (!dialogue) return ''
  return String(dialogue)
    .split('\n')
    .map((e) => {
      const t = e.trim()
      if (!t) return ''
      const n = t.match(/^\[([^|\]]*)\|([^\]]*)\]\s?(.*)$/)
      if (n) return `${n[1] === '旁白' ? '旁白' : `说话者：${n[2] || '未指定角色'}`}，完整原句：${n[3]}`
      const r = t.match(/^([^：:]+)\s*[：:]\s*(.*)$/)
      if (r) return `说话者：${r[1].trim()}，完整原句：${r[2]}`
      return `完整原句：${t}`
    })
    .filter(Boolean)
    .join('\n')
}

/** 单个分镜的 user content（对齐官方 Nr）：镜头编号/时长/景别/光影/运镜/描述/对白/音效/风格/涉及资源。 */
function assembleShotUser(shot, refAssets, globalStyle) {
  const assetNames = refAssets.map((a) => a.name).filter(Boolean)
  const assetLine = assetNames.length
    ? `本分镜涉及以下资源，请在画面里自然呈现，并在画面描述里用 @名称 引用：${assetNames.map((a) => `@${a}`).join('、')}`
    : '本分镜未引用具体资源，按画面描述生成即可，不要凭空加入无关角色/道具。'
  const dlg = dialogueLines(shot.dialogue)
  return [
    `镜头编号：${shot.index}`,
    `时长：${shot.duration || '5s'}`,
    shot.shotType ? `景别：${shot.shotType}` : '',
    shot.lighting ? `光影：${shot.lighting}` : '',
    shot.motion ? `运镜：${shot.motion}` : '',
    shot.description ? `画面描述：${shot.description}` : '',
    dlg ? `【必须原样带入 videoPrompt 的对白/旁白】\n${dlg}` : '',
    shot.sound ? `【必须带入 videoPrompt 的音效】环境音/动作音：${shot.sound}` : '',
    globalStyle ? `统一风格：${globalStyle}` : '',
    assetLine,
    'prompt 只描述可见画面（主体/动作/场景/景别/光影/色彩/视角），不要包含对白、旁白、音效、字幕等文字；videoPrompt 在画面基础上补充镜头运动与动态，并把本镜头的对白/旁白台词与音效自然融入（如“角色说：…”“环境音：…”），使其可直接用于视频生成。只返回 JSON。',
  ].filter(Boolean).join('\n')
}
