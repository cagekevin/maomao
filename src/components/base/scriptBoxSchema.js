/**
 * 剧本盒子 —— 权威数据契约 schema + 归一化（P0-0 地基）。
 *
 * 数据契约纪律（docs/剧本盒子数据流对齐与基础设施补齐… P0）：
 *  - 本文件是 ScriptBoxNode.data 全部字段（顶层 / shot 子字段 / asset 子字段）的唯一真相源；
 *  - 任何功能需新字段 → 先在此登记「默认值」，禁止在 UI / 引擎裸加字段；
 *  - 所有读取 node.data 前先经 normalizeScriptBoxData 补齐缺省（向后兼容迁移旧画布数据）。
 *
 * 序列化随画布快照（canvas-state-v1-{projectId}）走，不另立存储键（见 contracts.js 注释），
 * 防止双写漂移。归一化返回新对象，不改动传入的 raw。
 */
/** 顶层字段默认值（含 P0-1 分通道 negative + tailFrameAngleIds 尾帧默认角度）。 */
export function defaultScriptBoxTop() {
  return {
    step: 1,
    story: '',
    upstreamStory: '',
    globalStyle: '',
    aspectRatio: '16:9',
    customAspectRatio: '16:9',
    shotCount: 'auto',
    customCount: '',
    tailFrameAngleIds: ['forward', 'closeup', 'rotateLeft45'],
    // playbook 收口：当前选用 playbook id（默认漫剧）；label 为选中时名称快照（悬挂检测提示用）。
    // 提示词配置唯一真相源 = playbook（scriptBoxPlaybookStore），node.data 不存任何 customXxx 副本。
    playbookId: 'manga',
    playbookLabel: '',
  }
}

/** 单个 shot 子字段默认值（含 P1-1 连续性 / 尾帧变体全字段）。 */
export function defaultShotFields() {
  return {
    duration: '5s',
    description: '',
    shotType: '',
    lighting: '',
    dialogue: [],
    sound: '',
    motion: '固定',
    grid: 0,
    prompt: '',
    videoPrompt: '',
    promptLoading: false,
    imgGenLoading: false,
    connImg: false,
    connVid: false,
    // P1-1 连续性 + 尾帧变体
    usePrevShotVideoTail: false,
    prevShotImageRefUrls: [],
    prevTailFrameVariants: [],
    selectedTailFrameVariantId: 'original',
    tailFrameVariantsLoading: false,
    tailFrameVariantsError: undefined,
  }
}

/** 单个 asset 子字段默认值（含 P0-3 imageUrl / thumbnailUrl 分离）。 */
export function defaultAssetFields() {
  return {
    category: 'character',
    name: '',
    description: '',
    prompt: '',
    imageUrl: '',
    thumbnailUrl: '',
    has: false,
    loading: false,
    picked: false,
    // 资产参考图上传状态（上传的是图片，命名用 image；历史 videoStatus/videoError 在归一化时迁移）
    imageStatus: '',
    imageError: undefined,
  }
}

/** 新建剧本盒节点时的权威空 data（shots/assets 为空数组）。 */
export function defaultScriptBoxData() {
  return { ...defaultScriptBoxTop(), shots: [], assets: [] }
}

/**
 * 读取旧数据时补齐缺省字段（向后兼容迁移）。所有读取 node.data 前必经此函数。
 * @param {object} [raw] 原始 node.data（可能来自旧画布快照，缺新字段）
 * @returns {object} 归一化后的 data（含全量默认 + 存量的覆盖），不就地改 raw
 */
export function normalizeScriptBoxData(raw = {}) {
  const base = defaultScriptBoxTop()
  const d = { ...base, ...raw }

  // shots 子字段归一化：旧 shot 缺 P1-1 新字段时补默认；非对象项给空 shot 兜底。
  d.shots = (Array.isArray(raw.shots) ? raw.shots : []).map((s) =>
    s && typeof s === 'object' ? { ...defaultShotFields(), ...s } : { ...defaultShotFields() }
  )

  // assets 子字段归一化：P0-3 thumbnailUrl 缺省回退 imageUrl（唯一回退点，UI 不再各自处理）。
  d.assets = (Array.isArray(raw.assets) ? raw.assets : []).map((a) => {
    if (!a || typeof a !== 'object') return { ...defaultAssetFields() }
    const norm = { ...defaultAssetFields(), ...a }
    if (!norm.thumbnailUrl) norm.thumbnailUrl = norm.imageUrl || ''
    // 字段改名迁移：旧画布用 videoStatus/videoError（历史命名错误，存的是图片上传状态），
    // 迁移到 imageStatus/imageError，避免老数据丢失上传状态。
    if (norm.imageStatus === '' && (norm.videoStatus || norm.videoStatus === '')) {
      if (norm.videoStatus !== undefined) norm.imageStatus = norm.videoStatus
      if (norm.videoError !== undefined) norm.imageError = norm.videoError
    }
    return norm
  })

  return d
}