/**
 * 横切契约登记表 —— 横切基础设施层的「单一事实来源」。
 *
 * 【职责】把跨切面的机制（事件/存储键/错误类型）集中登记，避免散落各文件、
 * 调用方式不一致、发布无订阅等死代码。后续所有新增机制先查/先登记本表。
 *
 * 【分层】横切基础设施分 5 类，各一个权威入口：
 *   ① 通信层 eventBus     —— 瞬时事件广播（本表 EVENTS 是其注册表）
 *   ② 表现层 toastStore   —— 用户可见即时反馈
 *   ③ 观测层 logger       —— 记录 + 上报，供排查
 *   ④ 持久化层 storageAdapter + *Store —— 数据存取
 *   ⑤ 能力层 mediaType / clipboard / filesApi / imageCompress 等 —— 工具函数单一入口
 *
 * 【约定】新增事件：先在本表 EVENTS 登记（发布方/订阅方须成对，避免「只监听未发布」），
 * 命名统一「领域:动作」，再用 eventBus.publish/subscribe。
 */

/**
 * 高消耗积分确认（通用积分闸 creditSwitch）相关契约字符串 —— 单一事实来源。
 * 【三按钮收敛 · 2026-08-27】直接生图/分步确认/完全自主下，真生成图/视频前是否先确认，
 * 由全局开关 creditSwitch（默认开）+ per-conversation creditGate 决定（见 docs/59、60）。
 * 所有消费方一律 import 本常量引用，禁止散写裸字面量。
 */
/** creditSwitch 全局存储键（localStorage，默认 true = 任何模式真烧积分前先确认） */
export const CREDIT_SWITCH_KEY = 'agent_credit_switch'
/** conversation 会话字段名：creditGate（单一对象 { pending, gens, map }，per-conversation 唯一读写清） */
export const CREDIT_GATE_FIELD = 'creditGate'
/** credit 确认门禁广播事件名（useCanvasAgentTools 置位/清除 → AgentPanel 刷新确认卡片） */
export const CREDIT_GATE_EVENT = 'agent:credit-gate'

/**
 * 事件注册表（通信层 eventBus 的单一事实来源）。
 *
 * 每项：
 *   key  = 事件名（统一「领域:动作」）
 *   from = 发布方（文件:行）
 *   to   = 订阅方（文件:行）
 *   payload = 载荷结构（约定）
 *   note = 用途/状态
 *
 * ⚠️ 铁律（给维护者 / AI 读此文件时）：
 *   本表的 from / to 行号靠人工维护，会随代码插入而【漂移】，
 *   也可能出现【表登记滞后于代码】的情况（如 to:[] 实际已被订阅）。
 *   因此：凡判定「某事件无订阅方 / 是死事件 / 可删发布逻辑」，
 *   必须以代码实测为准——grep `subscribe('事件名'` 确认，
 *   禁止仅凭本表 to:[] / 注释「待核对」下结论。
 *   来源：`grep -rn "publish('" src/components` 提取，2026-08-17 核对。
 */
export const EVENTS = {
  'agent:task-completed': {
    from: ['taskCompletionBus.js:21'],
    to: ['useNodeGeneration.js:218'],
    payload: '{ taskId, nodeId, resultUrl, type, status: "completed" }',
    note: '任务完成 → 精准回填节点（刷新不丢图）。现统一经 taskCompletionBus.publishTaskCompleted 唯一发布（P1-D）；done 已去落盘（P0-C），广播直接用持久 resultUrl',
  },
  // 上游节点完成 → 直接下游可视需要自动触发（P2-G 安全网，AUTO_TRIGGER_DOWNSTREAM 默认关）
  'upstream:updated': {
    from: ['taskCompletionBus.js:24'],
    to: ['upstreamLink.js:31'],
    payload: '{ sourceNodeId }',
    note: '上游生成完成 → 直接下游（只接一层）自动触发（经 useUpstreamAutoTrigger；开关默认关，零行为改变）',
  },
  'presets-changed': {
    from: ['promptManager.js:85'],
    to: ['PromptLibrary.jsx:50'],
    payload: '{ presets }',
    note: '提示词库跨节点同步。生产使用',
  },
  'agent:credit-gate': {
    from: [],
    to: [],
    payload: '{ pending }',
    note: '高消耗积分确认门禁置位/清除广播（AgentPanel 刷新 credit 确认卡片）。经常量 CREDIT_GATE_EVENT 引用（P1-D），非字面量故反向校验跳过；发布 useCanvasAgentTools / 订阅 AgentPanel',
  },
  // 素材发送成功事件（P1-D 收口：原 assetStore 裸回调桥 → eventBus；assetStore 保留薄封装 onAssetSent/emitAssetSent）
  'asset:sent': {
    from: ['assetStore.js:306'],
    to: ['assetStore.js:303'],
    payload: '{ folder }',
    note: '素材落盘成功 → 素材库面板刷新（AssetLibrary 经 onAssetSent 订阅）。生产使用',
  },
  'yimao:remove-edge': {
    from: [],
    to: [],
    payload: '{ sourceNodeId, targetNodeId }',
    note: '跨 sub-window 画布移除边通知：App.jsx:1105 用 window.addEventListener 监听（window.dispatchEvent 通道，与 eventBus 并存），非 eventBus publish/subscribe 字面量，故反向校验跳过；当前无在源码内的发布方（孤儿监听，由子窗口/插件侧派发）',
  },
  'project:import': {
    from: ['ProjectSelector.jsx:103'],
    to: ['App.jsx'],
    payload: '{}',
    note: '导入按钮 → App 处理文件（App.jsx:414 标准 subscribe 承接，已核对，D5）。生产使用',
  },
  'project:export': {
    from: ['ProjectSelector.jsx:107'],
    to: ['App.jsx'],
    payload: '{}',
    note: '导出按钮 → App 下载。生产使用',
  },
  'persist:failed': {
    from: ['storageAdapter.js:31'],
    to: ['App.jsx:460'], // 全局监听器，节流 toast；分发逻辑收敛到 persistFailureBus（见 App.jsx:457-465）
    payload: '{ key, error }',
    note: '持久化失败广播（sSet/sRemove 失败）。已由 App.jsx 全局订阅',
  },
}

/**
 * 存储键登记区（持久化层单一事实来源）。
 *
 * 每条记录：
 *   key      = 存储键名（storageAdapter.sGet/sSet 调用时的 key，不含 yimao: 前缀）
 *   domain   = 所属领域（project/task/asset/settings/agent/etc.）
 *   store    = 所属 store/文件
 *   backend  = 存储后端
 *     'local'  → localStorage/Chrome storage（storageAdapter 自动路由）
 *     'kv'     → localTool KV（/api/kv/*，canvas-state-v1- 前缀）
 *     'native' → 原生 localStorage 直写（不经 storageAdapter）
 *   pattern  = 是否是动态键模板（如含 {agentKey} 占位符）
 *   dynamic  = 是否运行时动态生成
 *   note     = 用途/说明
 *
 * 使用规则：
 *   1. 新增存储键 → 先在此登记，禁止散落字符串字面量
 *   2. 改键名 → 全量 grep 同步所有引用，更新本条
 *   3. 删键 → 先确认无引用再删除本条
 *   4. 迁移键 → 添加 migration 字段记录迁移历史
 *
 * 来源：`grep -rn "sGet\|sSet\|sRemove\|storageGet\|storageSet\|storageDelete" src/components` 提取，2026-08-17 核对。
 */
/**
 * 画布快照 KV 键前缀（P0-1 收口单一来源）。
 * kvStore.js 运行时前缀与下方登记表模板统一引用本常量，消除双写 'canvas-state-v1-'。
 */
export const CANVAS_STATE_PREFIX = 'canvas-state-v1-'

/**
 * 画布快照 schema 版本号（P0-4 跨端对齐）。
 * 写入 saveCanvasState 快照的 schemaVersion 字段；读取端按版本做兼容（旧结构缺字段默认补齐）。
 * 变更快照结构（新增/重命名字段影响旧数据可恢复性）时 → 提升本版本号并补迁移，不宜原地覆盖旧结构。
 */
export const CANVAS_SCHEMA_VERSION = 1

export const STORAGE_KEYS = {
  // ── 项目（projectStore）────────────────────────────────────────────
  projects: {
    domain: 'project',
    store: 'projectStore.js',
    backend: 'local',
    note: '项目列表 [{id, name}]。双写：localStorage + localTool /api/projects',
  },
  lastOpenedProject: {
    domain: 'project',
    store: 'projectStore.js',
    backend: 'local',
    note: '上次打开项目 id。刷新后自动恢复该项目',
  },
  [`${CANVAS_STATE_PREFIX}{projectId}`]: {
    domain: 'project',
    store: 'projectStore.js',
    backend: 'kv',
    pattern: true,
    note: '画布快照：{ nodes, edges, viewport }。跨端共享，走 localTool KV（P20 新增 viewport 视窗缩放/平移）',
  },
  [`${CANVAS_STATE_PREFIX}{projectId}_version`]: {
    domain: 'project',
    store: 'projectStore.js',
    backend: 'kv',
    pattern: true,
    note: '画布快照版本号（单调递增，防旧数据覆盖新数据）',
  },

  // ── 应用设置（appSettings）─────────────────────────────────────────
  app_settings: {
    domain: 'settings',
    store: 'appSettings.js',
    backend: 'local',
    note: '应用设置：{ performanceMode, minimapOn, agentOpen, thumbnailOn }——整键随云端同步',
  },

  // ── 供应商配置（providerStore）─────────────────────────────────────
  active_api_endpoint: {
    domain: 'settings',
    store: 'settings/providerStore.js',
    backend: 'kv',
    note: '当前生效的主供应商 endpoint（跨端读取，写入 localTool KV）',
  },

  // ── AI 聊天模型（agentModelStore）──────────────────────────────────
  agent_chat_model: {
    domain: 'agent',
    store: 'agentModelStore.js',
    backend: 'local',
    note: 'AI 聊天模型配置：{ providerId, modelId, streamMode }',
  },
  agent_history_turns: {
    domain: 'agent',
    store: 'agentModelStore.js',
    backend: 'local',
    note: 'AI 助手历史回传轮数（默认 6，非负整数）',
  },

  // ── Skill（skillStore）─────────────────────────────────────────────
  agent_skills: {
    domain: 'agent',
    store: 'skillStore.js',
    backend: 'local',
    note: '用户自定义 Skill 列表 [{id, name, description, content}]',
  },
  agent_skill_usage: {
    domain: 'agent',
    store: 'skillStore.js',
    backend: 'local',
    note: 'Skill 使用次数统计：{ [skillId]: count }',
  },
  agent_skill_enabled: {
    domain: 'agent',
    store: 'skillStore.js',
    backend: 'local',
    note: 'Skill 启用状态：{ [skillId]: boolean }。默认启用',
  },

  // ── 提示词预设（promptManager）─────────────────────────────────────
  yimao_preset_prompts: {
    domain: 'preset',
    store: 'promptManager.js',
    backend: 'local',
    note: '提示词预设列表 [{id, title, type, prompt, enabled}]',
  },
  yimao_preset_recent: {
    domain: 'preset',
    store: 'promptManager.js',
    backend: 'local',
    note: '最近使用预设 id 列表（上限 50）',
  },

  // ── 素材库（assetStore）────────────────────────────────────────────
  yimao_asset_library: {
    domain: 'asset',
    store: 'assetStore.js',
    backend: 'local',
    note: '素材库列表 [{id, folder, type, url, name, size, ts}]',
  },

  // ── 提示词社区库（promptHubStore.js，联网 GitHub 源，非本地预设）──
  // 注意：与 promptManager.js 的 yimao_preset_prompts（我的预设）是两回事。
  yimao_prompt_hub_cache: {
    domain: 'prompthub',
    store: 'promptHubStore.js',
    backend: 'local',
    note: '提示词社区库各源拉取缓存 { [sourceId]: { items, fetchedAt, signature, lastError } }',
  },

  // ── 节点偏好（nodePrefs）───────────────────────────────────────────
  yimao_node_prefs: {
    domain: 'pref',
    store: 'nodePrefs.js',
    backend: 'local',
    note: '节点「上次参数」记忆：{ [nodeType]: { ...lastParams } }',
  },

  // ── 账号环境（accountsStore）───────────────────────────────────────
  yimao_accounts: {
    domain: 'account',
    store: 'accountsStore.js',
    backend: 'kv',
    note: '多开账号环境列表 [{id, name, siteName, siteUrl, avatar, cookies}]。走 localTool KV 磁盘持久化（对齐官方 users，关插件/跨设备不丢），仍进云同步',
  },

  // ── AI 会话（conversationStore）────────────────────────────────────
  'agent_conversations_{agentKey}': {
    domain: 'agent',
    store: 'conversationStore.js',
    backend: 'kv',
    pattern: true,
    note: 'AI 会话列表（按 agentKey 隔离，如 canvas-assistant-{projectId}），存 localTool KV',
  },
  'agent_active_conversation_id_{agentKey}': {
    domain: 'agent',
    store: 'conversationStore.js',
    backend: 'kv',
    pattern: true,
    note: '当前活跃会话 id（按 agentKey 隔离），存 localTool KV',
  },
  'agent_project_memory_v1_{agentKey}': {
    domain: 'agent',
    store: 'agent/runtime/projectMemoryStore.js',
    backend: 'local',
    pattern: true,
    note: '项目长期记忆（用户确认后写入，agentKey 全局共用，单 agentKey 上限 60 条）',
  },
  agent_conversations: {
    domain: 'agent',
    store: 'conversationStore.js',
    backend: 'local',
    migration: 'agent_conversations_{agentKey}',
    note: '旧全局会话键（迁移用，仅读不写，改造后不再使用）',
  },
  agent_active_conversation_id: {
    domain: 'agent',
    store: 'conversationStore.js',
    backend: 'local',
    migration: 'agent_active_conversation_id_{agentKey}',
    note: '旧全局会话 id 键（迁移用，仅读不写，改造后不再使用）',
  },

  // ── AI 面板（AgentPanel.jsx）───────────────────────────────────────
  agent_panel_width: {
    domain: 'agent',
    store: 'AgentPanel.jsx',
    backend: 'local',
    note: 'AI 助手面板宽度（px）',
  },
  agent_draft: {
    domain: 'agent',
    store: 'AgentPanel.jsx',
    backend: 'local',
    note: 'AI 助手输入框草稿内容',
  },
  agent_input_mode: {
    domain: 'agent',
    store: 'AgentPanel.jsx',
    backend: 'local',
    note: 'AI 助手输入模式（agent | chat 等）',
  },
  agent_work_mode: {
    domain: 'agent',
    store: 'runModeRegistry.js',
    backend: 'local',
    note: 'AI 助手三态 workMode（direct/step-confirm/auto）单一真源；inputMode/runMode 为其兼容派生态（setWorkMode 原子同步）',
  },
  [CREDIT_SWITCH_KEY]: {
    domain: 'agent',
    store: 'AgentPanel.jsx',
    backend: 'local',
    note: '高消耗积分确认开关：任何模式真生成图/视频前是否先确认（默认 true = 开/安全）',
  },

  // ── AI 历史迁移（useAgentChat.js）──────────────────────────────────
  'agent_history_{agentKey}': {
    domain: 'agent',
    store: 'useAgentChat.js',
    backend: 'local',
    pattern: true,
    note: '旧单会话历史（仅首次迁移用，从旧格式迁移到多对话体系后不再写入）',
  },

  // ── AI 生图参数（useCanvasAgentTools.js）───────────────────────────
  canvasAgentGenParams: {
    domain: 'agent',
    store: 'useCanvasAgentTools.js',
    backend: 'local',
    note: 'AI 生图默认参数：{ model, ratio, resolution }',
  },

  // ── 多窗口剪贴板（VideoExtractNode.jsx）────────────────────────────
  'mutiwindow-clipboard': {
    domain: 'clipboard',
    store: 'VideoExtractNode.jsx',
    backend: 'local',
    note: '多窗口剪贴板数据（跨窗口同步用）',
  },

  // ── 3D 导演台工程（director3d）【P2-F2 登记修正】───────────
  // 注：director3d 工程经 base/d3dPersistence 收口——主通道写 localTool KV（/api/kv/set），
  // 18080 不可达才降级直写 localStorage。故 backend 标 kv（配下方动态 pattern），与实测一致；
  // 别再标 native（旧"native 空洞语义"，见 contentStore.getBackend 启发式兜底问题）。
  'director3d-project': {
    domain: 'director3d',
    store: 'd3dPersistence.js',
    backend: 'kv',
    note: '3D 导演台工程默认 key（独立运行时）→ KV 主通道，降级写 localStorage',
  },
  'director3d-project-{nodeId}': {
    domain: 'director3d',
    store: 'd3dPersistence.js',
    backend: 'kv',
    pattern: true,
    note: '3D 导演台工程（画布节点实例）动态键 → KV 主通道，降级写 localStorage',
  },
  'director3d-custom-poses': {
    domain: 'director3d',
    store: 'director3d/App.jsx',
    backend: 'native',
    note: '3D 导演台自定义姿势库（仅 localStorage 直写，不进 KV，见 isProjectPersistenceKey）',
  },
  // 注：故 hideFromViewportCapture 曾登记为 native（2026-08-22 移除）——它实为 3D object.userData
  // 属性（SceneRoot.tsx / DirectorCanvas.tsx），并非存储键，登记纯属误导。此键不影响存储读写。

  // ── 备份/云同步清单（backupStore.js / cloudSync.js）──────────────
  // 已统一从本表 getLocalKeys() 生成，禁止再手写清单（防漂移漏备份）：
  //   backupStore 全量导出；cloudSync 用 SYNC_EXCLUDE 显式排除
  //   （lastOpenedProject / yimao_asset_library / agent_draft / mutiwindow-clipboard）。
  // 新增本表 local 键即自动进入备份与同步。
}

/** 获取所有 localStorage 后端键列表（不含动态键模板、不含已迁移旧键） */
export function getLocalKeys() {
  return Object.entries(STORAGE_KEYS)
    .filter(([, v]) => v.backend === 'local' && !v.migration && !v.pattern)
    .map(([k]) => k)
}

/** 获取所有 KV 后端键模板列表 */
export function getKvKeyPatterns() {
  return Object.entries(STORAGE_KEYS)
    .filter(([, v]) => v.backend === 'kv')
    .map(([k]) => k)
}

/**
 * 错误类型登记区（错误降级/重试的单一事实来源，实现见 genErrors.js classifyError）。
 * ⚠️ 新增错误：先登记 type 与其降级策略，禁止各节点自写 if(/网络错误/) 判断。
 * retryable=true 仅限网络/超时（可自动重试）；业务失败不重试（防封号）。
 */
export const GEN_ERRORS = {
  abort:    { label: '已取消',       retryable: false },
  timeout:  { label: '请求超时',     retryable: true },
  network:  { label: '网络错误',     retryable: true },
  http:     { label: '服务错误',     retryable: false },
  business: { label: '上游业务错误', retryable: false },
}

/**
 * 节点类型登记区（节点「上次参数」记忆 / 节点创建 的单一事实来源）。
 *
 * ⚠️ 新增节点：先在 nodePrefs 的 useNodePrefs(首参) 里用的类型名在此登记；
 *   禁止散落裸字符串当 useNodePrefs 命名空间（拼错跨窗口默认参数会静默失效）。
 *   编译期拦截见 `scripts/check-node-types.mjs`（npm run check:node-types）。
 *
 * 注：值为画布 node.type / useNodePrefs 首参的命名空间字符串；
 *   director3dNode 依赖 WebGL 无法 SSR、ghostTarget 为连线占位，均一并登记。
 */
export const NODE_TYPES = {
  imageNode:          'imageNode',
  imageBoxNode:       'imageBoxNode',
  gridSplitNode:      'gridSplitNode',
  gridMergeNode:      'gridMergeNode',
  panoramaNode:       'panoramaNode',
  director3dNode:     'director3dNode',
  faceMosaicNode:     'faceMosaicNode',
  loopNode:           'loopNode',
  videoExtractNode:   'videoExtractNode',
  videoProcessNode:   'videoProcessNode',
  group:              'group',
  // ScriptBoxNode.data 全部顶层/子字段属画布快照(canvas-state-v1-{projectId})一部分，
  // 禁止独立持久化（防双写漂移）。字段唯一真相源见 src/components/base/scriptBoxSchema.js。
  scriptBoxNode:      'scriptBoxNode',
  textNode:           'textNode',
  promptNode:         'promptNode',
  templateNode:       'templateNode',
  discountVideoNode:  'discountVideoNode',
  ghostTarget:        'ghostTarget',
}

/** 节点类型值集合（check-node-types 比对用） */
export const NODE_TYPE_SET = new Set(Object.values(NODE_TYPES))

/**
 * ════════════════════════════════════════════════════════════════
 * 剧本盒子「分镜端口」契约 —— 跨模块 handle id 的唯一事实来源
 * ════════════════════════════════════════════════════════════════
 *
 * 剧本盒子为每个分镜恒定注册一个 source handle，id 形如 `shot-${shotId}`。
 * 这个字符串是**跨模块契约**，四处独立消费，此前各写各的裸字面量（极易漂移）：
 *
 *   写侧（生成 handle id / 建边）：
 *     ScriptBoxNode.jsx:189   Handle id（渲染注册锚点）
 *     scriptBoxEngine.js:848  setEdges 建「合并视频」下游边
 *     scriptBoxEngine.js:928  setEdges 建「尾帧变体」下游边
 *   读侧（解析 handle id → shotId）：
 *     App.jsx:487             从端口拖出新节点时反查分镜预填参数
 *     useConnectedInputs.js   下游读取时按分镜取 @资产参考图
 *
 * 为什么必须收口：写侧改前缀而读侧没改 → 连线建得上但下游取不到图，
 * 且失败是静默的（find 落空返回空数组，无报错）。故前缀 + 编解码一并登记在此，
 * 消费方只能走 shotHandleId / parseShotHandle，禁止 slice/replace 手写。
 */

/** 分镜端口 handle id 前缀（拼接式：`${SHOT_HANDLE_PREFIX}${shotId}`） */
export const SHOT_HANDLE_PREFIX = 'shot-'

/**
 * 写侧：分镜 id → handle id。
 * @param {string|number} shotId
 * @returns {string} `shot-${shotId}`
 */
export function shotHandleId(shotId) {
  return `${SHOT_HANDLE_PREFIX}${shotId}`
}

/**
 * 读侧：handle id → 分镜 id；非分镜端口返回 null。
 * 按前缀长度截取而非 replace：分镜 id 自身可含 `shot-`（如 `shot-9`），
 * replace 只替换首个匹配会截错（旧实现 App.jsx:487 的 slice 口径是对的，统一按此）。
 * @param {string} [handle]
 * @returns {string|null}
 */
export function parseShotHandle(handle) {
  if (typeof handle !== 'string' || !handle.startsWith(SHOT_HANDLE_PREFIX)) return null
  const id = handle.slice(SHOT_HANDLE_PREFIX.length)
  return id || null
}

/**
 * 前端调用的后端 API 端点（url 路径段）——图片按需出图等 URL 构造处唯一事实来源。
 * 新增/改动端点路径 → 先在此登记，禁止组件散写裸路径字面量。
 * 与下方 apiRegistry 的 ACTIVE 清单一致：/api/files/thumbnail 为前端真实调用端点（envelope: stream）。
 */
export const API_ENDPOINTS = {
  /** 按需出图：GET {API_BASE}/api/files/thumbnail?url=<相对/subfolder/name>&maxDim=&format=
   *   直接返回缩略图二进制（image/*），供 <img src> 直接使用；format 白名单仅 png/jpg/jpeg/gif/bmp/tiff/webp，
   *   Jimp 0.22 无法编码 webp 时后端拒绝回退源扩展名（沿用源扩展名）。 */
  fileThumbnail: '/api/files/thumbnail',
}

/**
 * localTool 后端路由库存档（P0-4 死路由标注）。
 *
 * 目的：避免「前端改完后端炸 / 后端改契约前端无感知」。前端调用的端点集中登记，
 * 后端侧存在但前端【零调用】的端点归类为「预留/上游转发」，改动它们不触发前端回归，
 * 也防止误当 bug 删除。
 *
 * 前端【实际调用】的端点（改动需评估前端契约影响）：
 *   GET/POST /api/status、/api/logs、/api/tasks*、/api/projects*、/api/resources*、
 *   /api/files/*（upload/read/thumbnail/mkdir/move/open/open-dir/list）、
 *   /api/providers*、/api/config/base、/api/kv/*、/api/proxy、/api/agent/:key/chat。
 *   → 见 localToolApi.js / filesApi.js / logger.js / useLocalToolStatus.js / proxyGenerate.js 等。
 *
 * 后端存在、前端【零调用】= 预留/上游转发（勿当死代码删，勿随前后端契约盲改）：
 *   admin.ts： /api/admin/stats、/api/admin/kv-list、/api/admin/clear-cache、
 *              /api/admin/cleanup、/api/admin/export、/api/admin/import
 *   official.ts：/api/user/info、/api/user/model-entitlements、/api/agent/:id/vip-check、
 *              /api/official/entitlements/invalidate
 *   platform.ts：/plugin/manifest.json、/api/workflow-apps/by-project/:id、
 *              /public/platform/builtin、/public/platform/models
 *   passthrough.ts（isLocalOnlyPath 判定后的上游转发补偿用）
 *
 * 注：/api/agent/:key/chat 前端在「未配 provider」时直连 localTool 这一端点；配了 provider
 * 则走 /api/proxy。两端点都是生产路径，改动仍会影响直连链路。
 */
/**
 * 中央端点登记表（apiRegistry）—— 前端函数 ↔ 后端 route 的双向映射唯一真源（docs/26-M2-a/C1）。
 *
 * 【为什么建】早期 `BACKEND_ROUTES` 仅是无 program 化结构的字符串占位（已删除，2026-08-22）。
 * 本表以结构化数据承接
 * 「前端消费点 ↔ 后端 route pattern ↔ method ↔ 信封形状」，供 `scripts/check-api-contract.cjs`
 * 与 `localTool/src/router.ts` 的 `routes` 表正则互检（前端有后端无→warn 白实现；
 * 后端有前端无→info 待补；信封标注与 handler 形态不符→error）。
 *
 * 【形态】每条 = { fn, method, path, envelope, status }
 *  - fn：   前端聚合函数/消费点（localToolApi 导出 / filesApi / pollTask / 组件散落点）
 *  - method：GET/POST/PUT/DELETE（对齐 router.ts routes）
 *  - path：  后端 route pattern（字符串精确或正则源文本，与 router.ts 一致）
 *  - envelope：ok | code-data | items | success-data | raw | stream | sse | probe | stub。
 *       流式/探针/裸值/桩豁免信封检查（stream/sse/raw/probe/stub，check-api-contract 跳过）。
 *  - status：ACTIVE（前端已消费）/ RESERVED（后端有前端零消费，勿当死代码删）。
 *
 * 【纪律】新增端点 → 先在本表登记 + 在 localToolApi/filesApi 加函数（M2-d「加函数+登记」双动作）。
 * 散落点（GeneratedView/AssetLibrary/pollTask）也须登记，即便它们暂走 httpRequest 直拼——
 * 本批只登记定位，B3 再收进薄壳。
 *
 * ⚠️ RESERVED 组（后端已 handle、前端零消费）登记 admin/official/platform/workflow/sync/assets
 *   /batch-save/clear/move/list/jianying，校验脚本标 info 待补，勿误判白实现或误删。
 */
export const apiRegistry = {
  /** tasks 域 */
  fetchTasks:            { fn: 'localToolApi.fetchTasks',            method: 'GET',    path: '/api/tasks',                  envelope: 'code-data', status: 'ACTIVE' },
  saveTask:              { fn: 'localToolApi.saveTask',              method: 'POST',   path: '/api/tasks/save',             envelope: 'code-data', status: 'ACTIVE' },
  batchSaveTasks:        { fn: 'localToolApi.batchSaveTasks',        method: 'POST',   path: '/api/tasks/batch-save',       envelope: 'code-data', status: 'ACTIVE' },
  deleteTask:            { fn: 'localToolApi.deleteTask',            method: 'POST',   path: '/api/tasks/delete',           envelope: 'code-data', status: 'ACTIVE' },
  batchDeleteTasks:      { fn: 'localToolApi.batchDeleteTasks',      method: 'POST',   path: '/api/tasks/batch-delete',     envelope: 'code-data', status: 'ACTIVE' },
  clearAllTasksApi:      { fn: 'localToolApi.clearAllTasksApi',      method: 'POST',   path: '/api/tasks/clear',            envelope: 'code-data', status: 'ACTIVE' },
  /** projects 域 */
  fetchProjects:         { fn: 'localToolApi.fetchProjects',         method: 'GET',    path: '/api/projects',               envelope: 'code-data', status: 'ACTIVE' },
  saveProjects:          { fn: 'localToolApi.saveProjects',          method: 'POST',   path: '/api/projects/save',          envelope: 'code-data', status: 'ACTIVE' },
  /** resources 域 */
  fetchResources:        { fn: 'localToolApi.fetchResources',        method: 'GET',    path: '/api/resources',              envelope: 'code-data', status: 'ACTIVE' },
  rescanResources:       { fn: 'localToolApi.rescanResources',       method: 'POST',   path: '/api/resources/rescan',       envelope: 'code-data', status: 'ACTIVE' },
  deleteResource:        { fn: 'localToolApi.deleteResource',        method: 'POST',   path: '/api/resources/delete',       envelope: 'code-data', status: 'ACTIVE' },
  saveResource:          { fn: 'localToolApi.saveResource',          method: 'POST',   path: '/api/resources/save',         envelope: 'code-data', status: 'ACTIVE' },
  renameResource:        { fn: 'localToolApi.renameResource',        method: 'POST',   path: '/api/resources/rename',       envelope: 'code-data', status: 'ACTIVE' },
  /** files 域（stream 豁免 / 组件散落） */
  openLocalFolder:       { fn: 'localToolApi.openLocalFolder',       method: 'GET',    path: '/api/files/open',             envelope: 'code-data', status: 'ACTIVE' },
  openFileDir:           { fn: 'localToolApi.openFileDir',           method: 'GET',    path: '/api/files/open-dir',         envelope: 'code-data', status: 'ACTIVE' },
  uploadFile:            { fn: 'localToolApi.uploadFile',            method: 'POST',   path: '/api/files/upload',           envelope: 'code-data', status: 'ACTIVE' },
  createFolder:          { fn: 'localToolApi.createFolder',          method: 'POST',   path: '/api/files/mkdir',            envelope: 'code-data', status: 'ACTIVE' },
  fileRead:              { fn: 'filesApi.read (二进制流)',           method: 'GET',    path: '/api/files/read',             envelope: 'stream',   status: 'ACTIVE' },
  fileThumbnail:         { fn: 'API_ENDPOINTS.fileThumbnail',        method: 'GET',    path: '/api/files/thumbnail',        envelope: 'stream',   status: 'ACTIVE' },
  filesMove:             { fn: 'filesApi.move',                      method: 'POST',   path: '/api/files/move',             envelope: 'code-data', status: 'RESERVED' },
  filesList:             { fn: 'filesApi.list',                      method: 'GET',    path: '/api/files/list',             envelope: 'code-data', status: 'RESERVED' },
  /** kv 域（raw 豁免：裸 null/裸值） */
  kvGet:                 { fn: 'localToolApi.kvGet',                 method: 'GET',    path: '/api/kv/get',                 envelope: 'raw',      status: 'ACTIVE' },
  kvSet:                 { fn: 'localToolApi.kvSet',                 method: 'POST',   path: '/api/kv/set',                 envelope: 'code-data', status: 'ACTIVE' },
  kvDelete:              { fn: 'localToolApi.kvDelete',              method: 'POST',   path: '/api/kv/delete',              envelope: 'code-data', status: 'ACTIVE' },
  /** providers 域 */
  getProviders:          { fn: 'localToolApi.providerApi.getProviders',      method: 'GET',  path: '/api/providers',                envelope: 'code-data', status: 'ACTIVE' },
  saveProviders:         { fn: 'localToolApi.providerApi.saveProviders',     method: 'PUT',  path: '/api/providers',                envelope: 'code-data', status: 'ACTIVE' },
  syncConfigBase:        { fn: 'localToolApi.providerApi.syncConfigBase',    method: 'PUT',  path: '/api/config/base',             envelope: 'code-data', status: 'ACTIVE' },
  testConnection:        { fn: 'localToolApi.providerApi.testConnection',    method: 'POST', path: '/api/providers/test-connection', envelope: 'probe',    status: 'ACTIVE' },
  probeAsync:            { fn: 'localToolApi.providerApi.probeAsync',        method: 'POST', path: '/api/providers/probe-async',    envelope: 'probe',    status: 'ACTIVE' },
  fetchModels:           { fn: 'localToolApi.providerApi.fetchModels',       method: 'POST', path: '/api/providers/{id}/fetch-models', envelope: 'code-data', status: 'ACTIVE' },
  /** 代理 / 网关 / 系统 */
  proxy:                 { fn: 'proxyGenerate.__proxyFetch + chatProxy', method: 'POST', path: '/api/proxy',                  envelope: 'sse',      status: 'ACTIVE' },
  gatewayTask:           { fn: 'pollTask.pollOneTask (跨进程)',       method: 'GET',    path: '/api/v1/gateway/task/{id}',   envelope: 'code-data', status: 'ACTIVE' },
  status:                { fn: 'useLocalToolStatus',                  method: 'GET',    path: '/api/status',                 envelope: 'probe',    status: 'ACTIVE' },
  logs:                  { fn: 'logger 上报事件',                      method: 'POST',   path: '/api/logs',                   envelope: 'ok',       status: 'ACTIVE' },
  agentChat:             { fn: 'agentRuntime 直连 localTool A1',       method: 'POST',   path: '/api/agent/{id}/chat',        envelope: 'sse',      status: 'ACTIVE' },
  jianying:              { fn: '(前端零消费)',                          method: 'POST',   path: '/api/jianying/send',          envelope: 'stub',     status: 'RESERVED' },
  /** platform 域（RESERVED：前端零消费——模型源是 providerModels.js 聚合，不走 platform；handler 保留为「自研替换官方」兜底） */
  pluginManifest:        { fn: '(前端零消费·未实现)',                  method: 'GET',    path: '/plugin/manifest.json',       envelope: 'code-data', status: 'RESERVED' },
  builtin:               { fn: '(前端零消费·模型走 providerModels.js)', method: 'GET', path: '/api/public/platform/builtin', envelope: 'success-data', status: 'RESERVED' },
  models:                { fn: '(前端零消费·模型走 providerModels.js)', method: 'GET', path: '/api/public/platform/models', envelope: 'success-data', status: 'RESERVED' },
  workflowApps:          { fn: '(前端零消费)',                          method: 'GET',    path: '/api/workflow-apps/by-project/{id}', envelope: 'stub', status: 'RESERVED' },
  /** 官方权益转发（RESERVED：前端直连官方，本层就绪未接管） */
  officialUser:          { fn: '(前端零消费·直连官方)',                method: 'GET',    path: '/api/user/info',               envelope: 'code-data', status: 'RESERVED' },
  officialEntitlements:  { fn: '(前端零消费·直连官方)',                method: 'GET',    path: '/api/user/model-entitlements', envelope: 'code-data', status: 'RESERVED' },
  officialVipCheck:      { fn: '(前端零消费·直连官方)',                method: 'GET',    path: '/api/agent/{id}/vip-check',   envelope: 'code-data', status: 'RESERVED' },
  officialInvalidate:    { fn: '(前端零消费)',                          method: 'POST',   path: '/api/official/entitlements/invalidate', envelope: 'code-data', status: 'RESERVED' },
  /** admin 域（RESERVED） */
  adminStats:            { fn: '(前端零消费)',                          method: 'GET',    path: '/api/admin/stats',            envelope: 'code-data', status: 'RESERVED' },
  adminKvList:           { fn: '(前端零消费)',                          method: 'GET',    path: '/api/admin/kv-list',          envelope: 'code-data', status: 'RESERVED' },
  adminClearCache:       { fn: '(前端零消费)',                          method: 'POST',   path: '/api/admin/clear-cache',      envelope: 'code-data', status: 'RESERVED' },
  adminCleanup:          { fn: '(前端零消费)',                          method: 'POST',   path: '/api/admin/cleanup',          envelope: 'code-data', status: 'RESERVED' },
  adminExport:           { fn: '(前端零消费)',                          method: 'GET',    path: '/api/admin/export',           envelope: 'code-data', status: 'RESERVED' },
  adminImport:           { fn: '(前端零消费)',                          method: 'POST',   path: '/api/admin/import',           envelope: 'code-data', status: 'RESERVED' },
  /** 其余 RESERVED */
  syncDefault:           { fn: '(前端零消费)',                          method: 'GET',    path: '/api/sync/default',           envelope: 'code-data', status: 'RESERVED' },
  assetsUpload:          { fn: '(别名 handler=handleUpload)',          method: 'POST',   path: '/api/assets/upload',          envelope: 'code-data', status: 'RESERVED' },
  uploadAppAsset:        { fn: '(别名 handler=handleUpload)',          method: 'POST',   path: '/api/upload/app-asset',       envelope: 'code-data', status: 'RESERVED' },
  resourcesBatchSave:    { fn: '(前端零消费)',                          method: 'POST',   path: '/api/resources/batch-save',   envelope: 'code-data', status: 'RESERVED' },
  resourcesClear:        { fn: '(前端零消费)',                          method: 'POST',   path: '/api/resources/clear',        envelope: 'code-data', status: 'RESERVED' },
}

/** apiRegistry 的 path 集合（check-api-contract 与后端 routes 互检用） */
export const API_REGISTRY_PATHS = Object.values(apiRegistry).map((e) => e.path)
