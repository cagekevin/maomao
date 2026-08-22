import { buildShotImageUser, getImageGenSys, collectAssets, matchAsset, ZgPrompt, IMAGE_GEN_TYPES, IMAGE_GEN_DEFAULT, SCRIPT_WRITER_SYSTEM, SCRIPT_WRITER_FORMAT, SHOT_DIRECTOR_SYSTEM, SHOT_AUDIT_SYSTEM, buildAuditUser, getWorkflow } from './scriptBoxPrompts.js'
import { chatCompletions } from './chatApi.js'
import { generateImage } from './imageApi.js'
import { resolveProviderModel, buildAllModels } from './providerModels.js'
import { localizeAndStoreToLibrary, assetFolderOf } from './assetStore.js'
import { uploadFileToLocal } from './filesApi.js'
import { toAbsoluteFileUrl } from './imageUrl.js'
import { showToast } from './toastStore.js'
import { logger } from './logger.js'

/** 去掉 ```json 围栏、只保留首个 {...} 块（对齐官方 Ar/Ir 的解析）。
 *  顶层纯函数，导出供单测（剧本盒纯逻辑）。 */
export function parseJsonText(raw) {
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

/** 是否使用 json_object（deepseek/claude 不强制，对齐官方 r 判定）。
 *  顶层纯函数，导出供单测（剧本盒纯逻辑）。 */
export function useJsonObject(modelId) {
  const m = String(modelId || '').toLowerCase()
  return !m.includes('deepseek') && !m.includes('claude')
}

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
 * 10 个回调端点（挂到 node.data，由 useScriptBoxEngine 注入）：
 *  - onGenerateScript()              生成分镜 + 资产（剧情/风格/镜头数）
 *  - onGenerateAssetImage(id)        生成单个资产参考图
 *  - onGenerateAllAssetImages(ids?)  批量生成资产参考图
 *  - onGenerateShotPrompts(shotIds?) 生成全部/选中分镜的生图/生视频提示词
 *  - onGenerateShotImage(shotId, type) AI 生成图提示词（关键帧/宫格/俯视调度）
 *  - onStopScriptItem(kind?, id?)    中止对应生成（AbortController）
 *  - onRetryAssetImageUpload(id)     重试资产参考图上传
 *  - onUploadAllAssetImages()        上传全部资产素材
 *  - onUploadAssetImage(id, file)    上传本地图片设为资产参考图
 *  - onConnectShot(id, target)       单镜头连下游（建 promptNode/discountVideoNode）
 *  - onConnectShots(ids, target)     批量连下游
 *  - onGenerateTailFrameVariants(id) 抽上一镜尾帧→多角度生图→写回变体（P1-2）
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
export function createScriptBoxEngine({ getData, updateData, addNodes, nodeId, setEdges, getNodes, getProviderState, captureVideoFrame: cf = captureVideoFrame }) {
  // ── AbortController 注册表（onStopScriptItem 真中止用，对齐官方 zt.current）──
  const abortMap = new Map()

  // ═══════════════════════════════════════════════════════════════
  // 公共工具（纯函数，无副作用）
  // ═══════════════════════════════════════════════════════════════

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

  /**
   * 通知宿主 toast —— 走统一 store（toastStore.showToast → ToastContainer 顶部渲染）。
   * 背景：旧实现用 window 事件 `yimao:toast` 但「只发不收」（无订阅方，见 docs/实时总线… §五），
   * 报错被静默吞掉、用户看不到。改走 toastStore 后所有提示（含配置缺失/失败）显示到统一位置。
   * @param {string} msg 提示内容
   * @param {'success'|'error'|'warning'|'info'} [type] 状态档；未传时按内容关键词自动分档：
   *   - 含「已生成/已加入/开始/完成」等 → success（成功/进行提示）
   *   - 其余一律 → error（剧本盒引擎 toast 绝大多数是失败/配置缺失/上游错误等需醒目提示，
   *     上游错误文本（如「网络错误」）无法穷举关键词，故默认按 error 处理，避免漏显红条）
   */
  function toast(msg, type) {
    const m = String(msg || '')
    let t = type
    if (!t) {
      t = /已生成|已加入|开始批量|已完成|开始上传/.test(m) ? 'success' : 'error'
    }
    showToast(m, { type: t, duration: t === 'error' ? 5000 : undefined })
  }

  /**
   * 批量写回合并器（P11 收口，抽公共工具消除两份逐字重复）。
   * 用「队列累积 + 200ms 窗口」把多次 updateData 合并为低频一次 setNodes，
   * 避免每完成一个分镜/资产图就全图重建节点数组。必须累积所有 patch，
   * 不能用普通 debounce（否则丢中间项）。
   * @param {(fn:(latest)=>data)=>void} updateData 写回更新器
   * @returns {{ enqueuePatch:(apply:(latest)=>data)=>void, flushPatches:()=>void }}
   */
  function createPatchBatcher(updateData, windowMs = 200) {
    const patchQueue = []
    let flushTimer = null
    const flushPatches = () => {
      if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
      const q = patchQueue.splice(0)
      if (!q.length) return
      updateData((latest) => {
        let d = latest
        for (const apply of q) d = apply(d)
        return d
      })
    }
    const enqueuePatch = (apply) => {
      patchQueue.push(apply)
      if (flushTimer == null) flushTimer = setTimeout(flushPatches, windowMs)
    }
    return { enqueuePatch, flushPatches }
  }

  /**
   * 统一「可中止生成」骨架（收口 AbortController 注册/注销 + catch 分级样板，4 处复用）。
   * 职责（只收敛脚手架，不改任何业务写回语义）：
   *  - 建 AbortController 注册到 abortMap（供 onStopScriptItem 真中止），finally 统一注销；
   *  - 成功/业务失败分支由调用方 task 内部自行 return（各写回逻辑差异大，留在调用点）；
   *  - 仅当 task 抛出未捕获异常时按 /abort/ 分级：中止→logger.warn（不扰用户）；
   *    真错误→toast + logger.error（真实透传，见 CONTEXT §0 轻量兜底）；
   *  - onReset：异常时清 loading 的写回落点（各调用点写回语义不同）。
   * @param {string} key   abortMap 注册键（onStopScriptItem 真中止用，如 `shot-${id}`）
   * @param {()=>void} onReset  异常/中止时复位 loading
   * @param {(signal)=>Promise} task  业务异步任务（拿 signal 传给 API）
   * @param {{logLabel:string,toastFail:string,ctx:object}} info 分级日志/提示文案
   */
  const runAbortable = async (key, onReset, task, info) => {
    const ac = new AbortController()
    abortMap.set(key, ac)
    try {
      await task(ac.signal)
    } catch (e) {
      onReset?.()
      if (/abort/i.test(e?.message || '')) {
        logger.warn('scriptBox', `${info.logLabel}·已中止`, info.ctx)
      } else {
        toast(e?.message || info.toastFail)
        logger.error('scriptBox', `${info.logLabel}·异常`, { ...info.ctx, error: e?.message })
      }
    } finally {
      abortMap.delete(key)
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 步骤1 剧本生成（对齐官方 Ar）
  // ═══════════════════════════════════════════════════════════════
  const onGenerateScript = async () => {
    const d = getData()
    // 剧情 = 用户手动输入 story + 连线上游文本节点接入的剧情（data.upstreamStory）。
    // 上游文本是「智能接受文本节点接入剧情」的通道：textNode 连入剧本盒子后，其文本
    // 作为剧情来源之一，与手填 story 合并后一起交给编剧模型生成分镜。
    const userStory = (d.story || '').trim()
    const upstreamStory = (d.upstreamStory || '').trim()
    const story = [userStory, upstreamStory].filter(Boolean).join('\n\n')
    // 上游接入图片（data.upstreamImages，由 ScriptBoxNode 从 useConnectedInputs 同步）。
    // 编剧模型需要「知道产品外观」才能写出准确剧本，故把上游图片作为视觉参考一并传入
    //（chatCompletions 会把图片转成 image_url 内容块，让 AI 看图理解产品外观）。
    const upstreamImageUrls = (Array.isArray(d.upstreamImages) ? d.upstreamImages : [])
      .map((im) => (im && im.url ? im.url : ''))
      .filter(Boolean)
    if (!story) { toast('请先输入剧情或连接上游文本节点'); return }
    const { provider, modelId } = resolveTextModel()
    if (!provider || !modelId) { toast('请先在「设置」中配置文本大模型'); return }

    // 拼 system：创作部分（customScriptPrompt 可覆盖工作流默认编剧模板）+ 固定输出格式（不可覆盖）+ 镜头数 + 风格。
    // 输出 JSON 结构（SCRIPT_WRITER_FORMAT）是引擎解析契约，必须始终固定追加，即使用户自定义了创作提示词也不丢失。
    const scriptPrompt = (d.customScriptPrompt || '').trim() || getWorkflow(d.workflowId).script || SCRIPT_WRITER_SYSTEM
    // 镜头数量：预设(10/20/30/50) 为 number；自定义模式 shotCount==='custom' 时取 customCount
    // 数字；auto 或未提供有效数字时由模型按剧情节奏决定。
    const shotCountRaw = d.shotCount === 'custom' ? d.customCount : d.shotCount
    const shotCountNum = Number(shotCountRaw)
    const shotCount = Number.isFinite(shotCountNum) && shotCountNum > 0 ? Math.floor(shotCountNum) : null
    const countReq = shotCount != null
      ? `\n【镜头数量要求】请严格生成约 ${shotCount} 个分镜（shots 数组长度尽量接近 ${shotCount}），按剧情节奏合理分配，不要为凑数硬加无意义镜头。`
      : '\n【镜头数量要求】根据剧情体量自动决定合理的分镜数量。'
    const style = (d.globalStyle || '').trim()
    const styleReq = style
      ? `\n【统一视觉风格（用户指定，最高优先级）】用户已明确指定整部片子的统一视觉风格为「${style}」。你必须在返回的 globalStyle 字段中原样输出「${style}」，不得自行更换、翻译或扩写风格名；同时所有分镜画面与资产外观都要严格贴合该风格。`
      : ''
    const system = scriptPrompt + SCRIPT_WRITER_FORMAT + countReq + styleReq

    updateData({ genMask: true, genChars: 0 })
    logger.info('scriptBox', '生成剧本·开始', { nodeId, provider: provider?.id, model: modelId, storyLen: story.length, imgs: upstreamImageUrls.length, shotCount })
    return runAbortable('script', () => updateData({ genMask: false }), async (signal) => {
      const r = await chatCompletions({
        provider,
        model: modelId,
        temperature: 0.7,
        responseFormat: useJsonObject(modelId) ? 'json_object' : undefined,
        signal,
        images: upstreamImageUrls,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: story },
        ],
      })
      if (!r.ok) { updateData({ genMask: false }); if (!r.aborted) toast(r.error || '脚本生成失败'); logger.error('scriptBox', '生成剧本·上游失败', { nodeId, error: r.error }); return }
      logger.info('scriptBox', '生成剧本·上游返回', { nodeId, contentLen: (r.content || '').length })
      const parsed = parseJsonText(r.content)
      if (!parsed.ok) { updateData({ genMask: false }); toast('模型输出的 JSON 不完整或格式有误，请重试'); logger.error('scriptBox', '生成剧本·JSON解析失败', { nodeId }); return }

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

      // 结构校验：JSON 合法但未解析出任何可用分镜 → 视为格式不符，明确提示而非静默变空。
      if (shots.length === 0) {
        updateData({ genMask: false })
        toast('模型返回的剧本 JSON 格式不符（未解析出分镜），请重试')
        logger.error('scriptBox', '生成剧本·格式不符（无有效分镜）', { nodeId })
        return
      }

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
            imageStatus: '',
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
      toast(`已生成 ${shots.length} 个分镜`)
      logger.info('scriptBox', '生成剧本·成功', { nodeId, shots: shots.length, assets: assets.length, projectName, globalStyle })
    }, { logLabel: '生成剧本', toastFail: '脚本生成失败', ctx: { nodeId } })
  }

  // ═══════════════════════════════════════════════════════════════
  // 步骤2 资产参考图（对齐官方 Pr / Fr）
  // ═══════════════════════════════════════════════════════════════
  const onGenerateAssetImage = async (assetId, enqueuePatch) => {
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

    // 单张：直接 updateData；批量：走 enqueuePatch 合并（P11 收口）
    const commit = enqueuePatch || updateData
    commit((latest) => ({ assets: (latest.assets || []).map((a) => (a.id === assetId ? { ...a, loading: true } : a)) }))
    logger.info('scriptBox', '生成资产图·开始', { nodeId, assetId, name: asset.name, provider: provider?.id, model: modelId, aspectRatio, imageSize })
    return runAbortable(`asset-${assetId}`, () => commit((latest) => ({ assets: (latest.assets || []).map((a) => (a.id === assetId ? { ...a, loading: false } : a)) })), async () => {
      const r = await generateImage({
        provider,
        prompt,
        model: modelId,
        size: imageSize,
        n: 1,
        aspectRatio,
      }, null)
      if (r.ok && r.url) {
        // P2-1/P2-2：生图成功后把结果本地化落盘到素材库目录（migrated/{人物|场景|道具}），
        // 彻底替换旧的「上游 https 直链」式临时/外部 URL，让下游生图/生视频引用持久 /files/ 地址。
        // 缩略图机制统一：不再自产落盘独立 _thumb 文件，thumbnailUrl 回退原图，
        // 显示时由系统按需出图端点（buildThumbnailUrl）出小图（与画布 ImageNode 一致）。
        let imageUrl = r.url
        try {
          const localized = await localizeAndStoreToLibrary(r.url, { name: asset.name, folder: assetFolderOf(asset.category) })
          if (localized) imageUrl = localized
        } catch (e) {
          logger.warn('scriptBox', '资产图本地化落盘失败，保留原 URL', { nodeId, assetId, error: e?.message })
        }
        const thumbnailUrl = imageUrl
        commit((latest) => ({
          assets: (latest.assets || []).map((a) =>
            a.id === assetId
              ? { ...a, loading: false, has: true, imageUrl, thumbnailUrl }
              : a
          ),
        }))
        logger.info('scriptBox', '生成资产图·成功', { nodeId, assetId, url: imageUrl, thumbnailUrl })
      } else {
        commit((latest) => ({ assets: (latest.assets || []).map((a) => (a.id === assetId ? { ...a, loading: false } : a)) }))
        if (r && !r.aborted) toast(r.error || '资产参考图生成失败')
        if (r && !r.aborted) logger.error('scriptBox', '生成资产图·上游失败', { nodeId, assetId, error: r.error })
        else logger.warn('scriptBox', '生成资产图·已中止', { nodeId, assetId })
      }
    }, { logLabel: '生成资产图', toastFail: '资产参考图生成失败', ctx: { nodeId, assetId } })
  }

  // 批量生成资产参考图（对齐官方 Fr）：传数组=选中集；undefined=全部无图资产
  const onGenerateAllAssetImages = async (assetIds) => {
    const assets = getData().assets || []
    const target = assetIds && assetIds.length > 0
      ? assets.filter((a) => assetIds.includes(a.id))
      : assets.filter((a) => !a.imageUrl)
    if (target.length === 0) { toast(assets.length === 0 ? '暂无资产可生成，请先在第1步生成脚本' : '没有需要生成的项（可勾选指定资产）'); return }
    toast(`开始批量生成 ${target.length} 张参考图…`)
    logger.info('scriptBox', '批量生成资产图·开始', { nodeId, count: target.length, ids: target.map((a) => a.id) })
    // P11 收口：批量生成期间多次资产写回合并为低频一次 setNodes（同 onGenerateShotPrompts 范式）
    const { enqueuePatch, flushPatches } = createPatchBatcher(updateData)
    await Promise.all(target.map((a) => onGenerateAssetImage(a.id, enqueuePatch)))
    flushPatches()
    logger.info('scriptBox', '批量生成资产图·完成', { nodeId, count: target.length })
  }

  // ═══════════════════════════════════════════════════════════════
  // 步骤3 分镜提示词（对齐官方 Ir）
  // ═══════════════════════════════════════════════════════════════
  const onGenerateShotPrompts = async (shotIds, feedback) => {
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
    // 生效的 system：customShotPrompt(或工作流默认导演模板) + 工作流不可覆盖规则(可被 customQGPrompt 覆盖)
    const shotPrompt = (d.customShotPrompt || '').trim() || getWorkflow(d.workflowId).shot || SHOT_DIRECTOR_SYSTEM
    const qgRule = (d.customQGPrompt || '').trim() || getWorkflow(d.workflowId).qg
    const system = shotPrompt + (qgRule ? `\n\n${qgRule}` : '')

    logger.info('scriptBox', '生成分镜提示词·开始', { nodeId, count: target.length, provider: provider?.id, model: modelId, feedback: !!feedback })

    // P11 收口：批量生成期间，多个分镜完成的写回合并为低频一次 setNodes，
    // 避免「每完成一个分镜就全图 node 数组重建」导致画布节点多时频繁全量重算。
    // 用带队列的 200ms 窗口合并（必须累积所有 patch，不能用普通 debounce 否则丢中间分镜）。
    const { enqueuePatch, flushPatches } = createPatchBatcher(updateData)

    const genShot = async (shot) => {
      // 每个分镜发起时打一条日志（逐镜跟踪批量进度）
      logger.info('scriptBox', '生成分镜提示词·单镜开始', { nodeId, shotId: shot.id, index: shot.index })
      // 只在真正发起该分镜请求时置 loading → 动画精确反映「当前正在请求的分镜」。
      // 注意：必须用函数式更新基于「最新 data」计算，避免并发时 getData() 读到旧引用
      // 导致多个分镜的 loading 互相覆盖、动画闪现/产生不了。
      enqueuePatch((latest) => ({ shots: (latest.shots || []).map((s) => (s.id === shot.id ? { ...s, promptLoading: true } : s)) }))
      return runAbortable(`shot-${shot.id}`, () => enqueuePatch((latest) => ({ shots: (latest.shots || []).map((s) => (s.id === shot.id ? { ...s, promptLoading: false } : s)) })), async (signal) => {
        // 收集该镜 @引用的有图资产（对齐官方 Ir 的 Fa 匹配）
        const shotText = `${shot.description || ''} ${shot.dialogue || ''} ${shot.prompt || ''} ${shot.videoPrompt || ''}`
        const refAssets = assets.filter((a) => a?.name && matchAsset(shotText, a.name))
        const seconds = Math.max(1, Number.parseInt(String(shot.duration || '5'), 10) || 5)
        // 全片镜头序（整部 story 位置）：idx 为该镜在 d.shots 中的下标，0-based 作 shotIndexInStory
        const allShots = d.shots || target
        const idx = allShots.findIndex((s) => s?.id === shot.id)
        const prevShot = idx > 0 ? allShots[idx - 1] : undefined
        const nextShot = idx >= 0 && idx < allShots.length - 1 ? allShots[idx + 1] : undefined
        // P2-3 叙事密度（位置/承接/钩子）+ P2-4 分通道 negative 走 assembleShotUser opts
        // （对齐官方 Ir：上下文 v + 出场分工 y + 负面黑名单 C，含通用负面。）
        const user = assembleShotUser(shot, refAssets, globalStyle, {
          imageNegative: d.imageNegative,
          videoNegative: d.videoNegative,
          totalShots: allShots.length || target.length,
          shotIndexInStory: idx >= 0 ? idx : Math.max(0, (Number(shot.index) || 1) - 1),
          prevShot,
          nextShot,
        }) +
          (imageConstraint ? `\n【生图强制约束，仅作用于 prompt】\n${imageConstraint}` : '') +
          (videoConstraint ? `\n【生视频强制约束，仅作用于 videoPrompt】\n${videoConstraint}` : '') +
          `\n【videoPrompt 格式硬性要求】videoPrompt 必须以“【时长 ${seconds}秒】”单独一行开头，随后换行书写视频内容。` +
          (feedback && String(feedback).trim() ? `\n【用户本次修改意见（必须严格遵循）】${String(feedback).trim()}` : '')

        const r = await chatCompletions({
          provider,
          model: modelId,
          temperature: 0.7,
          responseFormat: useJsonObject(modelId) ? 'json_object' : undefined,
          signal,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        })
        if (!r.ok) {
          enqueuePatch((latest) => ({ shots: (latest.shots || []).map((s) => (s.id === shot.id ? { ...s, promptLoading: false } : s)) }))
          if (!r.aborted) toast(r.error || '分镜提示词生成失败')
          logger.error('scriptBox', '生成分镜提示词·单镜失败', { nodeId, shotId: shot.id, error: r.error })
          return
        }
        const parsed = parseJsonText(r.content)
        if (!parsed.ok) {
          enqueuePatch((latest) => ({ shots: (latest.shots || []).map((s) => (s.id === shot.id ? { ...s, promptLoading: false } : s)) }))
          toast('模型输出的提示词 JSON 不完整，请重试')
          logger.error('scriptBox', '生成分镜提示词·JSON解析失败', { nodeId, shotId: shot.id })
          return
        }
        const { prompt, videoPrompt } = parsed.data || {}
        // 结构校验：JSON 合法但缺 prompt/videoPrompt → 视为格式不符，明确提示且不写回空值。
        if (!prompt && !videoPrompt) {
          enqueuePatch((latest) => ({ shots: (latest.shots || []).map((s) => (s.id === shot.id ? { ...s, promptLoading: false } : s)) }))
          toast('模型输出的提示词 JSON 格式不符（缺少 prompt/videoPrompt），请重试')
          logger.error('scriptBox', '生成分镜提示词·格式不符', { nodeId, shotId: shot.id })
          return
        }
        let pText = prompt || ''
        let vText = videoPrompt || ''
        // 后处理：开启上一镜尾帧时，强制让 prompt/videoPrompt 显式含视觉起点引用标签
        // （对齐官方「最终输出必须显式包含 @图片1」：prompt 查 @图片1，videoPrompt 查 @视频1 或 @图片1），
        // 避免模型漏掉视觉起点引用。/[@＠]\s*(图片|视频)\s*1\b/i 双标签与官方一致。
        const hasTailRef = shot.usePrevShotVideoTail && Array.isArray(shot.prevShotImageRefUrls) && shot.prevShotImageRefUrls.length
        if (hasTailRef) {
          const tagLine = '\n@图片1 复用上一镜视频尾帧作为本镜视觉起点（100% 视觉一致）。'
          const pHasTag = /[@＠]\s*图片\s*1\b/i.test(pText)
          const vHasTag = /[@＠]\s*(图片|视频)\s*1\b/i.test(vText)
          if (pText && !pHasTag) pText += tagLine
          if (vText && !vHasTag) vText += tagLine
        }
        enqueuePatch((latest) => ({ shots: (latest.shots || []).map((s) => (s.id === shot.id ? { ...s, prompt: pText, videoPrompt: vText, promptLoading: false } : s)) }))
      }, { logLabel: '生成分镜提示词·单镜', toastFail: '分镜提示词生成失败', ctx: { nodeId, shotId: shot.id } })
    }

    // 【滑动窗口并发】同时最多 4 个分镜在途，但每个分镜「启动之间」隔 START_GAP_MS 毫秒
    // （不是 4 个同一秒全部发出），让连接平缓建立，避免瞬时打满连接池。
    //  - 逐个启动分镜，每个之间 sleep START_GAP_MS
    //  - 在途达到 MAX_CONCURRENT(4) 时，等其中一个完成再启动下一个（窗口保持 ≤4）
    // 每个分镜发起时打一条「单镜开始」日志；动画精确：genShot 内单独置 loading。
    const MAX_CONCURRENT = 4
    const START_GAP_MS = 500
    const pool = new Set()
    let next = 0
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
    while (next < target.length) {
      const shot = target[next]
      next += 1
      const p = genShot(shot).finally(() => pool.delete(p))
      pool.add(p)
      if (pool.size >= MAX_CONCURRENT) {
        // 在途已达 4：等其中一个完成再继续（释放一个名额）
        await Promise.race([...pool])
      } else if (next < target.length) {
        // 启动下一个分镜之前，先隔 START_GAP_MS
        await sleep(START_GAP_MS)
      }
    }
    await Promise.all([...pool])
    // 批量结束：立即把缓冲中最后一批分镜写回（避免等 200ms 窗口），并清掉待发定时器
    flushPatches()
    toast(Array.isArray(shotIds) && shotIds.length ? '已生成该分镜提示词' : `已生成 ${target.length} 个分镜提示词`)
    logger.info('scriptBox', '生成分镜提示词·完成', { nodeId, count: target.length })
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
    logger.info('scriptBox', 'AI生图提示词·开始', { nodeId, shotId, type })
    return runAbortable(`shotimg-${shotId}`, () => updateData({ shots: getData().shots.map((s) => (s.id === shotId ? { ...s, imgGenLoading: false } : s)) }), async (signal) => {
      const r = await chatCompletions({
        provider,
        model: modelId,
        temperature: 0.7,
        signal,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      })
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
      if (r.ok && !r.aborted) logger.info('scriptBox', 'AI生图提示词·成功', { nodeId, shotId, type, promptLen: (prompt || '').length })
      else if (!r.aborted) logger.error('scriptBox', 'AI生图提示词·失败', { nodeId, shotId, type, error: r.error })
      else logger.warn('scriptBox', 'AI生图提示词·已中止', { nodeId, shotId })
    }, { logLabel: 'AI生图提示词', toastFail: '提示词生成失败', ctx: { nodeId, shotId, type } })
  }

  // ═══════════════════════════════════════════════════════════════
  // 审计改写提示词（聊天式「按意见改」专用，对齐 onGenerateShotImage 单镜范式）
  //  - system 用 SHOT_AUDIT_SYSTEM（CINEDANCE/ACTING/LIRA 三框架审计）
  //  - user 用 buildAuditUser（当前提示词 + 意见 + 本镜资料）
  //  - 输出单条文本，只写回 shots[idx][field] 一个字段（不返回 JSON）
  //  - 复用 runAbortable + loading + logger/toast，与其它生成回调完全一致
  // ═══════════════════════════════════════════════════════════════
  const onReviewShotPrompt = (shotId, field, feedback) => {
    if (field !== 'prompt' && field !== 'videoPrompt') return Promise.resolve({ ok: false })
    const d = getData()
    const shot = (d.shots || []).find((s) => s.id === shotId)
    if (!shot || !feedback || !String(feedback).trim()) return Promise.resolve({ ok: false })
    const { provider, modelId } = resolveTextModel()
    if (!provider || !modelId) { toast('请先在「设置」中配置文本大模型'); return Promise.resolve({ ok: false }) }
    const system = (d.customAuditPrompt || '').trim() || SHOT_AUDIT_SYSTEM
    const user = buildAuditUser(shot, field, String(feedback).trim(), (d.assets || []).map((a) => a.name))

    // 改写结果经 Promise resolve 交给组件（组件 await 后写进预览，点「应用」才落盘到 shot）。
    // 引擎只置 promptLoading 驱动动画，不直接写回 shot[field]——符合「确认才生效」，且避开 effect 侦测回滚。
    let resolveResult
    const done = new Promise((res) => { resolveResult = res })

    updateData({ shots: getData().shots.map((s) => (s.id === shotId ? { ...s, promptLoading: true } : s)) })
    logger.info('scriptBox', '审计改写提示词·开始', { nodeId, shotId, field, feedback: String(feedback).trim() })
    runAbortable(`shot-review-${shotId}`, () => updateData({ shots: getData().shots.map((s) => (s.id === shotId ? { ...s, promptLoading: false } : s)) }), async (signal) => {
      const r = await chatCompletions({
        provider,
        model: modelId,
        temperature: 0.7,
        signal,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      })
      const text = r.ok ? String(r.content || '').trim() : ''
      if (r.ok) {
        updateData({ shots: getData().shots.map((s) => (s.id === shotId ? { ...s, promptLoading: false } : s)) })
        logger.info('scriptBox', '审计改写提示词·成功', { nodeId, shotId, field, len: text.length })
        resolveResult({ ok: true, text })
      } else {
        updateData({ shots: getData().shots.map((s) => (s.id === shotId ? { ...s, promptLoading: false } : s)) })
        if (!r.aborted) { toast(r.error || '审计改写失败'); logger.error('scriptBox', '审计改写提示词·失败', { nodeId, shotId, field, error: r.error }) }
        else logger.warn('scriptBox', '审计改写提示词·已中止', { nodeId, shotId, field })
        resolveResult({ ok: false, error: r.error })
      }
    }, { logLabel: '审计改写提示词', toastFail: '审计改写失败', ctx: { nodeId, shotId, field } })
    return done
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
  // 上传 / 连线（对齐官方 li / ui / ai / oi 的节点侧语义；上传素材走真素材库落盘）
  // ═══════════════════════════════════════════════════════════════
  // P0-2 真化：原实现是 setTimeout 600ms 假成功。现改为真实调素材库落盘通道
  // （assetStore.localizeAndStoreToLibrary → /files/migrated/{人物|场景|道具}）：
  //   落盘成功 → imageStatus='uploaded' + imageUrl 改写为本地化 URL；
  //   落盘失败 → imageStatus='failed' + imageError（依赖承诺，去假）。
  const onRetryAssetImageUpload = async (assetId) => {
    const d = getData()
    const asset = (d.assets || []).find((a) => a.id === assetId)
    // 无参考图时不能上传（上传的是 asset.imageUrl 到素材库），给出明确提示避免静默无反应
    if (!asset) return
    if (!asset.imageUrl) { toast(`「${asset.name || '该资产'}」还没有参考图，请先生成再上传`); return }
    updateData({ assets: d.assets.map((a) => (a.id === assetId ? { ...a, imageStatus: 'uploading', imageError: undefined } : a)) })
    logger.info('scriptBox', '素材上传·开始', { nodeId, assetId, name: asset.name })
    try {
      const localized = await localizeAndStoreToLibrary(asset.imageUrl, { name: asset.name, folder: assetFolderOf(asset.category) })
      updateData({ assets: getData().assets.map((a) => (a.id === assetId ? { ...a, imageStatus: 'uploaded', imageUrl: localized || a.imageUrl } : a)) })
      toast(`已上传「${asset.name || '素材'}」到素材库`)
      logger.info('scriptBox', '素材上传·成功', { nodeId, assetId, url: localized })
    } catch (e) {
      const msg = e?.message || '素材上传失败'
      updateData({ assets: getData().assets.map((a) => (a.id === assetId ? { ...a, imageStatus: 'failed', imageError: msg } : a)) })
      toast(msg)
      logger.error('scriptBox', '素材上传·失败', { nodeId, assetId, error: msg })
    }
  }

  const onUploadAllAssetImages = () => {
    const d = getData()
    const has = (d.assets || []).filter((a) => a.imageUrl && a.imageStatus !== 'uploaded')
    if (has.length === 0) { toast('暂无已生成的图片资产'); return }
    toast(`开始上传 ${has.length} 个素材…`)
    has.forEach((a) => onRetryAssetImageUpload(a.id))
  }

  // 上传本地图片作为资产参考图（用户自选图当角色/场景/道具）。
  // 复用与画布右键上传同一套底层（filesApi.uploadFileToLocal 落盘），不重复造轮子；
  // 仅额外补「写入剧本资产 data」这一层：设 imageUrl/thumbnailUrl + 归档素材库对应目录。
  //  - file：<input type=file> 选中的本地图片
  //  - 成功 → imageUrl/thumbnailUrl/has 写入，imageStatus='uploaded'（表示已归档到素材库）；
  //  - 失败 → imageStatus='failed' + imageError。
  const onUploadAssetImage = async (assetId, file) => {
    const d = getData()
    const asset = (d.assets || []).find((a) => a.id === assetId)
    if (!asset) return
    if (!file) { toast('未选择图片文件'); return }
    const isImg = /^image\//i.test(file.type || '') || /\.(png|jpe?g|gif|webp|svg)$/i.test(file.name || '')
    if (!isImg) { toast(`「${file.name || '该文件'}」不是图片，请选择图片文件`); return }
    updateData({ assets: getData().assets.map((a) => (a.id === assetId ? { ...a, loading: true, imageStatus: 'uploading', imageError: undefined } : a)) })
    logger.info('scriptBox', '上传本地资产图·开始', { nodeId, assetId, name: file.name })
    try {
      const folder = assetFolderOf(asset.category)
      // 原始图落盘（保留可读文件名，走 multipart；与右键上传同一入口 uploadFileToLocal）
      const ext = (file.name.split('.').pop() || 'png').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
      const imageUrl = await uploadFileToLocal(file, folder, `${asset.name || 'asset'}.${ext || 'png'}`)
      if (!imageUrl) throw new Error('图片落盘失败')
      // 缩略图：不再自产落盘独立文件，thumbnailUrl 回退原图；显示时由系统按需出图端点（buildThumbnailUrl）出小图
      updateData({ assets: getData().assets.map((a) => (a.id === assetId ? { ...a, imageUrl, thumbnailUrl: imageUrl, has: true, loading: false, imageStatus: 'uploaded' } : a)) })
      toast(`已将「${asset.name || '资产'}」设为本地参考图`)
      logger.info('scriptBox', '上传本地资产图·成功', { nodeId, assetId, url: imageUrl })
    } catch (e) {
      const msg = e?.message || '图片上传失败'
      updateData({ assets: getData().assets.map((a) => (a.id === assetId ? { ...a, loading: false, imageStatus: 'failed', imageError: msg } : a)) })
      toast(msg)
      logger.error('scriptBox', '上传本地资产图·失败', { nodeId, assetId, error: msg })
    }
  }

  // 连线（对齐官方 li）：按 target 建对应下游节点并自动连线，下游往右排布。
  // 预填（P1-③）：复刻 App.jsx 对 shot- 端口建下游时的透传——
  //   image→aspectRatio；video→size + selectedSeconds(分镜时长) + durationFromScript。
  //   宽高比 custom 取 customAspectRatio；4:4 归一为 1:1（与官方 di 行为一致）。
  const shotPrefill = (shot, type) => {
    const d = getData()
    const raw = String(d.aspectRatio || '16:9')
    const ratio = raw === 'custom' ? String(d.customAspectRatio || '16:9') : raw
    const o = ratio === '4:4' ? '1:1' : ratio
    const seconds = String(Math.max(1, Number.parseInt(String(shot.duration || '5'), 10) || 5))
    return type === 'video'
      ? { size: o, selectedSeconds: seconds, durationFromScript: true }
      : { aspectRatio: o }
  }

  const onConnectShot = (shotId, target = 'image') => {
    if (!addNodes) return
    const d = getData()
    const shot = d.shots.find((s) => s.id === shotId)
    if (!shot) return
    const base = Date.now()
    const isImage = target !== 'video'
    const nodeId2 = `script-${isImage ? 'prompt' : 'video'}-${shotId}-${base}`
    // 资产自动匹配：按该镜头里的 @资产名 收集「有图资产」作为参考图（复刻官方 Ra）。
    // 参考图字段统一命名为 images（P0-②）：生图/生视频下游都用 images，与 useConnectedInputs 产出命名一致。
    // 收口：注入 data.images 前统一补全为绝对原图地址（与派发/发送渲染口径一致，data.images 只存绝对原图）。
    const refImages = collectAssets(shot, d.assets).map((im) =>
      im && im.url ? { ...im, url: toAbsoluteFileUrl(im.url) } : im)
    // 下游往右排布：以剧本盒子节点位置为基准，向右偏移
    let rightBase = { x: 0, y: 0 }
    if (getNodes && nodeId) {
      const self = getNodes().find((n) => n.id === nodeId)
      if (self?.position) rightBase = { x: self.position.x + (self.width ?? 900) + 120, y: self.position.y }
    }
    const prefill = shotPrefill(shot, isImage ? 'image' : 'video')
    const baseData = { ...prefill, images: refImages }
    addNodes([
      isImage
        ? { id: nodeId2, type: 'promptNode', position: { x: rightBase.x, y: rightBase.y }, data: { ...baseData, label: `镜头${shot.index}图`, prompt: shot.prompt } }
        : { id: nodeId2, type: 'discountVideoNode', position: { x: rightBase.x, y: rightBase.y }, data: { ...baseData, label: `镜头${shot.index}视频`, prompt: shot.videoPrompt, upstreamShotId: shot.id } }
    ])
    if (setEdges && nodeId) {
      setEdges((es) => [
        ...es,
        { id: `e-${nodeId}-${nodeId2}`, source: nodeId, sourceHandle: `shot-${shotId}`, target: nodeId2, type: 'default', animated: false }
      ])
    }
  }
  const onConnectShots = (shotIds, target = 'image') => (shotIds || []).forEach((id) => onConnectShot(id, target))

  // ═══════════════════════════════════════════════════════════════
  // P1-2 尾帧变体生成（对齐官方 Qr）：抽上一镜视频尾帧 → 本地化 → 按角度生图 → 写回变体数组。
  // 输入：当前 shotId（仅第 2 镜及以后可用）。输出走 shots[] 子字段（P1-1）。
  // 依赖：上一镜连出的 discountVideoNode（data.upstreamShotId === 上一镜 id）的 videoUrl（已持久化）。
  // ═══════════════════════════════════════════════════════════════
  /** 读取上一镜连出的 discountVideoNode 视频结果 URL（P1-0 已验证持久化）。 */
  const findPrevShotVideoUrl = (prevShotId) => {
    if (!getNodes || !prevShotId) return ''
    return getNodes()
      .find((x) => x.type === 'discountVideoNode' && x.data?.upstreamShotId === prevShotId)?.data?.videoUrl || ''
  }

  const onGenerateTailFrameVariants = async (shotId) => {
    const d = getData()
    const shots = d.shots || []
    const idx = shots.findIndex((s) => s.id === shotId)
    if (idx < 1) { toast('仅第 2 镜及以后可用上一镜尾帧作视觉起点'); return }
    const prevShot = shots[idx - 1]
    const videoUrl = findPrevShotVideoUrl(prevShot.id)
    if (!videoUrl) { toast('未找到上一镜的视频结果，请先生成上一镜视频'); return }
    // 本镜 loading 置位 / 复位（尾帧可中止，注册 `tailframe-${id}`）
    const patchShot = (apply) => updateData({ shots: (getData().shots || []).map((s) => (s.id === shotId ? apply(s) : s)) })
    patchShot((s) => ({ ...s, tailFrameVariantsLoading: true, tailFrameVariantsError: undefined }))
    logger.info('scriptBox', '尾帧变体·开始', { nodeId, shotId, prevShotId: prevShot.id, hasVideo: !!videoUrl })
    return runAbortable(`tailframe-${shotId}`, () => patchShot((s) => ({ ...s, tailFrameVariantsLoading: false })), async (signal) => {
      // 1) 抽上一镜尾帧 → dataURL → 本地化「原版尾帧」（落 migrated/脚本/尾帧变体，对齐官方）。
      //    缩略图机制统一：不再自产落盘独立 _thumb，thumbnailUrl 回退原图，显示由系统按需出图。
      const frameData = await cf(videoUrl, 1)
      let origUrl = frameData
      try {
        const localized = await localizeAndStoreToLibrary(frameData, { name: `prev-${prevShot.id}-tail`, folder: 'migrated/脚本/尾帧变体' })
        if (localized) origUrl = localized
      } catch (e) {
        logger.warn('scriptBox', '尾帧本地化失败，保留原 dataURL', { nodeId, shotId, error: e?.message })
      }
      const original = { id: 'original', label: '原版尾帧', imageUrl: origUrl, thumbnailUrl: origUrl, loading: false }

      // 2) 取角度集（过滤为已知角度），按官方「原版 + composed」布局：composed 先占位 loading
      const angleIds = (Array.isArray(d.tailFrameAngleIds) ? d.tailFrameAngleIds : ['forward'])
        .filter((e) => typeof e === 'string' && TAIL_ANGLE_BY_ID[e])
      const { prompt: composePrompt, label: composeLabel } = buildTailComposePrompt(angleIds)
      const composed = { id: 'composed', label: composeLabel, imageUrl: '', thumbnailUrl: undefined, loading: true }
      const variants = [original, composed]
      patchShot((s) => ({
        ...s,
        prevTailFrameVariants: variants,
        selectedTailFrameVariantId: 'original',
        usePrevShotVideoTail: !!s.usePrevShotVideoTail,
        prevShotImageRefUrls: origUrl ? [origUrl] : [],
      }))

      // 3) 以「原版尾帧」为参考图（images:[origUrl]），调一次资产生图模型合成「综合图」→ 自动选中 composed
      const { provider, modelId } = resolveImageModel()
      if (provider && modelId && origUrl) {
        const ams = d.assetModelSettings || {}
        const aspectRatio = ams.globalAspectRatio || '16:9'
        const imageSize = ams.globalSize || '2K'
        const r = await generateImage({
          provider,
          prompt: composePrompt,
          images: origUrl ? [toAbsoluteFileUrl(origUrl)] : [],
          model: modelId,
          size: imageSize,
          n: 1,
          aspectRatio,
        }, signal)
        if (r.ok && r.url) {
          let cUrl = r.url
          try {
            const loc = await localizeAndStoreToLibrary(r.url, { name: `prev-${prevShot.id}-composed`, folder: 'migrated/脚本/尾帧变体' })
            if (loc) cUrl = loc
          } catch (e) {
            logger.warn('scriptBox', '尾帧综合图本地化失败，保留原 URL', { nodeId, shotId, error: e?.message })
          }
          patchShot((s) => ({
            ...s,
            prevTailFrameVariants: (s.prevTailFrameVariants || []).map((v) =>
              v.id === 'composed' ? { ...v, imageUrl: cUrl, thumbnailUrl: cUrl, loading: false, errorMsg: undefined } : v
            ),
            selectedTailFrameVariantId: 'composed',
            prevShotImageRefUrls: cUrl ? [cUrl] : s.prevShotImageRefUrls,
          }))
        } else {
          patchShot((s) => ({
            ...s,
            prevTailFrameVariants: (s.prevTailFrameVariants || []).map((v) =>
              v.id === 'composed' ? { ...v, loading: false, errorMsg: r.aborted ? '已取消' : (r.error || '综合图生成失败') } : v
            ),
            tailFrameVariantsError: r.aborted ? '已取消' : (r.error || '综合图生成失败，可重试'),
          }))
        }
      } else if (!(provider && modelId)) {
        patchShot((s) => ({ ...s, tailFrameVariantsError: '请先在「设置」中配置资产生图大模型' }))
      }

      // 4) 收尾：loading 复位
      patchShot((s) => ({ ...s, tailFrameVariantsLoading: false }))
      toast(`尾帧综合图生成完毕（原版 + 1 张综合图），已自动选中`, 'success')
      logger.info('scriptBox', '尾帧变体·完成', { nodeId, shotId, angleIds, composedOk: !!origUrl })
    }, { logLabel: '尾帧变体', toastFail: '尾帧变体生成失败', ctx: { nodeId, shotId } })
  }

  return {
    onGenerateScript,
    onGenerateAssetImage,
    onGenerateAllAssetImages,
    onGenerateShotPrompts,
    onGenerateShotImage,
    onReviewShotPrompt,
    onStopScriptItem,
    onRetryAssetImageUpload,
    onUploadAllAssetImages,
    onUploadAssetImage,
    onConnectShot,
    onConnectShots,
    onGenerateTailFrameVariants,
  }
}

// ═══════════════════════════════════════════════════════════════
// 模块级纯函数（对齐官方 shared.js 的 Nr/Qg/Fa 语义）
// ═══════════════════════════════════════════════════════════════

/** 对白字符串 → 每行「说话者：完整原句」格式（对齐官方 Ir 内嵌解析 + Nr）。
 *  兼容 dialogue 双态（P2-⑤）：数组形态（UI 编辑后 [{kind,role,text}]）逐行转字符串，
 *  字符串形态（引擎产出）按行解析。导出供单测（剧本盒纯逻辑）。 */
export function dialogueLines(dialogue) {
  if (Array.isArray(dialogue)) {
    return dialogue
      .map((x) => {
        if (!x || typeof x !== 'object') return ''
        const role = String(x.role || '').trim()
        const text = String(x.text || '').trim()
        if (!text) return ''
        return x.kind === '旁白'
          ? `旁白，完整原句：${text}`
          : `说话者：${role || '未指定角色'}，完整原句：${text}`
      })
      .filter(Boolean)
      .join('\n')
  }
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

/** 尾帧变体角度表（对齐官方 _Component95.jsx 的 Jr：id/label/action）。
 *  用于：综合图 prompt 的「镜头调整要求」+ composed 变体显示标签。导出供 UI/单测。 */
export const TAIL_ANGLE_BY_ID = {
  forward: { label: '镜头向前移动', action: '将摄像机向前（朝向画面主体方向）推进移动，让主体在画面中更突出、更近，画面边缘轻微向外裁剪，但保持主体相对位置居中' },
  left: { label: '镜头向左移动', action: '将摄像机沿水平方向向左平移移动，画面显示更多主体右侧的空间，主体相对视觉重心略微右移' },
  closeup: { label: '特写镜头', action: '将景别改为特写：聚焦到主体（人物脸部与肩颈），人物在画面中的占比显著放大，背景相应被进一步虚化/裁掉' },
  right: { label: '镜头向右移动', action: '将摄像机沿水平方向向右平移移动，画面显示更多主体左侧的空间，主体相对视觉重心略微左移' },
  rotateLeft45: { label: '镜头左转45°', action: '将摄像机绕垂直轴向左（逆时针）旋转约 45°，画面呈现主体的右后侧斜 45° 视角，更多看到主体右侧面与右后方背景' },
  down: { label: '镜头向下移动', action: '将摄像机沿竖直方向向下平移移动，画面呈现略微的俯感，上方空间更多露出，主体相对位置上移' },
  rotateRight45: { label: '镜头右转45°', action: '将摄像机绕垂直轴向右（顺时针）旋转约 45°，画面呈现主体的左前侧斜 45° 视角，更多看到主体左侧面与左前方背景' },
  topDown: { label: '俯视视角', action: '将摄像机提升到主体正上方并向下俯视（俯视/顶视视角），摄像机光轴指向地面方向' },
  faceCloseup: { label: '脸部特写镜头', action: '将景别改为脸部特写：人物的脸（含额头、下巴、耳朵）占画面核心区，眼神、表情、面部细节锐利清晰，人物发型/妆容保持 100% 不变' },
  lowAngle: { label: '仰视视角', action: '将摄像机位置降低到主体下方并向上仰望（仰拍/低角度视角），让人物看起来更挺拔、更有气势，天花板或上方背景更多出现' },
  wideAngle: { label: '广角镜头', action: '将镜头改为广角（较短焦距）：画面容纳更广阔的空间，四周有轻微但自然的广角透视感，人物与环境比例不变但环境展现更多' },
  backFull: { label: '背后全身镜头', action: '将视角改为从人物正后方看的全身镜头：从头到脚完整入镜，人物背对镜头，能看到发型背面、服装背面、鞋履和前方场景' },
  sideFull: { label: '正侧面全身镜头', action: '将视角改为从人物正侧面看的全身镜头：人物侧身完整入镜，能看到侧身轮廓、服装侧面与背景空间关系' },
}

/** 组装「尾帧综合图」生图 prompt 与显示标签（对齐官方 _Component95.jsx L6271-6275）。
 *  原理：以尾帧原图为参考图（images:[…]），用一段固定提示词 + 每条镜头调整动作，
 *  让模型产出「一张同时满足所有角度」的综合结果图。
 *  @param {string[]} angleIds 已过滤为已知角度的 id 数组
 *  @returns {{ prompt:string, label:string }}
 *    - label 形如「镜头向前移动 + 特写镜头 + 镜头左转45°」
 *    - prompt 含「请同时满足以下全部镜头调整要求，输出一张综合结果」 */
export function buildTailComposePrompt(angleIds) {
  const known = Array.isArray(angleIds) ? angleIds.map((e) => TAIL_ANGLE_BY_ID[e]).filter(Boolean) : []
  const label = known.map((e) => e.label).join(' + ') || '换角度图'
  const prompt = [
    '先描述输入图像的关键特征：颜色、形状、大小、纹理、物体、背景、角色姿势、角色注视方向、服装/发型/妆容、光线方向与色彩、材质风格。',
    '然后解释用户给的镜头指令应如何改变或修改画面（摄像机如何移动/旋转/景别如何变化）。',
    '生成一张与参考图视觉风格 100% 保持一致的新图：同一人物（外貌、服装、发型、妆容、身体姿态、表情、位置比例完全相同）、同一场景（陈设、地面材质、背景物品、光影色彩完全不变）、同一道具（大小、颜色、摆放完全相同）。',
    '除了用户明确要求的镜头运动/景别变化外，不要添加任何新物体、新角色，不要移除任何物体与角色，不跳切、不换风格、不改变画幅比例，不加任何文字、水印、边框、分割线、logo。',
    '用户指令：',
    '\n请同时满足以下全部镜头调整要求，输出一张综合结果：\n' + known.map((e, i) => `${i + 1}. ${e.action}`).join('\n'),
  ].join('\n')
  return { prompt, label }
}

/** 单个分镜的 user content（对齐官方 Nr + Ir：镜头信息 / 位置标注 / 上下文承接钩子 / 出场分工 /
 *  风格锚定 / 眼线锁定 / 环境音三层 / 负面黑名单）。
 *  导出供单测（剧本盒纯逻辑）。
 *
 *  opts 可选：
 *  - shotIndexInStory  0-based 镜头在整部短片中的位置（缺省取 shot.index - 1）
 *  - totalShots        全片总镜数（缺省取 shot.index）
 *  - prevShot / nextShot  上一镜 / 下一镜对象（读 description 作「承接 / 钩子」）
 *  - imageNegative / videoNegative  分通道负面词（用户设置，高优先级） */
export function assembleShotUser(shot, refAssets, globalStyle, opts = {}) {
  const assets = Array.isArray(refAssets) ? refAssets : []
  // ── 位置标注：0-based 序号 + 开场/中段/结尾（对齐官方 u/d/m 判定）──
  const u = Number.isFinite(Number(opts.shotIndexInStory))
    ? Math.max(0, Number(opts.shotIndexInStory))
    : Math.max(0, (Number(shot.index) || 1) - 1)
  const d = Number.isFinite(Number(opts.totalShots)) && Number(opts.totalShots) >= u + 1
    ? Number(opts.totalShots)
    : Math.max(u + 1, Number(shot.index) || 1)
  const m = u === 0 ? '开场镜' : u === d - 1 ? '结尾镜' : '中段镜'

  const rows = [`镜头编号：${shot.index}`, `时长：${shot.duration || '5s'}`]
  rows.push(shot.shotType ? `景别：${shot.shotType}` : '')
  rows.push(shot.lighting ? `光影：${shot.lighting}` : '')
  rows.push(shot.motion ? `运镜：${shot.motion}` : '')
  rows.push(globalStyle ? `统一风格：${globalStyle}` : '')
  rows.push(`本分镜在整部短片中的位置：第 ${u + 1} 镜 / 共 ${d} 镜（${m}）。`)
  if (shot.description) rows.push(`画面描述：${shot.description}`)

  // ── 剧情上下文块（视觉起点 / 上一镜承接 / 本镜职责 / 下一镜钩子，对齐官方 v）──
  const prevRefs = Array.isArray(shot.prevShotImageRefUrls) ? shot.prevShotImageRefUrls.filter(Boolean) : []
  const hasTail = !!shot.usePrevShotVideoTail
  const ctx = []
  if (hasTail && prevRefs.length) {
    ctx.push('【视觉起点·必带约束】本镜的起始画面必须以 @图片1（即上一镜视频尾帧图，已作为参考图传入）为视觉起点：人物外貌/服装/发型/妆容/表情/姿态/位置、场景陈设/地面材质/背景物品、光线方向/色彩/材质、道具大小/颜色/摆放，必须与 @图片1 保持 100% 视觉一致。除了用户要求的具体镜头运动/景别变化外，不得添加任何新角色、新道具、新背景元素；不得改变画幅比例、不得跳切、不得更换美术风格。**重要：最终输出的 prompt 与 videoPrompt 文本中必须显式包含 "@图片1" 这一引用标签，让视频生成模型把 @图片1 当作首帧。**')
  } else if (hasTail) {
    ctx.push('【视觉起点·必带约束】本镜的起始画面必须与上一镜视频尾帧保持零帧硬切连续：人物位置、姿态、表情、服装、场景光线和色彩完全一致，不得发生瞬移或跳切。')
  }
  const prevDesc = opts.prevShot?.description && String(opts.prevShot.description).trim()
  if (prevDesc) {
    ctx.push(`【剧情承接：上一镜状态描述】${prevDesc}（本镜首秒必须从这一画面状态自然延续，人物位置、姿态、情绪、场景环境不得跳切、不得瞬移、不得更换服装/造型）。`)
  }
  if (shot.description) {
    const seg = u <= Math.ceil(d * 0.2) ? '交代信息/建立悬念/锚定冲突' : u <= Math.ceil(d * 0.5) ? '冲突升级/情绪累积/压力堆叠' : u <= Math.ceil(d * 0.8) ? '情绪爆破/反转打脸/爽点释放' : '收束留钩/余韵钩子/为下一部或续作埋伏笔'
    ctx.push(`【本镜剧情职责】请围绕本镜画面描述执行，并思考本段在整个戏剧曲线中的叙事功能：${seg}。画面必须服务于这一叙事目的，不要拍无效镜头。`)
  }
  const nextDesc = opts.nextShot?.description && String(opts.nextShot.description).trim()
  if (nextDesc) {
    ctx.push(`【剧情钩子：下一镜预告】${nextDesc}（本镜结尾 0.8-1 秒要把人物视线/动作/画面构图自然指向这个结果，做好镜头衔接准备，但不要提前剧透下一镜的核心事件）。`)
  }
  if (ctx.length) {
    rows.push(`【本镜剧情上下文（服务于叙事节奏，写 prompt 与 videoPrompt 时请先吃透这一节再落笔）】\n${ctx.join('\n')}`)
  }

  // ── 出场分工（对齐官方 y：角色按核心/压迫位/背景位排布 + 场景 + 道具）──
  const chars = assets.filter((a) => a.category === 'character')
  const scenes = assets.filter((a) => a.category === 'scene')
  const props = assets.filter((a) => a.category === 'prop')
  const others = assets.filter((a) => a.category !== 'character' && a.category !== 'scene' && a.category !== 'prop')
  const allNames = assets.map((a) => a.name).filter(Boolean)
  const roleLines = []
  if (chars.length) {
    roleLines.push('【本分镜出场人物与叙事分工】（决定站位、景别、视线、动作权重，禁止把背景人物拍成与主角抢焦点）：')
    chars.forEach((c, n) => {
      roleLines.push(n === 0
        ? `- @${c.name}｜核心人物（本镜焦点/情绪承担者，景别优先给近景/特写，光影给主光落脸）`
        : n === 1
          ? `- @${c.name}｜主压迫位/对手位（围绕核心人物互动，距离核心人物最近，动作先触发）`
          : `- @${c.name}｜背景氛围位（不与核心人物对视、不抢焦点，仅作压力/氛围堆叠，景别优先全景/中景虚化）`)
    })
  }
  if (scenes.length) {
    roleLines.push(`【本分镜场景环境角色】${scenes.map((s) => `@${s.name}`).join('、')}：本镜全部动作必须发生在该场景内，场景细节必须与「资产清单」一致，场景不得变换、不得凭空新增外景/路人/NPC。`)
  }
  if (props.length) {
    roleLines.push(`【本分镜关键道具】${props.map((s) => `@${s.name}`).join('、')}：这些道具必须在画面中准确呈现并承载叙事功能，不得遗漏或变成模糊背景。`)
  }
  if (others.length) {
    roleLines.push(`【本分镜涉及资源】${others.map((a) => `@${a.name}`).filter(Boolean).join('、')}：请在画面里自然呈现，并在画面描述里用 @名称 引用。`)
  }
  if (roleLines.length) {
    rows.push(roleLines.join('\n'))
  } else if (allNames.length) {
    rows.push(`本分镜涉及以下资源，请在画面里自然呈现，并在画面描述里用 @名称 引用：${allNames.map((a) => `@${a}`).join('、')}`)
  } else {
    rows.push('本分镜未引用具体资源，按画面描述生成即可，不要凭空加入无关角色/道具。')
  }

  // ── 风格锚定（对齐官方 b：具体参数而非空洞形容词）──
  rows.push('【本镜风格锚定（写 prompt 时必须把这些具体参数写出来，不要用空洞形容词）】：\n- 景别与焦段：情绪爆破点/核心人物用 70mm-105mm 中近景或情绪近景，交代场景用 24mm-35mm 广角，细节用 85mm-135mm 特写。\n- 光影落位：核心人物的脸、手、眼睛必须有窄高光；情绪用冷/暖对比色光；阴影区压暗但保留暗部细节，不要纯黑死黑。\n- 材质细节微动作：衣服布料纹理、头发丝飘动、场景物体材质纹理必须清晰可见；把情绪具象成微动作，禁止空洞机械脸/空洞表情。')

  // ── 眼线锁定（≥2 角色时，对齐官方 x）──
  if (chars.length >= 2) {
    rows.push(`【眼线锁定（时间轴内严格执行，角色之间不得乱对视）】：\n- 核心人物 @${chars[0].name}：本镜视线目标根据「画面描述」执行，最后 0.8 秒扫过全场并停在叙事钩点上。\n- 其他角色（压迫位/背景位）：眼线全程只锁 @${chars[0].name} 的脸、手或关键道具，彼此绝对不准对视、不准交流、不准互看；背景位人物不得突然转头或有大动作。`)
  }

  // ── 对白/旁白 + 环境音三层（对齐官方 S）──
  const dlg = dialogueLines(shot.dialogue)
  if (dlg) rows.push(`【对白/旁白（仅限人声层，必须逐字保留角色名与完整原句）】\n${dlg}`)
  if (shot.sound) {
    rows.push(`【环境音三层（必须原样带入 videoPrompt，并以此调度视频的音频节奏，不要只写成一句话"有xx声"）】：\n- 环境层（垫底氛围音，音量-18dB 以下）：根据场景空间属性自行合理补齐，如：空调低鸣/室外风噪/远处车流/室内混响/梦境空间耳压。\n- 音效/拟音层（动作触发，与画面帧精确同步）：环境音/动作音：${shot.sound}。每一个动作在对应秒级时间点有独立音效，不与环境层混淆。\n- 人声层（仅保留"对白/旁白"块中列出的台词与说话者，禁止新增旁白/独白/OS）：严格保留说话者姓名与完整原句，不得缩写/改写/漏句。`)
  }

  // ── 负面黑名单（对齐官方 C：通用负面 + 用户分通道）──
  const negRows = ['【负面黑名单·绝对禁止出现】：']
  negRows.push('- 通用负面（prompt + videoPrompt 同时遵守）：新增无关对白/新增旁白/互相对骂争吵、画面上乱飞出无关道具或文字/字幕/水印/外框黑边、NPC/路人/管理员/同学/无关围观群众入画（除非明确在资产清单中）、人物突然瞬移/换衣服/换发型/换瞳色/换体型、恋爱糖感特效（爱心/花瓣/柔光过度）、空洞大笑/空洞机械脸（无肌肉微动）、肢体结构错误/手指数量异常/五官错位。')
  const imgNegRaw = opts.imageNegative && String(opts.imageNegative).trim()
  const vidNegRaw = opts.videoNegative && String(opts.videoNegative).trim()
  if (imgNegRaw) negRows.push(`【生图负面词·仅作用于 prompt】${imgNegRaw}`)
  if (vidNegRaw) negRows.push(`【生视频负面词·仅作用于 videoPrompt】${vidNegRaw}`)
  rows.push(negRows.join('\n'))

  // ── 尾部格式约束（对齐官方 footer）──
  rows.push('prompt 只描述可见画面（主体/动作/场景/景别/光影/色彩/视角/材质/焦段），不要包含对白、旁白、音效、字幕等文字信息；videoPrompt 在 prompt 画面基础上补充镜头连续运动与动态，并把对白/旁白/环境三层音效用"具体角色名说：……""环境层/拟音层/人声层：……"的结构自然融入，使其可直接用于视频生成。只返回包含 prompt、videoPrompt 两个字段的纯 JSON。')

  return rows.filter(Boolean).join('\n')
}

/**
 * 抽视频尾帧 → JPEG dataURL（P1-2）。复用 VideoExtractNode 的 canvas.drawImage 抽帧思路，
 * 独立成模块顶层函数（纯浏览器实现）便于单测注入 mock；非浏览器环境直接抛错，由调用方降级/提示。
 * @param {string} src  视频 URL（DiscountVideoNode.data.videoUrl，已持久化 /files/...）
 * @param {number} [atFraction=1]  抽帧时刻（1 = 尾帧；0~1 按时长比例）
 * @returns {Promise<string>} dataURL
 */
export async function captureVideoFrame(src, atFraction = 1) {
  if (typeof document === 'undefined' || typeof HTMLVideoElement === 'undefined') {
    throw new Error('浏览器环境不支持抽帧')
  }
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.crossOrigin = 'anonymous'
    video.preload = 'auto'
    video.src = String(src || '')
    let done = false
    const finish = (err, dataUrl) => {
      if (done) return
      done = true
      video.removeEventListener('loadeddata', onLoaded)
      video.removeEventListener('error', onErr)
      video.removeEventListener('seeked', onSeeked)
      if (err) reject(err)
      else resolve(dataUrl)
    }
    const onErr = () => finish(new Error('视频加载失败'))
    const onSeeked = () => {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return finish(new Error('Canvas 不可用'))
        let w = video.videoWidth
        let h = video.videoHeight
        if (!w || !h) return finish(new Error('视频尺寸不可用'))
        if (w > 480 || h > 480) {
          if (w > h) { h = Math.round(h * 480 / w); w = 480 } else { w = Math.round(w * 480 / h); h = 480 }
        }
        canvas.width = w
        canvas.height = h
        ctx.drawImage(video, 0, 0, w, h)
        finish(null, canvas.toDataURL('image/jpeg', 0.8))
      } catch (e) {
        finish(e)
      }
    }
    const onLoaded = () => {
      try {
        const duration = video.duration || 0
        const t = Number.isFinite(duration) && duration > 0
          ? Math.min(Math.max(duration * atFraction - 0.05, 0), Math.max(duration - 0.05, 0.001))
          : 0
        video.currentTime = t
      } catch (e) {
        finish(e)
      }
    }
    video.addEventListener('loadeddata', onLoaded, { once: true })
    video.addEventListener('seeked', onSeeked, { once: true })
    video.addEventListener('error', onErr, { once: true })
  })
}
