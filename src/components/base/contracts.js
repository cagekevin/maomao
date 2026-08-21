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
 * 前端调用的后端 API 端点（url 路径段）——图片按需出图等 URL 构造处唯一事实来源。
 * 新增/改动端点路径 → 先在此登记，禁止组件散写裸路径字面量。
 * 与 BACKEND_ROUTES 的 ACTIVE 清单一致：/api/files/thumbnail 为前端真实调用端点。
 */
export const API_ENDPOINTS = {
  /** 按需出图：GET {API_BASE}/api/files/thumbnail?url=<相对/subfolder/name>&maxDim=&format=
   *   返回 { thumbnailUrl }。render 显示链路经此取小图；format 白名单仅 png/jpg/jpeg/gif/bmp/tiff，
   *   Jimp 0.22 无法编码 webp，禁传（前端已钳制，后端亦拒绝回退源扩展名）。 */
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
export const BACKEND_ROUTES = {
  /** 前端真实调用、改动需评估前端契约的端点（见上注释清单） */
  ACTIVE: 'localTool routes/* 中 frontend 实际使用集合',
  /** 后端预留 / 上游转发端点（admin/official/platform/passthrough），前端零调用 */
  RESERVED: 'admin.ts official.ts platform.ts passthrough.ts 中 frontend 零调用集合',
}
