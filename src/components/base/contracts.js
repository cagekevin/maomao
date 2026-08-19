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
 * 事件注册表（通信层 eventBus 的单一事实来源）。
 *
 * 每项：
 *   key  = 事件名（统一「领域:动作」）
 *   from = 发布方（文件:行）
 *   to   = 订阅方（文件:行，null/[] 表示当前无订阅方）
 *   payload = 载荷结构（约定）
 *   note = 用途/状态
 *
 * 来源：`grep -rn "publish('" src/components` 提取，2026-08-17 核对。
 */
export const EVENTS = {
  'agent:task-completed': {
    from: ['taskStore.js:191', 'pollTask.js:80'],
    to: ['useNodeGeneration.js:163'],
    payload: '{ taskId, nodeId, resultUrl, type, status: "completed" }',
    note: '任务完成 → 精准回填节点（刷新不丢图）。生产使用',
  },
  'presets-changed': {
    from: ['promptManager.js:88'],
    to: ['PromptLibrary.jsx:40'],
    payload: '{ presets }',
    note: '提示词库跨节点同步。生产使用',
  },
  'project:import': {
    from: ['ProjectSelector.jsx:103'],
    to: ['App.jsx'],
    payload: '{}',
    note: '导入按钮 → App 处理文件。生产使用（订阅方写法非 subscribe 字面量，待核对）',
  },
  'project:export': {
    from: ['ProjectSelector.jsx:107'],
    to: ['App.jsx'],
    payload: '{}',
    note: '导出按钮 → App 下载。生产使用',
  },
  'agent:workflow-status': {
    from: ['workflowRuntime.js:66'],
    to: [], // 预留，无订阅方（勿当 bug 删）
    payload: '{ workflowId, conversationId, status }',
    note: '工作流状态广播。⚠️ 预留广播',
  },
  'agent:workflow-confirmed': {
    from: ['workflowRuntime.js:123'],
    to: [], // 预留，无订阅方
    payload: '{ workflowId, conversationId }',
    note: '策划确认广播。⚠️ 预留广播',
  },
  'persist:failed': {
    from: ['storageAdapter.js:28'],
    to: [], // 订阅方待核对
    payload: '{ key, error }',
    note: '持久化失败广播（sSet/sRemove 失败）。订阅方需核对是否存在',
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
    note: '画布快照：{ nodes, edges }。跨端共享，走 localTool KV',
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
    note: '应用设置：{ performanceMode, minimapOn, agentOpen }',
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
    backend: 'local',
    note: '多开账号环境列表 [{id, name, siteName, siteUrl, avatar, cookies}]',
  },

  // ── AI 会话（conversationStore）────────────────────────────────────
  'agent_conversations_{agentKey}': {
    domain: 'agent',
    store: 'conversationStore.js',
    backend: 'local',
    pattern: true,
    note: 'AI 会话列表（按 agentKey 隔离，如 canvas-assistant-{projectId}）',
  },
  'agent_active_conversation_id_{agentKey}': {
    domain: 'agent',
    store: 'conversationStore.js',
    backend: 'local',
    pattern: true,
    note: '当前活跃会话 id（按 agentKey 隔离）',
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

  // ── 3D 导演台（director3d）【原生 localStorage 直写】───────────────
  'storyai-3d-director-local-model-library': {
    domain: 'director3d',
    store: 'directorStore.ts',
    backend: 'native',
    note: '3D 本地模型库数据',
  },
  'storyai-3d-director-desk-demo': {
    domain: 'director3d',
    store: 'directorStore.ts',
    backend: 'native',
    note: '3D 场景快照数据',
  },
  hideFromViewportCapture: {
    domain: 'director3d',
    store: 'SceneRoot.tsx / DirectorCanvas.tsx',
    backend: 'native',
    note: '视口捕获隐藏标记',
  },

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
